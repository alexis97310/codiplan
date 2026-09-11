import { type PrismaClient } from "@prisma/client";

import { estContexteActif } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

import { auth, type Auth } from "./config";
import { exigeSecondFacteur, type Role } from "./roles";
import { obtenirSession } from "./session";
import { habilitationsDuCompte } from "./societe-active";

/**
 * CE QUE LA PAGE D'ARRIVÉE A LE DROIT DE DIRE (ticket L1-02f).
 *
 * ## Le périmètre est étroit, et c'est la moitié du ticket
 *
 * Qui vous êtes, pour quelle société, sous quel rôle. **Rien d'autre** : pas de
 * liste de clients, pas de navigation, pas de menu. Ce n'est pas de la
 * frugalité de façade — chaque donnée de plus serait un écran de lot 2 écrit
 * en avance, hors du plan.
 *
 * ## POURQUOI CE MODULE EXISTE PLUTÔT QU'UNE PAGE QUI LIRAIT DIRECTEMENT
 *
 * Parce que c'est LUI qui porte la dette que ce ticket devait payer : *le
 * cloisonnement est prouvé dans la base, jamais à travers l'application.* Une
 * lecture écrite dans un composant de page ne s'éprouve qu'en montant un
 * navigateur ; écrite ici, elle s'éprouve sous le rôle applicatif restreint,
 * politiques comprises, par la même fonction que la page appelle réellement.
 *
 * C'est le même parti pris que `lireThemeCloisonne` a pris à L0-09, et pour la
 * même raison : *les scénarios doivent éprouver la requête que sert
 * l'application, jamais une variante écrite pour le test.*
 *
 * ## LA RAISON SOCIALE EST LUE SOUS LE CONTEXTE, JAMAIS PORTÉE PAR LA SESSION
 *
 * La session ne porte qu'un identifiant de société. Le nom vient de la table
 * `societe`, dont la politique est de forme « identité » (`id =
 * app.societe_id`, D42) : une session active sur A ne peut donc pas obtenir le
 * nom de B — **pas même en passant l'identifiant de B**, puisque la politique
 * ne laisse voir que la société du contexte. C'est ce qui rend cette page
 * capable de PROUVER le cloisonnement plutôt que de l'illustrer.
 */

/** Ce que la page d'arrivée affiche, et rien de plus. */
export type Arrivee = {
  /** Nom de la personne connectée. */
  readonly nom: string;
  /** Son adresse électronique — l'identifiant qu'elle a saisi. */
  readonly email: string;
  /**
   * Raison sociale de la société active, `null` tant qu'aucune ne l'est.
   *
   * Lue en base sous le contexte, jamais recopiée depuis la session.
   */
  readonly societe: string | null;
  /** Rôle tenu sur cette société, `null` en l'absence de société active. */
  readonly role: Role | null;
};

/** Ce qu'un appelant obtient, et ce qu'il doit en faire. */
export type EtatArrivee =
  /** Personne n'est connecté : la page de connexion. */
  | { readonly issue: "anonyme" }
  /**
   * Connecté, mais un rôle exige un second facteur que le compte n'a pas encore
   * posé : le parcours d'enrôlement, et lui seul.
   */
  | { readonly issue: "enrolement_requis"; readonly role: Role }
  /** Connecté, société active : la page d'arrivée. */
  | { readonly issue: "arrivee"; readonly arrivee: Arrivee }
  /**
   * Connecté, aucune société active — parce que le compte n'est habilité nulle
   * part, ou parce qu'il l'est sur PLUSIEURS et que le sélecteur est un écran de
   * back-office, hors du périmètre de ce ticket. La page le DIT, elle ne
   * l'invente pas.
   */
  | { readonly issue: "sans_societe"; readonly arrivee: Arrivee };

/**
 * Le rôle qui réclame un enrôlement, ou `null`.
 *
 * **L'ordre du jugement n'est pas indifférent.** Un `admin_societe` sans second
 * facteur n'a AUCUNE société active — `motifRefusContexte` la lui refuse —, si
 * bien qu'un jugement qui commencerait par la société le renverrait
 * indéfiniment vers un sélecteur qui ne l'aiderait en rien. Le motif réel est
 * l'enrôlement, et c'est lui qu'il faut nommer.
 *
 * Le compte peut être habilité sur plusieurs sociétés sous des rôles
 * différents : **il suffit qu'UN seul l'exige.** Enrôler pour l'un enrôle pour
 * tous — le second facteur est porté par l'identité, pas par l'habilitation.
 */
