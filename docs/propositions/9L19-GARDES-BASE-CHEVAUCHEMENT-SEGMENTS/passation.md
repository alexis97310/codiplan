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

## Reprise 9L19SA (20/11/2026)

9L19 était recalé deux fois sur la même cause : `pnpm db:seed` échouait contre la base jetable
migrée, à l'amorçage des e2e. Les gardes étaient justes ; les données de démonstration et deux
fixtures e2e, elles, ne les respectaient pas.

### Report et renumérotation

Les six commits de la branche `9L19S-GARDES-BASE-CHEVAUCHEMENT-SEGMENTS-garde` ont été reportés
(cherry-pick) sur `origin/main` actuel, sans en retirer ni en modifier le contenu. Deux conflits,
les deux venant de `9L27-PLANCHER-JAMAIS-ZERO` (publié entre-temps) :

- `lib/db/migrations-attendues.ts` — les deux entrées cohabitent, dans l'ordre chronologique.
- `docs/arbitrages.md` — **D275 était pris par 9L27** ; l'arbitrage de ce lot devient **D276**,
  renuméroté partout où il était nommé (le fichier lui-même, cette passation).
- La migration a été **renommée** `20261120010000_…` → `20261120120000_…` (contenu inchangé),
  horodatage strictement postérieur à celle de 9L27 (`20261120113000_…`) — toutes ses références
  mises à jour (`lib/db/migrations-attendues.ts`, `scripts/lib/resserrements-migration.ts`, son
  gardien, `README.md`, `docs/arbitrages.md`).

### Point 1 (reprise) — le seed de démonstration

`pnpm db:seed`, rejoué contre une base jetable migrée (procédure de `tests/e2e/setup/base.ts`),
cassait en deux endroits distincts, les deux dans les données de démonstration, jamais dans les
gardes :

1. **L'intervention annulée de démonstration (rang 6) n'avait pas de motif.** `InterventionDemoSeed`
   porte désormais `motifAnnulation`, câblé dans `seed.ts` (`motif_annulation`).
2. **Après ce premier correctif, le seed cassait plus loin**, à l'affectation des techniciens :
   `intervention_sans_chevauchement_technicien` refusait quatre doubles réservations (rangs 9/18,
   10/19, 12/17 et 2/8). Cause commune, mesurée précisément (journal temporaire, puis la requête de
   contrôle n°1 ci-dessus sur la base avec la contrainte provisoirement retirée) :
   **`CONTRAT-SITE-1` a ajouté un CINQUIÈME site à CODIMA-NC après que les rangs 17/18/19 ont été
   calés sur une arithmétique d'index à QUATRE sites** — le commentaire qui l'affirmait
   (`prisma/seed-data.ts`, au-dessus du rang 17) a été **corrigé en place, daté**, plutôt que
   supprimé : il affirmait que l'indice 16 retombe sur Ducos, et c'est faux depuis l'ajout du
   cinquième site (`16 % 5 = 1`, pas Ducos — Koné). Les quatre lignes sans récit documenté (rangs 8,
   9, 10, 12) sont décalées matin↔après-midi, même jour, même durée ; les rangs 17/18/19 et leur
   récit horaire n'ont pas bougé. Rejoué deux fois sur une base recréée : vert.

### Point 2 (reprise) — les scènes e2e, même défaut

Les épreuves e2e ciblées (`glisser-deposer.spec.ts`, `planning-annuler-deplacement.spec.ts`,
`planning-filtres-aujourdhui.spec.ts`, `captures-pg-a8-annulees-masquees.spec.ts`) ont révélé le
même défaut dans des fixtures qui n'ont jamais traversé `prisma/seed.ts` :

