import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CODES_LIAISON,
  CODE_SORTIE_ECART,
  CODE_SORTIE_LIAISON,
  EcartConstate,
  INSTRUCTION_LECTURE_SEULE,
  estPanneDeLiaison,
  urlVeille,
} from "../../scripts/veille-hebergee.mjs";

/**
 * LA VEILLE DE LA BASE HÉBERGÉE — le détectif tourne-t-il, et sur la bonne base ?
 *
 * **Ce que ce gardien répare, et il a été mesuré.** Les contrôles détectifs du
 * dépôt ne s'exécutaient que dans `db-migrate.yml`, dont le déclencheur est
 * `workflow_dispatch` et lui seul ; et le `verify:full` nocturne tourne contre
 * un PostgreSQL JETABLE. Le détectif n'avait donc jamais regardé l'endroit où
 * la faute se produit. C'est la même famille que É12 — une garantie dont le
 * déclenchement dépend de l'initiative d'un humain n'est pas une garantie.
 *
 * **Et un job planifié que personne ne garde est le défaut du dépôt.** Retirer
 * la veille de `ci.yml` ne casserait rien, ne ferait rougir aucun test, et le
 * silence a exactement la forme du succès (§9, 31/08). Ce gardien lit donc le
 * flux et exige que la veille y soit, planifiée, et câblée à l'alarme.
 */
const CI = readFileSync(
  join(process.cwd(), ".github/workflows/ci.yml"),
  "utf8",
);

/**
 * Le SOURCE de la veille, lu comme texte.
 *
 * Le ticket L0-04 aurait dit « le script appelle les six contrôles » ; il les
 * appelle en effet. Mais **rien ne le tenait** : en retirer un de la liste
 * `controles` ne casse aucune compilation, ne fait rougir aucun scénario, et
 * la veille continue de rendre un vert — sur cinq contrôles au lieu de six. Les
 * fonctions pures, elles, restent gardées par leurs propres épreuves : ce qui
 * ne l'était pas, c'est le CÂBLAGE. Même famille que É12 : le silence a
 * exactement la forme du succès.
 */
const VEILLE = readFileSync(
  join(process.cwd(), "scripts/veille-hebergee.mts"),
  "utf8",
);

/**
 * Le PÉRIMÈTRE DE LA VEILLE EST INVERSÉ, sur le modèle de D55 : toute fonction
 * d'écart de `scripts/lib/` est un contrôle de veille **par défaut**, et n'y
 * échappe que par une exclusion écrite et justifiée.
 *
 * **Une première rédaction exigeait SIX contrôles, et six était un nombre écrit
 * à la main.** Elle attrapait le contrôle qu'on décâble ; elle laissait passer
 * celui qu'on écrit sans jamais le câbler — la veille aurait rendu un vert sur
 * six comme elle rendait un vert sur cinq, et personne ne s'en serait aperçu.
 * C'est la maladie que ce dépôt a déjà soignée quatre fois : une liste close
 * tenue à la main devient fausse le jour où quelqu'un crée l'objet suivant sans
 * revenir la ranger (§9, 20/08 et 01/09).
 *
 * **La source contre laquelle elle est fermée est le répertoire lui-même** —
 * une source que ce gardien ne contrôle pas et qui ne se plie pas à ce qu'il
 * déclare. Écrire `ecartsQuelqueChose` dans `scripts/lib/` suffit désormais à
 * l'exiger dans la veille, sans que personne n'ait à y penser.
 */
const LIB = join(process.cwd(), "scripts/lib");

/** Le source de chaque module de `scripts/lib/`, par nom de fichier. */
const SOURCES_LIB: ReadonlyMap<string, string> = new Map(
  readdirSync(LIB)
    .filter((fichier) => fichier.endsWith(".ts"))
    .map((fichier) => [fichier, readFileSync(join(LIB, fichier), "utf8")]),
);

