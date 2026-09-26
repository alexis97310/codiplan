import { describe, expect, it } from "vitest";

import {
  type ColonneAResumer,
  dureeCarteAffichee,
  materielDeLaCarte,
  resumeDesTechniciens,
  siteDeLaCarte,
} from "@/app/(back-office)/planning/carte";
import type { Annuaire, Designation } from "@/lib/auth/annuaire";
import type { DonneesMateriel } from "@/lib/machines/depot";

/**
 * CE QU'UNE CARTE DE PLANNING DIT EN PLUS DE L'HEURE ET DU CLIENT (PLANNING-2 ;
 * matériel ajouté par AFFICHAGE-MATERIEL-1, 23/09/2026).
 *
 * Trois fonctions pures, éprouvées seules : le rendu de la carte lui-même
 * (site, heure de début, silence sur une durée nulle) est éprouvé à travers
 * l'écran par `tests/e2e/planning-largeur-et-carte.spec.ts`.
 */
describe("siteDeLaCarte", () => {
  it("compose le mot imposé et le libellé du site", () => {
    expect(siteDeLaCarte({ libelle: "Boulari" })).toBe("Site Boulari");
  });
});

describe("dureeCarteAffichee", () => {
  it("rend `null` pour une durée nulle — jamais un zéro affiché", () => {
    expect(dureeCarteAffichee(0)).toBeNull();
  });

  it("rend `null` pour une durée négative", () => {
    expect(dureeCarteAffichee(-5)).toBeNull();
  });

  it("rend les minutes seules sous une heure", () => {
    expect(dureeCarteAffichee(45)).toBe("45 min");
  });

  it("rend l'heure et les minutes, minutes sur deux chiffres", () => {
    expect(dureeCarteAffichee(90)).toBe("1 h 30");
    expect(dureeCarteAffichee(65)).toBe("1 h 05");
  });

  it("rend une heure ronde avec ses minutes à zéro", () => {
    expect(dureeCarteAffichee(120)).toBe("2 h 00");
  });
});

/**
 * *Mesuré le 23/09/2026 en production : une carte se lisait « SIDAPS /
 * Curatif », sans dire QUEL matériel.*
 */
describe("materielDeLaCarte", () => {
  const PONT: DonneesMateriel = {
    familleLibelle: "Pont Elevateur",
    marque: "RAVAGLIOLI",
    reference: "RAV4401.4",
    numeroSerie: "00106",
  };

  it("sans machine affectée, dit que le matériel n'est pas précisé", () => {
    expect(materielDeLaCarte({ machines: [] }, new Map())).toBe(
      "Matériel non précisé",
    );
  });

  it("une machine : famille, marque, référence, puis S/N et le numéro de série", () => {
    const donnees = new Map([["m1", PONT]]);
    expect(
      materielDeLaCarte({ machines: [{ machine_id: "m1" }] }, donnees),
    ).toBe("Pont Elevateur RAVAGLIOLI RAV4401.4 S/N 00106");
  });

  it("plusieurs machines : jointes par une virgule, comme `machinesAffichees`", () => {
    const autre: DonneesMateriel = {
      familleLibelle: "Cric",
      marque: "Cascos",
      reference: "13442",
      numeroSerie: "10044",
    };
    const donnees = new Map([
      ["m1", PONT],
      ["m2", autre],
    ]);
    expect(
      materielDeLaCarte(
        { machines: [{ machine_id: "m1" }, { machine_id: "m2" }] },
        donnees,
      ),
    ).toBe(
      "Pont Elevateur RAVAGLIOLI RAV4401.4 S/N 00106, Cric Cascos 13442 S/N 10044",
    );
  });
});

/**
 * QUI EST LÀ, ET QUI EST BLOQUÉ (99G-PLANNING-JOUR, audit du 25/09/2026,
 * constat 14). L'annuaire est un simple dictionnaire, comme celui des
 * gardiens d'isolation — aucun contexte cloisonné à lever pour cette
 * fonction pure.
 */
describe("resumeDesTechniciens", () => {
  const annuaire =
    (designations: Record<string, Designation>): Annuaire =>
    (id) =>
      designations[id] ?? { etat: "non_demandee" };

  it("0 technicien, aucune colonne : pas de mention de blocage", () => {
    const colonnes: readonly ColonneAResumer[] = [];
    expect(resumeDesTechniciens(colonnes, annuaire({}))).toBe("0 techniciens");
  });

  it("la colonne SANS technicien ne compte pas comme un technicien", () => {
    const colonnes: readonly ColonneAResumer[] = [
      { technicienId: null, bloquee: false },
    ];
    expect(resumeDesTechniciens(colonnes, annuaire({}))).toBe("0 techniciens");
  });

  it("1 technicien, accordé au singulier — 0 bloqué : pas de mention", () => {
    const colonnes: readonly ColonneAResumer[] = [
      { technicienId: "t1", bloquee: false },
    ];
    expect(resumeDesTechniciens(colonnes, annuaire({}))).toBe("1 technicien");
  });

  it("plusieurs techniciens, 0 bloqué : pas de mention", () => {
    const colonnes: readonly ColonneAResumer[] = [
      { technicienId: "t1", bloquee: false },
      { technicienId: "t2", bloquee: false },
    ];
    expect(resumeDesTechniciens(colonnes, annuaire({}))).toBe("2 techniciens");
  });

  it("1 bloqué : le compte au singulier ET le nom, tiré de l'annuaire", () => {
    const colonnes: readonly ColonneAResumer[] = [
      { technicienId: "t1", bloquee: true },
      { technicienId: "t2", bloquee: false },
    ];
    const desLettres = annuaire({ t1: { etat: "nom", nom: "Cédric" } });
    expect(resumeDesTechniciens(colonnes, desLettres)).toBe(
      "2 techniciens · 1 agenda bloqué (Cédric)",
    );
  });

  it("plusieurs bloqués : le compte au pluriel, les noms joints par une virgule", () => {
    const colonnes: readonly ColonneAResumer[] = [
      { technicienId: "t1", bloquee: true },
      { technicienId: "t2", bloquee: true },
      { technicienId: "t3", bloquee: false },
    ];
    const desLettres = annuaire({
      t1: { etat: "nom", nom: "Cédric" },
      t2: { etat: "nom", nom: "Awa" },
    });
    expect(resumeDesTechniciens(colonnes, desLettres)).toBe(
      "3 techniciens · 2 agendas bloqués (Cédric, Awa)",
    );
  });

  it("un nom refusé par le cloisonnement est tu, jamais inventé — le compte reste vrai", () => {
    const colonnes: readonly ColonneAResumer[] = [
      { technicienId: "t1", bloquee: true },
    ];
    const desLettres = annuaire({ t1: { etat: "refusee" } });
    expect(resumeDesTechniciens(colonnes, desLettres)).toBe(
      "1 technicien · 1 agenda bloqué",
    );
  });
});
