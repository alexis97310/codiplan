# Passation — 9DHA-REPRISE-9DH

Reprise de 9DH-TP-S3-DROITS-ECRANS. Son travail était fini mais rangé sur la branche
locale `9DH-TP-S3-DROITS-ECRANS-garde` pour une raison EXTÉRIEURE au lot : la suite e2e
était rouge sur `main` nu le dimanche 04/10 (`tests/e2e/planning-laissees-sous-la-grille
.spec.ts`), corrigé depuis par `9DW-E2E-DIMANCHE` (commit `9a2f6ed`, déjà sur
`origin/main` au moment de cette reprise). Aucune fonctionnalité nouvelle, aucun
changement de comportement par rapport à la garde : ce lot rejoue, mesure, et consigne.

**Contrainte du dépôt, propre à cette session** : ce worktree (`/home/aplou/codiplan-
voie2`) ne porte pas la branche `main` — elle est extraite dans un AUTRE worktree
(`/home/aplou/codiplan`), et `refs/heads/main` est partagée entre les deux. Git refuse
tout déplacement de cette référence depuis ici (`git branch -f main …` et `git fetch .
…:main` échouent tous deux avec « cannot force update / refusing to fetch into branch
'refs/heads/main' checked out at ... »), et la consigne d'environnement interdit de force
le `cd` vers ce worktree. Les dix commits rejoués, plus les deux commits propres à cette
reprise, vivent donc sur la branche locale `9DHA-REPRISE-9DH`, partie d'`origin/main`
à jour (`9a2f6ed`) — prête à être avancée en avance rapide (fast-forward) sur `main` dès
qu'un geste humain ou la file peut le faire depuis le worktree qui la porte. Rien n'a été
poussé.

```
289bfb3 9DH-TP-S3-DROITS-ECRANS — « Déplacer » garde son régime du 20/09, seul le champ technicien disparaît
a9a6a0a 9DH-TP-S3-DROITS-ECRANS — passation
e699bda 9DH-TP-S3-DROITS-ECRANS — visuel-2.spec.ts bascule sur le compte administrateur (D153)
555abf4 9DH-TP-S3-DROITS-ECRANS — la porte d'index « agences » reste visible en lecture (D153)
94eaf6e 9DH-TP-S3-DROITS-ECRANS — /parametres/agences garde sa lecture ouverte, seule l'écriture ferme (D153)
6006ae4 9DH-TP-S3-DROITS-ECRANS — épreuves d'isolation sur les routes de paramétrage (D153)
f6de634 9DH-TP-S3-DROITS-ECRANS — IN-29 et PV-49 : trois blocs masqués plutôt que montrés refusés (D153)
eb7ff7b 9DH-TP-S3-DROITS-ECRANS — clients, sites et contacts n'offrent que ce que la route accepterait (D153)
7020af8 9DH-TP-S3-DROITS-ECRANS — les écrans de paramétrage n'offrent que ce que la route accepterait (D153)
4fdc1d3 9DH-TP-S3-DROITS-ECRANS — les routes de paramétrage portent les bons droits (D153)
```

---

## 1. Ce que j'ai changé, et ce que ça change pour l'exploitation

Rien de nouveau par rapport à la garde : les dix commits de `9DH-TP-S3-DROITS-ECRANS-
garde` ont été reportés **sans conflit**, dans l'ordre, par `git cherry-pick -x`, sur une
branche partie d'`origin/main` à jour (laquelle contient déjà `9DW-E2E-DIMANCHE`). Le
contenu fonctionnel — la décision D153, les treize routes de paramétrage sous
`exigerCapaciteComplete`, les deux capacités nouvelles (`regler_trajets`,
`consulter_clients_sites`), le régime de lecture ouverte sur `/parametres/agences`, IN-29
et PV-49, le comportement inchangé de « Déplacer » — est exactement celui décrit par la
passation déjà portée par le commit `a9a6a0a` (reportée telle quelle). Se reporter à
celle-ci pour le détail métier ; cette passation-ci ne documente que la reprise.

Pour l'exploitation : identique à ce que 9DH annonçait déjà — rien n'a changé ici.

---

## 2. Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **`git fetch origin`** puis vérification : `origin/main` contient bien `9a2f6ed
  9DW-E2E-DIMANCHE — la vue jour des laissées vise un jour ouvré, pas « aujourd'hui »`.
