import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { Prisma, PrismaClient } from "@prisma/client";

import { SQL_TENTATIVES, type TentativeMigration } from "@/lib/db/sante";

import {
  PROVENANCE_NON_MESUREE,
  provenanceDesEcarts,
} from "./lib/provenance-ecart";
import { DELAIS_VEILLE } from "./lib/veille-delais";
import {
  NOM_DECLENCHEUR,
  SQL_DECLENCHEURS_AUDIT,
  ecartsDeclencheurs,
  rapportDeclencheurs,
  type TableObservee,
} from "./lib/perimetre-audit";
import {
  SQL_COLONNE_SOCIETE,
  SQL_POLITIQUES,
  ecartsPolitiques,
  ecartsWithCheckExplicite,
  SQL_COLONNES_PERIMETRE,
  ecartsPerimetreNullable,
  type ColonnePerimetre,
  rapportPolitiques,
  type ColonneSociete,
  type PolitiqueObservee,
} from "./lib/politiques-rls";
import {
  SQL_PRIVILEGES_CONSOLIDATION,
  ecartsPrivilegesConsolidation,
  rapportPrivileges,
  versPrivileges,
  type LignePrivilege,
} from "./lib/privileges-consolidation";
import {
  ROLE_APPLICATIF,
  SQL_PARTITIONS_JOURNAL,
  SQL_PRIVILEGES_JOURNAL,
  TABLE_JOURNAL_AUDIT,
  ecartsDurcissementPartitions,
  ecartsPrivilegesJournal,
  rapportPartitionsJournal,
  rapportPrivilegesJournal,
  versPartitionsJournal,
  versPrivilegesJournal,
  type LignePartitionJournal,
  type LignePrivilegeJournal,
} from "./lib/privileges-journal";
import {
  SQL_DEMANDES_CONTEXTE,
  demandesContexte,
  ecartsContexteArme,
  rapportContexte,
  type ExpressionObservee,
} from "./lib/contexte-rls";
import {
  SQL_ETAT_RLS,
  ecartsRlsDeclaree,
  rapportRlsDeclaree,
  type EtatRlsTable,
} from "./lib/rls-declaree";
import {
  TABLES_CLOISONNEES,
  TABLES_HORS_CLOISONNEMENT,
  decompteVide,
  ecartsSansContexte,
  ecartsTemoinLecture,
  type DecompteHorsCloisonnement,
} from "./lib/inventaire";
import {
  SQL_CONTRAINTES,
  ecartsContraintesNonValidees,
  rapportContraintesNonValidees,
  type ContrainteObservee,
} from "./lib/contraintes-non-validees";
import { sqlDecompteAPlat } from "./lib/tables-comptees";
import { verifierRoleApplicatif } from "../lib/db/garde-role";

