import { z } from "zod";

/**
 * SAISIE DU MODULE DE PRÊT D'ÉQUIPEMENT (9L60-PRET-1-MODELE, D287).
 *
 * L'entrée serveur, validée par Zod sans exception (CLAUDE.md §2). Les bornes
 * qui comptent — un retour qui ne précède jamais la sortie, au plus un prêt en
 * cours par appareil — sont posées en base (migration `pret_equipement`) : Zod
 * répète ce qu'il peut pour que le refus arrive à l'écran plutôt qu'en `500`,
 * la base restant la source qui tranche en dernier ressort.
 */

/** Un texte obligatoire, une fois les espaces de bordure retirés. */
const texteNonVide = z.string().trim().min(1);

export const schemaAppareilPret = z.object({
  designation: texteNonVide,
  marque: z.string().trim().min(1).nullable().default(null),
  modele: z.string().trim().min(1).nullable().default(null),
  numero_serie: z.string().trim().min(1).nullable().default(null),
});

export type SaisieAppareilPret = z.infer<typeof schemaAppareilPret>;

/**
 * La sortie d'un prêt. `date_retour_prevue` n'est PAS comparée à
 * `date_sortie` ici — Zod valide un champ isolément, la comparaison entre
 * deux dates du même objet est une règle de COHÉRENCE que
 * `pret_equipement_retour_prevue_pas_avant_sortie` tient en base, et que le
 * dépôt revérifie avant d'écrire (refus nommé plutôt qu'un `500` PostgreSQL).
 */
export const schemaSortiePret = z.object({
  appareil_id: z.uuid(),
  intervention_id: z.uuid(),
  date_sortie: z.date(),
  date_retour_prevue: z.date(),
  etat_depart: texteNonVide,
  observations: z.string().trim().min(1).nullable().default(null),
});

export type SaisieSortiePret = z.infer<typeof schemaSortiePret>;

export const schemaRetourPret = z.object({
  date_retour_reelle: z.date(),
  etat_retour: texteNonVide,
  /** `null` = l'appareil revient disponible. Toute autre valeur l'envoie en révision. */
  en_revision: z.boolean().default(false),
  observations: z.string().trim().min(1).nullable().default(null),
});

export type SaisieRetourPret = z.infer<typeof schemaRetourPret>;
