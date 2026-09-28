# Captures — PG-A5-FICHE-CRENEAU

Le résumé de la fiche intervention (`/interventions/<id>`), sur trois interventions forgées par
`tests/e2e/captures-pg-a5-fiche-creneau.spec.ts` (env `CAPTURES_PG_A5`, préfixe `PGA5CAP-`,
supprimées en fin d'épreuve) — jamais une fixture `SCENE.*` partagée.

- `resume-complet-*.png` — planifiée, créneau 08:00–10:00, durée 120 min.
- `resume-sans-heure-*.png` — planifiée, date seule, aucun créneau (durée requise par
  `intervention_planifiee_a_sa_duree` mais non rendue dans ce cas).
- `resume-sans-duree-*.png` — terminée, un début de créneau, aucune durée prévue.

`avant/` : rejoué sur le code d'avant ce ticket (le commit `a246446`, 9BB-PG-G1-DOCS-FERIES-ORDRE,
le dernier avant ce lot) — le résumé affiche « 24/09/2026 08:00 » ou « 24/09/2026 » : la durée
prévue n'apparaît nulle part, et l'absence de créneau ne se distingue pas de l'absence de durée.

`apres/` : après le commit `PG-A5-FICHE-CRENEAU` — le résumé affiche « jeu. 24/09 · 08:00–10:00
(2 h 00) », « jeu. 24/09 · heure non fixée » et « jeu. 24/09 · 08:00 · durée non renseignée »,
chaque absence nommée plutôt que tue.

À 1280 et 375 px.
