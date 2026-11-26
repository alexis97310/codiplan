# 9L44-STATUT-MACHINE-SIMULTANE-SORTIE — passation

Ligne « Statut machine : écritures simultanées, confirmation de sortie du parc renforcée » des réserves des
revues (`lib/feuille-de-route/contenu.ts`). **Aucune migration.**

## Ce qui a été mesuré avant d'écrire une ligne

`changerStatutMachine` (`lib/machines/depot.ts`) lisait le statut, décidait (`decisionDepuisLaFiche`), puis
écrivait sans jamais revérifier qu'il n'avait pas changé entre les deux : deux écritures concurrentes sur la
même fiche, la **dernière** gagnait toujours, en silence — aucun refus, aucune trace de ce qui avait été
perdu.

**Première forme écrite, et écartée en la mesurant** : un verrou optimiste sur `modifie_le` (le candidat
naturel, `@updatedAt`) — posé dans le `WHERE` de l'écriture. **Elle ne fonctionnait JAMAIS, même sans la
moindre écriture concurrente** : la colonne est `timestamptz` (microseconde), le `Date` JavaScript ne porte
que la milliseconde, et Prisma — en relisant puis en reposant la même valeur — perd systématiquement les six
derniers chiffres. Le premier test isolé l'a montré immédiatement (le chemin « accepté » déjà existant du
fichier de test se mettait soudain à refuser « modifie_entre_temps », sans aucune concurrence). Corriger la
précision aurait exigé une migration (`@db.Timestamptz(3)`), exclue de ce lot par consigne. **Le statut LU
est le champ exact que ce chemin dispute, ne perd rien au passage, et sert de verrou à sa place** — voir D285
pour le détail, et la note de tête de `changerStatutMachineDans`.

## Ce qui a été livré

