-- ════════════════════════════════════════════════════════════════════════════
-- R3-14 — UN BLOCAGE D'AGENDA, ET RIEN DE PLUS.
--
-- **CODIPLAN n'est pas un outil de gestion des ressources humaines.** La
-- décision du 14/09/2026 retire à `absence` tout ce qui n'est pas une période :
-- il ne reste qu'une personne, une date de début, une date de fin — et le seul
-- effet attendu est que le planning ne propose pas cette personne sur ces
-- jours-là.
--
-- ── CE QUI EST RETIRÉ, ET POURQUOI CHAQUE COLONNE L'EST ────────────────────
--
--   `motif` + le type `MotifAbsence`  — `arret` est un arrêt de travail :
--       c'est une DONNÉE DE SANTÉ, sur un salarié nommé, en clair. La forme
--       « interne » (D94) la protège du portail ; elle ne protège de rien à
--       l'intérieur.
--
--   `precision`                       — le champ libre écrivait la MÊME donnée
--       sans l'énumérer. *Un texte libre n'est pas moins nominatif qu'une
--       énumération, il est seulement moins facile à mesurer* — et le retirer
--       en même temps est le seul moyen de ne pas déplacer la donnée d'une
--       colonne à l'autre.
--
--   `statut` + le type `StatutAbsence` — un cycle demandée → validée → refusée
--       est un CIRCUIT D'APPROBATION DE CONGÉS, c'est-à-dire l'outil RH
--       lui-même. **Le blocage devient donc IMMÉDIAT** : une ligne existe,
--       l'agenda est bloqué.
--
-- **LE MOMENT EST LE SEUL OÙ CE GESTE EST GRATUIT, ET C'EST MESURÉ.** `absence`
-- compte ZÉRO ligne — en base de démonstration comme en base hébergée. On peut
-- toujours AJOUTER une colonne plus tard ; on ne peut jamais DÉ-enregistrer ce
-- qui a été écrit, et une donnée de santé écrite une fois ne se retire pas d'un
-- journal d'audit (I8) ni d'une sauvegarde. *Une échéance qui tombe au pire
-- moment est un report déguisé* (§9, 30/08) : ici le pire moment serait le
-- premier arrêt de travail réellement saisi.
--
-- **LE COÛT, NOMMÉ** : plus rien ne distingue une indisponibilité pressentie
-- d'une indisponibilité arrêtée. Qui pose la ligne l'arrête ; qui se trompe la
-- supprime. *Réouverture : le jour où une indisponibilité doit être PROPOSÉE
-- avant d'être opposable à un client.*
--
-- ── CE QUE CETTE MIGRATION NE FAIT PAS ─────────────────────────────────────
--
-- Elle ne LIT aucune table, et c'est délibéré : elle n'a donc aucun bloc de
-- garde, donc aucun risque de compter sous `FORCE ROW LEVEL SECURITY` en
-- croyant mesurer (§9, 07/09). Ce qu'elle retire, elle le retire sans condition.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. LA NATURE, LE CHAMP LIBRE ET LE STATUT S'EN VONT ────────────────────
--
-- `absence_precision_si_autre` liait `precision` à `motif` : elle part avec ses
-- deux colonnes. La nommer ici plutôt que de compter sur la cascade est une
-- décision — une contrainte qu'on laisse disparaître en silence est une
-- contrainte dont personne ne relit le retrait.

ALTER TABLE "absence" DROP CONSTRAINT "absence_precision_si_autre";

ALTER TABLE "absence" DROP COLUMN "motif";
ALTER TABLE "absence" DROP COLUMN "precision";
ALTER TABLE "absence" DROP COLUMN "statut";

DROP TYPE "MotifAbsence";
DROP TYPE "StatutAbsence";