- **`tests/e2e/setup/scene.ts` pose `SCENE.obstacle` (Ducos, MARDI, 8 h-10 h) et
  `SCENE.chevauchante` (Ducos, MARDI, 13 h-14 h) une fois pour toute la suite.** Six scénarios de
  `glisser-deposer.spec.ts` et un de `planning-annuler-deplacement.spec.ts` posaient leur PROPRE
  intervention exactement sur l'un de ces deux créneaux, pour le même technicien — une double
  réservation réelle qu'aucune assertion ne visait à éprouver, et que rien n'empêchait avant 9L19.
  Chaque créneau concerné est déplacé vers une fenêtre libre du même jour (10 h-11 h le matin, ou
  15 h-17 h l'après-midi), sans toucher à l'intention d'aucun scénario ni à aucune assertion — voir
  le commentaire laissé à chaque site d'appel.
- **`planning-filtres-aujourdhui.spec.ts`** posait ses deux propres interventions (`planifiee` et
  `terminee`) sur le MÊME créneau littéral, pour le même technicien — une collision avec
  elle-même. `creerIntervention` prend désormais l'heure en paramètre.
- **`captures-pg-a8-annulees-masquees.spec.ts`** forgeait deux lignes `annulee` par `INSERT` brut,
  sans motif — même défaut que le seed, point 1. Les deux `INSERT` portent désormais
  `motif_annulation`.
- **Vérifié, pas modifié** : `tests/e2e/interventions-fiche-action-collee-bon.spec.ts` pose une
  ligne `cloturee` par `INSERT` brut sans aucun temps — elle ne porte pas davantage
  `temps_mesure_min`/`temps_valide_par`/`temps_valide_le`, donc tombe dans l'exemption nommée de
  D276 et reste verte sans y toucher.

**Incident sans suite, à savoir** : le tout premier passage de `planning-filtres-aujourdhui.spec.ts`
(avant son correctif) a planté entre ses deux créations, hors de tout `try/finally`, laissant une
ligne orpheline dans la base jetable. Sans conséquence : `playwright test` recrée cette base à
chaque exécution (`tests/e2e/setup/base.ts`, `recreerLaBase`).

**Recherche des localisateurs de la même famille (point 3 du mandat)** : sans objet ici — aucun
écran ni composant n'a changé dans ce lot ni dans 9L19S lui-même (« aucun écran dont le rendu
change » était déjà vrai avant la reprise), donc aucune capture et aucun localisateur à resserrer
pour un écran modifié.

### Épreuves rejouées

Au premier plan, `CI=1 --workers=1` : la quasi-totalité des fichiers `tests/e2e/planning-*.spec.ts`
et `*captures-*planning*`/`*cloture*`/`*annul*`, `tests/e2e/glisser-deposer.spec.ts`,
`tests/e2e/fiche-*.spec.ts`, `tests/e2e/9k09-fiche-cloture-suite-origine.spec.ts`, et
`tests/e2e/tous-les-ecrans-rendent.spec.ts` deux fois (avant et après le dernier correctif) —
tout vert, aucune exception restée non expliquée. `pnpm test:isolation` : 262 fichiers, 2534 tests,
vert. `CI=1 pnpm verify` (format + typecheck + lint + test + test:isolation + build) : vert de bout
en bout (code de sortie 0). `pnpm verify:full` non joué ici — laissé à la file.

**Captures d'écran** : non refaites — aucun écran touché par cette reprise (seed de démonstration,
fixtures e2e, nom de migration, numérotation d'arbitrage). Plusieurs épreuves `captures-*.spec.ts`
régénèrent leurs PNG de documentation à CHAQUE exécution locale, qu'il y ait eu un changement d'écran
ou non (`page.screenshot({path})` sans condition) : les rejouer pour chercher des régressions
d'overlap a mécaniquement touché des fichiers `docs/propositions/*/captures/*.png` sans rapport avec
ce lot — ils ont été restaurés (`git checkout --`) avant chaque commit, jamais committés.

### Migration à jouer, et requêtes de contrôle

Le nom change : **`20261120120000_gardes_chevauchement_segments_9l19`** (au lieu de
`20261120010000_…`). Les quatre requêtes de contrôle en lecture seule, §« Requêtes de contrôle »
plus haut dans cette passation, restent la référence pour la base de production — **Alexis doit les
faire jouer avant la migration** (le pilote les fera jouer sur staging puis production). Elles
n'ont pas changé : seule la démonstration locale avait des lignes en infraction, jamais tenues pour
des faits de production.

### État du dépôt (reprise)

`git fetch origin` : `origin/main` toujours à `845055bed` (aucun commit nouveau depuis le départ de
cette reprise). Travail posé en détaché, sur ce même point de départ — pas de rebase nécessaire.
Arbre propre, aucun push.

## Reprise 9L19SB (21/11/2026)

