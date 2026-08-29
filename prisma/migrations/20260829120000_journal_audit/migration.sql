-- CODIPLAN — Journal d'audit écrit par déclencheur, en ajout seul
-- (ticket L0-10 ; invariant I8 ; arbitrages D32 et D50 ; chapitre 11.2).
--
-- ── CE QUE CETTE MIGRATION ÉTABLIT ─────────────────────────────────────────
--
-- 1. `journal_audit` — table métier (PREMIÈRE catégorie de I1) : `societe_id`
--    NOT NULL, politique de cloisonnement, FORCE ROW LEVEL SECURITY.
-- 2. Un déclencheur unique, posé sur chaque table du périmètre de I8. Le
--    journal n'est PAS écrit par le code applicatif : aucun chemin d'écriture
--    — service, script, import Excel, correction manuelle en `psql` — ne peut
--    y échapper. C'est le principe de L0-04 (le filtrage ne vaut que là où
--    tous les chemins passent) et de D51 (le rendu est le point de passage
--    obligé), appliqué une troisième fois.
-- 3. L'AJOUT SEUL : le rôle applicatif reçoit `SELECT` et `INSERT`, et se voit
--    retirer `UPDATE`, `DELETE` et `TRUNCATE`. Deux verrous indépendants, en
--    fait : les privilèges, et l'absence de toute politique pour ces trois
--    verbes sous FORCE RLS.
--
-- ── PAS DE `SECURITY DEFINER`, ET C'EST TRANCHÉ ────────────────────────────
--
-- La forme classique d'un journal inaltérable est un déclencheur appartenant au
-- propriétaire et exécuté avec ses droits, de sorte que le rôle applicatif
-- puisse faire écrire une ligne sans jamais pouvoir en écrire une lui-même.
-- D50 interdit ce mécanisme, sa liste d'exceptions est CLOSE ET VIDE, et le
-- ticket L0-10 ne l'ouvre pas.
--
-- Le raisonnement, et il vaut d'être écrit ici plutôt que dans une décision que
-- personne ne rouvre : **ce contre quoi nous protégeons est la RÉÉCRITURE de
-- l'histoire, pas l'insertion d'une ligne.** Une application compromise peut
-- déjà mentir dans les tables métier — et le journal enregistrerait fidèlement
-- son mensonge, ce qui est exactement ce qu'on lui demande. Ce qu'elle ne doit
-- pas pouvoir faire, c'est revenir effacer sa trace. La propriété qui compte
-- est donc l'ajout seul, et `INSERT` sans `UPDATE` ni `DELETE` la donne, sous
-- `SECURITY INVOKER` — le défaut de PostgreSQL, celui qu'on ne demande pas.
--
-- Conséquence assumée, écrite pour qu'elle ne passe pas pour un oubli : le rôle
-- applicatif peut insérer une ligne d'audit à la main, sans qu'aucune écriture
-- métier ne l'ait causée. C'est un ajout, donc réversible par la lecture — la
-- ligne fabriquée se voit —, là où une suppression ne l'est pas. Ce ticket
-- montre ainsi qu'on peut se passer de `SECURITY DEFINER` sans rien perdre de
-- la garantie recherchée.
--
-- ── LE PÉRIMÈTRE, ET POURQUOI IL S'ARRÊTE LÀ ───────────────────────────────
--
-- I8, aligné par D32 : « intervention, contrat, machine, paramétrage société,
-- compte client ». Aujourd'hui, seules existent les tables de paramétrage
-- société — `societe`, `agence`, `calendrier`, `calendrier_plage`,
-- `calendrier_ferie` — et le compte client `utilisateur_client` (D10).
-- `intervention` (L2-07), `machine` (L2-01) et `contrat` (lot 4) rejoindront ce
-- déclencheur quand elles seront créées, et le gardien
-- `tests/unit/db/perimetre-audit.test.ts` le RÉCLAME le jour où elles
-- apparaissent au schéma : c'est la leçon du 20/08 — une liste close se
-- re-vérifie à chaque table créée, sinon elle devient fausse.
--
-- Les référentiels de plateforme — `devise`, `parite`, `jour_ferie` — n'ont
-- jamais figuré à ce périmètre et n'y entrent pas. Ils n'ont pas de société à
-- porter, et le déclencheur ci-dessous REFUSE de s'exécuter sur une table qui
-- n'en expose aucune : la limite est tenue par la base, pas par une intention.
-- Les trois voies possibles sont mesurées dans
-- docs/decisions/2026-08-29-journal-audit-par-declencheur.md ; deux d'entre
-- elles exigent un arbitrage, et aucune liste close n'est élargie ici.

