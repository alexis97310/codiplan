# 9K17A-MATERIEL-SOUS-TYPE — passation

## La migration

`prisma/migrations/20261110130000_sous_type_materiel_9k17a` — UNE migration,
neuve. **MIGRATION À JOUER par Alexis : staging puis `pnpm db:deploy`, et
seed de démonstration (`pnpm db:seed`) si la base le porte**, puis Vercel.

Une table nouvelle, `sous_type_materiel` (société, famille — FK composite
NOT NULL —, code, libellé, actif), forme RLS **« ascendance »** (D93) comme
`famille_materiel`/`modele_materiel` : un compte portail ne la voit que si
l'un de ses modèles porte une machine visible dans son périmètre.

Deux colonnes facultatives nouvelles :

- `modele_materiel.sous_type_id` — chaînage composite à **trois** colonnes
  `(societe_id, famille_id, sous_type_id)` vers `sous_type_materiel(societe_id,
  famille_id, id)`. C'est la clé, et rien d'autre, qui refuse qu'un modèle
  désigne un sous-type d'une autre famille — même dans la même société.
  `MATCH SIMPLE` (le défaut PostgreSQL) laisse `sous_type_id` `NULL` sans
  exiger les deux autres colonnes, ce qui rend le rattachement facultatif
  malgré une clé à trois colonnes.
- `checklist_modele.sous_type_id` — chaînage simple `(societe_id,
  sous_type_id)`. Avec elle, une contrainte CHECK
  (`checklist_modele_un_seul_rattachement`) : **au plus un niveau parmi
  modèle / sous-type / famille**, posée VALIDÉE (9K08 n'a livré que le
  socle de cette table le 09/11 ; aucune ligne n'existait pour la violer,
  mesuré).

**Ordre à l'intérieur du fichier SQL, et il compte** : la colonne
`modele_materiel.sous_type_id` est posée EN PREMIER, sans sa clé étrangère ;
`sous_type_materiel` est créée ensuite, sa politique « ascendance » lisant
cette colonne dans son `EXISTS` — PostgreSQL valide une politique à sa
création, et la colonne doit donc déjà exister. La clé étrangère à trois
colonnes sur `modele_materiel` est posée en dernier, une fois la cible prête.

**Le verrou d'écriture du portail (D237, 9K16) est recopié ici, pas dans la
migration de 9K16** : `sous_type_materiel` n'existait pas le 10/11/2026 à
06:45 quand 9K16 a posé son tableau de tables à fermer en écriture pour un
compte portail — une migration déjà appliquée ne se modifie jamais. Trois
`CREATE POLICY` (`verrou_ecriture_portail_insertion/modification/
suppression`), recopiées verbatim, ferment donc ici ce que `tablesVerrouEcriturePortail`
(dérivé de la première catégorie de I1) attendait déjà de cette table neuve.

## Le semis de démonstration

Six sous-types, sous les familles `PONT-ELEV` et `COMPRESSEUR` du semis :
pont 2 colonnes électromécanique, pont 2 colonnes électro-hydraulique, pont 4
colonnes, pont ciseaux ; compresseur à pistons, compresseur à vis.

**Aucun modèle de démonstration n'y est rattaché.** Classer les 71 modèles
de ponts et les 8 modèles de compresseurs de CODIMA dans leur sous-type —
depuis l'écran Paramètres › Matériel (onglet Modèles, champ « Sous-type »)
ou par un ré-import du fichier des modèles avec la colonne « Sous-type
(code) » remplie — est **un geste d'Alexis**, pas une donnée que ce ticket
invente.

## Le dépôt et les routes (`lib/materiel/`, `app/api/parametres/materiel/sous-types/`)

`listerLesSousTypes`, `creerSousType`, `modifierSousType`,
`basculerActiviteSousType` — aucune variante `Dans`/`EnLot` extraite, à la
différence des familles et des modèles : le ticket REFUSE qu'un sous-type
naisse par import, donc il n'y a qu'un seul appelant à chacune. Trois
routes, capacité `parametrer_societe` COMPLÈTE (même porte que
familles/modèles).

## L'écran — Paramètres › Matériel, troisième onglet

