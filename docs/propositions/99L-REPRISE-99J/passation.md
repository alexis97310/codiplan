# 99L-REPRISE-99J — reprendre 99J-PLANNING-GLISSER depuis sa branche de sauvegarde

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Rien de neuf en logique : ce lot **reprend** le travail de 99J-PLANNING-GLISSER, fini le
25/09 mais jamais committé. Les 4 fichiers sauvés par la file sur la branche locale
`99J-PLANNING-GLISSER-inacheve` (c2db457, partie de main 58c92c0) ont été réappliqués
sur main à jour, puis committés (`f59a402`).

Pour l'exploitation, c'est exactement ce que décrit la passation d'origine
(`docs/propositions/99J-PLANNING-GLISSER/passation.md`, reprise telle quelle) : sur
`/planning`, à partir de `lg` et seulement pour un rôle qui détient
`modifier_planning`, le sous-titre porte désormais « · Glisser-déposer pour
réaffecter », en écho au texte de la maquette (D95). Sous `lg`, ou pour un rôle sans
ce droit, rien ne change : la mention n'apparaît jamais là où le geste n'existe pas
(D-06).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- `git diff --stat $(git merge-base main 99J-PLANNING-GLISSER-inacheve)
  99J-PLANNING-GLISSER-inacheve` a rendu exactement les 4 fichiers annoncés par le
  ticket (`app/(back-office)/planning/page.tsx`, `lib/i18n/fr.ts`,
  `tests/e2e/planning-glisser-annonce.spec.ts`, la passation d'origine), sans aucun
  fichier étranger.
- `pnpm format:check` : vert avant le commit.
- `pnpm test` : **268 fichiers, 2878 tests, tous passés**, avant le commit.
- `CI=1 pnpm verify:full`, en un seul appel, au premier plan, exécuté deux fois de
  suite pour produire ce constat : sortie « exit 0 » les deux fois,
  **296 épreuves e2e passées, 3 ignorées, zéro échec** (1 worker), et aucune
  occurrence de `glisser-deposer.spec.ts` (l'épreuve instable connue de la
  consigne) dans le journal — elle ne s'est pas déclenchée cette fois-ci.
  `format:check`, `typecheck`, `lint`, `test`, `test:isolation`, `build`,
  `feries:horizon` et `audit:partitions` ont tous réussi avant `test:e2e`.
- Captures ajoutées (voir plus bas) : `planning-semaine-apres-1280.png` montre bien
  « Semaine 39 — du 21 au 26/09/2026 · Glisser-déposer pour réaffecter » dans le
  sous-titre ; `planning-semaine-apres-375.png` montre l'absence de la mention et la
  présence de « Pour réaffecter une intervention, ouvrez sa fiche. » — vérifié
  visuellement sur les deux images.

## Ce que j'ai tranché et pourquoi

- **Application du diff fichier par fichier avec `git apply --3way`**, jamais
  `git checkout 99J-PLANNING-GLISSER-inacheve -- <fichier>` : la branche de
  sauvegarde part de 58c92c0, et un `checkout` sur `lib/i18n/fr.ts` aurait effacé
  toute clé arrivée sur main depuis (aucune en l'occurrence, mais la règle du
  ticket est générale et je l'ai suivie même quand elle ne changeait rien au
  résultat).
- **Les captures ont été produites en insérant temporairement deux appels
  `page.screenshot()`** dans `tests/e2e/planning-glisser-annonce.spec.ts`, juste
  après les assertions de visibilité de chaque test (1280 puis 375), en réutilisant
  la scène et la session déjà montées par ce spec (`COMPTE_ADMIN_SOCIETE_EPREUVE`).
  Le spec a ensuite été **rendu à son état commité** (`git checkout --`) : seules
  les deux images produites ont été gardées, aucune ligne de test n'est restée
  modifiée — `git diff --stat -- tests/e2e/planning-glisser-annonce.spec.ts` est
  vide après coup. Même patron que 99K-REPRISE-99I.
- **Aucune nouvelle scène e2e forgée** : la capture réutilise le semis partagé déjà
  posé par la scène de l'épreuve d'origine (comptes et interventions de
  démonstration), sans écrire de donnée neuve.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix.
- Aucune logique changée par rapport à ce que 99J-PLANNING-GLISSER avait écrit le
  25/09 — ce lot ne fait que committer un travail déjà fini.
- Je n'ai pas supprimé la branche `99J-PLANNING-GLISSER-inacheve`.
- Je n'ai pas touché `depot/` ni `11-FILE.sh`.
- Les PNG et le PDF recapturés par `verify:full` sous une soixantaine d'autres
  `docs/propositions/*/captures/` (effet de bord déjà documenté par les passations
  précédentes) ont été laissés inchangés dans l'arbre, jamais committés — ce lot
  n'en touche aucun.

## Les pièges pour la session suivante

- Le même piège que celui documenté par 99K-REPRISE-99I : `pnpm verify:full`
  recapture au passage une soixantaine de PNG sans rapport avec le ticket en
  cours — toujours vérifier `git status --porcelain` après coup et ne committer
  que le territoire du lot.
- Pour produire une capture d'un écran qui n'a pas de mécanisme de capture
  permanent dans son spec e2e, la scène et la session déjà montées par un spec
  existant peuvent être réutilisées en insérant temporairement des appels
  `page.screenshot()` puis en revenant à l'état commité du fichier avec
  `git checkout --` — seules les images produites doivent survivre, jamais la
  modification du spec.
- L'épreuve instable connue (`tests/e2e/glisser-deposer.spec.ts:219/139`) ne s'est
  pas déclenchée pendant ce lot ; elle reste à surveiller pour un lot futur qui la
  toucherait.

## Ce qui reste à faire

Rien d'identifié dans le périmètre de ce lot. Le constat 15 de l'audit d'ergonomie
du 25/09 est désormais couvert dans son intégralité.
