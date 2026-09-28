# Captures — PG-B6-DUREE-A-LA-CREATION

Audit d'ergonomie du 27/09/2026 §4.3 ; décision QG-12 d'Alexis : des choix rapides, AUCUNE VALEUR
PAR DÉFAUT. « Créer une intervention » ne demandait pas la durée prévue, et « Trouver un créneau »
ne pouvait donc jamais présélectionner de puce de durée pour une intervention tout juste créée.

Prises par `tests/e2e/captures-pg-b6-duree-a-la-creation.spec.ts` (env `CAPTURES_PG_B6`), sur sa
propre scène (préfixe `PGB6-capture-`) : le formulaire de création rempli, puis l'écran atteint
après « Créer ».

- `formulaire-creation-avant-*.png` — rejoué sur le code d'AVANT ce ticket (`git stash`, le commit
  `81b2f98`, 9BJA-REPRISE-9BJ, le dernier avant ce ticket) : le formulaire ne porte aucun champ de
  durée.
- `formulaire-creation-apres-*.png` — après le commit `72fb847` (PG-B6-DUREE-A-LA-CREATION) : le
  formulaire porte les puces « Durée prévue » (30 min à 4 h, ou « Autre »), aucune n'étant cochée
  par défaut.
- `apres-creation-avant-*.png` — AVANT, « Créer » mène directement à la fiche, sans bandeau.
- `apres-creation-apres-*.png` — APRÈS, la fiche affiche le bandeau « Intervention créée. » avec
  ses deux choix, « Planifier maintenant » (ouvre `FenetrePose`) et « Laisser dans la file »
  (comportement d'avant ce ticket).

À 1280 et 375 px — le formulaire de création et la fiche sont disponibles aux deux largeurs,
contrairement à la grille glissable du planning.
