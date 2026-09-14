-- ════════════════════════════════════════════════════════════════════════════
-- R3-13 — LES PLAGES D'OUVERTURE SE RÈGLENT DEPUIS L'APPLICATION
--
-- L'écran `/parametres/agences` affichait les jours et les horaires et ne
-- laissait régler que le pas : les plages ne se modifiaient que par le semis ou
-- par une console. Deux états interdits deviennent donc ATTEIGNABLES le jour où
-- un formulaire les écrit, et cette migration les ferme AVANT que le formulaire
-- existe.
--
-- **Aucune contrainte `CHECK` ne peut les porter** : les deux règles regardent
-- PLUSIEURS LIGNES (le chevauchement) ou DEUX TABLES (le pas). Ce sont donc des
-- déclencheurs, et ils sont écrits ici plutôt qu'en TypeScript seul parce
-- qu'*une garantie qui ne vit que dans la couche applicative n'en est pas une*
-- (I1) : le semis, l'import et une console y échappent tous.
--
-- **Ce qui a été écarté, avec son motif.** Une contrainte `EXCLUDE USING gist`
-- sur un `int4range` serait plus déclarative et plus juste que le premier
-- déclencheur — elle exige `btree_gist`, et AUCUNE migration de ce dépôt n'a
-- jamais créé d'extension. En poser une pour la première fois dans un ticket
-- d'écran, sur une base hébergée dont nous ne tenons pas les privilèges, est un
-- pari dont le gain porte sur la FORME du refus et non sur sa solidité.
--
-- **AUCUN `SECURITY DEFINER`, ET LA LIMITE QUI EN DÉCOULE S'ÉCRIT.** Les trois
-- fonctions s'exécutent avec les droits de l'appelant ; leurs lectures passent
-- donc sous les politiques de cloisonnement. Pour le rôle applicatif, qui écrit
-- toujours sous un contexte de société posé (`avecContexteApplicatif`), toutes
-- les lignes du calendrier visé sont visibles et le contrôle est complet. Pour
-- le PROPRIÉTAIRE sous `FORCE ROW LEVEL SECURITY` et sans contexte — le semis,
-- une migration, une console de maintenance —, la lecture rend zéro ligne et le
-- contrôle S'ABSTIENT (CLAUDE.md §9, 07/09). C'est assumé et non réparé : le
-- seul appelant que ce cas décrit est celui qui peut de toute façon supprimer le
-- déclencheur, et le seul remède serait un `SECURITY DEFINER`, qu'un gardien
-- statique refuse avec une liste d'exceptions close et vide (D50).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. DEUX PLAGES DU MÊME JOUR NE SE RECOUVRENT PAS ────────────────────────
--
-- Deux plages qui se recouvrent compteraient DEUX FOIS les mêmes heures
-- ouvrables : le dénominateur du taux d'occupation serait faux, le taux aussi,
-- et rien ne le dirait — la divergence silencieuse, sur un chiffre qu'on lit
-- pour juger une charge de travail.
--
-- **Deux plages qui se TOUCHENT ne se chevauchent pas.** 08:00–12:00 et
-- 12:00–17:00 sont la journée coupée par le déjeuner : c'est le cas ordinaire,
-- et le refuser interdirait la forme la plus répandue d'un horaire d'agence.
-- C'est la borne exacte du chevauchement d'interventions, et elle est la même
-- ici pour que les deux ne divergent pas.
--
-- Le message dit ce qui bloque et la marche à suivre ; il ne NOMME aucune autre
-- plage et n'en compte aucune (D50) — un refus a le droit d'être lisible,
-- jamais d'être informatif.

CREATE FUNCTION "calendrier_plage_sans_chevauchement"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM "calendrier_plage" AS "autre"
     WHERE "autre"."calendrier_id" = NEW."calendrier_id"
       AND "autre"."jour_semaine"  = NEW."jour_semaine"
       AND "autre"."id" <> NEW."id"
       AND "autre"."debut_minutes" < NEW."fin_minutes"
       AND NEW."debut_minutes"     < "autre"."fin_minutes"
  ) THEN
    -- Le nom du verrou est DANS le texte : Prisma n'expose pas le champ
    -- `constraint` d'une erreur levée par un déclencheur, et sans le nom aucune
    -- assertion ne pourrait nommer la contrainte qu'elle éprouve (§9, 24/08).
    RAISE EXCEPTION
      'calendrier_plage_sans_chevauchement — Cette plage en recouvre une autre le même jour. Deux plages qui se touchent sont admises ; deux plages qui se recouvrent compteraient deux fois les mêmes heures ouvrables. Modifier la plage existante, ou choisir des bornes qui ne la recouvrent pas.'
      USING ERRCODE = 'check_violation',
            CONSTRAINT = 'calendrier_plage_sans_chevauchement';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "plage_sans_chevauchement"
  BEFORE INSERT OR UPDATE ON "calendrier_plage"
  FOR EACH ROW EXECUTE FUNCTION "calendrier_plage_sans_chevauchement"();