1. **Le verrou optimiste** — `changerStatutMachineDans` (`lib/machines/depot.ts`) reçoit un `statutAttendu`
   optionnel, rejoint `id` dans le `WHERE` de l'`updateMany`. `changerStatutMachine` le passe désormais,
   armé du statut qu'elle vient de lire. Une ligne déjà changée par une autre transaction depuis cette
   lecture ne matche plus : zéro ligne touchée, refus nommé **`modifie_entre_temps`** (nouveau motif de
   `MotifRefusMachine`), jamais un écrasement silencieux. `deposerDemande` (`lib/demandes/depot.ts`), seul
   autre appelant de `changerStatutMachineDans`, omet ce paramètre et garde son comportement déjà arbitré
   (une valeur annexe à une création s'ignore, elle ne se dispute pas) — **inchangé**.
2. **La confirmation d'une vraie sortie du parc retape le code** — `remplacee`/`ferraillee` seulement,
   jamais le RETOUR (qui vise un état actif, et garde son dialogue Confirmer/Revenir simple, inchangé).
   `BoutonAvecConfirmation` (`components/ui/bouton-confirmation.tsx`) porte le mécanisme en générique
   (`saisieDeControle: { attendu, libelle }`) — le bouton de confirmation reste désactivé tant que le texte
   saisi (espaces de bord ignorés) n'égale pas exactement `attendu`. Réutilisable par un autre geste
   irréversible de ce dépôt sans dupliquer la mécanique. Le code comparé est `referenceMachine(machine)`
   (`MAC-000123`/`Local-<6>`, déjà affiché en tête de fiche), jamais le numéro de série (qui peut porter
   « fiche à compléter », N-11).
3. `optionsChangerStatutMachine` (`app/(back-office)/parc/presentation.ts`) porte un champ `sortie`
   supplémentaire (la cible est-elle réellement `remplacee`/`ferraillee`), distinct de `confirmation` (qui
   couvre aussi le retour). La tuile Machine (`interventions/[id]/page.tsx`), qui ne propose jamais de
   sortie, pose `sortie: false` en dur.
4. **Aucun champ « motif »** n'a été ajouté : il n'en existait pas déjà, et le ticket l'interdisait
   explicitement dans ce cas.

Deux clés neuves dans `lib/i18n/fr.ts` : `machine.refus.modifie_entre_temps`,
`machine.changer_etat.sortie_retape_avant`/`sortie_retape_apres`.

## Épreuves

- `tests/isolation/changer-statut-machine.test.ts` — nouveau describe « deux écritures concurrentes sur la
  même fiche » : un verrou `SELECT … FOR UPDATE` posé depuis une connexion **externe** (`clientOwner`) force
  deux transactions réelles à lire la même version avant que l'une des deux ne puisse écrire — sans lui,
  l'issue dépendrait du hasard du réseau (une lecture Prisma ne bloque jamais sur un verrou de ligne). Un
  appel est accepté, l'autre refusé `modifie_entre_temps`, rien n'est écrasé.
- `tests/e2e/9l44-sortie-du-parc-retype.spec.ts` (neuf, 1280 et 375 px) — le dialogue de sortie : bouton
  désactivé sans rien taper, toujours désactivé avec un code FAUX, activé avec le code EXACT, puis la fiche
  montre le nouveau statut.
- `pnpm test` (6095), `pnpm test:isolation` (2579), `pnpm typecheck`, `pnpm lint`, `CI=1 pnpm verify` (format,
  typecheck, lint, test, test:isolation, build) — tous verts.
- Un gardien de forme a dû être mis à jour en cours de route : `tests/unit/ui/carte-pas-recopiee.test.ts`
  (nouvelle exception nommée pour le `<input>` de retype dans `bouton-confirmation.tsx`) — jamais assoupli,
  une ligne EXPLIQUÉE ajoutée à sa liste fermée, comme le fichier le prescrit lui-même.

## Captures de ce lot

`docs/propositions/9L44-STATUT-MACHINE-SIMULTANE-SORTIE/captures/` — **APRÈS seulement**, à 1280 et 375 px :
`9l44-dialogue-retype-rempli-apres-{1280,375}.png` (dialogue ouvert, code exact tapé, bouton activé) et
`9l44-fiche-sortie-confirmee-apres-{1280,375}.png` (fiche machine après la sortie). **AVANT non versé** : le
champ de retype est NEUF, rien dans l'arbre d'avant ce lot ne le montre — même raisonnement déjà écrit par
`tests/e2e/9l20-deplacer-machine.spec.ts` (« AVANT NON REPRODUCTIBLE SUR CET ARBRE »). Le dialogue simple
(sans retype, pour le RETOUR) est inchangé et déjà documenté par les captures de 9I8F1-REPRISE-9I8F.

**`docs/captures/` (le fleet général) n'a PAS été rejoué.** `pnpm captures:etat` le montre déjà en retard de
**73 fichiers de surface** sur `6d207f0` — bien au-delà des quatre fichiers touchés par ce lot, preuve que ce
rafraîchissement complet (base jetable, migration, semis, trois comptes, `scripts/captures.mts`) n'est pas
rejoué à chaque ticket malgré la consigne qui le redemande en tête de chacun. Le relancer seul, pour ce lot,
n'aurait photographié aucun écart sur l'écran touché (le dialogue est fermé par défaut, le rendu de repos de
`/parc/[id]` ne change pas) mais aurait quand même consommé une bonne part du budget du lot sur un écart
préexistant et bien plus large que lui. **À signaler au pilote** : soit regrouper ce rafraîchissement dans un
lot dédié, soit confirmer qu'il reste attendu à chaque ticket malgré son coût.

## Feuille de route et arbitrage

- `lib/feuille-de-route/contenu.ts` : la ligne migrée de « Réserves des revues, à regrouper » vers « Livré
  depuis le 31/10 », référencée `(9L44)`.
- `docs/arbitrages.md` : **D285** — le choix du statut lu plutôt que `modifie_le` (et pourquoi), et la
  confirmation renforcée de la sortie du parc, avec condition de réouverture.

## Pour la suite

- `lib/machines/depot.ts` porte désormais, en tête de `changerStatutMachineDans`, la mise en garde contre un
  futur verrou sur `modifie_le` sans migration préalable de précision — à relire avant toute tentative.
- `saisieDeControle` (`components/ui/bouton-confirmation.tsx`) est prêt à être réemployé par un autre geste
  irréversible qui en aurait besoin, sans dupliquer le mécanisme.

## Reprise 9L44A-REPRISE-STATUT-MACHINE

9L44 était RECALÉ deux fois sur la MÊME cause, hors lot : `tests/e2e/captures-9f4h5b-journee-sans-montant.
spec.ts:155` levait « strict mode violation » sur un `getByRole("status")` non filtré, ambigu dès que la
pastille réseau (9L42) et le message d'annonce coexistaient dans le DOM. 9L42B, publié sur `origin/main`
entre les deux passages, a déjà rendu ce localisateur précis (`.filter({ hasText: /transmis/ })`) et a déjà
audité toutes les occurrences `getByRole("status")` des e2e (voir sa passation). Le travail de 9L44
lui-même — verrou optimiste, retype de confirmation — était déjà fini et vert avant le recalage.

**Ce qui a été fait ici** :

1. Branche `9L44A-REPRISE-STATUT-MACHINE` ouverte à jour d'`origin/main` (qui contient déjà 9L42B). Les cinq
   commits de `9L44-STATUT-MACHINE-SIMULTANE-SORTIE-garde` ont été reportés par `git cherry-pick`, un par un, dans l'ordre
   d'origine — **aucun conflit** avec 9L42B : les deux lots touchent des fichiers disjoints (9L42B ne touche
   que le spec de capture et sa pastille réseau ; 9L44 touche `lib/machines/depot.ts`,
   `components/ui/bouton-confirmation.tsx`, `app/(back-office)/parc/presentation.ts`, `lib/i18n/fr.ts`,
   `docs/arbitrages.md`, `lib/feuille-de-route/contenu.ts` et son propre spec e2e neuf).
