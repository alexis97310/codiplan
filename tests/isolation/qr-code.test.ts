import { afterAll, describe, expect, it } from "vitest";

import { avecSociete, fermerClients } from "./setup/db";
import { MACHINE_A1, QR_A1, QR_B1, SOCIETE_A } from "./setup/fixtures";

/**
 * Résolution d'un QR code entre sociétés (L0-05 obligatoire, D22).
 *
 * `qr_token` est unique globalement, mais résoudre une machine par son jeton
 * doit vérifier qu'elle appartient à la société active. Le contrôle serveur de
 * l'endpoint `GET /machines/qr/{token}` arrive au lot 2 ; ici on verrouille le
 * filet base de données qui le sous-tend : sous le contexte d'une autre société,
 * la ligne est invisible, donc la résolution ne peut rien renvoyer à divulguer.
 */
function resoudreQr(societeId: string, token: string) {
  return avecSociete(societeId, (tx) =>
    tx.$queryRawUnsafe<Array<{ id: string; societe_id: string }>>(
      `SELECT "id", "societe_id" FROM "machine" WHERE "qr_token" = $1`,
      token,
    ),
  );
}

describe("résolution QR inter-société", () => {
  afterAll(fermerClients);

  it("refuse le jeton d'une machine appartenant à une autre société", async () => {
    const resultat = await resoudreQr(SOCIETE_A, QR_B1);
    expect(resultat).toHaveLength(0);
  });

  it("résout le jeton d'une machine de sa propre société", async () => {
    const resultat = await resoudreQr(SOCIETE_A, QR_A1);
    expect(resultat).toHaveLength(1);
    expect(resultat[0]?.id).toBe(MACHINE_A1);
    expect(resultat[0]?.societe_id).toBe(SOCIETE_A);
  });
});
