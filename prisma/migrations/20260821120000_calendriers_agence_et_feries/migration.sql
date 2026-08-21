-- CODIPLAN — Calendriers d'agence et jours fériés
-- (ticket L0-08 ; invariant I7 ; arbitrages D5, D13, D46, D47).
--
-- Quatre tables, et trois catégories de I1 s'y appliquent sans exception :
--
--   `jour_ferie`        RÉFÉRENTIEL DE PLATEFORME (D46) — pas de `societe_id`,
--                       lisible par toutes les sociétés, modifiable par les
--                       seuls rôles éditeur, comme `devise` et `parite`.
--   `calendrier`        TABLE MÉTIER — `societe_id NOT NULL`.
--   `calendrier_plage`  TABLE MÉTIER — `societe_id NOT NULL`.
--   `calendrier_ferie`  TABLE MÉTIER — `societe_id NOT NULL` ET `agence_id`.
--
-- Pourquoi `jour_ferie` n'est pas cloisonnée, et pourquoi c'est un arbitrage.
-- Le 14 juillet est un fait du TERRITOIRE : il ne dépend d'aucune société, et
-- deux sociétés opérant en Nouvelle-Calédonie n'ont aucune raison d'en tenir
-- deux listes divergentes — c'est le raisonnement de D41 pour `parite`, mot
-- pour mot. Mais la liste close des référentiels de plateforme ne se complète
-- pas dans un ticket (§8 du CLAUDE.md, leçon de D34/D41) : la sixième entrée a
-- été SOUMISE puis tranchée par D46.
--
-- ── L'ORDRE DE LECTURE, ET IL NE S'INVERSE JAMAIS (D46, complément 2) ───────
--   1. `jour_ferie`       le FAIT PUBLIC du territoire — ce qui EST férié ;
--   2. `calendrier_ferie` l'ÉCART LOCAL de l'agence — ce qu'elle en fait.
-- Le fait public d'abord, l'écart local ensuite. Lire dans l'autre sens
-- donnerait à une agence le pouvoir de décréter un férié pour son territoire,
-- ce qui n'appartient à aucune entreprise. `appliquerEcarts` (lib/calendar)
-- tient cet ordre, et un test le prouve.
--
-- ── LE TERRITOIRE N'EST PAS LE FUSEAU (D46, complément 1) ──────────────────
-- L'agence porte DEUX attributs distincts et indépendants : `fuseau_horaire`
-- (IANA — quelle heure il est) et `territoire` (ISO 3166-1 alpha-2 — quels
-- jours sont fériés). `Europe/Paris` couvre plusieurs territoires aux fériés
-- différents ; l'un ne se déduit jamais de l'autre, et un gardien statique le
-- refuse.
--
-- Aucune de ces tables ne porte d'instant. Elles portent des RÈGLES LOCALES —
-- un jour de semaine ISO, des minutes depuis minuit — et des JOURS. Le fuseau
-- leur vient de l'agence à la lecture (D5). Une plage figée en `timestamptz` se
-- décalerait d'une heure deux fois par an à Paris, jamais à Nouméa : c'est
-- exactement ce que le point 3 du ticket interdit.

-- ── 1. Territoire de l'agence (D46, complément 1) ──────────────────────────
-- NULLABLE, et c'est délibéré : il n'existe aucun défaut légitime. Un
-- `DEFAULT 'NC'` serait un territoire codé en dur, exactement ce que le ticket
-- interdit ; et rétablir NOT NULL casserait la migration d'une base portant
-- déjà des agences. Une agence sans territoire n'a donc pas de fériés — mais
-- cela ne passe pas inaperçu : `chargerCalendrierAgence` refuse de rendre un
-- calendrier, et `scripts/horizon-feries.mts` la nomme à chaque `verify:full`.

ALTER TABLE "agence" ADD COLUMN "territoire" TEXT;

