import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9L37-CASES-26PX-TERRAIN — LA CASE DE PRESTATION ET LA COCHE RONDE DE LA
 * CHECKLIST MESURENT 26 PX, décision d'Alexis du 23/11/2026 (« seulement les
 * cases de 26 px, couleurs inchangées »). Mesure géométrique, même gabarit
 * que `cases-parametrage-44.spec.ts` — jamais un décompte de base.
 *
 * Fiche jetable PROPRE (client, site, intervention `en_cours`, une
 * prestation GÉNÉRALE, un modèle de checklist GÉNÉRIQUE à un point
 * `case_faite`) — jamais une scène partagée que ce fichier ne crée pas
 * (§9). SÉRIEL, même raison que `9k21-checklist-terrain-saisie.spec.ts` : un
 * modèle générique s'applique à toute intervention de la société.
 *
 * EN LIGNE puis HORS RÉSEAU (`context.setOffline(true)`) — mêmes éléments
 * du DOM, la coquille hors-ligne (`ConsultationHorsReseau`) réutilisant les
 * deux mêmes composants (`CaseACocher`, `CocheRonde`) ; voir leurs
 * docblocks respectifs, `components/ui/case-a-cocher.tsx` et
 * `components/terrain/checklist-terrain.tsx`.
 *
 * Les captures AVANT/APRÈS de l'écran touché vivent dans
 * `docs/propositions/9L37-CASES-26PX-TERRAIN/captures/` (`avant-375.png`,
 * `apres-375.png`), prises hors de ce fichier sur la même fiche jetable.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9L37 = uuidv7();
const SITE_9L37 = uuidv7();
const INTERVENTION_9L37 = uuidv7();
const PRESTATION_9L37 = uuidv7();
const MODELE_9L37 = uuidv7();
const VERSION_9L37 = uuidv7();
const POINT_FAIT_9L37 = uuidv7();

const LIBELLE_PRESTATION = "zz9L37 prestation terrain";
const LIBELLE_POINT_FAIT = "zz9L37 point fait";

let societeId: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9L37,
        societe_id: societeId,
        raison_sociale: "zz9L37 client cases 26px",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9L37,
        societe_id: societeId,
        client_id: CLIENT_9L37,
        agence_id: agence.id,
        libelle: "zz9L37 site cases 26px",
      },
    });

    const jour = `${String(reperes.lundi.annee).padStart(4, "0")}-${String(
      reperes.lundi.mois,
    ).padStart(2, "0")}-${String(reperes.lundi.jour).padStart(2, "0")}`;
    await client.intervention.create({
      data: {
        id: INTERVENTION_9L37,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: CLIENT_9L37,
        site_id: SITE_9L37,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "en_cours",
        date_planifiee: new Date(`${jour}T00:00:00.000Z`),
        creneau_debut: new Date(`${jour}T08:00:00.000Z`),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "zz9L37-cases-26px",
      },
    });

    await client.prestation.create({
      data: {
        id: PRESTATION_9L37,
        societe_id: societeId,
        code: "9L37-PRESTA",
        libelle: LIBELLE_PRESTATION,
        actif: true,
      },
    });

    await client.checklistModele.create({
      data: {
        id: MODELE_9L37,
        societe_id: societeId,
        code: "ZZ9L37-GENERIQUE",
        libelle: "zz9L37 checklist générique",
        actif: true,
      },
    });
    await client.checklistVersion.create({
      data: {
        id: VERSION_9L37,
        societe_id: societeId,
        checklist_modele_id: MODELE_9L37,
        numero: 1,
      },
    });
    await client.checklistPoint.create({
      data: {
        id: POINT_FAIT_9L37,
        societe_id: societeId,
        checklist_version_id: VERSION_9L37,
        section: "Entretien",
        ordre: 1,
        libelle: LIBELLE_POINT_FAIT,
        obligatoire: false,
        type_reponse: "case_faite",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({ where: { id: INTERVENTION_9L37 } });
    await client.checklistVersion.deleteMany({
      where: { checklist_modele_id: MODELE_9L37 },
    });
    await client.checklistModele.deleteMany({ where: { id: MODELE_9L37 } });
    await client.prestation.deleteMany({ where: { id: PRESTATION_9L37 } });
    await client.site.deleteMany({ where: { id: SITE_9L37 } });
    await client.client.deleteMany({ where: { id: CLIENT_9L37 } });
  } finally {
    await client.$disconnect();
  }
});

async function mesurerCaseEtCible(page: Page): Promise<void> {
  // LA CASE DE PRESTATION — `CaseACocher`, `caseTerrain26px` : l'`<input>`
  // lui-même fait 26 px, le `<label>` qui le porte reste la cible ≥44 px.
  // Repéré par sélecteur CSS, jamais par son libellé (gardien L0-11 : une
  // valeur de fixture n'est pas une clé du dictionnaire) — une seule case à
  // cocher native existe sur cette fiche jetable.
  const caseInput = page.locator('input[type="checkbox"]');
  await expect(caseInput).toHaveCount(1);
  const boiteCase = await caseInput.boundingBox();
  expect(boiteCase).not.toBeNull();
  expect(boiteCase!.height).toBeGreaterThanOrEqual(25);
  expect(boiteCase!.height).toBeLessThanOrEqual(27);
  expect(boiteCase!.width).toBeGreaterThanOrEqual(25);
  expect(boiteCase!.width).toBeLessThanOrEqual(27);
  const cibleCase = caseInput.locator("xpath=..");
  const boiteCible = await cibleCase.boundingBox();
  expect(boiteCible).not.toBeNull();
  expect(boiteCible!.height).toBeGreaterThanOrEqual(44);

  // LA COCHE RONDE « FAIT » — `CocheRonde` : le cercle visuel INTÉRIEUR
  // (le `<span>`) fait 26 px, le `<button role="checkbox">` qui le porte
  // reste la cible ≥44 px. Même repérage par sélecteur CSS, même raison.
  const coche = page.locator('button[role="checkbox"]');
  await expect(coche).toHaveCount(1);
  const boiteCoche = await coche.boundingBox();
  expect(boiteCoche).not.toBeNull();
  expect(boiteCoche!.height).toBeGreaterThanOrEqual(44);
  expect(boiteCoche!.width).toBeGreaterThanOrEqual(44);
  const cercleVisuel = coche.locator("span");
  const boiteCercle = await cercleVisuel.boundingBox();
  expect(boiteCercle).not.toBeNull();
  expect(boiteCercle!.height).toBeGreaterThanOrEqual(25);
  expect(boiteCercle!.height).toBeLessThanOrEqual(27);
  expect(boiteCercle!.width).toBeGreaterThanOrEqual(25);
  expect(boiteCercle!.width).toBeLessThanOrEqual(27);
}

test("À 375 PX, EN LIGNE — la case de prestation et la coche ronde de la checklist mesurent 26 px, la cible reste ≥44 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${INTERVENTION_9L37}`);
  await expect(page.locator('input[type="checkbox"]')).toBeVisible();
  await expect(page.locator('button[role="checkbox"]')).toBeVisible();

  await mesurerCaseEtCible(page);
});

test("À 375 PX, HORS RÉSEAU — les mêmes cases, les mêmes 26 px, le réseau coupé ne change rien au rendu", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${INTERVENTION_9L37}`);
  await expect(page.locator('input[type="checkbox"]')).toBeVisible();

  await context.setOffline(true);
  try {
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    await mesurerCaseEtCible(page);
  } finally {
    await context.setOffline(false);
  }
});
