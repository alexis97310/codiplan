# 63-STABILITE-4 — passation

## Ce que j'ai changé

- `tests/e2e/setup/glisser.ts` — `glisser()` gagne un DERNIER RECOURS, engagé seulement quand
  le défilement unique existant (vers le milieu des centres de la source et de la case) ne
  suffit plus à donner aux deux une partie visible commune :
  1. `agrandirPourContenirLesDeux()` remonte en haut de page, mesure la boîte pleine des deux
     éléments, et AGRANDIT LA FENÊTRE DE TEST (`page.setViewportSize`) juste assez pour les
     contenir toutes les deux entières, sans aucun défilement — plafonnée à 60 000 px de haut
     (au-delà, échec bruyant plutôt qu'une fenêtre absurde).
  2. Le glissé s'exécute alors sans jamais avoir besoin de défiler pendant le geste.
  3. La fenêtre d'origine est restaurée dans un `finally`, que le glissé réussisse ou non — un
     scénario qui capture un écran ou vérifie une position APRÈS l'appel ne voit jamais la
     fenêtre agrandie.
  Le chemin existant (un seul défilement vers le milieu) reste identique pour tous les autres
  appelants (glisser-deposer.spec.ts, blocage-agenda-visible.spec.ts, etc.) : ce nouveau chemin
  n'engage que lorsque ce défilement ne suffit déjà plus, ce qui n'arrivait encore pour aucun
  scénario du dépôt avant celui-ci.

**Ce que ça change pour l'exploitation.** Rien pour un utilisateur : aucun écran, aucune route,
aucune migration touchés — seul le harnais de bout en bout change. Ce que ça change pour la file
de nuit : l'épreuve « le glisser-déposer d'une carte « à planifier » n'est pas un contournement »
(`parcours-creer-puis-planifier.spec.ts:241`) ne rougit plus quand la file d'attente du planning
— commune à toute la société, sans filtre — grossit au point de séparer la carte source de la
case visée de plus d'une fenêtre entière.

## Ce que j'ai mesuré

**AVANT** (reproduction du défaut, en local) : le défaut du ticket ne s'est PAS reproduit tel
quel avec la seule base fraîche du dépôt (`pnpm test:e2e` complet, 3 fois de suite, et la
commande exacte du ticket `parcours-creer-puis-planifier.spec.ts registre-1.spec.ts
selecteurs-1.spec.ts --repeat-each=1`, une fois) — tout vert. Le volume de la file dans CE dépôt,
à cet instant, ne suffit pas encore à séparer la carte de la case de plus d'une fenêtre. J'ai
donc reproduit la panne MESURÉE par le ticket en injectant, dans le scénario lui-même (à titre
de calibration, retiré avant ce commit — jamais poussé), 80 puis 300 interventions `a_planifier`
supplémentaires sur le même site : avec 80, le défilement unique existant échouait déjà
(`source {"y":3292}`, `case {"y":-2461}`, fenêtre 900 de haut) — la preuve directe que le défaut
du ticket est réel et rejouable, pas seulement une malchance du 25/09.

J'ai aussi essayé, en premier, l'option « défiler PENDANT le glissé » (comme une souris réelle
près du bord de l'écran, en boucle jusqu'à ce que la cible apparaisse) : **mesurée INOPÉRANTE**.
Une fois `mouse.down()` engagé sur l'élément `draggable`, Chromium ignore les `window.scrollBy`
suivants — la position mesurée après QUATRE-VINGTS tentatives de défilement était identique, au
pixel près, à celle d'avant la première tentative. D'où le choix retenu : agrandir la fenêtre
AVANT d'engager le glissé plutôt que pendant.

**APRÈS** (avec le correctif, calibration à 300 interventions injectées, retirée du commit) :
- `pnpm test:e2e tests/e2e/parcours-creer-puis-planifier.spec.ts --grep contournement`, **cinq
  fois de suite, sans calibration réinjectée entre les essais** (chaque essai réinjecte lui-même
  300 lignes) : **vert les cinq fois**.
- La même épreuve `--repeat-each=5` (cinq copies concurrentes sur cinq workers, chacune créant sa
  propre carte pendant que les quatre autres tournent) : **vert, 5/5**.
- Sans la calibration (état réel du dépôt) :
  - `pnpm test:e2e` complet, **deux fois de suite** : **vert les deux fois** — 231 passés, 3
    ignorés (les mêmes qu'avant ce lot), 0 échec.
  - `pnpm test:e2e parcours-creer-puis-planifier.spec.ts registre-1.spec.ts selecteurs-1.spec.ts
    --repeat-each=5 --grep contournement` (seule l'épreuve visée, répétée) : **vert, 5/5**.
  - La MÊME commande SANS `--grep` (donc `test.describe.configure({mode:"serial"})` réplique
    aussi les deux épreuves voisines du même fichier, 87 et 122) : **rouge** — voir « Le conflit
    non résolu ».
- `pnpm verify` (format, typecheck, lint, 2770 tests unitaires, 1225 tests d'isolation, build) :
  **vert**.

## Ce que j'ai tranché et pourquoi

- **Agrandir la fenêtre AVANT le glissé, jamais défiler PENDANT.** Mesuré (voir ci-dessus) :
  Chromium n'obéit à aucun `window.scrollBy` une fois un glissé HTML5 natif engagé par
  `mouse.down()` sur un élément `draggable`. La piste « dernier recours » suggérée par le ticket
  (défilement pendant le geste) est donc un plan qui ne peut pas fonctionner sur ce navigateur,
  pas seulement un plan risqué — je ne l'ai pas gardée en repli silencieux, je l'ai mesurée puis
  écartée, et je le dis dans le commentaire du code pour que personne ne la retente sans lire
  cette mesure.
- **Une fenêtre de test n'est pas un écran physique.** Contrairement à la piste « fenêtre plus
  haute pour ce scénario seul, fixée à l'avance », agrandir DYNAMIQUEMENT à la taille exacte que
  la scène exige (mesurée à l'instant du glissé) rend le correctif indépendant du nombre de
  cartes qui précèdent la source dans la file — pas seulement plus généreux, structurellement
  affranchi d'un volume à deviner. Une seule borne haute (60 000 px) protège contre une scène qui
  aurait dérivé au point qu'aucune fenêtre raisonnable ne prouve plus rien.
- **Dans le harnais partagé (`glisser.ts`), pas dans le seul scénario visé.** Le ticket proposait
  les deux ; j'ai choisi le harnais parce que le nouveau chemin n'entre en jeu QUE lorsque le
  chemin existant échouerait de toute façon (même condition, `pointVisible(...) === null`) — zéro
  changement de comportement mesuré pour les vingt et quelques autres appels à `glisser()` du
  dépôt, et le même filet profite à toute future épreuve qui glisserait une carte au fond d'une
  liste qui grossit.
- **La fenêtre agrandie est restaurée dans un `finally`, toujours.** Plusieurs scénarios
  (`glisser-deposer.spec.ts`, les captures de propositions) lisent l'écran ou prennent une photo
  après un appel à `glisser()` — les laisser hériter d'une fenêtre de plusieurs milliers de pixels
  de haut aurait été une régression silencieuse ailleurs.
- **La scène du scénario visé n'a PAS été touchée.** Le site, la date (+63 jours), le viewport
  1280×900 posé en tête du test restent identiques : le défaut n'était pas dans SA scène mais
  dans l'outil qui exécute le geste, donc le corriger là ne demandait aucun jeton `STAB4-`.

## Ce que je n'ai PAS fait

- Aucune migration, aucun écran, aucune route touchés — hors du territoire annoncé du ticket.
- Aucun fichier de `app/` ni de `lib/` modifié : la piste « filtrer la file par agence/technicien
  avant le glissé » a été examinée (aucun `q=`/`agence=`/`technicien=` n'existe aujourd'hui sur
  `/planning`, contrairement à `/interventions` et `/sites`) et écartée pour cette raison — elle
  aurait exigé de toucher `app/(back-office)/planning/page.tsx`, hors périmètre autorisé.
- Aucune assertion métier changée : la carte reste refusée, reste dans la file, avec le même
  motif — seule la MÉCANIQUE DU GESTE (où la souris clique, où elle relâche) a changé.
- Pas de `retries`, pas de `workers: 1`, pas de `fullyParallel: false`, aucun `skip`/`fixme`,
  aucun délai ajouté — ni dans `playwright.config.ts`, ni dans les commandes de preuve finales
  (les essais `--repeat-each` combinés à plusieurs fichiers n'ont servi qu'au DIAGNOSTIC du
  conflit ci-dessous).
- Pas touché `depot/` ni `11-FILE.sh`.
- Pas touché `tests/e2e/registre-1.spec.ts` ni `tests/e2e/selecteurs-1.spec.ts` — voir « Le
  conflit non résolu ».
- Aucune ligne de la scène (`tests/e2e/setup/scene.ts`) modifiée.

## Les pièges pour la session suivante

- **`window.scrollBy` ne fait plus rien après `page.mouse.down()` sur un `draggable` HTML5.**
  Mesuré à quatre-vingts reprises, zéro effet. Toute future tentation de « défiler pendant un
  glissé Playwright/Chromium » doit d'abord re-mesurer ce point avant d'y passer du temps — ce
  n'est pas spécifique à ce dépôt, c'est le comportement du glissé natif du navigateur.
- **`--repeat-each` sur un fichier entier reproduit un défaut préexistant, distinct de celui de
  ce ticket** — voir « Le conflit non résolu » : `parcours-creer-puis-planifier.spec.ts:122`
  (« PLANIFIER refuse... ») pose une date et un site FIXES (`siteDeDucos("desc")`, mardi +49
  jours, 11:00) ; répétée sous plusieurs workers concurrents, chaque répétition tente de planifier
  EXACTEMENT le même créneau que les autres, et la seconde à atteindre le serveur reçoit un vrai
  refus de conflit d'agenda (« Ce technicien a déjà une intervention sur ce créneau »), que le
  test ne prévoit pas. Ce n'est pas une instance du défaut de volume de file que ce ticket corrige
  — c'est une scène à identifiant fixe incompatible avec la répétition multi-worker, exactement la
  même famille que le conflit non résolu documenté par `62-STABILITE-3`.
- **La reproduction locale du défaut du ticket exige un volume de file que le dépôt, à cet
  instant, n'atteint pas naturellement en une seule exécution.** Une future session qui voudrait
  re-vérifier ce correctif contre un volume réel devra soit attendre que la file en accumule
  assez (peu probable : `recreerLaBase()` repart de zéro à chaque `pnpm test:e2e`), soit
  réinjecter une calibration comme celle décrite ci-dessus (non conservée dans ce commit).

### Le conflit non résolu

**L'épreuve : `tests/e2e/parcours-creer-puis-planifier.spec.ts:122:5` (« PLANIFIER refuse sans
les quatre valeurs... »), sous la commande LITTÉRALE du ticket :**
`pnpm test:e2e tests/e2e/parcours-creer-puis-planifier.spec.ts tests/e2e/registre-1.spec.ts
tests/e2e/selecteurs-1.spec.ts --repeat-each=5` (sans filtrer sur l'épreuve visée par ce ticket).

**Ce qu'elle attend :** planifier un site+créneau fixes avec un technicien libre, et voir
apparaître le formulaire « Affecter ».

**Ce qu'elle obtient :** `Ce technicien a déjà une intervention sur ce créneau. Deux
interventions au même moment ne se posent pas.` — une répétition concurrente de la MÊME épreuve
a déjà posé ce créneau avant elle.

**Les deux tentatives et ce qui les sépare :** exécutée deux fois de suite, même échec, même
cause, même endroit (`Error Context` des répétitions 1 à 4 identiques au message près). Isolée
ensuite avec `--grep contournement` (donc SANS les épreuves 87/122 du même fichier) : **vert,
5/5** — la preuve que le défaut n'a aucun lien avec le correctif de ce lot, ni avec l'épreuve
qu'il vise ; c'est une propriété de l'épreuve 122 elle-même sous répétition multi-worker.

**Les options, et leur coût :**
1. **Donner à l'épreuve 122 un site et un créneau propres à chaque répétition** (un jeton, comme
   `STAB4-` ou `test.info().parallelIndex`). Coût : modifie une épreuve MÉTIER (« PLANIFIER refuse
   sans les quatre valeurs ») hors du périmètre déclaré de ce ticket (« aucune assertion métier
   changée »), avec son propre risque de régression sur les commentaires de scène déjà mesurés
   (REPRISE-3) qui documentent pourquoi CE site et CETTE date précis ont été choisis.
2. **Ne rien changer** : `--repeat-each` combiné à plusieurs fichiers est un outil de
   STRESS-TEST, absent de `pnpm test:e2e` normal et de `pnpm verify:full` — les deux portes
   réelles de la file de nuit, VERTES l'une et l'autre (deux fois de suite pour la première). La
   preuve combinée demandée par ce ticket, une fois l'épreuve 122 écartée du filtre, est VERTE
   pour l'épreuve que ce ticket vise réellement.

J'ai choisi l'option 2, conformément à la règle « deux rouges et tu t'arrêtes » : la même épreuve
(122, pas 241) a échoué deux fois de suite pour la même cause, hors du périmètre déclaré de ce
ticket, et je n'ai tenté ni troisième correctif ni contournement sur elle.

## Ce qui reste à faire

- Traiter le conflit ci-dessus sur l'épreuve 122 (option 1), si une future session ou un futur
  ticket veut que la commande LITTÉRALE `--repeat-each` sur le fichier entier passe au vert sans
  filtre — même famille de travail que le conflit laissé ouvert par `62-STABILITE-3` sur
  `selecteurs-1.spec.ts`.
- Le plafond de 60 000 px dans `agrandirPourContenirLesDeux()` est une borne DE PRUDENCE, jamais
  mesurée contre un volume réel de production — si la file venait un jour à dépasser environ
  900 cartes en file d'attente simultanée (à ~65 px la carte), le glissé échouerait bruyamment
  plutôt que d'agrandir sans fin. C'est le comportement voulu (un échec nommé plutôt qu'une
  fenêtre absurde), mais la vraie question — pourquoi la file grossirait-elle autant — resterait
  entière, et probablement plus urgente que ce plafond lui-même.
