-- ═══════════════════════════════════════════════════════════════════════════
-- `app_invalider_liens_anterieurs` — LA TROISIÈME FONCTION SECURITY DEFINER
-- DU DÉPÔT, PAR ARBITRAGE EXPLICITE (D281, 24/11/2026,
-- 9L35-LIENS-ACCES-ANCIENS-ANNULES).
--
-- ## Le trou qu'elle ferme
--
-- 9L09 (D266, 10/11/2026) a laissé un point 3 non livré : « invalider les
-- liens de premier accès / mot de passe oublié ANTÉRIEURS encore valides d'un
-- compte, au moment où un nouveau lien lui est émis ». Mesuré alors : la
-- table `verification` n'est cloisonnée QUE par désignation sur `identifiant`
-- (L1-02d) — la chaîne aléatoire que seul le porteur du lien connaît — et
-- aucune politique n'admet `valeur` (qui porte l'identité du compte,
-- `utilisateur.id`, posée par Better Auth lui-même : voir
-- `requestPasswordReset`, `createVerificationValue({ value: user.id, … })`).
-- Retrouver « les jetons antérieurs du même compte » pour les fermer exige
-- donc de lire par `valeur`, une clé que les politiques existantes ne
-- servent jamais. Alexis a arbitré, le 23/11/2026 (séance de décisions, point
-- 5) : « anciens liens d'accès : annulés à l'envoi d'un nouveau ».
--
-- ## Pourquoi SECURITY DEFINER, et seulement pour CE geste étroit (D50)
--
-- Même raisonnement que D226 (`app_identite_exclusive_a_la_societe`) et D233
-- (`app_identite_interne_ailleurs`) : sous SECURITY INVOKER et FORCE ROW
-- LEVEL SECURITY, une clause `"valeur" = …` n'est tout simplement JAMAIS
-- atteinte — aucune politique sur `verification` n'admet cette colonne, et la
-- lecture rendrait toujours zéro ligne. SECURITY DEFINER ou rien.
--
-- **Ce qui la rend plus ÉTROITE que D226/D233** : elle n'a besoin d'AUCUN
-- contexte de société — l'autorisation du GESTE qui l'appelle (D226 pour la
-- copie d'un nouveau lien administratif, D247 pour les chemins Équipe
-- inchangés) a déjà été tranchée par l'appelant, avant que cette fonction ne
-- soit atteinte. Elle ne reçoit QUE l'identifiant de l'identité VISÉE — jamais
-- un rôle, jamais une société — et ne peut agir que sur LES LIGNES DE CE SEUL
-- COMPTE. Un appelant qui se serait trompé de compte n'invaliderait que les
-- liens de CE compte, jamais ceux d'un autre : la portée du dégât possible
-- est bornée par construction, pas par un contrôle supplémentaire ici.
--
-- **« Même usage » (consigne du ticket) — le filtre `identifiant LIKE
-- 'reset-password:%'`** : Better Auth pose ce préfixe EXACT pour
-- `requestPasswordReset`/`resetPassword` (mesuré,
-- `node_modules/better-auth/dist/api/routes/password.mjs`), et un préfixe
-- DIFFÉRENT pour toute autre vérification qui transite par cette même table —
-- le défi de second facteur et la confiance d'appareil (`2fa-…`, confiance
-- d'appareil, plugin `twoFactor`, mesuré de même). Cette fonction ne touche
-- JAMAIS ces lignes-là : le filtre est écrit en SQL, pas déduit d'une
-- convention côté application.
--
-- ## `SET row_security = off` — LE MÊME FAIL-CLOSED QUE D226/D233
--
-- `verification` porte `FORCE ROW LEVEL SECURITY` (L1-02d) — même le
-- PROPRIÉTAIRE du schéma y est normalement soumis. Sans cet attribut, la
-- fonction s'exécuterait sous les droits du propriétaire mais verrait son
-- `DELETE` filtré à zéro ligne par les politiques de `verification`,
-- silencieusement : un faux « rien à invalider ». Pour tout rôle qui N'EST
-- PAS le propriétaire (ni `BYPASSRLS`), la même valeur fait LEVER une erreur
-- sous FORCE RLS plutôt que de filtrer en silence (comportement PostgreSQL
-- documenté, même garantie que D226/D233) — jamais un succès muet qui
-- n'aurait rien supprimé.
--
-- ## Ce qu'elle ne fait PAS
--
-- Aucune politique RLS n'est modifiée, aucune table n'est créée. Elle ne
-- supprime QUE des lignes `reset-password:*` dont `valeur` désigne le compte
-- reçu en paramètre, à l'EXCLUSION explicite de l'identifiant qu'on lui
-- demande de conserver (le lien qu'on vient d'émettre). Elle ne rend rien à
-- l'appelant — ni compte, ni nombre de lignes supprimées.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION "app_invalider_liens_anterieurs"(
  "p_utilisateur_id" uuid,
  "p_identifiant_a_conserver" text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $fonction$
BEGIN
  DELETE FROM "verification"
   WHERE "valeur" = "p_utilisateur_id"::text
     AND "identifiant" LIKE 'reset-password:%'
     AND "identifiant" <> "p_identifiant_a_conserver";
END;
$fonction$;

COMMENT ON FUNCTION "app_invalider_liens_anterieurs"(uuid, text) IS
  'D281, 9L35 — supprime les lignes verification de prefixe reset-password: '
  'dont valeur designe le compte recu en parametre, hors celle dont '
  'identifiant est passe en second parametre (le lien qu''on vient d''emettre). '
  'SECURITY DEFINER avec row_security = off : seule facon de lire par valeur, '
  'colonne qu''aucune politique n''admet (L1-02d, designation par identifiant '
  'seul). Fail-closed : pour tout role qui n''est ni le proprietaire ni '
  'BYPASSRLS, leve sous FORCE ROW LEVEL SECURITY plutot que de filtrer en '
  'silence. Ne touche jamais les lignes d''un autre usage (second facteur, '
  'confiance d''appareil) ni d''un autre compte.';

-- Le rôle applicatif est le SEUL à l'appeler — même garde que D226/D233.
REVOKE ALL ON FUNCTION "app_invalider_liens_anterieurs"(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "app_invalider_liens_anterieurs"(uuid, text) TO "codiplan_app";
