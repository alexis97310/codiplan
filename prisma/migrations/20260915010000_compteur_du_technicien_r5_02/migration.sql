-- ════════════════════════════════════════════════════════════════════════════
-- R5-02 — LE COMPTEUR DU TECHNICIEN. Des SEGMENTS, jamais un total.
--
-- **Le compteur fait foi pour le temps** — décision d'exploitation du
-- 15/09/2026 (D119). Ce que cette table porte n'est donc pas une saisie : ce
-- sont des faits datés, et le total facturé s'en déduit. L'arrondi au quart
-- d'heure supérieur et le plancher d'une heure restent où ils sont
-- (`lib/tarification/valorisation.ts`, RG-TAR-05, D83, D89) : *arrondir à
-- l'écriture ferait deux lectures d'un même critère, et la seconde déciderait
-- du prix sans que la première laisse de trace* (§9, 01/09).
--
-- ── POURQUOI DES SEGMENTS ──────────────────────────────────────────────────
--
-- *Une pause est un fait, et un compteur qui ne garde que le total ne peut pas
-- dire ce qui s'est passé entre-temps.* Un technicien qui démarre à 8 h,
-- s'interrompt à 10 h et reprend à 14 h a travaillé quatre heures ; un couple
-- unique début/fin en dirait six, et personne ne saurait lesquelles.
--
-- ── CE QUE CETTE MIGRATION NE FAIT PAS, ET IL FAUT LE LIRE ─────────────────
--
-- **Elle ne touche NI `intervention.statut`, NI `intervention.temps_reel_min`.**
-- Ce sont deux questions ouvertes, posées à Alexis plutôt que répondues par
-- accident :
--
--   *(1)* démarrer le compteur doit-il faire passer l'intervention EN COURS ?
--         RG-INT-01 exige alors une machine rattachée, et la base le tient au
--         passage en statut de travail — or *le dépannage à l'aveugle est le
--         cas ordinaire*. Répondre « oui » ici rendrait le compteur
--         indémarrable sur l'appel du matin.
--
--   *(2)* qui écrit `temps_reel_min`, désormais ? La colonne a aujourd'hui UN
--         seul chemin d'écriture, la clôture depuis le back-office. Le
--         compteur faisant foi, ce chemin devient une SECONDE source du même
--         fait — et c'est exactement la divergence du §9. La réparation touche
--         ce qu'un client paie : elle n'est pas prise en séance.
--
-- *Une table qui n'écrit rien ailleurs qu'en elle-même ne peut pas se tromper
-- sur ce qu'elle n'a pas décidé.*
--
-- Elle ne LIT aucune table : aucun bloc de garde, donc aucun risque de compter
-- zéro sous `FORCE ROW LEVEL SECURITY` en croyant mesurer (§9, 07/09).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE "segment_travail" (
  -- **PAS de `DEFAULT gen_random_uuid()`**, à la différence d'`absence` : un
  -- segment naît sur l'APPAREIL (I10, L2-03), et l'identifiant vient avec lui.
  -- Un défaut en base ferait croire qu'on peut l'omettre, et la ligne insérée
  -- hors ligne recevrait alors deux identités.
  "id"              uuid NOT NULL,
  "societe_id"      uuid NOT NULL,
  "intervention_id" uuid NOT NULL,
  -- QUI a travaillé — pas forcément `intervention.technicien_id` : un renfort
  -- d'une heure est un fait, et l'affectation n'en dit rien.
  "utilisateur_id"  uuid NOT NULL,

  -- L'heure du TERRAIN, jamais celle de l'arrivée en base : `cree_le` dit
  -- quand la ligne est arrivée, `debut` quand le travail a commencé.
  "debut"           timestamptz(3) NOT NULL,
  -- NULL = il tourne encore. Jamais « on ne sait pas » : l'index partiel
  -- ci-dessous n'autorise qu'UN segment ouvert par personne, ce qui rend cet
  -- état non ambigu.
  "fin"             timestamptz(3),

  "cree_le"         timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifie_le"      timestamptz(3) NOT NULL,

  CONSTRAINT "segment_travail_pkey" PRIMARY KEY ("id"),

  -- Un segment dont la fin précède le début n'est pas un segment. **Strict, et
  -- non `>=`** : un segment de durée nulle ne mesure rien, et il compterait
  -- pourtant comme un segment fermé — c'est-à-dire comme du travail qui a eu
  -- lieu.
  CONSTRAINT "segment_travail_fin_apres_debut" CHECK ("fin" IS NULL OR "fin" > "debut")
);