-- ── 1. La table ────────────────────────────────────────────────────────────
--
-- AUCUNE CLÉ ÉTRANGÈRE, ni sur `societe_id` ni sur `utilisateur_id`, et c'est
-- délibéré : le journal doit SURVIVRE à ce qu'il décrit. Une clé vers `societe`
-- rendrait la suppression d'une société soit impossible, soit non
-- journalisable — le déclencheur `AFTER DELETE` écrirait une ligne désignant
-- une société qui n'existe plus, et la clé refuserait l'écriture même qu'elle
-- est censée garantir. L'intégrité vient d'ailleurs et elle suffit : la valeur
-- est recopiée de la ligne source, dont la clé étrangère était contrôlée au
-- moment de l'écriture.
--
-- La règle du CLAUDE.md §9 — « toute clé étrangère nouvelle dit ses DEUX
-- actions et les justifie » — est donc honorée par la négative : il n'y en a
-- aucune, et voici pourquoi.

CREATE TYPE "ActionAudit" AS ENUM ('creation', 'modification', 'suppression');

CREATE TABLE "journal_audit" (
  "id"             uuid PRIMARY KEY,
  "societe_id"     uuid NOT NULL,
  "entite"         text NOT NULL,
  "entite_id"      uuid NOT NULL,
  "action"         "ActionAudit" NOT NULL,
  "horodatage"     timestamptz(6) NOT NULL DEFAULT now(),
  "utilisateur_id" uuid,
  "adresse_ip"     text,
  "valeurs_avant"  jsonb,
  "valeurs_apres"  jsonb
);

-- L'usage réel du ticket : « qui a changé ce statut d'intervention, et depuis
-- quelle valeur » — une entité, son identifiant, dans l'ordre du temps.
CREATE INDEX "journal_audit_societe_id_entite_entite_id_horodatage_idx"
  ON "journal_audit" ("societe_id", "entite", "entite_id", "horodatage");

-- Le journal filtrable de la console d'administration (§10.1).
CREATE INDEX "journal_audit_societe_id_horodatage_idx"
  ON "journal_audit" ("societe_id", "horodatage");

COMMENT ON TABLE "journal_audit" IS
  'Journal d''audit inaltérable (I8, D32). Écrit par le déclencheur journal_audit_tracer, jamais par le code applicatif. EN AJOUT SEUL : le rôle applicatif n''a ni UPDATE ni DELETE, et aucune politique ne les autorise. Pas de clé étrangère : le journal survit à ce qu''il décrit.';

COMMENT ON COLUMN "journal_audit"."utilisateur_id" IS
  'Auteur, lu dans app.utilisateur_id. NULL quand l''écriture vient d''un chemin sans session (seed, migration, correction manuelle) : le journal le dit plutôt que d''inventer un compte. La ligne existe quand même.';

