# 9F4H5A-HEURE-CALEE-SERVEUR — passation

Branche dédiée `9F4H5A-HEURE-CALEE-SERVEUR` : le worktree était en HEAD
détachée sur `origin/main` (487673db) au démarrage — une branche a été posée
avant le premier commit, comme l'exige le protocole quand `main` est ailleurs
extrait.

## Point 1 — le téléphone cale ce qu'il envoie sur l'heure du serveur

**Avant** — `components/terrain/compteur-terrain.tsx:174` (mesuré sur
`487673db`) : `nouvelleOperation()` fabrique `instant_appareil` depuis
`new Date().toISOString()`, l'heure BRUTE du téléphone, envoyée telle quelle
au premier essai EN LIGNE. `lib/interventions/depot-compteur.ts` (9F4H4D,
`arreterLeCompteur`) borne cet `instant_appareil` à 5 minutes dans le futur
QUEL QUE SOIT `depuisFile` et REFUSE au-delà (`compteur.refus.instant_futur`),
sans jamais se rabattre sur l'heure du serveur — son rejeu se reconnaît par
la valeur exacte de `fin` (`dejaFerme`), pas par une colonne d'identité.
Conséquence mesurée : un téléphone dont l'horloge a plus de 5 minutes
d'avance ne pouvait plus « Mettre en pause » du tout, même en ligne.

