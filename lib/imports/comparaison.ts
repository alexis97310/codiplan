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
 * ## CINQ FORMES SONT COMPARABLES, ET TOUT LE RESTE REFUSE (R6-03, 9K29)
 *
 * *« Un verdict “inchangé” rendu sur une colonne qu'on ne sait pas comparer
 * autoriserait une écriture — ou une suppression — qu'on n'a pas vérifiée. »*
 * **C'est le sens de défaillance de L1-08j, et il reste le défaut** pour tout
 * ce qui n'est pas nommé ci-dessous : TEXTE, ENTIER, BOOLÉEN, `NULL`, et —
 * depuis 9K29, `prestation.types` — un TABLEAU DE TEXTES, comparé comme un
 * ENSEMBLE (ni l'ordre ni les doublons n'y portent de sens, `@@unique`
 * l'interdisant déjà en base). Sans cette cinquième forme, chaque réimport
 * d'un catalogue aux types inchangés aurait réécrit la table de relation à
 * l'identique — exactement le défaut mesuré en production que ce module
 * existe pour éviter (voir plus bas).
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
    if (Array.isArray(voulu)) {
      if (!Array.isArray(present)) return false;
      const voulus = new Set(voulu);
      const presents = new Set(present);
      if (voulus.size !== presents.size) return false;
      for (const valeur of voulus) {
        if (!presents.has(valeur)) return false;
      }
      return true;
    }
    return false;
  });
}

/**
 * REMPLACE, SUR CES CHAMPS, LA VALEUR PRÉPARÉE PAR CELLE DÉJÀ EN FICHE
 * (9L40, 25/11/2026) — jamais le défaut qu'un schéma de saisie pose quand
 * aucune cellule ne porte la colonne.
 *
 * **Une cellule vide ne remplace jamais une valeur existante.** Un gabarit
 * qui n'expose pas une colonne — `annee_fabrication`, avant ce ticket — rend
 * cette colonne TOUJOURS absente de la saisie préparée ; le schéma lui donne
 * alors son défaut Zod (souvent `null`), et l'écrire à chaque modification,
 * même motivée par une AUTRE colonne, efface silencieusement la valeur
 * saisie à la main. `champs` nomme les colonnes qu'aucune ligne de ce
 * gabarit ne peut jamais porter : pour elles, `avant` fait foi.
 *
 * Sans `champs`, rend `valeur` telle quelle — le régime de tout gabarit qui
 * n'a pas ce problème. **Appelée sur `ecrit` ET sur `comparaison`, avec le
 * même `avant`** : les deux doivent voir la même valeur, sans quoi
 * `porteEncore` comparerait une colonne à une valeur qu'on ne s'apprête plus
 * à écrire, et classerait « modifiée » une ligne qui ne l'est pas.
 */
export function conserverLesChampsAbsents<T extends Record<string, unknown>>(
  valeur: T,
  avant: FicheComparable,
  champs: readonly string[] | undefined,
): T {
  if (champs === undefined || champs.length === 0) return valeur;
  return {
    ...valeur,
    ...Object.fromEntries(champs.map((champ) => [champ, avant[champ]])),
  } as T;
}
