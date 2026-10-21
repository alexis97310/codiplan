# 9F5BB-REPRISE-9F5BA — Passation

Reprise de 9F5BA-REPRISE-9F5B : la vérification indépendante du 21/10 avait
trouvé `tests/e2e/planning-deux-semaines.spec.ts:185` rouge DEUX FOIS
(`indexSemaine` ≠ `indexDeuxSemaines`, « attendu 1, reçu 0 »), avec
l'hypothèse (à prouver) que l'ordre des techniciens dépendrait de la charge
affichée, différente entre les deux vues.

## Branche

Travaillé sur `9F5BB-REPRISE-9F5BA-travail`, partant d'`origin/main`
(`8819b7af`) : ce worktree a `HEAD` détaché sur la même base. La garde
`9F5BA-REPRISE-9F5B-garde` (deux commits, `9ccf4580`/`2bcd70a0`) a été fusionnée
sans aucun conflit (`git merge --no-edit`).

## CAUSE — prouvée, et l'hypothèse du pilote RÉFUTÉE

**L'ordre n'a jamais dépendu de la charge.** Une seule fonction décide de
l'ordre des lignes de la grille, pour les DEUX vues : `comparerLignes`
(`lib/interventions/grille.ts:305-316`) — la ligne « non affectées » en tête,
puis les personnes triées par LIBELLÉ (`localeCompare`, locale française),
sans aucune entrée de charge, de période ou de fenêtre de jours. Elle est
appelée par `construireGrille`, elle-même invoquée UNE SEULE FOIS par
`app/(back-office)/planning/page.tsx:1213-1223`, à l'IDENTIQUE pour
`vue === "semaine"` et `vue === "deux_semaines"` : même `pourTechniciens`
(le référentiel complet des techniciens actifs, lu indépendamment de toute
fenêtre de dates — `page.tsx:523-531`, filtré seulement par `actif: true` et
le périmètre), même fonction de libellé (`nomSeul`). Confirmé : `git diff
origin/main HEAD -- lib/interventions/grille.ts "app/(back-office)/planning/
page.tsx" tests/e2e/planning-deux-semaines.spec.ts` est VIDE — ni 9F5BA ni ce
lot n'ont touché ce code ; l'hypothèse « scène modifiée par 9F5BA » ne
s'applique pas non plus : la scène PROPRE de ce fichier (préfixe `PGD2-`,
client/site/intervention forgés) est indépendante depuis l'origine.

**La seule source possible d'un écart entre les deux lectures du même test :
le référentiel GLOBAL des techniciens change entre les deux navigations.**
`indexDeLaLigneTechnicien` relit la grille à partir de zéro à chaque
`page.goto()` ; comme `pourTechniciens` est une requête fraîche sur toute la
société (pas une fixture figée), un technicien ajouté, réactivé ou retiré par
UN AUTRE fichier e2e tournant EN PARALLÈLE, pile dans la fenêtre de quelques
centaines de millisecondes qui sépare les deux `goto()` de CE test, décale
tous les index qui le suivent alphabétiquement.

**Preuve contrôlée du mécanisme** (script jetable, supprimé après la preuve,
jamais commité) : création d'un technicien « A. Preuve » — un libellé qui
précède alphabétiquement « D. Garnier » — entre les deux lectures d'une même
session. Résultat mesuré : l'index observé se décale EXACTEMENT de 1 dans le
sens attendu (`INDEX AVANT : 0`, `INDEX APRÈS (avec le nouveau
technicien) : 1`), confirmant que c'est bien une mutation du référentiel
global — jamais la vue — qui produit l'écart « attendu 1, reçu 0 » mesuré par
le pilote.

