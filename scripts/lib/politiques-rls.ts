/**
 * Les FORMES de politique RLS, et le gardien qui les mesure en base
 * (ticket R0-a, écart É9 de la revue R0 ; invariant I1 ; arbitrages D4, D10,
 * D22, D42 ; ticket L0-10 pour le journal).
 *
 * **Ce qu'il répare, et ce n'est pas une politique.** Le ticket L0-04 écrit
 * « **Forme imposée** : `societe_id = current_setting('app.societe_id')::uuid
 * OR societe_id IS NULL` », au singulier. Il y en a CINQ en vigueur, mesurées
 * dans `pg_policies` et non déduites d'une lecture. Une session du lot 1 qui
 * recopie « la forme imposée » sur `client`, `site` ou `modele_materiel` écrit
 * une politique fausse **dans le sens permissif** — et elle l'écrit en
 * obéissant. C'est le seul défaut du dépôt qu'on produit en suivant la
 * documentation.
 *
 * ## Les cinq formes, chacune avec son cas et un exemple en base
 *
 * | Forme | Clause | S'applique à | Exemple |
 * |---|---|---|---|
 * | **identité** | `id = app.societe_id` | `societe` SEULE — la table que `societe_id` désigne (D42) | `societe` |
 * | **société** | `societe_id = app.societe_id` | toute table métier ordinaire (I1, 1ʳᵉ catégorie) | `agence`, `calendrier`, `utilisateur_societe` |
 * | **référentiel** | lecture `USING (true)`, écriture `app_est_role_editeur()` | liste close des référentiels de plateforme (I1, 2ᵉ catégorie, D4) | `devise`, `parite`, `jour_ferie` |
 * | **parc** | société **ET** `app.client_id` **ET** `app.perimetre_sites` | `client`, `site`, `machine` — le portail (D10) et le chemin QR (D22) | fixtures du harnais aujourd'hui, tables réelles aux lots 1 et 2 |
 * | **journal** | `SELECT` : société **ET** habilitation ; `INSERT` seul ; ni `UPDATE` ni `DELETE` | `journal_audit` (I8, L0-10) | `journal_audit` |
 *
 * ## Celle qui NE s'applique PAS à une table métier ordinaire, et pourquoi
 *
 * **La forme « référentiel ».** Ses deux moitiés sont fausses sur une table
 * métier, et pour deux raisons distinctes :
 *
 *   1. sa lecture est `USING (true)` — *toutes* les sociétés lisent *toutes*
 *      les lignes. Sur `devise` c'est la décision D4 (« le franc Pacifique est
 *      le même partout ») ; sur `client` c'est la fin du cloisonnement ;
 *   2. son écriture est `app_est_role_editeur()` — elle donne au salarié de
 *      l'éditeur le droit d'écrire, et le retire à la société propriétaire.
 *      Sur un référentiel c'est l'objet même de la règle ; sur une table
 *      métier c'est l'inverse exact de ce que §22.5 promet au client.
 *
 * **Et la branche `OR societe_id IS NULL` de la forme imposée est un vestige,
 * pas une licence.** Sur une colonne `societe_id NOT NULL` — c'est-à-dire sur
 * toute table de la première catégorie de I1 — elle est **inerte** : aucune
 * ligne ne peut la satisfaire. Les six tables du lot 0 la portent encore parce
 * que L0-04 l'a écrite ; le gardien ne l'interdit donc pas, il **mesure son
 * inertie** — la colonne doit être `NOT NULL`. Le jour où elle ne l'est pas,
 * la branche devient une porte, et le gardien la nomme. Une table nouvelle
 * s'écrit sans elle.
 *
 * ## Pourquoi MESURÉE EN BASE, et non lue dans les migrations
 *
 * `pg_policies` rend l'expression **analysée**, pas le texte écrit. Les six
 * formes équivalentes du §9 s'y dissolvent d'elles-mêmes :
 *   — la **graphie** (forme 1) : guillemets, casse, schéma qualifiant sont
 *     normalisés par l'analyseur, il n'y a plus qu'une écriture à reconnaître ;
 *   — l'**enveloppe d'exécution** (forme 2) : une politique posée depuis un
 *     `DO $$ … $$` ou un `EXECUTE format(…)` est dans le catalogue comme une
 *     autre — c'est le résultat qui est lu, pas l'instruction ;
 *   — les **deux temps** (forme 3) : `CREATE` puis `DROP`, `ALTER POLICY`,
 *     `CREATE OR REPLACE` — le catalogue ne porte que l'état final ;
 *   — l'**assemblage délibéré** (forme 6), seul angle mort d'un gardien
 *     statique, disparaît lui aussi : un nom construit à l'exécution produit
 *     une politique réelle, donc visible ici.
 *
 * Ce que cette mesure ne voit pas, et qui se dit plutôt que se tait : elle ne
 * juge que les tables **présentes dans la base observée**. `client`, `site` et
 * `machine` n'existent pas encore en production — elles y seront jugées le jour
 * où la migration les crée, comme `perimetre-audit` juge le déclencheur
 * d'audit. Sur la base jetable du harnais, elles existent en fixtures et sont
 * jugées **dès aujourd'hui**.
 */

