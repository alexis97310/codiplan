# Passation — 9BM-PG-G7-ANNULER-DUREE-CREATION

Ticket regroupé, deux parties : PG-B5-ANNULER-DEPLACEMENT puis PG-B6-DUREE-A-LA-CREATION.
`CI=1 pnpm verify:full` a tourné en entier, en un seul appel, deux fois de suite — vert les deux
fois — après la dernière partie.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**PG-B5-ANNULER-DEPLACEMENT** — un déplacement DIRECT (glisser-déposer, vue Semaine ou Jour) d'une
carte déjà planifiée n'écrit plus tout de suite. Pendant 10 s (délai fixe, décision QG-6 d'Alexis
du 27/09), la carte s'efface de sa case d'origine et un bandeau « Déplacée — <technicien>, <jour> à
<heure> · Annuler » apparaît sur la case visée. « Annuler » revient en arrière SANS AUCUNE requête.
Sans action, une seule écriture part à l'échéance. Si l'onglet se ferme ou navigue ailleurs pendant
le délai, l'écriture part immédiatement (`pagehide` + `navigator.sendBeacon`/`fetch(keepalive)`) —
un déplacement voulu n'est jamais perdu. Pour l'exploitation : un planificateur qui repositionne une
carte plusieurs fois avant de se décider ne fait plus recevoir au client ni au technicien un
courriel par tâtonnement — un seul courriel part, celui du choix final. Le redimensionnement et la
confirmation depuis la fenêtre de pose (« Planifier ») restent immédiats : ni l'un ni l'autre ne
change la date/heure de DÉBUT, donc aucun des deux ne peut jamais déclencher un second courriel
(`avertirApresPlanification` ne compare que date, heure de début et technicien).