/**
 * Les fonctions d'écart DÉCLARÉES par `scripts/lib/`, lues au source.
 *
 * Les deux formes d'export sont reconnues — `export function ecartsX(` et
 * `export const ecartsX =` —, et le motif est délibérément LARGE : élargir la
 * population est la parade au `WHERE` qui recoupe l'assertion (§9, 31/08). Une
 * fonction qu'on ne veut pas voir ici sort par une exclusion écrite, jamais en
 * échappant au motif.
 */
function controlesDeclares(
  sources: ReadonlyMap<string, string> = SOURCES_LIB,
): string[] {
  const trouves = new Set<string>();
  for (const source of sources.values()) {
    for (const trouve of source.matchAll(
      /^export (?:function|const) (ecarts[A-Za-z0-9_]*)\b/gm,
    )) {
      trouves.add(trouve[1]);
    }
  }
  return [...trouves].sort();
}

/**
 * Les contrôles HORS OBSERVATION — la seule chose qui reste tenue à la main,
 * donc la seule qui puisse dériver, et c'est pour cela qu'elle est gardée dans
 * les deux sens.
 *
 * **Un seul motif recevable**, et c'est celui que le titre porte : la fonction
 * ne juge pas une OBSERVATION de la base hébergée sous transaction en lecture
 * seule. En ajouter un second est le geste par lequel un périmètre inversé
 * redevient une liste d'admis, un argument à la fois (D55, mot pour mot).
 *
 * C'est ici que vit la justification, et **nulle part ailleurs** : le source de
 * la veille y renvoie plutôt que de la recopier (§9, 01/09 — deux copies que
 * rien ne confronte).
 */
