import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE } from "./outils/fichiers-source";

const SEED = readFileSync(join(RACINE, "prisma", "seed.ts"), "utf8");

/**
 * LE SEMIS ÉCRIT DES COMPTES, ET IL N'EN MOTIVE AUCUN (R1-09).
 *
 * ## Ce que ce gardien garde, et pourquoi il a fallu l'écrire
 *
 * `docs/mise-en-ligne.md` §5.1 affirmait : *« `prisma/seed.ts` n'écrit toujours
 * **aucune ligne de `compte`** »*. **C'était faux depuis le commit `62bf554`**
 * — `poserLeMoyenDeConnexionAuRepos` appelle `compte.create`, pour les quatre
 * identités internes et pour le compte de portail.
 *
 * *Et la phrase fausse coûtait une demi-journée à qui la suivait* : elle
 * envoyait créer une base de production, y déposer deux secrets et amorcer une
 * société — pour un écran qu'on ouvre sans rien de tout cela, la réémission du
 * jeton de premier accès n'exigeant que trois choses que ces identités
 * remplissent déjà.
 *
 * ## CE QUI RENDRAIT LA NOUVELLE PHRASE FAUSSE À SON TOUR
 *
 * La note dit maintenant : *« le semis écrit des lignes de `compte`, et n'y
 * pose AUCUN mot de passe »*. **Ce qui la renverserait est une empreinte de mot
 * de passe écrite par le semis** — et ce serait grave bien au-delà d'une note :
 *
 * - le cliquet de D65 lit un FAIT, `mot_de_passe IS NULL`. Une empreinte semée
 *   **fermerait la réémission pour toujours**, sur des comptes que personne
 *   n'aurait ouverts ;
 * - *la base est en ligne et le dépôt est PUBLIC* : un mot de passe semé serait
 *   un mot de passe connu de tous (I9).
 *
 * *Une note qui vient d'être corrigée est le meilleur endroit pour poser ce qui
 * dira qu'elle est redevenue fausse* — sans quoi on aura réparé une phrase et
 * laissé le mécanisme qui l'avait rendue fausse.
 */
describe("le semis n'écrit aucun mot de passe (R1-09, D65, I9)", () => {
  it("il écrit bien des lignes de `compte` — sinon ce gardien ne garde rien", () => {
    // TÉMOIN, et il est l'exact renversement de la phrase qu'on corrige : si le
    // semis cessait d'écrire des comptes, l'assertion suivante serait verte sur
    // une absence, et la note redeviendrait fausse dans l'AUTRE sens.
    expect(SEED).toMatch(/compte\.create\(/);
  });

  it("et il n'y pose que `null`", () => {
    const poses = [...SEED.matchAll(/mot_de_passe\s*:\s*([^,\n}]+)/g)].map(
      (m) => m[1]!.trim(),
    );

    expect(
      poses.length,
      "aucune pose de `mot_de_passe` trouvée dans le semis : le gardien n'a " +
        "rien regardé, ou la colonne a changé de nom.",
    ).toBeGreaterThan(0);

    for (const pose of poses) {
      expect(
        pose,
        "le semis pose un mot de passe. Deux conséquences, et la première " +
          "est la plus grave : le cliquet de D65 lit `mot_de_passe IS NULL`, " +
          "et une empreinte semée FERMERAIT la réémission du jeton de premier " +
          "accès pour toujours, sur des comptes que personne n'a ouverts. " +
          "Ensuite seulement : la base est en ligne et le dépôt est PUBLIC (I9).",
      ).toBe("null");
    }
  });
});
