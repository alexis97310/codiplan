# 9L08A0-ATTEIGNABILITE-ECRANS-RAPIDE — passation

*Constat du pilote (16/11/2026, ~21:35) : `tests/unit/navigation/atteignabilite-ecrans.test.ts:158`
dépasse son délai de 5000 ms pendant la vérification indépendante (machine chargée), et fait recaler
des lots sans rapport (9L07 ×2, 9L08A 2e passage, 9L08B ×2).*

## Ce que j'ai mesuré (point 1)

Sur `origin/main`, au calme, avec un script hors dépôt reproduisant exactement l'algorithme en
place (`sourceAvecComposants` de `tests/unit/navigation/atteignabilite-ecrans.test.ts`) :

- **50 écrans** dans `app/(back-office)/**`, pour **389 fichiers réellement distincts** dans l'union
  de leurs graphes d'imports.
- **31 311 appels à `readFileSync`** pour construire `ECRANS` — chaque écran reparcourt tout son
  graphe d'imports depuis zéro (`vus = new Set()` NEUF par écran), et chaque fichier y est lu DEUX
  fois (une pour sonder l'extension, une pour la récursion). Durée de cette seule construction :
  **2244,6 ms**.
- **Seconde cause, non soupçonnée au départ** : une fois la construction corrigée (ci-dessous), le
  test restait à ~2,3 s. `ecran.source` est la concaténation de TOUTE la fermeture d'imports — et
  presque tous les écrans partagent le même chrome (barre, mise en page, composants `ui/`). Les 50
  `source` cumulaient **84 845 754 octets** (84,8 Mo) pour 389 fichiers distincts. `ecransOrphelins`
  appelle `cheminsDesignes` (six motifs `matchAll`) sur CE texte à chaque écran exploré : **2141 ms**
  pour les 50 appels, soit la quasi-totalité du temps restant.
- `ecransOrphelins` elle-même (la fermeture transitive, hors `cheminsDesignes`) n'a pas de coût
  mesurable à part : chaque route n'y est explorée qu'une fois, et les boucles sur 50 écrans sont
  négligeables.

Sous charge (quatre processus `yes > /dev/null` en tâche de fond pendant l'exécution) : même ordre
de grandeur avant correction — 11-12 ms après, voir plus bas.

## Ce que j'ai corrigé (point 2)

Deux caches, tous les deux dans `tests/unit/navigation/atteignabilite-ecrans.test.ts` (le fichier où
vivent `sourceAvecComposants` et la construction de `ECRANS`/`DEPARTS`) :

1. **Cache de contenu et d'imports résolus, par fichier** (`cacheContenu`, `cacheImports`,
   `lireFichier`, `importsResolus`) — le graphe d'imports est le même pour tout le dépôt, qu'on le
   regarde depuis un écran ou un autre ; il ne se calcule plus qu'une fois. `sourceAvecComposants`
   garde son `vus` propre à CHAQUE écran (nécessaire pour arrêter un cycle PENDANT la descente) ;
   le cache est d'une autre nature, il survit entre les écrans.
2. **Cache des chemins désignés, par fichier** (`cacheCheminsParFichier`, `cheminsDesignesParFichier`,
   `cheminsDeFermeture`) — `cheminsDesignes` est maintenant appelé UNE fois par fichier distinct (et
   mémoïsé), puis les résultats sont réunis par écran via la même fermeture transitive que
   `sourceAvecComposants` (même cache `importsResolus`, donc pas de second parcours du disque). Ceci
   a demandé d'ajouter un champ `chemins: readonly string[]` au type exporté `Ecran`
   (`scripts/lib/atteignabilite-ecrans.ts`), précalculé à la construction de `ECRANS`/`DEPARTS`, et
   de faire lire ce champ par `ecransOrphelins` au lieu d'appeler `cheminsDesignes(ecran.source)` à
   chaque écran exploré. `Ecran` et `ecransOrphelins` ne sont importés que par ce seul fichier de
   test (vérifié par `grep` avant de toucher au type) : aucun autre appelant à mettre à jour.

`cheminsDesignes` et `mene` restent inchangés dans leur contrat et leur comportement — les épreuves
« l'appariement d'un chemin à une route » (déjà existantes) continuent de les exercer directement,
sans modification.

## L'épreuve d'équivalence (point 2, exigée par le ticket)

`describe("la mémoïsation du graphe d'imports ne change pas le résultat", ...)` rejoue, sur le dépôt
réel, l'algorithme D'ORIGINE — `sourceAvecComposantsSansCache` (copie exacte de l'ancienne
`sourceAvecComposants`, sans aucun partage) pour les écrans et les départs, et `chemins:
cheminsDesignes(source)` sur le texte concaténé en entier (la méthode d'avant, pas l'union par
fichier) pour servir de témoin INDÉPENDANT de l'optimisation testée — et compare :

- **même population d'écrans** (les 50 routes, triées) ;
- **mêmes départs** ;
- **mêmes orphelins** (`ecransOrphelins` appelé sur les deux jeux de données).

Les trois passent sur le dépôt réel : la mémoïsation ne change rien à ce que le gardien voit.

Cette épreuve rejoue DÉLIBÉRÉMENT l'ancien algorithme coûteux (c'est le seul témoin possible). Son
coût (~3-4 s) vit dans un `beforeAll` à délai explicite élargi (30 000 ms), jamais dans un `it` ni
dans le chemin que le gardien utilise réellement — le test mesuré au § CONTEXTE n'a ni son délai ni
son contenu modifiés.

