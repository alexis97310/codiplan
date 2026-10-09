# 9EQ-CORRECTIFS-SOLDE-FICHE — passation

## Tableau point → commit

| Point | Objet | Commit |
|---|---|---|
| 34 | Action principale pleine largeur sous 901 px | `9EQ-CORRECTIFS-SOLDE-FICHE point 34 — action principale pleine largeur sous 901 px` |
| 35 | Bandeau « Suspendue » sans « 0 min » ni « REF, . » | `9EQ-CORRECTIFS-SOLDE-FICHE point 35 — bandeau « Suspendue » sans « 0 min » ni « REF, . »` |
| 37 | Nom d'ensemble stable de la frise d'étapes | `9EQ-CORRECTIFS-SOLDE-FICHE point 37 — nom d'ensemble stable sur la frise d'étapes` |
| 52 | D187 précise D183 (donneur d'ordre sans courriel) | `9EQ-CORRECTIFS-SOLDE-FICHE point 52 — D187 précise D183 : donneur d'ordre sans courriel, un tiret` |
| 53 | Captures AVANT/APRES des cinq onglets, quatre statuts | `9EQ-CORRECTIFS-SOLDE-FICHE point 53 — captures AVANT/APRES des cinq onglets, quatre statuts` |
| 54 | « Sur place » absent des autres onglets, épreuve e2e | `9EQ-CORRECTIFS-SOLDE-FICHE point 54 — « Sur place » absent des autres onglets, épreuve e2e` |
| 56 | Minuit de fin d'horaire « 24:00 », JSDoc fusionné | `9EQ-CORRECTIFS-SOLDE-FICHE point 56 — minuit de fin d'horaire affiché « 24:00 », JSDoc fusionné` |

## Ce que j'ai changé, et ce que ça change pour l'exploitation

- **Point 56** : une plage d'horaires d'accès finissant à minuit de fin de journée (`fin_minutes = 1440`) s'affichait « 00:00 » au lieu de « 24:00 » sur la carte « Sur place » — une agence qui saisit une plage 08:00–minuit la verrait désormais correctement écrite, au lieu d'une plage qui semble finir au moment où elle commence.
- **Point 35** : une intervention suspendue sans date de suspension connue (`suspendue_le` nul — jamais synchronisée, ou écrite hors du chemin normal) affichait « Suspendue depuis 0 min », une durée fausse ; elle affiche désormais « Suspendue » sans durée inventée. Une pièce attendue sans date de disponibilité affichait « REF-123, . » (virgule suivie d'un point) ; elle affiche désormais « REF-123. ».
- **Point 37** : le nom accessible (`aria-label`) de la frise d'étapes changeait de valeur à chaque statut (« En cours », « Terminée »…) et ne disait jamais ce que ce repère EST. Il porte désormais un nom stable, « Avancement de l'intervention » ; l'étape courante continue de se lire dans le texte visible et par `aria-current="step"`.
- **Point 34** : sur téléphone, le lien d'action principale de l'en-tête gardait sa largeur de texte naturelle, perdu dans la ligne d'actions ; il occupe désormais toute la largeur de l'en-tête sous 901 px, et reprend sa largeur naturelle au-delà.
- **Point 52** : la décision D183 décrivait une intention non codée (« le donneur d'ordre sans courriel... reste nommé sur la carte »). Le code, lui, affiche un tiret (cohérent avec R8). D187 corrige le TEXTE de la décision pour qu'il décrive le code ; le code n'a pas changé.
- **Point 54** : aucune régression — une épreuve e2e neuve couvre un comportement déjà correct (la carte « Sur place » et la Note interne n'apparaissent que sur l'onglet Résumé, y compris pour une valeur `?onglet=` inconnue), qui n'avait jamais été mesuré.
- **Point 53** : captures AVANT/APRES des cinq onglets sur quatre statuts, preuve visuelle de ce que le lot `9EE-TP-UX4-1-FICHE-INTERVENTION-2` a changé — absente jusqu'ici (le README de ce lot nommait déjà ce manque).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- Point 56 : `heureDepuisMinutes(1440)` rendait `"00:00"` (AVANT) ; rend `"24:00"` (APRÈS) — trois cas neufs dans `tests/unit/sites/horaires-affiches.test.ts`, aucun cas existant modifié.
- Point 35 : trois cas neufs dans `tests/unit/interventions/etapes-et-bandeau-fiche.test.ts` (suspendue sans date, avec/sans motif ; pièce sans date de disponibilité), vérifiant l'absence de `enDuree(0)` et de `", ."` dans le texte produit.
- Point 37 : épreuve neuve dans `tests/unit/ui/frise-etapes.test.tsx` — même `aria-label` pour deux jeux d'étapes dont l'étape courante diffère.
- Point 34 : épreuve e2e neuve (`tests/e2e/9eq-fiche-intervention.spec.ts`) — à 375 px, largeur du lien ≥ largeur de l'en-tête − 1 px ; à 1280 px, largeur du lien < moitié de l'en-tête. Mesurée verte sur le code livré ; aucune mesure AVANT (le défaut était visuel, pas un crash).
- Point 52 : épreuve e2e neuve — donneur d'ordre actif sans courriel : ligne « Donneur d'ordre » = tiret, sans nom ni lien `tel:`.
- Point 54 : épreuve e2e neuve — 0 occurrence du titre « Sur place » et de « Note interne » sur Temps/Rapport/Valorisation/Historique ; 1 occurrence sur Résumé ET sur un `?onglet=inconnu`.
- Point 53 : 8 PNG AVANT (`aeb3520d`, une capture par statut × largeur) + 40 PNG APRÈS (code livré, cinq onglets × quatre statuts × deux largeurs) = 48 PNG, toutes vérifiées présentes et non vides.

## Ce que j'ai tranché, et pourquoi

- **Point 52** : choix conservateur demandé par le ticket — corriger le TEXTE de D183 plutôt que le code, puisque le comportement actuel (tiret) est conforme à R8 et qu'aucune décision n'a demandé de montrer un donneur d'ordre sans courriel autrement.
- **Point 34** : la pleine largeur passe par deux classes Tailwind (`w-full`/`min-[901px]:w-auto` sur le conteneur de l'en-tête, `w-full`/`min-[901px]:w-fit` sur `LienPrimaire`), jamais par une modification de `action-primaire.tsx` (partagé par d'autres écrans) — conformément à la consigne du ticket.
- **Point 53** : l'AVANT a été rejoué pour de vrai (`git worktree add --detach` sur `aeb3520d`), pas seulement nommé comme un manque. `package.json`/`pnpm-lock.yaml`/`prisma/schema.prisma` étant identiques entre les deux révisions, un lien symbolique vers `node_modules` a suffi — aucune réinstallation. Cinq clés i18n neuves de `9eq.e2e.*`/`9ee2.e2e.*` ont dû être ajoutées à la fin du dictionnaire DE CE WORKTREE SEULEMENT (jamais commitées sur `aeb3520d`) parce que la scène de capture les utilise et que cette révision ne les porte pas encore ; j'ai d'abord tenté de copier `lib/i18n/fr.ts` en entier depuis HEAD, ce qui a cassé la compilation de cette révision (une clé supprimée depuis, `tableau_de_bord.non_calcule`, encore référencée par son code) — j'ai donc restreint la copie aux cinq clés manquantes.
- **Point 52/54** : l'assertion du tiret (`"—"`) dans l'épreuve e2e passe par `.filter({ hasText: "—" })` plutôt que par `toHaveText("—")`, pour ne pas écrire un signe de ponctuation « en dur » dans une requête d'écran au sens du gardien `sans-chaine-visible-en-dur` — même idiome que `tests/e2e/liens-fiches.spec.ts`.

## Ce que je n'ai PAS fait

- Point 37 : `BlocATraiter` (sans appelant, attend TP-UX4-2), la redondance `role="list"` et la fusion des clés `intervention.fait.creneau`/`intervention.creneau` — hors du mandat de ce point, explicitement exclus par le ticket.
- Point 55 : simple note du solde, aucune action demandée.
- Point 57 : réservé au lot « fiche intervention selon maquette » (décision 63) — hors territoire de ce lot.
- D185 (tableau de bord, lot 9EG-1) et D186 (bon client, lot 9EN) : non écrites, non citées, conformément à l'interdiction du ticket.
- Aucun prix, aucune règle de gestion, aucune migration, aucune ligne de semis.

## Pièges pour la session suivante

- Les épreuves e2e de ce lot régénèrent parfois les captures d'autres lots (`9EE-TP-UX4-1-FICHE-INTERVENTION-1/2/captures/`) quand elles tournent dans la même exécution que leurs propres specs (`fiche-telephone.spec.ts`, `fiche-onglets-sur-place.spec.ts`, `fiche-entete-bandeau-frise.spec.ts` prennent des captures dans leurs propres tests) : `git status` après chaque run `playwright test`, et `git checkout --` les PNG étrangers avant de committer — je l'ai fait deux fois pendant ce lot.
- Le worktree jeté pour l'AVANT du point 53 a RECRÉÉ la base `codiplan_test` (le `globalSetup` de Playwright la détruit et la reseme à chaque exécution) : j'ai dû régénérer les 40 captures APRÈS une seconde fois après l'AVANT, sur le code livré, pour qu'elles reflètent la bonne scène. Si une session future rejoue ce worktree, prévoir de refaire les deux captures dans l'ordre (AVANT puis APRÈS, ou l'inverse, mais pas en supposant que la base survit entre les deux).
- Copier `lib/i18n/fr.ts` en entier depuis HEAD dans un worktree ancien est dangereux : une clé supprimée depuis mais encore référencée par le code ancien casse la compilation. N'ajouter QUE les clés manquantes dont la scène de capture a besoin.

## Ce qui reste à faire

Rien de connu dans le périmètre de ce lot ; le solde 9EP/9EQ continue avec le point 57 (lot « fiche intervention selon maquette », décision 63), hors de ce ticket.
