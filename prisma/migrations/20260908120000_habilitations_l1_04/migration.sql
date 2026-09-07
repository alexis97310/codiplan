-- CODIPLAN — Techniciens et habilitations (ticket L1-04 ; invariant I1 ;
-- arbitrages D9, D55, D60 ; règle RG-PLA-04).
--
-- ── CE QUE CETTE MIGRATION ÉTABLIT ─────────────────────────────────────────
--
-- 1. `habilitation` — la qualification elle-même. Table MÉTIER cloisonnée (D60),
--    forme « société ».
-- 2. `technicien_habilitation` — l'instance DATÉE, chaînée à `utilisateur_societe`
--    et non à `utilisateur` seul. Forme « société ».
-- 3. `site_habilitation_requise` — l'exigence, avec son booléen bloquant.
--    **PREMIÈRE table fille réelle d'une table du parc**, et donc la première à
--    porter la SIXIÈME forme de politique : « FILIATION ».
-- 4. Les trois déclencheurs d'audit, réclamés par le périmètre INVERSÉ de D55.
--
-- ── POURQUOI `habilitation` N'EST PAS UN RÉFÉRENTIEL DE PLATEFORME (D60) ───
--
-- Les habilitations électriques françaises sont réglementaires et nationales, ce
-- qui plaidait pour la deuxième catégorie de I1. L'exploitation a tranché
-- l'inverse, et le troisième argument est celui qui emporte : *une nomenclature
-- nationale est un fait de la France, pas un fait de la plateforme*, et le
-- produit est destiné à être vendu ailleurs. La forme « référentiel » dit
-- « ceci vaut pour tout le monde » ; ce n'est pas vrai ici. Et une société
-- suivra des qualifications qui ne sont pas réglementaires du tout — « formé sur
-- telle presse » — que rien ne rattache à une nomenclature.
--
-- La liste réglementaire garde sa valeur comme AMORÇAGE : le seed la pose pour
-- chaque société, qui peut ensuite la compléter ou la réduire. On a le bénéfice
-- des deux, et aucune migration le jour d'un nouveau territoire.
--
-- **Une différence avec les zones géographiques, dite pour qu'elle ne se lise
-- pas comme une contradiction** : les zones ont été enregistrées avec un
-- déclencheur de bascule parce qu'elles EXISTAIENT DÉJÀ sous une autre forme.
-- `habilitation` n'existe pas encore : elle naît directement dans sa forme
-- juste. *On ne reporte que ce qui est déjà là.*
--
-- ── LA SIXIÈME FORME : « FILIATION », TRANCHÉE À L1-02, CONSTRUITE ICI ─────
--
-- Le principe était arrêté depuis le 07/09/2026 et la forme délibérément non
-- construite : **le critère qui l'appelle est la première table fille réelle
-- d'une table du parc**, une borne qui porte sa condition plutôt qu'une date.
-- `site_habilitation_requise` est cette table, et `ecartsTablesFilles` la
-- réclame dès sa création.
--
-- *Une fille est visible si son parent l'est.* La clause s'adosse à la clé
-- étrangère qui la rattache, jamais à une recopie des colonnes du parent :
--
--     EXISTS (SELECT 1 FROM "site" "s" WHERE "s"."id" = <fille>."site_id")
--
-- La sous-requête est elle-même soumise à la politique de `site` — de forme
-- « parc », société ET `app.client_id` ET `app.perimetre_sites` —, si bien que
-- les trois filtres se propagent sans qu'aucun soit réécrit. **La règle est
-- écrite UNE fois et se recompose**, plutôt que deux clauses jumelles qui
-- divergeront (§9, 01/09).
--
-- **Pourquoi PAS la clause de société en plus.** Elle serait redondante, et une
-- redondance dans une politique est une seconde source du même fait. Ce qui
-- garantit qu'une fille ne dérive pas de la société de son parent n'est pas une
-- clause : c'est la clé étrangère composite `(societe_id, site_id)` vers
-- `site (societe_id, id)`, contrôlée par la base et exempte de RLS par
-- construction.
--
-- **Pourquoi PAS « société » ni « parc ».** « Société » laisserait un compte
-- portail restreint au site S1 lire les exigences du site S2 du même client —
-- très exactement ce que RG-DRO-01 refuse. « Parc » exigerait de recopier
-- `client_id` sur la fille, c'est-à-dire de dupliquer un rattachement que la clé
-- étrangère tient déjà.
--
-- **Son coût est MESURÉ, pas annoncé** (base locale, 5 000 sites, 100 000 lignes
-- filles, index sur la clé étrangère) : *hash semi-join*, une visite du parent —
-- 7,1 → 10,5 ms sur un balayage de société, 0,04 → 0,26 ms sur l'accès pointé,
-- qui est l'accès réel. Ce n'est PAS « une sous-requête à chaque ligne lue ».
--
-- ── CE QUE LA RÈGLE RG-PLA-04 N'ÉCRIT PAS ICI ─────────────────────────────
--
-- « L'affectation est BLOQUÉE si le site exige une habilitation marquée bloquante
-- que le technicien n'a pas, ou dont la date d'expiration est antérieure à la
-- date d'intervention. » Cette décision vit dans `lib/habilitations/`, pas en
-- base : elle dépend d'une DATE D'INTERVENTION que la base ne connaît pas — il
-- n'y a pas encore d'intervention. Ce que la base tient ici est la DONNÉE ; le
-- lot 2 la consommera. Poser une contrainte qui prétendrait décider sans cette
-- date serait une garantie décorative.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. `habilitation` — la qualification
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "habilitation" (
  "id" UUID NOT NULL,
  "societe_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "libelle" TEXT NOT NULL,
  -- NULLE quand l'habilitation n'expire pas. Elle ne CALCULE rien : c'est une
  -- aide à la saisie. La date qui décide est portée par chaque instance —
  -- deux sources d'un même fait divergent en silence (§9, 01/09).
  "duree_validite_mois" INTEGER,
  "actif" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "habilitation_pkey" PRIMARY KEY ("id")
);

