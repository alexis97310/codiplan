-- CODIPLAN — Le périmètre de sites devient une TABLE, et l'habilitation reçoit
-- sa forme de politique (ticket L1-02b ; invariants I1 et I8 ; arbitrages D10,
-- D22, D49, D55 ; règle RG-DRO-01 ; chapitre 11.2).
--
-- ── CE QUE CETTE MIGRATION ÉTABLIT ─────────────────────────────────────────
--
-- 1. Les cibles de chaînage : `site (societe_id, id)` et
--    `utilisateur_client (societe_id, id)`.
-- 2. `utilisateur_client_site` — le périmètre, avec une VRAIE clé étrangère.
-- 3. La reprise des données, sous levée explicite de `FORCE`.
-- 4. Le retrait de `utilisateur_client.perimetre_sites`.
-- 5. La forme « HABILITATION » sur les deux tables — la sixième forme.
-- 6. Le déclencheur d'audit sur la table nouvelle (D55, périmètre inversé).
--
-- ── POURQUOI UNE TABLE, ET PAS UN TABLEAU ──────────────────────────────────
--
-- `perimetre_sites uuid[]` ne pouvait rien garantir : **PostgreSQL 16 ne sait
-- pas contraindre les ÉLÉMENTS d'un tableau** — aucune des trois formes
-- déclaratives ne le permet, et un couple de déclencheurs serait une clé
-- étrangère écrite à la main, c'est-à-dire une clé étrangère sans le planificateur
-- ni le verrouillage qui la rendent sûre. Le tableau acceptait donc un site
-- inexistant, ou le site d'une AUTRE société — et un périmètre qui désigne un
-- site d'une autre société est un périmètre qui ne restreint rien.
--
-- ── LA FORME DE POLITIQUE : DÉDUITE, PAS RECOPIÉE ──────────────────────────
--
-- Les cinq formes en vigueur sont énumérées dans `scripts/lib/politiques-rls.ts`.
-- Aucune ne convient à une HABILITATION, et c'est mesuré plutôt que supposé :
--
--   * « société » — la clause seule que `utilisateur_client` portait — laisse un
--     compte portail du client A1 lire les lignes d'habilitation des comptes du
--     client A2 de la même société, en tirer par jointure leurs `nom` et `email`,
--     et énumérer par là les autres clients de la société. Mesuré le 07/09/2026
--     sous le rôle applicatif : les trois réponses sont oui ;
--   * « parc » — société ET `app.client_id` ET `app.perimetre_sites` — est
--     CIRCULAIRE ici : `app.perimetre_sites` est calculée EN LISANT ces deux
--     tables. Une politique qui lit la variable que la lecture alimente ne se
--     referme jamais ;
--   * « référentiel » ouvre tout en lecture, « identité » ne vise que `societe`,
--     « journal » ne vise que `journal_audit` ;
--   * « filiation », dont le critère existe déjà (`ecartsTablesFilles`), dit
--     *une donnée du parc est visible si son parent l'est*. Une habilitation
--     n'est pas une donnée du parc : c'est ce qui DONNE accès au parc. La faire
--     hériter de la visibilité de son client serait circulaire aussi.
--
-- La forme « HABILITATION » compose donc DEUX AXES, et c'est l'arbitrage du
-- 07/09/2026 qui la tranche :
--
--     société  ET  ( pas un compte portail  OU  sa propre ligne )
--
-- Le DISCRIMINANT est `app.client_id` : elle n'est posée que pour un compte
-- portail, jamais pour un utilisateur interne. C'est ce qui permet à un
-- `admin_societe` de voir les habilitations de sa société — ce qu'une clause
-- « `utilisateur_id` = le compte courant » tout court lui aurait retiré.
--
-- **Et elle est INERTE tant que personne ne pose `app.client_id`.** C'est
-- exactement pourquoi cette migration ne peut pas voyager seule : le commit qui
-- la précède fait poser la variable par `lib/db/rls.ts`, et le gardien
-- `tests/isolation/contexte-arme.test.ts` refuse désormais qu'une politique lise
-- une variable que personne ne pose.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LES CIBLES DE CHAÎNAGE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Sur le modèle de `client (societe_id, id)` posé par L1-02 et de
-- `agence (id, territoire)` posé par L0-09a. `id` étant déjà clé primaire, ces
-- index n'ajoutent aucune unicité : ils rendent le couple référençable, ce que
-- PostgreSQL exige d'une clé étrangère composite. Sans la société DANS la clé,
-- un périmètre pourrait désigner le site d'une AUTRE société — et les contrôles
-- d'intégrité référentielle contournent les politiques RLS par construction,
-- si bien que le verrou serait muet là précisément où il doit mordre.

