# 9G4A1-REPRISE-9G4C — passation (arrêt à T0 + 44 min, budget 90 min)

Parti d'`origin/main` (`a7182b066`) — branche `9G4A1-REPRISE-9G4C`, créée depuis ce
commit. T0 mesuré `01:25` (Pacific/Noumea). Cherry-pick des trois commits de la garde
`9G4C-REPRISE-9G4A-garde` (absents d'`origin/main`), sans conflit :
`2753e20ab` (cause + correctif), `ab8e361aa` (captures AVANT), `5678c1ebc` (passation
9G4C).

## Ce que le pilote avait mesuré (23:09 → 00:17, 26/10)

Cinq échecs, tous PLANNING, tous joués APRÈS MINUIT :
`planning-largeur-et-carte.spec.ts:220/235/252`, `pg-g14a-transmettre.spec.ts:148`
(l.224), `planning-survol-cases.spec.ts:191` (l.178). Hypothèse à trancher : ces échecs
viennent-ils du correctif de `bouton-confirmation.tsx`, ou d'autre chose ?

## Mesure 1 — `pg-g14a-transmettre.spec.ts` : MÊME échec sur `origin/main` SEUL

Rejoué `tests/e2e/pg-g14a-transmettre.spec.ts` deux fois, au même moment (01:26 puis
01:28 Pacific/Noumea) :

- sur ma branche (correctif présent) : 1 échec, `pg-g14a-transmettre.spec.ts:224`,
  `locator('[data-avertissement="intervention.avertissement.courriel_technicien_parti"]')`
  introuvable après le second `deplacer`.
- sur `a7182b066` (`origin/main`, SANS le correctif, checkout détaché temporaire dans ce
  même worktree, aucun commit perdu) : **même échec, même ligne, même message.**

⇒ Ce défaut préexiste au correctif et n'a aucun lien avec `bouton-confirmation.tsx` — ni
cette spec, ni le chemin « Transmettre »/« Déplacer » qu'elle joue, n'ouvrent le dialogue
de confirmation que 9G4C a touché. Hors territoire de ce ticket (le fichier en cause
serait `lib/avertissements/planification.ts`, pas `components/ui/bouton-confirmation.tsx`) :
non corrigé ici, voir « Points ouverts ».

## Mesure 2 — `planning-largeur-et-carte.spec.ts` et `planning-survol-cases.spec.ts` :
verts maintenant, cause structurelle identifiée par lecture (PAS reproduite — pas de
minuit franchi pendant cette mesure)

Rejoués à 01:30 (sur `origin/main` seul) : **14 + échecs attendus → 14 passed**, aucun
échec. Normal : contrairement à la mesure 1, reproduire CE défaut exige de faire tourner
la préparation globale avant minuit et la propre `beforeAll` de la spec après minuit — ce
que je n'ai pas recréé (ni cherché à recréer, le correctif n'étant structurellement pas en
cause, voir ci-dessous).

**Cause structurelle, par lecture du code (file:line) :**

- `tests/e2e/setup/scene.ts:316-317` (`ecrireLaScene`, joué UNE SEULE FOIS par
  `globalSetup`) calcule `aujourdhui` et `lundi` à l'instant où la préparation globale
  tourne, via `lundiSansJourPasse` (`scene.ts:261-269`).
- `tests/e2e/setup/reperes.ts:40,44` (`reperesDeLaScene`, RAPPELÉE dans le `beforeAll`
  de CHAQUE fichier de spec) recalcule `aujourdhui` et `lundi` à l'instant où CETTE
  spec démarre, par le MÊME `lundiSansJourPasse`.
- `lundiSansJourPasse` avance d'une semaine entière dès que `MARDI` (lundi+1) n'est plus
  **strictement futur** par rapport à `aujourdhui` (`comparerJours(...) <= 0`,
  `scene.ts:263`).

Si la préparation globale tourne avant minuit un jour où MARDI tombe le lendemain (pas
d'avance : MARDI reste strictement futur), puis qu'une spec individuelle appelle
`reperesDeLaScene()` APRÈS minuit, une fois ce « lendemain » devenu aujourd'hui : pour
cette spec, MARDI (même lundi) n'est plus strictement futur (égal à aujourd'hui) →
`lundiSansJourPasse` avance d'une semaine entière. La spec vise alors une semaine que la
scène écrite en base ne couvre pas — d'où « carte introuvable », « partie non visible »,
exactement les trois symptômes mesurés par le pilote. C'est la même famille de défaut que
9D2-TESTS-DATES-NOUMEA et 9F5BA-REPRISE-9F5B (déjà nommés dans les commentaires de ces
deux fichiers), pas une erreur de fuseau — `jourDe`/`maintenant` utilisent déjà
Pacific/Noumea correctement des deux côtés. Rien n'est corrigé ici : la consigne du
ticket est de ne PAS toucher à une scène/épreuve datée sauf erreur de fuseau évidente, ce
qui n'est pas le cas — c'est une vraie course entre deux processus qui recalculent
« aujourd'hui » à des instants différents d'une suite de ~1700 s. Voir « Points ouverts ».

