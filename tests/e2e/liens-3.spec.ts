import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 79-LIENS-3 — REVENIR D'UNE FICHE MACHINE AU PARC TEL QU'ON L'AVAIT LAISSÉ.
 *
 * ## LE DÉFAUT, mesuré sur main le 25/09/2026
 *
 * « Fiche complète » menait à `/parc/<id>` nu, et le lien « Retour » de la
 * fiche vers `/parc` nu — un lien NU, sans la recherche ni la page en cours.
 * Le retour depuis la fiche perdait tout : un exploitant qui filtrait
 * « page 2 » revenait systématiquement sur la vue par défaut, page 1.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `LIE3-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — aucune ligne n'est ajoutée
 * au semis, même discipline que `tests/e2e/liens-2.spec.ts`. **51 machines**
 * portent toutes le même client `LIE3-Client de l'épreuve` : la recherche
 * `q=LIE3-` les isole du reste du parc (semis compris, et les scènes des
 * autres specs exécutées en parallèle sous `fullyParallel`), et 51 lignes à
 * `LIMITE_RECHERCHE_PAR_DEFAUT = 50` par page donnent EXACTEMENT une page 2
 * d'une seule ligne — le terrain nécessaire pour prouver qu'un retour depuis
 * la page 2 REJOINT la page 2, pas la page 1.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_LIE3 = uuidv7();
const SITE_LIE3 = uuidv7();
const NOMBRE_MACHINES = 51;

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
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: societeId },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_LIE3,
        societe_id: societeId,
        raison_sociale: fr["liens3.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_LIE3,
        societe_id: societeId,
        client_id: CLIENT_LIE3,
        agence_id: agence.id,
        libelle: fr["liens3.e2e.site"],
      },
    });

    for (let i = 0; i < NOMBRE_MACHINES; i += 1) {
      await client.machine.create({
        data: {
          id: uuidv7(),
          societe_id: societeId,
          modele_id: modele.id,
          client_id: CLIENT_LIE3,
          site_id: SITE_LIE3,
          numero_serie: `LIE3-SN-${i}`,
          qr_token: engendrerJetonQr(),
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
    await client.machine.deleteMany({ where: { client_id: CLIENT_LIE3 } });
    await client.site.deleteMany({ where: { client_id: CLIENT_LIE3 } });
    await client.client.deleteMany({ where: { id: CLIENT_LIE3 } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/79-LIENS-3/captures",
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
  await page.goto("/parc?q=LIE3-&page=2");
  // TÉMOIN — la scène a été comptée « large » ailleurs (voir « piège connu »
  // du ticket) : sans cette ligne exacte, ce scénario ne prouve rien.
  await expect(page.locator('[data-bloc="liste-machines"] a')).toHaveCount(1);
  const ficheComplete = page.getByRole("link", {
    name: fr["parc.fiche_complete"],
  });
  await expect(ficheComplete).toBeVisible();
  await capturer(page, "parc-page-2-avant-ouverture");

  await ficheComplete.click();
  await expect(page).toHaveURL(/\/parc\/[^/?]+\?retour=/);

  const retour = page.getByRole("link", { name: fr["machine.retour"] });
  await expect(retour).toBeVisible();
  const hrefRetour = await retour.getAttribute("href");
  expect(hrefRetour).not.toBeNull();
  expect(hrefRetour).toContain("q=LIE3-");
  expect(hrefRetour).toContain("page=2");
  await capturer(page, "fiche-machine-lien-retour");

  await retour.click();
  await expect(page).toHaveURL(/\/parc\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get("q")).toBe("LIE3-");
  expect(url.searchParams.get("page")).toBe("2");
  await capturer(page, "parc-page-2-apres-retour");
});

test("sans retour dans l'URL de la fiche, le lien mène au parc nu — comportement inchangé", async ({
  page,
}) => {
  await page.goto("/parc?q=LIE3-");
  const ficheComplete = page.getByRole("link", {
    name: fr["parc.fiche_complete"],
  });
  await expect(ficheComplete).toBeVisible();
  const href = await ficheComplete.getAttribute("href");
  expect(href).not.toBeNull();
  const idFiche = new URL(href as string, "http://localhost").pathname
    .split("/")
    .pop();
  expect(idFiche).not.toBeUndefined();

  await page.goto(`/parc/${idFiche}`);
  const retour = page.getByRole("link", { name: fr["machine.retour"] });
  await expect(retour).toBeVisible();
  await expect(retour).toHaveAttribute("href", "/parc");
});

test("un paramètre de retour forgé, hors liste fermée, ne mène jamais hors du parc", async ({
  page,
}) => {
  await page.goto("/parc?q=LIE3-");
  const ficheComplete = page.getByRole("link", {
    name: fr["parc.fiche_complete"],
  });
  await expect(ficheComplete).toBeVisible();
  const href = await ficheComplete.getAttribute("href");
  expect(href).not.toBeNull();
  const idFiche = new URL(href as string, "http://localhost").pathname
    .split("/")
    .pop();
  expect(idFiche).not.toBeUndefined();

  await page.goto(
    `/parc/${idFiche}?retour=${encodeURIComponent("https://exemple-etranger.test")}`,
  );
  const retour = page.getByRole("link", { name: fr["machine.retour"] });
  await expect(retour).toBeVisible();
  await expect(retour).toHaveAttribute("href", "/parc");
});
