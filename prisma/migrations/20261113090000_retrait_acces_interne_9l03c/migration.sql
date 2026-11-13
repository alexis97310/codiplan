-- ═══════════════════════════════════════════════════════════════════════════
-- 9L03C — RETRAIT DE L'ACCÈS D'UN COMPTE INTERNE (décision d'Alexis du
-- 10/11/2026, puis du 13/11/2026 — « Désactiver »).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 9L03A a mesuré, avant tout code, que SUPPRIMER une ligne `utilisateur_societe`
-- se heurte à cinq contraintes `ON DELETE RESTRICT` déjà en production
-- (`technicien_habilitation`, `absence`, `segment_travail` auteur,
-- `intervention_pause` ouvert_par et fermée_par) dès que la personne porte une
-- activité enregistrée — la cible la plus courante du geste demandé. Alexis a
-- tranché : la ligne n'est JAMAIS supprimée, elle se DÉSACTIVE — même patron
-- que `utilisateur_client.actif` (9L04), posé pour la même raison.
--
-- Aucune politique RLS n'est ajoutée : `cloisonnement_societe`, posée sur
-- cette table depuis `20260820120000_rls_policies`, couvre déjà l'UPDATE pour
-- toute ligne de la société active — exactement la portée du geste
-- (`administrer_utilisateurs`, vérifié côté application, jamais par RLS sur
-- cette table). Le déclencheur d'audit (I8, `20260829120000_journal_audit`)
-- est déjà posé `AFTER INSERT OR UPDATE OR DELETE` sur `utilisateur_societe` :
-- cette écriture est donc déjà tracée sans rien ajouter ici.
--
-- Une ligne inactive n'ouvre RIEN — c'est au code applicatif que revient de le
-- faire tenir (`lib/auth/societe-active.ts`, le compte des administrateurs
-- dans `lib/auth/acces-bureau.ts`/`acces-technicien.ts`, …) : aucune des deux
-- écritures de cette migration ne peut, à elle seule, garantir une lecture.

ALTER TABLE "utilisateur_societe" ADD COLUMN "actif" BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN "utilisateur_societe"."actif" IS
  '9L03C — false quand l''accès a été retiré (retirerAccesInterne). La ligne reste : habilitations, absences, segments et pauses continuent de la désigner valablement. Toutes les lignes déjà en base sont reprises comme actives (DEFAULT true), comme la décision le veut : elles décrivaient déjà un accès accordé.';

-- ── LA TRACE — un nouvel événement de `journal_acces` (D32) ─────────────────
--
-- La valeur n'est UTILISÉE par aucune instruction de cette migration : rien
-- ici ne la caste ni ne la compare, elle est seulement ajoutée au type. La
-- contrainte PostgreSQL qui interdit d'UTILISER une valeur neuve dans la
-- transaction qui l'a créée (rencontrée par 9K18) ne s'applique donc pas, et
-- un seul dossier de migration suffit pour les deux écritures de ce lot.

ALTER TYPE "EvenementAcces" ADD VALUE 'retrait_acces_interne';
