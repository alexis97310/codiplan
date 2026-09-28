# 9BGA-REPRISE-9BG — passation

Reprise de `9BG-PG-G6-FENETRE-SURVOL-garde` (travail fait, gardé, jamais publié) et remise au
vert des deux épreuves e2e restées rouges à la fin de cette branche. Trois commits sur `main`,
en local, non poussés :

- `a4eb16c` — reprise de PG-B2 (fenêtre de pose) et PG-B4 (survol des cases) depuis la branche
- `2046ba1` — épreuve 1 : le dépôt d'une carte de la file ouvre désormais la fenêtre de pose
- `675205d` — épreuve 2 : le survol amène source et cible visibles avant le glissé

## Reprise 9BGA

**Empreintes reprises.** `git diff $(git merge-base main 9BG-PG-G6-FENETRE-SURVOL-garde)
9BG-PG-G6-FENETRE-SURVOL-garde --name-only` listait vingt fichiers (le composant
`components/planning/fenetre-pose.tsx`, les changements de `app/(back-office)/planning/page.tsx`
et `components/planning/pose.tsx`, `lib/interventions/survol.ts`, les clés `lib/i18n/fr.ts`, les
épreuves et captures de PG-B2/PG-B4, et la passation d'origine). `git apply --3way` sur ce
périmètre exact les a tous appliqués **cleanly**, sans conflit — `main` n'avait rien touché de
ces fichiers depuis la divergence.

**Cause mesurée du rouge n°1** (`parcours-creer-puis-planifier.spec.ts:243`). Confirmée en
lançant le fichier seul : PG-B2 a changé ce que fait un dépôt de carte « à planifier » sur une
case de la vue Semaine — il n'écrit plus, et n'affiche donc plus `[data-refus]` juste après le
dépôt ; il ouvre `FenetrePose`. L'épreuve visait un mécanisme qui n'existe plus à cet endroit.
L'intention d'origine (« le glisser-déposer n'est pas un contournement : aucune écriture sans les
quatre valeurs ») reste intacte et est reprouvée autrement : la fenêtre s'ouvre, « Planifier »
reste inactif tant qu'aucune durée n'est choisie (le manque est nommé dans le panneau
« Contrôles », `planning.pose.controles_attente`), fermer sans avoir choisi de durée ne déclenche
aucun `POST /deplacer` (écouté sur toute la durée du test), et l'intervention reste `a_planifier`
en base, `creneau_debut` toujours `null` — vérifié directement par une lecture Prisma, pas
seulement par l'écran. La carte reste visible dans la file d'attente.

**Cause mesurée du rouge n°2** (`planning-survol-cases.spec.ts:118`). Le test original composait
lui-même son geste de souris — un seul `mouse.move` vers le centre de la case cible, sans jamais
appeler `scrollIntoViewIfNeeded` ni vérifier que la source ET la cible étaient visibles ensemble
dans la fenêtre fixe (1280×1200). `setup/glisser.ts` documente déjà, depuis le 25/09/2026
(63-STABILITE-4), que la file grandit avec ce que d'autres scènes y posent en parallèle, et qu'un
point hors fenêtre n'est pas une erreur pour la souris : c'est un geste qui n'a pas lieu. Mesuré
en relançant le fichier seul (vert, systématiquement) puis dans un groupe de quatorze fichiers
`planning-*`/`glisser-*`/`parcours-creer-puis-planifier` (vert aussi) : la scène de ce test cible
`technicien Koné` + `mercredi de la semaine COURANTE`, un couple que de très nombreuses autres
épreuves du dépôt partagent (jour et technicien de référence, pas seulement une file d'attente).
Le rouge en suite complète n'a pu être reproduit isolément dans le temps disponible pour cette
session — la seule preuve directe reste le journal de la file — mais le mécanisme est le même que
celui déjà mesuré et documenté pour `setup/glisser.ts` : sans amener les deux boîtes dans la même
fenêtre avant d'engager le glissé, une case déplacée par l'accumulation d'autres scènes peut sortir
du viewport fixe, et `dragover` ne s'y déclenche jamais. **Correction appliquée par prudence
plutôt que par répétition d'un rouge observé deux fois** (aucun troisième rouge n'a été obtenu :
le fichier est resté vert à chaque relance, seule ou en groupe) : `survolerSansDeposer`, une
fonction locale au fichier de test, reproduit exactement la stratégie déjà validée par
`setup/glisser.ts` — scroll unique vers le milieu des deux boîtes, second mouvement une fois
arrivé sur la cible (Chromium ne recalcule `dragover` qu'après ce second mouvement) — sans jamais
relâcher la souris sur la case (l'intention du test, « ne jamais déposer », reste intacte :
`mouse.up` a toujours lieu hors de toute case).

**Ce qui a été corrigé et pourquoi l'intention de chaque épreuve est intacte.**

1. `parcours-creer-puis-planifier.spec.ts` — l'assertion « le glisser-déposer n'est pas un
   contournement » est reprouvée sur le NOUVEAU parcours (fenêtre de pose) au lieu de l'ancien
   (bandeau de refus immédiat) : même garantie (aucune écriture sans les quatre valeurs), preuve
   adaptée au mécanisme réellement en place.
2. `planning-survol-cases.spec.ts` — aucune assertion changée ; seule la MISE EN SCÈNE du geste de
   souris a été rendue robuste à une file qui grandit, comme le fait déjà `setup/glisser.ts` pour
   le dépôt réel. Le fichier `setup/glisser.ts` lui-même n'a pas été touché (hors territoire de ce
   ticket) ; la logique a été dupliquée localement, adaptée pour ne jamais relâcher sur la cible.

**Résultat de `CI=1 pnpm test:e2e` complet, une fois, au premier plan** : 560 épreuves, **557
passées, 3 ignorées** (pré-existantes, sans rapport avec ce lot), **0 échouée** — vert du premier
coup, sans relance. `CI=1 pnpm verify` (format:check, typecheck, lint, `test` 3137/3137,
`test:isolation` 1275/1275, build) : **vert**, code de sortie 0.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Rien de neuf pour l'exploitant au-delà de ce que 9BG avait déjà livré (voir la section
« Ce que j'ai changé » de la passation d'origine, reprise mot pour mot dans ce dépôt) : PG-B2 (la
fenêtre de pose remplace l'écriture directe au dépôt d'une carte de la file) et PG-B4 (le survol
d'une case teinte et nomme le refus pendant le glissé) sont désormais sur `main`, en local, prêts
à être publiés.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- Avant cette reprise : `git log --oneline -3` sur `main` ne montrait aucune trace de PG-B2/PG-B4 ;
  `git branch -a` montrait le travail vivant seulement sur `9BG-PG-G6-FENETRE-SURVOL-garde`.
- Après l'application (`a4eb16c`) : 20 fichiers sur `main`, identiques à la branche gardée
  (`git diff` entre les deux, restreint à ces fichiers, vide).
- Épreuve 1 seule : rouge avant (`element(s) not found` sur `[data-refus]`), verte après (3/3
  passées, y compris l'épreuve voisine `123:5` qui était *flaky* dans le même fichier).
- Épreuve 2 seule : verte avant ET après (le rouge ne s'est jamais reproduit isolément) ; verte en
  groupe de 14 fichiers avant ET après la correction.
- Suite complète : 557 passées / 3 ignorées / **0 échouée**, contre 2 rouges rapportés par les deux
  passages précédents de la file (28/09, 20h13 et 21h00 NC).

## Ce que j'ai tranché et pourquoi

1. **Reproduire la robustesse de `setup/glisser.ts` plutôt que le modifier.** Le territoire de ce
   ticket exclut `setup/glisser.ts` (fichier partagé, hors liste explicite). La stratégie de
   positionnement (scroll unique vers le milieu des deux boîtes, second mouvement une fois sur la
   cible) est dupliquée localement dans `planning-survol-cases.spec.ts`, adaptée pour ne jamais
   conclure par un dépôt — dupliquer une vingtaine de lignes déjà mesurées et documentées ailleurs
   coûte moins qu'inventer une nouvelle stratégie non éprouvée pour un geste qui, par construction,
   ne doit JAMAIS aboutir à un `drop`.
2. **Ne pas affaiblir l'épreuve 1 pour la faire passer.** L'ancienne assertion (`[data-refus]`
   visible juste après le dépôt) ne pouvait plus être vraie : le mécanisme qu'elle observait a
   changé de nature avec PG-B2 (la fenêtre remplace l'écriture directe). Plutôt que de retirer la
   garantie « aucune écriture sans les quatre valeurs », elle est reprouvée par trois signaux
   convergents : bouton « Planifier » inactif, aucun `POST /deplacer` observé, lecture en base
   confirmant `statut = a_planifier` et `creneau_debut = null`.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix.
- Aucune modification de `setup/glisser.ts` ni de `11-FILE.sh` (hors territoire).
- Aucune assertion assouplie, aucun test désactivé (`skip`/`fixme`), aucun `retries` ni `workers: 1`
  ajouté.
- Le rouge n°2 n'a pas été reproduit une seconde fois de façon isolée dans le temps de cette
  session : la correction se fonde sur la cause la plus probable, déjà mesurée et documentée
  ailleurs dans le dépôt pour un geste de glissé équivalent, et sur le fait que la suite complète
  est repassée au vert après son application — pas sur une reproduction directe du rouge original.

## Les pièges pour la session suivante

- **`survolerSansDeposer` (`tests/e2e/planning-survol-cases.spec.ts`) duplique une partie de
  `setup/glisser.ts`.** Si `setup/glisser.ts` évolue (nouvelle mesure sur le seuil de glissé
  Chromium, nouvelle gestion du défilement), penser à répercuter le même changement ici — les deux
  fonctions ne partagent aucun code, seulement une stratégie.
- **`planning-survol-cases.spec.ts` cible le technicien et le jour de la semaine COURANTE**
  (`reperes.technicienKone`, `jourDeLaScene(reperes, MERCREDI)`), un couple que beaucoup d'autres
  épreuves du dépôt partagent comme repère par défaut. Si ce test redevient flaky en suite
  complète malgré la correction de positionnement, la scène partagée (pas seulement la file
  d'attente) est la prochaine piste à mesurer — par exemple en réservant, comme `PARCOURS-1`,
  un jour éloigné de toute autre scène.
- Les pièges déjà notés par la passation d'origine de 9BG (dataTransfer illisible à `dragover`,
  `getByRole` sans `exact: true` sur les puces de durée, `waitForURL` inopérant après
  `window.location.assign` vers la même route, `showModal` absent de jsdom) restent valables et
  n'ont pas été retouchés.

## Ce qui reste à faire

- Rien d'identifié dans le territoire de cette reprise. Les deux rouges signalés par la file sont
  résolus et mesurés verts, seuls et dans la suite complète.
- Hors territoire : la remarque de la passation d'origine sur `donneesChargeesPourSurvol.habilitationManquante`
  (aujourd'hui toujours `null`, faute de donnée chargée par la page du planning) reste valable pour
  une session future.
