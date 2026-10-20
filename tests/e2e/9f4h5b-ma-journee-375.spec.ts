import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { cleJour, jourDe, maintenant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

/**
 * 9F4H5B-JOURNEE-SANS-MONTANT, point 3 — À 375 PX, AUCUN DÉBORDEMENT.
 *
 * Mesuré sur `docs/propositions/9F4H5-TERRAIN-VIVANT/captures/
 * ma-journee-nouvelle-375.png` : une carte portant TROIS pastilles sur sa
 * ligne d'en-tête (la priorité, « Nouveau », le statut) poussait
 * `document.documentElement.scrollWidth` à 400 — la ligne ne s'enroulait
 * jamais, sous `justify-between` sans `flex-wrap`.
 *
 * Sa propre scène, préfixée `9F4H5B375-` : une intervention `affectee`, pas
 * encore ouverte (`vue_technicien_le` nul par défaut) — elle porte donc la
 * priorité, « Nouveau » et son statut, les TROIS pastilles mesurées.
 */
test.describe.configure({ mode: "serial" });

const FENETRE_TELEPHONE = { width: 375, height: 900 };

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_ID = uuidv7();
const CLIENT_LIBELLE = "9F4H5B375 — Client à la raison sociale assez longue";
const SITE_LIBELLE = "9F4H5B375 — Site à l'intitulé lui aussi assez long";

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
        raison_sociale: CLIENT_LIBELLE,
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
        priorite: "p1",
        date_planifiee: new Date(`${cle}T00:00:00.000Z`),
        creneau_debut: new Date(`${cle}T20:00:00.000Z`),
        creneau_fin: new Date(`${cle}T21:00:00.000Z`),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9F4H5B375 — panne signalée pour la mesure de largeur",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
    await client.site.deleteMany({ where: { id: SITE_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test("à 375 px, une carte à trois pastilles (priorité, Nouveau, statut) ne fait pas déborder la page", async ({
  page,
}) => {
  await page.setViewportSize(FENETRE_TELEPHONE);
  await ouvrirLaSessionDuTerrain(page);

  const carte = page.locator("li", { hasText: SITE_LIBELLE });
  await expect(carte).toBeVisible();
  await expect(
    carte.getByText(fr["terrain.badge_nouveau"], { exact: true }),
  ).toBeVisible();
  await expect(
    carte.getByText(fr["statut.affectee"], { exact: true }),
  ).toBeVisible();

  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual(FENETRE_TELEPHONE.width);
});
