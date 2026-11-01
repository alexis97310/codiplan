# 9I8D2-EXCLUSIVITE-EN-PRODUCTION

Préalable vérifié avant d'ouvrir ce lot : `git log origin/main --oneline` contient `a9fc2dd4` (9I8D1), et
`prisma/migrations/20261101080000_identite_exclusive_a_la_societe_9i8d1/` existe. La migration de 9I8D1 n'est jouée ni en
production ni sur le site de test (confirmé par Alexis dans le ticket) — elle reste donc rejouable par une migration NEUVE
si besoin, mais ce lot n'en a pas écrit : voir point 3.

## POINT 1 — FAIL-CLOSED SANS PANNE (FAIT, COMMITÉ)

Commit `3093a491d`.

**Le défaut** : `identiteExclusiveALaSociete` (`lib/auth/lien-d-acces.ts`) appelait `app_identite_exclusive_a_la_societe`
sans filet. Sous le modèle hébergé (voir POINT 2), cette fonction LÈVE — et l'exception traversait sans être rattrapée :
les deux routes « copier un nouveau lien » (bureau et technicien) auraient rendu une page 500 au lieu du refus nommé
`autre_societe` ; `identitesExclusivesALaSociete`, construite sur `Promise.all`, aurait fait tomber la page Équipe
ENTIÈRE (`app/error.tsx`) pour tout administrateur, à chaque affichage, dès qu'un seul compte actif existe.

**Le correctif** :
- `identiteExclusiveALaSociete` entoure l'appel SQL d'un `try/catch`. Toute exception (ou résultat vide, déjà couvert
  par `?? false`) vaut désormais « non exclusif » — le refus nommé `autre_societe` existant, jamais un 500. L'erreur est
  journalisée par `console.error` avec le nom de la fonction et le code SQLSTATE SEULEMENT (`sqlstateDeLErreur`, qui lit
  `erreur.meta.code` — le SQLSTATE PostgreSQL réel pour un `$queryRaw` en échec — puis retombe sur `erreur.code`, le code
  Prisma `P2010`) : aucun identifiant d'utilisateur ni de société dans la trace.
- `identitesExclusivesALaSociete` passe de `Promise.all` à `Promise.allSettled` : chaque identité en échec vaut `false`
  dans la carte rendue (bouton « Copier un nouveau lien » caché), sans empêcher les autres de répondre. Cette garantie
  est posée INDÉPENDAMMENT du fait que `identiteExclusiveALaSociete` ne lève déjà plus — défense en profondeur
  explicitement demandée par le ticket.

**Les épreuves d'isolation ajoutées**, toutes contre la vraie base (`TEST_DATABASE_URL`, conteneur
`codiplan-pg-voie1`), simulent l'échec SANS toucher la migration de 9I8D1, en révoquant temporairement `EXECUTE` sur
`app_identite_exclusive_a_la_societe` pour `codiplan_app` (même famille d'échec qu'un propriétaire non exempté : une
exception SQL au moment de l'appel), puis en le regrantant dans un `finally` :
- `tests/isolation/identite-exclusive-a-la-societe.test.ts` — `identiteExclusiveALaSociete` rend `false` sans lever ;
  `identitesExclusivesALaSociete` rend une carte de `false` pour TOUTES les identités, sans rejeter.
- `tests/isolation/acces-bureau.test.ts` — `copierNouveauLienDAccesBureau` rend `{ accepte: false, motif:
  "autre_societe" }` plutôt qu'une exception.
- `tests/isolation/acces-technicien.test.ts` — même épreuve pour `copierNouveauLienDAcces`.

**Non fait, par manque de temps plutôt que par choix** : l'e2e Playwright de la page Équipe qui s'affiche quand la
fonction lève (mentionné par le ticket comme « si réalisable sans données de production »). La garantie est déjà
établie au niveau de la bibliothèque (`identitesExclusivesALaSociete` ne rejette jamais), ce qui est la même garantie
que verrait l'e2e — seul le rendu React au-dessus n'est pas rejoué bout en bout.

## POINT 2 — MESURE SOUS LE MODÈLE HÉBERGÉ (FAIT)

**Méthode** : recette de la mémoire de session « rejouer-roles-heberges-en-local » (déjà utilisée pour FERIES-1,
22/09/2026), rejouée sur le conteneur `codiplan-pg-voie1` (port 5441, celui de ce poste de travail) plutôt que
`codiplan-pg16`/5433 (celui de la mémoire, arrêté sur ce poste) :

```sql
CREATE ROLE mesure_bypass NOLOGIN BYPASSRLS;
CREATE ROLE mesure_owner LOGIN NOSUPERUSER NOBYPASSRLS CREATEROLE NOINHERIT IN ROLE mesure_bypass;
CREATE DATABASE codiplan_mesure OWNER mesure_owner;
```

Puis `DATABASE_URL=postgresql://mesure_owner@127.0.0.1:5441/codiplan_mesure pnpm exec prisma migrate deploy` — les 76
migrations s'appliquent sans erreur, y compris celle de 9I8D1. `GRANT SELECT, USAGE ...` à `mesure_bypass` (pour que
l'amorçage puisse lire), puis `pnpm db:referentiels` et `pnpm db:societe-initiale` sous `mesure_owner` posent une
société (`01a1955d-ab0e-7e2f-b001-092ca78f82be`). Une identité (`utilisateur` + `utilisateur_societe`) est posée par un
`SET LOCAL ROLE mesure_bypass` le temps d'une transaction (FORCE RLS mord aussi le propriétaire à l'écriture — même
remarque que la mémoire de session).

