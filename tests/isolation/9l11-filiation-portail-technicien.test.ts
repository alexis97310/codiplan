import { afterAll, describe, expect, it } from "vitest";

import {
  SQL_COLONNE_NOM_TECHNICIEN_AFFICHE,
  TABLE_PORTAIL_FILIATION,
  POLITIQUE_PORTAIL_FILIATION_RETIREE,
  ecartsNomTechnicienAfficheObligatoire,
  ecartsPolitiquePortailFiliationRetiree,
  type ColonneNomTechnicienAffiche,
} from "../../scripts/lib/filiation-portail-technicien";
import {
  SQL_POLITIQUES,
  type PolitiqueObservee,
} from "../../scripts/lib/politiques-rls";
import { clientOwner, fermerClients } from "./setup/db";

/**
 * Décision d'Alexis du 10/11/2026 (9J22A) — la politique retirée (9J22,
 * `utilisateur_lecture_filiation_portail`) ne doit pas revenir, et la colonne
 * de recopie qui l'a remplacée (`segment_travail.nom_technicien_affiche`)
 * doit rester `NOT NULL`.
 *
 * Même protocole que `politiques-rls.test.ts` : chaque refus a son jumeau —
 * la faute est ÉCRITE dans une transaction ANNULÉE (le DDL est transactionnel
 * en PostgreSQL), le contrôle est éprouvé dessus, puis la transaction est
 * défaite. La base de test migrée n'en garde aucune trace.
 */

class Annulation extends Error {}

async function sousLaFaute<T>(
  faute: readonly string[],
  observer: (tx: {
    $queryRawUnsafe: <U>(sql: string) => Promise<U>;
  }) => Promise<T>,
): Promise<T> {
  let observation: T | undefined;

  try {
    await clientOwner().$transaction(async (tx) => {
      for (const instruction of faute) {
        await tx.$executeRawUnsafe(instruction);
      }
      observation = await observer(tx);
      throw new Annulation();
    });
  } catch (erreur) {
    if (!(erreur instanceof Annulation)) {
      throw erreur;
    }
  }

  if (observation === undefined) {
    throw new Error("la transaction d'épreuve n'a rien observé.");
  }
  return observation;
}

function lirePolitiques(client: {
  $queryRawUnsafe: <T>(sql: string) => Promise<T>;
}): Promise<PolitiqueObservee[]> {
  return client.$queryRawUnsafe<PolitiqueObservee[]>(SQL_POLITIQUES);
}

function lireColonne(client: {
  $queryRawUnsafe: <T>(sql: string) => Promise<T>;
}): Promise<ColonneNomTechnicienAffiche[]> {
  return client.$queryRawUnsafe<ColonneNomTechnicienAffiche[]>(
    SQL_COLONNE_NOM_TECHNICIEN_AFFICHE,
  );
}

describe("la brèche de 9J22, refermée par 9J22A, reste fermée (décision d'Alexis du 10/11/2026)", () => {
  afterAll(fermerClients);

  it("sur la base migrée : la politique retirée est absente", async () => {
    const politiques = await lirePolitiques(clientOwner());
    expect(ecartsPolitiquePortailFiliationRetiree(politiques)).toEqual([]);
  });

  it("sur la base migrée : la colonne de recopie est NOT NULL", async () => {
    const colonnes = await lireColonne(clientOwner());
    expect(ecartsNomTechnicienAfficheObligatoire(colonnes)).toEqual([]);
  });

  it("JUMEAU : la politique recréée à la main est vue", async () => {
    const ecarts = await sousLaFaute(
      [
        `CREATE POLICY "${POLITIQUE_PORTAIL_FILIATION_RETIREE}" ` +
          `ON "${TABLE_PORTAIL_FILIATION}" FOR SELECT USING (true)`,
      ],
      async (tx) => {
        const politiques = await lirePolitiques(tx);
        // LA SONDE : la faute a-t-elle réellement eu lieu ?
        expect(
          politiques.some(
            (p) =>
              p.table === TABLE_PORTAIL_FILIATION &&
              p.nom === POLITIQUE_PORTAIL_FILIATION_RETIREE,
          ),
        ).toBe(true);
        return ecartsPolitiquePortailFiliationRetiree(politiques);
      },
    );
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain(POLITIQUE_PORTAIL_FILIATION_RETIREE);
  });

  it("après l'annulation : la politique a disparu de nouveau", async () => {
    const politiques = await lirePolitiques(clientOwner());
    expect(ecartsPolitiquePortailFiliationRetiree(politiques)).toEqual([]);
  });

  it("JUMEAU : la colonne desserrée (DROP NOT NULL) à la main est vue", async () => {
    const ecarts = await sousLaFaute(
      [
        'ALTER TABLE "segment_travail" ALTER COLUMN "nom_technicien_affiche" DROP NOT NULL',
      ],
      async (tx) => {
        const colonnes = await lireColonne(tx);
        // LA SONDE : la faute a-t-elle réellement eu lieu ?
        expect(colonnes[0]?.obligatoire).toBe(false);
        return ecartsNomTechnicienAfficheObligatoire(colonnes);
      },
    );
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("NOT NULL");
  });

  it("après l'annulation : la colonne est de nouveau NOT NULL", async () => {
    const colonnes = await lireColonne(clientOwner());
    expect(ecartsNomTechnicienAfficheObligatoire(colonnes)).toEqual([]);
  });
});
