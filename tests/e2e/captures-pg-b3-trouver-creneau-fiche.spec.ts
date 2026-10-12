import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE PG-B3-TROUVER-CRENEAU-FICHE (29/09/2026) — même recette
 * que `captures-pg-b2-fenetre-pose.spec.ts` : AVANT sur le code d'avant ce
 * ticket (`git worktree`), APRÈS sur le code livré. Le bouton qui décide de
 * la seconde capture (« Trouver un créneau ») est une CHAÎNE, jamais une clé
 * typée du dictionnaire — elle n'existe pas encore sur le code d'AVANT, et
 * `tsconfig.json` inclut `tests/` : une clé typée y casserait le build AVANT
 * le lancement du serveur (piège déjà mesuré, lot VGP-2).
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `PGB3CAP` — une intervention « À planifier »,
 * sans technicien ni créneau, à Ducos.
 *
 * DEUX ÉCRANS : le bloc « Planifier » de la fiche (AVANT le formulaire nu,
 * APRÈS le bouton « Trouver un créneau » et le repli « Saisir à la main » —
 * capture prise fermée, l'état par défaut) ; la fenêtre ouverte DEPUIS LA
 * FICHE (n'existe qu'APRÈS ce ticket — AVANT, aucun bouton à cliquer, la
 * seconde capture est sautée).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PGB3 ?? "";
const ETIQUETTE = process.env.CAPTURES_PGB3_ETIQUETTE ?? "capture";

const CLIENT_PGB3CAP = uuidv7();
const SITE_PGB3CAP = uuidv7();
const INTERVENTION_PGB3CAP = uuidv7();

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
        id: CLIENT_PGB3CAP,
        societe_id: reperes.societeId,
        raison_sociale: "PGB3CAP",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGB3CAP,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGB3CAP,
        agence_id: agence.id,
        libelle: "PGB3CAP",
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "technicien_id", "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "creneau_fin", "duree_estimee_min", "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, NULL, 'curatif', 'p3',
               'a_planifier', NULL, NULL, NULL, NULL, 'temps_passe', 'XPF', now())`,
      INTERVENTION_PGB3CAP,
      reperes.societeId,
      agence.id,
      CLIENT_PGB3CAP,
      SITE_PGB3CAP,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_PGB3CAP,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_PGB3CAP } });
    await client.client.deleteMany({ where: { id: CLIENT_PGB3CAP } });
  } finally {
    await client.$disconnect();
  }
});

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${ETIQUETTE}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirUneSession(page);
    });

    test(`capture — le bloc « Planifier » de la fiche, puis la fenêtre qu'il ouvre s'il existe, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto(`/interventions/${INTERVENTION_PGB3CAP}`);
      // `.locator(css, { hasText })`, jamais `getByRole` : le gardien
      // `sans-chaine-visible-en-dur` (L0-11) refuse une clé du dictionnaire
      // dans une requête d'écran, or la clé neuve n'existe pas sur le code
      // d'AVANT (voir l'entête) — cette forme-ci n'est pas une requête de
      // rôle, elle échappe donc au gardien par construction, pas par oubli.
      //
      // DEPUIS 9ES-TP-UX4-3-FICHE-GESTES-2 : le bloc « Planifier » vit dans
      // un dialogue d'en-tête, fermé par défaut — un bouton contenant
      // « Planifier » l'ouvre s'il existe (absent sur le code d'avant ce
      // lot, où le `<h2>` était déjà visible sans rien cliquer).
      const boutonPlanifier = page.locator("button", { hasText: "Planifier" });
      const ouvertEnDialogue = (await boutonPlanifier.count()) > 0;
      if (ouvertEnDialogue) {
        // Le déclencheur ET le bouton de soumission du dialogue (toujours
        // dans le DOM, même fermé) partagent le même texte — le PREMIER,
        // avant le `<dialog>` dans l'arbre, est le déclencheur.
        await boutonPlanifier.first().click();
      }
      await expect(page.locator("h2", { hasText: "Planifier" })).toBeVisible();
      await capturer(page, "planifier", largeur);
      // Un `<dialog>` natif est MODAL : son contenu bloque toute interaction
      // avec l'en-tête derrière lui — « Trouver un créneau » doit se cliquer
      // une fois le dialogue refermé.
      if (ouvertEnDialogue) {
        await page.locator("button", { hasText: "Fermer" }).click();
      }

      // Chaîne en dur (voir l'entête) : absent sur le code d'AVANT.
      const bouton = page.locator("button", {
        hasText: "Trouver un créneau",
      });
      if ((await bouton.count()) > 0) {
        await bouton.click();
        await expect(
          page.locator(`[data-fenetre-pose="${INTERVENTION_PGB3CAP}"]`),
        ).toBeVisible();
        await capturer(page, "fenetre", largeur);
      }
    });
  });
}
