# Captures — PG-C1a-EN-RETARD-PLANNING

Le planning (`/planning?vue=jour&jour=<hier>`), sur une intervention PLANIFIÉE datée d'HIER
(calculé au moment de l'épreuve — « en retard » dépend d'aujourd'hui), forgée par
`tests/e2e/captures-pg-c1a-en-retard-planning.spec.ts` (env `CAPTURES_PG_C1A`, préfixe
`PGC1ACAP-`, supprimée en fin d'épreuve) — jamais une fixture `SCENE.*` partagée. Sans créneau
posé, elle rend dans la ligne « Journée — heure non fixée ».

`avant/` : rejoué sur le code d'avant ce lot (commit `ca9bcea`, la passation de 9BCA-REPRISE-9BC,
le dernier avant PG-C1a) — la ligne ne porte aucune mention.

`apres/` : après les deux commits PG-C1a-EN-RETARD-PLANNING — la ligne porte « En retard » en
texte rouge sous la durée. (Cette ligne « sans heure » n'a pas de carte colorée par statut : le
contour pointillé s'applique aux trois rendus de carte du planning — grille semaine, liste
téléphone, grille jour — que cette scène, sans créneau posé, n'exerce pas ; la mention texte,
elle, est partagée par les cinq emplacements de `DetailsDeLaCarte`.)

À 1280 et 375 px.
