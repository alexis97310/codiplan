-- CODIPLAN — Le site d'intervention, et la clé restée en suspens depuis L1-01
-- (ticket L1-02 ; invariant I1 ; arbitrages D10, D22, D23, D48, D49, D55 ;
-- chapitre 11.2 ; règles RG-DRO-01 et RG-PLA-05 ; contrat des fixtures
-- d'isolation, ticket R0-a / écart É14).
--
-- ── CE QUE CETTE MIGRATION ÉTABLIT ─────────────────────────────────────────
--
-- 1. `client` gagne l'unicité composite `(societe_id, id)` — la CIBLE des deux
--    chaînages ci-dessous. Elle n'ajoute aucune unicité (`id` est déjà clé
--    primaire) : elle rend le couple référençable d'un seul geste.
-- 2. La RÉPARATION puis la CLÉ `utilisateur_client → client`, la décision que
--    L1-01 avait laissée ouverte.
-- 3. `site` — table métier ordinaire de la PREMIÈRE catégorie de I1 :
--    `societe_id NOT NULL`, RLS activée ET forcée.
-- 4. Sa politique, de forme « PARC », périmètre de sites COMPRIS.
-- 5. Son déclencheur d'audit, réclamé par le périmètre INVERSÉ de D55.
--
-- ── LA FORME DE LA POLITIQUE : DÉDUITE, PAS CHOISIE ────────────────────────
--
-- Les cinq formes en vigueur sont énumérées dans `scripts/lib/politiques-rls.ts`
-- et mesurées dans `pg_policies`. La déduction, pour `site` :
--
--   * « référentiel » est exclue par sa définition même — sa lecture est
--     `USING (true)`. Un site n'est pas un fait de plateforme comme la parité du
--     franc Pacifique : c'est la donnée d'un client, d'une société ;
--   * « identité » ne vise que `societe`, seule table que `societe_id` désigne
--     (D42). `site` porte un `societe_id`, elle n'en EST pas un ;
--   * « journal » ne vise que `journal_audit` (I8) ;
--   * « société » — la clause société seule — est la forme par défaut d'une
--     table métier ordinaire, et elle est INSUFFISANTE ici. Deux clients d'une
--     même société ne sont pas séparés par le filtre société : un compte portail
--     (D10) verrait les sites de tous les autres clients. Et deux sites d'un
--     MÊME client ne sont séparés par aucun des deux filtres précédents : un
--     compte portail restreint au site S1 verrait S2. C'est très exactement ce
--     que RG-DRO-01 refuse — « un client n'accède qu'aux données de son propre
--     PÉRIMÈTRE » —, et `app.perimetre_sites` n'existe que pour dire ce
--     périmètre ;
--   * « parc » — société ET `app.client_id` ET `app.perimetre_sites` — est donc
--     la seule qui couvre les trois séparations. Elle est déjà déclarée pour
--     `site` dans la liste close `TABLES_PARC`, avec `perimetre: true`.
--
-- `site` est la table où les TROIS filtres du parc mordent ensemble. Sur
-- `client` (L1-01) le troisième ne s'appliquait pas — elle EST le client, il n'y
-- a pas de site au-dessus d'elle. La colonne de périmètre est ici `id` : c'est
-- le site lui-même que `utilisateur_client.perimetre_sites` énumère.
--
-- La clause écrite ici est exactement celle que le harnais posait sur la table
-- FIXTURE — `politiqueParcSql("site", "client_id", "id")` dans
-- `tests/isolation/setup/contrat.ts` — de sorte que le contrat éprouvé depuis
-- L0-05 se reporte sur la vraie table sans rien perdre.
--
-- `app.client_id` ABSENT signifie « utilisateur interne » et ouvre tout le parc
-- de la société ; `app.perimetre_sites` ABSENT signifie « tous les sites du
-- client ». Ce sont les deux branches que l'ADV et le responsable empruntent.
--
-- La branche `OR societe_id IS NULL` de L0-04 n'est pas reprise : sur une
-- colonne `NOT NULL` elle est inerte, et une table nouvelle s'écrit sans elle.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LA CIBLE DES CHAÎNAGES — `client (societe_id, id)`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Sur le modèle de `agence (id, territoire)` posé par L0-09a (D48). `id` étant
-- déjà clé primaire, cet index n'ajoute aucune unicité : il rend le couple
-- (société, client) référençable, ce que PostgreSQL exige d'une clé étrangère
-- composite. Sans la société DANS la clé, un site ou un compte portail pourrait
-- désigner le client d'une AUTRE société : les contrôles d'intégrité
-- référentielle contournent les politiques RLS par construction, et le verrou
-- serait muet là précisément où le cloisonnement doit mordre.

