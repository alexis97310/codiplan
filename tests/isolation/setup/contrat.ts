import {
  VARIABLE_SESSION_CLIENT,
  VARIABLE_SESSION_PERIMETRE,
  VARIABLE_SESSION_ROLE,
  VARIABLE_SESSION_SOCIETE,
} from "@/lib/db/rls";

/**
 * LE CONTRAT DES FIXTURES D'ISOLATION — ce que le harnais doit continuer de
 * couvrir quand les vraies tables arriveront (ticket R0-a, écart É14 de la
 * revue R0 ; ticket L0-05 ; arbitrages D10 et D22).
 *
 * ## Le risque, tel qu'il est écrit
 *
 * `client`, `site` et `machine` existent aujourd'hui comme **tables fixtures**.
 * Elles portent les politiques du parc — filtre société, filtre `app.client_id`
 * du portail (D10), filtre `app.perimetre_sites` — et elles modèlent les
 * chemins que **L0-05 a déclarés obligatoires** : résolution QR inter-société
 * (D22), accès d'un compte portail aux données d'un autre client, respect du
 * périmètre de sites.
 *
 * Le jour où L1-01 crée la vraie table `client`, le harnais échoue bruyamment
 * sur `CREATE TABLE`. **Et la réparation la plus naturelle est la mauvaise** :
 * supprimer la fixture, pointer les scénarios sur la vraie table, lui donner la
 * « forme imposée » du backlog — la clause société seule. Tout redevient vert,
 * sur moins de choses. C'est le seul endroit du dépôt où une réparation
 * plausible RÉDUIT la couverture sans qu'aucun gardien ne s'en aperçoive : non
 * pas un gardien qui ne regarde rien, mais **un gardien à qui l'on retire ce
 * qu'il regardait**.
 *
 * ## Ce que ce module change
 *
 * Le contrat cesse de vivre dans des commentaires de test. Il est **déclaré
 * ici**, et trois gardiens indépendants le tiennent — chacun échouerait seul :
 *
 *   1. `tests/isolation/politiques-rls.test.ts` mesure dans `pg_policies` que
 *      `client`, `site` et `machine` portent la forme « parc », **fixture ou
 *      table réelle, sans faire la différence**. Remplacer la fixture par une
 *      vraie table à politique société seule fait rougir ce gardien, et il
 *      nomme le filtre perdu ;
 *   2. `scripts/lib/politiques-rls.ts` tient la liste `TABLES_PARC` comme une
 *      liste close : en RETIRER une entrée est refusé, parce que c'est le
 *      retrait — et non l'addition — qui ouvre la brèche ici ;
 *   3. `tests/unit/db/contrat-isolation.test.ts` compte les scénarios qui
 *      honorent chaque exigence de L0-05 et refuse que le nombre BAISSE. Les
 *      scénarios D10 et D22 doivent rester plus nombreux après la reprise,
 *      jamais moins.
 *
 * Et `global.ts` ne crée plus la fixture quand la vraie table existe : il la
 * laisse en place et **laisse les gardiens la juger**, en disant à la session
 * qui arrive là ce qu'elle doit faire. Le message est à l'endroit et au moment
 * où la faute se commettrait.
 *
 * Ce module ne dépend de rien — ni de Prisma, ni des fixtures. C'est ce qui
 * permet au gardien statique de `tests/unit/` de le lire sans ouvrir de base.
 */

/**
 * Variables de session lues par les politiques RLS — **réexportées depuis le
 * chemin de production, jamais redéclarées ici** (L1-02b).
 *
 * Elles étaient définies en toutes lettres dans ce fichier, et c'est ce qui a
 * permis au harnais de poser `app.client_id` pendant que `lib/db/rls.ts` ne la
 * posait pas : deux listes qui pouvaient diverger, et qui ont divergé, sans
 * qu'aucun test ne rougisse. Le harnais tire désormais ses noms de la SEULE
 * source qui les pose en production — ce qui rend structurellement impossible
 * qu'il arme une variable que la production ignore.
 *
 * `lib/db/rls.ts` n'importe que des types : ce module reste sans dépendance
 * d'exécution, ce qui permet au gardien statique de `tests/unit/` de le lire
 * sans ouvrir de base.
 */
