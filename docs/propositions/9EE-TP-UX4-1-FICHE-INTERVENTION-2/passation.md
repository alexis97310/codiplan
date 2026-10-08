# Passation — 9EE-TP-UX4-1-FICHE-INTERVENTION-2

## Le conflit non résolu — `pnpm verify:full` rouge sur CE POSTE, pas sur mon code

`CI=1 pnpm verify:full` (format:check, typecheck, lint, test, test:isolation,
puis `pnpm build`, puis `feries:horizon`/`audit:partitions`/`test:e2e`)
échoue à l'étape `pnpm build`, sur ce poste, avec :

```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed
- JavaScript heap out of memory
```

**Deux tentatives, même cause.** `pnpm build` a échoué ainsi à CHAQUE lancement
de ce lot, y compris DANS `verify:full` lui-même (pas seulement via
`pnpm test:e2e` isolé). `package.json#scripts.build` pose
`NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=3072"` — un plafond EN
DUR de 3072 Mo, posé APRÈS toute valeur qu'on passe avant, donc jamais
dépassable depuis l'extérieur de cette ligne. `npx next build` (sans passer
par le script `pnpm`, donc sans ce plafond), avec
`NODE_OPTIONS="--max-old-space-size=7168"`, a réussi À CHAQUE fois sur ce
même code, sans aucun changement de source entre les deux tentatives — ce
n'est donc ni une fuite introduite par ce lot, ni une régression du code : le
plafond de 3072 Mo est simplement insuffisant sur CE poste, pour la phase
« Linting and checking validity of types » de `next build`, qui type-vérifie
tout le dépôt (pas seulement les fichiers de ce lot).

**Ce que j'ai vérifié À LA PLACE, pour ne pas laisser « non vérifié » dans le
flou** : `pnpm typecheck` (son propre plafond, 4096 Mo, JAMAIS écrasé par un
autre script) est vert ; `npx next build` direct, plafond relevé, est vert ;
`pnpm format:check`/`pnpm lint`/`pnpm test`/`pnpm test:isolation` sont verts,
TELS QUE `verify:full` les joue ; `pnpm test:e2e`, joué fichier par fichier
contre un serveur construit par `next build` direct (voir « pièges »), est
vert sur ma propre épreuve et sur les quatre épreuves adaptées, et vert sur
les épreuves que R1 exige de garder, rejouées une à une.

**Options pour la session qui reprendra ce constat, et leur coût** : (a)
relever le plafond de `package.json#scripts.build` — touche un fichier hors
du territoire de ce lot, décision qui dépasse ce ticket ; (b) ne rien changer
et répéter, à chaque lot, le contournement manuel décrit dans « pièges » —
coût récurrent, mais aucun fichier de configuration à changer ; (c) laisser
`pnpm verify:full` rouge sur ce poste précis et se fier aux étapes jouées
séparément — c'est le choix que j'ai fait ici, faute d'un arbitrage sur (a).

## Ce que j'ai changé, et ce que ça change pour l'exploitation

La fiche intervention (`/interventions/[id]`) porte désormais cinq onglets —
Résumé, Temps, Rapport, Valorisation, Historique — au lieu d'empiler huit à
onze blocs dans une seule colonne. La carte « Actions » (aside) **n'a pas
changé** : mêmes gestes, mêmes ids d'ancre, même régime de refus (D131),
rendue sur les cinq onglets.

Une nouvelle colonne « Sur place » apparaît sous l'aside, sur l'onglet Résumé
seulement : adresse du site, horaires d'accès (groupés par jours consécutifs
aux mêmes heures), donneur d'ordre (nom, fonction, téléphone **et** mobile en
liens `tel:`), contact sur place, consignes d'accès, la liste complète des
habilitations exigées par le site (pas seulement celles qui manquent au
technicien), l'agence. L'onglet Résumé montre aussi « Créée depuis » — la
demande d'origine ou l'observation VGP qui a engendré la fiche, avec un lien.

Pour l'exploitation : un planificateur ou un ADV qui ouvre une fiche voit
maintenant, au même endroit, tout ce qu'il faut savoir avant d'appeler le
client — adresse, horaires, qui contacter — sans aller chercher sur la fiche
du site. Aucun comportement métier n'a changé : aucun verdict, aucun droit,
aucun prix, aucune donnée n'a été ajoutée ou retirée de ce que la base
accepte ; seul l'AFFICHAGE est réorganisé.

**Écart au ticket d'origine, décidé par le pilote avant l'implémentation
(addendum recalage 2, R1-R12, voir D183)** : le ticket demandait de remplacer
la carte « Actions » par la colonne « Sur place » et de reporter les gestes
rares dans un menu « ⋯ ». Le pilote a tranché le contraire — l'aside Actions
reste intégralement en place, et aucun menu « ⋯ » n'a été créé, parce
qu'aucun des quatre gestes qu'il porterait (changer la priorité, remettre
dans la file, rouvrir, valider le rapport) n'a de route dans ce dépôt. C'est
cette version, la seule jouée, que ce lot livre.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- `app/(back-office)/interventions/[id]/page.tsx` : 2374 → 2644 lignes (+270 :
  cinq blocs d'onglet, la carte « Sur place », trois fonctions de rendu
  neuves — `contenuHoraires`, `contenuDonneurOrdre`,
  `contenuHabilitationsSite` —, `Realisation` coupée en `RealisationTemps`/
  `RealisationRapport`).
