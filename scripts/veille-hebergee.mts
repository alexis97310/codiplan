import { pathToFileURL } from "node:url";

import { Prisma, PrismaClient } from "@prisma/client";

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
  SQL_ETAT_RLS,
  ecartsRlsDeclaree,
  rapportRlsDeclaree,
  type EtatRlsTable,
} from "./lib/rls-declaree";

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
 * Ni migration, ni seed, ni purge, ni inventaire comparé — ce dernier exige
 * d'écrire un fichier d'échange entre deux étapes et appartient à
 * `db-migrate.yml`, où il a un sens : il compare ce que le seed VIENT d'écrire
 * à ce que le rôle applicatif en voit. Une veille nocturne n'a rien écrit ; il
 * n'y a rien à comparer.
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
 * L'URL du rôle de MIGRATION, et le refus explicite de s'en passer.
 *
 * Sans elle, `information_schema.role_table_grants` rendrait zéro ligne et les
 * deux contrôles de privilèges passeraient au vert en n'ayant rien observé.
 * Zéro ligne est un échec (D38) — mais mieux vaut refuser de partir que
 * produire un rapport vert et creux.
 */
export function urlVeille(
  environnement: Record<string, string | undefined>,
): string {
  const url = environnement.MIGRATION_DATABASE_URL;
  if (url === undefined || url.trim().length === 0) {
    throw new Error(
      "MIGRATION_DATABASE_URL est vide : la veille ne peut pas lire " +
        "information_schema.role_table_grants, et les contrôles de privilèges " +
        "rendraient zéro ligne — un vide qui ressemble trop à la conformité. " +
        "La session est passée en LECTURE SEULE : ce rôle privilégié n'y écrit " +
        "rien.",
    );
  }
  return url;
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
    await prisma.$transaction(async (tx) => {
      // PREMIÈRE INSTRUCTION DE LA TRANSACTION, et rien avant elle : une
      // lecture seule posée après coup ne protégerait pas ce qui l'a précédée.
      await tx.$executeRawUnsafe(INSTRUCTION_LECTURE_SEULE);
      await observer(tx);
    });
  } finally {
    await prisma.$disconnect();
  }
}

/** Les six contrôles, joués sur un instantané unique et verrouillé. */
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
    ];

    for (const controle of controles) {
      process.stdout.write(controle.rapport);
    }

    // TÉMOIN GLOBAL. Une base injoignable, un schéma vide ou une requête jouée
    // ailleurs qu'on ne croit produiraient des observations vides — et six
    // contrôles verts sur du vide ressemblent trait pour trait à six contrôles
    // verts sur une base saine (§9, 30/08).
    if (colonnes.length === 0 || politiques.length === 0) {
      throw new Error(
        "La veille n'a RIEN observé : aucune table ou aucune politique dans " +
          "le schéma « public » de la base hébergée. Base vide, mauvaise base, " +
          "ou requête jouée hors du schéma attendu — dans les trois cas, un " +
          "rapport vert ne prouverait rien.",
      );
    }

    const ecarts = controles.flatMap((controle) =>
      controle.ecarts.map((ecart) => `[${controle.nom}] ${ecart}`),
    );

    if (ecarts.length > 0) {
      throw new Error(
        "La base hébergée s'est écartée de ce que le dépôt exige :\n" +
          ecarts.map((ecart) => `  — ${ecart}`).join("\n") +
          "\n\nCes écarts ne viennent d'aucune migration : ce sont des gestes " +
          "passés à la main sur la base. C'est exactement ce que cette veille " +
          "existe pour attraper, et ce que le contrôle statique ne peut pas " +
          "voir.",
      );
    }

    process.stdout.write(
      `Veille de la base hébergée : ${controles.length} contrôles, aucun écart. ` +
        "Lecture seule, aucune écriture émise.\n",
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
  await veiller();
}
