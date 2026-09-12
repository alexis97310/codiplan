import { describe, expect, it } from "vitest";

import {
  estFige,
  peutAffecter,
  peutAnnuler,
  peutCloturer,
  peutDeplacer,
  statutALaCreation,
} from "@/lib/interventions/cycle-de-vie";

/**
 * LE CYCLE DE VIE D'UNE INTERVENTION (lot 2, D84 ; I5 pour la préséance).
 *
 * Ce module n'est pas ce qui GARDE — la base garde, par
 * `intervention_cycle_de_vie`, et `tests/isolation/intervention.test.ts` le
 * mesure. Ce qu'on éprouve ici est **ce que l'écran dit avant d'agir**, et les
 * deux doivent dire la même chose : *une action refusée à l'écran mais acceptée
 * par la base est un trou ; l'inverse est un écran qui ment.*
 */

describe("le figeage, et l'issue que I5 laisse ouverte", () => {
  it("clôturée et annulée sont figées", () => {
    expect(estFige("cloturee")).toBe(true);
    expect(estFige("annulee")).toBe(true);
  });

  it("aucun autre statut ne l'est — et c'est le cas qui DOIT rester vert", () => {
    // Le pendant du cas ci-dessus (§9, 11/09). Si `estFige` retournait `true`
    // pour tout, le premier cas passerait et le planning serait inutilisable.
    for (const statut of [
      "a_planifier",
      "planifiee",
      "affectee",
      "en_cours",
      "suspendue",
      "terminee",
    ] as const) {
      expect(estFige(statut), statut).toBe(false);
    }
  });

  it("ANNULER une intervention CLÔTURÉE reste possible — I5 le veut", () => {
    // La préséance de I5 : ANNULEE > CLOTUREE. Une intervention clôturée par
    // erreur doit pouvoir être annulée, sinon l'invariant serait vrai dans la
    // synchronisation et faux à l'écran.
    expect(peutAnnuler("cloturee").refuse).toBe(false);
  });

  it("mais on n'annule pas ce qui est déjà annulé", () => {
    const verdict = peutAnnuler("annulee");
    expect(verdict.refuse).toBe(true);
    expect(verdict.refuse && verdict.cle).toBe(
      "intervention.refus.deja_annulee",
    );
  });
});

describe("déplacer et affecter", () => {
  it("sont refusés sur une figée, avec la raison qui la nomme", () => {
    const surCloturee = peutDeplacer("cloturee");
    expect(surCloturee.refuse && surCloturee.cle).toBe(
      "intervention.refus.cloturee_figee",
    );
    const surAnnulee = peutAffecter("annulee");
    expect(surAnnulee.refuse && surAnnulee.cle).toBe(
      "intervention.refus.annulee_figee",
    );
  });

  it("passent sur une intervention vivante", () => {
    expect(peutDeplacer("planifiee").refuse).toBe(false);
    expect(peutAffecter("en_cours").refuse).toBe(false);
  });
});

describe("clôturer", () => {
  it("est refusée sans temps saisi — c'est l'entrée de D83", () => {
    const sansTemps = peutCloturer("terminee", null);
    expect(sansTemps.refuse && sansTemps.cle).toBe(
      "intervention.refus.temps_manquant",
    );
    // Zéro aussi : sous D83, zéro minute facturerait quand même le plancher
    // d'une heure. Une intervention qui n'a pas eu lieu s'annule.
    expect(peutCloturer("terminee", 0).refuse).toBe(true);
  });

  it("passe avec un temps, et refuse la seconde fois", () => {
    expect(peutCloturer("terminee", 12).refuse).toBe(false);
    const deja = peutCloturer("cloturee", 12);
    expect(deja.refuse && deja.cle).toBe("intervention.refus.deja_cloturee");
  });
});

describe("le statut à la création est DÉDUIT de la pose", () => {
  /**
   * **Le défaut que ce scénario ferme a été vu à l'écran, pas imaginé.** La
   * première rédaction ne regardait que le créneau : trois interventions datées
   * du 14 septembre s'affichaient « à planifier », rangées parmi les posées.
   * *Un statut qui contredit la ligne où il s'affiche est pire qu'un statut
   * absent.*
   */
  const jour = new Date(Date.UTC(2026, 8, 14));

  it("sans date NI créneau : file d'attente", () => {
    expect(statutALaCreation(null, null)).toBe("a_planifier");
  });

  it("avec une DATE seule : planifiée — c'est le défaut mesuré", () => {
    expect(statutALaCreation(jour, null)).toBe("planifiee");
  });

  it("avec un créneau : planifiée", () => {
    expect(statutALaCreation(null, jour)).toBe("planifiee");
    expect(statutALaCreation(jour, jour)).toBe("planifiee");
  });
});