- **Numéros de décision** : `git grep -n "^## D15[0-9]\|^## D16[0-9]" docs/arbitrages.md`
  — avant rejeu (sur `origin/main`) : D150, D151, D152 seulement, aucun D153. Après
  rejeu : D150, D151, D152, **D153** (une seule occurrence, la section portée par
  `4fdc1d3`). Aucun doublon, aucune renumérotation nécessaire.
- **`git cherry-pick -x` des dix commits de la garde** : **aucun conflit**, les dix se sont
  appliqués proprement dans l'ordre d'origine.
- **`CI=1 pnpm verify` (hors e2e)** : vert en entier — `format:check`, `typecheck`, `lint`,
  **3910/3910 tests unitaires** (372 fichiers), **1355/1355 tests d'isolation** (149
  fichiers, y compris `tests/isolation/droits-ecrans-tp-s3.test.ts` ajouté par la garde),
  `pnpm build` vert (72/72 pages).
- **`CI=1 pnpm test:e2e`** (rejoué en entier, au premier plan, en une seule passe de
  32,6 minutes après un premier essai coupé à 30 min) : **805 passés, 7 `skip` attendus,
  0 échoué**. En particulier :
  - `tests/e2e/planning-laissees-sous-la-grille.spec.ts` — vert (le rouge nommé par la
    passation d'origine comme « hors territoire, non corrigé » est bien résolu par
    `9DW-E2E-DIMANCHE`, confirmé par ce rejeu complet).
  - `tests/e2e/intervention-technicien-select.spec.ts:263` (« Déplacer ») — vert, la
    régression que 9DH avait corrigée avant son propre commit reste corrigée après
    rejeu.
  - `tests/e2e/visuel-2.spec.ts`, `materiel-replie.spec.ts`, `ecrans-largeur-utile
    .spec.ts` (comptes de scène changés par 9DH) — verts.
- **`pnpm feries:horizon`** : vert — FR 1 agence (dernier férié 2028-12-25), NC 3 agences
  (dernier férié 2028-12-25), douze mois d'avance partout.
- **`pnpm audit:partitions`** : vert — 13 partitions couvertes jusqu'à 2027-10, partition
  par défaut présente et vide (préventif et détectif tous deux verts).
- **`CI=1 pnpm verify:full` est donc entièrement vert** à la fin de cette session (joué
  en deux appels distincts — `verify` puis `test:e2e` séparément — le second ayant dépassé
  les 30 minutes d'un seul appel ; `feries:horizon` et `audit:partitions` joués à part,
  comme le prescrit le découpage du point 4 du ticket).
