import { type PrismaClient } from "@prisma/client";
import { z } from "zod";

import {
  exigerContexteActif,
  exigerSocieteActive,
  type ContexteSession,
} from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { mesurer } from "@/lib/interventions/compteur";
import { estFige, peutTerminer } from "@/lib/interventions/cycle-de-vie";
import { accesSurCetteIntervention } from "@/lib/interventions/perimetre-technicien";
import type {
  IssueSignature,
  StatutIntervention,
} from "@/lib/interventions/saisie";

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
 * ## LE RENFORT POINTE, IL N'ÉCRIT PAS LE RAPPORT D'AUTRUI (décision du
 * 03/10/2026, point 1 ; D151, reprise 9DCA)
 *
 * `enregistrerRapportTexte`, `definirPrestationsRealisees`,
 * `enregistrerSignature` et `terminerIntervention` (9DE-TP-CY1) lisent
 * `technicien_id` de l'intervention visée et refusent si
 * `!accesSurCetteIntervention(contexte, "saisir_rapport", technicien_id)` —
 * même périmètre scopé que `cloturerIntervention` (D131),
 * généralisé par `accesSurCetteIntervention` plutôt que rejugé ici. Le
 * compteur (`depot-compteur.ts`) n'est PAS concerné : un technicien non
 * affecté continue de pouvoir démarrer et arrêter SON compteur sur
 * n'importe quelle intervention de la société — c'est le renfort que la
 * décision garde.
 *
 * Même clé de refus que « intervention introuvable » — hors périmètre et
 * inexistante rendent la même chose (D35, D50) : distinguer les deux dirait à
 * un technicien restreint qu'une intervention d'un collègue existe.
 *
 * ## AUCUN STATUT NE BLOQUE L'AJOUT — sauf ce que `intervention` bloque déjà
 *
 * `commentaire_technicien` et `suite_a_donner` sont des COLONNES de
 * `intervention` : une intervention FIGÉE (annulée ou clôturée, `estFige`) ne
 * se modifie plus — le déclencheur `intervention_cycle_de_vie` le refuse déjà
 * en base. `enregistrerRapportTexte` le REJUGE avant d'écrire (9DE-TP-CY1) :
 * sans ce refus NOMMÉ, la base lève une exception non rattrapée (23514, une
 * figée jamais vue par le terrain, mesuré par la passation de
 * 9DD-PG-G14C-TERRAIN-TRANSMISES) et la route rend une page d'erreur brute au
 * lieu d'un motif lisible. Les prestations réalisées, les photos et la
 * signature vivent dans des tables FILLES et n'héritent PAS de cette borne —
 * I5 garantit que le travail terrain n'est jamais perdu, même sur une
 * intervention clôturée ou annulée entre-temps.
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
 * Ce que `enregistrerRapportTexte` rend : la ligne écrite, un refus NOMMÉ
 * (intervention figée), ou `null` si l'intervention n'est pas visible (D35,
 * D50) — même traitement que `lireFicheIntervention`.
 */
export type EcritureRapportTexte =
  { readonly id: string } | { readonly refuse: true; readonly cle: string };