CREATE UNIQUE INDEX "segment_travail_societe_id_id_key" ON "segment_travail" ("societe_id", "id");
CREATE INDEX "segment_travail_intervention_idx" ON "segment_travail" ("societe_id", "intervention_id", "debut");
CREATE INDEX "segment_travail_auteur_idx" ON "segment_travail" ("societe_id", "utilisateur_id", "debut");

-- ── UN SEUL COMPTEUR OUVERT PAR PERSONNE ───────────────────────────────────
--
-- **Ce n'est pas une règle de gestion inventée, c'est un fait physique** : une
-- personne ne travaille pas à deux endroits à la fois. La borne porte sur la
-- PERSONNE et non sur l'intervention — deux compteurs ouverts sur deux
-- interventions différentes est précisément le cas qu'on refuse, et une clé
-- (société, intervention) l'aurait laissé passer.
--
-- **Un index PARTIEL, et c'est ce qui le rend juste** : il ne contraint que les
-- segments ouverts. Les segments FERMÉS peuvent se recouvrir, et ce n'est pas
-- un oubli — I5 dit que *le travail terrain n'est jamais perdu*, et deux
-- saisies hors ligne qui se chevauchent sont un fait à conserver et à
-- signaler, jamais une écriture à refuser. *Refuser ici ferait perdre du
-- travail réel pour préserver une propriété que personne n'a demandée.*
CREATE UNIQUE INDEX "segment_travail_un_seul_ouvert_par_personne"
  ON "segment_travail" ("societe_id", "utilisateur_id")
  WHERE "fin" IS NULL;

-- Les DEUX actions référentielles sont dites et justifiées (§9, 24/08).
-- `RESTRICT` partout : une intervention ne se supprime pas en laissant le temps
-- qu'on y a passé, et le rattachement d'une personne à une société ne se retire
-- pas en laissant ses segments orphelins.
--
-- **AUCUNE clé étrangère vers `utilisateur`** — quatrième catégorie de I1, sans
-- `societe_id` ; la clé passe par `utilisateur_societe`, qui porte les deux
-- colonnes (la forme d'`absence` et de `technicien_habilitation`).
ALTER TABLE "segment_travail"
  ADD CONSTRAINT "segment_travail_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "segment_travail_intervention_fkey"
    FOREIGN KEY ("societe_id", "intervention_id")
    REFERENCES "intervention"("societe_id", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "segment_travail_auteur_fkey"
    FOREIGN KEY ("utilisateur_id", "societe_id")
    REFERENCES "utilisateur_societe"("utilisateur_id", "societe_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────────────────────────────────────────────────────────────────────
-- LE CLOISONNEMENT — forme « interne » (D94)
-- ───────────────────────────────────────────────────────────────────────────
--
-- Société ET `app.client_id` ABSENT. Le discriminant est posé pour un compte de
-- portail et pour lui seul (D70) : un rôle interne garde la clause de société,
-- un compte portail ne lit RIEN, quel que soit son client.
--
-- **Pourquoi « interne » et non « parc ».** *Combien de temps une personne
-- nommée a passé chez un client, minute par minute, est une information sur
-- cette personne* — pas sur le parc du client. Ce qu'un client a le droit de
-- savoir est le temps FACTURÉ de SON intervention, qui se lit sur
-- l'intervention. C'est la décision d'`absence`, prise pour la même raison, et
-- prise ici à la NAISSANCE de la table : le seul moment où elle ne coûte rien.
--
-- Le `WITH CHECK` est ÉCRIT même s'il répète le `USING` (L1-02c) : une
-- politique qui n'énonce qu'un `USING` légifère en silence sur les écritures.

ALTER TABLE "segment_travail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "segment_travail" FORCE ROW LEVEL SECURITY;

-- ── TROIS POLITIQUES, UNE PAR VERBE — ET C'EST LA QUATRIÈME QUI COMPTE ─────
--
-- **Une politique sans clause `FOR` couvre les QUATRE verbes**, `DELETE`
-- compris. C'est la forme d'`absence`, et elle est juste là-bas : une absence
-- se supprime. Ici elle serait fausse — et elle l'a été, MESURÉE plutôt que
-- relue : *la première rédaction de cette migration écrivait une politique
-- unique et un `GRANT` sans `DELETE`, et la suppression est PASSÉE.* Deux
-- causes s'additionnaient, et chacune aurait suffi : la politique couvrait le
-- verbe, et `ALTER DEFAULT PRIVILEGES` (migration 20260820130000) accorde
-- d'avance les quatre verbes au rôle applicatif sur **toute table créée
-- ensuite** — un `GRANT` qui en nomme trois n'en retire aucun (§9, 30/08, sur
-- les partitions : *une garantie posée sur une table ne suit pas ce qui naît
-- après elle*).
--
-- Sous `FORCE ROW LEVEL SECURITY`, **un verbe sans politique est refusé pour
-- tout le monde**. `DELETE` n'en a donc aucune, et le privilège lui est retiré
-- explicitement : refusé DEUX FOIS plutôt qu'une, comme le journal d'audit.
--
-- *Le compteur fait foi pour le temps ; un temps qui peut disparaître sans
-- trace ne fait foi de rien.* Une erreur se CORRIGE — l'`UPDATE` reste ouvert,
-- et le journal d'audit en garde les valeurs avant et après (I8). Elle ne
-- s'efface pas.
--
-- Chaque politique d'écriture énonce son `WITH CHECK`, même quand il répète le
-- `USING` (L1-02c) : *une politique qui n'énonce qu'un `USING` légifère en
-- silence sur les écritures.*

CREATE POLICY "cloisonnement_interne_lecture" ON "segment_travail"
  FOR SELECT
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  );

CREATE POLICY "cloisonnement_interne_ajout" ON "segment_travail"
  FOR INSERT
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  );

