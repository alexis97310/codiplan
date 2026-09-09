-- ═══════════════════════════════════════════════════════════════════════════
-- LE PARAMÉTRAGE PAR AGENCE — pas de créneau, et exception par technicien
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Le planning en avait besoin, et le besoin nomme la règle : *aucun calendrier
-- global codé en dur* (I7). Les horaires et les jours travaillés existaient
-- déjà — `calendrier` et `calendrier_plage`, depuis L0-08. Il manquait deux
-- choses : le PAS de la grille de créneaux, et le cas du technicien dont la
-- disponibilité n'est pas celle de son agence.

-- ── 1. LE PAS DE CRÉNEAU ────────────────────────────────────────────────────
--
-- 30 minutes est une valeur d'AMORÇAGE, pas une règle métier : l'exploitation
-- la change à l'écran de réglage. Elle est en base plutôt que dans un
-- composant, parce qu'une valeur en dur dans un composant n'est réglable par
-- personne.
--
-- Le `CHECK` borne ce qui a un sens : un pas nul ferait une grille infinie, un
-- pas de plus d'une journée n'en ferait aucune.
ALTER TABLE "calendrier"
  ADD COLUMN "pas_creneau_minutes" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "calendrier"
  ADD CONSTRAINT "calendrier_pas_creneau_borne"
  CHECK ("pas_creneau_minutes" > 0 AND "pas_creneau_minutes" <= 480);

COMMENT ON COLUMN "calendrier"."pas_creneau_minutes" IS
  'Pas de la grille de créneaux du planning, en minutes locales. Une valeur PAR CALENDRIER, donc par agence (I7) : rien ne dit que Ducos et Koné découpent leur journée pareil. 30 est une valeur d''amorçage réglable à l''écran, jamais une règle métier.';

-- ── 2. L'EXCEPTION PAR TECHNICIEN ───────────────────────────────────────────
--
-- Un RATTACHEMENT, pas une copie d'horaires : le technicien reçoit un AUTRE
-- calendrier de la même société. Recopier des plages à côté de celles d'un
-- calendrier aurait fait deux lectures d'un même critère, et la seconde aurait
-- cessé d'être vraie au premier changement d'horaires.
--
-- Deux actions référentielles pour chaque clé, et elles sont dites (§9, 24/08) :
-- `ON DELETE RESTRICT` — on ne supprime pas un calendrier dont un technicien
-- dépend sans avoir décidé où il passe ; `ON UPDATE RESTRICT` — aucune
-- propagation silencieuse (D49).

CREATE TABLE "technicien_calendrier" (
  "societe_id"     UUID NOT NULL,
  "utilisateur_id" UUID NOT NULL,
  "calendrier_id"  UUID NOT NULL,
  "cree_le"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifie_le"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "technicien_calendrier_pkey"
    PRIMARY KEY ("societe_id", "utilisateur_id")
);

CREATE INDEX "technicien_calendrier_societe_id_calendrier_id_idx"
  ON "technicien_calendrier" ("societe_id", "calendrier_id");

ALTER TABLE "technicien_calendrier"
  ADD CONSTRAINT "technicien_calendrier_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Le calendrier est chaîné PAR SON COUPLE avec la société : sans cela, un
-- technicien de A pourrait recevoir le calendrier de B. Même forme que D48 sur
-- le territoire d'un férié.
ALTER TABLE "calendrier"
  ADD CONSTRAINT "calendrier_societe_id_id_key" UNIQUE ("societe_id", "id");

ALTER TABLE "technicien_calendrier"
  ADD CONSTRAINT "technicien_calendrier_societe_id_calendrier_id_fkey"
  FOREIGN KEY ("societe_id", "calendrier_id")
  REFERENCES "calendrier"("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ── 3. LE CLOISONNEMENT — forme « société » (I1) ────────────────────────────
--
-- Table métier ORDINAIRE : elle ne porte aucune donnée du parc, elle dit quand
-- un salarié de la société travaille. Ce n'est pas une habilitation non plus —
-- elle n'ouvre aucun accès, elle décrit une disponibilité.
--
-- Le `WITH CHECK` est ÉCRIT même s'il répète le `USING` : une politique qui
-- n'énonce qu'un `USING` légifère en silence sur les écritures (L1-02c).

ALTER TABLE "technicien_calendrier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "technicien_calendrier" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_societe" ON "technicien_calendrier"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "technicien_calendrier" TO "codiplan_app";

-- ── 4. L'AUDIT (I8, D55) ────────────────────────────────────────────────────
--
-- Table métier cloisonnée : le périmètre inversé la réclame le jour où elle
-- apparaît, et le gardien de `scripts/lib/perimetre-audit.ts` le dit tout seul.
-- Elle le mérite : « depuis quand ce technicien est-il à mi-temps » est une
-- question de paie autant que de planning.

CREATE TRIGGER "journal_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "technicien_calendrier"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "technicien_calendrier" IS
  'Exception d''horaires par technicien (lot 2). Un RATTACHEMENT à un autre calendrier de la même société, jamais une copie de plages — recopier aurait fait deux lectures d''un même critère. Elle ne MAJORE rien : une exception dit quand le technicien travaille, jamais à quel prix ; la majoration relève de RG-TAR et de l''agence du technicien (I7).';
