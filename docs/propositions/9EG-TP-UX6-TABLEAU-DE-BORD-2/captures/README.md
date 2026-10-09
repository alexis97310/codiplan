# Captures — 9EG-TP-UX6-TABLEAU-DE-BORD-2

Commit photographié : b14b5370 (après, et après le lot entier — direction/administrateur,
journal, mise en route, filtres équipe), le 10/10/2026.

**APRÈS SEULEMENT** — même recette que `captures-9eg1-tableau-de-bord.spec.ts` (le lot -1) :
ces deux écrans (direction, administrateur) sont NEUFS, reconstruits par ce lot ; il n'existe
pas d'« avant » comparable à capturer, l'écran montré avant ce lot étant la composition ADV
partagée, déjà photographiée par les captures du lot -1.

Produites par `tests/e2e/9eg2-tableau-de-bord-direction-admin.spec.ts` (`CAPTURES_9EG2=<dossier>
pnpm exec playwright test tests/e2e/9eg2-tableau-de-bord-direction-admin.spec.ts`), sur la
fixture propre du fichier (préfixe `9EG2-`, créée et supprimée par l'épreuve), jamais une
donnée de production.

- `apres-direction-*.png` — `/tableau-de-bord`, vu par la direction.
- `apres-administrateur-*.png` — `/tableau-de-bord`, vu par l'administrateur de société.
- `apres-equipe-acces-a-ouvrir-*.png` — `/parametres/equipe?acces=a-ouvrir`.
- `apres-imports-a-appliquer-*.png` — `/imports?vue=a-appliquer`.

Chacune à 1280 px et 375 px.
