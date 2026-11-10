import { randomUUID } from "node:crypto";

import {
  type Prisma,
  type PrismaClient,
  type ReponseConformite,
  type TypeIntervention,
} from "@prisma/client";

import {
  exigerContexteActif,
  exigerSocieteActive,
  type ContexteSession,
} from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import {
  resoudreGabarit,
  type CandidatGabarit,
  type ContexteResolutionGabarit,
  type GabaritResolu,
} from "@/lib/checklists/cascade";
import { etatDeCompletude, type EtatCompletude } from "@/lib/checklists/completude";
import {
  validerReponsePoint,
  type SaisieReponsePoint,
} from "@/lib/checklists/validation-reponse";
import { estFige } from "@/lib/interventions/cycle-de-vie";
import { accesSurCetteIntervention } from "@/lib/interventions/perimetre-technicien";
import type {
  StatutIntervention,
  TypeIntervention as TypeInterventionSaisie,
} from "@/lib/interventions/saisie";

/**
 * LE SOCLE DES CHECKLISTS (9K08-CHECKLIST-SCHEMA, D235) — dépôt MINIMAL :
 * créer un modèle, publier une version, lire la dernière version publiée.
 * Rien d'autre : la cascade de résolution, la saisie terrain et le blocage de
 * « Terminer » sont des lots suivants (CK2, CK5, CK7 — hors territoire ici).
 *
 * `checklist_modele` est de forme « interne » (D94) : aucun compte portail ne
 * lit ce dépôt, et les trois fonctions ci-dessous ne sont donc jamais
 * appelées sous un contexte de portail (`exigerContexteActif` le refuserait
 * de toute façon si `societeId`/`role` manquaient, mais rien n'empêche ICI un
 * contexte portail bien formé — c'est la politique RLS, pas ce module, qui
 * ferme la lecture : un appel sous ce contexte rendrait simplement zéro ligne
 * et zéro écriture acceptée).
 */

/** Un point à poser sur une version, selon son type de réponse. */
export type SaisiePointChecklist = {
  readonly section: string;
  readonly ordre: number;
  readonly libelle: string;
  readonly consigne?: string;
  readonly obligatoire?: boolean;
} & (
  | { readonly typeReponse: "conforme_non_conforme_sans_objet" }
  | { readonly typeReponse: "case_faite" }
  | {
      readonly typeReponse: "valeur_mesuree";
      readonly unite?: string;
      readonly toleranceMin?: number;
      readonly toleranceMax?: number;
    }
);

/** L'en-tête d'un modèle de checklist — rattachements tous FACULTATIFS. */
export type SaisieModeleChecklist = {
  readonly code: string;
  readonly libelle: string;
  readonly typeIntervention?: TypeIntervention;
  readonly familleId?: string;
  readonly modeleId?: string;
  readonly exigeMachine?: boolean;
};

/** Un point tel qu'il se lit sur une version déjà publiée. */
export type PointPublie = {
  readonly id: string;
  readonly section: string;
  readonly ordre: number;
  readonly libelle: string;
  readonly consigne: string | null;
  readonly obligatoire: boolean;
  readonly typeReponse: string;
  readonly unite: string | null;
  readonly toleranceMin: Prisma.Decimal | null;
  readonly toleranceMax: Prisma.Decimal | null;
};

/** Une version publiée, avec ses points dans l'ordre. */
export type VersionPubliee = {
  readonly id: string;
  readonly numero: number;
  readonly publieeLe: Date;
  readonly points: readonly PointPublie[];
};

/** Crée l'en-tête d'un modèle de checklist — NAÎT sans aucune version. */
export async function creerModele(
  contexte: ContexteSession,
  saisie: SaisieModeleChecklist,
  client?: PrismaClient,
): Promise<string> {
  const { societeId } = exigerContexteActif(contexte);
  const id = randomUUID();

  await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.checklistModele.create({
        data: {
          id,
          societe_id: societeId,
          code: saisie.code,
          libelle: saisie.libelle,
          type_intervention: saisie.typeIntervention ?? null,
          famille_id: saisie.familleId ?? null,
          modele_id: saisie.modeleId ?? null,
          exige_machine: saisie.exigeMachine ?? false,
        },
      }),
    client,
  );

  return id;
}

