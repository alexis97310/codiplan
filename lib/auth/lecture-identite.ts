import type { PrismaClient } from "@prisma/client";

import {
  VARIABLE_SESSION_AUTH_EMAIL,
  VARIABLE_SESSION_AUTH_UTILISATEUR,
  VARIABLE_SESSION_ROLE,
  VARIABLE_SESSION_SOCIETE,
} from "@/lib/db/rls";

/**
 * LA VÉRIFICATION D'IDENTIFIANTS, ET SA BORNE (ticket L1-02c).
 *
 * ## Pourquoi ce module existe
 *
 * `utilisateur` est cloisonnée en base depuis L1-02c. Mais l'authentification
 * **précède** la société : chercher « existe-t-il un compte pour ce courriel »
 * se fait à un moment où aucune société n'est connue et ne peut l'être. Sous
 * une politique de société seule, la lecture rend zéro et personne ne se
 * connecte — mesuré.
 *
 * La politique porte donc une branche « DÉSIGNATION » : l'appelant ne peut lire
 * que **la ligne qu'il nommait déjà**. Ce module est ce qui la nomme.
 *
 * ## Ce qu'il fait, et pourquoi une transaction
 *
 * Chaque lecture de `utilisateur` part dans **sa propre transaction**, qui pose
 * la variable de désignation tirée du `where` de la requête — puis la laisse
 * mourir au `COMMIT`.
 *
 * **La transaction n'est pas une précaution de style : c'est la garantie.**
 * Mesuré : `set_config(…, is_local => false)` **persiste sur la connexion** et
 * serait lu par la requête suivante — d'un AUTRE utilisateur, derrière un
 * pooler. Ce serait pire que le mal qu'on répare. `set_config(…, is_local =>
 * true)` meurt au `COMMIT` **et** au `ROLLBACK`, et un scénario le vérifie en
 * relisant la variable sur la connexion après coup.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il n'écrit rien et n'ouvre aucune écriture : la branche de désignation est en
 * `SELECT` seul. Ouvrir une identité est un acte administratif, gouverné par sa
 * propre expression `WITH CHECK` — voir la migration `20260907130000`.
 *
 * Et il ne pose rien quand la requête ne DÉSIGNE personne : une lecture sans
 * `where` sur le courriel ni sur l'identifiant part sans variable, et la
 * politique la refuse. C'est voulu — un balayage n'est pas une vérification
 * d'identifiants.
 *
 * ## L'adaptateur de Better Auth n'est pas déformé
 *
 * Il reçoit un client Prisma, et c'est tout ce qu'il connaît. L'enveloppe est
 * une extension du client, pas une modification de la bibliothèque.
 */

/** Le `where` d'une requête Prisma, réduit à ce qui DÉSIGNE une ligne. */
type Designation = { readonly email: string; readonly id: string };

/**
 * Extrait la désignation d'un `where` Prisma.
 *
 * Deux formes sont reconnues, et ce sont celles que Better Auth émet
 * réellement — mesurées en traçant une connexion : `{ email: "x" }` et
 * `{ email: { equals: "x" } }` pour la recherche par courriel, `{ id: "…" }`
 * pour la relecture de l'identité qu'il vient de trouver.
 *
 * Toute autre forme rend une désignation VIDE, et la politique refuse. C'est le
 * bon sens du défaut : ce qui n'est pas reconnu ne passe pas.
 */
function courrielDe(champ: unknown): string {
  if (typeof champ === "string") {
    return champ;
  }
  const egal = (champ as { equals?: unknown } | undefined)?.equals;
  return typeof egal === "string" ? egal : "";
}

