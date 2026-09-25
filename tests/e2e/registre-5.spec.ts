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
 * 88-REGISTRE-5 — LE FILTRE ACTIF SE VOIT ET S'EFFACE, LA LIGNE ENTIÈRE
 * OUVRE LA FICHE.
 *
 * ## LE CONSTAT, mesuré le 25/09/2026 (audit d'ergonomie, constats 16 et 17)
 *
 * Après une recherche, rien ne rappelait le critère appliqué ni ne
 * permettait de l'effacer ; seule la référence (un lien de 40 px, coupé sur
 * deux lignes à 1280 px) ouvrait la fiche d'une ligne — le reste, 60 px de
 * haut, restait inerte.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `RG5-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — aucune ligne n'est ajoutée
 * au semis, même geste que `tests/e2e/liens-2.spec.ts`. Deux clients, DEUX
 * interventions : `client_cible` seul porte `texte_recherche` en
 * sous-chaîne — `client_autre`, bien que préfixé `RG5-` comme le reste de la
 * scène, ne le porte pas. La recherche `q=RG5-cible` ne doit donc trouver
 * QUE la première : un résultat unique prouve que c'est la RECHERCHE qui a
 * filtré, jamais le préfixe de scène tout entier (piège connu du ticket).
 */
test.describe.configure({ mode: "serial" });

const CLIENT_CIBLE = uuidv7();
const CLIENT_AUTRE = uuidv7();
const SITE_CIBLE = uuidv7();
const SITE_AUTRE = uuidv7();
const INTERVENTION_CIBLE = uuidv7();
const INTERVENTION_AUTRE = uuidv7();

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
        id: CLIENT_CIBLE,
        societe_id: societeId,
        raison_sociale: fr["registre5.e2e.client_cible"],
        actif: true,
      },
    });
    await client.client.create({
      data: {
        id: CLIENT_AUTRE,
        societe_id: societeId,
        raison_sociale: fr["registre5.e2e.client_autre"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_CIBLE,
        societe_id: societeId,
        client_id: CLIENT_CIBLE,
        agence_id: agence.id,
        libelle: fr["registre5.e2e.site"],
      },
    });
    await client.site.create({
      data: {
        id: SITE_AUTRE,
        societe_id: societeId,
        client_id: CLIENT_AUTRE,
        agence_id: agence.id,
        libelle: fr["registre5.e2e.site"],
      },
    });

    for (const [interventionId, clientId, siteId] of [
      [INTERVENTION_CIBLE, CLIENT_CIBLE, SITE_CIBLE],
      [INTERVENTION_AUTRE, CLIENT_AUTRE, SITE_AUTRE],
    ] as const) {
      await client.$executeRawUnsafe(
        `INSERT INTO "intervention"
           ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "modifie_le")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'a_planifier', now())`,
        interventionId,
        societeId,
        clientId,
        siteId,
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
      `DELETE FROM "intervention" WHERE "client_id" IN ($1::uuid, $2::uuid)`,
      CLIENT_CIBLE,
      CLIENT_AUTRE,
    );
    await client.site.deleteMany({
      where: { client_id: { in: [CLIENT_CIBLE, CLIENT_AUTRE] } },
    });
    await client.client.deleteMany({
      where: { id: { in: [CLIENT_CIBLE, CLIENT_AUTRE] } },
    });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/88-REGISTRE-5/captures",
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

test("la recherche pose une puce retirable, qui n'annonce que ce seul critère", async ({
  page,
}) => {
  await page.goto(
    `/interventions?q=${encodeURIComponent(fr["registre5.e2e.texte_recherche"])}`,
  );
  // TÉMOIN — la scène est comptée « large » ailleurs (piège connu du
  // ticket) : sans cette ligne exacte, ce scénario ne prouve rien.
  await expect(page.locator("table tbody tr")).toHaveCount(1);

  const puceRecherche = `${fr["interventions.puce_recherche"]}${fr["ponctuation.deux_points"]}${fr["registre5.e2e.texte_recherche"]}`;
  const puce = page.locator('[data-puce="q"]');
  await expect(puce).toBeVisible();
  await expect(puce).toContainText(puceRecherche);
  await capturer(page, "registre-filtre-1280");

  const retirer = puce.locator("a");
  await expect(retirer).toBeVisible();
  const hrefRetirer = await retirer.getAttribute("href");
  expect(hrefRetirer).not.toBeNull();
  const urlRetirer = new URL(hrefRetirer as string, "http://localhost");
  expect(urlRetirer.searchParams.has("q")).toBe(false);

  await retirer.click();
  // ATTENTE EXPLICITE DE LA NAVIGATION — un motif qui accepterait aussi
  // l'ANCIENNE URL (`?q=…` compris) passerait avant que le clic n'ait rien
  // changé : c'est l'absence du paramètre qui doit être attendue, pas
  // seulement la forme générale de l'URL.
  await page.waitForURL((url) => !url.searchParams.has("q"));
  const urlApres = new URL(page.url());
  expect(urlApres.searchParams.has("q")).toBe(false);
});

test("cliquer la cellule CLIENT de la ligne ouvre la fiche, comme la référence", async ({
  page,
}) => {
  await page.goto(
    `/interventions?q=${encodeURIComponent(fr["registre5.e2e.texte_recherche"])}`,
  );
  const ligne = page.locator("table tbody tr").first();
  await expect(ligne).toBeVisible();

  const hrefReference = await ligne
    .locator('a[href^="/interventions/"]')
    .getAttribute("href");
  expect(hrefReference).not.toBeNull();
  const idFiche = new URL(hrefReference as string, "http://localhost").pathname
    .split("/")
    .pop();
  expect(idFiche).not.toBeUndefined();

  await ligne.getByText(fr["registre5.e2e.client_cible"]).click();
  await expect(page).toHaveURL(
    new RegExp(`/interventions/${idFiche}(?:\\?.*)?$`),
  );
});
