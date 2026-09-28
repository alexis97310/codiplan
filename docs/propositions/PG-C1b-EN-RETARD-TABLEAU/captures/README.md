# Captures — PG-C1b-EN-RETARD-TABLEAU

Le tableau de bord (`/tableau-de-bord`), sur une intervention AFFECTÉE datée d'HIER (calculé au
moment de l'épreuve), forgée par `tests/e2e/captures-pg-c1b-en-retard-tableau.spec.ts` (env
`CAPTURES_PG_C1B`, préfixe `PGC1BCAP-`, supprimée en fin d'épreuve) — jamais une fixture `SCENE.*`
partagée.

`avant/` : rejoué sur le code d'avant ce lot (commit `c1b3cbb`, les captures de PG-C1c-EN-RETARD-
REGISTRE, le dernier avant PG-C1b) — le bloc « Autres indicateurs » ne porte que deux tuiles,
« Demandes en attente de qualification » et « Techniciens indisponibles aujourd'hui ».

`apres/` : après PG-C1b-EN-RETARD-TABLEAU — une troisième tuile, « Interventions en retard »,
filet rouge, affiche « 1 » (la fiche forgée) et mène vers `/interventions?vue=en_retard`, l'onglet
posé par PG-C1c-EN-RETARD-REGISTRE.

À 1280 et 375 px.