-- Ni code ni libellé vides. En base et pas seulement dans Zod : l'import Excel
-- (L1-08) et une correction manuelle sont deux chemins de plus.
ALTER TABLE "habilitation"
  ADD CONSTRAINT "habilitation_code_non_vide"
  CHECK (length(btrim("code")) > 0);
ALTER TABLE "habilitation"
  ADD CONSTRAINT "habilitation_libelle_non_vide"
  CHECK (length(btrim("libelle")) > 0);

-- Une durée de validité nulle ou négative n'a pas de sens. Zéro non plus : une
-- habilitation valable zéro mois est expirée le jour où on l'obtient.
ALTER TABLE "habilitation"
  ADD CONSTRAINT "habilitation_duree_positive"
  CHECK ("duree_validite_mois" IS NULL OR "duree_validite_mois" > 0);

CREATE UNIQUE INDEX "habilitation_societe_id_code_key"
  ON "habilitation" ("societe_id", "code");

-- La CIBLE des chaînages composites. Elle n'ajoute aucune unicité — `id` est
-- déjà clé primaire — : elle rend le couple référençable d'un seul geste, de
-- sorte qu'une exigence de site ou une habilitation de technicien ne puisse pas
-- désigner l'habilitation d'une AUTRE société. Les contrôles d'intégrité
-- référentielle contournent les politiques RLS par construction : sans la
-- société dans la clé, le verrou serait muet là où le cloisonnement doit mordre.
CREATE UNIQUE INDEX "habilitation_societe_id_id_key"
  ON "habilitation" ("societe_id", "id");

-- Les DEUX actions référentielles sont dites, et justifiées (D49). `RESTRICT` en
-- suppression : effacer une société dont des habilitations dépendent est refusé.
-- `RESTRICT` en mise à jour : `societe.id` est un UUID v7 technique, il ne change
-- pas — et le défaut `CASCADE` de Prisma répondrait tout seul à une question que
-- personne n'a posée.
ALTER TABLE "habilitation"
  ADD CONSTRAINT "habilitation_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "habilitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "habilitation" FORCE ROW LEVEL SECURITY;