/**
 * Publie une NOUVELLE version — jamais une modification (D235) : le numéro
 * est UN DE PLUS que le dernier déjà publié pour ce modèle, calculé dans la
 * MÊME transaction que l'insertion pour qu'aucune course ne le réutilise.
 */
export async function publierVersion(
  contexte: ContexteSession,
  checklistModeleId: string,
  points: readonly SaisiePointChecklist[],
  client?: PrismaClient,
): Promise<string> {
  const { societeId } = exigerContexteActif(contexte);
  const id = randomUUID();

  await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const derniere = await tx.checklistVersion.findFirst({
        where: { checklist_modele_id: checklistModeleId },
        orderBy: { numero: "desc" },
        select: { numero: true },
      });

      await tx.checklistVersion.create({
        data: {
          id,
          societe_id: societeId,
          checklist_modele_id: checklistModeleId,
          numero: (derniere?.numero ?? 0) + 1,
        },
      });

      await tx.checklistPoint.createMany({
        data: points.map((point) => ({
          id: randomUUID(),
          societe_id: societeId,
          checklist_version_id: id,
          section: point.section,
          ordre: point.ordre,
          libelle: point.libelle,
          consigne: point.consigne ?? null,
          obligatoire: point.obligatoire ?? false,
          type_reponse: point.typeReponse,
          unite:
            point.typeReponse === "valeur_mesuree"
              ? (point.unite ?? null)
              : null,
          tolerance_min:
            point.typeReponse === "valeur_mesuree"
              ? (point.toleranceMin ?? null)
              : null,
          tolerance_max:
            point.typeReponse === "valeur_mesuree"
              ? (point.toleranceMax ?? null)
              : null,
        })),
      });
    },
    client,
  );

  return id;
}