/**
 * VEILLE DE LA BASE HÉBERGÉE — le détectif, à échéance fixe et en lecture seule.
 *
 * ## Le défaut que ce script répare, et il a été MESURÉ
 *
 * Les contrôles détectifs du dépôt — état RLS, formes de politique, privilèges
 * du journal, durcissement des partitions, privilèges de consolidation —
 * existent depuis L0-06 et sont bons. Mais ils ne s'exécutaient QUE dans
 * `db-migrate.yml`, dont le déclencheur est `workflow_dispatch` **et lui seul**,
 * par une décision explicite : une migration ne doit jamais partir toute seule.
 * Et le contrôle nocturne de `ci.yml` tourne contre un PostgreSQL **jetable**,
 * reconstruit à chaque exécution.
 *
 * **Conséquence, écrite platement : le détectif n'avait jamais regardé
 * l'endroit où la faute se produirait.** Il ne voyait la base hébergée que
 * lorsqu'un humain cliquait pour migrer. Entre deux migrations, il peut se
 * passer des semaines — et une garantie dont le déclenchement dépend de
 * l'initiative de quelqu'un n'est pas une garantie, c'est une intention. C'est
 * le même refus que celui opposé à la réparation « à lancer avant » de la clé
 * étrangère de L1-02.
 *
 * ## Ce qu'il regarde, et pourquoi la liste est celle-là
 *
 * Tout ce qu'une main peut défaire sur la base sans passer par une migration :
 * un `GRANT` de dépannage, un `DROP POLICY`, un `ALTER TABLE … DISABLE ROW
 * LEVEL SECURITY`, un `DROP TRIGGER`, une partition créée à la main. Ce sont
 * les gestes qui n'existent dans aucun fichier du dépôt, donc que le contrôle
 * statique ne peut pas voir par construction.
 *
 * **Aucune règle nouvelle n'est écrite ici.** Chaque contrôle appelle la
 * fonction pure qui le porte déjà, dans `scripts/lib/` — les mêmes que
 * `controle-cloisonnement.mts` joue après une migration et que les scénarios
 * d'isolation jouent sur la base jetable. Une seconde rédaction serait l'espèce
 * du §9 : deux lectures d'un même critère qui divergent en silence.
 *
 * **Et la liste ci-dessous n'est PAS tenue à la main : elle est fermée contre
 * `scripts/lib/`.** Toute fonction d'écart que ce répertoire déclare est un
 * contrôle de veille par défaut, et n'y échappe que par une exclusion écrite —
 * périmètre inversé, exactement comme celui de l'audit (D55). Le gardien et la
 * liste des exclusions vivent dans `tests/unit/veille-hebergee.test.ts`, et
 * c'est leur seule maison : un contrôle écrit demain et jamais câblé y fait
 * échouer la vérification le jour où il est écrit.
 *
 * ## LECTURE SEULE, et par la BASE plutôt que par la promesse
 *
 * La session est passée en `READ ONLY` avant toute autre instruction. Ce n'est
 * pas une intention : PostgreSQL refuse alors tout `INSERT`, `UPDATE`,
 * `DELETE`, `TRUNCATE` et tout DDL, avec `cannot execute … in a read-only
 * transaction`. Un scénario d'isolation le mesure plutôt que de le croire.
 *
 * C'est ce qui rend acceptable d'exécuter ce script avec le rôle de MIGRATION :
 * `information_schema.role_table_grants` n'est lisible que pour les droits dont
 * le rôle connecté est bénéficiaire ou concédant, et sous un autre rôle la
 * requête rendrait zéro ligne — un vide qui ressemble beaucoup trop à la
 * conformité (D38). Le rôle privilégié est donc nécessaire ; la lecture seule
 * est ce qui en borne l'usage.
 *
 * ## Ce qu'il ne fait PAS
 *
 * Ni migration, ni seed, ni purge. Les contrôles de `scripts/lib/` qu'elle ne
 * joue pas — l'inventaire comparé, le battement, les gardiens de listes du
 * dépôt — sont énumérés et JUSTIFIÉS un par un dans `HORS_OBSERVATION`
 * (`tests/unit/veille-hebergee.test.ts`). La raison ne se recopie pas ici : deux
 * copies que rien ne confronte divergent en silence (§9, 01/09).
 *
 * Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5).
 */

/**
 * L'instruction qui verrouille la TRANSACTION. Écrite une fois — un scénario
 * d'isolation la cite et mesure son effet.
 *
 * **`SET TRANSACTION READ ONLY`, et surtout PAS
 * `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`.** La différence n'est
 * pas de style, et elle a été mesurée : la seconde forme ne verrouille PAS la
 * transaction en cours — elle fixe le défaut des transactions SUIVANTES —, si
 * bien qu'un `DELETE` émis juste après passe sans rien dire. Pire, Prisma
 * répartit ses requêtes sur un POOL de connexions : un réglage de session posé
 * sur l'une n'engage pas les autres, et la veille aurait pu lire sous un verrou
 * qu'elle croyait avoir posé partout.
 *
 * Toute la veille tient donc dans UNE transaction explicite, dont c'est la
 * première instruction. C'est aussi ce qui lui donne un instantané cohérent :
 * les six contrôles observent le même état de la base, pas six états successifs.
 */