/** ENREGISTRE le commentaire et la suite à donner. */
export async function enregistrerRapportTexte(
  contexte: ContexteSession,
  interventionId: string,
  saisie: SaisieRapportTexte,
  client?: PrismaClient,
): Promise<EcritureRapportTexte | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const intervention = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: { id: true, technicien_id: true, statut: true },
      });
      if (
        intervention === null ||
        !accesSurCetteIntervention(
          exigerContexteActif(contexte),
          "saisir_rapport",
          intervention.technicien_id,
        )
      ) {
        return null;
      }
      if (estFige(intervention.statut as StatutIntervention)) {
        return {
          refuse: true,
          cle:
            intervention.statut === "annulee"
              ? "intervention.refus.annulee_figee"
              : "intervention.refus.cloturee_figee",
        };
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
        select: { id: true, technicien_id: true },
      });
      if (
        intervention === null ||
        !accesSurCetteIntervention(
          exigerContexteActif(contexte),
          "saisir_rapport",
          intervention.technicien_id,
        )
      ) {
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

/**
 * TROIS ISSUES, DISCRIMINÉES PAR `issue` (9DE-TP-CY1, décision du 03/10/2026
 * point 11 ; D-S5) :
 *
 *   - `signee` — un tracé de canevas PNG, encodé en data URI (jamais un
 *     fichier), accompagné du NOM et de la QUALITÉ du signataire (76-BON-4,
 *     SAV-10) : un bon signé ne dit pas seulement QU'il a été signé, mais QUI
 *     a signé pour le client. `signataire_nom` est OBLIGATOIRE ; les
 *     signatures antérieures à BON-4 n'en portent pas, et ce n'est pas
 *     rattrapé (voir le modèle `InterventionSignature`).
 *   - `client_absent` / `refus_signature` — un MOTIF obligatoire, et aucune
 *     image : la base tient la même règle (`intervention_signature_issue_
 *     coherente`), ce schéma la rejuge tôt pour nommer le refus à l'écran
 *     plutôt que de laisser la base répondre par une violation de contrainte.
 */
export const schemaSignature = z.discriminatedUnion("issue", [
  z.object({
    issue: z.literal("signee"),
    image_base64: z
      .string()
      .regex(
        /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/,
        "signature attendue en PNG encodé (data:image/png;base64,...)",
      ),
    signataire_nom: z.string().trim().min(1).max(120),
    signataire_qualite: z.string().trim().max(80).nullable().optional(),
  }),
  // `.strict()` (R1, relecture du 04/10/2026 de 9DE/9DEA/9DEB) : ces deux
  // issues n'ont JAMAIS d'image — l'en-tête de ce bloc le dit, et
  // `signature-signataire.test.ts` l'exige. Un schéma non strict retire les
  // clés inconnues plutôt que de refuser : `{issue:"client_absent", motif,
  // image_base64}` passait donc, l'image étant jetée EN SILENCE.
  z
    .object({
      issue: z.literal("client_absent"),
      motif: z.string().trim().min(1).max(500),
    })
    .strict(),
  z
    .object({
      issue: z.literal("refus_signature"),
      motif: z.string().trim().min(1).max(500),
    })
    .strict(),
]);
export type SaisieSignature = z.infer<typeof schemaSignature>;

export type Signature = {
  readonly id: string;
  readonly issue: IssueSignature;
  readonly image_base64: string | null;
  readonly motif: string | null;
  readonly cree_le: Date;
  readonly signataire_nom: string | null;
  readonly signataire_qualite: string | null;
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
        select: { id: true, technicien_id: true },
      });
      if (
        intervention === null ||
        !accesSurCetteIntervention(
          exigerContexteActif(contexte),
          "saisir_rapport",
          intervention.technicien_id,
        )
      ) {
        return null;
      }
      return tx.interventionSignature.create({
        data:
          saisie.issue === "signee"
            ? {
                id: uuidv7(),
                societe_id: societeId,
                intervention_id: interventionId,
                issue: "signee",
                image_base64: saisie.image_base64,
                signataire_nom: saisie.signataire_nom,
                signataire_qualite: saisie.signataire_qualite ?? null,
              }
            : {
                id: uuidv7(),
                societe_id: societeId,
                intervention_id: interventionId,
                issue: saisie.issue,
                motif: saisie.motif,
              },
        select: { id: true },
      });
    },
    client,
  );
}

const CHAMPS_SIGNATURE = {
  id: true,
  issue: true,
  image_base64: true,
  motif: true,
  cree_le: true,
  signataire_nom: true,
  signataire_qualite: true,
} as const;

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
        select: CHAMPS_SIGNATURE,
        orderBy: [{ cree_le: "desc" }, { id: "desc" }],
      }),
    client,
  );
}

/**
 * LA DERNIÈRE ISSUE DE SIGNATURE DE PLUSIEURS INTERVENTIONS À LA FOIS — pour
 * l'onglet « À contrôler » du registre (9DE-TP-CY1), qui ne peut pas
 * raisonnablement relire `derniereSignature` une fois par ligne affichée.
 *
 * `distinct` sur `intervention_id`, combiné à l'`orderBy` ci-dessous, rend LA
 * PLUS RÉCENTE de chaque groupe — même règle que `derniereSignature`, en une
 * seule requête plutôt qu'une par intervention.
 */
export async function dernieresIssuesSignature(
  contexte: ContexteSession,
  interventionIds: readonly string[],
  client?: PrismaClient,
): Promise<
  ReadonlyMap<
    string,
    { readonly issue: IssueSignature; readonly motif: string | null }
  >
