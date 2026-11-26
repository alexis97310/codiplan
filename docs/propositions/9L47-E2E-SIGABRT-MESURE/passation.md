# 9L47-E2E-SIGABRT-MESURE — passation

## Ce qui était demandé

Poser l'instrumentation proposée par `9L41C` derrière `E2E_MESURE_MEMOIRE=1`, jouer la suite e2e entière une
fois avec la mesure, et nommer les scènes où la mémoire monte sans redescendre. Si la cause est prouvée et le
correctif petit, corriger ; sinon, la mesure est le livrable.

**La suite entière (2217 épreuves, 538 fichiers) n'a pas pu être jouée en UN seul worker continu dans cette
session** — raison ci-dessous. Ce qui suit est une mesure PROUVÉE mais PARTIELLE : les 27 fichiers
`zz-captures-*.spec.ts` (180 épreuves), joués en un seul worker continu, en conditions CI (`CI=1`,
`workers: 1`). Elle déplace la suspicion loin de l'hypothèse de `9L41C`, vers une cible plus précise.

## Pourquoi la suite entière n'a pas pu être jouée en un seul passage

Le harnais qui exécute cette session plafonne une commande à 60 minutes, et — point mesuré, pas supposé —
une commande arrêtée par ce plafond (ou dont un enfant continue en arrière-plan après le retour de la
commande) **perd ses écritures sur disque** : seule une commande qui se termine d'elle-même laisse un état
relu par la commande suivante. Mesuré deux fois : une tentative `nohup … & disown` a laissé le vrai processus
tourner (visible à `ps`) mais le dossier qu'il écrivait avait disparu à la commande suivante ; une tentative
avec un délai d'outil de 60 min, tuée au plafond, a produit le même résultat. La suite complète, extrapolée
depuis un échantillon de 15 fichiers/55 épreuves (3,8 min, dont l'essentiel est la compilation initiale), tourne
autour de **75 à 90 minutes** pour 2217 épreuves — au-delà de ce qu'une seule commande, dans ce harnais, peut
mener à bien ET laisser lisible. Le découpage par `--shard` a été écarté : chaque fragment démarre un worker
NEUF, donc une mémoire remise à zéro — il aurait caché exactement ce qu'on cherche, la charge accumulée par
UN worker sur toute la suite.

**Conséquence acceptée** : la mesure porte sur le sous-ensemble suspect (`zz-captures-*`, là où les trois
incidents ont été constatés), pas sur la suite entière. Ce qui suit le dit scène par scène.

## L'instrumentation (point 1 et 2)

`tests/e2e/setup/mesure-memoire.cjs`, chargé par `NODE_OPTIONS=--require` — posé par
`playwright.config.ts` au chargement de la configuration, donc avant que Playwright ne lance le premier
worker (`child_process.fork`, qui copie `process.env` du processus principal à cet instant). **Désactivé par
défaut** : sans `E2E_MESURE_MEMOIRE=1`, le fichier ne fait rien, et vérifié qu'aucun dossier `test-results/
mesure-memoire/` n'apparaît (voir « Épreuves jouées »).

Échantillonne par **intervalle de temps** (2 s), pas par épreuve — aucune scène e2e n'est modifiée, et un seul
navigateur sert des centaines d'épreuves dans un worker. Pour chaque échantillon : `process.memoryUsage()` du
worker, et la mémoire (`VmRSS`) de tous ses **descendants** — le worker lance Chromium comme processus enfant,
qui lance lui-même zygote/GPU/rendu.

**Un repli nécessaire, mesuré en vrai sur ce poste** : `/proc/<pid>/task/<tid>/children` (la méthode « propre »,
Linux ≥ 3.5) **n'existe pas** sous le noyau WSL2 de ce poste — `ENOENT` même sur un pid qui a des descendants
réels. Remplacé par un parcours de TOUT `/proc`, reconstruisant l'arbre par le champ `PPid:` de chaque
`/proc/<pid>/status` — universel, vérifié par `ps --forest` en parallèle d'une exécution réelle (le
`headless_shell` trouvé par `ps` était bien parmi les descendants retrouvés par ce parcours).

Un rapport JSON Playwright (`["json", {outputFile: "test-results/mesure-memoire-resultats.json"}]`) est ajouté
au tableau `reporter`, sous la même variable — `stats.expected/skipped/unexpected` suffit à confirmer qu'aucune
épreuve n'a été affaiblie par la mesure.

## La mesure (point 2)

`CI=1 E2E_MESURE_MEMOIRE=1 pnpm test:e2e tests/e2e/zz-captures-*.spec.ts` — 180 épreuves déclarées, 124 jouées
(56 sautées par leurs propres gardes `CAPTURES_9DO`/`CAPTURES_9EB1`, comportement attendu, inchangé), **0
imprévue**, en 324 s de suite (dont 220 s après le lancement du navigateur, dans UN seul worker continu —
`worker-2857795.ndjson`, 221 échantillons).

**Chromium (6 processus descendants — navigateur + zygote/GPU/rendu) reste PLAT** : 480 à 510 Mo tout le long,
sans tendance à la hausse ni à la baisse notable (oscillation normale), jusqu'à la fermeture en toute fin
(0 Mo, 0 processus, au démontage du worker).

**Le worker (processus Node, PAS le navigateur) monte en continu, sans jamais redescendre avant la fin** :

| t (s) | rss (Mo) | tas V8 utilisé — `heapUsed` (Mo) | tas V8 alloué — `heapTotal` (Mo) |
|---|---|---|---|
| 0 | 47,7 | 4,7 | 5,6 |
| 20 | 230,7 | 82,6 | 108,5 |
| 40 | 255,5 | 93,7 | 123,1 |
| 60 | 254,1 | 91,2 | 121,1 |
| 80 | 271,9 | 102,4 | 139,2 |
| 100 | 282,4 | 116,5 | 145,5 |
| 120 | 294,3 | 127,5 | 155,2 |
| 140 | 282,1 | 128,4 | 145,8 |
| 160 | 315,6 | 146,9 | 175,4 |
| 180 | 328,4 | 150,2 | 183,0 |
| 200 | 341,6 | 170,2 | 197,4 |
| 220 (juste avant le démontage) | 350,8 | 178,4 | 204,7 |
| démontage du worker | ≈350 | **15,1** | **16,8** |

`external` et `arrayBuffers` (mémoire native hors tas JS — typiquement les tampons d'image) restent
MINUSCULES tout le long (1,6 à 5,7 Mo, jamais plus de 1,8 Mo pour `arrayBuffers`) : la croissance n'est **pas**
une image de capture retenue en mémoire — chaque capture écrit directement sur disque (`page.screenshot({
path: … })`, jamais `testInfo.attach()`), confirmé par lecture des fichiers de scène. C'est le **tas V8 du
worker lui-même** qui croît, en lockstep avec `rss`.

**La chute au démontage est informative, pas du bruit** : `heapUsed`/`heapTotal` s'effondrent (178 → 15 Mo,
205 → 17 Mo) exactement au moment où le worker ferme navigateur/contextes, alors que `rss` reste quasiment
inchangé (~350 Mo — normal, le système d'exploitation ne rend pas les pages tout de suite après un ramasse-
miettes). Ce qui retenait cette mémoire était donc **atteignable et vivant jusqu'au démontage**, et libéré à ce
moment — pas une fuite inatteignable pour toujours, mais quelque chose qui vit **à l'échelle du worker entier**
plutôt qu'à l'échelle d'une épreuve ou d'un fichier.

## Ce que ceci prouve, et ce que ceci ne prouve pas

**Prouvé** : sur ce sous-ensemble, l'hypothèse de `9L41C` (« croissance progressive de la mémoire du
*navigateur* long-vécu d'un worker ») est **contredite** — Chromium ne croît pas. Ce qui croît sans
redescendre avant la toute fin, c'est le tas V8 du **processus Node du worker lui-même**. Une extrapolation
simple (178 Mo / 124 épreuves ≈ 1,4 Mo/épreuve de tas utilisé) sur les 2217 épreuves de la suite entière
donnerait un tas cumulé de l'ordre de 3 Go avant la fin — un ordre de grandeur compatible avec le plafond par
défaut du tas V8 de Node, et avec le symptôme exact de l'incident : un `FATAL ERROR` V8 « Allocation failed —
JavaScript heap out of memory » appelle `abort()`, qui lève **SIGABRT** — précisément le signal constaté,
et sur le **worker**, jamais sur `headless_shell` (dont la mémoire, mesurée ici, ne bouge pas).

**Non prouvé** :
- Que ce taux de croissance (et sa cause) soit le MÊME sur le reste de la suite — seul `zz-captures-*` a été
  mesuré, et ce sont justement les fichiers les plus chargés en captures d'écran et en navigation.
- L'objet précis retenu par le worker (closures de fixture, accumulateur dans un module partagé, état interne
  de Playwright) — établir cela demanderait une comparaison d'instantanés de tas (`v8.writeHeapSnapshot()`),
  non tentée ici, hors du budget de ce lot.
- Que la MÊME trajectoire, jouée sur 2217 épreuves en continu, atteigne réellement le plafond V8 au même point
  que les incidents observés (~2100e épreuve) — l'extrapolation linéaire est plausible, pas mesurée en continu.

## Pourquoi aucun correctif n'est posé

Le point 3 du ticket autorise un correctif seulement si la cause est PROUVÉE et le correctif PETIT. La cause
est **resserrée** (tas du worker, pas le navigateur) mais pas **identifiée** (quel objet, retenu par quoi) :
poser un correctif sur cette seule base serait deviner, pas corriger. La mesure est le livrable de ce lot.

## Proposition pour un prochain lot

- Un instantané de tas (`node --inspect` + `v8.writeHeapSnapshot()`, ou l'option native de Playwright si une
  existe pour les workers) pris toutes les N épreuves sous la même variable, pour comparer deux instantanés et
  voir CE QUI grossit — pas seulement DE COMBIEN.
- Jouer `zz-captures-*` fichier par fichier (chacun un worker neuf) pour voir si `heapUsed` REPART de zéro à
  chaque fichier (état par fichier) ou continue de grimper même en changeant de fichier dans le MÊME worker —
  déjà partiellement répondu ici (un seul worker a tenu les 27 fichiers, et la montée ne s'interrompt pas aux
  frontières de fichier visibles dans l'échantillon), mais un passage dédié le confirmerait fichier par fichier.
- Si un prochain lot dispose d'un budget de temps plus grand qu'une commande (ou d'un harnais qui persiste les
  écritures d'un processus tué par expiration), rejouer la suite ENTIÈRE avec cette même instrumentation pour
  obtenir la courbe complète demandée par ce ticket.

## Pourquoi ceci n'est pas une entrée dans `docs/arbitrages.md`

Rien n'est une règle métier : correction de harnais de mesure, sans effet sur le comportement de
l'application. Aucune règle ne change, donc aucune condition de réouverture à écrire.

## Captures

Aucun écran touché ni créé — ce lot ne modifie que l'outillage e2e (`playwright.config.ts`,
`tests/e2e/setup/mesure-memoire.cjs`). Pas de capture AVANT/APRÈS, pas de relance de `scripts/captures.mts`.

## Épreuves jouées

- `pnpm typecheck`, `pnpm lint`, `pnpm run format:check` : verts sur les deux fichiers touchés.
- Confirmé qu'en l'ABSENCE de `E2E_MESURE_MEMOIRE` : `pnpm exec playwright test
  tests/e2e/9edz-connexion.spec.ts` passe 6/6 à l'identique, et `test-results/mesure-memoire/` n'existe même
  pas après coup (Playwright vide son propre `outputDir` au démarrage ; rien ne le recrée sans la variable).
- Avec la variable : même fichier, 6/6, vérifié que `test-results/mesure-memoire/worker-<pid>.ndjson` existe
  et porte des échantillons cohérents ; puis 15 fichiers/55 épreuves pour confirmer la détection des
  descendants Chromium en conditions réelles (6 processus, ~490 Mo) avant de mesurer le sous-ensemble suspect.
- La mesure retenue : `CI=1 E2E_MESURE_MEMOIRE=1 pnpm test:e2e tests/e2e/zz-captures-*.spec.ts` — 124 passées,
  56 sautées (attendu), 0 imprévue, 0 chancelante.
- `pnpm test` : 540 fichiers, 6098 tests, vert.
- `pnpm test:isolation` : 268 fichiers, 2581 tests. Un premier passage a donné 1 échec isolé
  (`tests/isolation/document.test.ts`, forme du plan `EXPLAIN` attendue — non lié à ce lot, aucun fichier
  touché ici ne s'en approche) ; rejoué seul puis la suite entière : vert les deux fois. Flaky,
  dépendant des statistiques PostgreSQL vivantes au moment de l'`EXPLAIN`, plausiblement perturbées par les
  nombreuses exécutions e2e menées dans la même session sur la même base `codiplan_test` (mémoire :
  TEST et E2E partagent cette base). Non touché, conformément à l'interdit de modifier un test pour faire
  passer la vérification.
- `CI=1 pnpm verify` (format:check + typecheck + lint + test + test:isolation + build) : vert.
- Aucune assertion retirée, élargie, ni `skip`/`fixme`/`retries` touché.

## Ce qui reste dû

- La courbe de mémoire sur la suite ENTIÈRE (2217 épreuves) — non obtenue, pour la raison de harnais exposée
  plus haut.
- L'identification de l'objet précis retenu par le worker.
