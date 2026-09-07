import type { PrismaClient } from "@prisma/client";

import {
  VARIABLE_SESSION_AUTH_EMAIL,
  VARIABLE_SESSION_AUTH_IDENTIFIANT,
  VARIABLE_SESSION_AUTH_JETON,
  VARIABLE_SESSION_AUTH_UTILISATEUR,
  VARIABLE_SESSION_ROLE,
  VARIABLE_SESSION_SOCIETE,
} from "@/lib/db/rls";

/**
 * LA DÉSIGNATION DES TABLES D'AUTHENTIFICATION (tickets L1-02c puis L1-02d).
 *
 * ## Pourquoi ce module existe
 *
 * L'authentification **précède** la société : chercher « existe-t-il un compte
 * pour ce courriel » se fait à un moment où aucune société n'est connue et ne
 * peut l'être. Sous une politique de société seule, la lecture rend zéro et
 * personne ne se connecte — mesuré.
 *
 * Les politiques de ces tables portent donc la forme « DÉSIGNATION » :
 * l'appelant ne peut lire que **la ligne qu'il nommait déjà**. Ce module est ce
 * qui la nomme, et il couvre les CINQ tables depuis L1-02d — `utilisateur`,
 * `session`, `compte`, `verification`, `second_facteur`.
 *
 * ## Ce que chaque table accepte comme désignation, et d'où on le sait
 *
 * Pas d'une lecture de la bibliothèque : d'une **trace des requêtes réellement
 * émises**, mesurée le 07/09/2026 sur l'inscription, la connexion et la lecture
 * de session.
 *
 * | Table | Clé de désignation | Variable posée |
 * |---|---|---|
 * | `utilisateur` | courriel, identifiant | `app.authentification_email`, `…_utilisateur_id` |
 * | `session` | jeton | `app.authentification_jeton_session` |
 * | `compte` | identifiant d'utilisateur | `app.authentification_utilisateur_id` |
 * | `verification` | identifiant opaque | `app.authentification_identifiant` |
 * | `second_facteur` | identifiant d'utilisateur | `app.authentification_utilisateur_id` |
 *
 * ## CE QUE LA TRACE MONTRE DE `getSession`, ET LA CAUSE ENFIN ISOLÉE (L1-02e)
 *
 * Elle montre **deux opérations de client distinctes** — `session` désignée par
 * son jeton, puis `utilisateur` désignée par son identifiant —, chacune dans sa
 * propre transaction. C'est ce chemin-là que l'enveloppe garde.
 *
 * **Et la seconde s'écrit `Utilisateur.findFirst { where: { id: { equals: … } } }`.**
 * Là est la cause du `NULL` que L1-02d avait constaté sans l'expliquer, et que
 * D59 déclarait hors de portée. L'enveloppe de L1-02c lisait la forme
 * `{ equals }` **pour le courriel seul** ; l'identifiant, lui, était lu nu
 * (`typeof ou.id === "string"`). La désignation partait donc vide,
 * `utilisateur_lecture` refusait, et Better Auth concluait « pas de session ».
 *
 * *Mesuré, et par le jumeau* : l'ancien module remis en place depuis
 * l'historique et les cinq tables ramenées sans RLS, `getSession` rend `null`
 * alors que le cookie est présent — le défaut est reproduit ; **une seule
 * ligne** changée dans cet ancien module — l'identifiant lu comme le courriel —
 * et il rend une session, sans que rien d'autre bouge. L'état de la base a été
 * écarté au passage : sous le code courant, `getSession` répond dans les deux
 * états.
 *
 * **C'est pourquoi la connexion marchait quand la relecture ne marchait pas :
 * deux clés, une seule forme reconnue.** `texteDe` lit désormais les deux
 * formes pour **toutes** les clés, et `tests/unit/auth/formes-d-appel.test.ts`
 * l'exige clé par clé, en dérivant sa liste de `CLES_DESIGNATION`.
 *
 * Ce qui garde cette chaîne reste néanmoins un APPELANT plutôt qu'une
 * explication — `tests/isolation/chaine-session.test.ts` : un appelant attrape
 * aussi les causes qu'on n'avait pas prévues.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il ne pose rien quand la requête ne DÉSIGNE personne : une lecture sans clé
 * part sans variable, et la politique la refuse. C'est voulu — un balayage
 * n'est pas une vérification d'identifiants.
 *
 * ## Une transaction, et ce n'est pas une précaution de style
 *
 * Mesuré : `set_config(…, is_local => false)` **persiste sur la connexion** et
 * serait lu par la requête suivante — d'un AUTRE utilisateur, derrière un
 * pooler. Ce serait pire que le mal qu'on répare. `set_config(…, is_local =>
 * true)` meurt au `COMMIT` **et** au `ROLLBACK`, et un scénario le vérifie en
 * relisant la variable sur la connexion après coup.
 *
 * ## L'adaptateur de Better Auth n'est pas déformé
 *
 * Il reçoit un client Prisma, et c'est tout ce qu'il connaît. L'enveloppe est
 * une extension du client, pas une modification de la bibliothèque.
 */

