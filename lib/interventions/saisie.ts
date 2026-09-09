import { z } from "zod";

/**
 * LA SAISIE D'UN ORDRE D'INTERVENTION (lot 2, D84).
 *
 * Zod sur toute entrée serveur, sans exception (CLAUDE.md §2). Ce module ne
 * touche pas la base : il dit ce qu'une entrée doit être pour mériter d'y
 * arriver.
 *
 * ## Ce que l'utilisateur ne saisit JAMAIS
 *
 * **L'agence** — elle est déduite du site, qui porte son rattachement (D56).
 * La faire saisir serait deux lectures d'un même critère, et deux lectures
 * divergent en silence (§9, 01/09).
 *
 * **Le forfait de déplacement** — il est déduit de la ZONE du site par la
 * règle déjà écrite et déjà éprouvée (`lib/tarification/forfaits.ts`,
 * RG-TAR-06, D23). *La consigne d'exploitation disait « l'agence impose le
 * forfait » ; le code dit que les conditions d'un forfait portent sur la zone,
 * la famille et le type — jamais sur l'agence. La voie qui reste ouverte est
 * celle de la règle écrite, et l'écart est inscrit au registre du jour.*
 *
 * **Le numéro** — il est attribué par le serveur, séquentiellement par société,
 * à la première synchronisation (I10). Personne ne l'attribue aujourd'hui, et
 * l'inventer ici poserait une règle que personne n'a décidée.
 *
 * **Le statut** — une intervention naît `a_planifier`, ou `planifiee` si un
 * créneau est donné. Le laisser saisir permettrait de créer une intervention
 * déjà clôturée.
 */

/** Les neuf natures du chapitre 11.2. */
export const TYPES_INTERVENTION = [
  "preventif_contrat",
  "preventif_hors_contrat",
  "curatif",
  "installation",
  "garantie",
  "controle_reglementaire",
  "expertise",
  "reprise",
  "recensement",
] as const;
export type TypeIntervention = (typeof TYPES_INTERVENTION)[number];

/** Les quatre niveaux d'urgence. */
export const PRIORITES = ["p1", "p2", "p3", "p4"] as const;
export type Priorite = (typeof PRIORITES)[number];

/** Le cycle de vie, dans l'ordre de l'annexe D. */
export const STATUTS_INTERVENTION = [
  "a_planifier",
  "planifiee",
  "envoyee",
  "en_cours",
  "suspendue",
  "terminee",
  "cloturee",
  "annulee",
] as const;
export type StatutIntervention = (typeof STATUTS_INTERVENTION)[number];

/** Les trois modes de RG-TAR-05. */
export const MODES_VALORISATION = [
  "forfait",
  "temps_passe",
  "forfait_plus_heures",
] as const;
export type ModeValorisation = (typeof MODES_VALORISATION)[number];

const uuid = z.string().uuid();

/**
 * LA CRÉATION. Le créneau est facultatif : une intervention peut naître dans la
 * file d'attente, sans date — c'est le statut `a_planifier` de l'annexe D, et
 * c'est le cas d'une demande qu'on enregistre avant de savoir quand la traiter.
 */
export const schemaCreation = z
  .object({
    id: uuid,
    client_id: uuid,
    site_id: uuid,
    machine_id: uuid.nullable().default(null),
    type: z.enum(TYPES_INTERVENTION),
    priorite: z.enum(PRIORITES).default("p3"),
    mode_valorisation: z.enum(MODES_VALORISATION).default("temps_passe"),
    date_planifiee: z.date().nullable().default(null),
    creneau_debut: z.date().nullable().default(null),
    creneau_fin: z.date().nullable().default(null),
    duree_estimee_min: z.number().int().positive().nullable().default(null),
    technicien_id: uuid.nullable().default(null),
  })
  .refine(
    (v) =>
      v.creneau_debut === null ||
      v.creneau_fin === null ||
      v.creneau_fin > v.creneau_debut,
    {
      message: "La fin du créneau doit suivre son début.",
      path: ["creneau_fin"],
    },
  )
  .refine((v) => (v.creneau_debut === null) === (v.creneau_fin === null), {
    message: "Un créneau se donne en entier : un début et une fin, ou aucun.",
    path: ["creneau_fin"],
  });

export type Creation = z.infer<typeof schemaCreation>;

/** LE DÉPLACEMENT — changer de créneau, changer de technicien, ou les deux. */
export const schemaDeplacement = z
  .object({
    intervention_id: uuid,
    date_planifiee: z.date().nullable(),
    creneau_debut: z.date().nullable(),
    creneau_fin: z.date().nullable(),
    technicien_id: uuid.nullable(),
  })
  .refine(
    (v) =>
      v.creneau_debut === null ||
      v.creneau_fin === null ||
      v.creneau_fin > v.creneau_debut,
    {
      message: "La fin du créneau doit suivre son début.",
      path: ["creneau_fin"],
    },
  );

export type Deplacement = z.infer<typeof schemaDeplacement>;

/**
 * LA CLÔTURE. Le temps réel est OBLIGATOIRE et STRICTEMENT POSITIF.
 *
 * Zéro est refusé, et ce n'est pas une coquetterie : sous D83, zéro minute
 * facturerait quand même le plancher d'une heure. Une intervention qui n'a pas
 * eu lieu s'annule, elle ne se clôture pas à zéro.
 */
export const schemaCloture = z.object({
  intervention_id: uuid,
  temps_reel_min: z
    .number()
    .int("Le temps se saisit en minutes entières.")
    .positive("Une intervention clôturée a duré. Sinon, elle s'annule."),
});

export type Cloture = z.infer<typeof schemaCloture>;

/**
 * L'ANNULATION. Le motif est OBLIGATOIRE et non vide.
 *
 * *Une annulation n'efface rien* : la ligne reste, son statut change, et le
 * motif est ce qui rend la trace lisible six mois plus tard. Un motif
 * facultatif serait un motif jamais renseigné.
 */
export const schemaAnnulation = z.object({
  intervention_id: uuid,
  motif: z
    .string()
    .trim()
    .min(3, "Le motif d'annulation est obligatoire.")
    .max(500),
});

export type Annulation = z.infer<typeof schemaAnnulation>;