/**
 * Les cinq formes. Le message d'échec les cite : un développeur qui découvre ce
 * gardien doit comprendre ce qu'on lui demande sans ouvrir le CLAUDE.md.
 */
export const RAPPEL_FORMES = [
  "identité   — `id = app.societe_id` : `societe` seule (D42).",
  "société    — `societe_id = app.societe_id` : toute table métier ordinaire.",
  "référentiel — lecture `true`, écriture `app_est_role_editeur()` : liste " +
    "close de I1 (D4). NE S'APPLIQUE JAMAIS à une table métier.",
  "parc       — société ET `app.client_id` ET `app.perimetre_sites` : " +
    "`client`, `site`, `machine` (D10, D22).",
  "journal    — SELECT habilité, INSERT seul, ni UPDATE ni DELETE : " +
    "`journal_audit` (I8).",
].join("\n  ");

/** Les formes que ce gardien sait exiger. */
export type Forme = "identité" | "société" | "parc" | "journal";

/**
 * `societe` est cloisonnée par son IDENTITÉ (D42). Liste close, recopiée depuis
 * la constitution — comme `CLOISONNEE_PAR_IDENTITE` de `categories-i1`, et pour
 * la même raison : un gardien qui tirerait sa liste de la source qu'il juge ne
 * vérifierait rien.
 */
export const CLOISONNEE_PAR_IDENTITE = ["societe"] as const;

/**
 * Les tables du PARC, celles que le portail client traverse (D10) et par
 * lesquelles un QR code se résout (D22).
 *
 * `perimetre` dit si la table porte, en plus du filtre client, le filtre de
 * périmètre de sites. `client` ne le porte pas — elle EST le client, il n'y a
 * pas de site au-dessus d'elle.
 *
 * **Liste close, et gardée comme les autres** (`ecartsListeParc`). Elle est la
 * plus exposée de toutes : la retirer d'une table ne casse rien, ne fait
 * échouer aucun scénario, et **réduit silencieusement** ce que le harnais
 * couvre. C'est l'écart É14 de la revue R0, rendu mécanique.
 *
 * Le jour où `intervention` rejoindra le parc — D10 donne au portail la vue de
 * ses interventions —, ce sera un **arbitrage**, pris au lot 2, jamais une
 * ligne ajoutée en séance.
 */
export const TABLES_PARC = [
  { table: "client", perimetre: false },
  { table: "site", perimetre: true },
  { table: "machine", perimetre: true },
] as const;

/** Les trois entrées que D10 et D22 autorisent aujourd'hui. Recopiées. */
const PARC_ARBITRE = ["client", "site", "machine"];

/** Le journal d'audit : lecture habilitée, ajout seul (I8, L0-10). */
export const TABLES_JOURNAL = ["journal_audit"] as const;

/**
 * Référentiels de plateforme (I1, 2ᵉ catégorie). Ils ne relèvent PAS de la
 * première catégorie : le gardien les nomme seulement pour refuser la
 * contradiction — un référentiel qui porterait `societe_id NOT NULL` serait
 * dans deux catégories à la fois, ce que D41 interdit.
 */
export const REFERENTIELS_PLATEFORME = [
  "devise",
  "parite",
  "jour_ferie",
  "famille_materiel",
  "modele_materiel",
  "checklist_modele",
] as const;