CREATE UNIQUE INDEX "client_societe_id_id_key" ON "client" ("societe_id", "id");

-- Et la même chose sur `agence`, cible du chaînage de rattachement (D56). Même
-- raisonnement : sans la société DANS la clé, un site pourrait se rattacher à
-- l'agence d'une AUTRE société.
CREATE UNIQUE INDEX "agence_societe_id_id_key" ON "agence" ("societe_id", "id");

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LA RÉPARATION, PUIS LA CLÉ `utilisateur_client → client`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── Pourquoi la réparation est ICI et non dans une consigne ────────────────
--
-- L1-01 avait renoncé à cette clé pour trois raisons, dont la première était
-- qu'une ligne de démonstration de `utilisateur_client` désigne un client
-- inexistant sur toute base amorcée avant L1-01. **Cette ligne n'est pas
-- l'empêchement : elle est la démonstration.** C'est exactement ce que la
-- contrainte interdit, et l'argument « on ne peut pas la poser à cause d'elle »
-- se retourne en « elle prouve qu'il fallait la poser ». Elle se traite donc
-- comme une donnée à réparer.
--
-- Et la réparation vit dans la migration parce qu'« il faudra vérifier avant »
-- est une étape que quelqu'un oubliera. Aucune étape manuelle : la migration
-- répare ce qu'elle sait réparer, et ÉCHOUE bruyamment sur tout le reste.
--
-- ── LE PIÈGE QUI REND CE BLOC VACUEUX, ET QUI EST MESURÉ ───────────────────
--
-- `client` et `utilisateur_client` portent `FORCE ROW LEVEL SECURITY`, et
-- `FORCE` s'applique au PROPRIÉTAIRE — donc à cette migration. Sans contexte
-- société, le propriétaire ne voit RIEN. Mesuré le 06/09/2026, propriétaire non
-- superutilisateur, deux lignes en table :
--
--     FORCE actif, sans contexte  → 0 ligne vue
--     NO FORCE, sans contexte     → 2 lignes vues
--
-- Un bloc de diagnostic écrit naïvement compterait donc **zéro orphelin**,
-- passerait au vert, et poserait la clé — qui échouerait ensuite pour de vrai.
-- Pire : en local, le rôle de migration est SUPERUTILISATEUR, et un
-- superutilisateur contourne RLS. Le bloc verrait ses lignes ici et rien sur la
-- base hébergée. **Le seul environnement où le défaut existe serait le seul
-- qui ne soit jamais exercé** — la leçon du 23/08, mot pour mot.
--
-- La levée est donc explicite et bornée à cette transaction, et le bloc REFUSE
-- de compter tant qu'il n'a pas constaté que `FORCE` est bien levé : c'est son
-- témoin de non-vacuité, et il porte sur le MÉCANISME de l'aveuglement plutôt
-- que sur un décompte, qu'un zéro légitime rendrait muet.

ALTER TABLE "client" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "utilisateur_client" NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  aveugle       boolean;
  reparables    bigint;
  bloquants     bigint;
  detail        text;
  restants      bigint;
  societe_courante uuid;
