# TABLEAU-1 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **`/vgp` et le tableau de bord comptent désormais le MÊME parc.** `/vgp`
  composait son résumé (`resumerLeRegistre`, les quatre KPI du bandeau) sur
  les lignes déjà bornées à 200 pour L'AFFICHAGE de sa table
  (`LIGNES_AFFICHEES`) — exactement la faute qu'AT-07 avait fermée pour
  `/parc` (`lib/machines/saisie.ts`, `LIMITE_RECHERCHE_MAXIMALE`). Une
  société dont les machines soumises dépassent 200 voyait donc son KPI
  « en retard » sous-compté par rapport à la tuile du tableau de bord
  (`compterAPrevoir`, qui lit tout le parc cloisonné, sans plafond). Réparé
  dans `app/(back-office)/vgp/page.tsx` : une seule lecture, bornée à un
  plafond de sécurité généreux (`LIGNES_RESUME_MAXIMALES = 2000`), dont
  l'affichage ne garde que les `LIGNES_AFFICHEES` (200) premières lignes.
  *Pour l'exploitation* : le nombre lu sur la tuile du matin est le même que
  celui du registre qu'elle mène — plus d'écart à réconcilier à la main.
- **La tuile « VGP à prévoir » ouvre le registre, filtré.** `/vgp` accepte
  désormais `?etat=depassees` (lecture de paramètre seule, aucune écriture) :
  la table ne montre alors que les échéances dépassées, avec un bandeau
  « Filtré sur les échéances dépassées · Voir tout le registre ». La tuile du
  tableau de bord y mène directement.
- **Une P1 à planifier se lit comme urgente.** `prioritesAPlanifier`
  (`app/(back-office)/tableau-de-bord/presentation.ts`) portait un rang de
  POSITION (« 01 », « 02 » …) qui ne disait rien de la priorité réelle — une
  fiche P1 — critique se lisait comme n'importe quelle P4. Le rang porte
  désormais la priorité elle-même (P1/P2/P3/P4, la même lecture que
  `prioritesUrgentes` faisait déjà), triée P1 > P2 > P3 > P4 puis par l'ordre
  déjà daté que `listerPlanning` a lu (tri STABLE, aucun second calcul de
  priorité).
- **Deux zones inertes ont quitté l'écran.** La tuile « Taux d'occupation »
  ne cite plus « R2-13 » (une référence de ticket interne, sans aucune valeur
  pour un opérateur) : elle ouvre désormais `/planning`, où le taux PAR
  TECHNICIEN est déjà affiché. La carte « Activité récente » — qui ne
  faisait que dire qu'elle n'affichait rien, en citant « I8 » — est devenue
  « Interventions sans durée » : un compte réel d'interventions déjà
  planifiées (une date posée) sans durée prévue, une donnée qui fausse la
  charge tant qu'elle n'est pas saisie, et que la future obligation de durée
  (décision d'Alexis du 23/09/2026) va combler. Le marqueur de composition
  `data-bloc="activite"` reste inchangé (D125 : même ordre, même nombre de
  blocs que `dashboard()` de la maquette) — seul son contenu change.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **La cause de l'écart de production, isolée et reproduite.** Un scénario
  d'isolation neuf (`tests/isolation/vgp-compte-tuile-registre.test.ts`)
  sème 205 machines soumises et en retard (au-delà des 200 lignes que
  `/vgp` affichait, très en dessous du nouveau plafond de 2000) : AVANT le
  correctif, `resumerLeRegistre` calculé sur la lecture bornée à 200
  sous-compte (< 205, mesuré sur le témoin) ; APRÈS, calculé sur le plafond
  du résumé, il retrouve EXACTEMENT le compte de `compterAPrevoir` — la
  tuile du tableau de bord. Les quatre scénarios passent sur ce commit.
- **`pnpm verify:full` complet et vert** avant ce commit : `format:check`,
  `typecheck`, `lint`, 2651 tests unitaires (244 fichiers), 1158 tests
  d'isolation (114 fichiers), `build`, puis la suite e2e (voir plus bas pour
  le détail e2e). Voir aussi le §"pièges" pour la seule chose non rejouée
  intégralement.
