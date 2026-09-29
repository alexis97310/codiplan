# Captures — 9BW-AVERT-POSE-FICHE

Fiche d'une intervention `a_planifier`, juste après une pose par « Trouver un
créneau » — client avec donneur d'ordre, à 1280 px et 375 px.

- `fiche-avert-pose-avant-*.png` — code AVANT ce lot (commit 4848b53~1, avant
  la commande de correction), capturé le 30/09/2026 depuis un `git worktree`
  sur ce commit. On y arrive avec `?motif=intervention.refus.jour_ferme` dans
  l'URL avant la pose : le rechargement par `window.location.reload()`
  conserve l'URL telle quelle, donc **le vieux bandeau rouge reste affiché**
  après une pose pourtant acceptée, et aucun avertissement de courriel
  n'apparaît (ils étaient jetés).
- `fiche-avert-pose-apres-*.png` — code APRÈS ce lot (commit 4848b53),
  capturé le 30/09/2026. Le rechargement passe par `urlDeRechargement`
  (même fonction que le planning) : le vieux bandeau a disparu, et les deux
  avertissements de courriels partis (client, technicien) sont visibles.

Scène de démonstration uniquement (I9) — un client, un site et une
intervention forgés et retirés par l'épreuve e2e elle-même
(`tests/e2e/fiche-trouver-creneau.spec.ts`, préfixe `PGB3AV-`).