COMMENT ON TABLE "absence" IS
  'UN BLOCAGE D''AGENDA : la période où quelqu''un n''est pas disponible (L3-04, R3-14, RG-PLA-06). Une personne, une date de début, une date de fin, et RIEN D''AUTRE — ni nature, ni motif, ni champ libre, ni historique de statut : CODIPLAN n''est pas un outil de gestion des ressources humaines. Table métier de la première catégorie de I1, forme « INTERNE » (D94) : société ET app.client_id absent. Aucun compte de portail ne la lit, et ce n''est pas une précaution — savoir que telle personne n''est pas là du 14 au 28 reste une information sur une personne nommée, même dépouillée de sa cause. Ce qu''un client a le droit de savoir est que SON rendez-vous bouge : cela se lit sur l''intervention.';

COMMENT ON COLUMN "absence"."du" IS
  'Première journée bloquée, COMPRISE.';

COMMENT ON COLUMN "absence"."au" IS
  'Dernière journée bloquée, COMPRISE. Une borne ouverte aurait fait travailler quelqu''un le dernier jour de son indisponibilité.';

-- ── 2. UN TECHNICIEN BLOQUE SON PROPRE AGENDA, JAMAIS CELUI D'UN AUTRE ──────
--
-- Les autres rôles internes saisissent pour un tiers — c'est l'ADV qui
-- enregistre l'appel du matin —, et ce déclencheur ne les vise pas.
--
-- **CE QU'IL NE TIENT PLUS, ET IL FAUT L'ÉCRIRE.** Tant qu'un statut existait,
-- un technicien pouvait demander sans que cela déplanifie quoi que ce soit :
-- l'encadrement tranchait. **Le blocage étant désormais immédiat, un technicien
-- qui pose son propre blocage rend à la file ses propres interventions.** Ce
-- n'est pas un oubli, c'est la conséquence directe du retrait du statut, et
-- elle est laissée en l'état plutôt que remplacée par une garde que personne
-- n'a demandée. *Réouverture : le jour où l'on dira qui, dans la société, a le
-- droit de vider un agenda.*
--
-- `app.utilisateur_id` est posée par le chemin de production : c'est la même
-- variable que lit le journal d'audit (I8). Vide, elle ne peut être égale à
-- aucun identifiant, donc le défaut est le REFUS et jamais la permission.

CREATE FUNCTION "absence_declaree_pour_soi"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.role', true) = 'technicien'
     AND NEW."utilisateur_id"::text IS DISTINCT FROM current_setting('app.utilisateur_id', true) THEN
    RAISE EXCEPTION
      'absence_declaree_pour_soi — Un technicien bloque son propre agenda, jamais celui d''un autre.'
      USING ERRCODE = 'insufficient_privilege',
            CONSTRAINT = 'absence_declaree_pour_soi';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "declaree_pour_soi"
  BEFORE INSERT ON "absence"
  FOR EACH ROW EXECUTE FUNCTION "absence_declaree_pour_soi"();

