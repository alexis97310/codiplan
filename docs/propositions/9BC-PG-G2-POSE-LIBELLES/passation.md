# 9BC-PG-G2-POSE-LIBELLES — passation

Ticket regroupé, trois parties, faites dans l'ordre : PG-A3a-MESSAGES-POSE, PG-A6-LIBELLE-SANS-DUREE,
PG-A7-SEMAINE-GARDE-HEURE. Les trois constats se sont vérifiés sur `main` (aucun n'était « non
reproduit ») ; les trois parties ont donc été codées, testées et commitées.

Commits :

- `54aeab7` PG-A3a-MESSAGES-POSE — le refus du dépôt nomme ce qui manque
- `33f495b` PG-A3a-MESSAGES-POSE — captures avant/apres
- `fc0efb2` PG-A6-LIBELLE-SANS-DUREE — chaque compte dit sa population
- `91c8a47` PG-A6-LIBELLE-SANS-DUREE — empreinte du commit APRES dans le README
- `6c42cf9` PG-A7-SEMAINE-GARDE-HEURE — un déplacement en vue Semaine garde l'heure et la durée
- `7dacc73` PG-A7-SEMAINE-GARDE-HEURE — captures avant/apres

## Ce que j'ai changé

**PG-A3a-MESSAGES-POSE.** Trois façons de manquer un créneau au dépôt affichaient toutes le même
message — « Une intervention dure au moins un créneau. Tirez la poignée... » — qui ne décrit que le
redimensionnement :

- `dureeDe` (`app/(back-office)/planning/page.tsx`) rend `null` plutôt que `?? 0` : une carte sans
  durée connue, déposée en vue Jour, part maintenant SANS `duree_min` au lieu d'un `0` que Zod
  refusait avec le mauvais message. Effet en exploitation : un planificateur qui dépose une
  intervention sans durée voit « L'heure de début et la durée prévue sont obligatoires », pas
  « tirez la poignée ».
- La route `/deplacer` distingue désormais un troisième cas — heure vidée, durée conservée (le
  formulaire « Déplacer » de la fiche, 99S) — avec une clé neuve `intervention.refus.heure_obligatoire`
  (« L'heure de début est obligatoire. »).
- Les champs « Durée » des formulaires « Planifier » et « Déplacer » de la fiche portent `min="1"` :
  un repère côté navigateur, la saisie serveur reste la garantie.
- `intervention.refus.duree_invalide` ne sert plus qu'au redimensionnement — le commentaire de la
  route le dit.

**PG-A6-LIBELLE-SANS-DUREE.** Deux libellés seulement, aucun calcul changé :

- Tuile du tableau de bord : « Planifiées sans durée prévue » → « Sans durée prévue — à planifier
  ou à venir » — elle compte aussi les interventions `a_planifier` (sans `date_planifiee`), pas
  seulement les planifiées.
- Lien du panneau de charge du planning : « Voir les interventions sans durée → » → « Voir celles
  à venir, sans durée → » — il dit désormais qu'il ouvre une population (à venir) différente de
  celle que la phrase juste à côté vient de compter (la semaine affichée, dates passées comprises).

**PG-A7-SEMAINE-GARDE-HEURE.** En vue Semaine, une case ne porte pas de minutes ; le dépôt n'envoyait
alors ni `heure_debut` ni `duree_min`, et la route traitait les deux comme un créneau RETIRÉ — une
intervention planifiée à une heure, déplacée d'un jour à l'autre en vue Semaine, perdait son heure
et sa durée sans que personne ne l'ait décidé. `components/planning/pose.tsx#deposer` renvoie
désormais l'heure et la durée que la carte porte déjà quand la case cible n'en a pas. Effet en
exploitation : glisser une intervention planifiée d'un jour à l'autre dans la vue Semaine ne la
transforme plus en « journée sans heure ».

## Ce que j'ai mesuré (comptes AVANT/APRES)

- PG-A3a, chemin 2 (fiche, « Déplacer », heure vidée) : AVANT « Une intervention dure au moins un
  créneau. Tirez la poignée sous le début du bloc, jamais au-dessus. », APRES « L'heure de début
  est obligatoire. » — captures `docs/propositions/PG-A3a-MESSAGES-POSE/captures/`.
- PG-A6 : tuile AVANT « Planifiées sans durée prévue », APRES « Sans durée prévue — à planifier ou
  à venir » ; lien AVANT « Voir les interventions sans durée → », APRES « Voir celles à venir, sans
  durée → » — captures `docs/propositions/PG-A6-LIBELLE-SANS-DUREE/captures/`.
- PG-A7 : carte du mercredi, après dépôt depuis le mardi, AVANT « PGA7 » (heure disparue), APRES
  « 15:30 PGA7 » (heure conservée) — captures `docs/propositions/PG-A7-SEMAINE-GARDE-HEURE/captures/`.

Toutes les captures AVANT ont été rejouées sur le commit d'avant ce ticket (`a246446` pour PG-A3a,
`33f495b` pour PG-A6, `91c8a47` pour PG-A7) par `git worktree`, jamais reconstruites de mémoire.

