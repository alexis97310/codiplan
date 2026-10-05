# 9DID-REPRISE-9DI — passation

Reprise de 9DI-TP-TER1-JOURNEE-FICHE (D161 ; journée et fiche terrain). 5ᵉ tentative :
9DI (conflit au rebase), 9DIA (rouge x2, spec de date UTC depuis corrigé par 9D2), 9DIB
(verte, puis conflit au rebase à cause de 9D2), 9DIC (session propre, `verify:full` vert
selon sa passation, puis CONFLIT au rebase à 09:21 le 05/10 : 9DO-TP-CLI2-INTERLOCUTEURS-
RECHERCHE a été publié `dd53a36b` à 08:42 pendant sa vérification indépendante), 9DID
(cette session) — rejeu de la garde `9DIC-REPRISE-9DI-garde` sur `origin/main` à jour.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Rien de nouveau pour l'exploitation par rapport à 9DIC : ce lot REJOUE le travail déjà
écrit (journée du technicien, fiche enrichie, barre basse, profil, bandeau « compteur en
cours », messages de succès du terrain) sur un `origin/main` qui a avancé pendant la
garde (contient désormais 9DO-TP-CLI2-INTERLOCUTEURS-RECHERCHE `dd53a36b` et
9D3/9D3A-PLANNING-TECHNICIEN-ACTIONS `6533c962`, ni l'un ni l'autre connus de 9DIC).

Les 15 commits de la garde `9DIC-REPRISE-9DI-garde` (les 13 de 9DI/9DIA/9DIB rejoués par
9DIC, plus les 2 commits propres à 9DIC : la correction de `signature-route.test.ts`
alignée sur D161, et sa passation) ont été rejoués par `git cherry-pick`, un par un, dans
l'ordre chronologique, sur `origin/main` (`6533c962`). **Aucun conflit textuel** : les
deux auto-merges rencontrés (sur `lib/i18n/fr.ts`, aux deux commits qui y ajoutent des
clés) se sont résolus seuls, proprement, sans marqueur de conflit — vérifié après coup
par une recherche de clé dupliquée sur tout le fichier (aucune) et par une relecture du
diff final contre `origin/main` (additif pur, aux emplacements `terrain.*`).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Recouvrement avec 9DO, mesuré avant tout rejeu** : aucun des 16 fichiers touchés par
  9DO (`git diff --name-only 0acadfc5 dd53a36b`, hors PNG) n'apparaît dans le diff final
  de cette reprise contre `origin/main`, **à l'exception de `lib/i18n/fr.ts`** — et ce
  recouvrement est purement additif des deux côtés (9DO ajoute des clés `client.*`,
  `contact.*`, `site.*` ; 9DI ajoute des clés `terrain.*`, `captures9di*`), confirmé par
  `git diff origin/main..HEAD -- lib/i18n/fr.ts`.
- `pnpm format:check` : vert.
- `pnpm typecheck` : vert.
- `pnpm lint` (`--max-warnings 0`) : vert.
- `pnpm test` (unitaires) : **378 fichiers / 4029 tests, tous verts**, du premier coup —
  aucune régression héritée de 9DIC n'a resurgi (son unique défaut de rejeu,
  `signature-route.test.ts`, reste corrigé dans la garde et le reste corrigé ici aussi).
- `pnpm test:isolation` : **155 fichiers / 1421 tests, tous verts**.
- `pnpm build` : vert — 75 pages générées, aucune régression de build.
- `pnpm feries:horizon` : vert — XA et ZZ, dernier férié 2028-12-04, douze mois d'avance
  partout.
- `pnpm audit:partitions` : vert — 13 partitions couvertes jusqu'à 2027-10, partition par
  défaut présente et vide (préventif et détectif verts).
