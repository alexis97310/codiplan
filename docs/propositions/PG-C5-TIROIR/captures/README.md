# Captures — PG-C5-TIROIR

Audit du 27/09/2026 (I-3) ; spécification §3.9 ; maquette complète (`openDrawer`, `.detail-drawer`)
et CA-8. Cliquer une carte du planning menait toujours à la fiche complète, quittant l'écran en
cours.

Prises par `tests/e2e/captures-pg-c5-tiroir.spec.ts` (env `CAPTURES_PG_C5`), sur sa propre scène
(préfixe `PGC5CAP-`) : une intervention « à planifier », dans la file de la colonne « À traiter ».

- `fiche-avant-*.png` — rejoué sur le code d'AVANT ce ticket (`git worktree` sur le commit
  `d7fea20`, le dernier avant ce ticket) : cliquer la carte navigue vers `/interventions/<id>`, la
  fiche complète — le planning est quitté.
- `tiroir-apres-*.png` — après le commit `9cd8357` (PG-C5-TIROIR) : le même clic ouvre un tiroir de
  440 px, le planning reste affiché derrière, avec les actions « Ouvrir la fiche », « Déplacer… »,
  « Remettre dans la file » et le motif d'annulation.

À 1280 et 375 px.