export const VAR_SOCIETE = VARIABLE_SESSION_SOCIETE;
export const VAR_ROLE = VARIABLE_SESSION_ROLE;
export const VAR_CLIENT = VARIABLE_SESSION_CLIENT;
export const VAR_PERIMETRE = VARIABLE_SESSION_PERIMETRE;

/**
 * Politique de cloisonnement société, forme imposée (D4) — `::uuid` compris —,
 * rendue « zéro ligne hors contexte » (voir la migration
 * `20260820140000_identifiants_uuid`). Réutilisée à l'identique par les tables
 * fixtures pour que le contrat testé soit le contrat réel. `FORCE` est posé
 * comme sur les vraies tables cloisonnées.
 */
export function politiqueCloisonnementSql(table: string): string {
  const propre = `"societe_id" = NULLIF(current_setting('${VAR_SOCIETE}', true), '')::uuid`;
  const plateforme = `"societe_id" IS NULL`;
  // Lecture : sa propre société, plus les référentiels de plateforme (D4).
  const lecture = `${propre} OR ${plateforme}`;
  // Écriture : sa propre société ; une ligne de plateforme n'est modifiable que
  // par un rôle éditeur (I1). C'est la règle que la migration
  // `20260820150000_authentification_et_roles` pose sur `devise` et `parite` ;
  // les fixtures l'honorent à l'identique, sans quoi le contrat éprouvé ici ne
  // serait pas celui des vraies tables.
  const ecriture = `${propre} OR (${plateforme} AND "app_est_role_editeur"())`;
  return `
    ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;
    CREATE POLICY "cloisonnement_societe" ON "${table}"
      USING (${lecture}) WITH CHECK (${ecriture});
  `;
}

/**
 * Politique du parc pour un compte portail (D10, D22). Superpose au filtre
 * société :
 *   - `app.client_id` positionné (compte portail) ⇒ un seul client visible ;
 *     absent (utilisateur interne) ⇒ tout le parc de la société ;
 *   - `app.perimetre_sites` (liste d'UUID séparés par des virgules, convertie en
 *     `uuid[]`) ⇒ visibilité restreinte à ces sites ; absent ⇒ tous les sites
 *     du client.
 * Sert `client`, `site` et `machine` : la résolution QR passe par `machine` et
 * hérite donc du même filtrage. `colonneClient` porte l'identité du client
 * (`id` sur la table `client` elle-même, `client_id` ailleurs).
 */
export function politiqueParcSql(
  table: string,
  colonneClient: string,
  colonneSite: string | null,
): string {
  const filtreSociete = `"societe_id" = NULLIF(current_setting('${VAR_SOCIETE}', true), '')::uuid`;
  const filtreClient = `(
    NULLIF(current_setting('${VAR_CLIENT}', true), '') IS NULL
    OR "${colonneClient}" = NULLIF(current_setting('${VAR_CLIENT}', true), '')::uuid
  )`;
  const filtreSite =
    colonneSite === null
      ? "true"
      : `(
    NULLIF(current_setting('${VAR_PERIMETRE}', true), '') IS NULL
    OR "${colonneSite}" = ANY(
      string_to_array(NULLIF(current_setting('${VAR_PERIMETRE}', true), ''), ',')::uuid[]
    )
  )`;
  const clause = `${filtreSociete} AND ${filtreClient} AND ${filtreSite}`;
  return `
    ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;
    CREATE POLICY "cloisonnement_parc" ON "${table}"
      USING (${clause}) WITH CHECK (${clause});
  `;
}

/** Une table du contrat : sa forme minimale, et la politique qu'elle doit porter. */
export type TableContrat = {
  table: string;
  /** Le lot qui livrera la vraie table — c'est là que la fixture s'efface. */
  lot: string;
  /** Colonne portant l'identité du client (D10). */
  colonneClient: string;
  /** Colonne portant le site, quand la table en a un. */
  colonneSite: string | null;
  /** Les colonnes de la fixture, tant que la vraie table n'existe pas. */
  colonnes: string;
};

