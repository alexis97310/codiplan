import type { Locator, Page } from "@playwright/test";

import { fr } from "@/lib/i18n/fr";

/**
 * OUVRE LE DIALOGUE « PLANIFIER À LA MAIN » / « DÉPLACER » DE L'EN-TÊTE
 * (9ES-TP-UX4-3-FICHE-GESTES-2, D195) — jusqu'à ce ticket, les blocs
 * « Planifier » et « Déplacer » de la carte Actions masquaient leur
 * formulaire derrière un `<summary>` « Saisir à la main », au profit du
 * bouton « Trouver un créneau ». La carte a quitté la fiche : les DEUX
 * gestes vivent désormais chacun dans leur propre dialogue d'en-tête
 * (`DialoguePlanifier`, `DialogueDeplacer`), ouvert par un bouton qui révèle
 * directement les champs — plus de repli imbriqué derrière un second clic.
 *
 * Au plus UN des deux boutons est visible par fiche (`Planifier à la main`
 * XOR `Déplacer`, jamais les deux) : **ignore volontairement `portee`** —
 * un `<dialog>` n'est jamais un descendant du bloc que l'appelant visait
 * avant ce ticket (un `<form>` filtré par son titre, par exemple), et ce
 * repère cible donc toujours la PAGE entière plutôt que la portée reçue,
 * via `Locator.page()` quand elle n'est pas déjà une `Page`.
 */
export async function ouvrirSaisieManuelle(
  portee: Page | Locator,
): Promise<void> {
  const page: Page = "goto" in portee ? portee : portee.page();
  await page
    .getByRole("button", {
      name: new RegExp(
        `^(${fr["intervention.action.planifier_a_la_main"]}|${fr["intervention.action.deplacer"]})$`,
      ),
    })
    .click();
}

/**
 * LE `<form>` DU DIALOGUE OUVERT (9ES-TP-UX4-3-FICHE-GESTES-2, D195) — ce
 * que les scénarios appelaient `formulairePlanifier(page)` /
 * `formDeplacer` avant ce ticket, un `<form>` filtré par le titre « Planifier »
 * ou « Déplacer » dans la carte Actions. Au plus un `<dialog>` est ouvert à
 * la fois : ce repère-ci suffit, sans distinguer lequel.
 *
 * Paresseux comme tout `Locator` Playwright : le construire AVANT
 * `ouvrirSaisieManuelle` est sans danger, seule l'action ou l'assertion qui
 * s'ensuit interroge réellement le DOM.
 */
export function formulaireDialogue(page: Page): Locator {
  return page.locator("dialog[open] form");
}

/**
 * LE `<dialog>` OUVERT LUI-MÊME — pour le bouton de soumission, posé dans
 * le PIED du dialogue (`components/ui/dialogue.tsx`) et associé à son
 * `<form>` par l'attribut `form`, jamais par imbrication DOM : chercher ce
 * bouton DANS `formulaireDialogue` ne le trouverait jamais.
 */
export function dialogueOuvert(page: Page): Locator {
  return page.locator("dialog[open]");
}
