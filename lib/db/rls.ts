import type { Prisma, PrismaClient } from "@prisma/client";

import type { Role } from "@/lib/auth/roles";

/**
 * Contexte de session pour la sécurité au niveau des lignes (I1, tickets L0-04
 * et L0-06).
 *
 * Ce module est le POINT DE PASSAGE UNIQUE qui arme le cloisonnement : il pose
 * les variables de session que les politiques et les déclencheurs lisent. Une
 * politique juste dont personne ne pose la variable ne garde rien.
 *
 * ## LE DÉFAUT QUE CE MODULE A PORTÉ, ET QUI A ÉTÉ MESURÉ (L1-02b)
 *
 * Il posait QUATRE variables. Les politiques en réclamaient SIX. `app.client_id`
 * et `app.perimetre_sites` — les deux tiers de la forme « parc », posée en base
 * par L1-01 puis L1-02 sur `client`, `site` et `machine` — n'étaient posées par
 * AUCUN chemin de production : seul le harnais `tests/isolation/` les posait.
 *
 * **Les scénarios d'isolation étaient donc verts parce que le harnais armait
 * une garantie que la production n'armait pas.** Ce n'était pas un test faux :
 * il éprouvait correctement des politiques justes. C'est que personne ne
 * comparait le contexte POSÉ au contexte ATTENDU — deux implémentations du même
 * contrat, chacune verte, divergeant en silence (§9, 01/09). Sous le contexte
 * réel, la branche « `app.client_id` absent » de la forme « parc » se lit
 * « utilisateur interne » et ouvre tout le parc de la société.
 *
 * **La réparation n'est pas d'ajouter deux `set_config`** — ce serait soigner
 * le symptôme et laisser la divergence libre de se recreuser au prochain ajout.
 * Elle a deux moitiés, et la seconde est celle qui tient :
 *
 *   1. `VARIABLES_CONTEXTE` ci-dessous est la liste close de ce que ce module
 *      pose, et `poserContexte` la PARCOURT. La liste et le comportement ne
 *      sont pas deux choses qui se ressemblent : c'est le même objet. En
 *      retirer une entrée retire réellement la pose.
 *   2. `scripts/lib/contexte-rls.ts` confronte cette liste à `pg_policies` et
 *      aux définitions de fonctions — deux sources que ce module ne contrôle
 *      pas. Toute variable réclamée par la base et absente d'ici est un écart,
 *      nommé, sur la base jetable comme sur la base hébergée.
 *
 * ## LES SIX VARIABLES, ET QUI LES LIT
 *
 *   - `app.societe_id` — le cloisonnement société (L0-04, D4). Lue par douze
 *     politiques.
 *   - `app.role` — le rôle tenu sur cette société, sans lequel l'écriture des
 *     référentiels de plateforme ne saurait être réservée aux rôles éditeur
 *     comme I1 l'exige (L0-06). Lue à travers la fonction `app_role()`.
 *   - `app.client_id` — le client d'un compte portail (D10), et le DISCRIMINANT
 *     qui distingue un compte portail d'un utilisateur interne.
 *   - `app.perimetre_sites` — le périmètre de sites de ce compte (RG-DRO-01).
 *   - `app.utilisateur_id` — l'auteur (I8 : « auteur, horodatage et valeurs
 *     avant/après »).
 *   - `app.adresse_ip` — l'adresse de l'appelant (chapitre 11.2), telle que
 *     Better Auth l'a déjà enregistrée sur la session.
 *
 * Les quatre dernières peuvent être absentes, et leur absence SIGNIFIE quelque
 * chose de précis dans chaque cas : pas de compte portail, pas de restriction
 * de sites, pas d'auteur (le seed, une tâche planifiée, une correction
 * manuelle — le journal l'écrit `NULL` plutôt que d'inventer un compte,
 * CLAUDE.md §8). L'écriture est journalisée quand même : c'est le déclencheur
 * qui décide, pas l'appelant.
 *
 * Les variables sont posées en `set_config(..., is_local => true)`, c'est-à-dire
 * portées à la transaction : elles sont automatiquement remises à zéro au
 * `COMMIT` ou au `ROLLBACK`. Aucune fuite de contexte d'une requête à l'autre
 * n'est donc possible sur une connexion mutualisée — condition indispensable
 * derrière un pool.
 */

/** Nom de la variable de session portant la société active. */
export const VARIABLE_SESSION_SOCIETE = "app.societe_id";

/** Nom de la variable de session portant le rôle tenu sur cette société. */
export const VARIABLE_SESSION_ROLE = "app.role";

/** Nom de la variable de session portant l'auteur des écritures (L0-10, I8). */
export const VARIABLE_SESSION_UTILISATEUR = "app.utilisateur_id";

/** Nom de la variable de session portant l'adresse de l'appelant (chapitre 11.2). */
export const VARIABLE_SESSION_ADRESSE_IP = "app.adresse_ip";

/**
 * Nom de la variable de session portant le client d'un compte portail (D10).
 *
 * **C'est le DISCRIMINANT du portail, et il n'a qu'un état signifiant : posé,
 * ou pas.** Les politiques de forme « parc » lisent son absence comme
 * « utilisateur interne » et ouvrent tout le parc de la société ; sa présence
 * restreint à un client. Aucun rôle ne la pose « à moitié ».
 */
