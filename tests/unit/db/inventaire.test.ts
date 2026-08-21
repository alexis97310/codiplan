import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FICHIER_INVENTAIRE,
  TABLES_CLOISONNEES,
  decompteVide,
  ecartsAvecContexte,
  ecartsInventaire,
  ecartsSansContexte,
  ecartsTemoins,
  lireInventaire,
  totaliser,
  type Inventaire,
  type LigneInventaire,
} from "@/scripts/lib/inventaire";

/**
 * Inventaire à plat et contrôle de cloisonnement (I1).
 *
 * Deux étapes du workflow « DB migrate & seed », deux motifs d'échec distincts :
 * la première échoue quand l'inventaire ne peut pas être juste, la seconde
 * quand le cloisonnement ne tient pas. Ce test verrouille les comparaisons qui
 * décident de ces échecs, et le câblage du workflow qui garantit que chacune
 * s'exécute sous le bon rôle. Voir
 * docs/decisions/2026-08-20-inventaire-et-controle-de-cloisonnement.md.
 */

const SOCIETE_NC = "0192f0a0-0000-7000-8000-000000000001";
const SOCIETE_EU = "0192f0a0-0000-7000-8000-000000000002";

function ligne(surcharge: Partial<LigneInventaire> = {}): LigneInventaire {
  return {
    societe_id: SOCIETE_NC,
    code: "CODIMA-NC",
    decomptes: {
      societe: 1,
      agence: 3,
      calendrier: 2,
      calendrier_plage: 11,
      calendrier_ferie: 1,
      utilisateur_societe: 2,
      utilisateur_client: 1,
    },
    ...surcharge,
  };
}

function inventaire(surcharge: Partial<Inventaire> = {}): Inventaire {
  const societes = surcharge.societes ?? [
    ligne(),
    ligne({
      societe_id: SOCIETE_EU,
      code: "CODIMA-EU",
      decomptes: {
        societe: 1,
        agence: 1,
        calendrier: 1,
        calendrier_plage: 5,
        calendrier_ferie: 0,
        utilisateur_societe: 1,
        utilisateur_client: 0,
      },
    }),
  ];
  return {
    identite: {
      role_connecte: "neondb_owner",
      identite_exemptee: "neon_superuser",
      base: "codiplan",
    },
    societes,
    total: totaliser(societes),
    hors_cloisonnement: {
      devise: 2,
      parite: 1,
      jour_ferie: 24,
      utilisateur: 4,
    },
    ...surcharge,
  };
}

describe("inventaire à plat", () => {
  it("totalise le détail société par société", () => {
    expect(totaliser(inventaire().societes)).toEqual({
      societe: 2,
      agence: 4,
      calendrier: 3,
      calendrier_plage: 16,
      calendrier_ferie: 1,
      utilisateur_societe: 3,
      utilisateur_client: 1,
    });
  });

  it("accepte un inventaire cohérent", () => {
    expect(ecartsInventaire(inventaire())).toEqual([]);
  });

  it("refuse une base sans aucune société — le seed n'a rien produit", () => {
    const ecarts = ecartsInventaire(
      inventaire({ societes: [], total: decompteVide() }),
    );
    expect(ecarts.join("\n")).toContain("aucune société en base");
  });

  it("refuse un total qui ne correspond pas au détail", () => {
    const fausse = inventaire();
    const ecarts = ecartsInventaire({
      ...fausse,
      total: { ...fausse.total, agence: 99 },
    });
    expect(ecarts.join("\n")).toContain("« agence »");
  });

  it("signale des lignes rattachées à une société inexistante", () => {
    const ecarts = ecartsInventaire(
      inventaire({
        societes: [
          ligne({
            code: null,
            decomptes: { ...ligne().decomptes, societe: 0 },
          }),
        ],
      }),
    );
    expect(ecarts.join("\n")).toContain("qui n'existe pas");
  });
});

describe("contrôle de cloisonnement", () => {
  describe("sans contexte société", () => {
    it("exige zéro ligne sur chaque table cloisonnée", () => {
      expect(ecartsSansContexte(decompteVide())).toEqual([]);
    });

    it("refuse la moindre ligne visible — c'est une fuite", () => {
      for (const table of TABLES_CLOISONNEES) {
        const observe = { ...decompteVide(), [table]: 1 };
        const ecarts = ecartsSansContexte(observe);
        expect(
          ecarts.join("\n"),
          `fuite non détectée sur « ${table} »`,
        ).toContain(`« ${table} »`);
      }
    });
  });

  describe("sous le contexte d'une société", () => {
    it("accepte exactement les lignes de l'inventaire", () => {
      expect(ecartsAvecContexte(ligne(), ligne().decomptes)).toEqual([]);
    });

    it("refuse un excédent, et le nomme fuite entre sociétés", () => {
      const ecarts = ecartsAvecContexte(ligne(), {
        ...ligne().decomptes,
        agence: 4,
      });
      expect(ecarts.join("\n")).toContain("fuite");
      expect(ecarts.join("\n")).toContain("3 ligne(s) attendue(s)");
    });

    it("refuse un déficit : une société doit voir ses propres lignes", () => {
      const ecarts = ecartsAvecContexte(ligne(), {
        ...ligne().decomptes,
        agence: 2,
      });
      expect(ecarts.join("\n")).toContain(
        "ne voit pas toutes ses propres lignes",
      );
    });
  });

  describe("témoins hors cloisonnement", () => {
    it("accepte des référentiels lus à l'identique", () => {
      const attendu = { devise: 2, parite: 1, jour_ferie: 24, utilisateur: 4 };
      expect(ecartsTemoins(attendu, { ...attendu })).toEqual([]);
    });

    /**
     * Sans ce témoin, une base vide ou une connexion muette produirait les
     * mêmes zéros qu'un cloisonnement parfait, et le contrôle passerait sans
     * rien prouver.
     */
    it("refuse un référentiel devenu illisible sous le rôle applicatif", () => {
      const ecarts = ecartsTemoins(
        { devise: 2, parite: 1, jour_ferie: 24, utilisateur: 4 },
        { devise: 0, parite: 1, jour_ferie: 24, utilisateur: 4 },
      );
      expect(ecarts.join("\n")).toContain("témoin « devise »");
    });
  });
});