const HORS_OBSERVATION: readonly {
  fonction: string;
  justification: string;
}[] = [
  {
    fonction: "ecartsObservationProprietaire",
    justification:
      "n'observe pas la base : elle lit le TEXTE des scénarios d'isolation et " +
      "refuse qu'une assertion de vacuité s'appuie sur une lecture faite sous " +
      "le propriétaire. C'est un gardien du harnais, pas un contrôle de " +
      "dérive de la base hébergée — la veille tourne sous le rôle applicatif " +
      "et n'a aucun fichier à lire.",
  },
  {
    fonction: "ecartsBattement",
    justification:
      "n'observe pas la base : elle lit l'âge de la dernière exécution " +
      "planifiée dans le flux CI. C'est le battement de cœur de la veille, " +
      "pas un de ses contrôles — et une veille qui se surveillerait " +
      "elle-même ne dirait rien le jour où elle cesse de tourner (É12).",
  },
  {
    fonction: "ecartsInventaire",
    justification:
      "exige d'ÉCRIRE puis de comparer : elle confronte ce que le seed VIENT " +
      "d'écrire à ce que le rôle applicatif en voit. La veille est en lecture " +
      "seule et n'a rien écrit ; il n'y aurait rien à comparer.",
  },
  {
    fonction: "ecartsSansContexte",
    justification:
      "même inventaire comparé : elle juge un décompte obtenu après un seed, " +
      "que la veille ne joue pas.",
  },
  {
    fonction: "ecartsAvecContexte",
    justification:
      "même inventaire comparé : elle juge un décompte obtenu après un seed, " +
      "que la veille ne joue pas.",
  },
  {
    fonction: "ecartsTemoins",
    justification: "témoins de l'inventaire comparé, indissociables de lui.",
  },
  {
    fonction: "ecartsListeDesignation",
    justification:
      "garde une LISTE DU DÉPÔT (`TABLES_DESIGNATION`), pas la base — même " +
      "raison que `ecartsListeParc`. La FORME qu'elle commande est bien " +
      "observée : `ecartsPolitiques` la mesure dans `pg_policies`.",
  },
  {
    fonction: "ecartsListeHabilitation",
    justification:
      "garde une LISTE DU DÉPÔT (`TABLES_HABILITATION`), pas la base — même " +
      "raison que `ecartsListeParc` juste en dessous. La FORME que cette " +
      "liste commande, elle, est bien observée : `ecartsPolitiques` la mesure " +
      "dans `pg_policies`, et c'est là que la veille mord.",
  },
  {
    fonction: "ecartsListeFiliation",
    justification:
      "garde une LISTE DU DÉPÔT (`TABLES_FILIATION`), pas la base — même " +
      "raison que `ecartsListeParc`. La FORME qu'elle commande est observée : " +
      "`ecartsPolitiques` mesure la clause de filiation dans `pg_policies`, et " +
      "c'est là que la veille mord.",
  },
  {
    fonction: "ecartsListeParc",
    justification:
      "garde une LISTE DU DÉPÔT (`TABLES_PARC`), pas la base. Aucune main " +
      "posée sur PostgreSQL ne peut la déplacer ; c'est le contrôle statique " +
      "qui la tient, et la veille observerait une constante.",
  },
  {
    fonction: "ecartsListeHorsDomaine",
    justification:
      "garde une LISTE DU DÉPÔT (la frontière du domaine d'audit), pas la base.",
  },
  {
    fonction: "ecartsExemptions",
    justification:
      "garde une LISTE DU DÉPÔT (les exemptions d'audit), pas la base.",
  },
  {
    fonction: "ecartsGardes",
    justification:
      "lit les FICHIERS DE MIGRATION du dépôt, jamais la base : elle vérifie " +
      "qu'un bloc de garde rend visible le mécanisme qui pourrait " +
      "l'aveugler. Une migration est immuable une fois appliquée, donc aucune " +
      "main posée sur PostgreSQL ne peut déplacer ce qu'elle juge — et la " +
      "veille, en lecture seule, observerait un fichier qu'elle ne lit pas.",
  },
  {
    fonction: "ecartsListeRattachees",
    justification:
      "garde une LISTE DU DÉPÔT (les tables rattachées au parc dont la " +
      "question n'est pas la filiation), pas la base.",
  },
  {
    fonction: "ecartsTablesFilles",
    justification:
      "juge le SCHÉMA PRISMA — l'existence d'une première table fille du " +
      "parc, critère de la forme « filiation ». C'est un contrôle " +
      "statique : la base ne peut pas faire apparaître une clé étrangère que " +
      "le dépôt ne déclare pas, et si elle le pouvait, c'est le contrôle des " +
      "FORMES qui le dirait, pas celui-ci.",
  },
];

/** Les contrôles que la veille DOIT câbler : déclarés, moins les exclusions. */
function controlesAttendus(
  declares: readonly string[] = controlesDeclares(),
  exclus: readonly string[] = HORS_OBSERVATION.map((e) => e.fonction),
): string[] {
  return declares.filter((nom) => !exclus.includes(nom)).sort();
}

/** Les contrôles réellement CÂBLÉS dans un source de veille donné. */
function controlesCables(
  source: string,
  declares: readonly string[] = controlesDeclares(),
): string[] {
  return declares
    .filter((nom) => new RegExp(`\\b${nom}\\s*\\(`).test(source))
    .sort();
}

/** Position d'un fragment dans le flux, en échouant s'il est absent. */
function position(fragment: string): number {
  const index = CI.indexOf(fragment);
  expect(index, `fragment absent de ci.yml : ${fragment}`).toBeGreaterThan(-1);
  return index;
}

