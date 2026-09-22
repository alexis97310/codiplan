# DOC-2 — passation

## 1. Ce que j'ai changé

- **`scripts/lib/sommaires.ts`** (nouveau). La logique de lecture d'un sommaire
  (`bornesDuSommaire`, `titresDuCorps`, `entreesDuSommaire`, `repertoiresAvecLigne`,
  `SEUIL_LIGNES_SOMMAIRE`, `FORME_LIGNE`) que DOC-1 avait écrite UNE FOIS, dans
  le gardien, est déplacée ici — plus une fonction neuve, `regenererBlocSommaire`,
  qui recalcule le contenu d'un sommaire et le réécrit en laissant tout le reste
  du fichier (y compris une note posée avant le marqueur) octet pour octet
  identique. Une seule implémentation, importée à la fois par le gardien et par
  le script de régénération — sinon j'aurais recréé le défaut que le fichier
  voisin nomme lui-même : « deux lectures d'un même critère divergent en
  silence ».
- **`scripts/regenerer-sommaires.mts`** (nouveau). Le script que DOC-1 avait
  nommé manquant dans sa passation (§6 : « un script PERMANENT qui régénère le
  sommaire par lignes de `organisation-du-code.md` n'existe pas »). Il
  régénère les DEUX sommaires du dépôt (`organisation-du-code.md` par ligne,
  `README.md` par titre), est idempotent (rejouer sur un fichier à jour
  n'écrit rien), et refuse si un sommaire recalculé est vide. Branché dans
  `package.json` sous `pnpm sommaires:regenerer`, et nommé dans les deux
  documents qu'il régénère (une note juste avant chaque marqueur `Sommaire`).
- **`docs/constitution/organisation-du-code.md`.** Une phrase ajoutée avant
  `### Sommaire`, nommant la commande de régénération et le gardien qui
  confronte. **Aucune autre ligne normative touchée** — le bloc de code de
  l'arborescence reste octet pour octet identique (vérifié, §2), seuls les 36
  numéros de ligne du sommaire ont été recalculés (ils avaient tous décalé de
  +2, à cause de la note que je viens d'insérer juste au-dessus).
- **`README.md`.** Un sommaire neuf (`## Sommaire`, 89 entrées : les 58 titres
  `##` et 31 titres `###` du document, à plat, dans l'ordre où ils apparaissent),
  précédé de la même note de régénération, inséré entre le paragraphe
  d'introduction et `## Documentation`. Aucune ligne existante déplacée,
  résumée ou reformulée — vérifié (§2).
- **`tests/unit/docs/constitution-indexee.test.ts`.** Étendu, pas réécrit : il
  importe désormais la logique de sommaire depuis `scripts/lib/sommaires.ts`
  au lieu de la définir. Deux épreuves à mutation (`ligne 66→67`,
  `auth/→authx/`) portaient des numéros codés en dur ; ils ont dû être
  actualisés (66→68, 112→114) parce que MA PROPRE note ajoutée dans
  `organisation-du-code.md` a décalé tout le fichier de deux lignes — la
  preuve la plus directe que le gardien recalcule vraiment depuis le fichier
  réel : la commande a échoué avant que je ne corrige les deux valeurs (§2).
- **`tests/unit/docs/readme-indexe.test.ts`** (nouveau). Même forme que le
  gardien voisin appliqué à `erreurs-a-ne-pas-refaire.md` (sommaire à titres,
  bidirectionnel), mais pour `README.md` — niveaux `##`/`###` au lieu de
  `###`/`####`, marqueur `## Sommaire`. 9 tests, dont deux épreuves à mutation
  et un test de non-vacuité.
- **`package.json`.** Une ligne : `"sommaires:regenerer": "tsx scripts/regenerer-sommaires.mts"`.

**Ce que ça change pour l'exploitation.** Le sommaire d'`organisation-du-code.md`
n'est plus « détecté en dérive puis corrigé à la main » (l'état laissé par
DOC-1) : `pnpm sommaires:regenerer` le corrige en une commande. Et
`README.md` — 224 747 octets, jamais indexé avant ce lot — devient navigable :
une question ciblée (ex. « que dit le README sur le journal d'audit ? ») coûte
désormais sommaire + une section (14 316 octets) au lieu du fichier entier
(224 747 octets), soit environ 15,7× moins (mesuré, §2).

## 2. Ce que j'ai mesuré

**FAIT 1 du ticket, vérifié avant toute correction.** Sur `main`, avant
modification, `tests/unit/docs/constitution-indexee.test.ts` (21 tests) est
VERT — y compris les trois tests DOC-1 qui confrontent le sommaire par ligne
d'`organisation-du-code.md` au fichier réel. **Le décalage annoncé par le
ticket n'avait PAS encore eu lieu** : 36 renvois sur 36 étaient justes, 0 faux.
Ce que DOC-1 avait réellement laissé en suspens n'est pas « un gardien qui ne
confronte rien » (un gardien existait et confrontait déjà, dans les deux
sens) — c'est l'absence d'un SCRIPT DE RÉGÉNÉRATION, nommée explicitement dans
sa passation §6. C'est cette pièce manquante que ce lot livre.

**La preuve que le gardien rougit réellement, observée deux fois, pas
supposée :**
1. En ajoutant ma note dans `organisation-du-code.md` puis en régénérant le
   sommaire, les numéros de ligne ont décalé de +2 (66→68, 112→114). Les deux
   épreuves à mutation de `constitution-indexee.test.ts`, qui codaient les
   anciennes valeurs en dur, ont ROUGI à la première exécution
   (`npx vitest run tests/unit/docs/constitution-indexee.test.ts` → 2 failed
   / 21) avant que je ne les corrige. Ce n'est pas une mise en échec
   fabriquée pour la démonstration : c'est une vraie dérive que j'ai moi-même
   causée et que le gardien a attrapée sans que je le lui demande.
2. Pour `README.md`, épreuve manuelle réelle (pas seulement programmatique) :
   `sed` a renommé `## Documentation` en `## DocumentationXX` dans le fichier
   sur disque, `npx vitest run tests/unit/docs/readme-indexe.test.ts` a rougi
   sur 5 des 9 tests (orphelin détecté, plus les épreuves internes qui
   dépendaient du même titre), puis le fichier a été restauré et les 9 tests
   repassent au vert. Commande exacte jouée, dans l'ordre : voir la
   transcription — `cp README.md /tmp/README.md.bak`, `sed -i
   '0,/^## Documentation$/{s/^## Documentation$/## DocumentationXX/}'
   README.md`, `npx vitest run tests/unit/docs/readme-indexe.test.ts`, puis
   restauration.

**Conservation du contenu — vérifiée programmatiquement, pas relue à l'œil.**
Pour les deux fichiers, un script Node compare la séquence des lignes NON
vides du texte AVANT (`git show HEAD~1:<fichier>`) à celle du texte APRÈS,
en retirant seulement le bloc que j'ai ajouté (la note + le sommaire) :
égalité stricte dans les deux cas (`README.md` : 1298 lignes de contenu de
chaque côté ; `organisation-du-code.md` : 1119 lignes hors entrées de
sommaire, de chaque côté). Pour `organisation-du-code.md`, en plus : le bloc
de code de l'arborescence extrait AVANT et APRÈS (entre les deux ``` ```` ``)
est comparé chaîne à chaîne — identique octet pour octet.

**Compte AVANT / APRÈS, sur des questions précises (contenu réel, pas une
estimation) :**

| Question | AVANT (fichier entier) | APRÈS (sommaire + section ciblée) |
|---|---:|---:|
| « Que dit le README sur le journal d'audit ? » | 224 747 octets | 5 750 (sommaire) + 8 566 (la section) = **14 316 octets**, soit ≈ 15,7× moins |

Une seule ligne de mesure ciblée cette fois (contrairement à DOC-1 qui en
avait deux) : le second fichier du lot, `organisation-du-code.md`, ne change
pas de forme de navigation — son sommaire existait déjà, seuls les numéros de
ligne ont été recalculés, donc son gain de navigation était déjà mesuré par
DOC-1 (27×) et n'a pas changé.

**`pnpm verify:full` complet, joué UNE FOIS après correction du format
(`prettier --write` sur les deux fichiers neufs de `scripts/`)** :
`format:check`, `typecheck`, `lint`, `test` (2 608 tests unitaires dans 240
fichiers, tous verts — 30 dans les deux fichiers touchés par ce lot),
`test:isolation`, `build`, `feries:horizon`, `audit:partitions`, `test:e2e`
(155 passés, 3 ignorés — routes dynamiques déjà exclues avant ce lot). Sortie
en 0. Commande exacte : `pnpm verify:full`, terminée avec `[exited with code
0]` après 2,6 minutes pour la seule section e2e (mesuré séparément : `pnpm
test` seul, 2 608/2 608, 14,5 s). Aucun test existant n'a été modifié pour le
faire passer — seuls les deux numéros de ligne codés en dur (§ ci-dessus) ont
été ACTUALISÉS, pas assouplis : ils continuent d'exiger une égalité stricte,
seule la valeur attendue a changé pour suivre le fichier réel.

## 3. Ce que j'ai tranché, et pourquoi

1. **La logique de sommaire est partagée entre le gardien et le script, dans
   `scripts/lib/sommaires.ts`**, plutôt que réimplémentée dans le script comme
   une seconde lecture. DOC-1 avait accepté ce risque une fois, pour une
   fonction hors de son territoire (`arborescence()` dans
   `organisation-du-code.test.ts`, qu'il ne pouvait pas toucher) ; ici, les
   deux consommateurs (`constitution-indexee.test.ts` et
   `regenerer-sommaires.mts`) sont tous les deux dans mon territoire, donc rien
   n'empêchait de n'en écrire qu'une version. Réouverture : si un jour
   `scripts/lib/` doit rester du seul ressort de l'exécution (pas du test), il
   faudrait déplacer ces fonctions ailleurs — je n'ai pas trouvé de règle du
   dépôt qui l'interdise.
2. **`README.md` reçoit un sommaire à TITRES (comme `erreurs-a-ne-pas-refaire.md`),
   pas à lignes.** Rien dans `README.md` ne ressemble à la contrainte du bloc
   de code unique qui avait forcé `organisation-du-code.md` vers l'autre forme
   — aucun gardien existant ne lit `README.md` comme un bloc figé.
3. **Les niveaux indexés pour `README.md` sont `##` et `###`, pas `###`/`####`.**
   C'est à ces deux niveaux que le document structure réellement son contenu
   (58 et 31 occurrences, mesuré §2 du ticket) ; le niveau `#` n'apparaît
   qu'une fois, pour le titre du document, et n'est pas une entrée de
   navigation. `titresDuCorps` a donc été généralisée avec un paramètre
   `niveaux` (défaut `[3,4]`, préservant tous les appels existants tels
   quels) plutôt que dupliquée pour ce nouveau cas.
4. **Le marqueur du sommaire de README est `## Sommaire` (niveau 2), placé
   comme la toute première section du document**, plutôt que `### Sommaire`
   comme dans les fichiers de `docs/constitution/`. `organisation-du-code.md`
   et `erreurs-a-ne-pas-refaire.md` nichent leur sommaire SOUS un titre `##`
   déjà existant (`## 6.`, `## 9.`) ; `README.md` n'a pas d'équivalent — son
   premier titre `##` est `## Documentation`. Un sommaire à `### Sommaire`
   y aurait été un sous-titre sans titre parent, ce qui n'a pas de sens
   structurel. `bornesDuSommaire`, `titresDuCorps` et `entreesDuSommaire`
   prennent donc un paramètre `marqueur` (défaut `"### Sommaire"`,
   appels existants inchangés) plutôt qu'un format figé.
5. **La note de régénération est placée AVANT le marqueur `Sommaire`, jamais
   entre le marqueur et le `---`.** `regenererBlocSommaire` remplace tout le
   contenu de cette zone par les entrées recalculées : une note qui y vivrait
   serait effacée au premier `pnpm sommaires:regenerer`. C'est écrit en
   commentaire dans `scripts/lib/sommaires.ts` pour qu'un futur sommaire ne
   retombe pas dans le piège.
6. **Je n'ai pas cherché à réduire le seuil de 250 lignes, ni à le généraliser
   en un troisième fichier « au-dessus du seuil ».** Le ticket vise
   nommément `README.md` ; les autres fichiers de rang 1 ou 2
   (`docs/arbitrages.md`, `docs/backlog.md`, `docs/cahier-des-charges.md`)
   sont explicitement hors territoire.

## 4. Ce que je n'ai PAS fait

- **Aucune ligne normative modifiée, résumée ou déplacée** dans `README.md` ni
  dans `docs/constitution/organisation-du-code.md` — vérifié
  programmatiquement (§2), pas seulement relu.
- **Aucun lien Markdown cliquable dans les sommaires** — même choix que DOC-1,
  pour la même raison (`docs/propositions/15-DOC-1/passation.md`, §4) : ni
  `README.md` ni les fichiers de `docs/constitution/` ne sont consultés via un
  rendu Markdown cliquable dans ce dépôt.
- **`docs/arbitrages.md`, `docs/backlog.md`, `docs/cahier-des-charges.md`** —
  hors territoire, non ouverts pour modification.
- **`CLAUDE.md`** — non listé dans le territoire du ticket, non touché ; la
  mention de la commande `pnpm sommaires:regenerer` vit dans les deux
  documents qu'elle régénère, pas dans le noyau.
- **Aucun code applicatif (`lib/`, `app/`, `prisma/`)** — hors territoire, non
  touché.
- **Je n'ai pas ajouté de sous-niveaux au sommaire de `README.md`** (les
  titres `###` ne sont pas indentés sous leur `##` parent) : la liste est
  À PLAT, dans l'ordre du document, exactement comme
  `erreurs-a-ne-pas-refaire.md` mêle ses `###`/`####` sans hiérarchie visuelle
  — même forme, pas une seconde inventée pour l'occasion.
- **Je n'ai pas retouché `tests/unit/docs/organisation-du-code.test.ts`**
  (hors territoire, gardien voisin intouchable — DOC-1 avait déjà mesuré que
  scinder le bloc de code casse son extracteur).

## 5. Les pièges pour la session suivante

- **`regenererBlocSommaire` efface TOUT ce qui vit entre le marqueur
  (`### Sommaire` / `## Sommaire`) et le `---` suivant**, pas seulement les
  lignes `- `. Une note ou un commentaire glissé là disparaîtrait au premier
  `pnpm sommaires:regenerer` sans avertissement. C'est pourquoi les deux notes
  de ce lot sont placées AVANT le marqueur — à respecter pour tout sommaire
  futur qui réutiliserait cette fonction.
- **`scripts/lib/sommaires.ts` est maintenant la SEULE source de la logique de
  sommaire** — si un ticket futur doit modifier la façon dont un sommaire est
  lu ou régénéré (nouvelle forme, nouveau niveau de titre), c'est CE fichier
  qu'il faut changer, jamais une copie locale dans un test ou un script. Le
  gardien et le script divergeraient sinon exactement comme le §9 du
  01/09/2026 le prévient.
- **`repertoiresAvecLigne` reste une réimplémentation indépendante de
  `arborescence()`** dans `tests/unit/docs/organisation-du-code.test.ts` (hors
  territoire, je n'ai pas pu la fusionner) — DOC-1 avait déjà signalé ce
  risque, il n'a pas changé avec ce lot.
- **Toute modification future de `README.md` qui ajoute, retire ou renomme un
  titre `##`/`###` doit être suivie de `pnpm sommaires:regenerer`** — le
  gardien (`tests/unit/docs/readme-indexe.test.ts`) le détectera si on
  l'oublie, mais ne le corrige pas tout seul.
- **`organisation-du-code.md` reste interdit de titres Markdown à l'intérieur
  du bloc de code de son arborescence** (contrainte de DOC-1, inchangée par ce
  lot) : `tests/unit/docs/organisation-du-code.test.ts` suppose toujours un
  seul bloc.
- **Le seuil de non-vacuité `expect(cibles.length).toBeGreaterThanOrEqual(2)`
  dans `constitution-indexee.test.ts`** ne couvre QUE `docs/constitution/` —
  `README.md` a son propre gardien séparé (`readme-indexe.test.ts`), pas
  intégré à `fichiersATitrer()`. Un ticket qui voudrait unifier les deux
  populations (« tout fichier du dépôt au-dessus de 250 lignes ») devra
  d'abord décider quels répertoires en sont exemptés — `docs/decisions/`,
  `docs/propositions/` notamment, jamais mesurés par ce lot.

## 6. Ce qui reste à faire

- **`docs/arbitrages.md` et `docs/backlog.md`** n'ont reçu aucun sommaire —
  explicitement hors territoire de ce ticket, mais ce sont deux documents de
  rang 1 et 4 qui grossissent avec chaque décision ; un ticket futur pourrait
  mesurer s'ils ont franchi un seuil de navigabilité qui leur est propre.
- **Le sommaire de `README.md` est un sommaire de PREMIER niveau seulement**
  (`##`/`###` mêlés à plat) : si le document continue de grossir, une
  hiérarchie à deux niveaux (titres `##` en tête de ligne, `###` indentés
  dessous) resterait à concevoir — je ne l'ai pas fait ici pour rester dans la
  forme déjà validée par DOC-1 (§3.6 de ce document).
- **Aucun contrôle n'existe qui empêche un futur ticket de recréer une TROISIÈME
  implémentation** de la lecture de sommaire ailleurs dans le dépôt (un script
  jetable dans `/tmp`, par exemple) — seule la discipline de lecture de ce
  fichier de passation le prévient pour l'instant.
