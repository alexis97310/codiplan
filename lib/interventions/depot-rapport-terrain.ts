import { type PrismaClient } from "@prisma/client";
import { z } from "zod";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

/**
 * LE RAPPORT DE TERRAIN (ticket 17-BON-2) — ce que BON-1 avait nommé sans le
 * construire : prestations réalisées, commentaire, suite à donner, signature.
 * Les photos vivent dans `lib/documents/depot.ts` (`deposerPhotoIntervention`,
 * `photosDeLIntervention`) : ce sont des `Document` comme les autres.
 *
 * ## SAISI SUR LE TERRAIN, JAMAIS AU BACK-OFFICE (I4, I5)
 *
 * Toutes les fonctions de ce module supposent un appelant `app/(mobile)/terrain`.
 * Rien ici ne le VÉRIFIE — ce n'est pas son rôle, exactement comme
 * `depot-compteur.ts` ne vérifie pas d'où vient l'appel : la porte se tient à
 * l'entrée de la route (`lib/auth/porte.ts`), jamais dans le dépôt.
 *
 * ## AUCUN STATUT NE BLOQUE L'AJOUT — sauf ce que `intervention` bloque déjà
 *
 * `commentaire_technicien` et `suite_a_donner` sont des COLONNES de
 * `intervention` : une intervention clôturée ne se modifie plus (le
 * déclencheur `intervention_cycle_de_vie` le refuse déjà, sans qu'il y ait
 * rien à répéter ici). Les prestations réalisées, les photos et la signature
 * vivent dans des tables FILLES et n'héritent PAS de cette borne — I5 garantit
 * que le travail terrain n'est jamais perdu, même sur une intervention
 * clôturée ou annulée entre-temps.
 *
 * ## LES PRESTATIONS SE DÉFINISSENT COMME UN ENSEMBLE, jamais ligne à ligne
 *
 * `definirPrestationsRealisees` reçoit la liste ENTIÈRE des prestations
 * cochées et la fait correspondre à l'existant (ajouts, retraits) dans UNE
 * transaction. Une API « ajouter une ligne » puis « en retirer une » aurait
 * exposé un état intermédiaire incohérent entre deux requêtes réseau — exactly
 * le risque qu'I4 (réseau absent, requêtes reprises) rend concret.
 */

// ═══════════════════════════════════════════════════════════════════════════
// LE COMMENTAIRE ET LA SUITE À DONNER
// ═══════════════════════════════════════════════════════════════════════════

/** `null` efface le champ — jamais une chaîne vide, qui se confondrait avec un texte réellement vide. */
export const schemaRapportTexte = z.object({
  commentaire_technicien: z.string().trim().min(1).nullable(),
  suite_a_donner: z.string().trim().min(1).nullable(),
});
export type SaisieRapportTexte = z.infer<typeof schemaRapportTexte>;

export type RapportTexte = {
  readonly commentaire_technicien: string | null;
  readonly suite_a_donner: string | null;
};

/** LIT le commentaire et la suite à donner. `null` si l'intervention n'est pas visible. */
export async function lireRapportTexte(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<RapportTexte | null> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.intervention.findFirst({
        where: { id: interventionId },
        select: { commentaire_technicien: true, suite_a_donner: true },
      }),
    client,
  );
}

/**
 * ENREGISTRE le commentaire et la suite à donner. `null` si l'intervention
 * n'est pas visible (D35, D50) — même traitement que `lireFicheIntervention`.
 */
export async function enregistrerRapportTexte(
  contexte: ContexteSession,
  interventionId: string,
  saisie: SaisieRapportTexte,
  client?: PrismaClient,
): Promise<{ readonly id: string } | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const intervention = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: { id: true },
      });
      if (intervention === null) {
        return null;
      }
      const ecrite = await tx.intervention.update({
        where: { id: interventionId },
        data: {
          commentaire_technicien: saisie.commentaire_technicien,
          suite_a_donner: saisie.suite_a_donner,
        },
        select: { id: true },
      });
      return ecrite;
    },
    client,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LES PRESTATIONS RÉALISÉES
// ═══════════════════════════════════════════════════════════════════════════

export const schemaPrestationsRealisees = z.object({
  prestation_ids: z.array(z.uuid()),
});
export type SaisiePrestationsRealisees = z.infer<
  typeof schemaPrestationsRealisees
>;

