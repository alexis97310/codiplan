# 9DIA-REPRISE-9DI — passation

## Ce que j'ai changé

Rien de fonctionnel : ce lot rejoue sur `main` à jour (origin : `5c710f6`, après la publication de 9DM) le travail déjà fini et vert de 9DI-TP-TER1-JOURNEE-FICHE, resté bloqué sur la branche locale `9DI-TP-TER1-JOURNEE-FICHE-garde` parce que son rebase avait croisé la publication de 9DHA-REPRISE-9DH (`d358ba6`, D153 — droits d'écran et de route TP-S3) pendant sa vérification indépendante.

Les sept commits de la garde ont été rejoués par `git cherry-pick`, dans l'ordre, sans aucune modification de leur contenu ni de la branche garde elle-même :

1. `9DI — retouches R1/R2 de la relecture de 9DG`
2. `9DI — journée, fiche, compteur et barre basse du technicien`
3. `9DI — D161, décision QE-11 : journée et fiche du technicien`
4. `9DI — épreuve de bout en bout de la journée et de la fiche`
5. `9DI — adapte trois épreuves existantes aux libellés et à l'URL que ce lot change`
6. `9DI — captures AVANT/APRÈS de la journée, de la fiche, du profil et de la barre basse`
7. `9DI — passation`

Pour l'exploitation : le terrain gagne sa barre basse (« Journée » / « Profil »), la fiche terrain affiche désormais priorité, créneau, panne signalée, machines et contact joignable, le bandeau « compteur en cours » et le verdict serveur sur le bouton du compteur — exactement ce que décrit D161. Rien de cela n'est neuf par rapport à ce que 9DI avait déjà livré ; ce lot ne fait que le poser sur la base la plus récente.

## Ce que j'ai mesuré

**Le seul conflit réel** était dans `docs/arbitrages.md` : D153 (9DH, déjà sur `main`) et D164 (9DM, déjà sur `main`) occupaient la place où le cherry-pick de D161 (9DI) voulait s'insérer. Aucun des trois textes n'a été modifié — j'ai simplement retiré les marqueurs de conflit et remis une ligne vide entre D164 et D161. Les trois décisions coexistent désormais dans l'ordre D153, D164, D161 (non numérique, mais c'était déjà l'ordre choisi par 9DM avant moi — D164 avait été écrite avant D161 textuellement sur `main`). Aucun numéro en double :

```
AVANT (sur origin/main)  : D150, D151, D152, D153, D164
APRÈS (après le rejeu)   : D150, D151, D152, D153, D164, D161
```

Aucun autre fichier n'est entré en conflit (les six autres commits se sont rejoués avec au plus un auto-merge silencieux sur `lib/i18n/fr.ts` et `lib/interventions/depot.ts`).

**`pnpm verify`** (format, typecheck, lint, 1366 tests unitaires, isolation, build) : vert. Un faux rouge de `tsc` au premier essai venait d'un `.next/` périmé laissé par une session antérieure dans ce worktree (deux routes supprimées depuis, `mot-de-passe-oublie` et `envoyer-acces`) ; `rm -rf .next` l'a résolu — rien à voir avec le rejeu.

**`pnpm feries:horizon`** : vert (2 territoires, horizon jusqu'à 2028-12-04). **`pnpm audit:partitions`** : vert (13 partitions couvertes, partition par défaut vide).

**`pnpm test:e2e`** : la commande entière dépasse les 30 minutes sous `CI=1` (`workers: 1` imposé en CI, `playwright.config.ts:79`) et se fait couper par le tampon de session. Scindé en deux passes avec `--shard=1/2` et `--shard=2/2`, comme prévu par la consigne :
- shard 1/2 : 414 passed, 4 skipped, 16.4 min
- shard 2/2 : 415 passed, 3 skipped, 18.7 min
- **829 passed, 7 skipped, 0 failed** au total.

**La spec de captures de 9DI** (`tests/e2e/captures-9di-tp-ter1-journee-fiche.spec.ts`) a été rejouée seule après le rejeu complet : 8 passed. Les PNG produits sont **octet pour octet identiques** à ceux déjà portés par le commit 6 (`git status` ne signale aucune différence sur `docs/propositions/9DI-TP-TER1-JOURNEE-FICHE/captures/`) — les captures AVANT/APRÈS correspondent donc bien au code rejoué, sans qu'aucun fichier n'ait eu besoin d'être remplacé.

**Effet de bord repéré et annulé** : lancer la suite e2e complète (les deux shards) régénère, en l'écrasant, le PNG de nombreuses specs de capture d'AUTRES lots (47-AVERTISSEMENTS-1, 48-FICHE-360-1, 50-INTERVENTIONS-2, … jusqu'à 9DW et AVERT-POSE-FICHE — 91 fichiers suivis, et 4 fichiers neufs apparus sous 47-AVERTISSEMENTS-1 et 9BV-TP-A5b-DATES-REPRISE). Ces fichiers n'ont **pas** été ajoutés : les 91 fichiers suivis ont été restaurés par `git checkout --`, les 4 fichiers neufs supprimés. `git status --porcelain` était vide avant le commit final.

## Ce que j'ai tranché et pourquoi

**Le conflit de `docs/arbitrages.md` n'opposait pas une règle de D153 à un affichage de 9DI** : les deux décisions ne se recouvrent pas (D153 porte sur les droits d'écran des routes de paramètres/clients/sites/VGP ; D161 porte sur la coque terrain — barre basse, fiche, compteur). Le conflit était purement positionnel (deux ajouts au même endroit du fichier), pas sémantique. Je n'ai donc pas eu à faire primer D153 sur un affichage de 9DI, comme le redoutait la consigne — rien dans le code rejoué de 9DI ne touche aux capacités ou aux routes que D153 a changées.

**J'ai gardé l'ordre textuel D153 → D164 → D161** plutôt que de réordonner par numéro : la consigne de reprise demande seulement qu'aucun numéro ne soit dupliqué et que les deux décisions coexistent, pas un tri numérique du fichier — et le fichier portait déjà D164 avant D153 dans l'ordre des tickets malgré le numéro, donc l'ordre n'y est pas strictement croissant par construction.

**J'ai séparé `test:e2e` en deux shards** plutôt que de relancer la commande entière une seconde fois après une première coupe : la consigne du lot anticipait explicitement ce cas (« en deux passes si l'outil coupe à 30 min »), et Playwright expose `--shard` nativement pour cet usage, sans toucher `playwright.config.ts` ni `workers: 1`.

**J'ai restauré les captures étrangères plutôt que de les laisser dans l'arbre** : la consigne du lot l'interdit explicitement (« n'ajoute pas les captures régénérées d'autres lots »), et ces PNG ne sont pas des épreuves de non-régression visuelle figées — chaque exécution de leur spec les réécrit, qu'il y ait eu un changement visuel ou non. Les laisser aurait pollué ce commit avec 95 fichiers sans rapport avec 9DI.

## Ce que je n'ai pas fait

Aucune fonctionnalité nouvelle, comme demandé. Je n'ai touché à aucune migration, aucune ligne de semis, aucun prix. Je n'ai pas réécrit la branche `9DI-TP-TER1-JOURNEE-FICHE-garde` (elle reste intacte, pour mémoire). Je n'ai pas réordonné numériquement `docs/arbitrages.md`. Je n'ai pas poussé : tout reste commité en local, sur l'arbre qui part de `origin/main`.

## Les pièges pour la session suivante

**`pnpm test:e2e` sous `CI=1` dépasse 30 minutes** (deux fois ~17-19 min en deux shards de 418 tests chacun, `workers: 1` forcé en CI) — toujours scinder avec `--shard=N/2` plutôt que de relancer la commande entière en espérant qu'elle rentre dans la fenêtre.

**Lancer la suite e2e complète réécrit, par effet de bord, les PNG de captures AVANT/APRÈS de dizaines de lots antérieurs** même quand rien n'a changé visuellement (chaque spec de capture reprend sa propre scène et réécrit son fichier à chaque exécution). Après tout `test:e2e` complet, vérifier `git status --porcelain` et restaurer (`git checkout --`) tout fichier `captures/*.png` étranger au ticket en cours avant de committer — ne jamais supposer que `git status` vide après un commit signifie qu'aucun nettoyage n'était nécessaire.

**Un `.next/` périmé dans un worktree partagé peut faire rougir `tsc` sur des routes qui n'existent plus** (`mot-de-passe-oublie`, `envoyer-acces` ici) : un `rm -rf .next` avant `pnpm verify` est un réflexe sûr quand le typecheck accuse un module introuvable qui n'apparaît dans aucun `grep` du dépôt.

**`main` est parfois détenu par un autre worktree** (`/home/aplou/codiplan` ici) : impossible d'y checkout localement depuis ce worktree. Travailler en HEAD détachée à partir de `origin/main` à jour fonctionne pour accumuler les commits de reprise ; c'est la file (`11-FILE.sh`) qui les publie, pas cette session.

## Ce qui reste à faire

Rien côté 9DI/9DIA : le lot est maintenant rejoué, vert (`pnpm verify`, `pnpm feries:horizon`, `pnpm audit:partitions`, `pnpm test:e2e` en deux shards, captures 9DI revérifiées), et commité. Les points laissés ouverts par D161 elle-même demeurent (reprise d'une SUSPENDUE depuis le terrain, question posée à Alexis — non tranchée ici, comme dans 9DI d'origine) et les entrées « Machines »/« Scanner » de la barre basse, qui arriveront avec TP-PARC.
