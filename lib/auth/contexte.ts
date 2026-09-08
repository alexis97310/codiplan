import { z } from "zod";

import {
  estRolePortail,
  exigeSecondFacteur,
  schemaRole,
  type Role,
} from "./roles";

/**
 * Contexte porté par une session serveur (ticket L0-06).
 *
 * C'est le seul objet qui autorise une lecture cloisonnée : `societeId` alimente
 * `app.societe_id` et `role` alimente `app.role`. Les décisions ci-dessous sont
 * pures — aucune base, aucun cadre web — pour qu'elles soient éprouvées par des
 * tests unitaires et non seulement par le bout de la chaîne.
 */

/** Contexte tel que la session le porte. Société et rôle vont toujours ensemble. */
export type ContexteSession = {
  /** Identifiant du compte connecté. */
  utilisateurId: string;
  /** Société active, `null` tant qu'aucune n'a été choisie ou accordée. */
  societeId: string | null;
  /** Rôle tenu sur cette société, `null` en l'absence de société active. */
  role: Role | null;
  /** Le second facteur a été présenté et validé à l'ouverture de la session. */
  secondFacteurValide: boolean;
  /**
   * Adresse de l'appelant, telle que Better Auth l'a enregistrée sur la ligne
   * `session` (L0-10). Elle n'autorise rien et ne filtre rien : elle alimente
   * la colonne `adresse_ip` du journal d'audit, que le chapitre 11.2 demande.
   * `null` quand la session n'en porte pas — jamais une valeur inventée.
   */
  adresseIp: string | null;
};

export const schemaContexteSession = z.object({
  utilisateurId: z.uuid(),
  societeId: z.uuid().nullable(),
  role: schemaRole.nullable(),
  secondFacteurValide: z.boolean(),
  adresseIp: z.string().nullable(),
});

/** Contexte dont la société et le rôle sont établis : le seul qui lit quelque chose. */
export type ContexteActif = ContexteSession & {
  societeId: string;
  role: Role;
};