/** Une variable de désignation et la valeur qu'une requête lui donne. */
export type Designation = {
  readonly variable: string;
  readonly valeur: string;
};

/**
 * Lit un champ de `where` sous les deux formes que Prisma produit :
 * `{ champ: "x" }` et `{ champ: { equals: "x" } }`.
 *
 * **Les DEUX, pour TOUTES les clés — et c'est la cause isolée à L1-02e.** Le
 * module de L1-02c traitait `{ equals }` pour le courriel et lisait
 * l'identifiant nu ; `getSession` relit l'identité sous la seconde forme, et
 * rendait `null`. Une fonction par clé aurait laissé ce genre d'écart naître à
 * chaque ajout : il n'y en a qu'une, et un gardien l'exige clé par clé.
 */
function texteDe(champ: unknown): string {
  if (typeof champ === "string") {
    return champ;
  }
  const egal = (champ as { equals?: unknown } | undefined)?.equals;
  return typeof egal === "string" ? egal : "";
}

/**
 * Aplatit un `where` en la liste des objets dont les champs sont CONJOINTS.
 *
 * **Mesuré, et c'est le genre de détail qui rend un gardien creux.** L'adaptateur
 * de Better Auth n'émet pas toujours un `where` plat : dès qu'il compose
 * plusieurs conditions, il écrit `{ AND: [{…}, {…}] }`. Le SQL rendu est
 * identique — `a = $1 AND b = $2` — si bien que rien ne le laisse voir depuis la
 * trace des requêtes. La lecture d'une clé au premier niveau seul rendait donc
 * une désignation VIDE, la transaction n'était pas ouverte, et la politique
 * refusait : `findCredentialAccount` ne trouvait plus le compte, et l'appelant
 * lisait « Invalid password » — un message juste sur une cause fausse.
 *
 * Seule la CONJONCTION est parcourue. Une clé trouvée sous un `OR` ne bornerait
 * rien : la requête pourrait rendre autre chose que la ligne nommée.
 */
function aplatirConjonction(
  ou: Record<string, unknown> | undefined,
): Record<string, unknown>[] {
  if (ou === undefined || ou === null) {
    return [];
  }
  const et = ou.AND;
  const enfants = Array.isArray(et)
    ? et.flatMap((membre) =>
        aplatirConjonction(membre as Record<string, unknown>),
      )
    : aplatirConjonction(et as Record<string, unknown> | undefined);
  return [ou, ...enfants];
}

/**
 * Les clés de désignation de chaque modèle : le champ Prisma qui la porte, et
 * la variable de session qu'elle alimente.
 *
 * **Liste close, et c'est elle qui borne la forme.** Y ajouter une entrée
 * ouvrirait une clé d'accès nouvelle à une table d'authentification : c'est un
 * arbitrage, jamais une décision de session.
 */
type Cle = { readonly champ: string; readonly variable: string };

/**
 * Exportée depuis L1-02e — pour que le gardien des formes d'appel DÉRIVE sa
 * population de cette liste au lieu de la recopier. Une liste close recopiée
 * « pour la lisibilité » devient fausse le jour où la première grandit, sans
 * rougir (§9, 01/09).
 */
export const CLES_DESIGNATION: Readonly<
  Record<
    string,
    { readonly ou: readonly Cle[]; readonly creation: readonly Cle[] }
  >
