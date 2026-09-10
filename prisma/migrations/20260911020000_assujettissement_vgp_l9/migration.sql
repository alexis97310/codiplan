-- ═══════════════════════════════════════════════════════════════════════════
-- LOT 9 — L'ASSUJETTISSEMENT AUX VGP : la colonne vertébrale du registre
--
-- Tickets L9-03, L9-04, L9-05, L9-06 et L9-07. Arbitrage D88.
--
-- LE FAIT DONT TOUT DÉCOULE : les vérifications générales périodiques sont
-- commandées par les CLIENTS, pas par CODIMA. CODIPLAN n'apprend leur résultat
-- que si on le lui dit. **Rien ici ne calcule une conformité** : ces colonnes
-- disent ce qu'on a DÉCLARÉ, et le seul calcul que le lot autorisera jamais est
-- une DATE (L9-01).
--
-- ── TROIS VALEURS, JAMAIS UNE CASE À COCHER (L9-03) ────────────────────────
--
-- Une case décochée est indiscernable d'une famille jamais examinée, et un pont
-- élévateur sortirait du registre en silence. L'énumération porte donc l'état
-- de NAISSANCE — `a_determiner` — au même rang que les réponses, et le DEFAULT
-- l'installe sans qu'on l'ait demandé : *le défaut porte la règle, il ne la
-- contourne pas.*
--
-- ── CE QUE LA BASE REFUSE, PLUTÔT QUE DE LE SIGNALER ───────────────────────
--
-- (L9-04) `soumis` sans périodicité ou sans référence de texte. *Sans le texte,
-- la périodicité est un chiffre que personne ne peut défendre.*
-- (L9-05) Aucune valeur par DÉFAUT pour la périodicité : elle dépend du
-- matériel et du texte applicable, la Nouvelle-Calédonie a son propre code du
-- travail, et la solution sera vendue ailleurs. Un `DEFAULT` serait un délai
-- inventé, ce que le §8 du CLAUDE.md interdit.
-- (L9-06) Une exception d'exemplaire sans motif écrit.
--
-- ── POURQUOI DES CONTRAINTES DE TABLE ET NON UNE VALIDATION D'ENTRÉE ───────
--
-- La saisie Zod les porte aussi, et c'est voulu : elle rend un message lisible.
-- Mais *une règle qui ne vit que dans la couche applicative n'en est pas une*
-- (I1, et le §9 tout entier). Le seed, une migration, une console : tous
-- passent par la base, aucun ne passe par Zod.
--
-- ── (L9-07) LA JOURNALISATION N'EST PAS UNE TABLE DE PLUS ──────────────────
--
-- `famille_materiel`, `modele_materiel` et `machine` sont déjà au périmètre
-- d'audit — première catégorie de I1, périmètre INVERSÉ de D55 : auditées par
-- défaut. Le déclencheur existe, il porte les valeurs avant et après, et
-- « qui, quand, sur quelle base » s'y lit sans qu'une ligne soit écrite ici.
-- *C'est l'exemple même de ce que le renversement de D55 fait gagner : le
-- ticket n'a rien à demander.*
--
-- ── POURQUOI AUCUN BLOC DE GARDE (§9, 07/09) ──────────────────────────────
--
-- Cette migration ne LIT aucune table. Les blocs qu'il faut rendre visibles
-- sont ceux qui COMPTENT des lignes sous `FORCE ROW LEVEL SECURITY` ; il n'y en
-- a pas ici. Les colonnes ajoutées sont nullables ou portent un défaut, donc
-- aucune ligne existante n'est en défaut au moment de l'ajout.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE "AssujettissementVgp" AS ENUM (
  'a_determiner', 'soumis', 'non_soumis', 'verifie'
);

COMMENT ON TYPE "AssujettissementVgp" IS
  'L9-03 / D88 — TROIS valeurs et jamais une case à cocher : a_determiner est l''état de NAISSANCE, et il dit « on n''a pas regardé », ce qu''aucun booléen ne sait dire. Une case décochée est indiscernable d''une famille jamais examinée.';

-- ── LA FAMILLE : c'est là que la question a un sens réglementaire ──────────

ALTER TABLE "famille_materiel"
  ADD COLUMN "assujettissement_vgp" "AssujettissementVgp" NOT NULL DEFAULT 'a_determiner',
  ADD COLUMN "vgp_periodicite_mois" integer,
  ADD COLUMN "vgp_reference_texte"  text;

COMMENT ON COLUMN "famille_materiel"."assujettissement_vgp" IS
  'L9-03 / D88 — se déclare à la FAMILLE et se propage. Naît à a_determiner sans qu''on l''ait demandé : le défaut porte la règle.';
