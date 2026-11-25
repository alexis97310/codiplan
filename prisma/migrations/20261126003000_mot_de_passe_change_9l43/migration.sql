-- ═══════════════════════════════════════════════════════════════════════════
-- 9L43-SECURITE-CHANGEMENT-MOT-DE-PASSE — trace du changement de mot de passe.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La valeur n'est UTILISÉE par aucune instruction de cette migration : rien
-- ici ne la caste ni ne la compare, elle est seulement ajoutée au type — même
-- parti pris que 9L03C, pour la même raison (la contrainte PostgreSQL qui
-- interdit d'utiliser une valeur neuve dans la transaction qui l'a créée ne
-- s'applique donc pas ici).

ALTER TYPE "EvenementAcces" ADD VALUE 'mot_de_passe_change';
