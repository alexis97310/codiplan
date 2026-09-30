# Passation — 9CI-PG-G12-DEUX-SEMAINES-MOIS

Sept commits sur `main`, en local, non poussés :

1. `85c4c30` — D145 (docs/arbitrages.md).
2. `6bd58d7` — les quatre vues, fonctions pures (`lib/interventions/affichage.ts`).
3. `0326a73` — la vue 2 semaines (`page.tsx`, `presentation.ts`, `apparence.ts`, `fr.ts`, e2e).
4. `8fc3046` — captures de la vue 2 semaines.
5. `9e63836` — le mois, fonctions pures (`affichage.ts`, `carte.ts`, `presentation.ts`).
6. `13cb470` — la vue Mois (`page.tsx`, `fr.ts`, `apparence.ts`, e2e).
7. `52be023` — captures de la vue Mois.

`CI=1 pnpm verify:full` a été rejoué EN ENTIER, en un seul appel, à la fin : **vert** —
format/typecheck/lint/test unitaire (346 fichiers, 3533 tests)/`test:isolation`/`build` puis
`feries:horizon`, `audit:partitions`, et `test:e2e` (707 passés, 7 ignorés, préexistants, 0 échec).

## 1. Ce que j'ai changé, et ce que ça change pour l'exploitation

Le planning a maintenant **quatre vues** au lieu de deux : Jour, Semaine (inchangées), **2
semaines** et **Mois**, nouvelles. Un planificateur peut désormais :
- préparer la semaine suivante sans y être : la vue **2 semaines** montre douze jours (deux fois
  lundi-samedi) avec des cartes compactes (heure de début + client) ;
- voir la charge du mois entier en un coup d'œil : la vue **Mois** montre 28 à 31 colonnes, une
  case par (technicien, jour) avec le nombre d'interventions et une teinte proportionnelle au taux
  de charge de ce jour (rouge plein au-delà de 100 %) ; cliquer une case ouvre la vue Jour de ce
  jour-là.

**Rien n'est retiré** : la vue Semaine (grille, cartes à trois lignes, barre de charge par jour,
plein écran) est strictement inchangée, vérifiée par les captures témoin et par les 29+ tests e2e
existants du planning, tous restés verts.

**Aucune règle de gestion, aucune formule de charge, aucune migration** : les deux vues neuves sont
des vues de LECTURE sur les mêmes données (`listerPlanning`, `construireGrille`, `tauxCompact`,
`TAUX_PLEIN`) — zéro nouvelle requête, zéro nouveau calcul de charge.

## 2. Ce que j'ai mesuré (AVANT/APRÈS)

Deux paires de captures, chacune AVANT/APRÈS **en un seul fichier de test**, par détection (le
scénario compte ce que la page rend et nomme sa capture en conséquence — pas de `git worktree`
nécessaire puisque le code d'avant était simplement l'état non commité du dépôt à cet instant) :

- `docs/propositions/PG-D2-DEUX-SEMAINES/captures/` — `deux-semaines-{avant,apres}-{1280,1024,375}.png`,
  `semaine-temoin-{1280,1024,375}.png` (témoin : identique aux deux passes), `mesure-{avant,apres}.md`.
- `docs/propositions/PG-D3-MOIS-CHARGE/captures/` — `mois-{avant,apres}-{1280,1024,375}.png`,
  `mois-clic-vue-jour-{1280,1024,375}.png`, `mesure-{avant,apres}.md`.

**Mesure (`mesurer`/`ligneMesureReadme`, `scripts/lib/mesure-captures.ts`), aux deux passes, aux
trois largeurs, pour chaque écran capturé : 0 texte sous 12 px (D138), 0 débordement horizontal,
0 erreur de console.** Les cibles (seuil 32/44 px) n'ont pas été mesurées par ces deux scénarios
(aucune cible cliquable classique dans la grille du Mois — la case entière EST le lien).

Largeur d'une colonne de jour, mesurée dans le code (constantes, pas une capture à part) :
- Semaine : 150 px (inchangée) ;
- 2 semaines : 118 px (`LARGEUR_COLONNE_JOUR_OUVERT_DEUX_SEMAINES_PX`) ;
- Mois : 32 px (`LARGEUR_COLONNE_JOUR_MOIS_PX`).

## 3. Ce que j'ai tranché, et pourquoi

- **D145** (nouvelle décision, `docs/arbitrages.md`) inscrit la réponse de QG-2 (27/09/2026,
  déjà appliquée sans page par PG-C) : les sept écarts nommés à la disposition de la maquette
  complète sont acceptés EN BLOC — des ajouts seulement, D125/D128 inchangées.
