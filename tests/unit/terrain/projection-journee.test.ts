import { describe, expect, it } from "vitest";

import type { LignePlanning } from "@/lib/interventions/depot";
import {
  projeterLigneJournee,
  type LigneJourneeAffichee,
} from "@/lib/terrain/projection-journee";

/**
 * LA PROJECTION VERS LA CARTE NE PORTE AUCUN MONTANT, AUCUN TEMPS, AUCUN
 * CHAMP INTERNE (9F4H5B-JOURNEE-SANS-MONTANT, point 1) — voir le docblock de
 * `lib/terrain/projection-journee.ts`. `tests/unit/terrain/sans-montant.test.ts`
 * prouve que l'ÉCRAN ne compose pas ces marques dans son JSX ; ce fichier
 * prouve la chose en amont, sur la FONCTION elle-même, avec une ligne
 * COMPLÈTE (tous les champs de `CHAMPS_LIGNE`) en entrée — la seule façon de
 * garantir qu'un champ ajouté demain à `CHAMPS_LIGNE` ne traverse pas cette
 * porte par défaut (une liste FERMÉE de champs à inclure, jamais une liste
 * ouverte de champs à exclure un par un, §9 01/09).
 */

const LIGNE_COMPLETE: LignePlanning = {
  id: "0199999-0000-7000-8000-000000000001",
  numero: 42,
  annee: 2026,
  statut: "affectee",
  type: "curatif",
  priorite: "p2",
  date_planifiee: new Date("2026-10-22T00:00:00.000Z"),
  creneau_debut: new Date("2026-10-22T20:00:00.000Z"),
  creneau_fin: new Date("2026-10-22T21:00:00.000Z"),
  duree_estimee_min: 60,
  technicien_id: "0199999-0000-7000-8000-000000000002",
  client_id: "0199999-0000-7000-8000-000000000003",
  site_id: "0199999-0000-7000-8000-000000000004",
  agence_id: "0199999-0000-7000-8000-000000000005",
  description: "Fuite d'huile constatée.\nRevoir le joint.",
  contact_id: "0199999-0000-7000-8000-000000000006",
  reference_client: "REF-CLIENT-SECRETE",
  demande_id: null,
  mode_valorisation: "forfait",
  forfait_deplacement_id: "0199999-0000-7000-8000-000000000007",
  temps_mesure_min: 55,
  temps_valide_min: 50,
  montant_ht: BigInt(123456),
  devise_code: "XPF",
  motif_annulation: null,
  motif_suspension: null,
  piece_attendue_ref: null,
  date_dispo_prevue: null,
  suspendue_le: null,
  machines: [{ machine_id: "0199999-0000-7000-8000-000000000008" }],
  vue_technicien_le: null,
  client: { raison_sociale: "CODIMA" },
  site: { libelle: "Atelier Ducos", commune: "Nouméa" },
  cree_le: new Date("2026-10-01T00:00:00.000Z"),
  deplanifiee_date: null,
};

const CLES_INTERDITES = [
  "montant_ht",
  "devise_code",
  "mode_valorisation",
  "temps_mesure_min",
  "temps_valide_min",
  "forfait_deplacement_id",
  "contact_id",
  "reference_client",
  "motif_annulation",
  "motif_suspension",
];

/** Toutes les clés d'un objet, récursivement — pour n'en manquer aucune à aucun niveau. */
function toutesLesCles(valeur: unknown): readonly string[] {
  if (valeur === null || typeof valeur !== "object") {
    return [];
  }
  const ici = Object.keys(valeur);
  const profondeur = Object.values(valeur).flatMap((v) => toutesLesCles(v));
  return [...ici, ...profondeur];
}

describe("projeterLigneJournee — n'emporte aucun champ de montant, de temps ou interne", () => {
  const libellesMachines = new Map([
    ["0199999-0000-7000-8000-000000000008", "Atlas Copco GA-11"],
  ]);
  const projection = projeterLigneJournee(LIGNE_COMPLETE, libellesMachines);

  it("aucune des clés interdites n'apparaît, à aucun niveau", () => {
    const cles = toutesLesCles(projection);
    for (const interdite of CLES_INTERDITES) {
      expect(cles, `la clé « ${interdite} »`).not.toContain(interdite);
    }
  });

  it("ne porte que ce que la carte affiche", () => {
    const attendu: LigneJourneeAffichee = {
      id: "0199999-0000-7000-8000-000000000001",
      statut: "affectee",
      type: "curatif",
      priorite: "p2",
      creneau_debut: LIGNE_COMPLETE.creneau_debut,
      creneau_fin: LIGNE_COMPLETE.creneau_fin,
      vue_technicien_le: null,
      client: { raison_sociale: "CODIMA" },
      site: { libelle: "Atelier Ducos" },
      panneResume: "Fuite d'huile constatée.",
      machinesLibelle: "Atlas Copco GA-11",
      // `date_planifiee` tombe un jeudi (2026-10-22T00:00:00Z, UTC) : voir
      // `jourEtDateAbregee`, `lib/interventions/presentation-partagee.ts`.
      enRetardPrevueLibelle: "jeu. 22/10",
    };
    expect(projection).toEqual(attendu);
  });

  it("sans machine affectée, machinesLibelle est nul plutôt que le signe d'absence", () => {
    const sansMachine = projeterLigneJournee(
      { ...LIGNE_COMPLETE, machines: [] },
      libellesMachines,
    );
    expect(sansMachine.machinesLibelle).toBeNull();
  });

  it("sans date planifiée, enRetardPrevueLibelle est nul", () => {
    const sansDate = projeterLigneJournee(
      { ...LIGNE_COMPLETE, date_planifiee: null },
      libellesMachines,
    );
    expect(sansDate.enRetardPrevueLibelle).toBeNull();
  });
});