/**
 * Les trois tables du parc, et rien d'autre. Types compris : identifiants en
 * `uuid` natif, comme le schéma réel — une fixture qui modèlerait un autre type
 * éprouverait un autre contrat.
 */
export const CONTRAT_PARC: readonly TableContrat[] = [
  {
    // **La fixture s'est effacée au ticket L1-01** : la migration
    // `20260901120000_client_l1_01` a créé la vraie table, et `global.ts` ne
    // fabrique plus rien ici. L'entrée RESTE, et son maintien est l'objet même
    // de la liste close : la retirer ferait retomber `client` sur la forme
    // « société », qui passe, et le filtre portail de D10 disparaîtrait sans
    // qu'aucun scénario ne rougisse. `colonnes` n'est plus lue — elle est
    // conservée telle quelle, comme trace de ce que la fixture modélisait.
    table: "client",
    lot: "L1-01",
    colonneClient: "id",
    colonneSite: null,
    colonnes: `
      "id" uuid PRIMARY KEY,
      "societe_id" uuid NOT NULL,
      "raison_sociale" text NOT NULL
    `,
  },
  {
    table: "site",
    lot: "L1-02",
    colonneClient: "client_id",
    colonneSite: "id",
    colonnes: `
      "id" uuid PRIMARY KEY,
      "societe_id" uuid NOT NULL,
      "client_id" uuid NOT NULL,
      "libelle" text NOT NULL
    `,
  },
  {
    table: "machine",
    lot: "L2-01",
    colonneClient: "client_id",
    colonneSite: "site_id",
    colonnes: `
      "id" uuid PRIMARY KEY,
      "societe_id" uuid NOT NULL,
      "client_id" uuid NOT NULL,
      "site_id" uuid NOT NULL,
      "qr_token" text NOT NULL UNIQUE,
      "numero_serie" text NOT NULL
    `,
  },
  {
    // **Née VRAIE table au ticket L1-03** — jamais une fixture. L'entrée est
    // ici pour la seule raison qui vaille : `CONTRAT_PARC` et `TABLES_PARC`
    // sont confrontées l'une à l'autre, et une table du parc absente de l'une
    // des deux serait posée par l'un sans être jugée par l'autre. Sa colonne de
    // périmètre est la PREMIÈRE nullable du dépôt : un contact sans site est un
    // contact du CLIENT.
    table: "contact",
    lot: "L1-03",
    colonneClient: "client_id",
    colonneSite: "site_id",
    colonnes: `
      "id" uuid PRIMARY KEY,
      "societe_id" uuid NOT NULL,
      "client_id" uuid NOT NULL,
      "site_id" uuid,
      "nom" text NOT NULL
    `,
  },
] as const;

/**
 * Les référentiels que le harnais modelait en fixture — **la liste est VIDE
 * depuis L1-05, et c'est le ticket.**
 *
 * Elle portait `modele_materiel`, avec un écart assumé : la fixture lui posait
 * `FORCE`, là où la vraie table devait rester en RLS simple. L'amendement à D4
 * du 08/09/2026 a retiré ce régime — `famille_materiel` et `modele_materiel`
 * sont désormais des tables MÉTIER cloisonnées, réelles, avec `FORCE` et la
 * forme « société ». L'écart n'existe plus parce que la règle a changé, pas
 * parce qu'on l'a effacé.
 *
 * **La liste reste plutôt que de disparaître**, et vide : les trois autres
 * référentiels de plateforme — `devise`, `parite`, `jour_ferie` — sont des
 * tables RÉELLES depuis le lot 0. Aucun référentiel n'a besoin d'être modelé, et
 * c'est un fait à constater, pas une case à supprimer.
 */
export const CONTRAT_REFERENTIEL: readonly TableContrat[] = [] as const;

/** Toutes les tables fixtures du harnais — parc et référentiel. */
export const TABLES_FIXTURES = [
  ...CONTRAT_PARC.map((entree) => entree.table),
  ...CONTRAT_REFERENTIEL.map((entree) => entree.table),
];

