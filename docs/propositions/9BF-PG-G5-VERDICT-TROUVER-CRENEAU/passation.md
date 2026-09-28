# 9BF-PG-G5-VERDICT-TROUVER-CRENEAU — passation

Ticket regroupé, deux parties : **PG-B1-VERDICT-LECTURE** (faite, commitée) et
**PG-B3-TROUVER-CRENEAU-FICHE** (non faite — bloquée, voir plus bas).

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**PG-B1-VERDICT-LECTURE** (commit `PG-B1-VERDICT-LECTURE — verdict de pose en
lecture seule`) :

- `lib/interventions/depot.ts` — extrait `jugerPose` (exportée), qui porte
  exactement ce que `deplacerIntervention` jugeait avant écriture :
  `peutDeplacer`, `peutPlanifier`, `verdictALaPose` (ouverture, habilitations,
  absence, chevauchement) et `peutEcrireSansDuree` (garde PG-A4). Aucune
  écriture dans `jugerPose` — elle rend `{ verdict, demande, statutApres,
  avertissements }`, et `deplacerIntervention` s'appuie dessus au lieu de
  recopier les quatre contrôles.
- `lib/interventions/creneaux.ts` (neuf, module pur) — les débuts de créneau
  possibles pour un technicien, un jour et une durée : dans les plages
  ouvertes du calendrier de l'AGENCE (jamais celui du technicien), au pas du
  calendrier, sans chevauchement avec ses interventions du jour, hors
  absence, hors passé quand le jour visé est aujourd'hui.
- `app/api/interventions/[id]/verdict-pose/route.ts` (neuf) —
  `GET .../verdict-pose?technicien=&date=&heure=&duree=`, même capacité
  (`modifier_planning`) que `POST .../deplacer` (les autres : 403), aucune
  écriture. Rend `{ verdicts: [{cle, bloquant}], creneaux: [...ISO] }`. Le
  verdict n'existe que si les QUATRE valeurs sont fournies (un candidat
  précis à juger) ; les créneaux n'exigent que technicien + date + durée.

**Pour l'exploitation** : rien de visible aujourd'hui — cette route n'a aucun
appelant côté écran tant que PG-B2 (la fenêtre de pose) n'existe pas. C'est
une fondation pour PG-B2 et PG-B3, pas une fonctionnalité livrée seule.

**PG-B3-TROUVER-CRENEAU-FICHE : PAS FAITE.** Voir « Ce que je n'ai pas fait ».

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- `pnpm test` (unitaires) : 297 fichiers, 3092 tests, tous verts — y compris
  `tests/unit/auth/porte.test.ts` mis à jour (65 routes gardées, contre 64
  avant ce lot : `verdict-pose` y entre avec `modifier_planning`).
- `pnpm test:isolation` : 132 fichiers, 1268 tests, tous verts, dont les 7
  nouveaux de `tests/isolation/verdict-pose-lecture.test.ts` (acceptée,
  férié chômé, hors heures, absence, chevauchement, habilitation bloquante,
  planifiée sans durée).
- `CI=1 pnpm verify` (format, typecheck, lint, test, test:isolation, build) :
  vert, code de sortie 0.
- `pnpm feries:horizon` : vert (12+ mois d'avance, 2 territoires).
- `pnpm audit:partitions` : vert (préventif et détectif).
- `CI=1 pnpm exec playwright test tests/e2e/tous-les-ecrans-rendent.spec.ts
  tests/e2e/ecrans-largeur-utile.spec.ts tests/e2e/coque-375.spec.ts` :
  51 passed, 3 skipped, 0 failed (3.0m). Aucun spec planning/fiche/terrain
  ajouté à la liste : PG-B1 ne touche aucun écran (route API + lib pures).

## Ce que j'ai tranché et pourquoi

- **`verdicts` n'existe que pour un candidat COMPLET** (technicien + date +
  heure + durée). Sans heure, il n'y a rien de précis à juger — seulement des
  trous à montrer (les créneaux). Les sept cas requis par le ticket sont tous
  des candidats complets ; je n'ai pas inventé de verdict partiel pour un
  candidat incomplet, faute de règle métier écrite pour ce cas.
