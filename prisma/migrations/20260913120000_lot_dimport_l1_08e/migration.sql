-- ═══════════════════════════════════════════════════════════════════════════
-- L1-08e — LE LOT D'IMPORT EXISTE DÈS LE CONTRÔLE
-- Invariants I1, I6, I8 ; arbitrages D15, D31, D54, D94, D100.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## Ce que cette migration établit
--
-- 1. Deux énumérations — l'état d'un lot, et l'action d'une ligne.
-- 2. `import_lot` et `import_lot_ligne` : le rapport de I6, rendu DURABLE.
-- 3. LA FORME « INTERNE » sur les deux (D100).
-- 4. Leurs déclencheurs d'audit (I8, D55).
--
-- ## POURQUOI LE LOT NAÎT AU CONTRÔLE, ET NON À L'APPLICATION
--
-- I6 : un import « produit d'abord un rapport, puis attend une validation
-- explicite ». **L'application ne peut appliquer que ce que le rapport a
-- MONTRÉ** — sans quoi la validation porte sur un écran et l'écriture sur
-- autre chose. Le rapport doit donc vivre quelque part entre les deux, et le
-- chapitre 11 le disait depuis l'origine sans que personne l'ait lu ainsi :
-- `import_lot.statut` vaut `controle`, `applique` ou `annule`. *Le lot EXISTE
-- dès le contrôle.*
--
-- ## POURQUOI LA FORME « INTERNE » ET NON « SOCIÉTÉ » (D100)
--
-- `import_lot_ligne.valeurs` porte **la ligne du fichier telle qu'elle a été
-- lue**. Un fichier d'import de parc contient TOUTES les machines de la
-- société : *aucun périmètre de sites ne l'a jamais filtré, et aucun ne le
-- filtrera — un fichier d'import n'est pas une vue, c'est une source.* Or une
-- table de forme « société » est lisible par un compte de portail, sa clause
-- ne lisant pas `app.client_id`. Lui donner cette forme aurait rendu à un
-- compte restreint à un atelier **la liste intégrale du parc de sa société**,
-- par une table que personne n'aurait pensé à regarder.
--
-- C'est la fuite que D94 ferme sur le bac de réception, un étage plus loin :
-- là un NOM DE FICHIER révélait le parc ; ici c'est le parc lui-même.
--
-- **Et le choix est fait À LA NAISSANCE**, ce qui est la seule chose qui le
-- rend bon marché : I1 écrit que *le seul moment où la question de
-- cloisonnement se pose sans effort est celui où la table est créée.*

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LES DEUX ÉNUMÉRATIONS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `controle` est la NAISSANCE : le rapport existe, rien n'a été écrit dans le
-- parc. Les deux autres états sont TERMINAUX et datés.

CREATE TYPE "StatutImportLot" AS ENUM ('controle', 'applique', 'annule');

-- CINQ valeurs, là où le chapitre 11 en écrivait trois. `gabarit` et `vide`
-- viennent de L1-08c/d, MESURÉES sur le fichier réel de l'exploitation : 652
-- lignes pour 55 codes réels sur l'onglet Clients. *Les ranger sous « rejet »
-- ferait 597 erreurs sur un fichier sain* — la panne par le bruit. Elles sont
-- COMPTÉES et non rejetées.
CREATE TYPE "ActionImportLigne" AS ENUM ('creation', 'modification', 'gabarit', 'vide', 'rejet');

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LE LOT
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "import_lot" (
  "id"                   uuid PRIMARY KEY,
  "societe_id"           uuid NOT NULL,

  -- Le marqueur du fichier (D31), et la version que le code a lue. Ce sont des
  -- données du FICHIER, pas une énumération du produit : un type inconnu est
  -- refusé par la grammaire, il n'a pas à être fermé ici.
  "type_import"          text NOT NULL,
  "version_modele"       integer NOT NULL,

  "utilisateur_id"       uuid NOT NULL,

  "nom_fichier"          text NOT NULL,
  -- Où sont les octets du fichier source, quand ils sont conservés. NULLABLE,
  -- et AUCUN CODE NE LA REMPLIT : le stockage d'objets n'a pas d'appelant.
  "objet_cle"            text,

  "statut"               "StatutImportLot" NOT NULL DEFAULT 'controle',

  "lignes_creations"     integer NOT NULL DEFAULT 0,
  "lignes_modifications" integer NOT NULL DEFAULT 0,
  "lignes_rejets"        integer NOT NULL DEFAULT 0,
  "lignes_gabarits"      integer NOT NULL DEFAULT 0,
  "lignes_vides"         integer NOT NULL DEFAULT 0,

  "controle_le"          timestamptz NOT NULL DEFAULT now(),
  "applique_le"          timestamptz,
  "annule_le"            timestamptz
);

