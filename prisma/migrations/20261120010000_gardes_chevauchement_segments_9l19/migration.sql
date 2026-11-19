-- ════════════════════════════════════════════════════════════════════════════
-- 9L19 — QUATRE GARDES EN BASE, DÉCISION D'ALEXIS DU 10/11/2026 (« OK »).
--
-- Quatre règles que seul le TypeScript tenait jusqu'ici — une garantie qui ne
-- vit que dans la couche applicative n'en est pas une (I1, L1-02c). Chacune a
-- son test jumeau : la garde retirée, la faute qu'elle refuse aujourd'hui doit
-- repasser.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. LE CHEVAUCHEMENT D'UN TECHNICIEN — UNE CONTRAINTE D'EXCLUSION, PAS UN
--      DÉCLENCHEUR, ET LA RAISON EST MESURÉE, PAS SUPPOSÉE ──────────────────
--
-- **Un déclencheur `SELECT EXISTS (...)` NE FERME PAS LA COURSE.** Deux
-- planificateurs qui posent chacun une intervention sur le même technicien,
-- au même instant, liraient chacun « aucune voisine » avant que l'autre
-- n'ait validé la sienne — chaque transaction ne voit que son propre
-- instantané. **Mesuré ici même** : sous `FORCE ROW LEVEL SECURITY` et sans
-- contexte de société posé (exactement l'écriture directe, hors application,
-- que cette garde doit aussi tenir), un `SELECT count(*)` rend ZÉRO sur une
-- table qui porte pourtant une ligne — un déclencheur bâti sur ce `SELECT`
-- ne regarderait rien, pour la même raison que `scripts/lib/gardes-
-- migration.ts` documente déjà sur les blocs de garde des migrations. **Une
-- contrainte d'exclusion, elle, est tenue par l'INDEX, sous la ligne des
-- politiques** : la même expérience, rejouée avec une contrainte `EXCLUDE` à
-- la place du déclencheur, refuse la ligne conflictuelle malgré le même
-- aveuglement du `SELECT`. C'est elle qui ferme la course.
--
-- **`btree_gist` est une extension CONTRIB de PostgreSQL, pas un paquet** —
-- aucune ligne de `pnpm`, aucun service externe, aucun coût. Elle est
-- nécessaire pour qu'un index GiST sache comparer `societe_id` et
-- `technicien_id` (deux `uuid`) par ÉGALITÉ, en plus de l'intersection de
-- plage qu'il sait déjà faire nativement. **Déclarée « de confiance »
-- (« trusted ») depuis PostgreSQL 13** : son installation ne réclame pas le
-- superutilisateur, seulement le privilège `CREATE` sur la base — le même
-- que celui qui a permis de créer les tables de ce schéma.
--
-- **`societe_id` fait partie de la clé**, et ce n'est pas une prudence
-- gratuite : `technicien_id` ne porte aucune clé étrangère (I10 n'en promet
-- aucune sur cette colonne, voir le commentaire du chapitre 11), et une
-- contrainte posée sans lui comparerait deux sociétés entre elles — une
-- fuite d'information au travers d'un refus, exactement ce qu'I1 interdit.
--
-- **La plage est `[)`**, bornes incluse-exclue : deux créneaux qui se
-- TOUCHENT ne se chevauchent pas (08:00–10:00 et 10:00–11:00 s'enchaînent),
-- même règle qu'à la pose et au déplacement (`verdictChevauchement`,
-- `lib/interventions/pose.ts`).
--
-- **Le filtre `WHERE` reprend `SANS_OCCUPATION`** (`pose.ts`) : une
-- intervention ANNULÉE ne tient plus de créneau, et ne compte donc pour
-- aucun chevauchement — ni le sien, ni celui des autres.
CREATE EXTENSION IF NOT EXISTS "btree_gist";

ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_sans_chevauchement_technicien"
  EXCLUDE USING gist (
    "societe_id" WITH =,
    "technicien_id" WITH =,
    tsrange("creneau_debut", "creneau_fin", '[)') WITH &&
  )
  WHERE (
    "technicien_id" IS NOT NULL
    AND "creneau_debut" IS NOT NULL
    AND "creneau_fin" IS NOT NULL
    AND "statut" <> 'annulee'
  );

