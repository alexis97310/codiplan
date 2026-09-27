import { describe, expect, it } from "vitest";

import { enDuree } from "@/lib/calendar/duree";
import { fr } from "@/lib/i18n/fr";

/**
 * Les champs SAISIS en minutes le disent, avec un exemple (GR14, audit GR du
 * 26/09/2026, constat G17 → gain GR14, ticket 9AI). L'exemple suit le
 * formateur `enDuree` plutôt que de le réécrire en toutes lettres : si sa
 * conversion change, l'exemple de ce test change avec elle, jamais l'inverse.
 */
const CLES_SAISIE_EN_MINUTES = [
  "intervention.deplacement.duree",
  "prestations.duree_minutes",
  "site.temps_trajet_min",
  "intervention.cloture.temps_valide_saisie",
  "trajets.champ_minutes",
] as const;

describe("libellés de saisie en minutes", () => {
  it.each(CLES_SAISIE_EN_MINUTES)(
    "« %s » nomme l'unité et donne un exemple",
    (cle) => {
      const libelle = fr[cle];
      expect(libelle).toContain("en minutes");
      expect(libelle).toContain(`ex. 90 = ${enDuree(90)}`);
    },
  );

  it("« intervention.cloture.temps_valide » est un libellé d'AFFICHAGE, sans unité en dur", () => {
    expect(fr["intervention.cloture.temps_valide"]).not.toContain("minutes");
  });
});
