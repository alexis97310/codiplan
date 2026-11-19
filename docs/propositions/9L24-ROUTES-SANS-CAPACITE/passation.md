# 9L24-ROUTES-SANS-CAPACITE — passation

Deux points, tous des tests seulement : aucun écran, aucune migration, aucun test existant assoupli,
aucune règle métier changée — rien à écrire dans `docs/arbitrages.md`.

## Point 1 — chaque route, appelée sans sa capacité, refuse et n'écrit rien

Mesuré : la garde de rôle de chaque route n'était prouvée que par lecture de **texte**
(`tests/unit/auth/porte.test.ts`, qui reconnaît `exigerCapacite(...)` par expression régulière, sans
jamais l'exécuter) — 74 routes sur 126 n'étaient atteintes par aucun test unitaire ni d'isolation.

`ROUTE_CAPACITE` et `PORTE_COMPLETE` sont extraites de `porte.test.ts` vers un nouveau fichier,
`tests/unit/auth/route-capacite.ts` — source unique, désormais partagée entre le gardien de texte
(inchangé, toujours dans `porte.test.ts`) et l'épreuve d'exécution ci-dessous. Aucune ligne de la
table n'a changé de valeur ; seul son domicile a bougé.

Nouveau fichier `tests/isolation/9l24-routes-sans-capacite.test.ts` : il importe chaque route des 118
chemins de `ROUTE_CAPACITE` (`import()` dynamique sur le chemin lui-même — une route renommée ou
supprimée y échoue à l'import, avant même d'atteindre une assertion), détermine son verbe HTTP réel
depuis le module (9 routes sont des `GET`, jamais supposées `POST`), construit les paramètres `[id]`
factices depuis le chemin, et l'appelle avec `@/lib/auth/porte` entièrement remplacée pour rendre
toujours un refus (`null`), quelle que soit la capacité demandée — exactement le cas du ticket, « un
rôle sans la capacité ».

Pour chacune des 118 routes : aucune panne (code `< 500`), et surtout **aucune ligne écrite** — mesuré
par le compte global de `journal_audit`, avant et après l'appel. `journal_audit` journalise déjà toute
écriture sur le périmètre audité (I8, par déclencheur PostgreSQL) : une route qui écrirait malgré le
refus y laisserait une trace, quelle que soit la table qu'elle touche — jamais besoin de connaître,
route par route, laquelle elle est. Une route neuve ajoutée à `ROUTE_CAPACITE` sans mise à jour de ce
fichier entre automatiquement dans la boucle (elle lit `Object.keys(ROUTE_CAPACITE)`).

**Une route a d'abord semblé ouverte à tort, et ne l'est pas** — `app/api/terrain/[id]/photos/
legende/route.ts` répond `200` même quand la capacité manque (son corps porte `{ ok: false, motif }`,
jamais un code HTTP distinct pour le refus — une convention « API » différente des routes de
formulaire, qui redirigent en `303`, ou des routes de lecture du terrain, qui répondent `403`/`404`).
La première version de ce fichier exigeait `status !== 200` partout, et a donc rougi sur cette seule
route ; vérification faite (lecture de `app/api/terrain/[id]/photos/legende/route.ts` : le refus
revient bien avant tout appel à `modifierLegendePhoto`, et le compte de `journal_audit` ne bouge pas),
ce n'est pas une route ouverte — c'est l'assertion qui supposait à tort un code HTTP unique pour tout
refus. Elle a été retirée ; seule la panne (`>= 500`) et l'absence d'écriture restent exigées,
génériques sur les 118 routes. Aucune route n'a dû être exclue de la boucle.

## Point 2 — deux faits, prouvés par le serveur, avant fusion

Mesuré : `.github/workflows/ci.yml` ne joue `pnpm test:e2e` que dans le job `verify-full` (nocturne, ou
sur `main` — donc après fusion) ; le job `verify`, lui, lu à chaque proposition de fusion, ne joue que
`pnpm test` et `pnpm test:isolation`. Deux faits n'étaient prouvés que par un scénario e2e, donc
jamais avant fusion :

**Le bon du portail ne porte aucun montant pour une garantie ou un recensement.**
`tests/isolation/bon-intervention.test.ts` prouvait déjà ce fait pour `lireBonIntervention` (le
back-office), décision d'Alexis du 10/11/2026 (RG-INT-09/RG-INT-11) — mais jamais pour
`lireBonDuParc`, la fonction que le **client** atteint réellement, qui partage la même composition
(`composerBon`, `lib/interventions/bon.ts`) sans jamais être exécutée ici.
`tests/unit/portail/bon-sans-montant.test.ts` ne lit que le **texte source** de l'écran portail — il
ne prouve jamais que la composition, exécutée pour le client réel de l'intervention, rend bien les
montants nuls. Un bloc ajouté au même fichier exécute `lireBonDuParc`, même décor (taux + forfait
posés) que le témoin back-office juste au-dessus, pour les deux types `garantie`/`recensement`, et
vérifie `taux`/`forfaitMontant`/`montantTotal` nuls.

**Le back-office se refuse au technicien par le serveur lui-même.** `middleware.ts` ne juge aucun
rôle (son propre en-tête le dit : il recopie seulement le chemin dans `x-chemin`/`x-recherche`). Le
vrai garde est `GardeTechnicienBureau`, export par défaut de `app/(back-office)/template.tsx` — et
`tests/unit/navigation/redirection-technicien.test.ts` n'éprouve que les fonctions **pures**
(`fermeAuTechnicienParD221`, `idInterventionDuChemin`) qu'il appelle, jamais le garde lui-même ; son
en-tête dit explicitement que le reste (session, rôle, redirection) n'était éprouvé qu'en bout en
bout. Nouveau fichier `tests/unit/navigation/9l24-garde-technicien-serveur.test.ts` : il exécute
`GardeTechnicienBureau` directement, avec `@/lib/auth/porte` et `next/headers` fabriqués (même patron
que `tests/isolation/mentions-legales-routes.test.ts` pour `headers()`) — une session technicien et
un chemin de back-office quelconque lèvent bien l'exception `NEXT_REDIRECT` de Next vers `/terrain`,
avant même de songer à ce que `middleware.ts` a posé. Deux témoins : un rôle non technicien n'est
jamais refusé ici ; `/arrivee` (l'exemption connue, D221) reste ouverte au technicien.

## Vérification

`pnpm typecheck`, `pnpm lint`, `pnpm test` (6006 tests, 535 fichiers), `pnpm test:isolation` (2503
tests, 255 fichiers) et `CI=1 pnpm verify` (format, typecheck, lint, test, test:isolation, build)
passent tous sans erreur ni avertissement.

## État du dépôt

`main` était extrait ailleurs au démarrage (HEAD détachée sur `origin/main`) : le travail est posé sur
la branche dédiée `9l24-routes-sans-capacite`, créée depuis ce même commit. Aucun push.
