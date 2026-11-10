-- ═══════════════════════════════════════════════════════════════════════════
-- 9K18-CHECKLIST-DOMAINE — CINQ TYPES DE RÉPONSE (décision d'Alexis du
-- 10/11/2026 ~13h10 : « Oui, les 5 types »)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Le socle 9K08 (D235) n'en posait que trois. Le brouillon des modèles
-- d'entretien en demande cinq : cette migration AJOUTE, elle ne touche
-- aucune migration déjà appliquée.
--
-- 1. `TypeReponseChecklist` gagne `choix_dans_une_liste` et `texte_libre`.
-- 2. `checklist_point.choix` (text[], vide par défaut) — les choix proposés,
--    NON VIDE et SANS DOUBLON exigé pour `choix_dans_une_liste`, VIDE exigé
--    pour les quatre autres types.
-- 3. `checklist_reponse.valeur_choix` / `valeur_texte` — la contrainte
--    d'exclusivité (`checklist_reponse_valeur_unique`, `num_nonnulls`) est
--    REPOSÉE sur les CINQ colonnes de valeur.
--
-- Aucune ligne n'existe encore dans `checklist_point` ni `checklist_reponse`
-- (9K08 n'a livré que le socle, aucun gabarit n'est semé) : les deux
-- contraintes neuves sont posées VALIDÉES, rien à resserrer.
--
-- ## LA RESTRICTION POSTGRESQL SUR LES VALEURS D'ÉNUMÉRATION NEUVES
--
-- Une valeur ajoutée par `ALTER TYPE ... ADD VALUE` ne peut pas être UTILISÉE
-- dans la transaction qui l'ajoute (même restriction que
-- `20261107010000_suite_a_donner_notifications_9j19`, documentée dans son
-- fichier). Les deux contraintes CHECK ci-dessous comparent donc
-- `"type_reponse"::text` à la valeur neuve, JAMAIS `"type_reponse" =
-- 'choix_dans_une_liste'::"TypeReponseChecklist"` — mesuré contre une base
-- réelle (un type de test, dans une transaction annulée) : la comparaison
-- textuelle passe, la comparaison typée lève « unsafe use of new value ».

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. L'ÉNUMÉRATION
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TYPE "TypeReponseChecklist" ADD VALUE 'choix_dans_une_liste';
ALTER TYPE "TypeReponseChecklist" ADD VALUE 'texte_libre';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. `checklist_point.choix` — LES CHOIX PROPOSÉS, `choix_dans_une_liste` SEUL
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "checklist_point" ADD COLUMN "choix" text[] NOT NULL DEFAULT '{}';

-- NON VIDE ET SANS DOUBLON pour `choix_dans_une_liste` ; VIDE pour les
-- quatre autres types — comparaison TEXTUELLE (voir note de tête).
ALTER TABLE "checklist_point"
  ADD CONSTRAINT "checklist_point_choix_reserve_a_choix_dans_une_liste" CHECK (
    CASE
      WHEN "type_reponse"::text = 'choix_dans_une_liste'
        THEN cardinality("choix") > 0
         AND cardinality("choix") = cardinality(ARRAY(SELECT DISTINCT "c" FROM unnest("choix") AS "c"))
      ELSE cardinality("choix") = 0
    END
  );

COMMENT ON COLUMN "checklist_point"."choix" IS
  'Les choix proposés — choix_dans_une_liste SEULEMENT (contrainte checklist_point_choix_reserve_a_choix_dans_une_liste, 9K18-CHECKLIST-DOMAINE) : vide par défaut et pour tout autre type ; non vide et sans doublon exigé pour choix_dans_une_liste.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. `checklist_reponse.valeur_choix` / `valeur_texte` — DEUX COLONNES NEUVES
--    ET L'EXCLUSIVITÉ REPOSÉE SUR LES CINQ
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "checklist_reponse"
  ADD COLUMN "valeur_choix" text,
  ADD COLUMN "valeur_texte" text;

-- Borne de longueur raisonnable (9K18-CHECKLIST-DOMAINE) — même plancher que
-- les autres colonnes recopiées de ce lot : non vide quand présente, et pas
-- au-delà de ce qu'une saisie plausible sur un point peut porter.
ALTER TABLE "checklist_reponse"
  ADD CONSTRAINT "checklist_reponse_valeur_choix_non_vide" CHECK (
    "valeur_choix" IS NULL OR btrim("valeur_choix") <> ''
  ),
  ADD CONSTRAINT "checklist_reponse_valeur_texte_bornee" CHECK (
    "valeur_texte" IS NULL
    OR (btrim("valeur_texte") <> '' AND length("valeur_texte") <= 2000)
  );

-- REPOSÉE sur les CINQ colonnes — même contrainte, même nom, un ALTER
-- TABLE ... DROP puis ADD plutôt qu'une migration déjà appliquée réécrite.
ALTER TABLE "checklist_reponse" DROP CONSTRAINT "checklist_reponse_valeur_unique";
ALTER TABLE "checklist_reponse"
  ADD CONSTRAINT "checklist_reponse_valeur_unique" CHECK (
    num_nonnulls(
      "valeur_conforme", "valeur_mesuree", "valeur_fait", "valeur_choix", "valeur_texte"
    ) = 1
  );

COMMENT ON COLUMN "checklist_reponse"."valeur_choix" IS
  'choix_dans_une_liste — un des choix du point au moment de la réponse (vérifié par le dépôt, 9K18-CHECKLIST-DOMAINE). Exclusivité : checklist_reponse_valeur_unique.';

COMMENT ON COLUMN "checklist_reponse"."valeur_texte" IS
  'texte_libre — bornée par checklist_reponse_valeur_texte_bornee (9K18-CHECKLIST-DOMAINE). Exclusivité : checklist_reponse_valeur_unique.';
