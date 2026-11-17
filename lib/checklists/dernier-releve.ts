/**
 * LE DERNIER RELEVÉ DE CHAQUE POINT CHIFFRÉ, SUR UNE AUTRE MACHINE
 * (9L08F-CHECKLIST-DERNIER-RELEVE, décisions d'Alexis du 11/11 et du
 * 16/11/2026) — RELEVÉ SEUL, AUCUNE TOLÉRANCE, AUCUN VERDICT. Pure logique
 * d'appariement, séparée de `lib/checklists/depot.ts` qui lit la base :
 * testable sans transaction Prisma, même patron que `lib/checklists/
 * completude.ts`.
 *
 * ## LA CLÉ DE CORRESPONDANCE — SECTION + LIBELLÉ, PAS `checklist_point.id`
 *
 * `checklist_point.id` change à CHAQUE nouvelle version de modèle (une
 * version récrit tous ses points) : deux interventions qui ont résolu deux
 * versions différentes du même modèle n'ont jamais le même `id` pour « le
 * même » point. `checklist_reponse`, elle, RECOPIE `libelle` et `section` du
 * point au moment de la réponse (D235) — c'est la clé la plus stable déjà
 * disponible, sans rouvrir `ChecklistPoint` d'une autre version.
 *
 * Deux limites connues, assumées (passation du lot) :
 * - un point RENOMMÉ entre deux versions perd son historique : aucune clé
 *   ne correspond plus, le relevé précédent disparaît silencieusement ;
 * - une machine dont le MODÈLE de matériel change garde quand même son
 *   relevé si le libellé/section du point survit au changement — rien ici
 *   ne borne par modèle, seulement par machine (voir l'appelant).
 */

export type ReleveHistorique = {
  readonly libelle: string;
  readonly section: string;
  readonly valeurMesuree: number;
  readonly unite: string | null;
  readonly reponduLe: Date;
};

export type DernierReleve = {
  readonly valeur: number;
  readonly unite: string | null;
  readonly date: Date;
};

/** La clé d'appariement — jamais recomposée deux fois autrement (§9, 01/09). */
export function cleDuPointReleve(section: string, libelle: string): string {
  return `${section}\u0000${libelle}`;
}

/**
 * `releves` DOIT déjà être trié par `reponduLe` DÉCROISSANT (l'appelant le
 * fait, via la requête). Cette fonction garde la PREMIÈRE occurrence de
 * chaque clé — donc la plus récente — jamais un second tri ici.
 */
export function dernierReleveParCle(
  releves: readonly ReleveHistorique[],
): ReadonlyMap<string, DernierReleve> {
  const parCle = new Map<string, DernierReleve>();
  for (const releve of releves) {
    const cle = cleDuPointReleve(releve.section, releve.libelle);
    if (!parCle.has(cle)) {
      parCle.set(cle, {
        valeur: releve.valeurMesuree,
        unite: releve.unite,
        date: releve.reponduLe,
      });
    }
  }
  return parCle;
}
