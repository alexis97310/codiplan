import { type Locator, type Page } from "@playwright/test";

/**
 * AIDES POUR LE FORMULAIRE DE CRÉATION, AU GABARIT DU 28/09
 * (TP-UX5-1-FORMULAIRES, 07/10/2026).
 *
 * La priorité est devenue un groupe de boutons radio (`components/ui/
 * choix.tsx`), jamais un `<select>` : ses boutons portent un `<input
 * type="radio">` NATIF, visuellement masqué (`sr-only`) sous un `<label>`
 * stylé — cliquer le `<label>` (qui a, lui, une taille réelle) coche
 * l'entrée qu'il porte, exactement comme le ferait un clic de souris sur le
 * composant rendu.
 */
export async function choisirPriorite(
  portee: Page | Locator,
  valeur: "p1" | "p2" | "p3" | "p4",
): Promise<void> {
  await portee
    .locator(`label:has(input[name="priorite"][value="${valeur}"])`)
    .click();
}

/**
 * LA MACHINE — DEUX FORMES (TP-UX5-1-FORMULAIRES) : un `<select>` quand le
 * site en propose plus de six, un groupe de boutons radio sinon — MÊME champ
 * `machine_ids`, deux rendus. Cette aide choisit la forme présente dans la
 * page plutôt que d'en supposer une : un scénario qui pose une fixture à six
 * machines ou moins n'a pas à savoir laquelle des deux formes y répond.
 *
 * `valeur` est l'identifiant de la machine, ou `""` pour « Sans machine ».
 */
export async function choisirMachine(
  portee: Page | Locator,
  valeur: string,
): Promise<void> {
  const select = portee.locator('select[name="machine_ids"]');
  if ((await select.count()) > 0) {
    await select.selectOption(valeur);
    return;
  }
  await portee
    .locator(`label:has(input[name="machine_ids"][value="${valeur}"])`)
    .click();
}
