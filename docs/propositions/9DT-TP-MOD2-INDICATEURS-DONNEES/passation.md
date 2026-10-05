# 9DT-TP-MOD2-INDICATEURS-DONNEES — passation

*Décide D170 (`docs/arbitrages.md`) : constats QT-20, MO-7 de l'audit du 28/09/2026
(`docs/propositions/audit-2026-09-28/constats/`), et répond à QE-19. Reste à valider par
Alexis.*

## Ce que j'ai changé, et ce que ça change pour l'exploitation

- **Une page « Indicateurs du mois » (`/indicateurs`)** — des décomptes seulement, jamais
  une heure ni un montant. Un sélecteur à deux valeurs (« Ce mois-ci » / « Mois précédent »),
  bornes calculées dans le fuseau de la SOCIÉTÉ. Quatre sections : interventions planifiées
  dans le mois (une tuile par nature — `TYPES_INTERVENTION`, la seule notion de « nature »
  que le schéma porte), interventions créées dans le mois (un seul total, sans détail),
  interventions clôturées dans le mois (par nature), machines ajoutées au parc dans le mois
  (par origine — `Machine.source_creation`). Garde : `consulter_planning` au niveau complet
  — fermée au technicien. Entrée de menu ajoutée (écart nommé à la maquette, domaine
  « Exploitation », à côté du « Tableau de bord »).
- **Une page « Données à compléter » (`/parametres/donnees`)** — quatre lignes, chacune avec
  SA liste : interventions sans durée, familles VGP à déterminer, clients sans code externe
  (nouveau filtre), machines incomplètes (nouveau filtre). Garde : `gerer_client_site` —
  ouverte à admin_societe, direction, ADV. Portée par la section « Données » du hub
  Paramètres.
- **Quatre filtres neufs, posés par un lien, jamais par un champ de formulaire visible**
  (même forme que `sans_duree_a_venir` du registre) :
  - `cree_du`/`cree_au` et `cloturee_du`/`cloturee_au` sur `/interventions`
    (`lib/interventions/saisie.ts`, `lib/interventions/depot.ts`) — bornes sur `cree_le` et
    `cloturee_le`, jamais `date_planifiee`.
  - `ajoutee_du`/`ajoutee_au` et `origine` sur `/parc` (`lib/machines/saisie.ts`,
    `lib/machines/depot.ts`) — bornes sur `cree_le`, filtre sur `source_creation`.
  - `incompletes` sur `/parc` — le même critère que le badge « à compléter » de la ligne
    (`machine.complet`).
  - `sans_code_externe` sur `/clients` (`lib/clients/saisie.ts`, `lib/clients/depot.ts`) —
    le même critère que `compterSansCodeExterne` (`code_externe: null`).
- **Une correction trouvée par l'épreuve e2e** : le lien « Clients sans code externe » de
  Données à compléter manquait `sans_equipement=1`. Sans lui, `/clients` masque par défaut
  (LISTES-1) les clients sans équipement, alors que le décompte de la page, lui, les compte
  déjà — deux lectures divergentes du même chiffre (§9, 01/09). Le lien porte désormais
  `?sans_code_externe=1&sans_equipement=1`.
- **Une icône neuve, `chart`** (`components/ui/icone.tsx`), transcrite de la planche `ICONS`
  de la maquette du 28/09 — pour « Indicateurs du mois » au menu.
- **Décision** : `docs/arbitrages.md` porte désormais D170.

## Ce que j'ai mesuré

- **Isolation (`tests/isolation/indicateurs-donnees.test.ts`)** : pour chaque nouveau filtre,
  le décompte (`compterInterventions`/`compterLeParc`/`compterClients`) vaut EXACTEMENT
  `.length` de la liste qu'il ouvre (même fonction, même critère) ; la fiche hors fenêtre et
  la fiche d'une autre origine/nature n'y entrent pas ; la société B ne voit jamais la
  société A, et réciproquement. 11 épreuves, toutes vertes.
