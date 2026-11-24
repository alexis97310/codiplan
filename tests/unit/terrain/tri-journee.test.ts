import { describe, expect, it } from "vitest";

import {
  prochaineAFaire,
  trierParPrioriteEtDate,
  type ClesTriJournee,
} from "@/lib/terrain/tri-journee";

/**
 * LE TRI DE « MA JOURNÉE » (9L41-MA-JOURNEE-TRI-A-FAIRE, M8) — priorité,
 * puis créneau, EN_COURS/SUSPENDUE toujours en tête ; et la carte « à faire
 * maintenant » qui en tire la première ligne non déjà faite.
 */

type Ligne = {
  readonly id: string;
  readonly statut: string;
  readonly priorite: string;
  readonly instant: number | null;
};

function ligne(
  id: string,
  statut: string,
  priorite: string,
  instant: number | null,
): Ligne {
  return { id, statut, priorite, instant };
}

const cles = (l: Ligne): ClesTriJournee => l;

describe("trierParPrioriteEtDate", () => {
  it("trie par priorité croissante (p1 avant p4) à créneau égal", () => {
    const resultat = trierParPrioriteEtDate(
      [
        ligne("p4", "affectee", "p4", 0),
        ligne("p1", "affectee", "p1", 0),
        ligne("p3", "affectee", "p3", 0),
      ],
      cles,
    );
    expect(resultat.map((l) => l.id)).toEqual(["p1", "p3", "p4"]);
  });

  it("à priorité égale, trie par créneau croissant", () => {
    const resultat = trierParPrioriteEtDate(
      [
        ligne("tard", "affectee", "p2", 2000),
        ligne("tot", "affectee", "p2", 1000),
      ],
      cles,
    );
    expect(resultat.map((l) => l.id)).toEqual(["tot", "tard"]);
  });

  it("une ligne sans créneau (instant nul) passe après celles qui en ont une, à priorité égale", () => {
    const resultat = trierParPrioriteEtDate(
      [
        ligne("sans_creneau", "affectee", "p2", null),
        ligne("avec_creneau", "affectee", "p2", 1000),
      ],
      cles,
    );
    expect(resultat.map((l) => l.id)).toEqual([
      "avec_creneau",
      "sans_creneau",
    ]);
  });

  it("EN_COURS passe en tête devant une priorité plus urgente", () => {
    const resultat = trierParPrioriteEtDate(
      [
        ligne("p1_affectee", "affectee", "p1", 0),
        ligne("p4_en_cours", "en_cours", "p4", 0),
      ],
      cles,
    );
    expect(resultat.map((l) => l.id)).toEqual(["p4_en_cours", "p1_affectee"]);
  });

  it("SUSPENDUE passe en tête devant une priorité plus urgente", () => {
    const resultat = trierParPrioriteEtDate(
      [
        ligne("p1_affectee", "affectee", "p1", 0),
        ligne("p4_suspendue", "suspendue", "p4", 0),
      ],
      cles,
    );
    expect(resultat.map((l) => l.id)).toEqual(["p4_suspendue", "p1_affectee"]);
  });

  it("est stable : deux lignes à égalité totale gardent l'ordre reçu", () => {
    const resultat = trierParPrioriteEtDate(
      [
        ligne("premiere", "affectee", "p2", 1000),
        ligne("seconde", "affectee", "p2", 1000),
      ],
      cles,
    );
    expect(resultat.map((l) => l.id)).toEqual(["premiere", "seconde"]);
  });

  it("ne modifie pas le tableau reçu", () => {
    const lignes = [ligne("a", "affectee", "p1", 0), ligne("b", "affectee", "p2", 0)];
    trierParPrioriteEtDate(lignes, cles);
    expect(lignes.map((l) => l.id)).toEqual(["a", "b"]);
  });
});

describe("prochaineAFaire", () => {
  it("retourne la première du tri quand rien n'est en cours", () => {
    const resultat = prochaineAFaire(
      [
        ligne("p3", "affectee", "p3", 0),
        ligne("p1", "affectee", "p1", 0),
      ],
      cles,
    );
    expect(resultat?.id).toBe("p1");
  });

  it("préfère une ligne EN_COURS même de priorité basse", () => {
    const resultat = prochaineAFaire(
      [
        ligne("p1_affectee", "affectee", "p1", 0),
        ligne("p4_en_cours", "en_cours", "p4", 0),
      ],
      cles,
    );
    expect(resultat?.id).toBe("p4_en_cours");
  });

  it("ignore une ligne TERMINEE ou CLOTUREE : elles ne sont plus « à faire »", () => {
    const resultat = prochaineAFaire(
      [
        ligne("p1_cloturee", "cloturee", "p1", 0),
        ligne("p4_terminee", "terminee", "p4", 1),
        ligne("p3_affectee", "affectee", "p3", 2),
      ],
      cles,
    );
    expect(resultat?.id).toBe("p3_affectee");
  });

  it("rend null quand la journée est vide", () => {
    expect(prochaineAFaire([], cles)).toBeNull();
  });

  it("rend null quand tout est déjà terminé ou clôturé", () => {
    const resultat = prochaineAFaire(
      [ligne("a", "terminee", "p1", 0), ligne("b", "cloturee", "p1", 1)],
      cles,
    );
    expect(resultat).toBeNull();
  });
});
