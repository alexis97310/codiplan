import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FICHIER_INVENTAIRE,
  TABLES_CLOISONNEES,
  TABLES_HORS_CLOISONNEMENT,
  decompteVide,
  ecartsAvecContexte,
  ecartsInventaire,
  ecartsSansContexte,
  ecartsTemoinLecture,
  ecartsTemoins,
  lireInventaire,
  socleAttendu,
  totaliser,
  type Inventaire,
  type LigneInventaire,
} from "@/scripts/lib/inventaire";
import { TABLES_RLS_FORCEE } from "@/scripts/lib/rls-declaree";

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
      client: 2,
      site: 3,
      contact: 2,
      agence: 3,
      calendrier: 2,
      calendrier_plage: 11,
      calendrier_ferie: 1,
      utilisateur_societe: 2,
      utilisateur_client: 1,
      utilisateur_client_site: 1,
      habilitation: 4,
      technicien_habilitation: 2,
      site_habilitation_requise: 1,
      taux_horaire: 1,
      forfait: 1,
      famille_materiel: 1,
      modele_materiel: 1,
      machine: 1,
      document: 0,
      document_recu: 0,
      import_lot: 0,
      import_lot_ligne: 0,
      intervention: 0,
      intervention_machine: 0,
      demande: 0,
      absence: 0,
      technicien: 0,
      technicien_calendrier: 0,
      prestation: 0,
      segment_travail: 0,
      temps_trajet_zone: 0,
      vgp_campagne: 0,
      vgp_observation: 0,
      vgp_verification: 0,
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
        client: 1,
        site: 1,
        contact: 0,
        agence: 1,
        calendrier: 1,
        calendrier_plage: 5,
        calendrier_ferie: 0,
        utilisateur_societe: 1,
        utilisateur_client: 0,
        utilisateur_client_site: 0,
        habilitation: 4,
        technicien_habilitation: 0,
        site_habilitation_requise: 0,
        taux_horaire: 0,
        forfait: 0,
        famille_materiel: 0,
        modele_materiel: 0,
        machine: 0,
        document: 0,
        document_recu: 0,
        import_lot: 0,
        import_lot_ligne: 0,
        intervention: 0,
        intervention_machine: 0,
        demande: 0,
        absence: 0,
        technicien: 0,
        technicien_calendrier: 0,
        prestation: 0,
        segment_travail: 0,
        temps_trajet_zone: 0,
        vgp_campagne: 0,
        vgp_observation: 0,
        vgp_verification: 0,
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
    },
    ...surcharge,
  };
}

