-- CODIPLAN — Le journal d'audit ne recopie pas non plus les octets du logo
-- (9EZ-LOGO-SOCIETE-1, décision n° 101 du Projet — D202 amendée). Même
-- raisonnement que `document.octets` (20261014040000, 9EWB2-AUDIT-SANS-
-- OCTETS) : `societe.logo_octets` peut peser jusqu'à 300 Ko, et le journal,
-- en ajout seul, ne purge jamais.
--
-- La ligne d'audit porte désormais `logo_octets_taille` (`octet_length`) et
-- `logo_octets_sha256` (`encode(sha256(…), 'hex')`) à la place des octets
-- bruts, pour les écritures sur `societe` SEULEMENT, et pour la colonne
-- `logo_octets` SEULEMENT. `societe.logo_empreinte` existe déjà mais n'est
-- pas réutilisée ici, pour la même raison que `document.empreinte` ne l'est
-- pas : elle dit ce que l'appelant prétend avoir déposé, pas ce que la ligne
-- jsonb contenait RÉELLEMENT au moment de l'écriture (voir l'en-tête de
-- 20261014040000).
--
-- Même ordre imposé que la migration précédente : `avant`/`apres` complets
-- d'abord, comparaison « ligne identique » sur ces jsonb COMPLETS ensuite,
-- SEULEMENT APRÈS la substitution par table. Entrée correspondante dans
-- `COLONNES_NON_RECOPIEES_AUDIT` (`scripts/lib/perimetre-audit.ts`).

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

  -- D202 amendée (9EZ-LOGO-SOCIETE-1) : même substitution, pour `societe` et
  -- sa colonne `logo_octets` seulement.
  IF TG_TABLE_NAME = 'societe' THEN
    IF avant IS NOT NULL THEN
      avant := (avant - 'logo_octets') || jsonb_build_object(
        'logo_octets_taille', octet_length(OLD.logo_octets),
        'logo_octets_sha256', encode(sha256(OLD.logo_octets), 'hex')
      );
    END IF;
    IF apres IS NOT NULL THEN
      apres := (apres - 'logo_octets') || jsonb_build_object(
        'logo_octets_taille', octet_length(NEW.logo_octets),
        'logo_octets_sha256', encode(sha256(NEW.logo_octets), 'hex')
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
  'Écrit une ligne de journal_audit pour toute création, modification ou suppression sur une table du périmètre de I8. SECURITY INVOKER (le défaut) : D50 reste close et vide, et ce ticket montre qu''on s''en passe — ce qu''on protège est la réécriture de l''histoire, pas l''insertion d''une ligne. LÈVE sur une table sans société : c''est ce refus qui tient le périmètre. Depuis D202 (9EWB2-AUDIT-SANS-OCTETS, amendée par 9EZ-LOGO-SOCIETE-1), ne recopie pas document.octets ni societe.logo_octets : elle y substitue leur taille et leur SHA-256, calculés sur la ligne réelle.';
