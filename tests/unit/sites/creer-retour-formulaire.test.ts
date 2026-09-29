import { describe, expect, it } from "vitest";

import { versLeFormulaire } from "@/app/api/sites/creer/formulaire";

/**
 * LE RETOUR AU FORMULAIRE APRÈS UN REFUS DE SAISIE (9BR-TP-A4b-MESSAGES,
 * CS42) — `client` reprend le nom déjà lu par la page (`?client=`).
 */

const CHAMPS = {
  client: "11111111-1111-1111-1111-111111111111",
  agence_id: "22222222-2222-2222-2222-222222222222",
  libelle: "TPA4-Site",
  commune: "Ducos",
  zone_geo: "grand_noumea",
  temps_trajet_min: "15",
};

function urlDeRetour(reponse: Response): URL {
  const location = reponse.headers.get("Location");
  expect(location).not.toBeNull();
  return new URL(location as string, "http://localhost");
}

describe("versLeFormulaire (sites)", () => {
  it("redirige en 303 vers /sites/nouveau, motif compris", () => {
    const url = urlDeRetour(versLeFormulaire("site.refus.saisie"));
    expect(url.pathname).toBe("/sites/nouveau");
    expect(url.searchParams.get("motif")).toBe("site.refus.saisie");
  });

  it("porte CHAQUE champ soumis, dont `client`", () => {
    const url = urlDeRetour(versLeFormulaire("site.refus.saisie", CHAMPS));
    for (const [nom, valeur] of Object.entries(CHAMPS)) {
      expect(url.searchParams.get(nom)).toBe(valeur);
    }
  });

  it("omet un champ absent plutôt que d'écrire une valeur vide", () => {
    const url = urlDeRetour(
      versLeFormulaire("site.refus.saisie", { libelle: "TPA4-Site" }),
    );
    expect(url.searchParams.has("client")).toBe(false);
    expect(url.searchParams.get("libelle")).toBe("TPA4-Site");
  });
});
