import { z } from "zod";

/**
 * SAISIE D'UN CONTACT — l'entrée serveur (ticket L1-03).
 *
 * Toute entrée serveur passe par Zod, sans exception (CLAUDE.md §2). Ce module
 * porte en plus les deux ÉNUMÉRATIONS que la base ne porte pas, et le choix de
 * l'endroit est la décision du ticket.
 *
 * ## Pourquoi les listes sont ICI et pas en base
 *
 * **Les rôles.** Une société tierce aura d'autres rôles que ceux de CODIMA, et
 * un type énuméré PostgreSQL ferait de leur ajout une **migration**. La colonne
 * est donc `text[]`, et la liste connue est close ici : l'étendre est un
 * changement de code, pas un changement de schéma.
 *
 * C'est le raisonnement des zones géographiques de `lib/sites`, appliqué en
 * SENS INVERSE — et la différence mérite d'être dite, sinon on croira à une
 * recopie. Les zones sont closes à l'entrée serveur parce qu'elles sont la
 * géographie d'UN territoire, une liste qui ne bougera pas. Les rôles de
 * contact sont clos au même endroit parce qu'ils bougeront, et qu'il faut que
 * ce mouvement soit bon marché.
 *
 * **Les canaux.** Un seul est implémenté — `email` —, et aucune passerelle SMS
 * n'est en service ni décidée. Le modèle ne fait pas du SMS une migration : le
 * jour où une passerelle existe, `sms` s'ajoute à `CANAUX_CONNUS` et rien
 * d'autre ne bouge. Critère de bascule NON DATÉ, inscrit au registre des
 * arbitrages — une borne qui porte sa condition plutôt qu'une date (§9, 01/09).
 *
 * ## Ce que ce ticket n'écrit PAS
 *
 * **Aucun envoi.** L1-03 pose la DONNÉE, pas la notification. RG-INT-05 — « toute
 * modification d'une intervention planifiée à moins de 24 h notifie le client
 * et le technicien » — la consommera, et c'est un autre ticket.
 */

/**
 * Les rôles connus, du chapitre 3 (M1).
 *
 * **`signataire` est un rôle parmi l'ensemble, jamais une colonne à part.**
 * RG-INT-04 — « la signature client est obligatoire pour clôturer » — le lit
 * ici. Une colonne `est_signataire` aurait été une seconde source du même fait,
 * et deux sources d'un même fait divergent en silence (§9, 01/09).
 */
export const ROLES_CONTACT = [
  "donneur_ordre",
  "signataire",
  "contact_technique",
  "comptabilite",
] as const;

export type RoleContact = (typeof ROLES_CONTACT)[number];

/**
 * Le rôle que RG-INT-04 interroge. Nommé plutôt que recopié à l'appel : le jour
 * où quelqu'un cherche « qui signe », il trouve la constante et non une chaîne.
 */
export const ROLE_SIGNATAIRE: RoleContact = "signataire";

/**
 * Les canaux de notification connus.
 *
 * **Un seul est IMPLÉMENTÉ**, et la liste ne le dit pas — c'est
 * `CANAUX_IMPLEMENTES` qui le dit. Séparer les deux est le point : un canal
 * peut être une préférence enregistrée sans être un canal servi, et confondre
 * les deux ferait promettre au client un SMS qui ne partira jamais.
 */
export const CANAUX_CONNUS = ["email"] as const;

export type CanalContact = (typeof CANAUX_CONNUS)[number];

/**
 * Ceux qu'on sait réellement servir aujourd'hui.
 *
 * Identique à `CANAUX_CONNUS` pour l'instant, et c'est voulu : on n'enregistre
 * pas une préférence qu'on ne sait pas honorer. Le jour où `sms` rejoint
 * `CANAUX_CONNUS` sans rejoindre celle-ci, la distinction devient vivante et un
 * test la mesure.
 */
export const CANAUX_IMPLEMENTES: readonly CanalContact[] = ["email"];

/** Le canal par défaut : celui que le chapitre 3 suppose, et le seul servi. */
export const CANAL_PAR_DEFAUT: CanalContact = "email";

/**
 * Un ensemble : non vide, sans doublon, et clos sur la liste connue.
 *
 * La base tient déjà « non vide, sans doublon, sans entrée vide » — ce sont des
 * PROPRIÉTÉS. Elle ne tient pas le CONTENU, et c'est la répartition voulue :
 * la propriété en base, où elle ne rouille pas ; le contenu ici, où l'étendre
 * ne coûte pas une migration. Les deux se recouvrent volontairement sur la
 * non-vacuité — un refus rendu à l'utilisateur vaut mieux qu'un refus de
 * PostgreSQL, et le second reste là si personne ne passe par le premier.
 */