⇒ Les deux hypothèses convergent : AUCUN des cinq échecs mesurés par le pilote ne vient du
correctif de 9G4C.

## Étape 4 — les deux épreuves du dialogue, `--repeat-each=5`

`CI=1 pnpm exec playwright test tests/e2e/absences-levee-confirmation.spec.ts
tests/e2e/9ewb1-feuille-basse-375-menu-plus.spec.ts --workers=1 --repeat-each=5` →
**100 passed** (01:34–01:39).

## POINT OUVERT 1 — la course de minuit sur `lundiSansJourPasse` (PAS corrigée ici)

`tests/e2e/setup/scene.ts:263` (et son usage à la ligne 317) contre
`tests/e2e/setup/reperes.ts:44` : deux processus distincts (préparation globale, spec
individuelle) recalculent indépendamment « aujourd'hui » pendant une suite e2e qui dure
largement plus d'une heure sous `CI=1 --workers=1`. Si l'exécution franchit minuit entre
les deux calculs, le jour « MARDI » visé par la scène écrite en base et celui visé par la
spec qui s'exécute plus tard peuvent diverger d'une semaine entière. Plusieurs fichiers
de scénario (`planning-largeur-et-carte.spec.ts`, `planning-survol-cases.spec.ts`, et
vraisemblablement d'autres qui partagent `reperesDeLaScene`) y sont exposés. Hors
territoire de ce ticket (`tests/e2e/setup/`, pas `bouton-confirmation.tsx`) — à ouvrir
comme ticket dédié si la suite continue de franchir minuit en CI.

## POINT OUVERT 2 — `pg-g14a-transmettre.spec.ts:224`, échec PRÉEXISTANT, reproductible
sans minuit (PAS corrigé ici)

Reproduit deux fois, à 01:26 et 01:28 (aucun franchissement de minuit), identique sur
`origin/main` seul : après un second geste « Déplacer » sur une intervention déjà
`Affectée`, l'avertissement
`[data-avertissement="intervention.avertissement.courriel_technicien_parti"]` n'apparaît
pas. Le premier avertissement (après « Transmettre », ligne 200) passe ; c'est le second
(après « Déplacer », ligne 224) qui échoue. La cause n'a pas été creusée — hors
territoire (`lib/avertissements/planification.ts`, pas `bouton-confirmation.tsx`), et ce
n'est ni une question de minuit ni de réseau (le transport courriel est doublé par
`tests/e2e/setup/double-courriel.cjs`, aucun appel réel). À ouvrir comme ticket dédié.

## POINT OUVERT 3 — `pnpm verify:full` NE S'EST PAS TERMINÉ DANS LE BUDGET (deuxième
reprise consécutive)

`CI=1 pnpm verify:full` lancé en un seul appel, au premier plan, à 01:38 — tué après
30 min (limite de l'outil, pas un verdict du code) à mi-parcours de la suite e2e (environ
900 à 950 des 1668 tests e2e exécutés sans aucun échec visible dans ce qui a tourné,
voir `verify-final.txt`, ~646 lignes). `format:check`, `typecheck`, `lint`, `test`,
`test:isolation`, `build` ont tous tourné et réussi AVANT que la suite e2e ne démarre
(aucune ligne d'échec dans `verify-final.txt` avant `Running 1668 tests`). **Deuxième
reprise de suite où `pnpm verify:full` dépasse le budget du ticket** (9G4C l'avait déjà
signalé) : la suite e2e complète dépasse largement l'heure sous `CI=1 --workers=1`. Une
capture régénérée par effet de bord d'AUTRES spécs (captures de 47-AVERTISSEMENTS-1,
9DF-TP-CY2-MATRICE-D8, etc. — 132 fichiers modifiés, 10 nouveaux) a été restaurée/retirée
avant de committer, conformément à la consigne (« jamais une capture régénérée par effet
de bord d'une AUTRE épreuve »). `pnpm verify` SEUL (sans `:full`) est vert, voir
ci-dessous.

## `pnpm verify` (sans `:full`) — vert

Rejoué séparément après la coupure de `verify:full`, exit 0.

`git fetch origin` / `git rebase origin/main` : `origin/main` n'a pas avancé depuis le
départ (`a7182b066`) ; rien à rebaser.