export function designationDe(args: unknown, operation = ""): Designation {
  const requete = args as
    | { where?: Record<string, unknown>; data?: Record<string, unknown> }
    | undefined;

  const ou = requete?.where;
  if (ou !== undefined && ou !== null) {
    const email = courrielDe(ou.email);
    const id = typeof ou.id === "string" ? ou.id : "";
    if (email !== "" || id !== "") {
      return { email, id };
    }
  }

  // ── LE CAS `create`, ET IL A ÉTÉ MESURÉ ────────────────────────────────
  //
  // Prisma n'émet pas un `INSERT` nu : il émet `INSERT … RETURNING`, et
  // **PostgreSQL soumet le `RETURNING` à la politique de LECTURE**. Une
  // identité qu'on vient d'ouvrir n'a encore ni habilitation ni société : la
  // lecture la refuse, et l'insertion échoue — alors même que le `WITH CHECK`
  // l'autorisait. Mesuré : le même `INSERT` écrit à la main, sans `RETURNING`,
  // passe sous le même contexte.
  //
  // L'administrateur DÉSIGNE donc l'identité qu'il ouvre : c'est le courriel
  // qu'il vient de saisir, et la forme « désignation » ne rend jamais plus que
  // ce que l'appelant savait déjà. `upsert` n'en a pas besoin — son `where`
  // porte déjà le courriel, et c'est pourquoi le seed passait là où `create`
  // échouait.
  //
  // Restreint aux opérations d'ÉCRITURE qui créent : une désignation tirée du
  // `data` d'un `update` laisserait nommer la ligne d'autrui, et l'`update`
  // devrait de toute façon franchir son `USING` — mais on ne s'appuie pas sur
  // un verrou voisin pour justifier une ouverture (§9, 24/08).
  if (operation === "create" || operation === "createMany") {
    const donnees = requete?.data;
    if (donnees !== undefined && donnees !== null && !Array.isArray(donnees)) {
      return {
        email: courrielDe(donnees.email),
        id: typeof donnees.id === "string" ? donnees.id : "",
      };
    }
  }

  return { email: "", id: "" };
}

/** L'instruction qui pose les deux désignations, bornée à la transaction. */
const SQL_DESIGNATION =
  "SELECT set_config($1, $2, true), set_config($3, $4, true)";

/** L'instruction qui pose le contexte d'ADMINISTRATION, bornée elle aussi. */
const SQL_ADMINISTRATION =
  "SELECT set_config($1, $2, true), set_config($3, $4, true)";

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

/**
 * Enveloppe un client Prisma pour que toute lecture de `utilisateur` nomme la
 * ligne qu'elle demande.
 *
 * Le client rendu est celui qu'on passe à Better Auth. Les autres modèles ne
 * sont pas touchés : `session`, `compte` et `verification` n'ont pas de
 * politique (troisième catégorie de I1, D34).
 */
export function avecDesignationIdentite(
  base: PrismaClient,
  administration?: ContexteAdministratif,
): PrismaClient {
  return base.$extends({
    query: {
      utilisateur: {
        async $allOperations({ operation, args, query }) {
          const { email, id } = designationDe(args, operation);
          const designe = email !== "" || id !== "";

          // Rien de désigné et aucun contexte d'administration : on ne pose
          // rien, et la politique refuse. Ne pas poser est ici la décision
          // sûre — poser une chaîne vide ouvrirait exactement autant, mais
          // laisserait croire qu'on a désigné.
          if (!designe && administration === undefined) {
            return query(args);
          }

          return base.$transaction(async (tx) => {
            if (designe) {
              await tx.$executeRawUnsafe(
                SQL_DESIGNATION,
                VARIABLE_SESSION_AUTH_EMAIL,
                email,
                VARIABLE_SESSION_AUTH_UTILISATEUR,
                id,
              );
            }
            if (administration !== undefined) {
              await tx.$executeRawUnsafe(
                SQL_ADMINISTRATION,
                VARIABLE_SESSION_SOCIETE,
                administration.societeId,
                VARIABLE_SESSION_ROLE,
                administration.role,
              );
            }
            const modele = (
              tx as unknown as Record<
                string,
                Record<string, (a: unknown) => Promise<unknown>>
              >
            ).utilisateur;
            return modele[operation]!(args);
          });
        },
      },
    },
  }) as unknown as PrismaClient;
}