/** La dernière version publiée d'un modèle (le plus grand numéro), avec ses points. */
export async function dernierVersionPubliee(
  contexte: ContexteSession,
  checklistModeleId: string,
  client?: PrismaClient,
): Promise<VersionPubliee | null> {
  const version = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.checklistVersion.findFirst({
        where: { checklist_modele_id: checklistModeleId },
        orderBy: { numero: "desc" },
        include: { points: { orderBy: { ordre: "asc" } } },
      }),
    client,
  );

  if (version === null) {
    return null;
  }

  return {
    id: version.id,
    numero: version.numero,
    publieeLe: version.publiee_le,
    points: version.points.map((point) => ({
      id: point.id,
      section: point.section,
      ordre: point.ordre,
      libelle: point.libelle,
      consigne: point.consigne,
      obligatoire: point.obligatoire,
      typeReponse: point.type_reponse,
      unite: point.unite,
      toleranceMin: point.tolerance_min,
      toleranceMax: point.tolerance_max,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LA SAISIE TERRAIN (9K18-CHECKLIST-DOMAINE) — résolution du gabarit,
// lecture, et écriture par DIFFÉRENCE
// ═══════════════════════════════════════════════════════════════════════════

/** Les candidats ACTIFS de la société — RLS scope déjà, aucune clause ici. */
async function candidatsActifs(
  tx: Prisma.TransactionClient,
): Promise<CandidatGabarit[]> {
  const modeles = await tx.checklistModele.findMany({
    where: { actif: true },
    select: {
      id: true,
      code: true,
      type_intervention: true,
      modele_id: true,
      sous_type_id: true,
      famille_id: true,
      exige_machine: true,
    },
  });
  return modeles.map((modele) => ({
    checklistModeleId: modele.id,
    code: modele.code,
    typeIntervention: modele.type_intervention as TypeInterventionSaisie | null,
    modeleId: modele.modele_id,
    sousTypeId: modele.sous_type_id,
    familleId: modele.famille_id,
    exigeMachine: modele.exige_machine,
  }));
}

/**
 * Le contexte que la MACHINE PORTÉE (s'il y en a une) donne à la cascade —
 * une intervention ne porte AU PLUS une machine (PARCOURS-1, `@@unique
 * ([intervention_id])` sur `intervention_machine`).
 */
async function contexteDeResolution(
  tx: Prisma.TransactionClient,
  interventionId: string,
  typeIntervention: TypeInterventionSaisie,
): Promise<ContexteResolutionGabarit> {
  const rattachement = await tx.interventionMachine.findFirst({
    where: { intervention_id: interventionId },
    select: { machine_id: true },
  });
  if (rattachement === null) {
    return {
      typeIntervention,
      machinePortee: false,
      modeleId: null,
      sousTypeId: null,
      familleId: null,
    };
  }
  const machine = await tx.machine.findFirst({
    where: { id: rattachement.machine_id },
    select: {
      modele: { select: { id: true, famille_id: true, sous_type_id: true } },
    },
  });
  return {
    typeIntervention,
    machinePortee: true,
    modeleId: machine?.modele.id ?? null,
    sousTypeId: machine?.modele.sous_type_id ?? null,
    familleId: machine?.modele.famille_id ?? null,
  };
}

async function resoudreGabaritPourIntervention(
  tx: Prisma.TransactionClient,
  interventionId: string,
  typeIntervention: TypeInterventionSaisie,
): Promise<GabaritResolu | null> {
  const [contexte, candidats] = await Promise.all([
    contexteDeResolution(tx, interventionId, typeIntervention),
    candidatsActifs(tx),
  ]);
  return resoudreGabarit(contexte, candidats);
}

export type PointDeChecklist = {
  readonly id: string;
  readonly section: string;
  readonly ordre: number;
  readonly libelle: string;
  readonly consigne: string | null;
  readonly obligatoire: boolean;
  readonly typeReponse: string;
  readonly unite: string | null;
  readonly toleranceMin: Prisma.Decimal | null;
  readonly toleranceMax: Prisma.Decimal | null;
  readonly choix: readonly string[];
};

export type ReponseDeChecklist = {
  readonly checklistPointId: string;
  readonly valeurConforme: ReponseConformite | null;
  readonly valeurMesuree: Prisma.Decimal | null;
  readonly valeurFait: boolean | null;
  readonly valeurChoix: string | null;
  readonly valeurTexte: string | null;
  readonly auteurId: string;
  readonly reponduLe: Date;
};

/**
 * `disponible: false` — aucun gabarit n'est résolu pour cette intervention
 * (nature non couverte, et aucun modèle générique). `null` — l'intervention
 * n'est pas visible (D35, D50).
 */
export type ChecklistDeLIntervention =
  | {
      readonly disponible: true;
      readonly checklistVersionId: string;
      readonly points: readonly PointDeChecklist[];
      readonly reponses: readonly ReponseDeChecklist[];
      readonly completude: EtatCompletude;
    }
  | { readonly disponible: false };

/**
 * LA CHECKLIST D'UNE INTERVENTION — la version FIGÉE
 * (`intervention.checklist_version_id`) si elle existe, sinon le gabarit
 * RÉSOLU par la cascade (`lib/checklists/cascade.ts`). Une LECTURE ne PIN
 * JAMAIS : seule `enregistrerReponses` pose le pin, à la première réponse
 * acceptée (D235).
 */
export async function checklistDeLIntervention(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<ChecklistDeLIntervention | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const intervention = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: { id: true, type: true, checklist_version_id: true },
      });
      if (intervention === null) {
        return null;
      }

      let versionId = intervention.checklist_version_id;
      if (versionId === null) {
        const resolu = await resoudreGabaritPourIntervention(
          tx,
          interventionId,
          intervention.type as TypeInterventionSaisie,
        );
        if (resolu === null) {
          return { disponible: false };
        }
        const derniere = await tx.checklistVersion.findFirst({
          where: { checklist_modele_id: resolu.checklistModeleId },
          orderBy: { numero: "desc" },
          select: { id: true },
        });
        if (derniere === null) {
          return { disponible: false };
        }
        versionId = derniere.id;
      }

      const points = await tx.checklistPoint.findMany({
        where: { checklist_version_id: versionId },
        orderBy: { ordre: "asc" },
      });
      const reponses = await tx.checklistReponse.findMany({
        where: { intervention_id: interventionId },
      });

      return {
        disponible: true,
        checklistVersionId: versionId,
        points: points.map((point) => ({
          id: point.id,
          section: point.section,
          ordre: point.ordre,
          libelle: point.libelle,
          consigne: point.consigne,
          obligatoire: point.obligatoire,
          typeReponse: point.type_reponse,
          unite: point.unite,
          toleranceMin: point.tolerance_min,
          toleranceMax: point.tolerance_max,
          choix: point.choix,
        })),
        reponses: reponses.map((reponse) => ({
          checklistPointId: reponse.checklist_point_id,
          valeurConforme: reponse.valeur_conforme,
          valeurMesuree: reponse.valeur_mesuree,
          valeurFait: reponse.valeur_fait,
          valeurChoix: reponse.valeur_choix,
          valeurTexte: reponse.valeur_texte,
          auteurId: reponse.auteur_id,
          reponduLe: reponse.repondu_le,
        })),
        completude: etatDeCompletude(
          points.map((point) => ({
            id: point.id,
            libelle: point.libelle,
            obligatoire: point.obligatoire,
          })),
          reponses.map((reponse) => ({
            checklistPointId: reponse.checklist_point_id,
            nonConforme: reponse.valeur_conforme === "non_conforme",
          })),
        ),
      };
    },
    client,
  );
}

