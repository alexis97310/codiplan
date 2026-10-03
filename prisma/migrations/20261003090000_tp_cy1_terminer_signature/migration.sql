-- ════════════════════════════════════════════════════════════════════════════
-- 9DE-TP-CY1 — LA SIGNATURE A TROIS ISSUES (décision du 03/10/2026, point 11 ;
-- D-S5).
--
-- Jusqu'ici, `intervention_signature` ne portait qu'une preuve : l'image et
-- le nom du signataire. Trois situations existent sur le terrain, et une
-- seule avait une table : le client qui signe, le client ABSENT, le client
-- qui REFUSE de signer. Les deux dernières ne s'effacent pas davantage
-- qu'une signature — elles entrent dans la MÊME table, historisée, avec un
-- motif à la place de l'image.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TYPE "IssueSignature" AS ENUM ('signee', 'client_absent', 'refus_signature');

-- ── 1. LES DEUX COLONNES NEUVES, D'ABORD SANS CONTRAINTE ───────────────────
--
-- `issue` naît NULLABLE : la table porte déjà des lignes, et aucune n'a
-- encore d'issue. La backfiller AVANT de poser NOT NULL est le seul ordre qui
-- n'invente rien (CLAUDE.md §8).

ALTER TABLE "intervention_signature"
  ADD COLUMN "issue" "IssueSignature",
  ADD COLUMN "motif" TEXT;

-- ── 2. LA REPRISE DE DONNÉES — AVEC SA PROPRE VÉRIFICATION ─────────────────
--
-- Toute ligne déjà en base porte une image (la contrainte
-- `intervention_signature_image_non_vide`, posée par 20260922100000, le
-- garantit depuis l'origine de la table) : elle devient donc « signee ».
-- **Vérifié ici, jamais supposé** — une correction silencieuse serait
-- exactement la faute que le §8 interdit : inventer une valeur par défaut
-- sur ce qu'on ne peut pas prouver.
--
-- **Le drapeau `FORCE ROW LEVEL SECURITY` est LEVÉ, et la levée CONSTATÉE**
-- (L1-02, 07/09/2026) : sur la base hébergée, le rôle de migration est
-- propriétaire NON superutilisateur, et un bloc qui lirait `intervention_
-- signature` sous `FORCE` verrait ZÉRO ligne — il ne se tromperait pas, il ne
-- regarderait rien. Le gardien `tests/unit/db/gardes-de-migration.test.ts`
-- refuse tout bloc de garde qui ne lève ni ne constate.

ALTER TABLE "intervention_signature" NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  "aveugle" boolean;
  "sans_image" integer;
BEGIN
  SELECT "c"."relforcerowsecurity" INTO "aveugle"
    FROM "pg_catalog"."pg_class" "c"
   WHERE "c"."relname" = 'intervention_signature';
  IF "aveugle" IS DISTINCT FROM false THEN
    RAISE EXCEPTION
      'Contrôle creux : FORCE ROW LEVEL SECURITY n''a pas été levé sur intervention_signature.';
  END IF;

  SELECT count(*) INTO "sans_image"
    FROM "intervention_signature"
   WHERE "image_base64" IS NULL OR btrim("image_base64") = '';
  IF "sans_image" > 0 THEN
    RAISE EXCEPTION
      'Migration refusée : % signature(s) existante(s) sans image — elles ne peuvent pas devenir "signee" sans preuve, et aucune valeur ne s''invente (CLAUDE.md §8).',
      "sans_image";
  END IF;
END $$;

ALTER TABLE "intervention_signature" FORCE ROW LEVEL SECURITY;

UPDATE "intervention_signature" SET "issue" = 'signee' WHERE "issue" IS NULL;

ALTER TABLE "intervention_signature" ALTER COLUMN "issue" SET NOT NULL;

-- ── 3. L'IMAGE DEVIENT FACULTATIVE — seule l'issue « signee » en porte une ─

ALTER TABLE "intervention_signature" ALTER COLUMN "image_base64" DROP NOT NULL;

ALTER TABLE "intervention_signature"
  DROP CONSTRAINT "intervention_signature_image_non_vide";

-- ── 4. LA COHÉRENCE DE L'ISSUE — UNE SEULE CONTRAINTE, SES DEUX FORMES ─────
--
-- « signee » ⇔ une image non vide ET aucun motif. « client_absent » /
-- « refus_signature » ⇔ aucune image ET un motif non vide. Les deux formes
-- sont des JUMELLES : une ligne qui mélangerait les deux (une image ET un
-- motif, ou ni l'un ni l'autre) est refusée, quelle que soit l'issue déclarée.

ALTER TABLE "intervention_signature"
  ADD CONSTRAINT "intervention_signature_issue_coherente" CHECK (
    (
      "issue" = 'signee'
      AND "image_base64" IS NOT NULL AND btrim("image_base64") <> ''
      AND "motif" IS NULL
    )
    OR
    (
      "issue" IN ('client_absent', 'refus_signature')
      AND "image_base64" IS NULL
      AND "motif" IS NOT NULL AND btrim("motif") <> ''
    )
  );

COMMENT ON COLUMN "intervention_signature"."issue" IS
  'LES TROIS ISSUES DU « TERMINER » (9DE-TP-CY1, D-S5) : signee (image + nom), client_absent ou refus_signature (motif, aucune image). Voir intervention_signature_issue_coherente.';

COMMENT ON COLUMN "intervention_signature"."motif" IS
  'Le motif de l''absence ou du refus — obligatoire pour ces deux issues, NULL pour "signee" (intervention_signature_issue_coherente).';

-- L'immutabilité (UPDATE/DELETE retirés au rôle applicatif, FORCE ROW LEVEL
-- SECURITY, aucune politique UPDATE/DELETE) reste exactement celle posée par
-- 20260922100000 : ajouter des colonnes à une table ne change rien à ses
-- privilèges ni à ses politiques.
