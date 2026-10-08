# 9EO-TAS-DU-BUILD — passation

## Etat de depart

- `git log --oneline origin/main -5` (au debut de session, apres `git fetch origin`) :
  ```
  4e3004d7 9EM-CORRECTIFS-ALEXIS-08-10 — passation
  6c9aa67e 9EM-CORRECTIFS-ALEXIS-08-10 — captures AVANT/APRÈS (/clients, /parc)
  591e912f 9EM-CORRECTIFS-ALEXIS-08-10 — commercial référent, seuil parc 480 px, h1 de Page
  4f841e0b 9EKA-REPRISE-9EK-1 — passation : cause du rouge tardif, tableau de couverture du ticket, verify:full entier vert après correctif
  9598cc65 9EKA-REPRISE-9EK-1 — afterAll insensible à la casse : ...
  ```
  La session a travaillé depuis ce worktree, dont le HEAD détaché pointait déjà exactement sur
  `origin/main` (`4e3004d7`) — aucune mise à jour nécessaire.
- `free -m` : total 11957 Mo, used 1232 Mo, free 7605 Mo, buff/cache 3460 Mo, available 10725 Mo ;
  swap total 8192 Mo, used 211 Mo.
- `nproc` : 24.
- Script `build` exact avant correctif (package.json) :
  `"build": "NODE_OPTIONS=\"${NODE_OPTIONS:-} --max-old-space-size=3072\" next build"`.
- `9EEA-REPRISE-9EE-2` n'apparaît pas dans les 5 derniers commits d'`origin/main` : la garde
  `9EE-TP-UX4-1-FICHE-INTERVENTION-2-garde` n'a donc pas encore été reprise/publiée. Les deux
  branches gardes citées par le pilote existaient bien en local : `9EE-TP-UX4-1-FICHE-INTERVENTION-2-garde`
  et `9EK-TP-UX5-2-CREATIONS-2-garde`.

## Ce que j'ai change (et ce que ca change pour l'exploitation)

Une seule ligne de `package.json`, script `build` uniquement :
`--max-old-space-size=3072` → `--max-old-space-size=4096`. `NODE_OPTIONS` reste ajouté
(`${NODE_OPTIONS:-}` conservé), aucun autre caractère du fichier modifié.

Pour l'exploitation : la machine de build (CI comme poste de développement) doit disposer d'au
moins ~3,6 Go de RSS disponibles pour `next build` (mesuré, voir tableau ci-dessous) — contre
~3,3 Go avant. Sur ce poste (11,9 Go RAM, 7,6 Go libres au repos), la marge reste confortable.
Aucun changement de comportement fonctionnel : `next build` produit le même bundle, seule la
limite haute du tas V8 du worker de vérification de types change.

## Ce que j'ai mesure (comptes AVANT/APRES)

**Etape 1 — verification independante par garde, dans un worktree temporaire dedie
(`pnpm install --frozen-lockfile` puis `CI=1 pnpm verify` une fois, au premier plan) :**

| Garde | format:check | typecheck | lint | test | test:isolation | build (3072, tel quel) |
|---|---|---|---|---|---|---|
| `9EE-TP-UX4-1-FICHE-INTERVENTION-2-garde` | vert | vert | vert | vert (421 fichiers, 4430 tests) | vert (170 fichiers, 1514 tests) | **ROUGE** — OOM |
| `9EK-TP-UX5-2-CREATIONS-2-garde` | vert | vert | vert | vert (421 fichiers, 4430 tests) | vert (170 fichiers, 1512 tests) | **ROUGE** — OOM |

Pour les deux gardes, la **premiere etape rouge est `build`**, exactement la meme panne
(sortie quasi identique, seuls les PID et horodatages GC changent) :

