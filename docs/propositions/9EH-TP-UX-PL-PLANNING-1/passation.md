# 9EH-TP-UX-PL-PLANNING-1 — passation

Commits : `54338aff` (code), `5120780b` (D190), `936b1041` (épreuve de bout en bout),
`14d516dd` (correctif `planning.titre`), `d4c22a65` (captures). Sur `main` local, rien poussé.

## Ce que j'ai changé

- **Titre et sous-titre** : « Planning des techniciens » (était « Planning des interventions »,
  même clé `planning.titre`). Sous-titre recomposé dans `presentation.ts` au gabarit
  « Semaine 40 · 28/09 → 03/10 · 5 techniciens · 3 absences » (année jamais sur la première
  borne, sur la seconde seulement hors année en cours) ; vue Jour : « · aucune absence ce
  jour » à zéro, un texte fixe. Pour l'exploitation : le sous-titre dit maintenant QUI est
  affiché et QUI est absent sans ouvrir la grille.
- **En-tête à deux boutons** : « Transmettre demain (n) » (icône `send`) puis « Intervention »
  (icône `plus`, texte visible « Intervention », nom accessible inchangé). « Transmettre
  toutes les planifiées prêtes » quitte l'en-tête et la rangée d'outils, se pose en tête du
  bloc « Laissées » sous la grille.
- **Barre d'outils en une ligne** à 1280/1440 px : vues réordonnées Jour, Semaine, 2 semaines,
  Mois (tranche la « question en passation » de 9CI) ; flèches en icônes (`chev-l`/`chev-r`,
  nom accessible et cible tactile inchangés) ; « Afficher les annulées » et « Plein écran »
  groupés à droite.
- **Filtres en ligne**, libellé à gauche, appliqués AU CHANGEMENT (`components/ui/
  liste-qui-filtre.tsx`, neuf) — plus besoin de cliquer « Filtrer » (resté en `sr-only` pour
  qui n'a pas JavaScript). Chaque liste plafonnée à 160 px (sinon la largeur suit le nom de
  client le plus long — mesuré jusqu'à faire déborder la page).
- **Bandeau** : icône `info`, puces-liens « N en retard », « N sans durée » (toutes vues),
  « N absence(s) cette semaine » (Semaine/Jour). Lien isolé « Absences » au-dessus de la
  grille RETIRÉ (la barre de navigation porte déjà `nav.absences`).
- **Indice de défilement** sur la grille Semaine (`CadreDefilant`, prop `indice`).
- Trois icônes ajoutées (`chev-l`, `columns`, `arrow-r`), tracées de la planche de la maquette.
- D190 (`docs/arbitrages.md`, fin de fichier) : la décision, avec ses écarts nommés.
- Épreuve de bout en bout neuve (`tests/e2e/planning-gabarit-maquette.spec.ts`), fixture
  propre (décalage de jours 203, inédit).

## Ce que j'ai mesuré

- `pnpm verify` (format, typecheck, lint, vitest) : **vert**, 600 fichiers / 6114 tests, à
  chaque étape du lot. `pnpm vitest run tests/unit/docs/` (D190) : vert.
- E2E ciblé (pas `verify:full` en entier — voir « ce que je n'ai pas fait ») : la nouvelle
  épreuve (6 tests) et les onze épreuves que le ticket nomme « doivent rester vertes » —
  `planning-creer-en-haut`, `planning-largeur-et-carte`, `planning-6`, `planning-glisser-
  annonce`, `planning-technicien-actions-refusees`, `planning-deux-semaines`, `planning-mois-
  charge`, `planning-telephone-onglets`, `planning-laissees-sous-la-grille`, `planning-
  filtres-aujourdhui` (adapté), `planning-cibles-375` (adapté) — **47/47 verts, trois passages
  complets d'affilée** pour écarter la non-déterminisme des comptes partagés (voir pièges).
- Mesuré EN COURS DE ROUTE, pas supposé : à 1280 px, le bloc titre (688,9 px, sous-titre à
  quatre informations) + deux boutons d'en-tête (360 px) dépassent les 968 px disponibles —
  d'où `max-w-[520px]` sur le sous-titre, seulement quand les deux boutons sont affichés
  ensemble (`deuxBoutonsEnTete`). Mesuré aussi : le bouton « Transmettre toutes les planifiées
  prêtes (N) » (`whitespace-nowrap`, shadcn) dépasse 375 px dès N à deux chiffres — contenu par
  `overflow-x-auto` sur son propre bloc, jamais la page.
- Pas d'exécution de `pnpm verify:full` en entier (`feries:horizon`, `audit:partitions`,
  `test:e2e` COMPLET) faute de budget — voir ci-dessous.
- Captures AVANT (commit `08a24e54`, avant ce lot) et APRÈS (`14d516dd`) : quatre vues, 1280
  et 375 px, via deux worktrees jetables (`/tmp/codiplan-avant`, supprimé) pointant la même
  base de test.

## Ce que j'ai tranché, et pourquoi

- **Un seul commit de code pour les parties A et B** du ticket plutôt que deux : les deux
  touchent les mêmes fichiers (`page.tsx`, `presentation.ts`, `fr.ts`), et un découpage par
  hunk après coup aurait été plus risqué qu'utile. D190 et l'épreuve de bout en bout sont
  des commits séparés, comme demandé.
- **`aria-label` → `sr-only`** pour le nom accessible du bouton « Intervention » :
  `components/ui/action-primaire.tsx` est hors du territoire de ce lot et `LienPrimaire` ne
  prend pas de prop `aria-label` ; un `<span class="sr-only">{t("planning.creer")}</span>` à
  côté d'un `<span aria-hidden>Intervention</span>` donne le même nom accessible sans y
  toucher.
- **Puce « N absence(s) cette semaine »** : je n'ai PAS vérifié à l'exécution que son compte
  égale celui que `/absences` montrerait (fenêtres différentes, six jours contre sept) — une
  lecture de plus que le ticket interdit. Mesuré sur la fixture de l'épreuve neuve (absence
  un jour de semaine, jamais le dimanche) ; écart nommé dans D190, à valider par Alexis.
