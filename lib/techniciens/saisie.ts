import { z } from "zod";

/**
 * SAISIE D'UN TECHNICIEN (ÉQUIPE-1).
 *
 * Deux formulaires, deux schémas : la CRÉATION porte l'identité (nom,
 * courriel) et le rattachement (agence, actif) ; la MODIFICATION ne porte
 * plus que ce qui peut changer une fois la personne créée — l'identité ne se
 * corrige pas ici (hors périmètre, voir `lib/techniciens/depot.ts`).
 */

const texteNonVide = z.string().trim().min(1);

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
});

export type SaisieTechnicien = z.infer<typeof schemaTechnicien>;

export const schemaModificationTechnicien = z.object({
  agence_id: z.uuid(),
  actif: z.boolean(),
});

export type SaisieModificationTechnicien = z.infer<
  typeof schemaModificationTechnicien
>;