describe("inventaire à plat", () => {
  it("totalise le détail société par société", () => {
    expect(totaliser(inventaire().societes)).toEqual({
      societe: 2,
      client: 3,
      site: 4,
      contact: 2,
      agence: 4,
      calendrier: 3,
      calendrier_plage: 16,
      calendrier_ferie: 1,
      utilisateur_societe: 3,
      utilisateur_client: 1,
      utilisateur_client_site: 1,
      habilitation: 8,
      technicien_habilitation: 2,
      site_habilitation_requise: 1,
      taux_horaire: 1,
      forfait: 1,
      famille_materiel: 1,
      modele_materiel: 1,
      machine: 1,
      document: 0,
      document_recu: 0,
      // L1-08e — la population de l'inventaire est DÉRIVÉE du schéma (§9,
      // 10/09), et ces deux entrées y sont donc entrées le jour où les tables
      // sont nées, sans qu'aucune liste ait été tenue à la main.
      import_lot: 0,
      import_lot_ligne: 0,
      intervention: 0,
      // L2-08a — même chemin, et c'est ce qui rend la dérivation utile : ni
      // cette liste ni le script n'ont eu à être tenus à la main.
      intervention_machine: 0,
      // L2-06 — même chemin : `demande` est entrée le jour où la table est née.
      demande: 0,
      // L3-01a — et c'est la table que trois `(prévu)` attendaient.
      absence: 0,
      technicien: 0,
      technicien_calendrier: 0,
      prestation: 0,
      segment_travail: 0,
      temps_trajet_zone: 0,
      vgp_campagne: 0,
      vgp_observation: 0,
      vgp_verification: 0,
    });
  });

  it("accepte un inventaire cohérent", () => {
    expect(ecartsInventaire(inventaire(), "seed")).toEqual([]);
  });

  /**
   * ── ZÉRO SOCIÉTÉ EST UN ÉCART OU UN ÉTAT, SELON CE QUE LE FLUX A FAIT AVANT
   *    (AMORCAGE-2 — mesuré le 22/09/2026 à 11 h 50, sur une vraie base) ───
   *
   * Sur la base de PRODUCTION neuve d'Alexis, la migration avait réussi —
   * toutes les tables, comptées à zéro — et le flux a rougi ici même :
   * « aucune société en base : le seed n'a pas produit le socle attendu ».
   * Or sur cette cible le seed est SAUTÉ par construction
   * (`cible-de-migration.test.ts`), et la société n'existe qu'après le flux
   * « Amorcer une base ». La note de mise en ligne le disait noir sur blanc ;
   * c'est le code qui arrêtait la chaîne.
   *
   * Le socle attendu dépend donc de ce que le flux a fait avant, et le flux
   * le SAIT : `CIBLE_RETENUE`, posée dans l'environnement par l'étape qui
   * décide de la cible, et que personne ne lisait. Les deux sens sont
   * éprouvés — refus sur la démonstration, où le seed vient de tourner ;
   * acceptation sur la production, POUR SA PROPRE RAISON (§9, 11/09) — et
   * le défaut d'un renseignement absent est le sens STRICT : un contrôle
   * joué hors du flux exige le seed plutôt que de supposer une production.
   */
  it("refuse une base sans aucune société quand le seed vient de tourner — démonstration", () => {
    const ecarts = ecartsInventaire(
      inventaire({ societes: [], total: decompteVide() }),
      "seed",
    );
    expect(ecarts.join("\n")).toContain("aucune société en base");
  });

  it("ACCEPTE une base sans aucune société quand le seed a été sauté — production neuve", () => {
    expect(
      ecartsInventaire(
        inventaire({ societes: [], total: decompteVide() }),
        "amorcage",
      ),
    ).toEqual([]);
  });

  it("le socle « amorçage » ne relâche RIEN d'autre : un total faux reste un écart", () => {
    // Le cas qui doit rougir pour sa propre raison : le socle décide du seul
    // contrôle « zéro société », jamais de la cohérence du détail.
    const fausse = inventaire();
    const ecarts = ecartsInventaire(
      { ...fausse, total: { ...fausse.total, agence: 99 } },
      "amorcage",
    );
    expect(ecarts.join("\n")).toContain("« agence »");
  });

  describe("le socle attendu se LIT dans ce que le flux sait de sa cible", () => {
    it("cible « production » : le seed est sauté, aucune société n'est attendue", () => {
      expect(socleAttendu({ CIBLE_RETENUE: "production" })).toBe("amorcage");
    });

    it("cible « demonstration » : le seed vient de tourner, le socle est exigé", () => {
      expect(socleAttendu({ CIBLE_RETENUE: "demonstration" })).toBe("seed");
    });

    it("renseignement ABSENT ou vide : le sens strict, jamais une production supposée", () => {
      expect(socleAttendu({})).toBe("seed");
      expect(socleAttendu({ CIBLE_RETENUE: "" })).toBe("seed");
    });
  });

  it("refuse un total qui ne correspond pas au détail", () => {
    const fausse = inventaire();
    const ecarts = ecartsInventaire(
      { ...fausse, total: { ...fausse.total, agence: 99 } },
      "seed",
    );
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
      "seed",
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
        { devise: 2, parite: 1, jour_ferie: 24 },
        { devise: 0, parite: 1, jour_ferie: 24 },
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
   * LE RENSEIGNEMENT EXISTE, ET IL PRÉCÈDE L'INVENTAIRE (AMORCAGE-2).
   *
   * Le flux pose `CIBLE_RETENUE` dans `$GITHUB_ENV` à l'étape qui décide de
   * la cible ; toute étape suivante en hérite. C'est la seule source que
   * l'inventaire lise pour savoir si le seed a été sauté — un drapeau de plus
   * aurait été une seconde lecture du même critère (§9, 01/09). Les deux
   * côtés sont éprouvés : le flux ÉCRIT la variable avant l'inventaire, et le
   * script la LIT par `socleAttendu`.
   */
  it("l'inventaire lit la cible que le flux a retenue, posée AVANT lui", () => {
    const pose = position('echo "CIBLE_RETENUE=$cible" >> "$GITHUB_ENV"');
    expect(pose).toBeLessThan(position("- name: Inventaire à plat"));

    const script = readFileSync(
      join(process.cwd(), "scripts/inventaire.mts"),
      "utf8",
    );
    expect(script).toContain("socleAttendu(process.env)");
  });

  /**
   * Le motif d'échec de l'étape 2 n'a de sens que si elle tourne sous le rôle
   * applicatif. Jouée avec l'URL de migration, elle ne prouverait rien : ce rôle
   * contourne les politiques par nature.
   */
  it("exécute le contrôle avec l'URL applicative, pas celle des migrations", () => {
    const etape = workflow.slice(position("- name: Contrôle de cloisonnement"));

    // Depuis le 09/09/2026, la base visée dépend de l'entrée « cible » : les
    // deux URL sont composées par l'étape de choix, qui REFUSE plutôt que de se
    // rabattre. L'intention du gardien ne bouge pas — le contrôle tourne sous
    // le rôle APPLICATIF — et l'assertion la suit là où la valeur se compose.
    expect(etape).toContain("DATABASE_URL: ${{ env.URL_APPLICATIVE }}");
    expect(etape).toContain("MIGRATION_DATABASE_URL: ${{ env.DATABASE_URL }}");
    expect(
      workflow,
      "URL_APPLICATIVE ne se compose qu'à partir d'un secret APPLICATIF",
    ).toContain('applicatif="$SECRET_APPLICATIF_PRODUCTION"');
    expect(
      etape,
      "jamais le rôle des migrations pour le contrôle",
    ).not.toContain("secrets.MIGRATION_DATABASE_URL");
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

    // LE REPLI A CHANGÉ DE COSTUME, ET IL EST TOUJOURS REFUSÉ. L'expression
    // `cible == 'production' && secrets.PRODUCTION_… || secrets.…` a l'air d'un
    // ternaire ; elle n'en est pas un quand la première valeur est VIDE — `&&`
    // rend alors la chaîne vide et `||` rend la seconde. Un secret de
    // production absent ferait donc migrer LA DÉMONSTRATION, sans que rien ne
    // soit vide et sans que rien ne le dise. *Écrite le 09/09/2026, cette
    // faute a été attrapée par ce gardien-ci.*
    expect(env).toContain(
      "SECRET_MIGRATION_PRODUCTION: ${{ secrets.PRODUCTION_MIGRATION_DATABASE_URL }}",
    );
    expect(env).toContain(
      "SECRET_MIGRATION_DEMONSTRATION: ${{ secrets.MIGRATION_DATABASE_URL }}",
    );
    expect(env, "aucune expression ne choisit un secret").not.toContain("||");

    // Et le choix se fait dans un shell, où « absent » ARRÊTE.
    expect(workflow).toContain("refuser plutôt que se rabattre");
    expect(workflow).toContain("Aucun repli n'est prévu");
  });
});

describe("fichier d'échange", () => {
  it("n'est jamais versionné (I9)", () => {
    const gitignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    expect(gitignore).toContain(FICHIER_INVENTAIRE);
  });
});

/**
 * LES DEUX LISTES NE PEUVENT PLUS SE CONTREDIRE (ticket L1-02c).
 *
 * **Ce gardien répare un rouge réel, survenu en migration.** `utilisateur` est
 * restée dans `TABLES_HORS_CLOISONNEMENT` après avoir reçu sa RLS : le contrôle
 * de la base hébergée l'a nommée — « 3 ligne(s) à l'inventaire, 0 lue(s) sous le
 * rôle applicatif » —, et il avait raison. Aucune suite LOCALE ne pouvait
 * l'attraper : les témoins de l'inventaire exigent d'écrire puis de comparer, ce
 * que `test:isolation` ne fait pas. Le seul environnement où le défaut existait
 * était le seul qui ne soit jamais exercé (§9, 23/08).
 *
 * La confrontation se fait ici, contre une source que ce fichier ne contrôle
 * pas : l'état RLS déclaré. Une table sous RLS forcée rend zéro sans contexte —
 * elle ne peut donc pas être un témoin « hors cloisonnement ».
 */
describe("les témoins hors cloisonnement ne sont pas sous RLS forcée", () => {
  it("n'observe aucune contradiction", () => {
    const forcees: readonly string[] = TABLES_RLS_FORCEE;
    const contradictions = TABLES_HORS_CLOISONNEMENT.filter((table) =>
      forcees.includes(table),
    );
    expect(
      contradictions,
      `témoins « hors cloisonnement » pourtant sous RLS forcée : ${contradictions.join(", ")}. ` +
        "Une table sous RLS forcée rend ZÉRO ligne sans contexte : elle ne peut " +
        "pas servir de témoin de lecture libre, et le contrôle de la base " +
        "hébergée la nommera en pleine migration.",
    ).toEqual([]);
  });

  it("a réellement comparé deux listes peuplées — témoin de non-vacuité", () => {
    // Deux listes vides ne se contredisent jamais (§9, 01/09).
    expect(TABLES_HORS_CLOISONNEMENT.length).toBeGreaterThan(0);
    expect(TABLES_RLS_FORCEE.length).toBeGreaterThan(5);
  });

  it("ÉPREUVE : la contradiction RÉELLE d'avant ce ticket est refusée", () => {
    // `utilisateur` dans les deux listes — l'état exact qui a fait rougir la
    // migration du 07/09/2026.
    const forcees: readonly string[] = TABLES_RLS_FORCEE;
    const avant = [...TABLES_HORS_CLOISONNEMENT, "utilisateur"];
    expect(avant.filter((t) => forcees.includes(t))).toEqual(["utilisateur"]);
  });
});

/**
 * LE TÉMOIN DE LA LECTURE — ce qui rend un « zéro partout » mesurable la nuit.
 *
 * `ecartsSansContexte` attend zéro sur chaque table cloisonnée. C'est la
 * preuve par LECTURE, la plus forte du dépôt (§9, 31/08) — et son mode de
 * défaillance est celui du 30/08 : *une connexion aveugle rend exactement le
 * même résultat qu'un cloisonnement parfait.* Le témoin l'écarte sans coûter
 * un seul privilège, ce qui est la condition pour qu'il rejoigne la veille
 * nocturne, laquelle tourne sous le rôle applicatif.
 *
 * Les deux directions du prédicat sont éprouvées, et pas seulement celle qui
 * rougit (§9, 11/09) : un cas qui doit rougir, et un cas qui doit rester vert
 * POUR SA PROPRE RAISON — un seul référentiel peuplé suffit, parce que la
 * question posée est « la lecture rapporte-t-elle des lignes ? », jamais
 * « les référentiels sont-ils complets ? ».
 */
describe("témoin de la lecture applicative", () => {
  it("rougit quand AUCUN référentiel ne rend de ligne — le vert serait creux", () => {
    const aveugle = Object.fromEntries(
      TABLES_HORS_CLOISONNEMENT.map((table) => [table, 0]),
    );
    const ecarts = ecartsTemoinLecture(aveugle);
    expect(ecarts).toHaveLength(1);
    // L'écart NOMME ce qu'il a regardé : un refus qui ne dit pas sur quoi il
    // porte envoie chercher ailleurs.
    for (const table of TABLES_HORS_CLOISONNEMENT) {
      expect(ecarts[0]).toContain(table);
    }
  });

  it("reste vert dès qu'UN référentiel rend des lignes, et c'est bien sa raison", () => {
    const [premier] = TABLES_HORS_CLOISONNEMENT;
    expect(premier).toBeDefined();
    const partiel = Object.fromEntries(
      TABLES_HORS_CLOISONNEMENT.map((table) => [
        table,
        table === premier ? 3 : 0,
      ]),
    );
    expect(ecartsTemoinLecture(partiel)).toEqual([]);
  });

  it("le témoin et le verdict sont INDÉPENDANTS : l'un peut passer et l'autre non", () => {
    // La population n'est pas vide — sans quoi les deux assertions ci-dessus
    // seraient vraies sur du vide (§9, 30/08).
    expect(TABLES_HORS_CLOISONNEMENT.length).toBeGreaterThan(0);
    expect(TABLES_CLOISONNEES.length).toBeGreaterThan(0);

    const [refer] = TABLES_HORS_CLOISONNEMENT;
    const [cloisonnee] = TABLES_CLOISONNEES;
    const temoins = Object.fromEntries(
      TABLES_HORS_CLOISONNEMENT.map((t) => [t, t === refer ? 1 : 0]),
    );
    const fuite = { ...decompteVide(), [cloisonnee as string]: 2 };

    // Témoin vert, verdict rouge : la lecture voit, et elle voit TROP.
    expect(ecartsTemoinLecture(temoins)).toEqual([]);
    expect(ecartsSansContexte(fuite)).toHaveLength(1);

    // Témoin rouge, verdict vert : le « zéro partout » qui ne prouve rien —
    // c'est exactement l'état qu'une veille sans témoin aurait rapporté vert.
    const aveugle = Object.fromEntries(
      TABLES_HORS_CLOISONNEMENT.map((t) => [t, 0]),
    );
    expect(ecartsTemoinLecture(aveugle)).toHaveLength(1);
    expect(ecartsSansContexte(decompteVide())).toEqual([]);
  });
});
