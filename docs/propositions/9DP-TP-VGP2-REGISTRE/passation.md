# 9DP-TP-VGP2-REGISTRE — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**PV-32.** Les quatre lecteurs de `lib/vgp/registre.ts` (`listerLeRegistre`,
`compterAPrevoir`, `prochaineEcheanceDuSite`, `famillesADeterminer`) écartent
désormais, sans aucun interrupteur, les machines des clients inactifs et
celles hors parc actif (`remplacee`, `ferraillee`, `fusionnee`). Pour
l'exploitation : si une société possède de telles machines sous une famille
soumise, le registre, les KPI, la tuile du tableau de bord et le compte « à
déterminer » baisseront d'autant — c'est le comportement voulu, pas un bug.
`STATUTS_HORS_PARC_ACTIF` (`lib/machines/depot.ts`) est désormais exportée,
réutilisée plutôt que recopiée.

**QE-13d.** Le titre de `/vgp` devient « Vérifications périodiques (VGP) » ;
deux onglets apparaissent au-dessus du bandeau de KPI — « Registre » (la
page) et « Familles à déterminer » (vers `/vgp/a-determiner`, inchangé). Les
cinq tuiles sont désormais des `Kpi` avec `href` : les trois datées (« à
venir », « dépassées », « sans information ») portent un chevron cliquable
sans plus de lien texte doublon dessous (D140, D144). « Informations reçues »
et « À déterminer » restent inertes, faute de liste correspondant exactement
à leur chiffre.

**PV-37.** La ligne « Machine » du registre affiche désormais
`marque référence` en sous-ligne. La recherche couvre en plus la marque, la
famille, le site, la commune du site et la référence interne.

**D122.** Deux `<select>` — Client, Site — filtrent l'affichage (jamais le
résumé des KPI, même règle que `?etat=`) ; les options du filtre Site se
restreignent au client déjà choisi.

