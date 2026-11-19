# 9L25-TESTS-FRAGILES — passation

Trois points, tous des tests seulement : aucun écran, aucune migration, aucun test existant assoupli,
aucune règle métier changée — rien à écrire dans `docs/arbitrages.md`. Décision d'Alexis du
10/11/2026 pour l'ensemble du lot.

## Point 1 — le classeur d'épreuve se refabrique dans un répertoire temporaire

`tests/unit/imports/classeur-fabrique.test.ts` réécrivait `tests/fixtures/clients-fabrique.xlsx`, un
fichier SUIVI, à chaque exécution de `pnpm test` — instable sous charge, et une réécriture en place
n'est une garantie que par chance (le contenu retombe identique, mais rien ne l'empêchait de ne pas
retomber).

`scripts/fabriquer-classeur-epreuve.mts` accepte désormais un chemin de sortie optionnel (second
argument) ; l'appel sans argument, inchangé, continue de régénérer le fichier suivi pour un humain qui
le relance volontairement. Le test fournit ce chemin dans un répertoire `mkdtempSync`, nettoyé en fin
d'épreuve dans un `finally`, et n'ouvre plus jamais le fichier du dépôt qu'en lecture. Délai explicite
posé sur l'épreuve (30 s) : le défaut de vitest (5 s) est mesuré insuffisant sous charge pour un
`execFileSync` qui démarre `tsx` dans un processus neuf.

Mesuré : `pnpm test` joué trois fois de suite laisse `git status` propre sur `tests/fixtures/`.

## Point 2 — un gardien contre une date littérale qui se fait passer pour une saisie

`tests/isolation/transmission-groupee.test.ts` comparait une date écrite en dur au jour réel via la
même porte que `confirmer_date_passee` (`lib/interventions/depot.ts`) — future à l'écriture, devenue
passée, l'épreuve a rougi pour une raison qui n'a rien à voir avec ce qu'elle éprouve. Cinq fichiers
ont été corrigés le 10/11/2026 par l'oracle déjà en usage ailleurs dans ce dépôt
(`chargerCalendrierAgence` + `prochainJourOuvert`) : un jour ouvré CALCULÉ à partir d'aujourd'hui,
jamais une date qui vieillit en silence.

Recherche des autres occurrences : une date littérale de l'année courante ou suivante est présente
dans 136 fichiers de `tests/isolation/**` et `tests/e2e/**`. Examinée une par une par catégorie —
fixture SQL brute (`$executeRawUnsafe`/`$queryRawUnsafe`), `new Date(...)` d'une écriture Prisma
directe, argument d'une fonction de domaine sans rapport (absences, file d'attente, taux horaire,
compteur), navigation vers une semaine fixe du jeu de démonstration pour une capture documentaire —
**aucune de ces formes ne traverse la validation qui compare une date au jour réel** : elles écrivent
la colonne directement, ou appellent une fonction qui ne lit jamais l'horloge. Le seul chemin par
lequel une date littérale rencontre cette validation est celui où elle se fait passer pour une saisie
réelle — un `.fill(...)` Playwright, un `FormData.set(...)`, une navigation `page.goto`/`toHaveURL`
avec la date en paramètre d'URL. 19 occurrences de cette forme, dans 13 fichiers, toutes examinées :
aucune n'est dangereuse (champs `date_dispo_prevue`, `date_verification`, `date_obtention`,
`date_effet` — aucun comparé à l'horloge réelle —, ou capture d'une semaine fixe du semis, ou épreuve
d'une période inversée dont les deux bornes ne sont jamais comparées à aujourd'hui).

`tests/unit/gardiens/dates-litterales-vivantes.test.ts` balaie `tests/isolation/**` et
`tests/e2e/**` pour cette seule forme — une date littérale de l'année courante ou suivante dans un
`.fill`, un `.set` de champ de date, ou une URL — et exige pour chaque occurrence une entrée
d'`EXCEPTIONS` nommée et motivée. Les deux directions sont gardées : une occurrence hors de la liste
fait échouer le gardien (vérifié en retirant une entrée), et une exception dont le texte ne se
retrouve plus dans son fichier fait échouer aussi (vérifié en ajoutant une entrée fabriquée pour ne
matcher rien).

## Point 3 — l'amorçage de `droits-ecrans-tp-s3` quitte le `it()`, avec une vraie assertion

`tests/isolation/droits-ecrans-tp-s3.test.ts` posait son habilitation référentielle dans un `it()`
sans aucune assertion — une tautologie, toujours verte quoi qu'il arrive, puisqu'elle ne vérifiait
rien de ce qu'elle venait de faire. Déplacé en `beforeAll`, avec une assertion réelle sur le compte de
la ligne insérée : si l'insertion échouait en silence, les deux épreuves suivantes auraient échoué
toutes les deux pour une raison qui n'est pas la leur, sans qu'on sache pourquoi.

Aucun autre amorçage écrit comme un test n'a été trouvé dans ce fichier.

## Vérification

`pnpm format:check`, `pnpm typecheck`, `pnpm lint` passent sans avertissement. `pnpm test` joué trois
fois de suite (536 fichiers, 6010 tests — 36,44 s, 36,70 s, 36,66 s), `git status` propre sur
`tests/fixtures/` après chacune des trois. `pnpm test:isolation` (255 fichiers, 2502 tests) passe une
fois, pour confronter le point 3 à la vraie base.

## État du dépôt

`main` était extrait ailleurs au démarrage (HEAD détachée sur `origin/main`) : le travail est posé sur
la branche dédiée `9l25-tests-fragiles`, créée depuis ce même commit. Aucun push.