COMMENT ON COLUMN "famille_materiel"."vgp_periodicite_mois" IS
  'L9-05 / D88 — AUCUNE valeur par défaut : la périodicité dépend du matériel et du texte applicable, et la Nouvelle-Calédonie a son propre code du travail. Obligatoire dès que l''assujettissement vaut soumis.';
COMMENT ON COLUMN "famille_materiel"."vgp_reference_texte" IS
  'L9-04 / D88 — le texte qui FONDE la périodicité. Sans lui, la périodicité est un chiffre que personne ne peut défendre. C''est aussi le « sur quelle base » de la journalisation (L9-07).';

-- LA CONTRAINTE, ÉCRITE DANS LE SENS QUI SE RELIT : « soumis IMPLIQUE les deux
-- champs ». Les trois autres valeurs ne les exigent pas, et ne les interdisent
-- pas non plus — une famille qu'on vient de déclarer non soumise peut garder la
-- trace du texte qu'on a lu pour le décider.
ALTER TABLE "famille_materiel"
  ADD CONSTRAINT "famille_vgp_soumis_exige_sa_base"
  CHECK (
    "assujettissement_vgp" <> 'soumis'
    OR ("vgp_periodicite_mois" IS NOT NULL AND "vgp_reference_texte" IS NOT NULL)
  );

-- Une périodicité de zéro mois ou négative n'est pas une périodicité. Écrit
-- séparément de la contrainte ci-dessus : elle répond à une autre question, et
-- un refus qui mêle les deux n'apprend pas laquelle a mordu (D50).
ALTER TABLE "famille_materiel"
  ADD CONSTRAINT "famille_vgp_periodicite_positive"
  CHECK ("vgp_periodicite_mois" IS NULL OR "vgp_periodicite_mois" > 0);

-- ── LE MODÈLE : il PRÉCISE, il ne décide pas (L9-06) ───────────────────────

ALTER TABLE "modele_materiel"
  ADD COLUMN "vgp_periodicite_mois" integer,
  ADD COLUMN "vgp_reference_texte"  text;

COMMENT ON COLUMN "modele_materiel"."vgp_periodicite_mois" IS
  'L9-06 / D88 — le modèle PRÉCISE la périodicité de sa famille, il ne décide pas de l''assujettissement. NULLE, il suit sa famille : l''absence n''est pas « aucune périodicité », c''est « rien à préciser ».';

-- Un chiffre sans son texte ne se défend pas plus ici qu'au niveau de la
-- famille : la règle de L9-04 est la MÊME, écrite au niveau où la précision se
-- pose. La recopier était le seul moyen de la faire tenir par la base des deux
-- côtés — une contrainte ne traverse pas les tables —, et c'est ce que la
-- saisie Zod, elle, écrit une seule fois.
ALTER TABLE "modele_materiel"
  ADD CONSTRAINT "modele_vgp_periodicite_exige_son_texte"
  CHECK (
    "vgp_periodicite_mois" IS NULL OR "vgp_reference_texte" IS NOT NULL
  );

ALTER TABLE "modele_materiel"
  ADD CONSTRAINT "modele_vgp_periodicite_positive"
  CHECK ("vgp_periodicite_mois" IS NULL OR "vgp_periodicite_mois" > 0);

-- ── L'EXEMPLAIRE : il fait EXCEPTION, et jamais sans sa raison (L9-06) ─────

ALTER TABLE "machine"
  ADD COLUMN "vgp_exception"       "AssujettissementVgp",
  ADD COLUMN "vgp_exception_motif" text;

COMMENT ON COLUMN "machine"."vgp_exception" IS
  'L9-06 / D88 — l''exception d''un EXEMPLAIRE à sa famille : un usage particulier, une modification. NULLE, la machine suit son modèle, qui suit sa famille. L''absence n''est pas « non soumise » : c''est « pas d''exception ».';
COMMENT ON COLUMN "machine"."vgp_exception_motif" IS
  'L9-06 / D88 — obligatoire dès qu''une exception est posée. Une exception sans sa raison est une exception que personne ne pourra rejuger, et la base la REFUSE plutôt que de la signaler.';

-- LES DEUX SENS, et le second est celui qu'on oublie : un motif sans exception
-- est une trace qui ne se rattache à rien, et qui survivrait au retrait de
-- l'exception qu'elle expliquait. C'est la même famille que les exemptions
-- orphelines du §9 (31/08).
ALTER TABLE "machine"
  ADD CONSTRAINT "machine_vgp_exception_exige_son_motif"
  CHECK (
    ("vgp_exception" IS NULL AND "vgp_exception_motif" IS NULL)
    OR ("vgp_exception" IS NOT NULL
        AND "vgp_exception_motif" IS NOT NULL
        AND btrim("vgp_exception_motif") <> '')
  );
