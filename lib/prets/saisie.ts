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

/** Un texte facultatif, `null` une fois les espaces de bordure retirés s'il était vide. */
const texteFacultatif = z.string().trim().min(1).nullable().default(null);

/**
 * La sortie d'un prêt. `date_retour_prevue` n'est PAS comparée à
 * `date_sortie` ici — Zod valide un champ isolément, la comparaison entre
 * deux dates du même objet est une règle de COHÉRENCE que
 * `pret_equipement_retour_prevue_pas_avant_sortie` tient en base, et que le
 * dépôt revérifie avant d'écrire (refus nommé plutôt qu'un `500` PostgreSQL).
 *
 * ## LA REMISE AU CLIENT (9L62-PRET-3-BON-SIGNE, décision d'Alexis du
 * 27/11/2026, point 3) — POSÉE DANS LA MÊME SAISIE, jamais un second geste
 *
 * « À la remise » est LA SORTIE elle-même : le bureau ne prête jamais un
 * appareil sans le remettre dans le même geste. Deux issues, et deux
 * seulement — jamais une troisième (même discipline que `IssueSignature`,
 * D173, appliquée ici SANS reprendre sa colonne `issue` : aucune n'a été
 * réservée par 9L60 pour ce prêt, voir `docs/arbitrages.md`) :
 *   - SIGNÉE — `signature_donnees` (le tracé du canevas, `data:image/png;
 *     base64,...`) ET `signataire_nom` sont les DEUX exigés ensemble ;
 *     `signataire_qualite` reste facultatif (même choix que
 *     `InterventionSignature.signataire_qualite`, un signataire n'a pas
 *     toujours de qualité à décliner) ;
 *   - SANS SIGNATURE — `motif_absence_signature` SEUL est exigé (client
 *     absent, refus — texte libre, comme `InterventionSignature.motif`),
 *     et aucun champ signataire n'est alors écrit.
 * Le premier `.refine` ferme l'alternative : l'une des deux branches, jamais
 * aucune, jamais les deux à la fois. Le second ferme la paire signature/nom.
 */
export const schemaSortiePret = z
  .object({
    appareil_id: z.uuid(),
    intervention_id: z.uuid(),
    date_sortie: z.date(),
    date_retour_prevue: z.date(),
    etat_depart: texteNonVide,
    observations: z.string().trim().min(1).nullable().default(null),
    signataire_nom: texteFacultatif,
    signataire_qualite: texteFacultatif,
    signature_donnees: z
      .string()
      .trim()
      .regex(/^data:image\/png;base64,/)
      .nullable()
      .default(null),
    motif_absence_signature: texteFacultatif,
  })
  .refine(
    (saisie) =>
      (saisie.signature_donnees !== null) !==
      (saisie.motif_absence_signature !== null),
    { message: "signature_ou_motif" },
  )
  .refine(
    (saisie) =>
      saisie.signature_donnees === null || saisie.signataire_nom !== null,
    { message: "signataire_nom_requis" },
  );

export type SaisieSortiePret = z.infer<typeof schemaSortiePret>;

export const schemaRetourPret = z.object({
  date_retour_reelle: z.date(),
  etat_retour: texteNonVide,
  /** `null` = l'appareil revient disponible. Toute autre valeur l'envoie en révision. */
  en_revision: z.boolean().default(false),
  observations: z.string().trim().min(1).nullable().default(null),
});

export type SaisieRetourPret = z.infer<typeof schemaRetourPret>;
