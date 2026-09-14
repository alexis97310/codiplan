import { z } from "zod";

/**
 * LA SAISIE D'UN BLOCAGE D'AGENDA (L3-04, R3-14) — Zod sur toute entrée
 * serveur, sans exception (§2).
 *
 * ## CE QUI SE SAISIT : une personne, un début, une fin. RIEN D'AUTRE.
 *
 * **CODIPLAN n'est pas un outil de gestion des ressources humaines.** Ni
 * nature, ni motif, ni champ libre, ni statut : ce ne sont pas des champs
 * oubliés, ce sont des champs RETIRÉS, et le schéma est le premier endroit où
 * ce retrait se lit.
 *
 * *`arret` était un arrêt de travail — une donnée de santé, sur un salarié
 * nommé, en clair. Un champ libre à sa place aurait écrit la même chose en
 * moins mesurable.* Le seul lecteur réel de cette table — le dénominateur du
 * taux d'occupation — n'a besoin que de savoir que la personne n'était pas là.
 *
 * ## La SOCIÉTÉ ne se saisit pas non plus
 *
 * Elle vient du contexte cloisonné, jamais d'un formulaire — c'est la forme de
 * toutes les saisies du dépôt.
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
  // sont COMPRISES : un blocage d'un seul jour a `du === au`.
  .refine((v) => v.au.getTime() >= v.du.getTime(), {
    message: "La fin d'un blocage ne précède pas son début.",
    path: ["au"],
  });

export type CreationAbsence = z.output<typeof schemaCreationAbsence>;

/**
 * LA LEVÉE D'UN BLOCAGE — il se supprime, il ne se « refuse » pas.
 *
 * *Un statut `refusee` aurait gardé la ligne en disant qu'elle ne compte pas* :
 * deux façons pour une période de ne pas bloquer, dont une invisible au
 * lecteur qui ne regarde que les dates. Le blocage est immédiat ; sa levée
 * l'est aussi, et elle ne laisse derrière elle que le journal d'audit (I8), qui
 * est le bon endroit pour l'histoire d'une ligne.
 */
export const schemaLeveeBlocage = z.object({
  absence_id: uuid,
});

export type LeveeBlocage = z.output<typeof schemaLeveeBlocage>;
