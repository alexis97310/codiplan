-- CODIPLAN — Le logo de la société, EN BASE (décision n° 87 d'Alexis,
-- 13/10/2026, 9EZ-LOGO-SOCIETE-1). Amende D167 (« Charte de la société retirée
-- jusqu'au lot 7 ») pour le SEUL bloc Logo : /parametres/societe rouvre pour
-- ce bloc, les couleurs restent fermées jusqu'au lot 7.
--
-- ── CE QUI A ÉTÉ MESURÉ ─────────────────────────────────────────────────────
--
-- `lib/documents/stockage.ts` écrit sous `process.cwd()/.donnees-locales`, non
-- inscriptible sur l'hébergeur (9EWB-PHOTOS-EN-BASE, 20261014030000) : ni ce
-- lot ni le précédent n'y stockent quoi que ce soit. Même choix que la photo
-- du technicien et la signature : EN BASE, borné, revu le jour où le volume
-- l'exige — `lib/documents/stockage.ts` restant l'interface prête pour ce
-- jour-là.
--
-- Le rôle applicatif `codiplan_app` détient déjà `GRANT SELECT, INSERT,
-- UPDATE, DELETE ON ALL TABLES IN SCHEMA "public"` (20260820130000) : aucun
-- GRANT supplémentaire n'est nécessaire pour écrire ces trois colonnes. La
-- politique RLS `cloisonnement_identite` (20260820120000, `id =
-- app.societe_id`, sans clause `FOR` — donc posée sur UPDATE comme sur
-- SELECT) borne déjà l'écriture à la société active : aucune politique
-- nouvelle n'est nécessaire non plus.

ALTER TABLE "societe"
  ADD COLUMN "logo_octets" BYTEA,
  ADD COLUMN "logo_type" TEXT,
  ADD COLUMN "logo_empreinte" TEXT;

-- Le type est reconnu aux octets magiques du fichier (jamais annoncé par le
-- navigateur, `lib/documents/formats-image.ts`) : PNG ou JPEG, jamais de SVG
-- (script embarqué) ni de GIF.
ALTER TABLE "societe"
  ADD CONSTRAINT "societe_logo_type_reconnu"
  CHECK ("logo_type" IS NULL OR "logo_type" IN ('image/png', 'image/jpeg'));

-- Les trois colonnes sont solidaires : un logo ne peut pas avoir ses octets
-- sans son type, ou son empreinte sans ses octets — un mélange laisserait un
-- `GET /api/societe/logo` servir un `Content-Type` qui ne correspond à rien.
ALTER TABLE "societe"
  ADD CONSTRAINT "societe_logo_complet"
  CHECK (
    num_nonnulls("logo_octets", "logo_type", "logo_empreinte") = 0
    OR num_nonnulls("logo_octets", "logo_type", "logo_empreinte") = 3
  );

-- 300 Ko (décision n° 87), rendu impossible à dépasser même par un chemin qui
-- oublierait de le vérifier en amont — même doctrine que
-- `document_octets_plafond` (20261014030000).
ALTER TABLE "societe"
  ADD CONSTRAINT "societe_logo_plafond"
  CHECK ("logo_octets" IS NULL OR octet_length("logo_octets") <= 307200);

-- L'empreinte SHA-256, hexadécimal minuscule — même forme que
-- `document.empreinte` (`lib/documents/saisie.ts`, `empreinteSha256`).
ALTER TABLE "societe"
  ADD CONSTRAINT "societe_logo_empreinte_forme"
  CHECK ("logo_empreinte" IS NULL OR "logo_empreinte" ~ '^[0-9a-f]{64}$');

COMMENT ON COLUMN "societe"."logo_octets" IS
  'Le logo de la société, EN BASE (D87, 9EZ-LOGO-SOCIETE-1). NULL = aucun logo déposé ; la barre et le bon affichent alors le nom seul.';

COMMENT ON COLUMN "societe"."logo_type" IS
  'Le type RÉEL du logo (image/png ou image/jpeg), reconnu à ses octets magiques — jamais annoncé par le navigateur.';

COMMENT ON COLUMN "societe"."logo_empreinte" IS
  'SHA-256 hexadécimal minuscule des octets du logo. Sert d''ETag à GET /api/societe/logo et de clé de cache côté client (?v=<empreinte>).';