COMMENT ON COLUMN "agence"."territoire" IS
  'Territoire au sens des jours fériés, ISO 3166-1 alpha-2 (NC, FR). Indépendant de fuseau_horaire, et jamais déduit de lui (D46) : Europe/Paris couvre plusieurs territoires aux fériés différents.';

CREATE INDEX "agence_territoire_idx" ON "agence"("territoire");

-- Contrôle de forme en base, et pas seulement dans Zod : un import mal formé
-- n'a pas à pouvoir écrire « Nouvelle-Calédonie » là où `jour_ferie` attend
-- `NC`. Deux lettres majuscules, la forme d'ISO 3166-1 alpha-2, et rien
-- d'autre. La liste des codes valides n'est PAS recopiée ici : elle
-- vieillirait, et le ticket dit expressément qu'un client sur un autre
-- territoire aura les siens.
ALTER TABLE "agence"
  ADD CONSTRAINT "agence_territoire_iso_alpha2"
  CHECK ("territoire" IS NULL OR "territoire" ~ '^[A-Z]{2}$');

-- ── 2. Référentiel territorial des jours fériés (D46) ──────────────────────

CREATE TABLE "jour_ferie" (
    "id" UUID NOT NULL,
    "territoire" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "libelle" TEXT NOT NULL,
    "mobile" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "jour_ferie_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "jour_ferie" IS
  'Référentiel de plateforme (I1, D46) : le FAIT PUBLIC — les jours fériés par territoire. Dit ce qui EST férié, jamais ce qui est chômé ; l''écart local vit dans calendrier_ferie (D13, RG-PLA-02).';

-- `date` est de type DATE, pas TIMESTAMPTZ : un férié est un jour, pas un
-- instant. Le 14 juillet ne commence pas à des moments différents selon le
-- fuseau de celui qui le lit — il est le 14 juillet, partout où il s'applique.
COMMENT ON COLUMN "jour_ferie"."date" IS
  'Jour, sans heure ni fuseau : un férié n''est pas un instant.';
COMMENT ON COLUMN "jour_ferie"."territoire" IS
  'Code ISO 3166-1 alpha-2. Jamais un fuseau, jamais la province administrative de societe.territoire.';

ALTER TABLE "jour_ferie"
  ADD CONSTRAINT "jour_ferie_territoire_iso_alpha2"
  CHECK ("territoire" ~ '^[A-Z]{2}$');

CREATE UNIQUE INDEX "jour_ferie_territoire_date_key" ON "jour_ferie"("territoire", "date");
CREATE INDEX "jour_ferie_territoire_idx" ON "jour_ferie"("territoire");

-- Clé composite technique : elle permet à `calendrier_ferie` de référencer le
-- couple (jour férié, date) d'un seul geste, si bien que sa propre colonne
-- `date` ne peut PAS diverger de celle du fait public qu'elle surcharge. Sans
-- elle, la redondance serait une divergence en attente.
CREATE UNIQUE INDEX "jour_ferie_id_date_key" ON "jour_ferie"("id", "date");

-- ── 3. Calendriers d'ouverture (D5, D13) ───────────────────────────────────
-- Le calendrier porte les HEURES, pas le territoire : le territoire est un
-- attribut de l'agence (complément 1 de D46), et deux agences de territoires
-- différents peuvent parfaitement partager les mêmes horaires.

CREATE TABLE "calendrier" (
    "id" UUID NOT NULL,
    "societe_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "calendrier_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "calendrier" IS
  'Calendrier d''ouverture d''une AGENCE (établissement CODIMA, D5) — jamais d''un SITE client, dont les horaires ne produisent qu''un avertissement (D13).';

CREATE UNIQUE INDEX "calendrier_societe_id_code_key" ON "calendrier"("societe_id", "code");

-- ── 4. Plages d'ouverture — la récurrence sous sa forme LOCALE ─────────────
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

-- ── 5. L'écart local d'une AGENCE (D46, compléments 1 et 2) ────────────────
-- Deux écarts, une seule table :
--   — `jour_ferie_id` renseigné, `travaille = true` : l'agence TRAVAILLE ce
--     férié (RG-PLA-02 — « un férié n'est pas systématiquement chômé ») ;
--   — `jour_ferie_id` nul, `travaille = false` : un PONT propre à l'entreprise,
--     un jour ordinaire que l'agence chôme.
--
-- `agence_id` et non `calendrier_id`, bien que la table porte le mot
-- « calendrier » : plusieurs agences partagent un calendrier d'ouverture (D13),
-- mais un pont est la décision d'UNE agence. Ducos et Dolbeau ouvrent aux mêmes
-- heures et peuvent diverger sur un pont.
--
-- Absence de ligne = le fait public s'applique tel quel. L'écart ne s'écrit que
-- pour dire l'exception, jamais pour répéter la règle.

CREATE TABLE "calendrier_ferie" (
    "id" UUID NOT NULL,
    "societe_id" UUID NOT NULL,
    "agence_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "jour_ferie_id" UUID,
    "travaille" BOOLEAN NOT NULL,
    "motif" TEXT,

    CONSTRAINT "calendrier_ferie_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "calendrier_ferie" IS
  'L''ÉCART LOCAL d''une agence sur le fait public de jour_ferie (D46) : un férié travaillé, ou un pont propre à l''entreprise. Le fait public d''abord, l''écart local ensuite — jamais l''inverse.';
COMMENT ON COLUMN "calendrier_ferie"."travaille" IS
  'L''agence travaille-t-elle ce jour-là ? Sans valeur par défaut : une ligne d''écart qui ne dirait pas ce qu''elle décide n''aurait aucun sens.';

CREATE UNIQUE INDEX "calendrier_ferie_agence_id_date_key"
  ON "calendrier_ferie"("agence_id", "date");
CREATE INDEX "calendrier_ferie_agence_id_idx" ON "calendrier_ferie"("agence_id");

-- ── 6. Clés étrangères ─────────────────────────────────────────────────────
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

ALTER TABLE "calendrier_ferie" ADD CONSTRAINT "calendrier_ferie_agence_id_fkey"
  FOREIGN KEY ("agence_id") REFERENCES "agence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Clé étrangère COMPOSITE, et c'est elle qui rend la colonne `date` de l'écart
-- sûre : elle ne peut désigner qu'un couple (id, date) réellement présent dans
-- `jour_ferie`. Un écart qui prétendrait surcharger le 14 juillet en portant la
-- date du 15 est refusé par la base, pas seulement par le code.
ALTER TABLE "calendrier_ferie" ADD CONSTRAINT "calendrier_ferie_jour_ferie_id_date_fkey"
  FOREIGN KEY ("jour_ferie_id", "date") REFERENCES "jour_ferie"("id", "date") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 7. Cloisonnement (I1) ──────────────────────────────────────────────────
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

-- ── 8. `jour_ferie` : lecture pour tous, écriture aux éditeurs (D46) ───────
-- Exactement le régime de `devise` et `parite` (L0-04 puis L0-06). `FORCE`
-- n'est PAS posé : le propriétaire doit pouvoir amorcer le référentiel sans
-- contexte, comme il amorce les devises.
--
-- C'est aussi ce qui donne son sens à l'ordre de lecture : le fait public est
-- écrit par l'éditeur, l'écart local par la société. Une société qui pourrait
-- écrire dans `jour_ferie` décréterait un férié pour tout son territoire.

ALTER TABLE "jour_ferie" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referentiel_lisible_par_tous" ON "jour_ferie"
  FOR SELECT
  USING (true);

CREATE POLICY "referentiel_ecriture_editeur" ON "jour_ferie"
  AS PERMISSIVE FOR ALL
  USING ("app_est_role_editeur"())
  WITH CHECK ("app_est_role_editeur"());

-- ── 9. Droits du rôle applicatif ───────────────────────────────────────────
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
