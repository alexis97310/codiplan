-- CODIPLAN — Calendriers d'agence et jours fériés
-- (ticket L0-08 ; invariant I7 ; arbitrages D5, D13, D46).
--
-- Quatre tables, et trois catégories de I1 s'y appliquent sans exception :
--
--   `jour_ferie`        RÉFÉRENTIEL DE PLATEFORME (D46) — pas de `societe_id`,
--                       lisible par toutes les sociétés, modifiable par les
--                       seuls rôles éditeur, comme `devise` et `parite`.
--   `calendrier`        TABLE MÉTIER — `societe_id NOT NULL`.
--   `calendrier_plage`  TABLE MÉTIER — `societe_id NOT NULL`.
--   `calendrier_ferie`  TABLE MÉTIER — `societe_id NOT NULL`.
--
-- Pourquoi `jour_ferie` n'est pas cloisonnée, et pourquoi c'est un arbitrage.
-- Le 14 juillet est un fait du TERRITOIRE : il ne dépend d'aucune société, et
-- deux sociétés opérant en Nouvelle-Calédonie n'ont aucune raison d'en tenir
-- deux listes divergentes — c'est le raisonnement de D41 pour `parite`, mot
-- pour mot. Mais la liste close des référentiels de plateforme ne se complète
-- pas dans un ticket (§8 du CLAUDE.md, leçon de D34/D41) : la sixième entrée a
-- été SOUMISE puis tranchée par D46, et la liste recopiée dans
-- `tests/unit/db/categories-i1.test.ts` a été mise à jour du même geste.
--
-- Ce que `jour_ferie` ne dit PAS : ce qui est chômé. Un férié peut être
-- travaillé (RG-PLA-02, D13) ; ce choix appartient à l'agence et vit dans
-- `calendrier_ferie`, qui est cloisonnée. Le référentiel fournit des dates,
-- jamais une politique d'ouverture.
--
-- Aucune de ces tables ne porte d'instant. Elles portent des RÈGLES LOCALES —
-- un jour de semaine ISO, des minutes depuis minuit — et des JOURS. Le fuseau
-- leur vient de l'agence à la lecture (D5). Une plage figée en `timestamptz` se
-- décalerait d'une heure deux fois par an à Paris, jamais à Nouméa : c'est
-- exactement ce que le point 3 du ticket interdit.

-- ── 1. Référentiel territorial des jours fériés (D46) ──────────────────────

