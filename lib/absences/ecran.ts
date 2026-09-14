import type { Prisma } from "@prisma/client";

import { annuaireDesPersonnes, type Annuaire } from "@/lib/auth/annuaire";

/**
 * CE QUE L'ÉCRAN DES ABSENCES A BESOIN DE SAVOIR (R3-14).
 *
 * ## Il LIT, il ne décide de rien
 *
 * Les décisions sont dans `depot.ts` — déclarer, valider, refuser — et la règle
 * est dans `periode.ts`. Ce module rassemble ce qu'une page affiche, sous le
 * contexte cloisonné, et rien de plus. *Recalculer ici ce que la décision a
 * rendu serait une seconde lecture d'un même critère* (§9, 01/09).
 *
 * ## Les personnes viennent de l'ANNUAIRE, et sa somme est conservée
 *
 * `nomsDesPersonnes` rend une `Map`, qui n'a qu'une façon de ne pas répondre.
 * L'annuaire, lui, distingue *« la politique refuse »* — légitime — de *« je
 * n'ai pas demandé »* — une anomalie. Les deux ne se corrigent pas au même
 * endroit, et l'écran ne les affiche pas de la même façon.
 */

/** Une personne que l'on peut déclarer absente : un technicien ACTIF. */
export type PersonneDeclarable = {
  readonly utilisateurId: string;
  readonly agenceId: string;
};

/** Ce qu'un écran d'absences lit en une fois. */
export type VueDesAbsences = {
  readonly absences: readonly {
    readonly id: string;
    readonly utilisateur_id: string;
    readonly du: Date;
    readonly au: Date;
    readonly statut: string;
  }[];
  readonly declarables: readonly PersonneDeclarable[];
  readonly annuaire: Annuaire;
};

/**
 * Les absences d'une fenêtre, les personnes déclarables, et de quoi les nommer.
 *
 * **Les trois lectures sont faites ensemble**, sous la même transaction : les
 * noms que l'annuaire résoudra sont ceux des absences ET ceux du référentiel.
 * *L'union est le sujet* — le planning a appris le 14/09 qu'une colonne gagnée
 * d'un côté perd son nom si l'autre moitié ne la connaît pas.
 */
export async function lireLesAbsences(
  tx: Prisma.TransactionClient,
  fenetre: { readonly du: Date; readonly au: Date },
): Promise<VueDesAbsences> {
  const absences = await tx.absence.findMany({
    where: { du: { lte: fenetre.au }, au: { gte: fenetre.du } },
    select: {
      id: true,
      utilisateur_id: true,
      du: true,
      au: true,
      statut: true,
    },
    // L'ordre est TOTAL : sans le dernier rang, deux absences du même jour se
    // rangeraient par la place physique des lignes.
    orderBy: [{ du: "desc" }, { utilisateur_id: "asc" }, { id: "asc" }],
  });
  const declarables = await tx.technicien.findMany({
    where: { actif: true },
    select: { utilisateur_id: true, agence_id: true },
    orderBy: { utilisateur_id: "asc" },
  });
  const annuaire = await annuaireDesPersonnes(tx, [
    ...new Set([
      ...absences.map((a) => a.utilisateur_id),
      ...declarables.map((d) => d.utilisateur_id),
    ]),
  ]);
  return {
    absences,
    declarables: declarables.map((d) => ({
      utilisateurId: d.utilisateur_id,
      agenceId: d.agence_id,
    })),
    annuaire,
  };
}

/**
 * LES INTERVENTIONS RENDUES À LA FILE, NOMMÉES.
 *
 * La décision a dit LESQUELLES ; cette lecture dit **comment elles s'appellent**,
 * et rien d'autre. Elle ne rejuge rien : un identifiant qui ne serait pas de la
 * société active ne rend simplement aucune ligne, la politique décidant.
 *
 * *Un décompte ne dit pas lesquelles* (§9, 06/09), et c'est précisément ce que
 * le planificateur doit voir pour les reposer.
 */
export async function nommerLesInterventions(
  tx: Prisma.TransactionClient,
  identifiants: readonly string[],
): Promise<readonly { readonly id: string; readonly numero: number | null }[]> {
  if (identifiants.length === 0) {
    return [];
  }
  return tx.intervention.findMany({
    where: { id: { in: [...identifiants] } },
    select: { id: true, numero: true },
    orderBy: { id: "asc" },
  });
}

/**
 * LES AGENCES OÙ LE SERVICE EST ROMPU, NOMMÉES.
 *
 * Même partage : `rupturesDeService` a rendu le VERDICT dans la transaction qui
 * a déplanifié — avec l'effectif sous les yeux —, et cette lecture ne fait que
 * lui donner un libellé. La recalculer ici demanderait de relire l'effectif sous
 * un autre contexte, c'est-à-dire de décider deux fois.
 */
export async function nommerLesAgences(
  tx: Prisma.TransactionClient,
  identifiants: readonly string[],
): Promise<readonly { readonly id: string; readonly libelle: string }[]> {
  if (identifiants.length === 0) {
    return [];
  }
  return tx.agence.findMany({
    where: { id: { in: [...identifiants] } },
    select: { id: true, libelle: true },
    orderBy: { libelle: "asc" },
  });
}
