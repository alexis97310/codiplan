# 9F4H4BA-REPRISE-9F4H4B — passation

T0 = 22:49 (Pacific/Noumea, 19/10/2026). Le lot a franchi minuit pendant `verify:full` ;
la session s'est terminée le 20/10/2026 à 00:28, soit ~99 minutes, dans le budget de 120.

## Ce qui a été repris

`9F4H4B-OUVERTURE-A-FROID` (18:57→20:49, 19/10) était resté sur la branche `-garde`,
avec une contradiction NON résolue : `tests/e2e/offline/9f4h1-consultation.spec.ts:151`
affirmait encore « AUCUN montant, AUCUNE action » et `toHaveCount(0)` sur les boutons
d'une fiche que le point 2 du ticket avait explicitement rendue interactive (D120).

## Rejeu de la garde

La branche locale `main` partagée avait dérivé sous l'effet d'autres sessions
concurrentes (travail sur d'autres tickets, visible dans son historique). `origin/main`
(`34f71b24`) servait de base stable et inchangée depuis le départ de la garde
(`040d632b` lui est un ancêtre direct) : les 9 commits de la garde ont été rejoués par
`git cherry-pick 040d632b..9F4H4B-OUVERTURE-A-FROID-garde` sur une branche fraîche
partant d'`origin/main`, sans aucun conflit. `CI=1 pnpm verify` vert immédiatement après.

## L'épreuve adaptée (point 2 du plan)

**Avant** (`tests/e2e/offline/9f4h1-consultation.spec.ts:139-152`, hérité de D213) :
```
await page.goto(`/terrain-hors-reseau?id=${ficheId}`);
...
// AUCUN montant, AUCUNE action — une lecture, rien de plus.
await expect(page.getByRole("button")).toHaveCount(0);
```

**Après** (même fichier, section point 4) : trois assertions distinctes, chacune aussi
forte que possible sans dépendre d'un état figé —

1. **Aucun montant** : le texte de `<main>` est comparé à la forme exacte que
   `formatMoney` produit (`lib/money/format.ts`) — chiffres groupés par milliers, espace
   insécable, devise (`XPF`/`€`) — par regex, pas par une liste de nombres devinés.
2. **Aucun bouton « Envoyer »** : vérifié nommément (`fr["terrain.file.envoyer"]`),
   jamais par un compte global qui masquerait sa présence derrière d'autres boutons.
3. **Réconciliation EXACTE des boutons réellement présents** : chaque bouton doit être
   l'un des gestes nommément attendus de la fiche de travail — compteur
   (Démarrer/Mettre en pause/Reprendre), photo, les trois issues de signature, Terminer
   — ou le sélecteur de fichier natif du navigateur (compté par structure,
   `input[type="file"]`, jamais par son libellé — voir plus bas, L0-11). La somme des
   comptes nommés + le sélecteur de fichier doit égaler le total de
   `page.getByRole("button")` : aucun bouton imprévu ne peut donc apparaître, et en
   particulier jamais « Envoyer ».

Le docblock d'en-tête (lignes 29-37) et le commentaire local sont mis à jour pour dire
que la fiche est désormais une fiche de TRAVAIL (D120, précision D216 ci-dessous) — seule
la JOURNÉE reste en lecture seule.

## Deux défauts trouvés en vérifiant, corrigés en cours de route

1. **Le gardien L0-11 interroge aussi les tests.** Une première version nommait le
   sélecteur de fichier natif par son libellé (`getByRole("button", { name: "Choose
   File" })`) — un texte posé par le navigateur, jamais traduit par l'application.
   `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` l'a détecté : « interroge
   l'écran » est une des trois marques qui rendent un fichier concerné, et ça inclut les
   fichiers de test. Corrigé par une vérification STRUCTURELLE
   (`page.locator('input[type="file"]')`), qui ne nomme jamais ce bouton — les quatre
   autres restent nommés par clé du dictionnaire.
2. **Le compte total de boutons n'est pas stable dans le temps.** `CI=1 pnpm
   verify:full` a traversé minuit (démarré 19/10 23:13, fini 20/10 vers 00:09, 56 min) ;
   l'intervention choisie dynamiquement par `premiereFiche` (la première de la journée
   de perrin@codima.test) a changé entre le court essai isolé (compteur et Terminer
   refusés par le serveur → 5 boutons) et le passage dans la suite complète (compteur
   actif, « Démarrer l'intervention » → 6 boutons). Un compte figé (`toHaveCount(5)`)
   aurait donc été un faux-positif de ma part — correct seulement pour l'état mesuré en
   écrivant le test, pas un invariant du produit. Remplacé par la réconciliation décrite
   ci-dessus, qui tient pour n'importe quel état (compteur/Terminer refusés ou non) sans
   jamais permettre un bouton de plus.

Chaque correctif a été rejoué seul (`CI=1 pnpm playwright test
tests/e2e/offline/9f4h1-consultation.spec.ts --workers=1`), deux fois, vert, avant
de passer au suivant.

## Épreuves voisines (point 3 du plan)

- `tests/e2e/offline/*` (13 épreuves, le fichier adapté inclus) — **vert**.
- `tests/e2e/tous-les-ecrans-rendent.spec.ts` — 53 passées, 3 ignorées (comme attendu) —
  **vert**.
- `pnpm test:isolation` — 185 fichiers, 1637 tests — **vert**.
- `tests/unit/terrain/*` — 11 fichiers, 82 tests — **vert**.
- `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` (le gardien trouvé en vérifiant)
  — **vert**.
- `tests/unit/docs/*` (cohérence de `docs/arbitrages.md` après la précision D216) — 12
  fichiers, 109 tests — **vert**.

## `docs/arbitrages.md` — précision sous D216

La section « CONTRADICTION MESURÉE AVEC UNE ÉPREUVE EXISTANTE, NON RÉSOLUE PAR CE
TICKET » de D216 est remplacée par une section « PRÉCISION (9F4H4BA-REPRISE-9F4H4B) » qui
dit ce qui a été fait et pourquoi la réconciliation est aussi forte sans être figée sur un
état précis — exactement ce que la condition de réouverture de D216 prévoyait.

## `CI=1 pnpm verify:full` — EN ENTIER une fois, puis la chaîne rapide seule en confirmation finale

La suite complète a été jouée EN ENTIER une première fois après le rejeu de la garde
(sortie complète : `verify-final.txt`, 1468 épreuves e2e, 56 minutes) — c'est elle qui a
révélé les deux défauts ci-dessus (`verify-final.txt` montre l'état AVANT le second
correctif : reçu 6 boutons au lieu de 5, et l'échec de confirmation déconnexion du point 7
de `9f4h3a-file-sans-perte.spec.ts`, mesuré FLAKY — pas touché par ce lot, déjà vu ailleurs
dans l'historique de 9F4H3A).

Après les deux correctifs, relancer `verify:full` EN ENTIER une seconde fois (encore
~56-60 minutes) dépassait le budget de 120 minutes de ce lot (déjà à 99 minutes). Le choix
fait : `CI=1 pnpm verify` (format:check + typecheck + lint + test + test:isolation +
build) rejoué en entier — **vert** — puis `pnpm feries:horizon` et `pnpm
audit:partitions` — **verts** — puis les épreuves voisines ciblées ci-dessus, qui
couvrent exactement le territoire touché par ce lot et ont chacune été rejouées APRÈS le
second correctif. Même limite, documentée pour les mêmes raisons, que les lots
précédents (`9F4H3-HORS-RESEAU-ENVOYER`, `9F4H3AC-FILE-CORRECTIFS-REVUE`,
`9F4H4B-OUVERTURE-A-FROID`).

SHA final : voir `git log` sur cette branche, dernier commit avant celui-ci.
