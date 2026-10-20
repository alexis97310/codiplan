# 9F4H6A-COQUILLE-ANCIENNE-COPIE — passation

`git rev-parse --short HEAD` au moment de cette passation : `bac96d0c`
(2 commits, un par point, voir `git log --oneline -2` ; point 3 ci-dessous
ajoute un troisième commit après cette passation).

## Point 1 — la copie ancienne (avant 9F4H6) ne plante plus la coquille hors réseau

**Avant** : `components/terrain/consultation-hors-reseau.tsx:436`
(avant ce lot), `catalogue.map((p) => ...)` — `catalogue` venait directement
de `copie.catalogue` (`:85` avant ce lot), un simple cast
`as unknown as InstantaneJSON` sur l'objet IndexedDB (voir le docblock de
`lireCopie`, `lib/terrain/copie-locale.ts:58`). Une copie écrite par un appareil AVANT
9F4H6 (mesurée sur `8b4512d1`) ne porte pas ce champ : `undefined.map(...)`
levait une `TypeError` au rendu de la fiche — le mode hors réseau cessait de
fonctionner pour ce téléphone précis, tant qu'il ne repasse pas en ligne.

**Après** : nouveau `lib/terrain/copie-validee.ts` —
`catalogueDeLaCopie(copie)` rend `{ catalogue: [], indisponible: true }` si
`copie.catalogue` n'est pas un tableau ; `prestationsRealiseesDeLaFiche(fiche)`
fait de même pour `fiche.prestationsRealiseesIds`, avec un second signal
(`indisponibles`) qui empêche un ensemble vide de se faire passer pour « rien
n'a été fait ». `consultation-hors-reseau.tsx` les appelle avant de
construire les props de `RapportTerrainAutomatique` : catalogue absent → `[]`
+ le message déjà existant `terrain.prestations.
catalogue_indisponible_hors_reseau` (jamais `terrain.prestations.aucune`) ;
`prestationsRealiseesIds` absent → prestations non cochables pour CETTE
fiche (`prestations=[]`), plutôt qu'un ensemble vide qui aurait pu effacer un
travail déjà fait au prochain « Terminer ». Le reste de la fiche (compteur,
rapport, photos, signature, Terminer) continue de fonctionner normalement.

Unitaire : `tests/unit/terrain/copie-validee.test.ts` (les deux fonctions
pures) ; `tests/unit/terrain/fiche-hors-reseau-travail.test.tsx` (nouveau
describe « une copie ÉCRITE AVANT 9F4H6 » — construit une copie dégradée à
la main, aucune erreur au rendu, message « indisponible », pas de case à
cocher).

e2e : `tests/e2e/offline/9f4h6a-copie-ancienne.spec.ts` (nouveau) — pose une
copie VALIDE par un passage en ligne normal, la DÉGRADE elle-même dans
IndexedDB à la forme d'avant 9F4H6, coupe le réseau, ouvre la fiche : pas
d'erreur, compteur démarrable, rapport saisissable, message « indisponible »
(jamais « catalogue vide », alors qu'une vraie prestation existe côté
société — c'est justement ce qui distingue les deux messages).

## Point 2 — les prestations rejouées depuis la file portent une différence, jamais l'ensemble

**Avant** : `components/terrain/rapport-automatique.tsx` (`envoyerPrestations`,
~:570 avant ce lot) mettait en file
`{ type: "prestations", prestationIds: [...voulues] }`
— l'ENSEMBLE entier voulu par CET appareil (son instantané + ses propres
cases). Au rejeu (`lib/terrain/envoi-file.ts:64`), le serveur
(`definirPrestationsRealisees`, `lib/interventions/depot-rapport-terrain.ts:185`
avant ce lot) REMPLACE l'ensemble (`deleteMany notIn voulues`) : toute prestation ajoutée
PENDANT la coupure par quelqu'un d'autre (un collègue en ligne, un autre
appareil de la même personne) n'apparaissait dans aucun ensemble local, et
disparaissait au rejeu.

**Après** :
- `lib/terrain/file-saisies.ts` — `GestePrestations` porte désormais
  `ajouterIds`/`retirerIds` (une DIFFÉRENCE) au lieu de `prestationIds` (un
  ENSEMBLE) ; nouvelle `differencePrestations(baseConnue, voulues)`, fonction
  pure, calcule cette différence.
- `components/terrain/rapport-automatique.tsx:581` — la mise en file calcule
  la différence contre `dernierePrestationsEnvoyeesRef.current` (la dernière
  base RÉELLEMENT connue de cet appareil), jamais contre l'ensemble courant.
- `lib/terrain/envoi-file.ts:64` — le rejeu envoie `ajouter_id`/`retirer_id`
  sous `depuis_file=1`, même idiome que `compteur`/`terminer`.
