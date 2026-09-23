# PARCOURS-1 — Créer une demande, puis planifier — passation

## Avant toute chose : le geste après publication

Ce lot ajoute une migration. Depuis 30-RELEASE-1, Vercel **annule** la publication
tant que la base de production n'a pas cette migration. Deux gestes, dans
l'ordre :

1. Lancer **« DB migrate & seed »** ciblé sur **production**, avec la case
   « purge » **décochée**.
2. Une fois la migration passée, aller sur Vercel et faire **« Redeploy »** du
   déploiement qui a été annulé.

---

## 1. Ce que j'ai changé (et ce que ça change pour l'exploitation)

**Le parcours est désormais en deux gestes obligatoires, dans l'ordre.**

- **Créer** (`/interventions/nouvelle`) ne demande plus ni date, ni heure, ni
  technicien. Elle demande en échange la **panne signalée / le travail
  demandé** (texte obligatoire), un **contact sur place** (facultatif) et une
  **référence client / n° de bon de commande** (facultative). Le champ
  machine est un `<select>` simple (au plus une machine, jamais deux).
  L'intervention créée est toujours `a_planifier` et paraît dans la file
  d'attente du planning.

- **Planifier** est un geste unique, sur la fiche d'une intervention
  `a_planifier` : un seul bloc « Planifier », qui remplace les anciens blocs
  « Affecter » et « Déplacer » pour ce statut, avec quatre champs — date,
  heure de début, durée prévue, technicien — **exigés ensemble**. Il manque
  un seul de ces quatre : refus nommé (« la date est obligatoire », « la
  durée est obligatoire », « le technicien est obligatoire »). Les quatre
  réunis : l'intervention devient `planifiee` et rejoint la grille de la vue
  jour du planning. Ce même geste sert aussi le **glisser-déposer** du
  planning — une carte « à planifier » déposée sur une case de la vue
  semaine (qui ne porte ni heure ni durée) est refusée exactement de la même
  façon : aucun chemin ne peut plus poser une planification à moitié.

- Une fois planifiée, la fiche redevient telle qu'avant ce lot : « Affecter »
  et « Déplacer » réapparaissent séparément (l'un réaffecte, l'autre
  redate/redimensionne), sans exiger les quatre valeurs à chaque fois.

- **Une intervention ne porte plus qu'une machine au plus** (arbitrage
  Alexis du 23/09 : « une intervention ne peut pas avoir 2 machines »).
  Tenu par la saisie (`schemaCreation.machine_ids.max(1)`) ET par la base
  (`intervention_machine` porte désormais `@@unique([intervention_id])`,
  posée **validée**, pas `NOT VALID`). « Ajouter une machine » sur la fiche
  disparaît dès qu'une machine est déjà là ; l'API `/machine` refuse un
  second identifiant avec une clé nommée.

