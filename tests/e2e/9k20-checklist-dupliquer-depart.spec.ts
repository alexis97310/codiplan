import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9K20-CHECKLIST-DUPLIQUER-DEPART — « Dupliquer » un modèle existant, et
 * « Partir d'un gabarit de départ » depuis `/parametres/checklists`.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `9K20-` : un modèle SOURCE, publié d'une
 * version, créé en `beforeAll` — même patron que `9k19-checklist-
 * parametrage.spec.ts`. Tout ce que les tests créent (la copie, le modèle
 * né du gabarit) est effacé en `afterAll`.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9K20-CHECKLIST-DUPLIQUER-DEPART/captures",
);

/** EN VIEWPORT, jamais `fullPage` — la capture montre ce qui se voit sans défiler. */
async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`) });
}

const CODE_SOURCE = "9K20-SOURCE";
const LIBELLE_SOURCE = "9K20-Source";
const CODE_COPIE = "9K20-COPIE";
const CODE_GABARIT = "9K20-GABARIT";
const MODELE_SOURCE_ID = uuidv7();

async function supprimerParCode(client: PrismaClient, code: string) {
  const modele = await client.checklistModele.findFirst({
    where: { code },
    select: { id: true },
  });
  if (modele !== null) {
    await client.checklistVersion.deleteMany({
      where: { checklist_modele_id: modele.id },
    });
    await client.checklistModele.deleteMany({ where: { id: modele.id } });
  }
}

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    await client.checklistModele.create({
      data: {
        id: MODELE_SOURCE_ID,
        societe_id: societe.id,
        code: CODE_SOURCE,
        libelle: LIBELLE_SOURCE,
      },
    });
    const versionId = uuidv7();
    await client.checklistVersion.create({
      data: {
        id: versionId,
        societe_id: societe.id,
        checklist_modele_id: MODELE_SOURCE_ID,
        numero: 1,
      },
    });
    await client.checklistPoint.create({
      data: {
        id: uuidv7(),
        societe_id: societe.id,
        checklist_version_id: versionId,
        section: "Sécurité",
        ordre: 1,
        libelle: "Point de la source",
        type_reponse: "case_faite",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await supprimerParCode(client, CODE_COPIE);
    await supprimerParCode(client, CODE_GABARIT);
    await supprimerParCode(client, CODE_SOURCE);
  } finally {
    await client.$disconnect();
  }
});

async function connexionAdmin(page: Page): Promise<void> {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
}

test("« Dupliquer » — nouveau code, libellé repris, la dernière version recopiée en v1", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/checklists");

  const table = page.locator("table").first();
  await table
    .locator("tr", { hasText: CODE_SOURCE })
    .getByRole("link", { name: fr["checklist.parametrage.dupliquer"] })
    .click();

  const volet = page.getByRole("dialog");
  await expect(
    volet.getByRole("heading", {
      name: fr["checklist.parametrage.dupliquer_titre"],
    }),
  ).toBeVisible();
  // Le libellé est REPRIS de la source, modifiable.
  await expect(
    volet.getByLabel(fr["checklist.parametrage.libelle"]),
  ).toHaveValue(LIBELLE_SOURCE);

  await volet.getByLabel(fr["checklist.parametrage.code"]).fill(CODE_COPIE);
  await volet
    .getByRole("button", {
      name: fr["checklist.parametrage.dupliquer_action"],
    })
    .click();

  await expect(page).toHaveURL(/\/parametres\/checklists$/);
  const ligne = page
    .locator("table")
    .first()
    .locator("tr", { hasText: CODE_COPIE });
  await expect(ligne).toHaveCount(1);
  await expect(ligne.filter({ hasText: "n°1" })).toHaveCount(1);

  await ligne
    .getByRole("link", { name: fr["checklist.parametrage.modifier_version"] })
    .click();
  await expect(page).toHaveURL(/\/parametres\/checklists\/.+\/version$/);
  await expect(
    page.getByLabel(fr["checklist.parametrage.point_libelle"]).first(),
  ).toHaveValue("Point de la source");
});

test("« Partir d'un gabarit de départ » — le modèle naît avec les quinze points du gabarit", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/checklists");

  await page
    .getByRole("link", { name: fr["checklist.parametrage.partir_gabarit"] })
    .click();
  const volet = page.getByRole("dialog");
  await expect(
    volet.getByRole("heading", {
      name: fr["checklist.parametrage.partir_gabarit"],
    }),
  ).toBeVisible();

  await volet.getByLabel(fr["checklist.parametrage.code"]).fill(CODE_GABARIT);
  await volet
    .getByLabel(fr["checklist.parametrage.libelle"])
    .fill("9K20-Depuis gabarit");
  await volet
    .getByRole("button", {
      name: fr["checklist.parametrage.partir_gabarit_action"],
    })
    .click();

  await expect(page).toHaveURL(/\/parametres\/checklists$/);
  const ligne = page
    .locator("table")
    .first()
    .locator("tr", { hasText: CODE_GABARIT });
  await expect(ligne.filter({ hasText: "n°1" })).toHaveCount(1);

  await ligne
    .getByRole("link", { name: fr["checklist.parametrage.modifier_version"] })
    .click();
  await expect(page).toHaveURL(/\/parametres\/checklists\/.+\/version$/);
  await expect(
    page.getByLabel(fr["checklist.parametrage.point_libelle"]),
  ).toHaveCount(15);
});

test("captures — « Dupliquer » et « Partir d'un gabarit de départ », à 1280 et 375 px", async ({
  page,
}) => {
  await connexionAdmin(page);

  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto("/parametres/checklists?volet=gabarit");
  await capturer(page, "volet-gabarit-1280");

  await page.goto(
    `/parametres/checklists?volet=dupliquer&source=${MODELE_SOURCE_ID}`,
  );
  await capturer(page, "volet-dupliquer-1280");

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/parametres/checklists?volet=gabarit");
  await capturer(page, "volet-gabarit-375");

  await page.goto(
    `/parametres/checklists?volet=dupliquer&source=${MODELE_SOURCE_ID}`,
  );
  await capturer(page, "volet-dupliquer-375");
});
