import { t } from "@/lib/i18n/fr";

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

/**
 * UN NOMBRE ET SON UNITÉ ACCORDÉE — jamais un « s » retranché (AT-07).
 *
 * Le singulier est une clé du dictionnaire, jamais calculé par troncature : le
 * français ne s'accorde pas ainsi, et une règle de morphologie écrite ici
 * serait une chaîne visible en dur (L0-11). Les DEUX libellés sont donc résolus
 * par l'appelant, exactement comme `decompte` de `parc/page.tsx` le fait déjà
 * pour son propre bandeau — cette version-ci sert les quatre écrans de liste
 * du back-office (clients, parc, sites, interventions) pour LEUR total filtré,
 * jamais pour un compte de page.
 */
export function decompte(
  nombre: number,
  un: string,
  plusieurs: string,
): string {
  return `${nombre} ${nombre === 1 ? un : plusieurs}`;
}

/**
 * « Page X sur Y » — composé ici, jamais dans le JSX d'un écran (AT-07).
 *
 * « Page » et « sur » ne dépendent d'aucune entité : ils vivent une seule fois
 * au dictionnaire (`pagination.page`, `pagination.sur`) plutôt que d'être
 * répétés dans chacun des quatre écrans qui paginent.
 */
export function libellePage(page: number, totalPages: number): string {
  return `${t("pagination.page")} ${page} ${t("pagination.sur")} ${totalPages}`;
}

/**
 * L'URL D'UNE AUTRE PAGE DE LA MÊME RECHERCHE — l'état vit dans l'URL, jamais
 * dans un composant (AT-07).
 *
 * `parametres` porte les filtres ACTIFS de l'écran appelant (texte, cases à
 * cocher, listes) — jamais `page`, qui est celui que cette fonction fixe. Un
 * lien vers la page 3 doit pouvoir se partager et rendre exactement la même
 * recherche : c'est ce qui interdit un état de composant ici.
 */
export function hrefDeLaPage(
  chemin: string,
  parametres: Readonly<Record<string, string | undefined>>,
  page: number,
): string {
  const recherche = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(parametres)) {
    if (valeur !== undefined && valeur.length > 0) {
      recherche.set(cle, valeur);
    }
  }
  recherche.set("page", String(page));
  return `${chemin}?${recherche.toString()}`;
}
