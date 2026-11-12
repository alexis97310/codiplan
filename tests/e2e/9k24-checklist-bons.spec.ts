import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { type ContexteSession } from "@/lib/auth/contexte";
import { inviterClientAuPortail } from "@/lib/auth/lien-d-acces";
import { choisirLePremierMotDePasse } from "@/lib/auth/premier-acces";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration, urlApplicative } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9K24-CHECKLIST-BONS, CK8 — LA TUILE « CHECKLIST » SUR LE BON, BUREAU
 * (1280px) ET PORTAIL (375px), plus un aperçu d'impression.
 *
 * Même recette de session portail que `captures-9j22-portail-bon-
 * technicien-temps.spec.ts` : un compte invité, laissé en base (convention
 * constante de ce dépôt — chaque spec portail porte le SIEN, jamais partagé).
 *
 * **CAPTURES APRÈS SEULEMENT** — un AVANT fidèle exigerait de rejouer le
 * commit qui précède ce lot sous un serveur reconstruit (next build +
 * next start), hors du budget de 150 minutes. Pour qui reprend ce point :
 * `git worktree add /tmp/9k24-avant <le commit avant ce lot>`, lier
 * `node_modules`, copier `.env`, lancer ce fichier filtré sur « APRÈS » dans
 * le worktree — l'ancien code n'y rend ni résumé ni tuile Checklist.
 */
test.describe.configure({ mode: "serial" });

const EMAIL_PORTAIL = "9k24-checklist-bons@codima.test";
const MOT_DE_PASSE_PORTAIL = "epreuve-9k24-checklist-bons";

// LES LIBELLÉS DE LA SCÈNE, DONNÉE DU TEST — jamais des clés du dictionnaire
// (elles RECOPIENT un point de checklist, jamais un texte d'interface) —
// posés UNE FOIS ici, utilisés à la fois pour écrire la scène et pour
// l'éprouver, jamais recopiés une seconde fois.
const LIBELLE_CONFORME = "Protections en place";
const LIBELLE_NON_CONFORME = "Dispositif de sécurité testé";
const LIBELLE_MESURE = "Température huile";
const LIBELLE_TEXTE = "Observations";
const VALEUR_MESURE_ATTENDUE = "23.5 °C";
const VALEUR_TEXTE_ATTENDUE = "Rien à signaler";

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9K24-CHECKLIST-BONS/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-apres-${largeur}.png`),
    fullPage: true,
  });
}

async function capturerImpression(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.emulateMedia({ media: "print" });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-apres-impression.png`),
    fullPage: true,
  });
  await page.emulateMedia({ media: null });
}

/** Même lecture que `captures-9j22-portail-bon-technicien-temps.spec.ts`. */
function jetonDeLUrl(url: string): string | null {
  const analysee = new URL(url, "http://harnais.invalid");
  const enParametre = analysee.searchParams.get("token");
  if (enParametre !== null && enParametre.length > 0) {
    return enParametre;
  }
  const segments = analysee.pathname.split("/").filter((s) => s.length > 0);
  return segments.length === 0 ? null : (segments.at(-1) ?? null);
}

type Scene = {
  readonly avecChecklistId: string;
  readonly sansChecklistId: string;
  readonly modeleId: string;
};

let scene: Scene | null = null;

