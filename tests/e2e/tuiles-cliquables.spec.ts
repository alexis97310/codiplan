import { expect, test, type Locator, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * TUILES CLIQUABLES AVEC CHEVRON (D140, TP-UX1-3, commit « tuile cliquable »).
 *
 * D140 (`docs/arbitrages.md:5055-5081`) : « Toutes les tuiles de chiffres sont
 * cliquables, avec un chevron » — « Chaque tuile ouvre la liste EXACTE que
 * son chiffre compte ». Ce fichier éprouve la TUILE elle-même — le nouveau
 * `<a>` posé par `Kpi` (`href`, `components/ui/kpi.tsx`) — jamais le lien
 * SECONDAIRE déjà posé sous chaque tuile (`CLASSES_LIEN_TUILE`), déjà
 * éprouvé par `tableau-de-bord-liens-tuiles.spec.ts` et
 * `registre-kpi-liens.spec.ts`.
 *
 * **Quatre tuiles rendues cliquables par ce ticket** — `kpi-bloques` et
 * `kpi-en-retard` (tableau de bord), `kpi-en-cours` et `kpi-en-attente`
 * (registre). `kpi-interventions` reste INERTE (voir la passation : la vue
 * jour du planning répartit ses cartes sur trois zones DOM sans convention
 * de comptage commune, condition non remplie avec confiance).
 *
 * ## Lecture seule
 *
 * Aucune donnée n'est créée ni modifiée. Comme `registre-kpi-liens.spec.ts`,
 * ce fichier compare deux LECTURES du même instant — la tuile, puis l'onglet
 * qu'elle nomme —, jamais un nombre absolu (Playwright `fullyParallel`, sur
 * la société partagée).
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

/** Le texte de l'onglet ACTIF du registre, et son compte extrait de « Libellé (N) ». */
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

/** Le lien de LA TUILE elle-même — son premier enfant direct, jamais le lien secondaire. */
function lienDeLaTuile(tuile: Locator): Locator {
  return tuile.locator("> div, > a").first();
}

const TUILES_CLIQUABLES = [
  {
    page: "/tableau-de-bord",
    blocTuile: "kpi-bloques",
    href: "/interventions?vue=bloquees",
    libelleOnglet: "interventions.vue.bloquees" as const,
  },
  {
    page: "/tableau-de-bord",
    blocTuile: "kpi-en-retard",
    href: "/interventions?vue=en_retard",
    libelleOnglet: "interventions.vue.en_retard" as const,
  },
  {
    page: "/interventions",
    blocTuile: "kpi-en-cours",
    href: "/interventions?vue=en_cours",
    libelleOnglet: "interventions.vue.en_cours" as const,
  },
  {
    page: "/interventions",
    blocTuile: "kpi-en-attente",
    href: "/interventions?vue=bloquees",
    libelleOnglet: "interventions.vue.bloquees" as const,
  },
] as const;

for (const {
  page: chemin,
  blocTuile,
  href,
  libelleOnglet,
} of TUILES_CLIQUABLES) {
  test(`la tuile « ${blocTuile} » (${chemin}) est cliquable, mène à ${href}, et compte EXACTEMENT ce que l'onglet montre`, async ({
    page,
  }) => {
    await page.goto(chemin);
    const tuile = page.locator(`[data-bloc="${blocTuile}"]`);
    await expect(tuile).toBeVisible();

    const lien = lienDeLaTuile(tuile);
    await expect(lien).toHaveAttribute("href", href);

    // FOCUS VISIBLE (9BZ-TP-UX1-1-ECHELLE) — la tuile porte l'anneau de
    // focus, comme tout élément actif du produit.
    await lien.focus();
    const anneau = await page.evaluate(
      () => getComputedStyle(document.activeElement as Element).boxShadow,
    );
    expect(anneau).toContain("3px");

    // LA VALEUR DE LA TUILE, LUE DANS LE RENDU — comparée deux lignes plus
    // bas à l'onglet qu'elle nomme, lu dans le MÊME passage.
    const valeurTuile = premierNombreIsole(await tuile.innerText());
    expect(valeurTuile).not.toBeNull();

    await lien.click();
    await page.waitForURL(href);
    const { texte: texteOnglet, compte: compteOnglet } =
      await ongletActifEtSonCompte(page);
    expect(texteOnglet).toContain(fr[libelleOnglet]);

    expect(valeurTuile).toBe(compteOnglet);
  });
}

const TUILES_INERTES = [
  { page: "/tableau-de-bord", blocTuile: "kpi-interventions" },
  { page: "/tableau-de-bord", blocTuile: "kpi-occupation" },
  { page: "/tableau-de-bord", blocTuile: "kpi-vgp" },
  { page: "/interventions", blocTuile: "kpi-semaine" },
] as const;

for (const { page: chemin, blocTuile } of TUILES_INERTES) {
  test(`la tuile « ${blocTuile} » (${chemin}) reste INERTE — aucun rôle "link" sur la tuile elle-même`, async ({
    page,
  }) => {
    await page.goto(chemin);
    const tuile = page.locator(`[data-bloc="${blocTuile}"]`);
    await expect(tuile).toBeVisible();
    const premierEnfant = lienDeLaTuile(tuile);
    expect(await premierEnfant.evaluate((element) => element.tagName)).toBe(
      "DIV",
    );
  });
}