-- ── 2. Cloisonnement : la lecture d'audit n'apprend rien d'une autre société ─
--
-- Le journal est soumis au cloisonnement comme le reste (I1), et le principe de
-- D50 s'y applique directement : ce qu'une lecture d'audit donne à lire est une
-- réponse, et se compte comme telle.
--
-- DEUX politiques plutôt qu'une, parce que la lecture et l'ajout n'ont pas les
-- mêmes ayants droit :
--
--   — `journal_audit_ajout` (INSERT) : la société de la ligne, et rien de plus.
--     Tout rôle peut CAUSER une ligne d'audit, puisque tout rôle peut écrire
--     dans les tables qu'il a le droit d'écrire. Exiger ici un rôle particulier
--     rendrait le journal facultatif — l'écriture métier échouerait faute de
--     pouvoir se journaliser, ce qui reviendrait à laisser le choix entre
--     tracer et écrire.
--
--   — `journal_audit_lecture` (SELECT) : la société de la ligne ET un rôle
--     habilité. La matrice du §5.2 fait foi et n'accorde « Consulter le journal
--     d'audit » qu'à `admin_societe` et `direction` ; `lib/auth/habilitations.ts`
--     la transcrit déjà côté applicatif. C'est la deuxième barrière du §12.2 :
--     la même règle, dite une seconde fois par la base.
--
-- Ni politique `UPDATE` ni politique `DELETE` : sous FORCE ROW LEVEL SECURITY,
-- leur absence vaut refus pour tout le monde, propriétaire compris. Les
-- privilèges de l'étape 4 disent la même chose une seconde fois — et c'est
-- voulu : deux verrous indépendants, dont l'un se lit dans
-- `information_schema` et l'autre dans `pg_policies`.
--
-- La branche `OR societe_id IS NULL` de la forme imposée par D4 est
-- délibérément ABSENTE : `societe_id` est `NOT NULL` ici, la branche serait
-- morte — et une branche morte dans une politique de lecture est exactement ce
-- qui deviendrait un laissez-passer le jour où quelqu'un rendrait la colonne
-- nullable. `societe` avait déjà écarté cette branche pour la même raison
-- (politique `cloisonnement_identite`, L0-04).

CREATE FUNCTION "app_peut_consulter_journal_audit"() RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path = pg_catalog, public
  AS $$
    SELECT COALESCE("app_role"() IN ('admin_societe', 'direction'), false)
  $$;

COMMENT ON FUNCTION "app_peut_consulter_journal_audit"() IS
  'Vrai si le rôle courant peut consulter le journal d''audit — matrice §5.2, ligne « Consulter le journal d''audit » : admin_societe et direction. Transcrite aussi dans lib/auth/habilitations.ts ; un test compare les deux.';

ALTER TABLE "journal_audit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journal_audit" FORCE ROW LEVEL SECURITY;

CREATE POLICY "journal_audit_lecture" ON "journal_audit"
  FOR SELECT
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND "app_peut_consulter_journal_audit"()
  );

CREATE POLICY "journal_audit_ajout" ON "journal_audit"
  FOR INSERT
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  );

-- ── 3. Le déclencheur ──────────────────────────────────────────────────────
--
-- `SECURITY INVOKER` — le défaut, et il n'est pas écrit parce qu'on ne demande
-- pas ce qu'on ne veut pas. Voir l'en-tête : D50 reste close et vide.
--
-- Un seul corps de fonction pour toutes les tables du périmètre. Le nom de la
-- colonne portant la société est passé en ARGUMENT du déclencheur
-- (`TG_ARGV[0]`), et vaut `societe_id` partout sauf sur `societe` elle-même, où
-- il vaut `id` : c'est l'exception `CLOISONNEE_PAR_IDENTITE` de D42, déjà
-- nommée par la constitution — un argument de pose, pas une liste close de
-- plus.
--
-- LE REFUS QUI TIENT LE PÉRIMÈTRE. Si la table n'expose pas la colonne
-- attendue, ou si sa valeur est nulle, la fonction LÈVE au lieu d'écrire une
-- ligne orpheline. C'est ce refus qui fait de « le journal ne couvre pas les
-- référentiels de plateforme » un fait de la base et non une intention : poser
-- ce déclencheur sur `devise`, `parite` ou `jour_ferie` casse la première
-- écriture, en nommant la table. Le message dit ce qui bloque et la marche à
-- suivre, sans rien compter ni nommer d'une autre société (D50).

