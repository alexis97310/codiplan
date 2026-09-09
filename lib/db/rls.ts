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
 * Nom de la variable nommant la ligne d'identité que la VÉRIFICATION
 * D'IDENTIFIANTS a le droit de lire, par son courriel (L1-02c).
 *
 * **C'est la forme « désignation », et sa borne est dans son nom** : elle ne
 * vaut que pour les opérations qui PRÉCÈDENT le contexte de locataire —
 * l'authentification, et rien d'autre. Elle n'autorise que la ligne que
 * l'appelant nommait DÉJÀ : elle ne rend jamais plus que ce qu'il savait avant
 * d'interroger.
 *
 * Elle figure dans `POSE` — donc posée à VIDE par tout contexte ordinaire — et
 * c'est indispensable : sur une connexion mutualisée, une variable non posée
 * hérite de ce que la transaction précédente y a laissé. `lib/auth/lecture-identite.ts`
 * la renseigne, et seulement à l'intérieur de sa propre transaction.
 */
export const VARIABLE_SESSION_AUTH_EMAIL = "app.authentification_email";

/** Même chose, par identifiant : Better Auth relit l'identité qu'il vient de trouver. */
export const VARIABLE_SESSION_AUTH_UTILISATEUR =
  "app.authentification_utilisateur_id";

/**
 * Le JETON de session que l'appelant présente (L1-02d).
 *
 * **Un jeton de session est une désignation, et c'en est même l'exemple pur** :
 * une valeur opaque et imprévisible que seul son porteur connaît. Le lire ne
 * rend jamais plus que ce que l'appelant savait déjà — c'est la définition de
 * la forme, et elle s'applique ici sans être élargie d'un pouce.
 *
 * Elle ne désigne QUE la session, et pas son identité : mesuré, `getSession`
 * émet deux opérations de client distinctes, et l'identité y est désignée par
 * son propre identifiant. Une branche avait été ajoutée à `utilisateur_lecture`
 * pour ce chemin ; le jumeau l'a démentie — retirée, la chaîne reste verte — et
 * elle a donc été supprimée plutôt que gardée « au cas où ».
 */
export const VARIABLE_SESSION_AUTH_JETON = "app.authentification_jeton_session";

/**
 * L'IDENTIFIANT d'une vérification — jeton de courriel, défi de second facteur,
 * confiance d'appareil (L1-02d).
 *
 * Même nature que le jeton de session : une valeur opaque, présentée par celui
 * qui la détient. `verification` n'a aucune autre clé d'accès — elle n'est
 * jamais parcourue, jamais listée.
 */
/**
 * LE SUJET D'UN DÉVERROUILLAGE ADMINISTRATIF (L7-04 / D66).
 *
 * **Elle DÉSIGNE une ligne, elle n'autorise rien** — c'est la forme de D64 : la
 * variable dit QUELLE ligne, la politique dit QUI a le droit et DANS QUEL ÉTAT.
 * Seule, elle ne rend rien : `second_facteur_deverrouillage` exige en plus
 * `admin_societe`, un sujet habilité sur la société active, et une ligne déjà à
 * la sentinelle de l'escalade.
 *
 * **Pourquoi une variable plutôt qu'une clause `where`.** Mesuré le 09/09/2026 :
 * PostgreSQL applique les politiques de `SELECT` au `WHERE` d'un `UPDATE`, si
 * bien qu'un `UPDATE … WHERE utilisateur_id = <sujet>` aurait exigé d'OUVRIR la
 * lecture de `second_facteur` à l'administrateur — c'est-à-dire de lui donner le
 * secret et les codes de secours de la personne qu'il dépanne. Un `UPDATE` sans
 * `WHERE` et à `SET` constants ne lit aucune colonne : le `USING` de la
 * politique choisit seul les lignes, et aucune lecture n'est ouverte.
 *
 * Comme les désignations d'authentification, elle est **remise à vide** par tout
 * contexte ordinaire : c'est sa pose la plus importante, celle qui referme.
 */
export const VARIABLE_SESSION_DEVERROUILLAGE_SUJET =
  "app.deverrouillage_sujet_id";

export const VARIABLE_SESSION_AUTH_IDENTIFIANT =
  "app.authentification_identifiant";

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
   * Sujet d'un déverrouillage administratif (L7-04), `null` partout ailleurs.
   * Alimente `app.deverrouillage_sujet_id`. **Elle désigne, elle n'autorise
   * pas** : la politique exige en plus le rôle, l'habilitation et l'état.
   */
  deverrouillageSujetId?: string | null;
};