9L19SA était recalé deux fois sur la même cause (`traces/9L19SA-REPRISE-GARDES-SEGMENTS-verify-*.txt`,
`tickets/recales/9L19SA-REPRISE-GARDES-SEGMENTS.md` — aucun des deux lisible depuis ce worktree,
dossier Windows) : une fois le seed réparé, la vérification indépendante tombait sur des scènes e2e
EXISTANTES qui posaient, pour le même technicien, deux lignes actives (jamais `annulee`) sur un
créneau identique — exactement ce que la garde du chevauchement refuse désormais, à bon droit.

### Report

Les douze commits de la branche `9L19SA-REPRISE-GARDES-SEGMENTS-garde` ont été reportés
(cherry-pick) sur `origin/main` actuel (toujours `845055bed`, aucun commit nouveau depuis le
départ de 9L19SA), sans en retirer ni en modifier le contenu. Quatre fichiers de fixtures
`tests/isolation/*.test.ts` (déjà modifiés depuis par du travail publié entre-temps sur
`origin/main` — 9L14-FIGE-A-LA-CLOTURE) et un conflit sur `docs/arbitrages.md` : **D276 était pris
par 9L14 depuis la reprise 9L19SA** ; l'arbitrage de ce lot devient **D277**, renuméroté partout où
il était nommé. Les quatre fixtures d'isolation ont été fusionnées à la main — l'exemption
`fige_a_la_cloture.exemption` de 9L14 (`SET LOCAL`, transaction) et les colonnes `motif_annulation`/
`temps_valide_min` de 9L19 cohabitent désormais dans chacune, sans qu'aucune des deux décisions
n'ait reculé.

### Point 2 — les scènes e2e, trouvées en rejouant toute la suite

`traces/` n'existe pas dans ce worktree : la suite complète (`pnpm exec playwright test`, 24
cœurs, sans `CI`) a été rejouée pour relever chaque `23P01` moi-même. Dix-sept échecs portaient ce
code, sur 68 au total — le reste, non lié au chevauchement (aucun `23514`/`check_violation`
derrière), a été laissé à cette proportion sans être creusé : du bruit de parallélisme élevé, hors
mandat de ce lot.

Nouvel utilitaire partagé, **`tests/e2e/setup/creneaux.ts`** (`creneauUtc`), pour donner à chaque
ligne sa propre heure sans dupliquer le calcul de date à la main. Neuf scènes corrigées, chacune
posait en réalité DEUX interventions non annulées du même technicien sur le même créneau, dans son
PROPRE amorçage (jamais une course entre fichiers) :

- `9dd-pg-g14c-terrain-transmises.spec.ts` et sa variante `captures-9dd-…` — Planifiée et Affectée
  partageaient `commun.creneau_debut/fin`.
- `9f2-terrain-jours-maquette.spec.ts` — la Planifiée de demain et l'Affectée de demain partageaient
  `creneauDe(demain)`.
- `9i8b2-majoration-affichee.spec.ts` — la clôturée figée (chemin FIGÉ, sans besoin d'un créneau
  précis) partageait le créneau EN PARTIE hors ouverture de la signature (chemin NON figé, lui, en
  a besoin).
- `affichage-materiel.spec.ts` — `AVEC_MACHINE` et `PLANIFIEE_SEULE` partageaient 10 h 30-11 h.
- `registre-ux3-2.spec.ts` — la Planifiée et l'Affectée d'aujourd'hui partageaient
  `creneauDebutAujourdhui`.
- `captures-9cp-pg-g14b-transmettre-groupe.spec.ts`, `captures-9db-retouches-10.spec.ts`,
  `captures-9ct-retouches-5.spec.ts` — une boucle `for (const largeur of [1280, 375])` posait CHAQUE
  itération sur le même créneau que la précédente (une heure par largeur, désormais).
- `captures-9f4h5-terrain-vivant.spec.ts` et `captures-9f4h5b-journee-sans-montant.spec.ts` — même
  patron de boucle, quatre et deux lignes respectivement.

**Deux causes supplémentaires, trouvées en rejouant `CI=1 --workers=1`** (le mode qui compte pour
la porte) sur le même fichier plus `tous-les-ecrans-rendent.spec.ts`, `*planning*`, `*terrain*`,
`offline/*` et les scénarios de 9L19SA :

