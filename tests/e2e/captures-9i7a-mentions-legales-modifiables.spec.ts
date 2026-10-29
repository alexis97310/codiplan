import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * CAPTURES — 9I7A-MENTIONS-LEGALES-MODIFIABLES, point 4.
 *
 * La ligne au repos, la saisie ouverte (carte « Identité », `/parametres`)
 * et le bon montrant le pied, à 375 et 1280 px — même patron que
 * `tests/e2e/captures-9i7-bon-en-tuiles.spec.ts`.
 *
 * **La société de la scène est PARTAGÉE par tout le run e2e** —
 * `societe.mentions_legales` n'a pas de fixture à soi : ce fichier tourne en
 * SÉRIE, pose le texte le plus tard possible et le RETIRE dans `afterAll`,
 * même discipline que `tests/e2e/9ez-logo-societe.spec.ts` pour le logo.
 *
 * SA PROPRE intervention (`zz9I7A-`), jamais celle d'un autre fichier.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9I7A-MENTIONS-LEGALES-MODIFIABLES/captures",
);

const CLIENT_ID = randomUUID();
const SITE_ID = randomUUID();
const INTERVENTION_ID = randomUUID();

const MENTIONS_LEGALES_DE_TEST =
  "zz9I7A — SARL au capital de 1 000 000 XPF\nRIDET 000 000.000\nSiège : 1 rue des Essais, Nouméa";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
  await client.site.deleteMany({ where: { id: SITE_ID } });
  await client.client.deleteMany({ where: { id: CLIENT_ID } });
}

async function retirerLesMentionsLegales(): Promise<void> {
  const client = admin();
  try {
    const reperes = await reperesDeLaScene();
    await client.societe.update({
      where: { id: reperes.societeId },
      data: { mentions_legales: null },
    });
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await nettoyer(client);
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "zz9I7A-Client (mentions légales)",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "zz9I7A-Lieu (mentions légales)",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        statut: "planifiee",
        type: "curatif",
        duree_estimee_min: 60,
        date_planifiee: new Date(),
      },
    });
    // LE BON N'EXISTE QUE POUR UN TRAVAIL FAIT — deux transitions, même geste
    // que `9ez-logo-societe.spec.ts`.
    await client.$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'en_cours'::"StatutIntervention" WHERE "id" = $1::uuid`,
      INTERVENTION_ID,
    );
    await client.$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'terminee'::"StatutIntervention" WHERE "id" = $1::uuid`,
      INTERVENTION_ID,
    );
  } finally {
    await client.$disconnect();
  }
  await retirerLesMentionsLegales();
});

test.afterAll(async () => {
  await retirerLesMentionsLegales();
  const client = admin();
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

async function ouvrirEnAdmin(page: Page): Promise<void> {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
}

for (const largeur of [375, 1280] as const) {
  test(`ligne au repos — ${largeur}px`, async ({ page }) => {
    await ouvrirEnAdmin(page);
    await page.goto("/parametres");
    await expect(
      page.getByText(fr["parametres.identite_mentions_legales"], {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: fr["parametres.identite_mentions_legales_modifier"],
      }),
    ).toBeVisible();
    await capturer(page, "mentions-legales-ligne-au-repos", largeur);
  });
}

for (const largeur of [375, 1280] as const) {
  test(`saisie ouverte — ${largeur}px`, async ({ page }) => {
    await ouvrirEnAdmin(page);
    await page.goto("/parametres");
    await page
      .getByRole("button", {
        name: fr["parametres.identite_mentions_legales_modifier"],
      })
      .click();
    await page
      .getByRole("textbox", {
        name: fr["parametres.identite_mentions_legales"],
      })
      .fill(MENTIONS_LEGALES_DE_TEST);
    await expect(
      page.getByText(fr["parametres.identite_mentions_legales_apercu_titre"]),
    ).toBeVisible();
    await capturer(page, "mentions-legales-saisie-ouverte", largeur);
  });
}

test("l'enregistrement se relit sur la ligne, et sur le pied du bon", async ({
  page,
}) => {
  await ouvrirEnAdmin(page);
  await page.goto("/parametres");
  await page
    .getByRole("button", {
      name: fr["parametres.identite_mentions_legales_modifier"],
    })
    .click();
  await page
    .getByRole("textbox", {
      name: fr["parametres.identite_mentions_legales"],
    })
    .fill(MENTIONS_LEGALES_DE_TEST);
  await page
    .getByRole("button", {
      name: fr["parametres.identite_mentions_legales_enregistrer"],
    })
    .click();
  await page.waitForLoadState("networkidle");
  // `.innerText()` + comparaison de chaîne, jamais `getByText` — c'est de la
  // DONNÉE de test (texte libre saisi par un administrateur), pas une copie
  // produit : même distinction que `tests/e2e/9ewe-tarifs-page-unique.spec.ts`
  // (innerText pour la valeur dynamique, `getByRole`/`t()` pour le libellé).
  const motifNormalise = MENTIONS_LEGALES_DE_TEST.replace(/\s+/g, " ").trim();
  const texteApresEnregistrement = (await page.locator("dl").innerText())
    .replace(/\s+/g, " ")
    .trim();
  expect(texteApresEnregistrement).toContain(motifNormalise);

  await page.goto(`/interventions/${INTERVENTION_ID}/bon`);
  const texteDuBon = (await page.locator(".zone-impression-bon").innerText())
    .replace(/\s+/g, " ")
    .trim();
  expect(texteDuBon).toContain(motifNormalise);

  for (const largeur of [375, 1280] as const) {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await capturer(page, "bon-avec-mentions-legales", largeur);
  }
});