BEGIN
  -- ── TÉMOIN DE NON-VACUITÉ ────────────────────────────────────────────────
  -- Un décompte nul ressemble toujours à un sans-faute (CLAUDE.md §9, 30/08).
  -- Ce témoin ne compte rien : il vérifie que le mécanisme qui rendrait le
  -- décompte creux est bien levé, ce qu'aucun décompte ne peut dire.
  SELECT bool_or("c"."relforcerowsecurity")
    INTO aveugle
    FROM "pg_catalog"."pg_class" "c"
    JOIN "pg_catalog"."pg_namespace" "n" ON "n"."oid" = "c"."relnamespace"
   WHERE "n"."nspname" = 'public'
     AND "c"."relname" IN ('client', 'utilisateur_client');

  IF aveugle IS DISTINCT FROM false THEN
    RAISE EXCEPTION
      'Migration refusée : FORCE ROW LEVEL SECURITY est encore actif sur client ou utilisateur_client au moment du diagnostic. Le propriétaire ne verrait aucune ligne et ce bloc compterait zéro orphelin sans en avoir cherché un seul — un contrôle creux, pas un contrôle vert.';
  END IF;

  -- ── Les orphelins RÉPARABLES ─────────────────────────────────────────────
  -- Une habilitation portail qui désigne un client inexistant DANS UNE SOCIÉTÉ
  -- QUI N'A AUCUN CLIENT. Le critère n'est pas un décompte magique ni une liste
  -- d'identifiants de démonstration recopiée ici : il nomme la seule situation
  -- où la ligne ne peut rien signifier — la table `client` n'a jamais été
  -- amorcée pour cette société, l'habilitation ne donne accès à rien, et le
  -- seed la recrée à l'identique au prochain passage (identifiants fixes).
  SELECT count(*)
    INTO reparables
    FROM "utilisateur_client" "uc"
   WHERE NOT EXISTS (SELECT 1 FROM "client" "c"
                      WHERE "c"."id" = "uc"."client_id"
                        AND "c"."societe_id" = "uc"."societe_id")
     AND NOT EXISTS (SELECT 1 FROM "client" "c"
                      WHERE "c"."societe_id" = "uc"."societe_id");

  -- ── Les orphelins BLOQUANTS ──────────────────────────────────────────────
  -- Une société qui a des clients et une habilitation qui n'en désigne aucun :
  -- c'est une anomalie de données réelles, et la migration s'arrête. Elle ne
  -- devine pas quel client était visé, et elle ne supprime pas une habilitation
  -- qu'un humain a peut-être créée.
  SELECT count(*), string_agg(DISTINCT "uc"."id"::text, ', ')
    INTO bloquants, detail
    FROM "utilisateur_client" "uc"
   WHERE NOT EXISTS (SELECT 1 FROM "client" "c"
                      WHERE "c"."id" = "uc"."client_id"
                        AND "c"."societe_id" = "uc"."societe_id")
     AND EXISTS (SELECT 1 FROM "client" "c"
                  WHERE "c"."societe_id" = "uc"."societe_id");

  IF bloquants > 0 THEN
    RAISE EXCEPTION
      'Migration refusée : % habilitation(s) portail désignent un client qui n''existe pas, dans une société qui a pourtant des clients — utilisateur_client.id : %. Ce n''est pas l''état de démonstration attendu : la ligne visait un client réel, effacé ou jamais créé. La migration ne devine pas lequel et ne supprime pas une habilitation créée par un humain. Corriger ou supprimer ces lignes, puis rejouer.',
      bloquants, detail;
  END IF;

  IF reparables > 0 THEN
    -- ── La suppression se fait SOCIÉTÉ PAR SOCIÉTÉ, et ce n'est pas un ────
    -- raffinement : `utilisateur_client` est AUDITÉE (D55), donc ce `DELETE`
    -- déclenche `journal_audit_tracer()`, dont l'`INSERT` est gardé par une
    -- politique ancrée sur `societe_id = app.societe_id`. Sans contexte, la
    -- ligne d'audit est REFUSÉE et toute la migration échoue :
    --
    --     ERROR: new row violates row-level security policy for table
    --            "journal_audit"
    --
    -- Mesuré le 06/09/2026 sur une base façonnée à l'identique de la base
    -- hébergée — propriétaire NON superutilisateur. En local le rôle de
    -- migration est superutilisateur et contourne RLS : le défaut n'existait
    -- QUE là où rien ne l'aurait exercé (leçon du 23/08).
    --
    -- Poser le contexte plutôt que lever `FORCE` sur le journal est le choix
    -- volontaire : la garantie du journal n'est pas desserrée d'un pouce, et
    -- la ligne d'audit part sous la BONNE société. Une réparation faite par
    -- une migration reste une suppression sur une table auditée — elle se
    -- journalise, elle ne se soustrait pas à I8.
    FOR societe_courante IN
      SELECT DISTINCT "uc"."societe_id"
        FROM "utilisateur_client" "uc"
       WHERE NOT EXISTS (SELECT 1 FROM "client" "c"
                          WHERE "c"."id" = "uc"."client_id"
                            AND "c"."societe_id" = "uc"."societe_id")
         AND NOT EXISTS (SELECT 1 FROM "client" "c"
                          WHERE "c"."societe_id" = "uc"."societe_id")
    LOOP
      PERFORM set_config('app.societe_id', societe_courante::text, true);
      DELETE FROM "utilisateur_client" "uc"
       WHERE "uc"."societe_id" = societe_courante
         AND NOT EXISTS (SELECT 1 FROM "client" "c"
                          WHERE "c"."id" = "uc"."client_id"
                            AND "c"."societe_id" = "uc"."societe_id");
    END LOOP;
    -- Le contexte est rendu : rien de ce qui suit ne doit hériter d'une société
    -- posée pour une réparation.
    PERFORM set_config('app.societe_id', '', true);

    RAISE NOTICE
      'L1-02 : % habilitation(s) portail de démonstration désignaient un client inexistant dans une société sans aucun client. Supprimées, et JOURNALISÉES — c''est ce que la clé étrangère posée ci-dessous interdit désormais. Le seed les recrée à l''identique (identifiants fixes).',
      reparables;
  END IF;

  -- ── Contrôle de sortie ───────────────────────────────────────────────────
  -- Belt and braces : après réparation, plus AUCUN orphelin ne doit subsister.
  -- Si celui-ci mord, c'est que le critère ci-dessus ne décrit pas l'état réel —
  -- et la migration s'arrête au lieu de laisser la clé échouer sur un message
  -- de PostgreSQL qui ne dirait ni quoi ni pourquoi.
  SELECT count(*)
    INTO restants
    FROM "utilisateur_client" "uc"
   WHERE NOT EXISTS (SELECT 1 FROM "client" "c"
                      WHERE "c"."id" = "uc"."client_id"
                        AND "c"."societe_id" = "uc"."societe_id");

  IF restants > 0 THEN
    RAISE EXCEPTION
      'Migration refusée : % habilitation(s) portail restent orphelines après réparation. L''état de la base n''est pas celui que cette migration décrit ; elle s''arrête plutôt que de deviner.',
      restants;
  END IF;
