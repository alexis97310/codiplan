/**
 * LES MIGRATIONS QUI RESSERRENT UNE TABLE DÉJÀ PEUPLÉE — la classe de panne du
 * 11/09/2026, et le seul endroit d'où elle se voit.
 *
 * ## LA CLASSE, et pourquoi aucune porte ne la gardait
 *
 * `pnpm verify` migre une base **VIDE** puis la sème : toute ligne respecte par
 * construction la règle que la migration vient de poser. **Aucune migration
 * n'était donc jamais éprouvée contre des données PRÉEXISTANTES**, c'est-à-dire
 * contre le seul monde où elle s'appliquera vraiment.
 *
 * C'est le §9 du 02/09 — *une porte qui ne garde pas ce que garde la porte
 * suivante produit des verts sincères et faux* — pris par l'autre bout : les
 * commandes sont les mêmes, c'est **l'ÂGE de la base** qui diffère.
 *
 * ## CE QU'EST UN RESSERREMENT
 *
 * Un ordre qui RÉDUIT ce qu'une table accepte, posé sur une table qu'une
 * migration ANTÉRIEURE a créée. Sur une base vide il passe toujours ; sur une
 * base peuplée il peut échouer, et il échoue alors en bloquant **toutes** les
 * migrations qui suivent (`P3018`).
 *
 * Une table créée par la migration elle-même n'en est jamais un : elle naît
 * vide, et ce qu'elle accepte n'a pas encore d'histoire.
 *
 * Une contrainte posée `NOT VALID` n'en est pas un non plus, et c'est la
 * DÉFINITION de `NOT VALID` : elle ne relit pas les lignes d'avant (D104). Sa
 * contrepartie est ailleurs — `scripts/lib/contraintes-non-validees.ts` exige
 * qu'elle soit déclarée, avec son motif et son rattrapage.
 *
 * ## CE QUE CE MODULE NE PEUT PAS FAIRE, et qui se dit
 *
 * Il lit du SQL statiquement. Il ne suit ni un nom de table assemblé à
 * l'exécution, ni un ordre écrit dans un `EXECUTE format(…)` — la forme 6 du
 * §9 (26/08), qu'aucun motif statique n'arrête. Et il ne juge JAMAIS si un
 * resserrement est dangereux : *cela ne se lit pas, cela se rejoue.* Son rôle
 * est de désigner ce qui DOIT être rejoué ; le rejeu est
 * `tests/isolation/migrations-sur-base-agee.test.ts`.
 */

/** Une migration, telle que le lecteur de fichiers la donne à ce module. */
export type MigrationLue = {
  readonly nom: string;
  readonly sql: string;
};

export type Resserrement = {
  readonly migration: string;
  readonly table: string;
  readonly genre: string;
  readonly objet: string;
  /** La migration qui a créé la table — ce qui fait du resserrement un resserrement. */
  readonly neeEn: string;
};

/**
 * « Documentation contre exécution », jamais « code contre chaîne » (§9, 26/08).
 * Les migrations de ce dépôt sont très commentées, et leurs commentaires citent
 * abondamment les ordres qu'elles posent.
 */
function sansCommentaires(sql: string): string {
  return sql
    .split("\n")
    .filter((ligne) => !/^\s*--/.test(ligne))
    .join("\n");
}

/**
 * La fin de l'expression parenthésée qui commence à `depuis`, par comptage.
 * Une expression `CHECK` contient des parenthèses — s'arrêter à la première
 * fermante lirait `(("statut" = 'suspendue')` et manquerait le `NOT VALID` qui
 * suit l'expression entière.
 */
function finDeParenthese(texte: string, depuis: number): number {
  let profondeur = 0;
  for (let i = depuis; i < texte.length; i += 1) {
    if (texte[i] === "(") profondeur += 1;
    else if (texte[i] === ")") {
      profondeur -= 1;
      if (profondeur === 0) return i;
    }
  }
  return texte.length;
}

/** `NOT VALID` suit-il immédiatement, avant la prochaine action de l'ALTER ? */
function estNotValid(corps: string, apres: number): boolean {
  const suite = corps.slice(apres, apres + 200);
  const prochaineAction = suite.search(/,\s*(?:ADD|ALTER|DROP)\b/i);
  const portee =
    prochaineAction === -1 ? suite : suite.slice(0, prochaineAction);
  return /\bNOT\s+VALID\b/i.test(portee);
}

const ALTER_TABLE =
  /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?"?([a-z_][a-z0-9_]*)"?([\s\S]*?);/gi;
const CREATE_TABLE =
  /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z_][a-z0-9_]*)"?/gi;
