-- ════════════════════════════════════════════════════════════════════════════
-- LA DURÉE RÉELLEMENT MESURÉE DE LA TRANSACTION D'APPLICATION (MESURE-1,
-- 23/09/2026).
-- ════════════════════════════════════════════════════════════════════════════
--
-- `lib/imports/delais.ts` budgète cette durée (`allersRetoursApplication`,
-- `DUREE_MAXIMALE_MS`) mais ne l'a jamais MESURÉE sur une application réelle :
-- le seul chemin du produit qui porte un budget de temps ne mesurait jamais le
-- temps qu'il prenait. Cette colonne ferme cet écart, et RIEN d'autre : aucune
-- constante de `lib/imports/delais.ts` ne change dans ce même lot.
--
-- ## CE QUE CETTE COLONNE N'EST PAS
--
-- **Ce n'est PAS `applique_le - controle_le`.** Cet écart contient le temps
-- qu'un humain a passé à regarder le rapport avant de cliquer « Appliquer » —
-- un lot contrôlé à 9h et appliqué à 14h donnerait cinq heures. La durée
-- mesurée ici est celle de la TRANSACTION, du début du travail jusqu'à son
-- `COMMIT`, chronométrée par `process.hrtime.bigint()` dans
-- `lib/imports/application.ts` — même outil que `scripts/mesure-delais-import.mts`
-- (IMPORT-2) a déjà employé pour mesurer ce même chemin, hors production.
--
-- Elle vaut NULL tant que le lot reste `controle` — jamais ZÉRO : zéro se
-- lirait comme « instantané », ce qui n'arrive jamais pour une vraie
-- transaction. La contrainte ci-dessous le tient en base, pas seulement dans
-- le code applicatif.

ALTER TABLE "import_lot"
  ADD COLUMN "duree_application_ms" INTEGER;

COMMENT ON COLUMN "import_lot"."duree_application_ms" IS
  'AJOUTÉE le 23/09/2026 (MESURE-1) : la durée RÉELLEMENT mesurée de la transaction d''application, du début du travail jusqu''au COMMIT, en millisecondes. NULL tant que le lot reste `controle`. Jamais `applique_le - controle_le`, qui contient le temps qu''un humain a passé à lire le rapport.';

ALTER TABLE "import_lot"
  ADD CONSTRAINT "import_lot_duree_application_jamais_zero"
  CHECK ("duree_application_ms" IS NULL OR "duree_application_ms" > 0);
