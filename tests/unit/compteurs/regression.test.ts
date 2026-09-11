import { describe, expect, it } from "vitest";

import {
  ordonnerParTerrain,
  regressions,
  type Releve,
  verdictsDesReleves,
} from "@/lib/compteurs/regression";

/**
 * LE CONTRÔLE DE NON-RÉGRESSION S'APPLIQUE APRÈS RÉORDONNANCEMENT (3.12).
 *
 * *L'ordre d'arrivée n'est pas l'ordre des faits* : un technicien relève un
 * compteur à 8 h dans un atelier sans réseau, un autre à 10 h dans un atelier
 * couvert, et le second arrive le premier. **Contrôler dans l'ordre d'arrivée
 * signalerait une régression là où il n'y en a aucune — et n'en verrait pas une
 * là où elle est.** Les deux moitiés sont mesurées ici.
 */

const MACHINE = "aaaaaaaa-0000-7000-8000-000000000001";
const AUTRE = "aaaaaaaa-0000-7000-8000-000000000002";

function releve(
  id: string,
  heure: string,
  valeur: number,
  machineId = MACHINE,
  type: Releve["type"] = "heures",
): Releve {
  return {
    id,
    machineId,
    type,
    valeur,
    horodatageTerrain: new Date(`2026-09-11T${heure}:00.000Z`),
  };
}

describe("l'ordre est celui du TERRAIN, jamais celui de l'arrivée", () => {
  it("réordonne, et deux relevés croissants dans le temps ne régressent pas", () => {
    // LA PREMIÈRE MOITIÉ : arrivés à l'envers, ils sont conformes.
    const arrives = [releve("b", "10:00", 1200), releve("a", "08:00", 1100)];
    expect(ordonnerParTerrain(arrives).map((r) => r.id)).toEqual(["a", "b"]);
    expect(regressions(arrives)).toEqual([]);
  });

  it("et une VRAIE régression est vue, même si elle arrive dans le bon ordre", () => {
    // LA SECONDE MOITIÉ, celle qu'on oublie : contrôler à l'arrivée ne
    // manquerait pas seulement de fausses alertes, il manquerait des vraies.
    const arrives = [releve("a", "08:00", 1200), releve("b", "10:00", 1100)];
    const vues = regressions(arrives);
    expect(vues.map((v) => v.id)).toEqual(["b"]);
    // *Un écart se lit avec ses deux termes* (D56) : le verdict porte la valeur
    // précédente, sans quoi « régression » n'apprend rien à qui doit trancher.
    expect(vues[0]?.precedente).toBe(1200);
  });

  it("à horodatage ÉGAL, l'ordre est celui de l'identifiant — et il est STABLE", () => {
    // Les identifiants sont des UUID v7 (I10), donc ordonnés dans le temps de
    // leur création. *Un tri instable rendrait le verdict dépendant de l'ordre
    // d'arrivée, ce que 3.12 refuse précisément.*
    const a = releve("aaaa-1", "08:00", 1100);
    const b = releve("aaaa-2", "08:00", 1050);
    expect(regressions([a, b]).map((v) => v.id)).toEqual(["aaaa-2"]);
    // Le MÊME jeu, présenté dans l'autre sens : le verdict ne bouge pas.
    expect(regressions([b, a]).map((v) => v.id)).toEqual(["aaaa-2"]);
  });
});

describe("chaque couple (machine, type) est une suite à part", () => {
  it("deux machines ne se comparent pas", () => {
    // Les mélanger ferait de chaque nouvelle machine une régression.
    const releves = [
      releve("a", "08:00", 5000),
      releve("b", "09:00", 10, AUTRE),
    ];
    expect(regressions(releves)).toEqual([]);
  });

  it("un compteur d'HEURES et un compteur de CYCLES ne se comparent pas", () => {
    const releves = [
      releve("a", "08:00", 5000),
      releve("b", "09:00", 12, MACHINE, "cycles"),
    ];
    expect(regressions(releves)).toEqual([]);
  });

  it("mais DEUX relevés de la MÊME suite se comparent — le cas qui doit rester vert pour sa raison", () => {
    // §9 (11/09). Sans lui, une séparation qui isolerait CHAQUE relevé ferait
    // passer les deux scénarios ci-dessus sans rien garantir.
    const releves = [
      releve("a", "08:00", 5000),
      releve("b", "09:00", 12, MACHINE, "heures"),
    ];
    expect(regressions(releves).map((v) => v.id)).toEqual(["b"]);
  });
});

describe("ce que le contrôle NE fait PAS", () => {
  it("il ne jette RIEN — un compteur remplacé repart de zéro (I5)", () => {
    // *Refuser la régression rendrait impossible de saisir le premier relevé
    // d'un compteur neuf, c'est-à-dire de dire la vérité.* Le relevé est
    // conservé et signalé ; c'est un œil qui tranche, pas une règle.
    const releves = [releve("a", "08:00", 9000), releve("b", "09:00", 0)];
    const verdicts = verdictsDesReleves(releves);
    expect(verdicts).toHaveLength(2);
    expect(verdicts.map((v) => v.id)).toEqual(["a", "b"]);
    expect(verdicts[1]?.regression).toBe(true);
  });

  it("il rend un verdict pour TOUS les relevés, anomalie ou non", () => {
    // *Un rapport qui ne rendrait que les anomalies laisserait son lecteur
    // incapable de distinguer « aucune anomalie » de « rien n'a été contrôlé ».*
    const releves = [releve("a", "08:00", 100), releve("b", "09:00", 200)];
    const verdicts = verdictsDesReleves(releves);
    expect(verdicts).toHaveLength(2);
    expect(verdicts.every((v) => !v.regression)).toBe(true);
    // Le premier n'a PAS de précédente : il n'y avait rien avant lui.
    expect(verdicts[0]?.precedente).toBeUndefined();
    expect(verdicts[1]?.precedente).toBe(100);
  });

  it("une valeur ÉGALE n'est pas une régression", () => {
    // Deux passages sans usage entre eux : le compteur n'a pas bougé, et ce
    // n'est pas une anomalie.
    const releves = [releve("a", "08:00", 1200), releve("b", "09:00", 1200)];
    expect(regressions(releves)).toEqual([]);
  });

  it("un seul relevé ne régresse jamais, et une liste vide non plus", () => {
    expect(regressions([releve("a", "08:00", 1200)])).toEqual([]);
    expect(verdictsDesReleves([])).toEqual([]);
  });

  it("`regressions` DÉRIVE de `verdictsDesReleves`, elle ne recalcule rien", () => {
    // Deux lectures d'un même critère divergent en silence (§9, 01/09). Ce
    // scénario les fait répondre l'une à côté de l'autre sur la même
    // population — avec son témoin : elle n'est pas vide.
    const releves = [
      releve("a", "08:00", 1200),
      releve("b", "09:00", 1100),
      releve("c", "10:00", 1300),
    ];
    const attendues = verdictsDesReleves(releves).filter((v) => v.regression);
    expect(attendues.length).toBeGreaterThan(0);
    expect(regressions(releves)).toEqual(attendues);
  });
});
