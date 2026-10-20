import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { cleJour, jourDe, maintenant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * LES CAPTURES DE 9F4H5B-JOURNEE-SANS-MONTANT (point 5) — Ma journée, avec
 * une carte « Nouveau » et le message d'annonce, aux deux largeurs exigées.
 * Silencieuses sous `pnpm test:e2e` ordinaire (interrupteur `CAPTURES_9F4H5B`,
 * même convention que les autres fichiers `captures-*`) ; `pnpm verify`/
 * `verify:full` ne les déclenchent pas.
 *
 * Sa propre scène, préfixée `9F4H5BCAP-`, forgée en `beforeAll`, effacée en
 * `afterAll`, aucune ligne au semis (I9).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9F4H5B ?? "";

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`), fullPage: true });
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
const SITES: Record<number, string> = { 1280: uuidv7(), 375: uuidv7() };
const INTERVENTIONS: Record<number, string> = { 1280: uuidv7(), 375: uuidv7() };

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
        raison_sociale: "9F4H5BCAP — client",
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
          libelle: `9F4H5BCAP — site ${largeur}`,
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
          statut: "affectee",
          type: "curatif",
          priorite: "p2",
          date_planifiee: new Date(`${cle}T00:00:00.000Z`),
          creneau_debut: new Date(`${cle}T20:00:00.000Z`),
          creneau_fin: new Date(`${cle}T21:00:00.000Z`),
          duree_estimee_min: 60,
          mode_valorisation: "temps_passe",
          devise_code: "XPF",
          description: "9F4H5BCAP — capture point 5",
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
    await client.intervention.deleteMany({
      where: { id: { in: Object.values(INTERVENTIONS) } },
    });
    await client.site.deleteMany({
      where: { id: { in: Object.values(SITES) } },
    });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of LARGEURS) {
  test(`capture — Ma journée, carte « Nouveau » et message d'annonce, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1100 });
    await ouvrirLaSessionDuTerrain(page);

    const carte = page.locator("li", {
      hasText: `9F4H5BCAP — site ${largeur}`,
    });
    await expect(carte).toBeVisible();
    await expect(
      carte.getByText(fr["terrain.badge_nouveau"], { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toBeVisible();

    await capturer(page, `ma-journee-nouveau-${largeur}`);
  });
}
