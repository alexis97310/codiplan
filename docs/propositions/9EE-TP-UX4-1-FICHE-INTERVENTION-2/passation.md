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

## Reprise 9EEA (09/10/2026)

Départ : `origin/main` = `4e3004d7` (9EM-CORRECTIFS-ALEXIS-08-10 — passation),
confirmé par `git log --oneline origin/main -6` identique à l'historique
rapporté plus haut (`4e3004d7`, `6c9aa67e`, `591e912f`, `4f841e0b`, `9598cc65`,
`ec0f5ae6`). `git log --oneline origin/main..9EE-TP-UX4-1-FICHE-INTERVENTION-2-garde`
donnait les 7 commits de ce lot ; rejoués par `git cherry-pick` dans l'ordre,
SANS AUCUN CONFLIT (la garde part du même `4e3004d7`).

### La cause trouvée, en une phrase

`pnpm build` (donc `pnpm verify` et le `webServer` de `pnpm test:e2e`) échoue
par intermittence sur ce poste précis à l'étape interne « Linting and
checking validity of types » de `next build`, avec `FATAL ERROR: Ineffective
mark-compacts ... JavaScript heap out of memory`, le tas culminant
systématiquement à 3007–3024 Mo contre un plafond `--max-old-space-size=3072`
posé en dur par `package.json#scripts.build` (jamais touché) : ce n'est PAS
un défaut de ce lot (mesuré : `rm -rf .next` puis reconstruction à froid
échoue pareil ; `free -h` montre 8 Gi libres à chaque échec ; aucun autre
processus Node ne tourne). Sur une **quarantaine** de lancements de
`pnpm build` seul ou via `verify`/`webServer` pendant cette reprise, le taux
de succès observé tourne autour de 15–20 %, par rafales (plusieurs échecs
d'affilée, puis un ou deux succès) — un phénomène de bord de plafond
mémoire, pas un défaut déterministe. `pnpm typecheck` (plafond 4096 Mo,
jamais écrasé) est VERT à 100 % des essais. Conformément à la consigne du
lot (« si build manque de mémoire, relance-le... ») je n'ai PAS touché
`package.json` ; j'ai simplement persisté les relances jusqu'à un passage
complet.

Un second rouge, réel cette fois, est apparu UNE FOIS `pnpm build` tenu :
`tests/e2e/affichage-materiel.spec.ts:154` (« la fiche intervention affiche
la famille, la marque, la référence et le numéro de série ») échouait en
« strict mode violation » — `page.locator('a[href^="/parc/"]', { hasText:
referenceAttendue })` résolvait DEUX éléments. Cause : la carte « La
machine » du résumé, ajoutée par CE lot (R4 de l'addendum recalage 2),
répète le même lien `/parc/<id>` avec le même texte que le fait « machine »
de l'en-tête — un comportement VOULU (même lien, même raison que l'en-tête),
mais que ce test, écrit avant le lot, cherchait sans jamais s'attendre à le
trouver deux fois. Corrigé en ciblant le lien DANS le `<dd>` de l'en-tête
(`ligneMachine`, qui reste unique — la carte neuve utilise `<li>`, pas
`<dd>`) : le test prouve exactement la même chose qu'avant, juste au bon
endroit. Rejoué seul 3 fois après correction (`tests/e2e/affichage-materiel.spec.ts`,
6 scénarios) : vert les 3 fois (les tentatives intercalées qui ont échoué
l'ont fait au démarrage du `webServer`, avant tout test — le même OOM de
build, jamais le test lui-même).

### `CI=1 pnpm verify:full`, EN UN APPEL, intégralement vert

Passage réussi démarré à 04:48:08 (+11, Nouméa) / 17:48:08 UTC, terminé à
05:33:51 (+11) / 18:33:51 UTC le 08/10/2026 (`test:e2e` seul : 42,2 min,
1059 passés, 48 ignorés — navigateurs non installés hors Chromium, comme
avant ce lot). `format:check`, `typecheck`, `lint`, `test` (4430 vert),
`test:isolation` (1514 vert), `build`, `feries:horizon`, `audit:partitions`
tous verts dans ce même passage. Journal complet conservé sous
`/tmp/verifyfull_final4.log` (ce poste, non versionné).

### Tableau de couverture du ticket 9EE-2

Le chemin donné par la consigne de reprise, `tickets/recales/9EE-TP-UX4-1-
FICHE-INTERVENTION-2.md`, **n'existe pas dans ce dépôt** (aucun répertoire
`tickets/` ; `docs/backlog.md` ne cite pas non plus « 9EE »). La base la
plus fidèle disponible est `docs/arbitrages.md` **D183** (la décision qui
couvre explicitement ce lot et son addendum de recalage) croisée avec le
propre compte-rendu de la session 9EE-2 ci-dessus. Signalé ici plutôt que
supposé.