-- Forme « SOCIÉTÉ » — la forme par défaut d'une table métier ordinaire, et elle
-- suffit ici : une habilitation n'est la donnée d'aucun client, et rien dans le
-- parc ne la sépare. La branche `OR societe_id IS NULL` de L0-04 n'est pas
-- reprise : sur une colonne `NOT NULL` elle est inerte, et une table nouvelle
-- s'écrit sans elle.
CREATE POLICY "cloisonnement_societe" ON "habilitation"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  );

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "habilitation"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "habilitation" IS
  'Qualification suivie par une société — habilitation réglementaire ou non. Table MÉTIER cloisonnée et non référentiel de plateforme (D60) : une nomenclature nationale est un fait de la France, pas un fait de la plateforme, et une société suivra aussi des qualifications non réglementaires. La liste réglementaire française est un AMORÇAGE posé par le seed, que chaque société peut compléter ou réduire.';

COMMENT ON COLUMN "habilitation"."duree_validite_mois" IS
  'Durée de validité en mois, NULLE quand l''habilitation n''expire pas. Aide à la saisie : elle ne calcule rien. La date qui décide est technicien_habilitation.date_expiration — deux sources d''un même fait divergent en silence.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. `technicien_habilitation` — l'instance datée
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "technicien_habilitation" (
  "id" UUID NOT NULL,
  "societe_id" UUID NOT NULL,
  "utilisateur_id" UUID NOT NULL,
  "habilitation_id" UUID NOT NULL,
  "date_obtention" DATE NOT NULL,
  -- NULLE quand l'habilitation n'expire pas. **`NULL` ne veut pas dire
  -- « expirée »** : RG-PLA-04 compare une date à la date d'intervention, et une
  -- habilitation sans échéance n'est jamais en retard.
  "date_expiration" DATE,

  CONSTRAINT "technicien_habilitation_pkey" PRIMARY KEY ("id")
);

-- Une expiration antérieure à l'obtention est une faute de saisie, jamais une
-- donnée. La borne est en base parce qu'elle est vraie de la donnée elle-même.
ALTER TABLE "technicien_habilitation"
  ADD CONSTRAINT "technicien_habilitation_dates_ordonnees"
  CHECK ("date_expiration" IS NULL OR "date_expiration" >= "date_obtention");

-- UNE ligne par couple, et l'historique vit au JOURNAL D'AUDIT. Un
-- renouvellement met à jour les dates ; I8 en conserve les valeurs avant/après.
-- Garder une ligne par renouvellement aurait donné deux sources au même fait —
-- « quelle est l'habilitation courante » — et obligé chaque lecture à choisir.
CREATE UNIQUE INDEX "technicien_habilitation_societe_utilisateur_habilitation_key"
  ON "technicien_habilitation" ("societe_id", "utilisateur_id", "habilitation_id");

CREATE INDEX "technicien_habilitation_societe_id_utilisateur_id_idx"
  ON "technicien_habilitation" ("societe_id", "utilisateur_id");

ALTER TABLE "technicien_habilitation"
  ADD CONSTRAINT "technicien_habilitation_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- LE CHAÎNAGE QUI COMPTE : vers `utilisateur_societe`, jamais vers `utilisateur`
