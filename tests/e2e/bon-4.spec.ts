import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * 76-BON-4 — LA SIGNATURE DU CLIENT PORTE LE NOM ET LA QUALITÉ DU SIGNATAIRE
 * (SAV-10). Suite de 69-BON-3.
 *
 * ## Le constat
 *
 * `intervention_signature` ne disait QUI avait signé pour le client, seulement
 * l'image du tracé et sa date. `tests/unit/interventions/signature-signataire.test.ts`
 * éprouve `schemaSignature` seul ; il ne prouve pas qu'un TECHNICIEN peut
 * réellement saisir ces deux champs sur le terrain, ni que le bon les imprime
 * dans le bon format — c'est ce que ce fichier joue, à travers le navigateur.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `BON4-` — SANS TOUCHER À `setup/scene.ts`
 *
 * Un client, un site, une intervention — créés en `beforeAll`, supprimés en
 * `afterAll`, aucune ligne ajoutée au semis (même discipline que
 * `tests/e2e/interventions-2.spec.ts`). Le technicien affecté est une
 * identité DU SEMIS (`guerin@codima.test`, Ducos, relue par
 * `reperesDeLaScene()`) : `restrictionParPersonne` filtre le terrain par
 * `technicien_id`, et cette même identité voit ensuite le bon —
 * `consulter_planning` reste `○` pour ce rôle, exactement comme sur
 * `bon/page.tsx` (voir son en-tête).
 *
 * ## SÉRIEL — un seul dossier, trois temps : signer, clore, imprimer
 */
test.describe.configure({ mode: "serial" });

const CLIENT_BON4 = uuidv7();
const SITE_BON4 = uuidv7();
const INTERVENTION_BON4 = uuidv7();

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

    await client.client.create({
      data: {
        id: CLIENT_BON4,
        societe_id: reperes.societeId,
        raison_sociale: fr["bon4.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_BON4,
        societe_id: reperes.societeId,
        client_id: CLIENT_BON4,
        agence_id: agence.id,
        libelle: fr["bon4.e2e.site"],
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_BON4,
        societe_id: reperes.societeId,
        client_id: CLIENT_BON4,
        site_id: SITE_BON4,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "planifiee",
        date_planifiee: new Date("2026-09-25T00:00:00Z"),
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    // CASCADE efface la signature avec son intervention.
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_BON4,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_BON4 } });
    await client.client.deleteMany({ where: { id: CLIENT_BON4 } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/76-BON-4/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/arrivee/);
});

test("le terrain signe avec un nom et une qualité, et le bon les imprime", async ({
  page,
}) => {
  await page.goto(`/terrain/${INTERVENTION_BON4}`);

  await page
    .getByLabel(fr["terrain.signature.nom_libelle"])
    .fill(fr["bon4.e2e.signataire_nom"]);
  await page
    .getByLabel(fr["terrain.signature.qualite_libelle"])
    .fill(fr["bon4.e2e.signataire_qualite"]);

  // Voir `rapport-terrain.spec.ts` : les événements sont DISPATCHÉS
  // DIRECTEMENT dans la page, la simulation matérielle de Playwright s'étant
  // révélée peu fiable sur des coordonnées calculées côté test.
  await page.locator("canvas").evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    const envoyer = (type: string, x: number, y: number): void => {
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: rectangle.left + x,
          clientY: rectangle.top + y,
          pointerId: 1,
        }),
      );
    };
    envoyer("pointerdown", 20, 20);
    envoyer("pointermove", 100, 80);
    envoyer("pointermove", 200, 30);
    envoyer("pointerup", 200, 30);
  });

  await capturer(page, "signature-terrain", 375);

  await page
    .getByRole("button", { name: fr["terrain.signature.enregistrer"] })
    .click();

  await expect(page).toHaveURL(new RegExp(`/terrain/${INTERVENTION_BON4}$`));
  await expect(
    page.getByText(fr["terrain.signature.deja_signee"]),
  ).toBeVisible();

  // LA CLÔTURE — geste réaliste qui précéderait l'impression du bon dans
  // l'exploitation, posé directement (même discipline que
  // `tests/e2e/interventions-2.spec.ts` pour sa fixture `cloturee`) : ce
  // fichier n'éprouve pas le CHEMIN vers la clôture, seulement ce que le bon
  // imprime une fois qu'on y est.
  const admin1 = admin();
  try {
    await admin1.$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'terminee'::"StatutIntervention" WHERE "id" = $1::uuid`,
      INTERVENTION_BON4,
    );
  } finally {
    await admin1.$disconnect();
  }

  await page.goto(`/interventions/${INTERVENTION_BON4}/bon`);
  await expect(
    page.getByText(texteSigneParAttendu(), { exact: false }),
  ).toBeVisible();

  await capturer(page, "bon-signature", 1280);
});

/**
 * « Signé par NOM (QUALITÉ) le » — la MÊME composition que `ligneSignature`
 * de `bon/page.tsx` (76-BON-4), reconstruite ici depuis le dictionnaire pour
 * ne dépendre d'aucun export de la page.
 */
function texteSigneParAttendu(): string {
  return `${fr["intervention.bon.signe_par"]} ${fr["bon4.e2e.signataire_nom"]} (${fr["bon4.e2e.signataire_qualite"]}) ${fr["intervention.bon.le"]}`;
}
