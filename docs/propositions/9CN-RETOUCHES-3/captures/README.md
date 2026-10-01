# Captures — 9CN-RETOUCHES-3

Ce ticket resserre trois preuves de tests déjà existantes (`sansCommentaires`, le `dd` de
`Fiche`, la sous-ligne d'agence du planning) et déplace `ouTravaille` de
`app/(back-office)/planning/page.tsx` vers `presentation.ts`, sans changer de règle de
gestion, de libellé ni de couleur. Le seul écran concerné est le planning (vue Semaine,
colonne Technicien avec son agence) — ces captures servent de preuve que le déplacement de
`ouTravaille` n'y change rien.

Prises par `tests/e2e/captures-9cn-retouches-3.spec.ts` (env `CAPTURES_9CN`), sans scène
forgée — le jeu de démonstration du seed suffit.

- `planning-semaine-agence-avant-*.png` — rejoué sur le code d'AVANT ce lot (`git worktree`
  sur le commit `9815a3d`, 9CN-RETOUCHES-3 — commit du `sansCommentaires`, le dernier avant
  le déplacement de `ouTravaille`).
- `planning-semaine-agence-apres-*.png` — après le commit `fc0b5a4` (9CN-RETOUCHES-3 —
  preuves du dd de Fiche et de l'agence du planning rendues).

Les deux paires sont identiques **au bit près** (`cmp`, exit 0) à 1280 et 375 px : le
déplacement de `ouTravaille` ne change rien à l'écran.
