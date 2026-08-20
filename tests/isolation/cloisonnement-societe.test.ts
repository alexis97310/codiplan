import { afterAll, describe, expect, it } from "vitest";

import { avecSociete, clientApp, fermerClients } from "./setup/db";
import { AGENCE_B, SOCIETE_A, SOCIETE_B } from "./setup/fixtures";

/**
 * Cloisonnement des tables portant `societe_id` (L0-04, L0-05, D4, I1).
 *
 * Tous les scénarios passent par le rôle applicatif restreint (voir setup/db) :
 * les politiques RLS mordent réellement. Lecture, écriture et suppression sont
 * tentées depuis une autre société.
 */
describe("cloisonnement société", () => {
  afterAll(fermerClients);

  it("sans contexte société, `agence` ne renvoie aucune ligne (table cloisonnée)", async () => {
    const agences = await clientApp().agence.findMany();
    expect(agences).toHaveLength(0);
  });

  it("sans contexte société, `societe` ne renvoie aucune ligne", async () => {
    const societes = await clientApp().societe.findMany();
    expect(societes).toHaveLength(0);
  });

  it("la société A ne lit que ses propres agences", async () => {
    const agences = await avecSociete(SOCIETE_A, (tx) =>
      tx.agence.findMany({ select: { id: true, societe_id: true } }),
    );
    expect(agences).toHaveLength(1);
    expect(agences[0]?.societe_id).toBe(SOCIETE_A);
  });

  it("la société A ne voit pas l'agence de la société B", async () => {
    const trouvee = await avecSociete(SOCIETE_A, (tx) =>
      tx.agence.findUnique({ where: { id: AGENCE_B } }),
    );
    expect(trouvee).toBeNull();
  });

  it("la société A ne peut pas créer une agence pour la société B (WITH CHECK)", async () => {
    await expect(
      avecSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "agence" ("id", "societe_id", "code", "libelle")
           VALUES ('aaaaaaaa-0000-7000-8000-0000000000ff', $1, 'PIRATE', 'Pirate')`,
          SOCIETE_B,
        ),
      ),
    ).rejects.toThrow();
  });

  it("la société A ne peut pas modifier une agence de la société B", async () => {
    const lignesAffectees = await avecSociete(SOCIETE_A, (tx) =>
      tx.$executeRawUnsafe(
        `UPDATE "agence" SET "libelle" = 'détournée' WHERE "id" = $1`,
        AGENCE_B,
      ),
    );
    expect(lignesAffectees).toBe(0);
  });

  it("la société A ne peut pas supprimer une agence de la société B", async () => {
    const lignesAffectees = await avecSociete(SOCIETE_A, (tx) =>
      tx.$executeRawUnsafe(`DELETE FROM "agence" WHERE "id" = $1`, AGENCE_B),
    );
    expect(lignesAffectees).toBe(0);
    // Contrôle : l'agence B est toujours là, vue depuis son propre contexte.
    const toujoursLa = await avecSociete(SOCIETE_B, (tx) =>
      tx.agence.findUnique({ where: { id: AGENCE_B } }),
    );
    expect(toujoursLa?.id).toBe(AGENCE_B);
  });

  it("la société A ne voit pas les habilitations (`utilisateur_societe`) de la société B", async () => {
    const habilitations = await avecSociete(SOCIETE_A, (tx) =>
      tx.utilisateurSociete.findMany({ select: { societe_id: true } }),
    );
    expect(habilitations.length).toBeGreaterThan(0);
    expect(habilitations.every((h) => h.societe_id === SOCIETE_A)).toBe(true);
  });

  it("la société A ne voit pas les rattachements portail (`utilisateur_client`) de la société B", async () => {
    const rattachements = await avecSociete(SOCIETE_A, (tx) =>
      tx.utilisateurClient.findMany({ select: { societe_id: true } }),
    );
    expect(rattachements.length).toBeGreaterThan(0);
    expect(rattachements.every((r) => r.societe_id === SOCIETE_A)).toBe(true);
  });

  it("sur `societe`, la société A ne voit qu'elle-même", async () => {
    const societes = await avecSociete(SOCIETE_A, (tx) =>
      tx.societe.findMany({ select: { id: true } }),
    );
    expect(societes).toHaveLength(1);
    expect(societes[0]?.id).toBe(SOCIETE_A);
  });
});
