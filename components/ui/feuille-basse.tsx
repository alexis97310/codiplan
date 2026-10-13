/**
 * LA FEUILLE BASSE, AU TÉLÉPHONE (QE-6c, 9DV-TP-NAV4-TELEPHONE-GLOSSAIRE,
 * décision 9 du pilote du 03/10/2026, D172) — les dialogues de confirmation
 * s'ouvrent collés au bas de l'écran sous 901 px, et restent centrés au-
 * dessus de ce seuil : « même composant, même comportement ».
 *
 * **UNE SEULE CHAÎNE DE CLASSES, PARTAGÉE** — `bouton-confirmation.tsx` et
 * `components/planning/transmettre-demain.tsx` l'appliquent tous deux au
 * même `<dialog>` natif ; une chaîne recopiée deux fois diverge en silence
 * le jour où l'une des deux change (§9, 01/09).
 *
 * **JAMAIS `fenetre-pose.tsx`** — cette fenêtre a déjà son propre traitement
 * mobile, PLEIN ÉCRAN sous 900 px, décidé par D146 (spécification §4,
 * PG-D4-TELEPHONE-ONGLETS) : un formulaire de pose, pas une confirmation, et
 * une décision déjà rendue sur ce point précis ne se réécrit pas en
 * silence depuis ce lot-ci (voir sa passation).
 *
 * **LONGHAND `top`/`right`/`bottom`/`left`, JAMAIS `inset-*`** : les deux
 * variantes (téléphone par défaut, bureau sous `min-[901px]:`) posent CHACUNE
 * les quatre côtés par leur propre nom de propriété — le même nom,
 * ré-affecté sous la variante — pour que la media query l'emporte sans
 * dépendre de l'ordre dans lequel Tailwind range `inset-x-*` et `inset-0`
 * dans la feuille compilée.
 *
 * **`max-w-none`/`max-h-[90dvh]`, NEUTRALISENT LE PLAFOND DU NAVIGATEUR SOUS
 * 901 px** (9EWB1-FEUILLE-BASSE-375-MENU-PLUS) — la feuille de styles du
 * navigateur impose `dialog:modal { max-width: calc(100% - 6px - 2em) }`
 * (337 px à 375 px) : rien, avant ce lot, ne la neutralisait. Même procédé
 * que `top`/`right`/`bottom`/`left` ci-dessus — chaque propriété reposée sous
 * `min-[901px]:` pour revenir au plafond natif au-dessus de ce seuil, dont
 * `min-[901px]:max-w-sm`/`lg`, posé par chaque appelant, n'a jamais eu besoin
 * d'être neutralisé puisqu'il s'applique déjà APRÈS le `max-w-none` d'ici.
 */
export const CLASSES_FEUILLE_BASSE =
  "fixed top-auto right-0 bottom-0 left-0 m-0 w-full max-w-none max-h-[90dvh] overflow-y-auto rounded-t-2xl border p-4 shadow-lg backdrop:bg-app-encre/40 " +
  "min-[901px]:top-1/2 min-[901px]:right-auto min-[901px]:bottom-auto min-[901px]:left-1/2 min-[901px]:w-fit min-[901px]:max-h-[calc(100%-6px-2em)] min-[901px]:overflow-visible min-[901px]:-translate-x-1/2 min-[901px]:-translate-y-1/2 min-[901px]:rounded-lg";