- **Aucune capture** n'a été (re)générée pour ce lot : la passation d'origine de 9DH
  (`a9a6a0a`, § « Ce que je n'ai PAS fait ») indique explicitly qu'aucune capture
  AVANT/APRÈS n'existe pour 9DH — ni prise, ni couverte par un fichier de spec de
  captures dédié (`find tests/e2e -iname "*9dh*"` : aucun résultat). Il n'y a donc rien à
  « relancer » : la consigne de ce ticket sur les captures ne s'applique pas à un lot qui
  n'en a produit aucune. Les captures PNG régénérées comme effet de bord de la suite e2e
  complète (plusieurs dizaines de fichiers sous `docs/propositions/*/captures/`,
  appartenant à d'autres lots) ont été restaurées à leur état commité
  (`git restore`/`git clean`) avant tout commit — `git status --porcelain` ne listait
  plus rien d'étranger au lot avant de committer.

---

## 3. Ce que j'ai tranché, et pourquoi

- **Rejeu sur une branche locale dédiée (`9DHA-REPRISE-9DH`), pas sur `main`** : `main`
  est extrait dans un AUTRE worktree de ce dépôt (`/home/aplou/codiplan`), et
  `refs/heads/main` est une référence PARTAGÉE entre tous les worktrees — Git refuse
  explicitement de la déplacer depuis ici tant qu'elle est extraite ailleurs (testé et
  confirmé par deux mécanismes distincts : `git branch -f` et `git fetch .`). Forcer le
  déplacement aurait exigé soit de contourner la protection de Git (non fait : la
  protection existe précisément pour éviter qu'un répertoire de travail diverge
  silencieusement de la référence qu'il croit porter), soit de quitter ce worktree vers
  `/home/aplou/codiplan` — explicitement interdit par la consigne d'environnement de
  cette session (« Do NOT cd to the original repository root »). Le travail est donc
  complet et mesuré, prêt pour une avance rapide, mais **pas sur `main`** : signalé ici
  en toutes lettres plutôt que forcé en silence.
- **Pas de nouveau commit de correction** : les dix commits rejoués sont restés
  identiques à la garde (même contenu, nouveaux hachages via `-x` qui référence
  l'origine) — aucun conflit n'a exigé de trancher entre deux apports, et aucune
  régression nouvelle n'est apparue au rejeu.
- **Les deux « restes à faire » de la passation d'origine de 9DH ne sont PAS repris
  ici** (les cinq captures AVANT/APRÈS, l'investigation de
  `planning-laissees-sous-la-grille.spec.ts`, la validation du choix de lecture ouverte
  sur `/parametres/agences`) : ce ticket REPRISE a un mandat strictement borné —
  rejouer, mesurer, committer — et ni une capture ni une investigation ne sont son
  objet. Le second point est d'ailleurs déjà résolu par 9DW ; les deux autres restent
  à la charge d'un lot futur, nommés au § 6.

---

## 4. Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix, aucune logique changée —
  conformément à l'interdit du ticket.
- Aucune capture AVANT/APRÈS nouvelle (voir § 2 et § 3 : le lot d'origine n'en portait
  aucune).
- Aucune correction du point resté ouvert par 9DH lui-même (choix de lecture ouverte sur
  `/parametres/agences`, à valider par Alexis) : ce n'est pas le mandat de cette reprise.
- Rien poussé, aucune branche distante créée.

---

## 5. Les pièges pour la session suivante

- **`main` est verrouillée par un autre worktree** (`/home/aplou/codiplan`) : toute
  session future dans `codiplan-voie1` ou `codiplan-voie2` qui doit « committer sur
  main » rencontrera la même protection Git. La résolution propre est une avance rapide
  (fast-forward) de `main` vers la branche de travail, jouée depuis le worktree qui PORTE
  `main` — pas un contournement de la protection depuis un worktree secondaire.
- **Le premier appel à `pnpm test:e2e` sans `timeout` étendu est coupé à 30 minutes** : la
  suite complète prend ~33 minutes en un seul worker (812 tests, pas de parallélisation
  configurée) — prévoir un appel avec un délai plus long (jusqu'à 60 min) dès le départ
  plutôt que de perdre un premier essai.
- **La suite e2e complète régénère des dizaines de captures PNG étrangères au lot en
  cours** (tous les fichiers `captures-*.spec.ts` et autres specs à capture dispersés
  dans `tests/e2e/`) : vérifier `git status --porcelain` et restaurer/nettoyer AVANT de
  committer, sous peine d'emporter des PNG hors mandat.
- Les pièges déjà nommés par la passation d'origine de 9DH (§ « pièges ») restent valables
  à l'identique : capacités sans `○` qui ferment tout le monde, les deux specs qui ne
  rougissent qu'en groupe (`agences-etat-visible.spec.ts:199`,
  `cases-parametrage-44.spec.ts:34`), et la nécessité de `grep` le nom d'un bloc avant
  d'en changer le régime.

---

## 6. Ce qui reste à faire

Hérité tel quel de la passation d'origine de 9DH (non traité par cette reprise, hors
mandat) :

1. Les cinq captures AVANT/APRÈS demandées par 9DH (direction sur `/parametres` et
   `/parametres/taux-horaire` ; ADV sur `/parametres/trajets` ; responsable SAV sur
   `/clients/[id]` et `/sites/[id]` ; un rôle sans `modifier_planning` sur une fiche
   intervention). Les deux dernières exigent une décision d'Alexis (créer un compte
   `responsable_sav`/`responsable_materiel` dans le semis).
2. Valider avec Alexis le choix tranché par 9DH : lecture ouverte sur
   `/parametres/agences` plutôt que fermeture complète.

Propre à cette reprise :

3. **Faire avancer `main` jusqu'à `289bfb3`** (la branche locale `9DHA-REPRISE-9DH`,
   identique à `origin/main` + les dix commits de la garde) depuis le worktree qui porte
   réellement `main` (`/home/aplou/codiplan`), par une avance rapide — aucun commit
   nouveau à créer, seule la référence doit bouger.