const CREATE_UNIQUE_INDEX =
  /CREATE\s+UNIQUE\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z0-9_]+)"?\s+ON\s+(?:ONLY\s+)?"?([a-z_][a-z0-9_]*)"?/gi;

/**
 * Les resserrements de la suite de migrations, dans l'ordre.
 *
 * La population est DÉRIVÉE du répertoire des migrations — une source que ce
 * module ne contrôle pas. Une migration écrite demain y entre d'elle-même, et
 * c'est tout l'objet : *une liste close tenue à la main devient fausse à
 * l'objet suivant* (§9, 20/08).
 */
export function resserrements(
  migrations: readonly MigrationLue[],
): Resserrement[] {
  const neeEn = new Map<string, string>();
  const trouves: Resserrement[] = [];

  for (const migration of migrations) {
    const sql = sansCommentaires(migration.sql);
    const ajoute = (genre: string, table: string, objet: string): void => {
      const naissance = neeEn.get(table);
      // Table inconnue, ou créée par CETTE migration : elle naît vide.
      if (naissance === undefined || naissance === migration.nom) return;
      trouves.push({
        migration: migration.nom,
        table,
        genre,
        objet,
        neeEn: naissance,
      });
    };

    for (const alter of sql.matchAll(ALTER_TABLE)) {
      const table = alter[1]!;
      const corps = alter[2]!;

      for (const check of corps.matchAll(
        /ADD\s+CONSTRAINT\s+"?([a-z0-9_]+)"?\s+CHECK\s*\(/gi,
      )) {
        const ouverture = check.index! + check[0]!.length - 1;
        const fin = finDeParenthese(corps, ouverture);
        if (estNotValid(corps, fin)) continue;
        ajoute("CHECK", table, check[1]!);
      }

      for (const fk of corps.matchAll(
        /ADD\s+CONSTRAINT\s+"?([a-z0-9_]+)"?\s+FOREIGN\s+KEY\s*\(/gi,
      )) {
        const ouverture = fk.index! + fk[0]!.length - 1;
        // Une clé étrangère porte DEUX parenthèses — les colonnes, puis celles
        // de la table référencée — et `NOT VALID` suit la seconde.
        const premiere = finDeParenthese(corps, ouverture);
        const seconde = corps.indexOf("(", premiere);
        const fin = seconde === -1 ? premiere : finDeParenthese(corps, seconde);
        if (estNotValid(corps, fin)) continue;
        ajoute("FOREIGN KEY", table, fk[1]!);
      }

      // ── TROIS FORMES RECONNUES, ET L'UNE D'ELLES A CESSÉ D'ÊTRE ABSENTE ─
      //
      // ~~Mesuré le 11/09/2026 sur les 47 migrations : `VALIDATE CONSTRAINT`,
      // `ATTACH PARTITION` et `EXCLUDE` n'y apparaissent **nulle part**.~~
      // **`VALIDATE CONSTRAINT` EST ÉCRIT DEPUIS LE 12/09/2026** — la
      // migration `20260913250000_rattrapage_suspensions_r3_02` valide les
      // deux contraintes de suspension (R3-02, D117). *Et c'est le témoin
      // posé la veille qui l'a dit, pas la relecture* : il existait pour
      // rougir ce jour-là, et il a rougi. `ATTACH PARTITION` et `EXCLUDE`
      // restent absentes, mesurées.
      // Elles sont reconnues quand même, et ce n'est pas de la précaution
      // décorative : *un lecteur qui ne connaît que ce qui existe devient faux
      // le jour où quelqu'un écrit autre chose*, et il le devient EN SILENCE —
      // la direction permissive, celle qui ne produit aucun signal.
      //
      // Elles sont éprouvées sur des migrations FABRIQUÉES, faute de réelles :
      // c'est le seul cas où le §9 du 21/08 — « un gardien vert sur un cas
      // fabriqué n'est pas un gardien éprouvé » — ne peut pas être satisfait,
      // et la limite est écrite plutôt que tue.
      for (const validation of corps.matchAll(
        /VALIDATE\s+CONSTRAINT\s+"?([a-z0-9_]+)"?/gi,
      )) {
        ajoute("VALIDATE CONSTRAINT", table, validation[1]!);
      }

      for (const attache of corps.matchAll(
        /ATTACH\s+PARTITION\s+"?([a-z0-9_]+)"?/gi,
      )) {
        ajoute("ATTACH PARTITION", table, attache[1]!);
      }

      for (const exclusion of corps.matchAll(
        /ADD\s+CONSTRAINT\s+"?([a-z0-9_]+)"?\s+EXCLUDE\b/gi,
      )) {
        ajoute("EXCLUDE", table, exclusion[1]!);
      }

      for (const unique of corps.matchAll(
        /ADD\s+CONSTRAINT\s+"?([a-z0-9_]+)"?\s+(UNIQUE|PRIMARY\s+KEY)/gi,
      )) {
        ajoute(
          unique[2]!.toUpperCase().replace(/\s+/g, " "),
          table,
          unique[1]!,
        );
      }

      // UN CHANGEMENT DE TYPE EST UN RESSERREMENT, et il s'oublie parce qu'il
      // ne ressemble pas à une contrainte. `ALTER COLUMN … TYPE uuid USING
      // …::uuid` réussit toujours sur une table vide et échoue sur la première
      // valeur que la conversion refuse. *Mesuré : c'est la seule autre forme
      // de rétrécissement présente au dépôt* — `20260820140000_identifiants_uuid`,
      // qui convertit onze colonnes de `text` vers `uuid`.
      for (const type of corps.matchAll(
        /ALTER\s+COLUMN\s+"?([a-z0-9_]+)"?\s+(?:SET\s+DATA\s+)?TYPE\s+/gi,
      )) {
        ajoute("ALTER COLUMN TYPE", table, type[1]!);
      }

      for (const notNull of corps.matchAll(
        /ALTER\s+COLUMN\s+"?([a-z0-9_]+)"?\s+SET\s+NOT\s+NULL/gi,
      )) {
        ajoute("SET NOT NULL", table, notNull[1]!);
      }

      // Une colonne obligatoire SANS défaut est refusée dès qu'une ligne
      // existe ; avec un défaut, PostgreSQL la remplit.
      for (const colonne of corps.matchAll(
        /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z0-9_]+)"?([^,;]*)/gi,
      )) {
        const suite = colonne[2]!;
        if (/\bNOT\s+NULL\b/i.test(suite) && !/\bDEFAULT\b/i.test(suite)) {
          ajoute("ADD COLUMN NOT NULL sans DEFAULT", table, colonne[1]!);
        }
      }
    }

    for (const index of sql.matchAll(CREATE_UNIQUE_INDEX)) {
      ajoute("UNIQUE INDEX", index[2]!, index[1]!);
    }

    // Les tables créées par CETTE migration ne comptent qu'à partir de la
    // SUIVANTE — d'où l'enregistrement après l'analyse.
    for (const creation of sql.matchAll(CREATE_TABLE)) {
      if (!neeEn.has(creation[1]!)) neeEn.set(creation[1]!, migration.nom);
    }
  }

  return trouves;
}

