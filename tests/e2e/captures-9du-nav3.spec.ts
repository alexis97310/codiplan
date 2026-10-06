import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * CAPTURES AVANT/APRÈS — 9DU-TP-NAV3-RECHERCHE-RAIL (D171).
 *
 * Recette éprouvée (lot VGP-2, mémoire du poste) : un seul spec, les
 * captures sont prises AVANT toute assertion qui pourrait rougir sur
 * l'ANCIEN code — ce fichier n'affirme donc presque rien, il PHOTOGRAPHIE.
 * Joué une fois sur le commit d'avant ce lot (`git worktree`), une fois
 * après.
 *
 * **Lecture du dictionnaire par nom, jamais `fr["clé neuve"]`** — `tsconfig`
 * inclut les specs, et `next build` (que Playwright lance avant `next
 * start`) type-vérifierait ce fichier contre l'ANCIEN `lib/i18n/fr.ts`, qui
 * ne porte pas encore les clés de ce lot.
 *
 * Sa PROPRE scène, préfixée `9DU-`, créée ici et supprimée en `afterAll` —
 * un client, un site (réutilisés par cette scène) et, pour que le menu
 * déployé montre des décomptes non nuls, une demande et une intervention
 * P1, qui n'apparaissent dans AUCUNE autre épreuve.
 */
test.describe.configure({ mode: "serial" });

const CLE = (nom: string): string => (fr as Record<string, string>)[nom] ?? "";

// CHEMIN ABSOLU, VERS LE DÉPÔT PRINCIPAL — ce spec est aussi joué depuis un
// `git worktree` séparé pour la capture AVANT (recette du poste) ; un
// chemin relatif y écrirait dans le worktree, jamais dans ce dépôt.
const DOSSIER =
  "/home/aplou/codiplan-voie1/docs/propositions/9DU-TP-NAV3-RECHERCHE-RAIL/captures";

const CLIENT_9DU = uuidv7();
const SITE_9DU = uuidv7();
const DEMANDE_9DU = uuidv7();
const INTERVENTION_9DU = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const societeId = reperes.societeId;
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_9DU,
        societe_id: societeId,
        raison_sociale: CLE("9du.e2e.client"),
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9DU,
        societe_id: societeId,
        client_id: CLIENT_9DU,
        agence_id: agence.id,
        libelle: CLE("9du.e2e.site"),
      },
    });
    const maintenant = new Date();
    await client.demande.create({
      data: {
        id: DEMANDE_9DU,
        societe_id: societeId,
        source: "appel",
        client_id: CLIENT_9DU,
        site_id: SITE_9DU,
        agence_id: agence.id,
        description: "9DU — capture, décompte P1",
        urgence: "p1",
        depose_le: maintenant,
        compteur_accuse_le: maintenant,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9DU,
        societe_id: societeId,
        client_id: CLIENT_9DU,
        site_id: SITE_9DU,
        agence_id: agence.id,
        type: "curatif",
        priorite: "p1",
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
      where: { id: INTERVENTION_9DU },
    });
    await client.demande.deleteMany({ where: { id: DEMANDE_9DU } });
    await client.site.deleteMany({ where: { client_id: CLIENT_9DU } });
    await client.client.deleteMany({ where: { id: CLIENT_9DU } });
  } finally {
    await client.$disconnect();
  }
});

// « avant » ou « après » — passé par la variable d'environnement
// `CAPTURE_PHASE` (jamais codé en dur : le MÊME fichier joue les deux
// côtés, une fois par commit, recette du poste).
const PHASE = process.env.CAPTURE_PHASE === "avant" ? "avant" : "apres";

async function capture(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  await page.screenshot({ path: `${DOSSIER}/${nom}-${PHASE}-${largeur}.png` });
}

test("bandeau du bureau à 1280 px — recherche et « Créer »", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/planning");
  await page.waitForLoadState("networkidle");
  await capture(page, "bandeau-bureau", 1280);
});

test("bandeau à 375 px — inchangé", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/planning");
  await page.waitForLoadState("networkidle");
  await capture(page, "bandeau-bureau", 375);
});

test("dialogue de recherche avec résultats", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/planning");
  await page.keyboard.press("Control+k");
  // Scopé au DIALOGUE : `/planning` porte DÉJÀ un champ de filtre qui lui
  // est propre (le registre), de même type — sans ce cadrage, `locator`
  // trouverait les deux (rouge attendu sur l'AVANT, où le dialogue
  // n'existe pas : `count()` y vaut alors 0).
  const champ = page.locator('[role="dialog"] input[type="search"]');
  if ((await champ.count()) > 0) {
    await champ.fill("9DU-Client");
    await page.waitForTimeout(500);
  }
  await capture(page, "recherche-dialogue", 1280);
});

test("menu en rail à 1000 px", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto("/planning");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
  await capture(page, "rail", 1000);
});

test("menu déployé avec décomptes, à 1280 px", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/planning");
  await page.waitForLoadState("networkidle");
  await capture(page, "menu-decomptes", 1280);
});

test("« Réservé aux techniciens » — rôle de bureau sur /terrain (QT-24)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/terrain");
  await page.waitForLoadState("networkidle");
  await capture(page, "reserve-techniciens", 1280);
});
