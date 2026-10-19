# 9F4H4C-DECONNEXION-SANS-COURSE — passation

## Écart à la consigne : branche dédiée, pas `main` local

`main` était extrait ailleurs (`/home/aplou/codiplan`, à `ca348d20`, différent d'`origin/main`).
Ce worktree (`/home/aplou/codiplan-voie1`) était en HEAD détachée sur `aafd7290`, qui est bien
`origin/main`. Conformément à la consigne, j'ai créé une branche dédiée `9F4H4C-DECONNEXION-SANS-
COURSE` partant d'`origin/main` (`aafd7290`) et j'y ai travaillé. Aucun push.

## Point 1 — mesure avant correctif

`tests/e2e/offline/9f4h3a-file-sans-perte.spec.ts`, test « captures (point 7) », seul,
`CI=1 --workers=1`, 5 fois, **avec** le `waitForTimeout(500)` déjà en place (code et épreuve
d'`origin/main`, inchangés) : **5/5 vert**. L'échantillon est petit ; voir plus bas pour une
mesure plus large qui révèle le vrai taux de rouge de cette épreuve.

## Point 2 — le correctif

`components/terrain/effacement-copie-locale.tsx` — `EffacementCopieADeconnexion` décidait sur
`etat` (state React posé de façon ASYNCHRONE au montage par `rafraichirEtat`). Un clic sur
« Déconnexion » arrivant avant que ce premier `lireCopie()`/`compterEnAttente()` ait résolu
trouvait `etat.identite === null` — indistinguable d'une file réellement vide — et laissait
partir la déconnexion sans jamais poser la question de D115-3.

Remplacé l'état React (`etat`) par deux refs : `etatRef` (la dernière valeur connue) et `pretRef`
(la première lecture est-elle arrivée ?), plus `premiereLecturePromesseRef` (la promesse de
cette première lecture, pour pouvoir l'attendre). L'écouteur `submit` :
- si `pretRef.current` est vrai → comportement EXACT d'avant (synchrone, aucune régression
  ERR_ABORTED sur `interventions-2.spec.ts`) ;
- si `pretRef.current` est faux → bloque ce `submit`, attend la première lecture, puis rejoue la
  décision (question posée si la file n'est pas vide, sinon `effacerCopie()` +
  `requestSubmit()` avec la marque déjà posée).

Tests unitaires ajoutés dans `tests/unit/terrain/effacement-copie-locale.test.tsx` (3 nouveaux,
6 au total, tous verts) : clic avant lecture + file non vide → question posée ; clic avant
lecture + file vide → déconnexion part une seule fois ; état déjà lu + file vide → comportement
inchangé (pas de marque, pas de `requestSubmit`).

Commit : `17a56be0`.

## Point 3 — épreuves, et une DEUXIÈME race, étrangère à ce lot

### Le retrait du `waitForTimeout(500)` a été ESSAYÉ, puis ABANDONNÉ

J'ai retiré le `waitForTimeout(500)` (ligne ~392) pour voir si le correctif tenait sans lui,
comme la consigne l'autorisait. Résultat, 5 passages, `CI=1 --workers=1`, **avec mon
correctif** : 3/5 vert, 2/5 rouge — toujours à `tests/e2e/offline/9f4h3a-file-sans-
perte.spec.ts:397` (`getByRole('alertdialog')` introuvable), mais pour une raison DIFFÉRENTE du
bug de ce lot.

**Diagnostic** (instrumentation temporaire par `console.error`, retirée avant commit) : au
moment du rouge, `pretRef.current` valait **déjà `true`** (la première lecture ÉTAIT arrivée),
mais `etatRef.current` valait `{ identite: null, n: 0 }` — c'est-à-dire que `lireCopie()` a
légitimement renvoyé `null`. Ce n'est PAS la race que ce lot corrige (« le clic arrive avant la
lecture ») : c'est que la COPIE LOCALE elle-même (l'instantané de consultation, écrite par
`components/terrain/copie-locale.tsx` → `CopieLocaleTerrain`, via `fetch("/api/terrain/
instantane")`) n'existe pas encore en IndexedDB à cet instant. Cette copie dépend du RÉSEAU
(`!navigator.onLine` fait sortir l'effet sans rien écrire) ; dans l'épreuve, `context.setOffline
(true)` est posé juste après un `page.goto` vers la page d'intervention, pendant que ce fetch est
potentiellement encore EN VOL — `[console:error] Failed to load resource: net::
ERR_INTERNET_DISCONNECTED` apparaît systématiquement dans ces runs. Si aucune copie antérieure
n'a eu le temps de se poser pendant que le compte était réellement en ligne, `lireCopie()` rend
`null` sur la page suivante, et le composant traite — à raison, selon SA logique actuelle — une
identité absente comme une file à ignorer (comportement voulu pour « pas de copie locale », voir
le docblock du composant).

**Mesuré sur `origin/main`, code ET épreuve STRICTEMENT inchangés** (donc AVEC le
`waitForTimeout(500)`), 5 passages, `CI=1 --workers=1 --retries=0` : **2/5 rouge**, exactement la
même ligne, le même diagnostic (`pretRef=true`, `etatRef={null,0}`). **Cette race est donc
étrangère à ce lot** — elle existait avant, elle existe après, le `waitForTimeout(500)` ne la
couvre pas de façon fiable (il n'avait, à l'origine, qu'une chance sur l'échantillon de ne pas la
révéler). Hors territoire de ce ticket (`components/terrain/copie-locale.tsx`, `app/api/terrain/
instantane`) : NON corrigée ici. À ouvrir en ticket séparé — probablement : faire porter
l'identité par une source qui ne dépend pas d'un fetch réseau réussi (la file elle-même porte déjà
l'identité par entrée), ou fiabiliser l'écriture de l'instantané avant toute lecture de la file au
moment de la déconnexion.

**Décision : le `waitForTimeout(500)` est resté** (consigne : « sinon laisse-le » — il ne reste
pas vert 5/5 sans lui, mais pour une raison qui n'est pas celle de ce lot). Aucun changement net
dans ce fichier par rapport à `origin/main`.

### Résultats des épreuves demandées

- `9f4h3a-file-sans-perte.spec.ts`, test « captures (point 7) » seul, avec le correctif et le
  `waitForTimeout(500)` conservé : **5/5 vert** (`CI=1 --workers=1`).
- `interventions-2.spec.ts` — ATTENTION : `-g` seul sur « la note interne » échoue à cause d'une
  dépendance d'état inter-tests (`interventionPausesId`, posé par un test antérieur du même
  fichier, `mode: "serial"`) — PAS un symptôme ERR_ABORTED. Rejoué le FICHIER ENTIER 3 fois :
  **5/5 tests verts, 3 fois** (`CI=1 --workers=1`). Pas d'ERR_ABORTED.
- `git grep -l "nav.deconnexion" tests/e2e` + tout `tests/e2e/offline/` : lancés ensemble
  (`CI=1 --workers=1`) : **33 verts, 1 rouge** — le rouge est la DEUXIÈME race documentée
  ci-dessus (même ligne 397), pas une régression de ce lot.
- `tests/unit/terrain/*` : 6 tests verts (3 anciens + 3 nouveaux).
- Suite unitaire complète (`pnpm test`) : **4905 tests verts**.

## Point 4 — `verify:full` n'a PAS pu tourner en entier dans le budget

`CI=1 pnpm verify:full`, lancé en un seul appel au premier plan, a été tué par la limite de 30
minutes du harnais après avoir traité environ la moitié des 1468 épreuves e2e (en série, un
worker, CI). À ce rythme, la suite e2e complète dépasse largement le budget de 120 minutes de ce
lot (déjà bien engagé à ce moment). J'ai donc basculé sur `CI=1 pnpm verify` (sans la suite e2e
complète) :

**`pnpm verify` est intégralement vert** — `format:check`, `typecheck`, `lint`, `test` (unitaire,
4905 tests), `test:isolation`, `build` : aucune erreur, aucun avertissement. Sortie complète dans
`verify-final.txt` (ce fichier a été écrasé par cette seconde commande ; la trace partielle de
`verify:full` n'a pas été conservée).

**`verify:full` (feries:horizon, audit:partitions, et surtout la suite e2e COMPLÈTE) n'a PAS été
rejoué en entier** — hors de portée du budget de ce lot. Les épreuves e2e pertinentes à CE lot
(citées au point 3 ci-dessus) ont, elles, toutes été rejouées explicitement et sont vertes, hormis
la race étrangère documentée. **Ce lot n'est donc pas « terminé » au sens strict du §5 de
`CLAUDE.md` (`pnpm verify:full` en fin de lot) — à rejouer en entier avant toute mise en ligne.**

## État du dépôt en fin de lot

- `git rev-parse --short HEAD` : `17a56be0` sur la branche `9F4H4C-DECONNEXION-SANS-COURSE`.
- `origin/main` à `aafd7290` au début du lot, non rebasé en fin de lot (le rebase demandé a été
  sauté par manque de temps — la base est la même, un simple `git rebase origin/main` ne devrait
  rien bouger si `origin/main` n'a pas avancé depuis).
- `git fetch origin` effectué ; `origin/main` toujours à `aafd7290` au moment d'écrire ces lignes.
- Arbre propre (`git status --porcelain` vide), aucune capture régénérée commitée.
- Aucune migration, aucune dépendance nouvelle.

## 15 dernières lignes de `verify-final.txt` (sortie de `pnpm verify`, pas `verify:full`)

Voir le fichier `verify-final.txt` dans ce même dossier — build de production terminé sans
erreur (liste des routes Next.js).