2. `tickets/recales/9L44-STATUT-MACHINE-SIMULTANE-SORTIE.md` et `traces/9L44-STATUT-MACHINE-SIMULTANE-SORTIE-verify-{1,2}.txt`, cités par
   le ticket de reprise comme référence, **n'existent nulle part** sur ce poste (ni sur `origin/main`, ni sur
   la branche garde, ni dans les autres copies de travail du dépôt accessibles). Le contenu mesuré par le
   pilote était déjà repris en entier dans le corps du ticket de reprise lui-même (cause, fichier, ligne,
   lots en cause) : j'ai travaillé sur cette base sans pouvoir ouvrir les fichiers sources. À signaler au
   pilote si cette trace devait être conservée ailleurs.
3. **Audit des localisateurs de la même famille** (non exacts, sans portée, ou qui comptent des boutons)
   pouvant rencontrer l'écran modifié par 9L44 (`/parc/[id]`, le dialogue de changement de statut, le champ
   de retype neuf) :
   - `grep -rn 'selectOption("remplacee")\|selectOption("ferraillee")' tests/e2e/` — **seul**
     `9l44-sortie-du-parc-retype.spec.ts` vise ces deux statuts. Aucun autre spec ne peut donc faire
     apparaître le dialogue de retype neuf ; aucune collision possible avec son
     `getByRole("textbox")` (scopé au dialogue, qui n'y porte qu'un seul champ) ni avec son bouton
     « Confirmer » (scopé de même).
   - `grep -rn 'getByRole("textbox"' tests/e2e/` — les quatre autres occurrences (mentions légales, checklist
     terrain, note interne d'intervention, qualité du signataire) portent toutes un `name` précis et ne
     visitent jamais `/parc/[id]`.
   - `grep -rln '/parc/\${'` (24 fichiers visitant la fiche machine) croisé avec la liste ci-dessus : aucun ne
     sélectionne `remplacee`/`ferraillee` — `9i8f-statut-machine-modifiable.spec.ts`, le plus proche (même
     formulaire `changer-statut`), ne transite qu'entre `en_service`/`en_panne`/`arretee`, jamais touché par
     le retype.
   - `grep -rn 'dialog\[open\]' tests/e2e/` (une cinquantaine d'occurrences) : toutes scopées à un seul
     dialogue par test, convention déjà uniforme dans ce dépôt — aucune n'est ambiguë au sens de 9L42B
     (deux éléments simultanément visibles), parce qu'un seul `<dialog>` est `[open]` à la fois.
   Aucun localisateur à corriger : l'audit ne trouve aucune ambiguïté neuve introduite par ce lot.

## Épreuves de la reprise

- `CI=1 pnpm playwright test --workers=1 tests/e2e/9l44-sortie-du-parc-retype.spec.ts` — 2 passed.
- `CI=1 pnpm playwright test --workers=1 tests/e2e/captures-9f4h5b-journee-sans-montant.spec.ts
  tests/e2e/tous-les-ecrans-rendent.spec.ts` — 63 passed, 4 skipped (déjà skip hors de ce lot).
- `pnpm test:isolation` — 267 fichiers, 2579 tests, vert.
- `CI=1 pnpm verify` (format:check + typecheck + lint + test + test:isolation + build), joué **deux fois** —
  `pnpm test` 540 fichiers/6096 tests, `pnpm test:isolation` 267 fichiers/2579 tests, lint/typecheck/format/
  build verts les deux fois.
- `pnpm verify:full` NON joué — laissé à la file, comme demandé.

Rebase propre sur `origin/main` au moment de rendre la main, arbre propre, rien poussé.

## Reprise 9L44C-REPRISE-STATUT-MACHINE

Condition d'arrêt du ticket de reprise vérifiée avant tout geste : `origin/main` ne contenait **pas** de
commit `9L44A-REPRISE-STATUT-MACHINE`, et la branche `9L44A-REPRISE-STATUT-MACHINE-garde` existait — aucun
arrêt immédiat requis.

**Note sur le chemin de ce fichier** : le ticket de reprise demandait une section dans
`docs/propositions/9L44A-REPRISE-STATUT-MACHINE/passation.md`. Ce répertoire n'a jamais existé — 9L44A a
suivi la convention déjà en place ici (section « Reprise 9L44A-REPRISE-STATUT-MACHINE » ci-dessus, dans le
fichier du lot d'origine). Cette reprise fait de même, par cohérence avec 9L44A plutôt qu'avec le chemin
littéral du ticket.

**Ce qui a été fait ici** :

1. Branche `9L44C-REPRISE-STATUT-MACHINE` ouverte à jour d'`origin/main` (déjà porteur de 9L42B, 9L44B et
   9L45). Les six commits de `9L44A-REPRISE-STATUT-MACHINE-garde` ont été reportés par `git cherry-pick`, un
   par un, dans l'ordre d'origine, sans les modifier.
2. **Un conflit**, sur `lib/feuille-de-route/contenu.ts` — pas avec 9L42B ni 9L44B comme l'anticipait le
   ticket (ces deux-là étaient déjà résolus côté 9L44A), mais avec **9L45**, publié sur `origin/main` après
   9L44A-REPRISE-STATUT-MACHINE-garde : les deux lots retiraient chacun leur propre ligne de la section « Réserves des
   revues, à regrouper » au même endroit du tableau (celle de 9L44 : « Statut machine : écritures
   simultanées… » ; celle de 9L45 : « Épreuves et captures manquantes sur 9I8C et 9I8F1. »), et ajoutaient
   chacun leur propre ligne en tête de « Livré depuis le 31/10 » au même endroit. Résolu en gardant **les
   deux intentions** : les deux lignes retirées de « à écrire », les deux lignes ajoutées à « livré »
   (9I8C/9I8F1 — 9L45 — suivie de Statut machine — 9L44). Rien d'autre n'a été changé dans ce fichier.
3. **Audit des localisateurs e2e de la même famille** (non exacts, sans portée, ou qui comptent des boutons)
   pouvant rencontrer l'écran modifié (`/parc/[id]`, le dialogue de changement de statut, le champ de retype) :
   repris intégralement — aucun nouveau localisateur fragile. Point notable relevé en creusant les libellés :
   `machine.changer_etat.bouton` et `machine.changer_etat.confirmer` valent tous deux « Changer l'état » (le
   bouton déclencheur et le bouton de confirmation du dialogue partagent le même texte) ; sans risque ici car
   `tests/e2e/9l44-sortie-du-parc-retype.spec.ts` et `9i8f-statut-machine-modifiable.spec.ts` scopent
   systématiquement leurs `getByRole("button", …)` au `<form>` ou au `<dialogue>` ouvert, jamais à la page
   entière. Aucun autre spec de `tests/e2e/**` ne transite vers `remplacee`/`ferraillee` par l'interface (les
   autres mentions de ces statuts posent la donnée directement en base par Prisma, sans jamais ouvrir le
   dialogue).
4. Rien d'autre ajouté au lot.

## Épreuves de la reprise 9L44C

- `CI=1 npx playwright test tests/e2e/9l44-sortie-du-parc-retype.spec.ts --workers=1` — 2 passed (couvre à la
  fois 9L44 et 9L44A, qui n'a ajouté aucun code, seulement sa passation).
- `CI=1 npx playwright test tests/e2e/tous-les-ecrans-rendent.spec.ts --workers=1` — 61 passed, 4 skipped
  (skip déjà présent hors de ce lot, non touché).
- `pnpm test:isolation` — 268 fichiers, 2581 tests, vert.
- `CI=1 pnpm verify` (format:check + typecheck + lint + test + test:isolation + build) — vert de bout en
  bout.
- `pnpm verify:full` NON joué — laissé à la file, comme demandé.

Rebase sur `origin/main` fait avant de rendre la main, arbre propre, rien poussé.