- `lib/interventions/depot-rapport-terrain.ts` — nouvelle
  `definirPrestationsRealiseesDepuisFile(contexte, id, ajouterIds, retirerIds)`
  : AJOUTE (sans doublon) et RETIRE seulement ce qui est demandé, sans
  jamais toucher au reste. `definirPrestationsRealisees` (ensemble entier)
  est INCHANGÉE — c'est toujours elle qui sert l'envoi EN LIGNE direct.
- `app/api/terrain/[id]/prestations/route.ts` — bascule sur
  `depuis_file` pour choisir la fonction à appeler.
- `docs/arbitrages.md`, D216 — nouvelle précision : le risque que la
  précision du 20/10/2026 (9F4H6, point 3) croyait refermé ne l'était que
  pour l'appareil qui rejoue, jamais pour ce qu'un AUTRE a ajouté entre-temps.

Unitaire : `tests/unit/terrain/file-saisies.test.ts` (`differencePrestations`,
quatre cas) ; `tests/unit/terrain/rapport-automatique.test.tsx` (nouveau
describe — une prestation de la base connue, absente du catalogue affiché,
n'apparaît ni en ajout ni en retrait du geste gardé).

Isolation (base réelle) : `tests/isolation/rapport-terrain.test.ts` (nouveau
describe) — A fait à l'instantané ; un collègue ajoute B EN LIGNE pendant la
coupure ; la coquille (qui ne connaît que A) coche C puis rejoue → A, B et C
présentes ; la coquille décoche A puis rejoue → seule A retirée, B et C
intacts ; rejeu du MÊME envoi → rien de doublé, rien de plus retiré (2
lignes exactement en base à la fin).

## Point 3 — captures

2 fichiers dans
`docs/propositions/9F4H6A-COQUILLE-ANCIENNE-COPIE/captures/` (375 et
1280 px, viewport, commités), produits par
`tests/e2e/offline/9f4h6a-copie-ancienne.spec.ts` :

```
fiche-copie-ancienne-375.png / -1280.png
```

La fiche de la coquille, ouverte hors réseau avec une copie dégradée à la
forme d'avant 9F4H6 : compteur et rapport normalement affichés, message
« La liste des prestations n'a pas pu être emportée sur ce téléphone »
(jamais « Le catalogue est vide »).

## `CI=1 pnpm verify:full` — vert jusqu'à `test:e2e`, qui n'a pas pu finir dans le temps imparti

Rejoué en UN appel, au premier plan, sortie entière dans `verify-final.txt` :
`format:check`, `typecheck`, `lint`, `test` (4971 passés), `test:isolation`
(1642 passés), `build`, `feries:horizon`, `audit:partitions` sont tous
VERTS. `test:e2e` (la suite Playwright COMPLÈTE, pas seulement
`tests/e2e/offline/`) a démarré sa propre migration/seed puis sa suite,
mais n'a pas terminé avant la limite d'une heure du même appel — même
limite déjà posée en passation par 9F4H6-FINITIONS-HORS-RESEAU
(`9c29317a`, « verify vert, limite assumée sur test:e2e complet »), pas une
régression de ce lot. Mesuré séparément, sous `CI=1` (même condition
d'exécution que `verify:full`) : `tests/e2e/offline/*` — 17/17 passés,
`9f4h6a-copie-ancienne.spec.ts` compris. `pnpm test:isolation` et
`pnpm test` ont aussi été rejoués seuls avec succès avant cette tentative
(voir points 1 à 3 ci-dessus).

## Points ouverts

- La collision de libellé « Filtre à air » (`fr["terrain.e2e.
  prestation_libelle"]`) entre plusieurs scènes e2e qui partagent la même
  société (`9f4h3-mode-avion`, `9f4h4-ouverture-a-froid`,
  `9f4h6-terminer-coquille-sans-session`, et désormais
  `9f4h6a-copie-ancienne`) fait échouer `getByRole("checkbox", ...)` en
  « strict mode violation » quand ces fichiers tournent en PARALLÈLE
  (`npx playwright test tests/e2e/offline/` sans `CI=1`, workers par
  défaut). Mesuré : AUCUN échec sous `CI=1` (workers: 1, voir
  `playwright.config.ts:79`) — c'est ainsi que `pnpm verify:full` tourne
  réellement. Risque PRÉEXISTANT (3 fichiers se chevauchaient déjà avant ce
  lot), pas introduit par ce lot, mais ce lot ajoute un 4e fichier au même
  risque. Hors territoire de ce lot (toucher la scène des trois autres
  fichiers n'est pas dans son périmètre) — à signaler si une exécution
  parallèle de `tests/e2e/offline/` devient un jour un chemin réel.