/** Une entrée de la DIFFÉRENCE envoyée par le terrain — jamais la liste entière. */
export type SaisieDifferenceReponse = {
  readonly checklistPointId: string;
  readonly valeur: unknown;
};

export type EcritureReponses =
  | { readonly id: string }
  | { readonly refuse: true; readonly cle: string };

function valeursDeLaSaisie(saisie: SaisieReponsePoint): {
  readonly valeur_conforme: ReponseConformite | null;
  readonly valeur_mesuree: number | null;
  readonly valeur_fait: boolean | null;
  readonly valeur_choix: string | null;
  readonly valeur_texte: string | null;
} {
  switch (saisie.typeReponse) {
    case "conforme_non_conforme_sans_objet":
      return {
        valeur_conforme: saisie.valeurConforme,
        valeur_mesuree: null,
        valeur_fait: null,
        valeur_choix: null,
        valeur_texte: null,
      };
    case "valeur_mesuree":
      return {
        valeur_conforme: null,
        valeur_mesuree: saisie.valeurMesuree,
        valeur_fait: null,
        valeur_choix: null,
        valeur_texte: null,
      };
    case "case_faite":
      return {
        valeur_conforme: null,
        valeur_mesuree: null,
        valeur_fait: true,
        valeur_choix: null,
        valeur_texte: null,
      };
    case "choix_dans_une_liste":
      return {
        valeur_conforme: null,
        valeur_mesuree: null,
        valeur_fait: null,
        valeur_choix: saisie.valeurChoix,
        valeur_texte: null,
      };
    case "texte_libre":
      return {
        valeur_conforme: null,
        valeur_mesuree: null,
        valeur_fait: null,
        valeur_choix: null,
        valeur_texte: saisie.valeurTexte,
      };
  }
}

/**
 * ENREGISTRE une DIFFÉRENCE de réponses — jamais l'ensemble entier, même
 * discipline que `definirPrestationsRealiseesDepuisFile` : l'appareil ne
 * connaît que ce que SA saisie a changé.
 *
 * **TOUT ou RIEN** (I6) : chaque entrée de `difference` est validée contre la
 * version EN VIGUEUR avant qu'aucune ligne ne soit écrite — un point hors de
 * cette version, ou une valeur qui ne correspond pas au type du point,
 * REFUSE la différence ENTIÈRE, nommément, sans rien enregistrer.
 *
 * **LE PIN** (D235) — si `intervention.checklist_version_id` est encore
 * `null`, la cascade résout un gabarit et la version qui en résulte est
 * POSÉE, conditionnée sur `checklist_version_id IS NULL` (même patron que la
 * transition `terminerIntervention`) : deux téléphones qui résolvent chacun
 * un gabarit au même instant ne pinnent qu'une fois — LE PREMIER GAGNE, le
 * second relit ce qui vient d'être posé et valide CONTRE CETTE version. Un
 * point qui n'existe pas dans la version déjà figée (par un autre appareil,
 * sur une AUTRE version) est refusé — `checklist.refus.point_hors_version`.
 *
 * `null` si l'intervention n'est pas visible OU que ce technicien n'y est pas
 * affecté (D35, D50, même refus que `enregistrerRapportTexte`).
 */
