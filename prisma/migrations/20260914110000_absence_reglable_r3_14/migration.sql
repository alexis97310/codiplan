-- ════════════════════════════════════════════════════════════════════════════
-- R3-14 — DÉCLARER UNE ABSENCE : ce que la BASE garde, et qu'un écran ne peut
-- pas garder à sa place.
--
-- Trois verrous, trois questions du ticket, et aucun n'est du confort :
--
--   1. **la NATURE d'une absence ne s'écrit plus** — décision PROVISOIRE de
--      l'exploitation, en attente de ratification (voir R3-14) ;
--   2. **décider appartient à l'encadrement**, et déclarer pour autrui n'est
--      pas ouvert à un technicien ;
--   3. **on ne POSE pas sur une absence validée** — RG-PLA-06 n'était tenue
--      qu'en TypeScript, et *une garantie qui ne vit que dans la couche
--      applicative n'en est pas une* (I1).
--
-- **AUCUN `SECURITY DEFINER`, ET LA LIMITE QUI EN DÉCOULE S'ÉCRIT.** Le
-- troisième déclencheur lit `absence` sous les politiques de l'appelant. Pour le
-- rôle applicatif, qui écrit toujours sous un contexte de société posé, la table
-- est entièrement visible et le contrôle est complet ; pour le PROPRIÉTAIRE sous
-- `FORCE ROW LEVEL SECURITY` et sans contexte, la lecture rend zéro ligne et le
-- contrôle S'ABSTIENT (CLAUDE.md §9, 07/09). C'est assumé : le seul appelant que
-- ce cas décrit est celui qui peut de toute façon supprimer le déclencheur, et
-- le seul remède serait un `SECURITY DEFINER`, qu'un gardien statique refuse
-- avec une liste d'exceptions close et vide (D50).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. AUCUNE NATURE N'EST ÉCRITE — et la colonne reste, DORMANTE ───────────
--
-- `absence.motif` est une énumération posée `NOT NULL` par L3-04 : `conge`,
-- `arret`, `formation`, `recuperation`, `autre`. **`arret` est un arrêt de
-- travail : c'est une donnée de santé, sur un salarié nommé, en clair.** La
-- forme « interne » (D94) la protège du portail ; elle ne protège de rien à
-- l'intérieur.
--
-- **L'argument qui tranche n'est pas la prudence, c'est l'ASYMÉTRIE** : on peut
-- toujours AJOUTER une colonne plus tard, on ne peut jamais DÉ-enregistrer ce
-- qui a été écrit. Et le dénominateur du taux d'occupation, seul lecteur réel de
-- cette table, n'a besoin d'aucune nature — il lui suffit de savoir que la
-- personne n'était pas là.
--
-- **Mesuré avant d'agir : `absence` compte ZÉRO ligne.** Le coût de ce choix ne
-- sera jamais plus bas, et c'est pour cela qu'il se fait maintenant plutôt que
-- « quand on saura » (§9, 30/08 — une échéance qui tombe au pire moment est un
-- report déguisé).
--
-- **CE QUI EST FAIT EST LA FORME LA PLUS RÉVERSIBLE QUI SOIT.** Ni la colonne
-- ni le type ne sont supprimés : ils dorment. Un déclencheur refuse d'en écrire
-- une, par quelque chemin que ce soit — écran, import, semis, console. Ratifier
-- dans un sens, c'est retirer le déclencheur ; ratifier dans l'autre, c'est
-- supprimer les colonnes et le type, et ce second geste restera GRATUIT tant
-- qu'aucune ligne ne porte de nature — ce que le déclencheur garantit.
--
-- La contrainte `absence_precision_si_autre` n'est PAS touchée : une expression
-- de `CHECK` qui vaut NULL passe, et `motif IS NULL` la rend NULL. Elle
-- continue donc de tenir exactement ce qu'elle tenait, pour le jour où la nature
-- reviendrait.

ALTER TABLE "absence" ALTER COLUMN "motif" DROP NOT NULL;

CREATE FUNCTION "absence_sans_nature"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."motif" IS NOT NULL OR NEW."precision" IS NOT NULL THEN
    RAISE EXCEPTION
      'absence_sans_nature — Une absence ne porte pas de nature : la période suffit à ce que le produit en fait. Écrire « congé » ou « arrêt » inscrirait une donnée de santé sur une personne nommée, et ce choix appartient à la direction, pas à un chemin d''écriture. Décision provisoire, voir R3-14.'
      USING ERRCODE = 'check_violation',
            CONSTRAINT = 'absence_sans_nature';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "sans_nature"
  BEFORE INSERT OR UPDATE ON "absence"
  FOR EACH ROW EXECUTE FUNCTION "absence_sans_nature"();

-- ── 2. DÉCIDER APPARTIENT À L'ENCADREMENT, DÉCLARER EST POUR SOI ────────────
--
-- *Un technicien qui validerait sa propre absence déplanifierait ses propres
-- interventions*, c'est-à-dire retirerait des rendez-vous à des clients sans
-- que personne l'ait vu. Le ticket le dit, RG-PLA-06 ne désigne personne, et
-- l'exploitation a tranché : `adv` ou `direction`, jamais le demandeur.
--
-- **Les deux rôles sont nommés ici et NON déduits d'une capacité.** Mesuré le
-- 14/09 : la matrice de RG-DRO-03 ne porte aucune capacité d'absence, et le
-- filtrage par capacité n'existe sur AUCUN écran de réglage du produit. En
-- fabriquer un ici et nulle part ailleurs aurait posé une garde incohérente
-- avec le reste ; le jour où le filtrage arrive, cette garde-ci se relit avec
-- les autres.
--
-- `app.role` est posée par le chemin de production (`lib/db/rls.ts`) et par lui
-- seul. Une chaîne vide — aucun rôle posé — ne satisfait aucune des deux
-- branches : **le défaut est le refus**, jamais la permission.

