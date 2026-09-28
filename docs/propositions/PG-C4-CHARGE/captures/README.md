# Captures — PG-C4-CHARGE

Prises par `9BJA-REPRISE-9BJ` (29/09/2026) : 9BJ avait livré PG-C4-CHARGE sans les prendre
(passation de 9BJ, « Ce que je n'ai PAS fait »). Même recette que les autres captures AVANT/APRÈS
du dépôt (`tests/e2e/captures-pg-c4-charge.spec.ts`, env `CAPTURES_PG_C4`) : rien n'est écrit sans
une variable d'environnement qui nomme le dossier, et AVANT/APRÈS se prend en rejouant ce même
fichier deux fois — une fois sur le code d'avant le ticket (`git worktree` sur le commit
`940cc53`, le dernier avant la branche `9BJ-PG-G10-CARTES-CHARGE-garde`), une fois sur le code
livré (commit `cc806ac`, 29/09/2026).

Scène de DÉMONSTRATION seulement (consigne du ticket de reprise) : aucune donnée forgée, la
semaine courante du jeu de démonstration (`prisma/seed.ts`).

- `colonne-technicien-barres-avant-1280.png` / `colonne-technicien-barres-apres-1280.png` — la
  colonne « Technicien » et les cases de la grille, à 1280 px. AVANT : le pourcentage compact sous
  chaque nom (« 29 % », « 28 % », « 105 % ») existait déjà (D111, avant ce lot) ; AUCUNE barre
  n'apparaît dans les cases. APRÈS : une fine barre bleue au bas de chaque case qui porte une
  charge ce jour-là, proportionnelle au taux DE CE JOUR (jamais celui de la semaine) — c'est le
  point 2 de PG-C4-CHARGE que 9BJ n'avait pas fait (« demande un dénominateur PAR JOUR », passation
  de 9BJ, « Ce qui reste à faire »). La barre de M. Poigoune (105 % sur la semaine, agence
  surchargée) reste bleue jour par jour dans cette scène de démonstration : aucun jour pris
  isolément n'y dépasse `TAUX_PLEIN` — le seuil de rougissement existe (`barreChargeDuJour`,
  `carte.ts`) mais n'est pas illustré par CETTE scène.
- `colonne-technicien-barres-avant-375.png` / `colonne-technicien-barres-apres-375.png` — même
  écran à 375 px : sous `lg`, c'est `ListeSemaine` (la liste téléphone) qui remplace la grille et
  ses cases — elle ne porte ni la colonne « Technicien » ni les barres par jour, territoire de la
  grille `lg` seulement (même limite que `TauxCompactAffiche`, déjà posée avant ce lot). Les deux
  captures sont donc proches ; la différence est dans le contenu des cartes (commune ajoutée,
  point 4b).

**Le panneau « Charge par technicien » reste**, repliable, avec ses deux termes et sa formule
(D107/D111) — visible identiquement aux deux états sur ces captures, en bas de la grille.
