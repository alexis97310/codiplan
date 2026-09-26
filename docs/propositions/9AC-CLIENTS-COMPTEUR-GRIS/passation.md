# 9AC-CLIENTS-COMPTEUR-GRIS — passation

## Ce que j'ai changé

Le ton du compteur d'équipements des cartes passe de **rouge** (PASTILLES-1)
à **gris**, sur les DEUX écrans qui le portent : `/clients`
(`app/(back-office)/clients/presentation.ts`, `compteurEquipements`) et
`/sites` (`app/(back-office)/sites/presentation.ts`, `compteurEquipements`),
et donc partout où ces fonctions sont appelées — `clients/page.tsx`,
`sites/page.tsx`, `clients/[id]/page.tsx`. Décision d'Alexis du 26/09 : le
rouge est réservé à ce qui demande une action, et un compte d'équipements
enregistrés n'en est pas une. Aucune logique changée — seul le champ `ton`
de la valeur de retour, et le docblock qui le documente. Pour
l'exploitation : les cartes clients et sites ne montrent plus de badge rouge
sur un simple décompte, ce qui laissait penser à tort qu'une action était
attendue.

Aucune migration, aucune ligne de semis, aucun prix.

## Ce que j'ai mesuré

- **Captures AVANT/APRÈS** (`docs/propositions/9AC-CLIENTS-COMPTEUR-GRIS/captures/`),
  à 1280 et 375 px, prises par `tests/e2e/captures-9ac-clients-compteur-gris.spec.ts`
  (env `CAPTURES_9AC_CLIENTS_COMPTEUR_GRIS`) : une fois avec le code d'AVANT
  le lot (`git stash` temporaire des deux `presentation.ts`, jamais commité,
  puis restauré à l'identique par `git stash pop` — vérifié par `git status`),
  une fois avec le code livré. L'AVANT montre, sur `/clients`, le badge
  « 6 équipements » de la carte « Garage du Nord » en rouge ; l'APRÈS montre
  le même badge en gris, identique au ton du compteur de sites voisin sur
  `/sites` (« 4 équipements », « 2 équipements »). Comparaison à l'octet
  (`cmp`) : les quatre paires diffèrent, comme attendu d'un changement de
  couleur.
- Test unitaire neuf, dans `tests/unit/clients/presentation-ecran.test.ts` :
  les deux `compteurEquipements` (client et site) rendent `"gris"` pour 0, 1
  et 7 équipements, et les deux fonctions rendent le MÊME ton l'une que
  l'autre pour ces trois valeurs — joué et vert.
- `pnpm format:check` et `pnpm test` (272 fichiers, 2933 tests) verts.
- `CI=1 pnpm verify:full` en entier, au premier plan, en un seul appel — voir
  le message de fin de tour pour le résultat exact.

## Ce que j'ai tranché et pourquoi

- **Un seul commit** pour le code, le test et la passation : la demande
  n'ouvre qu'un seul écart (une couleur, sur deux fonctions jumelles), pas
  plusieurs sous-tickets distincts comme GR12 (a/b/c) — rien ne justifiait de
  fractionner.
- **Le docblock des deux fonctions reste identique mot pour mot** (« même ton
  dans les deux fonctions ») — c'est la même garantie que celle déjà écrite
  pour `compteurSites`, et c'est elle qui a permis de retrouver les deux
  occurrences à corriger sans en oublier une.
- Je n'ai pas touché `docs/propositions/40-PASTILLES-1/passation.md` :
  l'amendement vit dans les docblocks des deux fonctions, comme demandé.

## Ce que je n'ai PAS fait

- Aucune touche à `compteurSites` (bleu) ni à `compteurContrat` (orange) —
  hors périmètre, et nommément exclus par le ticket.
- Aucune touche à `depot/` ni à `11-FILE.sh`.
- Aucune capture de `clients/[id]` (fiche client) : le ticket ne demandait
  que `/clients` et `/sites`, où le badge est visible sur la liste ; la fiche
  client réutilise la même fonction de `sites/presentation.ts` et son rendu
  n'a pas été jugé nécessaire à mesurer séparément.

## Les pièges pour la session suivante

- Le compteur d'équipements et le compteur de trajet (`/sites`) sont
  désormais tous les deux gris — visuellement indiscernables l'un de
  l'autre sur la carte site (voir la capture `apres/liste-sites-1280.png`) :
  c'est la conséquence directe et voulue de la décision, pas un défaut, mais
  une future demande de distinction visuelle entre ces deux compteurs devra
  choisir un autre levier que la couleur (icône, libellé) puisque le gris
  est maintenant le ton neutre par défaut de plusieurs compteurs.
- Le script de capture `tests/e2e/captures-9ac-clients-compteur-gris.spec.ts`
  suit exactement la recette de `captures-gr12-sites.spec.ts` : recréer un
  AVANT exige de `git stash` les fichiers de code (jamais le spec ni le
  test), lancer le spec, `git stash pop`, relancer le spec pour l'APRÈS.

## Ce qui reste à faire

Rien d'identifié dans le périmètre de ce ticket.
