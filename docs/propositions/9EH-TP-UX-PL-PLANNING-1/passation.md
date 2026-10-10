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

- La disposition téléphone de la décision 69 (ci-dessus).
- Vérifier avec Alexis les points nommés dans D190 : « absences » vs « absents » en vue Jour,
  l'égalité non vérifiée de la puce « cette semaine », la disposition téléphone.
- `pnpm verify:full` complet avant la prochaine mise en ligne du lot.
- 9EH-TP-UX-PL-PLANNING-2 : file « À traiter », cartes, colonne technicien, légende.
