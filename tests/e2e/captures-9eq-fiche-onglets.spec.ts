import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DU POINT 53 (9EQ-CORRECTIFS-SOLDE-FICHE) — même recette que
 * `captures-9ek-creations-1.spec.ts` : rien n'est écrit sans
 * `CAPTURES_9EQ` (le dossier), et `CAPTURES_9EQ_PHASE` choisit entre
 * `avant` et `apres` (par défaut `apres`), pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * ## AVANT / APRÈS, PAS LE MÊME NOMBRE DE CAPTURES
 *
 * APRÈS (ce code) : les cinq onglets (résumé, temps, rapport, valorisation,
 * historique) de chacun des quatre statuts, à 1280 et 375 — 40 PNG.
 *
 * AVANT : ce même fichier, copié avec `tests/e2e/setup/` sur un `git
 * worktree` jeté sur `aeb3520d` (le commit juste avant celui des onglets,
 * `c94e953c`) — la fiche d'avant ignorait `?onglet=` et n'avait qu'une
 * seule disposition : UNE capture par statut et par largeur, 8 PNG,
 * `<statut>-avant-<largeur>.png`. La branche `PHASE === "avant"`
 * ci-dessous est la même sur les deux révisions ; seule la branche
 * `apres`, qui itère sur les onglets, n'a de sens que sur le code livré.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9EQ-CAP-`
 *
 * Un client, un site complet (adresse, horaires lun.–ven., consignes), un
 * donneur d'ordre ACTIF AVEC courriel (à la différence de la scène du
 * point 52 : ces captures montrent la carte « Sur place » au complet,
 * lien `tel:` compris), et quatre interventions, une par statut capturé.
 * Créés en `beforeAll`, supprimés en `afterAll`, aucune ligne du semis.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9EQ ?? "";
const PHASE = process.env.CAPTURES_9EQ_PHASE === "avant" ? "avant" : "apres";

const CLIENT_9EQCAP = uuidv7();
const SITE_9EQCAP = uuidv7();
const CONTACT_9EQCAP = uuidv7();
const INTERVENTION_A_PLANIFIER = uuidv7();
const INTERVENTION_EN_COURS = uuidv7();
const INTERVENTION_TERMINEE = uuidv7();
const INTERVENTION_CLOTUREE = uuidv7();
const SEGMENT_EN_COURS = uuidv7();
const SEGMENT_TERMINEE = uuidv7();

const INTERVENTIONS: ReadonlyArray<{
  readonly statut: string;
  readonly id: string;
}> = [
  { statut: "a-planifier", id: INTERVENTION_A_PLANIFIER },
  { statut: "en-cours", id: INTERVENTION_EN_COURS },
  { statut: "terminee", id: INTERVENTION_TERMINEE },
  { statut: "cloturee", id: INTERVENTION_CLOTUREE },
];

