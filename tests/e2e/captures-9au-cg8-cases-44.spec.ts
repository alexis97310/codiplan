import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9AU-CG8-CASES-44 — même recette que
 * `captures-9aq-cg1-retour-parametres.spec.ts` : rien n'est écrit sans la
 * variable d'environnement qui nomme le dossier, pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot, une fois sur le code livré
 * (`CAPTURES_9AU_FASE=avant` puis `=apres`). LECTURE SEULE, aucune donnée
 * créée.
 *
 * Trois écrans portent leur case DANS un formulaire de modification, replié
 * par défaut (`<details>`) : la case n'existe qu'une fois ce repli ouvert, et
 * la capture l'ouvre PAR SCRIPT (`el.open = true`) plutôt que de cliquer un
 * `<summary>` dont le texte varie d'une ligne à l'autre. Deux écrans portent
 * un identifiant dynamique dans leur chemin — l'agence et le forfait à
 * modifier —, découvert sur la liste plutôt qu'écrit en dur : un identifiant
 * figé serait juste le jour de sa rédaction et périmé au semis suivant.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9AU ?? "";
const FASE = process.env.CAPTURES_9AU_FASE ?? "";

async function capturer(page: Page, ecran: string, largeur: number) {
  if (DOSSIER === "" || FASE === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${ecran}-${FASE}-${largeur}.png`),
    fullPage: true,
  });
}

/** Ouvre tous les `<details>` de la page — le repli par ligne (ERGO-1). */
async function ouvrirLesReplis(page: Page): Promise<void> {
  await page.locator("details").evaluateAll((elements) => {
    for (const element of elements) {
      (element as HTMLDetailsElement).open = true;
    }
  });
}

async function premierLienDeModificationAgence(page: Page): Promise<string> {
  const lien = page
    .getByRole("link", { name: fr["agence.modifier"], exact: true })
    .first();
  const href = await lien.getAttribute("href");
  if (href === null) {
    throw new Error(
      "la liste des agences ne porte aucun lien de modification : rien à " +
        "photographier.",
    );
  }
  return href;
}

async function premierLienDeModificationForfait(page: Page): Promise<string> {
  const lien = page
    .getByRole("link", { name: fr["forfaits.modifier"], exact: true })
    .first();
  const href = await lien.getAttribute("href");
  if (href === null) {
    throw new Error(
      "le catalogue des forfaits ne porte aucun lien de modification : rien " +
        "à photographier.",
    );
  }
  return href;
}

const ECRANS: readonly {
  nom: string;
  chemin: string;
  preparer?: (page: Page) => Promise<void>;
}[] = [
  {
    nom: "habilitations",
    chemin: "/parametres/habilitations",
    preparer: ouvrirLesReplis,
  },
  {
    nom: "materiel",
    chemin: "/parametres/materiel",
    preparer: ouvrirLesReplis,
  },
  {
    nom: "agences-modifier",
    chemin: "/parametres/agences",
    preparer: async (page) => {
      const chemin = await premierLienDeModificationAgence(page);
      await page.goto(chemin);
    },
  },
  { nom: "prestations", chemin: "/parametres/prestations" },
  {
    nom: "equipe",
    chemin: "/parametres/equipe",
    preparer: ouvrirLesReplis,
  },
  { nom: "forfaits", chemin: "/parametres/forfaits" },
  {
    nom: "forfaits-id",
    chemin: "/parametres/forfaits",
    preparer: async (page) => {
      const chemin = await premierLienDeModificationForfait(page);
      await page.goto(chemin);
    },
  },
];

for (const largeur of [1280, 375] as const) {
  for (const ecran of ECRANS) {
    test(`capture — ${ecran.nom} à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page.goto(ecran.chemin);
      await expect(page.locator("main")).toBeVisible();
      if (ecran.preparer !== undefined) {
        await ecran.preparer(page);
      }
      await capturer(page, ecran.nom, largeur);
    });
  }
}
