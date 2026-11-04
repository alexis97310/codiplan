-- ═══════════════════════════════════════════════════════════════════════════
-- 9J09-NOTIFICATIONS-SCHEMA — LA NOTIFICATION, ET LE JOURNAL DE SON ENVOI
-- Invariants I1, I8, I10 ; arbitrages D94, D100, D229.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## Ce que cette migration établit
--
-- 1. L'énumération des événements — une seule valeur aujourd'hui.
-- 2. `notification` : la cible disjointe, l'habilitation requise, la lecture
--    et le journal de l'envoi.
-- 3. LA FORME « INTERNE » (D229), le même régime que `document_recu` (D94) et
--    `import_lot`/`import_lot_ligne` (D100).
-- 4. Son déclencheur d'audit (I8, D55).
--
-- ## POURQUOI CETTE TABLE
--
-- Alexis a demandé, le 29/10/2026, que « chaque intéressé soit prévenu (en
-- interne ça peut être une page selon le niveau d'autorisation de son
-- compte) ». Rien n'existait : ni table, ni page, ni canal interne.
--
-- ## POURQUOI LA FORME « INTERNE » ET NON « PARC » (D229)
--
-- Une notification, pour ce ticket, n'est adressée qu'à des comptes internes
-- — `capacite_requise` ne désigne jamais une capacité de portail — et ne
-- cible aucun client ni aucun site. La forme « parc » exigerait `client_id`,
-- `perimetre_sites` et un `WITH CHECK` explicite pour ouvrir un accès
-- qu'aucun appelant ne réclame aujourd'hui ; « interne » coûte UNE clause de
-- moins et offre une protection strictement supérieure. En cas de doute entre
-- montrer et cacher, on cache (`docs/doctrine-arbitrage.md` §2).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. L'ÉNUMÉRATION DES ÉVÉNEMENTS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- UNE SEULE VALEUR aujourd'hui. Les producteurs des autres événements
-- viendront avec 9J11 et 9J19, chacun ajoutant la sienne à ce moment-là,
-- jamais avant.

CREATE TYPE "EvenementNotification" AS ENUM ('signature_absente_ou_refusee');

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LA TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "notification" (
  "id"         uuid PRIMARY KEY,
  "societe_id" uuid NOT NULL,

  -- La cible : l'intervention OU la demande, jamais deux (même patron que
  -- `document_cible_unique`). `suite_a_donner_id` s'ajoutera au ticket 9J19.
  "intervention_id" uuid,
  "demande_id"      uuid,

  "evenement" "EvenementNotification" NOT NULL,

  -- Doit correspondre à une entrée de CAPACITES (lib/auth/habilitations.ts) —
  -- vérifié par l'application, jamais par un type PostgreSQL : la matrice
  -- grandit au fil des arbitrages, et fermer cette colonne par une
  -- énumération en base coulerait une migration à chaque capacité ajoutée.
  "capacite_requise" text NOT NULL,

  -- NULL = tous ceux qui ont la capacité ci-dessus. Aucune relation Prisma
  -- déclarée vers `utilisateur` (même choix que `import_lot.utilisateur_id`,
  -- D39) : la clé étrangère existe en base, pas comme relation du modèle.
  "destinataire_id" uuid,

  "cree_le" timestamptz NOT NULL DEFAULT now(),
  -- NULLABLE, jamais un booléen (doctrine §3) : la DATE de lecture porte plus
  -- que « lu/non lu ».
  "lue_le" timestamptz,

  -- Le journal de l'envoi (FLX-12). `canal` et `tentee_le` NULL tant qu'aucun
  -- envoi n'a été tenté — une notification interne existe dès sa pose, avant
  -- toute tentative de l'acheminer par un canal.
  "canal"     text,
  "tentee_le" timestamptz,
  -- Booléen TYPÉ, et c'est volontaire malgré `lue_le` ci-dessus : ce n'est pas
  -- la date d'un fait qui se produit une fois pour toutes, c'est l'ISSUE
  -- d'une tentative déjà datée par `tentee_le`.
  "partie" boolean NOT NULL DEFAULT false
);

