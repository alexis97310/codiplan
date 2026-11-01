import { describe, expect, it } from "vitest";

import { peutPleinement } from "@/lib/auth/habilitations";
import { Role } from "@/lib/auth/roles";
import {
  decisionDepuisLaFiche,
  decisionDepuisUnFormulaireDeCreation,
} from "@/lib/machines/garde-statut";

/**
 * 9I8F1-REPRISE-9I8F, D227 — LES RÈGLES PURES DE LA GARDE DU STATUT
 * (`lib/machines/garde-statut.ts`), sans base : aucune réactivation
 * silencieuse d'une machine sortie ou fusionnée.
 */

describe("decisionDepuisLaFiche — l'écran autonome, une action explicite", () => {
  it("une machine fusionnée ne change JAMAIS de statut, quelle que soit la cible ou la confirmation", () => {
    expect(decisionDepuisLaFiche("fusionnee", "en_service", true)).toEqual({
      action: "refuser",
      motif: "fusionnee",
    });
    expect(decisionDepuisLaFiche("fusionnee", "remplacee", true)).toEqual({
      action: "refuser",
      motif: "fusionnee",
    });
  });

  it("une sortie du parc sans confirmation est un refus nommé", () => {
    expect(decisionDepuisLaFiche("en_service", "remplacee", false)).toEqual({
      action: "refuser",
      motif: "sortie_sans_confirmation",
    });
  });

  it("une sortie du parc AVEC confirmation est acceptée", () => {
    expect(decisionDepuisLaFiche("en_service", "remplacee", true)).toEqual({
      action: "ecrire",
      statut: "remplacee",
    });
  });

  it("le RETOUR d'une machine sortie vers un statut actif exige aussi une confirmation", () => {
    expect(decisionDepuisLaFiche("remplacee", "en_service", false)).toEqual({
      action: "refuser",
      motif: "sortie_sans_confirmation",
    });
    expect(decisionDepuisLaFiche("remplacee", "en_service", true)).toEqual({
      action: "ecrire",
      statut: "en_service",
    });
  });

  it("entre deux sorties du parc, aucune confirmation n'est exigée (ni l'une ni l'autre n'est un retour)", () => {
    expect(decisionDepuisLaFiche("remplacee", "ferraillee", false)).toEqual({
      action: "ecrire",
      statut: "ferraillee",
    });
  });

  it("entre deux statuts actifs, aucune confirmation n'est exigée", () => {
    expect(decisionDepuisLaFiche("en_panne", "arretee", false)).toEqual({
      action: "ecrire",
      statut: "arretee",
    });
  });
});

describe("decisionDepuisUnFormulaireDeCreation — un champ annexe, jamais un refus", () => {
  it("sans valeur postée, le champ est ignoré", () => {
    expect(decisionDepuisUnFormulaireDeCreation("en_service", null)).toEqual({
      action: "ignorer",
    });
  });

  it("une machine remplacée ignore le champ, même « en_service » forgé — jamais une réactivation", () => {
    expect(
      decisionDepuisUnFormulaireDeCreation("remplacee", "en_service"),
    ).toEqual({ action: "ignorer" });
  });

  it("une machine fusionnée ignore le champ, même « en_service » forgé — jamais une réactivation", () => {
    expect(
      decisionDepuisUnFormulaireDeCreation("fusionnee", "en_service"),
    ).toEqual({ action: "ignorer" });
  });

  it("une machine déjà active écrit la valeur choisie", () => {
    expect(
      decisionDepuisUnFormulaireDeCreation("en_service", "en_panne"),
    ).toEqual({ action: "ecrire", statut: "en_panne" });
  });
});

describe("la capacité `gerer_machine`, mécanique du point 2 (D227)", () => {
  it("le rôle du portail client (CLI) ne l'a pas — c'est lui que le champ « état de machine » doit refuser à la création", () => {
    expect(peutPleinement(Role.client, "gerer_machine")).toBe(false);
  });

  it("les rôles internes habituels l'ont en plein", () => {
    expect(peutPleinement(Role.adv, "gerer_machine")).toBe(true);
    expect(peutPleinement(Role.technicien, "gerer_machine")).toBe(true);
  });
});
