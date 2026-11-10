import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { motifModeleChecklist } from "@/lib/checklists/depot";

/**
 * `motifModeleChecklist` (9K19-CHECKLIST-PARAMETRAGE) — traduit un refus de
 * la base en motif nommé, pour la route `app/api/parametres/checklists/
 * creer/route.ts`. Même technique que `motifModele`/`motifSousType`
 * (`lib/materiel/depot.ts`) : `erreur.message` NOMME la contrainte qui a
 * mordu.
 */
describe("motifModeleChecklist", () => {
  function erreur(
    code: string,
    message: string,
  ): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError(message, {
      code,
      clientVersion: "test",
    });
  }

  it("P2002 — code_pris", () => {
    expect(
      motifModeleChecklist(erreur("P2002", "Unique constraint failed")),
    ).toBe("code_pris");
  });

  it("P2010, contrainte `checklist_modele_un_seul_rattachement` — plus_dun_rattachement", () => {
    expect(
      motifModeleChecklist(
        erreur(
          "P2010",
          'violates check constraint "checklist_modele_un_seul_rattachement"',
        ),
      ),
    ).toBe("plus_dun_rattachement");
  });

  it("P2003, clé `..._sous_type_id_fkey` — sous_type_hors_societe", () => {
    expect(
      motifModeleChecklist(
        erreur(
          "P2003",
          "Foreign key constraint failed: `checklist_modele_societe_id_sous_type_id_fkey`",
        ),
      ),
    ).toBe("sous_type_hors_societe");
  });

  it("P2003, clé `..._famille_id_fkey` — famille_hors_societe", () => {
    expect(
      motifModeleChecklist(
        erreur(
          "P2003",
          "Foreign key constraint failed: `checklist_modele_societe_id_famille_id_fkey`",
        ),
      ),
    ).toBe("famille_hors_societe");
  });

  it("P2003, clé `..._modele_id_fkey` — modele_hors_societe", () => {
    expect(
      motifModeleChecklist(
        erreur(
          "P2003",
          "Foreign key constraint failed: `checklist_modele_societe_id_modele_id_fkey`",
        ),
      ),
    ).toBe("modele_hors_societe");
  });

  it("P2025 — introuvable", () => {
    expect(
      motifModeleChecklist(
        erreur(
          "P2025",
          "An operation failed because it depends on one or more records that were required but not found",
        ),
      ),
    ).toBe("introuvable");
  });

  it("rend `null` sur une erreur ordinaire, sans code Prisma connu", () => {
    expect(motifModeleChecklist(new Error("quelque chose d'autre"))).toBeNull();
  });

  it("rend `null` sur un code Prisma non reconnu par ce motif", () => {
    expect(motifModeleChecklist(erreur("P2016", "autre chose"))).toBeNull();
  });
});
