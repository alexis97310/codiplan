import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * `/interventions/nouvelle?client=<id>` (9BL-TP-A1-HISTORIQUES-CLIENT-SITE,
 * audit du 28/09/2026, IN-04) — LE BOUTON « + INTERVENTION » DE LA FICHE
 * CLIENT NE PRÉREMPLISSAIT RIEN.
 *
 * ## Ce que ce scénario prouve
 *
 * Deux propriétés du paramètre `?client=`, sur une scène à SOI (deux clients
 * préfixés `TPA1-`, jamais le semis partagé — même piège que
 * `historique-site.spec.ts`) :
 *
 * 1. **La recherche de site se BORNE à ce client** — un mot commun aux deux
 *    sites (« Atelier ») ne ramène, sous `?client=`, QUE le site du client
 *    visé, jamais celui de l'autre.
 * 2. **Un client à UN SEUL site actif arrive présélectionné** — même forme
 *    que `?site=` (LIENS-1, `selecteurs-1.spec.ts`).
 *
 * Sur `main` avant ce lot, la première assertion rougit : `ChampSiteEtMachines`
 * n'ajoutait `client` à aucun paramètre de recherche, et la seconde aussi —
 * rien ne préremplissait de site depuis `?client=`.
 */

test.describe.configure({ mode: "serial" });

const CLIENT_UN = "e2e00000-0000-7000-8000-00000009a2f1";
const SITE_UN = "e2e00000-0000-7000-8000-00000009a1f1";
const CLIENT_AUTRE = "e2e00000-0000-7000-8000-00000009a2f2";
const SITE_AUTRE = "e2e00000-0000-7000-8000-00000009a1f2";

/** Le mot commun (« Atelier ») est délibéré — voir le docblock. */
const LIBELLE_SITE_UN = "TPA1- Atelier du client visé";
const LIBELLE_SITE_AUTRE = "TPA1- Atelier du client voisin";

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });
    await client.site.deleteMany({
      where: { id: { in: [SITE_UN, SITE_AUTRE] } },
    });
    await client.client.deleteMany({
      where: { id: { in: [CLIENT_UN, CLIENT_AUTRE] } },
    });
    await client.client.create({
      data: {
        id: CLIENT_UN,
        societe_id: societe.id,
        raison_sociale: "TPA1- Client à un seul site",
        actif: true,
      },
    });
    await client.client.create({
      data: {
        id: CLIENT_AUTRE,
        societe_id: societe.id,
        raison_sociale: "TPA1- Client voisin",
        actif: true,
      },
    });
    // LE MOT COMMUN (« Atelier ») EST DÉLIBÉRÉ : sans le filtre `?client=`,
    // une recherche sur ce mot ramènerait LES DEUX sites.
    await client.site.create({
      data: {
        id: SITE_UN,
        societe_id: societe.id,
        client_id: CLIENT_UN,
        agence_id: agence.id,
        libelle: LIBELLE_SITE_UN,
        temps_trajet_min: 10,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_AUTRE,
        societe_id: societe.id,
        client_id: CLIENT_AUTRE,
        agence_id: agence.id,
        libelle: LIBELLE_SITE_AUTRE,
        temps_trajet_min: 10,
        actif: true,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.site.deleteMany({
      where: { id: { in: [SITE_UN, SITE_AUTRE] } },
    });
    await client.client.deleteMany({
      where: { id: { in: [CLIENT_UN, CLIENT_AUTRE] } },
    });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("?client= présélectionne le site UNIQUE de ce client", async ({
  page,
}) => {
  await page.goto(`/interventions/nouvelle?client=${CLIENT_UN}`);
  const valeurCachee = page.locator(
    '[data-selecteur="site"] input[type="hidden"]',
  );
  await expect(valeurCachee).toHaveValue(`${CLIENT_UN}:${SITE_UN}`);
});

test("?client= borne la recherche de site à CE client — jamais celui d'un autre client", async ({
  page,
}) => {
  await page.goto(`/interventions/nouvelle?client=${CLIENT_UN}`);
  const bloc = page.locator('[data-selecteur="site"]');
  const saisie = bloc.locator('input[type="text"]');
  await saisie.click();
  await Promise.all([
    page.waitForResponse((reponse) => reponse.url().includes("q=Atelier")),
    saisie.fill("Atelier"),
  ]);
  const options = bloc.locator('ul[role="listbox"] li[role="option"]');
  await expect(options).toHaveCount(1);
  // `toContain` (générique), jamais `toContainText` (Playwright) : le texte
  // est déjà lu par `innerText()`, comparé comme une chaîne ordinaire — le
  // gardien `sans-chaine-visible-en-dur` (L0-11) ne suit que les requêtes
  // d'écran nommées, jamais une comparaison de chaînes déjà en main.
  const texteOption = (await options.first().innerText()).trim();
  expect(texteOption).toContain(LIBELLE_SITE_UN);
  const texteBloc = await bloc.innerText();
  expect(texteBloc).not.toContain(LIBELLE_SITE_AUTRE);
});
