-- ═══════════════════════════════════════════════════════════════════════════
-- LA SIGNATURE PORTE LE NOM ET LA QUALITÉ DU SIGNATAIRE (76-BON-4, SAV-10)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Le constat : `intervention_signature` ne disait QUI avait signé pour le
-- client, seulement l'image du tracé et sa date. Deux colonnes NULLABLES —
-- les signatures déjà en base n'ont ni nom ni qualité, et cette migration
-- n'invente rien pour elles. `signataire_nom` devient obligatoire pour toute
-- NOUVELLE signature côté application (`schemaSignature`), jamais en base :
-- la table reste INSERT seul pour le rôle applicatif (BON-2), et ajouter des
-- colonnes ne change rien à ce principe ni à ses politiques RLS.

ALTER TABLE "intervention_signature"
  ADD COLUMN "signataire_nom" TEXT,
  ADD COLUMN "signataire_qualite" TEXT;
