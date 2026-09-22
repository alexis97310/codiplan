import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  CREATIONS_HISTORIQUE_ATTENDUES,
  fabriquerLeClasseurHistorique,
  fabriquerUnClasseurDeTypeInconnu,
  CREATIONS_AU_SECOND_DEPOT,
  RATTACHEMENTS_ATTENDUS,
  REJETS_HISTORIQUE_ATTENDUS,
  TYPE_INCONNU_EPREUVE,
} from "./setup/classeur-historique";
import { ouvrirUneSession } from "./setup/session";

/**
 * L'ARCHIVE SAV, TRAVERSÉE PAR UN HUMAIN (REPRISE-HISTORIQUE ; I6, D127).
 *
 * ## Ce que ce fichier mesure et que rien d'autre ne mesure
 *
 * Le scénario d'isolation prouve que la chaîne écrit des interventions closes
 * et les défait. **Il ne peut pas prouver que l'écran les MONTRE** : le type
 * dans la liste des imports avec sa mention, le rapport avec ses comptes par
 * rang, et — le défaut mesuré en production — le refus d'un marqueur inconnu
 * qui NOMME le type au lieu d'envoyer chercher un choix qui n'existe pas.
 *
 * ## Les captures sont prises PAR CE SCÉNARIO, quand on le lui demande
 *
 * `CAPTURES_REPRISE_HISTORIQUE=<dossier>` fait écrire les captures à 1280 px
 * et `mesure.json` — l'empreinte de commit lue par `git rev-parse HEAD`, jamais
 * de mémoire, et les comptes tels que la page les a rendus. Sans la variable,
 * le scénario mesure et n'écrit rien : *une prise de vue à chaque `verify`
 * salirait l'arbre de travail sans que personne l'ait demandée.*
 */

test.describe.configure({ mode: "serial" });

const FENETRE = { width: 1280, height: 900 };
const DOSSIER_CAPTURES = process.env.CAPTURES_REPRISE_HISTORIQUE ?? "";

type Mesure = {
  readonly commit: string;
  readonly horodatage: string;
  readonly largeur: number;
  readonly hauteur: number;
  readonly resultat: Record<string, string>;
  readonly rattachements: Record<string, string>;
  readonly non_rattachees: readonly string[][];
  readonly rejets: readonly string[][];
  readonly type_inconnu: string;
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

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
});

test("le type « historique » est dans la liste, et il sait s'appliquer", async ({
  page,
}) => {
  await page.goto("/imports");
  const type = page.locator('li[data-type="historique"]');
  await expect(type).toHaveCount(1);
  await expect(type).toHaveAttribute("data-complet", "1");
  await expect(type.getByText(fr["imports.type.historique"])).toBeVisible();
  await expect(type.getByText(fr["imports.type.complet"])).toBeVisible();
  await capturer(page, "imports-type-historique");
});

test("un marqueur d'un type que PERSONNE ne publie NOMME le type — sans envoyer chercher un choix", async ({
  page,
}) => {
  await page.goto("/imports");
  await page.locator('input[name="classeur"]').setInputFiles({
    name: "inventaire-epreuve.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await fabriquerUnClasseurDeTypeInconnu(),
  });
  await page.getByRole("button", { name: fr["imports.controler"] }).click();

  const statut = page.locator(
    '[role="status"][data-motif="import.anomalie.marqueur_type_inconnu"]',
  );
  await expect(statut).toBeVisible();
  await expect(statut).toContainText(
    fr["import.anomalie.marqueur_type_inconnu"],
  );
  // LE TYPE EST NOMMÉ — c'est ce qui manquait le 22/09/2026.
  await expect(
    statut.locator(`code[data-type-annonce="${TYPE_INCONNU_EPREUVE}"]`),
  ).toHaveText(TYPE_INCONNU_EPREUVE);
  // Et l'ANCIEN message n'est plus celui-là : personne n'est envoyé vérifier
  // un « type d'import choisi ».
  await expect(
    page.getByText(fr["import.anomalie.marqueur_autre_type"]),
  ).toHaveCount(0);
  await capturer(page, "imports-marqueur-type-inconnu");
});