-- ── 2. LE PAS TOMBE DANS LA PLAGE, ET LE VERROU EST POSÉ DES DEUX CÔTÉS ─────
--
-- `lib/calendar/parametrage.ts` dit déjà qu'*une grille de créneaux ne DÉBORDE
-- jamais sa plage* : un créneau n'est retenu que s'il tient entièrement dedans.
-- La conséquence, c'est qu'une plage plus courte que le pas rend ZÉRO créneau —
-- un jour affiché comme ouvert sur lequel le planning ne propose rien, ce qui se
-- lit « le planning est en panne » et non « le réglage est faux ».
--
-- **DEUX SENS, et le second est celui qu'on oublie.** Raccourcir une plage sous
-- le pas courant est refusé ; ÉLEVER le pas au-dessus de la plus courte plage
-- l'est aussi. Le pas se règle depuis la ligne du tableau, la plage depuis
-- l'écran de détail : n'en garder qu'un laisserait l'autre produire exactement
-- l'état qu'on interdit.
--
-- **L'ordre est une décision, et le message la nomme** : pour raccourcir une
-- plage sous le pas, on baisse le pas d'abord. Même forme que D49, où l'on
-- traite les écarts de calendrier avant de changer le territoire d'une agence —
-- le déclencheur n'exige pas qu'on renonce, il exige qu'on décide dans l'ordre.

CREATE FUNCTION "calendrier_plage_tient_le_pas"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  "pas" INTEGER;
BEGIN
  SELECT "c"."pas_creneau_minutes" INTO "pas"
    FROM "calendrier" AS "c"
   WHERE "c"."id" = NEW."calendrier_id";
  -- NOT FOUND ne veut pas dire « le calendrier n'existe pas » — la clé
  -- étrangère le garantit : il veut dire « l'appelant ne le voit pas », donc
  -- qu'on lit sans contexte de société. Le contrôle s'abstient plutôt que
  -- d'inventer un pas (voir l'en-tête).
  IF FOUND AND NEW."fin_minutes" - NEW."debut_minutes" < "pas" THEN
    RAISE EXCEPTION
      'calendrier_plage_tient_le_pas — Cette plage est plus courte que le pas des créneaux : le planning ne proposerait aucun créneau ce jour-là. Baisser le pas du calendrier d''abord, ou allonger la plage.'
      USING ERRCODE = 'check_violation',
            CONSTRAINT = 'calendrier_plage_tient_le_pas';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "plage_tient_le_pas"
  BEFORE INSERT OR UPDATE ON "calendrier_plage"
  FOR EACH ROW EXECUTE FUNCTION "calendrier_plage_tient_le_pas"();

CREATE FUNCTION "calendrier_pas_tient_dans_les_plages"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  "plus_courte" INTEGER;
BEGIN
  IF NEW."pas_creneau_minutes" IS NOT DISTINCT FROM OLD."pas_creneau_minutes" THEN
    RETURN NEW;
  END IF;
  SELECT MIN("p"."fin_minutes" - "p"."debut_minutes") INTO "plus_courte"
    FROM "calendrier_plage" AS "p"
   WHERE "p"."calendrier_id" = NEW."id";
  -- NULL : le calendrier n'a aucune plage visible — soit il n'en a pas, soit on
  -- lit sans contexte. Dans les deux cas il n'y a pas de grille à vider.
  IF "plus_courte" IS NOT NULL AND NEW."pas_creneau_minutes" > "plus_courte" THEN
    RAISE EXCEPTION
      'calendrier_pas_tient_dans_les_plages — Ce pas dépasse la plus courte plage de ce calendrier : le planning ne proposerait aucun créneau sur cette plage. Allonger la plage d''abord, ou choisir un pas plus court.'
      USING ERRCODE = 'check_violation',
            CONSTRAINT = 'calendrier_pas_tient_dans_les_plages';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "pas_tient_dans_les_plages"
  BEFORE UPDATE ON "calendrier"
  FOR EACH ROW EXECUTE FUNCTION "calendrier_pas_tient_dans_les_plages"();

-- ── 3. CE QUE CETTE MIGRATION NE FAIT PAS, ET POURQUOI ──────────────────────
--
-- Elle ne RELIT aucune ligne existante. Un déclencheur ne s'applique qu'aux
-- écritures : les plages déjà posées restent en l'état, y compris si l'une
-- d'elles violait aujourd'hui l'une des deux règles. C'est délibéré et c'est le
-- raisonnement de D104 — une ligne ancienne qu'on TOUCHE doit se mettre en
-- règle, et c'est le seul moment où quelqu'un est là pour en décider. Vider une
-- plage de semis au passage d'une migration fermerait un jour d'ouverture sans
-- que personne l'ait demandé.
