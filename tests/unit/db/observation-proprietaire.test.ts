import { readFileSync } from "node:fs";
import { join } from "node:path";

import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ecartsObservationProprietaire,
  messageObservation,
} from "../../../scripts/lib/observation-proprietaire";

/**
 * LE HARNAIS NE PROUVE PAS UN CLOISONNEMENT SOUS DES PRIVILÈGES QUE LA
 * PRODUCTION N'A PAS (ticket L1-02d).
 *
 * Faute symétrique de celle que L1-02b a fermée. Là, le harnais ARMAIT une
 * garantie que la production n'armait pas ; ici, il la MESURERAIT sous une
 * identité que la production n'a pas — le propriétaire du schéma, qui est même
 * superutilisateur sur la base jetable.
 */

const RACINE = process.cwd();

function fichiersIsolation(): string[] {
  return globSync("tests/isolation/**/*.test.ts", { cwd: RACINE }).sort();
}

describe("aucune assertion de vacuité sous le propriétaire", () => {
  it("n'observe aucun écart dans les scénarios d'isolation", () => {
    const fichiers = fichiersIsolation();
    // TÉMOIN DE NON-VACUITÉ : zéro fichier parcouru serait un sans-faute
    // imaginaire (§9, 30/08).
    expect(fichiers.length).toBeGreaterThan(20);

    const ecarts = fichiers.flatMap((fichier) =>
      ecartsObservationProprietaire(
        fichier,
        readFileSync(join(RACINE, fichier), "utf8"),
      ),
    );

    expect(
      ecarts.map(messageObservation),
      ecarts.map(messageObservation).join("\n"),
    ).toEqual([]);
  });

  it("JUMEAU — il mord sur la faute telle qu'elle s'écrirait", () => {
    // La forme exacte que ce dépôt portait avant L1-02d, Prettier compris.
    const faute = `
      await expect(
        clientOwner().session.findMany({ where: { utilisateur_id: id } }),
      ).resolves.toHaveLength(0);
    `;
    const ecarts = ecartsObservationProprietaire("fabriqué.test.ts", faute);
    expect(ecarts).toHaveLength(1);
    expect(messageObservation(ecarts[0]!)).toContain("PROPRIÉTAIRE");
  });

  it("… et sur l'AUTRE nom, celui qui a l'air d'être en règle", () => {
    // `observerSousProprietaire` oblige à écrire une raison ; elle n'autorise
    // pas pour autant à conclure une vacuité. Un gardien qui ne reconnaîtrait
    // que `clientOwner` laisserait passer la forme la plus probable — celle
    // qu'écrirait quelqu'un qui a lu la règle à moitié.
    const faute = `
      const journal = observerSousProprietaire("une raison suffisamment longue")
        .journalAcces.findMany({ where: { utilisateur_id: id } });
      expect(await observerSousProprietaire("une raison suffisamment longue").journalAcces.findMany({}), "x").toHaveLength(0);
      void journal;
    `;
    expect(
      ecartsObservationProprietaire("fabriqué.test.ts", faute),
    ).toHaveLength(1);
  });

  it("NE MORD PAS sur les catalogues — ils ne sont pas cloisonnés", () => {
    // La contre-épreuve. « Aucune politique de suppression n'existe » est une
    // assertion de vacuité légitime, et c'est le propriétaire qui doit la lire.
    const licite = `
      const [politique] = await clientOwner().$queryRawUnsafe(
        "SELECT count(*) AS n FROM pg_policies WHERE tablename = 'second_facteur'",
      );
      expect(Number(politique?.n)).toBe(0);
    `;
    expect(ecartsObservationProprietaire("fabriqué.test.ts", licite)).toEqual(
      [],
    );
  });

  it("NE MORD PAS sur une assertion faite sous le rôle applicatif", () => {
    const licite = `expect(await clientApp().session.findMany({})).toHaveLength(0);`;
    expect(ecartsObservationProprietaire("fabriqué.test.ts", licite)).toEqual(
      [],
    );
  });
});