« Sous-types », même patron que « Modèles » : liste filtrable par famille,
volet de création/modification, aucune suppression. Sur la fiche d'un
modèle, un `<select>` « Sous-type » facultatif.

**LIMITE CONNUE, documentée en tête de `page.tsx`** : ce `<select>` est
limité aux sous-types actifs de la famille PAR DÉFAUT du formulaire (celle
de `valeurs.famille_id` en modification, la première famille en création) —
changer la famille dans le `<select>` voisin sans recharger la page ne met
pas à jour cette liste, ce formulaire n'ayant aucune interactivité côté
client (aucun autre champ de ce volet n'en a). La base refuse par la clé un
choix devenu incohérent (`sous_type_hors_famille`), donc aucune donnée
fausse ne peut s'écrire — seul le confort de l'édition est borné. Un lot
futur qui voudrait filtrer dynamiquement devra faire de ce formulaire un
composant client, comme `lib/materiel/saisie.ts` ne le demande pas
aujourd'hui.

## L'import des modèles (`lib/imports/modeles.ts`, `lib/imports/parc-sous-types.ts`)

Colonne facultative « Sous-type (code) », ajoutée **EN DERNIÈRE position**
du gabarit — jamais entre deux colonnes existantes : une feuille déjà en
circulation, ou un scénario qui n'écrit que quelques cellules en tête de
ligne, continue de se lire à l'identique. *Mesuré en écrivant la migration* :
une première rédaction l'insérait juste après « Famille (code) », et trois
scénarios d'isolation existants (`parc-clients-indexe.test.ts`) se sont mis
à rejeter des lignes saines — la cellule « Marque » se lisait comme un code
de sous-type, décalée d'une colonne.

Un code inconnu, inactif, ou d'une AUTRE FAMILLE que celle de la ligne est
REJETÉ (I6 : un rapport avant d'appliquer), jamais résolu vers le mauvais
sous-type ni créé par l'import. « Inconnu » et « autre famille » rendent le
MÊME motif (`sous_type_introuvable`) — l'index est scopé par famille
(`parc-sous-types.ts::cleSousType`), donc les deux cas sont structurellement
indiscernables, même raisonnement D35/D50 que le reste de ce module pour la
famille elle-même.

## La cascade de résolution — PAS CODÉE ICI (9K18)

Décision d'Alexis du 10/11/2026 (`claude/decisions-alexis-10-11.md`, décision
14, hors dépôt) : l'ordre de choix du gabarit d'une intervention devient
**nature d'intervention, puis MODÈLE exact (l'exception), puis SOUS-TYPE (la
règle), puis FAMILLE, puis générique**. Ce ticket pose seulement le modèle de
données et la contrainte d'exclusivité qui le rend applicable ; 9K18 écrira
la cascade elle-même.

## Épreuves

- `tests/unit/materiel/sous-type-saisie.test.ts` — `schemaSousTypeMateriel`,
  `sous_type_id` facultatif sur `schemaModeleMateriel`, et les cinq cas de la
  colonne d'import (vide, valide, inconnu, inactif, autre famille), sur des
  parcs FABRIQUÉS — aucune base requise.
