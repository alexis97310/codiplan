-- CODIPLAN — Les photos du technicien, réduites sur le téléphone, gardées
-- EN BASE (décision n° 96 d'Alexis, 13/10/2026, 9EWB-PHOTOS-EN-BASE).
--
-- ── LA DÉCISION ─────────────────────────────────────────────────────────
--
-- En testant l'application technicien en production, une photo n'a pas été
-- gardée. Cause mesurée : `lib/documents/stockage.ts` écrit sous
-- `process.cwd()/.donnees-locales/objets`, non inscriptible sur l'hébergeur
-- → exception non attrapée → page d'erreur 500, photo perdue. Le stockage
-- S3-compatible visé par L8-05/L0-09 n'a toujours aucun appelant construit.
--
-- Décision : réduire la photo sur le téléphone (~1600 px de plus grand
-- côté, JPEG qualité ~0,8) et la garder EN BASE, comme la signature
-- (`intervention_signature.image_base64`) et le logo (D87). À revoir le
-- jour où le volume l'exige (stockage dédié) — `octets` redevient NULL pour
-- les nouveaux dépôts ce jour-là, `lib/documents/stockage.ts` étant déjà
-- l'interface prête pour ça (BON-2).
--
-- `objet_cle` reste NOT NULL : pour un objet en base, c'est `'bd:' ||
-- empreinte`, jamais une clé de fichier qui n'existe pas.

ALTER TABLE "document"
  ADD COLUMN "octets" BYTEA;

COMMENT ON COLUMN "document"."octets" IS
  'Les octets de la photo, réduite sur le téléphone (D96). NULL pour un document dont les octets vivent ailleurs (`lib/documents/stockage.ts`, aujourd''hui un dos-d''âne local) — la clé `objet_cle` reste la référence dans ce cas.';

-- `octets` est cohérent avec `taille_octets` quand il est présent : la même
-- colonne ne peut pas raconter deux tailles.
ALTER TABLE "document"
  ADD CONSTRAINT "document_octets_taille_coherente"
  CHECK (octets IS NULL OR octet_length(octets) = taille_octets);

-- Le plafond d'une photo réduite (~1600 px, JPEG ~0,8) tient largement sous
-- 1 Mo (mesuré) ; la contrainte le rend impossible à dépasser même par un
-- chemin qui oublierait de le vérifier en amont.
ALTER TABLE "document"
  ADD CONSTRAINT "document_octets_plafond"
  CHECK (octets IS NULL OR octet_length(octets) <= 1048576);
