import { describe, expect, it } from "vitest";

import {
  observationsRecues,
  saisieVerificationRecue,
} from "@/lib/vgp/saisie-verification";

/**
 * LA SAISIE D'UNE VÉRIFICATION VGP, ÉPROUVÉE SANS BASE NI SESSION (lot
 * A5+A7, second temps).
 *
 * `enregistrerVerification` (`lib/vgp/verification.ts`) est déjà couverte,
 * sous cloisonnement, par `tests/isolation/vgp-verification.test.ts`. Ce
 * fichier couvre la pièce que ces scénarios ne peuvent pas isoler : la
 * TRADUCTION d'un `FormData` en `SaisieVerificationVgp`, avant tout accès à
 * la base — le même écart de portée que `lib/machines/saisie.ts` assume déjà
 * pour la fiche machine.
 */

const MACHINE_ID = "01a0e2e0-0000-7000-8000-0000000000f1";

function formulaire(champs: Readonly<Record<string, string>>): FormData {
  const donnees = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) {
    donnees.set(cle, valeur);
  }
  return donnees;
}

describe("saisieVerificationRecue", () => {
  it("accepte une saisie complète, avec observations", () => {
    const saisie = saisieVerificationRecue(
      formulaire({
        date_verification: "2026-07-19",
        organisme: "Bureau Veritas",
        reference_rapport: "BV-2026-0042",
        origine: "rapport_organisme",
        observations: "Frein de sécurité vérifié\nAucune fuite constatée",
      }),
      MACHINE_ID,
    );
    expect(saisie).not.toBeNull();
    expect(saisie?.machine_id).toBe(MACHINE_ID);
    expect(saisie?.date_verification).toEqual(
      new Date("2026-07-19T00:00:00.000Z"),
    );
    expect(saisie?.organisme).toBe("Bureau Veritas");
    expect(saisie?.reference_rapport).toBe("BV-2026-0042");
    expect(saisie?.origine).toBe("rapport_organisme");
    expect(saisie?.document_id).toBeNull();
    expect(saisie?.observations).toEqual([
      "Frein de sécurité vérifié",
      "Aucune fuite constatée",
    ]);
  });

  it("accepte une saisie SANS référence de rapport ni observation — la référence est NULLE, jamais une chaîne vide", () => {
    const saisie = saisieVerificationRecue(
      formulaire({
        date_verification: "2026-07-19",
        organisme: "Déclaration orale",
        origine: "declaration_client",
      }),
      MACHINE_ID,
    );
    expect(saisie?.reference_rapport).toBeNull();
    expect(saisie?.observations).toEqual([]);
  });

  it("refuse une saisie SANS origine — D114, aucun défaut n'est inventé", () => {
    const saisie = saisieVerificationRecue(
      formulaire({
        date_verification: "2026-07-19",
        organisme: "Bureau Veritas",
      }),
      MACHINE_ID,
    );
    expect(saisie).toBeNull();
  });

  it("refuse une origine hors des quatre valeurs ratifiées (D114)", () => {
    const saisie = saisieVerificationRecue(
      formulaire({
        date_verification: "2026-07-19",
        organisme: "Bureau Veritas",
        origine: "estimation_interne",
      }),
      MACHINE_ID,
    );
    expect(saisie).toBeNull();
  });

  it("refuse une saisie SANS date", () => {
    const saisie = saisieVerificationRecue(
      formulaire({
        organisme: "Bureau Veritas",
        origine: "rapport_organisme",
      }),
      MACHINE_ID,
    );
    expect(saisie).toBeNull();
  });

  it("refuse une saisie SANS organisme", () => {
    const saisie = saisieVerificationRecue(
      formulaire({
        date_verification: "2026-07-19",
        origine: "rapport_organisme",
      }),
      MACHINE_ID,
    );
    expect(saisie).toBeNull();
  });
});

describe("observationsRecues", () => {
  it("retire les lignes blanches et les espaces de bordure", () => {
    const donnees = formulaire({
      observations: "  Première ligne  \n\n   \nSeconde ligne",
    });
    expect(observationsRecues(donnees)).toEqual([
      "Première ligne",
      "Seconde ligne",
    ]);
  });

  it("rend un tableau vide, jamais une exception, quand le champ est absent", () => {
    expect(observationsRecues(new FormData())).toEqual([]);
  });
});
