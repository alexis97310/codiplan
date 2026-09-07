import { z } from "zod";

/**
 * SAISIE DES HABILITATIONS — l'entrée serveur (ticket L1-04 ; D9, D60).
 *
 * Toute entrée serveur passe par Zod, sans exception (CLAUDE.md §2).
 *
 * ## Ce que ce module ne ferme PAS, et c'est le contraire des deux précédents
 *
 * `lib/sites` clôt l'énumération des zones à l'entrée serveur ; `lib/contacts`
 * y clôt celle des rôles. **Ici, rien n'est clos.** Le CODE d'une habilitation
 * est du texte libre, et c'est la décision D60 : une société suivra des
 * qualifications que nulle nomenclature ne connaît — « formé sur telle presse ».
 * La liste réglementaire française vit dans le SEED, comme un amorçage que
 * chaque société complète ou réduit.
 *
 * *La question à laquelle chacune des trois répond est la même — « où cette
 * liste est-elle close ? » — et les trois réponses diffèrent parce que les trois
 * listes n'ont pas la même durée de vie.* Les zones ne bougeront pas ; les rôles
 * de contact bougeront et doivent bouger sans migration ; les habilitations
 * appartiennent à chaque société, et il n'y a donc aucune liste à fermer.
 */

/** Un identifiant technique du dépôt : UUID (v7 en pratique, I10). */
const identifiant = z.uuid();

/**
 * Création d'une habilitation.
 *
 * `societe_id` n'est PAS une entrée : elle vient du contexte de session, jamais
 * de l'appelant (I1).
 */
export const schemaCreationHabilitation = z.object({
  code: z.string().trim().min(1).max(32),
  libelle: z.string().trim().min(1),
  /**
   * Durée de validité en mois. `null` = l'habilitation n'expire pas.
   *
   * Elle ne CALCULE rien : la date qui décide est portée par chaque instance.
   * Deux sources d'un même fait divergent en silence (§9, 01/09), et celle-ci
   * n'est qu'une aide à la saisie.
   */
  duree_validite_mois: z.int().positive().nullable().default(null),
});

export type CreationHabilitation = z.infer<typeof schemaCreationHabilitation>;

/** Modification : le code se corrige, la société ne se change pas. */
export const schemaModificationHabilitation = z.object({
  code: z.string().trim().min(1).max(32).optional(),
  libelle: z.string().trim().min(1).optional(),
  duree_validite_mois: z.int().positive().nullable().optional(),
  actif: z.boolean().optional(),
});

/**
 * Attribution d'une habilitation à un technicien.
 *
 * **`date_expiration` nulle ne veut pas dire « expirée »** : elle veut dire
 * « n'expire pas ». RG-PLA-04 compare une date à la date d'intervention, et une
 * habilitation sans échéance n'est jamais en retard.
 */
export const schemaAttributionHabilitation = z
  .object({
    utilisateur_id: identifiant,
    habilitation_id: identifiant,
    date_obtention: z.coerce.date(),
    date_expiration: z.coerce.date().nullable().default(null),
  })
  .refine(
    (saisie) =>
      saisie.date_expiration === null ||
      saisie.date_expiration >= saisie.date_obtention,
    {
      path: ["date_expiration"],
      message:
        "Une habilitation ne peut pas expirer avant d'avoir été obtenue.",
    },
  );

export type AttributionHabilitation = z.infer<
  typeof schemaAttributionHabilitation
>;

/**
 * Exigence d'un site.
 *
 * `bloquant` vaut `true` par défaut, ici comme en base. **Le défaut sûr est
 * celui qui refuse** : une exigence qu'on oublie de qualifier doit bloquer, pas
 * avertir.
 */
export const schemaExigenceSite = z.object({
  site_id: identifiant,
  habilitation_id: identifiant,
  bloquant: z.boolean().default(true),
});

export type ExigenceSite = z.infer<typeof schemaExigenceSite>;