describe("échange entre les deux étapes", () => {
  it("relit un inventaire écrit par l'étape 1", () => {
    const relu = lireInventaire(JSON.stringify(inventaire()));
    expect(relu).toEqual(inventaire());
  });

  it("refuse un inventaire tronqué plutôt que de le compléter", () => {
    // La table retirée est nommée plutôt que déduite de l'ordre des clés :
    // ainsi le scénario continue de dire ce qu'il éprouve — « une table
    // manquante est refusée » — quand une table s'ajoute à l'inventaire.
    const tronque = Object.fromEntries(
      Object.entries(totaliser(inventaire().societes)).filter(
        ([table]) => table !== "utilisateur_societe",
      ),
    );

    expect(() =>
      lireInventaire(JSON.stringify({ ...inventaire(), total: tronque })),
    ).toThrow(/utilisateur_societe/);
  });

  it("refuse un décompte qui n'est pas un entier positif", () => {
    expect(() =>
      lireInventaire(
        JSON.stringify({
          ...inventaire(),
          hors_cloisonnement: {
            devise: -1,
            parite: 1,
            jour_ferie: 24,
            utilisateur: 4,
          },
        }),
      ),
    ).toThrow(/devise/);
  });
});

describe("câblage du workflow", () => {
  // Vitest s'exécute depuis la racine du dépôt.
  const workflow = readFileSync(
    join(process.cwd(), ".github/workflows/db-migrate.yml"),
    "utf8",
  );

  function position(fragment: string): number {
    const index = workflow.indexOf(fragment);
    expect(index, `fragment absent du workflow : ${fragment}`).toBeGreaterThan(
      -1,
    );
    return index;
  }

  it("sépare l'inventaire du contrôle, et les place après le seed", () => {
    const seed = position("- name: Exécuter le seed");
    const inventaireEtape = position("- name: Inventaire à plat");
    const controle = position("- name: Contrôle de cloisonnement");

    expect(seed).toBeLessThan(inventaireEtape);
    expect(inventaireEtape).toBeLessThan(controle);
    expect(workflow).toContain("scripts/inventaire.mts");
    expect(workflow).toContain("scripts/controle-cloisonnement.mts");
  });

  it("ne conserve plus le décompte unique qu'elles remplacent", () => {
    expect(workflow).not.toContain("decompte-controle");
  });

  /**
   * Le motif d'échec de l'étape 2 n'a de sens que si elle tourne sous le rôle
   * applicatif. Jouée avec l'URL de migration, elle ne prouverait rien : ce rôle
   * contourne les politiques par nature.
   */
  it("exécute le contrôle avec l'URL applicative, pas celle des migrations", () => {
    const etape = workflow.slice(position("- name: Contrôle de cloisonnement"));

    expect(etape).toContain("DATABASE_URL: ${{ secrets.DATABASE_URL }}");
    expect(etape).toContain(
      "MIGRATION_DATABASE_URL: ${{ secrets.MIGRATION_DATABASE_URL }}",
    );
  });

  /**
   * Le repli `MIGRATION_DATABASE_URL || DATABASE_URL` ferait tourner les
   * migrations sous le rôle applicatif, dépourvu de droits DDL, et masquerait
   * un secret manquant derrière une erreur sans rapport.
   */
  it("n'accepte aucun repli entre les deux secrets pour les migrations", () => {
    // Commentaires retirés : c'est le YAML effectif qui décide, et la décision
    // y est justement commentée — la prose ne doit pas faire échouer le test.
    const env = workflow
      .slice(position("    env:"), position("    steps:"))
      .split("\n")
      .filter((ligneYaml) => !ligneYaml.trim().startsWith("#"))
      .join("\n");

    expect(env).toContain(
      "DATABASE_URL: ${{ secrets.MIGRATION_DATABASE_URL }}",
    );
    expect(env).not.toContain("||");
  });
});

describe("fichier d'échange", () => {
  it("n'est jamais versionné (I9)", () => {
    const gitignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    expect(gitignore).toContain(FICHIER_INVENTAIRE);
  });
});