## Résultat mesuré (point 3 — objectif : moins de 1 s sous charge)

| | avant | après |
|---|---|---|
| `chaque écran est atteint depuis la barre…` (le test du ticket) | 2177-2361 ms | **9-12 ms** |
| import du module (construction `ECRANS`/`DEPARTS`) | ~2200-2380 ms | **~230-320 ms** |

Sous charge simulée (quatre `yes > /dev/null` en parallèle pendant l'exécution de Vitest) : le test
reste à **11 ms**. Bien en-deçà de l'objectif d'1 s, et très loin du délai de 5000 ms — aucune marge
n'a été rognée pour y arriver : aucune assertion retirée, aucun délai relevé sur ce test, aucune
population réduite (toujours 50 écrans, vérifié par l'épreuve d'équivalence).

## Interdits respectés

- Aucun délai relevé sur le test du § CONTEXTE (toujours le défaut Vitest du projet « unit »,
  5000 ms — vérifié : `testTimeout` n'est défini que pour le projet « isolation », à 30000 ms).
- Aucun `retries`, aucun `skip`, aucun `fixme`.
- Même population d'écrans (50), mêmes départs, mêmes orphelins — prouvé par épreuve sur le dépôt,
  pas affirmé.
- Aucune migration.

## Captures

Aucun écran touché ou créé par ce lot — uniquement des fichiers de test et d'outillage
(`tests/unit/navigation/atteignabilite-ecrans.test.ts`,
`scripts/lib/atteignabilite-ecrans.ts`). Pas de capture.

## Commandes jouées

- `pnpm typecheck` — vert.
- `pnpm lint` — vert (`--max-warnings 0`).
- `pnpm test` — trois passages complets, 530 fichiers / 5920 tests, tous verts chaque fois.
- `pnpm test:isolation` — 247 fichiers / 2274 tests, tous verts.
- `CI=1 pnpm verify` — vert de bout en bout (`format:check && typecheck && lint && test &&
  test:isolation && build`), capturé dans `/tmp/verify_out.log` (code de sortie 0).
- `npx vitest run tests/unit/navigation/atteignabilite-ecrans.test.ts --reporter=verbose` — rejoué
  à plusieurs reprises, au calme et sous charge CPU simulée, pour les mesures ci-dessus.

Pas de modification à `docs/arbitrages.md` : aucune règle métier ne change, c'est une correction de
performance d'un gardien existant, dont l'équivalence est prouvée par épreuve.