export const INSTRUCTION_LECTURE_SEULE = "SET TRANSACTION READ ONLY";

/**
 * L'URL du rôle APPLICATIF — le moins doté qui voie encore le catalogue.
 *
 * **Ce n'était pas le cas de la première rédaction, et c'était un vrai
 * défaut.** Elle se connectait avec le rôle de MIGRATION, parce que
 * `information_schema.role_table_grants` n'est lisible que pour les droits dont
 * le rôle connecté est bénéficiaire ou concédant — mesuré : sous
 * `codiplan_app`, elle rend zéro ligne pour les droits de `codiplan_reporting`.
 * On exposait donc chaque nuit, dans un travail automatique, une accréditation
 * capable de tout écrire, pour faire un travail qui ne demande que de lire un
 * catalogue. Le verrou `READ ONLY` protège de l'accident ; il ne protège pas de
 * l'accréditation elle-même.
 *
 * `aclexplode("relacl")` est lisible par n'importe quel rôle, et rend la même
 * observation. La veille se connecte donc avec `codiplan_app` : ni superuser,
 * ni `BYPASSRLS`, ni DDL, ni le moindre droit sur une table qu'il n'utilise pas.
 * Aucun rôle n'a été créé pour ce ticket.
 */
export function urlVeille(
  environnement: Record<string, string | undefined>,
): string {
  const url = environnement.DATABASE_URL;
  if (url === undefined || url.trim().length === 0) {
    throw new Error(
      "DATABASE_URL est vide : la veille n'a pas de base à observer. Elle " +
        "attend l'URL du rôle APPLICATIF — le moins doté qui voie le " +
        "catalogue —, jamais celle du rôle de migration : un travail qui ne " +
        "fait que lire n'a aucune raison de porter une accréditation capable " +
        "d'écrire.",
    );
  }
  return url;
}

/**
 * Codes de sortie — parce que ROUGE PARCE QUE FAUTE et ROUGE PARCE
 * QU'INJOIGNABLE ne sont pas la même nuit.
 *
 * Neon suspend une base inactive, et le premier réveil peut expirer. Une veille
 * qui rendrait le même rouge dans les deux cas apprendrait en trois semaines à
 * ne plus être lue — et l'on aurait reconstruit l'écart É12 avec plus de
 * machinerie. Une nuit injoignable est un incident d'EXPLOITATION ; une
 * partition nue est un incident de SÉCURITÉ. Le flux lit ces codes et n'ouvre
 * pas la même issue.
 */
export const CODE_SORTIE_ECART = 1;
/** `EX_TEMPFAIL` de `sysexits.h` : la chose a échoué, mais peut-être pas la chose. */
export const CODE_SORTIE_LIAISON = 75;

/**
 * Codes Prisma d'une base qu'on n'a pas pu joindre — par opposition à une base
 * jointe qui a répondu quelque chose de faux.
 *
 * `P1001` injoignable, `P1002` délai de connexion dépassé, `P1008` délai
 * d'opération dépassé, `P1017` le serveur a fermé la connexion. Les quatre
 * décrivent la LIAISON, jamais l'état de la base.
 */
export const CODES_LIAISON = ["P1001", "P1002", "P1008", "P1017"];

/**
 * L'échec est-il de liaison, ou constaté sur une base bel et bien jointe ?
 *
 * **Conservée pour ce qu'elle RECONNAÎT, jamais plus pour ce qu'elle décide.**
 * Elle sert au message : une base injoignable se dit autrement qu'une
 * observation interrompue. Le VERDICT, lui, est rendu par `codeDeSortie`, dont
 * le périmètre est inversé — voir sa note.
 */