- **`joursDeLaVue("mois")` et `moisDecale` ont été écrits au commit 2** ("les quatre vues"),
  en même temps que l'extension du type `VuePlanning` à `"mois"` — PAS au commit 5 ("le mois")
  comme le découpage du ticket le prévoyait. Raison : `VuePlanning` incluant déjà `"mois"`,
  écrire `joursDeLaVue` sans son cas `"mois"` aurait exigé soit un `throw` mort (jamais atteint,
  jamais éprouvé), soit une fonction non exhaustive que `tsc` aurait refusée — les deux sont une
  demi-implémentation, que la consigne de travail refuse explicitement. Conséquence mesurée : les
  tests unitaires du commit 5 pour `joursDeLaVue("mois")` sont VERTS DÈS LE PREMIER LANCEMENT
  (pas de rouge constaté avant implémentation), contrairement à la discipline test-d'abord tenue
  partout ailleurs dans ce lot (`teinteDeChargeDuJour`, `libelleMois`, `VueMois`, tous rouges puis
  verts). C'est un écart assumé et isolé à cette seule fonction, pas une pratique généralisée.
- **Ordre des onglets** : Semaine, Jour, 2 semaines, Mois — celui déjà posé par le dépôt avant ce
  ticket, PAS celui de la maquette du 28/09 (Jour, Semaine, 2 semaines, Mois). Choisi pour ne pas
  rouvrir un ordre que ce ticket n'a pas à trancher ; question posée en passation (point 8
  ci-dessous).
- **Occupation du jour d'une case, factorisée** (`occupationDuJourDeLaCase`, `page.tsx`) : la barre
  de charge de la Semaine (`BarreChargeJourDeLaCase`) et la teinte de la case du Mois
  (`teinteDeChargeDuJour`, appelée depuis `VueMois`) lisent désormais le MÊME calcul — un seul
  dénominateur, jamais deux écritures. Preuve que la barre de la Semaine n'a pas changé : les
  captures témoin (`semaine-temoin-*.png`, identiques aux deux passes) et les 29 tests e2e
  existants du planning, tous verts après la factorisation.
- **Écarts nommés à la maquette du planning GMAO** (`docs/propositions/planning-gmao/maquette-planning-gmao.html`), chacun avec sa source :
  - 118 px (2 semaines) au lieu de 120 px — arrondi sans signification, aucune source contraire ;
  - 32 px (Mois) au lieu de 22 px — `SEUIL_CIBLE_BUREAU_PX`, cible de bureau (spec §10 :963), 22 px
    romprait le plancher de cible que le dépôt mesure déjà ailleurs ;
  - 12 px minimum partout (D138) au lieu de 10-11 px de la maquette GMAO ;
  - opacité = `taux / 100`, plafonnée à 1, SANS le plancher 0,1 ni le facteur 0,8 de la maquette
    GMAO (`0.1 + 0.8 × taux`) — ces deux nombres ne sont écrits nulle part comme règle du produit,
    D145 ne les reprend pas ;
  - le chiffre de la case du Mois est sur une pastille claire (`bg-app-surface`, encre constante),
    jamais une encre qui bascule au blanc à 55 % — contraste constant, pas de seuil inventé ;
  - 12 jours pour « 2 semaines » (6 + 6, comme la Semaine), jamais 14 — décision d'Alexis du
    27/09/2026, le brouillon du ticket disait 14 par erreur, corrigé par le ticket lui-même
    (section « LE CONSTAT ») avant que je ne commence.

## 4. Ce que je n'ai PAS fait

- Aucune formule de charge changée (D107/D111 intacts), aucune requête nouvelle, aucune migration,
  aucune ligne de semis, aucun prix, conformément aux interdits du ticket.
- Le lien « Mois » de l'onglet n'a pas été ajouté avant que sa vue existe (commit 3 s'est arrêté à
  trois onglets ; le quatrième est arrivé avec le commit 6, la vue Mois elle-même).
- Rien de ce qui est explicitement HORS territoire n'a été touché : `VueJour`, `journee.ts`,
  `pose.tsx`, `ListeSemaine`, l'en-tête (`actions` de `<Page>`), `tiroir.tsx`, `grille.ts`,
  `occupation.ts`, `statistiques.ts` (hors lecture), `depot.ts`.
