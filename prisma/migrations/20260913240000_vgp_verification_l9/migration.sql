-- ═══════════════════════════════════════════════════════════════════════════
-- L9-08, L9-09, L9-10 — LE REGISTRE DES VGP REÇOIT CE QU'ON LUI DIT
-- D114 (12/09/2026 au soir), sur D88.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## CE QUI BLOQUAIT LES TROIS TICKETS, ET C'ÉTAIT UN SEUL FAIT
--
-- Le registre affichait *« sans information depuis X »* pour chaque machine
-- soumise, **et il l'aurait affiché pour toujours** : rien ne permettait
-- d'enregistrer qu'un organisme nous a dit quelque chose. `document` porte une
-- CLASSE et une CIBLE, jamais une NATURE ; aucune table ne portait de date de
-- vérification. *Le compteur qui descend de L9-08 ne pouvait donc jamais
-- descendre — et un compteur figé est pire qu'une alerte de trop, parce qu'il a
-- l'air de mesurer.*
--
-- ## L'ORIGINE EST UNE COLONNE, ET C'EST LA MOITIÉ QUI NE SE DEVINE PAS
--
-- > **Un rapport reçu de l'organisme, une vignette photographiée par un
-- > technicien et une parole du client au téléphone n'ont pas la même valeur le
-- > jour d'un contrôle.**
--
-- **Une colonne maintenant contre une migration douloureuse ce jour-là** — le
-- raisonnement de L8-06, qui vaut ici davantage : *l'origine ne se reconstitue
-- pas après coup.* Une ligne écrite sans elle est une ligne dont personne ne
-- saura jamais d'où elle vient.
--
-- **LES QUATRE VALEURS SONT UNE PROPOSITION**, et D114 le dit : elles sont du
-- vocabulaire d'exploitation, que le §1 du protocole réserve à Alexis. La table
-- naît avec la colonne ; la liste se complète par `ALTER TYPE … ADD VALUE`, qui
-- ne coûte rien. *Ce qui aurait coûté cher est de ne pas avoir la colonne.*
--
-- ## TROIS TABLES, ET LA FORME DE CHACUNE EST ÉCRITE
--
-- Les trois relèvent de la PREMIÈRE catégorie de I1 et prennent la forme
-- **« filiation »** : *une fille est visible si son parent l'est.*
-- `site_habilitation_requise` a ouvert cette forme avec un parent qui n'est pas
-- une intervention, et c'est ce qui rend l'usage possible ici sans créer de
-- quatorzième forme — **la forme est le CHAÎNAGE, jamais l'identité du parent.**
--
-- `vgp_campagne` fait exception et prend la forme **« société »** : son parent
-- serait `famille_materiel`, qui est de forme « ascendance » — *une campagne ne
-- doit pas hériter du refus de remonter vers une famille dont aucune machine
-- n'est visible*, sans quoi un compte interne cesserait de voir ses propres
-- campagnes le jour où la famille n'a plus de machine. Et elle ne nomme ni
-- client, ni site, ni personne : le motif d'une forme « interne » serait ce que
-- son retrait ROUVRIRAIT, et il n'y a rien (D94).
--
-- **Aucune clause de société n'est écrite dans les clauses de filiation** : elle
-- serait une seconde source du même fait, et c'est la clé étrangère COMPOSITE
-- qui empêche une fille de dériver de la société de son parent.

CREATE TYPE "OrigineInformationVgp" AS ENUM (
  'rapport_organisme',
  'rapport_transmis_client',
  'vignette_constatee',
  'declaration_client'
);

COMMENT ON TYPE "OrigineInformationVgp" IS
  'D''où vient ce qu''on nous a dit (D114). Un rapport reçu de l''organisme, une vignette photographiée et une parole du client n''ont pas la même valeur le jour d''un contrôle, et l''origine NE SE RECONSTITUE PAS APRÈS COUP. Ces quatre valeurs sont une PROPOSITION : le vocabulaire d''exploitation appartient à Alexis, et la liste se complète par ALTER TYPE … ADD VALUE.';