/**
 * Les chemins que **L0-05 déclare obligatoires**, recopiés depuis le ticket :
 * « Inclut obligatoirement : le chemin `GET /machines/qr/{token}`, qui doit
 * refuser un jeton appartenant à une autre société ; l'accès d'un compte
 * portail aux données d'un autre client ; le respect du périmètre de sites. »
 *
 * `plancher` est le nombre de scénarios qui les honorent aujourd'hui. **Il ne
 * se baisse jamais** : c'est la seule phrase de ce fichier qui soit une règle
 * plutôt qu'une donnée. Le gardien `tests/unit/db/contrat-isolation.test.ts`
 * échoue dès qu'un scénario disparaît, et la seule façon de le faire taire est
 * de baisser un chiffre ici — un geste qui se voit dans une revue, là où la
 * suppression d'un fichier de test ne se voyait pas.
 */
export const EXIGENCES_L0_05 = [
  {
    cle: "qr_inter_societe",
    intitule: "résolution QR inter-société",
    source: "D22",
    // Le plancher passe de 3 à 5 au ticket L2-01, et c'est le sens du contrat :
    // les scénarios D22 devaient être PLUS nombreux après la reprise de la
    // fixture par la vraie table, jamais moins. Les deux nouveaux sont dans
    // `tests/isolation/machine.test.ts` — l'un prouve PAR LECTURE que le jeton
    // d'une autre société ne se résout pas, avec le témoin qui montre qu'il se
    // résout sous la sienne ; l'autre éprouve l'unicité GLOBALE du jeton, sans
    // laquelle la résolution serait ambiguë au moment exact où aucune société
    // n'est encore connue.
    table: "machine",
    plancher: 5,
  },
  {
    cle: "portail_autre_client",
    intitule: "un compte portail et les données d'un autre client",
    source: "D10",
    // Le plancher est passé de 4 à 5 au ticket L1-01, et c'est le sens du
    // contrat : les scénarios D10 devaient être PLUS nombreux après la reprise,
    // jamais moins. Le cinquième est `tests/isolation/client.test.ts`, qui
    // prouve PAR LECTURE ce que la clause société seule laisserait fuir — là où
    // `politiques-rls.test.ts` prouve seulement que le gardien s'en apercevrait.
    table: "client",
    plancher: 5,
  },
  {
    cle: "perimetre_sites",
    intitule: "respect du périmètre de sites",
    source: "D10",
    // Le plancher est passé de 2 à 4 au ticket L1-02, et c'est le sens du
    // contrat : les scénarios de périmètre devaient être PLUS nombreux après la
    // reprise de la fixture par la vraie table, jamais moins. Les deux
    // nouveaux sont dans `tests/isolation/site.test.ts` — l'un prouve PAR
    // LECTURE ce que la politique amputée du troisième filtre laisserait fuir,
    // là où `politiques-rls.test.ts` prouve seulement que le gardien s'en
    // apercevrait ; l'autre porte sur l'ÉCRITURE, que les scénarios de
    // périmètre ne couvraient pas du tout.
    // Puis de 4 à 6 au ticket L2-01, pour la même raison : `machine` est la
    // troisième et dernière fixture du parc à s'effacer, et le troisième filtre
    // devait y gagner deux scénarios — la LECTURE bornée au site, et l'ÉCRITURE
    // que le `WITH CHECK` refuse.
    table: "site",
    plancher: 6,
  },
] as const;

/** La clé d'une exigence de L0-05. */
export type CleExigence = (typeof EXIGENCES_L0_05)[number]["cle"];

/**
 * Le titre d'un scénario qui honore une exigence de L0-05.
 *
 * **C'est l'appel qui est la marque**, pas le titre : le gardien statique compte
 * les `exigence("<clé>"` dans `tests/isolation/`. Un scénario renommé reste
 * compté ; un scénario supprimé ne l'est plus. Et le titre rendu porte la clé,
 * si bien qu'un échec de scénario nomme lui-même l'exigence qu'il servait.
 */
export function exigence(cle: CleExigence, intitule: string): string {
  const entree = EXIGENCES_L0_05.find((e) => e.cle === cle);
  if (entree === undefined) {
    throw new Error(`Exigence L0-05 inconnue : « ${cle} ».`);
  }
  return `L0-05 [${cle}, ${entree.source}] ${intitule}`;
}