**Après** — `lib/terrain/heure-calee.ts` (nouveau, pure, D-13) :
`instantAppareilCale({ instantAppareil, decalageHorlogeMs })` corrige
l'heure envoyée par l'écart mesuré si `|écart| > 60 000 ms`, sinon la rend
inchangée. `components/terrain/compteur-terrain.tsx:110-116` mesure cet
écart UNE SEULE FOIS au montage (`decalageHorloge(instantServeur,
instantAppareil())`, réutilisé tel quel depuis `lib/terrain/compteur-vivant.ts`,
déjà posé par 9F4H5-TERRAIN-VIVANT — aucune nouvelle lecture d'horloge, donc
aucune exemption neuve au gardien L0-08) ; `onClick:174-187` calcule la
valeur calée AVANT le tout premier essai et la réutilise identiquement pour
le corps POSTÉ, pour la file en cas de coupure, et pour l'affichage
« hors réseau depuis… » — le rejeu par l'instant exact de 9F4H4D reste
intact, puisque c'est la MÊME valeur qui repart. `app/(mobile)/terrain/[id]/
page.tsx:458` passe `instantServeur={new Date(genereLe)}` (l'heure déjà
calculée côté serveur pour `CompteurVivant`, réutilisée). La coquille
`/terrain-hors-reseau` (`consultation-hors-reseau.tsx`) ne passe aucun
`instantServeur` : aucune session n'y existe, le décalage y reste nul,
comportement inchangé. Aucune migration, aucune borne serveur assouplie.

### Épreuves (point 1)

- **Unitaires** : `tests/unit/terrain/heure-calee.test.ts` (6 cas — écart
  nul, sous le seuil d'une minute, ±10 min, >7 jours sans plafond, pile au
  seuil). `tests/unit/terrain/compteur-terrain.test.tsx` — deux cas ajoutés :
  téléphone 10 min en avance → l'instant posté est calé sur `instantServeur`
  (± 5 s) et le MÊME texte est réutilisé par la file après un échec réseau ;
  sans heure serveur connue (coquille) → l'instant posté reste celui du
  téléphone, inchangé. 9/9 verts dans ce fichier, 122/122 dans
  `tests/unit/terrain/`.
- **Bout en bout** (`tests/e2e/9f4h5a-heure-calee-serveur.spec.ts`, sa propre
  scène `9F4H5A-`) : `page.clock.setFixedTime` avance l'horloge VUE PAR LE
  NAVIGATEUR de 10 min — le serveur Next.js, lui, reste sur l'heure RÉELLE du
  processus, exactement l'écart que ce lot corrige. « Mettre en pause » EN
  LIGNE est accepté (jamais `compteur.refus.instant_futur`), le segment se
  ferme à l'heure RÉELLE (± 5 s), jamais à +10 min. Un renvoi direct du même
  geste avec le même `instant_appareil` (lie-fi simulé) retrouve le MÊME
  segment, rien n'est doublé — confirme que le rejeu par l'instant exact de
  9F4H4D n'est pas cassé par le calage.
- **Captures** (`tests/e2e/captures-9f4h5a-heure-calee-serveur.spec.ts`, sa
  propre scène `9F4H5ACAP-`, un segment ouvert créé juste avant chaque test
  — la contrainte d'unicité `(societe_id, utilisateur_id)` sur
  `segment_travail` interdit d'en poser deux d'avance pour la même personne)
  — voir plus bas.

## Point 2 — `rapport-automatique.test.tsx` « aucun envoi avant 1,5 s » rendu déterministe

**Avant** (`tests/unit/terrain/rapport-automatique.test.tsx:190`, mesuré sur
`686ab51b`) — `vi.useFakeTimers({ shouldAdvanceTime: true })` fait avancer
l'horloge FACTICE toute seule, au rythme de l'horloge RÉELLE de la machine
qui joue l'épreuve, EN PLUS des avancées explicites. Le temps que `scene()`
prend à monter (rendu, effets, double IndexedDB) s'ajoutait donc, de façon
non reproductible selon la charge de la machine, aux 1 499 ms explicitement
avancées — et basculait parfois la minuterie de 1 500 ms AVANT l'assertion
« rien envoyé » (ROUGE mesuré par 9F4H4D au 1er passage de `pnpm verify`,
VERT au 2e, sans aucun autre changement entre les deux —
`traces/9F4H4D-ARRETER-BORNE-verify-1.txt`).

**Après** — retire `shouldAdvanceTime` ; `vi.advanceTimersByTime` (synchrone)
devient `vi.advanceTimersByTimeAsync`, qui avance UNIQUEMENT l'horloge
factice et laisse les microtâches (le mock `fetch`, les promesses
d'IndexedDB) se résoudre entre deux avancées — sans jamais dépendre de
l'horloge réelle de la machine.

### Épreuve de déterminisme

`for i in $(seq 20); do pnpm vitest run tests/unit/terrain/rapport-automatique.test.tsx || break; done`
— 20/20 passages verts, 24/24 tests à chaque passage, aucune assertion
retirée ni élargie, aucun délai allongé.

## FIN — épreuves rejouées

- `tests/e2e/offline/*` (14 fichiers) : **14 passées, 0 échec**
  (`--workers=1`).
- `tests/unit/terrain/*` : **122 passées, 0 échec**.
- `pnpm test:isolation` : **1638 passées, 0 échec** (185 fichiers).
- `tests/e2e/9f4h5a-heure-calee-serveur.spec.ts` et
  `tests/e2e/captures-9f4h5a-heure-calee-serveur.spec.ts` : verts (voir
  points 1 et captures).

### `CI=1 pnpm verify:full` — lancée UNE FOIS, au premier plan, PAS jusqu'au bout

Lancée comme l'exige le ticket (un seul appel, premier plan, sortie complète
dans `docs/propositions/9F4H5A-HEURE-CALEE-SERVEUR/verify-final.txt`). Elle a
tourné pendant la totalité de l'heure permise par l'outil avant d'être
interrompue par ce plafond — **tout ce qu'elle a eu le temps de jouer est
VERT, rien n'a échoué** :

```
format:check  — vert (« All matched files use Prettier code style! »)
typecheck     — vert (tsc --noEmit, aucune erreur)
lint          — vert (eslint --max-warnings 0, aucun avertissement)
test          — 4953 passés / 4953 (464 fichiers)
test:isolation — 1638 passés / 1638 (185 fichiers)
build         — vert (compilation de production terminée)
feries:horizon — vert (12 mois d'avance tenus sur les deux territoires)
audit:partitions — vert (préventif et détectif)
test:e2e      — ENTAMÉE (webServer reconstruit + redémarré, base re-seedée,
                plusieurs centaines de scénarios joués sans qu'aucun échec ne
                soit observé dans la sortie capturée), coupée par le plafond
                d'une heure avant la fin des 336 fichiers.
```

**Même limite déjà documentée** par `9F4H3-HORS-RESEAU-ENVOYER`,
`9F4H3AC-FILE-CORRECTIFS-REVUE`, `9F4H4B-OUVERTURE-A-FROID` et
`9F4H5-TERRAIN-VIVANT` : la suite `test:e2e` complète (336 fichiers,
`workers=1` sous `CI=1`) est prévue pour tourner sans surveillance la nuit
(CLAUDE.md §4, `verify:full` en exécution nocturne), pas dans une seule
invocation d'outil plafonnée à 60 minutes. Remplacée, comme ces lots l'ont
fait, par les épreuves ciblées ci-dessus — `tests/e2e/offline/*` en entier,
plus les deux fichiers neufs de ce lot, tous verts.

15 dernières lignes brutes de `verify-final.txt` au moment de la coupure
(reporter `github` sous `CI=1` : un point par test réussi, une annotation
détaillée SEULEMENT en cas d'échec — aucune n'apparaît) :

```
·MESURE depot-fenetre-pose@375 — textes<12px: 0, cibles<32px: 13, débordement: 0
  cibles: [{"element":"a", ...} ... ]
·MESURE glisser-en-cours@1280 — textes<12px: 0, cibles<32px: 0, débordement: 0
MESURE bandeau-deplacement-differe@1280 — textes<12px: 0, cibles<32px: 0, débordement: 0
·············································°°··········
·············································································· [Better Auth WARN — baseURL]
··
················································································
································································································
················ [Better Auth WARN — baseURL]
································································
································································································
································································································
··········°·°·············°·····················································
····
```

(sortie brute complète, non tronquée par cette passation, dans
`verify-final.txt`.)

## `pnpm verify` — rejoué après le rebase

`git fetch origin` : `origin/main` n'avait pas bougé depuis T0 (`487673db`,
la même que la branche détachée de départ) — `git rebase origin/main` sans
effet (« Current branch ... is up to date »). `CI=1 pnpm verify`
(format:check, typecheck, lint, test, test:isolation, build) rejoué une
dernière fois : vert de bout en bout — format Prettier conforme, `tsc
--noEmit` sans erreur, `eslint --max-warnings 0` sans avertissement, build de
production terminé avec le manifeste complet des routes. Arbre de travail
propre après ce rejeu (`git status --porcelain` vide, aucune capture
régénérée par effet de bord conservée hors de ce lot).

## Captures — commitées

```
docs/propositions/9F4H5A-HEURE-CALEE-SERVEUR/captures/fiche-pause-horloge-avance-1280.png (69 348 octets)
docs/propositions/9F4H5A-HEURE-CALEE-SERVEUR/captures/fiche-pause-horloge-avance-375.png  (56 808 octets)
```

Fiche après « Mettre en pause », horloge du navigateur avancée de 10 min au
moment du clic — le bouton affiche « Reprendre le compteur », confirmant que
le geste a été accepté et le segment fermé (jamais le refus
`compteur.refus.instant_futur`).

## Points ouverts

- La suite `test:e2e` complète n'a pas été rejouée jusqu'au bout dans cette
  session (voir ci-dessus) — aucun échec observé dans ce qui a tourné,
  substitué par les épreuves ciblées. À confirmer par l'exécution nocturne
  de `verify:full` (CLAUDE.md §4).
- Hors réseau sans écart connu (aucune session, `instantServeur` absent) :
  comportement inchangé par construction (décalage nul) — non rejoué par une
  épreuve dédiée de ce lot au-delà des deux cas unitaires de
  `compteur-terrain.test.tsx` (coquille `sansSession`).

## `git log --oneline -8`, avant ce commit de passation

```
018d3776 9F4H5A-HEURE-CALEE-SERVEUR — passation : décision D132 datée, sortie de vérification, limite assumée
67e66d76 9F4H5A-HEURE-CALEE-SERVEUR — point 2 : « aucun envoi avant 1,5 s » rendu déterministe
686ab51b 9F4H5A-HEURE-CALEE-SERVEUR — point 1 : le téléphone cale ce qu'il envoie sur l'heure du serveur
487673db 9F4H5-TERRAIN-VIVANT — passation : détail des trois points, limites assumées
3ee5c117 9F4H5-TERRAIN-VIVANT — passation : pnpm verify vert, épreuves voisines /terrain vertes
8aad53a9 9F4H5-TERRAIN-VIVANT — correctif : les textes des épreuves passent par le dictionnaire
1e7d0fd7 9F4H5-TERRAIN-VIVANT — captures : fiche, bandeau et Ma journée, 375 et 1280 px
28b8b979 9F4H5-TERRAIN-VIVANT — point 3 : épreuve de bout en bout de « Nouvelle intervention »
```

Ce fichier est lui-même commité par-dessus `018d3776`, sur la branche
`9F4H5A-HEURE-CALEE-SERVEUR` — jamais poussé.