-- ───────────────────────────────────────────────────────────────────────────
-- CE QU'ON NOUS A DIT (L9-09)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE "vgp_verification" (
  "id" UUID NOT NULL,
  "societe_id" UUID NOT NULL,
  "machine_id" UUID NOT NULL,

  -- UN JOUR, pas un instant : un organisme intervient un jour donné, et l'heure
  -- n'est ni connue ni utile.
  "date_verification" DATE NOT NULL,

  -- TEXTE LIBRE : les organismes agréés ne sont pas une énumération que ce
  -- produit puisse fermer — ils diffèrent par territoire, et la solution sera
  -- vendue ailleurs. C'est la leçon de la périodicité (L9-05).
  "organisme" TEXT NOT NULL,

  -- NULLE quand l'information ne vient pas d'un rapport : une vignette n'en
  -- porte pas.
  "reference_rapport" TEXT,

  -- SANS VALEUR PAR DÉFAUT : une origine par défaut serait une valeur probante
  -- inventée.
  "origine" "OrigineInformationVgp" NOT NULL,

  -- OÙ SONT LES OCTETS, quand on les a. FACULTATIF : on peut savoir qu'une
  -- vérification a eu lieu sans détenir la pièce — c'est même le cas d'une
  -- vignette constatée.
  "document_id" UUID,

  "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifie_le" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "vgp_verification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vgp_verification_organisme_non_vide"
    CHECK (length(btrim("organisme")) > 0),
  -- UNE RÉFÉRENCE VIDE N'EST PAS UNE RÉFÉRENCE : `NULL` dit « il n'y en a
  -- pas », une chaîne vide ne dit rien et se compte comme une valeur.
  CONSTRAINT "vgp_verification_reference_non_vide"
    CHECK ("reference_rapport" IS NULL OR length(btrim("reference_rapport")) > 0)
);

CREATE UNIQUE INDEX "vgp_verification_societe_id_id_key"
  ON "vgp_verification"("societe_id", "id");
CREATE INDEX "vgp_verification_machine_date_idx"
  ON "vgp_verification"("societe_id", "machine_id", "date_verification" DESC);

