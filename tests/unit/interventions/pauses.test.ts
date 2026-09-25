import { describe, expect, it } from "vitest";

import { chronologieDeLaFiche } from "@/app/(back-office)/interventions/presentation";
import { schemaNoteInterne } from "@/lib/interventions/saisie";

/**
 * LES PAUSES — OUVRIR, FERMER (50-INTERVENTIONS-2, SAV-09).
 *
 * Ce module est PUR : il n'ouvre aucune base. « Jamais deux pauses ouvertes »
 * est un invariant de la BASE (l'index partiel `intervention_pause_une_seule_ouverte`
 * de la migration) et du dépôt (`suspendreIntervention` refuse déjà une
 * seconde suspension, `peutSuspendre`, `tests/unit/interventions/suspension.test.ts`)
 * — `tests/isolation/intervention-pause.test.ts` le confronte à la vraie
 * base. Ce fichier éprouve ce qui EST pur ici : la composition de la
 * chronologie depuis une liste de pauses, et la saisie de la note interne.
 */

const UUID = "01a09000-0000-7000-8000-000000000001";

describe("chronologieDeLaFiche : ouvrir produit un évènement, fermer en ajoute un second", () => {
  const creeLe = new Date("2026-09-01T08:00:00.000Z");

  it("une pause FERMÉE produit DEUX évènements, dans l'ordre chronologique", () => {
    const evenements = chronologieDeLaFiche({
      creeLe,
      pauses: [
        {
          debut: new Date("2026-09-02T09:00:00.000Z"),
          fin: new Date("2026-09-03T09:00:00.000Z"),
        },
      ],
      clotureeLe: null,
      annuleeLe: null,
    });
    expect(evenements.map((e) => e.cle)).toEqual([
      "intervention.chronologie.creation",
      "intervention.chronologie.suspension",
      "intervention.chronologie.reprise",
    ]);
  });

  it("une pause ENCORE OUVERTE ne produit QUE l'évènement d'ouverture — jamais une fermeture inventée", () => {
    const evenements = chronologieDeLaFiche({
      creeLe,
      pauses: [{ debut: new Date("2026-09-02T09:00:00.000Z"), fin: null }],
      clotureeLe: null,
      annuleeLe: null,
    });
    expect(evenements.map((e) => e.cle)).toEqual([
      "intervention.chronologie.creation",
      "intervention.chronologie.suspension",
    ]);
  });

  it("DEUX pauses successives (SAV-09) restent TOUTES DEUX lisibles", () => {
    // *« 2 pauses successives restent lisibles »* — c'est très exactement ce
    // que les quatre colonnes réécrites de `intervention` ne pouvaient pas
    // montrer, et la raison d'être de cette table.
    const evenements = chronologieDeLaFiche({
      creeLe,
      pauses: [
        {
          debut: new Date("2026-09-02T09:00:00.000Z"),
          fin: new Date("2026-09-03T09:00:00.000Z"),
        },
        {
          debut: new Date("2026-09-05T09:00:00.000Z"),
          fin: new Date("2026-09-06T09:00:00.000Z"),
        },
      ],
      clotureeLe: null,
      annuleeLe: null,
    });
    expect(evenements.map((e) => e.cle)).toEqual([
      "intervention.chronologie.creation",
      "intervention.chronologie.suspension",
      "intervention.chronologie.reprise",
      "intervention.chronologie.suspension",
      "intervention.chronologie.reprise",
    ]);
    // Triée du plus ancien au plus récent, quel que soit l'ordre de saisie —
    // ici l'appelant les fournit déjà dans l'ordre, mais l'ordre RENDU vient
    // du TRI, jamais de l'ordre du tableau reçu.
    const instants = evenements.map((e) => e.instant.getTime());
    expect(instants).toEqual([...instants].sort((a, b) => a - b));
  });

  it("clôture et annulation s'ajoutent à leur place, dans le temps", () => {
    const evenements = chronologieDeLaFiche({
      creeLe,
      pauses: [],
      clotureeLe: new Date("2026-09-10T09:00:00.000Z"),
      annuleeLe: null,
    });
    expect(evenements.map((e) => e.cle)).toEqual([
      "intervention.chronologie.creation",
      "intervention.chronologie.cloture",
    ]);
  });

  it("un ordre de saisie DÉSORDONNÉ est reclassé — c'est le tri qui décide, jamais l'ordre reçu", () => {
    const evenements = chronologieDeLaFiche({
      creeLe: new Date("2026-09-10T08:00:00.000Z"),
      pauses: [
        {
          debut: new Date("2026-09-01T09:00:00.000Z"),
          fin: new Date("2026-09-01T10:00:00.000Z"),
        },
      ],
      clotureeLe: null,
      annuleeLe: null,
    });
    // La pause, antérieure à `creeLe` dans ce scénario forgé, passe pourtant
    // en tête : le tri ne présuppose rien sur l'ordre d'arrivée des faits.
    expect(evenements[0]?.cle).toBe("intervention.chronologie.suspension");
  });

  it("cas normal — aucun fait daté n'est antérieur à `creeLe` : l'évènement reste « Créée »", () => {
    const evenements = chronologieDeLaFiche({
      creeLe,
      pauses: [],
      clotureeLe: new Date("2026-09-10T09:00:00.000Z"),
      annuleeLe: null,
    });
    expect(evenements.map((e) => e.cle)).toEqual([
      "intervention.chronologie.creation",
      "intervention.chronologie.cloture",
    ]);
  });

  it("fiche REPRISE D'UN IMPORT (audit du 25/09, constat 22) — la clôture précède `creeLe`, l'évènement de création se nomme « enregistrement » et reste DERNIER dans la liste", () => {
    const evenements = chronologieDeLaFiche({
      creeLe: new Date("2026-09-22T08:00:00.000Z"),
      pauses: [],
      clotureeLe: new Date("2026-08-19T09:00:00.000Z"),
      annuleeLe: null,
    });
    expect(evenements.map((e) => e.cle)).toEqual([
      "intervention.chronologie.cloture",
      "intervention.chronologie.enregistrement",
    ]);
  });
});

describe("la note interne : une case vide REMET à null (§9, même régime que commentaire_technicien)", () => {
  it("un texte est accepté tel quel", () => {
    const saisie = schemaNoteInterne.parse({
      intervention_id: UUID,
      note_interne: "Client difficile, prévenir avant de passer.",
    });
    expect(saisie.note_interne).toBe(
      "Client difficile, prévenir avant de passer.",
    );
  });

  it("une chaîne vide devient null — jamais une chaîne vide qui se confondrait avec un texte vide", () => {
    const saisie = schemaNoteInterne.parse({
      intervention_id: UUID,
      note_interne: "",
    });
    expect(saisie.note_interne).toBeNull();
  });

  it("des espaces seuls deviennent null aussi", () => {
    const saisie = schemaNoteInterne.parse({
      intervention_id: UUID,
      note_interne: "   ",
    });
    expect(saisie.note_interne).toBeNull();
  });

  it("l'absence du champ vaut null par défaut", () => {
    const saisie = schemaNoteInterne.parse({ intervention_id: UUID });
    expect(saisie.note_interne).toBeNull();
  });
});
