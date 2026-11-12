import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  gabaritDeDepart,
  type GabaritDeDepart,
} from "@/lib/checklists/gabarits-de-depart";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9K30A-CHECKLIST-GABARITS-VALIDES, DE BOUT EN BOUT.
 *
 * ## Ce que les épreuves unitaires et d'isolation ne peuvent pas prouver
 *
 * `tests/unit/checklists/gabarits-de-depart.test.ts` prouve la FORME des 26
 * gabarits ; `tests/isolation/checklist-parametrage.test.ts` prouve que le
 * DÉPÔT écrit et relit une liste de types, cloisonnée par société. Aucun des
 * deux ne prouve que l'ÉCRAN « Partir d'un gabarit de départ » précoche
 * réellement les types SUGGÉRÉS d'un gabarit d'INSTALLATION, affiche son
 * rattachement suggéré, et laisse la société les MODIFIER avant de créer le
 * modèle — c'est le rôle de ce fichier.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `9K30A-` : aucune écriture sur la scène
 * partagée. Tout modèle créé par un test est effacé en `afterAll`, par son
 * code.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9K30A-CHECKLIST-GABARITS-VALIDES/captures",
);

/** EN VIEWPORT, jamais `fullPage` — la capture montre ce qui se voit sans défiler. */
async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`) });
}

const CODE_INSTALLATION = "9K30A-I01";
const CODE_TYPE_MODIFIE = "9K30A-TYPE-MODIFIE";

async function supprimerParCode(client: PrismaClient, code: string) {
  const modele = await client.checklistModele.findFirst({
    where: { code },
    select: { id: true },
  });
  if (modele !== null) {
    await client.checklistModeleTypeIntervention.deleteMany({
      where: { checklist_modele_id: modele.id },
    });
    await client.checklistVersion.deleteMany({
      where: { checklist_modele_id: modele.id },
    });
    await client.checklistModele.deleteMany({ where: { id: modele.id } });
  }
}

test.afterAll(async () => {
  const client = admin();
  try {
    await supprimerParCode(client, CODE_INSTALLATION);
    await supprimerParCode(client, CODE_TYPE_MODIFIE);
  } finally {
    await client.$disconnect();
  }
});

async function connexionAdmin(page: Page): Promise<void> {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
}

function gabaritExige(id: string): GabaritDeDepart {
  const gabarit = gabaritDeDepart(id);
  if (gabarit === undefined) {
    throw new Error(
      `Gabarit « ${id} » introuvable : l'épreuve ne peut pas s'écrire.`,
    );
  }
  return gabarit;
}

const GABARIT_I01 = gabaritExige(
  "pont-2-colonnes-electromecanique-installation",
);

/** Sélectionne le gabarit « Installation — pont 2 colonnes électromécanique » (I01). */
async function choisirGabaritInstallation(volet: Locator): Promise<void> {
  await volet
    .getByLabel(fr["checklist.parametrage.gabarit"])
    .selectOption({ label: GABARIT_I01.libelle });
}

/**
 * LE TEXTE D'UN LOCATOR, CAPTURÉ EN CHAÎNE — jamais `toContainText` sur un
 * `Locator` directement avec un littéral : le gardien L0-11 (`sans-chaine-
 * visible-en-dur.test.ts`) refuse une chaîne visible écrite en dur comme
 * ARGUMENT d'une requête d'écran. `.includes()` sur une chaîne déjà lue
 * n'est plus une requête d'écran — même idiome que `texteDuBloc`
 * (`9ewe-tarifs-page-unique.spec.ts`).
 */
async function texteDuBloc(locator: Locator): Promise<string> {
  return (await locator.innerText()).replace(/\s+/g, " ").trim();
}

test("« Partir d'un gabarit de départ » — un gabarit D'INSTALLATION précoche « Installation » et affiche son rattachement suggéré", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/checklists?volet=gabarit");

  const volet = page.getByRole("dialog");
  await choisirGabaritInstallation(volet);

  // LE RATTACHEMENT SUGGÉRÉ, en texte — jamais un identifiant choisi à la place de la société.
  const texteDuVolet = await texteDuBloc(volet);
  expect(GABARIT_I01.rattachementSuggere).not.toBeNull();
  expect(texteDuVolet.includes(GABARIT_I01.rattachementSuggere ?? "")).toBe(
    true,
  );

  // SEUL « Installation » est précoché — les huit autres types ne le sont pas.
  await expect(
    volet.getByRole("checkbox", {
      name: fr["type_intervention.installation"],
    }),
  ).toBeChecked();
  await expect(
    volet.getByRole("checkbox", { name: fr["type_intervention.curatif"] }),
  ).not.toBeChecked();
  await expect(
    volet.getByRole("checkbox", {
      name: fr["type_intervention.preventif_contrat"],
    }),
  ).not.toBeChecked();

  await volet
    .getByLabel(fr["checklist.parametrage.code"])
    .fill(CODE_INSTALLATION);
  await volet
    .getByLabel(fr["checklist.parametrage.libelle"])
    .fill("9K30A — Installation pont 2 colonnes EM");
  await volet
    .getByRole("button", {
      name: fr["checklist.parametrage.partir_gabarit_action"],
    })
    .click();

  await expect(page).toHaveURL(/\/parametres\/checklists$/);
  const ligne = page
    .locator("table")
    .first()
    .locator("tr", { hasText: CODE_INSTALLATION });
  await expect(ligne).toHaveCount(1);
  // Colonne « Types » — le type coché s'y lit.
  await expect(ligne).toContainText(fr["type_intervention.installation"]);

  // VINGT-ET-UN points : les quinze de I01, PLUS les six de « Remise au client ».
  await ligne
    .getByRole("link", { name: fr["checklist.parametrage.modifier_version"] })
    .click();
  await expect(page).toHaveURL(/\/parametres\/checklists\/.+\/version$/);
  await expect(
    page.getByLabel(fr["checklist.parametrage.point_libelle"]),
  ).toHaveCount(21);
});

test("la case précochée reste MODIFIABLE — décocher « Installation », cocher « Curatif » change le type écrit", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/checklists?volet=gabarit");

  const volet = page.getByRole("dialog");
  await choisirGabaritInstallation(volet);

  await volet
    .getByRole("checkbox", { name: fr["type_intervention.installation"] })
    .uncheck();
  await volet
    .getByRole("checkbox", { name: fr["type_intervention.curatif"] })
    .check();

  await volet
    .getByLabel(fr["checklist.parametrage.code"])
    .fill(CODE_TYPE_MODIFIE);
  await volet
    .getByLabel(fr["checklist.parametrage.libelle"])
    .fill("9K30A — Type modifié avant création");
  await volet
    .getByRole("button", {
      name: fr["checklist.parametrage.partir_gabarit_action"],
    })
    .click();

  await expect(page).toHaveURL(/\/parametres\/checklists$/);
  const ligne = page
    .locator("table")
    .first()
    .locator("tr", { hasText: CODE_TYPE_MODIFIE });
  await expect(ligne).toContainText(fr["type_intervention.curatif"]);
  await expect(ligne).not.toContainText(fr["type_intervention.installation"]);
});

test("captures — le volet « gabarit de départ » avec un gabarit d'installation choisi, à 1280 et 375 px", async ({
  page,
}) => {
  await connexionAdmin(page);

  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto("/parametres/checklists?volet=gabarit");
  await choisirGabaritInstallation(page.getByRole("dialog"));
  await capturer(page, "volet-gabarit-installation-1280");

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/parametres/checklists?volet=gabarit");
  await choisirGabaritInstallation(page.getByRole("dialog"));
  await capturer(page, "volet-gabarit-installation-375");
});