CREATE FUNCTION "journal_audit_tracer"() RETURNS trigger
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
    -- chaque exécution.
    IF avant IS NOT DISTINCT FROM apres THEN
      RETURN NULL;
    END IF;
  ELSE
    avant := NULL;
    apres := to_jsonb(NEW);
    ligne := apres;
    verbe := 'creation';
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
  'Écrit une ligne de journal_audit pour toute création, modification ou suppression sur une table du périmètre de I8. SECURITY INVOKER (le défaut) : D50 reste close et vide, et ce ticket montre qu''on s''en passe — ce qu''on protège est la réécriture de l''histoire, pas l''insertion d''une ligne. LÈVE sur une table sans société : c''est ce refus qui tient le périmètre.';

-- ── 4. Le périmètre de I8, table par table ─────────────────────────────────
--
-- « Paramétrage société » : la société elle-même et tout ce qui la paramètre —
-- ses agences et ses calendriers, dont les écarts de jours fériés (D46). Le
-- déclencheur est posé AFTER : la ligne d'audit ne s'écrit qu'une fois
-- l'écriture métier acceptée, contraintes comprises.

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "societe"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"('id');

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "agence"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "calendrier"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "calendrier_plage"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "calendrier_ferie"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

-- « Compte client » : le compte portail rattaché à un client (D10).
CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "utilisateur_client"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

-- CE QUI RESTE HORS DE PORTÉE, ET QUI SE DIT PLUTÔT QUE SE TAIT. Un déclencheur
-- `FOR EACH ROW` ne voit pas `TRUNCATE` : la commande vide la table sans passer
-- par les lignes, et aucune ligne d'audit n'est écrite. La borne est étroite et
-- elle est connue : `TRUNCATE` relève de la PROPRIÉTÉ de la table, si bien que
-- `codiplan_app` — qui n'est pas propriétaire — ne peut pas l'exécuter. Seuls
-- une migration et `scripts/purge-demonstration.mts` le peuvent, tous deux sous
-- le rôle propriétaire et hors de tout chemin applicatif.
--
-- Un déclencheur `FOR EACH STATEMENT ON TRUNCATE` n'y changerait rien d'utile :
-- il ne verrait AUCUNE ligne, donc ni valeurs avant, ni identifiant, ni société.
-- Il ne pourrait écrire qu'une ligne sans société — c'est-à-dire précisément ce
-- que la voie retenue au point 4 du ticket refuse. Écrire la limite vaut mieux
-- que la combler par une ligne qui ne dirait rien.

-- ── 5. L'AJOUT SEUL, par les privilèges ────────────────────────────────────
--
-- Le REVOKE n'est pas décoratif : `ALTER DEFAULT PRIVILEGES` (migration
-- 20260820130000) accorde d'avance SELECT, INSERT, UPDATE et DELETE au rôle
-- applicatif sur toute table créée ensuite. `journal_audit` reçoit donc les
-- quatre à sa création, et deux lui sont retirés ici. TRUNCATE n'est pas dans
-- les privilèges par défaut, mais il est retiré quand même : un journal vidé
-- d'un coup est pire qu'un journal corrigé ligne à ligne.
--
-- Même forme que `journal_acces` (migration 20260820150000, D34), et pour la
-- même raison. Ce qui change ici, c'est le CONTRÔLE PERMANENT : le jour où un
-- droit d'écriture réapparaît — un `GRANT ... ON ALL TABLES` distrait, un
-- correctif appliqué à la main sur la base hébergée —,
-- `scripts/controle-cloisonnement.mts` échoue, en le lisant dans
-- `information_schema.role_table_grants` et non dans une déclaration (D38).

GRANT SELECT, INSERT ON "journal_audit" TO "codiplan_app";
REVOKE UPDATE, DELETE, TRUNCATE ON "journal_audit" FROM "codiplan_app";
