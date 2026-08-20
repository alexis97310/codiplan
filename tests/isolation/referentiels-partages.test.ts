import { afterAll, describe, expect, it } from "vitest";

import { avecSociete, clientApp, fermerClients } from "./setup/db";
import {
  MODELE_PLATEFORME,
  MODELE_SURCHARGE_A,
  MODELE_SURCHARGE_B,
  SOCIETE_A,
} from "./setup/fixtures";

/**
 * Référentiels partagés et branche `OR societe_id IS NULL` (L0-04, D4).
 *
 * Les référentiels de plateforme sont lisibles par toutes les sociétés ; une
 * surcharge portant un `societe_id` reste, elle, cloisonnée. C'est le mécanisme
 * « une copie masque l'original » de D4.
 */
describe("référentiels de plateforme", () => {
  afterAll(fermerClients);

  it("`devise` reste lisible sans contexte société (référentiel plateforme)", async () => {
    const devises = await clientApp().devise.findMany({
      select: { code: true },
    });
    const codes = devises.map((d) => d.code).sort();
    expect(codes).toEqual(["EUR", "XPF"]);
  });

  it("la société A voit la ligne plateforme (societe_id NULL) et sa surcharge, jamais celle de B", async () => {
    const modeles = await avecSociete(SOCIETE_A, (tx) =>
      tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "modele_materiel" ORDER BY "id"`,
      ),
    );
    const ids = modeles.map((m) => m.id);
    expect(ids).toContain(MODELE_PLATEFORME);
    expect(ids).toContain(MODELE_SURCHARGE_A);
    expect(ids).not.toContain(MODELE_SURCHARGE_B);
  });
});