> = {
  utilisateur: {
    ou: [
      { champ: "email", variable: VARIABLE_SESSION_AUTH_EMAIL },
      { champ: "id", variable: VARIABLE_SESSION_AUTH_UTILISATEUR },
    ],
    creation: [
      { champ: "email", variable: VARIABLE_SESSION_AUTH_EMAIL },
      { champ: "id", variable: VARIABLE_SESSION_AUTH_UTILISATEUR },
    ],
  },
  session: {
    // EN LECTURE, le jeton et LUI SEUL. Donner ici `utilisateur_id` laisserait
    // lire toutes les sessions d'un compte dont on ne connaît que
    // l'identifiant — or un identifiant n'est pas un secret, un jeton l'est.
    ou: [{ champ: "token", variable: VARIABLE_SESSION_AUTH_JETON }],
    // À LA CRÉATION, l'identité en plus : c'est ce qui rend le `WITH CHECK`
    // d'ouverture non tautologique — une session ne s'ouvre que pour l'identité
    // que le chemin d'authentification vient de désigner.
    creation: [
      { champ: "token", variable: VARIABLE_SESSION_AUTH_JETON },
      { champ: "utilisateur_id", variable: VARIABLE_SESSION_AUTH_UTILISATEUR },
    ],
  },
  compte: {
    ou: [
      { champ: "utilisateur_id", variable: VARIABLE_SESSION_AUTH_UTILISATEUR },
    ],
    creation: [
      { champ: "utilisateur_id", variable: VARIABLE_SESSION_AUTH_UTILISATEUR },
    ],
  },
  verification: {
    ou: [{ champ: "identifiant", variable: VARIABLE_SESSION_AUTH_IDENTIFIANT }],
    creation: [
      { champ: "identifiant", variable: VARIABLE_SESSION_AUTH_IDENTIFIANT },
    ],
  },
  secondFacteur: {
    ou: [
      { champ: "utilisateur_id", variable: VARIABLE_SESSION_AUTH_UTILISATEUR },
    ],
    creation: [
      { champ: "utilisateur_id", variable: VARIABLE_SESSION_AUTH_UTILISATEUR },
    ],
  },
  // ── `journal_acces`, ET POURQUOI UNE TABLE EN AJOUT SEUL EST ICI ─────────
  //
  // La déduction la range avec `journal_audit` : une TRACE, pas un matériau
  // d'authentification. On voulait donc lui donner l'ajout SEUL, sans aucune
  // politique de lecture — plus fort que « lisible sous désignation ».
  //
  // **Mesuré : c'est impossible à travers Prisma.** `INSERT … RETURNING` est
  // soumis à la politique de LECTURE (leçon de L1-02c), et sans politique de
  // SELECT l'écriture elle-même est refusée — « new row violates row-level
  // security policy ». `journal_audit` y échappe parce qu'un DÉCLENCHEUR
  // l'écrit ; `journal_acces` est écrite par du code applicatif.
  //
  // La lecture est donc bornée à la désignation plutôt qu'absente. C'est
  // strictement plus fort que l'état d'avant — où le rôle applicatif lisait
  // TOUTES les lignes de tous les comptes — et strictement plus faible que
  // l'ajout seul. L'écart est écrit ici plutôt que tu, et il porte son
  // alternative : un journal réellement en ajout seul demanderait un
  // déclencheur, ou du SQL brut que le §2 interdit hors migration.
  journalAcces: {
    ou: [
      { champ: "utilisateur_id", variable: VARIABLE_SESSION_AUTH_UTILISATEUR },
    ],
    creation: [
      { champ: "utilisateur_id", variable: VARIABLE_SESSION_AUTH_UTILISATEUR },
    ],
  },
};

/** Les modèles que l'enveloppe couvre — dérivés de `CLES_DESIGNATION`, jamais recopiés. */
export const MODELES_DESIGNES: readonly string[] =
  Object.keys(CLES_DESIGNATION);

/**
 * Extrait les désignations d'une requête Prisma.
 *
 * Le `where` d'abord ; le `data` seulement pour les opérations qui CRÉENT.
 *
 * **Le cas `create` a été mesuré, il n'est pas une précaution.** Prisma n'émet
 * pas un `INSERT` nu : il émet `INSERT … RETURNING`, et **PostgreSQL soumet le
 * `RETURNING` à la politique de LECTURE**. Une ligne qu'on vient d'écrire n'est
 * pas encore désignée : la lecture la refuse, et l'insertion échoue — alors même
 * que le `WITH CHECK` l'autorisait. Le même `INSERT` écrit à la main, sans
 * `RETURNING`, passe sous le même contexte.
 *
 * Restreint aux créations : une désignation tirée du `data` d'un `update`
 * laisserait nommer la ligne d'autrui, et l'`update` devrait de toute façon
 * franchir son `USING` — mais on ne s'appuie pas sur un verrou voisin pour
 * justifier une ouverture (§9, 24/08).
 */
