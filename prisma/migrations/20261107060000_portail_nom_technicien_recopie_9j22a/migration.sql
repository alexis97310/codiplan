-- ═══════════════════════════════════════════════════════════════════════════
-- 9J22A-REPRISE-9J22 — LE NOM DU TECHNICIEN EST RECOPIÉ SUR `segment_travail`,
-- LÀ OÙ LE CLIENT LE LIT DÉJÀ ; LA POLITIQUE PORTAIL SUR `utilisateur` EST
-- RETIRÉE.
--
-- Décision d'Alexis (07/11/2026 ~12:15), sur la passation de 9J22 elle-même :
-- la restriction aux colonnes `{id, nom}` d'`utilisateur` ne tenait que par la
-- discipline du seul appelant (`lib/auth/annuaire.ts`), jamais par la base —
-- un contexte client pouvait lire en base TOUTE la ligne `utilisateur` d'un
-- technicien de ses interventions (adresse électronique notamment), ce que le
-- contrat de 9J22 interdisait nommément.
--
-- La correction n'élargit ni ne réécrit la politique de 9J22 : elle RETIRE la
-- porte sur `utilisateur` et déplace ce dont le bon a réellement besoin — un
-- nom affiché, rien d'autre — sur la ligne que la politique « filiation »
-- de `segment_travail` (inchangée, posée par 9J22) rend déjà visible au
-- client. Un segment, un technicien : la colonne est remplie UNE FOIS, à la
-- naissance du segment (`lib/interventions/depot-compteur.ts`), par le code
-- applicatif qui connaît déjà l'identité de son auteur sous un contexte
-- interne — jamais par une politique RLS qui ne sait pas border des colonnes.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. LA COLONNE, D'ABORD SANS CONTRAINTE ─────────────────────────────────
--
-- NULLABLE à la naissance : la table porte déjà des lignes, et aucune ne
-- porte encore ce nom. La backfiller AVANT de poser NOT NULL est le seul
-- ordre qui n'invente rien (CLAUDE.md §8).

ALTER TABLE "segment_travail" ADD COLUMN "nom_technicien_affiche" TEXT;

-- ── 2. LA REPRISE DE DONNÉES — LES DEUX TABLES LUES SONT CLOISONNÉES ───────
--
-- Le backfill lit `utilisateur` (le nom d'origine) pour écrire `segment_
-- travail` (la recopie) : LES DEUX portent `FORCE ROW LEVEL SECURITY`
-- (L1-02c pour l'une, R5-02/D94 pour l'autre). Sur la base hébergée, le rôle
-- de migration est propriétaire NON superutilisateur, et une écriture jouée
-- sous `FORCE`, sans contexte société posé, ne verrait ni n'écrirait AUCUNE
-- ligne (L1-02, 07/09/2026 — voir `scripts/lib/gardes-migration.ts`). Le
-- drapeau est donc LEVÉ sur les deux tables pour la durée du backfill, et la
-- levée CONSTATÉE avant d'écrire quoi que ce soit — jamais supposée.

ALTER TABLE "segment_travail" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "utilisateur" NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  "aveugle_segment" boolean;
  "aveugle_utilisateur" boolean;
BEGIN
  SELECT "c"."relforcerowsecurity" INTO "aveugle_segment"
    FROM "pg_catalog"."pg_class" "c"
   WHERE "c"."relname" = 'segment_travail';
  SELECT "c"."relforcerowsecurity" INTO "aveugle_utilisateur"
    FROM "pg_catalog"."pg_class" "c"
   WHERE "c"."relname" = 'utilisateur';
  IF "aveugle_segment" IS DISTINCT FROM false
     OR "aveugle_utilisateur" IS DISTINCT FROM false THEN
    RAISE EXCEPTION
      'Contrôle creux : FORCE ROW LEVEL SECURITY n''a pas été levé sur segment_travail et utilisateur.';
  END IF;
END $$;

UPDATE "segment_travail" "st"
   SET "nom_technicien_affiche" = "u"."nom"
  FROM "utilisateur" "u"
 WHERE "u"."id" = "st"."utilisateur_id";

ALTER TABLE "utilisateur" FORCE ROW LEVEL SECURITY;
ALTER TABLE "segment_travail" FORCE ROW LEVEL SECURITY;

ALTER TABLE "segment_travail" ALTER COLUMN "nom_technicien_affiche" SET NOT NULL;

COMMENT ON COLUMN "segment_travail"."nom_technicien_affiche" IS
  'LE NOM AFFICHÉ DU TECHNICIEN AU MOMENT DU SEGMENT (9J22A-REPRISE-9J22) — une recopie, jamais une relation vers `utilisateur` : le bon du portail (et le bon back-office, par la même composition) le lit ICI, sans jamais ouvrir `utilisateur` à un contexte client. Rempli une seule fois, à la création du segment (`lib/interventions/depot-compteur.ts`) — les segments ne changent jamais d''auteur après coup, et aucune reprise ultérieure n''a donc à le réécrire. AUCUNE AUTRE donnée du technicien n''est portée ici (pas d''adresse électronique, pas de téléphone) : seulement ce qu''un bon affiche déjà.';

-- ── 3. LA BRÈCHE RETIRÉE — `utilisateur` REDEVIENT FERMÉE AU PORTAIL ───────
--
-- Elle n'est RÉTRÉCIE, jamais désactivée : les deux formes d'origine,
-- « désignation » et « rattachement » (L1-02c), restent entières. Seule la
-- TROISIÈME forme que 9J22 avait ajoutée — scopée à `app.client_id`, ouvrant
-- la ligne entière d'un technicien à son client — disparaît. Ce que le client
-- lisait par cette porte (id, nom) est désormais celui que `segment_travail`
-- porte lui-même, à la colonne posée ci-dessus.

DROP POLICY "utilisateur_lecture_filiation_portail" ON "utilisateur";