CREATE UNIQUE INDEX "site_societe_id_id_key" ON "site" ("societe_id", "id");
CREATE UNIQUE INDEX "utilisateur_client_societe_id_id_key"
  ON "utilisateur_client" ("societe_id", "id");

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LA TABLE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Table métier de la PREMIÈRE catégorie de I1 : `societe_id NOT NULL`, RLS
-- activée ET forcée, déclencheur d'audit (D55 — le périmètre est inversé, elle
-- y entre à sa naissance sans qu'aucune liste soit à compléter).

CREATE TABLE "utilisateur_client_site" (
    "id"                    UUID NOT NULL,
    "societe_id"            UUID NOT NULL,
    "utilisateur_client_id" UUID NOT NULL,
    "site_id"               UUID NOT NULL,

    CONSTRAINT "utilisateur_client_site_pkey" PRIMARY KEY ("id")
);

-- Un site n'entre qu'une fois dans le périmètre d'une habilitation. Le tableau
-- ne l'interdisait pas : il acceptait `{S1, S1}`.
CREATE UNIQUE INDEX "utilisateur_client_site_habilitation_site_key"
  ON "utilisateur_client_site" ("utilisateur_client_id", "site_id");

-- L'index de lecture : c'est par l'habilitation que `lib/db/rls.ts` interroge
-- cette table, une fois par transaction applicative d'un compte portail.
CREATE INDEX "utilisateur_client_site_societe_id_habilitation_idx"
  ON "utilisateur_client_site" ("societe_id", "utilisateur_client_id");

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. LES CLÉS, ET LEURS DEUX ACTIONS — chacune dite et justifiée (§9, 24/08)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Une action référentielle est une règle de gestion déguisée en modalité
-- technique : `ON UPDATE CASCADE` est le défaut de Prisma, et il répondrait
-- tout seul à une question qui appartient au métier.

-- Vers la SOCIÉTÉ. Refus des deux côtés : une société ne se supprime pas sous
-- ses habilitations, et son `id` est un UUID v7 technique qui ne change jamais.
ALTER TABLE "utilisateur_client_site"
  ADD CONSTRAINT "utilisateur_client_site_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
  ON UPDATE RESTRICT ON DELETE RESTRICT;

-- Vers l'HABILITATION, société comprise.
--
-- `ON DELETE CASCADE`, et c'est la seule des quatre qui propage. Le périmètre
-- n'a aucune vie propre : il ne signifie rien sans l'habilitation qu'il
-- restreint. `RESTRICT` obligerait à vider le périmètre à la main avant de
-- retirer un compte portail — une étape que quelqu'un oubliera, et qui laisserait
-- des lignes de périmètre orphelines de sens. La cascade reste AUDITÉE : le
-- déclencheur de I8 est `FOR EACH ROW`, il se déclenche sur les lignes que la
-- cascade efface comme sur celles qu'un humain efface.
--
-- `ON UPDATE RESTRICT` : `utilisateur_client.id` ne change pas, et sa société
-- non plus — une habilitation ne déménage pas d'une société à l'autre
-- (RG-SOC-04).
ALTER TABLE "utilisateur_client_site"
  ADD CONSTRAINT "utilisateur_client_site_habilitation_fkey"
  FOREIGN KEY ("societe_id", "utilisateur_client_id")
  REFERENCES "utilisateur_client"("societe_id", "id")
  ON UPDATE RESTRICT ON DELETE CASCADE;

-- Vers le SITE, société comprise. C'est la clé que le tableau ne pouvait pas
-- porter, et elle est l'objet même de ce ticket.
--
-- `ON DELETE RESTRICT` : supprimer un site qu'un périmètre nomme est REFUSÉ.
-- `CASCADE` élargirait le périmètre en silence — retirer la ligne qui restreint
-- revient à lever la restriction —, et c'est le pire sens dans lequel une action
-- référentielle puisse se tromper. `RESTRICT` oblige à décider, comme le
-- déclencheur du temps de trajet de D56 : il n'exige pas qu'on mesure, il exige
-- qu'on décide.
--
-- `ON UPDATE RESTRICT` : même raison que ci-dessus.
ALTER TABLE "utilisateur_client_site"
  ADD CONSTRAINT "utilisateur_client_site_site_fkey"
  FOREIGN KEY ("societe_id", "site_id")
  REFERENCES "site"("societe_id", "id")
  ON UPDATE RESTRICT ON DELETE RESTRICT;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. LA REPRISE DES DONNÉES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── LE PIÈGE QUI REND CE BLOC VACUEUX, ET IL EST MESURÉ ────────────────────