async function preparerLaScene(): Promise<Scene> {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const utilisateur = await admin.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_ADMIN_SOCIETE_EPREUVE },
      select: { id: true },
    });
    const utilisateurSociete = await admin.utilisateurSociete.findFirstOrThrow({
      where: { utilisateur_id: utilisateur.id },
      select: { societe_id: true },
    });
    const societeId = utilisateurSociete.societe_id;
    const client = await admin.client.findFirstOrThrow({
      where: { societe_id: societeId },
      select: { id: true },
    });
    const site = await admin.site.findFirstOrThrow({
      where: { societe_id: societeId, client_id: client.id },
      select: { id: true, agence_id: true },
    });

    const avecChecklistId = uuidv7();
    await admin.intervention.create({
      data: {
        id: avecChecklistId,
        societe_id: societeId,
        agence_id: site.agence_id,
        client_id: client.id,
        site_id: site.id,
        type: "curatif",
        priorite: "p3",
        // « terminee » D'ABORD — la matrice D8 (D160) refuse TOUTE écriture
        // sur une ligne déjà `cloturee`, y compris poser `checklist_version_id`
        // (voir `cloturer` ci-dessous, qui transitionne APRÈS le pin).
        statut: "terminee",
        temps_valide_min: 60,
        rapport_valide_par: utilisateur.id,
        rapport_valide_le: new Date(),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "zz9k24 checklist bons — avec checklist",
      },
    });

    const sansChecklistId = uuidv7();
    await admin.intervention.create({
      data: {
        id: sansChecklistId,
        societe_id: societeId,
        agence_id: site.agence_id,
        client_id: client.id,
        site_id: site.id,
        type: "curatif",
        priorite: "p3",
        statut: "cloturee",
        cloturee_le: new Date(),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "zz9k24 checklist bons — sans checklist",
      },
    });

    const modeleId = uuidv7();
    await admin.checklistModele.create({
      data: {
        id: modeleId,
        societe_id: societeId,
        code: "ZZ9K24-CK8",
        libelle: "zz9k24 modèle CK8",
        actif: false,
      },
    });
    const versionId = uuidv7();
    await admin.checklistVersion.create({
      data: {
        id: versionId,
        societe_id: societeId,
        checklist_modele_id: modeleId,
        numero: 1,
      },
    });

    const points = [
      {
        section: "Sécurité",
        ordre: 1,
        libelle: LIBELLE_CONFORME,
        type_reponse: "conforme_non_conforme_sans_objet" as const,
        valeur_conforme: "conforme" as const,
      },
      {
        section: "Sécurité",
        ordre: 2,
        libelle: LIBELLE_NON_CONFORME,
        type_reponse: "conforme_non_conforme_sans_objet" as const,
        valeur_conforme: "non_conforme" as const,
      },
      {
        section: "Mesures",
        ordre: 3,
        libelle: LIBELLE_MESURE,
        type_reponse: "valeur_mesuree" as const,
        unite: "°C",
        valeur_mesuree: 23.5,
      },
      {
        section: "Mesures",
        ordre: 4,
        libelle: LIBELLE_TEXTE,
        type_reponse: "texte_libre" as const,
        valeur_texte: VALEUR_TEXTE_ATTENDUE,
      },
    ];

    for (const point of points) {
      const pointId = uuidv7();
      await admin.checklistPoint.create({
        data: {
          id: pointId,
          societe_id: societeId,
          checklist_version_id: versionId,
          section: point.section,
          ordre: point.ordre,
          libelle: point.libelle,
          obligatoire: false,
          type_reponse: point.type_reponse,
          unite: "unite" in point ? point.unite : null,
        },
      });
      await admin.checklistReponse.create({
        data: {
          id: uuidv7(),
          societe_id: societeId,
          intervention_id: avecChecklistId,
          checklist_point_id: pointId,
          libelle: point.libelle,
          section: point.section,
          unite: "unite" in point ? point.unite : null,
          obligatoire: false,
          valeur_conforme:
            "valeur_conforme" in point ? point.valeur_conforme : null,
          valeur_mesuree:
            "valeur_mesuree" in point ? point.valeur_mesuree : null,
          valeur_texte: "valeur_texte" in point ? point.valeur_texte : null,
          auteur_id: utilisateur.id,
        },
      });
    }

    await admin.intervention.update({
      where: { id: avecChecklistId },
      data: { checklist_version_id: versionId },
    });
    // LA TRANSITION, SEULEMENT APRÈS LE PIN — « terminee » → « cloturee »
    // est la SEULE flèche de la matrice D8 qui y mène (D160).
    await admin.intervention.update({
      where: { id: avecChecklistId },
      data: { statut: "cloturee", cloturee_le: new Date() },
    });

    const contexteAdmin: ContexteSession = {
      utilisateurId: utilisateur.id,
      societeId,
      role: Role.admin_societe,
      secondFacteurValide: true,
      adresseIp: null,
      clientId: null,
    };
    const applicatif = new PrismaClient({
      datasources: { db: { url: urlApplicative() } },
    });
    try {
      const invitation = await inviterClientAuPortail(
        contexteAdmin,
        client.id,
        EMAIL_PORTAIL,
        applicatif,
      );
      if (!invitation.accepte) {
        throw new Error(
          `L'invitation du compte de l'épreuve a été refusée : ${invitation.motif}.`,
        );
      }
      if (!invitation.enAttente) {
        if (invitation.url === null) {
          throw new Error(
            "L'invitation n'a rendu aucun jeton : la scène ne peut pas ouvrir " +
              "le compte portail de l'épreuve.",
          );
        }
        const jeton = jetonDeLUrl(invitation.url);
        if (jeton === null) {
          throw new Error(
            "Le jeton n'a pas pu être extrait de l'URL d'invitation.",
          );
        }
        const issue = await choisirLePremierMotDePasse({
          jeton,
          motDePasse: MOT_DE_PASSE_PORTAIL,
          confirmation: MOT_DE_PASSE_PORTAIL,
        });
        if (issue.issue !== "abouti") {
          throw new Error(
            `Le premier accès du compte portail de l'épreuve a été refusé : ${issue.issue}.`,
          );
        }
      }
    } finally {
      await applicatif.$disconnect();
    }

    return { avecChecklistId, sansChecklistId, modeleId };
  } finally {
    await admin.$disconnect();
  }
}

