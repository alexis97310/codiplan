# 99H-CHRONOLOGIE — sur une fiche reprise, la chronologie ne dit plus « Créée » après « Clôturée »

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`chronologieDeLaFiche` (`app/(back-office)/interventions/presentation.ts`)
triait déjà les évènements du plus ancien au plus récent — l'ordre affiché
était juste. Le défaut constaté par l'audit du 25/09 (constat 22) était le
**mot** : l'évènement de création vient de `creeLe`, l'instant
d'enregistrement de la ligne en base, et portait toujours la clé
`intervention.chronologie.creation` (« Créée »). Sur une fiche reprise d'un
import, un fait daté (une clôture, une suspension...) peut précéder `creeLe` :
« Créée » vient alors AFTER un fait qui lui est pourtant antérieur, ce qui
laisse croire à une chronologie incohérente alors que le tri est correct.

La fonction calcule désormais si au moins un des autres évènements (pause,
clôture, annulation) a un instant strictement antérieur à `creeLe`. Si oui,
l'évènement de création prend la clé neuve
`intervention.chronologie.enregistrement` (« Enregistrée dans CODIPLAN ») au
lieu de `intervention.chronologie.creation` (« Créée »). Sinon, rien ne
change. Le tri et tous les autres évènements restent inchangés.

**Pour l'exploitation** : sur une fiche reprise d'un import dont un fait est
antérieur à la date d'enregistrement en base, la chronologie affichera
« Enregistrée dans CODIPLAN » à la place de « Créée », à sa place triée (donc
en général en dernier, après les faits qui la précèdent). Sur toute fiche
normale (immense majorité des cas), rien ne change — c'est toujours « Créée »
en tête.

Conformément à la décision déjà écrite (`lib/i18n/fr.ts` l.~1264,
FICHE-INTERVENTION-1), je n'ai ajouté aucune info-bulle sur le numéro
provisoire : ce mécanisme est documenté une fois au chapitre 10, pas répété
sur chaque fiche. Je n'ai pas non plus ajouté de marqueur « Importée » :
`Intervention` (prisma/schema.prisma) n'a aucune colonne pour ça, et ce
ticket n'en ajoute pas.

## Ce que j'ai tranché et pourquoi

- **Détection par comparaison d'instants, jamais par une colonne dédiée.** Le
  ticket interdit toute migration ; la seule information disponible pour
  distinguer une fiche reprise est déjà celle que la fonction manipule (les
  instants des faits). Comparer `creeLe` aux autres instants suffit et ne
  demande rien de plus.
- **Une seule clé neuve, pas de reformulation des clés existantes.** Les cinq
  autres évènements (`suspension`, `reprise`, `cloture`, `annulation`)
  restent inchangés : le défaut ne les concerne pas, l'audit ne vise que le
  mot « Créée ».

## Ce que j'ai testé

Deux cas ajoutés à `tests/unit/interventions/pauses.test.ts` (fonction pure,
aucune donnée forgée en base) :

- cas normal (aucun fait antérieur à `creeLe`) → la clé reste
  `intervention.chronologie.creation` ;
- fiche reprise d'un import (une clôture antérieure à `creeLe`, scénario du
  constat 22) → la clé devient `intervention.chronologie.enregistrement`, et
  l'évènement reste bien DERNIER dans la liste triée.

Les épreuves préexistantes de ce même fichier (tri, pauses successives, ordre
désordonné) n'ont pas été retouchées — elles restent vertes sans changement.
L'une d'elles (« un ordre de saisie désordonné... ») forge déjà un scénario où
une pause précède `creeLe`, mais elle ne vérifie que la position en tête de
l'évènement de suspension, jamais la clé de l'évènement de création
lui-même : aucun conflit avec ce changement.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix.
- Aucune modification de `app/(back-office)/interventions/[id]/page.tsx` ni
  d'aucun autre écran : seule la fonction pure change.
- Aucune info-bulle sur le numéro provisoire (décision déjà écrite,
  FICHE-INTERVENTION-1).
- Aucun marqueur d'import en base.
- Aucun `skip`/`fixme`, aucun `retries`, aucun `workers: 1`.
- Je n'ai touché ni `depot/` ni `11-FILE.sh`.

## `pnpm test` puis `CI=1 pnpm verify:full`

- `pnpm test` : **267 fichiers, 2872 tests, tous passés**, zéro échec.
- `CI=1 pnpm verify:full`, en un seul appel, au premier plan — chaîne
  complète liée par `&&` : chaque bannière d'étape suivante
  (`feries:horizon`, `audit:partitions`, `test:e2e`) ne s'est affichée
  qu'après la réussite de la précédente, ce qui atteste que `format:check`,
  `typecheck`, `lint`, `test`, `test:isolation` et `build` sont tous sortis
  en succès avant que `feries:horizon` ne démarre :
  - `feries:horizon` : 2 territoires contrôlés (XA, ZZ), horizon ≥ 12 mois
    partout — vert.
  - `audit:partitions` : 13 partitions couvertes jusqu'à 2027-09, partition
    par défaut présente et vide — préventif vert, détectif vert.
  - `test:e2e` : **294 épreuves passées, 3 ignorées, zéro échec** (1 worker).

## Les pièges pour la session suivante

- Comme documenté par plusieurs passations précédentes (`97A-FICHE-ACTIONS-REPRISE-2`,
  `92-CREATION-2`...), `pnpm verify:full` réécrit au passage une soixantaine
  de captures PNG/PDF sous `docs/propositions/*/captures/` (recapture des
  scènes AVANT/APRÈS d'autres tickets, sans rapport avec celui-ci) — je les ai
  laissées telles quelles dans l'arbre (`git checkout --` dessus) plutôt que
  de les commiter, ce lot n'en touchant aucune.

## Ce qui reste à faire

Rien d'identifié dans le périmètre de ce ticket. Les autres propositions de
l'audit du 25/09 (trier par date — déjà fait ; marquer les évènements
importés — hors périmètre, faute de colonne) restent hors de ce lot.
