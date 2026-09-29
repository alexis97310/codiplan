import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LE PLANCHER DE 12 PX, ÉPROUVÉ AU NAVIGATEUR (D138, TP-UX1-2).
 *
 * `tests/unit/ui/plancher-12-pages.test.ts` lit le texte source ; ces cinq
 * scénarios lisent le style CALCULÉ, sur un élément précis de chaque groupe
 * de commit — jamais par une classe, toujours par le rôle, le libellé ou un
 * attribut `data-` déjà présent. Lecture seule : aucune écriture en base,
 * scène de démonstration du semis uniquement.
 */

test.describe("plancher de 12 px — D138", () => {
  test("G1 — l'en-tête « Technicien » du planning, vue Semaine, à 1280 px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await ouvrirUneSession(page);
    await expect(page).toHaveURL(/\/planning/);

    const entete = page.getByRole("cell", {
      name: fr["planning.colonne_technicien"],
      exact: true,
    });
    await expect(entete).toHaveCSS("font-size", "12px");
  });
});