- Les cibles cliquables (seuil 32/44 px) n'ont pas été mesurées dans les deux scénarios de capture
  de ce lot (voir point 2) — aucune cible classique dans la grille du Mois, chaque case étant
  elle-même le lien entier.
- Le comportement de la vue Mois sous 900 px / à 375 px (la même table qui défile, plutôt qu'une
  liste ou des onglets par technicien) est un choix MINIMAL ET RÉVERSIBLE, pas une décision : PG-D4
  (onglets téléphone, hors de ce ticket) le retranchera probablement.

## 5. Les pièges pour la session suivante

- **`joursDeLaVue("mois")` est déjà écrite et testée depuis le commit 2** — un futur lot qui
  toucherait à `lib/interventions/affichage.ts` doit le savoir avant de croire qu'il manque encore
  quelque chose au mois.
- **Deux fichiers de capture par vue, PAS un** (`mesure-avant.md` / `mesure-apres.md`) : le script
  écrit systématiquement sous le nom `mesure.md`, et j'ai renommé à la main entre les deux passes.
  Un prochain lot qui reprendrait ce patron doit faire pareil, ou le fichier de la seconde passe
  écrase silencieusement celui de la première.
- **`pnpm typecheck`/`pnpm test`/`pnpm build` ont tous eu besoin de `NODE_OPTIONS=--max-old-space-size=6144`
  sur ce poste** — sans cette variable, `tsc` meurt d'OOM (`heap limit Allocation failed`) avant
  même d'atteindre ce ticket. Pas un défaut du ticket, un fait du poste ; à vérifier si ça persiste.
- **Rejouer `pnpm test:e2e` en entier régénère silencieusement des dizaines de PNG de captures
  D'AUTRES TICKETS** (`docs/propositions/*/captures/*.png`, plus de soixante-dix fichiers modifiés
  mesuré après ce seul `verify:full`) : plusieurs anciens scénarios de capture écrivent sans garde
  d'environnement (`DOSSIER_CAPTURES` toujours défini, jamais `process.env.X ?? ""`). Je les ai
  tous restaurés (`git checkout --`) avant de committer — **`git status --porcelain` doit être
  vérifié après TOUT `test:e2e`**, jamais supposé propre.
- **La colonne technicien de la vue Mois est collante (`sticky left-0`) mais je n'ai pas vérifié
  qu'elle reste au-dessus du calque de teinte** à un défilement horizontal important (30 colonnes à
  32 px dépassent largement 1280 px) — les captures ne montrent que le début du défilement.

## 6. Ce qui reste à faire

À CONFIRMER PAR ALEXIS (comportement minimal et réversible livré en attendant) :

1. **2 semaines = 12 jours**, lundi-samedi deux fois (comme la Semaine, 6 jours) — le brouillon du
   ticket disait 14, corrigé en 12 par le ticket lui-même avant que je ne commence (section « LE
   CONSTAT », point (1)) ; je n'ai fait que suivre cette correction.
2. **Mois sous 900 px et à 375 px** : la même table défile dans son conteneur, en attendant PG-D4
   (onglets téléphone) — garder, masquer, ou une liste ?
3. **Case d'un jour d'absence** : violet, SANS teinte, le chiffre gardé s'il reste des
   interventions posées ce jour-là — est-ce la bonne lecture ? (QG-8/PG-G15 rendra les absences
   partielles, ce qui rouvrira cette case).
4. **Le dénominateur du jour ne retire pas les absences** (existant, barre de la Semaine,
   inchangé par ce ticket) : garder, ou retirer les absences (un calcul de charge qui change,
   ticket à part) ?
5. **Le chiffre de la case sur une pastille claire**, plutôt qu'une encre qui change de couleur
   selon la teinte (écart nommé au point 3 ci-dessus) — à valider.
6. **« Plein écran »** : reste à la Semaine seule (inchangé), ou aussi en 2 semaines et en Mois ?
7. **La colonne « À traiter »** reste affichée en vue Mois (elle prend 255 px au mois qui
   défile) : garder ou replier ?
8. **L'ordre des onglets** (Semaine, Jour, 2 semaines, Mois — celui du dépôt) plutôt que celui de
   la maquette du 28/09 (Jour, Semaine, 2 semaines, Mois) — à harmoniser ou à laisser ?
9. Les libellés neufs (onglets, navigation, sous-titres, légende, infobulle de la case) — texte à
   valider par Alexis, comme toute chaîne du dictionnaire.

Aucune de ces neuf questions ne bloque `pnpm verify:full`, qui est vert ; ce sont des choix
d'ergonomie, pas des défauts.
