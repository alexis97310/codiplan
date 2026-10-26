# 9G4A-DIALOGUE-CONFIRMATION-ABSENCES — passation (arrêt à T0 + 50 min)

Parti d'`origin/main` (`73cde17a7`), branche dédiée `9g4a-dialogue-confirmation-absences`
créée depuis ce commit — `main` est extrait dans un autre worktree
(`/home/aplou/codiplan`). T0 mesuré `18:04` (Pacific/Noumea). **Cause non trouvée à
T0 + 50 min (18:54)** : conformément à la consigne « arrêt immédiat », aucune correction
n'a été tentée. Ce document ne porte que ce qui a été mesuré.

## Ce qui a été reproduit

`CI=1 pnpm exec playwright test tests/e2e/absences-levee-confirmation.spec.ts
tests/e2e/9ewb1-feuille-basse-375-menu-plus.spec.ts --workers=1 --repeat-each=10`,
rejoué quatre fois (`--repeat-each` 5 puis 10, deux fois chacun) :

- Les deux fichiers **ensemble** : le défaut apparaît — entre 1 et 3 échecs sur
  10 répétitions, tantôt sur `9ewb1-feuille-basse-375-menu-plus.spec.ts:438` (1280 px),
  tantôt sur `absences-levee-confirmation.spec.ts:150`.
- `absences-levee-confirmation.spec.ts` **seul**, 15 répétitions au total (5 puis 10) :
  **zéro échec**. Le défaut n'est donc pas intrinsèque à ce fichier seul — il dépend de
  l'exécution combinée avec `9ewb1-feuille-basse-375-menu-plus.spec.ts` dans le même
  worker (processus navigateur), bien que chaque test y ouvre sa propre page/contexte.

## Ce qui a été mesuré par instrumentation (dans une copie de travail, jamais commitée)

Les deux specs ont été temporairement instrumentés (`page.on("console")`,
`MutationObserver` sur `document.body` guettant l'ajout/retrait d'un `<dialog>`,
écouteur `close` posant la pile d'appel, écouteur `resize` et `visibilitychange`,
`page.on("request")` filtré puis non filtré) — **jamais commité**, retiré par
`git checkout --` avant de rendre la main (le dépôt est propre : `git status
--porcelain` vide à la fin).

Instantané du passage qui échoue (test `9ewb1-feuille-basse-375-menu-plus.spec.ts:438`,
1280 px), dans l'ordre exact :

```
DEBUG avant screenshot, open= true
DEBUG dialog removed from DOM, open-attr=true     ← retiré alors qu'il était OUVERT
DEBUG dialog ADDED to DOM
DEBUG dialog ADDED to DOM                          ← DEUX <dialog> réapparus
DEBUG dialog removed from DOM, open-attr=false     ← l'un des deux repart aussitôt
DEBUG apres screenshot, open= false
```