**La mesure, celle qui compte** — appel SOUS `mesure_owner`, SANS `SET ROLE`, exactement le rôle qui exécute
l'application sur la base hébergée telle que ce ticket la décrit :

```sql
BEGIN;
SELECT set_config('app.societe_id', '01a1955d-ab0e-7e2f-b001-092ca78f82be', true);
SELECT "app_identite_exclusive_a_la_societe"('<identité posée>'::uuid) AS "exclusif";
```

```
ERROR:  query would be affected by row-level security policy for table "utilisateur_societe"
HINT:  To disable the policy for the table's owner, use ALTER TABLE NO FORCE ROW LEVEL SECURITY.
CONTEXT:  SQL expression "NOT EXISTS ( SELECT 1 FROM "utilisateur_societe" "us" ... )"
PL/pgSQL function app_identite_exclusive_a_la_societe(uuid) line 15 at RETURN
```

**Confirmé, au mot près le défaut prédit par le ticket** : sous un propriétaire non superutilisateur et non `BYPASSRLS`,
`SET row_security = off` sous `FORCE ROW LEVEL SECURITY` fait LEVER plutôt que filtrer — la fonction de 9I8D1 ne répond
jamais sur la base hébergée telle qu'elle existera avant ce lot. Base et rôles de mesure supprimés après la mesure
(`DROP DATABASE codiplan_mesure; DROP ROLE mesure_owner; DROP ROLE mesure_bypass;`) — rien n'en subsiste.

**Les rôles exemptés existants, et leurs droits sur les deux tables en cause** (lu dans
`prisma/migrations/20260820150000_authentification_et_roles/migration.sql`, confirmé par `grep` sur TOUTES les
migrations) :
- `codiplan_app` — `NOBYPASSRLS` par construction (I1) : jamais candidat, et il ne doit jamais le devenir.
- `codiplan_reporting` — le SEUL rôle `BYPASSRLS` du système (D21, `ALTER ROLE ... BYPASSRLS` ~l.265). Ses
  `GRANT SELECT` (~l.278-290) portent sur `societe`, `agence`, `devise`, `parite` et les référentiels de plateforme.
  **`utilisateur`, `utilisateur_societe`, `utilisateur_client`, `session`, `compte`, `verification`, `second_facteur`
  et `journal_acces` en sont explicitement exclus — « et doivent le rester » (commentaire de la migration, D21,
  garde-fou n°1).** Aucune migration ultérieure ne lui accorde quoi que ce soit sur `utilisateur_societe` ni
  `utilisateur_client` (vérifié par `grep` sur `prisma/migrations/*/migration.sql`).
