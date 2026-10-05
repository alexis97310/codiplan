import { describe, expect, it } from "vitest";

import {
  schemaModificationTechnicien,
  schemaTechnicien,
} from "@/lib/techniciens/saisie";

const AGENCE_ID = "0192f0a0-0000-7000-8000-000000000001";

describe("la saisie d'un technicien", () => {
  it("LE CAS QUI DOIT RESTER VERT — une saisie complète passe", () => {
    const lu = schemaTechnicien.parse({
      nom: "Marc Weber",
      email: "marc.weber@example.test",
      agence_id: AGENCE_ID,
      actif: true,
      statut_ressource: "salarie",
    });
    expect(lu).toEqual({
      nom: "Marc Weber",
      email: "marc.weber@example.test",
      agence_id: AGENCE_ID,
      actif: true,
      statut_ressource: "salarie",
    });
  });

  it("« actif » vaut true par défaut — un technicien créé est proposable", () => {
    const lu = schemaTechnicien.parse({
      nom: "Marc Weber",
      email: "marc.weber@example.test",
      agence_id: AGENCE_ID,
      statut_ressource: "patente",
    });
    expect(lu.actif).toBe(true);
  });

  it("un nom vide est refusé", () => {
    expect(
      schemaTechnicien.safeParse({
        nom: "   ",
        email: "marc.weber@example.test",
        agence_id: AGENCE_ID,
        statut_ressource: "salarie",
      }).success,
    ).toBe(false);
  });

  it("un courriel mal formé est refusé", () => {
    expect(
      schemaTechnicien.safeParse({
        nom: "Marc Weber",
        email: "pas-un-courriel",
        agence_id: AGENCE_ID,
        statut_ressource: "salarie",
      }).success,
    ).toBe(false);
  });

  it("une agence qui n'est pas un UUID est refusée", () => {
    expect(
      schemaTechnicien.safeParse({
        nom: "Marc Weber",
        email: "marc.weber@example.test",
        agence_id: "ducos",
        statut_ressource: "salarie",
      }).success,
    ).toBe(false);
  });

  // QG-9 (27/09/2026, précisions du pilote du 03/10/2026, D163) : le statut de
  // ressource est OBLIGATOIRE à la création, et aucune valeur n'est choisie
  // d'avance — ni « salarie » ni « patente » ne sont un défaut.
  it("le statut de ressource est obligatoire — jamais de défaut inventé", () => {
    expect(
      schemaTechnicien.safeParse({
        nom: "Marc Weber",
        email: "marc.weber@example.test",
        agence_id: AGENCE_ID,
      }).success,
    ).toBe(false);
  });

  it("« non renseigné » n'est pas une valeur de la création — seules deux existent", () => {
    expect(
      schemaTechnicien.safeParse({
        nom: "Marc Weber",
        email: "marc.weber@example.test",
        agence_id: AGENCE_ID,
        statut_ressource: "non_renseigne",
      }).success,
    ).toBe(false);
  });
});

describe("la saisie d'une modification", () => {
  it("exige l'agence, l'activité et le statut de ressource, jamais l'identité", () => {
    const lu = schemaModificationTechnicien.parse({
      agence_id: AGENCE_ID,
      actif: false,
      statut_ressource: "patente",
    });
    expect(lu).toEqual({
      agence_id: AGENCE_ID,
      actif: false,
      statut_ressource: "patente",
    });
  });

  // QG-9 (D163) : le maintien explicite de « non renseigné » est posable à la
  // modification — `modifierTechnicien` seul sait si la fiche actuelle
  // l'autorise (motif `statut_deja_pose`).
  it("« non renseigné » se transforme en `null` — le MAINTIEN explicite de l'absence", () => {
    const lu = schemaModificationTechnicien.parse({
      agence_id: AGENCE_ID,
      actif: true,
      statut_ressource: "non_renseigne",
    });
    expect(lu.statut_ressource).toBeNull();
  });

  it("n'accepte pas une activité absente — jamais de défaut inventé", () => {
    expect(
      schemaModificationTechnicien.safeParse({
        agence_id: AGENCE_ID,
        statut_ressource: "salarie",
      }).success,
    ).toBe(false);
  });

  it("n'accepte pas un statut de ressource absent — jamais de défaut inventé", () => {
    expect(
      schemaModificationTechnicien.safeParse({
        agence_id: AGENCE_ID,
        actif: true,
      }).success,
    ).toBe(false);
  });
});