- **Mot « absences » repris pour la vue Jour** plutôt que « absents » que le corps du ticket
  employait une fois : cohérence avec le reste de l'écran (jamais un second mot pour la même
  idée, §9) — nommé dans D190 comme point à confirmer.
- **Disposition propre au téléphone (décision 69, addendum W11) non reprise** : filtres
  empilés (fonction conservée) plutôt que masqués, segment visible plutôt que masqué, onglets
  à leur place actuelle plutôt que déplacés sous le bandeau. Mesuré : aucun débordement
  horizontal introduit (Semaine/Jour/2 semaines/Mois, 375 px), mais la disposition fine du
  téléphone demandée par l'addendum du 09/10 n'a pas été reprise — nommé dans D190 et ci-dessous.

## Ce que je n'ai pas fait

- La disposition TÉLÉPHONE propre à la décision 69 (segment masqué, deux boutons d'en-tête
  pleine largeur côte à côte, onglets déplacés sous le bandeau, puces et indice masqués).
- `pnpm verify:full` en entier, et `pnpm test:e2e` sur l'ensemble du dépôt (seulement le
  sous-ensemble planning nommé par le ticket, trois fois).
- Aucune vérification en direct dans un navigateur humain (captures Playwright seulement).
- La file « À traiter », les cartes, la colonne technicien, la légende — hors territoire
  (9EH-TP-UX-PL-PLANNING-2).

## Les pièges pour la session suivante

- **`reuseExistingServer` de `playwright.config.ts`** réutilise un serveur déjà sur le port
  3100 : une modification de `page.tsx` qui semble sans effet lors d'un `pnpm test:e2e`
  peut simplement mesurer un ANCIEN build. Vérifier `ss -ltnp | grep 3100` avant de douter
  d'un correctif.
- **Flakiness mesurée et expliquée, pas supposée** : trois passages complets d'affilée sans
  l'erreur FK rencontrée une fois (`planning-laissees-sous-la-grille.spec.ts`, suppression du
  site) — elle n'est pas reproductible avec mon lot et je ne l'ai pas corrigée ; si elle
  revient, c'est un point à ouvrir à part, jamais un prétexte pour toucher son assertion.