- **Captures AVANT/APRÈS**, dans ce dossier — `/tableau-de-bord` à 1280 et
  390 px, `/vgp` à 1280 px — prises par un spec e2e temporaire non conservé
  (recette de la mémoire `captures-avant-apres-e2e`) : AVANT sur `2973a44`
  (état de `main` avant ce lot), APRÈS sur ce commit. Le contraste le plus
  net est la carte des priorités : AVANT, « 01, 02, 03… » sans aucune
  priorité lisible ; APRÈS, « P1, P1, P2, P2, P2, P3, P3 », triée. Sur cette
  scène de démonstration (une poignée de machines, très en dessous de 200),
  `/vgp` affiche le MÊME nombre d'échéances dépassées (2) avant et après —
  attendu : la scène ne dépasse jamais la borne d'affichage, donc l'écart de
  production ne s'y reproduit pas visuellement. C'est le scénario
  d'isolation ci-dessus, pas la capture, qui prouve la correction du
  dépassement de la borne.

## Ce que j'ai tranché et pourquoi

1. **La cause retenue est la borne d'affichage de `/vgp`, pas les
   « candidats » nommés par le ticket.** J'ai mesuré chacun : une machine de
   famille NON soumise avec une information reçue reste `hors_registre`
   dans `etatDeLInformation` (elle ne compte donc JAMAIS dans
   « information_recue »), les statuts terminaux de machine ne sont filtrés
   nulle part (ni `compterAPrevoir` ni `listerLeRegistre`), et les deux
   écrans calculent `aujourdHui` par la MÊME formule
   (`instantDuJour(jourDe(maintenant(fuseau).local))`). Aucun de ces trois
   candidats ne peut produire l'écart mesuré. La seule différence de lecture
   entre les deux calculs était la borne de 200 lignes — confirmée par
   mesure (voir ci-dessus).
2. **Une seule lecture, bornée plus largement, plutôt que deux requêtes
   séparées.** `/parc` (AT-07) fait deux requêtes distinctes pour sa table
   paginée et son résumé, parce que le résumé y lit MOINS de colonnes que la
   table. Ici, `resumerLeRegistre` lit exactement la même forme
   (`LigneDeRegistre`) que la table affichée : une seule lecture, bornée au
   plafond du résumé, puis tronquée en mémoire pour l'affichage, évite une
   seconde requête sans rien perdre en fraîcheur (même transaction logique).
