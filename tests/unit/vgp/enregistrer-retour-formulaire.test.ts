import { describe, expect, it } from "vitest";

import { versLeFormulaire } from "@/app/api/vgp/enregistrer/[id]/formulaire";

/**
 * LE RETOUR AU FORMULAIRE APRÈS UN REFUS DE SAISIE (9BR-TP-A4b-MESSAGES,
 * PV-45) — mêmes principes qu'`interventions/creer/formulaire.ts` : les
 * observations sont tronquées à 1000 caractères dans l'URL.
 */

const MACHINE_ID = "33333333-3333-3333-3333-333333333333";

const CHAMPS = {
  date_verification: "2026-09-29",
  origine: "organisme_agree",
  organisme: "TPA4-Organisme",
  reference_rapport: "RAP-1",
  observations: "Rien à signaler.",
};

function urlDeRetour(reponse: Response): URL {
  const location = reponse.headers.get("Location");
  expect(location).not.toBeNull();
  return new URL(location as string, "http://localhost");
}

describe("versLeFormulaire (vgp)", () => {
  it("redirige en 303 vers /vgp/enregistrer/<id>, motif compris", () => {
    const url = urlDeRetour(
      versLeFormulaire(MACHINE_ID, "vgp.verifier.refus.saisie"),
    );
    expect(url.pathname).toBe(`/vgp/enregistrer/${MACHINE_ID}`);
    expect(url.searchParams.get("motif")).toBe("vgp.verifier.refus.saisie");
  });

  it("porte CHAQUE champ soumis", () => {
    const url = urlDeRetour(
      versLeFormulaire(MACHINE_ID, "vgp.verifier.refus.saisie", CHAMPS),
    );
    for (const [nom, valeur] of Object.entries(CHAMPS)) {
      expect(url.searchParams.get(nom)).toBe(valeur);
    }
  });

  it("TRONQUE les observations à 1000 caractères dans l'URL", () => {
    const longue = "a".repeat(1500);
    const url = urlDeRetour(
      versLeFormulaire(MACHINE_ID, "vgp.verifier.refus.saisie", {
        observations: longue,
      }),
    );
    expect(url.searchParams.get("observations")).toHaveLength(1000);
  });

  it("omet un champ absent plutôt que d'écrire une valeur vide", () => {
    const url = urlDeRetour(
      versLeFormulaire(MACHINE_ID, "vgp.verifier.refus.saisie", {
        organisme: "TPA4-Organisme",
      }),
    );
    expect(url.searchParams.has("date_verification")).toBe(false);
    expect(url.searchParams.get("organisme")).toBe("TPA4-Organisme");
  });
});