- **Un bug réel, trouvé et corrigé par une épreuve unitaire dédiée**
  (`tests/unit/calendar/fuseau.test.ts`) : `bornesDuMois` utilisait d'abord `instantDuJour`
  (le jour civil à minuit UTC — exact pour `date_planifiee`, une `@db.Date`) pour borner des
  colonnes `DateTime` VRAIES (`cree_le`, `cloturee_le`). Sous `Pacific/Noumea` (UTC+11), un
  instant au 1er du mois à 00h30 LOCALE (le 30 du mois précédent à 13h30 UTC) aurait été
  exclu du mois où il a réellement eu lieu. Corrigé par `versInstant(minuit(...), fuseau)` ;
  l'épreuve rejoue EXACTEMENT ce cas.
- **e2e (`tests/e2e/indicateurs-donnees.spec.ts`)** : scène propre, préfixée `IND9DT`, créée
  et supprimée par l'épreuve — jamais `SCENE.*`. Sept épreuves : chaque lien de tuile mène à
  une liste contenant la ligne forgée par le test (jamais un total absolu, `fullyParallel`
  oblige) ; le technicien est refusé sur les deux pages ; l'ADV y accède. Toutes vertes.
- **`CI=1 pnpm verify:full` rejoué EN ENTIER, deux fois, vert à la seconde** — la première
  passe a fait rougir `tests/e2e/barre-titres-espaces.spec.ts` (voir « Ce que j'ai tranché »
  ci-dessous) ; corrigé, puis la suite complète (format:check, typecheck, lint, test,
  test:isolation, build, feries:horizon, audit:partitions, test:e2e — 939 tests e2e passés, 7
  sautés, 0 échec) est passée intégralement vert.
- **Captures AVANT/APRÈS** (`docs/propositions/9DT-TP-MOD2-INDICATEURS-DONNEES/captures/`,
  spec `tests/e2e/captures-9dt-mod2.spec.ts`) — rejouée une fois sur un `git worktree` posé
  sur `52023991` (le commit qui précède ce lot), une fois sur le code livré. AVANT :
  `/indicateurs` et `/parametres/donnees` rendent « Page introuvable » ; le menu n'a pas
  « Indicateurs du mois » ; la section Données du hub n'a que « Imports Excel ». APRÈS : les
  deux pages à 1280 et 375 px (mois en cours et précédent pour Indicateurs), la porte Données
  du hub, une liste ouverte depuis une tuile (`/parc?origine=terrain`).

## Ce que j'ai tranché, et pourquoi

- **« Par nature », précisé (choix du pilote, consigne du 03/10 « ne reste pas bloqué »)** :
  une tuile par valeur de `TYPES_INTERVENTION` pour les planifiées et les clôturées — la
  seule notion de « nature » que le schéma porte. Les créées n'ont pas cette précision dans
  le ticket : un seul total.
- **Le sélecteur de mois est un basculement fermé à deux valeurs**, pas un calendrier libre
  — le ticket ne nomme que « mois en cours » et « mois précédent ».
- **L'entrée de menu « Indicateurs du mois » est un écart nommé à la maquette**, exactement
  le mécanisme de « Demandes » (D133) : `ECARTS_HORS_MAQUETTE`
  (`lib/navigation/entrees.ts`), et `tests/unit/navigation/entrees.test.ts` adapté « au plus
  juste » comme demandé — liste et décompte des feuilles mis à jour, rien d'autre assoupli.
- **`tests/e2e/barre-titres-espaces.spec.ts` (gardien PRÉEXISTANT, hors territoire de ce
  ticket) a été corrigé, pas affaibli.** Il mesure un écart RELATIF entre deux liens
  consécutifs d'un même domaine ; son couple de mesure était câblé en dur sur « Tableau de
  bord » / « Planning », qui ne sont plus voisins dans le DOM depuis que « Indicateurs du
  mois » s'intercale entre les deux. Le PRINCIPE du gardien ne change pas — toujours deux
  liens réellement consécutifs — seul le couple choisi suit le DOM réel (« Tableau de bord »
  / « Indicateurs du mois »). Aucune assertion assouplie, aucun seuil changé.
