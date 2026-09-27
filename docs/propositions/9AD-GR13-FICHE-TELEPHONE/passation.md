# 9AD-GR13-FICHE-TELEPHONE — passation

## Ce que j'ai changé

Deux points, deux commits, sur la fiche intervention (`/interventions/[id]`) et le bandeau mobile.

- **GR13a** — le bandeau mobile (`components/navigation/bandeau-mobile.tsx`) lisait
  `document.querySelector("main h1").textContent`, qui concatène TOUT le texte du `<h1>` — y
  compris la pastille de statut collée juste derrière le titre sur cette fiche
  (`intervention.titre` + `statut.<statut>`). Résultat mesuré : le bandeau affichait
  « Intervention Local-0E2992En cours », les deux morceaux collés sans espace (voir
  `captures/avant/fiche-en-cours-375.png`). La pastille porte désormais `data-hors-bandeau`,
  et une fonction pure neuve, `titreDuBandeau(h1)` (`components/navigation/titre-du-bandeau.ts`),
  retire tout descendant ainsi marqué avant de lire le texte restant. Pour l'exploitation : le
  titre du bandeau, sur toute fiche intervention consultée au téléphone, redevient lisible
  (`captures/apres/fiche-en-cours-375.png`).
- **GR13b** — sous 901 px (même point de rupture que le bandeau mobile), le panneau « Actions »
  de la fiche (l'`<aside>`) passe SOUS tout le reste du contenu : l'action qui fait avancer
  l'intervention (`actionPrincipale`, 93-FICHE-ACTIONS) se retrouvait loin, après un long
  défilé. Un lien — jamais un second formulaire — apparaît désormais juste sous le titre,
  au libellé de l'action principale, et mène par ancre (`#action-<nom>`) au bloc `Action`
  correspondant dans l'aside. Le lien n'existe que si ce bloc est EFFECTIVEMENT rendu (les
  statuts `affectee`/`en_cours`/`cloturee`/`annulee` n'ont pas d'action principale ; `reprendre`
  et `cloturer` exigent en plus l'habilitation `suspendre_reprendre_intervention` /
  `cloturer_intervention`). À 1280 px le lien reste invisible (`min-[901px]:hidden`, comme le
  bandeau). Pour l'exploitation : un technicien ou un planificateur qui ouvre cette fiche au
  téléphone atteint l'action à faire en un geste, sans défiler jusqu'à l'aside
  (`captures/apres/fiche-planifiee-375.png`).

Aucune migration, aucune ligne de semis, aucun prix, aucune règle de gestion changée — les
deux points sont des corrections d'ergonomie d'affichage, tenues par le docblock amendé de
`Action` (l'écart au « seul regroupement des actions » de FICHE-INTERVENTION-1 y est nommé).

## Ce que j'ai mesuré

- **Captures AVANT/APRÈS** (`docs/propositions/9AD-GR13-FICHE-TELEPHONE/captures/`), à 375 et
  1280 px, sur les trois statuts demandés (`planifiee`, `terminee`, `en_cours`), prises par
  `tests/e2e/captures-gr13-fiche-telephone.spec.ts` (env `CAPTURES_GR13`) : une fois avec le
  code d'avant le lot (`git show a49cd35:...` remis temporairement sur le disque pour
  `app/(back-office)/interventions/[id]/page.tsx` et `components/navigation/bandeau-mobile.tsx`,
  et `components/navigation/titre-du-bandeau.ts` + son test unitaire retirés le temps de la
  capture — jamais committé, puis restauré à l'identique du commit livré, vérifié par
  `git diff --stat`, vide), une fois avec le code livré.
  - **AVANT** : le bandeau affiche « Intervention Local-XXXXXXEn cours » /
    « …Planifiée » / « …Terminée » (titre et statut collés), aucun lien sous le titre sur
    aucun des trois statuts.
  - **APRÈS** : le bandeau affiche « Intervention Local-XXXXXX » seul ; la fiche `planifiee`
    montre le lien « Affecter un technicien » juste sous le titre (au-dessus de
    l'identification) ; la fiche `terminee` montre le lien « Clôturer » ; la fiche `en_cours`
    ne montre aucun lien (elle n'a pas d'action principale) — confirmé visuellement sur les six
    captures 375 px.
- **Le scénario e2e neuf** (`tests/e2e/fiche-telephone.spec.ts`, scène `ERGO13`, propre,
  créée/supprimée par le test) prouve, à 375×800 : le lien existe et pointe sur
  `#action-affecter` / `#action-cloturer` selon le statut, il est situé AU-DESSUS de l'aside
  (comparaison des `boundingBox().y`), le clic amène le bloc dans la fenêtre
  (`toBeInViewport()`) ; sur `en_cours`, aucun lien « Affecter » ni « Clôturer » n'existe ; à
  1280 px le lien est invisible. 4 tests, tous verts.
- **Le test unitaire neuf** (`tests/unit/navigation/titre-du-bandeau.test.ts`) couvre : un
  `<h1>` sans pastille, une pastille directe, une pastille imbriquée sous plusieurs niveaux, et
  la normalisation des espaces après retrait.
- `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (273 fichiers, 2939 tests)
  verts après chacun des deux commits.
- e2e ciblés rejoués et verts après GR13b : `fiche-actions.spec.ts`, `fiche-annuler.spec.ts`,
  `avertissements-1.spec.ts`, `interventions-2.spec.ts` (les huit épreuves qui exigent la
  pastille dans le `<h1>` restent inchangées, sans modification).
- `CI=1 pnpm verify:full` en entier, au premier plan, en un seul appel, à la toute fin :
  339 épreuves e2e (336 passées, 3 ignorées — préexistant, hors périmètre), vert.

## Ce que j'ai tranché et pourquoi

- **`titreDuBandeau` vit dans `components/navigation/`** (et non `lib/`), comme le demandait le
  ticket : c'est une fonction de PRÉSENTATION du DOM (elle prend un `Element`), pas une règle
  de gestion — elle n'a rien à faire dans `lib/`.
- **Le point de rupture du lien mobile est `min-[901px]`**, celui du bandeau — pas 768 px comme
  l'énonçait le constat de l'audit du 26/09. C'est un écart TECHNIQUE nommé par le ticket
  lui-même : inventer un second système de points de rupture aurait été le défaut que
  `bandeau-mobile.tsx` évite déjà depuis COQUE-375.
- **`principaleRendue` (page.tsx) recalcule, sans les dupliquer, les conditions déjà posées
  plus haut** (`peutSuspendreOuReprendre`, `peutClore`) — jamais une троisième lecture d'un
  même critère : sans ce garde-fou, le lien pointerait vers une ancre qui n'existe pas quand
  le rôle courant n'a pas l'habilitation de reprendre ou de clôturer.
- **L'`id` est posé sur LES QUATRE variantes de rendu d'`Action`** (refus replié, refus déplié,
  bloc principal plein, `<details>` secondaire) plutôt que seulement sur le cas « principale » :
  un même appel (`action-affecter`, par exemple) peut être rendu refusé sur un autre rôle, et
  l'ancre doit rester stable dans tous les cas où ce bloc existe.
- **Le lien est un `<a>` natif**, pas un composant `<Link>` de Next : c'est une ancre vers un
  élément de LA MÊME page, jamais une navigation — un `<Link>` n'aurait rien apporté de plus
  qu'une dépendance inutile à ce geste.

## Ce que je n'ai PAS fait

- Je n'ai touché à aucune règle de gestion, aucune migration, aucune ligne de semis, aucun
  prix — conforme aux interdits du ticket.
- Je n'ai pas scindé le panneau « Actions » en deux regroupements : le lien mobile est un
  RACCOURCI vers le bloc existant de l'aside, jamais un second formulaire, jamais une
  duplication des champs `duree_min` déjà présents deux fois dans l'aside (piège nommé par le
  ticket, évité).
- Je n'ai pas touché `depot/` ni `11-FILE.sh`.
- Je n'ai pas ajouté de test `retries` ni `workers: 1`, ni de `skip`/`fixme`.

## Les pièges pour la session suivante

- **Le point de rupture du lien mobile (`min-[901px]`) diffère du 768 px cité par le constat
  G11 de l'audit** — c'est volontaire (voir « ce que j'ai tranché »), pas un oubli si un futur
  audit le relève à nouveau.
- **`Action` porte maintenant un `id` optionnel** — toute nouvelle action ajoutée à cette fiche
  qui voudrait un raccourci mobile doit lui donner un `id="action-<nom>"` ET étendre
  `principaleRendue` dans `page.tsx` si son rendu dépend d'une habilitation, sous peine d'un
  lien qui pointerait vers une ancre absente.
- **Les captures AVANT ont exigé de swapper temporairement TROIS fichiers**
  (`app/(back-office)/interventions/[id]/page.tsx`, `components/navigation/bandeau-mobile.tsx`,
  et le retrait provisoire de `components/navigation/titre-du-bandeau.ts` +
  `tests/unit/navigation/titre-du-bandeau.test.ts`, ce dernier sinon `next build` échoue à
  résoudre son import) avec `git show a49cd35:...` (le commit précédant les deux commits de ce
  lot), sans jamais les committer : restaurés à l'identique du commit livré avant la capture
  APRÈS et avant `verify:full` (vérifié par `git diff --stat`, vide).
- La scène `ERGO13` de `fiche-telephone.spec.ts` et la scène `GR13CAP` de
  `captures-gr13-fiche-telephone.spec.ts` sont VOLONTAIREMENT distinctes (deux fichiers e2e
  différents, deux préfixes différents) — les fusionner romprait l'indépendance des deux
  scènes sous `fullyParallel`.

## Ce qui reste à faire

Rien d'identifié dans le périmètre de ce ticket. Le gain GR13 de l'audit du 26/09/2026
(constat G11) et la décision d'Alexis du 26/09 sont livrés.