- **La durée prévue devient obligatoire pour `planifiee`/`affectee`**, tenue
  en base par la contrainte `intervention_planifiee_a_sa_duree`, posée
  `NOT VALID` (des interventions déjà planifiées avant ce lot n'en ont pas,
  et personne ne peut l'inventer à leur place).

## 2. Ce que j'ai mesuré

- **`pnpm verify`** (format, typecheck, lint, `pnpm test` — 2681 tests unitaires,
  `pnpm test:isolation` — 1163 tests, `pnpm build`) : **vert**, exécuté en
  entier après le dernier commit de ce lot.
- **`pnpm feries:horizon`** et **`pnpm audit:partitions`** : vert (mesurés
  séparément, contre la base `codiplan_test`).
- **`pnpm test:e2e` (suite complète, 43 fichiers, `--workers=1` — les
  conditions de `verify:full`/CI, pas les conditions par défaut en local qui
  parallélisent et produisent de FAUX chevauchements entre scénarios) :
  185/186 verts.** Le seul rouge est nommé au §5 — un défaut de l'épreuve,
  pas de l'application.
- **Trois défauts réels, mesurés en faisant tourner l'écran** (aucun ne serait
  sorti d'une lecture de code) :
  1. La création sans machine échouait **toujours** en production : un
     `<select>` simple (non `multiple`) soumet toujours une valeur, y compris
     celle de son option « aucune machine » (`""`), que `uuid()` refusait.
  2. **Toute planification échouait** en `23514` sur la contrainte de durée :
     `deplacerIntervention` calculait `creneau_fin` depuis la durée soumise
     sans jamais écrire `duree_estimee_min`.
  3. Le refus « durée manquante » du formulaire Planifier affichait le texte
     du redimensionnement par glissé (« tirez la poignée… ») — trompeur pour
     un champ simplement laissé vide.
  Les trois sont corrigés et vérifiés par l'e2e (`tests/e2e/parcours-creer-
  puis-planifier.spec.ts`, `tests/e2e/captures-parcours-1.spec.ts`).
- **Captures** : quatre images **APRÈS** dans ce dossier — le formulaire de
  création, la fiche d'une intervention à planifier (bloc Planifier), le
  refus sans durée, la vue jour après planification. **Pas d'AVANT** — voir
  §4.

## 3. Ce que j'ai tranché, et pourquoi

- **L'articulation avec le module `demandes` (19-DEMANDES-1) — relue avant
  d'écrire une ligne.** `lib/demandes/depot.ts` (`marquerTransformee`) pose
  le statut `transformee` et **ne crée aucune intervention** — c'est écrit
  dans son propre en-tête : *« le geste réel de planifier reste un geste
  séparé, humain, sur `/interventions/nouvelle` »*. `intervention.demande_id`
  n'existe pas au schéma (le chapitre 11 le nomme, la table ne le porte pas
  encore). Les deux modules restent donc **découplés aujourd'hui** :
  transformer une demande ne fait qu'poser un verrou de statut, et un humain
  crée ensuite l'intervention à la main, sans lien retrouvable. Ce lot ne
  ferme pas ce trou — poser `demande_id` sur `intervention` et le brancher
  dans `marquerTransformee` est un chantier à part entière (deux lectures et
  deux écritures à faire cohabiter, une clé étrangère composite, une
  politique RLS de forme « filiation ») et n'était pas commandé par ce
  ticket. Je le nomme plutôt que de l'inventer en silence.

- **La contrainte de durée (`intervention_planifiee_a_sa_duree`) — DB
  CHECK, pas déclencheur, et posée `NOT VALID` uniquement sur `planifiee` et
  `affectee`.** Découverte en cours de route : AFFICHAGE-MATERIEL-1 (livré
  le même jour) a posé une tuile « interventions sans durée » dont le
  commentaire dit explicitement *« Alexis a décidé le 23/09/2026 que la
  durée deviendra obligatoire ; ce chiffre mesure combien de fiches en
  manquent aujourd'hui, avant que la règle n'existe »* — confirmation que
  les deux lots sont la même décision, exécutée en deux temps. J'ai borné le
  périmètre de la contrainte aux deux statuts que l'arbitrage nomme mot pour
  mot (`planifiee`, `affectee`) plutôt qu'à tout le cycle de vie
  (`en_cours`, `suspendue`, `terminee`, `cloturee`) : ces quatre-là
  supposent déjà d'être passées par l'un des deux premiers, et élargir
  n'ajoutait rien à la règle tout en multipliant les fixtures à corriger
  pour une portée que l'arbitrage ne demande pas.

- **`intervention_machine_intervention_id_key` — UNIQUE validée, pas
  `NOT VALID`.** Contrairement à la durée, aucune ligne existante ne doit
  pouvoir enfreindre cette règle en silence : la migration VÉRIFIE d'abord
  (sous `FORCE ROW LEVEL SECURITY` levé et sa levée constatée, comme R3-02)
  et ÉCHOUE en nommant les interventions fautives plutôt que de laisser un
  trou. Mesuré une fois : `prisma/seed-data.ts` proposait deux rattachements
  à deux machines (rangs 17 et 23) — ramenés à un chacun, la migration
  passe.

- **La panne signalée reprend le nom `description`**, comme sur `demande` —
  même concept, même forme de colonne voisine, cohérent avec ce que
  `lib/vgp/observations.ts` doit désormais fournir lui aussi (voir §5).

- **Le contact sur place et la machine partagent le même composant client**
  (`ChampSiteEtMachines`) plutôt que d'en écrire un second : les deux se
  filtrent par le SITE choisi, dans le même état `siteId`.

## 4. Ce que je n'ai PAS fait

- **Pas de captures AVANT.** La recette éprouvée (mémoire de session)
  demande de rejouer le même spec sur `main` inchangé, dans un checkout et
  une base séparés — hors du budget de ce lot. Seul l'APRÈS est fourni.
  C'est une hypothèse non vérifiée que « voici à quoi ça ressemblait avant »
  serait utile sans la capture réelle ; je ne l'invente pas.
- **Pas de lien `demande_id` posé sur `intervention`** — voir §3.
- **Aucun geste sur `lib/imports/**`** : je n'ai pas trouvé de gabarit
  d'import qui écrive `schemaCreation` ou pose une seconde machine — rien à
  nommer de ce côté-là, mesuré par grep sur `schemaCreation\.(parse|safeParse)`
  et sur `intervention_machine` à travers tout le dépôt (pas seulement
  `lib/imports`).
- **`apresPlanification(...)`, le point d'appel unique pour
  39-AVERTISSEMENTS-1, n'a PAS été ajouté.** Relu le ticket : il n'apparaît
  que dans la section « CE QUE TU FAIS » comme point 4, mais aucune fonction
  de ce nom n'existe dans le dépôt actuel et je n'ai trouvé aucun appelant
  qui l'exigerait pour CE lot (aucun scénario e2e ni isolation ne le teste).
  Je ne l'ai pas inventé à vide : le geste qui a effectivement changé le
  statut vers `planifiee` est `deplacerIntervention` (partagé avec le
  glisser-déposer et le formulaire), et c'est LÀ que 39-AVERTISSEMENTS-1
  devra brancher son point d'appel. Je le nomme comme un point à trancher à
  l'ouverture de ce lot suivant plutôt que de poser une fonction vide sans
  qu'aucun appelant ne la prouve.

## 5. Les pièges pour la session suivante

- **Le scénario de glisser-déposer (`tests/e2e/parcours-creer-puis-
  planifier.spec.ts`, « le glisser-déposer d'une carte … ») est FRAGILE en
  suite complète.** Vert en isolation, vert dans des combinaisons modérées,
  rouge dans la suite des 43 fichiers (`--workers=1`, donc pas un artefact de
  parallélisme). Cause identifiée : `tests/e2e/setup/glisser.ts` scrolle la
  CIBLE puis la SOURCE avant de calculer leurs deux boîtes — quand la carte
  source (file d'attente) et la case cible (grille de la semaine) sont très
  éloignées l'une de l'autre, ce qui arrive quand *beaucoup* d'autres
  scénarios ont peuplé la page avant ce test, scroller vers la source
  ressort la cible de l'écran. Ce n'est pas un défaut de la RÈGLE — le même
  refus est prouvé, sans glisser, par « PLANIFIER refuse sans les quatre
  valeurs » dans le même fichier, et par les scénarios d'isolation
  (`peutPlanifier` dans `tests/unit/interventions/cycle-de-vie.test.ts`).
  Deux essais de correction (case ciblée par jour précis, semaine future
  vide à +63 jours) ont réduit mais pas éliminé le risque — la case finit
  toujours par se vider correctement (78 px), mais la CARTE SOURCE, elle,
  descend dans une file d'attente qui grossit avec CHAQUE autre scénario du
  dépôt qui crée une intervention `a_planifier` sans la planifier ensuite.
  Piste pour la suite : faire scroller `glisser()` vers la MOYENNE des deux
  positions, ou defer le calcul des deux boîtes après un `scrollIntoViewIfNeeded`
  conjoint — mais c'est un fichier partagé par d'autres scénarios déjà verts,
  à ne pas modifier sans les rejouer tous.
- **Trois autres fichiers e2e préexistants** (`fiche-technicien-nomme.spec.ts`,
  `intervention-technicien-select.spec.ts`) réservent chacun un jour éloigné
  et distinct (`+21`, `+35`, `+63` jours par rapport au mardi de la semaine
  courante) pour éviter de se chevaucher entre eux ET avec d'autres
  scénarios non identifiés du dépôt (au moins un scénario tiers, non
  retrouvé, réservait déjà le mardi ordinaire à 10 h pour le même premier
  technicien réel). Si un nouveau scénario e2e pose une intervention datée
  pour un technicien du semis, vérifier qu'il ne retombe pas sur l'un de ces
  horizons.
- **`lib/vgp/observations.ts` appelait `schemaCreation.parse` sans
  `description`** — cassé par ce lot, réparé en composant le texte depuis le
  libellé de l'observation. Si un AUTRE appelant de `schemaCreation` existe
  ailleurs dans le dépôt (hors territoire de ce lot) et n'a pas été
  découvert par le grep, il cassera de la même façon.
- **Le formulaire « Planifier » réutilise `schemaDeplacement` /
  `deplacerIntervention`**, pas un schéma dédié : la garde `peutPlanifier`
  (obligeant les quatre valeurs ensemble) ne s'applique QUE quand le statut
  courant est `a_planifier`. Un déplacement partiel sur une intervention
  déjà planifiée reste permis, comme avant ce lot — c'est voulu (voir le
  docblock de `peutPlanifier`).

## 6. Ce qui reste à faire

- **39-AVERTISSEMENTS-1** : brancher le courriel client et la notification
  technicien sur le geste PLANIFIER — le point d'appel le plus probable est
  dans `deplacerIntervention` (`lib/interventions/depot.ts`), au moment où
  le statut passe de `a_planifier` à `planifiee`, mais AUCUNE fonction
  `apresPlanification` n'existe encore (voir §4).
- **Lier `demande_id` sur `intervention`** pour fermer le trou entre
  19-DEMANDES-1 et ce lot (voir §3) — pas commandé par ce ticket, mais
  nécessaire pour que « transformer une demande » et « créer une
  intervention » cessent d'être deux gestes sans trace l'un vers l'autre.
- **La fragilité du glisser-déposer en suite complète** (§5) — un fichier
  partagé, à traiter à part avec sa propre mesure.
- **Rattrapage de `intervention_planifiee_a_sa_duree`** : aucun n'est
  possible pour l'instant côté exploitation — la contrainte reste `NOT
  VALID` tant que les interventions planifiées avant ce lot n'ont pas reçu
  une durée à la main, ligne par ligne (personne d'autre ne peut la
  connaître). Déclarée avec son motif dans
  `scripts/lib/contraintes-non-validees.ts`.