export function estPanneDeLiaison(erreur: unknown): boolean {
  if (erreur instanceof EcartConstate) {
    return false;
  }
  const nom = erreur instanceof Error ? erreur.name : "";
  if (nom === "PrismaClientInitializationError") {
    return true;
  }
  const code: unknown = (erreur as { errorCode?: unknown; code?: unknown })
    ?.errorCode;
  const alternatif: unknown = (erreur as { code?: unknown })?.code;
  return (
    (typeof code === "string" && CODES_LIAISON.includes(code)) ||
    (typeof alternatif === "string" && CODES_LIAISON.includes(alternatif))
  );
}

/**
 * LE VERDICT, ET SON PÉRIMÈTRE EST INVERSÉ — l'incident du 12/09/2026.
 *
 * La rédaction précédente décidait sur `estPanneDeLiaison`, c'est-à-dire sur
 * une **liste d'admis** : quatre codes Prisma et un nom de classe. Tout ce
 * qu'elle ne reconnaissait pas tombait dans l'autre branche, et l'autre branche
 * est l'incident de SÉCURITÉ. *Le verdict le plus grave était le verdict par
 * défaut.*
 *
 * *Mesuré sur l'exécution `34708986360`, deux fois : la transaction
 * d'observation a expiré au bout de 5 199 ms puis 5 152 ms, sous un plafond de
 * 5 000 ms hérité de Prisma. La veille n'avait donc RIEN observé — et l'issue
 * `#169` s'est ouverte sous le titre « la base hébergée a DÉRIVÉ ».*
 *
 * **Un contrôle qui n'est pas allé au bout de son observation ne rend jamais un
 * écart : il rend une ABSENCE DE MESURE.** Seul `EcartConstate` vaut donc un
 * incident de sécurité — c'est la classe que `observer()` lève quand elle a bel
 * et bien regardé, le témoin « la veille n'a RIEN observé » compris. Tout le
 * reste est un incident d'EXPLOITATION, y compris ce que personne n'a prévu :
 * une liste d'admis oublie, un périmètre inversé ne peut pas (D55).
 */
export function codeDeSortie(erreur: unknown): number {
  return erreur instanceof EcartConstate
    ? CODE_SORTIE_ECART
    : CODE_SORTIE_LIAISON;
}

/** Un écart CONSTATÉ sur une base jointe — c'est un incident de sécurité. */
export class EcartConstate extends Error {}

/**
 * LA PROVENANCE EST TRANSMISE, JAMAIS REDÉRIVÉE PAR LE FLUX.
 *
 * L'alarme doit pouvoir dire à un lecteur de téléphone ce qu'il faut faire
 * AVANT de conclure. Ce texte est une MESURE ; la recopier dans `ci.yml` en
 * ferait une seconde rédaction, qui deviendrait fausse sans rougir. Même
 * transmission que `scripts/verifier-deploiement.mts`, et pour la même raison.
 *
 * Hors CI, `GITHUB_OUTPUT` est absent : la fonction n'écrit alors rien, et la
 * phrase reste sur la sortie standard, où un humain la lit.
 */
function publier(phrase: string): void {
  process.stdout.write(`${phrase}\n`);
  const sorties = process.env.GITHUB_OUTPUT;
  if (sorties !== undefined && sorties.trim().length > 0) {
    appendFileSync(
      sorties,
      `provenance<<FIN_PROVENANCE\n${phrase}\nFIN_PROVENANCE\n`,
    );
  }
}

/** Un contrôle : ce qu'il a observé, ce qu'il en dit, et ce qu'il refuse. */
type Controle = {
  readonly nom: string;
  readonly rapport: string;
  readonly ecarts: readonly string[];
};

async function veiller(): Promise<void> {
  const prisma = new PrismaClient({
    datasources: { db: { url: urlVeille(process.env) } },
  });

  try {
    // LES DÉLAIS SONT DÉCLARÉS, JAMAIS HÉRITÉS. Les 5 000 ms de Prisma sont
    // une valeur de réseau local ; la veille les a franchis en GROSSISSANT,
    // contrôle après contrôle. L'arithmétique qui les fixe et le gardien qui la
    // redemande à chaque ajout vivent dans `scripts/lib/veille-delais.ts`.
    await prisma.$transaction(async (tx) => {
      // PREMIÈRE INSTRUCTION DE LA TRANSACTION, et rien avant elle : une
      // lecture seule posée après coup ne protégerait pas ce qui l'a précédée.
      await tx.$executeRawUnsafe(INSTRUCTION_LECTURE_SEULE);
      await observer(tx);
    }, DELAIS_VEILLE);
  } finally {
    await prisma.$disconnect();
  }
}