CREATE UNIQUE INDEX "import_lot_societe_id_key" ON "import_lot" ("societe_id", "id");
CREATE INDEX "import_lot_societe_statut_idx" ON "import_lot" ("societe_id", "statut");

ALTER TABLE "import_lot"
  ADD CONSTRAINT "import_lot_nom_fichier_non_vide"
  CHECK (btrim("nom_fichier") <> '');

ALTER TABLE "import_lot"
  ADD CONSTRAINT "import_lot_type_non_vide"
  CHECK (btrim("type_import") <> '');

ALTER TABLE "import_lot"
  ADD CONSTRAINT "import_lot_version_positive"
  CHECK ("version_modele" > 0);

ALTER TABLE "import_lot"
  ADD CONSTRAINT "import_lot_decomptes_positifs"
  CHECK ("lignes_creations" >= 0 AND "lignes_modifications" >= 0
     AND "lignes_rejets" >= 0 AND "lignes_gabarits" >= 0 AND "lignes_vides" >= 0);

-- ── LES DEUX SENS DE CHAQUE ÉTAT TERMINAL ──────────────────────────────────
--
-- `=` entre deux booléens est une ÉQUIVALENCE : elle refuse l'état sans sa
-- date ET la date sans son état. **Le second sens est celui qu'on oublie** —
-- une date d'application sur un lot resté « contrôlé » dirait qu'un import a
-- eu lieu sans qu'aucun statut ne le porte.
ALTER TABLE "import_lot"
  ADD CONSTRAINT "import_lot_applique_a_sa_date"
  CHECK (("statut" = 'applique') = ("applique_le" IS NOT NULL));

ALTER TABLE "import_lot"
  ADD CONSTRAINT "import_lot_annule_a_sa_date"
  CHECK (("statut" = 'annule') = ("annule_le" IS NOT NULL));

-- Chaînages. `RESTRICT` des deux côtés et pour les deux verbes : effacer
-- l'identité qui a importé effacerait la réponse à « qui a écrit cette
-- machine », et `societe_id` entre dans une clé — une propagation ferait
-- changer de société un lot entier.
ALTER TABLE "import_lot" ADD CONSTRAINT "import_lot_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "import_lot" ADD CONSTRAINT "import_lot_utilisateur_id_fkey"
  FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. LES LIGNES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "import_lot_ligne" (
  "id"            uuid PRIMARY KEY,
  "societe_id"    uuid NOT NULL,
  "import_lot_id" uuid NOT NULL,

  "rang"          integer NOT NULL,
  "action"        "ActionImportLigne" NOT NULL,

  -- Ce que la ligne DÉSIGNE. Absente pour un gabarit et pour une ligne vide :
  -- ils ne désignent rien, et leur inventer une clé les ferait entrer dans
  -- l'espace des clés réelles, où deux lignes muettes deviendraient la même
  -- machine (L1-08c).
  "cle"           text,
  "complete"      boolean,

  "entite"        text,
  "entite_id"     uuid,
  "rejet_motif"   text,

  "valeurs"       jsonb NOT NULL,
  -- CE QUE D15 EXIGE POUR RESTAURER. Écrite par l'APPLICATION quand elle
  -- écrase une fiche existante, jamais par le contrôle : avant l'application,
  -- il n'y a rien à restaurer.
  "valeurs_avant" jsonb
);

CREATE UNIQUE INDEX "import_lot_ligne_lot_rang_key"
  ON "import_lot_ligne" ("import_lot_id", "rang");
CREATE INDEX "import_lot_ligne_societe_lot_idx"
  ON "import_lot_ligne" ("societe_id", "import_lot_id");

ALTER TABLE "import_lot_ligne"
  ADD CONSTRAINT "import_lot_ligne_rang_positif"
  CHECK ("rang" >= 1);

-- ── L'ÉQUIVALENCE DU REJET, DANS LES DEUX SENS ─────────────────────────────
--
-- *Un rejet sans motif est un rejet que personne ne pourra rejuger* — et un
-- motif sans rejet est une ligne qu'on croit refusée alors qu'elle passera.
ALTER TABLE "import_lot_ligne"
  ADD CONSTRAINT "import_lot_ligne_rejet_a_son_motif"
  CHECK (("action" = 'rejet') = ("rejet_motif" IS NOT NULL AND btrim("rejet_motif") <> ''));

