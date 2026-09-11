-- ═══════════════════════════════════════════════════════════════════════════
-- L1-08j — UN LOT ANNULÉ GARDE SA DATE D'APPLICATION
-- Invariants I6 ; arbitrages D15, D54.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## Ce que L1-08e avait écrit, et ce que l'annulation a révélé
--
-- La migration précédente posait deux ÉQUIVALENCES, chacune dans les deux
-- sens :
--
--   (statut = 'applique') = (applique_le IS NOT NULL)
--   (statut = 'annule')   = (annule_le   IS NOT NULL)
--
-- Elles étaient justes tant qu'un lot n'avait que trois états SANS HISTOIRE.
-- **L'annulation les a mises en défaut le jour où elle a existé** : un lot
-- annulé a bel et bien été appliqué, et la première équivalence l'obligeait à
-- EFFACER `applique_le` pour passer à `annule`. *C'est-à-dire à perdre la seule
-- trace du moment où les fiches ont été écrites.*
--
-- Mesuré : `import_lot_applique_a_sa_date`, code 23514, sur la première
-- annulation réellement exécutée.
--
-- ## Pourquoi une SECONDE migration plutôt qu'une correction sur place
--
-- Le §7 du CLAUDE.md dit qu'une migration se réécrit **tant qu'elle n'a pas
-- touché une base réelle**, et qu'après elle est immuable. *Je ne peux pas
-- savoir laquelle des deux est vraie* : la base hébergée est injoignable depuis
-- une session, le geste « DB migrate & seed » de L1-08e est en attente d'une
-- main, et rien ne me dit s'il a été fait entre-temps. **Ne pouvant pas
-- mesurer, je prends la voie qui marche dans les deux cas.**
--
-- ## Ce que les nouvelles contraintes disent, et c'est PLUS que les anciennes
--
-- Un lot porte désormais son HISTOIRE, et chaque état dit ce qu'il implique :
--
--   controle → aucune des deux dates
--   applique → la date d'application, et pas celle d'annulation
--   annule   → LES DEUX — il a été appliqué, puis défait
--
-- *Un lot « annulé » sans date d'application serait un lot défait sans avoir
-- été fait*, et l'annulation refuse déjà ce cas ; la base le refuse aussi.

ALTER TABLE "import_lot" DROP CONSTRAINT "import_lot_applique_a_sa_date";
ALTER TABLE "import_lot" DROP CONSTRAINT "import_lot_annule_a_sa_date";

-- L'annulation est le SEUL état qui porte les deux dates, et elle les porte
-- toutes les deux : un lot ne s'annule qu'après avoir été appliqué.
ALTER TABLE "import_lot"
  ADD CONSTRAINT "import_lot_dates_suivent_le_statut"
  CHECK (
    ("statut" = 'controle' AND "applique_le" IS NULL     AND "annule_le" IS NULL)
    OR
    ("statut" = 'applique' AND "applique_le" IS NOT NULL AND "annule_le" IS NULL)
    OR
    ("statut" = 'annule'   AND "applique_le" IS NOT NULL AND "annule_le" IS NOT NULL)
  );

-- L'ordre des deux dates, quand les deux existent. *Une annulation antérieure à
-- son application décrirait un état qui n'a pas eu lieu*, et c'est le genre de
-- valeur qu'une reprise de données pose sans le vouloir.
ALTER TABLE "import_lot"
  ADD CONSTRAINT "import_lot_annulation_apres_application"
  CHECK ("annule_le" IS NULL OR "annule_le" >= "applique_le");

COMMENT ON COLUMN "import_lot"."applique_le" IS
  'Quand les fiches ont été écrites. ELLE SURVIT À L''ANNULATION : un lot annulé a bel et bien été appliqué, et effacer cette date perdrait la seule trace du moment où le parc a changé (L1-08j). La première rédaction de la contrainte l''effaçait, et c''est la première annulation réellement exécutée qui l''a dit.';
