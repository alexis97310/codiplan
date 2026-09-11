import { describe, expect, it } from "vitest";

import { resumerLeParc, type LigneDeParc } from "@/lib/machines/depot";

/*
 * R2-21 — LE RÉSUMÉ DU PARC SE COMPTE SUR LES LIGNES RENDUES.
 *
 * **Et pas par une seconde requête.** Deux lectures d'un même critère divergent
 * en silence (§9, 01/09), et un bandeau qui compterait autrement que le tableau
 * qu'il coiffe est la pire forme de cette divergence : *le lecteur voit les deux
 * chiffres côte à côte et ne sait pas lequel croire.*
 */

function ligne(statut: string, complet: boolean): LigneDeParc {
  return {
    id: "01a0e2e0-0000-7000-8000-00000000000a",
    numero: null,
    numero_serie: "SN-1",
    reference_interne: null,
    statut: statut as LigneDeParc["statut"],
    criticite: "normale" as LigneDeParc["criticite"],
    complet,
    localisation: null,
    date_mise_en_service: null,
    modele: { reference: "CP-500", famille: { libelle: "Compresseurs" } },
    client: { raison_sociale: "Client" },
    site: { libelle: "Atelier", commune: null },
  };
}

describe("le résumé du parc (R2-21)", () => {
  it("compte par statut et compte les fiches à compléter", () => {
    const resume = resumerLeParc([
      ligne("en_service", true),
      ligne("en_service", false),
      ligne("en_panne", true),
    ]);
    expect(resume.total).toBe(3);
    expect(resume.parStatut).toEqual({ en_service: 2, en_panne: 1 });
    expect(resume.incompletes).toBe(1);
  });

  it("un parc vide rend des ZÉROS, jamais une absence", () => {
    // *« Sans information » et « zéro » ne se corrigent pas pareil* (D88) — ici
    // le zéro est juste : on a compté, et il n'y avait rien.
    expect(resumerLeParc([])).toEqual({
      total: 0,
      parStatut: {},
      incompletes: 0,
    });
  });

  it("le total est la somme des statuts — le témoin du résumé", () => {
    // Sans lui, un statut oublié par le compteur passerait inaperçu : le total
    // vient d'ailleurs et ne le contredirait pas.
    const lignes = [
      ligne("en_service", true),
      ligne("arretee", false),
      ligne("ferraillee", true),
      ligne("arretee", true),
    ];
    const resume = resumerLeParc(lignes);
    const somme = Object.values(resume.parStatut).reduce((a, b) => a + b, 0);
    expect(somme).toBe(resume.total);
    expect(resume.total).toBeGreaterThan(0);
  });
});
