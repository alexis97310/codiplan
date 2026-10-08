import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LA MÊME PASTILLE DE PRIORITÉ, PARTOUT (GR5, audit du 26/09/2026, constat
 * G6) — `tonDePriorite` (`lib/theme/priorites.ts`) sert désormais cinq
 * écrans ; ce spec éprouve les DEUX qui ne se lisaient pas déjà par un
 * gardien statique (`tests/unit/interventions/colonnes-et-kpi.test.ts`
 * couvre le registre) : la fiche d'intervention, et la file « À planifier »
 * du planning, qui peignait la priorité dans la couleur du STATUT avant ce
 * lot.
 *
 * SA PROPRE LIGNE, à un identifiant fixe, JAMAIS une ligne du semis — même
 * raison que `tests/e2e/fiche-intervention.spec.ts`. **Supprimée en fin
 * d'épreuve** : une ligne `p1`/`a_planifier` compterait dans les KPI et la
 * liste « urgences » du tableau de bord (piège connu de ce lot), qu'aucune
 * autre épreuve de cette société partagée ne doit voir.
 */

test.describe.configure({ mode: "serial" });

/** Rien n'est écrit sans `CAPTURES_99U_PRIORITE` — même recette que
 * `captures-selecteurs-1.spec.ts` : l'exécution ordinaire de `pnpm
 * test:e2e` n'écrit jamais de fichier. */
const DOSSIER = process.env.CAPTURES_99U_PRIORITE ?? "";

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`), fullPage: true });
}

const INTERVENTION_P1 = "01a0f005-0000-7000-8000-000000000001";

let societeId: string;
let client: PrismaClient;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  const ducos = await client.agence.findFirstOrThrow({
    where: { societe_id: societeId, code: "DUCOS" },
    select: { id: true },
  });
  const site = await client.site.findFirstOrThrow({
    where: {
      societe_id: societeId,
      agence_id: ducos.id,
      client: { actif: true },
    },
    select: { id: true, client_id: true },
    orderBy: { libelle: "asc" },
  });

  // P1, SANS DATE — visible à la fois dans la file « À planifier » du
  // planning et sur sa propre fiche.
  await client.$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
       "type", "priorite", "statut", "duree_estimee_min",
       "mode_valorisation", "devise_code", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'p1',
             'a_planifier', 60, 'temps_passe', 'XPF', now())
     ON CONFLICT DO NOTHING`,
    INTERVENTION_P1,
    societeId,
    ducos.id,
    site.client_id,
    site.id,
  );
});

test.afterAll(async () => {
  await client.$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
    INTERVENTION_P1,
  );
  await client.$disconnect();
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("une P1 porte le ton rouge sur sa fiche, dans la file du planning et au tableau de bord", async ({
  page,
}) => {
  // LES CAPTURES D'ABORD, LES ASSERTIONS ENSUITE (recette AVANT/APRÈS) : ce
  // même spec est rejoué sur l'AVANT (`main` inchangé, rouge attendu) et sur
  // l'APRÈS (ce commit, vert) — une capture posée après une assertion ne
  // serait jamais prise sur l'AVANT, où le badge de la fiche n'existe pas
  // encore.
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto(`/interventions/${INTERVENTION_P1}`);
  await capturer(page, "fiche-priorite-p1-1280");
  await page.setViewportSize({ width: 375, height: 812 });
  await capturer(page, "fiche-priorite-p1-375");
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto("/planning");
  await capturer(page, "planning-file-priorite-p1-1280");

  await page.goto("/tableau-de-bord");
  await capturer(page, "tableau-de-bord-priorite-p1-1280");

  await page.goto(`/interventions/${INTERVENTION_P1}`);
  // LA PASTILLE DE PRIORITÉ A QUITTÉ LA LISTE `<dl>` POUR LE `<h1>`
  // (9EE-TP-UX4-1-FICHE-INTERVENTION-1, QE-9) — même pastille
  // (`Badge`/`span.rounded-[20px]`), même ton, seul son EMPLACEMENT change :
  // sélecteur adapté, attente inchangée.
  const badgeFiche = page
    .getByRole("heading", { level: 1 })
    .locator("span.rounded-\\[20px\\]")
    .first();
  await expect(badgeFiche).toBeVisible();
  await expect(badgeFiche).toHaveText(fr["priorite.p1"]);
  const classesFiche = (await badgeFiche.getAttribute("class")) ?? "";
  expect(classesFiche).toContain("bg-app-rouge-fond");

  await page.goto("/planning");
  // `data-tiroir-declencheur` (PG-C5-TIROIR), jamais `href="/interventions/…"`
  // — le tiroir a changé la cible de ce lien vers `?intervention=…`.
  const carte = page.locator(`[data-tiroir-declencheur="${INTERVENTION_P1}"]`);
  await expect(carte).toBeVisible();
  const badgePlanning = carte.locator("span.rounded-\\[20px\\]").first();
  await expect(badgePlanning).toBeVisible();
  await expect(badgePlanning).toHaveText(fr["priorite.p1"]);
  const classesPlanning = (await badgePlanning.getAttribute("class")) ?? "";
  expect(classesPlanning).toContain("bg-app-rouge-fond");

  await page.goto("/tableau-de-bord");
  // Égalité stricte (9DW-SOLDE-9DR, R1) : depuis 9DR-TP-NAV2-RETOURS-FIL
  // (TR-49, D168), ce lien porte `?depuis=tableau_de_bord` à la suite de
  // l'identifiant — exactement.
  const lienDossier = page.locator(
    `a[href="/interventions/${INTERVENTION_P1}?depuis=tableau_de_bord"]`,
  );
  await expect(lienDossier).toBeVisible();
  const boiteRang = lienDossier
    .locator("xpath=ancestor::article[1]")
    .locator("div")
    .first();
  const classesRang = (await boiteRang.getAttribute("class")) ?? "";
  expect(classesRang).toContain("bg-app-rouge-fond");
});