export function roleReclamantUnEnrolement(
  habilitations: readonly { readonly role: Role }[],
  mfaActif: boolean,
): Role | null {
  if (mfaActif) {
    return null;
  }
  return (
    habilitations.map((h) => h.role).find((role) => exigeSecondFacteur(role)) ??
    null
  );
}

/**
 * L'ÉTAT D'ARRIVÉE POUR UN ÉCRAN QUI PRÉCÈDE LA SESSION — et qui, lui, ne lève
 * JAMAIS (R2-16).
 *
 * ## Le même incident, son troisième appelant
 *
 * Le 11/09, `lib/auth/chrome.ts` a été écrit parce que la mise en page racine
 * levait sans `BETTER_AUTH_SECRET` et faisait rendre 500 à TOUTES les pages. Il
 * y notait déjà la forme du défaut : *« la garantie était énoncée pour le
 * THÈME, et un second appelant a traversé l'énoncé sans le rencontrer. »*
 *
 * **Voici le troisième, mesuré le même jour par le scénario de R2-16** — la
 * racine réparée, `/connexion` et `/enrolement` rendaient toujours **500** sur
 * une compilation de production sans secret, parce que la PAGE lisait la
 * session par `etatArrivee`, qui lève. *Une page de connexion qui rend 500
 * quand la configuration manque est le pire mode de défaillance du produit :
 * personne ne peut même lire le formulaire pour comprendre.*
 *
 * ## Ce que cette fonction garantit, et ce qu'elle coûte
 *
 * **Elle ne lève jamais.** Toute impossibilité — secret absent, base
 * injoignable, session illisible — rend `anonyme`, c'est-à-dire « montre le
 * formulaire ». C'est le contrat de `identiteDeChrome` et celui de
 * `themeDuContexte`, rendu à l'endroit où il manquait.
 *
 * **Le coût est nommé** : une personne DÉJÀ connectée, si sa session devient
 * illisible, revoit la page de connexion au lieu d'une erreur. C'est une
 * dégradation, jamais un droit accordé — aucune donnée cloisonnée ne transite
 * par `anonyme`, et le refus d'accès reste prononcé par les politiques et par
 * `exigerContexteActif`.
 *
 * **`etatArrivee` garde sa forme qui lève**, et `/arrivee` continue de
 * l'appeler : c'est un écran d'APRÈS-session, où une impossibilité doit se
 * voir. La coupure est la même que celle du chrome — ce qui précède la session
 * ne tombe pas avec elle.
 */
export async function etatArriveeOuAnonyme(
  entetes: Headers,
  lecture: (e: Headers) => Promise<EtatArrivee> = (e) => etatArrivee(e),
): Promise<EtatArrivee> {
  try {
    return await lecture(entetes);
  } catch {
    return { issue: "anonyme" };
  }
}

/**
 * L'état d'arrivée d'une requête, d'après ses en-têtes.
 *
 * Cette fonction ne fait qu'assembler ; chacune de ses lectures est cloisonnée
 * là où elle vit — les habilitations par la forme « appartenance », la raison
 * sociale par la forme « identité » de `societe`.
 */
export async function etatArrivee(
  entetes: Headers,
  instance: Auth = auth(),
  client?: PrismaClient,
): Promise<EtatArrivee> {
  const session = await obtenirSession(entetes, instance);
  if (session === null) {
    return { issue: "anonyme" };
  }

  const contexte = session.contexte;
  const socle = {
    nom: session.identite.nom,
    email: session.identite.email,
  };

  const habilitations = await habilitationsDuCompte(
    contexte.utilisateurId,
    client,
  );
  const aEnroler = roleReclamantUnEnrolement(
    habilitations,
    session.identite.mfaActif,
  );
  if (aEnroler !== null) {
    return { issue: "enrolement_requis", role: aEnroler };
  }

  if (!estContexteActif(contexte)) {
    return {
      issue: "sans_societe",
      arrivee: { ...socle, societe: null, role: null },
    };
  }

  const societeId = contexte.societeId;
  const societe = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.societe.findFirst({
        where: { id: societeId },
        select: { raison_sociale: true },
      }),
    client,
  );

  return {
    issue: "arrivee",
    arrivee: {
      ...socle,
      // `null` quand la politique n'a rien rendu : la page dira « aucune
      // société active » plutôt que d'afficher un nom inventé.
      societe: societe?.raison_sociale ?? null,
      role: contexte.role,
    },
  };
}
