-- ═══════════════════════════════════════════════════════════════════════════
-- D6 — `machine.reference_interne` EST UNIQUE PAR SOCIÉTÉ, LORSQU'ELLE EST
--      PRÉSENTE
-- Décision d'exploitation du 09/09/2026, inscrite le 10/09. Posée le 12/09.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## CE QUE D6 PROMET, ET QUE RIEN NE TENAIT
--
-- Quand la plaque d'une machine est illisible, le technicien saisit
-- `SN-INCONNU-<référence interne>` et la fiche est marquée `complet = false`.
-- D6 dit que cette valeur est **unique par CONTRAINTE** — et la phrase a été
-- précisée le 10/09/2026 après mesure : *« `reference_interne` est SAISIE,
-- texte libre facultatif dans `lib/machines/saisie.ts`, jamais engendrée ni
-- importée ; une valeur saisie par un humain n'est unique par aucune
-- construction. »*
--
-- Le schéma ne portait que `@@unique([societe_id, modele_id, numero_serie])`.
-- **Deux machines d'une même société pouvaient donc porter la même référence
-- interne, donc le même `SN-INCONNU-<réf>`** — le doublon silencieux que D6
-- existe pour supprimer.
--
-- ## POURQUOI L'INDEX EST PARTIEL, ET POURQUOI IL EST EN SQL
--
-- « Lorsqu'elle est présente » est la moitié qui compte : **toutes les machines
-- n'ont pas de référence interne**. Un `@@unique` de Prisma accepterait autant
-- de `NULL` qu'on veut — ce qui n'est pas faux, deux `NULL` étant distincts
-- pour un index unique — mais il ne DIT pas la règle. La clause `WHERE … IS NOT
-- NULL` la dit, et elle n'est pas exprimable dans `schema.prisma`.
--
-- ## LE DÉNOMBREMENT A ÉTÉ FAIT AVANT, ET SON RÉSULTAT EST UNE ABSENCE DE
--    MESURE — PAS UN VERT
--
-- Sur la base de démonstration migrée et semée le 12/09/2026 :
--
--     machine                     →  0 ligne
--     reference_interne NOT NULL  →  0 ligne
--     clés en doublon             →  0
--
-- **Zéro sur zéro n'est pas un résultat** (§4 du protocole de session) : la
-- table est VIDE, et un dénombrement dont la population est vide ne dit rien
-- de la base qui compte. L'inventaire n° 37 rapporte que la base hébergée ne
-- porte elle non plus aucune machine — *je le cite, je ne l'ai pas mesuré : une
-- session ne touche pas la base de production.*
--
-- ## D104 NE S'APPLIQUE PAS ICI, ET CE N'EST PAS UN CHOIX
--
-- D104 pose une contrainte « NOT VALID » quand les lignes antérieures ne
-- peuvent pas être mises en règle. **PostgreSQL n'admet `NOT VALID` que sur les
-- contraintes `CHECK` et `FOREIGN KEY`** : un index unique se construit sur
-- toutes les lignes ou ne se construit pas. Il n'existe donc pas d'état non
-- validé à rendre visible, et rien à inscrire dans
-- `scripts/lib/contraintes-non-validees.ts`.
--
-- **La conséquence est nommée plutôt que tue** : si la base visée portait des
-- doublons, cette migration ÉCHOUERAIT. C'est le bon sens de défaillance —
-- bruyant, réparable par `pnpm db:resoudre`, et jamais silencieux. Le bloc
-- ci-dessous existe pour que le refus soit LISIBLE plutôt que d'être une
-- violation de clé brute.
--
-- ## LE BLOC DE GARDE LIT `machine`, QUI EST SOUS `FORCE ROW LEVEL SECURITY`
--
-- Le rôle de migration en est le propriétaire : sans contexte de société, il
-- verrait **zéro ligne** et le bloc ne refuserait rien tout en paraissant
-- vérifier (§9, 07/09). Le drapeau est levé pour la durée du diagnostic, rendu
-- dans la même transaction, et **le bloc refuse de compter tant que la levée
-- n'est pas CONSTATÉE** — le témoin porte sur le MÉCANISME, jamais sur un
-- décompte, qu'un zéro légitime rendrait muet.

ALTER TABLE "machine" NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  levee boolean;
  cles_en_doublon integer;
BEGIN
  SELECT NOT relforcerowsecurity INTO levee
    FROM pg_class WHERE relname = 'machine';
  IF NOT COALESCE(levee, false) THEN
    RAISE EXCEPTION
      'Le diagnostic de D6 ne peut pas s''exécuter : FORCE ROW LEVEL SECURITY est toujours actif sur « machine », si bien que cette lecture verrait zéro ligne et ne refuserait rien. Le contrôle s''arrête plutôt que de passer à l''aveugle.';
  END IF;

  SELECT count(*) INTO cles_en_doublon
    FROM (
      SELECT 1
        FROM "machine"
       WHERE "reference_interne" IS NOT NULL
       GROUP BY "societe_id", "reference_interne"
      HAVING count(*) > 1
    ) AS doublons;

  IF cles_en_doublon > 0 THEN
    RAISE EXCEPTION
      'D6 refuse de poser l''unicité de « machine.reference_interne » : % référence(s) interne(s) sont portées par plusieurs machines d''une même société. Ce sont exactement les doublons silencieux que D6 supprime, et il faut les arbitrer fiche par fiche — une référence interne désigne un exemplaire, et la machine qui la perd doit en recevoir une autre. Traiter ces fiches, puis rejouer.',
      cles_en_doublon;
  END IF;
END
$$;

ALTER TABLE "machine" FORCE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- L'INDEX
-- ═══════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX "machine_societe_reference_interne_key"
    ON "machine" ("societe_id", "reference_interne")
 WHERE "reference_interne" IS NOT NULL;

COMMENT ON INDEX "machine_societe_reference_interne_key" IS
  'D6 — unique PAR SOCIÉTÉ et LORSQU''ELLE EST PRÉSENTE. Partiel, parce que toutes les machines n''ont pas de référence interne : la clause WHERE dit la règle qu''un @@unique de Prisma tairait. C''est elle qui empêche deux fiches de porter le même SN-INCONNU-<réf>.';
