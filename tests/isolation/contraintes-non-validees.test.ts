import { afterAll, describe, expect, it } from "vitest";

import {
  CONTRAINTES_NON_VALIDEES,
  SQL_CONTRAINTES,
  ecartsContraintesNonValidees,
  type ContrainteObservee,
} from "../../scripts/lib/contraintes-non-validees";
import { clientOwner, fermerClients } from "./setup/db";

/**
 * LA PREUVE PAR LECTURE, sur la base RÉELLEMENT MIGRÉE (D104).
 *
 * Les scénarios unitaires éprouvent la RÈGLE sur des états fabriqués ; celui-ci
 * la confronte à ce que les migrations du dépôt produisent vraiment. *Un
 * contrôle qui n'échoue jamais là où les autres échouent déjà ne prouve rien*
 * (§9, 07/09) — et celui-ci regarde un endroit qu'aucun autre ne regarde :
 * l'état `convalidated` que les 47 migrations laissent derrière elles.
 *
 * **Il tourne à chaque `pnpm verify`**, quand la veille ne tourne que la nuit et
 * seulement contre la base hébergée. Une contrainte `NOT VALID` posée dans une
 * migration écrite demain rougit donc AVANT d'être fusionnée, et non la nuit
 * d'après.
 *
 * La lecture se fait sous le PROPRIÉTAIRE, et c'est licite : `pg_constraint`
 * est un catalogue, aucune politique ne s'y applique, et il n'y a ici ni ligne
 * métier ni cloisonnement à mesurer.
 */

afterAll(fermerClients);

describe("contraintes NOT VALID de la base migrée", () => {
  it("celles que la base porte sont exactement celles que le dépôt déclare", async () => {
    const observees =
      await clientOwner().$queryRawUnsafe<ContrainteObservee[]>(
        SQL_CONTRAINTES,
      );

    // TÉMOIN : la requête a-t-elle lu quelque chose ? Une liste vide rendrait
    // un vert sur n'importe quelle déclaration — *un décompte nul ressemble
    // toujours à un sans-faute* (§9, 30/08).
    expect(observees.length).toBeGreaterThan(50);

    expect(ecartsContraintesNonValidees(observees)).toEqual([]);
  });

  it("les deux contraintes de D104 sont réellement NON VALIDÉES en base", async () => {
    const observees =
      await clientOwner().$queryRawUnsafe<ContrainteObservee[]>(
        SQL_CONTRAINTES,
      );

    for (const attendue of CONTRAINTES_NON_VALIDEES) {
      const trouvee = observees.find(
        (c) =>
          c.table === attendue.table && c.contrainte === attendue.contrainte,
      );
      expect(
        trouvee,
        `${attendue.contrainte} absente de la base`,
      ).toBeDefined();
      expect(trouvee?.validee, `${attendue.contrainte} est VALIDÉE`).toBe(
        false,
      );
    }
  });

  // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09). Les deux
  // AUTRES contraintes de la même migration sont posées VALIDÉES, et c'est
  // mesuré : `piece_attendue_ref` et `date_dispo_prevue` naissent nulles
  // partout, donc les deux équivalences sont vraies de toute ligne existante.
  // Les avoir posées NOT VALID « pour faire pareil » aurait affaibli sans
  // cause, et ce scénario le verrait.
  it("les deux autres contraintes de la même migration sont VALIDÉES", async () => {
    const observees =
      await clientOwner().$queryRawUnsafe<ContrainteObservee[]>(
        SQL_CONTRAINTES,
      );

    for (const nom of [
      "intervention_piece_attendue_a_son_horizon",
      "intervention_piece_attendue_suppose_la_suspension",
    ]) {
      const trouvee = observees.find(
        (c) => c.table === "intervention" && c.contrainte === nom,
      );
      expect(trouvee, `${nom} absente`).toBeDefined();
      expect(trouvee?.validee, `${nom} est NON VALIDÉE`).toBe(true);
    }
  });
});
