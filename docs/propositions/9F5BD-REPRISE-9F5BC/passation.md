# 9F5BD-REPRISE-9F5BC — passation

## Rejeu de la garde

Travail fait sur une branche dédiée partant d'`origin/main` (`9F5BD-REPRISE-9F5BC`),
`main` étant extrait dans un autre worktree (`/home/aplou/codiplan`). Les dix commits de
`9F5BC-REPRISE-9F5BB-garde` (9F5BA + 9F5BB + 9F5B) ont été rejoués par
`git cherry-pick 780ecfd0..9F5BC-REPRISE-9F5BB-garde` sur `origin/main`
(`fe4b58e8`, tête de la chaîne 9F4H6C) **sans aucun conflit**. `pnpm verify` était vert
juste après le rejeu.

`9F5BC-REPRISE-9F5BB` (sans `-garde`) ne portait aucun commit propre : toute la séance
9F5BC était restée non commitée. `voie1-reste-1021-2008` (le parking automatique le plus
proche de la coupure, 20:08) a été examinée mais ne contient **pas** le travail de
9F5BC — son unique commit (`ca9f9e46`) part de `780ecfd0` (avant même la garde) et ne
touche que douze captures PNG d'un autre audit (`docs/audits/9F5-fonctionnel`), rien dans
`tests/e2e/planning-deux-semaines.spec.ts` ni dans `lib/interventions/`.

## La ligne en trop — NOMMÉE, par la preuve déjà faite par 9F5BC

`/tmp/9f5bc-e2e.txt` (21/10/2026 20:07, dernière suite e2e complète jouée par 9F5BC avant
la coupure, `CI=1`, 1 seul worker) portait déjà le relevé temporaire demandé par l'étape 2
de ce ticket — il n'a donc pas été nécessaire de le reposer ni de rejouer les 57 minutes de
la suite complète pour l'obtenir :

```
RELEVE deux_semaines [{"technicienId":"","texte":"Interventions non affectéesAgence Ducos"},
  {D. Garnier…}, {J. Lemaître…}, {M. Perrin…}, {T. Weber…}]
RELEVE semaine [{D. Garnier…}, {J. Lemaître…}, {M. Perrin…}, {T. Weber…}]
```

**La ligne en trop EST la file elle-même** (`technicienId: ""`, texte « Interventions non
affectées — Agence Ducos »), présente en tête de la vue Deux semaines et absente de la vue
Semaine, sur la même semaine et les mêmes quatre techniciens. Ce n'est donc **pas** une
personne hors référentiel : la branche « D141 (désormais D218) suffit seule » du contrat
s'applique, sans retouche de nettoyage e2e.

Le fichier exact qui a posé cette intervention non affectée n'a pas été retrouvé avec
certitude dans le budget de ce lot (recherche bornée : `grep` sur `technicien_id: null` +
`DUCOS` dans `tests/e2e/*.spec.ts`, plusieurs candidats sans `afterAll` examinés — aucun
n'a pu être confirmé comme LA cause précise sans rejouer la suite complète dans l'ordre
exact). Cela ne change rien à la correction : D218 rend la ligne TOUJOURS présente, donc
indifférente à la donnée laissée par quelque fichier que ce soit.

## Correction (fichier:ligne)

- `lib/interventions/grille.ts:189-202` — `construireGrille` sème désormais la ligne non
  affectée (`groupes.set("", …)`) **avant** le référentiel et les interventions, sans
  agence de rattachement.
- `lib/interventions/journee.ts:328-337` — même réparation pour `construireJournee`
  (colonne non affectée semée avant le référentiel).
- Décision consignée sous **D218** dans `docs/arbitrages.md` (le contrat la nommait
  « D141 » ; ce numéro est déjà pris par une décision sans rapport du 27/09/2026 — note
  explicite posée dans le texte pour que ça ne diverge pas en silence).

## Épreuves touchées (avant/après)

Toutes les épreuves qui indexaient `grille[0]` / `colonnes[0]` en supposant une seule
ligne (sans file) ont dû changer d'index ou passer par `.find(technicienId === …)` —
**aucune assertion de comportement n'a été affaiblie**, seul l'INDEX attendu a changé
pour refléter que la file occupe désormais toujours le rang 0 :

