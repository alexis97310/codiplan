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

/**
 * LES CAPTURES ET L'ÉPREUVE DE 9J08B-PORTAIL-TEMPS-PAR-ETAT (CLI-2.4) — même
 * recette que `captures-9j07-portail-intervention-etat.spec.ts` pour
 * l'ouverture de session portail, et que `captures-9j08a-historique-des-
 * etats.spec.ts` pour produire un historique à PLUSIEURS transitions par de
 * vrais `UPDATE` SQL (le déclencheur pose une ligne par changement réel,
 * jamais une ligne fabriquée à la main).
 *
 * **UNE DEMANDE ET UNE INTERVENTION DÉDIÉES**, sur un client et un site
 * dédiés (comme 9J08A) — jamais le client de démonstration partagé par
 * d'autres specs de captures, pour que les deux transitions de la demande
 * soient entièrement attribuables à cette scène.
 *
 * **LA DEMANDE CHANGE DEUX FOIS D'ÉTAT** (`nouvelle` → `qualifiee` →
 * `transformee`) : c'est elle qui prouve, à l'écran, qu'un historique à
 * PLUSIEURS transitions affiche bien PLUSIEURS durées — pas seulement « au
 * moins une ».
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9J08B ?? "";
const EMAIL_PORTAIL = "9j08b-portail-temps-par-etat@codima.test";
const MOT_DE_PASSE_PORTAIL = "epreuve-9j08b-portail-temps-par-etat";

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_ID = uuidv7();
const DEMANDE_ID = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

/** Même lecture que `tests/e2e/setup/scene.ts` : l'URL est relative, et la
 * bibliothèque met le jeton tantôt en paramètre, tantôt en segment de chemin. */
function jetonDeLUrl(url: string): string | null {
  const analysee = new URL(url, "http://harnais.invalid");
  const enParametre = analysee.searchParams.get("token");
  if (enParametre !== null && enParametre.length > 0) {
    return enParametre;
  }
  const segments = analysee.pathname.split("/").filter((s) => s.length > 0);
  return segments.length === 0 ? null : (segments.at(-1) ?? null);
}

async function preparerLaScene(): Promise<void> {
  const client = admin();
  try {
    const utilisateur = await client.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_ADMIN_SOCIETE_EPREUVE },
      select: { id: true },
    });
    const utilisateurSociete = await client.utilisateurSociete.findFirstOrThrow(
      {
        where: { utilisateur_id: utilisateur.id },
        select: { societe_id: true },
      },
    );
    const societeId = utilisateurSociete.societe_id;
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societeId,
        raison_sociale: "zz9J08B-Client (captures)",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "zz9J08B-Lieu (captures)",
      },
    });

    // L'INTERVENTION — deux transitions RÉELLES, l'état courant reste OUVERT
    // (« en_cours »), même recette que 9J08A.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "date_planifiee", "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'planifiee', now() - interval '3 days', 60, now())`,
      INTERVENTION_ID,
      societeId,
      CLIENT_ID,
      SITE_ID,
      agence.id,
    );
    for (const statut of ["affectee", "en_cours"]) {
      await client.$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = $1::"StatutIntervention" WHERE "id" = $2::uuid`,
        statut,
        INTERVENTION_ID,
      );
    }

    // LA DEMANDE — deux transitions RÉELLES (`nouvelle` → `qualifiee` →
    // `transformee`) : l'état courant reste OUVERT.
    await client.$executeRawUnsafe(
      `INSERT INTO "demande"
         ("id", "societe_id", "source", "client_id", "site_id", "agence_id",
          "description", "depose_le", "compteur_accuse_le", "modifie_le")
       VALUES ($1::uuid, $2::uuid, 'portail', $3::uuid, $4::uuid, $5::uuid,
               'Bruit anormal au démarrage (capture 9J08B)', now(), now(), now())`,
      DEMANDE_ID,
      societeId,
      CLIENT_ID,
      SITE_ID,
      agence.id,
    );
    for (const statut of ["qualifiee", "transformee"]) {
      await client.$executeRawUnsafe(
        `UPDATE "demande" SET "statut" = $1::"StatutDemande" WHERE "id" = $2::uuid`,
        statut,
        DEMANDE_ID,
      );
    }

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
        CLIENT_ID,
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
  } finally {
    await client.$disconnect();
  }
}

async function effacerLaScene(): Promise<void> {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_ID,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "demande" WHERE "client_id" = $1::uuid`,
      CLIENT_ID,
    );
    // LE RATTACHEMENT PORTAIL — l'identité (`utilisateur`) est réutilisée
    // d'un passage à l'autre (même idiome que 9J04/9J07), mais ce client-ci
    // est jetable : sans cette ligne, la contrainte de clé étrangère refuse
    // la suppression du client.
    await client.$executeRawUnsafe(
      `DELETE FROM "utilisateur_client" WHERE "client_id" = $1::uuid`,
      CLIENT_ID,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
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

test.beforeAll(async () => {
  await preparerLaScene();
});

test.afterAll(async () => {
  await effacerLaScene();
});

const SUFFIXE_EN_COURS_INTERVENTION = `${fr["ponctuation.parenthese_ouvrante"]}${fr["portail.interventions.temps_par_etat.en_cours_suffixe"]}${fr["ponctuation.parenthese_fermante"]}`;
const SUFFIXE_EN_COURS_DEMANDE = `${fr["ponctuation.parenthese_ouvrante"]}${fr["portail.demandes.temps_par_etat.en_cours_suffixe"]}${fr["ponctuation.parenthese_fermante"]}`;

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
    });

    test(`capture — fiche intervention, temps par état à plusieurs transitions, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionPortail(page);
      await page.goto(`/portail/interventions/${INTERVENTION_ID}`);
      await expect(page).toHaveURL(/\/portail\/interventions\/[0-9a-f-]+/);
      await expect(
        page.getByText(fr["portail.interventions.temps_par_etat.titre"]),
      ).toBeVisible();
      // DEUX DURÉES, l'une close (planifiée), l'autre OUVERTE (en_cours).
      // `exact: true` depuis 9K06 : le `<dt>Date planifiée</dt>` de la fiche
      // (9K06-PORTAIL-COMPTE-TELEPHONE) résout sinon aussi « Planifiée ».
      await expect(
        page.getByText(fr["statut.planifiee"], { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(fr["statut.affectee"])).toBeVisible();
      await expect(
        page.getByText(
          `${fr["statut.en_cours"]}${SUFFIXE_EN_COURS_INTERVENTION}`,
        ),
      ).toBeVisible();
      await capturer(page, "fiche-intervention-temps-par-etat", largeur);
    });

    test(`capture — liste des demandes, une demande qui a changé deux fois d'état montre deux durées, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionPortail(page);
      await page.goto("/portail/demandes");
      await expect(page).toHaveURL(/\/portail\/demandes$/);
      await expect(
        page.getByText(fr["portail.demandes.temps_par_etat.titre"]).first(),
      ).toBeVisible();
      // TROIS ÉTATS TRAVERSÉS (deux transitions) — DEUX durées CLOSES, et
      // l'état courant OUVERT.
      await expect(page.getByText(fr["demande.statut.nouvelle"])).toBeVisible();
      await expect(
        page.getByText(fr["demande.statut.qualifiee"]),
      ).toBeVisible();
      await expect(
        page.getByText(
          `${fr["demande.statut.transformee"]}${SUFFIXE_EN_COURS_DEMANDE}`,
        ),
      ).toBeVisible();
      await capturer(page, "liste-demandes-temps-par-etat", largeur);
    });
  });
}