-- seul. Une habilitation est tenue par une personne EN TANT QUE salarié d'une
-- société ; ce couple garantit déclarativement qu'on ne peut pas habiliter
-- quelqu'un qui n'appartient pas à la société. C'est la forme de D48 — poser la
-- contrainte sur ce qui la rend vraie, plutôt que sur une recopie.
--
-- `RESTRICT` des deux côtés, et le côté suppression est une DÉCISION : retirer
-- quelqu'un d'une société alors qu'il y porte des habilitations est refusé. Le
-- traiter d'abord est la procédure ; un `CASCADE` aurait effacé la trace de ses
-- qualifications sans que personne l'ait voulu (D49).
ALTER TABLE "technicien_habilitation"
  ADD CONSTRAINT "technicien_habilitation_technicien_fkey"
  FOREIGN KEY ("utilisateur_id", "societe_id")
  REFERENCES "utilisateur_societe"("utilisateur_id", "societe_id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "technicien_habilitation"
  ADD CONSTRAINT "technicien_habilitation_habilitation_fkey"
  FOREIGN KEY ("societe_id", "habilitation_id")
  REFERENCES "habilitation"("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "technicien_habilitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "technicien_habilitation" FORCE ROW LEVEL SECURITY;

-- Forme « SOCIÉTÉ ». Ce n'est PAS une table du parc : l'habilitation d'un
-- technicien est une donnée interne de la société, jamais une donnée de client.
CREATE POLICY "cloisonnement_societe" ON "technicien_habilitation"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  );

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "technicien_habilitation"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "technicien_habilitation" IS
  'Habilitation détenue par un technicien, datée (D9). Rattachée à utilisateur_societe et non à utilisateur seul : une habilitation est tenue par une personne EN TANT QUE salarié d''une société, et le chaînage composite l''impose. UNE ligne par couple — l''historique des renouvellements vit au journal d''audit, pas dans une seconde ligne.';

COMMENT ON COLUMN "technicien_habilitation"."date_expiration" IS
  'NULLE quand l''habilitation n''expire pas. NULL ne veut PAS dire « expirée » : RG-PLA-04 compare une date à la date d''intervention, et une habilitation sans échéance n''est jamais en retard.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. `site_habilitation_requise` — l'exigence, et la SIXIÈME FORME
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "site_habilitation_requise" (
  "id" UUID NOT NULL,
  "societe_id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "habilitation_id" UUID NOT NULL,
  -- Bloquant ou non — c'est tout RG-PLA-04. Le DÉFAUT est `true`, et c'est une
  -- décision : une exigence qu'on oublie de qualifier doit refuser, jamais
  -- avertir. Le défaut sûr est celui qui bloque.
  "bloquant" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "site_habilitation_requise_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "site_habilitation_requise_societe_site_habilitation_key"
  ON "site_habilitation_requise" ("societe_id", "site_id", "habilitation_id");

CREATE INDEX "site_habilitation_requise_societe_id_site_id_idx"
  ON "site_habilitation_requise" ("societe_id", "site_id");

ALTER TABLE "site_habilitation_requise"
  ADD CONSTRAINT "site_habilitation_requise_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Le chaînage composite vers le SITE. C'est lui — et non une clause de la
-- politique — qui garantit qu'une exigence ne dérive pas de la société de son
-- site : les contrôles d'intégrité référentielle contournent les politiques RLS
-- par construction.
ALTER TABLE "site_habilitation_requise"
  ADD CONSTRAINT "site_habilitation_requise_site_fkey"
  FOREIGN KEY ("societe_id", "site_id")
  REFERENCES "site"("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "site_habilitation_requise"
  ADD CONSTRAINT "site_habilitation_requise_habilitation_fkey"
  FOREIGN KEY ("societe_id", "habilitation_id")
  REFERENCES "habilitation"("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "site_habilitation_requise" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "site_habilitation_requise" FORCE ROW LEVEL SECURITY;

-- ── LA SIXIÈME FORME : « FILIATION » ───────────────────────────────────────
--
-- *Une fille est visible si son parent l'est.* La sous-requête est soumise à la
-- politique de `site`, de forme « parc » : les trois filtres — société, client,
-- périmètre de sites — se propagent sans qu'aucun soit réécrit ici.
--
-- `WITH CHECK` écrit, et il répète le `USING` : une politique qui n'énonce qu'un
-- `USING` légifère en silence sur les écritures (L1-02c). Ici la répétition est
-- la bonne réponse — on n'écrit une exigence que sur un site qu'on voit.
CREATE POLICY "cloisonnement_filiation" ON "site_habilitation_requise"
  USING (
    EXISTS (
      SELECT 1 FROM "site" "s"
       WHERE "s"."id" = "site_habilitation_requise"."site_id"
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "site" "s"
       WHERE "s"."id" = "site_habilitation_requise"."site_id"
    )
  );

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "site_habilitation_requise"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "site_habilitation_requise" IS
  'Habilitation exigée par un site (D9, RG-PLA-04). PREMIÈRE table fille réelle d''une table du parc, et donc la première à porter la forme « FILIATION » — tranchée à L1-02, construite à L1-04 : une fille est visible si son parent l''est. La forme « société » aurait laissé un compte portail restreint au site S1 lire les exigences du site S2 ; la forme « parc » aurait exigé de recopier client_id, un rattachement que la clé étrangère tient déjà.';

COMMENT ON COLUMN "site_habilitation_requise"."bloquant" IS
  'RG-PLA-04 tout entier : bloquant = l''affectation est REFUSÉE ; non bloquant = elle produit un avertissement et passe. Le défaut est true, et c''est une décision — une exigence qu''on oublie de qualifier doit refuser, jamais avertir.';
