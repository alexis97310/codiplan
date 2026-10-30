-- ═══════════════════════════════════════════════════════════════════════════
-- 9I8-AFFICHAGE-DES-MONTANTS — « Afficher les montants » par société.
-- Demande d'Alexis du 28/10/2026 (audit en équipe, constat M1), option A.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## CE QUE CETTE MIGRATION POSE, ET RIEN D'AUTRE
--
-- Une seule colonne, booléenne : `societe.afficher_montants`. `NOT NULL
-- DEFAULT true` : toutes les sociétés démarrent avec les montants
-- D'INTERVENTION affichés — y compris celles déjà en production —, et seul un
-- admin de société ou la direction peut la décocher (garde SERVEUR dédiée,
-- `app/(back-office)/parametres/societe`).
--
-- Elle ne change ni un calcul ni une facturation : elle gouverne un AFFICHAGE,
-- exactement comme `accesAuxMontants` (`lib/interventions/montants-visibles.ts`,
-- D37) — même famille, même limite. « Masquer un bloc n'empêche personne
-- d'interroger la base » s'applique ici aussi : aucune politique RLS n'est
-- touchée, aucune donnée n'est modifiée.
--
-- Les écrans de PARAMÉTRAGE des prix (tarifs, taux horaire, forfaits,
-- prestations) ne sont pas concernés : cette colonne ne les lit pas.

ALTER TABLE "societe"
  ADD COLUMN "afficher_montants" BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN "societe"."afficher_montants" IS
  'AJOUTÉE le 31/10/2026 (9I8-AFFICHAGE-DES-MONTANTS, demande d''Alexis du 28/10/2026, option A) : affiche (true) ou masque (false) tout montant D''INTERVENTION à l''écran, pour tous les rôles — fiche, bon. Ne change ni le calcul ni la facturation (lecture seule de lib/interventions/depot.ts), et ne concerne pas le paramétrage des prix (tarifs, taux horaire, forfaits, prestations), qui reste visible à ses rôles habituels. `true` par défaut ; modifiable par admin_societe et la direction seulement.';
