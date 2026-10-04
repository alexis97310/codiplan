import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { t } from "@/lib/i18n/fr";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES AVANT/APRÈS DE 9DN-TP-CLI1-CLIENT-INACTIF (N1, addendum 9DN,
 * 05/10/2026) — jamais produites par la session d'origine (passation 9DN,
 * « Ce que je n'ai pas fait »).
 *
 * **Recette** (mémoire de session « captures-avant-apres-e2e ») : ce fichier
 * tourne une fois dans un worktree sur 69e3a145 (AVANT 9DN — `CAPTURES_9DN_ETAPE=avant`),
 * une fois ici, sur le code livré (APRÈS — `CAPTURES_9DN_ETAPE=apres`). Rien
 * n'est écrit sans `CAPTURES_9DN` (le dossier), pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * **Les assertions restent minimales** : ce fichier doit passer SANS
 * modification sur le code d'AVANT 9DN, qui ne connaît ni le refus
 * d'interventions ouvertes, ni le badge « Client inactif » sur `/sites`, ni
 * la ligne « Courriels de planification ». Seule la navigation et la capture
 * comptent ; le TEXTE affiché peut différer d'une étape à l'autre, et c'est
 * tout le sens de la paire.
 *
 * **SA PROPRE SCÈNE, préfixée `9DN-CAPT-`** — trois clients, deux sites,
 * créés en `beforeAll`, supprimés en `afterAll`. Jamais `SCENE.*`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9DN ?? "";
const ETAPE = process.env.CAPTURES_9DN_ETAPE ?? "avant";

const CLIENT_ACTIF = randomUUID();
const SITE_ACTIF = randomUUID();
const CLIENT_REFUS = randomUUID();
const SITE_REFUS = randomUUID();
const INTERVENTION_OUVERTE = randomUUID();
const CLIENT_INACTIF = randomUUID();
const SITE_INACTIF = randomUUID();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({ where: { id: INTERVENTION_OUVERTE } });
  await client.site.deleteMany({
    where: { id: { in: [SITE_ACTIF, SITE_REFUS, SITE_INACTIF] } },
  });
  await client.client.deleteMany({
    where: { id: { in: [CLIENT_ACTIF, CLIENT_REFUS, CLIENT_INACTIF] } },
  });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_ACTIF,
        societe_id: societe.id,
        raison_sociale: "9DN-CAPT-Client actif",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ACTIF,
        societe_id: societe.id,
        client_id: CLIENT_ACTIF,
        agence_id: agence.id,
        libelle: "9DN-CAPT-Site actif",
        commune: "Nouméa",
      },
    });

    await client.client.create({
      data: {
        id: CLIENT_REFUS,
        societe_id: societe.id,
        raison_sociale: "9DN-CAPT-Client avec intervention ouverte",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_REFUS,
        societe_id: societe.id,
        client_id: CLIENT_REFUS,
        agence_id: agence.id,
        libelle: "9DN-CAPT-Site (intervention ouverte)",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_OUVERTE,
        societe_id: societe.id,
        client_id: CLIENT_REFUS,
        site_id: SITE_REFUS,
        agence_id: agence.id,
        type: "curatif",
      },
    });

    // DÉJÀ INACTIF au départ — jamais obtenu par le formulaire ici : ce
    // client sert les captures de `/sites` et de la fiche site, qui ne
    // dépendent pas du GESTE de désactivation, seulement de l'ÉTAT.
    await client.client.create({
      data: {
        id: CLIENT_INACTIF,
        societe_id: societe.id,
        raison_sociale: "9DN-CAPT-Client inactif",
        actif: false,
      },
    });
    await client.site.create({
      data: {
        id: SITE_INACTIF,
        societe_id: societe.id,
        client_id: CLIENT_INACTIF,
        agence_id: agence.id,
        libelle: "9DN-CAPT-Site (client inactif)",
        commune: "Koné",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${ETAPE}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 375] as const) {
  test(`fiche client ACTIF, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await page.goto(`/clients/${CLIENT_ACTIF}`);
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "fiche-client-actif", largeur);
  });

  test(`fiche client — tentative de désactivation avec une intervention ouverte, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await page.goto(`/clients/${CLIENT_REFUS}`);
    await page.locator('select[name="actif"]').selectOption("false");
    await page
      .getByRole("button", { name: t("clients.action.modifier") })
      .click();
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "fiche-client-refus-desactivation", largeur);
  });

  test(`/sites — la carte d'un site dont le client est inactif, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await page.goto(
      `/sites?q=${encodeURIComponent("9DN-CAPT-Site (client inactif)")}&sans_equipement=1`,
    );
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "sites-client-inactif", largeur);
  });
}

test("fiche site — client inactif, à 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 1200 });
  await page.goto(`/sites/${SITE_INACTIF}`);
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "fiche-site-client-inactif", 375);
});