/** Les contrôles d'observation, joués sur un instantané unique et verrouillé. */
async function observer(prisma: Prisma.TransactionClient): Promise<void> {
  {
    const colonnes =
      await prisma.$queryRawUnsafe<ColonneSociete[]>(SQL_COLONNE_SOCIETE);
    const politiques =
      await prisma.$queryRawUnsafe<PolitiqueObservee[]>(SQL_POLITIQUES);
    const etatRls = await prisma.$queryRawUnsafe<EtatRlsTable[]>(SQL_ETAT_RLS);
    const declencheurs = await prisma.$queryRawUnsafe<{ table: string }[]>(
      SQL_DECLENCHEURS_AUDIT,
      NOM_DECLENCHEUR,
    );
    const privilegesJournal = await prisma.$queryRawUnsafe<
      LignePrivilegeJournal[]
    >(SQL_PRIVILEGES_JOURNAL, ROLE_APPLICATIF, TABLE_JOURNAL_AUDIT);
    const partitions = await prisma.$queryRawUnsafe<LignePartitionJournal[]>(
      SQL_PARTITIONS_JOURNAL,
      ROLE_APPLICATIF,
    );
    const consolidation = await prisma.$queryRawUnsafe<LignePrivilege[]>(
      SQL_PRIVILEGES_CONSOLIDATION,
      "codiplan_reporting",
    );
    const expressions = await prisma.$queryRawUnsafe<ExpressionObservee[]>(
      SQL_DEMANDES_CONTEXTE,
    );
    const colonnesPerimetre = await prisma.$queryRawUnsafe<ColonnePerimetre[]>(
      SQL_COLONNES_PERIMETRE,
    );
    // UNE RÈGLE QUI NE VAUT QUE POUR UNE PARTIE DES LIGNES (D104). Une
    // contrainte `NOT VALID` est une décision ; sans ce contrôle, ce serait le
    // raccourci qui fait taire une migration, et rien ne le dirait.
    const contraintes =
      await prisma.$queryRawUnsafe<ContrainteObservee[]>(SQL_CONTRAINTES);
    // D'OÙ VIENDRAIT UN ÉCART (R1-01). Ce n'est PAS un contrôle : un retard de
    // migrations n'est pas une dérive, et le nommer comme tel doublerait le job
    // « déploiement ». C'est ce qui QUALIFIE le verdict des autres — et sans
    // quoi le gabarit affirmait une cause qu'il n'avait jamais mesurée.
    const tentatives =
      await prisma.$queryRawUnsafe<TentativeMigration[]>(SQL_TENTATIVES);

    // ── LA LECTURE, et non plus seulement le CATALOGUE (11/09/2026) ─────────
    //
    // Les neuf contrôles ci-dessus lisent `pg_policies`, `pg_class`,
    // `information_schema` : ils disent que les politiques SONT ÉCRITES comme
    // le dépôt l'exige. Aucun ne lit une seule LIGNE. Or « la preuve par
    // LECTURE est la plus forte » (§9, 31/08), et c'est elle qui ne tournait
    // que dans le flux de migration — donc jamais entre deux migrations.
    //
    // Le rôle est vérifié AVANT de compter : sous un rôle qui contourne les
    // politiques, zéro ligne ne prouverait rien et des lignes ne prouveraient
    // rien non plus. Le contrôle refuse alors de mesurer plutôt que de rendre
    // un verdict sur une observation qui ne veut rien dire.
    const diagnostic = await verifierRoleApplicatif(prisma);

    // Hors de tout contexte : la veille n'appelle jamais `avecSociete`, et
    // `set_config(…, true)` est local à la transaction. C'est bien l'absence
    // de contexte que l'on éprouve.
    const sansContexte = decompteVide();
    for (const ligne of await prisma.$queryRawUnsafe<
      Array<{ table: string; lignes: number }>
    >(sqlDecompteAPlat(TABLES_CLOISONNEES))) {
      sansContexte[ligne.table] = ligne.lignes;
    }
    const temoinsLecture: DecompteHorsCloisonnement = Object.fromEntries(
      TABLES_HORS_CLOISONNEMENT.map((table) => [table, 0]),
    );
    for (const ligne of await prisma.$queryRawUnsafe<
      Array<{ table: string; lignes: number }>
    >(sqlDecompteAPlat(TABLES_HORS_CLOISONNEMENT))) {
      temoinsLecture[ligne.table] = ligne.lignes;
    }

    const observees: TableObservee[] = colonnes.map((colonne) => ({
      table: colonne.table,
      societeIdObligatoire: colonne.presente && colonne.obligatoire,
    }));
    const tablesDeclenchees = declencheurs.map((ligne) => ligne.table);

    const controles: Controle[] = [
      {
        nom: "état déclaré de la sécurité au niveau des lignes",
        rapport: rapportRlsDeclaree(etatRls),
        ecarts: ecartsRlsDeclaree(etatRls),
      },
      {
        nom: "contraintes posées NOT VALID",
        rapport: rapportContraintesNonValidees(contraintes),
        ecarts: ecartsContraintesNonValidees(contraintes),
      },
      {
        nom: "formes de politique",
        rapport: rapportPolitiques(colonnes, politiques),
        ecarts: ecartsPolitiques(colonnes, politiques),
      },
      {
        nom: "périmètre d'audit",
        rapport: rapportDeclencheurs(observees, tablesDeclenchees),
        ecarts: ecartsDeclencheurs(observees, tablesDeclenchees),
      },
      {
        nom: "ajout seul du journal",
        rapport: rapportPrivilegesJournal(
          versPrivilegesJournal(privilegesJournal),
        ),
        ecarts: ecartsPrivilegesJournal(
          versPrivilegesJournal(privilegesJournal),
        ),
      },
      {
        nom: "durcissement des partitions du journal",
        rapport: rapportPartitionsJournal(versPartitionsJournal(partitions)),
        ecarts: ecartsDurcissementPartitions(versPartitionsJournal(partitions)),
      },
      {
        nom: "privilèges du rôle de consolidation",
        rapport: rapportPrivileges(versPrivileges(consolidation)),
        ecarts: ecartsPrivilegesConsolidation(versPrivileges(consolidation)),
      },
      {
        // La colonne de périmètre d'une table du parc peut être NULLABLE — une
        // ligne sans site est alors une ligne du CLIENT. Sans la branche
        // `IS NULL`, elle DISPARAÎT pour tout compte portail restreint, et la
        // faute ne casse rien de visible (L1-03).
        nom: "branche `IS NULL` sur une colonne de périmètre nullable",
        rapport:
          "Colonnes de périmètre nullables — observées dans " +
          "information_schema : " +
          `${
            colonnesPerimetre
              .filter((c) => c.table === "contact" && c.colonne === "site_id")
              .map((c) => `${c.table}.${c.colonne}=${c.nullable}`)
              .join(", ") || "(aucune)"
          }\n`,
        ecarts: ecartsPerimetreNullable(colonnesPerimetre, politiques),
      },
      {
        // Une politique qui n'énonce qu'un `USING` légifère EN SILENCE sur les
        // écritures : PostgreSQL y fait valoir la même expression. Mesuré sur
        // `utilisateur` (L1-02c) — une expression de lecture reprise en
        // écriture refuse la création, parce qu'au moment de l'insertion ce que
        // la lecture exige n'existe pas encore.
        nom: "WITH CHECK explicite sur les politiques d'écriture",
        rapport:
          "WITH CHECK explicite — politiques d'écriture observées : " +
          `${politiques
            .filter((p) =>
              ["ALL", "INSERT", "UPDATE"].includes(p.commande.toUpperCase()),
            )
            .map((p) => `${p.table}/${p.nom}`)
            .join(", ")}\n`,
        ecarts: ecartsWithCheckExplicite(politiques),
      },
      {
        // LE TÉMOIN AVANT LE VERDICT. `ecartsSansContexte` attend zéro
        // partout : une connexion aveugle rend le même résultat qu'un
        // cloisonnement parfait. Les référentiels de plateforme sont lisibles
        // `USING (true)`, sans contexte et sans privilège — les voir peuplés
        // est ce qui donne un sens aux zéros mesurés à côté.
        nom: "témoin de la lecture applicative",
        rapport:
          "Témoin de lecture — référentiels lus sous le rôle applicatif, " +
          "sans contexte (observé en base) : " +
          `${TABLES_HORS_CLOISONNEMENT.map(
            (table) => `${table}=${temoinsLecture[table]}`,
          ).join(", ")}\n`,
        ecarts: ecartsTemoinLecture(temoinsLecture),
      },
      {
        // LA LECTURE elle-même — le contrôle qui ne tournait qu'au moment
        // d'une migration, et qui rejoint ici le rythme nocturne.
        nom: "lecture sans contexte société",
        rapport:
          `Lecture sans contexte — rôle ${diagnostic.role} sur ` +
          `${diagnostic.base}, zéro attendu partout (observé en base) : ` +
          `${
            TABLES_CLOISONNEES.filter(
              (table) => (sansContexte[table] ?? 0) !== 0,
            )
              .map((table) => `${table}=${sansContexte[table]}`)
              .join(", ") ||
            `aucune ligne visible sur ${TABLES_CLOISONNEES.length} table(s)`
          }\n`,
        ecarts: ecartsSansContexte(sansContexte),
      },
      {
        // L'armement du cloisonnement, et non plus seulement sa définition
        // (L1-02b). Les cinq contrôles ci-dessus disent que les politiques sont
        // JUSTES ; celui-ci dit que quelqu'un pose les variables qu'elles
        // lisent. Une politique dont personne ne pose la variable ne garde rien
        // — et, sur la forme « parc », elle OUVRE.
        nom: "armement du contexte de session",
        rapport:
          rapportContexte(demandesContexte(expressions)).join("\n") + "\n",
        ecarts: ecartsContexteArme(demandesContexte(expressions)),
      },
    ];

    for (const controle of controles) {
      process.stdout.write(controle.rapport);
    }

    // TÉMOIN GLOBAL — et il s'AJOUTE aux écarts au lieu de les court-circuiter.
    //
    // Une base injoignable, un schéma vide ou une requête jouée ailleurs qu'on
    // ne croit produiraient des observations vides, et six contrôles verts sur
    // du vide ressemblent trait pour trait à six contrôles verts sur une base
    // saine (§9, 30/08). Chacun des six porte donc SA PROPRE garde de
    // population — le sixième, le périmètre d'audit, ne l'avait pas.
    //
    // Une première rédaction levait ici, avant de lire les six. Le message
    // était juste et la démonstration incomplète : on ne voyait pas que chaque
    // contrôle avait, lui aussi, refusé le vide. Le témoin global est donc un
    // écart de plus, en tête, et les six parlent derrière lui.
    const ecarts = controles.flatMap((controle) =>
      controle.ecarts.map((ecart) => `[${controle.nom}] ${ecart}`),
    );

    if (colonnes.length === 0 || politiques.length === 0) {
      ecarts.unshift(
        "[veille] la veille n'a RIEN observé : aucune table ou aucune " +
          "politique dans le schéma « public ». Base vide, mauvaise base, ou " +
          "requête jouée hors du schéma attendu — dans les trois cas, un " +
          "rapport vert ne prouverait rien.",
      );
    }

    // LA PROVENANCE EST MESURÉE, et elle sort d'ici dans les DEUX cas — écart
    // ou pas. Le flux la lit plutôt que de l'affirmer (R1-01) ; la recopier
    // dans `ci.yml` ferait deux rédactions d'un même texte, dont la seconde
    // deviendrait fausse sans rougir (§9, 01/09).
    const provenance = provenanceDesEcarts(tentatives);
    publier(provenance.phrase);

    if (ecarts.length > 0) {
      throw new EcartConstate(
        "INCIDENT DE SÉCURITÉ — la base hébergée s'est écartée de ce que le " +
          "dépôt exige :\n" +
          ecarts.map((ecart) => `  — ${ecart}`).join("\n") +
          `\n\n${provenance.phrase}`,
      );
    }

    // « 0 faute sur 13 partitions » est une preuve ; « 0 faute » n'en est pas
    // une. Le rapport final dit donc ce qu'il a VU, pas seulement ce qu'il n'a
    // pas trouvé.
    process.stdout.write(
      `Veille de la base hébergée : ${controles.length} contrôles, aucun écart, ` +
        `sur ${colonnes.length} table(s), ${politiques.length} politique(s), ` +
        `${etatRls.length} état(s) RLS, ${declencheurs.length} déclencheur(s), ` +
        `${partitions.length} partition(s), ` +
        `${privilegesJournal.length} privilège(s) de journal et ` +
        `${consolidation.length} de consolidation. ` +
        `Lecture sans contexte : aucune ligne sur ${TABLES_CLOISONNEES.length} ` +
        `table(s) cloisonnée(s), le témoin ayant rapporté ` +
        `${TABLES_HORS_CLOISONNEMENT.filter(
          (table) => (temoinsLecture[table] ?? 0) > 0,
        ).join(", ")} — sans quoi ces zéros ne prouveraient rien. ` +
        "Rôle applicatif, transaction en lecture seule. " +
        `Migrations : ${provenance.aJour ? "aucune en retard" : "EN RETARD"} ` +
        `sur ${tentatives.length} tentative(s) lue(s).\n`,
    );
  }
}

