# 9L48-E2E-TAS-WORKER-FUITE — passation

## Ce qui était demandé

`9L47` avait prouvé que, sur `zz-captures-*` (124 épreuves, un seul worker continu), le tas V8 du
**worker** (jamais Chromium) monte sans redescendre avant le démontage. Ce lot devait trouver CE QUI
retient cette mémoire — instantanés de tas, comparaison, correctif si la cause est prouvée et petite,
sinon la mesure reste le livrable.

**Résultat : une cause réelle a été trouvée, prouvée et corrigée EN ISOLATION (compteur à l'appui) —
puis le correctif a été RETIRÉ, parce que mesuré une deuxième fois, il ne change RIEN à la courbe que
le ticket demande de faire baisser.** La cause dominante reste non identifiée. Ce qui suit explique les
deux, et pourquoi le dépôt ne porte, à la fin, que l'instrumentation de mesure — comme `9L47`.

## L'instrumentation ajoutée (point 1)

`tests/e2e/setup/mesure-memoire.cjs`, sous une seconde variable `E2E_INSTANTANES_TAS=1` (indépendante,
au-dessus de `E2E_MESURE_MEMOIRE=1` de `9L47`, qu'elle exige) : à l'échantillon n°1, n°10 et n°50 (environ
0, 20 et 100 s après le lancement du navigateur — pas par épreuve, pour la même raison que `9L47` :
aucun crochet par épreuve n'existe à ce niveau de chargement), `v8.writeHeapSnapshot()` écrit un instantané
du tas du worker dans `test-results/instantanes-tas/` (gitignored, comme `test-results/` en entier).

**Avant l'instantané, deux `global.gc()`** si `--expose-gc` est actif (`NODE_OPTIONS=--expose-gc`, posé
à la main sur la ligne de commande, jamais par défaut) — sans quoi un instantané peut montrer de la
mémoire juste pas encore balayée par un ramasse-miettes paresseux, qui ressemble à une fuite sans en
être une. **C'est précisément ce point qui a permis de trancher** (voir plus bas) : la mémoire mesurée
reste quasi identique avec ou sans ce `gc()` forcé — donc réellement atteignable, pas un artefact de
calendrier de ramasse-miettes.

## La mesure (point 2) — toujours la même forme

`CI=1 E2E_MESURE_MEMOIRE=1 E2E_INSTANTANES_TAS=1 pnpm test:e2e tests/e2e/zz-captures-*.spec.ts` — 124
épreuves jouées, 56 sautées (attendu), 0 imprévue, chaque fois (répété quatre fois dans ce lot, avec et
sans correctif, avec et sans `--expose-gc` : toujours 124/56/0).

| point de mesure | taille de l'instantané | tas utilisé V8 (recoupé avec 9L47) |
|---|---|---|
| échantillon 1 (~0 s, 1 test) | 5,9 à 6,0 Mo | ~4,7 Mo |
| échantillon 10 (~20 s, ~11 tests) | ~69,5 Mo | ~85 Mo |
| échantillon 50 (~100 s, ~56 tests) | **100,1 à 100,4 Mo** | ~170 Mo |

Quatre passages indépendants (patché/non patché, avec/sans `--expose-gc`+double `gc()`) retombent tous
dans 100,1–100,4 Mo à l'échantillon 50 — **la mesure est stable et reproductible**, et **le `gc()` forcé
ne change rien** : ce qui est mesuré est vraiment retenu, pas simplement pas-encore-balayé.

## Ce que l'histogramme du tas montre (point 2)

Décodage artisanal du format JSON de `v8.writeHeapSnapshot()` (`nodes`/`edges` + tables `strings`, champ
par champ selon `snapshot.meta`) — aucun outil existant dans ce dépôt ne le fait, écrit pour ce lot,
**non commité** (`/tmp`, jetable, ne survit pas à la session).

À l'échantillon 50 : le plus gros contributeur **statique** (dictionnaire `fr.ts`, base MIME) est stable
et sans rapport — écarté. Ce qui CROÎT avec le nombre d'épreuves jouées, par comptage direct des nœuds :

| type:nom | compte à l'échantillon 50 | attendu si aucune épreuve n'était retenue |
|---|---|---|
| `object:Page` | **55** | ~1 (la page de l'épreuve EN COURS) |
| `object:CRPage` | **54** | ~1 |
| `object:BrowserContext` | 5 | ~1 |
| `object:Request` | **4159** | quelques dizaines |
| `object:Response` | **4075** | quelques dizaines |
| `object:ManualPromise` | 37 284 | quelques centaines |

**55 pages vivantes pour ~56 épreuves jouées** : la quasi-totalité des pages de test, y compris celles de
fichiers déjà terminés et fermés depuis plusieurs minutes, restent ATTEIGNABLES (pas seulement allouées).
`BrowserContext`, lui, reste bas (5) — les contextes se ferment normalement ; ce sont les PAGES qui ne
meurent jamais, malgré leur fermeture.

## La cause trouvée, prouvée, et corrigée — puis retirée

### Le mécanisme

`playwright-core` (`lib/server/chromium/crNetworkManager.js`, classe interne `ResponseExtraInfoTracker`)
garde, par requête réseau, une entrée dans une `Map` tant qu'elle n'a pas reçu AUTANT d'événements CDP
`Network.responseReceivedExtraInfo` que de réponses (`info.responses.length <= info.responseReceivedExtraInfo.length`),
même après `loadingFinished`/`loadingFailed`. Sur une chaîne de redirection (notre `ouvrirUneSession` en
traverse plusieurs à chaque connexion, donc à peu près CHAQUE épreuve), ce décompte peut rester
définitivement inégal — l'entrée n'est alors **jamais** retirée de la `Map`. Chaque entrée retenue
retient `Response`, son `Request`, et `request.attribution.page` : **la page entière**, avec tout ce
qu'elle possède (`Frame`, `CRNetworkManager`, `Keyboard`, etc.).

### La preuve que ce chemin s'exécute vraiment

Compteur temporaire posé directement dans le fichier installé (pas commité, retiré avant la fin du
lot) : **256 appels à `_stopTracking` pour 6 épreuves** d'un seul fichier (`9edz-connexion.spec.ts`) —
le code concerné tourne bien, à chaque connexion.

### Le correctif essayé

`pnpm patch playwright-core@1.56.1` : une fois `loadingFinished`/`loadingFailed` reçu, arrêter le suivi
dans TOUS les cas (plus de condition sur le compte d'événements) — au prix, rare, de ne pas patcher les
en-têtes bruts d'une réponse de redirection arrivée en retard. Patch généré, commité dans
`patches/playwright-core@1.56.1.patch`, `pnpm.patchedDependencies` posé dans `package.json`, `pnpm install`
relancé, et RÉ-VÉRIFIÉ que le fichier installé porte bien le correctif (toutes les résolutions : store
patché, `.pnpm/node_modules/` partagé, arborescence sous `playwright@1.56.1` — les trois pointent vers la
MÊME entrée patchée).

**La version stable la plus récente (1.65.1, neuf versions au-dessus de notre 1.56.1 — vérifié par
téléchargement du paquet et extraction du bundle) porte EXACTEMENT la même condition, inchangée** : ce
n'est pas un bug déjà connu et corrigé en amont qu'une mise à jour aurait réglée.

### Pourquoi il est retiré malgré la preuve

Remesuré avec le correctif actif, dans les mêmes conditions (`CI=1 E2E_MESURE_MEMOIRE=1
E2E_INSTANTANES_TAS=1 pnpm test:e2e tests/e2e/zz-captures-*.spec.ts`) : **126,1 Mo à l'échantillon 50 —
contre 100,1 à 126,8 Mo sans lui**, c'est-à-dire **aucune réduction mesurable**, dans le bruit des quatre
passages de ce lot. Le correctif est réel (le compteur le prouve), petit, et sans risque pour les
assertions — mais il ne règle PAS ce que ce ticket demande de régler : la courbe qui mène au SIGABRT ne
change pas. Le garder aurait ajouté une dépendance patchée (fichier `patches/`, champ
`pnpm.patchedDependencies`, charge d'entretien à chaque mise à jour de `playwright-core`) pour un
bénéfice qui ne se voit nulle part dans la mesure. `git checkout -- package.json pnpm-lock.yaml`,
`rm -rf patches/`, `pnpm install` : le dépôt est revenu à l'état exact d'avant ce correctif, vérifié
par `grep` qu'aucune trace n'en subsiste dans `node_modules`.

## Ce qui a été écarté comme cause (dans l'ordre où c'est tombé)

- **Croissance de Chromium** — déjà écarté par `9L47`.
- **Artefact de calendrier de ramasse-miettes** (la mémoire serait « juste pas encore balayée ») — écarté
  par le `global.gc()` forcé × 2 : la taille ne change pas.
- **`CRBrowser._crPages` (registre des pages au niveau du navigateur)** — instrumenté directement (compteur
  posé dans le fichier installé, retiré ensuite) : sa taille reste à 0 ou 1 avant CHAQUE détachement, sur
  248 détachements observés. Les pages sont bien retirées de CE registre à la fermeture ; elles restent
  pourtant atteignables par un autre chemin.
- **Montée en version de `playwright-core`** — écarté : le code en cause est identique en 1.65.1.
- **`ResponseExtraInfoTracker`** — cause réelle, prouvée, corrigée, mais insuffisante seule (voir plus haut).

## Ce qui reste non identifié

Le graphe des rétenteurs d'une page vivante (balayage complet des arêtes entrantes, pas un échantillon —
354 rétenteurs directs pour une seule page à l'échantillon 50) ne montre QUE des objets que la page
possède elle-même (`CRPage`, `FrameSession`, `Keyboard`, `Frame`, `CRNetworkManager`) et des objets
`Request`/`Response` dont le champ `attribution.page` referme le cycle. Aucune structure EXTERNE à ce
cycle (registre, tableau, `Map`) n'a été trouvée qui le retiendrait depuis l'extérieur — alors que le
`gc()` forcé prouve que quelque chose le retient bel et bien. Deux pistes non tranchées, hors budget de ce
lot :
- Une racine native (poignée V8 persistante tenue par le transport CDP, un gestionnaire C++, invisible
  dans un instantané JS classique) ;
- Une structure de pile d'erreur mise en cache paresseusement par V8 (`CallSiteInfo`) jamais matérialisée
  (`.stack` jamais lu), qui retiendrait transitivement un objet de la page — piste explorée mais non
  confirmée : le décodage artisanal du format d'instantané traite peut-être mal certains types d'arête
  (`hidden`) dont l'encodage diffère de celui des arêtes `property`, ce qui a produit au moins une étiquette
  d'arête fausse pendant l'investigation (la chaîne littérale `"(GC roots)"` lue par erreur comme nom de
  propriété) — sans remettre en cause l'identité des NŒUDS retenteurs trouvés, seulement le nom affiché de
  l'arête qui y mène.

## Proposition pour un prochain lot

- Reprendre le correctif `ResponseExtraInfoTracker` (petit, prouvé, sans risque) n'a de sens que GROUPÉ
  avec l'identification de la rétention dominante — seul, il ne vaut pas la charge d'un `pnpm patch`.
- Un outil de comparaison d'instantanés plus fiable que le script artisanal de ce lot (le module `heapsnapshot`
  de `node:v8` reste expérimental ; un outil tiers conforme au format Chrome DevTools — hors dépôt,
  à exécuter manuellement, jamais commité) pour obtenir la VRAIE chaîne de rétenteurs jusqu'à une racine,
  sans les limites du décodage manuel exposées ci-dessus.
- Si aucune cause supplémentaire n'est trouvée, la mitigation qui reste disponible SANS toucher à
  `playwright-core` : réduire la part du budget de 75-90 minutes par un sous-découpage qui garde un seul
  worker continu mais limite son espérance de vie (hors де `--shard`, qui remet un worker à zéro et
  masquerait la charge accumulée — déjà écarté par `9L47` pour la même raison).

## Pourquoi ceci n'est pas une entrée dans `docs/arbitrages.md`

Aucune règle métier : outillage de diagnostic e2e, sans effet sur le comportement de l'application. Le
seul changement de code livré (`tests/e2e/setup/mesure-memoire.cjs`) est désactivé par défaut, comme son
prédécesseur `9L47`.

## Captures

Aucun écran touché ni créé — ce lot ne modifie que l'outillage e2e. Pas de capture AVANT/APRÈS, pas de
relance de `scripts/captures.mts`.

## Épreuves jouées

- `pnpm exec eslint tests/e2e/setup/mesure-memoire.cjs` : vert.
- `pnpm test` : 540 fichiers, 6098 tests, vert.
- `pnpm test:isolation` : 268 fichiers, 2581 tests, vert (aucun flaky cette fois, contrairement à `9L47`).
- `CI=1 pnpm verify` (format:check + typecheck + lint + test + test:isolation + build) : vert, code de
  sortie 0.
- Quatre exécutions complètes de `tests/e2e/zz-captures-*.spec.ts` sous `CI=1
  E2E_MESURE_MEMOIRE=1 E2E_INSTANTANES_TAS=1` (avec/sans `--expose-gc`, avec/sans le correctif retiré
  depuis) : 124 passées, 56 sautées, 0 imprévue, 0 chancelante — chaque fois.
- Aucune assertion retirée, élargie, ni `skip`/`fixme`/`retries` touché.
- `git status --porcelain` final : seul `tests/e2e/setup/mesure-memoire.cjs` modifié (hors fichiers
  étrangers à ce lot déjà présents dans l'arbre de travail — captures PNG sous `docs/propositions/9G2B-*`
  et `9H1B-*`, non produites par ce lot, non touchées).

## Ce qui reste dû

- L'identification de la rétention DOMINANTE (celle qui explique les 55 pages vivantes).
- La courbe sur la suite ENTIÈRE (2217 épreuves) — toujours hors budget d'une seule commande dans ce
  harnais, comme noté par `9L47`.