test("LE RAPPORT PRÉCÈDE L'ÉCRITURE, compte les rangs, puis s'applique et s'annule", async ({
  page,
}) => {
  await page.goto("/imports");
  await page.locator('input[name="classeur"]').setInputFiles({
    name: "historique-epreuve.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await fabriquerLeClasseurHistorique(),
  });
  await page.getByRole("button", { name: fr["imports.controler"] }).click();

  await expect(page).toHaveURL(/\/imports\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: fr["imports.lot_titre"] }),
  ).toBeVisible();

  // LE RAPPORT DIT CE QU'IL FERA : quatre créations, deux rejets.
  await expect(page.locator('li[data-decompte="creations"]')).toContainText(
    String(CREATIONS_HISTORIQUE_ATTENDUES),
  );
  await expect(page.locator('li[data-decompte="rejets"]')).toContainText(
    String(REJETS_HISTORIQUE_ATTENDUS),
  );
  // Les deux rejets sont MONTRÉS avec leur motif — et ce sont deux motifs
  // différents, corrigés à deux endroits différents.
  await expect(
    page.getByText(fr["imports.motif.site_indetermine"]),
  ).toBeVisible();
  await expect(
    page.getByText(fr["imports.motif.client_introuvable"]),
  ).toBeVisible();

  // LES COMPTES PAR RANG (D127) — et les non-rattachées, ligne à ligne.
  const rattachements = page.locator('[data-rattachements="historique"]');
  await expect(rattachements).toBeVisible();
  for (const [cle, valeur] of Object.entries(RATTACHEMENTS_ATTENDUS)) {
    await expect(
      rattachements.locator(`li[data-rattachement="${cle}"]`),
    ).toContainText(String(valeur));
  }
  await expect(rattachements.locator("tr[data-non-rattachee]")).toHaveCount(
    RATTACHEMENTS_ATTENDUS.rang3,
  );
  await expect(
    rattachements.getByText(fr["imports.rattachement.serie_inconnue"]),
  ).toBeVisible();
  await expect(
    rattachements.getByText(fr["imports.rattachement.serie_autre_client"]),
  ).toBeVisible();

  await capturer(page, "rapport-historique-comptes-par-rang");
  ecrireLaMesure({
    commit: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
    horodatage: new Date().toISOString(),
    largeur: FENETRE.width,
    hauteur: FENETRE.height,
    resultat: await comptes(page, "data-decompte"),
    rattachements: await comptes(page, "data-rattachement"),
    non_rattachees: await textesDe(page, "tr[data-non-rattachee]"),
    rejets: await textesDe(page, "tr[data-rang]"),
    type_inconnu: TYPE_INCONNU_EPREUVE,
  });

  // ── LE SECOND GESTE, puis son contraire — la base est rendue telle quelle ──
  const rapport = page.url();
  await page.getByRole("button", { name: fr["imports.appliquer"] }).click();
  await expect(page.getByText(fr["imports.applique"])).toBeVisible();

  // Le même fichier redéposé ne DUPLIQUE rien : chaque document est rejeté
  // « déjà repris », et aucune création n'est annoncée.
  await page.goto("/imports");
  await page.locator('input[name="classeur"]').setInputFiles({
    name: "historique-epreuve-bis.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await fabriquerLeClasseurHistorique(),
  });
  await page.getByRole("button", { name: fr["imports.controler"] }).click();
  await expect(page.locator('li[data-decompte="creations"]')).toContainText(
    String(CREATIONS_AU_SECOND_DEPOT),
  );
  await expect(
    page.getByText(fr["imports.motif.document_deja_repris"]).first(),
  ).toBeVisible();

  await page.goto(rapport);
  await page.getByRole("button", { name: fr["imports.annuler"] }).click();
  await expect(page.getByText(fr["imports.annule"])).toBeVisible();
});
