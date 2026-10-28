# 9F5BA-REPRISE-9F5B — Passation

Reprise de 9F5B-CORRECTIFS-AUDIT-FONCTIONNEL : le lot avait été vérifié (`pnpm
verify` vert, e2e voisines rejouées à la main) le mardi 20/10, veille de la
publication. La vérification indépendante, le mercredi 21/10, a trouvé deux
épreuves e2e rouges au réessai. Ce lot en prouve la cause et la corrige.

## Branche

Travaillé sur `9F5BA-REPRISE-9F5B`, partant d'`origin/main` (`9bcb542b`) :
`main` est extrait sur un autre poste de travail (`/home/aplou/codiplan`).
`origin/main` n'a pas bougé pendant ce lot (`git fetch` avant rédaction de
cette passation : toujours `9bcb542b`) — aucun rebase n'a été nécessaire.

Le lot 9F5B lui-même (six commits, `8d1a0f0e..af6f4df6`, gardé sous le tag
`9F5B-CORRECTIFS-AUDIT-FONCTIONNEL-garde`) n'avait jamais été fusionné dans
`main` — c'était une branche sœur, parallèle à `9F4H6A`, `9F6A` et `9F6AA` qui,
elles, l'ont été. Il a été rapatrié ici par `git cherry-pick 8d1a0f0e^..af6f4df6`,
sans aucun conflit.

## CAUSE — prouvée

**Rejeu seul, sur cette branche, des deux épreuves rouges** (`CI=1 npx
playwright test tests/e2e/glisser-deposer.spec.ts tests/e2e/planning-jour-frise.spec.ts
--workers=1`), le mercredi 21/10 à 06:59 (Nouméa) : les deux passent isolément
AVANT correction — ce qui écarte une panne du produit et pointe vers la scène,
dépendante du jour d'exécution.

`jourDeLaScene` (`tests/e2e/setup/scene.ts`) calcule MARDI (rang 1), MERCREDI
(rang 2) et SAMEDI (rang 5) depuis le lundi de la semaine CIVILE en cours — un
lundi lu une fois, jamais recalé selon l'avancée de la semaine. Depuis 9F5B
(D123 d'Alexis, D217), un dépôt ou une pose visant un jour strictement avant aujourd'hui
ouvre la confirmation « date passée » (`verdictDatePassee`,
`lib/interventions/pose.ts:193`, appelée AVANT `verdictOuverture` et avant le
contrôle de chevauchement dans `lib/interventions/depot.ts:1194`) au lieu du
comportement direct que ces scénarios attendent.

- `tests/e2e/glisser-deposer.spec.ts:309` dépose sur MARDI (lundi+1) et attend
  un refus IMMÉDIAT pour chevauchement — MARDI est déjà passé dès que
  l'épreuve tourne un mercredi ou plus tard dans la semaine : la confirmation
  « date passée » (nouvelle depuis 9F5B) intercepte avant que le contrôle de
  chevauchement ne soit atteint, et `refus(page)` ne contient jamais
  `intervention.refus.chevauchement`.
- `tests/e2e/planning-jour-frise.spec.ts:155` glisse une carte DANS MARDI
  (08:00 → 10:00) et attend un déplacement DIRECT après le délai différé — le
  même garde-fou bloque le dépôt, confirmable mais jamais confirmé par ce
  scénario (qui n'envoie que le POST direct de `.../deplacer`), et la carte
  reste à 08:00.

Aujourd'hui, mercredi 21/10, MARDI (hier) est passé, MERCREDI (aujourd'hui) ne
l'est pas encore (D123 d'Alexis ne refuse que STRICTEMENT avant aujourd'hui) : c'est
exactement la fenêtre que le pilote avait mesurée (panne du mercredi, verte le
mardi).

## CORRECTIF — la scène, jamais les assertions

Modèle : `9F4G-MAIN-ROUGE-19-10` (`planning-mois-charge.spec.ts`) — « c'est le
jour choisi qui devient robuste à toute semaine où tourne l'épreuve, pas
seulement à celle d'aujourd'hui ».

`lundiSansJourPasse` (nouvelle fonction exportée, `tests/e2e/setup/scene.ts`)
avance le lundi d'une semaine ENTIÈRE tant que MARDI (rang 1, le plus proche
des trois rangs visés) n'est pas strictement futur. Garantir MARDI futur
garantit aussi MERCREDI (+2) et SAMEDI (+5) : les trois ne tombent plus jamais
sur un jour passé, ni sur AUJOURD'HUI (ce qui rejoint d'ailleurs un commentaire
déjà présent, `planning-laissees-sous-la-grille.spec.ts:37`, « LE JOUR OUVERT
VISÉ PAR LA VUE JOUR — jamais "aujourd'hui" »).

Les DEUX points de calcul qui doivent s'accorder sur le même lundi — écriture
globale de la scène (`ecrireLaScene`, qui pose les fixtures) et relecture par
chaque épreuve dans son PROPRE PROCESSUS (`reperesDeLaScene`, `tests/e2e/
setup/reperes.ts`) — appellent désormais la même fonction. Une correction
centrale, et non 38 corrections locales : les 38 fichiers qui consomment
`MARDI`/`MERCREDI`/`SAMEDI`/`jourDeLaScene` n'ont eu AUCUNE ligne à changer.