**Le contrôle de fin de session**, une seule fois, après les trois parties :

1. `CI=1 pnpm verify` → format:check, typecheck, lint, test (298 fichiers / 3090 épreuves), 
   test:isolation (130 fichiers / 1258 épreuves), build : les six verts. (Deux passages ont buté
   sur un `next build` hors mémoire — voir « pièges » ci-dessous ; le troisième, après un
   `rm -rf .next`, est passé sans y toucher.)
2. `pnpm feries:horizon && pnpm audit:partitions` → deux territoires contrôlés (horizon ≥ 12 mois
   partout) ; 13 partitions couvertes jusqu'à 2027-09, partition par défaut vide — les deux verts.
3. `CI=1 pnpm exec playwright test tests/e2e/captures-pg-a3a-messages-pose.spec.ts
   tests/e2e/captures-pg-a6-libelle-sans-duree.spec.ts tests/e2e/captures-pg-a7-semaine-garde-heure.spec.ts
   tests/e2e/planning-semaine-garde-heure.spec.ts tests/e2e/glisser-deposer.spec.ts
   tests/e2e/deplacer-valeurs-prereplies.spec.ts tests/e2e/avertissements-1.spec.ts
   tests/e2e/intervention-technicien-select.spec.ts tests/e2e/fiche-intervention.spec.ts
   tests/e2e/tableau-de-bord-liens-tuiles.spec.ts tests/e2e/tableau-non-calcule.spec.ts
   tests/e2e/tous-les-ecrans-rendent.spec.ts tests/e2e/ecrans-largeur-utile.spec.ts
   tests/e2e/coque-375.spec.ts tests/e2e/planning-largeur-et-carte.spec.ts
   tests/e2e/planning-cibles-375.spec.ts tests/e2e/fiche-375.spec.ts`
   → **103 épreuves, 100 passées, 3 ignorées (projets hors Chromium), 0 échec.**

## Ce que j'ai tranché et pourquoi

- **`duree_invalide` réservé au redimensionnement.** Le refine de `schemaDeplacement` échoue sur
  `duree_min` dans les deux sens (heure sans durée, durée sans heure) ; j'ai distingué les trois cas
  par les valeurs de `heure`/`duree` côté route plutôt que d'ajouter un champ à la saisie — la forme
  du formulaire ne change pas, seule la LECTURE de son absence se précise.
- **`dureeDe` rend `null`, jamais `0`.** Un `0` se serait lu comme une durée invalide au lieu d'une
  durée absente — la distinction est ce que PG-A3a corrige. `pose.tsx` omet alors `duree_min` du
  corps plutôt que d'envoyer `"0"`.
