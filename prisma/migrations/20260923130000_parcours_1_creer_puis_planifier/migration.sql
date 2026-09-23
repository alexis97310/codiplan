-- ═══════════════════════════════════════════════════════════════════════════
-- PARCOURS-1 — CRÉER une demande, puis PLANIFIER : deux gestes, dans cet ordre
-- Arbitrages d'Alexis, 23/09/2026.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## CE QUE CETTE MIGRATION POSE
--
-- 1. Trois colonnes neuves sur `intervention` : la panne signalée ou le
--    travail demandé (`description`, comme sur `demande` — texte OBLIGATOIRE
--    à la création, tenu par `schemaCreation`, jamais par une contrainte de
--    base : les interventions nées avant ce lot n'ont rien à y écrire), le
--    contact sur place (`contact_id`, facultatif, chaîné sur le CLIENT comme
--    `demande.contact_id`) et la référence client / n° de bon de commande
--    (`reference_client`, facultatif, texte libre).
--
-- 2. « UNE INTERVENTION NE PORTE QU'UNE MACHINE AU PLUS. » Posée VALIDÉE,
--    jamais `NOT VALID` : contrairement à la durée ci-dessous, aucune
--    intervention existante ne doit pouvoir violer cette règle en silence —
--    la migration VÉRIFIE d'abord, et ÉCHOUE en nommant ce qu'elle a trouvé
--    plutôt que de poser une contrainte qui ne vaudrait que pour demain.
--    Aucune ligne n'est supprimée par cette migration, dans les deux cas.
--
-- 3. « UNE INTERVENTION NE PASSE AU STATUT PLANIFIÉ/AFFECTÉ SANS SA DURÉE
--    PRÉVUE. » Posée `NOT VALID` (D104) : des interventions déjà planifiées
--    portent aujourd'hui une date et un technicien sans durée — le champ
--    était facultatif avant ce lot —, et personne ne peut inventer la durée
--    qu'elles n'ont pas eue. La contrainte vaut pour toute ligne NOUVELLE ou
--    MODIFIÉE ; l'état non validé est déclaré dans
--    `scripts/lib/contraintes-non-validees.ts` et observé chaque nuit par
--    `pnpm veille`.
--
--    **Le périmètre s'arrête à `planifiee` et `affectee`, mot pour mot ceux
--    que l'arbitrage nomme** — jamais `en_cours`, `suspendue`, `terminee` ni
--    `cloturee` : ces quatre-là supposent déjà d'être passées par l'un des
--    deux premiers, et les élargir n'ajouterait rien à la règle tout en
--    gonflant le nombre de fixtures à mettre à jour pour une portée que
--    l'arbitrage ne demande pas.

-- ── 1. LES TROIS COLONNES ────────────────────────────────────────────────

ALTER TABLE "intervention"
  ADD COLUMN "description"      text,
  ADD COLUMN "contact_id"       uuid,
  ADD COLUMN "reference_client" text;

COMMENT ON COLUMN "intervention"."description" IS
  'PARCOURS-1 — la panne signalée ou le travail demandé. OBLIGATOIRE à la création, tenu par schemaCreation : la colonne reste nullable parce que les interventions nées avant ce lot n''ont rien à y écrire, et personne ne peut composer leur panne à leur place (même famille que D104).';

COMMENT ON COLUMN "intervention"."contact_id" IS
  'PARCOURS-1 — le contact sur place, facultatif. Même forme que demande.contact_id (L2-06) : chaîné sur le CLIENT, pas seulement sur la société.';

COMMENT ON COLUMN "intervention"."reference_client" IS
  'PARCOURS-1 — référence client ou n° de bon de commande, texte libre : le chapitre 10 ne pose aucune forme à ce jour.';

-- La cible existe déjà : `contact_societe_client_id_key`, posée par
-- `20260913140000_demande_l2_06` pour exactement ce chaînage. `contact_id`
-- nullable, `MATCH SIMPLE` : « pas de contact » est le seul état que la
-- nullité produit, jamais une ligne à moitié vérifiée (§9, 23/08).
ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_societe_id_client_id_contact_id_fkey"
  FOREIGN KEY ("societe_id", "client_id", "contact_id")
  REFERENCES "contact"("societe_id", "client_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ── 2. UNE MACHINE AU PLUS PAR INTERVENTION ─────────────────────────────
--
-- *Avant de poser la contrainte, on vérifie qu'aucune intervention n'a déjà
-- deux machines.* Le chapitre 7/M3 permettait « plusieurs lignes machine » ;
-- l'arbitrage du 23/09/2026 le referme. Si des lignes existantes
-- l'enfreignent, cette migration ÉCHOUE en les nommant — elle n'en supprime
-- aucune, et le rattrapage appartient à l'exploitation, pas à une migration
-- automatique qui choisirait pour elle laquelle des deux machines garder.
--
-- **LE DRAPEAU EST LEVÉ POUR LA DURÉE DU CONTRÔLE, RENDU DANS LA MÊME
-- TRANSACTION** (gardien `tests/unit/db/gardes-de-migration.test.ts`, même
-- famille que le rattrapage de R3-02). Le rôle de migration est propriétaire :
-- sans lever `FORCE ROW LEVEL SECURITY`, cette lecture verrait ZÉRO ligne sur
-- la base hébergée et ne refuserait jamais rien — elle ne se tromperait pas,
-- elle ne regarderait rien. La levée est CONSTATÉE avant d'agir, jamais
-- supposée.
ALTER TABLE "intervention_machine" NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  levee                boolean;
  nombre_interventions int;
  liste_interventions  text;
BEGIN
  SELECT NOT relforcerowsecurity INTO levee
    FROM pg_class WHERE relname = 'intervention_machine';
  IF NOT COALESCE(levee, false) THEN
    RAISE EXCEPTION
      'PARCOURS-1 ne peut pas contrôler l''unicité de la machine : FORCE ROW LEVEL SECURITY est toujours actif sur « intervention_machine », si bien que cette lecture verrait zéro ligne — elle ne réparerait rien et ne refuserait rien, tout en paraissant faire les deux. La migration s''arrête plutôt que de passer à l''aveugle.';
  END IF;

  SELECT count(*), string_agg(intervention_id::text, ', ')
    INTO nombre_interventions, liste_interventions
  FROM (
    SELECT "intervention_id"
    FROM "intervention_machine"
    GROUP BY "intervention_id"
    HAVING count(*) > 1
  ) AS doublons;

  IF nombre_interventions > 0 THEN
    RAISE EXCEPTION
      'PARCOURS-1 : % intervention(s) portent déjà plus d''une machine (%). '
      'La contrainte « une machine au plus » ne peut pas se poser sans '
      'perdre une ligne, et cette migration n''en supprime aucune : réglez '
      'ces interventions à la main — retirer les rattachements en trop de '
      '"intervention_machine" — puis rejouez cette migration.',
      nombre_interventions, liste_interventions;
  END IF;
END $$;

ALTER TABLE "intervention_machine" FORCE ROW LEVEL SECURITY;

ALTER TABLE "intervention_machine"
  ADD CONSTRAINT "intervention_machine_intervention_id_key" UNIQUE ("intervention_id");

COMMENT ON CONSTRAINT "intervention_machine_intervention_id_key" ON "intervention_machine" IS
  'PARCOURS-1, arbitrage Alexis du 23/09/2026 : une intervention ne porte qu''une machine au plus. Posée VALIDÉE — la migration a vérifié qu''aucune ligne existante ne l''enfreint avant de la poser, et échoue sinon plutôt que de laisser un trou.';

-- ── 3. LA DURÉE PRÉVUE, OBLIGATOIRE POUR PLANIFIER OU AFFECTER ──────────
--
-- Seuls `planifiee` et `affectee` sont contraints — mot pour mot les deux
-- statuts que l'arbitrage nomme. Tous les autres (`a_planifier`, `en_cours`,
-- `suspendue`, `terminee`, `cloturee`, `annulee`) passent librement : une
-- intervention qui a déjà quitté `planifiee`/`affectee` a nécessairement
-- satisfait la règle en y entrant, et une intervention encore dans la file
-- ou annulée depuis elle n'a rien à prévoir.
ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_planifiee_a_sa_duree" CHECK (
    "statut" NOT IN ('planifiee', 'affectee') OR "duree_estimee_min" IS NOT NULL
  ) NOT VALID;

COMMENT ON CONSTRAINT "intervention_planifiee_a_sa_duree" ON "intervention" IS
  'PARCOURS-1, arbitrage Alexis du 23/09/2026 : une intervention ne passe au statut planifiee/affectee sans sa duree prevue — les deux SEULS statuts contraints, mot pour mot ceux que l''arbitrage nomme. POSEE « NOT VALID » (D104) : des interventions deja planifiees portent une date et un technicien sans duree, ce champ etant facultatif avant ce lot, et personne ne peut inventer la duree qu''elles n''ont pas eue. L''etat non valide est tenu par scripts/lib/contraintes-non-validees.ts et observe chaque nuit par « pnpm veille ».';