- `enRetardFile`/`sansDureeFile` (donc les puces du bandeau et le compte « À traiter ») sont
  des lectures GLOBALES à la société, jamais filtrées par période : toute fixture qui pose un
  statut `planifiee`/`affectee` daté dans le passé, ou `duree_estimee_min: null`, apparaît sur
  TOUS les planning ouverts en même temps par d'autres épreuves — compter un total exact y est
  un piège (voir le « piège connu » du ticket, déjà vécu une fois pendant ce lot, corrigé en
  ne comptant jamais, seulement en vérifiant qu'une ligne forgée est atteignable).
- La contrainte `intervention_planifiee_a_sa_duree` (PARCOURS-1) rend `en_retard` et
  `sans_duree` MUTUELLEMENT EXCLUSIFS sur une même ligne (`planifiee`/`affectee` exige une
  durée) : toujours forger deux lignes séparées pour les deux critères.

## Ce qui reste à faire

- Vérifier avec Alexis les points nommés dans D190 : « absences » vs « absents » en vue Jour,
  l'égalité non vérifiée de la puce « cette semaine ».
- 9EH-TP-UX-PL-PLANNING-2 : file « À traiter », cartes, colonne technicien, légende.

---

## Reprise 9EHB (9EHB-REPRISE-9EH-1)

Commits (sur `9EHB-REPRISE-9EH-1`, partie depuis `origin/main` 6a9f48ae) :
`95d8c27d`/`b73b52a3`/`a10f75af`/`dfbb0e1b`/`11311c30`/`bd9f5bb6` (rejeu à l'identique des 6
commits de la garde `9EH-TP-UX-PL-PLANNING-1-garde`, conflits additifs résolus dans
`components/ui/icone.tsx` et `docs/arbitrages.md` — D191/D192, arrivées sur `main` après la
garde, gardées devant D190), puis `ebf2848a` (W11 — téléphone), `92095b5f` (D190 mis à jour),
`123fc140` (captures APRÈS 375 px régénérées).

### Point 1-3 — recalage et reprise du travail antérieur

`origin/main` au départ : `6a9f48ae` (9EFA-REPRISE-9EF-2). La garde `9EH-TP-UX-PL-PLANNING-1-garde`
existait (6 commits). La garde de 9EHA (`9EHA-REPRISE-9EH-1-garde`) portait les MÊMES 6 commits,
rejoués à l'identique (mêmes messages, mêmes diffs) — rien de plus à en tirer. Le « reste non
commité » de 9EHA (`voie1-reste-1010-2136`) mesuré par `git diff --stat 13cce6b3 voie1-reste-1010-2136`
(13cce6b3 = `9EF-TP-UX4-2-FICHES-1 — passation`, la base commune aux deux gardes) :
**12 fichiers, TOUS des PNG de captures étrangères au planning** (fiches client/site/machine,
bandeau transmis — territoires 9BV/9DF/47-AVERTISSEMENTS-1) — aucun fichier du territoire de la
partie haute du planning. Rien à récupérer. Ceci contredit le chiffre « ≈190 fichiers » noté par
le pilote à 20:57 le 10/10 ; mesuré ici avec `git diff --stat`, à l'identique les deux fois que je
l'ai rejoué — le chiffre du pilote portait peut-être sur un état antérieur de la branche, ou sur
un comptage différent. Je n'ai pas d'explication de plus, je rapporte ce que j'ai mesuré.

### Point 4 — le rouge de 9EHA

`CI=1 pnpm verify` sur la garde REJOUÉE À L'IDENTIQUE (avant tout travail neuf) : **VERT
d'emblée** — format, typecheck, lint, 4610 tests unitaires, 1524 tests d'isolation, build, tous
verts au premier passage. Le rouge rapide (6 min) constaté par le pilote sur 9EHA n'est donc PAS
dans les 6 commits de la garde eux-mêmes : il doit venir du travail NON commité de 9EHA
(90 min, 17:54-21:24), qui est perdu (point 1-3) et donc irreproductible depuis ce dépôt. Je ne
peux pas en dire plus sans ce travail.

### Points 5-6 — le travail neuf de cette reprise (W11, décision 69 précisée par la décision 71)

Un seul point restait ouvert dans la garde 9EH-1 (son propre « ce qui reste à faire ») : la
disposition téléphone (≤ 900 px) de l'en-tête. Fait dans ce lot, commit `ebf2848a` :

- **En-tête en colonne** : rien à construire — l'en-tête de `Page` (`flex flex-wrap`) passe déjà
  seul sur sa ligne dès que les actions de bureau sont masquées (ci-dessous) ; à 375 px il n'y a
  plus qu'un seul élément sur la ligne du titre.
- **h1 22 px** : NON posé, nommé en écart dans D190 (déjà nommé par la garde) — `Page` est
  partagée par 41 écrans, hors du territoire de ce lot.
- **Deux boutons pleine largeur, côte à côte** : `Page` (`components/mise-en-page/page.tsx`, 41
  appelants) ne pose aucun `flex-grow` sur son bloc d'actions — lui en poser un pour CE SEUL
  écran aurait affecté les 40 autres. Solution retenue : les deux boutons restent dans `actions`
  MAIS masqués sous 901 px (`max-[900px]:hidden`), et une COPIE pleine largeur est rendue en tête
  de `children`, où `<main className="flex flex-col …">` (même fichier) étire déjà chaque enfant
  sur toute la largeur par défaut (`align-items` non posé vaut `stretch`) — AUCUNE ligne de
  `Page` touchée. Même patron que `OngletsTelephone`/`Onglets` (D146) : deux rendus, un par
  gabarit, `getByRole` ne voit jamais les deux à la fois (l'un des deux est toujours
  `display:none`, hors de l'arbre d'accessibilité — vérifié par une épreuve dédiée). Cible
  tactile 44 px ajoutée aux deux boutons sous 901 px (`max-[900px]:min-h-11` sur le bouton de
  `components/planning/transmettre-demain.tsx`, qui n'a que ces deux seuls appelants désormais
  masqués l'un à l'autre par largeur — le réglage ne s'applique donc jamais aux deux instances en
  même temps ; `min-h-11` direct sur la copie téléphone de « Intervention »).
- **‹ Aujourd'hui ›, « Plein écran »** : déjà visibles sous 901 px (code de la garde, non
  touché) — confirmé par l'épreuve neuve, rien à faire.
