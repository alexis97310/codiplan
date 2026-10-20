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
 * LA CAPTURE DE 9F4H5A-HEURE-CALEE-SERVEUR — la fiche après « Mettre en
 * pause », horloge du navigateur avancée de 10 min. Silencieuse sous
 * `pnpm test:e2e` ordinaire (même interrupteur que les autres fichiers
 * `captures-*`) ; `pnpm verify`/`verify:full` ne la déclenchent pas.
 *
 * Viewport SEUL (jamais `fullPage`) — exigé par le ticket.
 *
 * SA PROPRE SCÈNE, préfixée `9F4H5ACAP-`, forgée en `beforeAll`, effacée en
 * `afterAll`, aucune ligne au semis (I9) — UNE INTERVENTION PAR LARGEUR,
 * chacune avec son propre segment déjà ouvert : « Mettre en pause » ferme
 * irréversiblement le segment côté serveur, donc pas de rejeu sur la même
 * ligne pour la seconde largeur.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9F4H5A ?? "";

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`) });
}

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
const LARGEURS = [1280, 375] as const;

const SITES: Record<number, string> = {
  1280: uuidv7(),
  375: uuidv7(),
};
const INTERVENTIONS: Record<number, string> = {
  1280: uuidv7(),
  375: uuidv7(),
};
const SEGMENTS: Record<number, string> = {
  1280: uuidv7(),
  375: uuidv7(),
};

let societeId: string;
let technicienId: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  technicienId = reperes.technicienDucos;
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "9F4H5ACAP client",
        actif: true,
      },
    });
    for (const largeur of LARGEURS) {
      await client.site.create({
        data: {
          id: SITES[largeur],
          societe_id: reperes.societeId,
          client_id: CLIENT_ID,
          agence_id: agence.id,
          libelle: `9F4H5ACAP site ${largeur}`,
        },
      });
      await client.intervention.create({
        data: {
          id: INTERVENTIONS[largeur],
          societe_id: reperes.societeId,
          agence_id: agence.id,
          client_id: CLIENT_ID,
          site_id: SITES[largeur],
          technicien_id: reperes.technicienDucos,
          type: "curatif",
          priorite: "p3",
          duree_estimee_min: 60,
          mode_valorisation: "temps_passe",
          devise_code: "XPF",
          description: "9F4H5ACAP — capture",
          statut: "en_cours",
          date_planifiee: null,
        },
      });
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    const ids = Object.values(INTERVENTIONS);
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = ANY($1::uuid[])`,
      ids,
    );
    await client.intervention.deleteMany({ where: { id: { in: ids } } });
    await client.site.deleteMany({
      where: { id: { in: Object.values(SITES) } },
    });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of LARGEURS) {
  test(`capture — fiche après « Mettre en pause », horloge avancée de 10 min, à ${largeur}px`, async ({
    page,
  }) => {
    const client = admin();
    try {
      await client.segmentTravail.create({
        data: {
          id: SEGMENTS[largeur],
          societe_id: societeId,
          intervention_id: INTERVENTIONS[largeur],
          utilisateur_id: technicienId,
          debut: new Date(Date.now() - 15 * 60_000),
          fin: null,
        },
      });
    } finally {
      await client.$disconnect();
    }

    await page.setViewportSize({ width: largeur, height: 1100 });
    await ouvrirLaSessionDuTerrain(page);
    await page.clock.setFixedTime(new Date(Date.now() + 10 * 60_000));

    await page.goto(`/terrain/${INTERVENTIONS[largeur]}`);
    await page
      .getByRole("button", { name: fr["terrain.compteur.pause"] })
      .click();
    await expect(
      page.getByRole("button", { name: fr["terrain.compteur.reprendre"] }),
    ).toBeVisible();
    await capturer(page, `fiche-pause-horloge-avance-${largeur}`);
  });
}
