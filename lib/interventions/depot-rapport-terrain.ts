import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import {
  exigerContexteActif,
  exigerSocieteActive,
  type ContexteSession,
} from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { estUuid } from "@/lib/identifiant";
import { mesurer, verifierInstantAppareil } from "@/lib/interventions/compteur";
import type { SaisieDifferee } from "@/lib/interventions/saisie-differee";
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
 * ## LES PRESTATIONS DU TERRAIN SE DÉFINISSENT PAR UNE DIFFÉRENCE, jamais un
 * ENSEMBLE ENTIER (D143, décision d'Alexis du 22/10/2026)
 *
 * `definirPrestationsRealiseesDepuisFile` (9F4H6A-COQUILLE-ANCIENNE-COPIE,
 * point 2 ; généralisé à l'envoi EN LIGNE par 9F4H6E-PRESTATIONS-DIFFERENCE-
 * EN-LIGNE) est le SEUL chemin que la route terrain (`app/api/terrain/[id]/
 * prestations/route.ts`) appelle, que l'envoi vienne directement du
 * composant ou d'un rejeu depuis la file hors réseau : l'appareil ne connaît
 * que ce que SON instantané portait et ce que SA propre saisie a changé
 * depuis — jamais ce qu'un autre appareil ou une autre personne a fait
 * pendant que la fiche était ouverte ou hors réseau. `ajouterIds` AJOUTE,
 * `retirerIds` RETIRE, tout le reste de `intervention_prestation` reste
 * intact — voir son docblock.
 *
 * `definirPrestationsRealisees`, QUI REMPLAÇAIT L'ENSEMBLE ENTIER (`notIn`
 * effaçait tout ce qui n'était pas soumis), A DISPARU AVEC CE TICKET — plus
 * personne ne l'appelait : c'était le chemin de l'envoi EN LIGNE direct, et
 * une prestation cochée par le BUREAU pendant que la fiche terrain était
 * ouverte disparaissait au premier geste du technicien, puisque son écran
 * ne la connaissait pas (revue du pilote sur `013857b7`, 22/10/2026). Le
 * gardien R3-12 (`tests/unit/gardiens/chemins-de-depot.test.ts`) refuse
 * qu'une fonction de dépôt sans appelant survive sans motif nommé — aucun
 * n'existait pour celle-ci.
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
      // UN RAPPORT MODIFIÉ ANNULE SA VALIDATION (RG-INT-03, D135, 9H1) : une
      // validation qui survivrait à ce qu'elle a jugé ne jugerait plus rien.
      // Écrit à CHAQUE enregistrement, même si la validation était déjà
      // absente (`null` sur `null` ne change rien) — plus simple et plus sûr
      // qu'une lecture préalable pour décider s'il faut l'effacer.
      const ecrite = await tx.intervention.update({
        where: { id: interventionId },
        data: {
          commentaire_technicien: saisie.commentaire_technicien,
          suite_a_donner: saisie.suite_a_donner,
          rapport_valide_par: null,
          rapport_valide_le: null,
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

/** Une prestation réalisée, avec le libellé de son catalogue. */
export type PrestationRealisee = {
  readonly id: string;
  readonly prestation_id: string;
  readonly code: string;
  readonly libelle: string;
};

/**
 * APPLIQUE UNE DIFFÉRENCE DE PRESTATIONS, JAMAIS UN ENSEMBLE ENTIER
 * (9F4H6A-COQUILLE-ANCIENNE-COPIE, point 2) — appelée UNIQUEMENT pour un
 * envoi REJOUÉ DEPUIS LA FILE hors réseau (`depuis_file`). `definirPrestations
 * Realisees` ci-dessus REMPLACE l'ensemble entier (`notIn` efface tout ce qui
 * n'est pas soumis) : c'est exactement ce qu'il ne faut JAMAIS faire pour un
 * geste rejoué, qui ne connaît que ce que SON appareil a coché/décoché —
 * jamais ce qu'un autre appareil ou une autre personne a ajouté depuis
 * l'instantané qu'il a emporté. `ajouterIds` AJOUTE (sans doublon, un rejeu du
 * même envoi ne crée rien de plus), `retirerIds` RETIRE — tout le reste de
 * `intervention_prestation` reste intact. `null` si l'intervention n'est pas
 * visible, même refus nommé que `definirPrestationsRealisees`.
 */
export async function definirPrestationsRealiseesDepuisFile(
  contexte: ContexteSession,
  interventionId: string,
  ajouterIds: readonly string[],
  retirerIds: readonly string[],
  client?: PrismaClient,
): Promise<{ readonly id: string } | null> {
  const societeId = exigerSocieteActive(contexte);
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
      const ajouter = [...new Set(ajouterIds)];
      const retirer = [...new Set(retirerIds)];
      // UN `ajouter_id`/`retirer_id` QUI N'EST PAS UN UUID (point 5,
      // 9F4H6C-FILE-ROBUSTESSE) — `prestation_id` est `@db.Uuid` ; une
      // valeur mal formée dans `tx.prestation.findMany` ou `deleteMany`
      // ci-dessous lèverait à la base (« invalid input syntax for type
      // uuid »), AVANT même que le contrôle de société suivant ne s'exécute.
      // Refusée PROPREMENT, avant d'interroger la base.
      if (
        ajouter.some((id) => !estUuid(id)) ||
        retirer.some((id) => !estUuid(id))
      ) {
        return null;
      }
      if (ajouter.length > 0) {
        // UN `ajouter_id` D'UNE AUTRE SOCIÉTÉ EST REFUSÉ, PROPREMENT (point 4,
        // 9F4H6B-FILE-ANCIEN-FORMAT) — sans ce contrôle, le `createMany`
        // plus bas heurterait la FK composite `(societe_id, prestation_id)`
        // → `prestation(societe_id, id)` et lèverait une erreur Prisma NON
        // rattrapée jusqu'à la route, qui rendait alors une page d'erreur
        // brute au lieu d'un motif — la saisie restait en file, gelée, sans
        // qu'aucun message n'explique pourquoi. I1 est déjà garanti par la
        // FK : ce correctif se contente de refuser PROPREMENT, avant
        // d'écrire quoi que ce soit (même refus nommé que « intervention non
        // visible », jamais une 500).
        const duCatalogue = await tx.prestation.findMany({
          where: { societe_id: societeId, id: { in: ajouter } },
          select: { id: true },
        });
        if (duCatalogue.length !== ajouter.length) {
          return null;
        }
      }
      let modifiee = false;
      if (retirer.length > 0) {
        const retirees = await tx.interventionPrestation.deleteMany({
          where: {
            intervention_id: interventionId,
            prestation_id: { in: retirer },
          },
        });
        modifiee = modifiee || retirees.count > 0;
      }
      if (ajouter.length > 0) {
        const existantes = await tx.interventionPrestation.findMany({
          where: {
            intervention_id: interventionId,
            prestation_id: { in: ajouter },
          },
          select: { prestation_id: true },
        });
        const dejaLa = new Set(existantes.map((e) => e.prestation_id));
        const aCreer = ajouter.filter((id) => !dejaLa.has(id));
        if (aCreer.length > 0) {
          await tx.interventionPrestation.createMany({
            data: aCreer.map((prestationId) => ({
              id: uuidv7(),
              societe_id: societeId,
              intervention_id: interventionId,
              prestation_id: prestationId,
            })),
          });
          modifiee = true;
        }
      }
      // UN RAPPORT MODIFIÉ ANNULE SA VALIDATION (RG-INT-03, D135, 9H1B) —
      // même motif que `enregistrerRapportTexte` : les prestations réalisées
      // faisaient partie de ce qu'un responsable a jugé en validant (BON-2),
      // au même titre que le texte. SAUF SUR UNE FIGÉE (`estFige`) : I5
      // garantit que ce dépôt n'est jamais bloqué par le statut, mais
      // `intervention_cycle_de_vie` refuse TOUTE modification d'une ligne
      // déjà `cloturee`/`annulee` — y écrire ferait échouer tout l'envoi,
      // prestations comprises, pour une validation qu'une clôture déjà
      // close n'a plus de sens à défaire.
      if (modifiee && !estFige(intervention.statut as StatutIntervention)) {
        await tx.intervention.updateMany({
          where: { id: interventionId },
          data: { rapport_valide_par: null, rapport_valide_le: null },
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
 * UNE SAISIE IDENTIQUE À LA DERNIÈRE LIGNE n'ajoute rien (9F4-TERRAIN-
 * ENREGISTREMENT-AUTO) — l'enregistrement automatique envoie la signature
 * dès qu'elle est complète, puis de nouveau si l'onglet se rouvre et renvoie
 * le même brouillon local : sans ce filtre, chaque rechargement ajouterait
 * une ligne à l'historique, qui resterait exact mais grossirait sans raison.
 * L'historique reste APPEND-ONLY (D173) : seul l'AJOUT d'un doublon est
 * évité, aucune ligne existante n'est jamais comparée puis modifiée.
 */
function signatureIdentiqueALaDerniere(
  derniere: Pick<
    Signature,
    "issue" | "image_base64" | "motif" | "signataire_nom" | "signataire_qualite"
  >,
  saisie: SaisieSignature,
): boolean {
  if (derniere.issue !== saisie.issue) {
    return false;
  }
  if (saisie.issue === "signee") {
    return (
      derniere.image_base64 === saisie.image_base64 &&
      derniere.signataire_nom === saisie.signataire_nom &&
      (derniere.signataire_qualite ?? null) ===
        (saisie.signataire_qualite ?? null)
    );
  }
  return derniere.motif === saisie.motif;
}

/** Les codes Prisma que ce module sait traduire. */
const VIOLATION_UNICITE = "P2002";

/**
 * AJOUTE une signature — jamais ne remplace. Voir l'en-tête du modèle
 * `InterventionSignature` : ce module n'expose NI modification NI suppression,
 * et c'est délibéré. `null` si l'intervention n'est pas visible.
 *
 * **`id` (9F4H2-HORS-RESEAU-HEURE-ET-REJEU, décision n° 108 d'Alexis,
 * 14/10/2026) — FABRIQUÉ PAR L'APPAREIL, FACULTATIF.** Un renvoi du MÊME
 * `id` POUR CETTE INTERVENTION rend la ligne déjà écrite, sans en créer une
 * seconde — même principe que `demarrerLeCompteur` (`depot-compteur.ts`).
 * Un `id` qui désigne la ligne d'une AUTRE intervention ou d'une AUTRE
 * société ne se voit pas sous les politiques de cette transaction (I1) et
 * heurte l'unicité à la création — rattrapé plus bas, jamais une page
 * d'erreur brute, jamais un motif qui nommerait ce qui a été heurté.
 */
export async function enregistrerSignature(
  contexte: ContexteSession,
  interventionId: string,
  saisie: SaisieSignature,
  client?: PrismaClient,
  id?: string,
): Promise<{ readonly id: string } | null> {
  const societeId = exigerSocieteActive(contexte);
  try {
    return await avecContexteApplicatif(
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
        if (id !== undefined) {
          const rejouee = await tx.interventionSignature.findFirst({
            where: { id, intervention_id: interventionId },
            select: { id: true },
          });
          if (rejouee !== null) {
            return rejouee;
          }
        }
        const derniere = await tx.interventionSignature.findFirst({
          where: { intervention_id: interventionId },
          select: CHAMPS_SIGNATURE,
          orderBy: [{ cree_le: "desc" }, { id: "desc" }],
        });
        if (
          derniere !== null &&
          signatureIdentiqueALaDerniere(derniere, saisie)
        ) {
          return { id: derniere.id };
        }
        const creee = await tx.interventionSignature.create({
          data:
            saisie.issue === "signee"
              ? {
                  id: id ?? uuidv7(),
                  societe_id: societeId,
                  intervention_id: interventionId,
                  issue: "signee",
                  image_base64: saisie.image_base64,
                  signataire_nom: saisie.signataire_nom,
                  signataire_qualite: saisie.signataire_qualite ?? null,
                }
              : {
                  id: id ?? uuidv7(),
                  societe_id: societeId,
                  intervention_id: interventionId,
                  issue: saisie.issue,
                  motif: saisie.motif,
                },
          select: { id: true },
        });
        // UN RAPPORT MODIFIÉ ANNULE SA VALIDATION (RG-INT-03, D135, 9H1B) —
        // même motif que `enregistrerRapportTexte` et les prestations
        // réalisées : la signature fait partie de ce qu'un responsable a
        // jugé en validant (BON-2). SAUF SUR UNE FIGÉE (`estFige`), pour la
        // même raison que les prestations — voir leur commentaire.
        if (!estFige(intervention.statut as StatutIntervention)) {
          await tx.intervention.updateMany({
            where: { id: interventionId },
            data: { rapport_valide_par: null, rapport_valide_le: null },
          });
        }
        return creee;
      },
      client,
    );
  } catch (erreur: unknown) {
    if (
      id !== undefined &&
      erreur instanceof Prisma.PrismaClientKnownRequestError &&
      erreur.code === VIOLATION_UNICITE
    ) {
      return null;
    }
    throw erreur;
  }
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
      /**
       * `true` SEULEMENT sur un REJEU reconnu (9F4H2, décision n° 108
       * d'Alexis) : l'appelant (la route) ne doit alors envoyer AUCUN
       * second courriel au SAV — le premier passage l'a déjà fait, ou a
       * déjà décidé de ne pas le faire.
       */
      readonly rejoue?: true;
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
 *
 * **`differe` (9F4H2-HORS-RESEAU-HEURE-ET-REJEU, décision n° 108 d'Alexis,
 * 14/10/2026)** — l'heure de l'APPAREIL ferme le segment ouvert, qui est
 * alors marqué `saisi_hors_reseau`. **Le rejeu se reconnaît par
 * `operation_id`**, posé dans `intervention.terminer_operation_id` à
 * l'instant même où `terminee` s'écrit : un renvoi du MÊME `operation_id` sur
 * une intervention déjà terminée PAR CETTE opération répond accepté SANS
 * RIEN RÉÉCRIRE (`rejoue: true`) — la route n'envoie alors AUCUN second
 * courriel au SAV. Une intervention terminée PAR UNE AUTRE VOIE, ou dont
 * l'`operation_id` ne correspond pas, garde le refus normal du cycle de vie.
 */
export async function terminerIntervention(
  contexte: ContexteSession,
  interventionId: string,
  instant: Date,
  client?: PrismaClient,
  differe?: SaisieDifferee,
): Promise<ResultatTerminer> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ligne = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: {
          id: true,
          statut: true,
          technicien_id: true,
          terminer_operation_id: true,
        },
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

      if (
        differe !== undefined &&
        ligne.terminer_operation_id === differe.operationId
      ) {
        const derniereRejouee = await tx.interventionSignature.findFirst({
          where: { intervention_id: interventionId },
          select: { issue: true, motif: true },
          orderBy: [{ cree_le: "desc" }, { id: "desc" }],
        });
        // `derniereRejouee` n'est jamais `null` ici : `terminer_operation_id`
        // n'a pu être posé qu'après qu'une signature ait existé
        // (`peutTerminer` l'exige). Le repli n'est qu'une garde TypeScript.
        return {
          accepte: true,
          id: interventionId,
          issueSignature: derniereRejouee?.issue ?? "client_absent",
          motifSignature: derniereRejouee?.motif ?? null,
          rejoue: true,
        };
      }

      // ADDENDUM n°1 (9F4H4B) — même distinction que `demarrerLeCompteur`/
      // `arreterLeCompteur` : `depuisFile` vaut vrai par défaut (ancien
      // contrat des épreuves d'isolation de 9F4H2), et seules les routes
      // compteur/terminer le posent explicitement à `false` pour le tout
      // premier essai EN LIGNE (`rapport-automatique.tsx`, section
      // « Terminer »). Le rejeu PAR `operation_id`, lui, reste valable quel
      // que soit `depuisFile` — voir le bloc juste au-dessus.
      const depuisFile = differe !== undefined && (differe.depuisFile ?? true);
      if (differe !== undefined && depuisFile) {
        const bornes = verifierInstantAppareil(
          instant,
          differe.instantAppareil,
        );
        if (bornes !== null) {
          return { accepte: false, cle: bornes };
        }
      }
      const effectif =
        differe !== undefined && depuisFile ? differe.instantAppareil : instant;

      const ouverts = await tx.segmentTravail.findMany({
        where: { intervention_id: interventionId, fin: null },
        select: { id: true, utilisateur_id: true, debut: true },
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
        // MÊME BORNE QUE `peutArreter` (compteur.ts) — « fin > debut » —, mais
        // non lue ici avant ce correctif : l'heure de l'APPAREIL (saisie
        // différée) peut précéder le démarrage du segment (dérive d'horloge),
        // et la base l'aurait refusée par sa contrainte CHECK, rattrapée en
        // amont par la route comme `intervention.refus.erreur_serveur` — un
        // refus générique là où la clé existait déjà.
        if (effectif.getTime() <= leSien.debut.getTime()) {
          return { accepte: false, cle: "compteur.refus.fin_avant_debut" };
        }
        // CONDITIONNÉ sur `fin: null` (point 2, 9F4H2A-REJEU-SANS-DOUBLON) :
        // deux « Terminer » simultanés liraient tous deux ce même segment
        // ouvert avant que l'un n'écrive ; sans la condition, le second
        // écraserait silencieusement le `fin` déjà posé par le premier. Si
        // elle n'a affecté personne, un autre appel a déjà fermé le segment —
        // rien de plus à y faire ici, `tousLesSegments` ci-dessous relit l'état réel.
        await tx.segmentTravail.updateMany({
          where: { id: leSien.id, fin: null },
          data: {
            fin: effectif,
            ...(depuisFile ? { saisi_hors_reseau: true } : {}),
          },
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

      // LA TRANSITION EST CONDITIONNELLE (point 2, 9F4H2A-REJEU-SANS-DOUBLON) :
      // `statut = 'en_cours'` est revérifié PAR L'ÉCRITURE, pas seulement par
      // `verdict` ci-dessus — entre les deux, un second « Terminer » simultané
      // a pu déjà gagner la course. Sous READ COMMITTED, Postgres relit la
      // ligne (et donc le WHERE) après avoir attendu le verrou posé par le
      // premier `UPDATE` : le second `updateMany` ne touche alors aucune ligne,
      // ce qui est exactement ce qui distingue le gagnant du perdant ici — un
      // `update` simple aurait écrit deux fois, et la route aurait envoyé deux
      // courriels SAV pour un seul fait.
      const transition = await tx.intervention.updateMany({
        where: { id: interventionId, statut: "en_cours" },
        data: {
          statut: "terminee",
          temps_mesure_min: tempsMesure,
          ...(differe !== undefined
            ? { terminer_operation_id: differe.operationId }
            : {}),
        },
      });
      if (transition.count === 0) {
        // PERDU LA COURSE. Même `operation_id` que le gagnant : c'est le même
        // rejeu, accepté sans second courriel (voir le rejeu séquentiel plus
        // haut). Sinon, l'intervention est déjà terminée PAR AUTRE CHOSE : le
        // même refus que `peutTerminer` rendrait aujourd'hui sur ce statut.
        if (differe !== undefined) {
          const courante = await tx.intervention.findFirst({
            where: { id: interventionId },
            select: { terminer_operation_id: true },
          });
          if (courante?.terminer_operation_id === differe.operationId) {
            return {
              accepte: true,
              id: interventionId,
              issueSignature: derniere.issue,
              motifSignature: derniere.motif,
              rejoue: true,
            };
          }
        }
        return { accepte: false, cle: "intervention.refus.pas_en_cours" };
      }

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
