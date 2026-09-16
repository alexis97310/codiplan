-- ════════════════════════════════════════════════════════════════════════════
-- LE QUATRIÈME DÉCOMPTE : LES LIGNES QUE L'APPLICATION N'A PAS ÉCRITES.
-- Session du 16/09/2026, point 1 — « une modification qui ne modifie rien
-- n'est pas une modification ».
-- ════════════════════════════════════════════════════════════════════════════
--
-- ## CE QUI A ÉTÉ MESURÉ
--
-- Un lot de 4 CRÉATIONS et 615 MODIFICATIONS de clients, réappliqué depuis le
-- MÊME fichier que celui qui les avait créées quatre lignes plus tôt : les 615
-- lignes réécrivaient 615 fiches à l'identique. `POST
-- /api/imports/{id}/appliquer` n'a rendu aucune réponse après quatre minutes,
-- pendant que le déclencheur d'audit (I8) inscrivait 615 traces de
-- modifications qui n'avaient pas eu lieu — un journal qui ment sur le passé.
--
-- ## CE QUE CETTE COLONNE N'EST PAS
--
-- **Elle n'est PAS de la même famille que `lignes_creations`,
-- `lignes_modifications`, `lignes_rejets`, `lignes_gabarits`, `lignes_vides` —
-- les cinq colonnes « tels que le rapport les a RENDUS » (le commentaire du
-- schéma, mot pour mot), posées UNE FOIS au contrôle et jamais réécrites.**
-- `lignes_inchangees` n'a aucune proposition à trahir : le contrôle ne peut pas
-- savoir si une ligne classée MODIFICATION ne changera rien — seule
-- l'application le mesure, en comparant chaque fiche avant d'écrire
-- (`porteEncore`, `lib/imports/application.ts`). Elle vaut zéro tant que le lot
-- reste `controle`, et l'application la pose une seule fois, dans la MÊME
-- écriture que `statut` et `applique_le`.
--
-- `lib/imports/application.ts` et `lib/imports/depot.ts` sont les seuls
-- appelants : la première l'écrit, la seconde la lit.

ALTER TABLE "import_lot"
  ADD COLUMN "lignes_inchangees" INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN "import_lot"."lignes_inchangees" IS
  'AJOUTÉE le 16/09/2026 : les lignes classées MODIFICATION dont la comparaison, faite par l''application AVANT d''écrire, a montré que la fiche portait déjà exactement ces valeurs. Zéro tant que le lot reste `controle` — à la différence des cinq autres colonnes de décompte, elle n''est pas une proposition du contrôle, elle est une mesure de l''application, posée une seule fois avec `statut` et `applique_le`.';

-- **LA MÊME CONTRAINTE, ÉTENDUE — et non une seconde à côté.** Une colonne de
-- décompte négative dirait la même chose qu'une des cinq autres : une erreur
-- de calcul. `DROP` puis `ADD` plutôt que de laisser deux contraintes dire la
-- même famille de règle à deux endroits.
ALTER TABLE "import_lot"
  DROP CONSTRAINT "import_lot_decomptes_positifs";

ALTER TABLE "import_lot"
  ADD CONSTRAINT "import_lot_decomptes_positifs"
  CHECK ("lignes_creations" >= 0 AND "lignes_modifications" >= 0
     AND "lignes_rejets" >= 0 AND "lignes_gabarits" >= 0 AND "lignes_vides" >= 0
     AND "lignes_inchangees" >= 0);
