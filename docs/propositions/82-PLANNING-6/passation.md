# 82-PLANNING-6 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- `app/(back-office)/planning/page.tsx`, vue SEMAINE (`VueSemaine`) :
  - Le tableau `data-maquette-bloc="tableau-charge-semaine"` a perdu son
    `min-w-[920px]`. Il reste `w-full table-fixed`, avec une seule largeur
    explicite (la colonne « Technicien », `LARGEUR_COLONNE_TECHNICIEN_PX`,
    170 px, D95 — inchangée) : le navigateur répartit TOUJOURS le reste à
    parts égales entre les six colonnes de jour, quelle que soit la largeur
    réelle du conteneur. **Résultat pour l'exploitation** : à 1280 px comme
    à 1440 px, menu latéral ouvert, les six jours de la semaine (lundi à
    samedi) sont visibles sans le moindre défilement horizontal — plus
    besoin de deviner que vendredi et samedi existent. À 1440 px, les
    colonnes sont visiblement plus larges qu'à 1280 : l'espace gagné sert
    enfin à quelque chose.
  - Le jour courant (calculé une seule fois, `aujourdhui`, dans le fuseau de
    la société — même source que le repli par défaut de `jourDemande`) porte
    `data-aujourdhui` sur son en-tête, un fond et un texte teintés
    (`bg-app-marque/10 text-app-marque`, la même famille que l'onglet actif),
    et une teinte plus légère sur ses cases (`bg-app-marque/5`), toujours
    dominée par un agenda bloqué (violet) ou un jour fermé (hachure) — la
    même hiérarchie que celle déjà écrite pour ces deux états.
  - Un bouton « Aujourd'hui » apparaît entre « Semaine précédente » et
    « Semaine suivante » dès que la semaine affichée n'est plus la semaine
    courante ; il est absent sur la semaine courante (jamais désactivé — même
    discipline que les avertissements de l'écran, qui ne s'affichent que
    lorsqu'il y a quelque chose à dire).
  - L'onglet de bascule vers la vue jour affiche à nouveau « Jour »
    (`t("planning.vue_jour")`) plutôt que le nom du jour réel — retour sur le
    choix du 19/09, corrigé par le constat 13 de l'audit du 25/09 : cet
    onglet est une bascule de VUE, comme son voisin « Semaine », qui ne nomme
    pas non plus la semaine affichée. La fonction `nomDuJourAffiche`, devenue
    inutile, est supprimée.
- `lib/i18n/fr.ts` — une clé neuve, `planning.aujourdhui` (« Aujourd'hui »).
- `tests/e2e/planning-6.spec.ts` (neuf) — l'épreuve de ce lot : absence de
  défilement du conteneur du tableau à 1280 et 1440 px, en-tête du jour
  courant entièrement dans la fenêtre aux deux largeurs, et le bouton
  « Aujourd'hui » qui ramène bien à la semaine courante (et n'apparaît pas
  quand on y est déjà).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Largeur du conteneur du tableau, mesurée dans ce dépôt** (et non
  supposée) : 662 px à 1280 px d'écran, 822 px à 1440 px, menu latéral
  ouvert (272 px fixes) — contre un tableau figé à 920 px. Vendredi et
  samedi étaient donc hors cadre aux DEUX largeurs, jamais seulement à
  1280 px comme le laissait penser la seule mesure de production citée par
  le ticket (805 px).
- **`pnpm exec playwright test tests/e2e/planning-6.spec.ts
  tests/e2e/planning-largeur-et-carte.spec.ts tests/e2e/glisser-deposer.spec.ts
  tests/e2e/blocage-agenda-visible.spec.ts tests/e2e/planning-5.spec.ts
  tests/e2e/planning-3.spec.ts`** : 25 passés, 0 échec — le glisser-déposer et
  l'agenda bloqué n'ont pas été touchés et restent verts.
- **`pnpm exec playwright test tests/e2e/affichage-materiel.spec.ts
  tests/e2e/tous-les-ecrans-rendent.spec.ts tests/e2e/interventions-2.spec.ts
  tests/e2e/formulaires-2.spec.ts`** : 49 passés, 3 sautés (déjà sautés hors
  de ce lot), 0 échec — sanity check plus large sur des écrans qui partagent
  des composants ou des routes avec `/planning`.
- **`pnpm verify`** (format, typecheck, lint, test unitaire — 2821 tests,
  test:isolation — 1239 tests, build) : vert de bout en bout.
- Captures AVANT/APRÈS jointes (`captures/vue-semaine-{avant,apres}-{1280,1440}.png`),
  prises par un script Playwright jetable (supprimé après usage) qui rejoue
  l'ancien `page.tsx` (`git checkout HEAD~1 --`) pour l'AVANT, puis restaure le
  commit de ce lot pour l'APRÈS — jamais une capture à la main.

## Ce que j'ai tranché et pourquoi

- **Colonnes fluides plutôt que colonne Technicien réduite ou jour non
  ouvert replié.** Retirer `min-w-[920px]` suffit : `table-fixed` avec une
  seule colonne à largeur explicite répartit déjà le reste à parts égales,
  pour n'importe quelle largeur de conteneur — c'est le mécanisme qui
  produisait déjà les 125 px par jour observés jusqu'ici (750 px / 6), rejoué
  sur la largeur RÉELLE du conteneur au lieu d'un minimum arbitraire de
  920 px. Je n'ai pas replié le samedi en colonne étroite grisée quand il
  n'est pas ouvert : la maille de cette grille est la PERSONNE, pas
  l'agence (N-06), et un technicien de Ducos (samedi ouvert) peut apparaître
  à côté d'un technicien de Koné (samedi fermé) dans la MÊME semaine — replier
  une colonne entière aurait fallu décider quelle agence l'emporte, une
  question que le ticket ne pose pas et que je n'ai pas tranchée à sa place.
  La colonne Technicien garde donc ses 170 px exacts de la maquette (D95),
  inchangés.
- **« Aujourd'hui » ABSENT plutôt que désactivé** sur la semaine courante :
  cohérent avec le reste de l'écran (avertissements, bannière de refus), qui
  ne montre jamais un contrôle qui n'a rien à faire.
- **Le jour courant est calculé dans le fuseau de la SOCIÉTÉ**, exactement
  la même source que `jourDemande` utilise déjà quand aucun paramètre d'URL
  ne fixe la semaine ou le jour — jamais une seconde lecture du même critère
  (§9, 01/09 : deux lectures divergent en silence). Je n'ai pas différencié
  par agence (fuseau de l'agence de CHAQUE ligne) : la notion de « jour »
  est une date civile, pas une heure, et toutes les agences de ce dépôt sont
  à Nouméa aujourd'hui — le jour où une agence métropolitaine existera, cette
  décision devra être rouverte, comme le fuseau d'affichage des heures l'est
  déjà par `fuseauPour`.
- **Un test étranger à ce lot, `tests/e2e/planning-largeur-et-carte.spec.ts`
  (PLANNING-2), a dû être réécrit — pas seulement sa mise en scène, son
  assertion.** Il forçait un défilement réel du conteneur
  (`element.scrollLeft = element.scrollWidth`, avec un témoin
  `expect(scrollReel).toBeGreaterThan(0)` qui aurait fait échouer l'épreuve
  si rien n'était scrollable) pour prouver que la colonne « Technicien »
  restait fixe PENDANT ce défilement. Ce défilement existait uniquement
  PARCE QUE le tableau débordait de son conteneur à 1280 px — exactement le
  défaut que ce lot corrige. Une fois `min-w-[920px]` retiré, il n'y a plus
  rien à défiler à cette largeur : le témoin ne peut plus être vrai, pas
  parce que le code est faux, mais parce que la prémisse du test (« la
  grille déborde de son propre conteneur à 1280 px ») a cessé d'être vraie
  PAR CONCEPTION. J'ai réécrit ce test pour vérifier directement ce que
  82-PLANNING-6 garantit (absence de débordement, colonne visible sans
  geste), avec un commentaire qui explique le changement en place — je n'ai
  ni supprimé le fichier, ni affaibli une assertion pour la faire passer.

## Ce que je n'ai PAS fait

- Aucun repli visuel du jour non ouvert (samedi) en colonne étroite grisée —
  voir la justification ci-dessus (maille par personne, pas par agence).
- La vue MOBILE de la semaine (`ListeSemaine`, sous `lg`) ne porte PAS le
  même surlignage du jour courant que la grille de bureau. Le ticket ne
  couvre que 1280/1440 px, et `ListeSemaine` n'est jamais montrée à ces
  largeurs (elle est remplacée par la grille dès `lg`) : je n'ai pas ouvert
  ce territoire faute de l'avoir mesuré nécessaire.
- La vue JOUR n'a reçu aucune modification (territoire interdit par le
  ticket) : ni bouton « Aujourd'hui », ni teinte du jour courant — elle a
  déjà son propre `jourAffiche` et sa propre navigation.
- Je n'ai pas cherché à faire fonctionner la classe `sticky` de la colonne
  « Technicien » à une largeur où elle serait réellement exercée : elle
  reste posée dans le code comme un plancher de sécurité (une largeur plus
  étroite que celles de ce lot, ou un contenu imprévu, pourrait encore
  provoquer un débordement local), mais aucune épreuve ne la vérifie plus en
  action — ce n'était pas l'objet de ce lot.

## Les pièges pour la session suivante

- **`min-w-[920px]` ne doit pas revenir sur ce tableau** sans revérifier les
  largeurs à 1280/1440 : c'est exactement lui qui causait le débordement.
  Un futur ajout de colonne (ou de contenu plus large dans une cellule) doit
  être vérifié contre `tests/e2e/planning-6.spec.ts`.
- **La teinte du jour courant (`bg-app-marque/10`, `bg-app-marque/5`) n'a pas
  de jeton dédié** — elle réutilise `--app-marque` avec un modificateur
  d'opacité Tailwind v4 (`color-mix`), comme `bg-app-chrome-fond/60` déjà
  présent dans `components/navigation/barre.tsx`. Si un jeton « aujourd'hui »
  dédié devait naître un jour, ces deux occurrences sont à regrouper.
- **Le compte de 662/822 px** (largeur du conteneur du tableau à 1280/1440,
  menu ouvert) dépend de la largeur fixe du menu latéral (272 px,
  `components/navigation/barre.tsx`) et de `LARGEUR_UTILE_PX` (1400,
  `lib/theme/apparence.ts`) : si l'un des deux change, ces chiffres ne sont
  plus valides — mais la garantie du lot (pas de débordement) ne dépend
  d'aucun des deux, elle est structurelle (`table-fixed` + `w-full`).

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce ticket. Les deux pistes écartées
  ci-dessus (repli du jour non ouvert, surlignage du jour courant dans
  `ListeSemaine`) restent ouvertes si un futur constat les demande
  explicitement.
