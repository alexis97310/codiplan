import type { TypeIntervention } from "@/lib/interventions/saisie";

/**
 * LA CASCADE DE RÉSOLUTION DU GABARIT (9K18-CHECKLIST-DOMAINE) — décision
 * d'Alexis du 10/11/2026 (reprise dans la passation de 9K17A-MATERIEL-SOUS-
 * TYPE) : « nature d'intervention, puis MODÈLE exact (l'exception), puis
 * SOUS-TYPE (la règle), puis FAMILLE, puis générique ».
 *
 * FONCTION PURE : aucune base, aucun Prisma — le dépôt (`depot.ts`) lit les
 * candidats ACTIFS de la société et la machine éventuellement portée, et
 * cette fonction se contente de choisir PARMI eux.
 *
 * ## LE FILTRE PAR NATURE VIENT D'ABORD, ET IL EST À PART DES QUATRE NIVEAUX
 *
 * `type_intervention` est une colonne INDÉPENDANTE du triplet modèle / sous-
 * type / famille (au plus un des trois, par la contrainte de base posée en
 * 9K17A) : un candidat dont la nature est renseignée et NE correspond PAS à
 * celle de l'intervention est exclu d'emblée, quel que soit son niveau de
 * rattachement matériel. Un candidat dont la nature est `null` est UNIVERSEL
 * — il passe le filtre pour toute nature.
 *
 * ## CINQ NIVEAUX, DU PLUS AU MOINS PRÉCIS
 *
 * 1. `modele` — le candidat vise le MODÈLE DE MATÉRIEL exact de la machine
 *    portée (l'EXCEPTION).
 * 2. `sous_type` — le candidat vise le SOUS-TYPE de ce modèle (la RÈGLE). Un
 *    modèle de matériel SANS sous-type (`sousTypeId` nul dans le contexte) ne
 *    peut jamais matcher un candidat de ce niveau — aucun candidat de ce
 *    niveau ne porte `sousTypeId: null` (la contrainte de base l'empêche) —,
 *    si bien que la résolution passe DIRECTEMENT au niveau famille, sans
 *    qu'aucun cas spécial ne soit écrit ici.
 * 3. `famille` — le candidat vise la FAMILLE de ce modèle.
 * 4. `type_seul` — le candidat ne vise aucun niveau matériel, mais une nature
 *    précise (qui a donc déjà été confrontée au filtre ci-dessus).
 * 5. `generique` — le candidat ne vise ni matériel ni nature : le filet
 *    universel.
 *
 * `exige_machine` est appliqué AVANT le classement : un candidat qui l'exige
 * et qu'aucune machine n'est portée (`machinePortee: false`) est exclu,
 * quel que soit son niveau.
 *
 * ## À ÉGALITÉ DE NIVEAU — LE CODE, PAR ORDRE ALPHABÉTIQUE
 *
 * *Une lecture qui dépendrait de l'ordre rendu par la base ne serait pas une
 * règle, ce serait un hasard répété* (§9) — `code` est unique par société
 * (`@@unique([societe_id, code])`), donc toujours discriminant. Arbitrage
 * D239.
 */
export type ProvenanceGabarit =
  "modele" | "sous_type" | "famille" | "type_seul" | "generique";

/** Un candidat tel que le dépôt le lit — les modèles ACTIFS de la société. */
export type CandidatGabarit = {
  readonly checklistModeleId: string;
  readonly code: string;
  readonly typeIntervention: TypeIntervention | null;
  readonly modeleId: string | null;
  readonly sousTypeId: string | null;
  readonly familleId: string | null;
  readonly exigeMachine: boolean;
};

/** Ce que la machine portée (s'il y en a une) donne à la cascade. */
export type ContexteResolutionGabarit = {
  readonly typeIntervention: TypeIntervention;
  readonly machinePortee: boolean;
  readonly modeleId: string | null;
  readonly sousTypeId: string | null;
  readonly familleId: string | null;
};

export type GabaritResolu = {
  readonly checklistModeleId: string;
  readonly provenance: ProvenanceGabarit;
};

const RANG: Readonly<Record<ProvenanceGabarit, number>> = {
  modele: 1,
  sous_type: 2,
  famille: 3,
  type_seul: 4,
  generique: 5,
};

/** Le niveau de CE candidat pour CE contexte — `null` s'il ne matche aucun niveau. */
function niveauDuCandidat(
  candidat: CandidatGabarit,
  contexte: ContexteResolutionGabarit,
): ProvenanceGabarit | null {
  if (candidat.modeleId !== null) {
    return candidat.modeleId === contexte.modeleId ? "modele" : null;
  }
  if (candidat.sousTypeId !== null) {
    return candidat.sousTypeId === contexte.sousTypeId ? "sous_type" : null;
  }
  if (candidat.familleId !== null) {
    return candidat.familleId === contexte.familleId ? "famille" : null;
  }
  // Aucun rattachement matériel : la nature seule porte le niveau — déjà
  // confrontée au filtre `passeLeFiltreDeNature` avant d'arriver ici.
  return candidat.typeIntervention !== null ? "type_seul" : "generique";
}

function passeLeFiltreDeNature(
  candidat: CandidatGabarit,
  contexte: ContexteResolutionGabarit,
): boolean {
  return (
    candidat.typeIntervention === null ||
    candidat.typeIntervention === contexte.typeIntervention
  );
}

/** Résout le gabarit applicable, ou `null` si aucun candidat ne convient. */
export function resoudreGabarit(
  contexte: ContexteResolutionGabarit,
  candidats: readonly CandidatGabarit[],
): GabaritResolu | null {
  const eligibles = candidats
    .filter((candidat) => passeLeFiltreDeNature(candidat, contexte))
    .filter((candidat) => !candidat.exigeMachine || contexte.machinePortee)
    .map((candidat) => ({
      candidat,
      niveau: niveauDuCandidat(candidat, contexte),
    }))
    .filter(
      (
        entree,
      ): entree is { candidat: CandidatGabarit; niveau: ProvenanceGabarit } =>
        entree.niveau !== null,
    );

  if (eligibles.length === 0) {
    return null;
  }

  eligibles.sort((a, b) => {
    const parRang = RANG[a.niveau] - RANG[b.niveau];
    return parRang !== 0
      ? parRang
      : a.candidat.code.localeCompare(b.candidat.code);
  });

  const meilleur = eligibles[0]!;
  return {
    checklistModeleId: meilleur.candidat.checklistModeleId,
    provenance: meilleur.niveau,
  };
}
