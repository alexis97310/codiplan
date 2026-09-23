# AFFICHAGE-MATERIEL-1 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **La vue JOUR du planning ne cache plus les interventions sans heure.**
  `lib/interventions/journee.ts` : une intervention datée sans créneau se
  dessine désormais DANS la colonne de son technicien, dans une nouvelle ligne
  « Journée — heure non fixée » posée EN TÊTE de la grille (avant 07:00),
  jamais plus seulement sous elle (`ColonneDeJournee.sansHeure`, remplace le
  motif `sans_creneau` de `horsGrille`, qui ne porte plus que `hors_axe`).
  *Pour l'exploitation* : les quatre interventions du jour mesurées « absentes »
  le 23/09 apparaissent maintenant à l'endroit où un planificateur les
  cherche — dans la colonne du technicien concerné.
- **Une intervention sans technicien** (`technicien_id` nul, datée) rendait
  déjà sa propre colonne « Interventions non affectées » — mesuré, pas
  changé : le mécanisme existait depuis le 12/09/2026 (référentiel des
  colonnes) et fonctionnait déjà pour ce cas.
- **Le matériel se voit, partout où le ticket le demande.** Un nouveau
  libellé complet — « <Famille> <Marque> <Référence> S/N <numéro de série> »
  (`lib/machines/presentation.ts`, `libelleMaterielComplet`, sur des données
  lues par `lib/machines/depot.ts:donneesMaterielDesMachines`) — remplace ou
  complète l'ancien « marque référence » à deux endroits :
  - la **fiche intervention** (`/interventions/[id]`) : la ligne Machine
    porte désormais famille + marque + référence + S/N, toujours en lien vers
    la fiche machine (LIENS-1, inchangé) ;
  - la **carte de planning**, dans ses TROIS rendus (grille semaine, grille
    jour, liste téléphone) : une ligne « Matériel » a rejoint site et durée
    dans `DetailsDeLaCarte` (`app/(back-office)/planning/page.tsx`), avec
    repli « Matériel non précisé » (RG-INT-01 : pas de machine n'est pas une
    anomalie) et troncature `title`-complète, comme le site.
  - **Le registre `/interventions` et le bon imprimable gardent leur forme
    « marque référence »** (`machinesAffichees`, inchangée) : le ticket ne
    demandait la famille que sur la fiche et le planning.