- **Le « pas » des créneaux vient de `calendrier.pas_creneau_minutes`**, lu
  par une requête dédiée dans la route (`chargerCalendrierAgence` ne le porte
  pas — il ne porte que les plages et les jours particuliers). Je n'ai pas
  étendu `chargerCalendrierAgence` (hors territoire du ticket,
  `lib/calendar/agence.ts` n'y figure pas).
- **PLANIFIÉE SANS DURÉE jugée sur une ligne synthétique.** La contrainte
  `intervention_planifiee_a_sa_duree` (PG-A4, `NOT VALID`) refuse toute
  NOUVELLE ligne `planifiee`/`affectee` sans durée — elle ne grand-père que
  les cinq lignes déjà dans cet état en production au 27/09/2026. Il est donc
  IMPOSSIBLE de fabriquer cet état par un INSERT dans la base de test : j'ai
  confronté `jugerPose` à une ligne construite en mémoire (jamais écrite),
  documenté dans l'entête du fichier de test. Ce cas n'a donc pas de jumeau
  « écriture réelle » — et ne peut structurellement pas en avoir tant que la
  contrainte existe.
- **403, pas la double forme JSON/redirection de `/deplacer`.** La route est
  lue par un écran (fenêtre de pose, PG-B2) qui appelle toujours en JSON —
  aucun formulaire HTML brut ne la cible — donc pas de négociation `Accept`
  à porter ici.

## Ce que je n'ai PAS fait

**PG-B3-TROUVER-CRENEAU-FICHE n'a pas été commencée.** Son constat dit
« Après PG-B2 » et ses gestes demandent d'ouvrir « LA MÊME fenêtre de pose
(import, aucune copie) » — `components/planning/fenetre-pose.tsx`. Vérifié
sur `main` à jour (mesure de cette session) : **ce fichier n'existe pas**, et
`components/planning/pose.tsx` est le contexte du glisser-déposer, pas une
fenêtre modale. PG-B2-FENETRE-POSE (le ticket qui la crée) n'a pas été livré
avant celui-ci.

Écrire le bouton « Trouver un créneau » sans la fenêtre à ouvrir aurait exigé
soit de la fabriquer moi-même (PG-B2 tout entier, hors territoire de PG-B3 —
`components/planning/fenetre-pose.tsx` n'y figure pas), soit de la copier en
miniature dans la fiche (exactement ce que « aucune copie » interdit). Aucune
des deux options n'est un raccourci acceptable : la première invente un
ticket entier sans le cadrer, la seconde recrée le risque de divergence que
ce lot vient de fermer côté serveur. J'ai donc arrêté PG-B3 avant d'écrire une
ligne, conformément à la règle du regroupement (§3 de l'en-tête du ticket) :
un constat faux sur `main` se documente, il ne s'invente pas — et ici la
partie suivante annoncée (« Après PG-B2 ») n'est simplement pas là.

## Les pièges pour la session suivante

- **PG-B2-FENETRE-POSE doit être livré avant PG-B3.** Vérifier
  `components/planning/fenetre-pose.tsx` existe avant de rouvrir PG-B3.
- **`jugerPose` et `creneaux.ts` sont prêts à l'emploi** pour PG-B2 : la route
  `GET .../verdict-pose` rend déjà `{ verdicts, creneaux }` dans la forme que
  la spécification §3.10 décrit (créneaux en ISO, verdicts en `{cle,
  bloquant}`). PG-B2 n'a qu'à les consommer, pas à les recalculer.
- **`ROUTE_CAPACITE` dans `tests/unit/auth/porte.test.ts`** est une liste
  fermée dans les deux sens : toute route neuve qui appelle `exigerCapacite`
  doit y gagner une ligne ET faire avancer le compte (`toBe(65)` désormais).
  Je l'ai mis à jour pour `verdict-pose` ; la prochaine route neuve devra
  faire pareil.
- **`avecContexteApplicatif` ouvre et commit une vraie transaction** — il n'y
  a pas de mécanisme générique de « transaction annulée » réutilisable entre
  deux appels séparés (`jugerPose` d'un côté, `deplacerIntervention` de
  l'autre : deux connexions, deux transactions). Le fichier de test nettoie
  donc par suppression explicite en `afterEach`, comme le reste de la suite
  d'isolation — je n'ai pas tenté d'imbriquer un vrai `ROLLBACK` autour des
  deux appels, Prisma ne le permet pas proprement ici (voir l'entête du
  fichier de test pour le détail du raisonnement).

## Ce qui reste à faire

- **PG-B2-FENETRE-POSE** (composant `components/planning/fenetre-pose.tsx`,
  et le rebranchement du dépôt/bouton « Poser » du planning) — préalable
  obligatoire à PG-B3.
- **PG-B3-TROUVER-CRENEAU-FICHE**, dans son intégralité, une fois PG-B2 posé :
  bouton « Trouver un créneau » dans les blocs Planifier/Déplacer de la
  fiche, repli du formulaire existant sous « Saisir à la main », e2e neuf,
  captures avant/après à 1280 et 375 px.