--
-- `utilisateur_client` porte `FORCE ROW LEVEL SECURITY`, et `FORCE` s'applique
-- au PROPRIÉTAIRE — donc à cette migration. Sans contexte société, le
-- propriétaire ne voit RIEN : la reprise recopierait ZÉRO ligne, réussirait, et
-- le périmètre de tous les comptes portail serait silencieusement vidé. Un
-- périmètre vide signifiant « tous les sites du client », l'effet serait un
-- ÉLARGISSEMENT muet des droits.
--
-- En local, le rôle de migration est superutilisateur et contourne RLS : le bloc
-- verrait ses lignes ici et rien sur la base hébergée. **Le seul environnement
-- où le défaut existe serait le seul qui ne soit jamais exercé** (§9, 07/09).
--
-- La levée est donc explicite, bornée à cette transaction, et le bloc REFUSE de
-- recopier tant qu'il n'a pas constaté que `FORCE` est bien levé. Le témoin
-- porte sur le MÉCANISME, jamais sur un décompte : un périmètre légitimement
-- vide rendrait un décompte muet, et c'est précisément le cas qu'on veut
-- distinguer.

-- DEUX tables sont lues par le bloc, et les DEUX portent `FORCE` : l'habilitation
-- pour ses périmètres, et `site` pour vérifier que chaque site désigné existe
-- dans la bonne société. N'en lever qu'une laisserait le contrôle des orphelins
-- aveugle sur `site` — il verrait ZÉRO site, conclurait que TOUS les périmètres
-- sont orphelins, et refuserait une migration parfaitement saine. Le gardien
-- `tests/unit/db/gardes-de-migration.test.ts` l'a nommé avant que la base ne le
-- fasse.
ALTER TABLE "utilisateur_client" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "site" NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  aveugle  boolean;
  attendus bigint;
  reprises bigint;
BEGIN
  SELECT bool_or("c"."relforcerowsecurity")
    INTO aveugle
    FROM "pg_catalog"."pg_class" "c"
    JOIN "pg_catalog"."pg_namespace" "n" ON "n"."oid" = "c"."relnamespace"
   WHERE "n"."nspname" = 'public'
     AND "c"."relname" IN ('utilisateur_client', 'site');

  IF aveugle IS DISTINCT FROM false THEN
    RAISE EXCEPTION
      'Migration refusée : FORCE ROW LEVEL SECURITY est encore actif sur utilisateur_client ou site au moment de la reprise. Le propriétaire ne verrait aucune ligne, la reprise recopierait zéro périmètre sans en avoir cherché un seul, et tous les comptes portail se retrouveraient avec un périmètre VIDE — c''est-à-dire élargi à tous les sites de leur client.';
  END IF;

  -- Ce qu'il y a à reprendre, compté AVANT.
  SELECT count(*)
    INTO attendus
    FROM "utilisateur_client" "uc",
         LATERAL unnest("uc"."perimetre_sites") AS "site"("id");

  -- Un périmètre qui désigne un site inexistant ou d'une autre société n'est pas
  -- repris : la clé étrangère le refuserait, et c'est exactement ce que ce
  -- ticket vient poser. La migration REFUSE plutôt que de laisser tomber la
  -- ligne en silence — un périmètre amputé est un périmètre élargi.
  IF EXISTS (
    SELECT 1
      FROM "utilisateur_client" "uc",
           LATERAL unnest("uc"."perimetre_sites") AS "p"("site_id")
     WHERE NOT EXISTS (
       SELECT 1 FROM "site" "s"
        WHERE "s"."id" = "p"."site_id" AND "s"."societe_id" = "uc"."societe_id"
     )
  ) THEN
    RAISE EXCEPTION
      'Migration refusée : au moins un périmètre de sites désigne un site inexistant ou appartenant à une autre société. C''est très exactement ce que le tableau ne pouvait pas interdire et ce que la clé étrangère va interdire. La migration ne devine pas quel site était visé et ne laisse pas tomber la ligne : un périmètre amputé est un périmètre ÉLARGI. Corriger utilisateur_client.perimetre_sites, puis rejouer.';
  END IF;

  INSERT INTO "utilisateur_client_site" ("id", "societe_id", "utilisateur_client_id", "site_id")
  SELECT gen_random_uuid(), "uc"."societe_id", "uc"."id", "p"."site_id"
    FROM "utilisateur_client" "uc",
         LATERAL unnest("uc"."perimetre_sites") AS "p"("site_id");

  GET DIAGNOSTICS reprises = ROW_COUNT;

  IF reprises <> attendus THEN
    RAISE EXCEPTION
      'Migration refusée : % entrées de périmètre attendues, % reprises. La reprise a perdu des lignes en chemin.',
      attendus, reprises;
  END IF;

  RAISE NOTICE 'Périmètre de sites repris : % entrée(s).', reprises;
