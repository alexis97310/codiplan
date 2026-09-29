# Captures — PG-C6-FILTRES-AUJOURDHUI

Audit du 27/09/2026, §5 : « le planning n'a AUCUN filtre » ; « Aujourd'hui » n'existait qu'en vue
Semaine, masqué sur la semaine courante (82-PLANNING-6) — le dimanche, le planning montre la
semaine écoulée sans aucun moyen d'un clic pour revenir à « maintenant ».

Prises par `tests/e2e/captures-pg-c6-filtres-aujourdhui.spec.ts` (env `CAPTURES_PG_C6`) — aucune
scène forgée, ces captures montrent la structure de la barre d'outils, pas le contenu du semis.

- `barre-outils-avant-*.png` — rejoué sur le code d'AVANT ce ticket (`git worktree` sur le commit
  `6537893`, le dernier avant ce ticket) : aucun filtre, « Aujourd'hui » absent (semaine courante).
- `barre-outils-apres-*.png` — après le commit `dfd03c1` (PG-C6-FILTRES-AUJOURDHUI) : la barre de
  filtres (Agence, Technicien, Nature, Priorité, Client, Statut) et « Aujourd'hui », permanent, y
  compris sur la semaine courante.

À 1280 et 375 px.
