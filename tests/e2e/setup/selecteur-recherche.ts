import { type Locator, type Page, expect } from "@playwright/test";

/**
 * AIDES POUR `SelecteurRecherche` (SELECTEURS-1, 24/09/2026).
 *
 * Les trois écrans qui posaient un `<select>` — `/sites/nouveau`,
 * `/interventions/nouvelle`, `/parc/nouvelle` — cherchent désormais un
 * client, un site ou un modèle par `components/ui/selecteur-recherche.tsx` :
 * un champ texte, une liste de résultats, un choix qui pose un champ CACHÉ.
 * `data-selecteur={nom}` identifie chaque instance — voir le composant.
 *
 * Les scénarios qui manipulaient `select[name="site"]`/`selectOption(...)`
 * appellent maintenant `choisirPremierResultat`/`choisirResultatParTexte` :
 * la MISE EN SCÈNE change, aucune assertion métier n'est modifiée.
 */

function champ(portee: Page | Locator, nom: string): Locator {
  return portee.locator(`[data-selecteur="${nom}"]`);
}

/**
 * Ouvre le sélecteur `nom` et choisit le PREMIER résultat proposé — le cas
 * « n'importe quel choix valide suffit », qui remplace
 * `selectOption(optionsSite.first())`.
 *
 * Rend le libellé choisi, pour les scénarios qui veulent le reconnaître
 * ensuite (comme l'ancien code lisait le texte de l'option).
 */
export async function choisirPremierResultat(
  portee: Page | Locator,
  nom: string,
): Promise<string> {
  const bloc = champ(portee, nom);
  await bloc.locator('input[type="text"]').click();
  const premiere = bloc.locator('ul[role="listbox"] li[role="option"]').first();
  await expect(premiere).toBeVisible();
  const libelle = ((await premiere.textContent()) ?? "").trim();
  await premiere.click();
  return libelle;
}

/**
 * Ouvre le sélecteur `nom`, tape `texte`, et choisit le résultat qui
 * contient `libelleAttendu` (ou le premier résultat si absent).
 */
export async function choisirResultatParTexte(
  portee: Page | Locator,
  nom: string,
  texte: string,
  libelleAttendu?: string | RegExp,
): Promise<void> {
  const bloc = champ(portee, nom);
  const saisie = bloc.locator('input[type="text"]');
  await saisie.click();
  await saisie.fill(texte);
  const resultat =
    libelleAttendu === undefined
      ? bloc.locator('ul[role="listbox"] li[role="option"]').first()
      : bloc
          .locator('ul[role="listbox"] li[role="option"]')
          .filter({ hasText: libelleAttendu })
          .first();
  await expect(resultat).toBeVisible();
  await resultat.click();
}

/** La valeur actuellement posée dans le champ CACHÉ soumis avec le formulaire. */
export function valeurChamp(portee: Page | Locator, nom: string): Locator {
  return champ(portee, nom).locator('input[type="hidden"]');
}