CREATE TABLE "jour_ferie" (
    "id" UUID NOT NULL,
    "territoire" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "libelle" TEXT NOT NULL,
    "mobile" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "jour_ferie_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "jour_ferie" IS
  'Référentiel de plateforme (I1, D46) : les jours fériés par territoire. Dit ce qui EST férié, jamais ce qui est chômé — la surcharge travaillée vit dans calendrier_ferie (D13, RG-PLA-02).';

-- `date` est de type DATE, pas TIMESTAMPTZ : un férié est un jour, pas un
-- instant. Le 14 juillet ne commence pas à des moments différents selon le
-- fuseau de celui qui le lit — il est le 14 juillet, partout où il s'applique.
COMMENT ON COLUMN "jour_ferie"."date" IS
  'Jour, sans heure ni fuseau : un férié n''est pas un instant.';

CREATE UNIQUE INDEX "jour_ferie_territoire_date_key" ON "jour_ferie"("territoire", "date");
CREATE INDEX "jour_ferie_territoire_idx" ON "jour_ferie"("territoire");

-- ── 2. Calendriers d'agence (D5, D13) ──────────────────────────────────────

CREATE TABLE "calendrier" (
    "id" UUID NOT NULL,
    "societe_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "territoire" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "calendrier_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "calendrier" IS
  'Calendrier d''ouverture d''une AGENCE (établissement CODIMA, D5) — jamais d''un SITE client, dont les horaires ne produisent qu''un avertissement (D13).';

CREATE UNIQUE INDEX "calendrier_societe_id_code_key" ON "calendrier"("societe_id", "code");

-- ── 3. Plages d'ouverture — la récurrence sous sa forme LOCALE ─────────────
-- Un jour sans aucune plage est un jour fermé. Il n'y a délibérément pas de
-- booléen `ouvert` : deux sources pour un même fait finissent par se
-- contredire, et c'est la plage qui fait foi puisque c'est elle qu'on lit.

CREATE TABLE "calendrier_plage" (
    "id" UUID NOT NULL,
    "societe_id" UUID NOT NULL,
    "calendrier_id" UUID NOT NULL,
    "jour_semaine" INTEGER NOT NULL,
    "debut_minutes" INTEGER NOT NULL,
    "fin_minutes" INTEGER NOT NULL,

    CONSTRAINT "calendrier_plage_pkey" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "calendrier_plage"."jour_semaine" IS
  'Jour ISO 8601 — 1 lundi, 7 dimanche. La semaine commence le lundi.';
COMMENT ON COLUMN "calendrier_plage"."debut_minutes" IS
  'Minutes locales depuis minuit. Le fuseau vient de l''agence à la lecture, jamais de la ligne.';

-- Les contrôles vivent en base et pas seulement dans Zod : une plage qui se
-- ferme avant de s'ouvrir produirait des durées négatives dans tous les calculs
-- d'heures ouvrées, et un import mal formé n'a pas à pouvoir l'écrire.
ALTER TABLE "calendrier_plage"
  ADD CONSTRAINT "calendrier_plage_jour_semaine_iso"
  CHECK ("jour_semaine" BETWEEN 1 AND 7);
ALTER TABLE "calendrier_plage"
  ADD CONSTRAINT "calendrier_plage_bornes_journee"
  CHECK ("debut_minutes" >= 0 AND "fin_minutes" <= 1440);
ALTER TABLE "calendrier_plage"
  ADD CONSTRAINT "calendrier_plage_ordre_bornes"
  CHECK ("fin_minutes" > "debut_minutes");

CREATE UNIQUE INDEX "calendrier_plage_calendrier_id_jour_semaine_debut_minutes_key"
  ON "calendrier_plage"("calendrier_id", "jour_semaine", "debut_minutes");
CREATE INDEX "calendrier_plage_calendrier_id_idx" ON "calendrier_plage"("calendrier_id");

-- ── 4. Surcharge des fériés par agence (D13, RG-PLA-02) ────────────────────
-- Absence de ligne = férié chômé. La surcharge ne s'écrit que pour dire
-- l'exception : Ducos ouvre le 24 septembre, par exemple.

CREATE TABLE "calendrier_ferie" (
    "id" UUID NOT NULL,
    "societe_id" UUID NOT NULL,
    "calendrier_id" UUID NOT NULL,
    "jour_ferie_id" UUID NOT NULL,
    "travaille" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "calendrier_ferie_pkey" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "calendrier_ferie"."travaille" IS
  'Vrai si l''agence travaille ce jour férié (D13). Un férié n''est pas systématiquement chômé (RG-PLA-02).';

CREATE UNIQUE INDEX "calendrier_ferie_calendrier_id_jour_ferie_id_key"
  ON "calendrier_ferie"("calendrier_id", "jour_ferie_id");
CREATE INDEX "calendrier_ferie_calendrier_id_idx" ON "calendrier_ferie"("calendrier_id");

-- ── 5. Clés étrangères ─────────────────────────────────────────────────────
-- `agence.calendrier_id` existe depuis L0-03 (D5) sans contrainte : la table
-- qu'elle désigne n'existait pas encore. Elle est posée ici, ON DELETE SET NULL
-- — supprimer un calendrier laisse l'agence sans calendrier, ce qui se voit,
-- plutôt que de supprimer l'agence, ce qui serait une catastrophe silencieuse.

ALTER TABLE "agence" ADD CONSTRAINT "agence_calendrier_id_fkey"
  FOREIGN KEY ("calendrier_id") REFERENCES "calendrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "calendrier" ADD CONSTRAINT "calendrier_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "calendrier_plage" ADD CONSTRAINT "calendrier_plage_calendrier_id_fkey"
  FOREIGN KEY ("calendrier_id") REFERENCES "calendrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendrier_ferie" ADD CONSTRAINT "calendrier_ferie_calendrier_id_fkey"
  FOREIGN KEY ("calendrier_id") REFERENCES "calendrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendrier_ferie" ADD CONSTRAINT "calendrier_ferie_jour_ferie_id_fkey"
  FOREIGN KEY ("jour_ferie_id") REFERENCES "jour_ferie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 6. Cloisonnement (I1) ──────────────────────────────────────────────────
-- Forme imposée par D4, à l'identique de L0-04 puis du rétablissement du
-- `::uuid` de L0-05 : contexte absent ⇒ le membre gauche vaut NULL ⇒ aucune
-- ligne visible. `FORCE` s'ajoute pour que le propriétaire y soit soumis
-- lui aussi (migration 20260820130000) — sans quoi le filet ne protégerait
-- que des rôles que personne n'utilise.

ALTER TABLE "calendrier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calendrier" FORCE ROW LEVEL SECURITY;
CREATE POLICY "cloisonnement_societe" ON "calendrier"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    OR "societe_id" IS NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    OR "societe_id" IS NULL
  );

ALTER TABLE "calendrier_plage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calendrier_plage" FORCE ROW LEVEL SECURITY;
CREATE POLICY "cloisonnement_societe" ON "calendrier_plage"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    OR "societe_id" IS NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    OR "societe_id" IS NULL
  );

ALTER TABLE "calendrier_ferie" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calendrier_ferie" FORCE ROW LEVEL SECURITY;
CREATE POLICY "cloisonnement_societe" ON "calendrier_ferie"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    OR "societe_id" IS NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    OR "societe_id" IS NULL
  );

-- ── 7. `jour_ferie` : lecture pour tous, écriture aux éditeurs (D46) ───────
-- Exactement le régime de `devise` et `parite` (L0-04 puis L0-06). `FORCE`
-- n'est PAS posé : le propriétaire doit pouvoir amorcer le référentiel sans
-- contexte, comme il amorce les devises.

ALTER TABLE "jour_ferie" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referentiel_lisible_par_tous" ON "jour_ferie"
  FOR SELECT
  USING (true);

CREATE POLICY "referentiel_ecriture_editeur" ON "jour_ferie"
  AS PERMISSIVE FOR ALL
  USING ("app_est_role_editeur"())
  WITH CHECK ("app_est_role_editeur"());

-- ── 8. Droits du rôle applicatif ───────────────────────────────────────────
-- `ALTER DEFAULT PRIVILEGES` (migration 20260820130000) les couvre déjà quand
-- c'est le même rôle qui applique les deux migrations. On les écrit néanmoins :
-- une base migrée par un autre rôle resterait sinon muette pour l'application.

GRANT SELECT, INSERT, UPDATE, DELETE ON "jour_ferie" TO "codiplan_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON "calendrier" TO "codiplan_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON "calendrier_plage" TO "codiplan_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON "calendrier_ferie" TO "codiplan_app";

-- Ajout DÉLIBÉRÉ au périmètre de consolidation (D21) : D13 range les « jours
-- ouvrés des indicateurs » sous « agence, agrégé par société », et une
-- comparaison N/N-1 « à jours ouvrés constants » (chapitre 8) exige donc de
-- lire les calendriers depuis `lib/reporting`. Aucune de ces quatre tables ne
-- porte de donnée personnelle — le garde-fou n°1 de D21 reste tenu.
-- `SELECT` seul, et rien d'autre : D38 en fait une règle, et
-- `scripts/controle-cloisonnement.mts` la vérifie par
-- `information_schema.role_table_grants` à chaque migration, jamais par
-- déclaration.
GRANT SELECT ON "jour_ferie" TO "codiplan_reporting";
GRANT SELECT ON "calendrier" TO "codiplan_reporting";
GRANT SELECT ON "calendrier_plage" TO "codiplan_reporting";
GRANT SELECT ON "calendrier_ferie" TO "codiplan_reporting";