END
$$;

-- Le durcissement est rendu DANS LA MÊME TRANSACTION. Ce n'est pas une
-- politesse : la migration entière est transactionnelle, et un échec entre les
-- deux annule aussi la levée.
ALTER TABLE "client" FORCE ROW LEVEL SECURITY;
ALTER TABLE "utilisateur_client" FORCE ROW LEVEL SECURITY;

-- Et le rétablissement est CONSTATÉ, pas supposé — c'est le jumeau du témoin
-- ci-dessus. Un `ALTER` supprimé par mégarde laisserait deux tables cloisonnées
-- lisibles par leur propriétaire sans contexte, et aucune lecture faite sous le
-- rôle applicatif ne pourrait s'en apercevoir (CLAUDE.md §9, 31/08).
DO $$
DECLARE
  non_forcees text;
BEGIN
  SELECT string_agg("c"."relname", ', ' ORDER BY "c"."relname")
    INTO non_forcees
    FROM "pg_catalog"."pg_class" "c"
    JOIN "pg_catalog"."pg_namespace" "n" ON "n"."oid" = "c"."relnamespace"
   WHERE "n"."nspname" = 'public'
     AND "c"."relname" IN ('client', 'utilisateur_client')
     AND NOT "c"."relforcerowsecurity";

  IF non_forcees IS NOT NULL THEN
    RAISE EXCEPTION
      'Migration refusée : FORCE ROW LEVEL SECURITY n''a pas été rétabli sur %. La levée du bloc de réparation doit être rendue dans la même transaction.',
      non_forcees;
  END IF;
END
$$;

