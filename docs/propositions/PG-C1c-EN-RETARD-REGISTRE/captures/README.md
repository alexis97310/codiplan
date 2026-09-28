# Captures — PG-C1c-EN-RETARD-REGISTRE

Le registre (`/interventions?vue=en_retard`), sur une intervention AFFECTÉE datée d'HIER
(calculé au moment de l'épreuve), forgée par `tests/e2e/captures-pg-c1c-en-retard-registre.spec.ts`
(env `CAPTURES_PG_C1C`, préfixe `PGC1CCAP-`, supprimée en fin d'épreuve) — jamais une fixture
`SCENE.*` partagée.

`avant/` : rejoué sur le code d'avant ce lot (commit `c9bac5f`, les captures de PG-C1a-EN-RETARD-
PLANNING, le dernier avant PG-C1c) — `vue=en_retard` est une vue INCONNUE du schéma d'alors : elle
retombe à « aucune vue » et affiche les 36 fiches, sans onglet actif, sous les six onglets d'avant
ce ticket (« Toutes », « À planifier », « Aujourd'hui », « En cours », « Bloquées », « À
contrôler », « Historique ») ; la tuile « Planifiées cette semaine » n'a aucun lien sous elle.

`apres/` : après PG-C1c-EN-RETARD-REGISTRE — huit onglets, « En retard (1) » actif, qui ne retrouve
que la fiche forgée ; « À venir (27) » compte les planifiées/affectées à partir d'aujourd'hui
inclus ; la tuile « Planifiées cette semaine » porte désormais « Voir les interventions à venir → »
vers `/interventions?vue=a_venir` (décision M1).

À 1280 et 375 px.