/**
 * Écarts de la liste du parc elle-même — additions comme retraits.
 *
 * Le retrait est le cas dangereux, et c'est celui que la revue R0 a nommé : le
 * jour où L1-01 crée la vraie table `client`, retirer sa ligne d'ici ferait
 * retomber la table sur la forme « société », qui passe — et le filtre portail
 * de D10 disparaîtrait sans qu'aucun scénario ne rougisse.
 */
export function ecartsListeParc(
  liste: readonly string[] = TABLES_PARC.map((entree) => entree.table),
): string[] {
  const ecarts = liste
    .filter((table) => !PARC_ARBITRE.includes(table))
    .map(
      (table) =>
        `« ${table} » a été ajoutée aux TABLES_PARC : toute addition passe ` +
        "par un arbitrage, elle ne se décide pas dans un ticket.",
    );

  for (const attendue of PARC_ARBITRE) {
    if (!liste.includes(attendue)) {
      ecarts.push(
        `« ${attendue} » a été RETIRÉE des TABLES_PARC. C'est le retrait qui ` +
          "est dangereux, pas l'addition : la table retombe sur la forme " +
          "« société », qui passe, et le filtre portail de D10 comme le " +
          "chemin QR de D22 disparaissent sans qu'aucun scénario ne rougisse. " +
          "Toute modification passe par un arbitrage.",
      );
    }
  }

  return ecarts;
}

/** La colonne `societe_id` d'une table, telle que le catalogue la porte. */
export type ColonneSociete = {
  table: string;
  /** La colonne existe-t-elle ? */
  presente: boolean;
  /** Est-elle `NOT NULL` ? C'est ce qui rend la branche plateforme inerte. */
  obligatoire: boolean;
};

/** Une politique, telle que `pg_policies` la rend — expression ANALYSÉE. */
export type PolitiqueObservee = {
  table: string;
  nom: string;
  /** `PERMISSIVE` ou `RESTRICTIVE`. Les permissives se combinent par OU. */
  permissive: string;
  /** `ALL`, `SELECT`, `INSERT`, `UPDATE` ou `DELETE`. */
  commande: string;
  /** `qual` — ce que la politique laisse LIRE. */
  lecture: string | null;
  /** `with_check` — ce qu'elle laisse ÉCRIRE. */
  ecriture: string | null;
};

/**
 * Les tables du schéma `public` et l'état de leur colonne `societe_id`.
 *
 * Mêmes exclusions que `SQL_ETAT_RLS` : les partitions relèvent du contrôle
 * dédié, et `_prisma_migrations` est hors périmètre de I1.
 */
export const SQL_COLONNE_SOCIETE = `
  SELECT "c"."relname"::text                        AS "table",
         ("a"."attname" IS NOT NULL)                AS "presente",
         COALESCE("a"."attnotnull", false)          AS "obligatoire"
    FROM "pg_catalog"."pg_class" "c"
    JOIN "pg_catalog"."pg_namespace" "n" ON "n"."oid" = "c"."relnamespace"
    LEFT JOIN "pg_catalog"."pg_attribute" "a"
           ON "a"."attrelid" = "c"."oid"
          AND "a"."attname" = 'societe_id'
          AND NOT "a"."attisdropped"
   WHERE "n"."nspname" = 'public'
     AND "c"."relkind" IN ('r', 'p')
     AND NOT "c"."relispartition"
     AND "c"."relname" <> '_prisma_migrations'
   ORDER BY "c"."relname"
`;

/** Les politiques du schéma `public`, expression analysée comprise. */
export const SQL_POLITIQUES = `
  SELECT "p"."tablename"::text  AS "table",
         "p"."policyname"::text AS "nom",
         "p"."permissive"::text AS "permissive",
         "p"."cmd"::text        AS "commande",
         "p"."qual"             AS "lecture",
         "p"."with_check"       AS "ecriture"
    FROM "pg_catalog"."pg_policies" "p"
   WHERE "p"."schemaname" = 'public'
   ORDER BY "p"."tablename", "p"."policyname"
`;

/** Espaces et retours à la ligne réduits — le catalogue en met de son cru. */
function normaliser(clause: string): string {
  return clause.replace(/\s+/g, " ").trim();
}

/**
 * La clause est-elle ancrée sur `<colonne> = app.societe_id` ?
 *
 * Les deux écritures du dépôt sont acceptées : celle de D4 (`= current_setting`)
 * et celle du rétablissement de L0-05 (`= NULLIF(current_setting(…), '')::uuid`).
 * Le catalogue ayant analysé l'expression, il n'y a pas d'autre graphie à
 * craindre.
 */