- **Le lien « Machines incomplètes » et le lien « Clients sans code externe » restent fermés
  à toute autre case du formulaire** (pas de `texte`, pas d'`etat`) — ce sont des DÉCOMPTES
  GLOBAUX de la société, comme `compterInterventionsSansDuree` et `famillesADeterminer`
  l'étaient déjà pour leurs propres points.

## Ce que je n'ai PAS fait

- **Aucune migration, aucune ligne de semis, aucun prix, aucune valeur inventée.**
- **Les cinq AUTRES points que l'audit MO-7 nomme** — sites sans zone/trajet, agences sans
  horaires, imports avec rejets, personne prévenu, zones sans forfait — n'ont ni ligne ni
  requête dans ce lot (territoire fermé par le ticket).
- **Aucun tableau de bord par rôle, aucun chiffre d'affaires, aucune heure, aucun taux,
  aucun export.**
- **Pas de badge/puce visible sur `/interventions` ni `/parc` pour signaler qu'un lien de
  tuile a posé un filtre caché** (le geste déjà fait pour `sans_duree_a_venir`, jamais
  étendu aux quatre filtres neufs) — le territoire du ticket limitait ces deux fichiers à
  « parametres seulement » (l'acceptation du paramètre d'URL). Une visite directe par lien
  fonctionne et filtre correctement ; une personne qui modifierait ensuite le formulaire de
  recherche sur ces écrans verrait le filtre cessé sans préavis visuel, comme c'est déjà le
  cas pour `sans_duree_a_venir`.

## Les pièges pour la session suivante

- **`bornesDuMois(mois, fuseau)` exige le fuseau**, et c'est volontaire : ne JAMAIS la
  remplacer par `instantDuJour` pour borner une colonne `DateTime` (`cree_le`,
  `cloturee_le`, tout horodatage réel) — seule une colonne `@db.Date` (`date_planifiee`)
  tolère cette simplification. Voir la note de tête de la fonction
  (`lib/calendar/fuseau.ts`).
- **Si un prochain lot ajoute une entrée de menu entre deux liens existants**, vérifier
  `tests/e2e/barre-titres-espaces.spec.ts` — il câble en dur une paire de liens « adjacents »
  pour mesurer un espacement relatif, et toute insertion entre les deux le fait rougir pour
  une raison qui n'a rien à voir avec le ticket qui l'a touché.
- **`compterSansCodeExterne` (carte du tableau de bord, KPI inline de `/clients`) n'a PAS été
  touchée** — seul `compterClients`/`rechercherClients` avec le nouveau `sans_code_externe`
  l'ont été. Les deux coexistent avec des portées différentes (l'un scope sur la recherche en
  cours, l'autre sur `sans_code_externe` seul) ; ne pas les fusionner sans mesurer les deux
  usages.
- **`SOURCES_CREATION_MACHINE` existait déjà** (`lib/machines/saisie.ts`, utilisé par le
  schéma de création) — je l'ai réutilisé pour le nouveau filtre `origine` plutôt que d'en
  recréer un ; `OrigineMachine` (type) est nouveau, ajouté à côté.

## Ce qui reste à faire

- Valider les choix du pilote écrits dans D170 (découpage « par nature », périmètre fermé de
  Données à compléter) — la décision le dit elle-même, à valider par Alexis.
- Les cinq points de MO-7 non traités (voir « Ce que je n'ai PAS fait ») — un ticket distinct,
  nommément, le jour où ils sont pris.
- Un badge visible sur `/interventions`/`/parc` quand un filtre caché (lien de tuile) est
  actif, si Alexis le juge utile — écart documenté, pas un oubli.
