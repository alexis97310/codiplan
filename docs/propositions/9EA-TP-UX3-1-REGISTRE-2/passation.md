# 9EA-TP-UX3-1-REGISTRE-2 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**Colonnes par onglet.** Le registre `/interventions` montrait les mêmes huit colonnes
(Référence, Client, Machine, Site, Technicien, Date planifiée, Priorité, Statut) sur ses
sept onglets listants. `colonnesDuRegistre` (`app/(back-office)/interventions/
presentation.ts`) rend désormais, par onglet, le jeu que la spécification du 28/09 dessine :
« Intervention » (référence + nature + machines) remplace Référence/Machine ; « Client ·
Site » remplace Client/Site ; « À planifier » montre Ancienneté/Durée au lieu de
Statut ; « Suspendues » montre Depuis/Motif/Pièce attendue ; « En cours » montre
Compteur ; « À contrôler » montre Terminée/Rapport. Aucune colonne de montant nulle part.
Pour un planificateur, ça veut dire : sur « À planifier », voir d'un coup d'œil ce qui
attend depuis le plus longtemps et ce qui n'a pas de durée estimée ; sur « Suspendues »,
voir la pièce attendue sans ouvrir chaque fiche.

**Actions de ligne.** « Poser » (À planifier, Suspendues) et « Déplacer… » (En retard)
ouvrent la même fenêtre de pose que la fiche, au même verdict serveur. « Transmettre… »
(Aujourd'hui, Planifiée) poste vers la route unitaire existante. « Contrôler » (Aujourd'hui
Terminée, À contrôler) est un lien vers la fiche. Un rôle sans `modifier_planning` complet
ne voit aucun des trois premiers boutons — cette page ne lisait jusqu'ici que
`consulter_planning`.