- `pnpm test:e2e` : **896 passés, 7 ignorés, 0 rouge**, en une seule passe de 35,9 minutes
  (le harnais de commande a accepté un délai de 60 minutes pour cette tentative, donc pas
  besoin de scinder en deux comme l'avait fait 9DIC).
  - **Premier essai** de `pnpm test:e2e` : échec au tout début de la préparation globale
    (`setup/global.ts`), `DROP DATABASE codiplan_test` refusé par PostgreSQL (code
    `55006`, « 2 autres sessions l'utilisent »). Diagnostic : un processus Playwright
    ORPHELIN (PID 2185679, parent `/init`, donc détaché de tout shell vivant), vieux de
    plus de 19 minutes, tournait encore dans CE worktree (`codiplan-voie1`) — reliquat
    d'une session précédente qui n'avait pas nettoyé ses processus enfants avant de
    rendre la main. Terminé par `kill` ciblé sur ce PID précis (jamais de `pkill -f`, qui
    aurait pu tuer le shell appelant lui-même — voir mémoire du poste). Un second
    processus actif à ce moment (`codiplan-voie2`, un AUTRE worktree) n'a pas été touché.
  - **Deuxième essai** : a dépassé la coupure à 30 minutes de l'outil (exit 143, SIGTERM
    du harnais, PAS un échec de test — aucune sortie Playwright n'a eu le temps de
    s'imprimer). Rejoué une troisième fois avec un délai de 60 minutes : vert.
- Passage mesuré le lundi 05/10/2026 à 13:15 (Nouméa, UTC+11) / 02:15 UTC (fin de la
  passe e2e qui a réussi).
- `git status --porcelain` : vide après restauration des captures étrangères régénérées
  par la suite e2e complète (124 fichiers d'autres tickets, ni modifiés ni ajoutés par ce
  lot) — vérifié juste avant chaque commit et avant de rendre la main.

## Ce que j'ai tranché et pourquoi

- **Rejouer les 15 commits de la garde tels quels, sans retrancher ni fusionner** :
  aucun des trois cas d'arbitrage prévus par la consigne (code applicatif de 9DO à
  écraser, décision D161/D160/D162/D173/D136 en jeu) ne s'est présenté — le rejeu a été
  entièrement mécanique, confirmé fichier par fichier dans `git diff --stat
  origin/main..HEAD` (49 fichiers, aucun recouvrement avec la liste 9DO sauf `fr.ts`,
  additif des deux côtés).
- **Le processus Playwright orphelin du premier essai a été tué par PID exact**, jamais
  par un `pkill` large : il appartenait à ce worktree précis (`codiplan-voie1`), était
  reparenté à `/init` (donc sans shell vivant qui l'attendait), et bloquait la suppression
  de la base de test partagée. Le laisser tourner aurait fait échouer indéfiniment
  `pnpm test:e2e` pour cette session comme pour toute session future dans ce worktree.
- **Les PNG regénérés par la suite e2e complète pour d'autres tickets** (47-AVERTISSEMENTS
  -1, 9BV-TP-A5b-DATES-REPRISE, 9D3-PLANNING-TECHNICIEN-ACTIONS, 9DF-TP-CY2-MATRICE-D8 —
  112 modifiés + 12 nouveaux) ont été écartés par `git checkout -- docs/propositions`
  puis `git clean -fd` ciblé sur ces quatre dossiers précis, jamais sur
  `docs/propositions` en bloc ni sur `9DI-TP-TER1-JOURNEE-FICHE` (dont aucune capture
  n'a bougé — l'écran n'a pas changé depuis la garde, donc rien à régénérer pour ce lot).

## Ce que je n'ai PAS fait

Aucune migration, aucune ligne de semis, aucun prix — conforme à la consigne. Aucune
fonctionnalité nouvelle : tout le contenu applicatif vient de la garde 9DIC, rejoué sans
modification. Je n'ai pas rouvert le fond des décisions D161/D165/D162/D173/D136 : aucune
n'a été touchée par ce rejeu (le conflit qui les avait fait apparaître dans `docs/
arbitrages.md` chez 9DIC n'existe plus ici, puisque 9DO ne touche pas ce fichier). Je n'ai
pas relu manuellement chaque fichier applicatif à la recherche d'un conflit sémantique
caché derrière un merge textuel propre — seule la suite `pnpm verify` complète + e2e en
fait foi, comme l'avait signalé 9DIC comme piège pour la session suivante.

## Les pièges pour la session suivante

- **Un worktree peut garder un processus orphelin d'une session précédente qui n'a pas
  nettoyé avant de rendre la main.** Si `pnpm test:e2e` échoue dès `setup/global.ts` sur
  un `DROP DATABASE … is being accessed by other users`, vérifier `ps aux | grep
  playwright` AVANT de conclure à une vraie contention inter-worktree : un PID dont le
  parent est `/init` et dont l'ancienneté dépasse largement la durée d'une suite e2e est
  un reliquat, pas une session active. Le tuer par PID exact, jamais par motif large.
- **`CI=1 pnpm verify:full` peut dépasser la coupure à 30 minutes de l'outil** rien que
  sur `test:e2e` (35,9 minutes mesurées ici, en un seul `worker` puisque `CI=1` l'impose).
  Si le harnais d'exécution accepte un délai plus long sur une commande donnée, une seule
  passe suffit ; sinon, scinder avec `pnpm exec playwright test --shard=N/2` comme l'a
  fait 9DIC — jamais `pnpm test:e2e -- --shard=…`, qui ne transmet pas l'argument.
- **La suite e2e complète régénère des dizaines de captures étrangères au lot.** Après
  `pnpm test:e2e`, toujours vérifier `git status --porcelain` et ne restaurer/nettoyer
  QUE les chemins étrangers constatés (jamais `git clean -fd .` en bloc, qui pourrait
  emporter un fichier légitime pas encore ajouté) avant de commiter.
- Ce dépôt est un worktree détaché sur `origin/main`, sans branche locale `main` ici (elle
  est occupée par un autre worktree, `/home/aplou/codiplan`) : les commits de cette
  session vivent sur la branche `9DID-REPRISE-9DI`, créée depuis `origin/main` à jour.
  Cohérent avec « la file publie » : une session future ne doit pas chercher ce travail
  sur une branche nommée `main` dans CE worktree.

## Ce qui reste à faire

Rien de fonctionnel : le contenu de 9DI-TP-TER1-JOURNEE-FICHE (D161) est maintenant rejoué
intégralement sur `origin/main` à jour (incluant 9DO et 9D3/9D3A), vérifié vert de bout en
bout (`pnpm verify` complet + `feries:horizon` + `audit:partitions` + `test:e2e`). Les
décisions D161 et D165 restent, comme avant cette reprise, à valider par Alexis — non
rouvertes par cette session. La question laissée ouverte par D161 sur la reprise d'une
absence SUSPENDUE depuis le terrain reste entière, non tranchée ici.
