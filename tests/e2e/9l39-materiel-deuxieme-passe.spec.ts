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
 * 9L39-MATERIEL-DEUXIEME-PASSE — Page Matériel, deuxième passe.
 *
 * Deux gênes de la feuille de route :
 *
 * 1. **L'état actif/inactif était écrit en clair SEULEMENT pour qui ne peut
 *    pas écrire** (`materiel.active`/`materiel.inactive`) — pour un rôle qui
 *    PEUT écrire, la liste ne montrait que le bouton « Activer »/
 *    « Désactiver », l'état se déduisant du LIBELLÉ du bouton plutôt que
 *    d'être nommé (accessibilité). Il est désormais écrit en clair dans tous
 *    les cas, bouton ou pas.
 * 2. **Un refus de saisie (code déjà pris) rouvrait le volet avec les
 *    valeurs DE LA BASE**, jamais celles tapées — la saisie se perdait au
 *    premier refus. Même mécanique que `app/api/clients/creer/formulaire.ts`
 *    (« ce qui avait été soumis », capturé avant toute validation) : le
 *    volet rouvre maintenant avec EXACTEMENT ce qui avait été tapé.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `9L39-` : une famille existante (pour provoquer
 * le doublon de code), créée en `beforeAll`, effacée en `afterAll` avec la
 * famille créée PAR le test de correction.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9L39-MATERIEL-DEUXIEME-PASSE/captures",
);

/** EN VIEWPORT, jamais `fullPage` — la capture montre ce qui se voit sans défiler. */
async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`) });
}

const FAMILLE_EXISTANTE = uuidv7();
const CODE_EXISTANT = "9L39FAME";
const LIBELLE_EXISTANT = "9L39-FamilleExistante";

const CODE_CORRIGE = "9L39FAMC";
const LIBELLE_SAISI = "9L39-LibelleGarde";

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    await client.familleMateriel.create({
      data: {
        id: FAMILLE_EXISTANTE,
        societe_id: societe.id,
        code: CODE_EXISTANT,
        libelle: LIBELLE_EXISTANT,
        actif: true,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.familleMateriel.deleteMany({
      where: { code: { in: [CODE_EXISTANT, CODE_CORRIGE] } },
    });
  } finally {
    await client.$disconnect();
  }
});

async function connexionAdmin(page: Page): Promise<void> {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
}

test("L'ÉTAT EST ÉCRIT EN CLAIR dans la liste, même quand le bouton de bascule est offert", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.setViewportSize({ width: 1280, height: 1200 });

  await page.goto("/parametres/materiel");
  const table = page.locator("table").first();
  const ligne = table.locator("tr", { hasText: CODE_EXISTANT });

  // LE MOT « Actif », PAS SEULEMENT LE BOUTON « Désactiver » — le même texte
  // doit être lisible même pour un rôle qui PEUT basculer l'état.
  await expect(
    ligne.getByText(fr["materiel.active"], { exact: true }),
  ).toBeVisible();
  await expect(
    ligne.getByRole("button", { name: fr["materiel.desactiver"] }),
  ).toBeVisible();

  await capturer(page, "etat-en-clair-1280");
  await page.setViewportSize({ width: 375, height: 900 });
  await page.reload();
  const carte = page.locator("li", { hasText: CODE_EXISTANT });
  await expect(
    carte.getByText(fr["materiel.active"], { exact: true }),
  ).toBeVisible();
  await capturer(page, "etat-en-clair-375");
});

test("UN REFUS DE SAISIE (code déjà pris) GARDE LA SAISIE — correction sans retaper le libellé", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.setViewportSize({ width: 1280, height: 1200 });

  await page.goto("/parametres/materiel");
  await page.getByRole("link", { name: fr["materiel.creer_famille"] }).click();
  const volet = page.getByRole("dialog");
  await volet.getByLabel(fr["materiel.code"]).fill(CODE_EXISTANT);
  await volet.getByLabel(fr["materiel.libelle"]).fill(LIBELLE_SAISI);
  await volet
    .getByRole("button", { name: fr["materiel.creer_action"] })
    .click();

  // LE REFUS, SON MOTIF, ET LE VOLET ROUVERT AVEC CE QUI AVAIT ÉTÉ TAPÉ —
  // jamais les valeurs de la base (ici, aucune : c'est une CRÉATION).
  await expect(page.getByText(fr["materiel.refus.code_pris"])).toBeVisible();
  const voletRouvert = page.getByRole("dialog");
  await expect(voletRouvert.getByLabel(fr["materiel.code"])).toHaveValue(
    CODE_EXISTANT,
  );
  await expect(voletRouvert.getByLabel(fr["materiel.libelle"])).toHaveValue(
    LIBELLE_SAISI,
  );

  await capturer(page, "refus-code-pris-volet-rouvert-1280");
  const urlRefus = new URL(page.url());
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(urlRefus.toString());
  await capturer(page, "refus-code-pris-volet-rouvert-375");
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto(urlRefus.toString());

  // LA CORRECTION : seul le code change, le libellé n'est PAS retapé.
  const voletCorrige = page.getByRole("dialog");
  await voletCorrige.getByLabel(fr["materiel.code"]).fill(CODE_CORRIGE);
  await voletCorrige
    .getByRole("button", { name: fr["materiel.creer_action"] })
    .click();

  await capturer(page, "refus-code-pris-apres-correction-1280");
  const table = page.locator("table").first();
  await expect(table.locator("tr", { hasText: LIBELLE_SAISI })).toHaveCount(1);
  await expect(table.locator("tr", { hasText: CODE_CORRIGE })).toHaveCount(1);
});
