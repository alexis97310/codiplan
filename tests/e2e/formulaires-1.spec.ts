import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  choisirResultatParTexte,
  valeurChamp,
} from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * 55-FORMULAIRES-1 (SAV-02) — UN DOUBLE CLIC SUR « CRÉER L'INTERVENTION » NE
 * CRÉE QU'UNE SEULE INTERVENTION.
 *
 * ## LE DÉFAUT MESURÉ
 *
 * `app/api/interventions/creer/route.ts` fabriquait un `id` CÔTÉ SERVEUR à
 * CHAQUE requête (`uuidv7()`) — deux soumissions du même formulaire posaient
 * donc deux lignes distinctes. La page rend maintenant l'`id` au RENDU, dans
 * un champ caché : deux soumissions du même formulaire portent désormais LE
 * MÊME `id`, et la route ne crée la seconde fois rien — elle redirige vers la
 * fiche que la première a déjà créée.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `FRM1-`
 *
 * Un client, un site — créés en `beforeAll`, supprimés en `afterAll`. Aucune
 * ligne n'est ajoutée au semis. Le décompte final ne porte QUE sur les
 * interventions dont la panne signalée est `FRM1-panne` : sous
 * `fullyParallel`, compter toute la société mesurerait aussi ce que d'autres
 * fichiers créent au même instant (piège déjà mesuré sur
 * `porte-capacites.spec.ts`, 24/09/2026).
 */
test.describe.configure({ mode: "serial" });

const CLIENT_FRM1 = uuidv7();
const SITE_FRM1 = uuidv7();
const LIBELLE_SITE = "FRM1-site";
const PANNE = "FRM1-panne";

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
        id: CLIENT_FRM1,
        societe_id: reperes.societeId,
        raison_sociale: "FRM1-client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_FRM1,
        societe_id: reperes.societeId,
        client_id: CLIENT_FRM1,
        agence_id: agence.id,
        libelle: LIBELLE_SITE,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({ where: { description: PANNE } });
    await client.site.deleteMany({ where: { id: SITE_FRM1 } });
    await client.client.deleteMany({ where: { id: CLIENT_FRM1 } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/55-FORMULAIRES-1/captures",
);

test("un double clic sur « Créer l'intervention » ne crée qu'une seule intervention", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/interventions/nouvelle");
  await choisirResultatParTexte(page, "site", LIBELLE_SITE, LIBELLE_SITE);
  await page.locator('textarea[name="description"]').fill(PANNE);

  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  for (const largeur of [375, 1280]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.screenshot({
      path: join(DOSSIER_CAPTURES, `formulaire-rempli-${largeur}.png`),
      fullPage: true,
    });
  }

  // L'`ID` EST CELUI QUE LA PAGE A TIRÉ AU RENDU — c'est LUI que les deux
  // soumissions ci-dessous rejouent, exactement comme un double clic sur le
  // même bouton soumettrait deux fois le même champ caché.
  const id = await page.locator('input[type="hidden"][name="id"]').inputValue();
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  const site = await valeurChamp(page, "site").inputValue();
  const type = await page.locator('select[name="type"]').inputValue();
  const champs = { id, site, description: PANNE, type };

  const premiere = await page.request.post("/api/interventions/creer", {
    form: champs,
    maxRedirects: 0,
  });
  expect(premiere.status()).toBe(303);
  const emplacement = premiere.headers()["location"] ?? "";
  expect(emplacement).toMatch(/^\/interventions\/[0-9a-f-]+$/);

  // LA SECONDE SOUMISSION, MÊMES CHAMPS, MÊME `id` — ne crée rien, et mène à
  // LA MÊME fiche.
  const seconde = await page.request.post("/api/interventions/creer", {
    form: champs,
    maxRedirects: 0,
  });
  expect(seconde.status()).toBe(303);
  expect(seconde.headers()["location"] ?? "").toBe(emplacement);

  // EXACTEMENT UNE INTERVENTION « FRM1- » — jamais deux.
  const client = admin();
  try {
    const compte = await client.intervention.count({
      where: { description: PANNE },
    });
    expect(compte).toBe(1);
  } finally {
    await client.$disconnect();
  }

  await page.goto(emplacement);
  for (const largeur of [375, 1280]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.screenshot({
      path: join(
        DOSSIER_CAPTURES,
        `fiche-apres-double-soumission-${largeur}.png`,
      ),
      fullPage: true,
    });
  }
});
