import { describe, expect, it } from "vitest";

import { uuidv7 } from "@/lib/db/uuid";
import { schemaCreation } from "@/lib/interventions/saisie";

/**
 * LA SAISIE DE CRÉATION (PARCOURS-1, 23/09/2026, arbitrage Alexis) :
 *
 * > « Créer demande d'intervention » ne porte ni date, ni technicien, ni durée
 * > — ces quatre valeurs n'entrent qu'au geste PLANIFIER. Elle porte en
 * > revanche la panne signalée / le travail demandé, OBLIGATOIRE, et au plus
 * > une machine.
 */

const BASE = {
  id: uuidv7(),
  client_id: uuidv7(),
  site_id: uuidv7(),
  type: "curatif",
  description: "Le compresseur ne démarre plus.",
};

describe("schemaCreation — ni date, ni technicien, ni durée", () => {
  it("accepte le minimum : lieu, nature, panne — rien de plus", () => {
    const resultat = schemaCreation.safeParse(BASE);
    expect(resultat.success).toBe(true);
  });

  it("REFUSE une `description` absente — la panne est OBLIGATOIRE", () => {
    const { description: _description, ...sansDescription } = BASE;
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
});
