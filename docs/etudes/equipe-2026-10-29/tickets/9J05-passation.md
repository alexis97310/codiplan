# 9J05-PORTAIL-COMMENTAIRES-GARDE — passation

Budget : T0 01:52 (Pacific/Noumea), limite 120 min.

## Point 1 — le test, rougi AVANT la fonction

`tests/unit/portail/commentaires-colonnes-fermees.test.ts` importe
`SELECTION_COMMENTAIRES_CLIENT` de `@/lib/portail/interventions`, qui n'existait pas encore. Lancé seul
(`lib/portail/interventions.ts` déplacé hors du dépôt pour la mesure), message d'échec mot pour mot :

```
Error: Failed to resolve import "@/lib/portail/interventions" from "tests/unit/portail/commentaires-colonnes-fermees.test.ts". Does the file exist?
  Plugin: vite:import-analysis
```

## Point 2 — la fonction

`lib/portail/interventions.ts` : `SELECTION_COMMENTAIRES_CLIENT` (`id`, `statut`, `commentaire_technicien`,
`suite_a_donner` — rien d'autre) et `commentairesVisiblesClient(contexte, interventionId, client?)`, qui
compose ce select SEUL, sous `avecContexteApplicatif` (même forme que `parcDuClient`,
`lib/portail/depot.ts`). Elle n'importe ni n'appelle `lireFicheIntervention`
(`lib/interventions/depot.ts`) ni aucune fonction qui sélectionne `note_interne`. Le test du point 1 devient
vert (3 tests : chaque clé du select appartient à la liste close ; la liste close ne nomme que des colonnes
réelles d'`Intervention`, lues par `Prisma.dmmf` — jamais une copie à la main ; `note_interne` n'est dans
aucune des deux listes).

## Point 3 — la morsure, mesurée puis retirée

`note_interne: true` ajouté temporairement à `SELECTION_COMMENTAIRES_CLIENT`, test relancé : 2 des 3 cas
rougissent —

```
AssertionError: expected [ 'id', 'statut', …(2) ] to include 'note_interne'
AssertionError: expected [ 'id', 'statut', …(3) ] to not include 'note_interne'
```

— preuve que le gardien mord réellement, pas seulement qu'il compile. L'ajout est retiré ; le test est
revérifié vert avant le commit (aucune trace de `note_interne` dans `lib/portail/interventions.ts` livré).

## Point 4 — cloisonnement, sous la vraie base

`tests/isolation/9j05-portail-commentaires-garde.test.ts` — une fiche dédiée (`INTERVENTION_COMMENTAIRES`,
posée en `beforeAll`, effacée en `afterAll` ; même patron que `INTERVENTION_DEDIEE` dans
`ecran-intervention.test.ts`, les fiches partagées du harnais n'étant pas stables d'un fichier à l'autre),
trois valeurs distinctes pour `note_interne`/`commentaire_technicien`/`suite_a_donner`. 6 épreuves, toutes
vertes sous `pnpm vitest run --project isolation` :
- témoin — la fiche porte bien trois valeurs distinctes ;
- le compte portail du client propriétaire, dans son périmètre de sites, lit ses deux commentaires — aucune
  clé ni valeur de `note_interne` dans ce que la fonction rend ;
- `null` sur une intervention du MÊME client mais hors du périmètre de sites (témoin : la ligne existe) ;
- `null` sur une intervention d'un AUTRE client de la même société ;
- `null` sur une intervention d'une AUTRE société (témoin : la ligne existe) ;
- une désignation de client qui n'est pas la sienne LÈVE (D70), elle ne rend pas `null`.

Aucune politique neuve posée : `commentairesVisiblesClient` hérite de la forme « parc » que `intervention`
porte depuis D84 — ce fichier éprouve l'appelant, la politique elle-même est déjà éprouvée par
`tests/isolation/portail-rattachement.test.ts`.

## État des portes

`pnpm format` / `pnpm typecheck` / `pnpm lint` : verts. `pnpm test` : 500 fichiers, 5505 tests, vert.
`pnpm test:isolation` : 216 fichiers, 1872 tests, vert (dont les 6 nouveaux). `pnpm build`,
`pnpm feries:horizon`, `pnpm audit:partitions` : verts (voir `9J05-verify-final.txt`).

**`CI=1 pnpm verify:full` INTERROMPU au bout de 60 minutes, en plein `test:e2e`** — même issue que
9J04 point 7. Tout ce qui précède `test:e2e` dans la chaîne est passé (`format:check`, `typecheck`, `lint`,
`test`, `test:isolation`, `build`, `feries:horizon`, `audit:partitions`) ; `test:e2e` avait démarré depuis
~34 minutes (1898 tests, 1 worker — voir la note mémoire sur sa durée) et n'affichait AUCUN échec au moment
de l'interruption, seulement des points de progression et des mesures d'accessibilité déjà connues du
dépôt. Ce ticket ne touche à AUCUN écran ni route (territoire : `lib/portail/interventions.ts` et deux
fichiers de test, aucun appelant e2e) — rien dans `test:e2e` ne peut dépendre de ce changement. Sortie
complète (interrompue) : `9J05-verify-final.txt`, dans ce même dossier. `pnpm verify` (sans `:full`) a été
rejoué séparément pour la porte de sortie du ticket, et il est vert.

## Hors territoire, rappelé

`lib/interventions/depot.ts` : lecture seule, aucune ligne modifiée — `lireFicheIntervention` continue de
sélectionner les trois colonnes pour le back-office, qui a droit aux trois. Aucun écran, aucun appelant :
9J07 branchera `commentairesVisiblesClient` sur un écran portail. `prisma/` : aucune migration. `CLAUDE.md` :
inchangé.