/**
 * Motif de refus d'un contexte, ou `null` s'il peut ouvrir une transaction
 * cloisonnée.
 *
 * Trois refus, dans cet ordre :
 *   1. **aucune société active** — la session ne doit alors rien pouvoir lire.
 *      La base le garantit déjà (sans `app.societe_id`, les politiques
 *      renvoient zéro ligne) ; on refuse néanmoins d'ouvrir la transaction,
 *      pour que l'absence de société soit une erreur explicite et non une liste
 *      vide qu'un écran afficherait comme « aucun résultat » ;
 *   2. **rôle manquant** — une société sans rôle ne dit pas ce que l'utilisateur
 *      a le droit d'y faire, et laisserait `app.role` vide ;
 *   3. **second facteur absent** sur un rôle qui l'exige (`admin_plateforme`,
 *      `direction`) ;
 *   4. **rôle du portail** — et ce quatrième refus est le seul qui ferme un
 *      trou MESURÉ plutôt qu'il n'explicite une absence. Voir ci-dessous.
 *
 * ## LE QUATRIÈME REFUS : `app.client_id` N'A AUCUN POSEUR DE PRODUCTION
 *
 * La forme « parc » des politiques (D10, D22) lit trois variables — société,
 * `app.client_id`, `app.perimetre_sites` — et sa deuxième clause s'écrit
 * *« `app.client_id` EST NULL **OU** `client_id` = `app.client_id` »*. **Une
 * variable vide DÉSACTIVE donc le filtre**, ce qui est voulu : c'est ainsi
 * qu'un utilisateur interne voit le parc entier de sa société.
 *
 * Or `avecContexteApplicatif` — le seul chemin de production qui ouvre une
 * transaction cloisonnée depuis une session — **ne peut pas la renseigner** :
 * `ContexteSession` ne porte aucun champ de client, et `POSE` l'écrit donc
 * toujours à vide. *Un compte portail qui atteindrait ce chemin lirait le parc
 * entier de sa société, tous clients confondus.*
 *
 * **Mesuré sur la base jetable**, sous `codiplan_app` (ni superutilisateur, ni
 * `BYPASSRLS`), deux témoins d'abord — le rôle est restreint, et sans contexte
 * la table rend zéro ligne :
 *
 * | Contexte posé | Ce que lit un compte portail du client `c2` |
 * | --- | --- |
 * | société + rôle `client`, `app.client_id` **vide** *(ce que pose la production)* | **2 machines du client `c1`** |
 * | le même, `app.client_id` **posé** *(ce qu'arme le harnais)* | **0 ligne** |
 *
 * **C'est la faute que L1-02b a fermée, revenue d'un étage plus haut.** Là, le
 * harnais armait une variable que la production n'armait pas ; ici, la
 * production la POSE — le gardien de `scripts/lib/contexte-rls.ts` est donc
 * vert, et il a raison — mais **rien ne peut lui donner de valeur**. *Un
 * gardien qui vérifie qu'une variable est posée ne vérifie pas qu'elle est
 * renseignable.*
 *
 * **Pourquoi un REFUS et pas un branchement.** D'où doit venir `client_id` —
 * de l'appelant, comme la société, ou de la base, comme `app.perimetre_sites`
 * qui se dérive déjà de `utilisateur_client_site` — est une décision de
 * cloisonnement, et elle est INSCRITE, pas prise ici. En attendant, le chemin
 * ferme : *une garantie manquante se signale par un refus, jamais par une
 * lecture réussie.*
 *
 * **Ce que ce refus ne casse pas, et c'est mesuré aussi** : aucun compte
 * portail ne peut aujourd'hui atteindre ce chemin. `utilisateur_societe` ne
 * porte AUCUNE ligne de rôle `client` (D10 — un compte portail se rattache par
 * `utilisateur_client`), si bien que `habilitationsDuCompte` ne lui rend rien
 * et que le refus n° 1 tombe avant celui-ci. **Cette fermeture-là est une
 * conséquence, pas une garantie** : elle disparaît le jour où quelqu'un donne
 * une société active à un compte portail, ce qui est exactement le premier
 * geste du ticket qui construira le portail.
 */
export function motifRefusContexte(contexte: ContexteSession): string | null {
  if (contexte.societeId === null) {
    return (
      "Aucune société active sur cette session : aucune donnée cloisonnée ne " +
      "peut être lue. Activer une société sur laquelle le compte est habilité."
    );
  }
  if (contexte.role === null) {
    return (
      "Session sans rôle sur la société active : le rôle est requis pour " +
      "déterminer les droits et alimenter `app.role`."
    );
  }
  if (exigeSecondFacteur(contexte.role) && !contexte.secondFacteurValide) {
    return (
      `Le rôle « ${contexte.role} » exige un second facteur, absent de cette ` +
      "session. Activer le second facteur sur le compte, puis se reconnecter."
    );
  }
  if (estRolePortail(contexte.role)) {
    return (
      "Rôle du portail client : ce chemin ne sait pas poser `app.client_id`, " +
      "et la forme « parc » traite une valeur vide comme « utilisateur " +
      "interne » — la transaction lirait le parc ENTIER de la société. Le " +
      "chemin du portail reste à construire, et l'origine de `client_id` est " +
      "une décision inscrite au registre, pas un défaut de renseignement."
    );
  }
  return null;
}

/** Vrai si le contexte porte une société et un rôle exploitables. */
export function estContexteActif(
  contexte: ContexteSession,
): contexte is ContexteActif {
  return motifRefusContexte(contexte) === null;
}

/** Renvoie le contexte actif, ou lève avec le motif du refus. */
export function exigerContexteActif(contexte: ContexteSession): ContexteActif {
  const motif = motifRefusContexte(contexte);
  if (motif !== null) {
    throw new Error(motif);
  }
  return contexte as ContexteActif;
}
