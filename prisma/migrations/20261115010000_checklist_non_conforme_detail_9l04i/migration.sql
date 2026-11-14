-- ═══════════════════════════════════════════════════════════════════════════
-- 9L04I-CHECKLIST-NON-CONFORME-DETAIL — LA SUITE À DONNER, LE COMMENTAIRE ET
-- LES PHOTOS D'UN POINT NON CONFORME (décisions d'Alexis du 13/11/2026).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Alexis, mesuré le 13/11 : le moteur ne porte PAS ce détail — la migration
-- 9K08/9K18/9K28 pose `checklist_reponse_valeur_unique` à SIX colonnes, et ce
-- lot ne la touche pas. Les deux colonnes ajoutées ici sont des INFORMATIONS
-- ADDITIONNELLES, jamais une septième alternative : elles restent NULLES
-- quelle que soit la réponse, SAUF quand `valeur_conforme = 'non_conforme'`,
-- et même alors elles restent FACULTATIVES (question ouverte laissée à la
-- passation — Alexis n'a tranché que les TROIS VALEURS de la suite et le fait
-- que « pièce à commander » ne porte pas de référence, la pièce en attente
-- passant déjà par « Suspendre », D236).
--
-- Les photos d'un point non conforme réutilisent `checklist_reponse_photo`
-- SANS migration : la garde qui limite aujourd'hui ce lien aux points de type
-- `photo` est purement APPLICATIVE (`enregistrerReponsePhoto`,
-- `lib/checklists/depot.ts`), jamais une contrainte en base — rien à desserrer
-- ici, seul le code est étendu.
--
-- Aucune ligne existante à reprendre : les deux colonnes neuves sont posées
-- NULLABLE, sans valeur par défaut.

CREATE TYPE "ChecklistNonConformiteSuite" AS ENUM (
  'regle_sur_place',
  'piece_a_commander',
  'a_revoir'
);

-- `TEXT`, PAS `VARCHAR(500)` — MÊME PATRON QUE `valeur_texte`
-- (`checklist_reponse_valeur_texte_bornee`, 9K18) : la borne de longueur est
-- UNIQUEMENT la contrainte CHECK ci-dessous, nommée, qui porte sa propre
-- erreur lisible. Un `VARCHAR(500)` poserait la MÊME borne au niveau du TYPE
-- de la colonne, et PostgreSQL la ferait respecter EN PREMIER, avec son
-- message technique à lui (`value too long for type character varying`) —
-- jamais celui, nommé, de la contrainte.
ALTER TABLE "checklist_reponse"
  ADD COLUMN "non_conformite_suite" "ChecklistNonConformiteSuite",
  ADD COLUMN "non_conformite_commentaire" TEXT;

-- LES DEUX COLONNES NE VALENT QUE POUR UN POINT NON CONFORME — jamais sur une
-- réponse `conforme`, `sans_objet`, ni sur un AUTRE type de point (où
-- `valeur_conforme` est de toute façon NULL, `checklist_reponse_valeur_unique`
-- l'imposant déjà).
ALTER TABLE "checklist_reponse"
  ADD CONSTRAINT "checklist_reponse_detail_non_conforme" CHECK (
    ("non_conformite_suite" IS NULL AND "non_conformite_commentaire" IS NULL)
    OR "valeur_conforme" = 'non_conforme'
  );

-- MÊME BORNE QUE `valeur_texte` (`checklist_reponse_valeur_texte_bornee`,
-- 9K18) — jamais une chaîne vide ou tout-blanc, jamais plus de 500 caractères.
ALTER TABLE "checklist_reponse"
  ADD CONSTRAINT "checklist_reponse_commentaire_non_conforme_borne" CHECK (
    "non_conformite_commentaire" IS NULL
    OR (
      btrim("non_conformite_commentaire") <> ''
      AND length("non_conformite_commentaire") <= 500
    )
  );

COMMENT ON COLUMN "checklist_reponse"."non_conformite_suite" IS
  '9L04I — la suite donnée à un point NON CONFORME (réglé sur place / pièce à commander / à revoir) ; NULL sinon, et facultative même sur un point non conforme.';
COMMENT ON COLUMN "checklist_reponse"."non_conformite_commentaire" IS
  '9L04I — le commentaire libre d''un point NON CONFORME, borné à 500 caractères ; NULL sinon, et facultatif même sur un point non conforme.';

-- AUCUN GRANT NOUVEAU — `GRANT SELECT, INSERT, UPDATE ON "checklist_reponse"`
-- (9K08) est posé par TABLE, jamais par colonne : les deux colonnes neuves en
-- héritent sans rien à répéter ici.
