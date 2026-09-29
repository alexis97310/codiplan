import { describe, expect, it } from "vitest";

import { versLeFormulaire } from "@/app/api/clients/creer/formulaire";

/**
 * LE RETOUR AU FORMULAIRE APRÈS UN REFUS DE SAISIE (9BR-TP-A4b-MESSAGES,
 * CS23) — même raison qu'`tests/unit/interventions/creer-retour-formulaire.test.ts`.
 */

const CHAMPS = {
  raison_sociale: "TPA4-Client",
  code_externe: "EXT-1",
  ridet: "123456.001",
  categorie: "Client B",
  conditions_reglement: "30 jours",
  commercial_referent: "J. Martin",
};

function urlDeRetour(reponse: Response): URL {
  const location = reponse.headers.get("Location");
  expect(location).not.toBeNull();
  return new URL(location as string, "http://localhost");
}

describe("versLeFormulaire (clients)", () => {
  it("redirige en 303 vers /clients/nouveau, motif compris", () => {
    const reponse = versLeFormulaire("client.refus.saisie");
    expect(reponse.status).toBe(303);
    const url = urlDeRetour(reponse);
    expect(url.pathname).toBe("/clients/nouveau");
    expect(url.searchParams.get("motif")).toBe("client.refus.saisie");
  });

  it("porte CHAQUE champ soumis — un aller-retour restitue la valeur exacte", () => {
    const url = urlDeRetour(versLeFormulaire("client.refus.saisie", CHAMPS));
    for (const [nom, valeur] of Object.entries(CHAMPS)) {
      expect(url.searchParams.get(nom)).toBe(valeur);
    }
  });

  it("omet un champ absent plutôt que d'écrire une valeur vide", () => {
    const url = urlDeRetour(
      versLeFormulaire("client.refus.saisie", {
        raison_sociale: "TPA4-Client",
      }),
    );
    expect(url.searchParams.has("code_externe")).toBe(false);
    expect(url.searchParams.get("raison_sociale")).toBe("TPA4-Client");
  });

  it("n'écrit aucun champ sur un refus de droit (aucun `champs` fourni)", () => {
    const url = urlDeRetour(versLeFormulaire("auth.refus_droit"));
    expect(url.searchParams.get("motif")).toBe("auth.refus_droit");
    expect(url.searchParams.has("raison_sociale")).toBe(false);
  });
});