CREATE INDEX "notification_societe_destinataire_idx" ON "notification" ("societe_id", "destinataire_id");
CREATE INDEX "notification_societe_evenement_idx" ON "notification" ("societe_id", "evenement");
CREATE INDEX "notification_societe_intervention_idx" ON "notification" ("societe_id", "intervention_id");
CREATE INDEX "notification_societe_demande_idx" ON "notification" ("societe_id", "demande_id");

-- `num_nonnulls` compte les colonnes non nulles : exactement une, donc ni
-- deux cibles ni aucune. C'est le SCHÉMA qui l'interdit, pas une validation
-- applicative (même motif que `document_cible_unique`).
ALTER TABLE "notification"
  ADD CONSTRAINT "notification_cible_unique"
  CHECK (num_nonnulls("intervention_id", "demande_id") = 1);

ALTER TABLE "notification"
  ADD CONSTRAINT "notification_capacite_requise_non_vide"
  CHECK (btrim("capacite_requise") <> '');

-- `canal` et `tentee_le` suivent l'ÉQUIVALENCE, dans les deux sens : l'un sans
-- l'autre mentirait sur ce qui s'est passé — un canal sans date dirait qu'un
-- envoi a eu lieu sans dire quand, une date sans canal dirait quand sans dire
-- par où.
ALTER TABLE "notification"
  ADD CONSTRAINT "notification_canal_suit_la_tentative"
  CHECK (("canal" IS NULL) = ("tentee_le" IS NULL));

-- Chaînages. `RESTRICT` des deux côtés, comme `document` : une intervention
-- ou une demande qui porte une notification ne s'efface pas en l'emportant ;
-- `societe_id` entre dans la clé, une propagation ferait changer de société
-- toute une notification.
ALTER TABLE "notification" ADD CONSTRAINT "notification_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "notification" ADD CONSTRAINT "notification_societe_id_intervention_id_fkey"
  FOREIGN KEY ("societe_id", "intervention_id")
  REFERENCES "intervention" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "notification" ADD CONSTRAINT "notification_societe_id_demande_id_fkey"
  FOREIGN KEY ("societe_id", "demande_id")
  REFERENCES "demande" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "notification" ADD CONSTRAINT "notification_destinataire_id_fkey"
  FOREIGN KEY ("destinataire_id") REFERENCES "utilisateur" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. LE CLOISONNEMENT — forme « INTERNE » (D94, D100, D229)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Société, PLUS l'absence de `app.client_id`. Un compte portail ne lit pas
-- cette table, quel que soit son client.

ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_interne" ON "notification"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "notification" TO "codiplan_app";

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. L'AUDIT (I8, D55)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Le périmètre est INVERSÉ : cette table est métier et cloisonnée, donc
-- auditée le jour où elle apparaît.

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "notification"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "notification" IS
  'LA NOTIFICATION (9J09-NOTIFICATIONS-SCHEMA, D229) — que chaque intéressé soit prévenu, en interne par une page selon son habilitation. Forme « interne » (D229, même régime que D94/D100) : société ET app.client_id absent. Aucun écran de portail n''en lit en V1 ; le jour où un événement doit atteindre un compte portail, cette forme SE RETIRE, elle ne s''assouplit pas.';

COMMENT ON COLUMN "notification"."capacite_requise" IS
  'Doit correspondre à une entrée de CAPACITES (lib/auth/habilitations.ts), vérifié par l''application et non par un type PostgreSQL : la matrice grandit au fil des arbitrages.';

COMMENT ON COLUMN "notification"."destinataire_id" IS
  'NULL = tous ceux qui ont la capacité requise. Aucune relation Prisma déclarée vers utilisateur (même choix que import_lot.utilisateur_id, D39) : une relation ferait naître son inverse sur utilisateur, que le gardien de D39 refuserait.';

COMMENT ON COLUMN "notification"."partie" IS
  'Booléen TYPÉ, volontairement, malgré lue_le ci-dessus NULLABLE (doctrine §3) : ce n''est pas la date d''un fait qui se produit une fois pour toutes, c''est l''ISSUE d''une tentative déjà datée par tentee_le (FLX-12).';
