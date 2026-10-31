-- ═══════════════════════════════════════════════════════════════════════════
-- 9I8C-INFOS-MACHINE-FICHE-ET-BON — L'ANNÉE DE FABRICATION (PLAQUE) ──────────
--
-- Additive, nullable, sans donnée existante réécrite. Distincte de
-- `date_vente` (la transaction commerciale) et de `date_mise_en_service` (le
-- premier usage) : la plaque peut porter une année de plusieurs années
-- antérieure à la vente.
--
-- ── BORNES FIXES, ET NON « 1900 À L'ANNÉE COURANTE + 1 » ────────────────────
--
-- Une contrainte CHECK n'accepte que des expressions IMMUTABLES : PostgreSQL
-- refuse `current_date` et `now()` dans une contrainte, précisément parce
-- qu'une borne qui bouge avec l'horloge rendrait la contrainte elle-même
-- instable (une ligne valide aujourd'hui pourrait violer la même contrainte
-- demain sans qu'aucune écriture ne l'ait touchée). 1900 et 2100 couvrent
-- largement le parc réel et son horizon, et c'est une borne FIXE, choisie en
-- connaissance de cette limite plutôt que subie.
--
-- ── POURQUOI AUCUN BLOC DE GARDE (§9, 07/09) ──────────────────────────────
--
-- La colonne est NULLABLE, sans défaut : aucune ligne existante n'est en
-- défaut au moment de l'ajout.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "machine"
  ADD COLUMN "annee_fabrication" integer;

COMMENT ON COLUMN "machine"."annee_fabrication" IS
  '9I8C — année de fabrication lue sur la plaque, facultative, distincte de date_vente et de date_mise_en_service. Bornée à [1900, 2100] par machine_annee_fabrication_bornes — une borne FIXE, une contrainte CHECK ne pouvant pas appeler current_date (non immutable).';

ALTER TABLE "machine"
  ADD CONSTRAINT "machine_annee_fabrication_bornes"
  CHECK (
    "annee_fabrication" IS NULL
    OR ("annee_fabrication" BETWEEN 1900 AND 2100)
  );