- `tests/isolation/sous-type-materiel.test.ts` — cloisonnement de base
  (société B ne lit ni n'écrit) ; le chaînage à trois colonnes refusant un
  sous-type d'une autre famille (même société ou pas) ; l'exclusivité CHECK
  sur `checklist_modele` ; la forme ascendance, avec son JUMEAU qui dégrade
  réellement la politique en clause de société seule.
- `tests/e2e/9k17a-materiel-sous-type.spec.ts` — l'onglet existe ; créer un
  sous-type puis le modifier depuis le volet ; un modèle le choisit, relu en
  base sur sa fiche ; captures à 1280 et 375 px. Scène dédiée (préfixe
  `9K17A-`), nettoyée en `afterAll`.
- Trois scénarios d'isolation existants réparés par la même occasion
  (`parc-clients-indexe.test.ts`, voir plus haut).

## Gardiens mis à jour à leur source

- `lib/db/migrations-attendues.ts` — la migration neuve.
- `scripts/lib/politiques-rls.ts` — `TABLES_ASCENDANCE`, `ASCENDANCE_ARBITREE`
  (troisième entrée).
- `scripts/lib/resserrements-migration.ts` — `TABLES_VIDES_AU_RESSERREMENT`
  gagne `(20261110130000_sous_type_materiel_9k17a, checklist_modele)`, avec sa
  mesure : créée la veille, aucun chemin n'y écrit encore.
- `docs/cahier-des-charges.md` — chapitre 10 (narratif « Familles et modèles
  de matériel », trois niveaux) et chapitre 11.2 (`sous_type_materiel`,
  `modele_materiel.sous_type_id`, `checklist_modele` amendé).
- `docs/arbitrages.md` — D238.
- Listes closes : `tests/unit/db/formes-du-lot-8.test.ts` (douzième forme,
  trois tables désormais) ; `tests/unit/db/perimetre-audit.test.ts`
  (quarante-huit tables auditées) ; `tests/unit/db/inventaire.test.ts` (une
  clé de décompte à zéro) ; `tests/unit/auth/porte.test.ts` (trois routes,
  107 au total) ; `tests/unit/docs/modele-de-donnees.test.ts` et
  `tests/unit/docs/citations-decisions-code.test.ts` (D238 résolue).
- `tests/isolation/politiques-rls.test.ts` et `tests/isolation/
  portail-matrice.test.ts` — la table neuve porte le verrou d'écriture
  portail et sa classification de lecture (« client », comme les deux autres
  tables d'ascendance).

## Ce qui reste dû (lots suivants, hors territoire ici)

9K18 (la cascade de résolution modèle > sous-type > famille > type seul >
générique, codée) ; 9K19 (les écrans qui en dépendent). Le classement des
modèles réels dans leur sous-type, par Alexis.

**AVANT/APRÈS non produit pour cet écran** (consigne permanente d'Alexis) :
seules les captures APRÈS existent
(`docs/propositions/9K17A-MATERIEL-SOUS-TYPE/captures/`). Produire l'AVANT
exige de faire tourner l'écran PRÉ-ticket (`origin/main`, commit `d6605a45e`)
contre un serveur distinct, sans rejouer son semis sur la même base de test
que ce ticket utilise — mesuré trop coûteux dans le budget de ce lot. Un lot
futur qui y reviendrait peut partir d'un `git worktree` détaché sur
`d6605a45e`, servi sur un port distinct (`PORT=3101`), SANS passer par
`playwright test` (qui rejoue le semis pré-ticket sur la base partagée) —
une connexion manuelle suffit, la base déjà migrée vers l'avant restant
lisible par le code d'avant.

## Vérification

`CI=1 pnpm verify` vert (format, typecheck, lint, test, test:isolation,
build). `pnpm test` : 5608 passés. `pnpm test:isolation` : 2103 passés.
`pnpm exec playwright test tests/e2e/9k17a-materiel-sous-type.spec.ts` : 4
passés. `verify:full` est laissé à la file de nuit.

### Reprise 9K17B

9K16 (publié `d6605a45e`) a ajouté des politiques `AS RESTRICTIVE`
(`verrou_*`) sur `intervention_machine`, les quatre tables `checklist_*`,
`suite_a_donner` et `document_recu`, entre autres. L'épreuve d'isolation
`tests/isolation/intervention-machines.test.ts:142` ("PREUVE que la
politique fille ne recopie RIEN") lisait `pg_policies` sans filtrer le nom
de la politique et prenait la première ligne rendue — l'ordre n'étant pas
garanti, elle pouvait tomber au hasard sur une politique `verrou_*` (qual
`NULL` pour un `INSERT`) plutôt que sur `cloisonnement_filiation`. Corrigée
pour nommer la politique visée (`policyname = 'cloisonnement_filiation'`) :
même sens, même assertion, rendue déterministe. `pnpm test:isolation`
rejoué trois fois de suite : vert les trois fois. `9K17A-MATERIEL-SOUS-
TYPE-garde` n'existe pas encore (sa vérification tourne toujours) : son
report par cherry-pick reste dû à une session suivante — seul
`9K17-CAPTURES-9K11-garde` a été reporté dans cette reprise. La migration
de 9K17A reste **À JOUER par Alexis**, inchangée par cette reprise.