export const VARIABLE_SESSION_CLIENT = "app.client_id";

/**
 * Nom de la variable de session portant le périmètre de sites d'un compte
 * portail — liste d'UUID jointe par des virgules, RG-DRO-01.
 *
 * Vide signifie « tous les sites du client », jamais « aucun ». C'est la
 * troisième branche de la forme « parc », la seule qui sépare deux sites d'un
 * MÊME client.
 */
export const VARIABLE_SESSION_PERIMETRE = "app.perimetre_sites";

/**
 * Contexte de session posé sur la transaction : société, rôle, auteur, adresse.
 *
 * Un objet plutôt que quatre paramètres positionnels : `avecContexteRls(prisma,
 * { societeId, role: null, auteurId: null }, …)` se relit, là où un quatrième
 * `null` en fin de liste ne se relit plus.
 */
export type ContexteRls = {
  /** Société active — alimente `app.societe_id`. */
  societeId: string;
  /** Rôle tenu sur cette société, `null` pour un chemin qui n'en a pas. */
  role: Role | null;
  /** Auteur des écritures, `null` hors session. Alimente `app.utilisateur_id`. */
  auteurId?: string | null;
  /** Adresse de l'appelant, `null` hors session. Alimente `app.adresse_ip`. */
  adresseIp?: string | null;
  /**
   * Client d'un compte portail (D10), `null` pour un utilisateur interne.
   * Alimente `app.client_id`. **Son absence n'est pas un défaut de
   * renseignement : c'est l'information « ce n'est pas un compte portail ».**
   */
  clientId?: string | null;
  /**
   * Périmètre de sites de ce compte portail (RG-DRO-01), alimentant
   * `app.perimetre_sites`. Vide = tous les sites du client, jamais aucun.
   */
  perimetreSites?: readonly string[];
};

/**
 * CE QUE CE MODULE POSE — liste close, et le comportement la PARCOURT.
 *
 * Ce n'est pas une déclaration à côté du code : `poserContexte` construit son
 * instruction à partir de ce tableau. En retirer une entrée retire réellement
 * la pose, et le gardien de `scripts/lib/contexte-rls.ts` le voit aussitôt.
 * C'est la parade du 01/09 appliquée à sa lettre — ne pas laisser vivre côte à
 * côte une liste et une implémentation qui se ressemblent.
 *
 * L'ordre compte, et il est le seul endroit du module où il compte : les cinq
 * premières sont des scalaires que l'appelant fournit ; la valeur de la
 * sixième est calculée en base, et sa lecture est soumise aux politiques que
 * les cinq premières viennent d'armer.
 */
const POSE: readonly {
  readonly variable: string;
  readonly valeur: (contexte: ContexteRls) => string;
}[] = [
  { variable: VARIABLE_SESSION_SOCIETE, valeur: (c) => c.societeId },
  { variable: VARIABLE_SESSION_ROLE, valeur: (c) => c.role ?? "" },
  { variable: VARIABLE_SESSION_UTILISATEUR, valeur: (c) => c.auteurId ?? "" },
  { variable: VARIABLE_SESSION_ADRESSE_IP, valeur: (c) => c.adresseIp ?? "" },
  { variable: VARIABLE_SESSION_CLIENT, valeur: (c) => c.clientId ?? "" },
  {
    variable: VARIABLE_SESSION_PERIMETRE,
    valeur: (c) => (c.perimetreSites ?? []).join(","),
  },
];

/**
 * Les variables de session que le CHEMIN DE PRODUCTION pose, dans l'ordre.
 *
 * C'est la moitié « dépôt » du contrôle de `scripts/lib/contexte-rls.ts` : la
 * moitié « base » vient de `pg_policies` et des définitions de fonctions, que
 * ce module ne contrôle pas. Le harnais d'isolation la lit aussi, plutôt que
 * de redéclarer ses propres noms — un harnais plus riche que la production est
 * un harnais qui ment.
 */
export const VARIABLES_CONTEXTE: readonly string[] = POSE.map(
  (entree) => entree.variable,
);

/** Client Prisma ou client de transaction — les deux exposent `$executeRawUnsafe`. */
type ClientPrisma = PrismaClient | Prisma.TransactionClient;

