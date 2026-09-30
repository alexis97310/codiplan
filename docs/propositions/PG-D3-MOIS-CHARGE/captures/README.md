# Captures — PG-D3-MOIS-CHARGE

Prises par `tests/e2e/captures-pgd3-mois-charge.spec.ts` (env `CAPTURES_PGD3`), AVANT/APRÈS EN UN
SEUL FICHIER, par détection (même patron que `captures-pgd2-deux-semaines.spec.ts`) : le scénario
compte les cases `[data-mois-jour]` de `/planning?vue=mois` et nomme sa capture selon ce qu'il
observe — au moins une sur le code livré, aucune sur le code d'avant ce commit (`vue=mois` y
retombait sur la grille Semaine). Rejoué sur le commit `9e63836` (le dernier avant ce commit,
AVANT), puis sur le code livré (APRÈS), sans `git worktree`.

Scène propre au fichier (préfixe `PGD3CAP-`) : un client, un site, une intervention `planifiee`
posée sur le technicien DUCOS de la scène de démonstration (`reperesDeLaScene`), sur le premier
jour ouvert d'un mois futur (celui qui suit le mois de la semaine +1) — jamais une donnée de
production (I9), tout effacé en fin de scénario. **Cette scène ne porte aucun jour à plus de
100 %** : le cas « dépassement » (rouge plein) est prouvé par
`tests/unit/planning/teinte-charge.test.ts`, pas ici.

- `mois-avant-*.png` — AVANT : `?vue=mois` rend la grille Semaine (six jours, colonnes à 150 px) —
  aucune case `[data-mois-jour]`.
- `mois-apres-*.png` — APRÈS : une colonne par jour du mois (30 colonnes pour novembre 2026, 32 px
  chacune), en-tête sur deux lignes (jour court, numéro), sous-titre « Novembre 2026 », quatrième
  onglet « Mois » actif. La case `PGD3CAP-` porte le chiffre « 1 » (nombre d'interventions) sur un
  calque de teinte proportionnelle au taux du jour (ici 1 %, à peine visible) ; les dimanches et
  les samedis de Koné/Dolbeau (fermés) portent la trame. La légende propre à la vue (0 %, teinte,
  au-delà de 100 %, fermé/férié, agenda bloqué) et la note « le chiffre est le nombre
  d'interventions, cliquer ouvre la vue Jour ». À 375 px, la même table défile dans son conteneur
  plutôt que de basculer sur une liste (comportement minimal et réversible, question en
  passation — PG-D4 tranchera les onglets téléphone).
- `mois-clic-vue-jour-*.png` — le clic sur la case `PGD3CAP-` ouvre `/planning?vue=jour&jour=...`,
  la vue Jour de ce jour (sous sa forme en frise, D142/9CF).

À 1280, 1024 et 375 px.

## Mesure

`mesure-avant.md` et `mesure-apres.md` — `mesurer`/`ligneMesureReadme`
(`scripts/lib/mesure-captures.ts`), aux trois largeurs : zéro texte sous 12 px (D138), zéro
débordement horizontal, zéro erreur de console, aux deux passes.
