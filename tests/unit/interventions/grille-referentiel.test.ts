import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { joursDeLaSemaine, lundiDeLaSemaine } from "@/lib/calendar/semaine";
import {
  construireGrille,
  type AgenceDeGrille,
  type Posable,
} from "@/lib/interventions/grille";

/**
 * N-06 — LA VUE SEMAINE FAIT DISPARAÎTRE QUI N'A RIEN (17/09/2026).
 *
 * ## Le défaut, mesuré avant d'être corrigé
 *
 * En vue JOUR, les colonnes viennent du référentiel des techniciens actifs
 * depuis le 12/09 (`construireJournee`, `TechnicienDeJournee`) : un technicien
 * dont la journée est entièrement libre garde sa colonne, VIDE. En vue SEMAINE,
 * `construireGrille` ne rangeait que ce que les INTERVENTIONS lui apportaient
 * — la seule personne que le test `grille.test.ts` connaissait déjà à ce
 * sujet était « sans aucune intervention, la grille est vide », qui décrivait
 * exactement le défaut sans le nommer comme tel.
 *
 * *C'est précisément le technicien qu'on cherche en ouvrant un planning —
 * celui qui n'a rien.* Un planificateur qui bascule de la semaine au jour
 * pour la même personne et le même établissement ne devrait jamais voir
 * l'équipe changer de taille selon la vue.
 *
 * ## Ce que ce fichier tient
 *
 * Le premier scénario est le JUMEAU (§9, 24/08) : il rejoue la faute telle
 * qu'elle a été commise — aucun référentiel fourni, le défaut par défaut de
 * `construireGrille` — et montre que le technicien libre est absent. Sans lui,
 * les scénarios suivants prouveraient que le référentiel fonctionne, pas que
 * le défaut est fermé.
 */

const SEMAINE = joursDeLaSemaine(
  lundiDeLaSemaine({ annee: 2026, mois: 8, jour: 19 }),
).slice(0, 6);
const LUNDI = SEMAINE[0];

const DUCOS: AgenceDeGrille = {
  id: "ag-ducos",
  libelle: "Ducos",
  joursOuverts: [1, 2, 3, 4, 5, 6],
  calendrierConnu: true,
};

const OCCUPE = "11111111-1111-7111-8111-111111111111";
const LIBRE = "22222222-2222-7222-8222-222222222222";

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

describe("N-06 — le référentiel donne une ligne à qui n'a rien cette semaine", () => {
  it("JUMEAU — sans référentiel, le technicien libre n'a AUCUNE ligne", () => {
    const grille = construireGrille(
      [intervention({ id: "a", technicien_id: OCCUPE })],
      SEMAINE,
      [DUCOS],
    );
    expect(grille.map((l) => l.technicienId)).not.toContain(LIBRE);
  });

  it("avec le référentiel, il garde sa ligne — VIDE, jamais absente", () => {
    const grille = construireGrille(
      [intervention({ id: "a", technicien_id: OCCUPE })],
      SEMAINE,
      [DUCOS],
      () => null,
      [
        { id: OCCUPE, agenceIds: [DUCOS.id] },
        { id: LIBRE, agenceIds: [DUCOS.id] },
      ],
    );
    const ligneLibre = grille.find((l) => l.technicienId === LIBRE);
    expect(ligneLibre).toBeDefined();
    expect(ligneLibre!.total).toBe(0);
    expect(ligneLibre!.cases.every((c) => c.lignes.length === 0)).toBe(true);
    // Son agence de rattachement se lit quand même — c'est elle qui décide
    // de l'ouverture (I7), même pour une personne qui n'a rien cette semaine.
    expect(ligneLibre!.agences.map((a) => a.libelle)).toEqual(["Ducos"]);
  });

  it("le référentiel n'invente aucune ligne fantôme sans agence connue", () => {
    // Une agence que la grille ne connaît pas ne rend aucun libellé — même
    // règle que pour une intervention (`grille.test.ts`) : la ligne existe
    // quand même, elle n'a simplement aucune agence à nommer.
    const grille = construireGrille([], SEMAINE, [DUCOS], () => null, [
      { id: LIBRE, agenceIds: ["ag-absente"] },
    ]);
    expect(grille).toHaveLength(1);
    expect(grille[0].agences).toEqual([]);
  });

  it("sans techniciens fournis, le comportement d'avant ne bouge pas", () => {
    // Non-régression : le paramètre est ADDITIF, un appelant qui ne le fournit
    // pas retrouve exactement l'ancien rangement.
    expect(construireGrille([], SEMAINE, [DUCOS])).toEqual([]);
  });
});

/**
 * L'USAGE — l'écran ne peut pas rétrécir la population en silence.
 *
 * Même raisonnement que `personnes-du-planning.test.ts` : la moitié
 * précédente sans celle-ci laisserait un écran juste appeler une fonction
 * juste avec le mauvais argument.
 */
describe("L'USAGE — la vue semaine passe bien le référentiel à la grille", () => {
  const ECRAN = join(process.cwd(), "app/(back-office)/planning/page.tsx");
  const source = () => readFileSync(ECRAN, "utf8");

  it("`construireGrille` est appelée avec `pourTechniciens`", () => {
    // Les espaces et les retours à la ligne sont absorbés : Prettier décide de
    // la mise en forme (§9, 26/08, forme 1) — la borne est la balise JSX qui
    // ferme l'attribut `grille`, jamais une ligne précise.
    const appel = /grille=\{construireGrille\(([\s\S]*?)\)\}/.exec(source());
    expect(appel).not.toBeNull();
    expect(appel![1]).toContain("affichees");
    expect(appel![1]).toContain("pourTechniciens");
  });
});
