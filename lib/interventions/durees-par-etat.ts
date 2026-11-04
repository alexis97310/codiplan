/**
 * LE TEMPS PASSÉ DANS CHAQUE ÉTAT (9J08A-HISTORIQUE-DES-ETATS) — calcul pur,
 * à partir des lignes d'`intervention_statut_historique` ou
 * `demande_statut_historique` (même forme pour les deux, d'où la fonction
 * générique sur `Statut`).
 *
 * **Ce module ne lit ni la base ni le fuseau.** Il reçoit des `Date` déjà
 * triées par ordre croissant de `change_le`, et « maintenant » comme un
 * paramètre explicite — jamais `new Date()` à l'intérieur, pour que le calcul
 * reste reproductible dans ses épreuves.
 *
 * ## Sans reprise du passé — ce que « incomplet » veut dire
 *
 * La migration ne reconstitue aucune ligne pour le passé (décision d'Alexis
 * du 29/10/2026, option A). Une intervention née avant le déploiement n'a
 * donc pas de ligne « création » (`statut_avant` NULL) : sa PREMIÈRE ligne
 * connue porte un `statut_avant` non nul, et tout le temps passé AVANT cette
 * ligne est perdu — pas « zéro », *inconnu*. Deux cas distincts :
 *   — l'historique est VIDE : rien n'est connu, pas même la date d'entrée
 *     dans l'état courant (`depuisLe` vaut `null`, `dureeEnCoursMs` aussi) ;
 *   — l'historique a au moins une ligne mais sa première porte un
 *     `statut_avant` non nul : tout ce qui suit cette ligne est fiable,
 *     `depuisLe` vaut la date de cette première ligne.
 */

export type LigneHistoriqueEtat<Statut extends string> = {
  readonly statutAvant: Statut | null;
  readonly statutApres: Statut;
  readonly changeLe: Date;
};

export type DureesParEtat<Statut extends string> = {
  /** Le temps cumulé passé dans chaque état TRAVERSÉ, en millisecondes. */
  readonly dureesCumuleesMs: ReadonlyMap<Statut, number>;
  readonly etatCourant: Statut;
  /** `null` seulement quand l'historique est vide — voir l'en-tête du module. */
  readonly dureeEnCoursMs: number | null;
  /** L'historique ne remonte pas à la création de l'intervention/demande. */
  readonly historiqueIncomplet: boolean;
  /** La première date connue — `null` seulement si l'historique est vide. */
  readonly depuisLe: Date | null;
};

/**
 * `historique` DOIT être trié par `changeLe` croissant — ce module ne trie
 * pas lui-même : trier est la responsabilité de la requête qui le pose
 * (`ORDER BY change_le`, déjà l'index de la migration).
 */
export function dureesParEtat<Statut extends string>(
  historique: readonly LigneHistoriqueEtat<Statut>[],
  statutActuel: Statut,
  maintenant: Date,
): DureesParEtat<Statut> {
  if (historique.length === 0) {
    return {
      dureesCumuleesMs: new Map(),
      etatCourant: statutActuel,
      dureeEnCoursMs: null,
      historiqueIncomplet: true,
      depuisLe: null,
    };
  }

  const dureesCumuleesMs = new Map<Statut, number>();
  for (let index = 0; index < historique.length; index += 1) {
    const ligne = historique[index]!;
    const fin = historique[index + 1]?.changeLe ?? maintenant;
    const duree = fin.getTime() - ligne.changeLe.getTime();
    dureesCumuleesMs.set(
      ligne.statutApres,
      (dureesCumuleesMs.get(ligne.statutApres) ?? 0) + duree,
    );
  }

  const premiere = historique[0]!;
  const derniere = historique[historique.length - 1]!;

  return {
    dureesCumuleesMs,
    etatCourant: statutActuel,
    dureeEnCoursMs: maintenant.getTime() - derniere.changeLe.getTime(),
    historiqueIncomplet: premiere.statutAvant !== null,
    depuisLe: premiere.changeLe,
  };
}
