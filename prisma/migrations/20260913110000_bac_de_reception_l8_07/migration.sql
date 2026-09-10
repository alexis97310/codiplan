-- ═══════════════════════════════════════════════════════════════════════════
-- L8-07 — LE BAC DE RÉCEPTION : il PROPOSE, il ne classe jamais seul
-- Invariants I1, I8 ; arbitrages D87, D93, D94.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## Ce que cette migration établit
--
-- 1. `StatutDocumentRecu` — trois états, et le troisième porte son motif.
-- 2. `document_recu` — le fichier déposé, AVANT tout rapprochement.
-- 3. LA DÉDUPLICATION PAR EMPREINTE, tenue par la BASE : `UNIQUE (societe_id,
--    empreinte)`. *Deux fois le même PDF est un seul document, et le découvrir
--    après le rapprochement fait deux fois le travail.*
-- 4. LA TREIZIÈME FORME de politique — « interne » (D94).
-- 5. Son déclencheur d'audit (I8, D55).
--
-- ## POURQUOI L'UNICITÉ EST EN BASE ET NON DANS UNE LECTURE APPLICATIVE
--
-- Une déduplication écrite en code lit d'abord, puis écrit. Entre les deux, un
-- second dépôt du même fichier passe — et le bac est justement l'endroit où
-- l'on redépose, parce qu'un téléversement de plusieurs gigaoctets depuis
-- Nouméa se coupe et se reprend. **Le seul endroit où « une fois » se garantit
-- est l'index unique.** Le code lit le refus et rend « doublon » ; il ne le
-- prévient pas.
--
-- ## LA TREIZIÈME FORME — « interne » (D94), et ce qu'elle DÉCOUVRE
--
-- Le bac nomme des FICHIERS : `notice-KPX-337.pdf` dit qu'un pont élévateur
-- existe quelque part dans la société, exactement comme la notice que D93 vient
-- de fermer. **Une table de forme « société » est lisible par un compte
-- portail** — la clause ne lit pas `app.client_id` —, et donner cette forme au
-- bac aurait rouvert par la porte de service la fuite qu'on ferme par la porte
-- principale, dans le ticket même qui la ferme.
--
-- La forme ajoute donc un seul terme : `app.client_id IS NULL`. *Une table
-- interne n'est pas lisible par un compte portail, quel que soit son client.*
--
-- **ET ELLE DÉCOUVRE UNE QUESTION PLUS LARGE, qui n'est PAS tranchée ici**
-- (D94, condition de réouverture) : `taux_horaire`, `forfait`, `agence`,
-- `habilitation` et les autres tables de forme « société » sont dans le même
-- cas AUJOURD'HUI. Aucun écran de portail ne les lit, et le jour où l'un d'eux
-- les lira, la question sera due. Elle est écrite plutôt que tue.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LES TROIS ÉTATS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `a_traiter` est la NAISSANCE : un fichier déposé n'est pas classé, et il
-- n'est pas non plus écarté. Les deux autres sont TERMINAUX et portent chacun
-- leur preuve — une fiche pour l'un, un motif pour l'autre.

CREATE TYPE "StatutDocumentRecu" AS ENUM ('a_traiter', 'classe', 'ecarte');

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LA TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "document_recu" (
  "id"               uuid PRIMARY KEY,
  "societe_id"       uuid NOT NULL,

  "empreinte"        text NOT NULL,
  "nom_fichier"      text NOT NULL,
  "type_mime"        text NOT NULL,
  "taille_octets"    bigint NOT NULL,

  -- Où sont les octets, et où est l'aperçu de la PREMIÈRE PAGE. *La couverture
  -- porte la marque et le modèle ; l'œil fait le travail, pas la reconnaissance
  -- de caractères* — aucune dépendance d'OCR en V1. L'aperçu est NULLABLE : un
  -- fichier peut être déposé avant que sa première page soit rendue, et un bac
  -- qui refuserait le dépôt pour cela perdrait le téléversement.
  "objet_cle"        text NOT NULL,
  "apercu_objet_cle" text,

  "statut"           "StatutDocumentRecu" NOT NULL DEFAULT 'a_traiter',

  -- La fiche PRODUITE par le classement, et le MOTIF de l'écartement. Chacune
  -- est liée à son état par une contrainte NOMMÉE, dans les DEUX sens.
  "document_id"      uuid,
  "ecarte_motif"     text,

  "recu_le"          timestamptz NOT NULL DEFAULT now(),
  "modifie_le"       timestamptz NOT NULL
);

