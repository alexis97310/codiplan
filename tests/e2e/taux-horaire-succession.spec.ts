import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * UN TAUX HORAIRE SE SUCCÈDE, DEPUIS UN ÉCRAN — ET SE RELIT FORMATÉ AVANT
 * D'ÊTRE ÉCRIT (TAUX-1).
 *
 * ## LE CONSTAT, MESURÉ SUR LE CODE DU 22/09
 *
 * `taux_horaire` n'avait qu'UN chemin d'écriture — le geste de mise en
 * service, atteint par un flux GitHub — et aucun écran. `/parametres`
 * n'offrait aucune porte vers un tarif qui aurait pourtant vocation à changer.
 *
 * **Sur `main` avant le lot, ce spec rougit dès la première assertion** : la
 * porte « Taux horaire » n'existe pas dans `/parametres`. La capture est
 * prise AVANT cette assertion — c'est ainsi que les paires AVANT/APRÈS de
 * `docs/propositions/14-TAUX-1/` ont été produites.
 *
 * ## Ce que ce spec éprouve
 *
 * 1. `/parametres` porte désormais un lien vers `/parametres/taux-horaire`.
 * 2. L'historique montre le taux fixé par la scène (`tests/e2e/setup/scene.ts`,
 *    7 000 XPF depuis le 01/01/2020).
 * 3. Poser un second taux, à une date d'effet FUTURE (2031, pour n'interférer
 *    avec aucun autre scénario qui valorise une intervention d'aujourd'hui),
 *    mène d'abord à un écran de CONFIRMATION qui relit le montant FORMATÉ —
 *    « 9 500 XPF » — sans avoir encore rien écrit.
 * 4. Confirmer écrit la ligne : l'historique porte alors DEUX taux, et le
 *    premier n'a pas bougé.
 *
 * La ligne posée par ce spec est retirée à la fin (`afterAll`), sous le rôle
 * PROPRIÉTAIRE — jamais le chemin applicatif, qui est justement ce qu'on
 * éprouve.
 *
 * **Aucune requête d'écran ne porte de libellé neuf en dur.** Les champs et
 * boutons sont repérés par leur NOM ou leur ATTRIBUT (`input[name=…]`,
 * `[data-bloc=…]`), jamais par un texte affiché : d'une part le gardien des
 * chaînes visibles (L0-11) refuserait un libellé écrit en clair dans ce
 * fichier, d'autre part `next build` type-vérifie `tests/` sur le code AVANT
 * le lot, où ces clés n'existent pas encore.
 *
 * `CAPTURES_TAUX_1=<dossier>` écrit les captures à 1280 px et `mesure.json`.
 */

test.describe.configure({ mode: "serial" });

const FENETRE = { width: 1280, height: 900 };
const DOSSIER_CAPTURES = process.env.CAPTURES_TAUX_1 ?? "";

/** Date d'effet du second taux — loin dans le futur, pour ne concurrencer
 * aucun scénario qui valorise une intervention d'aujourd'hui. */
const DATE_EFFET_SECOND_TAUX = "2031-01-01";
const MONTANT_SECOND_TAUX = "9500";

const mesure: {
  commit: string;
  horodatage: string;
  largeur: number;
  hauteur: number;
  ecrans: Record<string, unknown>;
} = {
  commit: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
  horodatage: new Date().toISOString(),
  largeur: FENETRE.width,
  hauteur: FENETRE.height,
  ecrans: {},
};

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER_CAPTURES === "") return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}--1280.png`),
    fullPage: true,
  });
  writeFileSync(
    join(DOSSIER_CAPTURES, "mesure.json"),
    `${JSON.stringify(mesure, null, 2)}\n`,
  );
}

/** Texte d'un bloc, espaces (dont insécables) normalisés en simples espaces. */
async function texteDuBloc(page: Page, bloc: string): Promise<string> {
  return (await page.locator(`[data-bloc="${bloc}"]`).innerText())
    .replace(/\s+/g, " ")
    .trim();
}

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "taux_horaire" WHERE date_effet = $1::date`,
      DATE_EFFET_SECOND_TAUX,
    );
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
});

test("AVANT — les paramètres ne portent aucune porte vers le taux horaire", async ({
  page,
}) => {
  await page.goto("/parametres");
  // Repérée par sa destination plutôt que par son texte : un texte composé
  // (titre + résumé) se prête mal à une correspondance stricte, et ce n'est
  // pas ce que ce test éprouve.
  const porte = page.locator('a[href="/parametres/taux-horaire"]');
  mesure.ecrans.parametres = {
    porte_visible: await porte.isVisible().catch(() => false),
  };
  await capturer(page, "parametres");

  await expect(porte).toBeVisible();
});

test("poser un second taux passe par une confirmation qui relit le montant formaté, puis écrit", async ({
  page,
}) => {
  await page.goto("/parametres/taux-horaire");

  // L'HISTORIQUE PORTE DÉJÀ LE TAUX DE LA SCÈNE — un seul, 7 000 XPF.
  const avant = await texteDuBloc(page, "historique-taux");
  expect(avant).toContain("7 000 XPF".replace(/\s+/g, " "));
  mesure.ecrans.historique_avant = { texte: avant };

  // LA SAISIE — montant et date d'effet, rien d'autre. Repérés par leur NOM
  // de champ plutôt que par leur libellé affiché — voir l'en-tête.
  const formulaireSaisie = page.locator(
    'form[action="/api/parametres/taux-horaire/creer"]',
  );
  await formulaireSaisie
    .locator('input[name="montant_mineur"]')
    .fill(MONTANT_SECOND_TAUX);
  await formulaireSaisie
    .locator('input[name="date_effet"]')
    .fill(DATE_EFFET_SECOND_TAUX);
  await formulaireSaisie.locator('button[type="submit"]').click();

  // LA CONFIRMATION — le montant est RELU FORMATÉ, rien n'est encore écrit.
  const confirmation = page.locator('[data-bloc="confirmer-taux"]');
  await expect(confirmation).toBeVisible();
  const texteConfirmation = (await confirmation.innerText())
    .replace(/\s+/g, " ")
    .trim();
  mesure.ecrans.confirmation = { texte: texteConfirmation };
  await capturer(page, "taux-horaire-confirmation");

  expect(texteConfirmation).toContain("9 500 XPF".replace(/\s+/g, " "));
  expect(texteConfirmation).toContain("01/01/2031");

  // TÉMOIN : rien n'est écrit tant que la confirmation n'a pas été validée.
  const [avantEcriture] = await new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  }).$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM "taux_horaire" WHERE date_effet = $1::date`,
    DATE_EFFET_SECOND_TAUX,
  );
  expect(Number(avantEcriture?.n)).toBe(0);

  // LA CONFIRMATION — et SEULEMENT MAINTENANT, l'écriture a lieu.
  await confirmation.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/parametres\/taux-horaire$/);

  const apres = await texteDuBloc(page, "historique-taux");
  mesure.ecrans.historique_apres = { texte: apres };
  await capturer(page, "taux-horaire-historique");

  // LES DEUX TAUX SONT LÀ — le premier n'a pas bougé, le second est présent.
  expect(apres).toContain("7 000 XPF".replace(/\s+/g, " "));
  expect(apres).toContain("9 500 XPF".replace(/\s+/g, " "));
  expect(apres).toContain("01/01/2031");
  expect(apres).toContain("01/01/2020");
});