-- ── La clé, avec ses deux actions ──────────────────────────────────────────
--
-- `ON DELETE RESTRICT` — effacer un client dont des comptes portail dépendent
--   est refusé. `CASCADE` retirerait des habilitations sans que personne ne
--   l'ait demandé ; `SET NULL` est impossible, la colonne étant `NOT NULL`.
-- `ON UPDATE RESTRICT` — et NON le `CASCADE` que Prisma pose par défaut (D49).
--   `client.id` est un UUID v7 technique (I10) qui ne change jamais, et
--   `client.societe_id` ne change pas davantage : un client ne déménage pas
--   d'une société à l'autre (RG-SOC-04). `RESTRICT` rend cette impossibilité
--   explicite, là où `CASCADE` promettrait silencieusement de réécrire les
--   habilitations si elle survenait.

ALTER TABLE "utilisateur_client"
  ADD CONSTRAINT "utilisateur_client_client_fkey"
  FOREIGN KEY ("societe_id", "client_id") REFERENCES "client" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- **`perimetre_sites` NE REÇOIT PAS de clé étrangère, et ce n'est pas un
-- report.** L1-01 rangeait « `perimetre_sites` vers `site` » comme l'autre
-- moitié de la même décision, à traiter ici. Elle l'est : PostgreSQL 16 ne sait
-- pas contraindre les ÉLÉMENTS d'un tableau. Mesuré le 06/09/2026, les trois
-- voies déclaratives :
--
--   FOREIGN KEY (perimetre_sites) REFERENCES site(id)
--     → ERROR: foreign key constraint cannot be implemented
--       DETAIL: Key columns "perimetre_sites" and "id" are of incompatible
--               types: uuid[] and uuid.
--   FOREIGN KEY (EACH ELEMENT OF perimetre_sites) REFERENCES site(id)
--     → ERROR: syntax error at or near "ELEMENT"   (proposée, jamais intégrée)
--   CHECK (… SELECT … )
--     → ERROR: cannot use subquery in check constraint
--
-- Ce n'est donc pas un arbitrage qu'on repousse, c'est une impossibilité
-- déclarative. Les sorties — normaliser en table de jointure, ou doubler par un
-- couple de déclencheurs — sont des décisions de structure qui touchent le
-- cloisonnement (CLAUDE.md §8) et qui coûtent, l'une comme l'autre, bien plus
-- qu'une ligne : elles sont portées au registre des arbitrages du ticket avec
-- leurs conséquences, et non tranchées en séance. Ce que cette migration fait,
-- elle, est de rendre le trou NOMMÉ plutôt que tacite.

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. LA TABLE `site`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Colonnes du chapitre 11.2 : « societe_id, client, libellé, adresse, commune,
-- zone géographique, latitude/longitude, consignes d'accès, horaires, contact
-- principal, temps de trajet par agence ».
--
-- **`contact principal` n'est PAS ici, et c'est le ticket L1-03.** Le backlog
-- de L1-02 ne le nomme pas ; L1-03 livre les contacts avec leurs rôles et leurs
-- préférences de notification. Une colonne de texte posée aujourd'hui devrait
-- être migrée dans trois semaines, et deux représentations d'un contact
-- coexisteraient entre-temps. Un ticket à la fois (CLAUDE.md §7).
--
-- ── `temps_trajet_min` ET `agence_id` NE VOYAGENT JAMAIS SÉPARÉMENT (D56) ──
--
-- D23 (rang 1) et RG-PLA-05 (rang 2) écrivent tous deux `site.temps_trajet_min`
-- — une valeur portée par le site, non par un couple (site, agence). Le
-- chapitre 11.2 (rang 3) et le backlog (rang 4) disaient « par agence », ce qui
-- se lisait « une valeur par agence ». **L'exploitation a tranché : un site
-- dépend d'une agence et d'une seule, toujours la même.** Le scalaire est donc
-- juste, et « par agence » voulait dire « depuis l'agence dont le site dépend ».
--
-- **Mais un nombre dont la signification dépend d'une autre colonne ne doit
-- jamais voyager seul.** « 45 » ne dit pas d'où l'on part. Sans le
-- rattachement dans la donnée, la valeur n'est interprétable que par quelqu'un
-- qui connaît déjà la réponse — et le jour où une quatrième agence ouvre,
-- personne ne sait quelles valeurs revoir. D'où `agence_id`, et d'où le
-- déclencheur posé plus bas : changer l'agence sans revoir le temps de trajet
-- est REFUSÉ, pas signalé.