- **Filtres gardés, deux par ligne** : déjà le comportement du code de la garde
  (`max-w-[160px]` sur chaque `<select>`, `flex-wrap` sur le formulaire) — confirmé MESURÉ (pas
  supposé) par l'épreuve neuve : à 375 px, Technicien et Priorité tombent sur la même ligne,
  Nature est rejeté à la ligne suivante. Rien à construire, le réexamen demandé par D190 est
  devenu une CONFIRMATION (décision 71).
- Segment de vues, puces du bandeau, indice de défilement : restent VISIBLES sous 901 px,
  **délibérément non masqués** — la décision 71 ne porte que sur les boutons et les filtres, ce
  lot ne masque rien qu'elle ne nomme pas. Nommé dans D190.

Épreuve neuve : `tests/e2e/planning-telephone-en-tete.spec.ts` (4 tests — défilement horizontal,
côte-à-côte + cible 44 px avec scène forgée `PGTEL-` pour `pretesDemain`, absence des deux
instances à la fois à 1280 px, filtres deux par ligne) — **verte 3 passages consécutifs**. Les
47 épreuves planning déjà listées par le ticket comme devant rester vertes : **toutes vertes**
(`planning-creer-en-haut`, `planning-largeur-et-carte`, `planning-6`, `planning-glisser-annonce`,
`planning-technicien-actions-refusees`, `planning-deux-semaines`, `planning-mois-charge`,
`planning-telephone-onglets`, `planning-laissees-sous-la-grille`, `planning-filtres-aujourdhui`,
`planning-cibles-375`, `planning-gabarit-maquette`), ainsi que
`pg-g14b-transmettre-groupe.spec.ts` (seul autre test qui exerce `DialogueTransmettreDemain`).
Captures APRÈS à 375 px régénérées (commit `123fc140`, `ebf2848a` photographié) — les 1280 px
restent celles de la garde (l'en-tête bureau n'a pas bougé).