/**
 * Exécutée seulement en invocation directe : l'import du module par un test ne
 * déclenche aucune connexion. Même garde que `purge-demonstration.mts`, et pour
 * la même raison — un scénario qui importe `INSTRUCTION_LECTURE_SEULE` pour la
 * mesurer ne doit pas, ce faisant, ouvrir une session sur la base hébergée.
 */
const invoqueeDirectement =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invoqueeDirectement) {
  try {
    await veiller();
  } catch (erreur: unknown) {
    const code = codeDeSortie(erreur);
    const message = erreur instanceof Error ? erreur.message : String(erreur);

    if (code === CODE_SORTIE_LIAISON) {
      // RIEN N'A ÉTÉ CONSTATÉ, et la provenance doit le dire elle aussi : une
      // provenance absente se lirait « rien en retard » (§9, 31/08).
      publier(PROVENANCE_NON_MESUREE);
      process.stderr.write(
        estPanneDeLiaison(erreur)
          ? "INCIDENT D'EXPLOITATION — la base hébergée est INJOIGNABLE. La " +
              "veille n'a rien constaté : elle n'a pas pu regarder. Neon " +
              "suspend une base inactive et le premier réveil peut expirer ; " +
              "ce rouge-ci ne dit RIEN de l'état de la base.\n" +
              `${message}\n`
          : "INCIDENT D'EXPLOITATION — la veille N'EST PAS ALLÉE AU BOUT de " +
              "son observation. Elle n'a rien constaté, et ce rouge-ci ne dit " +
              "RIEN de l'état de la base : il dit que le contrôle a échoué. " +
              "Un contrôle interrompu ne rend jamais un écart.\n" +
              `${message}\n`,
      );
    } else {
      process.stderr.write(`${message}\n`);
    }
    process.exit(code);
  }
}
