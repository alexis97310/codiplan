# 9F5A-REPRISE-9F5 — Passation

## Verdict : aucune épreuve rouge stable attribuable au lot 9F5

Contrairement au journal de la file (« ROUGE au 1er passage 00:44, ROUGE au 2e 01:43,
environ 60 min chacun »), cette session **n'a reproduit aucun échec** en rejouant
exactement la même commande, sur le même commit (après rebase sur `origin/main`) :

```
CI=1 pnpm verify:full → CODE_SORTIE=0, en un seul appel, premier plan, ~59 minutes
```

Journal complet : `docs/propositions/9F5A-REPRISE-9F5/verify-final.txt`.

## Étape 1 — rejeu de la garde

`git log --oneline origin/main..9F5-AUDIT-FONCTIONNEL-PARCOURS-garde` : 10 commits, du
point de départ `a576f175` au dernier `202e5be5` (local : `6b667208` après rebase, les
hashes changent car `origin/main` a avancé de 9F4H3A-FILE-SANS-PERTE et ses deux reprises
entre-temps). `git cherry-pick a576f175..9F5-AUDIT-FONCTIONNEL-PARCOURS-garde` sur une
branche partie du HEAD détaché (= `origin/main` au début de cette session, `c39b6332`) :
**les 10 commits se sont rejoués sans un seul conflit.** `pnpm verify` vert immédiatement
après (format:check, typecheck, lint, test 4887/4887, test:isolation 1631/1631, build).

## Étape 2 — chercher l'épreuve rouge

1. **Pistes du journal, mesurées et écartées** :
   - Le harnais d'audit (`playwright.audit-fonctionnel.config.ts`, `testDir:
     "./tests/audit-fonctionnel"`) n'est **pas** ramassé par `pnpm test:e2e`
     (`testDir: "./tests/e2e"` dans `playwright.config.ts`, répertoires disjoints). Lu le
     fichier en entier : l'isolation est déjà construite et commentée par 9F5 lui-même.
   - Aucun gardien du dépôt ne rougit sur les fichiers ajoutés (`pnpm lint`,
     `pnpm typecheck`, `pnpm test` verts sur l'intégralité du dépôt après rebase).
   - Aucune fuite de données semées par l'audit dans la base des e2e : la suite e2e
     complète passe (voir ci-dessous), et le harnais d'audit utilise le même
     `globalSetup` que les e2e (`tests/e2e/setup/global.ts`) sans écrire hors de
     `docs/audits/9F5-fonctionnel/`.
2. **Suite e2e en parallèle** (`pnpm test:e2e`, workers par défaut) :
   **17 échecs** sur 1465 scénarios (`e2e-parallele.txt`). Tous des symptômes de
   contention sous parallélisme complet (timeouts d'attente, compteurs de courriels
   décalés, `scrollWidth` différent, ordre de clics) — aucun ne touche
   `tests/audit-fonctionnel/`.
3. **Chacun des 17 rejoué seul, `CI=1 --workers=1`** (`e2e-serie-echecs.txt`) :
   **76/76 verts**. Confirme que c'était du bruit de parallélisme, pas un défaut.
4. **Suite e2e complète, `CI=1` (un seul worker, comme `verify:full`)**
   (`e2e-serie-complete.txt`) : **1416 passés, 1 flaky (retry réussi), 48 ignorés,
   55.7 min**. Le seul flaky —
   `tests/e2e/offline/9f4h3a-file-sans-perte.spec.ts:368` (point 7, dialogue de
   confirmation de déconnexion) — est un fichier que 9F5 n'a jamais touché
   (`git log --follow` : dernière modification par 9F4H3A-FILE-SANS-PERTE et ses
   reprises). Étranger au lot, et déjà absorbé par `retries: 1` sous `CI`.
5. **Mesure finale en un seul appel** (`verify-final.txt`) : `CI=1 pnpm verify:full`,
   premier plan, commande unique — **vert, code retour 0**, même résultat qu'à l'étape 4
   pour la portion e2e.

## Ce qui a été corrigé

**Rien côté code.** Aucune correction n'a été nécessaire : le harnais d'audit (9F5) était
déjà correctement isolé (`testDir` disjoint), aucun gardien ne rougit, et la suite e2e
complète passe de bout en bout sous `CI=1`. Les seules écritures de cette session sont
les artefacts de mesure sous `docs/propositions/9F5A-REPRISE-9F5/` et cette passation.

## Hypothèse sur les deux ROUGE de la file

`CI=1 pnpm verify:full` prend ~59 minutes sur cette machine (dont 55.7 min pour
`test:e2e` seul, 1465 scénarios sous un seul worker). C'est une durée proche de tout
plafond de temps raisonnable pour une vérification automatique. La propre passation du
lot 9F5 notait déjà, avant cette session, un risque de contention machine : « la
différence vient du NOMBRE de scénarios : 1462 contre 19 » et « probablement partagée
avec d'autres sessions du dépôt (plusieurs ports PostgreSQL jetables actifs en
parallèle) ». Cette session n'a mesuré aucun défaut fonctionnel ; l'explication la plus
probable des deux ROUGE indépendants est une question de **délai ou de ressources
partagées au moment de la mesure**, pas un défaut du code ou des tests ajoutés par 9F5 —
mais cela reste une hypothèse non prouvée : cette session n'a pas eu accès au journal
détaillé des deux tentatives de la file.

## État du dépôt

`git fetch origin` : `origin/main` toujours à `c39b6332` (aucun nouveau commit poussé
depuis le début de cette session). Pas de rebase nécessaire. `CI=1 pnpm verify` rejoué
une dernière fois : vert. `git status --porcelain` vide hors de ce territoire. Travail
sur la branche locale `9F5A-REPRISE-9F5`, jamais poussé.

Les centaines de captures d'autres lots (`docs/propositions/<AUTRE-LOT>/captures/*.png`)
régénérées comme effet de bord de `pnpm test:e2e` ont été restaurées
(`git checkout --`) ou supprimées quand nouvelles (`??`) à chaque mesure — aucune ne doit
apparaître dans le commit de ce lot.
