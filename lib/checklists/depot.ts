import { randomUUID } from "node:crypto";

import {
  type Prisma,
  type PrismaClient,
  type TypeIntervention,
} from "@prisma/client";

import { type ContexteSession, exigerContexteActif } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

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
