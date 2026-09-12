-- ═══════════════════════════════════════════════════════════════════════════
-- L1-12 — LE CATALOGUE DES PRESTATIONS
-- D109 (12/09/2026) et D113 (12/09/2026 au soir).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## LA RÈGLE QUI GOUVERNE CETTE TABLE
--
-- > **UNE PRESTATION PORTE UNE DURÉE, JAMAIS UN TAUX** (D109).
--
-- *Une facture ne change pas quand un tarif change* — RG-TAR-04, et
-- `lib/tarification/` tout entier, qui refuse jusqu'à une fonction « le taux
-- courant ». **Deux endroits qui portent un prix, c'est une préséance à
-- inventer et une seconde historisation à tenir, pour rien.**
--
-- **Aucune colonne de montant ici**, et ce n'est pas une omission : un gardien
-- statique le refuse — `tests/unit/prestations/aucun-montant.test.ts`.
--
-- ## ET AUCUN LIEN VERS `forfait` NON PLUS (D113)
--
-- Le pont de D109 — *« quand une prestation se vend à prix fixe, elle DÉSIGNE un
-- forfait »* — vaut au sens où **l'INTERVENTION** reçoit le forfait par les
-- trois axes de RG-TAR-06, jamais au sens d'une clé étrangère portée par le
-- catalogue.
--
-- *La colonne écartée l'est pour une raison mesurable* : elle aurait fait naître
-- une question que personne n'a posée — **que se passe-t-il si le forfait
-- désigné ne s'applique pas à la zone de l'intervention ?** Les trois axes
-- peuvent le disqualifier, et il aurait fallu arbitrer d'avance une préséance
-- entre deux sélections de forfait. *Une question qui disparaît vaut mieux
-- qu'une question arbitrée d'avance.*
--
-- ## PROPRE À CHAQUE SOCIÉTÉ, et la raison n'est pas technique
--
-- `societe_id NOT NULL` : table métier de la PREMIÈRE catégorie de I1, de forme
-- « société ». *Une durée standard et une checklist décrivent la façon de
-- travailler d'une entreprise et le niveau de ses techniciens* — et le jour où
-- CODIPLAN est vendu à un concurrent de CODIMA, il n'héritera pas de ce
-- catalogue.
--
-- **La forme est « société » et non « interne », et le choix s'écrit parce
-- qu'une table qui naît le doit** (D94) : *le motif d'une entrée « interne » est
-- ce que son retrait ROUVRIRAIT*, et ici il n'y a rien — « l'entretien annuel
-- d'un pont élévateur dure 90 minutes » ne nomme ni client, ni site, ni
-- personne. Elle rejoint la classe que D94 laisse ouverte, avec sa condition de
-- réouverture : *le jour où un écran ou une route de portail lit une table de
-- forme « société »*.
--
-- Le `WITH CHECK` est ÉCRIT même s'il répète le `USING` (L1-02c) : une politique
-- qui n'énonce qu'un `USING` légifère en silence sur les écritures.

CREATE TABLE "prestation" (
  "id" UUID NOT NULL,
  "societe_id" UUID NOT NULL,

  "code" TEXT NOT NULL,
  "libelle" TEXT NOT NULL,

  -- FACULTATIVE : un déplacement, un diagnostic ou une formation ne visent
  -- aucune famille de matériel.
  "famille_id" UUID,

  -- NULLE quand personne ne l'a estimée — l'état ordinaire d'un catalogue qu'on
  -- remplit. Elle ne se confond pas avec zéro, qui dirait « instantané ».
  "duree_standard_min" INTEGER,

  "checklist_type" TEXT,

  "actif" BOOLEAN NOT NULL DEFAULT true,

  "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifie_le" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "prestation_pkey" PRIMARY KEY ("id"),

  -- Les bornes sont vraies de la DONNÉE, pas du formulaire : l'import Excel et
  -- une correction à la main sont deux chemins de plus. Zod les répète pour que
  -- le refus arrive à l'écran plutôt qu'en 500.
  CONSTRAINT "prestation_code_non_vide" CHECK (length(btrim("code")) > 0),
  CONSTRAINT "prestation_libelle_non_vide" CHECK (length(btrim("libelle")) > 0),
  -- ZÉRO N'EST PAS UNE DURÉE : une prestation qui dure zéro minute n'est pas une
  -- prestation. La même borne que la périodicité de `famille_materiel`.
  CONSTRAINT "prestation_duree_positive"
    CHECK ("duree_standard_min" IS NULL OR "duree_standard_min" > 0)
);

CREATE UNIQUE INDEX "prestation_societe_id_code_key"
  ON "prestation"("societe_id", "code");
CREATE INDEX "prestation_societe_id_famille_id_idx"
  ON "prestation"("societe_id", "famille_id");

ALTER TABLE "prestation"
  ADD CONSTRAINT "prestation_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- LA CLÉ EST COMPOSITE, et c'est le cloisonnement qui l'exige : *sans la
-- société dans la clé, une prestation pourrait désigner la famille d'une AUTRE
-- société*, et les contrôles d'intégrité référentielle contournent les
-- politiques RLS par construction. C'est la leçon de `modele_materiel`.
--
-- Les DEUX actions sont écrites et justifiées (§9, 24/08) : `RESTRICT` au
-- retrait — *une famille qu'une prestation vise ne s'efface pas sous elle* —,
-- `RESTRICT` à la mise à jour, parce qu'une valeur par défaut qui répond à une
-- question qu'on n'a pas posée est une décision prise par personne.
ALTER TABLE "prestation"
  ADD CONSTRAINT "prestation_famille_fkey"
  FOREIGN KEY ("societe_id", "famille_id")
  REFERENCES "famille_materiel"("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "prestation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prestation" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_societe" ON "prestation"
  USING ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)
  WITH CHECK ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "prestation" TO "codiplan_app";

-- ───────────────────────────────────────────────────────────────────────────
-- L'AUDIT (I8, D55)
-- ───────────────────────────────────────────────────────────────────────────
--
-- Le périmètre est INVERSÉ : toute table métier cloisonnée est auditée, et le
-- gardien la réclame le jour où elle apparaît. Elle le mérite sans qu'on
-- plaide : *une durée standard est ce contre quoi une intervention se compare*,
-- et qui l'a changée, quand, et depuis quelle valeur est exactement ce qu'on
-- cherchera le jour où une estimation paraîtra fausse.

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "prestation"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "prestation" IS
  'Le catalogue des prestations d''une société (L1-12, D109, D113). Table métier de la première catégorie de I1, forme « société ». UNE PRESTATION PORTE UNE DURÉE, JAMAIS UN TAUX : aucune colonne de montant, et aucun lien vers « forfait » — le pont de D109 passe par l''INTERVENTION, qui reçoit le forfait par les trois axes de RG-TAR-06. Propre à chaque société parce qu''une durée standard et une checklist décrivent la façon de travailler d''une entreprise.';

COMMENT ON COLUMN "prestation"."duree_standard_min" IS
  'La durée standard en minutes. NULLE quand personne ne l''a estimée — l''état ordinaire d''un catalogue qu''on remplit —, et jamais zéro, qui dirait « instantané ». Aucune valeur par défaut : le §8 interdit d''inventer un délai.';

COMMENT ON COLUMN "prestation"."checklist_type" IS
  'La checklist type, en texte LIBRE. Le chapitre 10 ne pose aucune structure de checklist, et en inventer une ici la figerait pour toutes les sociétés avant que quiconque en ait écrit une seule — fermer une énumération avant d''avoir tranché à qui l''on vend est une erreur que ce dépôt a déjà faite.';