```
> codiplan@0.1.0 build /home/aplou/tas-9EE
> NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=3072" next build

   ▲ Next.js 15.5.23
   Creating an optimized production build ...
 ✓ Compiled successfully in 12.2s
   Linting and checking validity of types ...

<--- Last few GCs --->

[2993398:0x3851e000]    40293 ms: Mark-Compact 3014.5 (3109.6) -> 2999.5 (3110.9) MB, pooled: 0 MB, 825.56 / 0.00 ms  (average mu = 0.061, current mu = 0.023) allocation failure; scavenge might not succeed
[2993398:0x3851e000]    41124 ms: Mark-Compact 3015.8 (3110.9) -> 3001.0 (3112.4) MB, pooled: 0 MB, 811.38 / 0.00 ms  (average mu = 0.043, current mu = 0.025) allocation failure; scavenge might not succeed

<--- JS stacktrace --->

FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----
 1: 0xe46bbe node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/usr/bin/node]
 2: 0x1244310 v8::Utils::ReportOOMFailure(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [/usr/bin/node]
 3: 0x12445e7 v8::internal::V8::FatalProcessOutOfMemory(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [/usr/bin/node]
 4: 0x14734f5  [/usr/bin/node]
 5: 0x1473523  [/usr/bin/node]
 6: 0x148c5fa  [/usr/bin/node]
 7: 0x148f7c8  [/usr/bin/node]
 8: 0x1cf8351  [/usr/bin/node]
Next.js build worker exited with code: null and signal: SIGABRT
 ELIFECYCLE  Command failed with exit code 1.
 ELIFECYCLE  Command failed with exit code 1.
```

L'echec survient **apres** « Compiled successfully » et **pendant** « Linting and checking
validity of types » — c'est le worker Next.js de verification de types (post-compilation) qui
sature le tas, pas la compilation elle-meme. Le message des deux sessions recalees (« le build
manque de memoire a 3072 ») est donc confirme, et ce n'est pas propre au contenu de leur lot :
`origin/main` lui-meme est a la limite (voir tableau suivant).

**Etape 3 — mesure `/usr/bin/time -v pnpm build` (ou `npx next build` a 4096), 2 essais par
cible, `.next` supprime avant chaque essai :**

| Cible | Essai | Script | Resultat | RSS max (Ko) | Duree |
|---|---|---|---|---|---|
| `origin/main` (ce depot) | 1 | 3072 (tel quel) | vert | 3 305 244 | 0:57.17 |
| `origin/main` (ce depot) | 2 | 3072 (tel quel) | vert | 3 301 824 | 0:56.66 |
| `9EE-TP-UX4-1-FICHE-INTERVENTION-2-garde` (worktree) | 1 | 3072 (tel quel) | **ROUGE** OOM/SIGABRT | 3 306 032 | 0:54.68 |
| `9EE-TP-UX4-1-FICHE-INTERVENTION-2-garde` (worktree) | 2 | 3072 (tel quel) | **ROUGE** OOM/SIGABRT | 3 305 160 | 0:55.01 |
| `9EE-TP-UX4-1-FICHE-INTERVENTION-2-garde` (worktree) | 1 | 4096 (`NODE_OPTIONS` + `npx next build`) | vert | 3 566 820 | 0:51.22 |
| `9EE-TP-UX4-1-FICHE-INTERVENTION-2-garde` (worktree) | 2 | 4096 (`NODE_OPTIONS` + `npx next build`) | vert | 3 564 856 | 0:51.16 |
| `9EK-TP-UX5-2-CREATIONS-2-garde` (worktree) | 1 | 3072 (tel quel) | **ROUGE** OOM/SIGABRT | 3 306 884 | 0:55.30 |
| `9EK-TP-UX5-2-CREATIONS-2-garde` (worktree) | 2 | 3072 (tel quel) | **ROUGE** OOM/SIGABRT | 3 310 604 | 0:55.32 |
| `9EK-TP-UX5-2-CREATIONS-2-garde` (worktree) | 1 | 4096 (`NODE_OPTIONS` + `npx next build`) | vert | 3 557 940 | 0:50.87 |
| `9EK-TP-UX5-2-CREATIONS-2-garde` (worktree) | 2 | 4096 (`NODE_OPTIONS` + `npx next build`) | vert | 3 558 516 | 0:51.01 |
| `main` local, APRES correctif (3072→4096 dans `package.json`) | 1 | 4096 (script corrige) | vert | 3 555 136 | 0:50.76 |
| `main` local, APRES correctif (3072→4096 dans `package.json`) | 2 | 4096 (script corrige) | vert | 3 552 684 | 0:50.80 |

Lecture : `origin/main` passe 2/2 a 3072, mais son RSS (≈3,30 Go) est deja a ~82 Mo du plafond
V8 reel (le plafond `--max-old-space-size` borne le *tas* V8, pas le RSS total du processus, qui
inclut aussi le code natif, les buffers et les threads workers — d'ou un RSS superieur au
plafond nomme). Les deux gardes, memes lots independants l'un de l'autre, ajoutent chacun assez
de surface (types, imports) pour faire deborder ce tas deja tendu, de facon reproductible (2/2).
A 4096, les trois cibles (main, 9EE, 9EK) passent 2/2 avec un RSS stable autour de 3,55-3,57 Go,
largement sous la marge disponible du poste (7,6 Go libres au repos, 24 coeurs).

