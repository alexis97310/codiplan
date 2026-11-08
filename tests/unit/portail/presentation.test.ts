import { describe, expect, it } from "vitest";

import {
  sansLieuDuPortail,
  sousTitreDuPortail,
  titreTuileAvecCompte,
} from "@/app/(portail)/portail/presentation";

/**
 * LE PORTAIL NOMME LA SOCIÉTÉ QUI LE SERT, JAMAIS « CODIMA » EN DUR (TR-28,
 * audit du 28/09/2026).
 *
 * *Le produit est multi-société* : un compte portail d'une autre société que
 * CODIMA lisait pourtant « CODIMA » dans son propre sous-titre. Les deux
 * phrases se composent désormais depuis `chromeDeLaRequete().theme.nom`
 * (décision d'Alexis, 29/09/2026) — jamais une seconde lecture de la société
 * active, la même raison que `titreDesSites` compose déjà le mot imposé hors
 * du JSX (L0-11).
 */
describe("le sous-titre du portail nomme la société qui le sert", () => {
  it("porte le nom donné, jamais « CODIMA »", () => {
    const rendu = sousTitreDuPortail("Société X");
    expect(rendu).toContain("Société X");
    expect(rendu.toLowerCase()).not.toContain("codima");
  });
});

describe("la phrase « aucun lieu » nomme la société qui le sert", () => {
  it("porte le nom donné, jamais « CODIMA »", () => {
    const rendu = sansLieuDuPortail("Société X");
    expect(rendu).toContain("Société X");
    expect(rendu.toLowerCase()).not.toContain("codima");
  });
});

/**
 * LE TITRE DES DEUX TUILES DE L'ACCUEIL (9K02-PORTAIL-MENU-ACCUEIL) — le
 * chiffre porte le libellé, jamais l'inverse : un compte à zéro doit
 * s'afficher comme un compte, pas comme un texte vide.
 */
describe("le titre d'une tuile de compte porte le libellé ET le chiffre", () => {
  it("compose « libellé (n) »", () => {
    expect(titreTuileAvecCompte("Interventions en cours", 3)).toBe(
      "Interventions en cours (3)",
    );
  });

  it("affiche bien 0, jamais un texte vide", () => {
    expect(titreTuileAvecCompte("Demandes en attente", 0)).toBe(
      "Demandes en attente (0)",
    );
  });
});
