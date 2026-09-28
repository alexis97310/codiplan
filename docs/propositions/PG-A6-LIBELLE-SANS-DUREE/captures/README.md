# Captures — PG-A6-LIBELLE-SANS-DUREE

I-5 de l'audit d'ergonomie du 27/09/2026 : deux comptes disaient tous deux « sans durée » pour
deux POPULATIONS différentes. La tuile du tableau de bord (`tableau_de_bord.kpi_interventions_sans_duree`)
compte aussi une intervention `a_planifier` (sans `date_planifiee`), pas seulement les
« planifiées » que son ancien libellé nommait. Le lien du panneau de charge du planning
(`statistiques.charge_incomplete_lien`) ouvre `/interventions?sans_duree_a_venir=1` — une
population différente de celle que la phrase juste à côté vient de compter (la SEMAINE affichée,
dates passées comprises) ; son ancien texte ne le disait pas.

Prises par `tests/e2e/captures-pg-a6-libelle-sans-duree.spec.ts` (env `CAPTURES_PG_A6`), sur sa
propre scène (préfixe `PGA6-`) : une intervention `a_planifier`, affectée à un technicien, datée
d'aujourd'hui, sans créneau ni durée estimée.

- `tuile-sans-duree-avant-*.png` / `lien-sans-duree-planning-avant-*.png` — rejoués sur le code
  d'AVANT ce ticket (`git worktree` sur le commit `33f495b`, PG-A3a-MESSAGES-POSE, le dernier
  avant ce ticket) : la tuile dit « Planifiées sans durée prévue », le lien dit « Voir les
  interventions sans durée → ».
- `tuile-sans-duree-apres-*.png` / `lien-sans-duree-planning-apres-*.png` — après le commit
  `fc0efb2` (PG-A6-LIBELLE-SANS-DUREE) : la tuile dit « Sans durée prévue — à planifier ou à
  venir », le lien dit « Voir celles à venir, sans durée → ».

À 1280 et 375 px. Le calcul n'a pas changé — seuls les deux libellés le disent.
