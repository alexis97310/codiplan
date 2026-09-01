-- CODIPLAN — La fiche client, première table métier du lot 1
-- (ticket L1-01 ; invariant I1 ; arbitrages D10, D22, D29 ; chapitre 11.2 ;
-- règle RG-IMP-05 ; contrat des fixtures d'isolation, ticket R0-a / écart É14).
--
-- ── CE QUE CETTE MIGRATION ÉTABLIT ─────────────────────────────────────────
--
-- 1. `societe.libelle_code_externe` — le libellé d'affichage de
--    `client.code_externe`, paramétrable par société (D29).
-- 2. `client` — table métier ordinaire de la PREMIÈRE catégorie de I1 :
--    `societe_id NOT NULL`, RLS activée ET forcée.
-- 3. Sa politique, qui est de forme « PARC » et non « société ». Voir plus bas :
--    c'est le point que la revue R0 a désigné comme le plus dangereux du lot 1.
--
-- ── LA FORME DE LA POLITIQUE, ET POURQUOI CE N'EST PAS LA CLAUSE SOCIÉTÉ ───
--
-- Le ticket L0-04 écrit « **Forme imposée** » au singulier. Il y en a CINQ, et
-- recopier ici celle de L0-04 — la clause société seule — écrirait une
-- politique fausse **dans le sens permissif, en obéissant**. `client` relève de
-- la forme « parc » : filtre société, ET `app.client_id`, ET (pour les tables
-- qui portent un site) `app.perimetre_sites`.
--
-- Ce que la clause société seule laisserait passer, précisément : deux clients
-- d'une MÊME société ne sont pas séparés par elle. Un compte portail (D10) —
-- dont l'habilitation vit dans `utilisateur_client` et jamais dans
-- `utilisateur_societe` — verrait donc la fiche de tous les autres clients de sa
-- société. Le filtre société les laisse tous les deux visibles ; seul
-- `app.client_id` les sépare. C'est RG-DRO-01, et c'est D10.
--
-- `client` ne porte PAS le filtre de périmètre de sites : elle EST le client,
-- il n'y a pas de site au-dessus d'elle. `site` (L1-02) et `machine` (L2-01) le
-- porteront. La clause écrite ici est exactement celle que le harnais
-- d'isolation posait sur la table FIXTURE — `politiqueParcSql("client", "id",
-- null)` dans `tests/isolation/setup/contrat.ts` — de sorte que le contrat
-- éprouvé depuis L0-05 se reporte sur la vraie table sans rien perdre.
--
-- `app.client_id` ABSENT signifie « utilisateur interne » et ouvre tout le parc
-- de la société : c'est la branche que l'ADV et le responsable empruntent. Ce
-- n'est pas un trou, c'est le cas normal — l'habilitation interne est déjà
-- filtrée par la clause société, et le portail est le seul chemin qui pose
-- cette variable (`lib/db/rls.ts`).
--
-- ── LA BRANCHE `OR societe_id IS NULL` N'EST PAS REPRISE ───────────────────
--
-- Les six tables du lot 0 la traînent parce que L0-04 l'a écrite ; sur une
-- colonne `NOT NULL` elle est inerte, et le gardien de formes se contente d'en
-- mesurer l'inertie. Une table nouvelle s'écrit sans elle (CLAUDE.md, pied de
-- I1). Celle-ci s'en passe.
--
-- ── LES DEUX ACTIONS RÉFÉRENTIELLES, ET LEUR JUSTIFICATION ─────────────────
--
-- CLAUDE.md §9 (24/08) : « toute clé étrangère nouvelle dit ses DEUX actions,
-- et les justifie ». Une seule clé est créée ici, et elle refuse les deux fois
-- plutôt que de propager :
--
--   * `ON DELETE RESTRICT` — supprimer une société qui a des clients est
--     refusé. Le contraire (`CASCADE`) effacerait le référentiel client d'un
--     acheteur sur un geste d'administration, et `SET NULL` est impossible : la
--     colonne est `NOT NULL`, et c'est I1 qui l'exige.
--   * `ON UPDATE RESTRICT` — et NON le `CASCADE` que Prisma pose par défaut.
--     C'est la leçon de D49 : une valeur par défaut qui répond à une question
--     qu'on n'a pas posée est une décision prise par personne. `societe.id` est
--     un UUID v7 technique (I10) qui ne change jamais ; `RESTRICT` rend cette
--     impossibilité explicite, là où `CASCADE` promettrait silencieusement de
--     réécrire tout un parc client si elle survenait.
--
-- **Une clé étrangère est délibérément ABSENTE, et son absence est motivée** :
-- celle qui relierait `utilisateur_client.client_id` à `client.id`. Trois
-- raisons, et la première suffirait :
--   1. la table `utilisateur_client` porte aujourd'hui, sur toute base déjà
--      amorcée, une ligne de démonstration qui désigne un client inexistant
--      (`prisma/seed-data.ts`, COMPTES_PORTAIL). Poser la contrainte ferait
--      ÉCHOUER cette migration sur la base hébergée, et une migration ne
--      supprime pas des données pour se rendre applicable ;
--   2. le chaînage utile est COMPOSITE — `(societe_id, client_id)` vers
--      `(societe_id, id)`, sur le modèle de D48 —, faute de quoi un compte
--      portail pourrait désigner le client d'une AUTRE société : les contrôles
--      d'intégrité référentielle contournent les politiques RLS par
--      construction en PostgreSQL ;
--   3. son autre moitié, `perimetre_sites` vers `site`, appartient à L1-02.
-- Chaîner une moitié de D10 ici et l'autre au ticket suivant scinderait une
-- seule décision — que devient un compte portail quand son client disparaît ? —
-- en deux migrations. Elle est portée au registre des points ouverts du ticket.
--
-- ── CE QUI N'EST PAS ICI, ET POURQUOI ──────────────────────────────────────
--
-- **Aucun déclencheur d'audit.** `client` ne figure pas au périmètre de I8
-- (`scripts/lib/perimetre-audit.ts`), qui est une liste CLOSE DES DEUX CÔTÉS :
-- un déclencheur posé sur une table hors liste est refusé par
-- `tests/unit/db/perimetre-audit.test.ts`. L'y faire entrer est un arbitrage,
-- jamais une décision de ticket — la revue R0 l'a noté en propre (écart É-b).
--
-- **Aucune énumération de catégorie client.** Le chapitre 11 nomme la colonne
-- « catégorie client » et ne l'énumère pas ; le chapitre 10 est muet. Fermer
-- une énumération avant d'avoir tranché à qui l'on vend est exactement l'erreur
-- du 20/08 (CLAUDE.md §9). La colonne est donc du texte libre, et le jour où
-- l'on voudra une énumération, ce sera un arbitrage.

-- ── 1. Le libellé du code externe, paramétrable par société (D29) ──────────
--
-- NULLABLE, et sans valeur par défaut : « Code Winpro » est le libellé de
-- CODIMA, pas celui du produit. L'écrire en `DEFAULT` reviendrait à nommer une
-- colonne d'après l'outil d'un seul client — l'erreur même que D29 corrige.
-- Absent, l'interface affiche le libellé générique du dictionnaire.

ALTER TABLE "societe" ADD COLUMN "libelle_code_externe" TEXT;

-- ── 2. La table ────────────────────────────────────────────────────────────
--
-- Colonnes reprises du chapitre 11.2, à l'exception de `code_winpro` que D29
-- renomme `code_externe` — la source de rang 1 l'emporte sur le chapitre 11,
-- qui est de rang 3 et que la revue R0 a relevé comme non réécrit (écart É8).
--
-- `adresse_facturation` est du JSON, comme `agence.adresse` : une adresse
-- calédonienne (boîte postale, tribu, commune) n'a pas la même forme qu'une
-- adresse métropolitaine, et figer des colonnes serait décider d'un format que
-- le cahier des charges ne donne pas.

CREATE TABLE "client" (
  "id" UUID NOT NULL,
  "societe_id" UUID NOT NULL,
  "code_externe" TEXT,
  "raison_sociale" TEXT NOT NULL,
  "ridet" TEXT,
  "categorie" TEXT,
  "adresse_facturation" JSONB,
  "conditions_reglement" TEXT,
  "commercial_referent" TEXT,
  "actif" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- La raison sociale ne peut pas être vide : une fiche client sans nom n'est pas
-- une fiche. Le contrôle est en base et non seulement dans Zod, parce que
-- l'import Excel (L1-08) et une correction manuelle sont deux chemins de plus.
ALTER TABLE "client"
  ADD CONSTRAINT "client_raison_sociale_non_vide"
  CHECK (length(btrim("raison_sociale")) > 0);

-- Un code externe présent est du texte non vide : la chaîne vide se lirait
-- « code renseigné » côté rapprochement et « code absent » côté humain, et
-- RG-IMP-05 distingue précisément ces deux cas.
ALTER TABLE "client"
  ADD CONSTRAINT "client_code_externe_non_vide"
  CHECK ("code_externe" IS NULL OR length(btrim("code_externe")) > 0);

-- ── 3. Unicité du code externe DANS la société, et pas ailleurs ────────────
--
-- RG-IMP-05 (amendée par D29) fait du code externe LA clé de rapprochement à
-- l'import « s'il existe ». Deux fiches partageant un code dans une même
-- société rendraient ce rapprochement indéterminé : la règle deviendrait
-- inapplicable sans qu'aucune erreur ne se produise. L'unicité est donc la
-- condition d'existence de la règle, pas une précaution ajoutée.
--
-- Elle porte sur `(societe_id, code_externe)` et jamais sur le code seul : deux
-- sociétés vendues séparément ont chacune son ERP, et RG-SOC-04 interdit qu'un
-- référentiel client soit partagé.
--
-- Les NULL ne se heurtent pas dans un index unique PostgreSQL : autant de
-- clients sans code externe que voulu, ce que D29 exige explicitement (« son
-- absence ne suffit plus à rejeter la ligne »).
CREATE UNIQUE INDEX "client_societe_id_code_externe_key"
  ON "client" ("societe_id", "code_externe");

-- **Aucune unicité sur la raison sociale, et c'est une décision.** RG-IMP-05
-- prévoit le rapprochement « à défaut sur la raison sociale normalisée » et
-- range l'ambiguïté en « rejet pour arbitrage humain ». Une contrainte
-- d'unicité en base transformerait cet arbitrage humain en refus de la base,
-- au moment de la saisie et non au moment de l'import.

-- ── 4. La clé étrangère, avec ses deux actions ─────────────────────────────

ALTER TABLE "client" ADD CONSTRAINT "client_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ── 5. La sécurité au niveau des lignes : forme « parc » (D10, D22) ────────
--
-- Les DEUX drapeaux, jamais un seul (CLAUDE.md §9, 31/08) : `ENABLE` fait
-- s'appliquer les politiques aux rôles ordinaires, `FORCE` les applique aussi
-- au PROPRIÉTAIRE — donc aux migrations, au seed et à toute connexion de
-- maintenance. `FORCE` seul laisserait la sécurité inerte ; `ENABLE` seul
-- laisserait le propriétaire lire toutes les sociétés, et aucune lecture faite
-- sous le rôle applicatif ne pourrait s'en apercevoir.

ALTER TABLE "client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_parc" ON "client"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR "id" = NULLIF(current_setting('app.client_id', true), '')::uuid
    )
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR "id" = NULLIF(current_setting('app.client_id', true), '')::uuid
    )
  );

-- ── 6. Privilèges ──────────────────────────────────────────────────────────
--
-- `ALTER DEFAULT PRIVILEGES` (migration 20260820130000) couvre déjà toute table
-- nouvelle créée par le propriétaire ; ces GRANT sont explicites pour la même
-- raison qu'aux migrations L0-06 et L0-08 — une table dont les droits ne
-- s'écrivent nulle part est une table dont personne ne peut dire ce qu'elle
-- accorde.
GRANT SELECT, INSERT, UPDATE, DELETE ON "client" TO "codiplan_app";

-- **Le rôle de consolidation ne reçoit RIEN sur cette table, et c'est une
-- décision.** `codiplan_reporting` (D21, D38) voit TOUTES les sociétés : c'est
-- une clé passe-partout, et chaque table qu'on lui ouvre est un arbitrage, pas
-- un effet de bord — `ALTER DEFAULT PRIVILEGES` ne le vise d'ailleurs pas. La
-- migration L0-06 a posé la même règle mot pour mot : « la lecture d'une table
-- d'un lot ultérieur n'est PAS accordée d'office ».
--
-- La consolidation aura besoin de `client` — le §2.2 demande la marge par
-- client et les meilleurs comptes — mais elle en aura besoin AVEC
-- `intervention` et `contrat`, au lot 5. L'accorder aujourd'hui élargirait la
-- portée d'une clé passe-partout trois lots avant son premier usage, et
-- personne ne reviendrait se demander pourquoi. Le GRANT s'écrira dans la
-- migration du lot qui s'en sert, et
-- `tests/isolation/reporting.test.ts` — qui énumère ce périmètre en toutes
-- lettres — rendra cette addition visible en revue.

COMMENT ON TABLE "client" IS
  'Fiche client — table métier cloisonnée (I1, 1re categorie). Politique de forme « parc » : societe ET app.client_id (D10, D22), jamais la clause societe seule.';