- **`avecRedimensionnement` plutôt qu'un second champ.** PG-A7 a besoin que `debutMinutes` VOYAGE
  dans le glissé (pour conserver l'heure en vue Semaine) SANS poser la poignée de redimensionnement
  (qui suppose des minutes sur la case cible, absentes en vue Semaine). Un booléen dédié sépare les
  deux usages d'une même valeur plutôt que de dupliquer `debutMinutes` sous deux noms.
- **PG-A6 : aucun changement de critère.** Le ticket le demandait explicitement (« aucun calcul
  changé ») — vérifié en relisant `criteresSansDureeAVenir` et le lien du panneau de charge avant
  d'écrire le test, qui compare les DEUX anciens textes littéraux aux nouveaux pour garantir que la
  seule chose qui change est le libellé.
- **Créneaux des scènes e2e choisis hors des interventions de démonstration.** `reperes.technicienDucos`
  porte déjà des interventions du semis toute la semaine (mesuré en base) ; PG-A7 a d'abord buté sur
  un refus « chevauchement » avec 08:00–10:00, corrigé en choisissant 15:30–16:30 (les horaires
  DUCOS sont 07:30–11:30 et 13:00–17:00, mesurés en base).

## Ce que je n'ai PAS fait

- **PG-A3a** ne touche ni `lib/interventions/saisie.ts` ni `lib/interventions/cycle-de-vie.ts` —
  territoire explicitement exclu, réservé à PG-A3b.
- **Pas d'e2e pour le « chemin 1 »** de PG-A3a (carte sans durée déposée en vue Jour) — le ticket le
  proposait « si la scène s'y prête » (facultatif), et la preuve existe déjà à deux niveaux : un
  test unitaire de la route (`tests/unit/interventions/deplacer-refus-saisie.test.ts`) et un test
  unitaire de `pose.tsx` qui vérifie qu'aucun `duree_min=0` ne part
  (`tests/unit/planning/pose.test.tsx`). Les deux ont été vérifiés rouges sur le code d'avant ce
  ticket avant d'écrire le correctif.
- **PG-A6** ne touche pas au critère `criteresSansDureeAVenir` ni à la population du panneau de
  charge — le ticket réserve leur unification à PG-C2 (onglet « Sans durée »).
- **PG-A7** ne change rien au comportement d'une carte SANS heure connue (`debutMinutes === null`,
  « héritage ») déposée en vue Semaine — elle garde le comportement d'avant ce ticket, réservé à
  PG-A3b et PG-B2 par le ticket lui-même.
- Aucune migration, aucune ligne de semis, aucun prix modifié — conforme aux interdits du ticket.

## Les pièges pour la session suivante

- **`next build` est tombé deux fois en `Ineffective mark-compacts ... JavaScript heap out of
  memory`** pendant cette session — au moins une fois isolé (`pnpm build` seul), une fois dans
  `pnpm verify`, une fois dans le `webServer` de Playwright. La machine a 8-10 Gio libres à chaque
  fois (`free -h` vérifié) : ce n'est pas une saturation système, c'est le tas V8 par défaut du
  worker de vérification de types (~2 Gio) qui est parfois insuffisant. `rm -rf .next` avant de
  relancer a suffi les trois fois — **ce n'est pas un défaut du code de ce lot** (le même `pnpm
  build`, sans rien changer, a réussi puis échoué à des instants différents). Si ça revient, essayer
  `NODE_OPTIONS=--max-old-space-size=4096` avant d'y passer du temps à chercher une régression qui
  n'existe pas.
- **`BlocPosable` porte maintenant `avecRedimensionnement`** (`components/planning/pose.tsx`) — tout
  nouvel appelant qui passe `debutMinutes` pour une raison AUTRE que la poignée de redimensionnement
  (vue Jour) doit y penser, sinon une poignée apparaîtrait dans une vue qui n'a pas de minutes.
- **`reperes.technicienDucos` (guerin@codima.test) est chargé toute la semaine** par le semis de
  démonstration — mesuré en base (`calendrier_plage` de DUCOS : 07:30–11:30 et 13:00–17:00 ; les
  matinées sont occupées du lundi au jeudi). Un nouveau scénario de glisser-déposer sur ce technicien
  doit choisir son créneau après une lecture en base, pas par supposition.

## Ce qui reste à faire

- PG-A3b : le comportement d'une carte SANS heure dans les chemins que PG-A3a et PG-A7 excluent
  explicitement.
- PG-B2 : mentionné par PG-A7 comme second ticket qui traite le cas « carte sans heure » en vue
  Semaine.
- PG-C2 : l'onglet « Sans durée » qui doit unifier les deux populations que PG-A6 s'est contenté de
  NOMMER sans les réconcilier.
