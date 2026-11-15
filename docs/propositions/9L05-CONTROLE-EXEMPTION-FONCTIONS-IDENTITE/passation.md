# 9L05-CONTROLE-EXEMPTION-FONCTIONS-IDENTITE

Décision d'Alexis du 10/11/2026 : `app_identite_exclusive_a_la_societe` (D226) et `app_identite_interne_ailleurs`
(D233) — les deux fonctions `SECURITY DEFINER` arbitrées du dépôt — ne répondent sur la base hébergée QUE parce que
leur propriétaire est exempté des politiques (`rolbypassrls` ou superutilisateur) et que leurs réglages
(`SECURITY DEFINER`, `search_path`, `row_security`) restent ceux posés par leur migration. Les deux fonctions
restent SÛRES si ce propriétaire change un jour — elles LÈVENT plutôt que de filtrer en silence, c'est tout l'objet
de leur `SET row_security = off` — mais chaque appel applicatif retomberait alors sur un refus, SANS qu'aucune
alarme ne le dise. Ce lot rend cette dérive bruyante.

## POINT 1 — LA MESURE PARTAGÉE (FAIT)

`lib/db/exemption-fonctions-identite.ts` : une requête (`SQL_FONCTIONS_IDENTITE`) qui lit, pour les deux fonctions,
le propriétaire, `rolbypassrls` et `rolsuper` de ce propriétaire, `prosecdef`, et le tableau `proconfig` de la
fonction (d'où `search_path` et `row_security` sont extraits). Mesuré sous `codiplan_app` sur la base de test, sans
aucun `GRANT` supplémentaire : `pg_proc`, `pg_roles` et `pg_namespace` sont lisibles par tout rôle connecté — la
veille nocturne et `/api/sante`, qui ne portent que ce rôle, peuvent donc la jouer.

`etatsFonctionsIdentite` réduit chaque ligne à deux booléens (`exempte`, `reglagesSurs`) ; `exemptionFonctionsIdentiteOk`
rend vrai seulement si les DEUX fonctions attendues sont observées, exemptées et réglées comme leur migration l'a
posé — une fonction absente (migration non jouée, nom changé) vaut « non sûr », jamais « rien à signaler ».

## POINT 2 — BRANCHÉE DANS `pnpm veille` ET `/api/sante` (FAIT)

**`pnpm veille`** : `scripts/lib/exemption-fonctions-identite.ts` porte le JUGEMENT (`ecartsExemptionFonctionsIdentite`,
`rapportExemptionFonctionsIdentite`), sur le modèle de `scripts/lib/privileges-consolidation.ts`. Le périmètre de la
veille est INVERSÉ (D55) : toute fonction `export function ecarts*` ou `export const ecarts* =` déclarée dans
`scripts/lib/` est un contrôle par défaut, exigé dans `scripts/veille-hebergee.mts` sans qu'une exemption écrite ne
le dispense. Ce lot câble donc le contrôle dans `observer()` (nouveau `Controle` « exemption des fonctions
d'identité ») — `tests/unit/veille-hebergee.test.ts` l'exige et vérifie le câblage.

**`/api/sante`** : `lib/db/sante.ts` ajoute `fonctionsIdentite: Reponse` à `EtatSante`, lu par une fonction encapsulée
(`lireFonctionsIdentite`, locale à ce fichier) qui n'ouvre JAMAIS la branche de panne générale — un échec ici
(catalogue inattendu) ne fait pas passer `baseJointe` ou `migrations` pour en panne, ce sont deux questions
distinctes. `reponseMachine` rend `fonctionsIdentite: { ok }` SANS AUCUN DÉTAIL, à la différence des trois champs
existants : cette route est SANS COMPTE, et un motif nommerait un rôle ou un réglage (D50). La page humaine `/sante`
n'affiche PAS ce champ — aucun écran n'est touché, le ticket ne le demandait pas et la page reste à parité avec les
champs qu'elle choisissait déjà de montrer.

## POINT 3 — REMARQUE D'ALEXIS SUR `search_path` (VÉRIFIÉ, NON BLOQUANT)

Mesuré avant d'écrire quoi que ce soit, sur la base de test, sous `codiplan_app` :
`has_schema_privilege('codiplan_app', 'public', 'CREATE')` rend `f`, et un `CREATE TABLE`/`CREATE FUNCTION` dans
`public` est refusé (`permission denied for schema`). Aucune migration du dépôt ne lui accorde `CREATE` sur
`public` (PostgreSQL 15+ retire ce droit par défaut à `PUBLIC`, et rien ne le lui redonne). Le point n'est donc PAS
un problème : `search_path = pg_catalog, public` dans les deux fonctions ne peut pas être piégé par un objet que le
rôle applicatif aurait lui-même déposé dans `public`. Deux épreuves d'isolation figent cette mesure
(`tests/isolation/9l05-exemption-fonctions-identite.test.ts`) : le jour où l'une rougit, c'est le point d'arrêt que
le ticket demandait pour ce cas précis, pas un ajustement — aucun droit n'a été touché ici.

## POINT 4 — ÉPREUVES (FAIT)

- **Unitaires** (`tests/unit/db/exemption-fonctions-identite.test.ts`) : sur des lignes fabriquées — un propriétaire
  `BYPASSRLS` est exempté, un propriétaire superutilisateur aussi (c'est le cas de la base de test), un propriétaire
  ni l'un ni l'autre rend `ko` ; une fonction absente, un `search_path` desserré, un `row_security` disparu ou une
  fonction redevenue `SECURITY INVOKER` rendent chacun `reglagesSurs: false`. `ecartsExemptionFonctionsIdentite`
  nomme la fonction fautive dans chaque cas.
- **Isolation** (`tests/isolation/9l05-exemption-fonctions-identite.test.ts`) : la mesure réelle, sous `codiplan_app`
  sur la base de test — où le propriétaire est exempté par `rolsuper`, PAS par `rolbypassrls` (contrairement à la
  base hébergée, mesurée différemment par la passation de 9I8D2) ; une épreuve par falsification injecte un
  propriétaire non exempté dans des lignes par ailleurs réelles, pour prouver que le JUGEMENT (pas seulement la
  lecture) refuse ce cas ; et les deux épreuves de la remarque d'Alexis (point 3).
- **`/api/sante`** (`tests/unit/db/sante.test.ts`) : `reponseMachine` ne rend que `{ ok }` pour `fonctionsIdentite`,
  jamais le détail qu'`EtatSante` peut porter ; une base injoignable rend `fonctionsIdentite.ok === false`, jamais
  vrai par défaut. `tests/unit/deploiement/verdict-deploiement.test.ts` (le gardien qui confronte `reponseMachine`
  et `verdictDuDeploiement`) est mis à jour pour le nouveau champ d'`EtatSante`.
- Aucun écran touché, donc aucune capture — conforme à ce que le ticket prévoyait pour ce lot.

## CE QUI N'A PAS ÉTÉ FAIT

Aucune migration, aucun `docs/arbitrages.md` neuf : ce lot implémente un contrôle d'exploitation d'une décision déjà
arrêtée (D226, D233, et la décision du 10/11/2026 elle-même, mesurée par 9I8D2) ; il ne tranche aucune règle
métier ni n'assouplit aucun invariant. Le point 3 n'a appelé aucun changement, pour la raison mesurée ci-dessus.

## `verify`

`CI=1 pnpm verify` (format:check, typecheck, lint, test — 5860 passés, test:isolation — 2238 passés, build) est VERT.
`pnpm chemins` reste vert (le nouveau module de `lib/db/` est atteint depuis `app/` via `lib/db/sante.ts`, et aucune
fonction exportée n'est restée sans appelant). `pnpm veille` n'a pas été rejoué contre une base hébergée depuis ce
poste — hors de portée d'une session locale — mais le contrôle est éprouvé contre la base de test par les scénarios
d'isolation ci-dessus, et le gardien statique `tests/unit/veille-hebergee.test.ts` confirme qu'il est bien câblé
dans `scripts/veille-hebergee.mts`.

## TERRITOIRE TOUCHÉ

`lib/db/exemption-fonctions-identite.ts` (créé), `scripts/lib/exemption-fonctions-identite.ts` (créé),
`scripts/veille-hebergee.mts`, `lib/db/sante.ts`, `tests/unit/db/exemption-fonctions-identite.test.ts` (créé),
`tests/isolation/9l05-exemption-fonctions-identite.test.ts` (créé), `tests/unit/db/sante.test.ts`,
`tests/unit/deploiement/verdict-deploiement.test.ts`, `docs/propositions/9L05-CONTROLE-EXEMPTION-FONCTIONS-IDENTITE/`
(ce fichier). Rien touché dans `prisma/`, aucun écran, aucune route.
