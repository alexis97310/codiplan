import { describe, expect, it } from "vitest";

import { cleJour } from "@/lib/calendar/fuseau";
import { joursDeLaSemaine, lundiDeLaSemaine } from "@/lib/calendar/semaine";
import {
  construireGrille,
  type AgenceDeGrille,
  type Posable,
} from "@/lib/interventions/grille";

/**
 * LA GRILLE DU PLANNING — ce qui tombe dans quelle case (D95).
 *
 * L'écran est jugé à l'œil ; le RANGEMENT, lui, se mesure. Ce sont deux choses
 * différentes, et le §9 (09/09) dit pourquoi : *un défaut peut être invisible à
 * toute assertion et évident sur une image* — la réciproque est vraie aussi, et
 * « cette intervention est-elle dans la bonne case ? » ne se voit pas sur une
 * capture quand il y a quatre lignes et six colonnes.
 */

const SEMAINE = joursDeLaSemaine(
  lundiDeLaSemaine({ annee: 2026, mois: 8, jour: 19 }),
).slice(0, 6);
// Lundi 17 → samedi 22 août 2026 : la semaine même de la maquette.
const LUNDI = SEMAINE[0];
const SAMEDI = SEMAINE[5];

const DUCOS: AgenceDeGrille = {
  id: "ag-ducos",
  libelle: "Ducos",
  joursOuverts: [1, 2, 3, 4, 5, 6],
  calendrierConnu: true,
};
const KONE: AgenceDeGrille = {
  id: "ag-kone",
  libelle: "Koné",
  joursOuverts: [1, 2, 3, 4, 5],
  calendrierConnu: true,
};
const SANS_CALENDRIER: AgenceDeGrille = {
  id: "ag-muette",
  libelle: "Agence muette",
  joursOuverts: [],
  calendrierConnu: false,
};

function jour(j: { annee: number; mois: number; jour: number }): Date {
  return new Date(Date.UTC(j.annee, j.mois - 1, j.jour));
}

function intervention(p: Partial<Posable> & { id: string }): Posable {
  return {
    technicien_id: null,
    agence_id: DUCOS.id,
    date_planifiee: jour(LUNDI),
    ...p,
  };
}