**MO-12 / UX9-c.** Un lien « Grouper par client » bascule le registre
(filtré, trié, sans pagination) en une carte par client. Chaque carte porte
« Imprimer pour ce client », qui compose un document sans réserves (en-tête
société/client/date, colonnes Machine/Site/Dernier contrôle/Échéance/État).
Mécanisme d'impression étendu (`components/vgp/impression-registre.tsx`,
bloc `print-vgp` dans `app/globals.css`) : classe `print-vgp` sur `<body>`,
jamais `:has()` — et, nouveau par rapport au bon/QR qui ne posent jamais
qu'une zone, un masquage impératif en JavaScript des zones NON choisies
(`hidden`, qui l'emporte sur `visibility:visible`), pour isoler UN groupe
parmi plusieurs sur le même écran.

**D166** (`docs/arbitrages.md`) consigne la décision — reste **à valider par
Alexis**, comme D165, D162.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- Captures AVANT/APRÈS dans `docs/propositions/9DP-TP-VGP2-REGISTRE/captures/`
  (AVANT rejoué sur `dd53a36b` via un worktree jetable) : titre, onglets,
  tuiles, filtres, ligne avec marque/référence, vue groupée, aperçu
  d'impression — à 1280 et 375 px.
- `prisma/seed-data.ts` : AUCUN client inactif ne porte de machine (le seul,
  « Ancien client », n'a aucune machine sur son site), et AUCUNE machine du
  semis ne porte un statut `remplacee`/`ferraillee`/`fusionnee` — **PV-32 ne
  change donc AUCUN compte affiché sur les données de démonstration**,
  vérifié par grep avant d'écrire la moindre ligne de code.
- Isolation dédiée (`tests/isolation/vgp-client-inactif-machine-sortie.test.ts`) :
  deux machines soumises jamais informées existent bien en base (`count=2`,
  lu en SQL direct, hors cascade applicative) mais `listerLeRegistre`,
  `prochaineEcheanceDuSite` et `famillesADeterminer` les écartent toutes les
  deux — 6/6 épreuves vertes.
- `pnpm verify` (format, typecheck, lint, 4011 tests unitaires, 1421 tests
  d'isolation, build) : vert.
- `pnpm feries:horizon` : vert (2 territoires, ≥ 12 mois d'avance).
- `pnpm audit:partitions` : vert (13 partitions, horizon tenu, partition par
  défaut vide).
- `pnpm test:e2e` (suite complète, 903 scénarios) : **vert** — 896 passés, 7
  ignorés, 0 échec — après correction de deux régressions découvertes par
  cette même suite (voir « Ce que j'ai tranché »). Rejoué une seconde fois
  en entier après correction, pour confirmer.
- `tests/e2e/vgp-4.spec.ts`, `vgp-affichage-tpa2.spec.ts`,
  `vgp-retard-visible.spec.ts`, `tri-et-recherche.test.ts` : tous verts,
  AUCUNE assertion ni fixture modifiée (cohérent avec la mesure ci-dessus :
  rien dans le semis n'active PV-32).

## Ce que j'ai tranché et pourquoi

- **Aucun interrupteur pour PV-32** (contrairement à D129, qui en offre un
  pour les interventions) : le registre VGP n'est pas un historique, décision
  explicite du ticket/D166.
- **Le bandeau orange « X familles à déterminer » reste**, en plus du nouvel
  onglet qui mène à la même page : ce n'est pas le doublon « lien texte sous
  une tuile cliquable » que D144 proscrit (il n'est accolé à aucune tuile),
  mais un rappel visible distinct au sens de D88 §3/L9-03. **Choix du
  pilote non explicitement couvert par le ticket, non validé par Alexis** —
  à confirmer ou corriger.
- **La recherche VGP cherche sur la référence interne, `/parc` non** :
  l'audit affirmait que `/parc` le faisait déjà (constat du ticket), mesuré
  faux en lisant `filtreDuParc` (`lib/machines/depot.ts`) — `/parc` ne
  cherche QUE sur numéro de série, client, site, commune, référence et
  marque du modèle. Ajouté pour VGP comme demandé, **`/parc` n'est pas
  touché** (hors territoire de ce lot) ; écart nommé dans D166.
- **Deux épreuves e2e étrangères réparées, pas contournées** —
  `defilement-tableau.spec.ts` et `vgp-finitions.spec.ts` échouaient parce
  que les nouveaux onglets ajoutent un second élément `.overflow-x-auto` et
  un second lien vers `/vgp/a-determiner` que leurs sélecteurs `.first()`
  retrouvaient à la place de leur cible d'origine. Cause directe de ce lot
  (pas un piège étranger au sens du mémo « épreuves qui comptent large ») :
  corrigées avec un marqueur stable (`data-bloc="bandeau-indetermines"` posé
  sur le bandeau, `[data-bloc="tableau-registre"] .overflow-x-auto` pour le
  conteneur défilant), aucune assertion assouplie.
- **Noms de fixture « Lieu » et non « Site »** dans les clés
  `vgp2registre.e2e.*` — le gardien du vocabulaire imposé (D5/D47) refuse
  « site »/« agence » en dur hors de `vocabulaire.*`, même dans une valeur de
  démonstration ; suivi du précédent `vgp4.e2e.site` = « Lieu de l'épreuve ».
- **Suffixes « Alpha/Beta/1/2 » plutôt que « X1 »/« Y1 »** dans certaines
  valeurs de fixture (`lib/i18n/fr.ts`) : le gardien `sans-jargon-interne`
  refuse toute valeur du dictionnaire dont le DERNIER mot ressemble à une
  référence de ticket (`[A-Z]{1,2}\d{1,2}`) — « Lieu X1 » tombait dedans.

## Ce que je n'ai PAS fait

- L'onglet « Réserves » : l'état n'existe pas, lot suivant (avec migration).
- L'horizon « à venir » (PV-35) : valeur non fixée, pas touché.
- La fiche machine, le régime des familles, le tableau de bord : hors
  territoire.
- La correction de `/parc` pour chercher sur la référence interne (voir
  ci-dessus) — signalé dans D166, pas appliqué.
- Je n'ai **pas pu poser mes commits sur la branche locale `main`** : ce
  worktree a démarré en HEAD détaché (`dd53a36b`, déjà l'état au lancement
  de la session) et `git branch -f main <HEAD>` est REFUSÉ par git — la
  branche `main` est actuellement empruntée par le worktree
  `/home/aplou/codiplan`, qui pointe sur un commit beaucoup plus ancien
  (`ca348d20`, 96 commits derrière). Les cinq commits de ce lot restent donc
  sur le HEAD détaché de CE worktree. Voir « Pièges » ci-dessous.
- Je n'ai pas touché à la course préexistante entre `vgp-affichage-tpa2.spec.ts`
  et `vgp-retard-visible.spec.ts` sous `workers>1` (étrangère à ce lot).

## Les pièges pour la session suivante

- **Ce worktree est en HEAD détaché, et `main` local ne le contient PAS.**
  Les cinq commits de ce lot sont au-dessus de `dd53a36b`, sur le HEAD
  détaché actuel de `/home/aplou/codiplan-voie1` — PAS sur une branche. Si tu
  reprends ce travail, retrouve ce HEAD (pas `main`) avant toute chose,
  sans quoi il se croit perdu. Ce n'est pas une erreur de ma part : c'est
  l'état dans lequel la session a commencé (voir le rappel système du début),
  et `git branch -f main` est bloqué par le worktree `/home/aplou/codiplan`
  qui détient déjà cette branche. Je ne l'ai PAS forcée.
- **`pnpm test:e2e` (suite complète) régénère des dizaines de PNG d'AUTRES
  tickets**, dans `docs/propositions/*/captures/`, même sans variable
  d'environnement de capture posée — ce n'est pas gated chez tout le monde.
  Après un run complet, TOUJOURS `git status`, `git checkout --` sur les
  fichiers modifiés hors de ton lot, et supprimer les PNG orphelins (`??`)
  avant de committer quoi que ce soit. Fait deux fois pendant ce lot.
- **`Onglets` (`components/ui/onglets.tsx`) porte `overflow-x-auto`** — tout
  écran qui en gagne un cassera les épreuves qui font
  `page.locator(".overflow-x-auto").first()` sans portée. Scoper par
  `data-bloc`.
- **Vocabulaire imposé et jargon interne, dans `lib/i18n/fr.ts` — deux
  gardiens, deux pièges distincts** : `vocabulaire-impose.test.ts` refuse
  « site »/« agence » en dur hors de `vocabulaire.*` ; `sans-jargon-interne.test.ts`
  refuse qu'une valeur se TERMINE par quelque chose qui ressemble à une
  référence de ticket (`[A-Z]{1,2}\d{1,2}`, entre parenthèses ou en fin de
  phrase) — un suffixe de scène du genre « Site X1 » tombe dans LES DEUX.
- **D166 n'est pas validée par Alexis.**

## Ce qui reste à faire

- Faire valider D166 par Alexis — en particulier l'absence d'interrupteur
  pour PV-32, et le bandeau orange laissé en plus du nouvel onglet.
- Lot suivant : onglet « Réserves » (état, écran, migration).
- Décider si `/parc` doit, lui aussi, chercher sur la référence interne
  (écart constaté, non corrigé ici, hors territoire).
- Poser les commits de ce lot sur une branche atteignable par la file — je
  ne l'ai pas fait (voir « Ce que je n'ai pas fait »).

## Reprise 9DPA (05/10/2026, 14h08–15h20 Nouméa / 03h08–04h20 UTC)

**Cause trouvée en une phrase :** le rouge rapide n'a pas été reproduit —
`CI=1 pnpm verify` (format, typecheck, lint, 4041 tests unitaires, 1427
tests d'isolation, build) et le reste de `verify:full` (`feries:horizon`,
`audit:partitions`, puis `test:e2e` — 909 passés, 7 ignorés, 0 échec, 36,5
min) sont ressortis **intégralement verts** une fois la garde rejouée sur
`origin/main` à jour ; le rouge constaté par la file à 11h46–12h01 est très
probablement une interférence transitoire (base de test `codiplan_test`
partagée entre worktrees concomitants — TEST et E2E visent la même base, un
`test:isolation` concurrent peut effacer la scène e2e d'un autre worktree),
pas un défaut du lot.

- `git fetch origin` : `origin/main` à `a058705c` (9DID-REPRISE-9DI).
  `9DP-TP-VGP2-REGISTRE-garde` porte 6 commits au-dessus de son point de
  divergence (`6533c962`, déjà fusionné dans `origin/main`).
- La branche `main` locale est empruntée par le worktree `/home/aplou/codiplan`
  (comme la session 9DP l'avait déjà constaté) : impossible de l'utiliser ici
  — rejoué sur une branche `main-work` qui suit `origin/main`, pas sur une
  branche `main` locale distincte.
- Rejeu des 6 commits de la garde par `git cherry-pick`, un seul conflit :
  `docs/arbitrages.md`, D161 (déjà sur `origin/main`, apportée par 9DI) et
  D166 (apportée par ce lot) accolées au même endroit par le merge — un
  conflit PUREMENT additif, aucune divergence de sens ; résolu en gardant les
  deux décisions intégralement, D161 puis D166, séparées par une ligne vide.
  Aucune autre décision (D129, D140, D144, QT-13, QE-13d) touchée par la
  résolution.
- `voie1-reste-1005-1201` (évoquée par la file) : vérifiée, elle ne contient
  qu'un commit de captures PNG étrangères au lot (9DI, 9D3, 9DF, 9BV) rangées
  AVANT 9DID-REPRISE-9DI — rien à en tirer pour 9DP.
- `git status --porcelain` après le cherry-pick : vide, conforme à la
  passation d'origine (19 fichiers listés = 19 fichiers trouvés par
  `git ls-files docs/propositions/9DP-TP-VGP2-REGISTRE/`).
- Après le run complet de `test:e2e`, ~110 captures PNG d'AUTRES tickets
  (47-AVERTISSEMENTS-1, 48-FICHE-360-1, 9DE-TP-CY1-TERMINER-SIGNATURE,
  9D3-PLANNING-TECHNICIEN-ACTIONS, 9DF-TP-CY2-MATRICE-D8, etc.) ont été
  régénérées, modifiées ou créées comme non suivies — exactement le piège
  déjà nommé par la passation d'origine (« pnpm test:e2e régénère des
  dizaines de PNG d'autres tickets »). Toutes écartées (`git checkout --` +
  `git clean -fd` sur `docs/propositions/`), aucune commitée. Les 19 fichiers
  du lot 9DP n'en faisaient pas partie (`git diff --stat HEAD --
  docs/propositions/9DP-TP-VGP2-REGISTRE/` vide après nettoyage).
- Aucun écran du lot n'a bougé depuis les captures AVANT/APRÈS d'origine —
  non régénérées.
- Rien à corriger dans le code : aucune épreuve, aucun gardien n'est tombé
  pendant cette reprise. Les commits de la garde sont repris tels quels, sans
  modification de fichier source.
