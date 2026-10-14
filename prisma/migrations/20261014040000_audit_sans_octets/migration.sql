-- CODIPLAN — Le journal d'audit ne recopie plus les octets d'une photo
-- (décision n° 100 d'Alexis, 14/10/2026, 9EWB2-AUDIT-SANS-OCTETS). Portée au
-- dépôt comme D202 — voir docs/arbitrages.md.
--
-- ── CE QUI A ÉTÉ MESURÉ ─────────────────────────────────────────────────────
--
-- `journal_audit_tracer` (définie UNE fois, migration 20260829120000, jamais
-- redéfinie depuis) écrit `to_jsonb(OLD)` / `to_jsonb(NEW)` ENTIERS — c'est
-- D201 bis... non, c'est le choix du §4 de
-- docs/decisions/2026-08-29-journal-audit-par-declencheur.md : la question se
-- pose champ par champ, longtemps après, sur des champs qu'on ne connaît pas
-- d'avance. `to_jsonb(bytea)` rend une chaîne hexadécimale `"\\x…"` : pour la
-- colonne `document.octets` (migration 20261014030000, D96 — la photo du
-- technicien réduite sur le téléphone et gardée en base), cela recopie jusqu'à
-- ~2 Mo par ligne d'audit, deux fois sur un `UPDATE` (avant et après). Le
-- journal est en ajout seul (I8, L0-10) : rien n'y purge jamais cette taille.
--
-- ── LA DÉCISION ─────────────────────────────────────────────────────────────
--
-- Pour `document` seulement, et seulement pour sa colonne `octets` : la ligne
-- d'audit ne porte plus les octets bruts, mais deux clés calculées sur ce
-- qu'ils étaient RÉELLEMENT en base — `octets_taille` (`octet_length`) et
-- `octets_sha256` (`encode(sha256(…), 'hex')`, hexadécimal minuscule, comme
-- `document.empreinte`). PostgreSQL 16 rend `sha256(bytea)` nativement, dans
-- `pg_catalog` — déjà dans le `search_path` de la fonction : aucune extension.
-- `document.empreinte` existe déjà mais n'est pas réutilisée ici : elle dit ce
-- que le DÉPÔT prétend avoir reçu, pas ce que la ligne jsonb contient
-- réellement au moment de l'écriture — on recalcule depuis `OLD.octets` /
-- `NEW.octets` pour que la ligne d'audit soit la preuve de ce que la base
-- contient, et non la recopie d'une déclaration applicative.
--
-- `octets` NULL (document dont les octets vivent ailleurs, L8-05) → les deux
-- clés sont présentes, à `null` : `octet_length(NULL)` et `sha256(NULL)` sont
-- NULL par la stricture des deux fonctions, sans `CASE` à écrire.
--
-- Toutes les autres colonnes, et toutes les autres tables du périmètre de I8,
-- sont inchangées — y compris `intervention_signature.image_base64`, que
-- cette migration ne touche PAS (décision explicite antérieure, petite
-- taille).
--
-- ── ORDRE IMPOSÉ DANS LE CORPS DU DÉCLENCHEUR ───────────────────────────────
--
-- 1. `avant`/`apres` sont calculés COMPLETS (octets inclus), comme avant cette
--    migration ;
-- 2. la comparaison « ligne identique » (`IS NOT DISTINCT FROM`, §4 de la
--    décision du 29/08 — le seed est idempotent) se fait sur ces jsonb
--    COMPLETS : une photo réécrite à l'identique n'est toujours pas une
--    modification, et le serait devenue si la comparaison avait porté sur la
--    forme réduite ;
-- 3. SEULEMENT APRÈS, et seulement pour `TG_TABLE_NAME = 'document'`, `avant`
--    et `apres` sont chacun réécrits en retirant `octets` et en ajoutant les
--    deux clés calculées.
--
-- Aucune autre table n'est touchée par cette branche ; les déclencheurs déjà
-- posés ne sont pas reposés — `CREATE OR REPLACE FUNCTION` les conserve tels
-- quels, c'est la DÉFINITION de la fonction qui change, pas son câblage.
--
-- Les lignes d'audit DÉJÀ ÉCRITES avec des octets bruts (depuis la migration
-- de ce matin, 20261014030000) ne sont PAS reprises par cette migration : le
-- journal est en ajout seul, aucune réécriture rétroactive, aucun détachement
-- de partition. Elles restent lisibles telles qu'elles ont été écrites.

CREATE OR REPLACE FUNCTION "journal_audit_tracer"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  colonne_societe text := COALESCE(TG_ARGV[0], 'societe_id');
  avant  jsonb;
  apres  jsonb;
  ligne  jsonb;
  verbe  "ActionAudit";