- Aucun autre rôle `BYPASSRLS` ni superutilisateur n'existe nommément dans le dépôt.

## POINT 3 — ARRÊT (PAS FAIT, VOLONTAIREMENT)

**Le chemin attendu par le ticket** — `ALTER FUNCTION "app_identite_exclusive_a_la_societe"(uuid) OWNER TO <rôle
exempté>`, avec un `GRANT SELECT ("utilisateur_id", "societe_id")` sur les seules `utilisateur_societe` et
`utilisateur_client` à ce rôle — exige un rôle qui porte `BYPASSRLS`. **Le seul qui existe est `codiplan_reporting`.**
Aucun autre n'est accessible sans créer un rôle neuf ou accorder `BYPASSRLS` à un rôle existant — les deux premières
clauses du garde-fou du ticket (« si la seule voie exige de créer un rôle, de donner BYPASSRLS ... ARRÊTE-TOI »).

Mais même en restant dans les clous de ce garde-fou — réutiliser `codiplan_reporting`, avec le `GRANT SELECT` le plus
étroit possible (deux colonnes, deux tables) — **ce geste contredit directement D21, garde-fou n°1** : le commentaire
de la migration qui a créé ces droits nomme `utilisateur_societe` et `utilisateur_client` comme exclus de
`codiplan_reporting`, et dit explicitement qu'ils « doivent le rester ». Ce n'est pas une omission à compléter, c'est
une décision déjà prise, rang 1 (`docs/arbitrages.md`), qui nomme CES DEUX TABLES PRÉCISÉMENT. L'élargir, même d'une
seule colonne et à droit `SELECT` seul, est une modification de cette décision — pas une mise en œuvre de 9I8D2.

CLAUDE.md §8 est explicite sur ce point : « l'assouplissement d'un invariant » et « tout ce qui touche au
cloisonnement ou aux données personnelles » sont des points d'arrêt, même quand une doctrine locale pourrait trancher
ailleurs — et plus largement, « si une instruction d'ici contredit une demande ponctuelle, signaler la contradiction
avant d'agir ». C'est exactement la situation : l'instruction de ce ticket (accorder ce droit à un rôle exempté) et la
décision déjà écrite (D21 garde-fou n°1, "doivent le rester" exclus) se contredisent sur ces deux tables précises. Je
m'arrête donc ici, comme le ticket le prévoit lui-même pour ce cas (« le point 1 suffit pour la démo »), et j'expose
les options plutôt que d'en choisir une.

### CE QUI A ÉTÉ VÉRIFIÉ AVANT DE S'ARRÊTER (pas une supposition)

- Aucune autre table ni aucun autre rôle ne permettrait de contourner le problème : la fonction a structurellement
  besoin de lire `utilisateur_societe` ET `utilisateur_client` au-delà de la société active (c'est tout son objet,
  D226) — il n'y a pas de sous-ensemble de colonnes qui évite la question.
- La membre-appartenance nécessaire (`ALTER FUNCTION ... OWNER TO codiplan_reporting` exige que le rôle de migration
  soit membre de `codiplan_reporting`, ou superutilisateur) n'a pas pu être vérifiée sur la vraie base hébergée depuis
  ce poste — mais la passation de FERIES-1 (22/09/2026, citée par ce ticket) documente un remède appliqué avec succès
  en production via `SET LOCAL ROLE` vers un rôle exempté dont le propriétaire était membre, ce qui suggère que cette
  appartenance existe déjà. Ce point n'est donc probablement pas le blocage réel — D21 l'est.
- Un superutilisateur bypasserait FORCE RLS inconditionnellement (pas besoin de `BYPASSRLS` dans ce cas), mais élever
  le propriétaire hébergé au rang de superutilisateur serait une décision bien plus large que celle-ci, et n'est
  mentionné nulle part comme une option envisagée — je ne la retiens pas davantage que les autres voies fermées par le
  garde-fou du ticket.

### OPTIONS, SANS EN CHOISIR UNE