describe("le rangement en lignes et en cases", () => {
  it("range une intervention dans la case de son technicien et de son jour", () => {
    const grille = construireGrille(
      [
        intervention({
          id: "a",
          technicien_id: "t1",
          date_planifiee: jour(LUNDI),
        }),
        intervention({
          id: "b",
          technicien_id: "t1",
          date_planifiee: jour(SAMEDI),
        }),
      ],
      SEMAINE,
      [DUCOS],
    );

    expect(grille).toHaveLength(1);
    expect(grille[0].technicienId).toBe("t1");
    expect(grille[0].cases).toHaveLength(6);
    expect(grille[0].cases[0].lignes.map((l) => l.id)).toEqual(["a"]);
    expect(grille[0].cases[5].lignes.map((l) => l.id)).toEqual(["b"]);
    expect(grille[0].total).toBe(2);
  });

  it("LA MAILLE EST LE COUPLE (technicien, agence) — un technicien, deux lignes", () => {
    // C'est I7 qui l'impose : le calendrier appartient à l'agence, donc un
    // technicien qui intervient pour deux agences n'a pas UN samedi mais deux.
    const grille = construireGrille(
      [
        intervention({ id: "a", technicien_id: "t1", agence_id: DUCOS.id }),
        intervention({ id: "b", technicien_id: "t1", agence_id: KONE.id }),
      ],
      SEMAINE,
      [DUCOS, KONE],
    );

    expect(grille).toHaveLength(2);
    expect(grille.map((l) => l.agenceLibelle).sort()).toEqual([
      "Ducos",
      "Koné",
    ]);
  });

  it("le samedi de Koné est FERMÉ, celui de Ducos est OUVERT — sur les mêmes données", () => {
    // Le témoin est la paire : un seul des deux ne prouverait pas que le
    // calendrier est lu, il prouverait qu'une valeur est recopiée.
    const grille = construireGrille(
      [
        intervention({ id: "a", technicien_id: "t1", agence_id: DUCOS.id }),
        intervention({ id: "b", technicien_id: "t2", agence_id: KONE.id }),
      ],
      SEMAINE,
      [DUCOS, KONE],
    );

    const ducos = grille.find((l) => l.agenceId === DUCOS.id)!;
    const kone = grille.find((l) => l.agenceId === KONE.id)!;
    expect(ducos.cases[5].ouverte).toBe(true);
    expect(kone.cases[5].ouverte).toBe(false);
    // Et le lundi est ouvert des deux côtés : sans cela, « fermé » pourrait
    // n'être que « rien n'est jamais ouvert ».
    expect(ducos.cases[0].ouverte).toBe(true);
    expect(kone.cases[0].ouverte).toBe(true);
  });

  it("SANS calendrier, l'ouverture est INCONNUE — jamais « fermé »", () => {
    // Une agence grisée toute la semaine se lirait comme une agence fermée
    // toute la semaine. C'est la distinction que `tauxOccupation` fait déjà
    // entre « pas de calendrier » et « 0 % ».
    const grille = construireGrille(
      [
        intervention({
          id: "a",
          technicien_id: "t1",
          agence_id: SANS_CALENDRIER.id,
        }),
      ],
      SEMAINE,
      [SANS_CALENDRIER],
    );
    expect(grille[0].cases.map((c) => c.ouverte)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("une intervention SANS date n'entre pas dans la grille", () => {
    // Sa place est la colonne « À planifier ». La ranger quelque part lui
    // donnerait une date que personne n'a saisie.
    const grille = construireGrille(
      [
        intervention({ id: "a", technicien_id: "t1", date_planifiee: null }),
        intervention({ id: "b", technicien_id: "t1" }),
      ],
      SEMAINE,
      [DUCOS],
    );
    expect(grille[0].total).toBe(1);
    expect(grille[0].cases.flatMap((c) => c.lignes.map((l) => l.id))).toEqual([
      "b",
    ]);
  });

  it("une intervention HORS de la semaine affichée n'entre pas non plus", () => {
    const grille = construireGrille(
      [
        intervention({
          id: "avant",
          technicien_id: "t1",
          date_planifiee: jour({ annee: 2026, mois: 8, jour: 16 }),
        }),
        intervention({
          id: "apres",
          technicien_id: "t1",
          date_planifiee: jour({ annee: 2026, mois: 8, jour: 23 }),
        }),
        intervention({ id: "dedans", technicien_id: "t1" }),
      ],
      SEMAINE,
      [DUCOS],
    );
    expect(grille[0].cases.flatMap((c) => c.lignes.map((l) => l.id))).toEqual([
      "dedans",
    ]);
  });

  it("le jour se lit en UTC — UTC+11 rangerait un lundi au dimanche", () => {
    // `date_planifiee` est une DATE (`@db.Date`), rendue à minuit UTC. La lire
    // dans le fuseau de Nouméa la décalerait d'un cran : c'est le défaut que
    // `lib/excel/controle.ts` évite à l'import, et il se rejouerait ici.
    const minuitUtc = jour(LUNDI);
    const grille = construireGrille(
      [
        intervention({
          id: "a",
          technicien_id: "t1",
          date_planifiee: minuitUtc,
        }),
      ],
      SEMAINE,
      [DUCOS],
    );
    expect(cleJour(grille[0].cases[0].jour)).toBe(cleJour(LUNDI));
    expect(grille[0].cases[0].lignes.map((l) => l.id)).toEqual(["a"]);
  });

  it("les non affectées viennent en PREMIER, et l'ordre est stable", () => {
    const grille = construireGrille(
      [
        intervention({ id: "a", technicien_id: "t9", agence_id: KONE.id }),
        intervention({ id: "b", technicien_id: null, agence_id: DUCOS.id }),
        intervention({ id: "c", technicien_id: "t1", agence_id: DUCOS.id }),
      ],
      SEMAINE,
      [DUCOS, KONE],
    );
    expect(grille.map((l) => l.technicienId)).toEqual([null, "t1", "t9"]);
  });

  it("une agence inconnue rend son identifiant plutôt que rien", () => {
    // Un libellé vide dans la colonne de gauche se lirait comme une ligne
    // cassée. L'identifiant est laid et il est vrai.
    const grille = construireGrille(
      [intervention({ id: "a", technicien_id: "t1", agence_id: "ag-absente" })],
      SEMAINE,
      [DUCOS],
    );
    expect(grille[0].agenceLibelle).toBe("ag-absente");
    expect(grille[0].cases[0].ouverte).toBeNull();
  });

  it("sans aucune intervention, la grille est vide — et pas une ligne fantôme", () => {
    expect(construireGrille([], SEMAINE, [DUCOS, KONE])).toEqual([]);
  });
});
