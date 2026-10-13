# 9EWB1-FEUILLE-BASSE-375-MENU-PLUS — passation

## Ce qui était cassé

À 375 px, le `<dialog>` natif qui porte la feuille basse (`CLASSES_FEUILLE_BASSE`,
`components/ui/feuille-basse.tsx`) restait plafonné par la feuille de styles du
navigateur (`dialog:modal { max-width: calc(100% - 6px - 2em) }`, soit 337 px
sur 375) — rien ne le neutralisait. Le pied débordait à gauche, et le menu
« ⋯ » (`components/ui/menu-plus.tsx`), ancré `right-0` sans contrepartie sous
901 px, s'ouvrait hors écran quand son bouton est près du bord gauche de
l'en-tête.

## Ce qui a changé

1. **`CLASSES_FEUILLE_BASSE`** neutralise désormais le plafond natif sous
   901 px (`max-w-none`, `max-h-[90dvh]`, `overflow-y-auto`) et le restaure
   au-dessus (`min-[901px]:max-h-[calc(100%-6px-2em)]`,
   `min-[901px]:overflow-visible`) — comportement inchangé au-dessus de
   900 px. Le pied de `components/ui/dialogue.tsx` passe en `flex-wrap`, en
   filet de sécurité si un pied porte un jour trois boutons.
2. **Le menu « ⋯ »** s'ancre à gauche de son bouton sous 901 px, avec une
   largeur bornée à `calc(100vw - 2rem)` ; comportement inchangé au-dessus.
3. **Une épreuve e2e neuve** (`tests/e2e/9ewb1-feuille-basse-375-menu-plus.spec.ts`,
   scène `zz9EWB1-`) mesure au pixel, à 375 et 1280 px, la boîte de chaque
   dialogue en feuille basse atteignable depuis la fiche, du menu « ⋯ », d'un
   `BoutonAvecConfirmation` (`/absences`) et de « Transmettre demain »
   (`/planning`).

## Le second débordement, trouvé en faisant tourner l'épreuve

En ajoutant « Transmettre demain » à l'épreuve, un débordement DISTINCT des
points 1 et 2 est apparu : `[&_button]:w-full`, posé dans
`app/(back-office)/planning/page.tsx` sur le `<span>` qui entoure le bouton
déclencheur mobile de `DialogueTransmettreDemain`, est un sélecteur de
DESCENDANT — il élargissait, via `shrink-0` (`components/ui/button.tsx`,
qui empêche tout bouton de rétrécir), CHAQUE bouton du pied du `<dialog>`
que ce même composant ouvre, le `<dialog>` restant un descendant DOM de ce
`<span>` malgré son rendu en couche supérieure (mesuré : le bouton
« Fermer » à x=-332 sur 375 px, les deux boutons du pied forcés chacun à
100 % de la largeur du dialogue dans un pied non `flex-wrap`). Changé en
`[&>button]:w-full` (enfant DIRECT) : seul le bouton déclencheur, réellement
enfant direct de ce `<span>`, reste visé ; les boutons du dialogue, petits-
enfants ou plus profonds, ne le sont plus. Ce fichier n'était pas dans le
territoire annoncé par le ticket ; le correctif y est resté strictement
d'un caractère (`_` → `>`), sans toucher à la largeur voulue du déclencheur
ni à rien au-dessus de 900 px.

## Points ouverts

- **Le défilement interne du corps, pied toujours visible** (suggéré par le
  point 1 — « avec défilement interne du corps — le pied reste visible »)
  n'est PAS implémenté à la lettre : `max-h-[90dvh] overflow-y-auto` fait
  défiler le `<dialog>` TOUT ENTIER (titre compris), pas seulement son corps,
  si son contenu dépasse 90 % de la hauteur de l'écran. Épingler le pied
  exigerait de transformer chaque consommateur de `CLASSES_FEUILLE_BASSE`
  (`Dialogue`, `BoutonAvecConfirmation`, `DialogueTransmettreDemain`) en
  `flex flex-col` avec son propre corps `overflow-y-auto flex-1` — hors du
  territoire de ce lot (`dialogue.tsx` n'y est cité que pour son pied). Aucun
  dialogue mesuré aujourd'hui n'approche 90 % de la hauteur d'un écran de
  900 px ; à surveiller si un futur dialogue porte un corps plus long.
- **Le correctif `[&>button]:w-full`** touche un fichier hors du territoire
  annoncé (`app/(back-office)/planning/page.tsx`) — nécessaire pour que
  « Transmettre demain », explicitement cité au point 3, ne déborde plus.
  Voir la section ci-dessus pour la justification complète.