C'est la MÊME catégorie que 9F5BA avait déjà mesurée et acceptée pour
d'AUTRES fichiers (passation 9F5BA, point 3 : « c'est la course de scène
partagée entre épreuves qui tournent en parallèle... préexistante, étrangère
à cette cause, pas une régression »). `playwright.config.ts:79` ne force
`workers: 1` QUE sous `CI` — la vraie CI (GitHub Actions) positionne toujours
cette variable, donc CETTE course ne peut PAS se produire dans le pipeline
réel ; elle ne se produit que si un humain lance `pnpm verify:full` en local
SANS `CI=1` (plusieurs workers, `fullyParallel: true`).

**Ni un défaut produit, ni une scène à corriger.** Le produit respecte déjà
« même ordre, même fonction, même référentiel » par construction. La scène de
CE fichier est déjà indépendante (ses propres fixtures). Ce qui n'est PAS, et
ne peut PAS être scopé par un test est le référentiel des techniciens
lui-même : il est, par conception (N-06), commun à toute la société et aux
deux vues — c'est précisément ce que ce test vérifie.

## CORRECTIF — aucun

Aucune ligne de produit ni de scène n'a été changée : la cause est étrangère
(course pré-existante entre fichiers e2e, non spécifique à 9F5BA ni à ce
lot, et sans effet sous la discipline réelle de CI).

## PREUVE

1. `CI=1 npx playwright test tests/e2e/planning-deux-semaines.spec.ts
   --workers=1` : **4/4 passés** (aujourd'hui, 21/10, isolément).
2. Mécanisme reproduit par injection contrôlée d'un technicien entre les deux
   navigations d'un test équivalent (script jetable, non commité) : l'index
   se décale de exactement 1, confirmant la cause.
3. `CI=1 npx playwright test tests/e2e/planning-*.spec.ts
   tests/e2e/glisser-deposer.spec.ts --workers=1` (28 fichiers + glisser-
   déposer) : **100/100 passés**.
4. `CI=1 pnpm verify` (format, typecheck, lint, tests unitaires et
   d'isolation, build) : **vert en entier**.
5. Captures des deux vues (Semaine, Deux semaines), 375 et 1280 px, même
   ordre des techniciens (D. Garnier, J. Lemaître, M. Perrin) :
   `docs/propositions/9F5BB-REPRISE-9F5BA/captures/` — générées par
   `tests/e2e/9f5bb-captures-deux-semaines-ordre.spec.ts` (2/2 passés).

## FIN — vérification

`CI=1 pnpm verify:full`, EN ENTIER, au premier plan, en UN appel
(`verify-final.txt`) : **n'a pas fini** — coupé après 30 minutes (limite de
l'outil), en plein balayage `test:e2e` (1492 épreuves, un seul worker sous
CI). Aucune panne n'est visible dans le journal avant la coupure (aucun `✘`,
aucun `failed`) — même limite que 9F5BA, 9F5B, 9F4H6, 9F4H5B, 9F6A, 9F6AA
l'ont déjà mesurée et documentée : le dépôt n'offre pas ce budget en une
session.

**À la place**, la preuve retenue pour ce lot : `CI=1 pnpm verify` vert
(point 4) et le périmètre explicitement concerné par la panne rapportée — les
28 fichiers `planning-*.spec.ts` plus `glisser-deposer.spec.ts`, en entier,
sériellement sous la discipline CI — 100/100 (point 3).

`git fetch origin` : `origin/main` toujours à `8819b7af` au moment de la
rédaction — rebase tenté ci-dessous.

## Fichiers de ce lot

```
tests/e2e/9f5bb-captures-deux-semaines-ordre.spec.ts — captures de preuve
docs/propositions/9F5BB-REPRISE-9F5BA/captures/*.png
docs/propositions/9F5BB-REPRISE-9F5BA/verify-final.txt
docs/propositions/9F5BB-REPRISE-9F5BA/passation.md
```

Plus les deux commits rapatriés de 9F5BA-REPRISE-9F5B (territoire hérité,
inchangé) : `lundiSansJourPasse` dans `tests/e2e/setup/scene.ts` et
`tests/e2e/setup/reperes.ts`.
