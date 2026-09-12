import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE } from "../outils/fichiers-source";

/**
 * LES QUATRE ORIGINES D'UNE INFORMATION DE VGP — une liste close, RATIFIÉE,
 * gardée dans les DEUX sens (D114, ratification du 13/09/2026).
 *
 * **Pourquoi un gardien sur celle-ci, et pas sur toutes les énumérations.** Le
 * §1 du protocole réserve ces valeurs à Alexis : c'est du vocabulaire
 * d'exploitation, et il touche à la valeur probante d'une ligne le jour d'un
 * contrôle. Une valeur ajoutée dans un ticket serait donc un arbitrage pris par
 * une session — la faute exacte que les quatre listes closes de I1 existent
 * pour empêcher.
 *
 * **Et le coût n'est pas symétrique**, ce qui rend le second sens le plus
 * important : ajouter une valeur est une migration d'une ligne ; en RETIRER une
 * demande de réécrire le type PostgreSQL, et ce coût tombe à la première ligne
 * réelle. *La fenêtre où une valeur se retire sans peine se referme le jour du
 * premier enregistrement.*
 *
 * **Ce que ce gardien n'est pas** : il ne lit aucune heuristique et ne cherche
 * aucune valeur d'énumération dans la prose — c'est précisément le gardien
 * refusé le 11/09 pour son taux de fausses alertes. Il confronte **une** liste
 * nommée à **un** arbitrage nommé, et son verdict ne s'interprète pas.
 */

const SCHEMA = readFileSync(join(RACINE, "prisma", "schema.prisma"), "utf8");
const ARBITRAGES = readFileSync(
  join(RACINE, "docs", "arbitrages.md"),
  "utf8",
);

/** Les quatre valeurs, dans l'ordre de valeur probante décroissante. */
const RATIFIEES = [
  "rapport_organisme",
  "rapport_transmis_client",
  "vignette_constatee",
  "declaration_client",
] as const;

/** Les valeurs déclarées au schéma — la population vient du dépôt, pas d'ici. */
function valeursDuSchema(): string[] {
  const bloc = SCHEMA.match(/enum OrigineInformationVgp \{([\s\S]*?)\n\}/);
  if (bloc === null) {
    return [];
  }
  return bloc[1]!
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0 && !ligne.startsWith("///"));
}

describe("les origines d'une information de VGP sont celles que D114 ratifie", () => {
  it("le schéma en porte exactement quatre, et ce sont celles-là", () => {
    const observees = valeursDuSchema();

    // TÉMOIN : le bloc a bien été trouvé. Deux listes vides sont égales, et
    // cette égalité-là ne prouverait rien (§9, 10/09).
    expect(
      observees.length,
      "l'énumération `OrigineInformationVgp` est introuvable ou vide dans " +
        "`prisma/schema.prisma` — le gardien n'a rien regardé.",
    ).toBeGreaterThan(0);

    expect(
      observees,
      "les valeurs d'origine d'une VGP appartiennent à Alexis (§1 du " +
        "protocole) : elles sont du vocabulaire d'exploitation et décident de " +
        "la valeur probante d'une ligne le jour d'un contrôle. En ajouter ou " +
        "en retirer une est un ARBITRAGE, jamais une décision de ticket — et " +
        "un retrait coûte la réécriture du type PostgreSQL.",
    ).toEqual([...RATIFIEES]);
  });

  it("l'arbitrage les nomme, et dit qu'elles sont ratifiées", () => {
    // LE SECOND SENS, celui qu'on oublie : la liste du schéma pourrait être
    // juste pendant que l'arbitrage, lui, aurait bougé.
    const bloc = ARBITRAGES.match(
      /## D114[\s\S]*?\n## D115/,
    );
    expect(bloc, "D114 est introuvable dans `docs/arbitrages.md`").not.toBe(
      null,
    );
    expect(bloc![0]).toMatch(/RATIFIÉES/);
    for (const valeur of RATIFIEES) {
      expect(
        bloc![0],
        `D114 ne nomme pas \`${valeur}\` : le schéma et l'arbitrage ne disent ` +
          "plus la même chose.",
      ).toContain(valeur);
    }
  });
});