- **Le bon d'intervention n'existe plus que pour un travail FAIT.**
  `peutGenererLeBon` (`lib/interventions/cycle-de-vie.ts`) n'autorise que
  `terminee` et `cloturee` — exactement les deux statuts nommés par le
  ticket. La fiche ne propose plus le lien « Bon d'intervention » en dehors
  de ces deux statuts ; l'URL `/interventions/[id]/bon` d'une intervention
  qui ne les porte pas redirige vers la fiche avec un motif clair (« Le bon
  sera disponible une fois l'intervention terminée »), par le MÊME mécanisme
  que le refus d'accès par rôle qui existait déjà sur cette page — jamais un
  bon à moitié vide, jamais une erreur.
- **La tuile « Interventions sans durée » du tableau de bord ne compte plus
  l'historique.** Mesuré en production le 23/09 à 13h05 : elle affichait
  1755, presque tout l'historique clôturé de 2021 à 2026.
  `compterInterventionsSansDuree` (`lib/interventions/depot.ts`) ne compte
  désormais que les interventions **non terminales** (ni `terminee`, ni
  `cloturee`, ni `annulee`) **datées d'aujourd'hui ou plus tard, ou sans
  date** — la civile est lue dans le fuseau de la société (L0-08), jamais
  l'horloge de l'appareil. Le lien de la tuile mène au registre
  `/interventions` filtré sur ce MÊME critère (`?sans_duree_a_venir=1`,
  nouveau champ de `schemaRechercheInterventions`), avec un bandeau qui dit
  que le filtre est actif.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Vue jour, sans heure** : `tests/unit/interventions/journee.test.ts` —
  AVANT, une intervention sans créneau était comptée dans `j.horsGrille`
  (motif `sans_creneau`) et absente de toute colonne dessinée ; APRÈS,
  `j.horsGrille` vaut 0 pour ce cas et `j.colonnes[0].sansHeure` la porte.
  Capturé à l'écran (`docs/propositions/37-AFFICHAGE-MATERIEL-1/
  planning-jour--1280--apres.png`) : « Local-000001 » apparaît dans la
  colonne de M. Poigoune, ligne « Journée — heure non fixée », au-dessus de
  07:30.
- **Tuile « sans durée »** : `tests/isolation/ecran-intervention.test.ts`,
  nouveau bloc — quatre fiches dédiées (à venir sans durée, passée clôturée
  sans durée, file d'attente sans durée, à venir AVEC durée) confrontées à un
  témoin SQL littéral. AVANT (code d'avant ce lot, raisonnement à partir du
  code lu) : les quatre auraient été comptées si elles portaient une date ;
  APRÈS : seules les deux premières catégories (à venir sans durée, file
  d'attente) sont comptées — mesuré `2` sur les quatre fiches dédiées, la
  passée clôturée et celle qui porte une durée en sont exclues.
  **Je n'ai pas reproduit le chiffre « 1755 » lui-même** : il vient de la
  base de PRODUCTION, à laquelle je n'ai pas accès depuis cette session ; ma
  mesure porte sur le CRITÈRE (isolation, sur une base jetable), pas sur le
  chiffre de production avant/après.
- **Bon d'intervention** : `tests/unit/interventions/cycle-de-vie.test.ts`
  (`peutGenererLeBon`) — passe sur `terminee`/`cloturee`, refuse les six
  autres statuts avec la même clé. Capturé à l'écran : le lien est ABSENT sur
  `fiche-planifiee--1280--apres.png`, PRÉSENT sur
  `fiche-terminee--1280--apres.png`, et `bon-terminee--1280--apres.png`
  montre le bon effectivement rendu pour une intervention terminée.
- **Captures AVANT non prises, faute de temps** (limite 3h du ticket) : les
  six images du dossier sont toutes des « APRÈS ». L'état AVANT est celui que
  d3crit le constat du ticket, mesuré par Alexis lui-même en production le
  23/09 (captures citées en toutes lettres dans le ticket, pas rejouées ici).
  **C'est une non-mesure, écrite comme telle.**

## Ce que j'ai tranché et pourquoi

- **La ligne « sans heure » est un rendu STATIQUE, jamais une cible de
  glisser-déposer.** Le ticket interdit de toucher au placement horaire ; lui
  donner une `CasePosable` aurait été une extension non demandée, avec son
  propre risque de régression sur `components/planning/pose.tsx`.
- **Le motif `sans_creneau` a quitté `MotifHorsGrille`** plutôt que d'y
  coexister avec le nouveau rendu en colonne : le garder aurait affiché la
  même intervention DEUX FOIS (dans sa colonne ET sous la grille), la faute
  exacte que `ListeSemaine` évite déjà pour une autre raison (§9, doctrine de
  ce dépôt : jamais deux lectures d'un même fait qui pourraient diverger).
- **Format du matériel — famille avant marque, comme demandé mot pour mot**,
  composé une seule fois (`lib/machines/presentation.ts`) et réutilisé par la
  fiche et le planning : deux écritures auraient pu diverger en silence.
- **Le registre `/interventions` et le bon imprimable gardent « marque
  référence »**, jamais la forme complète : le ticket ne le demandait qu'à la
  fiche et au planning ; l'étendre partout aurait été une extension non
  demandée, en territoire (`presentation.ts`, `machinesAffichees`) que la
  consigne « territoire » ne cite pas pour ce changement précis.
- **Le lien de la tuile « sans durée » pose un NOUVEAU paramètre de filtre**
  (`sans_duree_a_venir`) plutôt que de réutiliser les filtres existants
  (`statut`, `du`/`au`) : le critère combine un `NOT IN` sur trois statuts et
  un `OR (date NULLE ou future)`, une forme que les filtres unitaires
  existants ne peuvent pas exprimer sans la dénaturer. Le paramètre est
  calculé UNE FOIS (`criteresSansDureeAVenir`), partagé par la tuile et le
  registre.
- **Le bon redirige vers la fiche plutôt que d'afficher un message dédié** :
  la fiche portait déjà un mécanisme de bannière `motif` pour un refus
  d'accès par rôle (`/interventions/[id]/bon` → redirige déjà ainsi quand
  `exigerCapacite` refuse) ; réutiliser EXACTEMENT ce chemin pour le nouveau
  refus de statut évite une troisième forme d'affichage d'un refus.
- **Trois fichiers e2e préexistants visaient une intervention `planifiee`
  pour ouvrir son bon** (`bon-intervention.spec.ts`, `rapport-terrain.spec.ts`,
  `tous-les-ecrans-rendent.spec.ts`) — cassés par la nouvelle règle, pas par
  une régression de comportement voulu. `bon-intervention.spec.ts` pose
  désormais SA PROPRE fixture `terminee` plutôt que de faire avancer
  `SCENE.obstacle`, partagée par dix autres fichiers e2e ; `rapport-
  terrain.spec.ts`, déjà sériel et seul propriétaire de sa scène à ce stade
  de son exécution, fait passer `obstacle` ET `chevauchante` à `terminee`
  juste avant son dernier test ; le résolveur générique de
  `tous-les-ecrans-rendent.spec.ts` cherche maintenant une intervention dont
  le bon existe réellement.

## Ce que je n'ai PAS fait

- **Pas de migration, rien sous `prisma/`** — conforme à l'interdit du
  ticket ; tout passe par des colonnes déjà lues (`intervention.statut`,
  `intervention.date_planifiee`, `intervention.duree_estimee_min`,
  `machine.numero_serie`, `modele_materiel.*`, `famille_materiel.libelle`).
- **Pas touché au glisser-déposer ni à la logique de placement horaire** —
  `components/planning/pose.tsx` n'a reçu aucune modification.
- **Pas de changement au format « marque référence » du registre
  `/interventions` ni du bon imprimable** — voir « ce que j'ai tranché ».
- **Pas de captures AVANT** — voir « ce que j'ai mesuré ». Les captures
  APRÈS suffisent à vérifier le résultat, mais ne remplacent pas une
  comparaison photographique.
- **Pas de vérification manuelle sur la base de PRODUCTION** — aucun accès
  depuis cette session ; toute mesure du point 5 est faite sur une base
  jetable (isolation) ou de démonstration (captures).

## Les pièges pour la session suivante

- **`ColonneDeJournee.sansHeure` est un NOUVEAU champ** — tout code qui
  construisait une `Journee<T>`/`ColonneDeJournee<T>` à la main (aucun trouvé
  dans ce dépôt hors `construireJournee` lui-même et les tests) devra le
  fournir ; TypeScript le signalera à la compilation, mais un mock JSON non
  typé ne serait pas averti.
- **`RechercheInterventions.sans_duree_a_venir` est un booléen qui ne
  COMBINE PAS avec les autres filtres du formulaire visible** — le
  formulaire GET de `/interventions` ne porte pas de case cachée pour ce
  paramètre : changer un filtre à la main depuis la vue « sans durée à venir »
  fait perdre ce paramètre (comportement voulu, mais à connaître avant de
  s'étonner qu'il « disparaisse »).
- **La flakiness pré-existante, mesurée et NON causée par ce lot** :
  `tests/e2e/planning-largeur-et-carte.spec.ts` (« dans la grille (lg+), une
  carte affiche le site et la durée connue ») échoue par intermittence sous
  `pnpm test:e2e` complet (12 workers), jamais seule : un autre fichier
  (`glisser-deposer.spec.ts`, qui redimensionne une intervention par
  glissement) modifie la durée de `SCENE.chevauchante` PENDANT que ce
  scénario la lit — race entre fichiers sur une fixture partagée, la famille
  déjà nommée par la mémoire « Semis partagé sous fullyParallel ». Confirmé
  en le rejouant SEUL (`pnpm playwright test tests/e2e/planning-largeur-et-
  carte.spec.ts`) : toujours vert. Rien à corriger dans ce lot ; à garder à
  l'œil si elle réapparaît.
- **`bon/page.tsx` fait maintenant DEUX lectures avant de rendre** : `bon =
  lireBonCache(...)` puis `peutGenererLeBon(statut)` avant de composer
  `montants`/`libellesMachines`. Un futur refus à ajouter sur cette page doit
  se poser AVANT ces lectures coûteuses, comme celui-ci — pas après.

## Ce qui reste à faire

- **Aucune UI pour COMPOSER le filtre `sans_duree_a_venir` à la main** —
  seul le lien de la tuile le pose. Si l'exploitation veut un jour une case
  à cocher sur le registre lui-même, il faudra l'ajouter au formulaire GET
  (`app/(back-office)/interventions/page.tsx`) et décider comment elle
  cohabite avec les quatre filtres existants.
- **La vue jour ne montre pas la ligne « sans heure » quand AUCUNE agence
  présente n'a de calendrier connu autrement qu'en liste plate**
  (`SansHeureVide`, repli du cas où `journee.axe` est vide) — ce repli est
  écrit et couvert par construction (même fonction `DetailsDeLaCarte`), mais
  n'a pas de capture ni d'épreuve e2e dédiée : le cas est rare (aucune
  agence de la scène de démonstration ne le déclenche).
- **Captures AVANT/APRÈS complètes** — à refaire dans une session qui peut se
  permettre de checkouter le commit de départ (`65138af`) dans un
  `git worktree`, construire les deux versions, et photographier les deux
  contre les mêmes fixtures.
