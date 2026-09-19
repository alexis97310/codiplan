import { describe, expect, it } from "vitest";

import {
  schemaModificationTechnicien,
  schemaTechnicien,
} from "@/lib/techniciens/saisie";

const AGENCE_ID = "0192f0a0-0000-7000-8000-000000000001";

describe("la saisie d'un technicien", () => {
  it("LE CAS QUI DOIT RESTER VERT — une saisie complète passe", () => {
    const lu = schemaTechnicien.parse({
      nom: "Marc Wamytan",
      email: "marc.wamytan@example.test",
      agence_id: AGENCE_ID,
      actif: true,
    });
    expect(lu).toEqual({
      nom: "Marc Wamytan",
      email: "marc.wamytan@example.test",
      agence_id: AGENCE_ID,
      actif: true,
    });
  });

  it("« actif » vaut true par défaut — un technicien créé est proposable", () => {
    const lu = schemaTechnicien.parse({
      nom: "Marc Wamytan",
      email: "marc.wamytan@example.test",
      agence_id: AGENCE_ID,
    });
    expect(lu.actif).toBe(true);
  });

  it("un nom vide est refusé", () => {
    expect(
      schemaTechnicien.safeParse({
        nom: "   ",
        email: "marc.wamytan@example.test",
        agence_id: AGENCE_ID,
      }).success,
    ).toBe(false);
  });

  it("un courriel mal formé est refusé", () => {
    expect(
      schemaTechnicien.safeParse({
        nom: "Marc Wamytan",
        email: "pas-un-courriel",
        agence_id: AGENCE_ID,
      }).success,
    ).toBe(false);
  });

  it("une agence qui n'est pas un UUID est refusée", () => {
    expect(
      schemaTechnicien.safeParse({
        nom: "Marc Wamytan",
        email: "marc.wamytan@example.test",
        agence_id: "ducos",
      }).success,
    ).toBe(false);
  });
});

describe("la saisie d'une modification", () => {
  it("exige l'agence et l'activité, jamais l'identité", () => {
    const lu = schemaModificationTechnicien.parse({
      agence_id: AGENCE_ID,
      actif: false,
    });
    expect(lu).toEqual({ agence_id: AGENCE_ID, actif: false });
  });

  it("n'accepte pas une activité absente — jamais de défaut inventé", () => {
    expect(
      schemaModificationTechnicien.safeParse({ agence_id: AGENCE_ID })
        .success,
    ).toBe(false);
  });
});
