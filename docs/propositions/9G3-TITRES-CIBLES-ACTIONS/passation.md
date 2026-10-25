# 9G3A-REPRISE-9G3 — passation

Parti de `9G3-TITRES-CIBLES-ACTIONS-garde` (`fe0a7122f`), déjà directement sur
`origin/main` (`46ab3de58`) — aucun rebase nécessaire, `git merge-base` confirmé
identique au tip d'`origin/main` tout du long de cette reprise. Branche de travail :
`9G3A-REPRISE-9G3`.

`tickets/recales/9G3-TITRES-CIBLES-ACTIONS.md` et
`traces/9G3-TITRES-CIBLES-ACTIONS-verify-1.txt`, cités par le ticket de reprise,
**n'existent dans ce dépôt sous aucune forme** — ni sur ce worktree, ni dans
l'historique git d'aucune branche, ni ailleurs sur la machine (recherche large,
`find` + `git log --all`). Même situation déjà rencontrée et documentée par
`docs/propositions/9G9B-ENTETES-TEXTES-ACCES/passation.md` (« Reprise 9G9BB ») :
repris sur la seule base du code, des 5 commits de point de `9G3-TITRES-CIBLES-ACTIONS`
(messages complets relus) et du contenu du ticket de reprise lui-même, qui résume le
premier passage de vérification indépendante.

## Ce qui a été repris du ticket

1. `tests/e2e/registre-2.spec.ts:253` — **défaut de l'application, corrigé.**
2. `tests/e2e/absences-levee-confirmation.spec.ts:150` — **instabilité pré-existante,
   non causée par 9G3, non corrigée.**
3. `tests/e2e/9ewb1-feuille-basse-375-menu-plus.spec.ts:438` — même famille que le
   point 2 (voir ci-dessous), non corrigée.

### 1. registre-2 — `LigneResume` n'accordait pas 0 au singulier

Le point 5 de 9G3 (« le pluriel du zéro ») a corrigé `decompte`
(`app/(back-office)/presentation.ts`, lu par `Pagination`) et `auPluriel`
(`lib/navigation/decomptes-parametrage.ts`), mais le registre des interventions compte
le résultat affiché à DEUX endroits distincts (constat déjà noté dans les commentaires
du spec, depuis TP-UX3-1-REGISTRE-1) : `Pagination` (par `decompte`) ET `LigneResume`
(`components/ui/ligne-resume.tsx`), qui porte sa PROPRE règle d'accord
(`nombre === 1 ? ... : ...`), jamais touchée par le point 5. À zéro résultat, l'écran
affichait donc deux comptes en désaccord : « 0 intervention » (Pagination) contre
« 0 interventions » (LigneResume) — mesuré en reproduisant l'échec
(`getByText('0 intervention', {exact:true})` : 2 attendus, 1 reçu).

