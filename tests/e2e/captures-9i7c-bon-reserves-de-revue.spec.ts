import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * CAPTURES — 9I7C-BON-RESERVES-DE-REVUE, point 5.
 *
 * Bon signé et bon non signé, en 375 px, 1280 px et rendu impression —
 * AVANT/APRÈS la réparation des réserves de 9I7-BON-INTERVENTION-EN-TUILES
 * (date de l'en-tête, technicien, tuile signataire). Le libellé de phase
 * vient de `CAPTURE_PHASE` (`avant` ou `apres`, par défaut `apres`) : lancer
 * une première fois avec `CAPTURE_PHASE=avant` sur le code non corrigé, puis
 * sans la variable une fois le correctif commité — même recette que
 * [[captures-avant-apres-e2e]].
 *
 * SA PROPRE PAIRE D'INTERVENTIONS, jamais celle d'un autre spec de bon.
 */
test.describe.configure({ mode: "serial" });

const PHASE = process.env.CAPTURE_PHASE === "avant" ? "avant" : "apres";

const INTERVENTION_SIGNEE = uuidv7();
const INTERVENTION_NON_SIGNEE = uuidv7();
const SIGNATURE_ID = uuidv7();

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9I7C-BON-RESERVES-DE-REVUE/captures",
);

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const ducos = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: {
        societe_id: reperes.societeId,
        agence_id: ducos.id,
        client: { actif: true },
      },
      select: { id: true, client_id: true },
    });

    // NAÎT `en_cours` : la signature est rattachée pendant le travail, PUIS
    // seulement l'intervention est clôturée (9L14SB — ordre réel, le
    // figement à la clôture refuse désormais ce rattachement sur une
    // intervention déjà `cloturee`).
    await client.intervention.create({
      data: {
        id: INTERVENTION_SIGNEE,
        societe_id: reperes.societeId,
        agence_id: ducos.id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "en_cours",
        statut_facturation: "non_facturable",
        date_planifiee: new Date("2026-09-10T00:00:00.000Z"),
      },
    });
    await client.interventionSignature.create({
      data: {
        id: SIGNATURE_ID,
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_SIGNEE,
        issue: "signee",
        image_base64:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        signataire_nom: "9I7C — Signataire de la capture",
      },
    });
    // PUIS la clôture — l'ordre réel, rien n'est rattaché après (même patron
    // que `tests/e2e/9l14-fige-a-la-cloture.spec.ts` : la matrice D8 ne
    // clôture qu'à partir de `terminee`, temps validé et rapport validé) ;
    // `cloturee_le` reprend la date fixe que le bon affiche.
    await client.intervention.update({
      where: { id: INTERVENTION_SIGNEE },
      data: {
        statut: "terminee",
        temps_valide_min: 60,
        rapport_valide_par: reperes.technicienDucos,
        rapport_valide_le: new Date("2026-09-10T22:00:00.000Z"),
      },
    });
    await client.intervention.update({
      where: { id: INTERVENTION_SIGNEE },
      data: {
        statut: "cloturee",
        cloturee_le: new Date("2026-09-10T22:00:00.000Z"),
      },
    });

    await client.intervention.create({
      data: {
        id: INTERVENTION_NON_SIGNEE,
        societe_id: reperes.societeId,
        agence_id: ducos.id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "terminee",
        date_planifiee: new Date("2026-09-12T00:00:00.000Z"),
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({
      where: { id: { in: [INTERVENTION_SIGNEE, INTERVENTION_NON_SIGNEE] } },
    });
  } finally {
    await client.$disconnect();
  }
});

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${PHASE}-${largeur}-viewport.png`),
  });
}

async function capturerImpression(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.emulateMedia({ media: "print" });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${PHASE}-impression.png`),
    fullPage: true,
  });
  await page.emulateMedia({ media: null });
}

test("bon signé — 375 px, 1280 px et rendu impression", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${INTERVENTION_SIGNEE}/bon`);
  await capturer(page, "bon-signe", 375);
  await capturer(page, "bon-signe", 1280);
  await capturerImpression(page, "bon-signe");
});

test("bon non signé — 375 px, 1280 px et rendu impression", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${INTERVENTION_NON_SIGNEE}/bon`);
  await capturer(page, "bon-non-signe", 375);
  await capturer(page, "bon-non-signe", 1280);
  await capturerImpression(page, "bon-non-signe");
});