> {
  if (interventionIds.length === 0) {
    return new Map();
  }
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const lignes = await tx.interventionSignature.findMany({
        where: { intervention_id: { in: [...interventionIds] } },
        select: { intervention_id: true, issue: true, motif: true },
        distinct: ["intervention_id"],
        orderBy: [
          { intervention_id: "asc" },
          { cree_le: "desc" },
          { id: "desc" },
        ],
      });
      return new Map(
        lignes.map((ligne) => [
          ligne.intervention_id,
          { issue: ligne.issue, motif: ligne.motif },
        ]),
      );
    },
    client,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TERMINER — EN COURS → TERMINÉE (9DE-TP-CY1 ; D8 à la lettre, QT-4(a))
// ═══════════════════════════════════════════════════════════════════════════

/** Ce que `terminerIntervention` rend : la ligne écrite et l'issue qui a servi à la juger, ou un refus NOMMÉ. */
export type ResultatTerminer =
  | {
      readonly accepte: true;
      readonly id: string;
      readonly issueSignature: IssueSignature;
      readonly motifSignature: string | null;
    }
  | { readonly accepte: false; readonly cle: string };

/**
 * TERMINER — ferme le segment ouvert de l'APPELANT sur cette intervention
 * s'il en a un, recalcule le temps mesuré, puis écrit `terminee` — dans la
 * MÊME transaction, comme `arreterLeCompteur` (D120) : un segment fermé sans
 * que la somme suive laisserait un temps mesuré faux.
 *
 * **Le périmètre est celui du rapport** (D151, même règle que 9DC) : seul le
 * technicien AFFECTÉ termine — un renfort pointe, il ne termine pas le travail
 * d'autrui.
 *
 * **Un AUTRE segment ouvert sur cette intervention (un renfort qui pointe
 * encore) REFUSE** (décision du 03/10/2026) : terminer sous le pied de
 * quelqu'un qui travaille encore fausserait son temps mesuré, fermé par un
 * autre que lui.
 */
export async function terminerIntervention(
  contexte: ContexteSession,
  interventionId: string,
  instant: Date,
  client?: PrismaClient,
): Promise<ResultatTerminer> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ligne = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: { id: true, statut: true, technicien_id: true },
      });
      if (ligne === null) {
        return { accepte: false, cle: "intervention.refus.inconnue" };
      }
      if (
        !accesSurCetteIntervention(
          exigerContexteActif(contexte),
          "saisir_rapport",
          ligne.technicien_id,
        )
      ) {
        return { accepte: false, cle: "intervention.refus.inconnue" };
      }

      const ouverts = await tx.segmentTravail.findMany({
        where: { intervention_id: interventionId, fin: null },
        select: { id: true, utilisateur_id: true },
      });
      const dUnAutre = ouverts.find(
        (s) => s.utilisateur_id !== contexte.utilisateurId,
      );
      if (dUnAutre !== undefined) {
        return {
          accepte: false,
          cle: "intervention.refus.compteur_tourne_encore",
        };
      }
      const leSien = ouverts.find(
        (s) => s.utilisateur_id === contexte.utilisateurId,
      );
      if (leSien !== undefined) {
        await tx.segmentTravail.update({
          where: { id: leSien.id },
          data: { fin: instant },
        });
      }

      const tousLesSegments = await tx.segmentTravail.findMany({
        where: { intervention_id: interventionId },
        select: { id: true, debut: true, fin: true },
      });
      const tempsMesure = mesurer(tousLesSegments).minutes;

      const derniere = await tx.interventionSignature.findFirst({
        where: { intervention_id: interventionId },
        select: { issue: true, motif: true },
        orderBy: [{ cree_le: "desc" }, { id: "desc" }],
      });

      const verdict = peutTerminer(
        ligne.statut as StatutIntervention,
        tempsMesure,
        derniere?.issue ?? null,
      );
      if (verdict.refuse) {
        return { accepte: false, cle: verdict.cle };
      }
      // `derniere` n'est jamais `null` ici : `peutTerminer` aurait refusé sur
      // `issueSignature === null` sinon. Rejugé pour que TypeScript n'ait
      // rien à deviner.
      if (derniere === null) {
        return {
          accepte: false,
          cle: "intervention.refus.signature_manquante",
        };
      }

      await tx.intervention.update({
        where: { id: interventionId },
        data: { statut: "terminee", temps_mesure_min: tempsMesure },
      });

      return {
        accepte: true,
        id: interventionId,
        issueSignature: derniere.issue,
        motifSignature: derniere.motif,
      };
    },
    client,
  );
}
