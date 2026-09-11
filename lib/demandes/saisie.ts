import { z } from "zod";

/**
 * LA SAISIE D'UNE DEMANDE D'INTERVENTION (lot 2, L2-06).
 *
 * Zod sur toute entrée serveur, sans exception (CLAUDE.md §2). Ce module ne
 * touche pas la base : il dit ce qu'une entrée doit être pour mériter d'y
 * arriver.
 *
 * ## Ce que l'utilisateur ne saisit JAMAIS
 *
 * **L'agence** — elle est déduite du site, qui porte son rattachement (D56), et
 * c'est elle qui décide du calendrier de l'accusé de réception (D13). La faire
 * saisir serait deux lectures d'un même critère, et deux lectures divergent en
 * silence (§9, 01/09).
 *
 * **Le départ du compteur d'accusé** — il se calcule sur le calendrier de cette
 * agence, à l'instant du dépôt (`accuse.ts`). Le laisser saisir permettrait de
 * se donner un délai.
 *
 * **Le numéro** — attribué par le serveur, séquentiellement par société (I10).
 * Personne ne l'attribue aujourd'hui, et l'inventer ici poserait une règle que
 * personne n'a décidée.
 *
 * **Le statut** — une demande naît `nouvelle`. Le laisser saisir permettrait de
 * créer une demande déjà close, donc une mesure de service rendu à distance que
 * personne n'a rendu.
 */

/** Les six sources du chapitre 7/M3. */
export const SOURCES_DEMANDE = [
  "appel",
  "portail",
  "email",
  "echeance_contrat",
  "seuil_compteur",
  "detection_technicien",
] as const;
export type SourceDemande = (typeof SOURCES_DEMANDE)[number];

/** Les quatre statuts du ticket L2-06. */
export const STATUTS_DEMANDE = [
  "nouvelle",
  "qualifiee",
  "transformee",
  "close_sans_suite",
] as const;
export type StatutDemande = (typeof STATUTS_DEMANDE)[number];

/**
 * Les quatre motifs de clôture sans suite.
 *
 * *Cette information est conservée : elle mesure le service rendu à distance*
 * (chapitre 7/M3). Les trois premiers y sont nommés ; `doublon` vient du ticket.
 */
export const MOTIFS_CLOTURE = [
  "resolue_telephone",
  "hors_perimetre",
  "refus_client",
  "doublon",
] as const;
export type MotifCloture = (typeof MOTIFS_CLOTURE)[number];

/** Les quatre niveaux d'urgence — les mêmes que ceux de l'intervention. */
export const URGENCES = ["p1", "p2", "p3", "p4"] as const;
export type Urgence = (typeof URGENCES)[number];

const uuid = z.string().uuid();

/**
 * LE DÉPÔT D'UNE DEMANDE.
 *
 * `machine_id` est facultatif — le chapitre 7 écrit « machine concernée **ou
 * déclarée inconnue** ». `site_id` ne l'est pas : c'est la colonne de périmètre
 * de la politique, et une demande sans site serait invisible à celui qui l'a
 * déposée.
 *
 * `contact_id` est facultatif : une demande née d'une échéance contractuelle ou
 * d'un seuil de compteur n'a personne au bout du fil.
 */
export const schemaDepot = z
  .object({
    id: uuid,
    source: z.enum(SOURCES_DEMANDE),
    client_id: uuid,
    site_id: uuid,
    machine_id: uuid.nullable().default(null),
    contact_id: uuid.nullable().default(null),
    description: z.string().trim().min(1).max(4000),
    urgence: z.enum(URGENCES).default("p3"),
    machine_arretee: z.boolean().default(false),
    date_souhaitee: z.date().nullable().default(null),
  })
  .strict();

export type Depot = z.infer<typeof schemaDepot>;

/**
 * LA CLÔTURE SANS SUITE. Le motif est exigé par le type avant de l'être par la
 * base : *une clôture sans motif effacerait la mesure du service rendu à
 * distance.*
 */
export const schemaCloture = z
  .object({
    id: uuid,
    motif: z.enum(MOTIFS_CLOTURE),
  })
  .strict();

export type Cloture = z.infer<typeof schemaCloture>;