CREATE FUNCTION "absence_decision_reservee_a_l_encadrement"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."statut" IS DISTINCT FROM OLD."statut"
     AND current_setting('app.role', true) NOT IN ('adv', 'direction') THEN
    RAISE EXCEPTION
      'absence_decision_reservee_a_l_encadrement — Valider ou refuser une absence appartient à l''encadrement : une absence validée déplanifie des interventions, et celui qui la demande ne peut pas être celui qui la tranche.'
      USING ERRCODE = 'insufficient_privilege',
            CONSTRAINT = 'absence_decision_reservee_a_l_encadrement';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "decision_reservee_a_l_encadrement"
  BEFORE UPDATE ON "absence"
  FOR EACH ROW EXECUTE FUNCTION "absence_decision_reservee_a_l_encadrement"();

-- Un TECHNICIEN déclare POUR LUI-MÊME, et pour personne d'autre. Les autres
-- rôles internes saisissent pour un tiers — c'est l'ADV qui enregistre un arrêt
-- reçu par téléphone —, et ce déclencheur ne les vise pas.
--
-- `app.utilisateur_id` est posée par le chemin de production : c'est la même
-- variable que lit le journal d'audit (I8). Vide, elle ne peut être égale à
-- aucun identifiant, donc le défaut est ici aussi le REFUS.

CREATE FUNCTION "absence_declaree_pour_soi"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.role', true) = 'technicien'
     AND NEW."utilisateur_id"::text IS DISTINCT FROM current_setting('app.utilisateur_id', true) THEN
    RAISE EXCEPTION
      'absence_declaree_pour_soi — Un technicien déclare son absence, jamais celle d''un autre.'
      USING ERRCODE = 'insufficient_privilege',
            CONSTRAINT = 'absence_declaree_pour_soi';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "declaree_pour_soi"
  BEFORE INSERT ON "absence"
  FOR EACH ROW EXECUTE FUNCTION "absence_declaree_pour_soi"();

-- ── 3. ON NE POSE PAS SUR UNE ABSENCE VALIDÉE — l'autre bout de RG-PLA-06 ───
--
-- La moitié qui DÉPLANIFIE existait et était éprouvée : valider une absence rend
-- à la file les interventions posées, dans la même transaction. **Celle qui
-- manquait est l'autre bout** : rien n'empêchait de poser une intervention sur
-- une absence déjà validée depuis un chemin qui ne passe pas par
-- `lib/interventions/pose.ts`.
--
-- **Seule une absence VALIDÉE bloque.** Une demandée ne dit rien encore, une
-- refusée ne dit plus rien. Ce n'est pas une seconde lecture du critère de
-- `absenceCouvrant` : celle-ci juge un jour et un statut, celui-là aussi, et
-- c'est le MÊME critère écrit une fois de chaque côté de la frontière — le
-- contrôle applicatif pour que le refus soit NOMMÉ à l'écran, le déclencheur
-- pour qu'il soit TENU. *L'un explique, l'autre garde.*
--
-- Les bornes sont COMPRISES des deux côtés : une absence du 14 au 28 couvre le
-- 14 et le 28. Une borne ouverte ferait travailler quelqu'un le dernier jour de
-- son arrêt.
--
-- Ce déclencheur ne se déclenche QUE si une date est posée : la déplanification
-- écrit `date_planifiee = NULL`, et elle doit rester possible — c'est elle qui
-- répare l'état, pas elle qui le crée.

CREATE FUNCTION "intervention_pas_sur_absence_validee"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."date_planifiee" IS NOT NULL
     AND NEW."technicien_id" IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM "absence" AS "a"
        WHERE "a"."utilisateur_id" = NEW."technicien_id"
          AND "a"."statut" = 'validee'
          AND NEW."date_planifiee" BETWEEN "a"."du" AND "a"."au"
     ) THEN
    RAISE EXCEPTION
      'intervention_pas_sur_absence_validee — Ce technicien est absent ce jour-là, et l''absence est validée. Choisir une autre date, une autre personne, ou refuser l''absence d''abord.'
      USING ERRCODE = 'check_violation',
            CONSTRAINT = 'intervention_pas_sur_absence_validee';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "pas_sur_absence_validee"
  BEFORE INSERT OR UPDATE ON "intervention"
  FOR EACH ROW EXECUTE FUNCTION "intervention_pas_sur_absence_validee"();

-- ── 4. CE QUE CETTE MIGRATION NE FAIT PAS ──────────────────────────────────
--
-- Elle ne relit AUCUNE ligne existante : un déclencheur ne s'applique qu'aux
-- écritures. C'est le raisonnement de D104 — *une ligne ancienne qu'on TOUCHE
-- doit se mettre en règle, et c'est le seul moment où quelqu'un est là pour en
-- décider.* Ici la question est théorique : `absence` compte zéro ligne, et
-- aucune intervention ne peut donc chevaucher une absence validée.
