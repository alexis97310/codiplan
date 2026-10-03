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
 * LES CAPTURES DE 9DD-PG-G14C-TERRAIN-TRANSMISES (D141, 14C) — AVANT/APRÈS,
 * recette du 22/09/2026 (lot VGP-2) : ce fichier a été lancé une fois sur le
 * code d'AVANT ce ticket (`git worktree add` sur le commit 2c95eb1, libellés
 * posés en dur puisque les clés `terrain9dd.e2e.*` n'existaient pas encore
 * là-bas), puis une fois ici, APRÈS le commit — jamais une comparaison de
 * branches.
 *
 * SA PROPRE SCÈNE, préfixée `9DD` — forgée en `beforeAll`, effacée en
 * `afterAll`, aucune ligne au semis (I9). Le technicien, lui, est une
 * identité DU SEMIS (`garnier@codima.test`, Ducos) en LECTURE SEULE, comme
 * `tests/e2e/9dd-pg-g14c-terrain-transmises.spec.ts`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9DD ?? "";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
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
  await page.waitForLoadState("networkidle");
}

const CLIENT_ID = uuidv7();
const SITE_PLANIFIEE_ID = uuidv7();
const SITE_AFFECTEE_ID = uuidv7();
const SITE_ANNULEE_ID = uuidv7();
const INTERVENTION_PLANIFIEE_ID = uuidv7();
const INTERVENTION_AFFECTEE_ID = uuidv7();
const INTERVENTION_ANNULEE_ID = uuidv7();

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const aujourdHui = jourDe(maintenant(reperes.fuseau).local);
  const cle = cleJour(aujourdHui);
  const datePlanifiee = new Date(`${cle}T00:00:00.000Z`);
  const creneauDebut = new Date(`${cle}T20:00:00.000Z`);
  const creneauFin = new Date(`${cle}T21:00:00.000Z`);

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
        raison_sociale: fr["terrain9dd.e2e.client"],
        actif: true,
      },
    });
    await client.site.createMany({
      data: [
        {
          id: SITE_PLANIFIEE_ID,
          societe_id: reperes.societeId,
          client_id: CLIENT_ID,
          agence_id: agence.id,
          libelle: fr["terrain9dd.e2e.site_planifiee"],
        },
        {
          id: SITE_AFFECTEE_ID,
          societe_id: reperes.societeId,
          client_id: CLIENT_ID,
          agence_id: agence.id,
          libelle: fr["terrain9dd.e2e.site_affectee"],
        },
        {
          id: SITE_ANNULEE_ID,
          societe_id: reperes.societeId,
          client_id: CLIENT_ID,
          agence_id: agence.id,
          libelle: fr["terrain9dd.e2e.site_annulee"],
        },
      ],
    });

    const commun = {
      societe_id: reperes.societeId,
      agence_id: agence.id,
      client_id: CLIENT_ID,
      technicien_id: reperes.technicienDucos,
      type: "curatif" as const,
      priorite: "p3" as const,
      date_planifiee: datePlanifiee,
      creneau_debut: creneauDebut,
      creneau_fin: creneauFin,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
      description: "9DD — intervention forgée pour une capture",
    };
    await client.intervention.create({
      data: {
        id: INTERVENTION_PLANIFIEE_ID,
        site_id: SITE_PLANIFIEE_ID,
        statut: "planifiee",
        ...commun,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_AFFECTEE_ID,
        site_id: SITE_AFFECTEE_ID,
        statut: "affectee",
        ...commun,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_ANNULEE_ID,
        site_id: SITE_ANNULEE_ID,
        statut: "annulee",
        // DÉJÀ « VUE » — voir la note équivalente de
        // `9dd-pg-g14c-terrain-transmises.spec.ts` : évite un défaut
        // préexistant (23514) hors territoire de ce ticket plutôt que de
        // le masquer.
        vue_technicien_le: creneauDebut,
        ...commun,
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
      where: {
        id: {
          in: [
            INTERVENTION_PLANIFIEE_ID,
            INTERVENTION_AFFECTEE_ID,
            INTERVENTION_ANNULEE_ID,
          ],
        },
      },
    });
    await client.site.deleteMany({
      where: {
        id: { in: [SITE_PLANIFIEE_ID, SITE_AFFECTEE_ID, SITE_ANNULEE_ID] },
      },
    });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [375, 1280] as const) {
  test(`capture — Ma journée, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await ouvrirLaSessionDuTerrain(page);
    await expect(
      page.getByRole("heading", { name: fr["terrain.titre"] }),
    ).toBeVisible();
    await capturer(page, "ma-journee", largeur);
  });

  test(`capture — fiche d'une Planifiée, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await ouvrirLaSessionDuTerrain(page);
    await page.goto(`/terrain/${INTERVENTION_PLANIFIEE_ID}`);
    await page.waitForLoadState("networkidle");
    // Pas de niveau précis : AVANT rend la fiche réelle (`h1`), APRÈS rend
    // « introuvable » (`h2`, voir `components/ui/carte.tsx`) — la même
    // capture sert aux deux états.
    await expect(page.getByRole("heading").first()).toBeVisible();
    await capturer(page, "fiche-planifiee", largeur);
  });
}