**Piège mesuré pendant cette reprise, pour la session suivante** : `pretesDemain`/`laissees` sont
des lectures GLOBALES à la société (même famille de piège que `enRetardFile`/`sansDureeFile`,
déjà nommé par la garde). `planning-telephone-en-tete.spec.ts` force `pretesDemain.length > 0`
pendant la durée de ses tests ; rejoué SANS `CI=1` (donc avec plusieurs workers, exécution de
fichiers en parallèle), ce fichier et `planning-creer-en-haut.spec.ts` ont pu s'exécuter en même
temps et se gêner — `main header p` y trouvait alors 2 éléments (le sous-titre ET le paragraphe
« Laissées, à compléter » du dialogue, QUI VIT DANS `header` depuis le tout premier commit de la
garde, `95d8c27d` — rien de neuf dans ce lot). **Avec `CI=1` (`workers: 1`, la configuration
RÉELLE de `verify`/`verify:full`, `playwright.config.ts:79`), rejoué 2 fois, ce risque disparaît**
— les fichiers s'exécutent en séquence, jamais deux pages du même planning en même temps. Comme
`pg-g14b-transmettre-groupe.spec.ts` (même risque, préexistant), ce fichier doit toujours être
mesuré avec `CI=1`, jamais sans.

### Point 7 — tableau W0-W17

| Point | État | Où |
|---|---|---|
| W0 Ordres (69/71, captures 1280+375) | FAIT | garde + cette reprise |
| W1 Références `page.tsx` | FAIT | garde ; recalé sans dérive (point 8) |
| W2 `fr.ts` | FAIT | garde |
| W3 En-tête (bouton Intervention) | FAIT | garde |
| W4 Barre d'outils | FAIT | garde |
| W5 Icônes | FAIT | garde |
| W6 « Transmettre toutes » → bloc Laissées | FAIT | garde |
| W7 Filtres en ligne | FAIT (garde) ; 2/ligne CONFIRMÉ | garde + cette reprise |
| W8 Bandeau | FAIT | garde |
| W9 Lien Absences retiré | FAIT | garde |
| W10 Indice de défilement | FAIT | garde |
| W11 Téléphone 375 px | FAIT (en-tête : colonne, 2 boutons, filtres) ; segment/puces/indice délibérément non masqués (hors décision 71) | cette reprise |
| W12 Captures | FAIT (garde : 1280+375 avant/après) ; 4 APRÈS 375 régénérées | garde + cette reprise |
| W13 Décision D190 | FAIT ; repositionnée en fin de fichier (après D191/D192), attribution mise à jour (décision 71) | garde + cette reprise |
| W14 Épreuves | FAIT (garde : 11 épreuves + épreuve neuve gabarit) ; épreuve neuve téléphone (4 tests, 3× vert) | garde + cette reprise |
| W15 Rebase de fin de session | fait en fin de session (ci-dessous) | cette reprise |
| W16 Non traité (file, cartes, colonne technicien, légende) | CONFIRMÉ hors scope | 9EH-TP-UX-PL-PLANNING-2 |
| W17 Recalage au dépôt | FAIT ; seuls `icone.tsx` et `fr.ts` avaient bougé entre la base de la garde et `origin/main`, fusionnés au cherry-pick | cette reprise |

### Point 9 — `CI=1 pnpm verify:full`

