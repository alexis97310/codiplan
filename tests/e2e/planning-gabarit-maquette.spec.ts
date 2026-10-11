import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { jourDe, jourSuivant, maintenant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EH-TP-UX-PL-PLANNING-1 (D190) — LE PLANNING AU GABARIT DE LA MAQUETTE DU
 * 28/09 : EN-TÊTE, BARRE D'OUTILS, FILTRES ET BANDEAU.
 *
 * Scène PROPRE à ce fichier, préfixée par un UUID, forgée en `beforeAll` et
 * effacée en `afterAll` (I9) — DEUX interventions, jamais une seule : la
 * contrainte `intervention_planifiee_a_sa_duree` (PARCOURS-1) exige une
 * durée dès que le statut est `planifiee`/`affectee`, exactement les deux
 * seuls statuts du critère `en_retard` — elle est donc, par construction,
 * incompatible avec `duree_estimee_min: null` (`sans_duree`). La première,
 * « planifiee », datée d'HIER, porte une durée (`en_retard`) ; la seconde,
 * « en_cours » (même statut que `tests/e2e/planning-cibles-375.spec.ts`),
 * sans durée (`sans_duree`). Ni l'un ni l'autre critère ne dépend de la
 * période affichée (`interventionsEnRetard`/`interventionsSansDuree`,
 * `lib/interventions/depot.ts`).
 *
 * **Ce que ce fichier NE compte PAS** : le total « À traiter » est une
 * lecture GLOBALE à la société, que d'autres scénarios jetés en parallèle
 * peuvent faire varier (piège connu de ce ticket) — chaque épreuve ci-dessous
 * vérifie seulement que SA propre ligne est atteignable depuis la puce,
 * jamais un compte exact.
 */

// SÉRIE (tests/unit/e2e-mise-en-scene.test.ts) — `beforeAll` écrit en base ;
// sous `fullyParallel`, deux ouvriers rejoueraient sinon la même écriture.
test.describe.configure({ mode: "serial" });

async function admin(): Promise<PrismaClient> {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

let reperes: Awaited<ReturnType<typeof reperesDeLaScene>>;
const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_EN_RETARD_ID = uuidv7();
const INTERVENTION_SANS_DUREE_ID = uuidv7();

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  const client = await admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const hier = jourSuivant(jourDe(maintenant(reperes.fuseau).local), -1);
    const cleHier = `${hier.annee}-${String(hier.mois).padStart(2, "0")}-${String(
      hier.jour,
    ).padStart(2, "0")}`;

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "zz9EHC-GABARIT — client forgé",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "zz9EHC-GABARIT — site forgé",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_EN_RETARD_ID,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: new Date(`${cleHier}T00:00:00.000Z`),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "zz9EHC-GABARIT — en retard, forgée par l'épreuve",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_SANS_DUREE_ID,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "en_cours",
        duree_estimee_min: null,
        temps_valide_min: null,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "zz9EHC-GABARIT — sans durée, forgée par l'épreuve",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = await admin();
  try {
    for (const id of [INTERVENTION_EN_RETARD_ID, INTERVENTION_SANS_DUREE_ID]) {
      await client.$executeRawUnsafe(
        `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
        id,
      );
    }
    await client.intervention.deleteMany({
      where: {
        id: { in: [INTERVENTION_EN_RETARD_ID, INTERVENTION_SANS_DUREE_ID] },
      },
    });
    await client.site.deleteMany({ where: { id: SITE_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("le titre et l'ordre des quatre vues suivent le gabarit de la maquette du 28/09", async ({
  page,
}) => {
  await page.goto("/planning");
  await expect(
    page.getByRole("heading", { level: 1, name: fr["planning.titre"] }),
  ).toBeVisible();

  const onglets = page
    .locator('[data-maquette-bloc="selecteur-semaine-jour"] a')
    .filter({ visible: true });
  await expect(onglets).toHaveText([
    fr["planning.vue_jour"],
    fr["planning.vue_semaine"],
    fr["planning.vue_deux_semaines"],
    fr["planning.vue_mois"],
  ]);
});

test("aucun lien isolé « Absences » ne subsiste dans le contenu de la page", async ({
  page,
}) => {
  await page.goto("/planning");
  await expect(
    page.locator("main").getByRole("link", { name: fr["absences.titre"] }),
  ).toHaveCount(0);
});

for (const largeur of [1280, 1440] as const) {
  test(`à ${largeur} px, le segment, les flèches et « Plein écran » restent sur la même ligne`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto("/planning?vue=semaine");

    const segment = page.locator(
      '[data-maquette-bloc="selecteur-semaine-jour"]',
    );
    const aujourdhui = page.getByRole("link", {
      name: fr["planning.aujourdhui"],
      exact: true,
    });
    const pleinEcran = page.getByRole("link", {
      name: fr["planning.plein_ecran"],
      exact: true,
    });
    await expect(segment).toBeVisible();
    await expect(aujourdhui).toBeVisible();
    await expect(pleinEcran).toBeVisible();

    const [rSegment, rAujourdhui, rPleinEcran] = await Promise.all([
      segment.evaluate((element) => element.getBoundingClientRect().top),
      aujourdhui.evaluate((element) => element.getBoundingClientRect().top),
      pleinEcran.evaluate((element) => element.getBoundingClientRect().top),
    ]);

    expect(Math.abs(rSegment - rAujourdhui)).toBeLessThanOrEqual(4);
    expect(Math.abs(rSegment - rPleinEcran)).toBeLessThanOrEqual(4);
  });
}

test("la puce « en retard » mène à l'onglet qui montre la carte forgée", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/planning");

  const puce = page.getByRole("link", {
    name: new RegExp(`^\\d+ ${fr["planning.bandeau_en_retard"]}$`),
  });
  await expect(puce).toBeVisible();
  await puce.click();
  await expect(page).toHaveURL(/onglet=en_retard/);
  await expect(
    page
      .locator(`[data-tiroir-declencheur="${INTERVENTION_EN_RETARD_ID}"]`)
      .first(),
  ).toBeVisible();
});

test("la puce « sans durée » mène à l'onglet qui montre la carte forgée", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/planning");

  const puce = page.getByRole("link", {
    name: new RegExp(`^\\d+ ${fr["planning.bandeau_sans_duree"]}$`),
  });
  await expect(puce).toBeVisible();
  await puce.click();
  await expect(page).toHaveURL(/onglet=sans_duree/);
  await expect(
    page
      .locator(`[data-tiroir-declencheur="${INTERVENTION_SANS_DUREE_ID}"]`)
      .first(),
  ).toBeVisible();
});
