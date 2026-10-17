# 9F2B-TERRAIN-JOURS-EPREUVES — passation

Revue de 9F2-TERRAIN-JOURS-MAQUETTE (publié b40ed8ff, mesurée par le pilote sur
`origin/main`). Cinq commits livrés : isolation sous un technicien, état vide sans
`test.skip`, cartes sous le bon titre, bascule de jour Nouméa/UTC, captures en viewport ;
plus le câblage D161 ↔ D210 et cette passation.

## Ce que j'ai changé

- **Isolation sous un technicien** (`tests/isolation/terrain-technicien-isole.test.ts`,
  neuf) : `interventionsEnRetard` et `listerPlanning` (paramètres de `/terrain`, D141 14C)
  n'étaient éprouvés que sous un rôle de bureau (accès complet). Deux scénarios forgent
  une ligne du technicien lui-même (doit apparaître), une d'un AUTRE technicien de la même
  société (doit disparaître) et une de la société B (doit disparaître). **Sabotage
  mesuré** : `restrictionParPersonne` neutralisée (`return undefined`) fait échouer les
  deux épreuves ; restituée, elles passent.
- **État vide sans `test.skip`** (`tests/e2e/9f2-terrain-jours-maquette.spec.ts`) : le
  `test.skip` auto-mesuré de « Ma journée vide » ne s'exécutait JAMAIS — mesuré que même
  sans la scène `zz9F2-`, le seul semis de démonstration pose une ligne pour
  `COMPTE_TECHNICIEN_EPREUVE` dans la fenêtre `[J+1, J+7]`. Option (a) du ticket retenue :
  « Ma journée vide » ouvre désormais son propre technicien (`zz9f2b-`, `beforeAll`/
  `afterAll`, même chemin de premier accès que les quatre autres comptes de la scène,
  `ouvrirLeCompteDeLEpreuve`), né sans la moindre intervention — son état vide est
  CONSTRUIT, jamais mesuré. `tests/unit/terrain/presentation.test.ts` exerce en plus
  `libelleJoursSuivantsVide` (jamais exercée auparavant), sur la borne de changement
  d'année.
- **Cartes sous le bon titre** (même spec) : les assertions de 9F2 ne vérifiaient que la
  PRÉSENCE d'une carte n'importe où sur la page. Ajoute la ligne forgée « Affectées, sans
  date » qui manquait à la scène, et borne chaque carte entre le titre de SA section
  (`boundingBox().y`, `exact: true`, le titre « Demain » composé avec sa date réelle via
  `libelleTitreDemain`) et celui de la suivante. **Sabotage mesuré** : une carte de demain
  datée aujourd'hui fait échouer l'épreuve (`yCarteDemain < yDemainExact`).