`CI=1 pnpm verify` (format, typecheck, lint, 4611 tests unitaires, 1524 tests d'isolation,
build) : **VERT**. `feries:horizon` et `audit:partitions` : **VERT**. `test:e2e` (suite
COMPLÈTE, 1262 tests, 1 worker, ~47 min) : **1 ÉCHEC, REPRODUIT IDENTIQUE DEUX FOIS** —
`tests/e2e/planning-fenetre-pose.spec.ts:233:5 › un technicien absent ce jour-là : « Planifier »
reste inactif, le motif est affiché`, erreur « Le glissé vise un élément sans boîte »
(`tests/e2e/setup/glisser.ts:348`), échec PUIS retry, deux exécutions complètes de la suite
(21:46-21:19 UTC environ, 47,3 puis 47,4 min).

**Mesuré, pas supposé, avant de classer ce rouge étranger au lot** :
- Ce fichier n'est touché par AUCUN commit de ce lot ni de la garde — territoire « file/grille »,
  explicitement hors de ce ticket (9EH-TP-UX-PL-PLANNING-2, W16).
- Rejoué SEUL 3 fois (`pnpm exec playwright test tests/e2e/planning-fenetre-pose.spec.ts -g
  "technicien absent"`) : **vert les 3 fois**.
- Rejoué avec le test qui le précède immédiatement dans l'ordre de `--list` (même fichier,
  `:125:5`) : **vert**, 2 fois.
- Le `error-context.md` du retry montre une page STRUCTURELLEMENT SAINE au moment de l'échec :
  en-tête, barre d'outils, filtres, bandeau à mon gabarit ; la grille Semaine montre bien la case
  Mercredi de M. Perrin (agence Koné) marquée « Absence » (donc avec son contenu, donc avec une
  boîte) ; le fil « À planifier » contient 13 cartes dont plusieurs du site forgé par le
  scénario. Rien dans cette capture ne pointe vers une cause dans le territoire de ce lot.
- Classé « interférence entre specs, étrangère au lot » (règle du point 5) : le fichier n'est pas
  touché, le test est vert isolé et apparié à son voisin direct, et rien dans la page au moment
  de l'échec ne porte la marque de ce lot. Je n'ai PAS trouvé la cause exacte (quel autre fichier,
  parmi les ~1260, laisse une trace qui fait échouer CE glissé après ~1213 tests) — la retrouver
  aurait demandé une bissection par relances complètes de 47 minutes chacune, hors de ce que ce
  lot peut absorber sans dépasser trois à quatre heures de plus. Je l'écris comme un DEVIS, pas
  une conclusion : retrouver la cause coûterait plusieurs passages de ~50 minutes, par dichotomie
  sur les fichiers exécutés avant `planning-fenetre-pose.spec.ts`.
