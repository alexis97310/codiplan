import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  ATTENTE_ATTENDUE,
  CREATIONS_OBSERVATIONS_ATTENDUES,
  CREATIONS_PV_ATTENDUES,
  fabriquerLeClasseurObservations,
  fabriquerLeClasseurVgp,
  REJETS_OBSERVATIONS_ATTENDUS,
  REJETS_PV_ATTENDUS,
} from "./setup/classeur-vgp";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES DEUX GABARITS DE LA VGP, VUS PAR UN HUMAIN (VGP-IMPORT).
 *
 * Ce que ce scénario prouve, et que les épreuves d'isolation ne peuvent pas
 * prouver : que les deux types sont DANS LA LISTE de `/imports` et savent
 * s'appliquer ; que le rapport d'un lot de PV montre ses trois comptes de
 * rattachement et la ligne en attente AVEC son motif ; que les observations
 * refusent leur PV manquant à l'écran ; et que les deux gestes — appliquer,
 * annuler — se jouent dans l'ordre, l'annulation des PV attendant celle des
 * observations.
 *
 * SÉRIEL, parce que l'ordre est le sujet : PV d'abord, observations ensuite,
 * annulation à rebours.
 */

test.describe.configure({ mode: "serial" });

const FENETRE = { width: 1280, height: 900 };
const DOSSIER_CAPTURES = process.env.CAPTURES_VGP_IMPORT ?? "";