-- ── 3. LE VERROU DE CHEVAUCHEMENT TRAITE UN BLOCAGE COMME UNE OCCUPATION ────
--
-- La moitié qui DÉPLANIFIE existait et était éprouvée : poser un blocage rend à
-- la file les interventions posées, dans la même transaction. **Celle qui
-- manquait est l'autre bout** : rien n'empêchait de poser une intervention sur
-- un blocage déjà en place depuis un chemin qui ne passe pas par
-- `lib/interventions/pose.ts`. *Une garantie qui ne vit que dans la couche
-- applicative n'en est pas une* (I1).
--
-- **TOUTE ligne d'`absence` bloque désormais**, le statut ayant disparu : il n'y
-- a plus de moitié qui ne bloque pas encore. Le contrôle TypeScript demeure — il
-- rend un motif NOMMÉ que l'écran affiche, là où le déclencheur rend un refus.
-- *Les deux ne se doublent pas : l'un explique, l'autre garde.*
--
-- Les bornes sont COMPRISES des deux côtés : un blocage du 14 au 28 couvre le 14
-- et le 28.
--
-- **IL EST POSÉ EN `AFTER`, ET C'EST MESURÉ PLUTÔT QUE COPIÉ.** Le §9 du
-- 14/09 dit qu'un gardien de base se lit sur deux axes, et que le second
-- s'oublie : *par quel VERBE écrit-on, et est-ce celui de la production ?* Sous
-- `upsert` — un seul `INSERT … ON CONFLICT DO UPDATE` —, PostgreSQL lève
-- `BEFORE INSERT` sur la ligne CANDIDATE, qui porte les valeurs du bloc
-- `create`, avant de découvrir le conflit. Un `BEFORE` refuserait donc un
-- `upsert` dont le bloc `create` porte une date bloquée alors que la branche
-- réellement exécutée est celle du bloc `update` : **un refus sur une écriture
-- qui n'a pas lieu.** En `AFTER`, la branche du conflit ne lève que les
-- événements de la MISE À JOUR, dont le `NEW` est la ligne RÉELLE. Un `AFTER`
-- qui lève une exception annule la commande exactement comme un `BEFORE` : la
-- différence est interne à la transaction, jamais visible d'un appelant.
--
-- **CE N'EST PAS UN RAISONNEMENT RECOPIÉ DE #188 : IL A ÉTÉ REJOUÉ ICI.** Sur
-- PostgreSQL 16.13, le 14/09/2026, avec une ligne existante datée d'un jour
-- LIBRE, un `INSERT … ON CONFLICT DO UPDATE` dont la partie insérée porte une
-- date BLOQUÉE et dont le `DO UPDATE` ne touche pas la date :
--
--     BEFORE INSERT OR UPDATE   → REFUSE  — « l'agenda est bloqué ce jour-là »
--     AFTER  INSERT OR UPDATE   → ACCEPTE — aucune erreur
--
-- *Le refus de la première ligne porte sur une écriture qui n'a jamais eu
-- lieu.* Le scénario qui le tient est « UPSERT avec conflit vers un jour LIBRE »
-- dans `tests/isolation/blocage-agenda-verrous.test.ts`.
--
-- Il ne se déclenche QUE si une date est posée : la déplanification écrit
-- `date_planifiee = NULL`, et elle doit rester possible — c'est elle qui répare
-- l'état, pas elle qui le crée.
--
-- **AUCUN `SECURITY DEFINER`, ET LA LIMITE QUI EN DÉCOULE S'ÉCRIT.** Il lit
-- `absence` sous les politiques de l'appelant. Pour le rôle applicatif, qui
-- écrit toujours sous un contexte de société posé, la table est entièrement
-- visible et le contrôle est complet ; pour le PROPRIÉTAIRE sous
-- `FORCE ROW LEVEL SECURITY` et sans contexte, la lecture rend zéro ligne et le
-- contrôle S'ABSTIENT (§9, 07/09). C'est assumé : le seul appelant que ce cas
-- décrit est celui qui peut de toute façon supprimer le déclencheur, et le seul
-- remède serait un `SECURITY DEFINER`, qu'un gardien statique refuse avec une
-- liste d'exceptions close et vide (D50).

CREATE FUNCTION "intervention_pas_sur_blocage_agenda"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."date_planifiee" IS NOT NULL
     AND NEW."technicien_id" IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM "absence" AS "a"
        WHERE "a"."utilisateur_id" = NEW."technicien_id"
          AND NEW."date_planifiee" BETWEEN "a"."du" AND "a"."au"
     ) THEN
    RAISE EXCEPTION
      'intervention_pas_sur_blocage_agenda — L''agenda de ce technicien est bloqué ce jour-là. Choisir une autre date, une autre personne, ou lever le blocage d''abord.'
      USING ERRCODE = 'check_violation',
            CONSTRAINT = 'intervention_pas_sur_blocage_agenda';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "pas_sur_blocage_agenda"
  AFTER INSERT OR UPDATE ON "intervention"
  FOR EACH ROW EXECUTE FUNCTION "intervention_pas_sur_blocage_agenda"();

-- ── 4. CE QUE CETTE MIGRATION NE RELIT PAS ─────────────────────────────────
--
-- Aucune ligne existante : un déclencheur ne s'applique qu'aux écritures. C'est
-- le raisonnement de D104 — *une ligne ancienne qu'on TOUCHE doit se mettre en
-- règle, et c'est le seul moment où quelqu'un est là pour en décider.* Ici la
-- question est théorique : `absence` compte zéro ligne, et aucune intervention
-- ne peut donc chevaucher un blocage.