CREATE TABLE "site" (
  "id" UUID NOT NULL,
  "societe_id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  -- L'agence DONT CE SITE DÉPEND (D56). Obligatoire : voir le bloc « temps de
  -- trajet » plus bas — un site dont on ne sait pas de quelle agence il dépend
  -- porte un temps de trajet qui ne veut rien dire.
  "agence_id" UUID NOT NULL,
  "libelle" TEXT NOT NULL,
  "adresse" JSONB,
  "commune" TEXT,
  "zone_geo" TEXT,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "consignes_acces" TEXT,
  "horaires" JSONB,
  "temps_trajet_min" INTEGER,
  "actif" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "site_pkey" PRIMARY KEY ("id")
);

-- Un site sans nom n'est pas un site. Le contrôle est en base et non seulement
-- dans Zod, parce que l'import Excel (L1-08) et une correction manuelle sont
-- deux chemins de plus — même raisonnement qu'à L1-01 sur la raison sociale.
ALTER TABLE "site"
  ADD CONSTRAINT "site_libelle_non_vide"
  CHECK (length(btrim("libelle")) > 0);

-- Les bornes de la latitude et de la longitude ne sont pas une règle de gestion :
-- ce sont les bornes de la mesure elle-même (WGS 84). Les poser en base ne
-- décide de rien qu'un arbitrage devrait décider, et attrape l'inversion
-- latitude/longitude, qui est la faute de saisie la plus fréquente sur des
-- coordonnées.
ALTER TABLE "site"
  ADD CONSTRAINT "site_latitude_bornee"
  CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90));
ALTER TABLE "site"
  ADD CONSTRAINT "site_longitude_bornee"
  CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180));

-- Un temps de trajet négatif n'a pas de sens. Zéro en a un — un site situé à
-- l'agence même —, et la borne l'admet.
ALTER TABLE "site"
  ADD CONSTRAINT "site_temps_trajet_positif"
  CHECK ("temps_trajet_min" IS NULL OR "temps_trajet_min" >= 0);