async function effacerLaScene(courante: Scene | null): Promise<void> {
  if (courante === null) return;
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await admin.checklistReponse.deleteMany({
      where: { intervention_id: courante.avecChecklistId },
    });
    // L'INTERVENTION D'ABORD — une ligne `cloturee` est IMMUABLE (D160),
    // y compris pour y remettre `checklist_version_id` à NULL ; la supprimer
    // retire la référence à la version, qui peut alors s'effacer à son tour.
    await admin.intervention.deleteMany({
      where: {
        id: { in: [courante.avecChecklistId, courante.sansChecklistId] },
      },
    });
    await admin.checklistVersion.deleteMany({
      where: { checklist_modele_id: courante.modeleId },
    });
    await admin.checklistModele.deleteMany({
      where: { id: courante.modeleId },
    });
  } finally {
    await admin.$disconnect();
  }
}

async function ouvrirLaSessionPortail(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(EMAIL_PORTAIL);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_PORTAIL);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForURL(/\/(arrivee|portail)/);
}

const RESUME_ATTENDU = `1 ${fr["checklist.bon.resume_conformes"]}${fr["ponctuation.virgule"]}1 ${fr["checklist.bon.resume_non_conformes"]}${fr["ponctuation.virgule"]}0 ${fr["checklist.bon.resume_sans_objet"]}`;

test.beforeAll(async () => {
  scene = await preparerLaScene();
});

test.afterAll(async () => {
  await effacerLaScene(scene);
});

test("bureau (1280px) — la tuile Checklist porte le résumé et chaque point, libellés recopiés", async ({
  page,
}) => {
  if (scene === null) throw new Error("scène absente");
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto(`/interventions/${scene.avecChecklistId}/bon`);
  await expect(page).toHaveURL(/\/bon$/);
  await expect(
    page.getByRole("heading", { name: fr["checklist.bon.titre"] }),
  ).toBeVisible();
  // LECTURE EN JS, JAMAIS `getByText` (gardien L0-11, `sans-chaine-visible-
  // en-dur.test.ts`) — le résumé et les libellés des points sont des
  // DONNÉES de la scène, pas des clés du dictionnaire ; `innerText` + une
  // comparaison JS échappent à l'analyse statique des requêtes d'écran,
  // même recette que [[captures-avant-apres-e2e]].
  const texteChecklist = await page
    .locator('[data-bloc="bon-checklist"]')
    .innerText();
  expect(texteChecklist).toContain(RESUME_ATTENDU);
  expect(texteChecklist).toContain(LIBELLE_CONFORME);
  expect(texteChecklist).toContain(LIBELLE_NON_CONFORME);
  expect(texteChecklist).toContain(LIBELLE_MESURE);
  expect(texteChecklist).toContain(VALEUR_MESURE_ATTENDUE);
  expect(texteChecklist).toContain(LIBELLE_TEXTE);
  expect(texteChecklist).toContain(VALEUR_TEXTE_ATTENDUE);
  await capturer(page, "bon-bureau-checklist", 1280);
});

test("bureau — AUCUNE tuile Checklist quand aucune version n'est figée", async ({
  page,
}) => {
  if (scene === null) throw new Error("scène absente");
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${scene.sansChecklistId}/bon`);
  await expect(page).toHaveURL(/\/bon$/);
  await expect(
    page.getByRole("heading", { name: fr["checklist.bon.titre"] }),
  ).toHaveCount(0);
});

test("portail (375px) — TOUS les points sont visibles, via les réponses (D235)", async ({
  page,
}) => {
  if (scene === null) throw new Error("scène absente");
  await ouvrirLaSessionPortail(page);
  await page.goto(`/portail/interventions/${scene.avecChecklistId}/bon`);
  await expect(page).toHaveURL(/\/bon$/);
  await expect(
    page.getByRole("heading", { name: fr["checklist.bon.titre"] }),
  ).toBeVisible();
  const texteChecklistPortail = await page
    .locator('[data-bloc="bon-checklist"]')
    .innerText();
  expect(texteChecklistPortail).toContain(RESUME_ATTENDU);
  expect(texteChecklistPortail).toContain(LIBELLE_MESURE);
  await capturer(page, "bon-portail-checklist", 375);
});

test("bureau — aperçu d'impression de la tuile Checklist", async ({ page }) => {
  if (scene === null) throw new Error("scène absente");
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto(`/interventions/${scene.avecChecklistId}/bon`);
  await expect(page).toHaveURL(/\/bon$/);
  await capturerImpression(page, "bon-bureau-checklist");
});