- Ni la garde 9EH-1 ni la reprise 9EHA n'avaient fait tourner la suite complète avec succès avant
  (passation de la garde : « Pas d'exécution de `pnpm verify:full` en entier… faute de budget ») —
  ce rouge n'est donc PEUT-ÊTRE pas neuf, seulement jamais mesuré avant ce lot.

`CI=1 pnpm verify` (porte courte) et les 47+4 épreuves planning nommées par ce ticket sont donc
**vertes**, et c'est la seule garantie que ce lot peut apporter sans rouvrir un territoire qui
n'est pas le sien. Toutes les captures étrangères régénérées par les deux passages complets de la
suite (≈174 fichiers suivis + 12 non suivis) ont été restaurées (`git checkout --`) ou supprimées
(nouvelles, non suivies) — `git status --porcelain` ne porte que les fichiers de ce lot.

Heure du dernier passage complet de `test:e2e` : 21:19 UTC le 10/10/2026 (08:19 à Nouméa le
11/10/2026). Confirmation finale, `CI=1 pnpm verify` (porte courte) + les 53 épreuves planning
nommées par ce ticket (dont les 4 de `planning-telephone-en-tete.spec.ts` et les 2 de
`pg-g14b-transmettre-groupe.spec.ts`), toutes avec `CI=1` : **vert**, 22:09-22:12 UTC le
10/10/2026 (09:09-09:12 à Nouméa le 11/10/2026).

### Point 10 — captures

Conservées : les 8 AVANT/APRÈS à 1280 px de la garde (inchangées). Régénérées : les 4 APRÈS à
375 px (commit `123fc140`, photographiant `ebf2848a`) — l'écran a bougé à cette largeur
(W11). Toutes les autres captures régénérées par `verify:full` ont été restaurées ou supprimées
(point 9).

---

## Reprise 9EHC (9EHC-REPRISE-9EH-1)

Recalage (11/10, journal-parallèle 11:03) : 9EHB a été recalé car rouge DEUX FOIS, de façon
reproductible, sur `tests/e2e/planning-fenetre-pose.spec.ts` — fichier non touché par le lot —
alors que lui-même tournait vert 3 fois seul. Cause mesurée par le pilote (lecture du code,
non reproduite ici) : cette épreuve prenait le premier site de l'agence par ordre alphabétique
sans filtre, et une fixture laissée en base par une autre spec pouvait la détourner. Le ticket
**9E1-E2E-FENETRE-POSE-SITE**, déjà publié sur `main` avant cette reprise, rend cette épreuve
indépendante (elle forge désormais son propre client et site actifs).

### Points 1-2 — recalage et rejeu de la garde

`origin/main` au départ : `7da502e8` (9EFC-REPRISE-9EFB — passation), AVEC 9E1 déjà dedans
(`a1076df2`/`32750bc2`). La garde `9EHB-REPRISE-9EH-1-garde` existait (11 commits). Rejouée par
`git cherry-pick origin/main..9EHB-REPRISE-9EH-1-garde` : **les 11 commits se sont appliqués sans
aucun conflit**, arbre propre ensuite.

Le « reste non commité » de 9EHB (`voie1-reste-1011-1103`) mesuré par `git show --stat 4448d024`
(son seul commit) : **12 fichiers, tous des PNG de captures étrangères au planning** (territoires
47-AVERTISSEMENTS-1/9BV/9DF, fiches et bandeau transmis) — aucun fichier du territoire de la
partie haute du planning. Rien à récupérer de cette branche, conformément à ce que la garde
9EHB avait déjà deviné (« probablement vide ou captures »).

### Point 3 — hygiène des épreuves (la cause du recalage, nommée d'avance par le ticket)

Les 4 fichiers e2e touchés par 9EH-1/9EHA/9EHB (`git diff --name-only origin/main...HEAD --
tests/e2e`) : `planning-cibles-375.spec.ts`, `planning-filtres-aujourdhui.spec.ts`,
`planning-gabarit-maquette.spec.ts`, `planning-telephone-en-tete.spec.ts`. Relecture des deux
fichiers neufs contre les quatre points (a)-(d) :

- `planning-telephone-en-tete.spec.ts` : scène préfixée `PGTEL —` (sort après « Atelier
  principal »), supprimée en `afterAll`, client actif, aucune lecture de compte global — rien à
  corriger.
- `planning-gabarit-maquette.spec.ts` : scène préfixée **`9EH-GABARIT —`** — un CHIFFRE en tête,
  qui trie AVANT « Atelier principal » (ASCII), exactement le piège nommé par ce ticket pour
  `planning-fenetre-pose.spec.ts`. La scène était déjà supprimée en `afterAll` (donc pas la cause
  du recalage mesuré, puisque 9E1 protège déjà fenêtre-pose), mais le préfixe restait un risque
  pour tout futur lecteur « premier site par ordre alphabétique sans filtre ». Corrigé (commit
  `92efccb4`) : préfixe renommé en `zz9EHC-GABARIT —` (sort après « Atelier principal »), les
  deux autres points (client actif, aucun compte global lu — la regex `^\d+ …$` ne vérifie
  jamais un total exact) étaient déjà bons.
- `planning-cibles-375.spec.ts` et `planning-filtres-aujourdhui.spec.ts` : seules des assertions
  retouchées par le lot (lien « Absences » retiré, soumission au changement) — aucune fixture
  neuve, hors scope du point 3.

Preuve (`CI=1 pnpm exec playwright test tests/e2e/planning-cibles-375.spec.ts
tests/e2e/planning-filtres-aujourdhui.spec.ts tests/e2e/planning-gabarit-maquette.spec.ts
tests/e2e/planning-telephone-en-tete.spec.ts tests/e2e/planning-fenetre-pose.spec.ts`, 1
worker) : **15 passed**. Requête d'administration après coup sur la base e2e (`libelle`/
`raison_sociale` contenant `9EHC`, `PGTEL` ou `GABARIT`) : **0 site, 0 client restant**.

