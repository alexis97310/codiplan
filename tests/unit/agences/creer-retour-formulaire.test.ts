import { describe, expect, it } from "vitest";

import { versLeFormulaire } from "@/app/api/parametres/agences/creer/formulaire";

/**
 * LE RETOUR AU FORMULAIRE APRÈS UN REFUS DE SAISIE (9BR-TP-A4b-MESSAGES,
 * PA-06).
 */

const CHAMPS = {
  code: "TPA4",
  libelle: "TPA4-Agence",
  territoire: "NC",
  fuseau_horaire: "Pacific/Noumea",
};

function urlDeRetour(reponse: Response): URL {
  const location = reponse.headers.get("Location");
  expect(location).not.toBeNull();
  return new URL(location as string, "http://localhost");
}

describe("versLeFormulaire (agences)", () => {
  it("redirige en 303 vers /parametres/agences/nouvelle, motif compris", () => {
    const url = urlDeRetour(versLeFormulaire("agence.refus.saisie"));
    expect(url.pathname).toBe("/parametres/agences/nouvelle");
    expect(url.searchParams.get("motif")).toBe("agence.refus.saisie");
  });

  it("porte CHAQUE champ soumis", () => {
    const url = urlDeRetour(versLeFormulaire("agence.refus.saisie", CHAMPS));
    for (const [nom, valeur] of Object.entries(CHAMPS)) {
      expect(url.searchParams.get(nom)).toBe(valeur);
    }
  });

  it("omet un champ absent plutôt que d'écrire une valeur vide", () => {
    const url = urlDeRetour(
      versLeFormulaire("agence.refus.saisie", { code: "TPA4" }),
    );
    expect(url.searchParams.has("libelle")).toBe(false);
    expect(url.searchParams.get("code")).toBe("TPA4");
  });
});
