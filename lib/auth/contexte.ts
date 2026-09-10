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
  /**
   * Client pour lequel un compte PORTAIL agit — `null` pour tout autre rôle.
   *
   * **C'est une DÉSIGNATION, pas une autorisation** (D70). Elle alimente
   * `app.client_id`, et la base refuse la pose si ce client ne figure pas
   * parmi les habilitations de ce compte — `app_poser_perimetre_client` lève,
   * dans la même transaction que la pose. *Ce champ dit POUR QUI le compte
   * agit ; la base dit s'il en a le droit.*
   *
   * Pourquoi l'appelant le fournit plutôt que la base ne le dérive : la
   * dérivation N'EST PAS UNIQUE. `utilisateur_client` porte
   * `UNIQUE (utilisateur_id, client_id)` et non `(utilisateur_id, societe_id)`
   * — un même compte tient légitimement plusieurs clients d'une même société
   * (éprouvé en base). La base ne peut donc pas choisir à la place du compte
   * sans inventer une règle que personne n'a décidée.
   */
  clientId: string | null;
};

export const schemaContexteSession = z.object({
  utilisateurId: z.uuid(),
  societeId: z.uuid().nullable(),
  role: schemaRole.nullable(),
  secondFacteurValide: z.boolean(),
  adresseIp: z.string().nullable(),
  clientId: z.uuid().nullable(),
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
 *   4. **rôle du portail SANS client désigné**, et
 *   5. **client désigné par un rôle qui n'est pas celui du portail**.
 *
 * ## LES DEUX DERNIERS : L'APPARIEMENT RÔLE ↔ CLIENT *(D70)*
 *
 * La forme « parc » des politiques (D10, D22) lit trois variables — société,
 * `app.client_id`, `app.perimetre_sites` — et sa deuxième clause s'écrit
 * *« `app.client_id` EST NULL **OU** `client_id` = `app.client_id` »*. **Une
 * variable vide DÉSACTIVE donc le filtre**, ce qui est voulu : c'est ainsi
 * qu'un utilisateur interne voit le parc entier de sa société.
 *
 * Le 09/09, `avecContexteApplicatif` ne savait pas la renseigner : un compte
 * portail qui atteignait ce chemin lisait le parc entier. *Mesuré sous
 * `codiplan_app`, après deux témoins — rôle non privilégié, zéro ligne sans
 * contexte : un compte portail du client `c2` lisait **2 machines du client
 * `c1`** ; le même contexte, `app.client_id` posé, rendait **0**.*
 *
 * **La réparation n'est ni « l'appelant fournit » ni « la base dérive » : les
 * deux.** L'appelant DÉSIGNE — `clientId` ci-dessus —, et la base DISPOSE :
 * `app_poser_perimetre_client` refuse la pose si le client désigné ne figure
 * pas parmi les habilitations de ce compte, dans la même transaction. C'est
 * exactement la forme de `app.societe_id`.
 *
 * *Pourquoi pas la base seule :* la dérivation n'est pas unique — un compte
 * tient légitimement plusieurs clients d'une même société (éprouvé en base).
 * *Pourquoi pas l'appelant seul :* une valeur qui désigne ne vient jamais de
 * l'extérieur sans être validée (L1-02e).
 *
 * **Et les deux sens sont fermés.** Le portail sans client rouvrirait la
 * branche « utilisateur interne » ; un rôle interne AVEC client déplacerait en
 * silence le discriminant de la forme « habilitation » (L1-02b), qui distingue
 * précisément le compte portail de tous les autres.
 */
/**
 * LA SOCIÉTÉ ACTIVE, EXIGÉE — une seule maison pour ce contrôle.
 *
 * `avecContexteApplicatif` refuse déjà un contexte sans société. Ce contrôle est
 * là pour que le TYPE soit `string` et non `string | null` au moment d'écrire
 * une colonne `societe_id`, et pour que l'appel n'ait pas à le savoir.
 *
 * **Il vivait en TROIS copies** — `lib/clients/depot.ts`, `lib/sites/depot.ts`,
 * et il allait en recevoir une quatrième au lot 8. Trois écritures d'un même
 * critère, chacune juste, que rien ne confrontait : c'est la faute du §9
 * (01/09), et la parade qu'il prescrit est celle-ci — *« soit on la remplace
 * par un appel à la première, ce qui est presque toujours possible et presque
 * toujours meilleur »*. Les trois appellent désormais celle-là.
 *
 * Le message est destiné à un DÉVELOPPEUR : il ne passe pas par le dictionnaire
 * (`lib/i18n/fr.ts`, la coupure de L0-11).
 */
export function exigerSocieteActive(contexte: ContexteSession): string {
  if (contexte.societeId === null) {
    throw new Error(
      "Aucune société active : `avecContexteApplicatif` aurait dû refuser " +
        "cette transaction avant d'en arriver ici.",
    );
  }
  return contexte.societeId;
}

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
  // ── QUATRIÈME ET CINQUIÈME MOTIFS : L'APPARIEMENT RÔLE ↔ CLIENT (D70) ──
  //
  // Ils ferment les deux sens, et le second est celui qu'on oublie.
  if (estRolePortail(contexte.role) && contexte.clientId === null) {
    return (
      "Rôle du portail sans client désigné : `app.client_id` resterait vide, " +
      "et la forme « parc » lit une valeur vide comme « utilisateur interne » " +
      "— la transaction ouvrirait le parc ENTIER de la société. Un compte " +
      "portail désigne toujours le client pour lequel il agit."
    );
  }
  if (!estRolePortail(contexte.role) && contexte.clientId !== null) {
    return (
      `Le rôle « ${contexte.role} » n'est pas un rôle du portail et ne ` +
      "désigne aucun client : `app.client_id` est posée pour un compte " +
      "portail et pour lui seul (D10). Une désignation ailleurs déplacerait " +
      "en silence ce que la forme « habilitation » discrimine."
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