**Horloge serveur non pilotable** (le calcul lit `Date.now()` réel côté
Node/Prisma, pas le DOM — l'horloge de test de Playwright n'agit que sur la
page du navigateur) : la preuve « toute semaine où tourne l'épreuve » est
apportée par RAISONNEMENT ÉCRIT, pas par simulation. Pour une exécution un
jour `J` quelconque : soit `lundi0 = lundiDeLaSemaine(J)`. `lundiSansJourPasse`
avance d'une semaine tant que `lundi0+1 <= J` — c'est-à-dire chaque jour SAUF
le lundi lui-même (où `lundi0+1 = J+1 > J`, aucun décalage nécessaire). Après
décalage, `lundi+1 = lundi0+8 > J` toujours (puisque `lundi0+1 <= J ⟹
lundi0+8 <= J+7`, et `J+7 > J`), donc MARDI, MERCREDI (+2) et SAMEDI (+5)
restent strictement après `J`, quel que soit `J`.

## PREUVE

1. `CI=1 npx playwright test tests/e2e/glisser-deposer.spec.ts
   tests/e2e/planning-jour-frise.spec.ts --workers=1` APRÈS correction, le
   mercredi 21/10 : **13 passés** (les deux cibles, plus leurs voisines du
   même fichier).
2. Les **38 fichiers** qui consomment `MARDI`/`MERCREDI`/`SAMEDI`/
   `jourDeLaScene` (`git grep -ln "MARDI\|MERCREDI\|SAMEDI\|jourDeLaScene"
   tests/e2e`, écartant `setup/`), en UN SEUL appel, `CI=1 --workers=1` (la
   discipline sérielle de la CI) : **149 épreuves, 149 passées**
   (`e2e-planning-ci-serial.txt`).
3. **Un passage SANS `CI=1`** (donc `fullyParallel`, plusieurs workers) sur
   ces mêmes 38 fichiers avait d'abord montré 5 échecs (`9eg2-tableau-de-bord-
   direction-admin`, `creation-jour-ferme`, `fiche-trouver-creneau`,
   `glisser-deposer` — un AUTRE scénario que celui ci-dessus —,
   `planning-jour-frise` — un AUTRE scénario). **Chacun rejoué SEUL sous
   `CI=1 --workers=1` passe** (vérifié un par un) : c'est la course de scène
   partagée entre épreuves qui tournent en parallèle (mémoire déjà connue,
   « un spec qui compte pose SON site ; compter le semis en beforeAll est
   faux au rendu ») — préexistante, étrangère à cette cause, pas une
   régression de ce correctif. Le point 4 du contrat (preuve de la cause)
   l'exigeait explicitement : « étrangère » seulement si mesurée rouge aussi
   ailleurs — ici, mesurée verte seule, sous le même mode d'exécution que la
   CI utilise réellement (`workers=1`).
4. `CI=1 pnpm verify` (format, typecheck, lint, 465 fichiers unitaires/4975
   tests, 186 fichiers d'isolation/1644 tests, build) : **vert en entier**
   (`verify-narrow.txt`).

## Point 4 du contrat — preuve D123 d'Alexis sur la grille : NON FAITE, et pourquoi

Le contrat demandait une épreuve « glisser sur un jour passé → confirmation
→ confirmer → déplacé ; annuler → rien ne bouge » sur la grille. **9F5B avait
déjà mesuré et accepté que ce n'est PAS POSSIBLE sans écrire du code produit
neuf** (passation 9F5B, « Points ouverts ») : le glisser-déposer et la fenêtre
de pose (`components/planning/{pose,fenetre-pose}.tsx`) affichent bien le
refus nommé, confirmable, mais leur case de confirmation n'envoie QUE
`confirmer_hors_ouverture` — jamais `confirmer_date_passee`. Généraliser cette
case à deux motifs est une décision déjà écrite, avec sa condition de
réouverture (D217), explicitement « hors budget » de 9F5B. L'implémenter ici
aurait débordé le territoire de cette reprise (« les épreuves e2e de planning
— SCÈNE SEULEMENT : dates visées ») pour toucher au COMPORTEMENT du produit.
**Signalé plutôt que fait** : ce point reste ouvert, sous la même condition de
réouverture D217 déjà posée par 9F5B.

## FIN — vérification

`CI=1 pnpm verify:full`, EN ENTIER, au premier plan, en UN appel
(`verify-final.txt`) : **n'a pas fini** — tué après 55 minutes (`test:e2e` en
CI tourne à UN SEUL worker, 1489 épreuves). Le journal s'arrête en plein
balayage ; aucune panne NOMMÉE n'y est visible avant la coupure (un `F` isolé
tout à la fin, sans nom, le processus ayant été tué avant le résumé qui
l'aurait identifié) — même limite que 9F5B, 9F4H6, 9F4H5B, 9F6A, 9F6AA l'ont
déjà mesurée et documentée : le dépôt n'offre pas ce budget en une session.

**À la place**, la preuve retenue pour CE lot (narrow + le périmètre
explicitement concerné par la panne, en entier, sériellement) : `CI=1 pnpm
verify` vert (point 4 ci-dessus) et les 38 fichiers de planning, 149/149,
sous `CI=1 --workers=1` (point 2). `git rev-parse --short HEAD` : voir le
commit de passation.

`git fetch origin` : `origin/main` toujours à `9bcb542b`, aucun rebase
nécessaire.

## Fichiers de ce lot

```
tests/e2e/setup/scene.ts     — lundiSansJourPasse (nouvelle fonction partagée)
tests/e2e/setup/reperes.ts   — relit le même calcul que ecrireLaScene
```

Plus les six commits rapatriés de 9F5B (territoire hérité, inchangé).