1. **`affichage-materiel.spec.ts` pose `AVEC_MACHINE` (10 h 30-11 h, Ducos, MARDI) SANS `afterAll` —
   PERMANENTE pour toute la suite**, comme une fixture `SCENE.*`, mais invisible de `scene.ts` :
   9L19SA avait évité `SCENE.obstacle`/`chevauchante`/`redimensionnable`, jamais celle-ci.
   `glisser-deposer.spec.ts` (`chevauchanteId`, cinq scénarios) et
   `planning-annuler-deplacement.spec.ts` (son premier scénario) empruntaient le même créneau —
   déplacés hors du creux contesté (11 h 30-12 h 30 pour les premiers, 16 h-17 h pour le second,
   libre aussi bien MARDI que MERCREDI, sa destination). `PLANIFIEE_SEULE`
   (`affichage-materiel.spec.ts`), qui n'apparaît jamais sur la grille, est sortie du creux
   entièrement (7 h-7 h 30, avant toute ouverture).
2. **Deux scénarios de `glisser-deposer.spec.ts` créaient leurs deux interventions (obstacle +
   chevauchante) AVANT le `try`** : si la seconde création échouait — ce que la nouvelle garde
   permet désormais, et qui n'arrivait jamais avant elle —, la première n'était jamais retirée,
   polluant le scénario suivant qui viserait le même créneau. Les deux créations sont maintenant
   DANS le `try`, avec un nettoyage conditionnel (`if (id !== undefined)`) dans le `finally`.

**Trois motifs d'annulation manquants, trouvés par les mêmes rejeux** — le point 3 du mandat de
9L19 (motif/temps à l'`INSERT`, une trentaine de fichiers) n'avait pas touché
`9dd-pg-g14c-terrain-transmises.spec.ts`, sa variante `captures-9dd-…`, `captures-tpa6.spec.ts`, ni
les deux `UPDATE` de `offline/9f4h3-mode-avion.spec.ts` et `offline/9f4h3a-file-sans-perte.spec.ts`
— hors territoire du chevauchement, mais bloquant la vérification sans être corrigés. Un motif non
vide, sans rapport avec ce qu'aucune de ces épreuves asserte, leur a été ajouté.

**Un dernier motif, trouvé par `pnpm test:isolation`** : `tests/isolation/fige-a-la-cloture.test.ts`
(créé par 9L14, postérieur au cherry-pick qui avait corrigé le point 3 de 9L19) posait sa fixture
`jetable("annulee")` sans `motif_annulation` — même cause, même correctif.

**Aucune assertion retirée ni élargie.** Aucune règle de gestion changée. Aucune exemption de la
garde utilisée.

**Recherche des localisateurs de la même famille (point 3 du mandat)** : sans objet — aucun écran
ni libellé n'a changé dans ce lot, seuls des amorçages de fixtures et deux commentaires de
documentation.

### Épreuves rejouées

`CI=1 --workers=1` sur les 84 fichiers relevés (les neuf scènes corrigées, `glisser-deposer.spec.ts`,
tous les `*planning*.spec.ts`, tous les `*terrain*.spec.ts`, `offline/*.spec.ts`,
`tous-les-ecrans-rendent.spec.ts`) : quatre passages successifs, chacun réduisant le nombre
d'échecs (17 → 7 → 3 → 0) à mesure que chaque cause réelle était nommée plutôt que supposée. Dernier
passage : **337 passed, 0 failed** (17.0 min). `pnpm test:isolation` : 263 fichiers, 2543 tests,
vert. `CI=1 pnpm verify` (format + typecheck + lint + test + test:isolation + build) : vert de bout
en bout (code de sortie 0). `pnpm verify:full` non joué ici — laissé à la file.

**Captures d'écran** : non refaites — aucun écran touché par cette reprise (fixtures e2e, numéro
d'arbitrage, commentaires). Chaque exécution complète de la suite a régénéré (sans rapport avec ce
lot) des centaines de PNG/PDF de documentation sous `docs/propositions/*/captures/` — restaurés
(`git checkout --`) et les nouveaux non commités supprimés avant chaque commit, jamais committés.

### Migration à jouer, et requêtes de contrôle

Inchangée : **`20261120120000_gardes_chevauchement_segments_9l19`**. Les quatre requêtes de
contrôle en lecture seule, §« Requêtes de contrôle » en tête de cette passation, restent la
référence pour la base de production.

### État du dépôt (reprise)

`git fetch origin` : `origin/main` toujours à `845055bed`. Travail posé sur une branche dédiée,
`9L19SB-REPRISE-GARDES-FIXTURES-E2E`, partant d'`origin/main` — pas de rebase nécessaire. Arbre
propre, aucun push.
