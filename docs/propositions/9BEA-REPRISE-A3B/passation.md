# 9BEA-REPRISE-A3B — passation

Reprise de la PARTIE 2/2 de 9BE-PG-G4-SANS-DUREE-HEURE (PG-A3b-HEURE-OBLIGATOIRE), non commencée
sur `main` avant ce lot. PG-A3a et PG-A7 étaient déjà sur `main` (via 9BCA-REPRISE-9BC) et PG-B1
(verdict de lecture, `jugerPose`) était déjà livré par 9BF — vérifié avant d'écrire une ligne.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**Décision QG-4 d'Alexis du 27/09/2026** (`docs/propositions/planning-gmao/decisions-2026-09-27.md`) :
une intervention `planifiee` ou `affectee` ne peut plus devenir une « journée sans heure » par un
simple déplacement. Avant ce lot, le formulaire « Déplacer » de la fiche proposait explicitement de
vider l'heure (« laisser vide pour une journée sans heure ») sur une intervention déjà planifiée,
et rien côté serveur ne le refusait : `statutApresDeplacement` laissait la ligne `planifiee`, avec
une date mais sans créneau ni durée effective.

**Le correctif** — un nouveau verdict pur, `peutGarderHeure` (`lib/interventions/cycle-de-vie.ts`,
juste après `peutPlanifier`, dont le docblock est amendé pour dire la frontière entre les deux) :
pour une intervention `planifiee`/`affectee` dont la date DEMANDÉE reste donnée, l'heure DEMANDÉE
doit l'être aussi (la durée est liée à l'heure par le refine de `schemaDeplacement`, donc juger
l'heure seule suffit) ; sinon, refus nommé `intervention.refus.heure_obligatoire` (« L'heure de
début est obligatoire. »). Vider TOUT (date, heure, durée) reste permis — c'est la remise dans la
file (`a_planifier`).

