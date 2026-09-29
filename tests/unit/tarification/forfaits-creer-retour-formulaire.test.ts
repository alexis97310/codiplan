import { describe, expect, it } from "vitest";

import { versLeFormulaire } from "@/app/api/parametres/forfaits/creer/formulaire";

/**
 * LE RETOUR AU CATALOGUE APRÈS UN REFUS DE SAISIE (9BR-TP-A4b-MESSAGES,
 * PV-45) — chaque champ est préfixé `forfait_`, pour ne jamais se confondre
 * avec `?zone=`, le filtre d'affichage du catalogue.
 */

const CHAMPS = {
  forfait_code: "TPA4-FRF",
  forfait_libelle: "TPA4-Forfait",
  forfait_type: "forfait_deplacement",
  forfait_rang: "1",
  forfait_montant_mineur: "5000",
  forfait_zone_geo: "grand_noumea",
  forfait_cumulable_temps: "1",
  forfait_actif: "1",
};

function urlDeRetour(reponse: Response): URL {
  const location = reponse.headers.get("Location");
  expect(location).not.toBeNull();
  return new URL(location as string, "http://localhost");
}

describe("versLeFormulaire (forfaits)", () => {
  it("redirige en 303 vers /parametres/forfaits, motif compris", () => {
    const url = urlDeRetour(versLeFormulaire("forfaits.refus.saisie"));
    expect(url.pathname).toBe("/parametres/forfaits");
    expect(url.searchParams.get("motif")).toBe("forfaits.refus.saisie");
  });

  it("porte CHAQUE champ soumis, préfixé forfait_", () => {
    const url = urlDeRetour(versLeFormulaire("forfaits.refus.saisie", CHAMPS));
    for (const [nom, valeur] of Object.entries(CHAMPS)) {
      expect(url.searchParams.get(nom)).toBe(valeur);
    }
    expect(url.searchParams.has("zone")).toBe(false);
  });

  it("omet un champ absent plutôt que d'écrire une valeur vide", () => {
    const url = urlDeRetour(
      versLeFormulaire("forfaits.refus.saisie", {
        forfait_code: "TPA4-FRF",
      }),
    );
    expect(url.searchParams.has("forfait_libelle")).toBe(false);
    expect(url.searchParams.get("forfait_code")).toBe("TPA4-FRF");
  });
});
