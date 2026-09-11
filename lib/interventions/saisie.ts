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
 *
 * ## Les machines sont un TABLEAU depuis L2-08a
 *
 * `machine_id` a disparu, de la saisie comme du schéma : une visite couvre
 * plusieurs matériels (chapitre 7/M3), et garder une colonne « pour la
 * principale » aurait fait deux écritures d'un même fait (§9, 01/09).
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
    /**
     * LES MACHINES, au pluriel depuis L2-08a — une visite peut en couvrir
     * plusieurs (chapitre 7/M3).
     *
     * **Le tableau VIDE est le cas ordinaire à la création**, et non un oubli :
     * le dépannage à l'aveugle sait qu'un compresseur est en panne, pas lequel.
     * RG-INT-01 n'exige la machine qu'**avant de démarrer**, et c'est la base
     * qui le tient — pas cette saisie, qui refuserait alors d'enregistrer un
     * appel.
     *
     * Les doublons sont retirés ICI plutôt que laissés buter sur l'index
     * unique : *une même machine nommée deux fois dans un formulaire est une
     * maladresse de saisie, pas une faute à refuser.*
     */
    machine_ids: z
      .array(uuid)
      .default([])
      .transform((ids) => [...new Set(ids)]),
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

/**
 * LE DÉPLACEMENT — changer de jour, d'heure, de technicien, ou tout cela.
 *
 * ## L'HEURE SE DONNE EN MINUTES LOCALES, JAMAIS EN INSTANT (R2-19)
 *
 * Un créneau est stocké en INSTANT — 07:30 à Nouméa et 07:30 à Lyon ne sont pas
 * le même moment, et c'est tout l'objet de la colonne. Mais **l'instant se
 * calcule, il ne se saisit pas** : il demande le fuseau de l'agence de
 * l'intervention, que ni un formulaire ni un navigateur ne connaissent.
 *
 * *Laisser l'appelant fournir l'instant donnerait DEUX représentations d'une
 * même chose* — l'une pour le glissé, l'autre pour le formulaire — et deux
 * lectures d'un même critère divergent en silence (§9, 01/09). Le dépôt
 * résout donc l'instant, une fois, sous le fuseau qui décide.
 *
 * La DURÉE est fournie plutôt que la fin : c'est ce que la règle de la vue jour
 * demande — *le dépôt change l'heure de début, la durée est conservée* — et
 * fournir une fin permettrait de redimensionner par un chemin qui n'est pas
 * fait pour cela.
 */
export const schemaDeplacement = z
  .object({
    intervention_id: uuid,
    date_planifiee: z.date().nullable(),
    /** Minutes locales depuis minuit, dans le fuseau de l'agence. */
    debut_minutes: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 - 1)
      .nullable(),
    /** Durée en minutes, strictement positive quand une heure est donnée. */
    duree_min: z.number().int().positive().nullable(),
    technicien_id: uuid.nullable(),
  })
  .refine((v) => (v.debut_minutes === null) === (v.duree_min === null), {
    message: "Un créneau se donne en entier : une heure et une durée, ou rien.",
    path: ["duree_min"],
  })
  // UN CRÉNEAU SANS JOUR EST UN ÉTAT QUE LE PLANNING NE SAIT PAS RANGER. La
  // grille range par `date_planifiee` ; un créneau posé sans elle laisserait
  // l'intervention invisible sur les deux vues tout en occupant le temps d'un
  // technicien.
  .refine((v) => v.debut_minutes === null || v.date_planifiee !== null, {
    message: "Un créneau se pose sur un jour : la date planifiée est requise.",
    path: ["date_planifiee"],
  });

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

/**
 * LA SUSPENSION (L2-10, RG-INT-06).
 *
 * Le **motif** est obligatoire — *une intervention arrêtée sans qu'on sache
 * pourquoi est une intervention perdue*, et celui qui la retrouvera dans trois
 * semaines n'aura personne à qui demander.
 *
 * **La référence de pièce et sa date vont ENSEMBLE, ou pas du tout.** RG-INT-06
 * exige les deux : *« pour une attente de pièce, la référence attendue **et** la
 * date de disponibilité prévisionnelle »*. Une référence sans date ferait une
 * file d'attente **sans horizon**, c'est-à-dire une file que l'alerte du
 * chapitre 16.1 ne saurait pas trier.
 *
 * **Ce qui n'est PAS saisi : l'instant de la suspension.** Il est daté par le
 * serveur, dans le fuseau de l'agence (L0-08) — le laisser saisir permettrait
 * de rajeunir une attente, et l'ancienneté est précisément ce que la file
 * mesure.
 */
export const schemaSuspension = z
  .object({
    intervention_id: uuid,
    motif: z
      .string()
      .trim()
      .min(3, "Le motif de la suspension est obligatoire.")
      .max(500),
    piece_attendue_ref: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .nullable()
      .default(null),
    date_dispo_prevue: z.date().nullable().default(null),
  })
  .strict()
  .refine(
    (v) => (v.piece_attendue_ref === null) === (v.date_dispo_prevue === null),
    {
      message:
        "Une attente de pièce se saisit en entier : la référence et la date de disponibilité prévue, ou aucune des deux.",
      path: ["date_dispo_prevue"],
    },
  );

export type Suspension = z.infer<typeof schemaSuspension>;

/** La reprise ne porte que l'identifiant : le statut se déduit du créneau. */
export const schemaReprise = z.object({ intervention_id: uuid }).strict();

export type Reprise = z.infer<typeof schemaReprise>;
