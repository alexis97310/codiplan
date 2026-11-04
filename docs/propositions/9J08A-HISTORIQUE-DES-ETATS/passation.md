# 9J08A-HISTORIQUE-DES-ETATS — passation

## La migration à jouer, nommément

```
20261104100000_historique_des_etats_9j08a
```

Écrite à la main (gabarit `intervention_pause` — déclencheur, politique RLS
« filiation », GRANT limité, journal d'audit), appliquée par `prisma migrate
deploy` sur `codiplan_test` (port 5441) pour les épreuves, et rejouée par
Playwright pour les captures. Alexis la joue en production et sur le site de
test par le chemin habituel (`pnpm db:deploy`). **Aucune reprise du passé** :
après la migration, les interventions et demandes déjà en base n'ont un
historique qu'à partir de leur premier changement de statut postérieur.

## 1. Mesure (demandée en tête du ticket)

- Déclencheurs existants, convention : `journal_audit_tracer()`
  (`prisma/migrations/20260829120000_journal_audit/migration.sql:235`) n'est
  **jamais** `SECURITY DEFINER` (D50, liste close et vide ailleurs) et fixe
  `SET search_path = pg_catalog, public` en clause de fonction. Les deux
  nouveaux déclencheurs (`intervention_statut_historique_tracer`,
  `demande_statut_historique_tracer`) suivent exactement ce gabarit.
- Forme « filiation » existante la plus proche : `intervention_pause`
  (`prisma/migrations/20260924180000_interventions_2/migration.sql:141-178`) —
  deux politiques (`SELECT`, `INSERT`), aucune `UPDATE`/`DELETE`, clause
  `EXISTS (SELECT 1 FROM "intervention" "i" WHERE "i"."id" =
  "<fille>"."intervention_id")`. Recopiée à l'identique pour les deux
  nouvelles tables (vers `intervention` et vers `demande` respectivement) —
  aucune 14e forme créée.
- Écriture du statut aujourd'hui : **exclusivement** par
  `prisma.intervention.update({ data: { statut: ... } })` /
  `prisma.demande.update(...)`, centralisés dans `lib/interventions/depot.ts`,
  `depot-rapport-terrain.ts`, `depot-compteur.ts`, `depot-reprise.ts` et
  `lib/demandes/depot.ts`. Aucun `$executeRaw`/`$queryRaw`/`upsert` sur
  `statut` nulle part dans `lib/`, `app/` ni `scripts/` — un `UPDATE` SQL
  classique, donc entièrement intercepté par `AFTER UPDATE OF "statut"`.
- **Le journal d'audit n'est jamais la source** de l'écran : sa politique de
  lecture n'ouvre qu'à `admin_societe` et `direction`
  (`app_peut_consulter_journal_audit`), ce que `chronologieDeLaFiche`
  documentait déjà pour la même raison.

## 2. La migration — deux tables

`intervention_statut_historique` et `demande_statut_historique` : `id`,
`societe_id`, `intervention_id`/`demande_id`, `statut_avant` (nullable, NULL
seulement à la création), `statut_apres`, `change_le` (`timestamptz(3)`,
défaut `now()`). Clé composite `(societe_id, intervention_id)` /
`(societe_id, demande_id)` vers le parent, `ON DELETE CASCADE`.

- Déclencheur `AFTER INSERT OR UPDATE OF "statut"` sur `intervention`/
  `demande` : une ligne à l'INSERT (`statut_avant` NULL), une ligne à chaque
  UPDATE où `NEW.statut IS DISTINCT FROM OLD.statut` — gardé explicitement,
  parce que PostgreSQL déclenche un trigger `UPDATE OF` dès que la colonne
  est NOMMÉE dans le `SET`, même si la valeur ne change pas.
- RLS « filiation » : `SELECT` et `INSERT` seulement, aucune politique
  `UPDATE`/`DELETE` — fermées par construction sous `FORCE ROW LEVEL
  SECURITY`. `GRANT SELECT, INSERT` à `codiplan_app`, `REVOKE UPDATE, DELETE,
  TRUNCATE` : mesuré en base (`permission denied`), et éprouvé par
  `tests/isolation/historique-des-etats.test.ts`.
- Périmètre d'audit (I8) : les deux tables sont de première catégorie et
  reçoivent le déclencheur `journal_audit`, comme `intervention_pause` —
  gardiens mis à jour (`tests/unit/db/perimetre-audit.test.ts`,
  `tests/unit/db/inventaire.test.ts`).
- Registre des formes de politique mis à jour
  (`scripts/lib/politiques-rls.ts` : `TABLES_FILIATION`,
  `FILIATION_ARBITREE`) et chapitre 11.2 du cahier des charges complété
  (gardien `tests/unit/db/modele-de-donnees.test.ts`).

Mesuré directement en base (`psql`, hors application) : l'INSERT pose une
ligne, le premier `UPDATE` de statut en pose une seconde, un `UPDATE` qui
répète la même valeur ou qui touche une autre colonne n'en pose aucune.

## 3. Le calcul pur — `lib/interventions/durees-par-etat.ts`

`dureesParEtat(historique, statutActuel, maintenant)`, générique sur
`Statut extends string` (sert aux deux tables). Rend les durées cumulées par
état traversé, l'état courant et sa durée en cours, un drapeau
`historiqueIncomplet` et `depuisLe` (la première date connue, `null` si
l'historique est vide). Deux cas distincts d'incomplétude :
**vide** (rien n'est connu, pas même `depuisLe`) et **non vide mais dont la
première ligne porte un `statut_avant` non nul** (la création n'a pas été
vue — l'objet préexistait à la migration). Cinq épreuves unitaires
(`tests/unit/interventions/durees-par-etat.test.ts`) : passages multiples
dans un même état, état courant ouvert, historique vide, historique
incomplet, UPDATE sans changement réel.

## 4. La fiche intervention du bureau

- `lib/interventions/depot.ts` : `historiqueStatutDeLIntervention` — lecture
  seule, triée par `change_le` croissant, `null` si l'intervention n'est pas
  visible sous le contexte courant.
- `app/(back-office)/interventions/presentation.ts` : `tempsParEtatAffiche`
  compose `dureesParEtat` avec les libellés existants (`statut.<valeur>`,
  jamais inventés) et `enDuree` (déjà la seule conversion minutes → heures du
  dépôt). Le message « disponible à partir du JJ/MM/AAAA » réutilise
  `dateLocale`.
- `app/(back-office)/interventions/[id]/page.tsx`, onglet Historique : une
  nouvelle tuile « Temps par état », gabarit `Carte` (9I6), juste après la
  tuile Chronologie existante. L'état courant porte le suffixe « (en cours) ».
- Gardien DATES-1 (`tests/unit/dates/comparaison-civile.test.ts`) : nouvelle
  exemption pour `maintenant(fiche.fuseau).instant` — comparé à `change_le`,
  un AUTRE instant (`timestamptz`), jamais une colonne civile.
- `lib/i18n/fr.ts` : quatre clés neuves sous
  `intervention.chronologie.temps_par_etat.*` (titre, suffixe « en cours »,
  message d'indisponibilité, message « aucun historique »).

## 5. Captures

`docs/propositions/9J08A-HISTORIQUE-DES-ETATS/captures/` — 375 px et
1280 px, historique complet (plusieurs états, le dernier ouvert) et
historique incomplet (ligne de création effacée en base pour simuler une
intervention née avant la migration, message « disponible à partir du
04/11/2026 ») :

- `temps-par-etat-complet-375.png` (60 Ko), `temps-par-etat-complet-1280.png` (88 Ko)
- `temps-par-etat-incomplet-375.png` (64 Ko), `temps-par-etat-incomplet-1280.png` (92 Ko)

Produites par `tests/e2e/captures-9j08a-historique-des-etats.spec.ts` (SQL
brut en `beforeAll`/`afterAll`, comme les autres specs de captures du dépôt —
jamais de donnée de production, jamais d'identifiant réel).

## `verify-final.txt` — `test:e2e` n'a PAS fini dans l'appel unique

`format:check`, `typecheck`, `lint`, `test` (499 fichiers, 5484 épreuves),
`test:isolation` (209 fichiers, 1825 épreuves), `build`, `feries:horizon` et
`audit:partitions` sont tous passés sans un seul rouge. `test:e2e` a ensuite
tourné **environ 50 minutes sous `CI=1` (1 seul worker)** sans qu'aucun
« ✘ »/« FAIL » n'apparaisse dans tout ce qui a eu le temps de s'exécuter —
puis l'appel unique a été coupé par la limite de temps de l'outil (60 min),
en plein milieu de la suite. Ce n'est **pas un rouge mesuré**, c'est une
suite trop longue pour un seul appel — conforme au précédent déjà noté pour
ce dépôt (`test:e2e` seul dépasse 30 min avec 1877 épreuves). `pnpm verify`
(sans `test:e2e`) a été rejoué séparément, à sec, et passe.

**Pour la session qui reprend ce fil** : rejouer `CI=1 pnpm test:e2e` seul,
dans un appel dédié avec un budget de temps supérieur à 50 minutes (ou en
plusieurs tranches par motif de fichier), avant de considérer `verify:full`
comme réellement rejoué en entier.

## Hors territoire, non fait (par construction du ticket)

Le portail client (9J08B), les énumérations de statut existantes, le journal
d'audit, toute autre politique RLS, `lib/auth/**`, les capacités. Aucune
valeur de `StatutIntervention`/`StatutDemande` n'a été ajoutée.
`demande_statut_historique` est posée et éprouvée (migration, RLS,
isolation) mais **n'a encore aucun lecteur applicatif** : aucun écran du
bureau ne l'affiche aujourd'hui — c'est 9J08B qui en aura besoin pour le
portail client.