**Sélection.** Une case à cocher sur trois onglets (À planifier, Aujourd'hui, Toutes), une
barre collée en haut qui compte, transmet (Aujourd'hui, limité aux lignes réellement
planifiées parmi les cochées) et exporte (partout, avec les identifiants cochés). Jamais de
pose en lot (D106).

**Suivi étendu.** « Sous garantie, ouvertes » rejoint « Sans durée prévue ». « Retours sous
30 jours » (RG-INT-10) reste absent — voir « Ce que j'ai tranché ».

**Cartes sous 900 px.** Le tableau défilait horizontalement au téléphone ; il laisse
désormais place à une carte par ligne, identique sur tous les onglets, sans action ni case
(choix du pilote C5).

**Export.** `GET /api/interventions/exporter` lit désormais un paramètre `id` répété,
ajouté au filtre existant — jamais une seconde lecture.

Rien de tout cela ne change une règle de gestion, un montant, ou un droit déjà posé ailleurs.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

Captures dans `docs/propositions/9EA-TP-UX3-1-REGISTRE-2/captures/` (README daté, commit de
référence pour chaque série) : AVANT rejoué sur `616b4bdc` dans un worktree détaché, APRÈS
sur le commit livré, les deux sur le même semis de démonstration.

- **AVANT** (`avant-a-planifier-1280.png`) : 8 colonnes identiques, priorité en toutes
  lettres avec tiret cadratin (« P1 — critique »), aucune case, aucun bouton d'action,
  tableau qui déborde à 375 px.
- **APRÈS** (`apres-a-planifier-1280.png`, `apres-en-cours-1280.png`,
  `apres-selection-aujourdhui-1280.png`, `apres-fenetre-poser-1280.png`,
  `apres-toutes-375.png`) : colonnes propres à l'onglet, priorité en sigle coloré, case +
  barre de sélection fonctionnelles (vérifié : une ligne « Affectée » cochée désactive
  « Transmettre… », exactement le verdict attendu), fenêtre « Poser » ouverte sur la bonne
  fiche, cartes au lieu du tableau à 375 px.
- `pnpm verify:full` (format/typecheck/lint/test/isolation/build/feries/partitions/e2e)
  rejoué EN ENTIER : **0 échec, 1018 passés, 36 ignorés** (suite existante, non touchée par
  ce ticket).
- 402 fichiers, 4270 tests unitaires verts ; 2 épreuves d'isolation neuves
  (`suivi-garantie-ouvertes.test.ts`) vertes, dont la mesure du cloisonnement entre les
  deux sociétés.
- 18 épreuves de bout en bout neuves (`registre-ux3-2.spec.ts`) vertes, deux fois de
  suite (stabilité vérifiée).

Je n'ai PAS mesuré : le rendu réel sur un lecteur d'écran (seules les captures d'image et
les assertions de rôle/texte ont été vérifiées) ; le comportement sous une volumétrie
proche de la production (la scène de l'épreuve bout en bout porte 8 lignes).

## Ce que j'ai tranché et pourquoi

- **« Retours sous 30 jours » (RG-INT-10) reste absent du Suivi.** Le critère compare la
  ligne à une AUTRE ligne (une `curatif` antérieure sur la même machine, clôturée dans les
  30 jours précédant la création de LA LIGNE COURANTE) — une corrélation sur une valeur qui
  n'est pas littérale, qu'un filtre Prisma déclaratif ne sait pas exprimer sans SQL brut
  (interdit hors migrations, CLAUDE.md §2). Choix du pilote C1, confirmé en écrivant le
  code : je n'ai trouvé aucune façon de l'exprimer autrement qu'en SQL brut ou en relisant
  TOUTE la population pour comparer côté application — les deux hors du geste de ce ticket.
- **« Terminée » (À contrôler) lit `date_planifiee`, pas l'instant réel de fin.** Aucune
  colonne ne date le passage au statut « terminée » — la même réserve que
  `chronologieDeLaFiche` pose déjà pour « planification »/« déplacement ». J'ai choisi la
  date la plus proche de ce que la colonne promet plutôt que de ne rien montrer.
- **Le sélecteur technicien de « Poser »/« Déplacer… » ne porte pas l'annotation
  « absent le JJ ».** La fiche la calcule depuis une date déjà choisie (`optionsDAffectation`
  dépend de la date du formulaire) ; au registre, aucune date n'est encore choisie pour
  CHAQUE ligne sans lecture supplémentaire par ligne. J'ai réutilisé la liste de techniciens
  actifs déjà lue pour le filtre, sans l'annotation — le refus d'une affectation réellement
  bloquée reste porté par le dépôt et le déclencheur, jamais par ce seul affichage.
- **`SELECTION_LIGNE_PLANNING` (dépôt) a grandi plutôt que de se dupliquer.** `LignePlanning`
  est un type PARTAGÉ (registre, historiques client/site). Plutôt que créer un second type
  pour le registre, j'ai étendu la sélection existante (`cree_le`, `deplanifiee_date`,
  `site.commune`) — ces lectures sont bon marché, et les fiches client/site les ignorent
  sans coût. Mesuré par le typecheck, qui a détecté l'incompatibilité AVANT que je choisisse
  cette voie.
- **Les épreuves bout en bout pré-existantes qui lisaient `a[href^="/interventions/{id}"]`
  sans le scoper au tableau cassaient** : la carte du téléphone porte, dans le DOM, le même
  `href` que la ligne (CSS la masque sous 900 px, jamais retirée du DOM). Adaptées (scope au
  tableau, ou `.first()`), citées ligne à ligne dans chaque fichier, sans affaiblir une
  assertion.
- **`tests/unit/ui/lot-a3.test.ts` et `tests/unit/interventions/colonnes-et-kpi.test.ts`**
  mesuraient l'ancien tableau à plat (`const colonnes = [...]`, Site AVANT Machine). Comme
  ce tableau n'existe plus, je les ai réécrits pour mesurer `colonnesDuRegistre` — l'ordre
  Intervention AVANT Client · Site (inversé par rapport à l'ancienne maquette, D137) —
  plutôt que de les supprimer : ce qu'ils gardaient reste gardé, sous une forme qui
  correspond à ce qui existe.

## Ce que je n'ai PAS fait

- « Retours sous 30 jours » (voir ci-dessus).
- « Clôturer… », « Valider le rapport », « À valider depuis N j » — l'état « rapport
  validé » n'existe pas encore (IN-20, TP-UX4).
- Avatar de technicien.
- Lecture des segments de travail pour la colonne « Compteur » — elle lit `temps_mesure_min`,
  déjà porté par la ligne, jamais une lecture nouvelle des segments.
- « Réserve VGP » dans la colonne « Demande » — aucune lecture existante à réutiliser.
- Recherche sur la commune du site.
- Pose groupée (D106, exclue explicitement).
- Toute migration, tout prix, toute valeur inventée.
- Le rejeu complet du scénario « Poser » jusqu'à la confirmation dans l'épreuve bout en
  bout neuve (je vérifie seulement que la fenêtre s'ouvre sur la bonne fiche — le parcours
  complet de planification est déjà éprouvé par `fiche-trouver-creneau.spec.ts`, la même
  fenêtre, jamais une seconde écriture de cette épreuve).

## Les pièges pour la session suivante

- **La carte du téléphone (`components/ui/liste-cartes.tsx`) porte le MÊME `href` que la
  ligne du tableau, dans le DOM, à TOUTE largeur d'écran** (CSS la masque sous 900 px,
  jamais retirée du DOM). Toute requête `page.locator('a[href^="/interventions/{id}"]')`
  non scopée au tableau (`tbody`/`table`) résout à DEUX éléments et casse en mode strict.
  Scoper, ou prendre `.first()`.
- **« Contrôler » (Aujourd'hui Terminée, À contrôler) partage le MÊME `href` que la
  référence** — un deuxième `<a>` dans la même ligne. `toHaveCount(1)` sur un `href` de
  référence y échoue aussi ; j'ai utilisé `>= 1` partout où c'était pertinent.
- **`registre-filtre-agence-inactive.spec.ts` a échoué UNE FOIS sous forte parallélisation**
  (10 workers, FK violée en nettoyant une agence encore référencée par un site) — rejoué
  seul, il passe. Je n'ai RIEN touché à ce fichier : la panne ne s'est produite qu'en
  parallèle avec 12 autres fichiers du même run, jamais isolément ni dans `verify:full`
  (1 seul worker, CI=1) qui vient de passer entièrement. Si elle réapparaît, c'est un
  problème de parallélisme pré-existant entre fichiers e2e, pas une régression de ce ticket.
- **`VALEURS_SUIVI` a grandi** (`garantie_ouvertes`) : toute épreuve qui itère dessus (déjà
  le cas de `registre-vues.test.ts`) couvre automatiquement la nouvelle valeur — aucune
  mise à jour séparée n'était nécessaire, et c'est voulu.
- **`STATUTS_INTERVENTION_FERMES` est désormais exportée** depuis `lib/interventions/
  depot.ts` — avant ce ticket elle était privée. Si un futur gardien `chemins-de-depot`
  se met à vérifier les CONSTANTES exportées (il ne vérifie aujourd'hui que les fonctions),
  cette constante n'a qu'un seul appelant réel (dans le même fichier) et un usage en
  commentaire ailleurs — à surveiller si la règle change.

## Ce qui reste à faire

- Si Alexis tranche un jour « Retours sous 30 jours » autrement (par exemple en acceptant
  une vue matérialisée ou une colonne calculée à l'écriture plutôt qu'à la lecture), ce
  Suivi peut rejoindre `VALEURS_SUIVI` sans toucher au reste de ce ticket.
- L'annotation « absent le JJ » sur le sélecteur technicien de « Poser »/« Déplacer… »
  depuis le registre, si elle s'avère nécessaire en usage réel (coûterait une lecture
  d'absences par agence présente, pas par ligne — faisable sans exploser le nombre de
  requêtes).
- « Clôturer… »/« Valider le rapport » arriveront avec TP-UX4, quand l'état « rapport
  validé » existera.
