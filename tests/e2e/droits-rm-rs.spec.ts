import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { peut, peutPleinement } from "@/lib/auth/habilitations";
import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";

import {
  COMPTE_RM_EPREUVE,
  COMPTE_RS_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";

/**
 * 9D4-E2E-COMPTES-RM-RS — CE QUE `responsable_materiel` ET `responsable_sav`
 * VOIENT RÉELLEMENT, PAR L'ÉCRAN.
 *
 * ## Pourquoi ce fichier, et pas un test unitaire de plus
 *
 * `tests/unit/auth/habilitations.test.ts` éprouve la MATRICE en isolation :
 * il ne peut pas prouver qu'un compte RÉEL, connecté par l'écran, voit bien
 * ce que `peut()`/`peutPleinement()` disent — c'est-à-dire la chaîne entière
 * (session, porte, écran, route). Avant ce ticket, aucune identité
 * `responsable_materiel` ni `responsable_sav` n'existait dans la scène e2e :
 * aucun scénario ne pouvait se connecter sous ces deux rôles (constats des
 * relectures de 9DG R1 et de 9DH).
 *
 * ## Ce que chaque ligne cite, jamais un attendu inventé
 *
 * Chaque attendu est lu DANS LA MATRICE (`lib/auth/habilitations.ts`), par
 * les mêmes fonctions `peut`/`peutPleinement` que l'écran appelle — jamais un
 * booléen recopié à la main, qui divergerait en silence le jour où D152/D153
 * se rouvre (§9, 01/09).
 *
 * ## Les deux comptes, et leur mot de passe
 *
 * `COMPTE_RM_EPREUVE` / `COMPTE_RS_EPREUVE` (`tests/e2e/setup/scene.ts`) —
 * ouverts par la scène elle-même (`ecrireLesComptesRmEtRs`), jamais par le
 * semis. Ni l'un ni l'autre n'est un rôle sensible
 * (`ROLES_SECOND_FACTEUR_OBLIGATOIRE`, `lib/auth/roles.ts`) : la connexion ne
 * traverse donc pas `/enrolement`, comme pour `adv` ou le technicien de
 * l'épreuve.
 */

const ROLES_EPREUVE = [
  { email: COMPTE_RM_EPREUVE, role: Role.responsable_materiel, nom: "rm" },
  { email: COMPTE_RS_EPREUVE, role: Role.responsable_sav, nom: "rs" },
] as const;

/**
 * Le site « Atelier sous contrat (démonstration) » (`prisma/seed-data.ts`,
 * CONTRAT-SITE-1, id fixe) — SEUL site du jeu de démonstration dont
 * `sous_contrat` est vrai. Lu ici en lecture seule, jamais écrit : la scène
 * n'a besoin d'aucune fixture propre pour ce constat.
 */
const SITE_SOUS_CONTRAT_ID = "0192f0a0-4000-7000-8000-000000000005";

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9D4-E2E-COMPTES-RM-RS/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}.png`),
    fullPage: true,
  });
}

/**
 * CONNEXION ORDINAIRE — ni RM ni RS n'est un rôle sensible (voir l'en-tête du
 * fichier) : même geste que `ouvrirUneSession` (`tests/e2e/setup/
 * session.ts`), paramétré par le courriel plutôt que figé sur `adv`.
 */
async function connecter(page: Page, email: string): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(email);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/planning/);
}

async function porteDuHub(
  page: Page,
  chemin: string,
  attendue: boolean,
): Promise<void> {
  await expect(page.locator(`a[href="${chemin}"]`)).toHaveCount(
    attendue ? 1 : 0,
  );
}

for (const { email, role, nom } of ROLES_EPREUVE) {
  test.describe(`${nom} (${email})`, () => {
    test("voit le planning et le registre en accès complet (habilitations.ts : consulter_planning, modifier_planning — complet pour RM/RS)", async ({
      page,
    }) => {
      // Attendu lu dans la matrice, pas inventé.
      expect(peutPleinement(role, "consulter_planning")).toBe(true);
      expect(peutPleinement(role, "modifier_planning")).toBe(true);

      await connecter(page, email);
      await expect(page.getByText(fr["auth.refus_droit"])).toHaveCount(0);

      // Le registre complet (`/interventions`) exige le ● sur
      // `consulter_planning` (D152, point 3) — pas seulement `peut()`.
      await page.goto("/interventions");
      await expect(page.getByText(fr["auth.refus_droit"])).toHaveCount(0);
    });

    test("voit « Sous contrat » sur /sites/[id] (CONTRAT-SITE-1, app/(back-office)/sites/[id]/page.tsx : visible de tout rôle qui atteint la fiche)", async ({
      page,
    }) => {
      // `consulter_clients_sites` ouvre la fiche (D153, habilitations.ts).
      expect(peut(role, "consulter_clients_sites")).toBe(true);

      await connecter(page, email);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/sites/${SITE_SOUS_CONTRAT_ID}`);
      await expect(page.getByText(fr["auth.refus_droit"])).toHaveCount(0);
      // ADAPTÉ (D191, 9EF-TP-UX4-2-FICHES-1) — la pastille d'en-tête porte
      // désormais « Sous contrat » (`sites.badge_sous_contrat`), jamais le
      // libellé complet du champ (`site.sous_contrat`, réservé au formulaire
      // derrière `?edition=site`) : même fait, visible de tout rôle qui
      // atteint la fiche, lu dans le titre.
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        fr["sites.badge_sous_contrat"],
      );
      await capturer(page, `site-sous-contrat-${nom}-1280`);

      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`/sites/${SITE_SOUS_CONTRAT_ID}`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        fr["sites.badge_sous_contrat"],
      );
      await capturer(page, `site-sous-contrat-${nom}-375`);
    });

    test("le hub /parametres n'offre que les portes que la matrice ouvre (D153, lib/navigation/portes-parametrage.ts)", async ({
      page,
    }) => {
      await connecter(page, email);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/parametres");
      await capturer(page, `parametres-hub-${nom}-1280`);

      // Aucune `capacite` sur ces trois portes (lecture ouverte à tout rôle
      // non technicien) : RM et RS, non techniciens, les voient toujours.
      await porteDuHub(page, "/parametres/agences", true);
      await porteDuHub(page, "/parametres/materiel", true);
      await porteDuHub(page, "/parametres/prestations", true);

      // habilitations.ts : voir_montants_vente complet pour RM/RS → la porte
      // des tarifs (lue en OU avec parametrer_societe) reste ouverte.
      const lectureTarifs =
        peut(role, "parametrer_societe") || peut(role, "voir_montants_vente");
      expect(lectureTarifs).toBe(true);
      await porteDuHub(page, "/parametres/taux-horaire", lectureTarifs);
      await porteDuHub(page, "/parametres/forfaits", lectureTarifs);

      // habilitations.ts : regler_trajets — aucun pour RM/RS (D153, PA-25).
      expect(peut(role, "regler_trajets")).toBe(false);
      await porteDuHub(page, "/parametres/trajets", false);

      // habilitations.ts : administrer_utilisateurs — aucun pour RM/RS.
      expect(peut(role, "administrer_utilisateurs")).toBe(false);
      await porteDuHub(page, "/parametres/equipe", false);
      await porteDuHub(page, "/parametres/habilitations", false);

      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/parametres");
      await capturer(page, `parametres-hub-${nom}-375`);
    });

    test("tarifs (taux horaire) : lecture ouverte, écriture refusée à l'écran ET au serveur (D153 PA-02, habilitations.ts : parametrer_societe aucun pour RM/RS)", async ({
      page,
    }) => {
      // Attendu lu dans la matrice : RM/RS lisent (voir_montants_vente),
      // n'écrivent pas (parametrer_societe refusé par `exigerCapaciteComplete`).
      expect(peut(role, "voir_montants_vente")).toBe(true);
      expect(peutPleinement(role, "parametrer_societe")).toBe(false);

      await connecter(page, email);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/parametres/taux-horaire");
      await expect(page.getByText(fr["auth.refus_droit"])).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: fr["taux_horaire.poser"] }),
      ).toHaveCount(0);
      await capturer(page, `parametres-taux-horaire-${nom}-1280`);

      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/parametres/taux-horaire");
      await capturer(page, `parametres-taux-horaire-${nom}-375`);

      // Le serveur refuse aussi — même route que l'écran, forgée directement.
      const reponse = await page.request.post(
        "/api/parametres/taux-horaire/creer",
        {
          form: {
            montant_mineur: "7500",
            date_effet: "2030-01-01",
            confirme: "oui",
          },
          maxRedirects: 0,
        },
      );
      expect(reponse.status()).toBe(303);
      expect(reponse.headers()["location"] ?? "").toContain(
        "motif=auth.refus_droit",
      );
    });

    test("agences : lecture ouverte, écriture refusée à l'écran ET au serveur (habilitations.ts : administrer_agences complet pour admin_societe seul)", async ({
      page,
    }) => {
      expect(peut(role, "administrer_agences")).toBe(false);

      await connecter(page, email);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/parametres/agences");
      await expect(page.getByText(fr["auth.refus_droit"])).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: fr["agence.creer"] }),
      ).toHaveCount(0);
      await capturer(page, `parametres-agences-${nom}-1280`);

      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/parametres/agences");
      await capturer(page, `parametres-agences-${nom}-375`);

      const reponse = await page.request.post("/api/parametres/agences/creer", {
        form: {
          code: "FORGE-9D4",
          libelle: "Agence forgée par l'épreuve",
          territoire: "nouvelle_caledonie",
        },
        maxRedirects: 0,
      });
      expect(reponse.status()).toBe(303);
      expect(reponse.headers()["location"] ?? "").toContain(
        "motif=auth.refus_droit",
      );
    });

    test("trajets : refus entier (habilitations.ts : regler_trajets aucun pour RM/RS, D153 PA-25)", async ({
      page,
    }) => {
      expect(peut(role, "regler_trajets")).toBe(false);

      await connecter(page, email);
      await page.goto("/parametres/trajets");
      await expect(page.getByText(fr["auth.refus_droit"])).toBeVisible();
    });

    test("équipe et habilitations : refus entier (habilitations.ts : administrer_utilisateurs aucun pour RM/RS)", async ({
      page,
    }) => {
      expect(peut(role, "administrer_utilisateurs")).toBe(false);

      await connecter(page, email);
      await page.goto("/parametres/equipe");
      await expect(page.getByText(fr["auth.refus_droit"])).toBeVisible();

      await page.goto("/parametres/habilitations");
      await expect(page.getByText(fr["auth.refus_droit"])).toBeVisible();
    });
  });
}