type Mesure = {
  readonly commit: string;
  readonly horodatage: string;
  readonly largeur: number;
  readonly hauteur: number;
  readonly pv: {
    readonly resultat: Record<string, string>;
    readonly attente: Record<string, string>;
    readonly en_attente: readonly string[][];
    readonly rejets: readonly string[][];
  };
  readonly observations: {
    readonly resultat: Record<string, string>;
    readonly rejets: readonly string[][];
  };
};

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER_CAPTURES === "") return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}--1280.png`),
    fullPage: true,
  });
}

function ecrireLaMesure(mesure: Mesure): void {
  if (DOSSIER_CAPTURES === "") return;
  writeFileSync(
    join(DOSSIER_CAPTURES, "mesure.json"),
    `${JSON.stringify(mesure, null, 2)}\n`,
  );
}

async function textesDe(page: Page, selecteur: string): Promise<string[][]> {
  return page
    .locator(selecteur)
    .evaluateAll((lignes) =>
      lignes.map((ligne) =>
        [...ligne.querySelectorAll("td")].map((td) => td.textContent ?? ""),
      ),
    );
}

async function comptes(
  page: Page,
  attribut: string,
): Promise<Record<string, string>> {
  const entrees = await page
    .locator(`li[${attribut}]`)
    .evaluateAll(
      (elements, attr) =>
        elements.map((e) => [
          e.getAttribute(attr) ?? "",
          e.querySelector("span:nth-child(2)")?.textContent ?? "",
        ]),
      attribut,
    );
  return Object.fromEntries(entrees);
}

async function deposer(page: Page, nom: string, classeur: Buffer) {
  await page.goto("/imports");
  await page.locator('input[name="classeur"]').setInputFiles({
    name: nom,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: classeur,
  });
  await page.getByRole("button", { name: fr["imports.controler"] }).click();
  await expect(page).toHaveURL(/\/imports\/[0-9a-f-]{36}$/);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
});

test("les deux types de la VGP sont dans la liste, et ils savent s'appliquer", async ({
  page,
}) => {
  await page.goto("/imports");
  for (const type of ["vgp", "vgp_observations"]) {
    const entree = page.locator(`li[data-type="${type}"]`);
    await expect(entree).toHaveCount(1);
    await expect(entree).toHaveAttribute("data-complet", "1");
    await expect(entree.getByText(fr["imports.type.complet"])).toBeVisible();
  }
  await expect(
    page.locator('li[data-type="vgp"]').getByText(fr["imports.type.vgp"]),
  ).toBeVisible();
  await expect(
    page
      .locator('li[data-type="vgp_observations"]')
      .getByText(fr["imports.type.vgp_observations"]),
  ).toBeVisible();
  await capturer(page, "imports-types-vgp");
});

let mesurePv: Mesure["pv"] | null = null;
let rapportPv = "";

test("LE RAPPORT D'UN LOT DE PV compte ses rattachements, montre l'attente avec son motif, puis s'applique", async ({
  page,
}) => {
  await deposer(page, "vgp-epreuve.xlsx", await fabriquerLeClasseurVgp());
  rapportPv = page.url();

  // LE RAPPORT DIT CE QU'IL FERA : une création, trois rejets — dont deux
  // sont une ATTENTE, comptée à part.
  await expect(page.locator('li[data-decompte="creations"]')).toContainText(
    String(CREATIONS_PV_ATTENDUES),
  );
  await expect(page.locator('li[data-decompte="rejets"]')).toContainText(
    String(REJETS_PV_ATTENDUS),
  );
  const attente = page.locator('[data-rattachements="vgp"]');
  await expect(attente).toBeVisible();
  for (const [cle, valeur] of Object.entries(ATTENTE_ATTENDUE)) {
    await expect(attente.locator(`li[data-attente="${cle}"]`)).toContainText(
      String(valeur),
    );
  }
  await expect(attente.locator("tr[data-en-attente]")).toHaveCount(
    ATTENTE_ATTENDUE.en_attente,
  );
  await expect(
    attente.getByText(fr["imports.vgp.attente.sans_serie"]),
  ).toBeVisible();
  await expect(
    attente.getByText(fr["imports.vgp.attente.serie_inconnue"]),
  ).toBeVisible();
  // ET LE MOTIF LONG, sur la ligne du rejet, commence par dire l'attente.
  await expect(
    page.getByText(fr["imports.motif.a_rattacher_sans_serie"]),
  ).toBeVisible();
  await expect(
    page.getByText(fr["imports.motif.origine_inconnue"]),
  ).toBeVisible();

  await capturer(page, "rapport-vgp-comptes-de-rattachement");
  mesurePv = {
    resultat: await comptes(page, "data-decompte"),
    attente: await comptes(page, "data-attente"),
    en_attente: await textesDe(page, "tr[data-en-attente]"),
    rejets: await textesDe(page, "tr[data-rang]"),
  };

  await page.getByRole("button", { name: fr["imports.appliquer"] }).click();
  await expect(page.getByText(fr["imports.applique"])).toBeVisible();
});

let rapportObservations = "";

test("LES OBSERVATIONS exigent leur PV : deux entrent, une est refusée avec son motif — et aucune demande n'est créée", async ({
  page,
}) => {
  await deposer(
    page,
    "vgp-observations-epreuve.xlsx",
    await fabriquerLeClasseurObservations(),
  );
  rapportObservations = page.url();
  await expect(page.locator('li[data-decompte="creations"]')).toContainText(
    String(CREATIONS_OBSERVATIONS_ATTENDUES),
  );
  await expect(page.locator('li[data-decompte="rejets"]')).toContainText(
    String(REJETS_OBSERVATIONS_ATTENDUS),
  );
  await expect(
    page.getByText(fr["imports.motif.rapport_introuvable"]),
  ).toBeVisible();
  await capturer(page, "rapport-vgp-observations");
  const mesureObservations = {
    resultat: await comptes(page, "data-decompte"),
    rejets: await textesDe(page, "tr[data-rang]"),
  };
  if (mesurePv !== null) {
    ecrireLaMesure({
      commit: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
      horodatage: new Date().toISOString(),
      largeur: FENETRE.width,
      hauteur: FENETRE.height,
      pv: mesurePv,
      observations: mesureObservations,
    });
  }

  await page.getByRole("button", { name: fr["imports.appliquer"] }).click();
  await expect(page.getByText(fr["imports.applique"])).toBeVisible();
});

test("L'ANNULATION se joue à rebours : les PV attendent leurs observations", async ({
  page,
}) => {
  // Les PV d'abord : REFUSÉS ligne à ligne, parce que deux observations les
  // retiennent — l'annulation est partielle, et l'écran le dit.
  await page.goto(rapportPv);
  await page.getByRole("button", { name: fr["imports.annuler"] }).click();
  await expect(page.getByText(fr["imports.annule_partiel"])).toBeVisible();

  // Les observations ensuite : tout est défait.
  await page.goto(rapportObservations);
  await page.getByRole("button", { name: fr["imports.annuler"] }).click();
  await expect(page.getByText(fr["imports.annule"])).toBeVisible();
});