function ensembleClos<T extends string>(
  valeurs: readonly [T, ...T[]],
  quoi: string,
) {
  return z
    .array(z.enum(valeurs))
    .min(1, `Au moins un ${quoi} est requis.`)
    .refine(
      (liste) => new Set(liste).size === liste.length,
      `Un ${quoi} ne peut pas être répété.`,
    );
}

/**
 * Le courriel est exigé dès que le canal `email` est demandé.
 *
 * **La dépendance entre deux champs est dite à l'entrée serveur ET tenue en
 * base** (`contact_courriel_si_canal_email`). Les deux ne se remplacent pas :
 * Zod ne voit ni l'import Excel de L1-08 ni une correction faite à la main, et
 * la base ne rend pas de message affichable. C'est la forme de D56.
 */
function exigerCourrielSiCanalEmail<
  T extends { canaux: readonly string[]; email?: string | null },
>(saisie: T, contexte: z.RefinementCtx): void {
  if (saisie.canaux.includes("email") && !saisie.email) {
    contexte.addIssue({
      code: "custom",
      path: ["email"],
      message:
        "Un contact notifié par courriel doit porter une adresse électronique.",
    });
  }
}

const champsCommuns = {
  nom: z.string().trim().min(1),
  fonction: z.string().trim().min(1).nullable().default(null),
  telephone: z.string().trim().min(1).nullable().default(null),
  mobile: z.string().trim().min(1).nullable().default(null),
  email: z.email().nullable().default(null),
  roles: ensembleClos(ROLES_CONTACT, "rôle"),
  canaux: ensembleClos(CANAUX_CONNUS, "canal").default([CANAL_PAR_DEFAUT]),
};

/**
 * Création d'un contact.
 *
 * `client_id` EST une entrée — c'est l'utilisateur qui choisit de quel client
 * est ce contact. `societe_id` n'en est pas une : elle vient du contexte de
 * session, jamais de l'appelant (I1).
 *
 * **`site_id` est facultatif, et son absence PORTE DU SENS** : elle dit
 * « contact du client ». Un tel contact ne disparaît pas pour un compte portail
 * restreint à certains sites — sinon on perdrait le comptable en restreignant
 * un atelier. La politique de `contact` porte la branche qui le garantit, et un
 * scénario l'éprouve.
 */
export const schemaCreationContact = z
  .object({
    client_id: z.uuid(),
    site_id: z.uuid().nullable().default(null),
    ...champsCommuns,
  })
  .superRefine(exigerCourrielSiCanalEmail);

export type CreationContact = z.infer<typeof schemaCreationContact>;

/**
 * Modification d'un contact.
 *
 * **`client_id` n'est PAS modifiable, et c'est une décision** — la même que
 * pour `site.client_id` (L1-02). Déplacer un contact d'un client à l'autre
 * n'est pas une correction de saisie : c'est effacer un interlocuteur chez l'un
 * et en créer un chez l'autre, avec l'historique qui ne suit pas. `site_id`,
 * lui, se modifie : un interlocuteur change d'atelier.
 */
export const schemaModificationContact = z
  .object({
    site_id: z.uuid().nullable().optional(),
    nom: champsCommuns.nom.optional(),
    fonction: z.string().trim().min(1).nullable().optional(),
    telephone: z.string().trim().min(1).nullable().optional(),
    mobile: z.string().trim().min(1).nullable().optional(),
    email: z.email().nullable().optional(),
    roles: ensembleClos(ROLES_CONTACT, "rôle").optional(),
    canaux: ensembleClos(CANAUX_CONNUS, "canal").optional(),
    actif: z.boolean().optional(),
  })
  .superRefine((saisie, contexte) => {
    if (saisie.canaux !== undefined) {
      exigerCourrielSiCanalEmail(
        { canaux: saisie.canaux, email: saisie.email },
        contexte,
      );
    }
  });

export type ModificationContact = z.infer<typeof schemaModificationContact>;

/** Vrai si ce contact peut signer — RG-INT-04 le lit ici, et nulle part ailleurs. */
export function peutSigner(roles: readonly string[]): boolean {
  return roles.includes(ROLE_SIGNATAIRE);
}
