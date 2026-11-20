# 9L19-GARDES-BASE-CHEVAUCHEMENT-SEGMENTS — passation

Quatre gardes en base, décision d'Alexis du 10/11/2026 (« OK »), arbitrage **D276**
(`docs/arbitrages.md`) — une règle change pour la quatrième garde (l'exemption nommée de l'archive,
voir plus bas). Une seule migration, aucun écran dont le rendu change — aucune capture.

**MIGRATION À JOUER par Alexis : `20261120120000_gardes_chevauchement_segments_9l19` — staging
puis `DB migrate & seed`, puis Vercel.**

## Ce que la migration pose

1. **`intervention_sans_chevauchement_technicien`** — une contrainte d'EXCLUSION (`EXCLUDE USING
   gist`) sur `(societe_id, technicien_id, tsrange(creneau_debut, creneau_fin, '[)'))`, filtrée aux
   lignes actives. Même règle qu'à la pose et au déplacement (`verdictChevauchement`,
   `lib/interventions/pose.ts`) : deux créneaux qui se TOUCHENT ne se chevauchent pas, une
   intervention ANNULÉE ne compte pas.

   **Pourquoi une contrainte d'exclusion et non un déclencheur** : mesuré directement sur ce poste
   (voir l'en-tête de la migration) — un déclencheur `BEFORE INSERT OR UPDATE` avec un `SELECT
   EXISTS` ne ferme PAS la course entre deux planificateurs concurrents. Posé sur une table owned
   par un rôle non superutilisateur, sous `FORCE ROW LEVEL SECURITY` et sans contexte de société
   (exactement l'écriture directe que cette garde doit aussi tenir), un tel `SELECT` rend ZÉRO ligne
   même quand la table en porte une — un déclencheur bâti dessus ne regarderait rien. Rejoué avec
   une contrainte `EXCLUDE` à la place, la MÊME expérience refuse la ligne conflictuelle : elle est
   tenue par l'index, sous la ligne des politiques.

   **Dépendance** : `CREATE EXTENSION IF NOT EXISTS "btree_gist"` — un module CONTRIB de PostgreSQL,
   pas un paquet `pnpm`, aucun coût. Il est nécessaire pour qu'un index GiST compare `societe_id` et
   `technicien_id` par ÉGALITÉ. Déclaré « de confiance » depuis PostgreSQL 13 : son installation ne
   réclame que le privilège `CREATE` sur la base, jamais le superutilisateur — le même que celui qui
   a déjà permis de créer les tables de ce schéma. **Point d'attention pour le déploiement** : si le
   rôle de migration en production ne porte pas ce privilège au niveau de la BASE (distinct du
   privilège de créer des tables dans un schéma), cette ligne échouera avec un message explicite
   (`permission denied to create extension`) — la migration entière échoue alors atomiquement, rien
   n'est appliqué à moitié. Dans ce cas, il faut soit accorder `CREATE` sur la base au rôle de
   migration, soit demander à l'hébergeur d'installer `btree_gist` une fois, en superutilisateur.

2. **`segment_travail_ferme_non_modifiable`** — un déclencheur qui refuse toute modification d'un
   segment déjà FERMÉ (`OLD.fin IS NOT NULL`). Seule la fermeture d'un segment OUVERT reste permise
   — le seul `UPDATE` que l'application écrit (`arreterLeCompteur`, `depot-compteur.ts` ; la branche
   « Terminer », `depot-rapport-terrain.ts`).

3. **`intervention_annulee_a_son_motif`** — `statut = 'annulee'` exige `motif_annulation` non vide.
   `schemaAnnulation` (`lib/interventions/saisie.ts`) l'exigeait déjà à la saisie ; rien ne le tenait
   en base.

4. **`intervention_cloturee_a_son_temps_valide_positif`** — `statut = 'cloturee'` exige
   `temps_valide_min` strictement positif, **SAUF exemption nommée** : `temps_mesure_min`,
   `temps_valide_par` ET `temps_valide_le` tous NULS à la fois — la signature exacte de
   `creerInterventionsRepriseEnLot` (`lib/interventions/depot-reprise.ts`, REPRISE-HISTORIQUE,
   D127), qui clôture l'archive SANS AUCUN temps par décision déjà écrite là-bas. Mesuré en écrivant
   la garde : sans cette exemption, la contrainte casse l'import d'historique — `intervention.test.ts`
   (matrice D8) et `9h1c-numerotation-reprise.test.ts`, `application-import-historique.test.ts`,
   `refus-creation-agence-inactive.test.ts` l'ont montré en échouant. Voir D276 pour le détail et sa
   condition de réouverture.

## Requêtes de contrôle — À LANCER EN PRODUCTION, LECTURE SEULE, AVANT de jouer la migration

Les quatre gardes ont d'abord été vérifiées sur la base de test (`codiplan_test`) : zéro ligne en
infraction. Voici les mêmes requêtes pour la base hébergée. Un résultat non nul sur l'une d'elles
signifie que la migration échouera (contrainte `CHECK`/`EXCLUDE` posée pleinement validée, jamais
`NOT VALID` — voir plus bas pourquoi) ; dans ce cas, s'arrêter et signaler avant de rejouer.

```sql
-- 1. Chevauchement déjà présent (la migration échouerait à la validation)
SELECT a.id AS intervention_a, b.id AS intervention_b, a.societe_id, a.technicien_id
  FROM intervention a
  JOIN intervention b
    ON a.societe_id = b.societe_id
   AND a.technicien_id = b.technicien_id
   AND a.id < b.id
   AND a.statut <> 'annulee' AND b.statut <> 'annulee'
   AND a.creneau_debut IS NOT NULL AND a.creneau_fin IS NOT NULL
   AND b.creneau_debut IS NOT NULL AND b.creneau_fin IS NOT NULL
   AND a.creneau_debut < b.creneau_fin AND a.creneau_fin > b.creneau_debut
 WHERE a.technicien_id IS NOT NULL;