| Partie / choix | État |
|---|---|
| Cinq onglets Résumé/Temps/Rapport/Valorisation/Historique, `?onglet=` fermé, retombe sur Résumé | Fait (commit `f8c07165`) |
| Carte « Actions » (aside) inchangée, ancres `#action-*`, rendue sur les 5 onglets | Fait — vérifié : aucune des ancres ni le composant Actions n'apparaît dans le diff du lot |
| Aucun menu « ⋯ » (R1) | Fait — absent du code, confirmé par lecture de `page.tsx` |
| Colonne « Sur place » (`ColonneContexte`), `<div>`, jamais un second `<aside>` | Fait (commit `f8c07165`), confirmé par lecture du composant |
| Horaires d'accès groupés (`horairesAffiches`) | Fait, avec épreuves unitaires (`horaires-affiches.test.ts`) |
| Donneur d'ordre (nom · fonction, tel: / mobile), `destinataireClient` rendue générique | Fait |
| Contact sur place, consignes d'accès, agence | Fait (cité dans le compte-rendu, repris dans la carte « Sur place ») |
| Liste ENTIÈRE des habilitations exigées par le site (R-habilitations) | Fait (cité dans le compte-rendu) |
| « Créée depuis » (demande ou observation VGP) | Fait (`origineDeLaFiche`, ligne ~692) |
| « La machine » répétée dans le résumé (R4) | Fait (`contenuMachines`, section « La machine », ligne ~1040) — c'est CETTE répétition qui a fait rougir le test existant, corrigé par cette reprise |
| Note interne migrée hors de l'aside | Fait (cité dans le compte-rendu) |
| « Site » non répété dans « Sur place » (déjà dans l'en-tête) | Fait — absent de `colonne-contexte.tsx`, confirmé |
| Isolation : `numeroDeLaDemande`/`observationLieeAIntervention` cloisonnées | Fait, épreuve dédiée (commit `1a652665`) |
| Épreuve e2e dédiée (`fiche-onglets-sur-place.spec.ts`) + captures | Fait (commit `5bf69a74`) |
| D183 écrite | Fait (commit `8044227b`) |
| Menu « ⋯ » : « Changer la priorité », « Remettre dans la file », « Rouvrir » | PAS fait (aucune route dans ce dépôt — à trancher par Alexis, D183 le nomme) |
| « Valider le rapport » | PAS fait (IN-20, migration hors lot) |
| Bloc « Avant de clôturer » de la maquette | PAS fait |
| « Suite à donner → Créer une demande » (MO-5) | PAS fait |
| Fiches client/site/machine (9EF, 9EK-2) | Hors territoire — non touché, confirmé |
| Captures AVANT (gabarit pré-lot) | **Toujours PAS fait** — cette reprise a priorisé l'obtention d'un `verify:full` vert (coût déjà très élevé, voir ci-dessus) ; le temps restant du lot (limite 210 min) n'a pas suffi pour un second `git worktree` sur `4e3004d7` avec sa propre reconstruction, elle-même sujette au même OOM |
| Captures des 5 onglets sur `terminee`/`en_cours`/`cloturee`/reprise | Toujours PAS fait |

### Pièges pour la session suivante

- **Le plafond mémoire de build (`package.json#scripts.build`,
  `--max-old-space-size=3072`) est intermittent, pas seulement insuffisant**
  sur ce poste : il échoue environ 80 % des essais, mais réussit parfois
  plusieurs fois de suite. Ne pas conclure « cassé » après un ou deux rouges
  — ni conclure « réparé » après un ou deux verts. Ne JAMAIS modifier cette
  ligne sans arbitrage (hors territoire de tout lot qui n'est pas dédié à
  cette question) : c'est une décision qui dépasse un ticket d'affichage.
- **Un test qui filtre par texte visible sur toute la page (`page.locator`,
  sans portée) devient fragile dès qu'un lot répète intentionnellement un
  fait déjà affiché ailleurs** (ici : le lien machine, en-tête ET carte
  « La machine »). Le réflexe : scoper dans l'élément déjà identifié de
  façon unique (`ligneMachine.locator(...)`), jamais élargir ou committer
  `.first()` à l'aveugle — `.first()` masquerait une vraie régression si la
  carte venait à pointer vers une AUTRE machine que l'en-tête.
- **Le chemin `tickets/recales/...` cité par les consignes de reprise
  n'existe pas dans ce dépôt** — se rabattre sur `docs/arbitrages.md` (la
  décision D1xx qui cite le ticket) et la passation de la session d'origine,
  jamais inventer le contenu manquant.

### Ce qui reste à faire

