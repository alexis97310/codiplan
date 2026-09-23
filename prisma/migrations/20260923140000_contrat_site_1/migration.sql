-- ═══════════════════════════════════════════════════════════════════════════
-- CONTRAT-SITE-1 — une case « sous contrat de maintenance » sur le site.
-- Demande d'Alexis, arbitrage rendu le 23/09/2026.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## CE QUE CETTE MIGRATION POSE, ET RIEN D'AUTRE
--
-- Une seule colonne, booléenne : `site.sous_contrat`. Le vrai module Contrats
-- (chapitre 7/M3 ; `docs/maquette/codiplan-maquette-complete.html`,
-- fonction `contrats()`, « Module futur · lot 4 ») reste REPORTÉ — aucune
-- date, aucune référence, aucun montant, aucune table de contrat. Cocher cette
-- case dit seulement que le site EST couvert, jamais depuis quand ni jusqu'à
-- quand.
--
-- `NOT NULL DEFAULT false` : tous les sites démarrent DÉCOCHÉS, y compris ceux
-- déjà en production. C'est Alexis qui cochera lui-même les sites concernés
-- après mise en ligne — cette migration ne coche aucun site réel (I9).
--
-- Le cloisonnement (RLS) de `site` n'est pas touché : cette colonne est une
-- colonne de plus sur une table déjà en forme « parc », pas une nouvelle
-- relation. Aucune politique nouvelle, aucune forme nouvelle.

ALTER TABLE "site"
  ADD COLUMN "sous_contrat" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "site"."sous_contrat" IS
  'AJOUTÉE le 23/09/2026 (CONTRAT-SITE-1) : sous contrat de maintenance. Une case, et rien de plus — le vrai module Contrats (chapitre 7/M3) reste reporté. `false` par défaut ; tous les sites démarrent décochés, y compris ceux déjà en production (I9) — c''est Alexis qui coche.';
