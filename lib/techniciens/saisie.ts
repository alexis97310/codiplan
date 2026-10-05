import { z } from "zod";

/**
 * SAISIE D'UN TECHNICIEN (ÉQUIPE-1).
 *
 * Deux formulaires, deux schémas : la CRÉATION porte l'identité (nom,
 * courriel) et le rattachement (agence, actif, statut de ressource) ; la
 * MODIFICATION ne porte plus que ce qui peut changer une fois la personne
 * créée — l'identité ne se corrige pas ici (hors périmètre, voir
 * `lib/techniciens/depot.ts`).
 */

const texteNonVide = z.string().trim().min(1);

/**
 * SALARIÉ OU PATENTÉ (QG-9, 27/09/2026 ; précisions du pilote du 03/10/2026,
 * à valider par Alexis — D163, `docs/arbitrages.md`) — les deux seules
 * valeurs posables ; « non renseigné » est l'ABSENCE de l'une des deux, jamais
 * une troisième valeur de l'énumération (voir `StatutRessource`, schéma).
 */
export const STATUTS_RESSOURCE = ["salarie", "patente"] as const;

export const schemaTechnicien = z.object({
  nom: texteNonVide,
  email: z.email(),
  /**
   * L'agence est NOMMÉE par son identifiant, et la base vérifie qu'elle
   * appartient à la même société : la clé étrangère est composite
   * `(societe_id, agence_id)`. Sans la société dans la clé, le verrou serait
   * muet là où le cloisonnement doit mordre — la leçon de `modele_materiel`.
   */
  agence_id: z.uuid(),
  actif: z.boolean().default(true),
  /**
   * OBLIGATOIRE À LA CRÉATION, AUCUNE VALEUR CHOISIE D'AVANCE (QG-9, D163) :
   * contrairement à la modification, « non renseigné » n'est pas une option
   * de ce formulaire — le menu force un choix réel, et ce schéma n'offre
   * aucun défaut qui le contournerait.
   */
  statut_ressource: z.enum(STATUTS_RESSOURCE),
});

export type SaisieTechnicien = z.infer<typeof schemaTechnicien>;

/**
 * Les valeurs POSABLES à la modification — les deux de la création, plus le
 * MAINTIEN explicite de « non renseigné » (QG-9, D163). Une chaîne distincte,
 * jamais une valeur vide : un champ absent du corps reste un refus (voir
 * `saisieModificationRecue`), et la différence entre « le champ manque » et
 * « la personne choisit de ne pas répondre » ne se dirait pas sinon.
 */
const STATUTS_RESSOURCE_MODIFIABLES = [
  ...STATUTS_RESSOURCE,
  "non_renseigne",
] as const;

export const schemaModificationTechnicien = z.object({
  agence_id: z.uuid(),
  actif: z.boolean(),
  /**
   * « non renseigné ne peut pas être RE-choisi une fois un statut posé »
   * (QG-9, D163) n'est PAS une règle de forme — elle dépend de la fiche
   * actuelle, que ce schéma ne connaît pas. Elle est tenue par
   * `modifierTechnicien` (`lib/techniciens/depot.ts`), motif
   * `statut_deja_pose`. Ici, seule la forme : une des deux valeurs, ou le
   * maintien explicite de l'absence.
   */
  statut_ressource: z
    .enum(STATUTS_RESSOURCE_MODIFIABLES)
    .transform((valeur) => (valeur === "non_renseigne" ? null : valeur)),
});

export type SaisieModificationTechnicien = z.infer<
  typeof schemaModificationTechnicien
>;
