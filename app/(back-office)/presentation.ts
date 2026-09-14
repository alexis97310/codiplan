/**
 * CE QUE PLUSIEURS ÉCRANS DU BACK-OFFICE COMPOSENT, et qu'aucun ne peut
 * composer chez lui (14/09/2026).
 *
 * ## Pourquoi un module sans JSX
 *
 * Le gardien des chaînes visibles (L0-11) DÉDUIT les fichiers concernés — un
 * fichier qui contient du JSX est scanné **en entier**, variables comprises. Un
 * gabarit qui assemble deux clés du dictionnaire y est donc pris pour du texte
 * en dur, et *le gardien a raison de ne pas savoir faire la différence : ce
 * n'est pas le fichier qui est exempté, c'est une forme d'écriture.*
 *
 * ## Pourquoi ici plutôt que dans l'écran qui l'utilisait
 *
 * `ouTiret` vivait dans `sites/presentation.ts`. L'écran client en avait besoin
 * mot pour mot, et **le recopier aurait été une seconde écriture d'un même
 * critère** (§9, 01/09) : le jour où l'on décide qu'une absence s'écrit
 * autrement — un tiret cadratin, une mention —, les deux écrans divergeraient
 * sans que rien ne les confronte. *La seconde implémentation d'un critère n'est
 * jamais gratuite : on la remplace par un appel à la première.*
 *
 * `sites/presentation.ts` la RÉ-EXPORTE pour ses appelants existants : une
 * seule maison, et aucun appelant à réécrire.
 */

/**
 * CE QU'ON ÉCRIT LÀ OÙ UNE DONNÉE MANQUE — un tiret, jamais un zéro.
 *
 * *Un zéro dirait que la valeur vaut zéro ; une case vide dirait qu'on ne l'a
 * pas remplie.* Le tiret dit qu'il n'y a rien à dire, et c'est la troisième
 * chose — celle que D88 distingue sur le registre des VGP.
 *
 * **Il passe par une fonction et non par une constante employée dans le JSX** :
 * le gardien des chaînes visibles lit les enfants d'un élément, et il a raison
 * de ne pas savoir si `{x ?? TIRET}` rend une clé ou du texte.
 */
export function ouTiret(valeur: string | number | null): string {
  return valeur === null ? "—" : String(valeur);
}
