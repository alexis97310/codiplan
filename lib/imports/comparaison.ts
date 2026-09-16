/**
 * LA FICHE PORTE-T-ELLE ENCORE CE QU'UNE SAISIE DÉCLARE (L1-08j ; §9, 01/09) ?
 *
 * **Deux appelants posent la MÊME question, à deux moments distincts** :
 * `lib/imports/annulation.ts` la pose APRÈS l'écriture — « la fiche
 * porte-t-elle encore ce que l'import y a écrit, ou quelqu'un est-il passé
 * après ? » — et `lib/imports/application.ts` la pose AVANT — « la fiche
 * porte-t-elle DÉJÀ ce que la ligne s'apprête à écrire ? ». *C'est la même
 * comparaison, lue dans les deux sens* : une seconde implémentation aurait
 * divergé en silence au premier champ qu'on oublie d'un côté (§9, 01/09), et
 * c'est pourquoi elle vit ici, seule, appelée par les deux.
 */

/** Une fiche telle qu'un `SELECT` la rend — assez pour être comparée. */
export type FicheComparable = Readonly<Record<string, unknown>>;

/**
 * La fiche porte-t-elle CES valeurs, sur CES champs ?
 *
 * ## QUATRE FORMES SONT COMPARABLES, ET TOUT LE RESTE REFUSE (R6-03)
 *
 * *« Un verdict “inchangé” rendu sur une colonne qu'on ne sait pas comparer
 * autoriserait une écriture — ou une suppression — qu'on n'a pas vérifiée. »*
 * **C'est le sens de défaillance de L1-08j, et il reste le défaut** pour tout
 * ce qui n'est pas nommé ci-dessous : TEXTE, ENTIER, BOOLÉEN, et `NULL`.
 *
 * `null` VOULU se compare à `null` PRÉSENT, et c'est une écriture au même
 * titre qu'une valeur : *le confondre avec « rien n'a été dit » (`undefined`)
 * ferait juger identique une fiche dont une colonne vient d'être effacée, ou
 * inversement écraser une colonne qu'on vient de renseigner.*
 *
 * Un champ ABSENT de `attendu` (`undefined`) n'est pas une promesse : *rien
 * n'a été dit sur lui*, et le comparer à `null` ferait dépendre le verdict
 * d'un défaut de schéma plutôt que d'une écriture. Il compte donc comme
 * « porté », dans les deux sens de lecture — ce que l'écriture ne touche pas,
 * elle n'a rien à en dire.
 */
export function porteEncore(
  fiche: FicheComparable,
  attendu: Readonly<Record<string, unknown>>,
  champs: readonly string[],
): boolean {
  return champs.every((champ) => {
    const voulu = attendu[champ];
    if (voulu === undefined) return true;
    const present = fiche[champ];
    if (voulu === null) return present === null;
    if (typeof voulu === "number") {
      return typeof present === "number" && present === voulu;
    }
    if (typeof voulu === "string") {
      return typeof present === "string" && present === voulu;
    }
    if (typeof voulu === "boolean") {
      return typeof present === "boolean" && present === voulu;
    }
    return false;
  });
}