**Option A — un rôle NEUF, dédié, qui ne touche pas à `codiplan_reporting`.** Un rôle `NOLOGIN BYPASSRLS` séparé (par
exemple `codiplan_identite_exclusive`), propriétaire de la seule fonction `app_identite_exclusive_a_la_societe`, avec
`GRANT SELECT ("utilisateur_id", "societe_id")` sur les deux tables, à LUI SEUL — jamais à `codiplan_reporting`.
Avantage : D21 garde-fou n°1 reste intact au mot près, rien n'est élargi sur le rôle existant. Coût : un rôle
`BYPASSRLS` de plus dans le système (le ticket nomme « créer un rôle » et « donner BYPASSRLS » comme des gestes qui
arrêtent le travail, précisément parce que c'est une décision, pas un détail d'implémentation).

**Option B — amender D21 garde-fou n°1 nommément**, pour `codiplan_reporting`, avec une exception écrite : SELECT sur
EXACTEMENT `utilisateur_societe(utilisateur_id, societe_id)` et `utilisateur_client(utilisateur_id, societe_id)` —
aucun nom, aucun courriel, aucune autre colonne. Avantage : pas de rôle supplémentaire. Coût : révise une décision
rang 1 qui disait explicitement que ces tables « doivent rester » hors de portée de ce rôle — même étroitement, c'est
rouvrir un carcan posé exprès.

**Option C — ne rien faire de plus ici.** Le propriétaire de la fonction reste celui de 9I8D1 (le propriétaire du
schéma). Sur la base hébergée, l'appel continuera de lever, et le POINT 1 garantit que ce n'est jamais un 500 : chaque
appel à « Copier un nouveau lien » rendra `autre_societe` pour TOUTE identité, y compris une identité réellement
exclusive — la fonctionnalité D226 reste sûre (aucune fuite possible) mais **dégradée en « toujours refuser »**
jusqu'à ce que A ou B soit tranché. Aucune privilège touché, aucun risque nouveau — mais la fonctionnalité promise par
D226 n'existe pas en pratique tant que ce choix n'est pas fait.

Les points 4 et 5 du ticket (e2e complémentaires, captures) dépendaient de la fonction répondant VRAI pour une
identité exclusive sous le modèle hébergé — impossible à démontrer honnêtement tant que le point 3 n'est pas tranché.
Ils ne sont donc pas faits non plus dans cette session.

## `verify-final.txt`

`CI=1 pnpm verify:full` : `format:check`, `typecheck`, `lint`, `test` (5389 passés), `test:isolation` (1758 passés — +4
sur les 1754 d'avant ce lot, nommément les épreuves fail-closed du point 1), `build` (compilé) et
`feries:horizon`/`audit:partitions` sont VERTS. `test:e2e` a démarré (« Running 1823 tests using 1 worker ») et a été
coupé par la limite de 30 minutes de l'outil d'exécution, aux alentours de 612 épreuves jouées — **même point de
coupure que les lots précédents** (9I8D, « coupée à 1h » ; 9I8D1, build complet mais e2e non intégralement rejoué) :
aucune ligne `✘`/`failed` dans tout ce qui a tourné avant la coupure, seulement des passes et une note déjà connue du
dépôt (« "En retard" ne vaut pas 0 au moment de l'épreuve (10) — capture non prise, voir le README »), pas une
exception.

## TERRITOIRE TOUCHÉ DANS CETTE SESSION

`lib/auth/lien-d-acces.ts`, `tests/isolation/identite-exclusive-a-la-societe.test.ts`,
`tests/isolation/acces-bureau.test.ts`, `tests/isolation/acces-technicien.test.ts`,
`docs/propositions/9I8D2-EXCLUSIVITE-EN-PRODUCTION/` (ce fichier). Rien touché dans `prisma/`, `lib/auth/acces-bureau.ts`
au-delà de son épreuve, `lib/auth/acces-technicien.ts` au-delà de son épreuve, `app/api/equipe/**`, l'écran Équipe,
`docs/arbitrages.md` — aucune migration neuve, aucun complément à D226 : il n'y a pas de décision à documenter tant
qu'Alexis n'a pas choisi entre A, B et C.
