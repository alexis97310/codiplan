# Passation — 9L38A-HISTORIQUE-EMPLACEMENTS-SOCIETE-DE-SESSION

## Ce qui était demandé

Durcir `app_historique_emplacements_machine` (D283, 9L38) : la société venait d'un PARAMÈTRE fourni par l'appelant (`lib/machines/emplacements.ts`, `exigerSocieteActive(contexte)`), sur une fonction `SECURITY DEFINER` qui contourne déjà `FORCE ROW LEVEL SECURITY`. C'était juste alors — mais la base faisait confiance à l'appelant pour son propre cloisonnement, et les trois autres fonctions `SECURITY DEFINER` du dépôt qui portent sur une société (D226, D233) ne commettent pas cette faute.

## Ce qui est LIVRÉ

**Le paramètre société est RETIRÉ, pas doublé d'une vérification.** La consigne laissait le choix entre retirer le paramètre ou exiger qu'il égale le contexte ; j'ai retiré le paramètre, pour la même raison que D226 ne le reçoit pas en premier lieu : garder le paramètre et seulement comparer aurait laissé un appelant futur fournir sa propre société « à la main » dans le cas normal, l'égalité ne jouant qu'un rôle de filet — exactement la forme que D226 évite.

`app_historique_emplacements_machine` ne prend plus que `p_machine_id`. Elle lit la société dans `current_setting('app.societe_id', true)`, posé par `avecContexteApplicatif` (`lib/db/rls.ts`) sur CHAQUE transaction applicative, et LÈVE (jamais zéro ligne silencieuse) si ce contexte est absent — même fail-closed que D226. **Elle refuse en plus tout contexte portail** : si `app.client_id` (D10) est posé, elle lève aussi, par construction — le journal d'audit n'est lisible par aucun compte portail, et D283 ne l'avait ouvert qu'aux rôles internes qui voient la fiche machine.

Signature changée `(uuid, uuid)` → `(uuid)` : un `CREATE OR REPLACE` ne change pas une signature, d'où le `DROP FUNCTION` explicite suivi d'un `CREATE FUNCTION` (migration `20261125013000_historique_emplacements_societe_de_session_9l38a`).

**Ce qui ne change pas** : les colonnes rendues, le filtre `entite = 'machine'` / `action = 'modification'` / site différent avant-après, `search_path` figé, `SET row_security = off`, `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE` au seul `codiplan_app`. `app_historique_emplacements_machine` reste la quatrième et unique entrée pour ce besoin dans `AUTORISEES_PAR_ARBITRAGE` (`tests/unit/db/security-definer-sous-arbitrage.test.ts`) — ce lot la durcit, il n'en ajoute pas une cinquième.

`historiqueDesEmplacements` (`lib/machines/emplacements.ts`) n'appelle plus la fonction avec `societeId`, et `exigerSocieteActive`/son import sont retirés : ils ne servaient qu'à produire ce paramètre — `avecContexteApplicatif` exige déjà une société active (`exigerContexteActif`) avant d'ouvrir la transaction, la garantie n'est donc pas affaiblie.

Décision écrite en **D284** (`docs/arbitrages.md`), avec condition de réouverture.

## Un bogue trouvé ET corrigé en écrivant la fonction, pas seulement signalé

Première écriture : `LANGUAGE plpgsql` avec `SELECT "id", "horodatage", … FROM "journal_audit" WHERE …` sans alias. Rejouée contre la vraie base (`pnpm test:isolation`), elle a levé `ERROR: column reference "id" is ambiguous` (42702) — en `plpgsql`, les colonnes de `RETURNS TABLE` deviennent des VARIABLES du bloc, qui rendent `"id"` ambigu face à la colonne `"journal_audit"."id"`. Corrigé par un alias explicite sur la table (`"journal_audit" AS "ja"`, colonnes qualifiées `"ja"."id"`, etc.), avec une note dans la migration pour que la prochaine fonction `plpgsql` à `RETURNS TABLE` ne retombe pas dans le même trou. Les 7 épreuves qui avaient échoué à cause de cette ambiguïté (dans `tests/isolation/9l20-deplacer-machine.test.ts`) sont repassées vertes sans qu'aucune assertion n'ait été touchée — la base jetable est détruite et reconstruite à chaque exécution de `test:isolation` (`tests/isolation/setup/global.ts`), aucune donnée corrompue n'a donc persisté entre les deux lancements.

## Épreuves

Nouveau describe dans `tests/isolation/9l20-deplacer-machine.test.ts` : « `app_historique_emplacements_machine` — garanties posées par la migration (D284) ». Même méthode que `tests/isolation/identite-exclusive-a-la-societe.test.ts` pour D226 : appel direct de la fonction SQL, hors du wrapper `historiqueDesEmplacements`, pour éprouver ce qui se passe QUAND le contexte est absent ou porte le discriminant portail — un appel qui passe par le wrapper normal porte toujours une société active et jamais `app.client_id`, donc ne peut pas exercer ces deux branches.

- Contexte sans `app.societe_id` → lève.
- Contexte avec `app.societe_id` valide ET `app.client_id` posé → lève.
- Contexte avec `app.societe_id` valide, sans `app.client_id` → rend la trace (témoin, sans quoi les deux refus ci-dessus prouveraient seulement que la fonction lève TOUJOURS).
- `codiplan_reporting` (BYPASSRLS, `SELECT` seul, aucun `GRANT EXECUTE`) → `permission denied`.

Les épreuves EXISTANTES de D283 (`describe("historiqueDesEmplacements — ouvert à tout rôle qui voit la fiche (D283)")`) n'ont pas eu besoin d'être modifiées : elles appellent toutes `historiqueDesEmplacements` par une SESSION (jamais directement la fonction SQL), et une session porte déjà une société active sans `app.client_id` — le chemin durci par ce lot leur est donc transparent. C'est la preuve que la consigne demandait : « l'écran de 9L38 inchangé ».

## Aucune capture

Aucun écran n'est touché par ce lot (fonction SQL interne, pas d'UI) — confirmé par la consigne elle-même.

## Vérifications jouées

`pnpm test` (6075 tests, vert), `pnpm test:isolation` (2571 tests, vert — après correction de l'ambiguïté ci-dessus), `CI=1 pnpm verify` (format, typecheck, lint, test, test:isolation, build — vert, exit 0).

## Migration à jouer par Alexis

**MIGRATION À JOUER par Alexis : `pnpm db:migrate` (ou `db:deploy` en production) pour `20261125013000_historique_emplacements_societe_de_session_9l38a`, puis redéploiement Vercel.** DROP + CREATE sur une fonction existante : aucune donnée n'est perdue, aucune table n'est touchée.

## Portée

`prisma/migrations/20261125013000_historique_emplacements_societe_de_session_9l38a/`, `lib/db/migrations-attendues.ts`, `lib/machines/emplacements.ts`, `tests/unit/db/security-definer-sous-arbitrage.test.ts`, `tests/isolation/9l20-deplacer-machine.test.ts`, `docs/arbitrages.md` (D284).
