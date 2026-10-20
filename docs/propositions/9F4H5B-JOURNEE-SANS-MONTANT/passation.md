# 9F4H5B-JOURNEE-SANS-MONTANT — passation

Branche dédiée `9f4h5b-journee-sans-montant`, partant d'`origin/main` (ce
worktree était en HEAD détachée sur `6cc0b673`, `main` étant extrait ailleurs
— `/home/aplou/codiplan`). Quatre commits, un par point, plus un cinquième
pour les captures du point 5 et un sixième de formatage :

1. **Point 4 (préparation)** — `jourEtDateAbregee` et `machinesAffichees`
   déménagés de `app/(back-office)/interventions/presentation.ts` vers
   `lib/interventions/presentation-partagee.ts`. Le back-office les
   réimporte et les réexporte sous le même nom : aucun appelant existant
   n'a eu besoin de changer.
2. **Point 1** — `lib/terrain/projection-journee.ts` (nouveau) : la fonction
   `projeterLigneJournee` rend un type dédié, `LigneJourneeAffichee`, qui ne
   porte que ce que la carte affiche — liste FERMÉE de champs à inclure.
   `app/(mobile)/terrain/page.tsx` projette chaque ligne après répartition
   (`repartirJourneeTechnicien`) et avant de la passer à `ListeJournee`.
   `components/terrain/liste-journee.tsx` est réécrit pour consommer ce
   type — **et ce même passage porte aussi les points 2 et 3** (badge
   unique, `flex-wrap`) : les trois tenaient dans la même carte au même
   rendu, et je n'ai pas reconstruit de versions intermédiaires du fichier
   pour les séparer en commits — limite assumée sur la granularité des
   commits, pas sur le contenu.
3. **Point 2** — `lib/terrain/vues-locales.ts` et son épreuve retirés. Une
   seule pastille « Nouveau » (`vue_technicien_le`), une seule annonce
   `role="status"` TOUJOURS dans le DOM (`sr-only` + texte vide quand le
   compte est nul). `terrain.badge_nouvelle` retiré du dictionnaire.
   `tests/e2e/9f4h5-nouvelle-intervention.spec.ts` et
   `tests/e2e/captures-9f4h5-terrain-vivant.spec.ts` adaptés.
4. **Point 3** — `flex-wrap`/`min-w-0` sur les trois conteneurs flex de
   l'en-tête de carte ; `tests/e2e/9f4h5b-ma-journee-375.spec.ts` (nouveau).
