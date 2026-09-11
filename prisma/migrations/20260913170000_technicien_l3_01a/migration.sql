-- ═══════════════════════════════════════════════════════════════════════════
-- LE TECHNICIEN — l'agence de rattachement, et rien de plus (L3-01a)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- L3-01 le réclame nommément : *« Dépend de : la table `technicien`
-- (utilisateur, société, **agence**, actif — chapitre 11), à créer au lot 3
-- AVANT l'écran. »* Et le lot 2 l'attendait déjà sans le dire : **D12 calcule
-- la majoration hors ouverture sur le calendrier de l'AGENCE DU TECHNICIEN**,
-- et D13 y ajoute la détection de conflit à la pose.
--
-- ## TROIS COLONNES DU CHAPITRE 11 NE SONT PAS CRÉÉES
--
-- `cout_horaire` et `taux_facturation_defaut` — *c'est exactement le piège de
-- `societe.taux_horaire_defaut`, RETIRÉE le 09/09/2026* : deux sources d'un
-- même fait qui divergent en valeur. Le taux vit dans `taux_horaire`,
-- historisé par date d'effet (RG-TAR-04), et **une facture qui change quand le
-- tarif change est une facture fausse**.
--
-- `vehicule` — rien ne le lit, rien ne l'écrit. *Une colonne inerte n'est pas
-- neutre, elle est une invitation* : elle s'implémentera un jour de travers,
-- par quelqu'un qui la trouvera au schéma et lui cherchera un sens (D77).
--
-- ## ET LE CALENDRIER PROPRE N'EST PAS ICI
--
-- `technicien_calendrier` le porte déjà, sur la MÊME clé. L'ajouter ferait deux
-- écritures d'un même fait, et personne ne saurait laquelle gagne (§9, 01/09).

-- ## UNE COLONNE `id` QUE LE JOURNAL EXIGE, ET UNE VOISINE RÉPARÉE
--
-- `journal_audit_tracer` désigne la ligne journalisée par sa CLÉ TECHNIQUE
-- (I10) et **lève** quand la table n'expose aucune colonne `id`. Sa voisine
-- `technicien_calendrier` ne l'avait pas : le déclencheur y est posé depuis le
-- paramétrage par agence, et **aucun INSERT n'a jamais pu aboutir** —
-- *personne ne l'avait vu parce que personne n'écrivait dans cette table.*
--
-- Mesuré par un `INSERT` direct, à l'occasion de ce ticket :
--
--   ERROR : journal_audit : la table « technicien_calendrier » n'expose
--           aucune colonne « id ».
--
-- C'est le §9 du 08/09 — *un défaut invisible parce que ce qu'il casse n'existe
-- pas encore* —, et il est réparé ici plutôt que laissé : **ce ticket LIT cette
-- table**, et la règle de priorité de D72 n'a jamais pu être exercée.
--
-- La clé PRIMAIRE reste le couple des deux tables : c'est lui qui dit « une
-- personne, une société, un rattachement ». `id` est une clé TECHNIQUE, unique,
-- et rien d'autre.

ALTER TABLE "technicien_calendrier"
  ADD COLUMN "id" uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "technicien_calendrier_id_key"
  ON "technicien_calendrier" ("id");

COMMENT ON COLUMN "technicien_calendrier"."id" IS
  'Clé technique exigée par journal_audit_tracer (I10), AJOUTÉE à L3-01a. Sans elle, tout INSERT dans cette table levait — le déclencheur d''audit y était posé depuis le paramétrage par agence, et rien n''y écrivait, si bien que personne ne l''avait vu. La clé primaire reste (societe_id, utilisateur_id).';

CREATE TABLE "technicien" (
  "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
  "societe_id"     uuid NOT NULL,
  "utilisateur_id" uuid NOT NULL,
  "agence_id"      uuid NOT NULL,
  "actif"          boolean NOT NULL DEFAULT true,
  "cree_le"        timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifie_le"     timestamptz(3) NOT NULL,

  CONSTRAINT "technicien_pkey" PRIMARY KEY ("societe_id", "utilisateur_id")
);

