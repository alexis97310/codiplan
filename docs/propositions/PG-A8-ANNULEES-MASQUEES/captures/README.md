# Captures — PG-A8-ANNULEES-MASQUEES

Le planning (`/planning?vue=semaine&semaine=2026-09-21`), sur deux interventions ANNULÉES
forgées par `tests/e2e/captures-pg-a8-annulees-masquees.spec.ts` (env `CAPTURES_PG_A8`, préfixe
`PGA8CAP-`, supprimées en fin d'épreuve) — jamais une fixture `SCENE.*` partagée : l'une sans
date (file « À planifier »), l'autre datée le jeudi 24/09 (grille, colonne D. Guérin).

- `decoche-*.png` — sans `?annulees=1` : le bouton « Afficher les annulées » est visible mais
  non actif.
- `coche-*.png` — avec `?annulees=1` : le bouton est actif (fond plein).

`avant/` : rejoué sur le code d'avant ce ticket (le commit `0fdfa79`, PG-A5-FICHE-CRENEAU —
captures avant/apres du resume, le dernier avant ce lot) — les DEUX captures sont IDENTIQUES :
`listerPlanning` ne filtrait aucun statut, la carte annulée reste dans la file (5 dossiers) et sur
la grille, barrée, qu'`annulees=1` soit présent ou non.

`apres/` : après le commit `PG-A8-ANNULEES-MASQUEES` — `decoche` masque la carte (4 dossiers, la
grille sans la case barrée) ; `coche` la remontre à l'identique de l'AVANT, et le bouton se lit
actif.

À 1280 et 375 px.
