# 9L00-FIXTURE-EXCEL-SANS-VALEURS-REELLES — passation

Décision d'Alexis du 10/11/2026 : `tests/fixtures/dates-excel.xlsx` était *« tirée PAR RETRAIT »*
du classeur réel de l'exploitation (D90) — le retrait gardait toute cellule NUMÉRIQUE portant un
format de date, et retirait le reste (textes, montants, en-têtes). Mesuré : le fichier qui en
résultait portait encore environ 4 390 dates réelles et les volumes du classeur réel (l'onglet du
parc à 293 lignes sur 22 colonnes), alors que `docs/backlog.md` affirmait « aucune cellule » — faux.
I9 ne distingue pas la donnée métier de la donnée de structure, et le dépôt est PUBLIC.

## CONTRADICTION SIGNALÉE EN COURS DE ROUTE, ET SA RÉSOLUTION — D244

`scripts/lib/archive-zip.ts` documentait une seconde vertu de cette fixture, distincte d'I9 :
**être un fichier qu'Excel a réellement produit**, témoin indépendant de `lireArchiveStricte`
(sans lui, un défaut partagé entre ce lecteur et son propre fabricant ne se verrait jamais —
*deux erreurs identiques ne se contredisent jamais*, §9, 10/09). Cette propriété est documentée au
même rang que I9 (README.md, `docs/constitution/erreurs-a-ne-pas-refaire.md`,
`docs/constitution/stack.md`). Remplacer la fixture par un fichier CALCULÉ — ce que ce ticket
demandait explicitement (« jamais une valeur lue d'un fichier réel ») — fait nécessairement perdre
ce témoin : je n'ai ni Excel ni réseau dans cette session pour produire un nouveau fichier
authentique sans donnée réelle.

La contradiction est signalée ici plutôt que résolue en silence (CLAUDE.md, en-tête ; le ticket
lui-même posait « ARRÊT IMMÉDIAT SI : Aucune », donc j'ai continué plutôt que de bloquer). **D244**
(`docs/arbitrages.md`) tranche dans le sens d'I9 : la fixture est calculée, et
`tests/unit/imports/classeur-fabrique.test.ts` ne lui demande plus de servir de témoin — le test
qui le lui demandait est RETIRÉ (pas assoupli), avec son motif écrit en toutes lettres dans D244 et
dans le fichier de test. **Ce que ça laisse ouvert, pour Alexis** : aucun fichier de ce dépôt
n'atteste plus aujourd'hui que `lireArchiveStricte` ouvre un vrai classeur Excel sans partager ses
erreurs. La condition de réouverture de D244 : le jour où un nouveau fichier, neuf et sans donnée
réelle, est produit par un vrai Excel, il reprend ce rôle.

## Ce que le lot fait

1. **`scripts/lib/fixture-dates.ts`** (créé) porte les valeurs inventées une seule fois — six dates
   synthétiques sur trois des cinq feuilles (deux autres totalement vides), couvrant les mêmes cas
   que l'ancienne mesure sans en reprendre une seule valeur : une date ancienne, un serial porté par
   deux feuilles à la fois (comme un événement du parc répété à l'historique), une date récente, et
   une cellule à ZÉRO (l'absence, D31).
2. **`scripts/fabriquer-fixture-dates-excel.mts`** (créé) fabrique `tests/fixtures/dates-excel.xlsx`
   à partir de ces valeurs — archive ZIP écrite à la main (répertoire central et en-têtes locaux
   ACCORDÉS, même disposition que `scripts/fabriquer-classeur-epreuve.mts`, qui évite le défaut du
   14/09/2026), aucune date d'horodatage écrite, fichier identique d'une exécution à l'autre.
   Aucun `docProps/app.xml` n'est écrit : la fixture n'affirme plus venir d'Excel.
3. **Les trois fichiers de test qui lisaient l'ancienne fixture sont réécrits** sur les valeurs
   synthétiques :
   - `tests/unit/excel/fixture-dates.test.ts` — le relevé de cellules et la cellule zéro viennent
     désormais de `scripts/lib/fixture-dates.ts` ; gagne une épreuve de confrontation (le fichier du
     dépôt est EXACTEMENT ce que le script produit, même motif que `classeur-fabrique.test.ts`) ;
     les deux assertions qui vérifiaient `<Application>Microsoft Excel</Application>` et
     `<AppVersion>16.0300</AppVersion>` sont retirées (ce ne serait plus vrai) et remplacées par
     l'assertion inverse : `docProps/app.xml` n'existe pas.
   - `tests/unit/excel/classeur.test.ts` — la cellule relevée passe de « R254 → 2022-02-21 » (réel)
     à « C3 → 2019-03-10 » (synthétique).
   - `tests/unit/imports/classeur-fabrique.test.ts` — le test « TÉMOIN — le lecteur ouvre le VRAI
     fichier d'Excel » et la constante `AUTHENTIQUE` sont retirés (voir la contradiction ci-dessus).
4. **`docs/backlog.md` (L1-10)** — la phrase fausse (« aucune cellule », « 0 ligne portant au moins
   une cellule sur 293 ») est corrigée pour dire ce qui est mesuré et ce que D244 a tranché ;
   empreinte de relecture mise à jour (`089b5afb`).
5. **`lib/imports/televersement.ts`** et **`docs/constitution/organisation-du-code.md`** — le
   commentaire qui adossait `MAXIMUM_OCTETS` à « 59 642 octets, le classeur réel de CODIMA » est
   corrigé : cette mesure reste la seule que ce projet ait jamais faite sur un fichier réel, mais la
   fixture qui la portait a changé de nature — le commentaire le dit désormais. La valeur de
   `MAXIMUM_OCTETS` (20 Mio) ne change pas ; `tests/unit/imports/televersement.test.ts` la mesure
   dynamiquement contre le fichier courant (`reel = readFileSync(FIXTURE).length`), jamais contre un
   nombre écrit en dur, donc aucun changement n'y était nécessaire.
6. **`scripts/lib/archive-zip.ts`** — le commentaire qui présentait `dates-excel.xlsx` comme le
   témoin crédibilisant le lecteur strict est corrigé au passé, avec un renvoi vers D244.
7. **`docs/arbitrages.md`** — **D244** (nouveau), qui amende D90 sur le seul point de la provenance
   de cette fixture.

## Ce que ça ne touche pas

Aucune migration. Aucun écran (aucune capture). `tests/fixtures/clients-fabrique.xlsx` ne change
pas — il était déjà calculé. L'HISTORIQUE git garde l'ancienne version de la fixture et de
`docs/backlog.md` ; purger l'historique reste une décision d'Alexis, non prise ici.

## Vérifié avant de rendre la main

`pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (521 fichiers, 5753 tests),
`pnpm test:isolation` (240 fichiers, 2163 tests) et `pnpm build` passent tous. `verify:full` est
laissé à la file de nuit, comme demandé.

Portée : `scripts/fabriquer-fixture-dates-excel.mts` (créé), `scripts/lib/fixture-dates.ts` (créé),
`scripts/lib/archive-zip.ts`, `lib/imports/televersement.ts`,
`docs/constitution/organisation-du-code.md`, `docs/backlog.md`, `docs/arbitrages.md` (D244),
`tests/unit/excel/fixture-dates.test.ts`, `tests/unit/excel/classeur.test.ts`,
`tests/unit/imports/classeur-fabrique.test.ts`, `tests/fixtures/dates-excel.xlsx`.