Corrigé dans `LigneResume` avec la même règle (0 ET 1 au singulier), avec le commentaire
expliquant pourquoi ce composant ne peut pas simplement importer `decompte` depuis
`app/(back-office)/` (direction d'import interdite, composant générique de `components/ui/`).
Épreuve ajoutée dans `tests/unit/ui/ligne-resume-et-bascule-densite.test.tsx` sur le cas
nommé par le point 5 lui-même. `tests/e2e/registre-2.spec.ts` rejoué seul : 5/5 verts.

**Sweep NON fait, volontairement** : `grep -rn "=== 1 ?"` trouve une quinzaine d'autres
emplacements dans l'app (`absences/presentation.ts`, `materiel/page.tsx`,
`tableau-de-bord/presentation.ts`, `equipe/presentation.ts`, `vgp/libelles.ts`,
`barre-selection.tsx`, `terrain/liste-journee.tsx`, …) qui portent le MÊME défaut
(0 prend le pluriel) et que le point 5 n'a jamais prétendu couvrir — son message de
commit ne cite que `decompte`, `auPluriel` et l'appel `motDansUnePhrase` de
`tarifs/page.tsx`. Aucun de ces autres emplacements ne cause d'échec mesuré par ce lot ;
les toucher aurait dépassé le territoire de cette reprise (le contrat de 9G3, pas une
règle d'accord généralisée au produit entier). Un ticket dédié serait légitime si la
règle « 0 prend le singulier » doit devenir uniforme.

### 2 et 3. Dialogue de `BoutonAvecConfirmation` sur `/absences` — flake pré-existante, pas une régression de 9G3

Reproduit à deux reprises (une fois dans chaque spec, selon l'ordre d'exécution) : le
clic sur le bouton « Revenir » du dialogue de confirmation (`components/ui/
bouton-confirmation.tsx`, native `<dialog>`/`showModal()`) expire après 30 s. Trace
Playwright du premier échec (capturé avec `--trace=on`, pas seulement
`on-first-retry`) : le dialogue est bien ouvert, sa géométrie et ses deux boutons sont
mesurés avec succès par `verifierGeometrieDialogue`, puis — moins de 5 ms plus tard —
le clic sur « Revenir » ne résout plus jamais `dialog[open]`. L'instantané DOM pris à
l'expiration ne montre plus aucun `<dialog>` dans l'arbre d'accessibilité : le dialogue
s'est refermé de lui-même entre la mesure de géométrie et le clic, sans action du
scénario.

**Preuve que 9G3 n'en est pas la cause** : `git diff 46ab3de58 HEAD --
components/ui/bouton-confirmation.tsx components/ui/feuille-basse.tsx
'app/(back-office)/absences/page.tsx'` est VIDE — aucun des trois fichiers qui
implémentent ce dialogue n'a été touché par les 5 commits de 9G3. Les seuls fichiers
que 9G3 modifie et qui touchent de près ou de loin un dialogue
(`components/ui/action-primaire.tsx`, `dialogue-cloturer/deplacer/suspendre.tsx`) sont
des composants DIFFÉRENTS, non utilisés par `/absences`. Ce comportement est donc une
instabilité déjà présente avant ce lot — dans la même famille que l'instabilité connue
de `tests/e2e/glisser-deposer.spec.ts`, documentée ailleurs dans ce dépôt
(`docs/propositions/99M-REPRISE-99G/passation.md`,
`docs/propositions/99L-REPRISE-99J/passation.md`) — pas un défaut introduit par ce
ticket. Non corrigée ici : aucune cause confirmée dans le territoire de ce lot, et
« interdit absolu » d'assouplir le test pour le faire taire. Signalé pour un ticket
dédié sur `BoutonAvecConfirmation`.

## Captures régénérées par effet de bord, restaurées

Les épreuves rejouées pour reproduire les trois points ci-dessus (seules, puis en
combinaison, puis la suite e2e complète pour `verify:full`) régénèrent par effet de
bord les captures « avant/après » d'AUTRES tickets (plus de 300 fichiers PNG/PDF à la
fin de la suite complète). Aucune n'est un livrable de ce lot : toutes restaurées
(`git checkout --`) ou supprimées quand nouvellement créées, avant commit.

## `CI=1 pnpm verify`

Vert : `format:check`, `typecheck`, `lint`, `test` (471 fichiers, 5126 tests — +1 sur
le point 1), `test:isolation` (192 fichiers, 1679 tests), `build`.

## `CI=1 pnpm verify:full`

`feries:horizon` et `audit:partitions` verts (2 territoires, horizon tenu ; 13
partitions, horizon tenu, partition par défaut vide).

`pnpm test:e2e` — **interrompu par la limite de l'outil (60 min), comme dans toutes
les sessions précédentes qui l'ont mesuré de bout en bout** (voir p. ex.
`docs/propositions/9G8E-NAV-TECHNICIEN-SANS-ENTREES-BUREAU/passation.md`,
`docs/propositions/9G2-TABLEAUX-EN-CARTES-375/passation.md`). Sortie complète dans
`docs/propositions/9G3-TITRES-CIBLES-ACTIONS/verify-final-e2e.txt` (tronquée, 363
lignes) : 1655 scénarios annoncés, la suite a progressé jusqu'à une mesure
« MESURE … » datée ~47 minutes après le départ sans atteindre la fin. Un échec net
(`×`) et des marqueurs d'instabilité (`°`) apparaissent dans le flux de symboles vers
le milieu du passage, **sans reporter nommé** (la sortie `tee` de ce lot n'exécute pas
avec un reporter qui imprime les noms de scénario) — leur identité n'est PAS établie
par cette session. Les trois scénarios ciblés par ce ticket (`registre-2.spec.ts`,
`absences-levee-confirmation.spec.ts`, `9ewb1-feuille-basse-375-menu-plus.spec.ts`) ont
chacun été rejoués séparément et en combinaison sous `CI=1` (1 worker, 1 retry) — voir
ci-dessus — mais pas dans le cadre de CETTE exécution complète. Point ouvert pour la
prochaine reprise : identifier `×`/`°` de `verify-final-e2e.txt`, et, si le budget le
permet, rejouer `test:e2e` jusqu'à son terme (éventuellement en plusieurs morceaux par
fichier, pour rester sous la limite de l'outil).

## Points ouverts, hérités de 9G3 et non repris ici (budget)

- **Point 3 (partiel, 9G3)** : le câblage de `BarreActionCollee` sur la fiche
  intervention (`interventions/[id]/page.tsx`) reste un point ouvert — l'évaluation
  de 9G3 (« dépasse le budget de ce lot », zone « gestes » à plusieurs boutons
  conditionnels sur une fiche très couverte) tient toujours ; non retenté ici.
- Le sweep de la règle « 0 prend le singulier » aux ~15 autres emplacements listés
  plus haut.
- L'identité du `×`/`°` de la deuxième exécution e2e (voir ci-dessus).

## Rebase avant remise

`git fetch origin` : `origin/main` toujours à `46ab3de58`, inchangé depuis le départ
de cette reprise — aucun rebase nécessaire.