CREATE UNIQUE INDEX "technicien_id_key" ON "technicien" ("id");
CREATE INDEX "technicien_societe_id_agence_id_idx"
  ON "technicien" ("societe_id", "agence_id");

-- Les DEUX actions référentielles sont dites et justifiées (§9, 24/08) :
-- `RESTRICT` des deux côtés. Une agence ne se supprime pas tant qu'elle a des
-- techniciens — *les leur retirer en silence les rattacherait à rien, et la
-- majoration de D12 n'aurait plus de calendrier.*
--
-- **AUCUNE clé étrangère vers `utilisateur`**, et c'est la forme de
-- `journal_audit` et de `import_lot` : `utilisateur` est la QUATRIÈME catégorie
-- de I1, sans `societe_id`, et une relation Prisma vers elle est refusée par le
-- gardien de D39. Le lien reste, tenu par la colonne et par le code.
ALTER TABLE "technicien"
  ADD CONSTRAINT "technicien_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "technicien_societe_id_agence_id_fkey"
    FOREIGN KEY ("societe_id", "agence_id") REFERENCES "agence"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────────────────────────────────────────────────────────────────────
-- LE CLOISONNEMENT — forme « société »
-- ───────────────────────────────────────────────────────────────────────────
--
-- Table métier ORDINAIRE : le cas général de la première catégorie de I1. Elle
-- ne porte ni `client_id` ni `site_id`, et aucun écran de portail ne la lit.
--
-- **La question que D94 laisse ouverte la vise comme les autres** : une table de
-- forme « société » est lisible par un compte de portail, sa clause ne lisant
-- pas `app.client_id`. `taux_horaire`, `forfait` et `agence` sont dans le même
-- cas, et D94 écrit sa condition de réouverture — *le jour où un écran ou une
-- route de portail lit une table de forme « société », la question vise la
-- CLASSE et non une table.* Aucun écran ne le fait, et l'étendre ici serait un
-- arbitrage bien plus large que ce ticket.
--
-- Le `WITH CHECK` est ÉCRIT même s'il répète le `USING` (L1-02c).

ALTER TABLE "technicien" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "technicien" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_societe" ON "technicien"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "technicien" TO "codiplan_app";

-- ───────────────────────────────────────────────────────────────────────────
-- L'AUDIT (I8, D55)
-- ───────────────────────────────────────────────────────────────────────────
--
-- Le périmètre est inversé : le gardien le réclame le jour où la table
-- apparaît. Elle le mérite — *« depuis quand ce technicien dépend-il de Koné »*
-- décide de ce qui a été facturé en majoration, et c'est une question de
-- facture autant que de planning.

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "technicien"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "technicien" IS
  'Le rattachement d''une personne à une agence, dans une société (L3-01a). Table métier de la première catégorie de I1, forme « société ». Le chapitre 11 y nomme aussi cout_horaire, taux_facturation_defaut et vehicule : les deux premiers ne sont PAS créés — c''est le piège de societe.taux_horaire_defaut, retirée le 09/09/2026, deux sources d''un même fait qui divergent en valeur ; le troisième non plus — rien ne le lit, et une colonne inerte est une invitation. Le calendrier propre du technicien vit dans technicien_calendrier, sur la même clé.';

COMMENT ON COLUMN "technicien"."agence_id" IS
  'L''agence DE RATTACHEMENT — et non celle de l''intervention. C''est elle qui décide de la majoration hors ouverture (D12) et du calendrier de détection de conflit à la pose (D13). Une intervention posée à Koné par un technicien de Ducos un samedi n''est pas hors ouverture, et son SLA court pourtant sur le calendrier de Koné : les deux agences se distinguent, et c''est ici que la seconde existe enfin.';

COMMENT ON COLUMN "technicien"."actif" IS
  'Un technicien qui a quitté l''entreprise ne se supprime pas : ses interventions passées le nomment encore. Il cesse d''être proposé, il ne cesse pas d''avoir existé.';
