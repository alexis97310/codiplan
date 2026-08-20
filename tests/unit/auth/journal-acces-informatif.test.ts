import { describe, expect, it } from "vitest";

import { fichiersSource } from "../outils/fichiers-source";

/**
 * `journal_acces.societe_id_source` et `societe_id_cible` sont INFORMATIVES
 * (arbitrage D34, ticket L0-06b).
 *
 * **Ce qu'elles servent.** Répondre à « qui a tenté d'accéder à mes données ».
 * Une bascule refusée de A vers B ne se range ni sous A ni sous B ; sans ces
 * deux colonnes, la trace existe mais ne dit pas d'où venait la tentative ni où
 * elle allait, et la question reste sans réponse.
 *
 * **Ce qu'elles ne servent JAMAIS.** À filtrer. `journal_acces` est une table
 * technique d'authentification : elle n'est pas soumise au cloisonnement, et
 * elle ne le sera pas — un journal qui enjambe les sociétés ne peut pas être
 * rangé sous l'une d'elles. Le danger est donc précis : une requête applicative
 * qui filtrerait sur `societe_id_cible` donnerait l'apparence d'un journal
 * cloisonné là où il n'y a aucune politique pour le garantir. Le premier écran
 * écrit sur cette base serait faux, et il aurait l'air juste.
 *
 * D'où ce gardien : les deux colonnes s'ÉCRIVENT, elles ne se cherchent pas.
 * Il se lit en parcourant le dépôt, comme les deux autres gardiens statiques du
 * ticket L0-06.
 */
const REPERTOIRES = ["app", "components", "lib", "prisma", "scripts"];

/** Les deux colonnes informatives, en camelCase Prisma comme en snake_case SQL. */
const COLONNES = /societe_?[Ii]d_?(?:[Ss]ource|[Cc]ible)/;

/**
 * Extrait les blocs `where: { … }` d'un fichier, accolades appariées.
 *
 * Un `indexOf` suivi d'un `indexOf("}")` s'arrêterait à la première accolade
 * fermante venue, c'est-à-dire au milieu du premier filtre imbriqué. On compte
 * donc les accolades — c'est la seule façon de couvrir un `where` composé.
 */
export function blocsWhere(source: string): string[] {
  const blocs: string[] = [];
  const debutFiltre = /\bwhere\s*:\s*\{/gi;

  for (
    let trouve = debutFiltre.exec(source);
    trouve !== null;
    trouve = debutFiltre.exec(source)
  ) {
    let profondeur = 0;
    let curseur = trouve.index + trouve[0].length - 1;
    const depart = curseur;

    for (; curseur < source.length; curseur += 1) {
      const caractere = source[curseur];
      if (caractere === "{") {
        profondeur += 1;
      } else if (caractere === "}") {
        profondeur -= 1;
        if (profondeur === 0) {
          break;
        }
      }
    }

    blocs.push(source.slice(depart, curseur + 1));
  }

  return blocs;
}

describe("les colonnes de société du journal des accès sont informatives (D34)", () => {
  const fichiers = fichiersSource(REPERTOIRES);

  it("parcourt bien des fichiers — sinon le gardien serait vide", () => {
    expect(fichiers.length).toBeGreaterThan(10);
  });

  it("le gardien sait repérer un filtre — éprouvé sur un cas fabriqué", () => {
    // Sans cette vérification, une expression régulière fautive rendrait le
    // scénario vert sur n'importe quel dépôt.
    const fautif = `
      await client.journalAcces.findMany({
        where: { societe_id_cible: societeId, evenement: { not: null } },
      });
    `;
    expect(blocsWhere(fautif).some((bloc) => COLONNES.test(bloc))).toBe(true);

    const sain = `await client.journalAcces.findMany({ where: { utilisateur_id: id } });`;
    expect(blocsWhere(sain).some((bloc) => COLONNES.test(bloc))).toBe(false);
  });

  it("aucune requête applicative ne filtre sur ces colonnes", () => {
    const fautifs = fichiers
      .filter((fichier) =>
        blocsWhere(fichier.contenu).some((bloc) => COLONNES.test(bloc)),
      )
      .map((fichier) => fichier.chemin);

    expect(
      fautifs,
      "`societe_id_source` et `societe_id_cible` répondent à « qui a tenté " +
        "d'accéder à mes données » ; elles ne filtrent jamais (D34)",
    ).toEqual([]);
  });

  it("aucun SQL brut ne les met derrière un WHERE", () => {
    // Le filtre peut aussi s'écrire en SQL, où le gardien précédent ne voit
    // rien. On refuse donc toute occurrence des colonnes dans une clause
    // `WHERE` écrite à la main.
    const sqlFiltrant =
      /\bWHERE\b[^;`'"]*societe_id_(?:source|cible)|societe_id_(?:source|cible)[^;`'"]*\bWHERE\b/i;

    const fautifs = fichiers
      .filter((fichier) => sqlFiltrant.test(fichier.contenu))
      .map((fichier) => fichier.chemin);

    expect(fautifs).toEqual([]);
  });

  it("elles s'écrivent bien quelque part — le gardien porte sur quelque chose", () => {
    const ecrivains = fichiers.filter((fichier) =>
      COLONNES.test(fichier.contenu),
    );

    expect(ecrivains.map((fichier) => fichier.chemin)).toContain(
      "lib/auth/societe-active.ts",
    );
  });
});
