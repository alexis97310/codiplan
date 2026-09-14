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
 * ## ET LA NATURE NE SE SAISIT PLUS NON PLUS (R3-14, 14/09/2026)
 *
 * Décision **PROVISOIRE** de l'exploitation, en attente de ratification.
 * `absence.motif` est une énumération — `conge`, `arret`, `formation`,
 * `recuperation`, `autre` —, et **`arret` est un arrêt de travail : une donnée
 * de santé sur un salarié nommé, en clair.** Le dénominateur du taux
 * d'occupation, seul lecteur réel de cette table, n'a besoin d'aucune nature :
 * il lui suffit de savoir que la personne n'était pas là.
 *
 * *L'argument qui tranche n'est pas la prudence, c'est l'ASYMÉTRIE* : on peut
 * toujours ajouter une colonne plus tard, on ne peut jamais dé-enregistrer ce
 * qui a été écrit. La colonne et le type restent en base, **dormants**, et le
 * déclencheur `absence_sans_nature` refuse toute écriture qui en porterait une.
 * Ce schéma-ci ne les accepte plus : *un champ qu'aucune saisie n'expose est un
 * champ qu'aucun écran ne peut remplir par mégarde.*
 */

const uuid = z.string().uuid();

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
  })
  // Une période dont la fin précède le début n'est pas une période. Les bornes
  // sont COMPRISES : une absence d'un seul jour a `du === au`.
  .refine((v) => v.au.getTime() >= v.du.getTime(), {
    message: "La fin d'une absence ne précède pas son début.",
    path: ["au"],
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
