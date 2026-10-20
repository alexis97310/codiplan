import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { cleJour, jourDe, maintenant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * 9F4H5-TERRAIN-VIVANT, point 1 — LE COMPTEUR DÉFILE, À TRAVERS L'ÉCRAN.
 *
 * Les scénarios unitaires (`tests/unit/terrain/compteur-vivant.test.ts`)
 * éprouvent le calcul, pur. Ils ne peuvent pas prouver que la FICHE affiche
 * réellement une valeur qui CHANGE toute seule, sans recharger : c'est ce que
 * ce fichier joue, à travers un vrai navigateur, une vraie minuterie.
 *
 * ## SA PROPRE SCÈNE
 *
 * `SCENE.compteurA` (utilisé par `tests/e2e/terrain.spec.ts`) est une
 * intervention PARTAGÉE : démarrer son compteur ici entrerait en conflit avec
 * ce que cet autre fichier lui fait, sous exécution parallèle (`fullyParallel`).
 * Cette intervention-ci est forgée et détruite par ce fichier seul.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_ID = uuidv7();
const SITE_LIBELLE = fr["terrain9f4h5.e2e.site_compteur"];

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const aujourdHui = jourDe(maintenant(reperes.fuseau).local);
    const cle = cleJour(aujourdHui);
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: fr["terrain9f4h5.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: SITE_LIBELLE,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        statut: "affectee",
        type: "curatif",
        priorite: "p3",
        date_planifiee: new Date(`${cle}T00:00:00.000Z`),
        creneau_debut: new Date(`${cle}T20:00:00.000Z`),
        creneau_fin: new Date(`${cle}T21:00:00.000Z`),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9F4H5 — intervention forgée par l'épreuve",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    // LE COMPTEUR DÉMARRÉ PAR L'ÉPREUVE LAISSE UN SEGMENT — à effacer avant
    // l'intervention elle-même, qu'il référence (même geste que les autres
    // scènes qui démarrent un compteur, ex. `9f4-terrain-enregistrement-
    // auto.spec.ts`).
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_ID,
    );
    await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
    await client.site.deleteMany({ where: { id: SITE_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test("Démarrer, attendre 3 s : la valeur a changé et n'est plus 00:00:00", async ({
  page,
}) => {
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${INTERVENTION_ID}`);

  await page
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();
  await expect(
    page.getByRole("button", { name: fr["terrain.compteur.pause"] }),
  ).toBeVisible();

  // LE TOTAL VIVANT, `HH:MM:SS` — jamais confondu avec « Le compteur tourne
  // depuis HH:MM » (deux groupes seulement), qui reste affiché à sa place
  // habituelle.
  const ZERO = /^00:00:00$/;
  const valeur = page.getByText(/^\d{2}:\d{2}:\d{2}$/);
  await expect(valeur).toBeVisible();
  await expect(valeur).toHaveText(ZERO);

  await page.waitForTimeout(3_000);

  await expect(valeur).not.toHaveText(ZERO);
});