END $$;

ALTER TABLE "utilisateur_client" FORCE ROW LEVEL SECURITY;
ALTER TABLE "site" FORCE ROW LEVEL SECURITY;

-- Le témoin de la remise en place : une migration qui laisserait `NO FORCE`
-- derrière elle ouvrirait la table à toute connexion propriétaire — migrations,
-- seed, maintenance —, et la preuve par lecture ne pourrait pas le voir, `FORCE`
-- ne concernant QUE le propriétaire (§9, 31/08).
DO $$
DECLARE force_remis boolean;
BEGIN
  SELECT bool_and("c"."relforcerowsecurity")
    INTO force_remis
    FROM "pg_catalog"."pg_class" "c"
    JOIN "pg_catalog"."pg_namespace" "n" ON "n"."oid" = "c"."relnamespace"
   WHERE "n"."nspname" = 'public'
     AND "c"."relname" IN ('utilisateur_client', 'site');

  IF force_remis IS DISTINCT FROM true THEN
    RAISE EXCEPTION
      'Migration refusée : FORCE ROW LEVEL SECURITY n''a pas été remis sur utilisateur_client ou site après la reprise.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. LE TABLEAU DISPARAÎT
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Il ne reste pas « au cas où » : deux sources d'un même périmètre divergeraient
-- en silence, et c'est la maladie que ce dépôt a nommée le 01/09. La colonne
-- part dans la même transaction que la reprise.

ALTER TABLE "utilisateur_client" DROP COLUMN "perimetre_sites";

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. LA FORME « HABILITATION » — la sixième
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La branche `OR societe_id IS NULL` de L0-04 n'est pas reprise : sur une
-- colonne `NOT NULL` elle est inerte, et une table nouvelle s'écrit sans elle.

DROP POLICY "cloisonnement_societe" ON "utilisateur_client";

CREATE POLICY "cloisonnement_habilitation" ON "utilisateur_client"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
    )
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
    )
  );

ALTER TABLE "utilisateur_client_site" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "utilisateur_client_site" FORCE ROW LEVEL SECURITY;

-- La même forme, atteinte par le PARENT. La sous-requête est elle-même soumise
-- aux politiques : elle ne rend que les habilitations que l'appelant a le droit
-- de voir, et elle se recompose donc automatiquement avec la clause ci-dessus,
-- quelle qu'elle devienne. C'est une seule règle écrite une seule fois — pas
-- deux clauses jumelles qui divergeront (§9, 01/09).
CREATE POLICY "cloisonnement_habilitation" ON "utilisateur_client_site"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR EXISTS (
        SELECT 1 FROM "utilisateur_client" "uc"
         WHERE "uc"."id" = "utilisateur_client_id"
      )
    )
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR EXISTS (
        SELECT 1 FROM "utilisateur_client" "uc"
         WHERE "uc"."id" = "utilisateur_client_id"
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. L'AUDIT — réclamé par le périmètre INVERSÉ de D55
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Aucune liste n'est à compléter : la table est de la première catégorie de I1,
-- donc auditée par défaut, et `tests/unit/db/perimetre-audit.test.ts` la
-- réclamerait le jour où elle apparaît.

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "utilisateur_client_site"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "utilisateur_client_site" IS
  'Périmètre de sites d''un compte portail (RG-DRO-01, D10). Une ligne = un site que ce compte a le droit de voir. AUCUNE ligne = tous les sites de son client, jamais aucun : c''est la convention que lit app.perimetre_sites, et l''inverser retirerait tous les droits au lieu de les ouvrir. Remplace utilisateur_client.perimetre_sites, que PostgreSQL ne savait pas contraindre élément par élément.';