function ancre(clause: string, colonne: string): boolean {
  const motif = new RegExp(
    `\\b${colonne}\\s*=\\s*\\(*\\s*(?:nullif\\s*\\(\\s*)?current_setting\\s*\\(\\s*'app\\.societe_id'`,
    "i",
  );
  return motif.test(normaliser(clause));
}

/** La branche plateforme `OR societe_id IS NULL` — inerte si la colonne l'est. */
function branchePlateforme(clause: string): boolean {
  return /\bsociete_id\s+is\s+null\b/i.test(normaliser(clause));
}

/** La clause admet-elle TOUTE ligne ? C'est la moitié lecture du référentiel. */
function ouvertureTotale(clause: string): boolean {
  const propre = normaliser(clause)
    .replace(/^\(+|\)+$/g, "")
    .trim();
  return propre.toLowerCase() === "true" || /\bor\s+true\b/i.test(clause);
}

/** L'écriture réservée aux rôles éditeur — l'autre moitié du référentiel. */
function roleEditeur(clause: string): boolean {
  return /\bapp_est_role_editeur\s*\(/i.test(clause);
}

/** Le filtre du compte portail (D10). */
function filtreClient(clause: string): boolean {
  return /'app\.client_id'/.test(clause);
}

/** Le filtre de périmètre de sites (D10). */
function filtrePerimetre(clause: string): boolean {
  return /'app\.perimetre_sites'/.test(clause);
}

/** L'habilitation de lecture du journal d'audit (§5.2). */
function habilitationJournal(clause: string): boolean {
  return /\bapp_peut_consulter_journal_audit\s*\(/i.test(clause);
}

/**
 * Les clauses d'une politique qui GARDENT réellement des lignes.
 *
 * `qual` ne s'applique pas à un `INSERT` et `with_check` ne s'applique pas à un
 * `SELECT` : juger la mauvaise moitié rendrait le gardien creux dans un sens ou
 * bruyant dans l'autre. Pour `ALL` et `UPDATE`, `with_check` absent signifie
 * « la même que `qual` » — c'est la règle de PostgreSQL, et elle est reprise
 * ici plutôt que supposée.
 */
function clausesGardiennes(politique: PolitiqueObservee): string[] {
  const commande = politique.commande.toUpperCase();
  const lecture = politique.lecture;
  const ecriture = politique.ecriture ?? politique.lecture;

  if (commande === "INSERT") {
    return politique.ecriture === null ? [] : [politique.ecriture];
  }
  if (commande === "SELECT" || commande === "DELETE") {
    return lecture === null ? [] : [lecture];
  }
  // ALL et UPDATE gardent des deux côtés.
  return [lecture, ecriture].filter(
    (clause): clause is string => clause !== null,
  );
}

/** Les commandes couvertes par un jeu de politiques. */
function couvreToutesCommandes(
  politiques: readonly PolitiqueObservee[],
): boolean {
  const commandes = new Set(politiques.map((p) => p.commande.toUpperCase()));
  if (commandes.has("ALL")) {
    return true;
  }
  return ["SELECT", "INSERT", "UPDATE", "DELETE"].every((c) =>
    commandes.has(c),
  );
}

/**
 * Les tables que I1 range dans sa PREMIÈRE catégorie, telles que la base les
 * montre : `societe` par exception (D42), plus toute table portant une colonne
 * `societe_id` sans être un référentiel de plateforme.
 *
 * **La colonne est retenue qu'elle soit `NOT NULL` ou non, et c'est le point.**
 * La première rédaction ne retenait que les colonnes obligatoires — si bien
 * qu'une table qui perdait son `NOT NULL` SORTAIT du périmètre du gardien au
 * lieu d'y être condamnée. Le contrôle passait au vert sur le geste même qui
 * ouvre la branche `OR societe_id IS NULL` : la vacuité du §9, dans le gardien
 * écrit pour la combattre, et démasquée par son propre jumeau. La nullité est
 * désormais un ÉCART, jamais une sortie.
 */
export function tablesPremiereCategorie(
  colonnes: readonly ColonneSociete[],
): ColonneSociete[] {
  return colonnes.filter(
    (colonne) =>
      (CLOISONNEE_PAR_IDENTITE as readonly string[]).includes(colonne.table) ||
      (colonne.presente &&
        !(REFERENTIELS_PLATEFORME as readonly string[]).includes(
          colonne.table,
        )),
  );
}

/** La forme attendue d'une table de la première catégorie de I1. */
export function formeAttendue(table: string): Forme {
  if ((CLOISONNEE_PAR_IDENTITE as readonly string[]).includes(table)) {
    return "identité";
  }
  if (TABLES_PARC.some((entree) => entree.table === table)) {
    return "parc";
  }
  if ((TABLES_JOURNAL as readonly string[]).includes(table)) {
    return "journal";
  }
  return "société";
}

/** Préfixe commun des messages : la table, sa forme, et le rappel. */
function entete(table: string, forme: Forme): string {
  return `« ${table} » relève de la première catégorie de I1 et doit porter la forme « ${forme} » — `;
}

/** Écarts de la forme « identité » (D42). */
function ecartsIdentite(
  table: string,
  politiques: readonly PolitiqueObservee[],
): string[] {
  const ecarts: string[] = [];

  for (const politique of politiques) {
    for (const clause of clausesGardiennes(politique)) {
      if (!ancre(clause, "id")) {
        ecarts.push(
          entete(table, "identité") +
            `la politique « ${politique.nom} » n'est pas ancrée sur ` +
            "`id = app.societe_id`. `societe` n'a pas de colonne `societe_id` : " +
            "elle EST la société, et c'est son `id` qui la cloisonne (D42).",
        );
      }
      if (ouvertureTotale(clause) || roleEditeur(clause)) {
        ecarts.push(
          entete(table, "identité") +
            `la politique « ${politique.nom} » porte la forme « référentiel » ` +
            "(`true` en lecture, `app_est_role_editeur()` en écriture). C'est " +
            "la forme qui NE s'applique JAMAIS à une table métier.",
        );
      }
    }
  }

  return ecarts;
}

/** Écarts des formes « société » et « parc » — la seconde ajoute à la première. */
function ecartsSociete(
  table: string,
  forme: Forme,
  politiques: readonly PolitiqueObservee[],
  colonne: ColonneSociete,
): string[] {
  const ecarts: string[] = [];
  const parc = TABLES_PARC.find((entree) => entree.table === table);

  for (const politique of politiques) {
    for (const clause of clausesGardiennes(politique)) {
      if (ouvertureTotale(clause)) {
        ecarts.push(
          entete(table, forme) +
            `la politique « ${politique.nom} » ouvre TOUTES les lignes ` +
            "(`true`). C'est la moitié lecture de la forme « référentiel », " +
            "légitime sur `devise` (D4) et jamais sur une table métier : elle " +
            "y supprime le cloisonnement.",
        );
        continue;
      }
      if (roleEditeur(clause)) {
        ecarts.push(
          entete(table, forme) +
            `la politique « ${politique.nom} » réserve l'accès à ` +
            "`app_est_role_editeur()`. C'est la moitié écriture de la forme " +
            "« référentiel » : elle donne le droit au salarié de l'éditeur et " +
            "le retire à la société propriétaire — l'inverse exact de ce que " +
            "le §22.5 promet au client.",
        );
        continue;
      }
      if (!ancre(clause, "societe_id")) {
        ecarts.push(
          entete(table, forme) +
            `la politique « ${politique.nom} » n'est pas ancrée sur ` +
            "`societe_id = app.societe_id`. Une politique permissive non " +
            "ancrée s'ajoute aux autres par OU : elle élargit, elle ne " +
            "restreint jamais.",
        );
        continue;
      }
      if (branchePlateforme(clause) && !colonne.obligatoire) {
        ecarts.push(
          entete(table, forme) +
            `la politique « ${politique.nom} » porte la branche ` +
            "`OR societe_id IS NULL` alors que la colonne est NULLABLE. Sur " +
            "une colonne `NOT NULL` cette branche est un vestige INERTE de la " +
            "rédaction de L0-04 ; ici elle est VIVANTE, et c'est une porte : " +
            "toute ligne sans société devient lisible et écrivable par toutes " +
            "les sociétés.",
        );
      }
      if (parc !== undefined && !filtreClient(clause)) {
        ecarts.push(
          entete(table, "parc") +
            `la politique « ${politique.nom} » a perdu le filtre ` +
            "`app.client_id`. C'est la réparation que la revue R0 redoutait : " +
            "la clause société seule PASSE, et un compte portail voit alors " +
            "tout le parc de la société au lieu du sien (D10).",
        );
      }
      if (parc?.perimetre === true && !filtrePerimetre(clause)) {
        ecarts.push(
          entete(table, "parc") +
            `la politique « ${politique.nom} » a perdu le filtre ` +
            "`app.perimetre_sites` : un compte portail restreint à un site en " +
            "voit alors d'autres (D10).",
        );
      }
    }
  }

  if (politiques.length > 0 && !couvreToutesCommandes(politiques)) {
    ecarts.push(
      entete(table, forme) +
        "ses politiques ne couvrent pas les quatre commandes. Une commande " +
        "sans politique n'est pas ouverte — elle est fermée —, mais " +
        "l'application ne peut plus l'exercer : c'est une panne, pas un " +
        "cloisonnement.",
    );
  }

  return ecarts;
}

/** Écarts de la forme « journal » — lecture habilitée, ajout seul (I8, L0-10). */
function ecartsJournal(
  table: string,
  politiques: readonly PolitiqueObservee[],
): string[] {
  const ecarts: string[] = [];
  const parCommande = (commande: string) =>
    politiques.filter((p) => p.commande.toUpperCase() === commande);

  for (const interdite of ["ALL", "UPDATE", "DELETE"]) {
    if (parCommande(interdite).length > 0) {
      ecarts.push(
        entete(table, "journal") +
          `une politique porte la commande ${interdite}. Le journal est en ` +
          "AJOUT SEUL (I8, D32) : une politique qui autorise la réécriture ou " +
          "l'effacement retire au mot « inaltérable » son seul contenu.",
      );
    }
  }

  const lectures = parCommande("SELECT");
  if (lectures.length === 0) {
    ecarts.push(
      entete(table, "journal") +
        "aucune politique de SELECT : le journal n'est consultable par " +
        "personne, pas même par `admin_societe` et `direction` (§5.2).",
    );
  }
  for (const lecture of lectures) {
    const clause = lecture.lecture ?? "";
    if (!ancre(clause, "societe_id")) {
      ecarts.push(
        entete(table, "journal") +
          `la politique de lecture « ${lecture.nom} » n'est pas ancrée sur ` +
          "`societe_id = app.societe_id` : une société lirait le journal " +
          "d'une autre.",
      );
    }
    if (!habilitationJournal(clause)) {
      ecarts.push(
        entete(table, "journal") +
          `la politique de lecture « ${lecture.nom} » n'exige plus ` +
          "`app_peut_consulter_journal_audit()` : tout rôle de la société y " +
          "lirait les valeurs avant/après de tout le métier (§5.2).",
      );
    }
  }

  const ajouts = parCommande("INSERT");
  if (ajouts.length === 0) {
    ecarts.push(
      entete(table, "journal") +
        "aucune politique d'INSERT : le déclencheur ne peut plus écrire, et " +
        "le journal cesse silencieusement d'être alimenté.",
    );
  }
  for (const ajout of ajouts) {
    if (!ancre(ajout.ecriture ?? "", "societe_id")) {
      ecarts.push(
        entete(table, "journal") +
          `la politique d'ajout « ${ajout.nom} » n'est pas ancrée sur ` +
          "`societe_id = app.societe_id` : une société écrirait au journal " +
          "d'une autre.",
      );
    }
  }

  return ecarts;
}

/**
 * Écarts entre ce que I1 exige et ce que la base porte réellement.
 *
 * Le renversement de D41, appliqué aux politiques : le contrôle part des
 * COLONNES observées — toute table portant `societe_id NOT NULL`, plus
 * `societe` par exception — et non d'une liste de tables à vérifier. Une table
 * métier créée demain sans sa politique fait tomber la vérification le jour où
 * elle est écrite.
 *
 * Trois témoins ouvrent la fonction, et ils comptent autant que les règles : un
 * décompte nul ressemble toujours à un sans-faute (§9, 30/08).
 */
export function ecartsPolitiques(
  colonnes: readonly ColonneSociete[],
  politiques: readonly PolitiqueObservee[],
): string[] {
  if (colonnes.length === 0) {
    return [
      "aucune table observée dans le schéma « public » : le contrôle des " +
        "formes de politique n'a rien établi. Base vide, mauvaise base, ou " +
        "requête jouée hors du schéma attendu.",
    ];
  }

  const premiereCategorie = tablesPremiereCategorie(colonnes);

  if (premiereCategorie.length === 0) {
    return [
      "aucune table de la PREMIÈRE catégorie de I1 observée : ni `societe`, " +
        "ni aucune table portant `societe_id`. Le contrôle des formes de " +
        "politique n'a rien gardé.",
    ];
  }

  if (politiques.length === 0) {
    return [
      "aucune politique observée dans `pg_policies` : le contrôle des formes " +
        "n'a rien lu. Les politiques ont-elles été appliquées ?",
    ];
  }

  const ecarts: string[] = [];

  // La contradiction inverse : un référentiel de plateforme qui porterait
  // `societe_id NOT NULL` relèverait de deux catégories à la fois (D41).
  for (const colonne of colonnes) {
    if (
      (REFERENTIELS_PLATEFORME as readonly string[]).includes(colonne.table) &&
      colonne.presente &&
      colonne.obligatoire
    ) {
      ecarts.push(
        `« ${colonne.table} » est un référentiel de plateforme (I1, 2ᵉ ` +
          "catégorie) et porte pourtant `societe_id NOT NULL` : elle relève " +
          "de deux catégories à la fois, ce que D41 interdit. Un référentiel " +
          "surchargeable porte `societe_id` NULLABLE (D4).",
      );
    }
  }

  for (const colonne of premiereCategorie) {
    const table = colonne.table;

    if (colonne.presente && !colonne.obligatoire) {
      ecarts.push(
        `« ${table} » relève de la première catégorie de I1 et porte un ` +
          "`societe_id` NULLABLE. Une table métier le porte `NOT NULL` ou " +
          "passe par un arbitrage — et une colonne nullable rend VIVANTE la " +
          "branche `OR societe_id IS NULL` que les politiques du lot 0 " +
          "traînent depuis L0-04.",
      );
    }

    const siennes = politiques.filter((p) => p.table === table);
    if (siennes.length === 0) {
      ecarts.push(
        entete(table, formeAttendue(table)) +
          "elle ne porte AUCUNE politique. Avec `FORCE ROW LEVEL SECURITY` et " +
          "sans politique, plus personne n'y lit ni n'y écrit : c'est une " +
          "panne, et elle se découvrira en production.",
      );
      continue;
    }

    const restrictives = siennes.filter(
      (p) => p.permissive.toUpperCase() !== "PERMISSIVE",
    );
    for (const politique of restrictives) {
      ecarts.push(
        entete(table, formeAttendue(table)) +
          `la politique « ${politique.nom} » est RESTRICTIVE. Aucune forme du ` +
          "dépôt ne l'est : une restrictive se combine par ET et peut rendre " +
          "muettes les permissives voisines sans qu'aucune d'elles ne change.",
      );
    }

    const forme = formeAttendue(table);
    if (forme === "identité") {
      ecarts.push(...ecartsIdentite(table, siennes));
    } else if (forme === "journal") {
      ecarts.push(...ecartsJournal(table, siennes));
    } else {
      ecarts.push(...ecartsSociete(table, forme, siennes, colonne));
    }
  }

  return ecarts;
}

/**
 * Rapport de journal — ce qui a été observé, avant tout verdict. Le décompte
 * par forme est le témoin lisible : une forme à zéro dit que le contrôle n'a
 * pas regardé ce qu'il croit regarder.
 */
export function rapportPolitiques(
  colonnes: readonly ColonneSociete[],
  politiques: readonly PolitiqueObservee[],
): string {
  const premiereCategorie = tablesPremiereCategorie(colonnes);
  const parForme = new Map<Forme, number>();
  for (const colonne of premiereCategorie) {
    const forme = formeAttendue(colonne.table);
    parForme.set(forme, (parForme.get(forme) ?? 0) + 1);
  }

  const detail = [...parForme.entries()]
    .map(([forme, nombre]) => `${nombre} « ${forme} »`)
    .join(", ");

  return [
    "Formes de politique RLS (observées dans pg_policies, non déclarées)",
    `  ${premiereCategorie.length} table(s) de la 1ʳᵉ catégorie de I1 : ${detail}`,
    `  ${politiques.length} politique(s) lue(s) au total`,
    "",
  ].join("\n");
}