/** Une prestation réalisée, avec le libellé de son catalogue. */
export type PrestationRealisee = {
  readonly id: string;
  readonly prestation_id: string;
  readonly code: string;
  readonly libelle: string;
};

/**
 * DÉFINIT l'ensemble des prestations réalisées — voir l'en-tête du module.
 * `null` si l'intervention n'est pas visible.
 */
export async function definirPrestationsRealisees(
  contexte: ContexteSession,
  interventionId: string,
  prestationIds: readonly string[],
  client?: PrismaClient,
): Promise<{ readonly id: string } | null> {
  const societeId = exigerSocieteActive(contexte);
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const intervention = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: { id: true },
      });
      if (intervention === null) {
        return null;
      }
      const voulues = [...new Set(prestationIds)];
      await tx.interventionPrestation.deleteMany({
        where: {
          intervention_id: interventionId,
          prestation_id: { notIn: voulues },
        },
      });
      const existantes = await tx.interventionPrestation.findMany({
        where: { intervention_id: interventionId },
        select: { prestation_id: true },
      });
      const dejaLa = new Set(existantes.map((e) => e.prestation_id));
      const aCreer = voulues.filter((id) => !dejaLa.has(id));
      if (aCreer.length > 0) {
        await tx.interventionPrestation.createMany({
          data: aCreer.map((prestationId) => ({
            id: uuidv7(),
            societe_id: societeId,
            intervention_id: interventionId,
            prestation_id: prestationId,
          })),
        });
      }
      return { id: interventionId };
    },
    client,
  );
}

/** LES PRESTATIONS RÉALISÉES d'une intervention, dans l'ordre de saisie. */
export async function prestationsRealisees(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<readonly PrestationRealisee[] | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const intervention = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: { id: true },
      });
      if (intervention === null) {
        return null;
      }
      const lignes = await tx.interventionPrestation.findMany({
        where: { intervention_id: interventionId },
        select: {
          id: true,
          prestation_id: true,
          prestation: { select: { code: true, libelle: true } },
        },
        orderBy: [{ cree_le: "asc" }, { id: "asc" }],
      });
      return lignes.map((ligne) => ({
        id: ligne.id,
        prestation_id: ligne.prestation_id,
        code: ligne.prestation.code,
        libelle: ligne.prestation.libelle,
      }));
    },
    client,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LA SIGNATURE — HISTORISÉE, JAMAIS RÉÉCRITE (voir le modèle Prisma)
// ═══════════════════════════════════════════════════════════════════════════

/** Un tracé de canevas PNG, encodé en data URI — jamais un fichier. */
export const schemaSignature = z.object({
  image_base64: z
    .string()
    .regex(
      /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/,
      "signature attendue en PNG encodé (data:image/png;base64,...)",
    ),
});
export type SaisieSignature = z.infer<typeof schemaSignature>;

export type Signature = {
  readonly id: string;
  readonly image_base64: string;
  readonly cree_le: Date;
};

/**
 * AJOUTE une signature — jamais ne remplace. Voir l'en-tête du modèle
 * `InterventionSignature` : ce module n'expose NI modification NI suppression,
 * et c'est délibéré. `null` si l'intervention n'est pas visible.
 */
export async function enregistrerSignature(
  contexte: ContexteSession,
  interventionId: string,
  saisie: SaisieSignature,
  client?: PrismaClient,
): Promise<{ readonly id: string } | null> {
  const societeId = exigerSocieteActive(contexte);
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const intervention = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: { id: true },
      });
      if (intervention === null) {
        return null;
      }
      return tx.interventionSignature.create({
        data: {
          id: uuidv7(),
          societe_id: societeId,
          intervention_id: interventionId,
          image_base64: saisie.image_base64,
        },
        select: { id: true },
      });
    },
    client,
  );
}

/**
 * LA SIGNATURE EN VIGUEUR — la plus RÉCENTE, jamais un historique complet :
 * *si le client re-signe, c'est la nouvelle qui compte sur le bon*, l'ancienne
 * restant en base comme preuve datée mais cessant d'être celle qu'on montre.
 */
export async function derniereSignature(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<Signature | null> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.interventionSignature.findFirst({
        where: { intervention_id: interventionId },
        select: { id: true, image_base64: true, cree_le: true },
        orderBy: [{ cree_le: "desc" }, { id: "desc" }],
      }),
    client,
  );
}
