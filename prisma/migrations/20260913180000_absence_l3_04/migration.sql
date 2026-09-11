-- ═══════════════════════════════════════════════════════════════════════════
-- L'ABSENCE D'UN TECHNICIEN — et pourquoi aucun client ne la lit (L3-04)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RG-PLA-06 : *« Une absence validée bloque le créneau ; les interventions
-- posées repassent en file à planifier avec alerte. Tant que l'effectif est
-- d'un seul technicien, l'absence déclenche une alerte de rupture de service
-- et propose le report groupé. »*
--
-- Cette migration porte la DONNÉE et le cloisonnement. La règle — quatrième
-- contrôle à la pose, et le repli des interventions déjà posées — vit dans
-- `lib/interventions/` et `lib/absences/`.
--
-- ## LA FORME EST « INTERNE », ET C'EST LE CŒUR DE LA DÉCISION
--
-- D94 a créé cette forme pour `document_recu` — *une table de forme « société »
-- est lisible par un compte de portail, sa clause ne lisant pas
-- `app.client_id`* — et il a écrit ce qu'il laissait ouvert : *« le jour où un
-- écran ou une route de portail lit une table de forme « société », la question
-- vise la CLASSE et non une table. »*
--
-- **Ici la question ne se pose pas au réveil : elle se pose à la NAISSANCE de
-- la table**, et c'est le seul moment où elle ne coûte rien (§9, 30/08 — *une
-- échéance qui tombe au pire moment est un report déguisé*). Une absence nomme
-- une PERSONNE et dit qu'elle n'est pas là :
--
-- > *« Votre technicien habituel est en arrêt du 14 au 28 » est une donnée de
-- > santé par déduction, et ce n'est pas au client de la lire.*
--
-- C'est la doctrine §2 appliquée sans détour — **en cas de doute entre montrer
-- et cacher, on cache** — et c'est plus fort qu'un doute : aucun écran de
-- portail n'a de raison de lire cette table, ni aujourd'hui ni au lot 5.
--
-- *Le coût, nommé comme D94 nomme le sien* : le jour où l'on voudrait dire à un
-- client « votre intervention est reportée, le technicien est indisponible », ce
-- n'est pas cette table qu'il lira — c'est l'intervention elle-même, qui porte
-- déjà son statut et son motif. **Et c'est bien ainsi** : ce qu'un client a le
-- droit de savoir est que SON rendez-vous bouge, jamais pourquoi la personne
-- n'est pas là.
--
-- ## DEUX DATES, ET AUCUNE HEURE
--
-- `du` et `au`, bornes COMPRISES, en `DATE`. Une absence à la demi-journée
-- n'est pas tranchée et n'est donc pas construite : *une colonne inerte n'est
-- pas neutre, elle est une invitation* (D77). La borne fermée est écrite ici
-- plutôt que laissée à la lecture — « au 28 » veut dire que le 28 est absent,
-- et une borne ouverte aurait fait travailler quelqu'un le dernier jour de son
-- arrêt.
--
-- ## LE STATUT EST UN ÉTAT À TROIS VALEURS, JAMAIS UN BOOLÉEN
--
-- RG-PLA-06 ne bloque QUE sur une absence **validée**. Un booléen `validee`
-- n'aurait pas su dire la différence entre « demandée, pas encore tranchée » et
-- « refusée » — *une case décochée est indiscernable d'une demande jamais
-- examinée* (doctrine §3, la leçon de l'assujettissement VGP). Trois valeurs,
-- et la naissance est `demandee`.

CREATE TYPE "StatutAbsence" AS ENUM ('demandee', 'validee', 'refusee');

-- Le MOTIF est une énumération et non du texte libre, pour la raison inverse de
-- celle des habilitations : les habilitations d'une société tierce sont
-- inconnues (D60), les motifs d'absence ne le sont pas — congé, arrêt,
-- formation, récupération, autre. **`autre` porte le texte**, et lui seul.
CREATE TYPE "MotifAbsence" AS ENUM ('conge', 'arret', 'formation', 'recuperation', 'autre');

CREATE TABLE "absence" (
  "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
  "societe_id"     uuid NOT NULL,
  "utilisateur_id" uuid NOT NULL,

  -- Bornes COMPRISES toutes les deux. Voir l'entête.
  "du"             date NOT NULL,
  "au"             date NOT NULL,

  "statut"         "StatutAbsence" NOT NULL DEFAULT 'demandee',
  "motif"          "MotifAbsence"  NOT NULL,
  -- Le commentaire libre : obligatoire quand le motif est `autre`, interdit
  -- sinon. Un motif énuméré qui traînerait un commentaire ferait deux sources
  -- d'un même fait.
  "precision"      text,

  "cree_le"        timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifie_le"     timestamptz(3) NOT NULL,

  CONSTRAINT "absence_pkey" PRIMARY KEY ("id"),

  -- Une période dont la fin précède le début n'est pas une période.
  CONSTRAINT "absence_dates_ordonnees" CHECK ("au" >= "du"),

  -- **LES DEUX SENS, et le second est celui qu'on oublie** (D88, sur les
  -- exceptions VGP) : un `autre` sans précision ne dit rien, et une précision
  -- sous un motif énuméré est une seconde source du même fait.
  CONSTRAINT "absence_precision_si_autre" CHECK (
    ("motif" = 'autre') = ("precision" IS NOT NULL AND length(btrim("precision")) > 0)
  )
);

