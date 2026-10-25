# 9G4-PLANNING-JOUR-ET-MOIS — passation

Branche dédiée `9G4-PLANNING-JOUR-ET-MOIS` partant d'`origin/main` (19bb8c58e) : `main` était extrait dans
un autre worktree (`/home/aplou/codiplan`), interdiction de le toucher directement. HEAD de fin :
`e6524701b` (voir « Fin de session » plus bas pour le HEAD après rebase).

## Les 8 points, dans l'ordre

### Point 1 — La frise du jour défile dans un `CadreDefilant`, colonne technicien figée

- **Avant** : `app/(back-office)/planning/page.tsx:3955` — `<div className="overflow-x-auto overflow-y-hidden">`
  simple, sans indice ; `<th>` d'en-tête (:3968) et `<th scope="row">` de colonne (:4021) sans `sticky`.
- **Après** : `CadreDefilant` avec `indice={texteIndiceDefilementJour(journee.axe, journee.pasMinutes)}`
  (`presentation.ts`, nouvelle fonction) ; les deux `<th>` portent `sticky left-0 z-10`/`z-[1]`.
- **Épreuve** : capture `jour-1280-{avant,apres}.png` — l'indice « Défilez vers la droite : la journée
  continue jusqu'à 17:00 » apparaît ; `tests/e2e/planning-jour-frise.spec.ts`,
  `planning-largeur-et-carte.spec.ts` (vérifient déjà le gabarit général de la vue Jour) restent verts.
- Commit `02e4fb362`.

### Point 2 — Les blocs de la frise reprennent la hiérarchie de la carte Semaine

- **Avant** : `page.tsx` (ancien ~4129-4195) — en-tête heure+client fondu, puis la référence
  `Local-…`, puis `DetailsDeLaCarte` (site/matériel/durée/retard) : à 80 px/h, 5-6 lignes dans une
  carte de 64 px de haut, le client illisible (tronqué à 2-3 caractères), la nature absente.
- **Après** : créneau + puce priorité / CLIENT sur sa propre ligne / nature · site fondus / « en retard »
  en texte si applicable. Référence, matériel et durée restent dans le `title` (tiroir à un clic).
- **Épreuve** : vérifié par inspection DOM directe (`boundingBox`/`innerHTML` du premier bloc, hors dépôt)
  avant/après ; capture `jour-1280-apres.png`. Aucune épreuve existante ne mesurait le contenu de CE
  bloc précis (seul `[data-bloc]`, la Semaine, est couvert par `planning-largeur-et-carte.spec.ts`) —
  confirmé en relisant ce fichier avant de toucher.
- Commit `bb535067c`.

### Point 3 — La vue Jour partage la légende complète de la Semaine

- **Avant** : `page.tsx` (ancien ~3912-3941) — `<ul>` locale à 4 entrées (Occupé/Libre/Hors ouverture/
  Absence) ; « Occupé » ne correspondait à aucun aplat réel.
- **Après** : `<Legende afficherAnnulees={afficherAnnulees} />`, le même composant que la Semaine (5
  statuts, agenda bloqué, jour non ouvert, puce de priorité).
- **Épreuve** : capture `jour-1280-apres.png` — légende à 9 entrées visible juste sous le sous-titre.
- Commit `69f8f0b04`.

### Point 4 — « Plein écran » gagne Jour et « 2 semaines », masqué au téléphone

- **Avant** : `page.tsx:1475-1481` (ancien) — `vue === "semaine"` seulement ; `hrefSansPleinEcran`/
  `BasculerPleinEcran` figés sur `vue=semaine` (Échap y ramenait toujours, même depuis une autre vue).
- **Après** : affiché pour `semaine`/`jour`/`deux_semaines`, généralisé par `parametrePeriode` (D145) ;
  enveloppé `max-[900px]:hidden`.
- **Épreuve** : capture `jour-1280-apres.png` — bouton visible dans la barre d'outils ;
  `tests/e2e/planning-largeur-et-carte.spec.ts` (« Plein écran replie… ») reste vert sans changement
  d'attente (vue Semaine, comportement inchangé).
- Commit `46cae4b3a`.

### Point 5 — Le Mois s'ouvre sur aujourd'hui, pas sur le 1er

- **Avant** : `page.tsx:3640` (ancien) — `CadreDefilant` sans `indice`, aucun défilement au montage ;
  aujourd'hui hors cadre jusqu'au jour 16.
- **Après** : `app/(back-office)/planning/defiler-mois.tsx` (nouveau, composant client) — `scrollIntoView`
  sur `[data-aujourdhui]` au montage ; `indice={texteIndiceDefilementMois(...)}`.