ALTER TABLE "vgp_verification"
  ADD CONSTRAINT "vgp_verification_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "vgp_verification"
  ADD CONSTRAINT "vgp_verification_machine_fkey"
  FOREIGN KEY ("societe_id", "machine_id")
  REFERENCES "machine"("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "vgp_verification"
  ADD CONSTRAINT "vgp_verification_document_fkey"
  FOREIGN KEY ("societe_id", "document_id")
  REFERENCES "document"("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- LA FORME « FILIATION », parent `machine` : *une fille est visible si son
-- parent l'est*, et rien d'autre. Les TROIS filtres du parc — société,
-- `app.client_id`, `app.perimetre_sites` — se propagent par cette seule clause,
-- et les recopier ici en ferait une seconde lecture du même critère.
ALTER TABLE "vgp_verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vgp_verification" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_filiation" ON "vgp_verification"
  USING (EXISTS (SELECT 1 FROM "machine" WHERE "machine"."id" = "vgp_verification"."machine_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "machine" WHERE "machine"."id" = "vgp_verification"."machine_id"));

GRANT SELECT, INSERT, UPDATE, DELETE ON "vgp_verification" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "vgp_verification"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "vgp_verification" IS
  'Ce qu''on nous a dit d''une vérification périodique (D88, D114). CODIPLAN N''AFFIRME JAMAIS LA CONFORMITÉ : cette table enregistre ce qu''un organisme agréé a écrit, et le seul calcul du produit est une DATE. Aucune colonne ne porte un verdict. Forme « filiation », parent « machine ».';

-- ───────────────────────────────────────────────────────────────────────────
-- L'OBSERVATION QUI ENGENDRE UNE INTERVENTION (L9-10)
-- ───────────────────────────────────────────────────────────────────────────
--
-- *« C'est le seul point où ce lot alimente le planning, et c'est celui qui
-- rapporte de l'argent. »* Une observation d'organisme est un travail à faire,
-- daté, sur une machine identifiée : **elle a exactement la forme d'une
-- intervention `a_planifier`.**

CREATE TABLE "vgp_observation" (
  "id" UUID NOT NULL,
  "societe_id" UUID NOT NULL,
  "verification_id" UUID NOT NULL,

  -- CE QUE L'ORGANISME A ÉCRIT, mot pour mot. Texte libre, et il le restera :
  -- une énumération d'observations serait une classification que CODIPLAN n'a
  -- pas le droit de faire — il rapporte, il ne qualifie pas.
  "libelle" TEXT NOT NULL,

  -- L'intervention engendrée. NULLE tant que personne ne l'a planifiée : *une
  -- observation non traitée est l'état qui compte*, et la confondre avec une
  -- observation traitée ferait disparaître du travail dû.
  "intervention_id" UUID,

  "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifie_le" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "vgp_observation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vgp_observation_libelle_non_vide"
    CHECK (length(btrim("libelle")) > 0)
);

CREATE INDEX "vgp_observation_verification_idx"
  ON "vgp_observation"("societe_id", "verification_id");

ALTER TABLE "vgp_observation"
  ADD CONSTRAINT "vgp_observation_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "vgp_observation"
  ADD CONSTRAINT "vgp_observation_verification_fkey"
  FOREIGN KEY ("societe_id", "verification_id")
  REFERENCES "vgp_verification"("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "vgp_observation"
  ADD CONSTRAINT "vgp_observation_intervention_fkey"
  FOREIGN KEY ("societe_id", "intervention_id")
  REFERENCES "intervention"("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- FILIATION, parent `vgp_verification` — qui est elle-même une fille de
-- `machine`. *L'adossement se CHAÎNE*, et c'est ce qui fait qu'aucune clause de
-- société n'est écrite nulle part dans cette branche.
ALTER TABLE "vgp_observation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vgp_observation" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_filiation" ON "vgp_observation"
  USING (EXISTS (SELECT 1 FROM "vgp_verification" WHERE "vgp_verification"."id" = "vgp_observation"."verification_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "vgp_verification" WHERE "vgp_verification"."id" = "vgp_observation"."verification_id"));

GRANT SELECT, INSERT, UPDATE, DELETE ON "vgp_observation" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "vgp_observation"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "vgp_observation" IS
  'Une observation d''organisme — un travail à faire, daté, sur une machine identifiée (D88 §10). Elle a exactement la forme d''une intervention « a_planifier », et intervention_id dit celle qu''elle a engendrée. NULLE tant que personne ne l''a planifiée : une observation non traitée est l''état qui compte. Forme « filiation », parent « vgp_verification » — l''adossement se CHAÎNE jusqu''à « machine ».';

-- ───────────────────────────────────────────────────────────────────────────
-- LA CAMPAGNE DATÉE (L9-08)
-- ───────────────────────────────────────────────────────────────────────────
--
-- > **Faire passer une famille de « non soumise » à « soumise » n'ouvre PAS
-- > deux cents alertes : cela ouvre UNE CAMPAGNE DATÉE avec un compteur qui
-- > descend.**
--
-- **LE COMPTEUR N'EST PAS UNE COLONNE, et c'est décidé.** Il se DÉRIVE des
-- machines de la famille qui n'ont reçu aucune information depuis l'ouverture :
-- *un compteur stocké se désynchronise en silence, et un compteur figé est pire
-- qu'une alerte de trop — il a l'air de mesurer.*

CREATE TABLE "vgp_campagne" (
  "id" UUID NOT NULL,
  "societe_id" UUID NOT NULL,
  "famille_id" UUID NOT NULL,

  -- C'est lui qui borne ce que le compteur regarde : une information reçue
  -- AVANT ne solde pas une campagne ouverte APRÈS.
  "ouverte_le" DATE NOT NULL,

  -- NULLE tant qu'elle court. Elle ne se ferme pas toute seule quand le
  -- compteur atteint zéro : *une campagne close est une décision*, et le
  -- compteur peut remonter — une machine neuve entre dans la famille.
  "close_le" DATE,

  "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifie_le" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "vgp_campagne_pkey" PRIMARY KEY ("id"),
  -- UNE CAMPAGNE NE SE CLÔT PAS AVANT DE S'OUVRIR. La borne est vraie de la
  -- donnée, et une inversion rendrait le compteur négatif sans rien dire.
  CONSTRAINT "vgp_campagne_close_apres_ouverte"
    CHECK ("close_le" IS NULL OR "close_le" >= "ouverte_le")
);

CREATE INDEX "vgp_campagne_famille_idx"
  ON "vgp_campagne"("societe_id", "famille_id");

ALTER TABLE "vgp_campagne"
  ADD CONSTRAINT "vgp_campagne_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "vgp_campagne"
  ADD CONSTRAINT "vgp_campagne_famille_fkey"
  FOREIGN KEY ("societe_id", "famille_id")
  REFERENCES "famille_materiel"("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- FORME « SOCIÉTÉ », et le choix s'écrit parce qu'une table qui naît le doit.
-- Son parent serait `famille_materiel`, qui est de forme « ascendance » : une
-- campagne ne doit PAS hériter du refus de remonter vers une famille dont
-- aucune machine n'est visible, sans quoi un compte interne cesserait de voir
-- ses propres campagnes le jour où la famille n'a plus de machine. Et elle ne
-- nomme ni client, ni site, ni personne — le motif d'une forme « interne »
-- serait ce que son retrait ROUVRIRAIT, et il n'y a rien (D94).
ALTER TABLE "vgp_campagne" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vgp_campagne" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_societe" ON "vgp_campagne"
  USING ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)
  WITH CHECK ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "vgp_campagne" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "vgp_campagne"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "vgp_campagne" IS
  'Une campagne datée de mise en conformité du registre (L9-08, D88 §8). Faire passer une famille de « non soumise » à « soumise » n''ouvre PAS deux cents alertes : cela ouvre UN objet unique, daté, avec un reste-à-faire visible. LE COMPTEUR N''EST PAS UNE COLONNE : il se dérive des machines sans information depuis l''ouverture — un compteur stocké se désynchronise en silence, et un compteur figé a l''air de mesurer.';
