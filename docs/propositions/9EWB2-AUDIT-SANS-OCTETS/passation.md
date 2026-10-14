# 9EWB2-AUDIT-SANS-OCTETS — passation

**MIGRATION À APPLIQUER EN PRODUCTION PAR ALEXIS** : `20261014040000_audit_sans_octets`
(`pnpm db:deploy`). `CREATE OR REPLACE FUNCTION "journal_audit_tracer"` — ne crée ni ne
retire aucun déclencheur, aucune table, aucune colonne, aucun privilège. Non destructive.

Décision n° 100 d'Alexis (14/10/2026), portée au dépôt comme **D202**
(`docs/arbitrages.md`) : `journal_audit_tracer` recopiait `document.octets` (D200, migration
du matin `20261014030000_photos_en_base`) en entier — jusqu'à ~2 Mo par ligne d'audit,
deux fois sur un `UPDATE`, dans un journal en ajout seul qui ne purge jamais. Pour
`document` seulement, la ligne porte désormais `octets_taille` et `octets_sha256` au lieu
des octets bruts.

Aucun écran touché : pas de capture d'écran prise, comme demandé au ticket.

## Point 1 — la migration

`prisma/migrations/20261014040000_audit_sans_octets/` : `CREATE OR REPLACE FUNCTION
"journal_audit_tracer"` reprend le corps exact de la migration du 29/08
(`20260829120000_journal_audit`, jamais redéfinie jusqu'ici), avec une branche fermée
après la comparaison « ligne identique » (`avant IS NOT DISTINCT FROM apres`, sur le jsonb
COMPLET, octets inclus — ordre imposé par le ticket) : si `TG_TABLE_NAME = 'document'`,
`avant` et `apres` sont chacun réécrits en `(x - 'octets') || jsonb_build_object(
'octets_taille', octet_length(…), 'octets_sha256', encode(sha256(…), 'hex'))`. `sha256
(bytea)` est natif à PostgreSQL 16 (`pg_catalog`) : aucune extension. `octets` NULL → les
deux clés à `null` (stricture de `octet_length`/`sha256`, pas de `CASE` à écrire). Vérifié
à la main sur `codiplan_test` (INSERT/UPDATE/DELETE, cas NULL) avant d'écrire les épreuves
automatisées — voir point 3. `lib/db/migrations-attendues.ts` étendu.

## Point 2 — `COLONNES_NON_RECOPIEES_AUDIT`, liste close en trois sens

`scripts/lib/perimetre-audit.ts` exporte `COLONNES_NON_RECOPIEES_AUDIT` (une entrée :
`document.octets`) et :

- `ecartsColonnesNonRecopiees(colonnesBytes, observees, …)` — sens 1 (toute colonne BYTEA
  d'une table auditée figure dans la liste) et sens 2 (toute entrée s'adosse à une colonne
  réelle toujours auditée), confrontés au schéma Prisma par le gardien statique
  (`tests/unit/db/perimetre-audit.test.ts`, qui lit `modelesDuSchema` pour en tirer les
  colonnes `Bytes`/`Bytes?`) ;
- `couplesSubstituesParTraceur(definition)` / `ecartsTraceurColonnesNonRecopiees` — sens 3,
  **une seule implémentation, deux sources** (même doctrine que `ecartsDeclencheurs`) : le
  gardien statique lui passe le SQL concaténé des migrations, `pnpm veille` lui passe
  `pg_get_functiondef('journal_audit_tracer'::regproc)` contre la base hébergée. La lecture
  compte la profondeur des `IF`/`END IF` à partir du `THEN` qui suit `IF TG_TABLE_NAME =
  '<table>' THEN`, pour isoler exactement son bloc sans dépendre du texte qui suit.

Chaque sens a son test négatif (liste vidée, entrée orpheline, entrée sans justification,
corps de fonction fabriqué qui substitue une colonne non déclarée) — tous rouges comme
attendu, vérifié avant de committer.

`scripts/veille-hebergee.mts` : deux requêtes de plus (`SQL_COLONNES_BYTEA` contre
`pg_catalog`, `SQL_DEFINITION_TRACEUR`) et deux contrôles de plus dans `pnpm veille` — 14
au total désormais (12 + 2). Mesuré en local contre `codiplan_test` sous le rôle
`codiplan_app` : **« 14 contrôles, aucun écart »**, les deux nouveaux rapportant
`document.octets`. `tests/unit/veille-delais.test.ts` reste vert sans y toucher : le
budget de 240 allers-retours (120 s à 500 ms) est calculé depuis le source, deux appels de
plus ne l'approchent pas.

**Point ouvert mineur, signalé plutôt que corrigé** : le ticket anticipait `D201` comme
« prochain numéro libre » ; `D201` a été pris dans l'intervalle par
9EWD-PARAMETRES-HUB-MAQUETTE (commit `65ea71e9`, visible sur `main` avant ce lot). La
décision est donc écrite sous **D202**. De même, `CLAUDE.md` §4 annonce encore « DOUZE »
contrôles pour `pnpm veille` ; ce lot le porte à 14 mais ne touche pas `CLAUDE.md` (hors
territoire du ticket) — à corriger au prochain lot qui y entre.

## Point 3 — épreuves d'isolation

`tests/isolation/journal-audit.test.ts`, nouvelle section « le journal ne recopie pas
document.octets » : création (pas de clé `octets`, `octets_taille`/`octets_sha256`
corrects), modification du seul `octets` (empreintes avant/après différentes), modification
d'un autre champ (`octets_*` identiques avant/après), non-modification (zéro ligne — preuve
que la comparaison porte bien sur le jsonb complet, octets inclus, et non sur la forme
réduite), `octets` NULL (clés présentes à `null`), suppression (seul `avant` porte les
clés). Plus un scénario par le chemin de PRODUCTION
(`deposerPhotoIntervention`, via `clientApp()`) et le sens 3 joué directement contre la
base de test (`pg_get_functiondef` réel, pas une fabrication).