-- **AUCUNE contrainte d'énumération sur `zone_geo`, et c'est une décision.**
-- D23 arrête bien les six zones, et `lib/sites/zones.ts` les tient closes à
-- l'entrée serveur — Zod, sur tous les chemins sans exception. Mais ces six
-- valeurs sont celles d'UN territoire : `grand_noumea` n'a aucun sens pour une
-- société vendue en métropole, et le jeu de démonstration en compte déjà une
-- (CODIMA-EU). Les figer en `CHECK` ou en type énuméré ferait de la géographie
-- de la Nouvelle-Calédonie une contrainte du produit — c'est la forme exacte de
-- l'erreur du 19/08 (`code_winpro`, une colonne nommée d'après l'outil d'un
-- seul client) et de celle du 20/08 (fermer une énumération avant d'avoir
-- tranché à qui l'on vend). Le point est porté au registre du ticket.

-- **AUCUNE unicité sur le libellé.** Rien au chapitre 10 n'en fait une clé, et
-- une contrainte transformerait en refus de saisie ce que RG-IMP-05 range en
-- rapprochement puis arbitrage humain. Deux ateliers « Zone industrielle » chez
-- le même client sont un cas réel.

-- L'index sert le chemin le plus fréquent — les sites d'un client — et il est
-- préfixé par la société parce que c'est l'ordre dans lequel la politique RLS
-- filtre.
CREATE INDEX "site_societe_id_client_id_idx" ON "site" ("societe_id", "client_id");

-- ── Les clés étrangères, avec leurs deux actions ───────────────────────────

ALTER TABLE "site" ADD CONSTRAINT "site_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Chaînage COMPOSITE, sur le modèle de D48 : sans la société dans la clé, un
-- site pourrait désigner le client d'une AUTRE société.
-- `ON DELETE RESTRICT` : un client qui a des sites ne s'efface pas — `CASCADE`
--   effacerait un parc entier sur un geste d'administration.
-- `ON UPDATE RESTRICT` : ni `client.id` ni `client.societe_id` ne changent
--   (I10, RG-SOC-04), et `CASCADE` promettrait silencieusement le contraire.
ALTER TABLE "site" ADD CONSTRAINT "site_client_fkey"
  FOREIGN KEY ("societe_id", "client_id") REFERENCES "client" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Chaînage COMPOSITE vers l'agence de rattachement (D56), même forme et même
-- raison : sans la société dans la clé, un site pourrait se rattacher à
-- l'agence d'une AUTRE société.
-- `ON DELETE RESTRICT` : une agence dont des sites dépendent ne s'efface pas —
--   `CASCADE` emporterait le parc, `SET NULL` est impossible (colonne NOT NULL).
-- `ON UPDATE RESTRICT` : `agence.id` est un UUID v7 technique (I10) qui ne
--   change jamais, et une agence ne change pas de société.
ALTER TABLE "site" ADD CONSTRAINT "site_agence_fkey"
  FOREIGN KEY ("societe_id", "agence_id") REFERENCES "agence" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "site_societe_id_agence_id_idx" ON "site" ("societe_id", "agence_id");

-- ── LE TEMPS DE TRAJET SUIT SON AGENCE, ET LA BASE LE TIENT (D56) ──────────
--
-- Écrire la dépendance dans un commentaire ne suffit pas : un commentaire ne
-- refuse rien. Ce déclencheur refuse de changer `agence_id` en laissant
-- `temps_trajet_min` inchangé — le nombre décrirait alors un trajet depuis une
-- agence dont le site ne dépend plus, et RIEN ne le signalerait ensuite.
--
-- Ce qui reste PERMIS, et c'est délibéré : fournir la nouvelle valeur dans la
-- même instruction, ou la mettre à `NULL` pour revenir à l'estimation par zone
-- (D23). Le déclencheur n'exige pas qu'on mesure ; il exige qu'on décide.
--
-- **Le message dit la marche à suivre, et rien de plus** (D50) : un refus a le
-- droit d'être lisible, jamais d'être informatif. Il ne nomme aucune agence,
-- aucun client, aucun décompte — il n'apprend rien à qui le lit sur ce qu'il
-- n'a pas le droit de lire. Même forme que le déclencheur de D49.
--
-- Aucun `SECURITY DEFINER` : la fonction s'exécute avec les droits de
-- l'appelant, elle ne lit aucune autre table, et elle n'a donc rien à voir
-- par-dessus les politiques.

CREATE FUNCTION "site_trajet_suit_agence"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."agence_id" IS DISTINCT FROM OLD."agence_id"
     AND OLD."temps_trajet_min" IS NOT NULL
     AND NEW."temps_trajet_min" IS NOT DISTINCT FROM OLD."temps_trajet_min" THEN
    -- **Le nom du verrou est DANS le message, et ce n'est pas une redondance
    -- avec `CONSTRAINT` ci-dessous.** Mesuré : Prisma n'expose pas le champ
    -- `constraint` d'une erreur levée par un déclencheur — il ne rend que le
    -- SQLSTATE et le texte. Sans le nom dans le texte, aucune assertion ne
    -- pourrait nommer la contrainte qu'elle éprouve, et « un refus venu
    -- d'ailleurs passerait pour le bon » (CLAUDE.md §9, 24/08). C'est le même
    -- obstacle qu'à L1-01 sur l'index unique ; ici il se contourne, parce que
    -- c'est nous qui écrivons le message.
    --
    -- `CONSTRAINT` reste posé pour `psql` et pour tout client qui, lui, le lit.
    RAISE EXCEPTION
      'site_trajet_suit_agence — Le temps de trajet est mesuré DEPUIS l''agence de rattachement du site : changer l''agence sans revoir temps_trajet_min laisserait un nombre qui ne veut plus rien dire. Fournir la nouvelle valeur — ou NULL pour revenir à l''estimation par zone — dans la même instruction.'
      USING ERRCODE = 'check_violation',
            CONSTRAINT = 'site_trajet_suit_agence';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "trajet_suit_agence" BEFORE UPDATE ON "site"
  FOR EACH ROW EXECUTE FUNCTION "site_trajet_suit_agence"();

-- ── La sécurité au niveau des lignes : forme « parc », périmètre COMPRIS ───
--
-- Les DEUX drapeaux, jamais un seul (CLAUDE.md §9, 31/08) : `ENABLE` fait
-- s'appliquer les politiques aux rôles ordinaires, `FORCE` les applique aussi
-- au PROPRIÉTAIRE — donc aux migrations, au seed et à toute connexion de
-- maintenance.

ALTER TABLE "site" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "site" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_parc" ON "site"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR "client_id" = NULLIF(current_setting('app.client_id', true), '')::uuid
    )
    AND (
      NULLIF(current_setting('app.perimetre_sites', true), '') IS NULL
      OR "id" = ANY(
        string_to_array(NULLIF(current_setting('app.perimetre_sites', true), ''), ',')::uuid[]
      )
    )
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR "client_id" = NULLIF(current_setting('app.client_id', true), '')::uuid
    )
    AND (
      NULLIF(current_setting('app.perimetre_sites', true), '') IS NULL
      OR "id" = ANY(
        string_to_array(NULLIF(current_setting('app.perimetre_sites', true), ''), ',')::uuid[]
      )
    )
  );

