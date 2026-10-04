import type { Prisma } from "@prisma/client";

import { annuaireDesPersonnes, type Annuaire } from "@/lib/auth/annuaire";
import { type PerimetrePlanning } from "@/lib/interventions/perimetre-technicien";
import { nomSeul } from "@/lib/interventions/personnes";
import { trierAlphanumeriquement } from "@/lib/tri/collation";

/**
 * CE QUE L'ÉCRAN DES BLOCAGES D'AGENDA A BESOIN DE SAVOIR (R3-14).
 *
 * ## Il LIT, il ne décide de rien
 *
 * Les décisions sont dans `depot.ts` — poser, lever — et la règle est dans
 * `periode.ts`. Ce module rassemble ce qu'une page affiche, sous le
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

/**
 * Une personne dont on peut bloquer l'agenda : un technicien ACTIF.
 *
 * **L'ORDRE EST CELUI DU NOM** (LISTES-1, TP-A6, 30/09/2026) — c'est ce
 * qu'affiche le `<select>` « Personne ». `agencesSansTechnicienDisponible`
 * (`app/(back-office)/absences/presentation.ts`) consomme aussi ce tableau et
 * range les agences en rupture par PREMIÈRE APPARITION : ce tri change donc
 * l'ordre des agences du KPI « Rupture de service » — un ordre qu'aucun test
 * ni aucune règle n'impose (l'alerte nomme les agences, elle ne les classe
 * pas), et que ce ticket a vérifié avant de trier ici plutôt qu'à l'écran.
 */
export type PersonneDeclarable = {
  readonly utilisateurId: string;
  readonly agenceId: string;
};

/** Ce qu'un écran de blocages lit en une fois. */
export type VueDesAbsences = {
  readonly absences: readonly {
    readonly id: string;
    readonly utilisateur_id: string;
    readonly du: Date;
    readonly au: Date;
  }[];
  readonly declarables: readonly PersonneDeclarable[];
  readonly annuaire: Annuaire;
};

/**
 * Les blocages d'une fenêtre, les personnes déclarables, et de quoi les nommer.
 *
 * **Les trois lectures sont faites ensemble**, sous la même transaction : les
 * noms que l'annuaire résoudra sont ceux des blocages ET ceux du référentiel.
 * *L'union est le sujet* — le planning a appris le 14/09 qu'une colonne gagnée
 * d'un côté perd son nom si l'autre moitié ne la connaît pas.
 */
export async function lireLesAbsences(
  tx: Prisma.TransactionClient,
  // `au: null` — AUCUNE BORNE HAUTE (TR-3, D136) : le tableau de `/absences`
  // montre désormais TOUTES les absences à venir, jamais seulement celles
  // des 90 prochains jours. La borne basse, elle, reste requise — `/absences`
  // ne devient pas un historique sans fin.
  fenetre: { readonly du: Date; readonly au: Date | null },
  // LE PÉRIMÈTRE PAR PERSONNE (QT-2, D152) — un technicien restreint
  // (`consulter_planning` ○) ne lit que SA PROPRE absence, jamais celle de
  // ses collègues : même modèle que `app/(back-office)/planning/page.tsx`
  // (lignes 279, 496-504), ici sur `absence.utilisateur_id` et
  // `technicien.utilisateur_id` plutôt que `intervention.technicien_id` —
  // `filtreDuPerimetre` ne convient pas, la colonne diffère. Sans défaut :
  // un appelant qui l'omettrait devrait le dire, jamais hériter d'un accès
  // complet en silence.
  perimetre: PerimetrePlanning,
): Promise<VueDesAbsences> {
  const filtrePersonne =
    perimetre.acces === "restreint"
      ? { utilisateur_id: perimetre.technicienId }
      : {};
  const absences = await tx.absence.findMany({
    where: {
      ...(fenetre.au === null ? {} : { du: { lte: fenetre.au } }),
      au: { gte: fenetre.du },
      ...filtrePersonne,
    },
    select: {
      id: true,
      utilisateur_id: true,
      du: true,
      au: true,
    },
    // L'ordre est TOTAL : sans le dernier rang, deux blocages du même jour se
    // rangeraient par la place physique des lignes.
    orderBy: [{ du: "desc" }, { utilisateur_id: "asc" }, { id: "asc" }],
  });
  const declarables = await tx.technicien.findMany({
    where: { actif: true, ...filtrePersonne },
    select: { utilisateur_id: true, agence_id: true },
  });
  const annuaire = await annuaireDesPersonnes(tx, [
    ...new Set([
      ...absences.map((a) => a.utilisateur_id),
      ...declarables.map((d) => d.utilisateur_id),
    ]),
  ]);
  // TRIÉES PAR NOM (LISTES-1, TP-A6-TRIS-MISE-EN-PAGE, 30/09/2026) — c'est ce
  // qu'affiche le `<select>` « Personne » de l'écran, JAMAIS `ORDER BY`
  // (`lib/tri/collation.ts`). `nomSeul` a besoin de l'annuaire déjà résolu
  // ci-dessus, donc ce tri ne peut être fait plus tôt.
  const declarablesTries = trierAlphanumeriquement(
    declarables,
    (d) => nomSeul(d.utilisateur_id, annuaire) ?? "",
    (d) => d.utilisateur_id,
  );
  return {
    absences,
    declarables: declarablesTries.map((d) => ({
      utilisateurId: d.utilisateur_id,
      agenceId: d.agence_id,
    })),
    annuaire,
  };
}

/**
 * LES INTERVENTIONS RENDUES À LA FILE, NOMMÉES.
 *
 * La pose a dit LESQUELLES ; cette lecture dit **comment elles s'appellent**,
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
 * a posé le blocage et déplanifié — avec l'effectif sous les yeux —, et cette
 * lecture ne fait que
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
