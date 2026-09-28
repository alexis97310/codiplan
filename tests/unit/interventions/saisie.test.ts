import { describe, expect, it } from "vitest";

import { uuidv7 } from "@/lib/db/uuid";
import { schemaCreation } from "@/lib/interventions/saisie";

/**
 * LA SAISIE DE CRÉATION (PARCOURS-1, 23/09/2026, arbitrage Alexis) :
 *
 * > « Créer demande d'intervention » ne porte ni date, ni technicien — ces
 * > trois valeurs (avec l'heure) n'entrent qu'au geste PLANIFIER, ENSEMBLE.
 * > Elle porte en revanche la panne signalée / le travail demandé,
 * > OBLIGATOIRE, et au plus une machine.
 *
 * **LA DURÉE PRÉVUE EST L'EXCEPTION** (PG-B6-DUREE-A-LA-CREATION, décision
 * QG-12 d'Alexis du 27/09/2026) : facultative, SANS AUCUNE VALEUR PAR DÉFAUT,
 * et elle ne pose ni date, ni heure, ni technicien — PARCOURS-1 tient
 * toujours pour les trois autres.
 */

const BASE = {
  id: uuidv7(),
  client_id: uuidv7(),
  site_id: uuidv7(),
  type: "curatif",
  description: "Le compresseur ne démarre plus.",
};

describe("schemaCreation — ni date, ni technicien (la durée prévue reste facultative, PG-B6)", () => {
  it("accepte le minimum : lieu, nature, panne — rien de plus", () => {
    const resultat = schemaCreation.safeParse(BASE);
    expect(resultat.success).toBe(true);
  });

  it("REFUSE une `description` absente — la panne est OBLIGATOIRE", () => {
    const sansDescription: Record<string, unknown> = { ...BASE };
    delete sansDescription.description;
    const resultat = schemaCreation.safeParse(sansDescription);
    expect(resultat.success).toBe(false);
  });

  it("REFUSE une `description` vide — un texte blanc n'en est pas un", () => {
    const resultat = schemaCreation.safeParse({ ...BASE, description: "   " });
    expect(resultat.success).toBe(false);
  });

  it("REFUSE `date_planifiee`, `creneau_debut` et `technicien_id` — champs INCONNUS depuis PARCOURS-1", () => {
    // `.strict()` : un champ que ce schéma ne porte plus fait échouer TOUTE
    // la saisie, plutôt que de le laisser passer en silence — exactement le
    // contournement qu'un formulaire forgé chercherait (§9, 01/09).
    const resultat = schemaCreation.safeParse({
      ...BASE,
      date_planifiee: new Date(),
      technicien_id: uuidv7(),
    });
    expect(resultat.success).toBe(false);
  });

  it("le contact et la référence client sont FACULTATIFS", () => {
    const resultat = schemaCreation.safeParse({
      ...BASE,
      contact_id: uuidv7(),
      reference_client: "BC-2026-001",
    });
    expect(resultat.success).toBe(true);
  });

  it("au plus UNE machine (arbitrage : « une intervention ne peut pas avoir 2 machines »)", () => {
    const uneSeule = schemaCreation.safeParse({
      ...BASE,
      machine_ids: [uuidv7()],
    });
    expect(uneSeule.success).toBe(true);

    const deux = schemaCreation.safeParse({
      ...BASE,
      machine_ids: [uuidv7(), uuidv7()],
    });
    expect(deux.success).toBe(false);
  });

  it("une même machine nommée deux fois DÉDOUBLONNE avant le plafond — une maladresse, pas un refus", () => {
    const id = uuidv7();
    const resultat = schemaCreation.safeParse({
      ...BASE,
      machine_ids: [id, id],
    });
    expect(resultat.success).toBe(true);
    expect(resultat.success && resultat.data.machine_ids).toEqual([id]);
  });

  it("aucune machine reste le cas ordinaire — le dépannage à l'aveugle", () => {
    const resultat = schemaCreation.safeParse(BASE);
    expect(resultat.success && resultat.data.machine_ids).toEqual([]);
  });

  it("la durée prévue est ABSENTE par défaut — AUCUNE valeur par défaut (QG-12)", () => {
    const resultat = schemaCreation.safeParse(BASE);
    expect(resultat.success && resultat.data.duree_min).toBeNull();
  });

  it("accepte une durée prévue entière et strictement positive", () => {
    const resultat = schemaCreation.safeParse({ ...BASE, duree_min: 90 });
    expect(resultat.success && resultat.data.duree_min).toBe(90);
  });

  it("REFUSE une durée nulle ou négative — jamais inventée", () => {
    const zero = schemaCreation.safeParse({ ...BASE, duree_min: 0 });
    expect(zero.success).toBe(false);
    const negative = schemaCreation.safeParse({ ...BASE, duree_min: -30 });
    expect(negative.success).toBe(false);
  });

  it("REFUSE une durée non entière", () => {
    const resultat = schemaCreation.safeParse({ ...BASE, duree_min: 45.5 });
    expect(resultat.success).toBe(false);
  });

  it("la durée prévue ne pose ni date, ni heure, ni technicien (PARCOURS-1 tient toujours)", () => {
    const resultat = schemaCreation.safeParse({
      ...BASE,
      duree_min: 60,
      date_planifiee: new Date(),
    });
    // `.strict()` refuse `date_planifiee`, exactement comme sans durée —
    // fournir une durée n'ouvre pas la porte aux trois autres champs.
    expect(resultat.success).toBe(false);
  });
});