-- ── LA DÉDUPLICATION, TENUE PAR LA BASE (L8-07) ────────────────────────────
--
-- Par SOCIÉTÉ et non globalement : deux sociétés qui exploitent le même
-- matériel déposent légitimement la même notice, et une unicité globale ferait
-- de la seconde un doublon de la première — c'est-à-dire un cloisonnement
-- franchi par un index.
CREATE UNIQUE INDEX "document_recu_societe_empreinte_key"
  ON "document_recu" ("societe_id", "empreinte");

CREATE INDEX "document_recu_societe_statut_idx"
  ON "document_recu" ("societe_id", "statut");

ALTER TABLE "document_recu"
  ADD CONSTRAINT "document_recu_empreinte_sha256"
  CHECK ("empreinte" ~ '^[0-9a-f]{64}$');

ALTER TABLE "document_recu"
  ADD CONSTRAINT "document_recu_nom_fichier_non_vide"
  CHECK (btrim("nom_fichier") <> '');

ALTER TABLE "document_recu"
  ADD CONSTRAINT "document_recu_objet_cle_non_vide"
  CHECK (btrim("objet_cle") <> '');

ALTER TABLE "document_recu"
  ADD CONSTRAINT "document_recu_taille_positive"
  CHECK ("taille_octets" > 0);

-- ── LES DEUX SENS DE CHAQUE ÉTAT TERMINAL ──────────────────────────────────
--
-- `=` entre deux booléens est une ÉQUIVALENCE : elle refuse le classé sans
-- fiche ET la fiche sans classement. **Le second sens est celui qu'on oublie**
-- — c'est la leçon de D88 sur l'exception et son motif, rejouée ici.
ALTER TABLE "document_recu"
  ADD CONSTRAINT "document_recu_classe_a_sa_fiche"
  CHECK (("statut" = 'classe') = ("document_id" IS NOT NULL));

-- *Un écartement sans motif est un écartement que personne ne pourra rejuger.*
-- La base le refuse, elle ne le signale pas.
ALTER TABLE "document_recu"
  ADD CONSTRAINT "document_recu_ecarte_a_son_motif"
  CHECK (("statut" = 'ecarte') = ("ecarte_motif" IS NOT NULL AND btrim("ecarte_motif") <> ''));

-- ── Chaînages, COMPOSITES et par la société ────────────────────────────────
--
-- `ON DELETE RESTRICT` : supprimer la fiche produite sans revenir sur le reçu
-- laisserait un bac qui dit « classé » et ne montre rien. `ON UPDATE RESTRICT` :
-- `societe_id` entre dans la clé, et une propagation ferait changer de société
-- un bac entier.

ALTER TABLE "document_recu" ADD CONSTRAINT "document_recu_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "document_recu" ADD CONSTRAINT "document_recu_document_fkey"
  FOREIGN KEY ("societe_id", "document_id")
  REFERENCES "document" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. LE CLOISONNEMENT — forme « INTERNE » (D94)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Société, PLUS l'absence de `app.client_id`. Le discriminant est le même que
-- celui des formes « habilitation » et « ascendance », et il est ici employé
-- dans son sens le plus simple : *un compte portail ne lit pas cette table, quel
-- que soit son client.*

ALTER TABLE "document_recu" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_recu" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_interne" ON "document_recu"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "document_recu" TO "codiplan_app";

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. L'AUDIT (I8, D55)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Le périmètre est INVERSÉ : la table est métier et cloisonnée, donc auditée le
-- jour où elle apparaît. Elle le mérite doublement — *« qui a écarté ce
-- document, quand, et avec quel motif »* est la question que pose un travail
-- DÉLÉGUÉ, et ce travail le sera.

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "document_recu"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "document_recu" IS
  'LE BAC DE RÉCEPTION (L8-07, D87) : un fichier déposé AVANT tout rapprochement. Il PROPOSE, il ne classe jamais seul — un rapprochement faux accroche la notice d''un compresseur à un pont élévateur, et personne ne le voit avant qu''un technicien suive la mauvaise procédure. La déduplication par empreinte est tenue par l''INDEX UNIQUE (societe_id, empreinte) et non par une lecture applicative : entre un SELECT et un INSERT, un second dépôt du même fichier passe. Forme « interne » (D94) : société ET app.client_id absent — le bac nomme des fichiers, et un nom de fichier révèle le parc.';

COMMENT ON COLUMN "document_recu"."apercu_objet_cle" IS
  'Clé de l''aperçu de la PREMIÈRE PAGE dans le stockage d''objets. La couverture porte la marque et le modèle : l''œil fait le travail, pas la reconnaissance de caractères — aucune dépendance d''OCR en V1. NULLABLE, parce qu''un fichier peut être déposé avant que son aperçu soit rendu, et qu''un bac qui refuserait le dépôt pour cela perdrait le téléversement. AUCUN CODE NE LA REMPLIT AUJOURD''HUI : le module de stockage n''existe pas, faute d''appelant.';
