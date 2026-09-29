# Captures — 9BY-TP-I9-NOMS-REELS

AVANT : commit `dd0093a` (9BY-TP-I9-NOMS-REELS — raisons sociales, avant le
renommage des techniciens), rejoué dans un `git worktree` sur une base
ressemée avec l'ancien code (recette « captures-avant-apres-e2e »).

APRÈS : commit `e0f545a` (9BY-TP-I9-NOMS-REELS — techniciens fictifs).

Spec : `tests/e2e/captures-tpi9-noms-fictifs.spec.ts`, rejouée deux fois avec
`CAPTURES_TPI9=<dossier>` et `CI=1`.

Quatre écrans, à 1280 et 375 px :

- `planning-semaine-*` — planning, vue Semaine.
- `planning-jour-*` — planning, vue Jour (lundi 21/09/2026, jour ouvert de la
  scène de démonstration).
- `equipe-*` — `/parametres/equipe` : les quatre techniciens et leurs
  courriels, l'écran où le changement se voit le plus clairement.
- `absences-*` — `/absences` : capturé pour mémoire, mais les paires
  AVANT/APRÈS sont **identiques à l'octet près** — le sélecteur « Personne »
  est un `<select>` natif fermé (son option choisie n'apparaît pas dans une
  capture d'écran statique, même limite que `captures-tpa6.spec.ts`) et la
  scène ne porte aucun blocage d'agenda à afficher en ligne. Le changement de
  nom est bien en base (vérifié par `equipe-*`), mais cet écran-là ne le
  montre pas visuellement dans ces conditions.