## Ce que j'ai tranche et pourquoi

Premier cas du point 4 de la fiche : au moins une garde (les deux, en fait) echoue au build par
manque de memoire a 3072 ET passe 2 fois de suite a 4096, ET `origin/main` passe 2 fois a 3072.
J'ai donc remplace, dans `package.json`, script `build` uniquement, `--max-old-space-size=3072`
par `--max-old-space-size=4096`, sans toucher `NODE_OPTIONS` (toujours ajoute, jamais ecrase) ni
aucun autre caractere du fichier. Rejoue ensuite sur `main` local : 2/2 vert (tableau ci-dessus,
dernieres lignes).

Je n'ai pas remonte au-dela de 4096 : la fiche l'interdit explicitement sauf preuve que 4096 ne
suffit pas, ce qui n'est pas le cas ici (4/4 verts a 4096, tous essais confondus).

## Ce que je n'ai PAS fait

- Je n'ai touche a aucun ecran, aucune fonctionnalite, aucune migration, aucune decision D
  numerotee, conformement a la fiche.
- Je n'ai pas touche `next.config.*`, ni desactive le lint ou la verification de types du build.
- Je n'ai pas rejoue `pnpm test:e2e` (la fiche dit que ce n'est pas necessaire, aucun ecran
  n'etant touche ; la file rejouera `verify:full` en entier).
- Je n'ai pas cherche ce qui gonfle la verification des types dans les lots des deux gardes
  (import circulaire, type recursif, etc.) : ce diagnostic n'etait requis que si 4096 ne
  suffisait pas, et il a suffi.
- Je n'ai pas verifie si `9EEA-REPRISE-9EE-2` a ete publie ou recale depuis — seul fait constate :
  il n'apparait pas dans les 5 derniers commits d'`origin/main` au debut de cette session.

## Les pieges pour la session suivante

- Le plafond `--max-old-space-size` borne le tas V8, pas le RSS total mesure par `/usr/bin/time`
  (qui inclut code natif, buffers, et les workers de Next.js) : a 3072, le RSS observe est deja
  ~3,30 Go, superieur au plafond nomme. Ne pas s'etonner de voir RSS > plafond ; c'est normal et
  ne veut pas dire que le plafond est inefficace.
- `origin/main` lui-meme n'a plus de marge a 3072 (RSS ~3,30 Go sur un poste qui en offre bien
  plus) : le moindre lot qui ajoute du typage ou des imports peut suffire a faire basculer le
  build en rouge. 4096 redonne de la marge (RSS observe ~3,55-3,57 Go, encore loin des 7,6 Go
  disponibles au repos sur ce poste), mais si un futur lot fait a nouveau planter le build a
  4096, suivre la meme methode : MESURER avant de remonter encore, et exiger deux builds verts de
  suite avant de conclure qu'une valeur suffit.
- L'echec se produit APRES « Compiled successfully », PENDANT « Linting and checking validity of
  types » — c'est le worker de verification de types post-compilation de `next build` qui sature,
  pas la compilation. Un futur diagnostic de « build qui grossit » doit regarder la surface de
  typage (nombre de fichiers, profondeur des types, pas seulement la taille du bundle).
- Les deux worktrees temporaires (`../tas-9EE`, `../tas-9EK`) ont ete crees hors du depot
  (`/home/aplou/tas-*`) avec `git worktree add --detach`, utilises, puis supprimes avec
  `git worktree remove --force` + `git worktree prune` ; les branches gardes elles-memes n'ont
  jamais ete modifiees ni deplacees.

## Ce qui reste a faire

- Rien d'identifie par cette mesure : la cause (OOM a 3072, confirmee et reproduite 2/2 sur les
  deux gardes) est corrigee et verifiee (2/2 vert a 4096, main comme gardes). Les deux tickets
  gardes (`9EE-TP-UX4-1-FICHE-INTERVENTION-2`, `9EK-TP-UX5-2-CREATIONS-2`) restent a reprendre par
  leurs propres sessions de reprise — ce lot ne les reprend pas, il ne fait que lever la cause
  materielle de leur recalage a la verification independante.
