-- CODIPLAN — Politiques Row Level Security (ticket L0-04, arbitrage D4).
--
-- Invariant I1 : « Toute requête est filtrée côté serveur, et la base applique
-- EN PLUS une politique RLS. » Cette migration pose le filet base de données.
-- Le filtre applicatif (côté serveur) reste la première barrière ; RLS est la
-- défense en profondeur.
--
-- Forme imposée (D4) sur les tables cloisonnées portant `societe_id` :
--     societe_id = current_setting('app.societe_id')::uuid OR societe_id IS NULL
--
-- Trois ajustements de forme, à iso-sémantique :
--   1. Pas de `::uuid`. Les identifiants du schéma L0-03 sont stockés en `text`
--      (Prisma `String` ; UUID v7 généré côté appareil, I10). La comparaison est
--      donc text-à-text ; caster la variable en uuid lèverait « operator does
--      not exist: text = uuid ».
--   2. `current_setting('app.societe_id', true)` — le second argument (missing_ok)
--      renvoie NULL quand la variable n'est pas positionnée, au lieu de lever
--      « unrecognized configuration parameter ». C'est ce qui rend « aucune
--      société positionnée ⇒ zéro ligne » vrai, comme l'exige le critère
--      d'acceptation, plutôt qu'une erreur.
--   3. `NULLIF(..., '')` — une variable posée à la chaîne vide est traitée comme
--      absente.
-- Le résultat est bien celui de la forme imposée : contexte absent ⇒ le membre
-- gauche vaut NULL ⇒ aucune ligne cloisonnée ne satisfait la clause.
--
-- FORCE ROW LEVEL SECURITY n'est volontairement PAS activé ici : le propriétaire
-- des tables (rôle qui applique migration et seed) doit continuer à écrire le
-- socle L0-03 sans positionner de contexte. La politique mord donc pour tout
-- rôle NON propriétaire et NON BYPASSRLS — exactement la posture qu'adoptera le
-- rôle applicatif restreint câblé au ticket L0-06 (Better Auth + rôles), et
-- exactement la posture sous laquelle tournent les tests d'isolation L0-05
-- (rôle dédié non-owner). Voir docs/decisions/2026-08-20-tests-isolation-postgres-local.md.

-- ── Tables cloisonnées portant `societe_id` ────────────────────────────────

ALTER TABLE "agence" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cloisonnement_societe" ON "agence"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')
    OR "societe_id" IS NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')
    OR "societe_id" IS NULL
  );

ALTER TABLE "utilisateur_societe" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cloisonnement_societe" ON "utilisateur_societe"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')
    OR "societe_id" IS NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')
    OR "societe_id" IS NULL
  );

ALTER TABLE "utilisateur_client" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cloisonnement_societe" ON "utilisateur_client"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')
    OR "societe_id" IS NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')
    OR "societe_id" IS NULL
  );

-- ── Table racine `societe` : cloisonnée par son identité ───────────────────
-- Elle ne porte pas de colonne `societe_id` mais un `id` qui EST la société.
-- La forme canonique s'y transpose en `id = app.societe_id`. Sans contexte,
-- zéro ligne : une société ne voit qu'elle-même.

ALTER TABLE "societe" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cloisonnement_identite" ON "societe"
  USING ("id" = NULLIF(current_setting('app.societe_id', true), ''))
  WITH CHECK ("id" = NULLIF(current_setting('app.societe_id', true), ''));

-- ── Référentiels de plateforme (I1 — liste close) ──────────────────────────
-- `devise` et `parite` n'ont pas de `societe_id` : ils sont lisibles par toutes
-- les sociétés (« le franc Pacifique est le même partout », D4). La lecture est
-- donc ouverte ; l'écriture reste réservée aux rôles éditeur, restriction posée
-- au ticket L0-06 avec l'énumération des rôles. Ici : lecture pour tous.

ALTER TABLE "devise" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referentiel_lisible_par_tous" ON "devise"
  FOR SELECT
  USING (true);

ALTER TABLE "parite" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referentiel_lisible_par_tous" ON "parite"
  FOR SELECT
  USING (true);

-- ── `utilisateur` : identité globale, hors périmètre de L0-04 ───────────────
-- La table ne porte pas de `societe_id` (un compte peut être habilité sur
-- plusieurs sociétés via `utilisateur_societe`). Sa visibilité relève de
-- l'authentification (L0-06), pas du cloisonnement société. RLS n'y est donc
-- pas activée à ce ticket, ce qui est cohérent avec sa portée « tables portant
-- societe_id ».