/**
 * L'instruction unique qui pose les six variables, et ses paramètres liés.
 *
 * **UN SEUL ALLER-RETOUR, LÀ OÙ IL Y EN AVAIT QUATRE.** Le module émettait une
 * instruction par variable ; en ajouter deux en aurait fait six. À 190 ms vers
 * Sydney, six allers-retours sur le chemin de CHAQUE requête applicative n'est
 * pas un détail — c'est la leçon du 23/08, et elle vaut pour la lecture comme
 * elle valait pour le seed. Les `set_config` d'un même `SELECT` s'exécutent
 * tous, et aucun ne dépend de la valeur d'un autre : rien n'exigeait qu'ils
 * voyagent séparément.
 *
 * `set_config` est utilisé plutôt que `SET LOCAL` parce qu'il accepte un
 * paramètre lié : la valeur ne transite jamais par de la concaténation de
 * chaîne, ce qui ferme la porte à toute injection dans la variable de session.
 * Le NOM, lui, vient de `POSE` — une constante du module, jamais d'une entrée.
 *
 * Les variables de session restent du texte — c'est le type de
 * `current_setting` — et ce sont les politiques et la fonction `app_role()` qui
 * les convertissent en `uuid` et en `"Role"` (forme D4). Corollaire pour toute
 * requête brute écrite ailleurs : un identifiant passé en paramètre lié part en
 * `text` et doit être casté sur place (`$1::uuid`), les colonnes d'identifiants
 * étant typées `uuid` depuis la migration `20260820140000_identifiants_uuid`.
 *
 * Une valeur absente est posée à la chaîne vide, que `NULLIF` ramène à `NULL`
 * du côté des politiques. C'est ce qui rend l'absence LISIBLE plutôt que
 * silencieuse : « société sans rôle », « pas un compte portail », « tous les
 * sites du client ».
 */
export function instructionContexte(contexte: ContexteRls): {
  readonly sql: string;
  readonly parametres: readonly string[];
} {
  const fragments = POSE.map(
    (_, rang) => `set_config($${2 * rang + 1}, $${2 * rang + 2}, true)`,
  );
  return {
    sql: `SELECT ${fragments.join(", ")}`,
    parametres: POSE.flatMap((entree) => [
      entree.variable,
      entree.valeur(contexte),
    ]),
  };
}

/** Positionne les six variables de session sur la transaction courante. */
async function poserContexte(
  tx: ClientPrisma,
  contexte: ContexteRls,
): Promise<void> {
  const { sql, parametres } = instructionContexte(contexte);
  await tx.$executeRawUnsafe(sql, ...parametres);
}

/**
 * Les délais d'une transaction interactive, en millisecondes.
 *
 * Les noms sont ceux de Prisma, délibérément : ce type ne traduit rien, il
 * rend seulement EXPLICITE ce que `$transaction` accepte déjà. Une traduction
 * française aurait ajouté une couche à relire pour retrouver, en dessous, la
 * documentation de Prisma.
 *
 *   - `maxWait` — attente maximale pour obtenir une connexion avant que la
 *     transaction ne commence. Défaut Prisma : 2 000 ms.
 *   - `timeout` — durée maximale de la transaction elle-même, du `BEGIN` au
 *     `COMMIT`. Défaut Prisma : 5 000 ms.
 *
 * **Ces deux défauts sont des valeurs de RÉSEAU LOCAL.** Ils tiennent tant
 * qu'un aller-retour coûte une milliseconde ; ils ne tiennent plus dès que la
 * base est à Sydney et l'appelant ailleurs. Un chemin qui enchaîne beaucoup
 * d'écritures dans une seule transaction doit donc les fixer lui-même — c'est
 * le cas du seed, voir `prisma/seed-delais.ts`.
 */
export type DelaisTransaction = {
  maxWait: number;
  timeout: number;
};

/**
 * Exécute `travail` dans une transaction portant société ET rôle.
 *
 * Toute requête émise sur le client de transaction fourni est alors soumise aux
 * politiques RLS avec `app.societe_id = societeId` et `app.role = role`. La
 * transaction interactive garantit qu'une seule et même connexion porte le
 * contexte et les requêtes.
 *
 * `delais` est facultatif : omis, les défauts de Prisma s'appliquent, ce qui
 * convient aux chemins de session — une requête applicative, servie depuis le
 * même continent que la base, fait deux ou trois allers-retours. Le préciser
 * est réservé aux chemins d'amorçage, longs et distants.
 */
export function avecContexteRls<T>(
  prisma: PrismaClient,
  contexte: ContexteRls,
  travail: (tx: Prisma.TransactionClient) => Promise<T>,
  delais?: DelaisTransaction,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await poserContexte(tx, contexte);
    return travail(tx);
  }, delais);
}

/**
 * Variante sans auteur, pour les chemins qui n'en ont pas : le seed, le
 * contrôle de cloisonnement, les tâches par société. Le journal d'audit y
 * inscrit alors un auteur `NULL` — et la ligne existe quand même.
 */
export function avecSocieteEtRole<T>(
  prisma: PrismaClient,
  societeId: string,
  role: Role | null,
  travail: (tx: Prisma.TransactionClient) => Promise<T>,
  delais?: DelaisTransaction,
): Promise<T> {
  return avecContexteRls(prisma, { societeId, role }, travail, delais);
}

/**
 * Variante sans rôle, pour les chemins qui n'en ont pas : le seed et le
 * contrôle de cloisonnement, qui écrivent le socle sous le rôle propriétaire.
 * Un chemin de session passe toujours par `avecSocieteEtRole`.
 */
export function avecSociete<T>(
  prisma: PrismaClient,
  societeId: string,
  travail: (tx: Prisma.TransactionClient) => Promise<T>,
  delais?: DelaisTransaction,
): Promise<T> {
  return avecSocieteEtRole(prisma, societeId, null, travail, delais);
}