export function designationsDe(
  modele: string,
  operation: string,
  args: unknown,
): Designation[] {
  const cles = CLES_DESIGNATION[modele];
  if (cles === undefined) {
    return [];
  }

  const requete = args as
    | { where?: Record<string, unknown>; data?: Record<string, unknown> }
    | undefined;

  const lire = (
    lu: Record<string, unknown> | undefined,
    dans: readonly Cle[],
  ): Designation[] => {
    const sources = aplatirConjonction(lu);
    return dans
      .map((cle) => ({
        variable: cle.variable,
        valeur: sources.reduce(
          (trouve, source) =>
            trouve !== "" ? trouve : texteDe(source[cle.champ]),
          "",
        ),
      }))
      .filter((designation) => designation.valeur !== "");
  };

  const duWhere = lire(requete?.where, cles.ou);
  if (duWhere.length > 0) {
    return duWhere;
  }

  if (operation === "create" || operation === "createMany") {
    const donnees = requete?.data;
    if (donnees !== undefined && donnees !== null && !Array.isArray(donnees)) {
      return lire(donnees, cles.creation);
    }
  }

  return [];
}

/**
 * Le contexte sous lequel une identité est OUVERTE (L1-02c).
 *
 * *Personne ne crée son propre compte.* L'ouverture est un acte administratif :
 * elle se fait sous une société, par un rôle qui administre — matrice §5.2,
 * ligne « Administrer les utilisateurs », `admin_societe` seul (D37). La
 * politique `utilisateur_ouverture` l'exige en base ; ce type l'exige dans le
 * code, pour que l'appelant ait à le DIRE.
 */
export type ContexteAdministratif = {
  /** La société qui ouvre le compte. */
  readonly societeId: string;
  /** Le rôle sous lequel elle l'ouvre. */
  readonly role: string;
};

/** Construit l'instruction qui pose N désignations en UN aller-retour. */
function instruction(designations: readonly Designation[]): {
  sql: string;
  parametres: string[];
} {
  const fragments = designations.map(
    (_, rang) => `set_config($${2 * rang + 1}, $${2 * rang + 2}, true)`,
  );
  return {
    sql: `SELECT ${fragments.join(", ")}`,
    parametres: designations.flatMap((d) => [d.variable, d.valeur]),
  };
}

/**
 * Enveloppe un client Prisma pour que toute opération sur une table
 * d'authentification NOMME la ligne qu'elle demande.
 *
 * Le client rendu est celui qu'on passe à Better Auth.
 */
export function avecDesignationAuth(
  base: PrismaClient,
  administration?: ContexteAdministratif,
): PrismaClient {
  const enveloppe = async (
    modele: string,
    operation: string,
    args: unknown,
    query: (a: unknown) => Promise<unknown>,
  ): Promise<unknown> => {
    const designations = designationsDe(modele, operation, args);

    // Rien de désigné et aucun contexte d'administration : on ne pose rien, et
    // la politique refuse. Ne pas poser est ici la décision sûre — poser une
    // chaîne vide ouvrirait exactement autant, mais laisserait croire qu'on a
    // désigné.
    if (designations.length === 0 && administration === undefined) {
      return query(args);
    }

    return base.$transaction(async (tx) => {
      const aPoser: Designation[] = [...designations];
      if (administration !== undefined) {
        aPoser.push(
          {
            variable: VARIABLE_SESSION_SOCIETE,
            valeur: administration.societeId,
          },
          { variable: VARIABLE_SESSION_ROLE, valeur: administration.role },
        );
      }
      const { sql, parametres } = instruction(aPoser);
      await tx.$executeRawUnsafe(sql, ...parametres);

      const modeles = tx as unknown as Record<
        string,
        Record<string, (a: unknown) => Promise<unknown>>
      >;
      return modeles[modele]![operation]!(args);
    });
  };

  const query: Record<string, unknown> = {};
  for (const modele of MODELES_DESIGNES) {
    query[modele] = {
      async $allOperations({
        operation,
        args,
        query: suite,
      }: {
        operation: string;
        args: unknown;
        query: (a: unknown) => Promise<unknown>;
      }) {
        return enveloppe(modele, operation, args, suite);
      },
    };
  }

  // L'extension est construite en PARCOURANT `CLES_DESIGNATION` plutôt qu'écrite modèle par
  // modèle : la liste des tables couvertes et le comportement sont alors le
  // MÊME objet, et non deux choses qui se ressemblent (§9, 01/09). Le prix est
  // cette conversion — le type de `$extends` énumère les modèles, un objet
  // construit à l'exécution ne peut pas le satisfaire statiquement.
  const extension = { query } as unknown as Parameters<
    PrismaClient["$extends"]
  >[0];
  return base.$extends(extension) as unknown as PrismaClient;
}
