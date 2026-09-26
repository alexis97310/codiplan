# 9AA-GR11-CLIENT-MACHINE — passation

## Ce que j'ai changé

Une colonne « Machine » sur l'historique des interventions de la fiche client
(`app/(back-office)/clients/[id]/page.tsx`), posée **après** la colonne « Site »
et avant « Statut ». Pour chaque ligne, elle rend un lien vers `/parc/<id>` par
machine rattachée — désignation complète (famille, marque, référence, n° de
série), séparées par une virgule quand une intervention en porte plusieurs ;
une intervention sans machine rend le signe d'absence (`—`), jamais une cellule
muette. Les libellés viennent d'une **seule lecture groupée**
(`donneesMaterielDesMachines`) sur les `machine_id` des lignes de la PAGE
COURANTE — jamais une requête par ligne — et composés par
`libelleMaterielComplet`, la même fonction déjà servie par la fiche
intervention et la carte de planning.

Pour l'exploitation : un directeur qui cherche l'historique d'une machine
précise depuis la fiche de son client n'a plus besoin d'ouvrir chaque
intervention une à une pour savoir laquelle la porte — la colonne le dit, et le
lien mène directement à la fiche machine.

Aucune migration, aucune ligne de semis, aucune règle de gestion touchée.

## Ce que j'ai mesuré

- **Captures AVANT/APRÈS** (`docs/propositions/9AA-GR11-CLIENT-MACHINE/captures/`),
  à 1280 et 375 px, prises par `tests/e2e/historique-client-machine.spec.ts`
  (env `CAPTURES_GR11_CLIENT_MACHINE`) : une fois avec l'ANCIEN
  `page.tsx` (obtenu par `git show HEAD~1:...` et temporairement remis en place
  sur le disque, avant d'être restauré), une fois avec le code livré. L'AVANT
  ne porte aucune colonne « Machine » ; l'APRÈS porte le lien
  `Ponts élévateurs Ravaglioli KPX-337 S/N ERGO11-SN-04471` vers `/parc/<id>`.
- Le scénario e2e neuf, joué sur l'ANCIEN code, rougit exactement à
  l'assertion attendue (`toBeVisible()` sur le lien `/parc/<id>` : élément
  introuvable) — jamais avant, jamais sur une autre assertion. Joué sur le
  code livré, il est vert (1 passed).
- `pnpm format:check`, `pnpm typecheck`, `pnpm test` (272 fichiers, 2927 tests)
  et `CI=1 pnpm verify:full` en entier (format, typecheck, lint, tests
  unitaires, cloisonnement, build, fériés, partitions, 320 scénarios e2e dont
  3 sauts connus) : tous verts, y compris `tests/e2e/historique-client.spec.ts`
  (l'épreuve existante de la pagination), qui reste inchangée.

## Ce que j'ai tranché et pourquoi

- **`minimum="1000px"`** sur le tableau de l'historique (au lieu de `820px`) :
  la nouvelle colonne (`largeur: "220px"`) aurait autrement resserré les
  colonnes existantes sous leur largeur mesurée ailleurs dans le produit.
- **Réutilisation totale** de `donneesMaterielDesMachines` (`lib/machines/depot.ts`)
  et `libelleMaterielComplet` (`lib/machines/presentation.ts`), déjà écrites
  pour la fiche intervention et la carte de planning (AFFICHAGE-MATERIEL-1) :
  un troisième critère de libellé aurait fait diverger la forme affichée d'un
  écran à l'autre (§9, 01/09).
- **`machinesIdentifiees`** (`app/(back-office)/interventions/presentation.ts`,
  déjà exportée pour la fiche intervention) plutôt qu'une seconde fonction
  locale de résolution `machine_id → libellé` : même contrat, même fichier
  d'origine.
- **Une seule lecture groupée sur les machines de la PAGE COURANTE**
  (`interventions`, la variable déjà paginée), jamais sur la totalité de
  l'historique du client ni sur la ligne "dernière intervention" du bloc de
  synthèse (qui ne montre pas la machine) : conforme à la contrainte du
  ticket, et à la même discipline que le matériel des cartes de planning
  (`AFFICHAGE-MATERIEL-1`), qui ne lit que les lignes affichées.
- **`lib/i18n/fr.ts` non touché** : la clé `intervention.machine` existait
  déjà (servait la fiche intervention) et porte exactement le mot attendu
  pour l'en-tête de colonne.
- **Scène e2e à part** (`tests/e2e/historique-client-machine.spec.ts`), plutôt
  qu'un ajout à `historique-client.spec.ts` : ce dernier reste l'épreuve de la
  PAGINATION (treize interventions, deux pages) ; mélanger une machine dans
  cette scène en aurait changé la population comptée par ses propres
  assertions. Une intervention suffit ici, et — depuis PARCOURS-1 — une
  intervention ne porte qu'une seule machine au plus
  (`@@unique([intervention_id])` sur `intervention_machine`).

## Ce que je n'ai PAS fait

- Je n'ai touché ni `lib/interventions/depot.ts` (interdit par le ticket), ni
  `depot/`, ni `11-FILE.sh`.
- Je n'ai pas ajouté de filtre machine sur `/interventions` ni de lien
  supplémentaire depuis `/parc` vers l'historique client — hors territoire.
- Je n'ai pas cherché à afficher la machine sur le compteur « Dernière
  intervention » du bloc de synthèse (`BlocSyntheseClient`) : le ticket ne le
  demande que sur le tableau de l'historique.

## Les pièges pour la session suivante

- Les captures AVANT ont exigé de swapper temporairement le fichier
  `app/(back-office)/clients/[id]/page.tsx` sur le disque avec l'ancienne
  version (`git show HEAD~1:...`), sans jamais committer ce retour arrière :
  après la capture AVANT, le fichier a été restauré à l'identique du commit
  livré (vérifié par `git diff --stat`, vide) avant de relancer les tests.
- `reuseExistingServer` (`playwright.config.ts`) ne relance JAMAIS le serveur
  `next start` s'il tourne déjà sur le port 3100 : entre l'AVANT et l'APRÈS,
  vérifier qu'aucun `next-server`/`next start` ne survit (`pgrep -fa
  next-server`) avant de relancer, sinon la capture APRÈS montrerait encore
  l'ancien code compilé.
- `E2E_DATABASE_URL` était déjà exportée dans le profil du poste (comme
  `TEST_DATABASE_URL`) : ni l'un ni l'autre n'est dans `.env`.

## Ce qui reste à faire

Rien d'identifié dans le périmètre de ce ticket. Le gain GR11 de l'audit du
26/09/2026 (constat G14) est livré.
