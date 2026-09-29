# Captures — 9BV-TP-A5b-DATES-REPRISE

Prises le 29-30/09/2026.

- APRÈS photographié contre `main` au commit `783ba6e` (dernier commit de
  code du lot, avant cette passation).
- AVANT photographié contre le commit `a85ad3e` (dernier commit de `main`
  avant ce lot), depuis un `git worktree` jetable — jamais en modifiant le
  code livré pour reculer.
- Les deux passages jouent le **même fichier**, `tests/e2e/
  captures-9bv-dates-reprise.spec.ts` (committé, inerte sous `pnpm
  test:e2e` ordinaire, il n'écrit rien sans sa variable d'environnement
  `CAPTURES_9BV`). Aucune clé `fr[...]` n'y est lue, à dessein : sur le
  code AVANT, les clés neuves n'existent pas encore, et `next build`
  type-vérifie ce fichier contre le code qu'il capture (mémoire
  « captures-avant-apres-e2e »).
- Deux largeurs par scène : 1280 px et 375 px. `fullPage`.
- La fiche reprise d'un import est posée directement par `INSERT` SQL
  (même fixture que `tests/e2e/reprise-bandeau.spec.ts`) : `cloturee_le`
  fixé au 15/03/2019, `cree_le` à sa valeur par défaut (`now()`) — le seul
  écart qui fait la reprise, des deux côtés du commit.

## Les cinq scènes

| Fichier (préfixe) | Ce qui change |
|---|---|
| `planning-sous-titre-a-cheval` | `/planning?semaine=2026-09-28` — AVANT : « Semaine 40 — du 28 au 3/10/2026· Glisser-déposer... » (premier jour sans mois, dernier jour non complété, aucun espace avant « · ») ; APRÈS : « Semaine 40 — du 28/09 au 03/10/2026 · Glisser-déposer... » (TR-54) |
| `absences-mois-a-cheval` | `/absences?semaine=2026-09-28` — AVANT : « Septembre 2026 » (mois du lundi seul) ; APRÈS : « Septembre – Octobre 2026 » (TR-7) |
| `trajets-grand-noumea` | `/parametres/trajets` — AVANT : « 30 min (30 minutes) » sur la ligne Grand Nouméa ; APRÈS : « 30 min » seul, sous l'heure (PA-24). Les zones à partir de l'heure (Côte Est, 240 min) sont inchangées des deux côtés. |
| `fiche-reprise` | `/interventions/{reprise}` — AVANT : aucun bandeau, « Aucun segment de travail enregistré : le compteur n'a pas encore tourné. » sur une fiche clôturée depuis 2019 ; APRÈS : bandeau « Reprise de l'archive du 15/03/2019 » (ton neutre, jetons `app-bleu-*`) et « Aucun segment de travail enregistré. » sans promesse d'avenir (IN-23) |
| `fiche-note-interne` | `/interventions/{ouverte}` — changement d'ACCESSIBILITÉ seulement (IN-25) : AVANT et APRÈS se ressemblent au pixel près, la différence est dans l'arbre d'accessibilité — le `<textarea>` porte désormais `aria-labelledby` vers le `<h2>` « Note interne », sans second texte visible |

## Non capturé — rien à signaler

Les cinq écrans du lot sont tous capturés ; aucun refus d'accès mesuré
(contrairement à `/portail` pour `9BT-TP-A5-LIBELLES`).
