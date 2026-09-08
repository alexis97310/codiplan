-- ═══════════════════════════════════════════════════════════════════════════
-- L2-01 — LA FICHE MACHINE
-- Invariant I1, I10 ; arbitrages D6, D7, D10, D22, D55 ; chapitre 11.2 ;
-- contrat des fixtures d'isolation (ticket R0-a, écart É14).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## Ce que cette migration établit
--
-- 1. Trois énumérations : statut, criticité, source de création.
-- 2. `machine` — table métier ordinaire de la PREMIÈRE catégorie de I1 :
--    `societe_id NOT NULL`, RLS activée ET forcée.
-- 3. Ses TROIS chaînages composites — client, site, modèle —, tous par la
--    société. La cible du troisième, `modele_materiel (societe_id, id)`,
--    existait DÉJÀ : L1-05 l'avait posée pour chaîner le modèle à sa famille,
--    et la reposer ici a fait échouer la migration sur la base jetable
--    (`42P07`). Corrigée sur place — elle n'avait touché aucune base réelle
--    (CLAUDE.md §7).
-- 4. Sa politique, de forme « PARC », périmètre de sites COMPRIS.
-- 5. Son déclencheur d'audit, réclamé par le périmètre INVERSÉ de D55.
--
-- ## LE CONTRAT DES FIXTURES, HONORÉ ICI (R0-a)
--
-- `machine` existait comme table FIXTURE du harnais d'isolation depuis L0-05,
-- et c'est elle qui portait la résolution QR inter-société de D22. **La
-- réparation la plus naturelle — supprimer la fixture et donner à la vraie table
-- la clause société seule — réduirait la couverture sans qu'aucun gardien ne
-- s'en aperçoive.** La clause écrite ici est donc EXACTEMENT celle que le
-- harnais posait — `politiqueParcSql("machine", "client_id", "site_id")` —, de
-- sorte que ce qui était éprouvé depuis L0-05 se reporte sans rien perdre.
--
-- Trois gardiens l'exigent, et ils ne se recouvrent pas : la FORME mesurée dans
-- `pg_policies` (fixture ou table réelle, sans faire la différence), la liste
-- close `TABLES_PARC` dont le RETRAIT est refusé, et le PLANCHER de scénarios
-- de `EXIGENCES_L0_05`, qui ne se baisse jamais.
--
-- ## LES QUATRE CHAMPS OBLIGATOIRES, ET LE TROU QU'ILS FERMENT (D6)
--
-- `modele_id`, `client_id`, `site_id`, `numero_serie` — quatre, et non trois.
-- **Le numéro de série est obligatoire**, ce qui rend l'unicité définissable et
-- supprime le risque de doublons silencieux au recensement.
--
-- Le cas du numéro illisible existe, et il est traité SANS `NULL` : le
-- technicien saisit `SN-INCONNU-<référence interne>`, unique par construction,
-- et la fiche est marquée `complet = false` — ce qui la fait remonter dans la
-- file de complétion. *Un contrôle d'unicité classique suffit alors, sans NULL
-- et donc sans trou* : sous `UNIQUE`, PostgreSQL considère deux `NULL` comme
-- distincts, et une colonne nullable aurait laissé passer autant de doublons
-- qu'on veut.
--
-- ## LA CLÉ TECHNIQUE ET LE NUMÉRO AFFICHÉ SONT DEUX CHOSES (D7, I10)
--
-- `id` est un UUID v7 **généré sur l'appareil**, y compris hors ligne : il porte
-- toutes les relations et le `qr_token`. `numero` est attribué par le SERVEUR,
-- séquentiellement par société, à la première synchronisation — il est donc
-- `NULL` tant qu'elle n'a pas eu lieu, et l'interface affiche
-- `Local-<6 caractères>` en attendant.
--
-- **LE QR ENCODE LE JETON, JAMAIS LE NUMÉRO.** L'étiquette posée hors ligne
-- reste donc valide quel que soit le numéro attribué ensuite.
--
-- **CE QUE CETTE MIGRATION NE CONSTRUIT PAS, ET QUI EST ÉCRIT PLUTÔT QUE TU :**
-- l'ATTRIBUTION du numéro. La colonne existe, son unicité par société est
-- posée, et **aucun code ne l'attribue** — le compteur par société appartient à
-- la synchronisation (lot 3), et l'inventer ici poserait une règle que personne
-- n'a décidée. `numero` reste donc NUL sur toute fiche créée aujourd'hui, ce qui
-- est exactement l'état que D7 décrit pour une machine non synchronisée.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LES TROIS ÉNUMÉRATIONS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- **En base et non dans le code**, à l'inverse des zones géographiques (D23) et
-- des rôles de contact : ce sont des états du CYCLE DE VIE d'un actif, pas une
-- nomenclature d'un territoire. Une société tierce aura les mêmes — une machine
-- est en service, en panne, arrêtée, remplacée ou ferraillée — et une valeur de
-- plus est une migration qu'on veut voir passer en revue.

CREATE TYPE "StatutMachine" AS ENUM (
  'en_service', 'en_panne', 'arretee', 'remplacee', 'ferraillee'
);