### Points 6-7 — téléphone et tableau W0-W17

Déjà fait par la garde 9EHB (W11, commit `ebf2848a`, D190 mis à jour `92095b5f`, décision 71) :
vérifié, rien à refaire. Tableau repris à l'identique de la passation 9EHB (tous les points
étaient déjà FAIT avant cette reprise) :

| Point | État |
|---|---|
| W0 Ordres (69/71, captures 1280+375) | FAIT (garde) |
| W1 Références `page.tsx` | FAIT (garde) |
| W2 `fr.ts` | FAIT (garde) |
| W3 En-tête (bouton Intervention) | FAIT (garde) |
| W4 Barre d'outils | FAIT (garde) |
| W5 Icônes | FAIT (garde) |
| W6 « Transmettre toutes » → bloc Laissées | FAIT (garde) |
| W7 Filtres en ligne, 2/ligne confirmé | FAIT (garde) |
| W8 Bandeau | FAIT (garde) |
| W9 Lien Absences retiré | FAIT (garde) |
| W10 Indice de défilement | FAIT (garde) |
| W11 Téléphone 375 px | FAIT (garde, 9EHB) |
| W12 Captures | FAIT (garde) |
| W13 Décision D190 | FAIT (garde), amendée par aucune décision de cette reprise |
| W14 Épreuves | FAIT (garde) ; hygiène du préfixe corrigée par cette reprise (point 3) |
| W15 Rebase de fin de session | fait en fin de cette reprise (ci-dessous) |
| W16 Non traité (file, cartes, colonne technicien, légende) | CONFIRMÉ hors scope (9EH-2) |
| W17 Recalage au dépôt | FAIT ; `app/(back-office)/planning`, `components/planning`,
`lib/planning`, `cadre-defilant.tsx`, `icone.tsx` : AUCUN changement entre `6a9f48ae`
(base de la garde 9EHB) et `7da502e8` (base de cette reprise) hors de ce que la garde
9EHB portait déjà — seul 9E1 (hors territoire planning) s'est intercalé |

Aucune fonctionnalité nouvelle ajoutée par cette reprise : un seul commit de code (le préfixe de
fixture, point 3).

### Point 9 — `CI=1 pnpm verify:full`

Lancé en un seul appel de bout en bout (arrière-plan, suivi par sondages) le 11/10/2026,
démarré à 08:14 UTC (19:14 à Nouméa) : format, typecheck, lint, 4611 tests unitaires, 1524 tests
d'isolation, build, `feries:horizon`, `audit:partitions`, puis `test:e2e` (suite COMPLÈTE, 1 worker) —
**TOUT VERT**, `test:e2e` : **1232 passed, 48 skipped, 0 failed** (51,3 min), `planning-fenetre-pose.spec.ts`
compris. Terminé à 09:15 UTC (20:15 à Nouméa) le 11/10/2026. Le rouge rencontré par 9EHB sur ce
fichier n'est PAS réapparu — cohérent avec 9E1 (déjà sur `main`) qui l'a rendu indépendant de
toute fixture étrangère.

Captures régénérées par la suite complète : 174 fichiers suivis restaurés (`git checkout --`),
12 fichiers non suivis (territoires 47-AVERTISSEMENTS-1, 9BV-TP-A5b-DATES-REPRISE,
9DF-TP-CY2-MATRICE-D8 — jamais celui de ce ticket) supprimés. `format:check` relancé après
restauration : vert. `git status --porcelain` vide après coup.

### Ce qui reste à faire

- 9EH-TP-UX-PL-PLANNING-2 : file « À traiter », cartes, colonne technicien, légende (W16).
- Les points nommés dans D190 à valider par Alexis (hors décision 71, déjà tranchée) :
  « absences » vs « absents » en vue Jour, l'égalité non vérifiée de la puce « cette semaine ».
