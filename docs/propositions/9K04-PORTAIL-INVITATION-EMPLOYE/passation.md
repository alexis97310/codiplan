# 9K04-PORTAIL-INVITATION-EMPLOYE — passation

## État : LIVRÉ

Budget de 100 min. T0 = 04:51 (Pacific/Noumea). Commits livrés, du plus ancien au plus récent :

1. `b894f472b` — point 2 : `app_identite_interne_ailleurs`, seconde fonction `SECURITY DEFINER`
   (D233).
2. `798159863` — point 3+4 : refus d'un employé déjà actif d'une autre société, épreuves
   d'isolation.
3. `60e97479b` — point 5 : D233 complétée, résidu (c) fermé.

## Mesure (point 1)

- `identiteExclusiveALaSociete` (`lib/auth/lien-d-acces.ts:415-438`, D226) appelle
  `app_identite_exclusive_a_la_societe` (migration
  `20261101080000_identite_exclusive_a_la_societe_9i8d1`) — `SECURITY DEFINER`, propriétaire du
  schéma, `SET row_security = off`, `STABLE`, lit `app.societe_id` dans le contexte. Rend VRAI
  seulement si l'identité n'a AUCUNE ligne `utilisateur_societe` NI `utilisateur_client` pour une
  société autre — un seul booléen, jamais laquelle des deux tables a répondu.
- `inviterClientAuPortail` (`lib/auth/lien-d-acces.ts`, avant ce lot) appelait cette fonction une
  seule fois, pour un compte EXISTANT sans rôle interne dans la société active : si `!exclusive`,
  elle lisait `compte.mot_de_passe` (sans filtre de société) — posé → acceptée (branche (a),
  `dejaActif: true`) ; absent → refus `compte_connu_autre_societe`. Un employé d'une autre société
  (ligne `utilisateur_societe` ailleurs) qui avait DÉJÀ un mot de passe (cas rare mais possible :
  un compte interne peut porter un mot de passe sans jamais avoir été invité au portail) suivait
  donc la branche (a) — accepté comme un client — exactement le résidu nommé par D233 (c).
- `UtilisateurSociete` (`prisma/schema.prisma:963-978`) ne porte AUCUNE colonne `actif` : à la
  différence de `UtilisateurClient`, il n'existe aucune révocation souple de ce rattachement —
  l'EXISTENCE de la ligne EST le rattachement actif. La nouvelle fonction n'a donc besoin
  d'aucune clause supplémentaire sur un état : un simple `EXISTS` sur `utilisateur_societe` suffit.
- `AUTORISEES_PAR_ARBITRAGE` (`tests/unit/db/security-definer-sous-arbitrage.test.ts`) : liste
  close, une seule entrée avant ce lot (`app_identite_exclusive_a_la_societe`). D233 posait déjà
  sa condition de réouverture : « une seconde fonction `SECURITY DEFINER` (sur le modèle de D226),
  donc une migration, à traiter comme telle plutôt qu'en passant » — exactement ce que la décision
  verbatim d'Alexis du 08/11 ~09:00, point (c), demande.

## Point 2 — La migration

`prisma/migrations/20261109050000_identite_interne_ailleurs_9k04/migration.sql` :
`app_identite_interne_ailleurs(p_utilisateur_id uuid) RETURNS boolean` — même patron que D226
(`SECURITY DEFINER`, propriétaire du schéma, `SET search_path = pg_catalog, public` figé, `SET
row_security = off` fail-closed, `STABLE`, `app.societe_id` lu dans le contexte, jamais en
paramètre, `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE` au seul rôle `codiplan_app`), mais une
question plus étroite : `EXISTS` sur `utilisateur_societe` SEULE, jamais `utilisateur_client`.
Enregistrée dans `lib/db/migrations-attendues.ts` et dans `AUTORISEES_PAR_ARBITRAGE` (seconde
entrée, avec son commentaire).

## Point 3+4 — L'appel et les épreuves

`identiteInterneAilleurs` (`lib/auth/lien-d-acces.ts`, enveloppe de
`app_identite_interne_ailleurs`, même forme que `identiteExclusiveALaSociete`) — **FAIL-CLOSED
INVERSÉ** : une exception à l'appel rend `true` (« oui, interne ailleurs »), jamais `false`,
puisque c'est `true` qui mène au refus dans `inviterClientAuPortail`. Une erreur ne devient jamais
une acceptation silencieuse.

`inviterClientAuPortail` appelle `identiteInterneAilleurs` UNIQUEMENT dans la branche où un compte
déjà actif ailleurs (mot de passe posé) aurait sinon été accepté sans distinction — jamais pour un
compte pas encore activé (déjà refusé par (b), inchangé). Si elle répond vrai, refus NOMMÉ
`compte_interne` (le motif déjà utilisé pour un compte interne de la société active — même famille
de refus, pas un nouveau motif), AVANT tout jeton ou rattachement.

Épreuves :

- `tests/isolation/identite-interne-ailleurs.test.ts` (nouveau) — même structure que
  `identite-exclusive-a-la-societe.test.ts` : vrai/faux selon les lignes `utilisateur_societe`,
  jamais affecté par `utilisateur_client` (témoin `PORTAIL_DEUX_SOCIETES`), fail-closed sur
  `EXECUTE` révoqué (rend `true`), ne rend qu'un booléen, lève sans `app.societe_id`, refusée hors
  rôle applicatif (`codiplan_reporting`).
- `tests/isolation/invitation-portail-client.test.ts` — nouveau scénario « C1(c), compte déjà
  actif » : un employé de B avec mot de passe posé, invité par A, est refusé
  (`compte_interne`), aucun rattachement posé. Les scénarios C1(a)/(b)/(c) existants (identité pas
  encore activée) restent inchangés et verts — non-régression explicite.

## Ce que ce lot NE fait pas

Aucune route `app/(portail)/**` touchée. Aucune nouvelle clé `lib/i18n/fr.ts` : le motif
`compte_interne` existait déjà, et son texte (« Cette adresse est un compte interne : elle ne peut
pas recevoir un accès portail. ») reste correct pour ce cas. Aucune politique RLS modifiée.

## Vérification

Après chaque commit, au premier plan : `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`
(505 fichiers, 5555 tests), `pnpm test:isolation` (229 fichiers, 1966 tests). Les gardiens de
documentation (`tests/unit/docs/cablage-arbitrages.test.ts`,
`tests/unit/docs/constitution-indexee.test.ts` et les autres du répertoire) rejoués après l'édition
de `docs/arbitrages.md`, tous verts. `verify:full` est laissé à la file, comme demandé — non joué
ici. `git fetch origin` + `git rebase origin/main` à faire juste avant de rendre la main (voir
ci-dessous).