Ce n'est **pas** un appel à `.close()` ni une touche Échap : le nœud `<dialog>` est
retiré du DOM **pendant qu'il porte encore l'attribut `open`**, puis DEUX nouveaux
`<dialog>` sont ajoutés (cohérent avec les deux instances `coteLargeur="large"` /
`coteLargeur="etroit"` de `BoutonAvecConfirmation` qui remontent toutes les deux avant
que l'effet `matchMedia` de chacune ne retranche la mauvaise), puis l'une des deux
redisparaît. **C'est la signature d'un REMONTAGE React de tout le sous-arbre
`ActionDeLaLigne`**, pas une fermeture du dialogue au sens de l'API `<dialog>`.

## Pistes écartées, avec leur preuve

1. **Le `coteLargeur`/`matchMedia` (901 px) lui-même, isolément** — écarté : aucun
   `DEBUG window resize event` n'est loggé dans l'épisode ci-dessus (l'écouteur
   `resize` posé sur `window` est muet), et `innerWidth`/`matches901` sont restés
   identiques dans les passages instrumentés où ils ont été lus explicitement. La
   largeur ne bouge pas : la bascule de montage que ce prop pilote n'a donc pas de
   cause à ce niveau.
2. **`page.setViewportSize`** — écarté pour CE test précis : le test
   `9ewb1-feuille-basse-375-menu-plus.spec.ts:438` ne rappelle `setViewportSize` qu'une
   fois, avant `page.goto`, jamais après ; son `capturer()` (lignes 272-282) ne fait
   qu'un `page.screenshot`, sans toucher au viewport. Le remontage survient donc sans
   AUCUN changement de taille de fenêtre, observé ou provoqué.
3. **`visibilitychange`** — écarté : l'écouteur posé reste muet dans l'épisode mesuré.
4. **Une requête réseau vers `/absences` (un `router.refresh()` ou une revalidation
   Next.js du contenu de la page)** — écarté pour l'URL courante : `page.on("request")`
   filtré sur `/absences` ne logge rien dans l'épisode ; non vérifié en revanche pour
   une requête vers une AUTRE route (le filtre large, non restreint à `/absences`,
   n'a pas été rejoué avant la limite de budget — voir point ouvert ci-dessous).
5. **Un minuteur (`setInterval`/`setTimeout`) posé par un composant client visible sur
   `/absences`** — `grep` sur tous les composants `"use client"` du dépôt qui posent un
   minuteur (`menu-plus.tsx`, `selecteur-recherche.tsx`, `recherche-globale.tsx`,
   `planning/pose.tsx`, `terrain/*`, `machines/actions-qr.tsx`) : aucun n'est monté sur
   `/absences` d'après une lecture de `app/(back-office)/absences/page.tsx` et de ses
   imports directs. `DecompteLecture` (le seul composant propre à cet écran qui aurait
   pu porter un minuteur) est un composant purement statique (lu : aucun hook, aucun
   effet). Piste affaiblie, non éliminée avec certitude (un minuteur posé plus haut
   dans la mise en page globale, `components/navigation/barre.tsx`, pose bien un
   écouteur `resize` — lu, mais celui-ci ne fait QUE relire `window.innerWidth` dans son
   propre état local, sans toucher au contenu de la page ; rien dans ce fichier ne
   pose de minuteur).
6. **Isolé du fichier voisin** : `absences-levee-confirmation.spec.ts` rejoué SEUL
   15 fois (5 + 10 répétitions, deux sessions) ne reproduit jamais le défaut — seule
   l'exécution COMBINÉE avec `9ewb1-feuille-basse-375-menu-plus.spec.ts` le fait
   apparaître, et de façon irrégulière (pas à chaque répétition combinée). Chaque test
   Playwright ouvre sa propre `page` (et, par défaut, son propre contexte de navigateur)
   — il n'y a donc pas de partage direct évident de mémoire JS entre les deux fichiers,
   mais les deux PARTAGENT le même worker Node (le processus serveur Next lui-même, et
   le processus Playwright qui pilote le navigateur), et surtout la MÊME base
   `/absences` peut porter SIMULTANÉMENT les deux blocages forgés par les deux fichiers
   (chacun crée le sien en `beforeAll`, le détruit en `afterAll`, sans coordination
   entre fichiers) — piste non instrumentée jusqu'au bout avant la limite de budget.

## Ce que `docs/propositions/9G3-TITRES-CIBLES-ACTIONS/passation.md` avait déjà noté

Confirmé à nouveau ici : `git diff` sur `components/ui/bouton-confirmation.tsx`,
`components/ui/feuille-basse.tsx` et `app/(back-office)/absences/page.tsx` entre
`9G9E` (dernier point sans cette instabilité) et `HEAD` n'est pas vide — 9G2 (543efc282)
et 9G2A (f85c21ad3) touchent bien `absences/page.tsx` et `bouton-confirmation.tsx` (voir
leurs diffs complets relus dans cette session) — mais la mécanique `coteLargeur` qu'ils
introduisent n'est PAS mise en cause par la mesure 1 ci-dessus (aucun changement de
largeur observé pendant l'épisode). La remarque du 9G3 (« flake pré-existante, pas une
régression de 9G3 ») reste cohérente avec ce qui est mesuré ici : le défaut existe
indépendamment des changements de 9G3, mais sa cause réelle est plus profonde qu'un
simple diff de fichier — un remontage React déclenché par quelque chose qui n'a pas pu
être identifié dans ce budget.

## Point ouvert pour la prochaine reprise

1. Rejouer avec `page.on("request")` **non filtré** (toute URL, pas seulement
   `/absences`) pendant l'exécution combinée, pour vérifier si une requête de
   préchargement (`next/link` prefetch d'une entrée de la colonne de navigation,
   visible en permanence sur cet écran, D121) coïncide avec le remontage.
2. Vérifier si les DEUX fichiers, exécutés dans le MÊME worker CI (`workers=1`),
   partagent une connexion Prisma/un état de processus serveur Next qui pourrait, à
   l'arrivée d'une requête concurrente (l'autre fichier qui navigue vers `/absences`
   presque au même instant, les deux à un seul worker mais potentiellement
   chevauchant côté serveur Next lui-même, qui lui n'est pas mono-thread), déclencher
   une invalidation du cache de rendu côté serveur pour `/absences` — auquel cas le
   remontage observé serait une conséquence d'une revalidation Next.js du contenu de
   LA MÊME ROUTE, demandée par l'AUTRE fichier au même moment, et non par le test qui
   échoue lui-même (expliquerait pourquoi `absences-levee-confirmation.spec.ts` seul
   ne reproduit jamais rien : il n'a alors aucun concurrent sur `/absences`).
3. Si la piste 2 se confirme, la correction à chercher serait côté révalidation/cache
   de la route `/absences` (ou dans la stabilité de clé des deux instances
   `coteLargeur` de `BoutonAvecConfirmation` face à un remontage du parent, pour que
   l'état `dialogueOuvert` survive), PAS dans la détection de largeur elle-même
   (`coteLargeur`), qui n'est pas en cause d'après la mesure 1.

## `CI=1 pnpm verify`

Non rejoué dans cette session : aucune ligne de code applicatif n'a été modifiée (toute
l'instrumentation a été retirée). `git status --porcelain` est vide au moment de
rendre la main — seul ce document est nouveau.