COMMENT ON CONSTRAINT "intervention_sans_chevauchement_technicien" ON "intervention" IS
  'Décision d''Alexis du 10/11/2026 — un technicien ne tient pas deux créneaux qui se recouvrent, même règle qu''à la pose et au déplacement (verdictChevauchement, lib/interventions/pose.ts) : deux créneaux qui se TOUCHENT ne se chevauchent pas, et une intervention ANNULÉE ne compte pas. Une contrainte d''EXCLUSION, et non un déclencheur : elle seule reste vraie sous FORCE ROW LEVEL SECURITY sans contexte de société posé, là où un déclencheur SELECT EXISTS ne regarderait rien (mesuré, voir scripts/lib/gardes-migration.ts) — et c''est elle qui ferme la course entre deux planificateurs concurrents.';

-- ── 2. UN SEGMENT FERMÉ NE SE MODIFIE PLUS ──────────────────────────────────
--
-- *Le compteur fait foi pour le temps* (R5-02, D119), et `temps_mesure_min`
-- est recalculé par somme des segments FERMÉS (`intervention_temps_mesure_
-- du_compteur`, 20260915060000). Mais cette somme n'est recalculée QUE
-- lorsqu'elle est écrite : rien ne refusait de modifier `debut` ou `fin`
-- d'un segment déjà fermé SANS toucher à `temps_mesure_min`, ce qui
-- désynchronise silencieusement le temps mesuré de ce que les segments
-- portent réellement.
--
-- **Seule la fermeture d'un segment ouvert reste permise** : c'est le seul
-- `UPDATE` que l'application écrit (`arreterLeCompteur`, `depot-compteur.ts` ;
-- la branche « Terminer », `depot-rapport-terrain.ts`), toujours conditionné
-- à `fin: null`. Un segment déjà fermé est donc un FAIT clos — le corriger
-- demande une nouvelle ligne, jamais une réécriture de celle qui existe déjà
-- (même famille que I5 : le travail terrain ne se perd ni ne se réécrit).
CREATE OR REPLACE FUNCTION "segment_travail_ferme_non_modifiable"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."fin" IS NOT NULL THEN
    RAISE EXCEPTION
      'Segment de travail fermé : il ne se modifie plus. Le compteur fait foi pour le temps (R5-02, D119) ; une correction s''écrit sur une nouvelle ligne, jamais sur celle déjà close.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "segment_travail_ferme_non_modifiable"
  BEFORE UPDATE ON "segment_travail"
  FOR EACH ROW EXECUTE FUNCTION "segment_travail_ferme_non_modifiable"();

-- ── 3. UNE ANNULATION EXIGE SON MOTIF ───────────────────────────────────────
--
-- *Une annulation n'efface rien* : la ligne reste, son statut change, et le
-- motif est ce qui rend la trace lisible six mois plus tard. `schemaAnnulation`
-- (`lib/interventions/saisie.ts`) l'exige déjà à la saisie — au minimum trois
-- caractères, non vide après coupe des espaces — mais rien ne le tenait en
-- base : une écriture directe pouvait annuler sans un mot.
ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_annulee_a_son_motif"
  CHECK (
    "statut" <> 'annulee'
    OR (
      "motif_annulation" IS NOT NULL
      AND btrim("motif_annulation") <> ''
    )
  );

COMMENT ON CONSTRAINT "intervention_annulee_a_son_motif" ON "intervention" IS
  'Une intervention ANNULÉE porte un motif non vide. schemaAnnulation (lib/interventions/saisie.ts) l''exige déjà à la saisie ; cette contrainte tient la même règle pour toute écriture qui ne passerait pas par lui.';