3. **`LIGNES_RESUME_MAXIMALES` vit dans `app/(back-office)/vgp/page.tsx`,
   pas dans `lib/vgp/registre.ts`.** Ma première écriture la posait dans
   `registre.ts`, à côté de `listerLeRegistre` — et le gardien
   `tests/unit/vgp/aucune-duree-en-dur.test.ts` (L9-05, aucun littéral
   numérique hors conversion d'unité dans ce dossier) a rougi dessus, à
   raison : ce plafond n'est pas une périodicité, mais le gardien est
   délibérément large plutôt qu'à trous. Déplacé dans la page, comme
   `LIGNES_AFFICHEES` l'était déjà.
4. **Le tri des priorités est explicite (`triParPrioritePuisDate`), pas
   hérité de l'ordre de `listerPlanning`.** L'ordre reçu est DÉJÀ trié par
   priorité (voir le commentaire de `listerPlanning`), donc un tri explicite
   ici est redondant en pratique — mais une fonction pure qui dépend d'un
   ordre incident non testé casserait en silence si l'appelant changeait un
   jour. Le tri est stable (`Array.prototype.sort`, ES2019) : à priorité
   égale, l'ordre déjà daté reçu est conservé, sans second critère à
   inventer.
5. **La tuile VGP et « Interventions sans durée » sont des LIENS ajoutés à
   l'intérieur des blocs existants (`data-bloc`), jamais de nouveaux blocs.**
   Le gardien de composition D125
   (`tests/unit/ui/lot-a1-a4.test.ts`) exige que `/tableau-de-bord` porte
   EXACTEMENT les marqueurs `data-bloc` que `dashboard()` de la maquette
   dessine — ni un de plus, ni un de moins. J'ai donc enrichi le CONTENU des
   blocs `kpi-occupation`, `kpi-vgp` et `activite`, jamais ajouté ou retiré
   de bloc.

## Ce que je n'ai PAS fait

- **Aucun filtre neuf sur `/interventions`.** Le lien « Voir les
  interventions → » sous « Interventions sans durée » mène à
  `/interventions` SANS filtre : `filtreDesInterventions`
  (`lib/interventions/depot.ts`) n'a aucun critère de durée manquante
  aujourd'hui, et `app/(back-office)/interventions/page.tsx` est HORS
  territoire de ce ticket. Contrairement à `/vgp` (explicitement autorisé à
  gagner un filtre), ce lien reste donc générique — écart nommé, comme le
  prévoyait le ticket pour la tuile VGP si `/vgp` n'avait pas su filtrer.
- **Aucune migration, aucune contrainte posée.** `duree_estimee_min` existe
  déjà, nullable ; le compte ne fait que la lire. La future obligation de
  durée (décision d'Alexis) reste un ticket séparé.
- **`prioritesUrgentes` n'a pas été modifiée.** Elle exposait déjà `rang:
  ligne.priorite.toUpperCase()` avant ce lot — le défaut ne la concernait
  pas. Je ne l'ai pas fait passer par `triParPrioritePuisDate` : elle ne
  contient que des P1 (filtrées en amont), un tri par priorité y serait un
  no-op qui n'aurait rien prouvé de plus qu'un test dédié.
- **Aucune capture ne montre le dépassement réel de la borne des 200
  lignes** (voir ci-dessus, § mesures) : la scène de démonstration e2e est
  bien trop petite. C'est le scénario d'isolation qui porte cette preuve.

## Les pièges pour la session suivante

- **`compterAPrevoir` et `listerLeRegistre` n'acceptent AUCUN client Prisma
  explicite** (contrairement à `dernieresInformations`,
  `enregistrerVerification`, etc.) : elles passent toujours par le client
  global de `lib/db/client.ts`. Pour les éprouver en isolation, il faut
  poser `process.env.DATABASE_URL` sur l'URL applicative de la base jetable
  **avant** de charger le module (`await import(...)` dynamique après avoir
  posé la variable — un `import` statique en tête de fichier s'exécute AVANT
  toute instruction du corps du module, variable comprise). Voir
  `tests/isolation/vgp-compte-tuile-registre.test.ts` pour la recette
  complète, et `tests/isolation/sante-migrations.test.ts` pour le même
  geste ailleurs dans le dépôt.
- **Les tables `machine` et `vgp_verification` ont un `modifie_le` NOT NULL
  SANS défaut de base** (`@updatedAt` de Prisma le pose côté client, jamais
  côté SQL) : un `INSERT` en SQL brut sur ces tables doit fournir
  `modifie_le` lui-même, sous peine d'un `23502` peu explicite sur la
  colonne en cause.
- **Un `deleteMany({ where: { id: undefined } })` de Prisma ne filtre RIEN**
  — il matche toutes les lignes. Une variable de nettoyage jamais assignée
  (parce qu'une étape antérieure de `beforeAll` a levé) transforme donc un
  nettoyage ciblé en un `DELETE` sur toute la table, qui échoue bruyamment
  sur la première contrainte de clé étrangère rencontrée — mais qui
  RÉUSSIRAIT SILENCIEUSEMENT sur une table sans contrainte entrante. Garder
  les identifiants en `string | undefined`, et garder chaque `deleteMany` de
  nettoyage derrière un `if (id !== undefined)`.
- **`git checkout <ref> -- .` sur un dépôt propre est un moyen sûr de
  rejouer l'AVANT d'un lot déjà commité**, sans créer de worktree ni changer
  de branche : le répertoire de travail reprend l'état de `<ref>`, `HEAD`
  reste sur le commit courant. Utilisé ici pour les deux passages de la
  capture e2e.

## Ce qui reste à faire

- **Aucun test ne prouve le dépassement de la borne des 200 lignes contre un
  ÉCRAN rendu** (Playwright) — seulement contre les fonctions de
  `lib/vgp/registre.ts` (isolation) et la composition statique de la page
  (aucun gardien de source dédié n'a été ajouté). Un scénario e2e qui sème
  ~205 machines soumises pour mesurer le rendu réel de `/vgp` coûterait cher
  en temps de seed à chaque exécution ; à évaluer si la régularité de ce
  chemin le justifie.
- **`/interventions` n'a toujours aucun filtre « durée manquante »** — à
  écrire quand la durée deviendra obligatoire (décision d'Alexis), pour que
  le lien de la tuile « Interventions sans durée » cesse d'être générique.
- **Le taux d'occupation CONSOLIDÉ reste `Non calculé`** — inchangé par ce
  lot, toujours bloqué sur l'absence de règle de consolidation multi-agence
  au chapitre 10 (R2-13, désormais uniquement en commentaire, jamais à
  l'écran).