BEGIN
  IF TG_OP = 'DELETE' THEN
    avant := to_jsonb(OLD);
    apres := NULL;
    ligne := avant;
    verbe := 'suppression';
  ELSIF TG_OP = 'UPDATE' THEN
    avant := to_jsonb(OLD);
    apres := to_jsonb(NEW);
    ligne := apres;
    verbe := 'modification';
    -- Une écriture qui laisse la ligne IDENTIQUE n'est pas une modification :
    -- « valeurs avant » et « valeurs après » seraient les mêmes, et la ligne
    -- d'audit ne dirait rien. Ce n'est pas une dispense accordée à un chemin
    -- d'écriture — c'est la définition du mot. Le cas est réel : le seed est
    -- idempotent et réécrit ses sociétés, ses agences et ses calendriers à
    -- chaque exécution. Comparaison sur le jsonb COMPLET, octets inclus :
    -- voir l'en-tête de 20261014040000_audit_sans_octets.
    IF avant IS NOT DISTINCT FROM apres THEN
      RETURN NULL;
    END IF;
  ELSE
    avant := NULL;
    apres := to_jsonb(NEW);
    ligne := apres;
    verbe := 'creation';
  END IF;

  -- D202 (9EWB2-AUDIT-SANS-OCTETS) : pour `document` seulement, les octets ne
  -- sont pas recopiés — leur taille et leur empreinte SHA-256 le sont, calculées
  -- sur ce que la ligne contenait RÉELLEMENT. Liste close et gardée dans les
  -- deux sens : `scripts/lib/perimetre-audit.ts`, export
  -- `COLONNES_NON_RECOPIEES_AUDIT`.
  IF TG_TABLE_NAME = 'document' THEN
    IF avant IS NOT NULL THEN
      avant := (avant - 'octets') || jsonb_build_object(
        'octets_taille', octet_length(OLD.octets),
        'octets_sha256', encode(sha256(OLD.octets), 'hex')
      );
    END IF;
    IF apres IS NOT NULL THEN
      apres := (apres - 'octets') || jsonb_build_object(
        'octets_taille', octet_length(NEW.octets),
        'octets_sha256', encode(sha256(NEW.octets), 'hex')
      );
    END IF;
  END IF;

  IF NOT (ligne ? colonne_societe) OR ligne ->> colonne_societe IS NULL THEN
    RAISE EXCEPTION
      'journal_audit : la table « % » n''expose aucune société par la colonne « % ». Le journal ne trace que des lignes cloisonnées (I8, D32) : une ligne d''audit sans société ne pourrait être ni lue ni cloisonnée. Marche à suivre : retirer ce déclencheur de cette table, ou porter au registre des arbitrages la question du journal des référentiels de plateforme — voir docs/decisions/2026-08-29-journal-audit-par-declencheur.md.',
      TG_TABLE_NAME, colonne_societe;
  END IF;

  IF NOT (ligne ? 'id') OR ligne ->> 'id' IS NULL THEN
    RAISE EXCEPTION
      'journal_audit : la table « % » n''expose aucune colonne « id ». Le journal désigne la ligne journalisée par sa clé technique (I10) ; sans elle, l''historique d''une ligne ne peut pas se relire.',
      TG_TABLE_NAME;
  END IF;

  INSERT INTO "journal_audit" (
    "id", "societe_id", "entite", "entite_id", "action",
    "utilisateur_id", "adresse_ip", "valeurs_avant", "valeurs_apres"
  ) VALUES (
    gen_random_uuid(),
    (ligne ->> colonne_societe)::uuid,
    TG_TABLE_NAME,
    (ligne ->> 'id')::uuid,
    verbe,
    NULLIF(current_setting('app.utilisateur_id', true), '')::uuid,
    NULLIF(current_setting('app.adresse_ip', true), ''),
    avant,
    apres
  );

  RETURN NULL;
END
$$;

COMMENT ON FUNCTION "journal_audit_tracer"() IS
  'Écrit une ligne de journal_audit pour toute création, modification ou suppression sur une table du périmètre de I8. SECURITY INVOKER (le défaut) : D50 reste close et vide, et ce ticket montre qu''on s''en passe — ce qu''on protège est la réécriture de l''histoire, pas l''insertion d''une ligne. LÈVE sur une table sans société : c''est ce refus qui tient le périmètre. Depuis D202 (9EWB2-AUDIT-SANS-OCTETS), ne recopie pas document.octets : elle y substitue octets_taille et octets_sha256, calculés sur la ligne réelle.';
