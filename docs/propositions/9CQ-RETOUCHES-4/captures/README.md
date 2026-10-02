# Captures — 9CQ-RETOUCHES-4

Ce ticket ne touche aucun écran de production : il resserre quatre gardiens de tests
(priorité, focus, `sansCommentaires`, trois copies locales retirées). Ces captures du
tableau de bord servent de preuve que rien n'y a bougé.

Prises par `tests/e2e/captures-9cq-retouches-4.spec.ts` (env `CAPTURES_9CQ`), sans scène
forgée — le jeu de démonstration du seed suffit.

- `tableau-de-bord-avant-*.png` — rejoué sur le code d'AVANT ce lot (`git worktree` sur le
  commit `d80157b`, 9CP-PG-G14B-TRANSMETTRE-GROUPE — passation, le dernier commit avant ce
  lot).
- `tableau-de-bord-apres-*.png` — après les deux commits de code de ce lot (`9bed687` —
  gardiens de priorité et de focus ; `1510292` — `sansCommentaires` et copies locales
  retirées).

Les deux paires sont identiques **au bit près** (`cmp`, exit 0) à 1280 et 375 px : aucun
écran ne bouge.
