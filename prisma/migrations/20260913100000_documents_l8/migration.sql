-- ═══════════════════════════════════════════════════════════════════════════
-- LOT 8 — LA DOCUMENTATION DES MACHINES : le socle de données
-- Tickets L8-01 à L8-06 ; invariants I1, I8 ; arbitrages D10, D22, D55, D93.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## Ce que cette migration établit
--
-- 1. `ClasseDocument` — deux valeurs, et deux seulement (L8-03).
-- 2. `document` — table métier de la PREMIÈRE catégorie de I1, dont la CIBLE
--    est le modèle OU la machine, jamais les deux (L8-01).
-- 3. LA ONZIÈME FORME de politique — « héritage » — pour `document` (D93).
-- 4. LA DOUZIÈME — « ascendance » — qui REMPLACE la clause de société seule sur
--    `modele_materiel` et `famille_materiel` (D93).
-- 5. Le déclencheur d'audit réclamé par le périmètre INVERSÉ de D55.
--
-- ## LA DÉCISION D'EXPLOITATION DU 13/09/2026, ET CE QU'ELLE COÛTE
--
-- *« Un compte de portail ne voit les documents d'un MODÈLE que si une machine
-- de ce modèle se trouve DANS SON PROPRE PÉRIMÈTRE — sa société, son site, son
-- habilitation. Jamais parce que sa société en possède un ailleurs. »*
--
-- La raison est que **le cloisonnement fuirait par la LISTE DES DOCUMENTS au
-- lieu de fuir par les données, et il fuirait quand même** : la seule présence
-- d'une notice de pont élévateur apprend à un compte restreint à Ducos que la
-- société en exploite un à Koné. *Un « 0 document » affiché là où il n'y a rien
-- à afficher est déjà une fuite* — il dit que la question a un sens.
--
-- **Ce n'est donc pas la forme du document qu'il faut changer, c'est LE CHEMIN
-- D'ACCÈS AU MODÈLE.** Le chemin passe par machine → site → habilitation,
-- jamais par société → modèle. D'où la douzième forme, et d'où le fait qu'elle
-- porte sur `modele_materiel` et non sur `document`.
--
-- **LE COÛT, NOMMÉ** (il l'est toujours, D61, D67, D92) :
--
--   - *un compte portail ne voit plus les modèles dont il ne possède aucune
--     machine visible* — y compris un modèle qu'il exploite réellement mais
--     dont la fiche machine n'a pas encore été saisie, et y compris un modèle
--     commandé et non encore livré. **La documentation d'un matériel non
--     recensé est inaccessible au client tant que le recensement n'est pas
--     fait**, et c'est le prix exact de la fuite refusée.
--   - *l'utilisateur INTERNE ne perd rien* : la branche `app.client_id` absent
--     lui rend la clause de société seule. Sans elle, créer un modèle avant sa
--     première machine deviendrait impossible — la table se refuserait à
--     elle-même.
--   - *une sous-requête d'existence par ligne de modèle lue par un compte
--     portail*, et seulement par lui. Le coût réel se MESURE, il ne s'affirme
--     pas (§9, 07/09) : `tests/isolation/document.test.ts` en porte le plan
--     d'exécution.
--
-- ## POURQUOI `famille_materiel` REÇOIT LA MÊME FORME
--
-- La fuite est la même un étage plus haut, et écrire « le jour où un écran de
-- portail lira les familles, la question sera due » serait la laisser filer :
-- une famille « ponts élévateurs » visible dit qu'il y a un pont quelque part.
-- La chaîne est donc fermée sur les deux étages le même jour — famille visible
-- si un de ses modèles l'est, modèle visible si une de ses machines l'est,
-- machine visible selon la forme « parc ». **Trois maillons, un seul critère,
-- écrit une seule fois** : la politique de chaque étage lit celle du dessous.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LA CLASSE DE VISIBILITÉ — deux valeurs, et deux seulement (L8-03)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- **Liste close produite par le SCHÉMA**, comme les statuts d'intervention et à
-- l'inverse des zones géographiques (D23) : ce n'est pas la nomenclature d'un
-- territoire, c'est la question « le client a-t-il le droit de lire ce
-- document ». Elle se pose de la même façon chez toute société.
--
-- *À cinq valeurs, personne ne classe juste* : une classification qu'on hésite
-- à appliquer est appliquée au hasard, et un document mal classé est pire qu'un
-- document absent.

CREATE TYPE "ClasseDocument" AS ENUM ('client', 'interne');

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LA TABLE (L8-01, L8-05, L8-06)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "document" (
  "id"              uuid PRIMARY KEY,
  "societe_id"      uuid NOT NULL,

  -- LA CIBLE : le modèle OU la machine, jamais les deux (L8-01). Deux colonnes
  -- nullables et une contrainte NOMMÉE — la forme que L2-04 a mesurée comme
  -- fonctionnelle, contre la colonne `entite_id` à deux clés étrangères, « un
  -- piège qui a l'air d'un verrou et rend la table inutilisable ».
  "modele_id"       uuid,
  "machine_id"      uuid,

  "classe"          "ClasseDocument" NOT NULL,

  "libelle"         text NOT NULL,
  "nom_fichier"     text NOT NULL,
  "type_mime"       text NOT NULL,
  "taille_octets"   bigint NOT NULL,

  -- L'EMPREINTE SHA-256 des octets, en hexadécimal minuscule. Elle est ce qui
  -- rend la déduplication du bac de réception possible AVANT le rapprochement
  -- (L8-07) : deux fois le même PDF est un seul document, et le découvrir après
  -- le rapprochement fait deux fois le travail.
  "empreinte"       text NOT NULL,

  -- OÙ SONT LES OCTETS. Une clé d'objet, jamais les octets eux-mêmes : L8-05
  -- interdit le PDF dans PostgreSQL, et le contrôle statique
  -- `tests/unit/db/aucun-binaire-en-base.test.ts` refuse toute colonne binaire.
  --
  -- **AUCUN CODE NE LA REMPLIT AUJOURD'HUI, et c'est écrit plutôt que tu** : le
  -- module de stockage n'existe pas, parce qu'aucun écran ne l'appelle encore.
  -- Une interface sans appelant est la maladie que le portail vient de soigner.
  "objet_cle"       text NOT NULL,

  -- L8-06 — LES DEUX DATES DÈS LE PREMIER JOUR, MÊME INUTILISÉES.
  -- Un certificat porte une date d'émission et une date de fin de validité, et
  -- le lot 9 s'en servira. *Trois minutes maintenant, une migration douloureuse
  -- plus tard.* **Aucun code ne les lit aujourd'hui.**
  "date_document"   date,
  "date_expiration" date,

  "cree_le"         timestamptz NOT NULL DEFAULT now(),
  "modifie_le"      timestamptz NOT NULL
);

-- ── LA CIBLE UNIQUE, PAR LE SCHÉMA ET NON PAR UNE VALIDATION (L8-01) ────────
--
-- `num_nonnulls` compte les colonnes non nulles : exactement une, donc ni deux
-- cibles ni aucune. La contrainte est NOMMÉE — sans quoi un refus venu
-- d'ailleurs passerait pour le bon dans le jumeau (§9, 24/08).
ALTER TABLE "document"
  ADD CONSTRAINT "document_cible_unique"
  CHECK (num_nonnulls("modele_id", "machine_id") = 1);

ALTER TABLE "document"
  ADD CONSTRAINT "document_libelle_non_vide"
  CHECK (btrim("libelle") <> '');

ALTER TABLE "document"
  ADD CONSTRAINT "document_nom_fichier_non_vide"
  CHECK (btrim("nom_fichier") <> '');

ALTER TABLE "document"
  ADD CONSTRAINT "document_objet_cle_non_vide"
  CHECK (btrim("objet_cle") <> '');

-- L'empreinte a une FORME, et une seule : 64 caractères hexadécimaux
-- minuscules. Sans cette contrainte, deux écritures du même condensat — l'une
-- en majuscules, l'autre en minuscules — seraient deux documents distincts, et
-- la déduplication du bac laisserait passer le doublon qu'elle existe pour
-- attraper.
ALTER TABLE "document"
  ADD CONSTRAINT "document_empreinte_sha256"
  CHECK ("empreinte" ~ '^[0-9a-f]{64}$');

-- Un fichier vide n'est pas un document.
ALTER TABLE "document"
  ADD CONSTRAINT "document_taille_positive"
  CHECK ("taille_octets" > 0);

-- ── Chaînages, COMPOSITES et par la société ────────────────────────────────
--
-- Les DEUX actions référentielles sont écrites et justifiées (§9, 24/08).
-- `ON DELETE RESTRICT` : un modèle ou une machine qui porte des documents ne se
-- supprime pas en emportant sa documentation. `ON UPDATE RESTRICT` : `societe_id`
-- entre dans la clé, et une propagation silencieuse ferait changer de société
-- toute une documentation.

ALTER TABLE "document" ADD CONSTRAINT "document_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "document" ADD CONSTRAINT "document_modele_fkey"
  FOREIGN KEY ("societe_id", "modele_id")
  REFERENCES "modele_materiel" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "document" ADD CONSTRAINT "document_machine_fkey"
  FOREIGN KEY ("societe_id", "machine_id")
  REFERENCES "machine" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ── Index ──────────────────────────────────────────────────────────────────
--
-- L8-02 : l'écran d'une machine affiche l'UNION de ses documents et de ceux de
-- son modèle. Les deux index servent exactement ces deux lectures.
CREATE INDEX "document_societe_modele_idx" ON "document" ("societe_id", "modele_id");
CREATE INDEX "document_societe_machine_idx" ON "document" ("societe_id", "machine_id");

-- L'empreinte est INDEXÉE et NON UNIQUE, et c'est une décision. La
-- déduplication de L8-07 est celle du BAC : deux fichiers identiques n'y
-- produisent qu'une fiche. Sur `document`, une unicité par société INTERDIRAIT
-- d'accrocher la même notice à deux modèles distincts — ce qui arrive quand un
-- constructeur publie un manuel commun à une gamme —, et transformerait en
-- refus de saisie ce que le bac règle par une proposition.
CREATE INDEX "document_societe_empreinte_idx" ON "document" ("societe_id", "empreinte");

-- Cible des chaînages composites que d'autres tables poseront vers `document` —
-- `document_recu` le fait au ticket suivant. Elle rend le couple (société,
-- document) référençable d'un seul geste, de sorte qu'un chaînage ne puisse pas
-- traverser une frontière de société.
CREATE UNIQUE INDEX "document_societe_id_id_key" ON "document" ("societe_id", "id");

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. LE CLOISONNEMENT DE `document` — forme « HÉRITAGE » (D93, L8-04)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- *Un document est visible si sa CIBLE l'est, et la classe ne fait que
-- RÉTRÉCIR.* C'est la filiation de L1-04, avec deux différences que L8-04
-- annonçait et qui font l'arbitrage :
--
--   1. **La cible est POLYMORPHE** — un parent parmi deux, exactement un des
--      deux étant renseigné. La forme « filiation » n'en connaît qu'un.
--   2. **La classe RÉTRÉCIT** — `interne` disparaît pour un compte portail.
--      C'est un axe de RESTRICTION, pas un axe d'accès : il n'ouvre rien à
--      personne, il ferme au portail. L8-04 l'exigeait : « la classe ne fait
--      que rétrécir », « elle n'ajoute aucun axe ».
--
-- **AUCUNE clause de société n'est écrite ici**, et c'est la doctrine de la
-- filiation : elle serait une seconde source du même fait (§9, 01/09). Ce qui
-- empêche un document de dériver de la société de sa cible n'est pas une clause
-- mais la clé étrangère COMPOSITE, contrôlée par la base et exempte de RLS par
-- construction.
--
-- **Et c'est la sous-requête qui porte tout le cloisonnement de D10 et D22** :
-- `machine` est de forme « parc », donc société, client et périmètre de sites y
-- mordent déjà ; `modele_materiel` reçoit ci-dessous la forme « ascendance ».
-- Recopier ces filtres ici en ferait deux lectures d'un même critère.

ALTER TABLE "document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_heritage" ON "document"
  USING (
    (
      EXISTS (SELECT 1 FROM "machine" WHERE "machine"."id" = "document"."machine_id")
      OR EXISTS (SELECT 1 FROM "modele_materiel" WHERE "modele_materiel"."id" = "document"."modele_id")
    )
    AND (
      "classe" = 'client'::"ClasseDocument"
      OR NULLIF(current_setting('app.client_id', true), '') IS NULL
    )
  )
  WITH CHECK (
    (
      EXISTS (SELECT 1 FROM "machine" WHERE "machine"."id" = "document"."machine_id")
      OR EXISTS (SELECT 1 FROM "modele_materiel" WHERE "modele_materiel"."id" = "document"."modele_id")
    )
    AND (
      "classe" = 'client'::"ClasseDocument"
      OR NULLIF(current_setting('app.client_id', true), '') IS NULL
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "document" TO "codiplan_app";

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. LE CHEMIN D'ACCÈS AU MODÈLE — forme « ASCENDANCE » (D93)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- *Un parent est visible si l'un de ses enfants l'est* — l'INVERSE exact de la
-- filiation, et c'est pour cela que ce n'est pas la même forme. La filiation
-- propage vers le bas une visibilité déjà acquise ; l'ascendance REFUSE vers le
-- haut une visibilité que la clause de société donnait.
--
-- **Le discriminant est `app.client_id`**, comme dans la forme « habilitation »
-- et pour la même raison : la restriction ne vise que le compte portail. Un
-- utilisateur interne garde la clause de société seule, sans quoi créer un
-- modèle avant sa première machine serait impossible.
--
-- Les anciennes politiques de forme « société » sont RETIRÉES, jamais doublées :
-- une politique permissive s'ajoute aux autres par OU, si bien qu'en laisser une
-- en place annulerait entièrement celle-ci.

DROP POLICY "cloisonnement_societe" ON "modele_materiel";

CREATE POLICY "cloisonnement_ascendance" ON "modele_materiel"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR EXISTS (
        SELECT 1 FROM "machine" WHERE "machine"."modele_id" = "modele_materiel"."id"
      )
    )
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR EXISTS (
        SELECT 1 FROM "machine" WHERE "machine"."modele_id" = "modele_materiel"."id"
      )
    )
  );