/** Les migrations qui resserrent, sans doublon et dans l'ordre. */
export function migrationsQuiResserrent(
  trouves: readonly Resserrement[],
): string[] {
  return [...new Set(trouves.map((r) => r.migration))];
}

/**
 * LES RESSERREMENTS DÉJÀ APPLIQUÉS PARTOUT, et pourquoi ils n'ont pas de rejeu.
 *
 * **Un défaut connu et inventorié n'est pas le même objet qu'un défaut connu et
 * unique** (§9, 07/09). Ces migrations se sont appliquées à la base de
 * démonstration — la seule base en service au 11/09/2026 —, et une base de
 * production neuve les reçoit toutes d'un coup sur un schéma VIDE. *Le rejeu
 * contre des données ne répondrait donc à aucune question ouverte pour elles :
 * la réponse est déjà écrite dans `_prisma_migrations`.*
 *
 * **Cette liste est FERMÉE par le passé, pas par une décision.** Une migration
 * écrite demain n'y est pas et ne peut pas y entrer : le critère est d'avoir
 * été appliquée avant que ce gardien existe. C'est ce qui la distingue d'une
 * exemption — on ne peut pas s'en réclamer.
 */
export const RESSERREMENTS_DEJA_APPLIQUES: readonly {
  readonly migration: string;
  readonly justification: string;
}[] = [
  {
    migration: "20260820140000_identifiants_uuid",
    justification:
      "Cinq clés étrangères posées sur les tables du socle. Appliquée à la " +
      "base de démonstration le 20/08/2026 ; immuable depuis.",
  },
  {
    migration: "20260821120000_calendriers_agence_et_feries",
    justification:
      "Une contrainte de forme sur `agence.territoire` et une clé étrangère " +
      "vers `calendrier`. Appliquée ; immuable.",
  },
  {
    migration: "20260823130000_territoire_du_ferie_reference",
    justification:
      "Le plus lourd du lot : deux `SET NOT NULL`, deux clés composites, " +
      "deux index uniques. C'est aussi celui dont les blocs de garde sont " +
      "INVENTORIÉS comme aveugles (`GARDES_AVEUGLES_CONNUES`) — même " +
      "migration, deux inventaires, deux motifs distincts. Appliquée ; " +
      "immuable.",
  },
  {
    migration: "20260828120000_charte_societe_optionnelle",
    justification:
      "Deux contraintes de forme sur les couleurs de `societe`. Appliquée ; " +
      "immuable.",
  },
  {
    migration: "20260906120000_site_l1_02",
    justification:
      "Une clé étrangère sur `utilisateur_client`, deux index uniques de " +
      "chaînage. Appliquée ; immuable.",
  },
  {
    migration: "20260907120000_perimetre_sites_l1_02b",
    justification: "Deux index uniques de chaînage. Appliquée ; immuable.",
  },
  {
    migration: "20260907140000_contact_l1_03",
    justification: "Un index unique de chaînage. Appliquée ; immuable.",
  },
  {
    migration: "20260909200000_intervention_l2_planning",
    justification:
      "Un index unique de chaînage sur `forfait`. Appliquée ; immuable.",
  },
  {
    migration: "20260909210000_parametrage_par_agence",
    justification:
      "Une borne sur le pas de créneau et un index unique de chaînage sur " +
      "`calendrier`. Appliquée ; immuable.",
  },
  {
    migration: "20260910030000_forfait_rang_d86",
    justification:
      "`SET NOT NULL` sur `forfait.rang` et l'index unique du rang. La " +
      "migration porte son propre rattrapage — elle renseigne le rang avant " +
      "de le rendre obligatoire —, et c'est exactement la forme qu'on " +
      "demande aux nouvelles. Appliquée ; immuable.",
  },
  {
    migration: "20260911020000_assujettissement_vgp_l9",
    justification:
      "Cinq contraintes sur `famille_materiel`, `modele_materiel` et " +
      "`machine`. Toutes portent sur des colonnes qui NAISSENT dans cette " +
      "migration, donc nulles partout : elles ne pouvaient rien refuser. " +
      "Appliquée ; immuable.",
  },
] as const;