| Fichier | Avant | Après |
|---|---|---|
| `tests/unit/interventions/grille.test.ts` | `grille[0]` = la seule ligne (ex. « t1 ») | `grille.find(l => l.technicienId === "t1")` ; longueur attendue `+1` |
| `tests/unit/interventions/grille.test.ts` (« sans aucune intervention ») | `toEqual([])` | `toHaveLength(1)`, la file vide (technicienId `null`, total 0) |
| `tests/unit/interventions/grille-referentiel.test.ts` | `toHaveLength(1)` / `toEqual([])` | `toHaveLength(2)` / `toHaveLength(1)` (la file, toujours) |
| `tests/unit/interventions/grille-journee-feries.test.ts` | `grille[0]` | `grille.find(l => l.technicienId === "t1")` |
| `tests/unit/interventions/journee.test.ts` | `j.colonnes[0]` (partout) | `j.colonnes[1]` ou `.find(technicienId === …)` ; ajout d'un test dédié « LA FILE NON AFFECTÉE EST TOUJOURS LÀ » |
| `tests/unit/interventions/journee-a-caler.test.ts` | `j.colonnes[0].aCaler` | `j.colonnes.find(c => c.technicienId === "t1")!.aCaler` |
| `tests/unit/interventions/blocage-agenda-visible.test.ts` | `avecLigne[0]` / `colonnes[0]` (4 occurrences) | `.find(technicienId === "garnier")` |

`tests/e2e/planning-deux-semaines.spec.ts` — **aucune modification**, c'est l'épreuve qui
PROUVE la correction : `indexDeLaLigneTechnicien` ne compte pas les lignes, elle cherche la
ligne d'un technicien précis, donc l'index se déplace de façon identique dans les deux
vues et `expect(indexSemaine).toBe(indexDeuxSemaines)` passe désormais
(ligne 231, exécutée seule : voir ci-dessous).

## Mesures faites

- `pnpm vitest run tests/unit` — **5021 tests, tous verts** (avant la correction, 31
  échouaient après le patch de `grille.ts`/`journee.ts` et avant la mise à jour des
  épreuves ; tous corrigés).
- `pnpm test:e2e tests/e2e/planning-deux-semaines.spec.ts` seule — **4/4 verts**, dont
  l'épreuve `:185` qui échouait chez 9F5BB et 9F5BC.
- `pnpm test:e2e tests/e2e/planning-*.spec.ts tests/e2e/glisser-deposer.spec.ts` —
  **100/100 verts**.
- Nouvelle épreuve de capture `tests/e2e/9f5bd-captures-file-toujours-affichee.spec.ts` —
  2/2 verte (375 et 1280 px), prouve que même SANS aucune intervention non affectée dans
  la scène de démonstration, la ligne/colonne « Interventions non affectées » reste
  affichée, vide, en tête, aux trois vues (Semaine, Deux semaines, Jour).

## Captures (`docs/propositions/9F5BD-REPRISE-9F5BC/captures/`)

```
deux-semaines-file-vide-1280.png   deux-semaines-file-vide-375.png
jour-file-vide-1280.png            jour-file-vide-375.png
semaine-file-vide-1280.png         semaine-file-vide-375.png
```

## `pnpm verify:full` (CI=1) — n'a pas fini en 58 minutes, même limite que 9F5B/9F5BA/9F5BB/9F5BC

`docs/propositions/9F5BD-REPRISE-9F5BC/verify-final.txt` porte la trace complète,
tronquée : `format:check`, `typecheck`, `lint`, `test` (5021 passés, **1 échec transitoire
retenu et corrigé** — voir ci-dessous), `test:isolation`, `build` ont tous réussi ; la
suite `test:e2e` complète (1498 tests, 1 seul worker, comme CI) avait dépassé ~44 minutes
sans aucun échec constaté au moment de l'arrêt forcé (58 minutes, limite de l'outil), les
seuls marqueurs rencontrés étant des `°` (retries attendus) et un avertissement de capture
« non prise » déjà connu (hors du périmètre de ce lot).

**L'échec transitoire corrigé** : la première passe de `pnpm verify` a fait rougir
`tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` — la nouvelle épreuve de capture
appelait `page.getByText("Interventions non affectées")` en dur plutôt que par
`fr["statistiques.non_affectees"]` (L0-11). Corrigé (commit `8a16296c`), confirmé vert
isolément.

**Repli** : `CI=1 pnpm verify` (sans `:full`, donc sans `test:e2e`) a ensuite été rejoué
EN ENTIER et est passé **intégralement vert** —
`docs/propositions/9F5BD-REPRISE-9F5BC/verify-narrow.txt` : format, typecheck, lint,
5022 tests unitaires, 1653 tests d'isolation, build, tous verts. Combiné aux 100 épreuves
e2e `planning-*`/`glisser-deposer` mesurées vertes séparément ci-dessus (territoire exact
de ce lot), la correction est vérifiée sans avoir pu rejouer la suite e2e complète dans le
budget imparti — même limite assumée que les quatre lots précédents de cette chaîne.

## HEAD final

```
8a16296c   (avant ce commit de passation — git rev-parse --short HEAD)
```

## Rebase sur `origin/main`

`git fetch origin` puis `git rebase origin/main` : `origin/main` n'a pas bougé depuis le
départ de ce lot (toujours `fe4b58e8`) — rebase sans effet, arbre inchangé.