CREATE TYPE "CriticiteMachine" AS ENUM (
  'bloquante', 'importante', 'normale'
);

CREATE TYPE "SourceCreationMachine" AS ENUM (
  'terrain', 'recensement', 'import', 'back_office'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LA TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "machine" (
  "id"                   uuid PRIMARY KEY,
  "societe_id"           uuid NOT NULL,

  -- Les QUATRE obligatoires (D6).
  "modele_id"            uuid NOT NULL,
  "client_id"            uuid NOT NULL,
  "site_id"              uuid NOT NULL,
  "numero_serie"         text NOT NULL,

  -- Le jeton du QR, dérivé de l'`id` et jamais du numéro (D7, I10).
  "qr_token"             text NOT NULL,

  -- Attribué par le SERVEUR à la première synchronisation ; NUL en attendant.
  "numero"               integer,

  -- La référence interne que le technicien compose quand la plaque est
  -- illisible — `SN-INCONNU-<reference_interne>` (D6). Nullable, et elle le
  -- reste : la plupart des machines ont une plaque lisible.
  "reference_interne"    text,

  "localisation"         text,
  "date_mise_en_service" date,
  "date_vente"           date,
  "facture_origine"      text,
  "garantie_fin"         date,

  "statut"               "StatutMachine" NOT NULL DEFAULT 'en_service',
  "criticite"            "CriticiteMachine" NOT NULL DEFAULT 'normale',
  "machine_remplacee_id" uuid,
  "source_creation"      "SourceCreationMachine" NOT NULL DEFAULT 'back_office',

  -- Fiche minimale ou complète : c'est elle qui pilote la file de complétion.
  "complet"              boolean NOT NULL DEFAULT true,

  "cree_le"              timestamptz NOT NULL DEFAULT now(),
  "modifie_le"           timestamptz NOT NULL
);

-- ── Unicités ───────────────────────────────────────────────────────────────
--
-- `(societe_id, modele_id, numero_serie)` — RG-PAR-01, rendue définissable par
-- D6. AUCUNE colonne nullable n'y entre, et c'est le point : deux `NULL` sont
-- distincts pour un index unique, si bien qu'une seule colonne nullable aurait
-- laissé passer autant de doublons qu'on veut.
CREATE UNIQUE INDEX "machine_societe_modele_serie_key"
  ON "machine" ("societe_id", "modele_id", "numero_serie");

-- Le jeton est GLOBALEMENT unique, et pas « unique par société ». Il est
-- présenté SEUL par le lecteur de QR, avant qu'aucune société ne soit connue :
-- une collision entre deux sociétés rendrait la résolution ambiguë au moment
-- exact où l'on ne peut pas la lever. Le contrôle de société, lui, reste fait
-- APRÈS (D22) — c'est la politique qui le tient, jamais l'unicité.
CREATE UNIQUE INDEX "machine_qr_token_key" ON "machine" ("qr_token");

-- Le numéro affiché est unique PAR SOCIÉTÉ (D7) — deux sociétés numérotent
-- chacune à partir de 1. `NULL` reste permis, et autant de fois qu'il le faut :
-- toute machine non encore synchronisée en porte un.
CREATE UNIQUE INDEX "machine_societe_numero_key"
  ON "machine" ("societe_id", "numero");

CREATE INDEX "machine_societe_client_idx" ON "machine" ("societe_id", "client_id");
CREATE INDEX "machine_societe_site_idx" ON "machine" ("societe_id", "site_id");

-- ── Le numéro de série n'est jamais vide ───────────────────────────────────
--
-- `NOT NULL` n'interdit pas la chaîne vide, et une chaîne vide serait le NULL
-- que D6 refuse, déguisé : elle ferait de l'unicité une passoire par le bas.
ALTER TABLE "machine"
  ADD CONSTRAINT "machine_numero_serie_non_vide"
  CHECK (btrim("numero_serie") <> '');

ALTER TABLE "machine"
  ADD CONSTRAINT "machine_qr_token_non_vide"
  CHECK (btrim("qr_token") <> '');

-- Le numéro affiché part de 1 : un zéro ou un négatif ne serait pas un numéro.
ALTER TABLE "machine"
  ADD CONSTRAINT "machine_numero_positif"
  CHECK ("numero" IS NULL OR "numero" > 0);

-- ── Chaînages, tous COMPOSITES et tous par la société ──────────────────────
--
-- Les DEUX actions référentielles sont écrites et justifiées (§9, 24/08) — une
-- action par défaut est une décision prise par personne.
--
-- `ON DELETE RESTRICT` : on ne supprime pas un client, un site ou un modèle qui
-- porte des machines. Le §22 parle de conservation, jamais d'effacement en
-- cascade, et une machine orpheline de son site est une machine qu'on ne
-- retrouve plus.
--
-- `ON UPDATE RESTRICT` : ces colonnes sont des identifiants techniques, qui ne
-- changent pas — mais `societe_id` entre dans la clé, et une propagation
-- silencieuse ferait changer de société tout un parc. Le refus est le seul
-- comportement lisible.

ALTER TABLE "machine" ADD CONSTRAINT "machine_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "machine" ADD CONSTRAINT "machine_client_fkey"
  FOREIGN KEY ("societe_id", "client_id") REFERENCES "client" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "machine" ADD CONSTRAINT "machine_site_fkey"
  FOREIGN KEY ("societe_id", "site_id") REFERENCES "site" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "machine" ADD CONSTRAINT "machine_modele_fkey"
  FOREIGN KEY ("societe_id", "modele_id")
  REFERENCES "modele_materiel" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- La machine REMPLACÉE, s'il y en a une. Composite elle aussi : une machine ne
-- remplace pas celle d'une autre société. `ON DELETE RESTRICT` — perdre le
-- chaînage d'un remplacement, c'est perdre l'historique que D7 veut garder.
CREATE UNIQUE INDEX "machine_societe_id_id_key" ON "machine" ("societe_id", "id");

ALTER TABLE "machine" ADD CONSTRAINT "machine_remplacee_fkey"
  FOREIGN KEY ("societe_id", "machine_remplacee_id")
  REFERENCES "machine" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Une machine ne se remplace pas elle-même.
ALTER TABLE "machine"
  ADD CONSTRAINT "machine_remplacee_distincte"
  CHECK ("machine_remplacee_id" IS NULL OR "machine_remplacee_id" <> "id");

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. LE CLOISONNEMENT — forme « PARC », périmètre COMPRIS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Les deux drapeaux : `ENABLE` ne concerne pas le propriétaire, et les
-- migrations comme le seed passent par lui.
--
-- `app.client_id` ABSENT signifie « utilisateur interne » et ouvre tout le parc
-- de la société ; `app.perimetre_sites` ABSENT signifie « tous les sites du
-- client ». La colonne de périmètre est `site_id` : une machine appartient au
-- site où elle est installée.
--
-- La branche `OR societe_id IS NULL` de L0-04 n'est pas reprise : sur une
-- colonne `NOT NULL` elle est inerte, et une table nouvelle s'écrit sans elle.

ALTER TABLE "machine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "machine" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_parc" ON "machine"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR "client_id" = NULLIF(current_setting('app.client_id', true), '')::uuid
    )
    AND (
      NULLIF(current_setting('app.perimetre_sites', true), '') IS NULL
      OR "site_id" = ANY(
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
      OR "site_id" = ANY(
        string_to_array(NULLIF(current_setting('app.perimetre_sites', true), ''), ',')::uuid[]
      )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "machine" TO "codiplan_app";

-- Le rôle de consolidation ne reçoit RIEN : `codiplan_reporting` voit TOUTES les
-- sociétés, et chaque table qu'on lui ouvre est un arbitrage. Il aura besoin du
-- parc au lot 5, avec `intervention` et `contrat`.

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. L'AUDIT (I8, D55)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Il est ici parce que le périmètre est INVERSÉ, pas parce que quelqu'un a
-- ajouté « machine » à une liste : le gardien de `scripts/lib/perimetre-audit.ts`
-- réclame ce déclencheur le jour où la table apparaît au schéma. Une fiche
-- machine est saisie par un humain, souvent sur le terrain et hors ligne :
-- « qui a changé cela, quand, depuis quelle valeur » est exactement la question
-- qu'un litige pose.

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "machine"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "machine" IS
  'Fiche machine du parc installé (L2-01, D6, D7). Table métier de la première catégorie de I1, forme « parc » — société ET app.client_id ET app.perimetre_sites (D10, D22) —, la clause exacte que le harnais d''isolation posait sur la table FIXTURE, de sorte que la couverture éprouvée depuis L0-05 se reporte sans rien perdre. QUATRE champs obligatoires (D6) : modele_id, client_id, site_id, numero_serie ; le numéro illisible se saisit SN-INCONNU-<référence> avec complet = false, jamais NULL — deux NULL sont distincts pour un index unique, et une colonne nullable ferait de l''unicité une passoire.';

COMMENT ON COLUMN "machine"."numero" IS
  'Numéro AFFICHÉ, attribué par le SERVEUR séquentiellement par société à la première synchronisation (D7, I10) — distinct de la clé technique id, qui est un UUID v7 généré sur l''appareil. NUL tant que la synchronisation n''a pas eu lieu : l''interface affiche alors Local-<6 caractères>. AUCUN CODE NE L''ATTRIBUE AUJOURD''HUI — le compteur par société appartient à la synchronisation (lot 3), et l''inventer ici poserait une règle que personne n''a décidée.';

COMMENT ON COLUMN "machine"."qr_token" IS
  'Jeton du QR, dérivé de l''id et JAMAIS du numéro (D7, I10) : l''étiquette posée hors ligne reste valide quel que soit le numéro attribué ensuite. Unique GLOBALEMENT et non par société — il est présenté seul par le lecteur, avant qu''aucune société ne soit connue, et une collision rendrait la résolution ambiguë au moment exact où l''on ne peut pas la lever. Le contrôle de société se fait APRÈS, par la politique (D22).';
