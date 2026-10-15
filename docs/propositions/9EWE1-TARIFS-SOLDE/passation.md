# 9EWE1-TARIFS-SOLDE — passation

## Ce qui est livré

1. **Forfaits atteignables** (`app/(back-office)/parametres/tarifs/page.tsx`) — sous le tableau
   « Forfaits », une liste repliée `<details data-bloc="autres-forfaits-deplacement">` « Autres
   forfaits de déplacement (N) » montre chaque forfait de déplacement NON retenu pour aucune zone
   (inactif, ou masqué par un rang plus petit partout où il s'appliquerait), avec code, rang, état
   (Actif/Inactif) et un lien « Modifier ». Aucun calcul touché : `idsRetenus` est dérivé de
   `retenuParZone`, déjà calculé par `forfaitRetenu`.

2. **Badge du taux futur** (`taux-horaire/presentation.ts`, `tarifs/page.tsx`) — `statutDuTaux`
   rend désormais « À partir du <date> » (clé `taux_horaire.a_partir_du`) pour une ligne dont la
   date d'effet est future ; badge bleu (`badgeStatutTaux`, préfixe testé par `startsWith`). Le
   taux courant porte « En vigueur » (sans « aujourd'hui », devenu trompeur à côté d'un badge de
   date future — changement du texte de la clé `taux_horaire.en_vigueur`, aucun code appelant ne
   comparait la CHAÎNE, seulement `t("taux_horaire.en_vigueur")`). Une assertion existante du test
   unitaire (`taux-horaire-presentation.test.ts`) fixait `null` pour une ligne future : corrigée
   PA-11 — c'est exactement le troisième statut que PA-11 laissait hors lot, désormais traité.

3. **Cartes sous 900 px** (`tarifs/page.tsx`) — les trois tableaux (historique du taux, forfaits
   de déplacement par zone, autres forfaits) gardent leur `<Tableau>` au-dessus de 900 px
   (`max-[900px]:hidden`) et basculent, en dessous, sur `GrilleCartesEntites`/`CarteEntite`
   (`min-[901px]:hidden`) — mêmes données, `scrollWidth` ≤ 375 (vérifié visuellement par capture,
   voir `captures/tarifs-rempli-375.png`). Le lien d'action d'une zone (« Modifier »/« Créer ») est
   factorisé dans `actionZoneForfait`, calculé une fois par zone AVANT le JSX (et non inline dans
   l'expression enfant) — un calcul inline avait déclenché un faux positif du gardien L0-11 par
   collision de nom avec le `peutEcrire` local de `PageTarifs` (voir note dans le commit du point 3).

4. **Fiche forfait** (`forfaits/[id]/page.tsx`) — `verdict()` et `phraseSansForfaitDeDeplacement()`
   ont de nouveau un appelant : la fiche affiche « Conditions » (`resumeConditions`) et « Verdict »
   dans son bloc d'identité. Pour un déplacement — seule nature où le verdict dépend du rang des
   pairs — un sélecteur `?zone=` (repris tel quel de l'ancien `/parametres/forfaits`) choisit la
   zone évaluée, et l'avertissement « aucun forfait de déplacement pour cette zone » apparaît au
   besoin. Les trois autres natures rendent `forfaits.non_applique`/`forfaits.inactif` sans
   dépendre d'une zone (lu dans `verdict()`, qui court-circuite avant d'en avoir besoin).

5. **E2E** (`tests/e2e/9ewe-tarifs-page-unique.spec.ts`, ajouts) :
   - un forfait masqué par le rang (EPR-DEP-B de la scène, toujours écarté par EPR-DEP-A) reste
     atteignable depuis « Autres forfaits de déplacement », et sa fiche porte le verdict et les
     conditions attendus (points 1 et 4) ;
   - poser un taux à date d'effet future fait apparaître le badge « À partir du … » et le taux
     courant garde « En vigueur » (point 2) ;
   - RM lit « Autres forfaits de déplacement » sans aucun bouton ni lien autre que « Modifier »
     (droits-rm-rs.spec.ts couvre déjà le reste de la page — cet ajout vise spécifiquement le bloc
     neuf du point 1) ;
   - captures 375/1280 en viewport (sans `fullPage`) de la page remplie, filtrée (« vide ») et du
     hub, sous `CAPTURES_9EWE1=1`, dans `docs/propositions/9EWE1-TARIFS-SOLDE/captures/`. Regardées :
     cartes lisibles à 375, aucun débordement, badge « En vigueur » visible, bloc « Autres forfaits
     de déplacement (2) » visible même en vue filtrée.

## Points ouverts

- **Non fait : transition « aucun forfait » → montant par création d'un forfait de zone, et
  `?vue=sans-forfait` passant d'un résultat NON nul à nul.** La scène partagée
  (`tests/e2e/setup/scene.ts`, `FORFAITS_SCENE`) ne porte que des forfaits de déplacement SANS
  condition de zone : les six zones sont déjà couvertes dès le départ, comme le documente déjà
  l'en-tête du fichier de ce spec (« le filtre ne peut donc s'éprouver ici qu'à ZÉRO zone
  affichée… une scène jetable serait nécessaire pour le second, et ce n'est pas ce que ce fichier
  construit »). Produire cette transition demanderait soit de désactiver temporairement les deux
  forfaits de la scène (risque de flakiness sous `fullyParallel` : d'autres spec files lisent la
  même société, par exemple `droits-rm-rs.spec.ts` et `taux-horaire-succession.spec.ts`), soit une
  scène jetable dédiée (nouvelle société ou nouveau compte) — non construite ici, faute de budget
  dans la fenêtre de 120 minutes. **À ouvrir en ticket si cette transition doit être éprouvée.**
- Le sélecteur `?zone=` de la fiche forfait reprend tel quel le formulaire GET de l'ancien
  `/parametres/forfaits` (même option `<select>`, même bouton « Voir ») ; aucune capture dédiée à
  ce sélecteur n'a été prise (hors budget).

## Vérifications

- `pnpm format` / `pnpm typecheck` / `pnpm lint` / `pnpm test` (6281 tests) / `pnpm test:isolation`
  (1558 tests) : verts, à chaque commit.
- `pnpm exec playwright test` ciblé sur `tarif|forfait|taux-horaire|parametres|droits-rm-rs|
  ecrans-largeur-utile|sans-chaine-visible-en-dur` (119 scénarios, dont les 5 de
  `9ewe-tarifs-page-unique.spec.ts`) : **tous verts**, à `--workers=2`. **Observé** : à un
  parallélisme plus élevé (5 workers par défaut sur ce poste), une connexion a dépassé le délai de
  30 s — contention d'infrastructure locale, pas une régression du code (reproduit aussi sur un
  test pré-existant du même fichier, hors territoire de ce lot).
- **`CI=1 pnpm verify:full` — INCOMPLET, consigné tel quel.** Lancé au premier plan, il a dépassé
  les 30 minutes sans avoir fini la suite `test:e2e` (1 373 scénarios à 1 seul worker sous `CI=1`,
  `playwright.config.ts:79`) ; relancé en arrière-plan (journal `/tmp/verify-full-2.log`), il
  tournait encore après 36 minutes de plus, toujours dans `test:e2e`, sans erreur constatée jusque-là
  (`format:check`, `typecheck`, `lint` déjà verts ; `test` et `test:isolation`, déjà vérifiés verts
  séparément ci-dessus, dans la même fenêtre). Ce n'est pas une anomalie du dépôt : CLAUDE.md §4
  décrit `verify:full` comme l'« exécution nocturne en CI », pas une commande de fenêtre de
  120 minutes. Une session future doit relire `/tmp/verify-full-2.log` (ou relancer la commande) et
  consigner ses 15 dernières lignes ici avant de considérer le lot clos à ce niveau de rigueur.
  `git rev-parse --short HEAD` au moment de l'arrêt : `db55c01f`.
