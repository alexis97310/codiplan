import { z } from "zod";

/**
 * LA SAISIE D'UNE ABSENCE (L3-04) — Zod sur toute entrée serveur, sans
 * exception (§2).
 *
 * ## Ce qui NE SE SAISIT PAS
 *
 * **Le statut.** Une absence naît `demandee` et rien d'autre : la laisser
 * naître `validee` donnerait à qui la saisit le pouvoir de déplanifier le
 * planning d'autrui en un appel. La validation est un ACTE SÉPARÉ, et c'est
 * lui qui déplanifie.
 *
 * **La société.** Elle vient du contexte cloisonné, jamais d'un formulaire —
 * c'est la forme de toutes les saisies du dépôt.
 *
 * ## LES DEUX SENS DE LA PRÉCISION
 *
 * Obligatoire sous `autre`, **interdite sous les autres motifs**. Le second
 * sens est celui qu'on oublie (D88, sur les exceptions VGP) : une précision
 * sous un motif énuméré serait une seconde source du même fait, et personne ne
 * saurait laquelle lire. La base le tient aussi — deux verrous qui ne se
 * recouvrent pas, aucun ne remplaçant l'autre.
 */

const uuid = z.string().uuid();

/** Les motifs, clos ICI comme en base. Voir le schéma pour le pourquoi. */
export const MOTIFS_ABSENCE = [
  "conge",
  "arret",
  "formation",
  "recuperation",
  "autre",
] as const;

export type MotifAbsence = (typeof MOTIFS_ABSENCE)[number];

/**
 * Une journée civile, lue en UTC et JAMAIS par un `Date` local : UTC+11 décale
 * le jour d'un cran, et le 14 se rangerait au 13 (L0-08).
 */
const jourCivil = z.date();

export const schemaCreationAbsence = z
  .object({
    utilisateur_id: uuid,
    du: jourCivil,
    au: jourCivil,
    motif: z.enum(MOTIFS_ABSENCE),
    precision: z.string().trim().min(1).nullable().default(null),
  })
  // Une période dont la fin précède le début n'est pas une période. Les bornes
  // sont COMPRISES : une absence d'un seul jour a `du === au`.
  .refine((v) => v.au.getTime() >= v.du.getTime(), {
    message: "La fin d'une absence ne précède pas son début.",
    path: ["au"],
  })
  // LES DEUX SENS, et le second est celui qu'on oublie.
  .refine((v) => (v.motif === "autre") === (v.precision !== null), {
    message:
      "Le motif « autre » exige une précision, et les autres motifs n'en acceptent pas.",
    path: ["precision"],
  });

export type CreationAbsence = z.output<typeof schemaCreationAbsence>;

/**
 * LA DÉCISION SUR UNE ABSENCE — validée ou refusée, jamais « remise à
 * demandée ».
 *
 * *Revenir à `demandee` effacerait qu'un arbitrage a eu lieu*, et une
 * validation qui a déjà déplanifié des interventions ne se défait pas en
 * changeant un mot : elle se refuse, et les interventions se replanifient.
 */
export const schemaDecisionAbsence = z.object({
  absence_id: uuid,
  decision: z.enum(["validee", "refusee"]),
});

export type DecisionAbsence = z.output<typeof schemaDecisionAbsence>;