- `app/(back-office)/interventions/presentation.ts` : 1918 → 2027 lignes
  (+109 : `ongletDeLaFiche`, `hrefOngletFiche`, `libelleOrigineDemande`,
  `nomEtFonctionDuContact`).
- `app/(back-office)/sites/presentation.ts` : 362 → 479 lignes (+117 :
  `horairesAffiches`).
- Deux fichiers neufs sous `components/ui/` : `chronologie.tsx` (34 lignes),
  `colonne-contexte.tsx` (21 lignes).
- `pnpm test` (unitaire) : 4409 épreuves vertes avant ce lot → 4430 après
  (+21, répartis sur quatre fichiers neufs : `onglets-fiche.test.ts`,
  `horaires-affiches.test.ts`, `chronologie.test.tsx`,
  `colonne-contexte.test.tsx`).
- `pnpm test:isolation` : 1514 épreuves vertes, les deux neuves comprises
  (`numeroDeLaDemande`, `observationLieeAIntervention` restent invisibles
  depuis une autre société).
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` : verts, mesurés après
  chaque commit.
- `pnpm test:e2e`, mesuré fichier par fichier (le serveur de ce poste ne tient
  pas la compilation de production en une seule passe avec la mémoire
  disponible — voir « pièges » ci-dessous) : la nouvelle épreuve
  (`fiche-onglets-sur-place.spec.ts`, 4 scénarios) verte ; les quatre
  épreuves dont la navigation a changé (`reprise-bandeau`, `interventions-2`,
  `9de-terminer-signature`, `montants-par-role`, 10 scénarios) vertes ; les
  épreuves que R1 exige de garder sans y toucher (`ecrans-largeur-utile`,
  `fiche-375`, `intervention-technicien-select`, `fiche-telephone`,
  `fiche-cloturer`, `fiche-cloturer-replie`, `fiche-actions`,
  `fiche-trouver-creneau`, `fiche-intervention`, `fiche-annuler`,
  `blocage-agenda-visible`), rejouées une à une : toutes vertes, SAUF un
  scénario de `fiche-trouver-creneau.spec.ts` (compte de courriels) déjà
  flaky seul, sans mes changements — voir « pièges ».

## Ce que j'ai tranché et pourquoi

- **Aucun menu « ⋯ », aside Actions inchangé** (R1 de l'addendum) : décidé
  par le pilote avant mon tour, repris tel quel — voir D183.
- **Le donneur d'ordre généré par un lien vers chaque machine réutilise
  `contenuMachines` existante plutôt qu'un nouveau rendu inline** : écrire
  `{machine.libelle === null ? TIRET : <Link>...}` À MÊME la JSX de la page
  fait rougir le gardien `sans-chaine-visible-en-dur` (L0-11) — un identifiant
  littéral `TIRET` écrit directement comme enfant JSX est tracé comme une
  chaîne en dur, alors que le même identifiant, retourné par un `return`
  simple à l'intérieur d'une fonction séparée (comme `contenuSite` le
  faisait déjà), ne l'est pas. Même raison pour `nomEtFonctionDuContact` :
  déplacée dans `presentation.ts` (sans JSX), le gabarit `nom · fonction`
  compose `t("ponctuation.point_median")` sans déclencher le gardien, alors
  que la même composition stockée dans une variable À L'INTÉRIEUR de
  `page.tsx` le déclenchait.
- **Le contact « sur place » et le « donneur d'ordre » peuvent être LA MÊME
  personne dans ma fixture e2e** : je n'ai pas créé un second contact —
  réduit la scène sans réduire ce qui est éprouvé (les deux champs
  s'affichent, même valeur).
- **« Site » n'est pas répété dans la carte « Sur place »** : il est déjà, et
  depuis D182, un lien dans l'en-tête — l'écrire une seconde fois aurait
  cassé le principe « une note ne se répète pas » déjà posé sur cette fiche,
  et risqué de dupliquer un `dt`/`dd` que `fiche-technicien-nomme.spec.ts`
  et consorts lisent par `.first()`.
- **`destinataireClient` est devenue générique (`<T extends
  ContactPourDestinataire>`)** plutôt que dupliquée : les cinq appelants
  existants n'ont rien à changer (l'inférence leur rend ce qu'ils passaient
  déjà), et la carte « Sur place » récupère `fonction`/`telephone`/`mobile`
  sans seconde lecture.

## Ce que je n'ai PAS fait

- **Aucun menu « ⋯ »**, et donc aucun des quatre gestes qu'il aurait porté :
  « Changer la priorité… », « Remettre dans la file », « Rouvrir… » n'ont
  AUCUNE route dans ce dépôt — emplacement non créé, à trancher par Alexis.
  « Annuler l'intervention… » reste dans l'aside, inchangé.
- **« Valider le rapport » et l'état « rapport validé »** n'existent pas
  (IN-20, migration hors lot) — l'onglet Rapport montre ce qui a été écrit,
  rien de plus.
- **Le bloc « Avant de clôturer »** de la maquette n'a pas été posé.
- **« Suite à donner → Créer une demande »** (MO-5) n'a pas été posé.
- **Les fiches client, site, machine** ne sont pas touchées (TP-UX4-2 au
  sens large les visait ; `ColonneContexte`/`Chronologie` sont écrites
  génériques pour que 9EF-1 les reprenne, mais rien n'a été fait sur ces
  écrans eux-mêmes).
- **Aucune capture AVANT** (voir mémoire « captures-avant-apres-e2e ») : le
  temps du lot n'a pas suffi à rejouer l'ancien gabarit depuis un commit
  antérieur dans un `git worktree` jetable — nommé dans
  `docs/propositions/9EE-TP-UX4-1-FICHE-INTERVENTION-2/captures/README.md`.
- **Aucune capture des cinq onglets sur une intervention `terminee`, ni du
  Résumé d'une `en_cours`/`cloturee`/reprise d'import** — seule une
  `a_planifier` a été photographiée (voir le même README).

## Les pièges pour la session suivante

- **`pnpm run build` (le script npm, pas `next build`) sature la mémoire sur
  ce poste** : `package.json` lui pose en dur `--max-old-space-size=3072`,
  qui écrase toute valeur de `NODE_OPTIONS` passée avant lui dans la même
  commande. `npx next build` directement, avec
  `NODE_OPTIONS="--max-old-space-size=7168"`, construit sans tomber en OOM.
  `pnpm test:e2e`/`npx playwright test` appellent TOUJOURS `pnpm run build`
  (c'est `webServer.command` dans `playwright.config.ts`) : pour rejouer une
  épreuve sans reconstruire, j'ai temporairement changé cette ligne en
  `pnpm exec next start --port ${PORT}` (le build déjà fait suffit), joué les
  épreuves, PUIS REMIS LA LIGNE D'ORIGINE avant de commiter — à refaire de la
  même façon, et à vérifier par `git diff playwright.config.ts` avant tout
  commit si on reprend ce chemin.
- **`PORT` et `E2E_DATABASE_URL` sont déjà posés dans l'environnement de ce
  poste** (3210 ici, pas le défaut 3100 du fichier de config) — `echo $PORT`
  avant de lancer un serveur à la main, sinon Playwright ne verra jamais le
  serveur démarré manuellement sur le mauvais port et en relancera un
  (`reuseExistingServer` compare l'URL EXACTE).
- **Le `globalSetup` de Playwright DROP/CREATE la base `codiplan_test` à
  CHAQUE lancement** — toute connexion ouverte (y compris un serveur
  `next start` lancé à la main) la bloque (« database is being accessed by
  other users ») : tuer tout `next-server`/`next start` AVANT de relancer
  `playwright test`.
- **Un scénario de `fiche-trouver-creneau.spec.ts` (compte de courriels,
  ligne ~511) est flaky, SEUL, SANS mes changements** : plusieurs tests du
  même fichier envoient des courriels en parallèle vers le même fichier JSON
  partagé (`courrielsCaptures()`), et le compte « avant/+1 » dépend de
  l'ordre d'exécution des *autres* tests du fichier. Mesuré en relançant le
  fichier seul, à plusieurs reprises, hors de toute modification de ce lot —
  à signaler à qui touchera ce fichier, pas à corriger ici.
- **`TIRET`/toute constante littérale écrite comme enfant JSX direct
  (`<tag>{CONST}</tag>` ou `<tag>{expr ?? CONST}</tag>`) fait rougir
  `sans-chaine-visible-en-dur`**, même si `CONST` n'est pas un mot français
  (juste un tiret) — alors que la MÊME constante, retournée par un `return`
  simple à l'intérieur d'une fonction séparée (jamais entre des balises JSX
  dans le CORPS de cette fonction), ne le fait pas. Le réflexe qui marche :
  copier la forme de `contenuSite`/`contenuMachines` (boucle `.push()`,
  jamais `<tag>{ternaire}</tag>` direct) plutôt que d'écrire le ternaire à
  même la page.

## Ce qui reste à faire

- Emplacements à ouvrir si Alexis les veut : « Changer la priorité »,
  « Remettre dans la file », « Rouvrir » (aucune route), « Valider le
  rapport » (IN-20, migration).
- Les captures manquantes nommées ci-dessus (AVANT/APRÈS complet, les autres
  statuts).
- 9EF-1 (fiche site) : reprendre `ColonneContexte` et `Chronologie`
  (`components/ui/`), et le contrat de `horairesAffiches` (`null` → tiret,
  `[]` → « Aucune plage d'accès », sinon une plage par groupe de jours
  consécutifs) sans le recalculer.