describe("la veille de la base hébergée (D55)", () => {
  describe("elle est branchée, et sur une échéance", () => {
    it("le flux la déclare comme job", () => {
      position("veille-hebergee:");
      position("pnpm veille");
    });

    it("elle tourne à ÉCHÉANCE FIXE, pas seulement à la main", () => {
      // Le point entier. `workflow_dispatch` seul rendrait la veille aussi
      // dépendante de l'initiative humaine que le contrôle qu'elle remplace.
      const bloc = CI.slice(
        position("veille-hebergee:"),
        position("alarme-nuit-rouge:"),
      );
      expect(bloc).toContain("github.event_name == 'schedule'");
      expect(CI).toContain('- cron: "0 15 * * *"');
    });

    it("elle reçoit le secret du rôle APPLICATIF, jamais celui de migration", () => {
      // **Le point le plus important de ce gardien.** Lire `pg_inherits`,
      // `pg_policies` et les ACL ne demande aucun droit particulier. Faire
      // porter à un travail automatique nocturne une accréditation capable de
      // tout écrire serait payer un prix qu'on n'a aucune raison de payer — et
      // le verrou READ ONLY protège de l'accident, pas de l'accréditation.
      const bloc = CI.slice(
        position("veille-hebergee:"),
        position("alarme-nuit-rouge:"),
      );
      expect(bloc).toContain("DATABASE_URL: ${{ secrets.DATABASE_URL }}");
      expect(bloc).not.toContain("secrets.MIGRATION_DATABASE_URL");
      // Elle ne migre pas et n'amorce pas : ces mots n'ont rien à faire ici.
      expect(bloc).not.toContain("migrate deploy");
      expect(bloc).not.toContain("db:seed");
      expect(bloc).not.toContain("PURGE_DEMONSTRATION_CONFIRMEE");
    });

    it("elle publie la NATURE de son rouge, et l'alarme la lit", () => {
      const bloc = CI.slice(
        position("veille-hebergee:"),
        position("alarme-nuit-rouge:"),
      );
      expect(bloc).toContain("nature: ${{ steps.veille.outputs.nature }}");
      expect(bloc).toContain("nature=liaison");
      expect(bloc).toContain("nature=securite");
      expect(CI).toContain("needs.veille-hebergee.outputs.nature");
    });

    it("les deux rouges ouvrent DEUX fils d'issues distincts", () => {
      // Une nuit injoignable est un incident d'EXPLOITATION ; une base qui a
      // dérivé est un incident de SÉCURITÉ. Les mêler apprendrait en trois
      // semaines à ne plus lire ni l'un ni l'autre.
      for (const marqueur of [
        "[veille-injoignable]",
        "[veille-securite]",
        "[nuit-rouge]",
      ]) {
        expect(CI, marqueur).toContain(marqueur);
      }
    });

    it("une nuit de veille rouge ouvre la MÊME issue qu'un verify:full rouge", () => {
      // Sans ce câblage, la veille sonnerait dans la boîte de courriel que le
      // 20 août a montrée vide — c'est tout l'objet de l'écart É12.
      expect(CI).toContain("needs: [verify-full, veille-hebergee]");
      expect(CI).toContain("needs.veille-hebergee.result == 'failure'");
    });

    it("elle ne tourne PAS sur les propositions de fusion", () => {
      // Une PR n'a pas à toucher la base hébergée, et les secrets n'ont rien à
      // faire sur un chemin qu'une branche quelconque déclenche.
      const bloc = CI.slice(
        position("veille-hebergee:"),
        position("alarme-nuit-rouge:"),
      );
      expect(bloc).not.toContain("pull_request");
    });
  });

  describe("elle ne peut pas écrire", () => {
    it("verrouille la TRANSACTION, et non les sessions suivantes", () => {
      // **La différence a été mesurée, elle n'est pas de style.**
      // `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` ne verrouille
      // PAS la transaction en cours : un `DELETE` émis juste après passe sans
      // rien dire. Et Prisma répartit ses requêtes sur un POOL : un réglage de
      // session posé sur une connexion n'engage pas les autres. La première
      // rédaction de la veille portait cette faute, et c'est le scénario
      // d'isolation qui l'a révélée en échouant.
      expect(INSTRUCTION_LECTURE_SEULE).toBe("SET TRANSACTION READ ONLY");
      expect(INSTRUCTION_LECTURE_SEULE).not.toContain(
        "SESSION CHARACTERISTICS",
      );
    });

    it("le verrou est la PREMIÈRE instruction de la transaction", () => {
      // Une lecture seule posée après coup ne protégerait pas ce qui l'a
      // précédée. L'ordre est donc lu dans le fichier, pas supposé.
      const source = readFileSync(
        join(process.cwd(), "scripts/veille-hebergee.mts"),
        "utf8",
      );
      const ouverture = source.indexOf("$transaction(async (tx)");
      const verrou = source.indexOf(
        "tx.$executeRawUnsafe(INSTRUCTION_LECTURE_SEULE)",
      );
      const premiereLecture = source.indexOf("await observer(tx)");

      expect(ouverture).toBeGreaterThan(-1);
      expect(verrou).toBeGreaterThan(ouverture);
      expect(premiereLecture).toBeGreaterThan(verrou);
    });
  });

  describe("elle refuse de partir aveugle", () => {
    it("exige une base à observer, et c'est celle du rôle applicatif", () => {
      expect(() => urlVeille({})).toThrow(/DATABASE_URL/);
      expect(() => urlVeille({ DATABASE_URL: "   " })).toThrow(
        /rôle APPLICATIF/,
      );
      expect(urlVeille({ DATABASE_URL: "postgres://x" })).toBe("postgres://x");
      // Et elle ne se rabat PAS sur le secret privilégié s'il traîne dans
      // l'environnement : un repli silencieux vers le rôle de migration serait
      // exactement le défaut qu'on vient de retirer.
      expect(() =>
        urlVeille({ MIGRATION_DATABASE_URL: "postgres://privilegie" }),
      ).toThrow(/DATABASE_URL/);
    });
  });

  describe("elle appelle TOUS les contrôles que `scripts/lib/` déclare", () => {
    it("le périmètre est INVERSÉ : câblé par défaut, exclu par écrit", () => {
      // Le témoin d'abord, et il porte sur la POPULATION : zéro fonction
      // énumérée ressemblerait trait pour trait à un sans-faute (§9, 30/08).
      // Quatorze aujourd'hui, dont huit hors observation.
      const declares = controlesDeclares();
      expect(declares.length).toBeGreaterThanOrEqual(14);
      expect(SOURCES_LIB.size).toBeGreaterThanOrEqual(10);

      // Le cœur : déclarés moins exclus = câblés, en ÉGALITÉ d'ensembles. Un
      // contrôle écrit et jamais câblé fait échouer ici, le jour où il est
      // écrit — c'est ce que « six » ne pouvait pas faire.
      expect(controlesCables(VEILLE)).toEqual(controlesAttendus());
      expect(controlesAttendus().length).toBeGreaterThanOrEqual(6);

      // Et la liste `controles` en déclare autant qu'il y a de contrôles : un
      // appel présent mais rangé hors du tableau ne serait jamais joué.
      expect(VEILLE.match(/^\s+ecarts: /gm) ?? []).toHaveLength(
        controlesAttendus().length,
      );
    });

    it("chaque exclusion s'adosse à une fonction qui EXISTE, et se justifie", () => {
      // Le corollaire du 31/08 sur les sélections négatives : une exclusion qui
      // ne s'applique à personne ne fait échouer personne. Elle survit au
      // renommage de sa fonction, ne protège plus rien, et la prochaine
      // fonction qui reprendra ce nom en héritera sans que personne ne le lui
      // ait accordé.
      const declares = controlesDeclares();
      expect(HORS_OBSERVATION.length).toBeGreaterThan(0);
      for (const exclusion of HORS_OBSERVATION) {
        expect(declares, exclusion.fonction).toContain(exclusion.fonction);
        expect(
          exclusion.justification.trim().length,
          exclusion.fonction,
        ).toBeGreaterThan(40);
      }
    });

    it("ÉPREUVE PAR RETRAIT : un contrôle décâblé est vu", () => {
      // La faute écrite plutôt qu'imaginée (§9, 24/08) : on retire de la source
      // l'appel au contrôle des FORMES de politique — celui qui attrape la
      // politique de `client` desserrée à la main.
      const ampute = VEILLE.replace(
        /ecartsPolitiques\s*\(/g,
        "voidPolitiques(",
      );

      // LA SONDE : le retrait a-t-il réellement eu lieu ?
      expect(ampute).not.toBe(VEILLE);
      expect(controlesCables(ampute)).not.toContain("ecartsPolitiques");
      expect(controlesCables(ampute)).not.toEqual(controlesAttendus());
    });

    it("ÉPREUVE PAR AJOUT : un SEPTIÈME contrôle écrit et non câblé est vu", () => {
      // **Le cas que « six » laissait passer**, et la raison d'être de ce
      // ticket. On ajoute au source d'un module de `scripts/lib/` une fonction
      // d'écart telle qu'un lot 3 l'écrirait, et l'on n'y touche pas à la
      // veille. Le gardien doit la réclamer.
      const septieme = "ecartsPrivilegesDeSauvegarde";
      const sources = new Map(SOURCES_LIB);
      const [nom, texte] = [...sources.entries()][0];
      sources.set(
        nom,
        `${texte}\nexport function ${septieme}(): string[] {\n  return [];\n}\n`,
      );

      // LA SONDE : la fonction a-t-elle réellement été déclarée ?
      const declares = controlesDeclares(sources);
      expect(declares).toContain(septieme);
      expect(declares).toHaveLength(controlesDeclares().length + 1);

      // Et elle est EXIGÉE sans que personne ne l'ait inscrite nulle part.
      const attendus = controlesAttendus(declares);
      expect(attendus).toContain(septieme);
      expect(controlesCables(VEILLE, declares)).not.toEqual(attendus);
    });
  });

  describe("rouge parce que faute, rouge parce qu'injoignable", () => {
    it("distingue les deux, et par le CODE DE SORTIE", () => {
      // `EX_TEMPFAIL` de sysexits.h. Deux codes, parce que le flux doit pouvoir
      // choisir son fil d'issues sans lire un message.
      expect(CODE_SORTIE_ECART).toBe(1);
      expect(CODE_SORTIE_LIAISON).toBe(75);
      expect(CODE_SORTIE_ECART).not.toBe(CODE_SORTIE_LIAISON);
    });

    it("un écart CONSTATÉ n'est jamais pris pour une panne de liaison", () => {
      // Le sens qui compte : une base jointe et fautive ne doit pas se ranger
      // dans le fil « injoignable », où elle finirait par ne plus être lue.
      expect(estPanneDeLiaison(new EcartConstate("la base a dérivé"))).toBe(
        false,
      );
      expect(estPanneDeLiaison(new Error("n'importe quoi"))).toBe(false);
    });

    it("les codes Prisma de LIAISON sont reconnus", () => {
      // Témoin : une liste vide rendrait `estPanneDeLiaison` toujours faux, et
      // toute nuit injoignable serait classée « sécurité ».
      expect(CODES_LIAISON.length).toBeGreaterThanOrEqual(4);
      for (const code of CODES_LIAISON) {
        expect(estPanneDeLiaison({ errorCode: code }), code).toBe(true);
        expect(estPanneDeLiaison({ code }), code).toBe(true);
      }
      // Et l'erreur d'initialisation de Prisma, qui n'a pas toujours de code.
      const initiale = new Error("Can't reach database server");
      initiale.name = "PrismaClientInitializationError";
      expect(estPanneDeLiaison(initiale)).toBe(true);
    });

    it("un code Prisma qui n'est PAS de liaison ne s'y range pas", () => {
      // Sans ce sens-là, tout échec deviendrait « injoignable » et le fil
      // sécurité ne recevrait jamais rien.
      for (const code of ["P2002", "P2025", "P1000"]) {
        expect(estPanneDeLiaison({ errorCode: code }), code).toBe(false);
      }
    });
  });
});