-- ── 4. UNE CLÔTURE EXIGE UN TEMPS VALIDÉ STRICTEMENT POSITIF, SAUF L'ARCHIVE
--      QUI N'EN PORTE AUCUN — ET C'EST NOMMÉ, PAS DEVINÉ ───────────────────
--
-- `intervention_cycle_de_vie` (20261023073000) refuse déjà la clôture quand
-- `temps_valide_min` est NUL — mais un ZÉRO, ou une valeur NÉGATIVE, passait.
-- `schemaCloture` (`lib/interventions/saisie.ts`) exige déjà `.positive()` à
-- la saisie ; cette contrainte tient la même règle pour toute écriture qui ne
-- passerait pas par lui — une correction par ADV comme une reprise.
--
-- **Sauf qu'une ligne existe déjà qui naît `cloturee` SANS AUCUN temps** :
-- `creerInterventionsRepriseEnLot` (`lib/interventions/depot-reprise.ts`,
-- REPRISE-HISTORIQUE, D127) — « l'archive ne porte pas le temps », par
-- décision déjà écrite là-bas, et `temps_mesure_min`, `temps_valide_min`,
-- `temps_valide_par`, `temps_valide_le` y naissent tous les quatre NULS. Une
-- contrainte qui l'ignorerait casserait une fonctionnalité réelle pour fermer
-- une faute qu'elle ne commet pas.
--
-- **La troisième branche nomme ce cas précisément, elle ne le devine pas**
-- (doctrine d'arbitrage §5 : « chaque élément est couvert, ou exempté
-- NOMMÉMENT avec son motif ») : une clôture est exemptée seulement si AUCUN
-- temps n'a jamais été mesuré NI validé par personne — `temps_mesure_min`,
-- `temps_valide_par` ET `temps_valide_le` tous NULS. Le chemin applicatif
-- normal (`arreterLeCompteur` puis `cloturerIntervention`) pose toujours
-- `temps_mesure_min` avant la clôture (D120) ; cette combinaison des trois
-- NULS ne peut donc naître que d'une écriture directe qui n'emprunte jamais
-- ce chemin — l'archive, ou un jeu d'épreuves qui la rejoue délibérément.
--
-- **Condition de réouverture, vérifiable** : le jour où `depot-reprise.ts`
-- se met à écrire une valeur dans l'une de ces trois colonnes pour une ligne
-- reprise, cette exemption devient trop large pour ce qu'elle visait et doit
-- se refermer sur un signal plus étroit.
ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_cloturee_a_son_temps_valide_positif"
  CHECK (
    "statut" <> 'cloturee'
    OR ("temps_valide_min" IS NOT NULL AND "temps_valide_min" > 0)
    OR (
      "temps_mesure_min" IS NULL
      AND "temps_valide_par" IS NULL
      AND "temps_valide_le" IS NULL
    )
  );

COMMENT ON CONSTRAINT "intervention_cloturee_a_son_temps_valide_positif" ON "intervention" IS
  'Une intervention CLÔTURÉE porte un temps validé strictement positif. schemaCloture (lib/interventions/saisie.ts) l''exige déjà à la saisie (.positive()) ; cette contrainte tient la même règle pour toute écriture qui ne passerait pas par lui. intervention_cycle_de_vie refuse déjà temps_valide_min NUL à la clôture ; cette contrainte referme ce qu''il laissait passer : zéro et le négatif. EXEMPTION NOMMÉE : temps_mesure_min, temps_valide_par ET temps_valide_le tous NULS — la signature de creerInterventionsRepriseEnLot (depot-reprise.ts, D127), qui clôture l''archive SANS AUCUN temps par décision déjà écrite là-bas. Condition de réouverture : le jour où ce chemin se met à poser l''une des trois, resserrer le signal.';