const ONGLETS = [
  "resume",
  "temps",
  "rapport",
  "valorisation",
  "historique",
] as const;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const technicienId = reperes.technicienDucos;

    await client.client.create({
      data: {
        id: CLIENT_9EQCAP,
        societe_id: reperes.societeId,
        raison_sociale: fr["9eq.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9EQCAP,
        societe_id: reperes.societeId,
        client_id: CLIENT_9EQCAP,
        agence_id: agence.id,
        libelle: fr["9eq.e2e.lieu"],
        adresse: { rue: fr["9ee2.e2e.rue"] },
        commune: "Nouméa",
        consignes_acces: fr["9ee2.e2e.consignes"],
        horaires: [1, 2, 3, 4, 5].map((jour_semaine) => ({
          jour_semaine,
          debut_minutes: 360,
          fin_minutes: 840,
        })),
      },
    });
    await client.contact.create({
      data: {
        id: CONTACT_9EQCAP,
        societe_id: reperes.societeId,
        client_id: CLIENT_9EQCAP,
        site_id: SITE_9EQCAP,
        nom: fr["9eq.e2e.contact_nom"],
        fonction: "Responsable technique",
        telephone: "687000010",
        email: "9eq-cap-donneur-ordre@exemple.test",
        roles: ["donneur_ordre"],
        canaux: ["email"],
        actif: true,
      },
    });

    // À PLANIFIER — aucun technicien, aucun créneau (le cas le plus nu).
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "contact_id",
          "type", "priorite", "statut", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
               'curatif', 'p3', 'a_planifier', now())`,
      INTERVENTION_A_PLANIFIER,
      reperes.societeId,
      CLIENT_9EQCAP,
      SITE_9EQCAP,
      agence.id,
      CONTACT_9EQCAP,
    );

    // EN COURS — un segment ouvert.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "contact_id",
          "type", "priorite", "statut", "date_planifiee", "creneau_debut",
          "creneau_fin", "duree_estimee_min", "technicien_id", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
               'curatif', 'p3', 'en_cours', now()::date, now(),
               now() + interval '1 hour', 60, $7::uuid, now())`,
      INTERVENTION_EN_COURS,
      reperes.societeId,
      CLIENT_9EQCAP,
      SITE_9EQCAP,
      agence.id,
      CONTACT_9EQCAP,
      technicienId,
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "segment_travail"
         ("id", "societe_id", "intervention_id", "utilisateur_id", "debut",
          "fin", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid,
               now() - interval '35 minutes', NULL, now())`,
      SEGMENT_EN_COURS,
      reperes.societeId,
      INTERVENTION_EN_COURS,
      technicienId,
    );

    // TERMINÉE, AVEC TEMPS MESURÉ — prête à clôturer.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "contact_id",
          "type", "priorite", "statut", "date_planifiee", "creneau_debut",
          "creneau_fin", "duree_estimee_min", "technicien_id", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
               'curatif', 'p4', 'terminee', now()::date, now(),
               now() + interval '1 hour', 60, $7::uuid, now())`,
      INTERVENTION_TERMINEE,
      reperes.societeId,
      CLIENT_9EQCAP,
      SITE_9EQCAP,
      agence.id,
      CONTACT_9EQCAP,
      technicienId,
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "segment_travail"
         ("id", "societe_id", "intervention_id", "utilisateur_id", "debut",
          "fin", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid,
               now() - interval '90 minutes', now(), now())`,
      SEGMENT_TERMINEE,
      reperes.societeId,
      INTERVENTION_TERMINEE,
      technicienId,
    );
    await client.$executeRawUnsafe(
      `UPDATE "intervention"
         SET "temps_mesure_min" = 90, "temps_valide_min" = 90
       WHERE "id" = $1::uuid`,
      INTERVENTION_TERMINEE,
    );

    // CLÔTURÉE.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "contact_id",
          "type", "priorite", "statut", "date_planifiee", "creneau_debut",
          "creneau_fin", "duree_estimee_min", "technicien_id",
          "temps_valide_min", "cloturee_le", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
               'curatif', 'p3', 'cloturee', now()::date, now(),
               now() + interval '1 hour', 60, $7::uuid, 60, now(), now())`,
      INTERVENTION_CLOTUREE,
      reperes.societeId,
      CLIENT_9EQCAP,
      SITE_9EQCAP,
      agence.id,
      CONTACT_9EQCAP,
      technicienId,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" IN (
         SELECT "id" FROM "intervention" WHERE "client_id" = $1::uuid
       )`,
      CLIENT_9EQCAP,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9EQCAP,
    );
    await client.contact.deleteMany({ where: { id: CONTACT_9EQCAP } });
    await client.site.deleteMany({ where: { client_id: CLIENT_9EQCAP } });
    await client.client.deleteMany({ where: { id: CLIENT_9EQCAP } });
  } finally {
    await client.$disconnect();
  }
});

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

for (const largeur of [1280, 375] as const) {
  if (PHASE === "avant") {
    for (const { statut, id } of INTERVENTIONS) {
      test(`capture AVANT — ${statut} à ${largeur}px`, async ({ page }) => {
        await page.setViewportSize({ width: largeur, height: 1200 });
        await ouvrirUneSession(page);
        await page.goto(`/interventions/${id}`);
        await capturer(page, `${statut}-avant`, largeur);
      });
    }
  } else {
    for (const { statut, id } of INTERVENTIONS) {
      for (const onglet of ONGLETS) {
        test(`capture APRÈS — ${statut}, onglet ${onglet} à ${largeur}px`, async ({
          page,
        }) => {
          await page.setViewportSize({ width: largeur, height: 1200 });
          await ouvrirUneSession(page);
          await page.goto(`/interventions/${id}?onglet=${onglet}`);
          await capturer(page, `${statut}-${onglet}-apres`, largeur);
        });
      }
    }
  }
}