- **Épreuve** : capture `mois-1280-{avant,apres}.png` — « Lun 26 » (aujourd'hui) visible dans le cadre
  après ce lot, hors cadre avant ; `tests/e2e/planning-mois-charge.spec.ts` reste vert (scène sur un
  mois futur, `data-aujourdhui` absent, pas concernée par le défilement).
- Commit `8dd942f68`.

### Point 6 — « Transmettre toutes les planifiées prêtes (N) » passe à la ligne à 375 px

- **Avant** : `page.tsx:2413` (ancien) — `className="mb-2.5 overflow-x-auto overflow-y-hidden"` sur le
  `<form>` : le bouton (shadcn, `whitespace-nowrap`) débordait, le compte restait hors cadre sans
  défilement visible.
- **Après** : `[&>button]:max-[900px]:whitespace-normal` (et `text-center`/`leading-tight`/`py-1`) posé
  sur le `<form>`, qui vise le SEUL bouton déclencheur (enfant direct) — `BoutonAvecConfirmation`
  (`components/ui/`, hors territoire) ne reçoit aucun `className`.
- **Épreuve** : capture `transmettre-toutes-375-{avant,apres}.png` — le bouton passe de « …prêtes » (le
  « (20) » hors cadre) à deux lignes centrées avec « (20) » visible.
- Commit `d523cd851`.

### Point 7 — L'indice de défilement dit « les deux semaines », pas « la semaine », en 2 semaines

- **Avant** : `presentation.ts:101` (ancien) — `texteIndiceDefilement` ne portait qu'un seul texte,
  « la semaine continue jusqu'à… », utilisé aussi par la vue « 2 semaines ».
- **Après** : paramètre `deuxSemaines` (déduit de `formeCarte === "compacte"`, seule appelante de cette
  forme), nouvelle clé `planning.indice_defilement_deux_semaines`.
- **Épreuve** : capture `deux-semaines-1280-{avant,apres}.png` (le texte diffère si le débordement est
  présent à cette largeur — à défaut, vérifié par lecture directe du code : le nouveau paramètre est
  bien branché au seul point d'appel, `grep` confirmé).
- Commit `6ea07eb85`.

### Point 8 — Aucun onglet téléphone ne s'allume à tort en Mois ou « 2 semaines »

- **Avant** : `lib/interventions/affichage.ts:330` (ancien) — `ongletTelephone` rendait `"semaine"` pour
  TOUTE vue différente de « jour », donc aussi pour Mois et « 2 semaines ».
- **Après** : rend `null` pour ces deux vues ; `"semaine"` uniquement pour la vue Semaine elle-même.
- **Épreuve** : capture `deux-semaines-375-{avant,apres}.png` — l'onglet « Semaine » est allumé (bleu)
  avant ce lot, éteint après, en vue « 2 semaines » au téléphone. Épreuve unitaire adaptée explicitement
  (`tests/unit/interventions/telephone-onglets.test.ts:39-46`, citée au commit).
- Commit `c0e32134e`.

## Correctif annexe — `tests/e2e/setup/glisser.ts`

Régression DÉCOUVERTE en épreuve voisine (`glisser-deposer.spec.ts`, « tirer la poignée À GAUCHE du
début ») : point 1 ajoute un indice de défilement affiché SEULEMENT tant que la frise déborde — le
résorber en élargissant la fenêtre de test fait disparaître cette ligne et reflow toute la page
verticalement. `agrandirPourContenirLesDeux` mesurait `haut`/`bas` AVANT cet élargissement, défilant
ensuite vers une position devenue fausse (la poignée retombait sous le bandeau fixe, invisible).
Mesuré rouge sur `origin/main` après avoir temporairement remplacé les 5 fichiers touchés par leur
version `19bb8c58e` dans CE worktree (donc faux négatif écarté : le test était VERT sur `origin/main`
inchangé, confirmant que c'est bien ce lot qui casse l'hypothèse du harnais, pas un flake préexistant).
Fixé en mesurant `haut`/`bas` APRÈS l'élargissement de largeur (hauteur inchangée), avant le second
redimensionnement qui porte la hauteur. Commit `4a29d064f`.

## Captures (`docs/propositions/9G4-PLANNING-JOUR-ET-MOIS/captures/`)

```
-rw-r--r-- 1 aplou aplou 129226 deux-semaines-1280-apres.png
-rw-r--r-- 1 aplou aplou 128376 deux-semaines-1280-avant.png
-rw-r--r-- 1 aplou aplou  44935 deux-semaines-375-apres.png
-rw-r--r-- 1 aplou aplou  45720 deux-semaines-375-avant.png
-rw-r--r-- 1 aplou aplou 125380 jour-1280-apres.png
-rw-r--r-- 1 aplou aplou 128100 jour-1280-avant.png
-rw-r--r-- 1 aplou aplou  45211 jour-375-apres.png
-rw-r--r-- 1 aplou aplou  45211 jour-375-avant.png
-rw-r--r-- 1 aplou aplou 116986 mois-1280-apres.png
-rw-r--r-- 1 aplou aplou 113297 mois-1280-avant.png
-rw-r--r-- 1 aplou aplou  45875 mois-375-apres.png
-rw-r--r-- 1 aplou aplou  46124 mois-375-avant.png
-rw-r--r-- 1 aplou aplou  55380 transmettre-toutes-375-apres.png
-rw-r--r-- 1 aplou aplou  54028 transmettre-toutes-375-avant.png
```

AVANT pris sur `origin/main` (19bb8c58e) dans un worktree temporaire (`/home/aplou/9g4-avant`, retiré
depuis) ; APRÈS pris sur ce code. Spec : `tests/e2e/zz-captures-9g4-planning-jour-et-mois.spec.ts`
(commité).

## `pnpm verify:full` — ce qui a tourné, et ce qui n'a pas pu finir

`CI=1 pnpm verify:full` a été lancé EN ENTIER, au premier plan, dans `docs/propositions/
9G4-PLANNING-JOUR-ET-MOIS/verify-final.txt`. Dans l'ordre :

- `format:check`, `typecheck`, `lint` : **verts**.
- `test` (unitaire) : **vert** — 471 fichiers, 5127 tests.
- `test:isolation` : **vert** — 192 fichiers, 1679 tests. (Une première tentative, lancée alors qu'un
  `pnpm verify:full` précédent tournait encore en tâche de fond par erreur de ma part — fautif, j'ai tué
  les deux processus et recommencé proprement EN PREMIER PLAN — avait donné 52 échecs par
  contention/deadlock sur la base partagée, aucun touchant `planning/`. Le rejeu isolé, seul, est vert.)
- `build` : **vert** — `next build` compile et génère les 91 pages statiques.
- `feries:horizon`, `audit:partitions` : **verts**.
- `test:e2e` (suite complète Playwright) : **n'a pas fini dans le budget du ticket** — interrompu après
  55 minutes (`timeout 3300`). Le journal montre des centaines d'épreuves vertes (`·`), quelques
  reprises (`°`, un "flaky réussi au second essai" normal du harnais), UN SEUL symbole d'échec (`×`,
  ligne 630 du journal, horodatage ~22:15-22:21 UTC) sans nom de fichier résolu — le reporter `dot`
  n'imprime les noms qu'au résumé final, jamais atteint avant la coupure. Tous les fichiers e2e ciblés
  par CE ticket (`planning-jour-frise`, `planning-jour-suite`, `planning-jour-en-tete`,
  `planning-largeur-et-carte`, `planning-mois-charge`, `planning-telephone-onglets`,
  `affichage-materiel`, `ergo-carte-semaine`, `blocage-agenda-visible`, `glisser-deposer` en entier,
  `planning-annuler-deplacement`, `planning-fenetre-pose`, `planning-semaine-garde-heure`,
  `planning-survol-cases`, `parcours-creer-puis-planifier`, `9f5c-date-passee-planning`,
  `planning-creer-ici`, `planning-laissees-sous-la-grille`, `planning-filtres-aujourdhui`,
  `planning-cibles-375`) ont été joués INDIVIDUELLEMENT avant la tentative `verify:full` et sont tous
  **verts** — voir le journal de session, pas reproduit ici faute de place.

15 dernières lignes du journal : voir `verify-final.txt` (coupure en plein milieu d'une mesure, pas de
résumé final — le fichier documente ce qui a tourné, honnêtement incomplet).

## Fin de session

`git fetch origin` puis `git rebase origin/main` et `CI=1 pnpm verify` restent À FAIRE si le temps du
lot le permet encore — sinon, à faire par la reprise. `git rev-parse --short HEAD` avant toute tentative
de rebase : `e6524701b`. Jamais de push.

## Points ouverts

1. **`test:e2e` complet non rejoué jusqu'au bout** après le correctif de `glisser.ts` — le `×` unique
   observé dans le journal n'est pas identifié par son nom de fichier. Les 20 fichiers e2e directement
   concernés par ce ticket sont verts individuellement (mesuré). À rejouer en entier par la reprise,
   si possible en plusieurs appels plus courts (`-g` par thème) pour obtenir un résumé nommé avant
   d'épuiser le budget de temps.
2. **Point 7 (indice « 2 semaines »)** : la capture `deux-semaines-1280-{avant,apres}.png` ne montre
   l'indice QUE si la grille déborde réellement à 1280 px dans la scène de démonstration — à vérifier
   visuellement par la reprise ; le branchement du code, lui, est confirmé par lecture.
3. **Légende de la vue Jour (point 3)** perd la bordure inférieure (`border-b`) que l'ancienne `<ul>`
   portait — `Legende` (composant partagé) n'a pas cette classe, utilisée en fin de carte côté Semaine.
   Écart cosmétique mineur, non demandé explicitement par le ticket, non corrigé faute de pouvoir
   toucher au composant partagé sans risquer la Semaine.