-- ── Privilèges ─────────────────────────────────────────────────────────────
--
-- `ALTER DEFAULT PRIVILEGES` (migration 20260820130000) couvre déjà toute table
-- nouvelle créée par le propriétaire ; ce GRANT est explicite pour la même
-- raison qu'aux migrations précédentes — une table dont les droits ne
-- s'écrivent nulle part est une table dont personne ne peut dire ce qu'elle
-- accorde.
GRANT SELECT, INSERT, UPDATE, DELETE ON "site" TO "codiplan_app";

-- **Le rôle de consolidation ne reçoit RIEN, et c'est une décision.**
-- `codiplan_reporting` (D21, D38) voit TOUTES les sociétés : chaque table qu'on
-- lui ouvre est un arbitrage, pas un effet de bord. La consolidation aura
-- besoin de `site` — le §2.2 demande la marge par zone —, mais avec
-- `intervention` et `contrat`, au lot 5. Le GRANT s'écrira dans la migration du
-- lot qui s'en sert, et `tests/isolation/reporting.test.ts` rendra cette
-- addition visible en revue.

-- ── Le déclencheur d'audit (I8, D55) ───────────────────────────────────────
--
-- Il est ici parce que le périmètre d'audit est INVERSÉ, pas parce que
-- quelqu'un a ajouté « site » à une liste : aucune liste n'a été touchée par ce
-- ticket, et le gardien statique de `scripts/lib/perimetre-audit.ts` réclame ce
-- déclencheur le jour où la table apparaît au schéma. Les consignes d'accès et
-- les horaires d'un site sont saisis par un humain, et « qui a changé cela,
-- quand, depuis quelle valeur » est une question qu'un auditeur pose.
--
-- Sans argument : `journal_audit_tracer()` lit alors `societe_id`, qui est la
-- colonne de cloisonnement de cette table.

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "site"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

-- La dépendance est écrite LÀ OÙ QUELQU'UN LA LIRA : dans le schéma Prisma,
-- dans ce fichier, et ici — sur la colonne elle-même, de sorte qu'un `\d+ site`
-- dans une console la donne à lire à qui n'ouvrira jamais le dépôt.
COMMENT ON COLUMN "site"."temps_trajet_min" IS
  'Temps de trajet de reference en minutes, DEPUIS site.agence_id (D23, D56, RG-PLA-05). Ce nombre ne veut rien dire sans son agence : le declencheur trajet_suit_agence refuse de changer agence_id sans revoir cette valeur. NULL = pas de mesure, estimation par zone.';

COMMENT ON COLUMN "site"."agence_id" IS
  'Agence DONT CE SITE DEPEND (D56). Un site depend d''une agence et d''une seule, toujours la meme. C''est l''origine du temps de trajet porte par temps_trajet_min.';

COMMENT ON TABLE "site" IS
  'Site d''intervention chez un client — table métier cloisonnée (I1, 1re categorie). Politique de forme « parc » avec le filtre de PERIMETRE : societe ET app.client_id ET app.perimetre_sites (D10, D22, RG-DRO-01). Un site n''est jamais une agence (D5, D47).';