CREATE UNIQUE INDEX "absence_societe_id_id_key" ON "absence" ("societe_id", "id");
-- L'index qui sert la question posée à chaque pose : *cette personne est-elle
-- absente ce jour-là ?*
CREATE INDEX "absence_societe_utilisateur_periode_idx"
  ON "absence" ("societe_id", "utilisateur_id", "du", "au");

-- Les DEUX actions référentielles sont dites et justifiées (§9, 24/08).
-- `RESTRICT` des deux côtés : une société ne se supprime pas tant qu'elle porte
-- des absences, et le rattachement d'une personne à une société ne se retire
-- pas en laissant ses absences orphelines.
--
-- **AUCUNE clé étrangère vers `utilisateur`** — quatrième catégorie de I1, sans
-- `societe_id`, et une relation Prisma vers elle est refusée par le gardien de
-- D39. C'est la forme de `technicien_habilitation` : la clé passe par
-- `utilisateur_societe`, qui porte les deux colonnes.
ALTER TABLE "absence"
  ADD CONSTRAINT "absence_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "absence_technicien_fkey"
    FOREIGN KEY ("utilisateur_id", "societe_id")
    REFERENCES "utilisateur_societe"("utilisateur_id", "societe_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────────────────────────────────────────────────────────────────────
-- LE CLOISONNEMENT — forme « interne » (D94)
-- ───────────────────────────────────────────────────────────────────────────
--
-- Société ET `app.client_id` ABSENT. Le discriminant est posé pour un compte de
-- portail et pour lui seul (D70) : un rôle interne garde la clause de société,
-- un compte portail ne lit RIEN, quel que soit son client.
--
-- Le `WITH CHECK` est ÉCRIT même s'il répète le `USING` (L1-02c) : une
-- politique qui n'énonce qu'un `USING` légifère en silence sur les écritures.

ALTER TABLE "absence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "absence" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_interne" ON "absence"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "absence" TO "codiplan_app";

-- ───────────────────────────────────────────────────────────────────────────
-- L'AUDIT (I8, D55)
-- ───────────────────────────────────────────────────────────────────────────
--
-- Le périmètre est inversé : le gardien le réclame le jour où la table
-- apparaît. Elle le mérite sans qu'on ait à plaider — *qui a validé cette
-- absence, et quand* décide de ce qui a été déplanifié, et une validation
-- revenue sur elle-même laisserait des interventions en file sans que personne
-- ne sache pourquoi.

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "absence"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "absence" IS
  'L''indisponibilité datée d''une personne (L3-04, RG-PLA-06). Table métier de la première catégorie de I1, forme « INTERNE » (D94) : société ET app.client_id absent. Aucun compte de portail ne la lit, et ce n''est pas une précaution — « votre technicien habituel est en arrêt du 14 au 28 » est une donnée de santé par déduction. Ce qu''un client a le droit de savoir est que SON rendez-vous bouge, jamais pourquoi la personne n''est pas là : cela se lit sur l''intervention, qui porte son statut et son motif.';

COMMENT ON COLUMN "absence"."du" IS
  'Première journée d''absence, COMPRISE.';

COMMENT ON COLUMN "absence"."au" IS
  'Dernière journée d''absence, COMPRISE. Une borne ouverte aurait fait travailler quelqu''un le dernier jour de son arrêt.';

COMMENT ON COLUMN "absence"."statut" IS
  'TROIS valeurs, jamais un booléen : RG-PLA-06 ne bloque que sur une absence VALIDÉE, et un booléen n''aurait pas distingué « demandée, pas encore tranchée » de « refusée ». La naissance est « demandee ».';

COMMENT ON COLUMN "absence"."precision" IS
  'Obligatoire quand le motif est « autre », INTERDITE sinon — les deux sens, et le second est celui qu''on oublie : une précision sous un motif énuméré serait une seconde source du même fait.';
