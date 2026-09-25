# 96B-FICHE-375-REPRISE — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Rien au code au-delà de la fusion de `95-FICHE-375-garde` dans `main`
(commit de fusion `e82b3be`) : les trois classes sur
`app/(back-office)/interventions/[id]/page.tsx` (`w-full min-w-0` sur le
`<select>` d'« Ajouter une machine » et sur `Saisie`, les quatre `<dl>` en
une colonne sous `sm`) et le nouveau `tests/e2e/fiche-375.spec.ts`, tels que
décrits dans `docs/propositions/95-FICHE-375/passation.md`. Le constat de ce
ticket (« verification de la file tournait sans `CI=1` ; corrigé à 22h55 »)
plaçait la cause du double rouge hors du lot 95 ; mon travail a consisté à
le vérifier, pas à corriger un défaut de plus. Pour l'exploitation, rien ne
change au-delà de ce que 95-FICHE-375 apportait déjà.

## Ce que j'ai mesuré (comptes AVANT/APRES)

- `pnpm typecheck` immédiatement après la fusion : **vert**, zéro erreur.
- `CI=1 pnpm exec playwright test tests/e2e/parcours-creer-puis-planifier.spec.ts`
  (l'épreuve qui avait recalé le lot deux fois sur `:197`, bandeau
  `role=status` après un refus de planification) : **3/3 passés**, ~50,5 s.
- `CI=1 pnpm exec playwright test tests/e2e/fiche-intervention.spec.ts` :
  **5/5 passés**, ~49,0 s.
- `pnpm test` (unitaires) : **2855 tests passés** sur 265 fichiers.
- `CI=1 pnpm verify:full` en entier, en un seul appel, au premier plan :
  **vert de bout en bout**. `verify:full` est une chaîne `&&`
  (`pnpm verify && pnpm feries:horizon && pnpm audit:partitions && pnpm test:e2e`,
  elle-même `format:check && typecheck && lint && test && test:isolation &&
  build`) — atteindre et réussir la dernière étape (e2e, 278 passés, 3
  skips préexistants et nommés, hors de ce lot) confirme que toutes les
  étapes précédentes ont réussi.

Aucune régression mesurée sur le bandeau `role=status` de la fiche
intervention ni sur le parcours « créer puis planifier ».

## Ce que j'ai tranché, et pourquoi

- **Je n'ai appliqué aucune correction de code** : les deux épreuves visées
  par le rouge de la session précédente passent toutes les deux, sous
  `CI=1`, isolées. Le constat du ticket (verification de la file sans
  `CI=1`, corrigé avant ce lot) est cohérent avec cette mesure — rien dans
  le comportement du bandeau `role=status` ni du parcours de planification
  n'a bougé entre 95 et 96B. Chercher une cause supplémentaire dans le code
  du lot aurait été une correction sans défaut mesuré.
- **J'ai relancé les deux épreuves isolément avant `verify:full`** plutôt
  que de me fier directement à la suite complète, pour vérifier
  spécifiquement le point que le ticket désignait (§2 des consignes)
  avant d'engager les ~15 minutes de la suite e2e complète.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix — territoire inchangé.
- Aucune capture d'écran nouvelle : comme pour 95-FICHE-375, le texte du
  ticket porte la mention « Captures : … (liste ci-dessus) » sans qu'aucune
  liste ne précède cette phrase — rien à quoi rattacher un nom de fichier.
  Les écrans touchés sont ceux déjà couverts par les captures de la session
  95 (`docs/propositions/95-FICHE-375/`), non dupliquées ici.
- Je n'ai touché ni `depot/` ni `11-FILE.sh`.

## Les pièges pour la session suivante

Rien de nouveau au-delà de ce que `docs/propositions/95-FICHE-375/passation.md`
documente déjà (le piège `fullyParallel`/`beforeAll` par ouvrier, les deux
`<aside>` de la fiche, le `<select>` natif qui ne s'enroule jamais). Le
piège propre à cette reprise — la file jouant `verify:full` sans `CI=1` —
est décrit comme corrigé dans le constat du ticket ; je ne l'ai pas
recontrôlé au-delà de constater que les deux épreuves visées passent sous
`CI=1` en local.

## Ce qui reste à faire

Rien d'identifié sur le périmètre de ce ticket.