DROP POLICY "cloisonnement_societe" ON "famille_materiel";

CREATE POLICY "cloisonnement_ascendance" ON "famille_materiel"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR EXISTS (
        SELECT 1 FROM "modele_materiel"
         WHERE "modele_materiel"."famille_id" = "famille_materiel"."id"
      )
    )
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR EXISTS (
        SELECT 1 FROM "modele_materiel"
         WHERE "modele_materiel"."famille_id" = "famille_materiel"."id"
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. L'AUDIT (I8, D55)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Il est ici parce que le périmètre est INVERSÉ : `document` est une table
-- métier cloisonnée, donc auditée à sa naissance, et le gardien de
-- `scripts/lib/perimetre-audit.ts` la réclame le jour où elle apparaît au
-- schéma. La classe d'un document décide de ce qu'un client voit : « qui l'a
-- fait passer de interne à client, et quand » est exactement la question qu'un
-- litige pose.

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "document"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "document" IS
  'Documentation d''une machine ou d''un modèle (lot 8, L8-01 à L8-06). Table métier de la première catégorie de I1, forme « héritage » (D93) : un document est visible si sa CIBLE l''est, et la classe ne fait que rétrécir. La cible est le modèle OU la machine, jamais les deux — num_nonnulls(modele_id, machine_id) = 1, par le schéma et non par une validation applicative. Les octets vivent dans un stockage d''objets, jamais ici (L8-05).';

COMMENT ON COLUMN "document"."objet_cle" IS
  'Clé de l''objet dans le stockage S3-compatible de l''hébergeur, MÊME RÉGION que la base (L8-05) : la latence vers Sydney se paye à chaque aller-retour. AUCUN CODE NE LA REMPLIT AUJOURD''HUI — le module de stockage n''existe pas, parce qu''aucun écran ne l''appelle encore, et une interface sans appelant est une maladie que ce dépôt vient de soigner sur le portail.';

COMMENT ON COLUMN "document"."date_expiration" IS
  'Fin de validité, pour un certificat qui en porte une (L8-06). Nullable, et AUCUN CODE NE LA LIT AUJOURD''HUI : elle existe dès le premier jour parce que trois minutes maintenant valent mieux qu''une migration douloureuse plus tard, et le lot 9 s''en servira.';

COMMENT ON COLUMN "modele_materiel"."id" IS
  'LE CHEMIN D''ACCÈS AU MODÈLE PASSE PAR LA MACHINE (D93, 13/09/2026). Pour un compte portail — app.client_id posée —, un modèle n''est visible que s''il existe une machine visible de ce modèle, c''est-à-dire dans son propre périmètre de sites. Sans cela, la présence d''une notice révélerait la composition du parc des autres sites : un compte restreint à Ducos déduirait ce que Koné possède, et le cloisonnement fuirait par la liste des documents au lieu de fuir par les données.';
