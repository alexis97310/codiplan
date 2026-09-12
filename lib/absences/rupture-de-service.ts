/**
 * L'ALERTE DE RUPTURE DE SERVICE À EFFECTIF UNIQUE (L3-04a, RG-PLA-06, D106).
 *
 * ## CE QUE CE MODULE EST, ET SURTOUT CE QU'IL N'EST PAS
 *
 * **Il ne propose AUCUN créneau, et c'est une décision, pas une limite.** D106
 * l'a tranché avec deux raisons, et la seconde est celle qu'aucun moteur ne
 * rattrapera : *un moteur qui propose sur un effectif d'un ne propose rien* —
 * la règle décrit précisément le cas où il n'y a personne d'autre ; et *le
 * planificateur sait ce que le système ne saura jamais*, que ce client ferme en
 * août, que la pièce n'est pas arrivée, que celui-là peut attendre. **Une liste
 * qu'il replace utilise ce savoir ; une proposition automatique le contredit
 * avec un air d'autorité.**
 *
 * **Il ne lit ni base, ni horloge.** L'appelant fournit ce qu'il a observé sous
 * son contexte cloisonné, et c'est cette séparation qui rend la règle
 * éprouvable sans base fabriquée — la même forme que `periode.ts`.
 *
 * ## LA MAILLE EST L'AGENCE DE L'INTERVENTION, jamais la société
 *
 * D106 : *compter par société ferait taire l'alerte à Koné parce que Ducos a du
 * monde, et personne à Koné n'irait remplacer l'absent.* C'est la maille que I7
 * impose partout ailleurs.
 *
 * **Et c'est l'agence de l'INTERVENTION, pas celle de l'absent.** Les deux ne
 * coïncident pas : D112 autorise expressément qu'un technicien de Ducos soit
 * posé sur une intervention de Koné. *Ce qui se rompt est le service rendu
 * QUELQUE PART, et « quelque part » est l'endroit où l'intervention devait
 * avoir lieu.*
 *
 * ## TROIS VERDICTS, ET LE TROISIÈME EST CELUI QU'ON OUBLIE
 *
 * « Cette agence a du monde » et « je ne sais pas combien elle en a » ne se
 * corrigent pas au même endroit. Une agence dont l'effectif n'a pas été observé
 * rendrait, sous un verdict à deux valeurs, exactement ce que rend une agence
 * bien pourvue : **le silence**. *Et le silence a exactement la forme du
 * succès* (§9, 31/08) — ici, la forme d'un service qui tient.
 */

/** Une intervention rendue à la file, réduite à ce que la règle regarde. */
export type InterventionRendue = {
  readonly id: string;
  /** L'agence de l'INTERVENTION, jamais celle du technicien absent (D112). */
  readonly agenceId: string;
};

/** Ce que la règle prononce, agence par agence. */
export type VerdictRupture =
  | {
      readonly etat: "rupture";
      readonly agenceId: string;
      /** Les interventions rendues POUR CETTE AGENCE. Nommées, jamais comptées. */
      readonly interventions: readonly string[];
    }
  | {
      readonly etat: "effectif_suffisant";
      readonly agenceId: string;
      readonly effectif: number;
    }
  | { readonly etat: "effectif_inconnu"; readonly agenceId: string };

/**
 * Le verdict pour chaque agence touchée par le report.
 *
 * `effectifs` compte les techniciens **actifs** rattachés à l'agence,
 * **l'absent COMPRIS** : être absent quinze jours ne rend pas inactif, et c'est
 * bien « cette agence n'a qu'une personne » que la règle énonce. *Un effectif
 * dont on aurait retranché l'absent ferait de « un » un « zéro », et le seuil
 * de D106 — « un seul technicien actif » — cesserait de vouloir dire ce qu'il
 * dit.*
 *
 * L'ordre de sortie suit la première apparition de chaque agence dans la liste
 * rendue : *trier ici serait une seconde lecture de l'ordre que l'écran
 * affiche* — la leçon de `trajet.ts`.
 */
export function rupturesDeService(
  rendues: readonly InterventionRendue[],
  effectifs: ReadonlyMap<string, number>,
): readonly VerdictRupture[] {
  const parAgence = new Map<string, string[]>();
  for (const rendue of rendues) {
    const deja = parAgence.get(rendue.agenceId) ?? [];
    deja.push(rendue.id);
    parAgence.set(rendue.agenceId, deja);
  }

  const verdicts: VerdictRupture[] = [];
  for (const [agenceId, interventions] of parAgence) {
    const effectif = effectifs.get(agenceId);
    if (effectif === undefined) {
      verdicts.push({ etat: "effectif_inconnu", agenceId });
      continue;
    }
    if (effectif <= 1) {
      verdicts.push({ etat: "rupture", agenceId, interventions });
      continue;
    }
    verdicts.push({ etat: "effectif_suffisant", agenceId, effectif });
  }
  return verdicts;
}

/** Les seules agences en rupture — ce qu'un bandeau d'alerte affiche. */
export function ruptures(
  verdicts: readonly VerdictRupture[],
): readonly Extract<VerdictRupture, { etat: "rupture" }>[] {
  return verdicts.filter((v) => v.etat === "rupture");
}