- Les captures AVANT (gabarit pré-lot) et les captures des statuts
  `terminee`/`en_cours`/`cloturee`/reprise, nommées ci-dessus et dans
  `captures/README.md`.
- Les emplacements du menu « ⋯ » si Alexis les veut (D183 : aucune route
  aujourd'hui pour les trois gestes qu'il porterait).
- 9EF-1 : reprendre `ColonneContexte`/`Chronologie` pour la fiche site, sans
  recalculer `horairesAffiches`.

## Reprise 9EEB (09/10/2026)

### Ce que j'ai changé

Rien de fonctionnel : départ `origin/main` = `e6854342` (9EO-TAS-DU-BUILD,
plafond de build déjà relevé à 4096 Mo — la cause du rouge intermittent des
deux recalages précédents était donc déjà levée avant mon tour). Les 9 commits
de `9EEA-REPRISE-9EE-2-garde` (les 7 de 9EE-2 + la correction
`affichage-materiel.spec.ts` + la passation 9EEA) ont été rejoués par
`git cherry-pick`, un par un, dans l'ordre d'origine, **sans aucun conflit**
(la garde part du même point qu'`origin/main` moins le correctif de build,
déjà appliqué côté origin). Rien d'autre modifié par cette reprise elle-même.

### Ce que j'ai mesuré

`CI=1 pnpm verify:full`, en un seul appel, au premier plan, démarré à
20:01:32 UTC (07:01:32 Nouméa) le 09/10/2026, terminé à 20:47:56 UTC
(07:47:56 Nouméa) — **vert de bout en bout au premier essai**, aucun rouge,
aucune relance nécessaire : `format:check`, `typecheck`, `lint`, `test`,
`test:isolation`, `build`, `feries:horizon`, `audit:partitions` tous verts,
puis `test:e2e` : 1059 passés, 48 ignorés (42,1 min), 0 échec. Le plafond de
build relevé à 4096 Mo par 9EO a tenu du premier coup, confirmant que le
rouge intermittent des deux reprises précédentes était bien d'origine
matérielle (tas V8), pas un défaut de ce lot.

### Ce que j'ai tranché et pourquoi

- **Point 5 (captures AVANT/APRÈS des statuts `en_cours`/`terminee`/
  `cloturee`) non entrepris** : la consigne le conditionne explicitement à
  « si le temps le permet APRÈS un verify:full vert ». Un seul passage de
  `verify:full` a déjà coûté 46 minutes ; en ajouter (nouvelle épreuve e2e
  à écrire pour trois statuts, plus un second `verify:full` complet imposé
  par le point 7 après tout nouveau commit, plus la marge de 20 minutes
  réservée à la fin de session pour le rebase) aurait consommé l'essentiel
  des 210 minutes du lot pour un gain qui reste, par consigne, secondaire au
  commit obligatoire. J'ai préféré sécuriser le commit du travail déjà vert
  plutôt que risquer de tout perdre en débordant la limite.
- **D183 non retouchée** : déjà posée par 9EE-2, confirmée toujours seule à
  occuper ce numéro (`grep -n "D18[0-9]" docs/arbitrages.md` : D180-D183
  chacun un seul titre, aucun doublon, D184+ absent de ce fichier à ce jour).

### Ce que je n'ai PAS fait

- Les captures AVANT/APRÈS des statuts `en_cours`/`terminee`/`cloturee`/
  reprise d'import (point 5) — toujours manquantes, voir
  `captures/README.md`.
- Aucune autre investigation : le périmètre de cette reprise était
  mécanique (rejouer une garde déjà vérifiée verte par la session
  précédente, sur un `origin/main` qui n'avait plus besoin de correctif de
  build).

### Les pièges pour la session suivante

- **Le plafond de build à 4096 Mo (9EO) suffit** : aucun rouge rencontré sur
  ce poste pendant cette reprise, contrairement aux deux sessions
  précédentes qui tournaient à 3072 Mo. Ne pas réintroduire l'ancien
  contournement (`playwright.config.ts` modifié temporairement, rejeu
  fichier par fichier) sauf nouvelle preuve de rouge.
- Le reste des pièges nommés par 9EE-2 et 9EEA (flakiness connue de
  `fiche-trouver-creneau.spec.ts`, le gardien `sans-chaine-visible-en-dur`
  sur les constantes JSX littérales, le chemin `tickets/recales/...`
  inexistant) restent valables tels qu'écrits plus haut — rien de nouveau
  observé ici.

### Ce qui reste à faire

- Les captures AVANT/APRÈS complètes (point 5), nommées ci-dessus et dans
  `captures/README.md`.
- Les emplacements du menu « ⋯ » si Alexis les veut (D183).
- 9EF-1 : reprendre `ColonneContexte`/`Chronologie` pour la fiche site.
