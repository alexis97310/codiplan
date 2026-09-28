import type { Locator, Page } from "@playwright/test";

import { fr } from "@/lib/i18n/fr";

/**
 * OUVRE LE REPLI « SAISIR À LA MAIN » (PG-B3-TROUVER-CRENEAU-FICHE) — les
 * blocs « Planifier » et « Déplacer » de la fiche masquent désormais leur
 * formulaire derrière ce résumé, au profit du bouton « Trouver un créneau ».
 * Au plus UN bloc de ce type est visible par fiche (`Planifier` XOR
 * `Déplacer`, jamais les deux) : sans portée, ce repère cible le
 * `<summary>` visible de toute la page.
 *
 * Ne rouvre PAS le bloc lui-même quand il est déjà replié (« Déplacer »
 * n'est jamais l'action principale, `lib/interventions/action-principale.ts`)
 * — l'appelant l'ouvre d'abord, comme avant ce ticket.
 */
export async function ouvrirSaisieManuelle(
  portee: Page | Locator,
): Promise<void> {
  await portee
    .locator("summary", {
      hasText: fr["intervention.action.saisir_a_la_main"],
    })
    .click();
}