-- 1bis. Un créneau INVERSÉ (fin avant début) ferait échouer la construction
--       du tsrange avec un message Postgres générique, pas le nom de la
--       contrainte — à corriger avant la migration si ça rend une ligne.
SELECT id, creneau_debut, creneau_fin FROM intervention
 WHERE creneau_debut IS NOT NULL AND creneau_fin IS NOT NULL
   AND creneau_fin < creneau_debut;

-- 3. Annulée sans motif (ou motif blanc)
SELECT id, statut, motif_annulation FROM intervention
 WHERE statut = 'annulee'
   AND (motif_annulation IS NULL OR btrim(motif_annulation) = '');

-- 4. Clôturée sans temps validé positif, HORS exemption de l'archive
SELECT id, statut, temps_mesure_min, temps_valide_min, temps_valide_par, temps_valide_le
  FROM intervention
 WHERE statut = 'cloturee'
   AND NOT (temps_valide_min IS NOT NULL AND temps_valide_min > 0)
   AND NOT (temps_mesure_min IS NULL AND temps_valide_par IS NULL AND temps_valide_le IS NULL);
```

**Point 2 (segment fermé) n'a pas de requête de contrôle** : c'est un déclencheur sur `UPDATE`, pas
une contrainte qui relit les lignes existantes — il ne peut rien refuser rétroactivement, seulement
une écriture future. Aucune donnée en place ne peut donc le faire échouer à la pose.

**Aucune des quatre contraintes n'est posée `NOT VALID`** (contrairement à plusieurs contraintes plus
anciennes du dépôt) : les requêtes ci-dessus en sont la condition — si elles rendent toutes zéro
ligne, la migration s'applique sans réserve et vaut pour les lignes anciennes comme pour les
nouvelles dès le premier jour.

## Épreuves

Quatre fichiers neufs sous `tests/isolation/` (`9l19-chevauchement-technicien`,
`9l19-segment-ferme-non-modifiable`, `9l19-annulation-motif-garde`,
`9l19-cloture-temps-valide-positif`) — chacun : un témoin, la faute refusée (avec son jumeau : la
garde retirée, la faute passe), et pour le point 1 une épreuve de **concurrence réelle** (deux poses
simultanées sur le même créneau/technicien via `Promise.allSettled`, deux connexions distinctes du
pool : exactement une des deux réussit). Pour le point 4, un témoin dédié à l'exemption de l'archive
et un témoin qui montre qu'elle ne couvre pas une ligne mesurée à zéro.

`tests/isolation/compteur-du-technicien.test.ts` — un test préexistant attendait une violation
d'unicité (`23505`) en rouvrant un segment fermé ; le nouveau déclencheur du point 2 intercepte
maintenant en premier (même refus, message plus spécifique) : régex d'attente mise à jour, rien
d'assoupli.

**Fixtures corrigées (une trentaine de fichiers sous `tests/isolation/`)** : plusieurs scénarios
préexistants posaient des lignes `annulee` sans motif ou `cloturee` sans temps validé via SQL brut,
pour des raisons sans rapport avec ce ticket (statuts fixes nécessaires à LEUR propre scénario). Deux
des nouvelles gardes (3 et 4) s'appliquent aussi à l'`INSERT`, pas seulement à l'`UPDATE` que garde
`intervention_cycle_de_vie` — ces fixtures ont donc reçu la valeur manquante, sans toucher à aucune
assertion. Un fichier d'amorce historique (`tests/isolation/fixtures/base-agee/
20261022210000_rapport_valide_avant_cloture.sql`) a reçu `temps_valide_min` sur deux lignes `cloturee`
pour la même raison.

## Vérification

`pnpm typecheck`, `pnpm lint`, `pnpm format:check` : propres. `pnpm test` — 537 fichiers, 6020 tests.
`pnpm test:isolation` — 262 fichiers, 2532 tests. `CI=1 pnpm verify` (format + typecheck + lint +
test + test:isolation + build) — vert de bout en bout, exécuté et reconstaté après les derniers
correctifs. Aucune assertion retirée ni élargie, aucun `skip`/`fixme`/`retries` ajouté.
`pnpm verify:full` non joué ici — laissé à la file, comme demandé.

Deux gardiens statiques préexistants ont rougi sur cette migration, et ont été mis à jour à leur
source plutôt que contournés :
- `tests/unit/db/migrations-attendues.test.ts` — `lib/db/migrations-attendues.ts` recevait la
  nouvelle migration.
- `tests/unit/db/resserrements-migration.test.ts` — affirmait qu'`EXCLUDE` n'apparaît nulle part
  dans le dépôt ; inversé en une liste close (« n'apparaît QUE dans... ») plutôt qu'en exemption
  d'arbitrage comme `VALIDATE CONSTRAINT`, parce qu'une contrainte d'exclusion ne rend rien vrai sur
  des lignes déjà posées — `scripts/lib/resserrements-migration.ts` et `README.md` mis à jour pour la
  même raison.

## État du dépôt

`HEAD` était détachée au démarrage, en avance sur `main` (travail des lots `9L26`/`9L26A`). Travail
posé en détaché, commit par commit, sur ce même point de départ. Aucun push.
