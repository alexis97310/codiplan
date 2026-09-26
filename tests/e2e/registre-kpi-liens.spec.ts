import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * 99V-GR6-TUILES — « EN COURS » ET « EN ATTENTE » DU BANDEAU DU REGISTRE
 * MÈNENT À L'ONGLET QU'ELLES COMPTENT, AVEC LE MÊME NOMBRE.
 *
 * ## Le constat (audit GR du 26/09/2026, constats G7 et M1)
 *
 * `kpiDuRegistre` comptait `statut: "en_cours"` / `statut: "suspendue"` sur
 * TOUTE la société, sans exclure les clients inactifs — un critère plus LARGE
 * que celui de l'onglet correspondant (`compterParVue`, qui applique
 * `filtreClientActif` par défaut, RG-PLA-08/D129). La tuile et l'onglet
 * qu'elle nomme pouvaient donc afficher deux nombres différents pour la même
 * question. `kpiDuRegistre` réutilise désormais `compterParVue` sur la
 * recherche vide : le MÊME critère, jamais une seconde forme.
 *
 * Les deux tuiles n'avaient par ailleurs aucun lien — un chiffre sans chemin
 * vers ce qu'il compte, la même faute déjà réparée ailleurs sur cet écran et
 * sur le tableau de bord (98-TABLEAU-2).
 *
 * ## Lecture seule
 *
 * Aucune donnée n'est créée ni modifiée. Forger ici une intervention
 * `en_cours` ou `suspendue` changerait un compte que d'AUTRES épreuves lisent
 * en parallèle, sur la société partagée (même piège que les tuiles du
 * tableau de bord et leur KPI, §9) : ce fichier compare deux LECTURES du même
 * instant — la tuile, puis l'onglet qu'elle nomme —, jamais un nombre absolu
 * (Playwright `fullyParallel`).
 */

test.describe.configure({ mode: "serial" });

const FENETRE = { width: 1280, height: 900 };

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
});

/** Le premier nombre isolé sur sa propre ligne, dans un texte rendu multi-lignes. */
function premierNombreIsole(texte: string): number | null {
  const correspondance = /\n(\d+)\n/.exec(`\n${texte}\n`);
  return correspondance === null ? null : Number(correspondance[1]);
}

/** Le texte de l'onglet ACTIF, et son compte extrait de « Libellé (N) ». */
async function ongletActifEtSonCompte(
  page: Page,
): Promise<{ readonly texte: string; readonly compte: number }> {
  const texte = (
    await page
      .locator('nav[data-nav="onglets-registre"] a[aria-current="page"]')
      .innerText()
  ).trim();
  const correspondance = /\((\d+)\)\s*$/.exec(texte);
  expect(correspondance).not.toBeNull();
  return { texte, compte: Number(correspondance![1]) };
}

const TUILES = [
  {
    blocTuile: "kpi-en-cours",
    vue: "en_cours",
    libelleLien: "interventions.lien_kpi_en_cours" as const,
    libelleOnglet: "interventions.vue.en_cours" as const,
  },
  {
    blocTuile: "kpi-en-attente",
    vue: "bloquees",
    libelleLien: "interventions.lien_kpi_en_attente" as const,
    libelleOnglet: "interventions.vue.bloquees" as const,
  },
] as const;

for (const { blocTuile, vue, libelleLien, libelleOnglet } of TUILES) {
  test(`la tuile « ${blocTuile} » compte EXACTEMENT ce que l'onglet « ${vue} » montre, et y mène`, async ({
    page,
  }) => {
    await page.goto("/interventions");

    const tuile = page.locator(`[data-bloc="${blocTuile}"]`);
    await expect(tuile).toBeVisible();

    const lien = tuile.getByRole("link", { name: fr[libelleLien] });
    await expect(lien).toHaveAttribute("href", `/interventions?vue=${vue}`);

    // LA VALEUR DE LA TUILE, LUE DANS LE RENDU — comparée deux lignes plus
    // bas à l'onglet qu'elle nomme, lu dans le MÊME passage.
    const valeurTuile = premierNombreIsole(await tuile.innerText());
    expect(valeurTuile).not.toBeNull();

    await lien.click();
    await page.waitForURL(`/interventions?vue=${vue}`);
    const { texte: texteOnglet, compte: compteOnglet } =
      await ongletActifEtSonCompte(page);
    expect(texteOnglet).toContain(fr[libelleOnglet]);

    expect(valeurTuile).toBe(compteOnglet);
  });
}