**PG-B6-DUREE-A-LA-CREATION** — « Créer une intervention » porte désormais un champ « Durée prévue »
facultatif (puces 30 min à 4 h, ou une valeur libre), SANS AUCUNE valeur cochée par défaut (décision
QG-12 d'Alexis). Choisie, elle s'écrit seule dans `duree_estimee_min` — ni date, ni heure, ni
technicien (PARCOURS-1 tient toujours). Après « Créer », la fiche affiche un bandeau « Intervention
créée. » avec deux choix : « Planifier maintenant » (ouvre `FenetrePose` via `TrouverCreneau`,
réemployée telle quelle, puce de durée déjà présélectionnée si une durée a été choisie) ou « Laisser
dans la file » (comportement d'avant ce ticket — ne rien faire de plus). Pour l'exploitation : un
planificateur qui connaît déjà la durée probable d'une intervention (ex. un préventif répété) n'a
plus à la redécouvrir au moment de planifier, et peut planifier dans la foulée de la création sans
revenir chercher la fiche plus tard.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- PG-B5 : captures AVANT (commit `81b2f98`, immédiat, aucun bandeau) / APRÈS (commit `b212d83`,
  bandeau visible sur la case visée, case d'origine vide) — `docs/propositions/PG-B5-ANNULER-DEPLACEMENT/captures/`.
- PG-B6 : captures AVANT (commit `81b2f98`, aucun champ de durée, aucun bandeau après « Créer ») /
  APRÈS (commit `72fb847`, puces de durée, bandeau « Intervention créée. » avec ses deux choix) —
  `docs/propositions/PG-B6-DUREE-A-LA-CREATION/captures/`.
- `pnpm test` : 3158 tests passés (3150 avant ce lot + 8 nouveaux/modifiés : 5 pour `duree_min`
  dans `schemaCreation`, 3 de mise à jour de `pose.test.tsx` pour le délai).
- `CI=1 pnpm verify:full` (format, typecheck, lint, test, test:isolation, build, feries:horizon,
  audit:partitions, test:e2e) : **vert en entier**, deux fois de suite — 594 tests e2e passés (3
  ignorés, comportement normal), à chaque fois.

## Ce que j'ai tranché et pourquoi

1. **Le mécanisme de délai vit dans `Posable` (pose.tsx), pas dans page.tsx.** Une exploration a
   montré que le rendu des cartes du planning (`VueSemaine`/`VueJour`, `app/(back-office)/planning/page.tsx`,
   2851 lignes) est entièrement composé côté SERVEUR — aucune structure client ne porte la liste
   des interventions pour la « rebucketer » ailleurs. Réécrire ce rendu pour un déplacement
   optimiste complet aurait été une réécriture, pas un ajout. À la place : `BlocPosable` masque la
   carte d'ORIGINE (elle retourne `null` tant qu'un déplacement la concerne) et `CasePosable` affiche
   un bandeau sur la case VISÉE — les deux consultent le contexte `Posable` (`enAttente`), qui
   re-rend déjà tout consommateur du contexte à chaque changement (même mécanisme déjà en place pour
   le survol PG-B4). Aucune ligne de `page.tsx` n'a été touchée.
2. **Redimensionnement et « Planifier » (fenêtre de pose) restent immédiats.** Le premier ne change
   jamais la date/heure de début (`peutPlanifier`/`avertirApresPlanification` ne les comparent QUE
   sur ces deux-là et le technicien) ; le second vient de confirmer un geste explicite dans une
   fenêtre déjà ouverte. Un dispatcheur dans `deposer` distingue les deux (`main.bord === "fin"`) et
   la fenêtre de pose appelle directement `ecrire` (l'écriture immédiate), jamais `deposer`.
3. **Un second dépôt de la même carte pendant le délai REMPLACE le premier**, il ne l'empile pas
   (minuterie précédente annulée, nouvelle cible posée). Choix non demandé explicitement par le
   ticket, mais nécessaire : sans lui, glisser deux fois la même carte avant l'échéance aurait posé
   deux écritures futures pour un seul geste.
4. **Le bandeau de PG-B6 est signalé par `?cree=1` sur la redirection de création**, une fonction
   dédiée `versLaFicheApresCreation` plutôt que la `versLaFiche` partagée — celle-ci sert aussi
   `/deplacer` et les autres actions de la fiche, qui n'ont rien à proposer après coup.
5. **« Planifier maintenant » réemploie `TrouverCreneau` telle quelle**, avec un unique prop ajouté
   (`libelleBouton`, optionnel, par défaut inchangé) plutôt qu'une seconde ouverture de `FenetrePose`
   écrite à part.
6. **Ripple non prévu au territoire, mais nécessaire pour garder `verify:full` vert** — les deux
   changements de comportement touchent des e2e PRÉEXISTANTS hors du territoire annoncé par le
   ticket (qui ne citait que « l'e2e neuf ») :
   - PG-B5 casse l'attente immédiate de 8 scénarios dans 3 fichiers
     (`glisser-deposer.spec.ts`, `planning-semaine-garde-heure.spec.ts`,
     `captures-pg-a7-semaine-garde-heure.spec.ts` — ce dernier repéré seulement à la deuxième
     exécution de `verify:full`, un premier `grep` ayant manqué son appel `glisser(` multi-lignes).
     Chacun attend maintenant la réponse `/deplacer` (ou un délai fixe pour les cas de refus, où
     aucune requête ne part avant l'échéance) avant ses assertions habituelles — MÊME comportement
     mesuré, le délai en plus.
   - PG-B6 change la forme de l'URL après toute création réussie (`?cree=1` ajouté) : 16
     assertions dans 12 fichiers (`toHaveURL`/`Location` vérifiant une fiche « nue ») ont été
     relâchées pour tolérer ce paramètre optionnel — aucune assertion métier n'a changé de sens.
   Ces deux ripples sont mécaniques (aucune assertion affaiblie, seulement adaptée à un délai ou un
   paramètre attendus) — je ne les ai pas demandés à l'avance faute d'avoir mesuré leur ampleur avant
   d'implémenter, et je le signale ici plutôt que de les passer sous silence.

   Corrigé par 9BMA : la vérification de la garde enVol, perdue par 9BM, est rétablie.
7. **Isolation tests** (`tests/isolation/demandes-2.test.ts`,
   `tests/isolation/intervention-machines.test.ts`) : `duree_min` étant maintenant un champ REQUIS
   du type `Creation` (nullable, mais pas optionnel — le défaut Zod ne s'applique qu'au `.parse()`),
   `tsc` a refusé les objets littéraux qui construisaient une `Creation` sans lui. Ajouté
   `duree_min: null` aux cinq occurrences concernées.

## Ce que je n'ai PAS fait

- Je n'ai pas ajouté d'affichage de la durée sur la carte de la file d'attente (« bug 2 » de l'audit
  du 27/09 — la file n'affiche aujourd'hui ni durée ni heure sur ses cartes, `BlocPosable`/le rendu
  de la file dans `page.tsx` n'a pas de ligne pour cela). Le ticket ne le demandait pas explicitement
  dans ses « CE QUE TU FAIS » numérotés — seule sa description du scénario e2e (« la carte de la
  file porte "2h" ») le suggère. J'ai interprété cela comme : la durée choisie doit se RETROUVER dans
  la fenêtre de pose (préremplissage de la puce, déjà câblé et vérifié par mon e2e) et permettre à la
  carte de se poser effectivement en vue Jour une fois planifiée (vérifié aussi) — pas comme une
  demande d'ajouter un nouvel élément visuel à la file elle-même. Si ce n'est pas la lecture voulue,
  c'est un écart à signaler.
- Je n'ai pas touché à `app/(back-office)/planning/page.tsx` du tout, ni pour PG-B5 ni pour PG-B6.
- Je n'ai pas exploré si le bandeau « Intervention créée » devrait aussi apparaître pour une
  intervention créée depuis une demande (`?demande=<id>`) différemment — il apparaît de la même
  façon, sans distinction, ce qui semble cohérent mais n'a pas été spécifiquement demandé ni testé
  pour ce cas.

## Les pièges pour la session suivante

- **`git stash` scope à la liste de fichiers, jamais `git stash` nu** — le dépôt porte en permanence
  des PNG modifiés hors du périmètre de ce lot (captures d'autres tickets, non commitées avant ce
  lot). Un `git stash` sans pathspec les aurait emportés. `git stash push -- <fichiers>` cible
  précisément les fichiers du lot.
- **Toute nouvelle capture AVANT/APRÈS qui touche `Posable.deposer` (glisser-déposer direct d'une
  carte déjà planifiée) doit désormais attendre la réponse `/deplacer` avant de vérifier l'écran** —
  un simple `await expect(...).toBeVisible()` immédiatement après `glisser()` échouera pour TOUT
  scénario qui déplace directement une carte déjà planifiée (pas pour les cartes « à planifier »,
  qui passent par `FenetrePose` et restent immédiates). Chercher `import ... from "./setup/glisser"`
  (pas seulement `glisser(page` sur une ligne — l'appel s'écrit parfois sur plusieurs lignes) avant
  de croire qu'un fichier e2e est hors de portée.
- **Le bandeau de PG-B6 ne s'affiche que si `?cree=1` est présent ET `statut === "a_planifier"`** —
  toute action qui ferait quitter puis revenir sur la fiche sans ce paramètre ne le montre plus,
  c'est voulu (« Laisser dans la file » y mène explicitement).
- **`ListeSemaine` (vue mobile du planning) n'utilise pas `BlocPosable`** — aucun mécanisme de
  PG-B5 (bandeau, carte effacée) ne s'y voit ; c'est mesuré et documenté dans le README des captures
  PG-B5, pas un oubli.

## Ce qui reste à faire

- Rien d'identifié comme bloquant. Le seul écart potentiel est le point « Ce que je n'ai PAS fait »
  ci-dessus sur l'affichage de la durée dans la file d'attente (bug 2), à trancher si l'intention du
  ticket allait au-delà de ce que ses points numérotés demandaient explicitement.