/*
 * **`perimetreSites` n'est PAS un champ de ce type, et c'est une décision.**
 * Le périmètre est DÉRIVÉ de `utilisateur_client_site` (L1-02b), il n'est pas
 * fourni par l'appelant. Le laisser fournir aurait donné deux sources à une
 * même valeur — celle de la base et celle du code —, et deux sources d'un même
 * fait divergent en silence parce qu'aucune ne prétend être l'autre (§9,
 * 01/09). L'appelant dit QUI il est ; la base dit ce que cela lui donne.
 */

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
  // Posée à vide ici, puis REMPLIE par `app_poser_perimetre_client` pour un
  // compte portail (D70) — après que ce même appel a VALIDÉ la désignation.
  // Elle figure dans cette liste parce qu'elle doit être DÉFINIE dans tous les
  // cas : sur une connexion mutualisée, une variable non posée hérite de ce que
  // la transaction précédente y a laissé.
  { variable: VARIABLE_SESSION_PERIMETRE, valeur: () => "" },
  // Les deux désignations d'authentification : TOUJOURS remises à vide par un
  // contexte ordinaire. C'est leur pose la plus importante — celle qui REFERME.
  { variable: VARIABLE_SESSION_AUTH_EMAIL, valeur: () => "" },
  { variable: VARIABLE_SESSION_AUTH_UTILISATEUR, valeur: () => "" },
  { variable: VARIABLE_SESSION_AUTH_JETON, valeur: () => "" },
  { variable: VARIABLE_SESSION_AUTH_IDENTIFIANT, valeur: () => "" },
  // Le sujet d'un déverrouillage administratif (L7-04). Vide partout ailleurs,
  // et c'est cette pose-là qui compte : sur une connexion mutualisée, une
  // variable non posée hérite de ce que la transaction précédente y a laissé.
  {
    variable: VARIABLE_SESSION_DEVERROUILLAGE_SUJET,
    valeur: (c) => c.deverrouillageSujetId ?? "",
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

/**
 * LA DÉSIGNATION DU CLIENT — l'appelant DÉSIGNE, la base DISPOSE (D70).
 *
 * ## Ce que cet appel remplace, et pourquoi il ne coûte rien de plus
 *
 * Il prend la place de l'instruction qui posait `app.perimetre_sites` depuis
 * `utilisateur_client_site` (L1-02b) : **un appel là où il y avait une
 * instruction**, et toujours aucune pour un utilisateur interne. Ce qu'il
 * AJOUTE est la validation qui manquait — le client désigné doit figurer parmi
 * les habilitations de ce compte —, et elle voyage dans le même aller-retour.
 *
 * ## Pourquoi la validation est en BASE et non ici
 *
 * Parce qu'elle doit être soumise aux politiques de l'appelant. La fonction est
 * `SECURITY INVOKER` : elle ne peut confirmer qu'une habilitation que l'appelant
 * a lui-même le droit de lire. Écrite ici, en TypeScript, elle aurait été une
 * lecture de plus dont rien ne garantissait qu'elle regarde la même chose que
 * les politiques — *deux lectures d'un même critère divergent en silence*
 * (§9, 01/09).
 *
 * ## Elle LÈVE, elle ne rend jamais un contexte vide
 *
 * Un `app.client_id` vide se lit « utilisateur interne » dans la forme « parc »
 * et OUVRE tout le parc de la société. Une désignation refusée qui retomberait
 * en silence sur la chaîne vide rouvrirait donc exactement le trou qu'elle
 * ferme. L'exception annule la transaction entière : rien n'est lu ensuite.
 */
const SQL_DESIGNATION_CLIENT = `SELECT "app_poser_perimetre_client"($1::uuid, $2::uuid)`;

/**
 * Positionne les six variables de session sur la transaction courante.
 *
 * UNE instruction pour un utilisateur interne, DEUX pour un compte portail —
 * contre quatre pour tout le monde avant L1-02b.
 */
async function poserContexte(
  tx: ClientPrisma,
  contexte: ContexteRls,
): Promise<void> {
  const { sql, parametres } = instructionContexte(contexte);
  await tx.$executeRawUnsafe(sql, ...parametres);

  // **L'ORDRE EST UNE DÉCISION** (D70). `app.client_id` est posée par
  // l'instruction ci-dessus, AVANT d'être validée par celle-ci. La politique
  // « habilitation » s'écrit *société ET (`app.client_id` absent OU ma propre
  // ligne)* : valider avant de poser ferait lire sous la branche « absent »,
  // c'est-à-dire sous le régime de l'utilisateur INTERNE, qui voit TOUTES les
  // habilitations de la société. Poser d'abord RESSERRE la validation à ses
  // propres lignes.
  //
  // Ce que l'inversion coûte : entre les deux, la variable porte une valeur non
  // vérifiée. **Rien ne doit s'exécuter dans cette fenêtre** — c'est la raison
  // pour laquelle ces deux instructions sont adjacentes et le resteront, et un
  // scénario d'isolation éprouve qu'un refus annule la transaction entière.
  if (contexte.clientId) {
    await tx.$executeRawUnsafe(
      SQL_DESIGNATION_CLIENT,
      contexte.auteurId ?? "",
      contexte.clientId,
    );
  }
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
 * Contexte d'IDENTITÉ SEULE — aucune société active (ticket L1-02f).
 *
 * **Ce n'est pas une variante de confort, c'est le seul contexte qui existe
 * entre la connexion et la première activation de société.** La connexion
 * n'établit que l'identité (D35) ; `basculerSociete` exige qu'on lui NOMME la
 * société visée ; et la seule lecture qui puisse la nommer est celle des
 * habilitations du compte, sous la huitième forme de politique — « appartenance »,
 * ancrée sur `app.utilisateur_id` et non sur `app.societe_id` (D61).
 *
 * `app.societe_id` part donc à VIDE, ce qui n'est pas une omission : les
 * politiques la lisent par `NULLIF(…, '')`, et une société vide signifie
 * exactement « aucune ». Toute table cloisonnée rend alors zéro ligne — c'est
 * le comportement voulu, et un scénario le mesure.
 */
export function avecIdentite<T>(
  prisma: PrismaClient,
  utilisateurId: string,
  travail: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return avecContexteRls(
    prisma,
    { societeId: "", role: null, auteurId: utilisateurId },
    travail,
  );
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