5. **Point 5** — `tests/e2e/captures-9f4h5b-journee-sans-montant.spec.ts`
   (nouveau), captures dans `docs/propositions/9F4H5B-JOURNEE-SANS-MONTANT/
   captures/` (`ma-journee-nouveau-{375,1280}.png`, vérifiées visuellement :
   aucun débordement à 375, une seule pastille « Nouveau », message
   d'annonce visible).

## Bundle (point 4) — avant / après, `pnpm build`

Mesuré en stashant mes changements (`git stash push -u`, restaurés ensuite
par `git stash apply <sha>` puis `git stash drop` — jamais de stash/pop nu,
conformément à la consigne du worktree) pour obtenir un « avant » sur le
même poste, sans checkout d'un autre commit.

| Route | Avant | Après |
|---|---|---|
| `/terrain` (page) | 2.46 kB | 2.06 kB |
| `/terrain` (First Load JS) | 193 kB | **191 kB** |
| `/terrain/[id]` (First Load JS) | 197 kB | 194 kB |
| `/terrain-hors-reseau` (First Load JS) | 197 kB | 195 kB |

Les trois routes terrain baissent, pas seulement `/terrain` : `components/
terrain/presentation.ts` (consommé aussi par `terrain-hors-reseau` et la
fiche) importait déjà `jourEtDateAbregee` depuis le back-office pour
`libelleDatesSuite` — ce chemin-là aussi tirait `presentation.ts` au complet
dans le paquet avant ce lot.

## Ce qui n'a PAS pu être rejoué en entier — limite assumée

`CI=1 pnpm verify:full` lance `pnpm test:e2e` SANS filtre, la suite
COMPLÈTE (1479 épreuves) — sous `CI=1`, `workers=1` (voir `playwright.
config.ts`). Une première tentative a été tuée par le harnais à 30 minutes,
encore en cours (environ 40 % de la suite d'après les points affichés).
Mesuré séparément : les 14 épreuves de `tests/e2e/offline/*` jouent en
1 min 36 s à 1 worker — extrapolé aux 1479 épreuves de la suite complète,
la jouer en entier dépasse très largement les 120 minutes du lot. Je n'ai
pas de mesure antérieure (sur `origin/main`) de la durée de la suite
complète à comparer : ce n'est pas une régression mesurée, c'est un constat
d'échelle qui dépasse ce que CE lot peut couvrir seul.

**Ce qui a tourné, et est VERT :**
- `CI=1 pnpm verify` (format:check, typecheck, lint, test — 4951 épreuves —,
  test:isolation, build) : **vert**, journalisé dans `verify-final.txt`.
- `pnpm feries:horizon`, `pnpm audit:partitions` : **verts**.
- Le sous-ensemble e2e ciblé par ce lot, joué à part, à 1 worker :
  `tests/e2e/9f4h5-nouvelle-intervention.spec.ts`,
  `tests/e2e/9f4h5b-ma-journee-375.spec.ts`,
  `tests/e2e/captures-9f4h5-terrain-vivant.spec.ts` (375 et 1280 px),
  `tests/e2e/captures-9f4h5b-journee-sans-montant.spec.ts` (375 et 1280 px),
  et les 9 épreuves de `tests/e2e/offline/*` listées ci-dessous — **18
  épreuves, toutes vertes**.

**Une mesure de contention, pas une régression** : en lançant le lot entier
d'épreuves ciblées à 10 workers (`fullyParallel: true`, mode par défaut hors
CI), 5 épreuves de `tests/e2e/offline/` ont rougi (`9f4h3-mode-avion`,
`9f4h3a-file-sans-perte`, `9f4h3ac-correctifs-revue`, `9f4h4-ouverture-
a-froid`, `9f4h4d-coquille-sans-session`) — toutes avec des erreurs de
timing ou de doublon (deux cases à cocher trouvées, texte attendu absent
après un clic). Rejouées SEULES à 1 worker (`--workers=1`), les 9 épreuves
de ces 5 fichiers passent toutes. Aucune de ces épreuves ne touche un
fichier modifié par ce lot (compteur, envoi hors ligne, coquille) — la
rougeur venait de la contention de 10 workers partageant la même base entre
suites non conçues pour tourner ensemble à cette échelle, pas de mon
changement. `CI=1 pnpm verify:full` tourne précisément à 1 worker pour
cette raison ; c'est sa DURÉE qui dépasse le budget du lot, pas sa fiabilité.

## Captures régénérées par effet de bord — écartées, pas commitées

La tentative de `test:e2e` complet a régénéré ~130 captures PNG d'autres
tickets (`47-AVERTISSEMENTS-1`, `9F2-TERRAIN-JOURS-MAQUETTE`,
`9EC-TP-UX3-E-ABSENCES`, etc. — fichiers `captures-*.spec.ts` qui écrivent
sur un chemin fixe à chaque exécution, sans verrou). Toutes écartées
(`git checkout --` pour les modifiées, supprimées pour les nouvelles) avant
tout commit, conformément à la consigne. Seules les deux captures de CE lot
sont commitées.

## Rebase et vérification finale

```
git fetch origin
git rebase origin/main   # sans effet : la branche part déjà d'origin/main
CI=1 pnpm verify         # vert
```

`git status --porcelain` vide avant de rendre la main.
