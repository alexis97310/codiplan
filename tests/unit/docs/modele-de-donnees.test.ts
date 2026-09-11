import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ecartsModeleDeDonnees,
  tablesDuChapitre11,
  tablesDuSchema,
} from "@/scripts/lib/modele-de-donnees";

import { RACINE } from "../outils/fichiers-source";

/**
 * Q7 — LE CHAPITRE 11 PORTE-T-IL TOUTES LES TABLES QUI EXISTENT ?
 *
 * L'écart signalé était `import_lot_ligne`, prescrite par D15 (rang 1) et
 * absente du chapitre 11 (rang 3). L'exploitation a demandé s'il y en avait
 * d'autres : **il y en avait seize**, toutes au schéma, aucune au chapitre.
 *
 * Ce n'était pas seize décisions manquantes — c'était la même omission seize
 * fois. Le remède est celui de D41 : **renverser la charge, et partir du
 * schéma**, une source que ce gardien ne contrôle pas.
 */

const schema = readFileSync(join(RACINE, "prisma/schema.prisma"), "utf8");
const cahier = readFileSync(join(RACINE, "docs/cahier-des-charges.md"), "utf8");

describe("le chapitre 11 nomme toute table qui existe au schéma", () => {
  it("aucun écart", () => {
    const ecarts = ecartsModeleDeDonnees(schema, cahier);
    expect(ecarts, ecarts.join("\n")).toEqual([]);
  });

  it("TÉMOINS — les deux côtés ont réellement été lus", () => {
    // Un décompte nul ressemble toujours à un sans-faute (§9, 30/08).
    expect(tablesDuSchema(schema).length).toBeGreaterThanOrEqual(28);
    expect(tablesDuChapitre11(cahier).length).toBeGreaterThanOrEqual(30);
    // Et les deux listes ne sont pas la même chose lue deux fois : le chapitre
    // porte des tables du PLAN que le schéma ne connaît pas encore.
    //
    // *Le témoin portait `import_lot_ligne` jusqu'au 11/09/2026, et L1-08e l'a
    // créée.* Il désigne désormais `contrat`, qui vient au lot 4 — et le jour
    // où elle sera créée, c'est ce scénario qui le dira, comme il vient de le
    // faire. **Un témoin qui se périme en le disant est un bon témoin.**
    expect(tablesDuChapitre11(cahier)).toContain("contrat");
    expect(tablesDuSchema(schema)).not.toContain("contrat");
    // Et la table que L1-08e vient de créer est désormais des DEUX côtés.
    expect(tablesDuChapitre11(cahier)).toContain("import_lot_ligne");
    expect(tablesDuSchema(schema)).toContain("import_lot_ligne");
  });

  it("une table du schéma absente du chapitre est un ÉCART", () => {
    const ecarts = ecartsModeleDeDonnees(
      `${schema}\nmodel Nouvelle {\n  id String @id\n  @@map("table_de_demain")\n}\n`,
      cahier,
    );
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("table_de_demain");
    expect(ecarts[0]).toContain("omission");
  });

  it("le SENS INVERSE n'est PAS un écart — et c'est délibéré", () => {
    // Le chapitre décrit le modèle COMPLET, dont la plus grande part n'est pas
    // encore construite. Exiger la réciproque ferait échouer le gardien sur le
    // PLAN, c'est-à-dire sur ce que le chapitre est.
    expect(ecartsModeleDeDonnees(schema, cahier)).toEqual([]);
    // `machine` a QUITTÉ cet exemple au ticket L2-01 : elle existe désormais au
    // schéma. `contrat` la remplace — et le jour où elle existera aussi, ce
    // scénario réclamera son remplaçant plutôt que de passer au vert.
    expect(tablesDuChapitre11(cahier)).toContain("contrat");
    expect(tablesDuSchema(schema)).not.toContain("contrat");
  });

  it("il ÉCHOUE plutôt que de comparer à rien — dans les deux sens", () => {
    expect(ecartsModeleDeDonnees("", cahier)[0]).toContain("aucune table lue");
    expect(ecartsModeleDeDonnees(schema, "# Rien")[0]).toContain(
      "n'a été trouvée",
    );
  });
});
