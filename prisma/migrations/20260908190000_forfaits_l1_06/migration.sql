-- CODIPLAN — Catalogue de forfaits (ticket L1-06 ; RG-TAR-06 ; chapitre 4.3 et
-- chapitre 11 ; invariants I1, I2, I3 ; décision d'exploitation du 08/09/2026).
--
-- ── 0. LE CONTRÔLE DE DEVISE DEVIENT GÉNÉRIQUE, AVANT D'ÊTRE DUPLIQUÉ ──────
--
-- L1-07 a posé `taux_horaire_devise_de_la_societe()` : *un montant porte la
-- devise de sa société* (RG-TAR-01). `forfait` a exactement le même besoin.
--
-- **Écrire une seconde fonction serait la faute du §9 (01/09)** — deux
-- implémentations d'un même critère, chacune juste, qui divergent en silence
-- parce qu'aucune ne prétend être l'autre. La fonction est donc RENOMMÉE pour ce
-- qu'elle fait, et les deux tables la partagent. Elle ne lisait déjà que
-- `NEW.societe_id` et `NEW.devise_code` : elle était générique sans le dire.
CREATE OR REPLACE FUNCTION "montant_devise_de_la_societe"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  attendue TEXT;
BEGIN
  SELECT "devise_code" INTO attendue FROM "societe" WHERE "id" = NEW."societe_id";

  -- La société est-elle seulement lisible ? Sous RLS, un contexte qui ne la voit
  -- pas rendrait NULL — et la comparaison serait vraie de rien. On refuse
  -- plutôt que de laisser passer : un décompte nul ressemble à un sans-faute.
  IF attendue IS NULL THEN
    RAISE EXCEPTION
      'Impossible de lire la devise de la société de ce montant. Écrire un montant exige un contexte qui voit sa société.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."devise_code" IS DISTINCT FROM attendue THEN
    RAISE EXCEPTION
      'Un montant porte la devise de sa société. Corriger la devise du montant, ou celle de la société — jamais les deux séparément.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "montant_devise_de_la_societe"() IS
  'RG-TAR-01 — un montant porte la devise de sa société. Partagée par taux_horaire et forfait : écrire une seconde fonction aurait été deux lectures d''un même critère, chacune juste, qui divergent en silence.';

DROP TRIGGER "taux_horaire_devise_de_la_societe" ON "taux_horaire";
DROP FUNCTION "taux_horaire_devise_de_la_societe"();

CREATE TRIGGER "taux_horaire_devise_de_la_societe"
  BEFORE INSERT OR UPDATE ON "taux_horaire"
  FOR EACH ROW
  EXECUTE FUNCTION "montant_devise_de_la_societe"();

-- ── 1. LE TYPE DE FORFAIT ──────────────────────────────────────────────────
--
-- **Une énumération EN BASE, et c'est le raisonnement des zones à l'endroit.**
-- Les zones et les rôles de contact sont clos à l'entrée serveur parce qu'ils
-- décrivent UN territoire ou UNE organisation, et qu'une société tierce en aura
-- d'autres. Les quatre natures de forfait ne décrivent pas un territoire : elles
-- décrivent ce qu'un forfait FAIT dans le moteur de valorisation, et le lot 2
-- s'appuiera dessus. Le chapitre 11 l'écrit `enum`, et rien ne l'amende.
CREATE TYPE "TypeForfait" AS ENUM (
  'deplacement',
  'mise_en_service',
  'controle',
  'prestation'
);

-- ── 2. LE CATALOGUE ────────────────────────────────────────────────────────

CREATE TABLE "forfait" (
  "id" UUID NOT NULL,
  "societe_id" UUID NOT NULL,

  "code" TEXT NOT NULL,
  "libelle" TEXT NOT NULL,
  "type" "TypeForfait" NOT NULL,

  -- LE MONTANT, comme partout : entier dans l'unité la plus fine, jamais sans sa
  -- devise. Le chapitre 11 l'écrit `numeric` ; la décision d'exploitation du
  -- 08/09/2026 l'amende — *jamais un flottant, jamais un montant sans sa devise*
  -- —, pour la raison que I3 donne : les décimales sont une propriété de la
  -- DEVISE, et un `numeric` obligerait chaque lecture à se rappeler laquelle.
  "montant_mineur" BIGINT NOT NULL,
  "devise_code" TEXT NOT NULL,

  -- Les heures incluses, EN MINUTES et en entier. Le chapitre 11 l'écrit
  -- `numeric` ; les minutes sont l'unité de la règle qui la consomme —
  -- RG-TAR-05 arrondit au quart d'heure supérieur (D57) —, et comparer un
  -- arrondi à un flottant est le moyen le plus sûr de facturer un quart d'heure
  -- de travers. NULLE quand le forfait n'inclut aucune heure.
  "heures_incluses_minutes" INTEGER,

  -- ── LES TROIS AXES DE RG-TAR-06 ────────────────────────────────────────
  --
  -- « Un forfait ne s'applique que si ses conditions sont remplies — zone,
  -- famille de matériel, type d'intervention. » NULL veut dire « sans condition
  -- sur cet axe », jamais « aucune valeur ne convient » : un forfait sans
  -- condition s'applique partout, c'est le cas le plus courant.
  --
  -- `zone_geo` est un `text[]` et non une énumération, exactement comme
  -- `site.zone_geo` : six valeurs d'UN territoire, closes à l'entrée serveur
  -- (`lib/sites/zones.ts`), jamais en base — sans quoi ajouter une zone serait
  -- une migration.
  "zone_geo" TEXT[],
  "famille_id" UUID,
  -- `type_intervention` est un `text[]` pour une raison DIFFÉRENTE, et il faut
  -- la dire : **les types d'intervention n'existent nulle part encore.** Ni
  -- énumération, ni liste close, ni table. Ce troisième axe de RG-TAR-06 est
  -- donc INERTE jusqu'à ce que le lot 2 les décide, et le registre le porte —
  -- même forme que D63 sur les durées de validité : *ce n'est pas un défaut du
  -- code, c'est une donnée qui n'existe pas, et rien ne rougira tout seul.*
  "type_intervention" TEXT[],

  "cumulable_temps" BOOLEAN NOT NULL,
  "actif" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "forfait_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "forfait"
  ADD CONSTRAINT "forfait_code_non_vide" CHECK (length(btrim("code")) > 0);
ALTER TABLE "forfait"
  ADD CONSTRAINT "forfait_libelle_non_vide" CHECK (length(btrim("libelle")) > 0);

-- Un montant de forfait peut être ZÉRO — une prestation offerte est un forfait à
-- zéro, et c'est la façon de la dire. Négatif, non : ce serait un avoir, qui
-- n'est pas un forfait.
ALTER TABLE "forfait"
  ADD CONSTRAINT "forfait_montant_non_negatif" CHECK ("montant_mineur" >= 0);

ALTER TABLE "forfait"
  ADD CONSTRAINT "forfait_heures_incluses_positives"
  CHECK ("heures_incluses_minutes" IS NULL OR "heures_incluses_minutes" > 0);

-- LES PROPRIÉTÉS DES ENSEMBLES sont tenues par la base, leur CONTENU par
-- l'entrée serveur — c'est la coupure que L1-03 a posée sur les rôles de
-- contact. Un tableau vide n'est pas « sans condition » : `NULL` l'est, et deux
-- façons de dire la même chose en font une de trop.
--
-- **La propriété passe par une FONCTION, et ce n'est pas un enjolivement.**
-- PostgreSQL refuse toute sous-requête dans une contrainte `CHECK` — mesuré :
-- `0A000, cannot use subquery in check constraint` —, et « sans doublon » ne
-- s'exprime pas sur un tableau sans en écrire une. Le corps de la fonction, lui,
-- en admet une. La fonction est `IMMUTABLE` : elle ne lit que son argument, et
-- une contrainte `CHECK` ne doit dépendre de rien d'autre que de la ligne.
CREATE FUNCTION "condition_multivaluee_valide"(valeurs TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT valeurs IS NULL
      OR (cardinality(valeurs) > 0
          AND cardinality(valeurs) = (SELECT count(DISTINCT v) FROM unnest(valeurs) AS v));
$$;

COMMENT ON FUNCTION "condition_multivaluee_valide"(TEXT[]) IS
  'Un axe de condition de RG-TAR-06 est NUL — sans condition — ou un ensemble non vide, sans doublon et sans NULL. Le NULL interne tombe de lui-même : count(DISTINCT) l''ignore, donc le cardinal ne correspond plus.';

ALTER TABLE "forfait"
  ADD CONSTRAINT "forfait_zones_non_vides"
  CHECK ("condition_multivaluee_valide"("zone_geo"));
ALTER TABLE "forfait"
  ADD CONSTRAINT "forfait_types_intervention_non_vides"
  CHECK ("condition_multivaluee_valide"("type_intervention"));

CREATE UNIQUE INDEX "forfait_societe_id_code_key"
  ON "forfait" ("societe_id", "code");

CREATE INDEX "forfait_societe_id_actif_idx" ON "forfait" ("societe_id", "actif");

ALTER TABLE "forfait"
  ADD CONSTRAINT "forfait_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "forfait"
  ADD CONSTRAINT "forfait_devise_code_fkey"
  FOREIGN KEY ("devise_code") REFERENCES "devise"("code")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- LE CHAÎNAGE COMPOSITE — un forfait ne se conditionne pas à la famille d'une
-- AUTRE société. Les contrôles d'intégrité référentielle contournent les
-- politiques RLS par construction : sans la société dans la clé, le verrou
-- serait muet là où le cloisonnement doit mordre.
ALTER TABLE "forfait"
  ADD CONSTRAINT "forfait_famille_fkey"
  FOREIGN KEY ("societe_id", "famille_id")
  REFERENCES "famille_materiel"("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TRIGGER "forfait_devise_de_la_societe"
  BEFORE INSERT OR UPDATE ON "forfait"
  FOR EACH ROW
  EXECUTE FUNCTION "montant_devise_de_la_societe"();

ALTER TABLE "forfait" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "forfait" FORCE ROW LEVEL SECURITY;

-- Forme « SOCIÉTÉ », déduite comme celle de `taux_horaire` : un forfait est
-- COMMERCIAL, donc propre à chaque société — D4 le dit nommément — et il n'est
-- la donnée d'aucun client.
CREATE POLICY "cloisonnement_societe" ON "forfait"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  );

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "forfait"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "forfait" IS
  'Catalogue de forfaits d''une société (chapitre 4.3, RG-TAR-06). La TABLE existe, elle naît VIDE : quels forfaits mettre au catalogue et à quels montants est une question d''exploitation, inscrite au registre depuis l''ouverture du projet. Le montant est un entier en unités les plus fines, avec sa devise (I2, I3) — le chapitre 11 l''écrit numeric, la décision du 08/09/2026 l''amende.';

COMMENT ON COLUMN "forfait"."type_intervention" IS
  'Troisième axe de RG-TAR-06. INERTE aujourd''hui : les types d''intervention n''existent nulle part — ni énumération, ni table — et le lot 2 les décidera. Ce n''est pas un défaut du code, c''est une donnée qui n''existe pas ; rien ne rougira tout seul.';

COMMENT ON COLUMN "forfait"."heures_incluses_minutes" IS
  'Heures incluses, EN MINUTES et en entier. RG-TAR-05 arrondit au quart d''heure supérieur (D57) : comparer un arrondi à un flottant est le moyen le plus sûr de facturer un quart d''heure de travers. NULLE quand le forfait n''inclut aucune heure.';