Branché dans `jugerPose` (`lib/interventions/depot.ts`), juste après `peutPlanifier` et avant les
trois contrôles de pose (calendrier, absence, chevauchement) — une seule source vue par
`deplacerIntervention` (l'écriture) ET par la route `GET .../verdict-pose` (la lecture, PG-B1),
jamais deux lectures d'un même critère.

**Pour l'exploitation** : le formulaire « Déplacer » d'une intervention déjà planifiée refuse
désormais tout dépôt qui garderait la date sans heure ni durée, avec un message nommé et une note
sous les champs (« Pour remettre l'intervention dans la file, videz la date, l'heure et la
durée. »). Le libellé du champ heure perd sa parenthèse trompeuse dans les DEUX blocs de la fiche
(« Planifier » et « Déplacer »).

**Effet de bord découvert et corrigé** : le glisser-déposer en vue Semaine (`pose.tsx`, PG-A7) ne
renvoie l'heure et la durée que si la carte déplacée en porte déjà une — dans le cas contraire, ni
`heure_debut` ni `duree_min` ne partent, et la route les traite comme un créneau qu'on retire.
Concrètement : glisser d'un jour à l'autre une carte `planifiee` SANS heure (un état encore
possible avant ce lot) est désormais refusé, nommé, avant même le calendrier ou le chevauchement.
Deux scénarios de `tests/e2e/glisser-deposer.spec.ts` posaient volontairement ce genre de carte
(`debut: null`) pour tester autre chose (déplacement accepté, jour fermé) ; adaptés pour poser un
créneau existant, cohérent avec `tests/e2e/planning-semaine-garde-heure.spec.ts` (PG-A7, déjà
écrit en connaissance de QG-4).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- `pnpm test` (unitaires) : 300 fichiers, 3120 tests, tous verts (dont les 5 nouveaux de
  `peutGarderHeure` dans `tests/unit/interventions/cycle-de-vie.test.ts`).
- `pnpm test:isolation` : 133 fichiers, 1275 tests, tous verts — dont, dans
  `tests/isolation/verdict-pose-lecture.test.ts` : le cas synthétique existant
  (« PLANIFIÉE SANS DURÉE ») ADAPTÉ (son motif attendu passe de
  `intervention.refus.planifiee_sans_duree` à `intervention.refus.heure_obligatoire`, QG-4
  s'exécutant avant PG-A4 dans `jugerPose`), UN cas synthétique neuf pour vérifier que
  `peutEcrireSansDuree` reste atteignable dans `jugerPose` (affectée grand-père, tout vidé), et
  DEUX cas neufs sur une ligne réellement écrite (date gardée/heure vidée → refus ;
  tout vidé → remise dans la file, vérifiée par une relecture de `statut`).
- `tests/e2e/pg-a3b-heure-obligatoire.spec.ts` (6 tests, scène `PGA3B-`) : vert — libellé sans
  parenthèse (bloc Planifier), note de remise en file (bloc Déplacer), refus nommé, remise dans la
  file.
- `tests/e2e/glisser-deposer.spec.ts` + `tests/e2e/planning-semaine-garde-heure.spec.ts` : 9 tests,
  tous verts après adaptation des deux fixtures.
- `CI=1 pnpm verify:full` (format, typecheck, lint, test, test:isolation, build, feries:horizon,
  audit:partitions, test:e2e) : **vert, code de sortie 0** — 551 tests e2e passés, 3 sautés, 0
  échoué. Joué deux fois (la première a débusqué la régression sur `glisser-deposer.spec.ts`,
  corrigée avant la seconde).
- Captures AVANT (commit `940cc53`, via `git worktree`) / APRÈS (commit `f6fa091`) des blocs
  Planifier et Déplacer, à 1280 et 375 px : `docs/propositions/PG-A3b-HEURE-OBLIGATOIRE/captures/`.

## Ce que j'ai tranché et pourquoi

- **`peutGarderHeure` juge le statut ACTUEL de la ligne et les valeurs DEMANDÉES**, pas l'état
  après écriture (contrairement à `peutEcrireSansDuree`) : pour ce cas précis les deux coïncident
  toujours, `statutApresDeplacement` ne changeant un statut `planifiee`/`affectee` que si date ET
  créneau sont TOUS DEUX vidés — exactement le cas que ce verdict laisse passer. Juger sur les
  valeurs demandées, avant tout appel réseau, permet de le placer tôt dans `jugerPose` (avant
  `verdictALaPose`), comme `peutPlanifier`.
- **Réutilisation de la clé `intervention.refus.heure_obligatoire`**, déjà créée par PG-A3a pour
  un refus de forme (le refine « une heure et une durée, ou rien » de `schemaDeplacement`, quand
  une durée arrive sans heure). Le motif affiché est le même des deux côtés de l'écran (« l'heure
  manque ») ; le commentaire du dictionnaire est réécrit pour dire les deux gardes distinctes qui
  rendent ce même message.
- **`peutEcrireSansDuree` (PG-A4) n'est pas retirée** : elle reste la seule garde pour les
  appelants qui ne passent pas par un déplacement complet (`affecterTechnicien`,
  `enregistrerNoteInterne`, `marquerVuParTechnicien`), et pour le seul cas encore atteignable dans
  `jugerPose` — une AFFECTÉE grand-père (sans durée) dont TOUT est vidé : `statutApresDeplacement`
  ne la remet pas dans la file (contrairement à une PLANIFIÉE), donc PG-A4 la bloque encore. Testé
  explicitement pour que ce chemin ne devienne pas du code mort sans que personne ne le sache.
- **Adapter `glisser-deposer.spec.ts` plutôt que le contourner.** Les deux fixtures cassées
  posaient délibérément une carte `planifiee` sans créneau pour tester le déplacement lui-même
  (accepté / refusé pour jour fermé), pas la règle « journée sans heure » — leur donner un créneau
  existant (08:00, dans les plages de Koné) ne change rien à ce qu'elles éprouvent réellement.
- **Captures de comportement séparées des captures d'apparence.** Le spec de capture
  (`captures-pg-a3b-heure-obligatoire.spec.ts`) n'affirme AUCUN texte neuf par son nom de clé
  (`fr["intervention.deplacement.vider_pour_la_file"]` n'existe pas avant ce lot et casserait le
  typecheck du build sur l'ancien code) — il capture seulement. Le comportement (refus, remise en
  file, textes neufs) est éprouvé par le spec comportemental
  `pg-a3b-heure-obligatoire.spec.ts`, jamais rejoué sur l'ancien code.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix — conforme aux interdits.
- Je n'ai pas touché `statutApresDeplacement` (`depot.ts`) : son asymétrie PLANIFIÉE/AFFECTÉE sur
  un vidage complet (une PLANIFIÉE retombe `a_planifier`, une AFFECTÉE reste `affectee`) est
  antérieure à ce lot et hors de son territoire ; je m'en sers pour raisonner, je ne la change pas.
- Je n'ai pas ajouté de cas de test pour « une AFFECTÉE normale (avec durée), tout vidé » — seul le
  cas grand-père (sans durée) est testé, car c'est le seul qui distingue `peutEcrireSansDuree` de
  `peutGarderHeure` dans `jugerPose` ; une AFFECTÉE normale tout-vidée est déjà couverte par la
  garantie générale (`peutGarderHeure` permet, `peutEcrireSansDuree` permet aussi puisque sa durée
  n'est pas nulle).
- Je n'ai pas modifié `tests/e2e/setup/scene-glisser.ts` au-delà d'un commentaire : `debut: null`
  reste possible pour poser une ligne qu'on ne déplace pas.
- Je n'ai pas touché aux fichiers PNG/PDF de captures préexistants que `pnpm verify:full` a modifiés
  en cours de route (contenu binaire différent à chaque exécution, sur des tickets sans rapport) —
  restaurés par `git checkout --` avant chaque commit, jamais ajoutés ni commités.

## Les pièges pour la session suivante

- **QG-4 s'exécute AVANT PG-A4 (`peutEcrireSansDuree`) dans `jugerPose`.** Toute nouvelle garde
  ajoutée dans `jugerPose` pour un statut `planifiee`/`affectee` doit être positionnée en gardant à
  l'esprit cet ordre : `peutDeplacer` → `peutPlanifier` → `peutGarderHeure` → `verdictALaPose` →
  `peutEcrireSansDuree`.
- **`pose.tsx` (PG-A7) ne renvoie heure/durée QUE si la carte déplacée en porte déjà une.** Toute
  fixture e2e qui pose une intervention `planifiee` SANS créneau (`debut: null` dans
  `poserInterventionGlisser`) et la déplace ensuite en vue Semaine sera désormais refusée pour
  `heure_obligatoire` — sauf si c'est exactement ce que le scénario veut éprouver.
- **`pnpm verify:full` modifie des PNG/PDF de captures sans rapport avec le lot en cours** (mesuré
  deux fois, mêmes ~85 fichiers à chaque exécution complète). Toujours vérifier `git status`
  après, et `git checkout --` ce qui n'appartient pas au lot avant de commiter.

## Ce qui reste à faire

Rien côté PG-A3b : la partie est complète, testée, capturée et vérifiée par `verify:full` vert.
PG-B3-TROUVER-CRENEAU-FICHE (mentionné dans la passation de 9BF) reste bloqué sur PG-B2-FENETRE-POSE,
non livré — hors territoire de ce lot.