CREATE POLICY "cloisonnement_interne_modification" ON "segment_travail"
  FOR UPDATE
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  );

GRANT SELECT, INSERT, UPDATE ON "segment_travail" TO "codiplan_app";
REVOKE DELETE, TRUNCATE ON "segment_travail" FROM "codiplan_app";

-- ───────────────────────────────────────────────────────────────────────────
-- L'AUDIT (I8, D55) — le périmètre est inversé : le gardien le réclame le jour
-- où la table apparaît, et celle-ci le mérite sans qu'on ait à plaider. *Ce
-- qu'elle porte décide de ce qu'un client paie.*
-- ───────────────────────────────────────────────────────────────────────────

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "segment_travail"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "segment_travail" IS
  'CE QUE LE COMPTEUR DU TECHNICIEN A MESURÉ (R5-02, D119). Des SEGMENTS, jamais un total : une pause est un fait, et un compteur qui ne garde que le total ne peut pas dire ce qui s''est passé entre-temps. Le compteur FAIT FOI pour le temps ; l''arrondi au quart d''heure supérieur et le plancher d''une heure restent dans la valorisation (RG-TAR-05, D83, D89) — arrondir à l''écriture ferait deux lectures d''un même critère. Table métier de la première catégorie de I1, forme « INTERNE » (D94) : société ET app.client_id absent. Aucun compte de portail ne la lit — combien de temps une personne nommée a passé chez un client, minute par minute, est une information sur cette personne ; ce qu''un client a le droit de savoir est le temps FACTURÉ de SON intervention.';

COMMENT ON COLUMN "segment_travail"."debut" IS
  'L''heure du TERRAIN, jamais celle de l''arrivée en base : cree_le dit quand la ligne est arrivée, debut quand le travail a commencé. L''ordre d''arrivée n''est pas l''ordre des faits (L2-03).';

COMMENT ON COLUMN "segment_travail"."fin" IS
  'NULL veut dire « il tourne encore », jamais « on ne sait pas » : un index partiel n''autorise qu''UN segment ouvert par personne, ce qui rend cet état non ambigu.';

COMMENT ON COLUMN "segment_travail"."utilisateur_id" IS
  'QUI a travaillé — pas forcément intervention.technicien_id : un renfort d''une heure est un fait, et l''affectation n''en dit rien.';