## Point 4 — doc

`docs/arbitrages.md` — D202, avec renvoi depuis D200. `docs/decisions/
2026-08-29-journal-audit-par-declencheur.md` §4 — paragraphe ajouté nommant l'exception et
excluant explicitement `intervention_signature.image_base64`. En-tête de
`scripts/lib/perimetre-audit.ts` — section dédiée à `COLONNES_NON_RECOPIEES_AUDIT`, sa
distinction avec `EXEMPTIONS_AUDIT` (une table reste auditée dans son ensemble), et le
renvoi vers le lot futur 9EZ-LOGO-SOCIETE-1.

## Points ouverts

- La collision de numérotation D201 (voir point 2) : aucune action requise, juste
  consignée pour qu'une relecture future ne s'étonne pas de l'écart avec le texte du
  ticket.
- `CLAUDE.md` §4 dit « DOUZE » contrôles pour `pnpm veille` ; il en existe 14 depuis ce
  lot. Hors territoire ici (CLAUDE.md n'y figure pas) ; à corriger par qui touchera
  prochainement ce paragraphe.
- 9EZ-LOGO-SOCIETE-1 devra ajouter sa propre entrée à `COLONNES_NON_RECOPIEES_AUDIT`
  (`societe.logo_octets`) et sa branche dans `journal_audit_tracer` — le gardien de sens 1
  le réclamera dès que la colonne apparaîtra au schéma, sens 3 dès que la branche sera
  posée dans une migration.
- Les lignes d'audit déjà écrites ce matin (entre `20261014030000_photos_en_base` et ce
  lot) portent encore les octets bruts. C'est délibéré et nommé dans D202 (ajout seul,
  aucune réécriture rétroactive) — pas un oubli.

## Vérification finale

<!-- à compléter après le rejeu des épreuves voisines et `CI=1 pnpm verify:full` -->
