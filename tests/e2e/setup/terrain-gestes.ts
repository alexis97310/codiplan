import { type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

/**
 * « TERMINER », AVEC SA CONFIRMATION (D219, décision d'Alexis du 21/10/2026,
 * 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES) — le bouton n'envoie plus directement :
 * un premier clic ouvre le résumé (temps mesuré, rapport, prestations,
 * signature), un second sur « Oui, terminer » déclenche le geste qu'un clic
 * seul déclenchait avant ce ticket. Un seul endroit pour les deux clics, pour
 * qu'aucun des scénarios qui terminent une intervention n'ait à connaître ce
 * détail d'écran.
 */
export async function cliquerTerminer(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: fr["terrain.terminer.bouton"] })
    .click();
  await page
    .getByRole("button", { name: fr["terrain.terminer.confirmation.oui"] })
    .click();
}
