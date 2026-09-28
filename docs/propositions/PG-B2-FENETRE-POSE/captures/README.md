# Captures — PG-B2-FENETRE-POSE

Audit du 27/09/2026, bugs 1 et 2 ; spécification §3.10, §3.11, CA-3 ; décisions d'Alexis du 27/09
(QG-2 : ajouts acceptés ; QG-12 : durées en choix rapides, rien de coché par défaut). Le dépôt
d'une carte « À planifier » sur une case du planning était refusé 100 % du temps : la case n'a ni
heure ni toujours de durée, et `peutPlanifier` exige les quatre valeurs ensemble (PARCOURS-1).
`FenetrePose` (neuf) les complète avant d'écrire, plutôt que d'appeler `/deplacer` directement.

Prises par `tests/e2e/captures-pg-b2-fenetre-pose.spec.ts` (env `CAPTURES_PG_B2`), sur sa propre
scène (préfixe `PGB2-`) : une intervention « À planifier » sans technicien ni créneau, déposée sur
la case de D. Guérin (agence Ducos) un MARDI, en vue Semaine.

- `depot-semaine-avant-*.png` — rejoué sur le code d'AVANT ce ticket (`git worktree` sur le commit
  `ca9bcea`, 9BCA-REPRISE-9BC, le dernier avant ce ticket) : le dépôt est refusé, bandeau rouge
  « L'heure de début et la durée prévue sont obligatoires pour planifier cette intervention. ».
- `depot-semaine-apres-*.png` — après le commit `5d66116` (PG-B2-FENETRE-POSE) : le dépôt n'écrit
  rien, la fenêtre de pose s'ouvre, pré-remplie (« Poser — PGB2 · Curatif · P3 — normale »,
  technicien « D. Guérin », date « 29/09/2026 »).

À 1280 et 375 px. **La grille glissable n'existe pas sous `lg`** (`hidden ... lg:block`,
`app/(back-office)/planning/page.tsx`) : le geste de déposer n'a pas d'équivalent tactile. La
capture à 375 px n'effectue donc pas de glissé — AVANT ce ticket, rien à cliquer, elle montre la
carte de la file telle quelle ; APRÈS, elle clique le bouton « Poser… » ajouté sur chaque carte
(accessible au clavier et au téléphone, PG-B2), qui ouvre la même fenêtre.