/**
 * LES TABLES QU'AUCUN CHEMIN NE POUVAIT REMPLIR au moment du resserrement.
 *
 * Le rejeu exige que la table resserrée porte des lignes : *une migration
 * éprouvée contre une table vide n'est pas éprouvée du tout.* Il existe pourtant
 * un cas où ce n'est pas un manque d'amorce — c'est une **impossibilité
 * mesurée**, et elle vaut mieux qu'un contournement silencieux.
 *
 * Gardée dans les deux sens : une entrée dont la table se remplit RÉELLEMENT au
 * rejeu rougit, parce qu'elle exemptait alors sans raison.
 */
export const TABLES_VIDES_AU_RESSERREMENT: readonly {
  readonly migration: string;
  readonly table: string;
  readonly mesure: string;
}[] = [
  {
    migration: "20260913170000_technicien_l3_01a",
    table: "technicien_calendrier",
    mesure:
      "Son déclencheur d'audit REFUSE toute écriture tant que la table n'a " +
      "pas de colonne `id` — « journal_audit : la table " +
      "« technicien_calendrier » n'expose aucune colonne « id » » —, et `id` " +
      "n'arrive QUE dans cette migration. Mesuré le 11/09/2026 en tentant " +
      "l'insertion depuis l'amorce du rejeu. La table est donc prouvée vide à " +
      "ce point de l'histoire : aucun chemin n'a jamais pu y écrire, et son " +
      "index unique ne peut rien refuser.",
  },
] as const;

/**
 * IL N'Y A PAS DE FONCTION D'ÉCART ICI, ET C'EST UNE DÉCISION.
 *
 * La première rédaction en portait une — `ecartsResserrementsEprouves`,
 * confrontant les resserrements à une liste de migrations « rejouées ». Elle
 * **n'avait aucun appelant** : le rejeu dérive ses arrêts de `resserrements()`
 * lui-même, si bien que toute migration hors inventaire y est rejouée par
 * CONSTRUCTION, et qu'une liste de « rejouées » n'aurait été qu'une seconde
 * écriture du même fait.
 *
 * *Une interface sans appelant est la maladie que le portail a soignée* (§6 du
 * CLAUDE.md) : elle est juste, personne ne l'exerce, et on la découvre fausse
 * le jour où quelqu'un s'y fie. Elle a été retirée plutôt que gardée « au cas
 * où ».
 *
 * **Ce qui fait rougir un resserrement non éprouvé n'est donc pas une liste,
 * c'est le rejeu** : `tests/isolation/migrations-sur-base-agee.test.ts`
 * s'arrête avant chaque resserrement hors inventaire et refuse une table vide.
 * Les deux listes closes de ce module sont gardées dans les deux sens par
 * `tests/unit/db/resserrements-migration.test.ts`.
 */
