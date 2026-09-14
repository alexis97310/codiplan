import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  CHEMIN_EPREUVE,
  CREATIONS_ATTENDUES,
  RAISONS_INVENTEES,
  REJETS_ATTENDUS,
} from "../../scripts/lib/classeur-epreuve";

import { ouvrirUneSession } from "./setup/session";

/**
 * L'ÉCRAN D'IMPORT, TRAVERSÉ PAR UN HUMAIN (L1-11 ; I6, RG-IMP-01).
 *
 * ## Ce que ce fichier mesure et que rien d'autre ne mesure
 *
 * Les scénarios d'isolation prouvent que la chaîne écrit ce que le rapport
 * annonçait, et que le cloisonnement mord. **Ils ne peuvent pas prouver que la
 * SÉPARATION DES DEUX GESTES arrive jusqu'à l'écran**, et c'est l'acceptation
 * même du ticket :
 *
 * > *« un fichier de clients téléversé produit un rapport à l'écran AVANT toute
 * > écriture, et un scénario le prouve par l'absence de fiche entre le dépôt et
 * > la validation »*
 *
 * Un test qui appellerait les fonctions dans l'ordre prouverait qu'on PEUT les
 * appeler dans cet ordre. *Ici on mesure qu'il n'existe pas d'autre chemin* :
 * le téléversement mène à un rapport, et rien n'est écrit tant que le second
 * bouton n'a pas été cliqué.
 *
 * ## LE CLASSEUR EST FABRIQUÉ, ET C'EST UNE CONTRAINTE, PAS UNE COMMODITÉ
 *
 * *Aucun fichier de données réelles n'entre au dépôt, jamais* (I9), et le dépôt
 * est PUBLIC depuis le 12/09/2026 — **un dépôt rendu public publie aussi son
 * passé**. Le classeur de cette épreuve est calculé par
 * `scripts/fabriquer-classeur-epreuve.mts` : trois raisons sociales inventées,
 * dont une vide qui part en rejet.
 */

test.describe.configure({ mode: "serial" });

const CLASSEUR = join(process.cwd(), CHEMIN_EPREUVE);

/**
 * La raison sociale que le classeur d'épreuve crée — inventée (I9), et LUE
 * plutôt qu'écrite ici : *elle est écrite une fois, dans le module que le
 * script de fabrication lit aussi.*
 */
const RAISON_INVENTEE = RAISONS_INVENTEES[0];

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("l'écran se rejoint par la BARRE, et nomme ce qu'il ne sait pas appliquer", async ({
  page,
}) => {
  await page.goto("/planning");
  // *Une interface sans appelant est la maladie que le portail a soignée* :
  // l'écran se rejoint par son entrée de barre, jamais en tapant l'URL.
  await page.getByRole("link", { name: fr["nav.imports_excel"] }).click();
  await expect(page).toHaveURL(/\/imports$/);

  await expect(
    page.getByRole("heading", { name: fr["imports.titre"] }),
  ).toBeVisible();

  // LES QUATRE TYPES NON APPLICABLES SONT NOMMÉS, jamais proposés. *Les taire
  // ferait croire qu'ils n'ont pas été pensés* — la faute de D88.
  const incomplets = page.locator('li[data-complet="0"]');
  await expect(incomplets).toHaveCount(4);
  // Et le TÉMOIN de l'autre direction : celui qu'on sait appliquer est là
  // aussi, et il est seul. *Quatre absences se ressemblent ; c'est la présence
  // du cinquième qui dit que la liste a été lue.*
  await expect(page.locator('li[data-complet="1"]')).toHaveCount(1);

  // Ce qu'on ne sait pas faire est INERTE et MOTIVÉ — jamais un lien vers rien.
  await expect(
    page.getByText(fr["imports.modele_indisponible_motif"]),
  ).toBeVisible();
});

test("LE RAPPORT PRÉCÈDE TOUTE ÉCRITURE, et la validation est un SECOND geste", async ({
  page,
}) => {
  await page.goto("/imports");
  await page.locator('input[name="classeur"]').setInputFiles(CLASSEUR);
  await page.getByRole("button", { name: fr["imports.controler"] }).click();

  // Le téléversement mène au RAPPORT, jamais à une écriture.
  await expect(page).toHaveURL(/\/imports\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: fr["imports.lot_titre"] }),
  ).toBeVisible();

  // LE RAPPORT DIT CE QU'IL FERA : deux créations, un rejet.
  await expect(page.locator('li[data-decompte="creations"]')).toContainText(
    String(CREATIONS_ATTENDUES),
  );
  await expect(page.locator('li[data-decompte="rejets"]')).toContainText(
    String(REJETS_ATTENDUS),
  );
  // Et la ligne rejetée est MONTRÉE avec son motif — c'est ce que I6 demande
  // qu'on ait sous les yeux avant de décider.
  await expect(
    page.getByText(fr["imports.motif.saisie_refusee"]),
  ).toBeVisible();

  // ── LE TÉMOIN DE I6 : RIEN N'EST ENCORE ÉCRIT ─────────────────────────────
  //
  // *Sans lui, « le rapport précède l'écriture » serait vrai d'un écran qui
  // aurait déjà tout écrit et se contenterait de le raconter.* La fiche ne doit
  // exister NULLE PART tant que le second bouton n'a pas été cliqué.
  const rapport = page.url();
  await page.goto("/clients");
  await expect(page.getByText(RAISON_INVENTEE)).toHaveCount(0);

  // ── LE SECOND GESTE ───────────────────────────────────────────────────────
  await page.goto(rapport);
  await page.getByRole("button", { name: fr["imports.appliquer"] }).click();
  await expect(page.getByText(fr["imports.applique"])).toBeVisible();

  // ET LA FICHE EXISTE MAINTENANT, atteinte par l'écran des clients.
  await page.goto("/clients");
  await expect(page.getByText(RAISON_INVENTEE).first()).toBeVisible();

  // ── L'ANNULATION DÉFAIT CE QU'ELLE PEUT ───────────────────────────────────
  await page.goto(rapport);
  await page.getByRole("button", { name: fr["imports.annuler"] }).click();
  // Deux issues, et elles ne disent pas la même chose (D88) : ici rien ne
  // référence les fiches créées, donc tout se défait.
  await expect(page.getByText(fr["imports.annule"])).toBeVisible();

  await page.goto("/clients");
  await expect(page.getByText(RAISON_INVENTEE)).toHaveCount(0);
});

test("un fichier qui n'est pas un classeur est REFUSÉ avec son motif", async ({
  page,
}) => {
  await page.goto("/imports");
  await page.locator('input[name="classeur"]').setInputFiles({
    name: "clients.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("code;raison\nA;B\n"),
  });
  await page.getByRole("button", { name: fr["imports.controler"] }).click();

  // *Le §2 interdit le CSV* — un CSV n'a ni type de cellule ni feuille, et
  // toute la grammaire de D31 repose sur les deux.
  await expect(page).toHaveURL(/\/imports\?motif=/);
  await expect(page.getByText(fr["imports.refus.extension"])).toBeVisible();
});