-- ── CE QUI NE DÉSIGNE RIEN N'A PAS DE CLÉ, ET RÉCIPROQUEMENT ───────────────
--
-- La propriété que L1-08c a PROUVÉE plutôt qu'espérée : un gabarit et une
-- ligne vide ne portent AUCUNE clé. La base la tient désormais aussi, et dans
-- les deux sens — une clé sur un gabarit le ferait entrer dans l'espace des
-- clés réelles.
ALTER TABLE "import_lot_ligne"
  ADD CONSTRAINT "import_lot_ligne_muette_sans_cle"
  CHECK (("action" IN ('gabarit', 'vide')) = ("cle" IS NULL));

-- `complete` QUALIFIE une clé : elle ne vaut rien sans elle, et elle manque
-- dès qu'il y en a une. *Un nombre dont la signification dépend d'une autre
-- colonne ne voyage jamais seul* (D56).
ALTER TABLE "import_lot_ligne"
  ADD CONSTRAINT "import_lot_ligne_complete_suit_la_cle"
  CHECK (("cle" IS NULL) = ("complete" IS NULL));

-- Chaînage COMPOSITE vers le lot : sans la société DANS la clé, une ligne
-- pourrait s'adosser au lot d'une AUTRE société — les contrôles d'intégrité
-- référentielle contournent les politiques RLS par construction.
--
-- `CASCADE` en suppression, et c'est la SEULE des deux clés qui propage : une
-- ligne n'a aucune vie propre, elle ne signifie rien sans son lot. La cascade
-- reste auditée, le déclencheur de I8 étant `FOR EACH ROW`.
ALTER TABLE "import_lot_ligne" ADD CONSTRAINT "import_lot_ligne_lot_fkey"
  FOREIGN KEY ("societe_id", "import_lot_id")
  REFERENCES "import_lot" ("societe_id", "id")
  ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE "import_lot_ligne" ADD CONSTRAINT "import_lot_ligne_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. LE CLOISONNEMENT — forme « INTERNE » (D94, D100)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Société, PLUS l'absence de `app.client_id`. *Un compte portail ne lit pas
-- ces tables, quel que soit son client.*

ALTER TABLE "import_lot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_lot" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_interne" ON "import_lot"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  );

ALTER TABLE "import_lot_ligne" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_lot_ligne" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_interne" ON "import_lot_ligne"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "import_lot" TO "codiplan_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON "import_lot_ligne" TO "codiplan_app";

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. L'AUDIT (I8, D55)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Le périmètre est INVERSÉ : ces tables sont métier et cloisonnées, donc
-- auditées le jour où elles apparaissent. Elles le méritent doublement — *« qui
-- a appliqué cet import, et qu'est-ce qui a été écrasé »* est la question que
-- l'annulation partielle de I6 devra trancher ligne à ligne.

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "import_lot"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "import_lot_ligne"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "import_lot" IS
  'UN LOT D''IMPORT (L1-08e, I6) — le rapport de contrôle rendu DURABLE. Le lot EXISTE DÈS LE CONTRÔLE : I6 veut qu''un import produise d''abord un rapport, PUIS attende une validation explicite, et l''application ne peut appliquer que ce que le rapport a MONTRÉ. Forme « interne » (D100) : société ET app.client_id absent — ses lignes portent le parc entier, qu''aucun périmètre de sites n''a filtré.';

COMMENT ON COLUMN "import_lot"."objet_cle" IS
  'Clé du fichier source dans le stockage d''objets. NULLABLE, et AUCUN CODE NE LA REMPLIT : le module de stockage n''existe pas, faute d''appelant (§6 du CLAUDE.md). Une colonne qui attend est écrite comme telle, jamais remplie d''un chemin fabriqué.';

COMMENT ON COLUMN "import_lot_ligne"."valeurs_avant" IS
  'CE QUE D15 EXIGE POUR RESTAURER à l''annulation : la fiche telle qu''elle était AVANT que l''import l''écrase. Écrite par l''APPLICATION seule — avant elle, il n''y a rien à restaurer. L''annulation est partielle et sûre : refus motivé sur les lignes modifiées ou référencées depuis, jamais de suppression en cascade.';
