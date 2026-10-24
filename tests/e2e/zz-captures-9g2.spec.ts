import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9G2-TABLEAUX-EN-CARTES-375 — AVANT (`origin/main`) et
 * APRÈS, en VIEWPORT (jamais `fullPage`), 375 puis 1280 px — même recette
 * que `zz-captures-9g9e.spec.ts` (mémoire « captures-avant-apres-e2e ») :
 * ce même fichier est rejoué une fois dans un worktree posé sur le commit
 * qui précède ce lot, une fois sur le code livré.
 *
 * Aucune écriture en base : les scènes lues (un site qui porte une machine
 * et une intervention) existent déjà dans le semis de démonstration.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9G2 ?? "";
const PHASE = process.env.CAPTURES_9G2_PHASE ?? "apres";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  await page.setViewportSize({ width: largeur, height: 800 });
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${PHASE}-${largeur}.png`),
    fullPage: false,
  });
}

async function capturerEcran(
  page: Page,
  chemin: string,
  nom: string,
): Promise<void> {
  await page.goto(chemin);
  await expect(page.locator("main")).toBeVisible();
  for (const largeur of [1280, 375] as const) {
    await capturer(page, nom, largeur);
  }
}

let siteId: string | null = null;

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    // UN SITE QUI PORTE AU MOINS UNE MACHINE — la fiche n'est intéressante à
    // capturer (le tableau « Dernières interventions ») que non vide.
    const machine = await client.machine.findFirst({
      where: { societe_id: societe.id },
      select: { site_id: true },
    });
    siteId = machine?.site_id ?? null;
  } finally {
    await client.$disconnect();
  }
});

test("captures — les écrans en cartes sous 900 px (9G2)", async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

  await capturerEcran(page, "/parametres/trajets", "parametres-trajets");
  await capturerEcran(page, "/parametres/agences", "parametres-agences");
  await capturerEcran(page, "/parametres/materiel", "parametres-materiel");
  await capturerEcran(
    page,
    "/parametres/habilitations",
    "parametres-habilitations",
  );
  await capturerEcran(
    page,
    "/parametres/prestations",
    "parametres-prestations",
  );
  await capturerEcran(page, "/imports", "imports");
  await capturerEcran(page, "/vgp", "vgp");
  await capturerEcran(page, "/vgp/a-determiner", "vgp-a-determiner");
  await capturerEcran(page, "/absences", "absences");

  if (siteId !== null) {
    await capturerEcran(page, `/sites/${siteId}`, "sites-fiche");
  }
});