- **Bascule de jour Nouméa/UTC** (`tests/unit/interventions/bascule-jour-noumea.test.ts`,
  neuf) : horloge figée (`vi.setSystemTime`) sur la frontière réelle — Nouméa (UTC+11,
  sans heure d'été) bascule de jour civil à 13:00 UTC, jamais à minuit. Cinq scénarios :
  12:59:59/13:00:00/23:59:59 UTC avec `maintenant` + `jourDe` réels, puis la borne J+8 de
  `repartirJourneeTechnicien` mesurée de part et d'autre de la bascule, avec
  `jourCivilDeDatePlanifiee` réel.
- **Captures en viewport** (même spec, `fullPage: false`, jamais celles de 9F2) : dans
  `docs/propositions/9F2B-TERRAIN-JOURS-EPREUVES/captures/` — « Ma journée » remplie au
  chargement et défilée jusqu'à « Les jours suivants » (375 et 1280 px), et « Ma journée »
  vide du technicien dédié. **Vérifiées à l'œil** (voir ci-dessous) : la barre de
  navigation basse ne recouvre aucune carte, à aucune des deux largeurs.
- **D161 ↔ D210** (`docs/arbitrages.md`) : D210 restreint la portée du bandeau « compteur
  en cours » que D161 posait, sans marque dans aucun des deux sens. Les deux marques
  (`**Amendé par D210.**` dans le préambule de D161, `**Décisions amendées :** D161` dans
  celui de D210 — **avant le premier sous-titre de chacune**, limite documentée du
  parseur, §9) rejoignent le couple attendu de
  `tests/unit/docs/amendements-arbitrages.test.ts`.
- **`terrain9f2.e2e.site_sans_date`** (`lib/i18n/fr.ts`) : nouvelle clé, nécessaire à la
  ligne « Affectées, sans date » forgée pour le point 3 — un fichier qui interroge l'écran
  (`page.getByText(...)`) tombe sous le gardien L0-11 au même titre qu'un composant,
  **mesuré** (`tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` a d'abord rougi sur un
  littéral local avant cette correction).

## Ce que j'ai mesuré

- Chaque point validé par sabotage ciblé avant commit (voir ci-dessus) — jamais seulement
  « le test passe ».
- Les captures ont été regardées (outil de lecture d'image) : « remplie-haut »,
  « remplie-jours-suivants » et « vide », aux deux largeurs — aucune ne montre de carte
  recouverte par la barre basse ; à 1280 px la barre basse mobile reste affichée (chrome
  de l'application, pas un défaut de ce ticket) mais ne chevauche aucun contenu.
- Deux captures de 9F2 (`journee-remplie-{375,1280}.png`) ont été régénérées par effet de
  bord à CHAQUE exécution de la spec modifiée (la scène « remplie » a changé — nouvelle
  ligne sans date) : **restaurées** à leur état commité avant chaque commit, comme l'exige
  le gabarit — ce ticket ne republie pas les captures d'un autre.
- `pnpm format` + `pnpm typecheck` + `pnpm lint` + `pnpm test` verts avant chaque commit ;
  `pnpm test:isolation` entier vert après le point 1. La spec e2e modifiée
  (`9f2-terrain-jours-maquette`) rejouée en entier après chaque point touché (verte à
  chaque fois, 3/3).

## Ce qui reste ouvert

- La question laissée ouverte par D210 elle-même (une ligne `en_cours`/`suspendue`/
  `terminee`/`cloturee` restée datée dans le passé, invisible de toute section) n'est pas
  reprise ici — hors périmètre de ce ticket, qui porte sur les épreuves, pas sur une
  règle de gestion neuve.
- Le compte technicien dédié du point 2 (`zz9f2b-technicien-vide@codima.test`) n'a
  d'habilitation que `technicien` sur CODIMA-NC — aucune ligne `technicien` (table) n'a
  été créée pour lui : `fuseauDuTechnicien` retombe sur le fuseau de la société
  (Pacific/Noumea), identique à celui de l'agence Ducos, donc sans effet observable ici ;
  à surveiller si une future épreuve attend une agence précise pour ce compte.

## Épreuves voisines

`pnpm test:isolation` entier (181 fichiers, 1603 tests) vert. `tests/e2e/
9dd-pg-g14c-terrain-transmises`, `terrain`, `9di-tp-ter1-journee-fiche`,
`rapport-terrain`, `tous-les-ecrans-rendent` rejoués ensemble : un échec isolé
(`9di-tp-ter1-journee-fiche`, timeout sur « Démarrer l'intervention ») **mesuré non lié**
— rejoué seul juste après, 4/4 vert en 1,2 minute. Même contention sur l'état partagé du
compte technicien sous plusieurs workers en parallèle que celle déjà documentée dans
`docs/propositions/9F2-TERRAIN-JOURS-MAQUETTE/passation.md` pour `avertissements-1` ;
aucun code applicatif n'a été touché par ce lot (seules les constantes `***.e2e.*`
nouvelles et les tests), donc aucune régression possible de ce côté.

## Fin de lot

Épreuves voisines rejouées (`pnpm test:isolation` entier, `tests/unit/interventions/*`,
`tests/unit/terrain/*`, la spec `9f2-terrain-jours-maquette` en entier).

`CI=1 pnpm verify:full` a été lancé EN ENTIER (`docs/propositions/9F2B-TERRAIN-JOURS-
EPREUVES/verify-final.txt`) : son volet e2e tourne sous un seul worker (CI=1, 1439
scénarios) et n'a pas terminé en 30 minutes — coupé par le budget du lot, pas par un
échec observé. Ce qui en était sorti avant la coupure (format, typecheck, lint, les
~400 premiers scénarios e2e) ne montrait aucun rouge qui me soit imputable, hors
l'avertissement déjà connu « En retard » ne vaut pas 0 ». **`CI=1 pnpm verify`** (sans le
volet e2e complet : format + typecheck + lint + `test` + `test:isolation` + `build`) a
ensuite tourné EN ENTIER et est passé, exit 0 — mêmes 15 dernières lignes (le résumé du
build Next.js) collées ci-dessous, à la suite de `verify-final.txt`.

```
├ ƒ /sante                                             383 B         103 kB
├ ƒ /sites                                             214 B         106 kB
├ ƒ /sites/[id]                                        853 B         118 kB
├ ƒ /sites/nouveau                                   3.74 kB         118 kB
├ ƒ /tableau-de-bord                                   465 B         106 kB
├ ƒ /terrain                                           214 B         106 kB
├ ƒ /terrain/[id]                                    4.51 kB         165 kB
├ ƒ /terrain/profil                                    383 B         103 kB
├ ƒ /vgp                                             1.17 kB         164 kB
├ ƒ /vgp/a-determiner                                  853 B         118 kB
└ ƒ /vgp/enregistrer/[id]                              214 B         106 kB
+ First Load JS shared by all                         102 kB
  ├ chunks/0c86f1d0-e396209ab64996d1.js              54.2 kB
  ├ chunks/8817-050d255d41a76bbe.js                    46 kB
  └ other shared chunks (total)                      1.93 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

`HEAD` au moment de ce `verify` : `9b983fcc` (avant le commit de cette passation).

**Point ouvert pour la prochaine session** : `verify:full` complet (volet e2e sous un
seul worker) reste à rejouer et coller en entier — ce lot ne l'a pas pu dans son budget.
