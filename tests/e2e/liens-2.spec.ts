import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 78-LIENS-2 — REVENIR D'UNE FICHE AU REGISTRE TEL QU'ON L'AVAIT LAISSÉ.
 *
 * ## LE DÉFAUT, mesuré sur main 876db2e le 25/09/2026
 *
 * Chaque ligne du registre menait à `/interventions/<id>?depuis=interventions`
 * — un lien NU, sans la vue, la recherche, les filtres ni la page en cours.
 * Le retour depuis la fiche perdait tout : le chef d'atelier qui filtrait
 * « page 3 » revenait systématiquement sur la vue par défaut, page 1.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `LIE2-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — aucune ligne n'est ajoutée
 * au semis, même geste que `tests/e2e/registre-2.spec.ts`. **51 interventions**
 * portent toutes le même client `LIE2-Client de l'épreuve` : la recherche
 * `q=LIE2-` les isole du reste du parc (semis compris, et les scènes des
 * autres specs exécutées en parallèle sous `fullyParallel`), et 51 lignes à
 * `LIMITE_RECHERCHE_PAR_DEFAUT = 50` par page donnent EXACTEMENT une page 2
 * d'une seule ligne — le terrain nécessaire pour prouver qu'un retour depuis
 * la page 2 REJOINT la page 2, pas la page 1.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_LIE2 = uuidv7();
const SITE_LIE2 = uuidv7();
const NOMBRE_INTERVENTIONS = 51;

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
        id: CLIENT_LIE2,
        societe_id: societeId,
        raison_sociale: fr["liens2.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_LIE2,
        societe_id: societeId,
        client_id: CLIENT_LIE2,
        agence_id: agence.id,
        libelle: fr["liens2.e2e.site"],
      },
    });

    for (let i = 0; i < NOMBRE_INTERVENTIONS; i += 1) {
      await client.$executeRawUnsafe(
        `INSERT INTO "intervention"
           ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "modifie_le")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'a_planifier', now())`,
        uuidv7(),
        societeId,
        CLIENT_LIE2,
        SITE_LIE2,
        agence.id,
      );
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_LIE2,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_LIE2 } });
    await client.client.deleteMany({ where: { id: CLIENT_LIE2 } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/86-LIENS-2-REPRISE/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-1280.png`),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("le retour depuis une fiche ouverte en page 2 rejoint la page 2 avec la recherche intacte", async ({
  page,
}) => {
  await page.goto("/interventions?q=LIE2-&page=2");
  // TÉMOIN — la scène a été comptée « large » ailleurs (voir « piège connu » du
  // ticket) : sans cette ligne exacte, ce scénario ne prouve rien.
  await expect(page.locator("table tbody tr")).toHaveCount(1);
  await capturer(page, "registre-page-2-avant-ouverture");

  const ligne = page.locator("table tbody tr").first();
  await ligne.locator('a[href^="/interventions/"]').click();

  const retour = page.getByRole("link", {
    name: fr["intervention.retour.interventions"],
  });
  await expect(retour).toBeVisible();
  const hrefRetour = await retour.getAttribute("href");
  expect(hrefRetour).not.toBeNull();
  expect(hrefRetour).toContain("q=LIE2-");
  expect(hrefRetour).toContain("page=2");
  await capturer(page, "fiche-lien-retour");

  await retour.click();
  await expect(page).toHaveURL(/\/interventions\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get("q")).toBe("LIE2-");
  expect(url.searchParams.get("page")).toBe("2");
  await expect(page.locator("table tbody tr")).toHaveCount(1);
  await capturer(page, "registre-page-2-apres-retour");
});

/**
 * L'IDENTIFIANT DE LA FICHE, LU DEPUIS LE `href` DE LA LIGNE — jamais depuis
 * `page.url()` après un clic : la navigation Next.js est asynchrone, et lire
 * l'URL trop tôt renverrait encore `/interventions` (mesuré : `idFiche`
 * valait alors le mot « interventions », que Prisma refusait comme UUID).
 */
async function idDeLaPremiereFiche(page: Page): Promise<string> {
  const ligne = page.locator("table tbody tr").first();
  const href = await ligne
    .locator('a[href^="/interventions/"]')
    .getAttribute("href");
  expect(href).not.toBeNull();
  const id = new URL(href as string, "http://localhost").pathname
    .split("/")
    .pop();
  expect(id).not.toBeUndefined();
  return id as string;
}

test("sans retour dans l'URL de la fiche, le lien mène au registre nu — comportement inchangé", async ({
  page,
}) => {
  await page.goto("/interventions?q=LIE2-");
  const idFiche = await idDeLaPremiereFiche(page);
  await page.goto(`/interventions/${idFiche}?depuis=interventions`);

  const retour = page.getByRole("link", {
    name: fr["intervention.retour.interventions"],
  });
  await expect(retour).toBeVisible();
  await expect(retour).toHaveAttribute("href", "/interventions");
});

test("un paramètre de retour forgé, hors liste fermée, ne mène jamais hors du registre", async ({
  page,
}) => {
  await page.goto("/interventions?q=LIE2-");
  const idFiche = await idDeLaPremiereFiche(page);

  await page.goto(
    `/interventions/${idFiche}?depuis=interventions&retour=${encodeURIComponent("https://exemple-etranger.test")}`,
  );
  const retour = page.getByRole("link", {
    name: fr["intervention.retour.interventions"],
  });
  await expect(retour).toBeVisible();
  await expect(retour).toHaveAttribute("href", "/interventions");
});