export async function enregistrerReponses(
  contexte: ContexteSession,
  interventionId: string,
  difference: readonly SaisieDifferenceReponse[],
  client?: PrismaClient,
): Promise<EcritureReponses | null> {
  const societeId = exigerSocieteActive(contexte);
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const intervention = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: {
          id: true,
          technicien_id: true,
          statut: true,
          type: true,
          checklist_version_id: true,
        },
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

      let versionId = intervention.checklist_version_id;
      if (versionId === null) {
        const resolu = await resoudreGabaritPourIntervention(
          tx,
          interventionId,
          intervention.type as TypeInterventionSaisie,
        );
        if (resolu === null) {
          return { refuse: true, cle: "checklist.refus.aucun_gabarit" };
        }
        const derniere = await tx.checklistVersion.findFirst({
          where: { checklist_modele_id: resolu.checklistModeleId },
          orderBy: { numero: "desc" },
          select: { id: true },
        });
        if (derniere === null) {
          return { refuse: true, cle: "checklist.refus.aucun_gabarit" };
        }
        const pin = await tx.intervention.updateMany({
          where: { id: interventionId, checklist_version_id: null },
          data: { checklist_version_id: derniere.id },
        });
        if (pin.count === 1) {
          versionId = derniere.id;
        } else {
          const relue = await tx.intervention.findFirst({
            where: { id: interventionId },
            select: { checklist_version_id: true },
          });
          // Jamais `null` ici : une course perdue veut dire qu'un AUTRE appel
          // vient de poser le pin à l'instant même.
          versionId = relue?.checklist_version_id ?? derniere.id;
        }
      }

      const points = await tx.checklistPoint.findMany({
        where: { checklist_version_id: versionId },
      });
      const pointsParId = new Map(points.map((point) => [point.id, point]));

      const validees: {
        readonly point: (typeof points)[number];
        readonly saisie: SaisieReponsePoint;
      }[] = [];
      for (const entree of difference) {
        const point = pointsParId.get(entree.checklistPointId);
        if (point === undefined) {
          return { refuse: true, cle: "checklist.refus.point_hors_version" };
        }
        const verdict = validerReponsePoint(
          { typeReponse: point.type_reponse, choix: point.choix },
          entree.valeur,
        );
        if (!verdict.valide) {
          return { refuse: true, cle: verdict.cle };
        }
        validees.push({ point, saisie: verdict.saisie });
      }

      for (const { point, saisie } of validees) {
        await tx.checklistReponse.upsert({
          where: {
            societe_id_intervention_id_checklist_point_id: {
              societe_id: societeId,
              intervention_id: interventionId,
              checklist_point_id: point.id,
            },
          },
          create: {
            id: uuidv7(),
            societe_id: societeId,
            intervention_id: interventionId,
            checklist_point_id: point.id,
            libelle: point.libelle,
            section: point.section,
            unite: point.unite,
            obligatoire: point.obligatoire,
            auteur_id: contexte.utilisateurId,
            ...valeursDeLaSaisie(saisie),
          },
          update: {
            libelle: point.libelle,
            section: point.section,
            unite: point.unite,
            obligatoire: point.obligatoire,
            auteur_id: contexte.utilisateurId,
            repondu_le: new Date(),
            ...valeursDeLaSaisie(saisie),
          },
        });
      }

      // UNE RÉPONSE MODIFIÉE ANNULE SA VALIDATION (RG-INT-03, D135) — même
      // motif que `enregistrerRapportTexte` : la réponse fait partie de ce
      // qu'un responsable juge en validant le rapport.
      if (validees.length > 0) {
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
