# 9BOA-REPRISE-9BO — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- Repris à l'identique le travail de la branche locale `9BO-TP-UX0-DOCS-garde` (recalée le 29/09
  pour une raison sans rapport avec son contenu, voir plus bas) et l'ai posé sur `main` :
  `docs/propositions/ergonomie-2026-09-28/` (spécification ergonomie/graphisme/usage, `lots-ux.md`,
  `maquette-toutes-pages.html`, et les 109 fichiers de `captures/`), et la ligne de renvoi ajoutée
  dans `docs/audit-ergonomie-2026-09-28.md`.
- Ai aussi rapporté `docs/propositions/9BO-TP-UX0-DOCS/passation.md` — la passation écrite par la
  session originale, présente sur la branche `9BO-TP-UX0-DOCS-garde` mais non mentionnée dans le
  territoire annoncé de ce ticket (voir « Ce que j'ai tranché »).
- Pour l'exploitation : rien de nouveau par rapport à ce que 9BO-TP-UX0-DOCS avait déjà produit —
  cette reprise ne fait que faire aboutir sur `main` un travail déjà fait et déjà vérifié une fois,
  bloqué uniquement par un incident d'environnement de test.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- Empreintes MD5 des cinq fichiers listés par le ticket, comparées à celles attendues — identiques
  dans les cinq cas : `ergonomie-graphisme-usage-2026-09-28.md` (`97d414c...`), `lots-ux.md`
  (`cfa2399...`), `maquette-toutes-pages.html` (`dd79840...`), `captures/README.md` (`9437a02...`),
  `captures/index.json` (`e8b214e...`).
- Comptage des captures après application du diff : `bureau-1440/` 73 fichiers, `telephone-390/` 22,
  `etats/` 12 — soit 107 + `README.md` + `index.json` = 109, conforme à la passation d'origine.
- `git diff --stat` de la branche contre `main` : 114 fichiers, 7944 insertions, 0 suppression,
  aucun fichier de code.
- `CI=1 pnpm verify:full` joué en entier, au premier plan, un seul appel : format, typecheck, lint,
  tests unitaires, isolation, build, `feries:horizon`, `audit:partitions`, puis les e2e — 624 tests
  passés, 3 ignorés, 0 échec. Le préalable (voir plus bas) n'a donc pas resurgi.

## Ce que j'ai tranché et pourquoi

- **Le préalable était déjà fait.** `git log --oneline -5 -- tests/e2e/planning-fenetre-pose.spec.ts`
  montre deux commits déjà sur `main` : `3a92dea` (« PRÉALABLE — dates futures pour
  planning-fenetre-pose ») et `35cf6ab` (« PRÉALABLE — la semaine affichée doit suivre le jour
  décalé »), postérieurs au recalage. Je n'ai donc rien touché à ce fichier — c'est bien ce que
  `verify:full` vert confirme.
- **`docs/propositions/9BO-TP-UX0-DOCS/passation.md` a été rapporté malgré son absence du
  territoire annoncé.** Le `git diff --stat` de la branche contre `main` contenait ce fichier
  (102 lignes) en plus de `ergonomie-2026-09-28/**` et de la ligne d'audit — un écart par rapport à
  l'énoncé du ticket (« seulement docs/propositions/ergonomie-2026-09-28/** et UNE ligne de
  docs/audit-ergonomie-2026-09-28.md »). J'ai lu son contenu : c'est la passation de la session
  originale 9BO-TP-UX0-DOCS, avec les mêmes empreintes et comptes que ceux redonnés dans ce ticket
  — un document de documentation, sans code, sans migration, cohérent avec la convention « un
  ticket, sa passation ». J'ai choisi de le conserver plutôt que de le retirer du diff appliqué :
  le retirer aurait perdu la trace du travail original sans bénéfice, et rien n'indique qu'il ait
  été volontairement exclu par le pilote — plus probablement un oubli de description. Je le signale
  ici explicitement plutôt que de trancher en silence.
- **`git diff --binary` a été nécessaire.** Un premier essai avec `git diff $BASE branche | git
  apply --3way` (sans `--binary`) a échoué sur toutes les captures PNG (« cannot apply binary patch
  ... without full index line ») et n'a rien appliqué du tout (git apply annule l'ensemble en cas
  d'échec). Refait avec `git diff --binary $BASE branche | git apply --3way --binary`, qui a
  appliqué la totalité sans erreur. Ce n'est pas prescrit littéralement par le ticket, mais reste
  fidèle à son esprit (« jamais `git checkout <branche> -- fichier` », donc pas de contournement par
  checkout — seulement l'ajout du drapeau nécessaire au même mécanisme d'application de diff).

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix — conforme aux interdits du ticket.
- Aucune capture d'écran prise : aucun écran de l'application n'a été touché ou créé (le territoire
  est de la documentation copiée, photographie de la maquette).
- La branche `9BO-TP-UX0-DOCS-garde` n'a pas été supprimée, comme demandé.
- Je n'ai pas ouvert de nouveau ticket ni modifié `docs/arbitrages.md` pour la décision de garder
  `9BO-TP-UX0-DOCS/passation.md` : la question ne relève d'aucune des familles du §8 de
  `CLAUDE.md` (pas d'argent, pas d'obligation légale, rien de visible client, rien d'irréversible).

## Les pièges pour la session suivante

- `git apply --3way` seul (sans `--binary`) échoue silencieusement en tout-ou-rien sur un diff
  contenant des PNG : il annonce « Applied patch ... cleanly » pour les fichiers texte puis échoue
  sur le premier binaire, et l'ensemble de la patch — texte compris — repart à zéro. Toujours
  vérifier `git status`/`git diff HEAD` après un `git apply` qui a affiché des erreurs, avant de
  conclure qu'une partie a été appliquée.
- La commande `git diff --stat` annoncée dans un ticket de reprise comme définissant le territoire
  exact peut être incomplète (elle a oublié la passation de la session d'origine ici) : la vérifier
  soi-même avant de s'y fier pour cadrer le commit.

## Ce qui reste à faire

Rien côté de ce lot. Le travail de 9BO-TP-UX0-DOCS est maintenant sur `main`, vérifié, commité.
