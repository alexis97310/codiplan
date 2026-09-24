# 62-STABILITE-3 — passation

## Ce que j'ai changé

- `tests/e2e/sites.spec.ts` — le scénario CONTRAT-SITE-1 (« la case ACTIVE persiste… ») ne
  cherche plus sa carte à l'aveugle sur `/sites?sans_equipement=1`. Trois changements :
  1. Le libellé du site créé porte un JETON UNIQUE par exécution
     (`` `Site e2e ${jeton} (persistance)` ``, `jeton = STAB3-${crypto.randomUUID().slice(0, 8)}`)
     au lieu du libellé fixe `"Site e2e du lot 41 (persistance)"`.
  2. Les DEUX visites de la liste (avant et après avoir décoché la case) ajoutent
     `&q=<jeton>` à l'URL, en plus de `sans_equipement=1` — la recherche filtre côté serveur
     (`contains` sur le libellé, `lib/sites/depot.ts`), donc la carte cherchée est la SEULE que
     la page rend, quelle que soit la pagination.
  3. Le site créé est supprimé en fin de scénario (`try`/`finally`, `PrismaClient` sous
     `urlAdministration()`, comme `historique-site.spec.ts` et consorts) — plus aucune trace
     ne lui survit.
- `tests/unit/e2e-mise-en-scene.test.ts` — extension du gardien statique du lot 54 d'une règle
  ciblée : un `.fill(...)` sur `input[name="libelle"]` dans `sites.spec.ts` ne doit pas passer
  une chaîne fixe (littéral entre guillemets sans interpolation). Le gardien reste au ras de
  l'appel — il ne remonte pas jusqu'à la déclaration de la variable passée — pour rester une
  règle simple à lire et à maintenir.

**Ce que ça change pour l'exploitation.** Rien pour un utilisateur : aucun écran, aucune route,
aucune migration touchés. Ce que ça change pour la file de nuit : l'épreuve CONTRAT-SITE-1 de
`sites.spec.ts` ne rougit plus par malchance de pagination quand une autre scène (notamment
`selecteurs-1.spec.ts`, qui pose 210 sites en parallèle) remplit la liste `/sites` pendant son
exécution — c'était la cause exacte des trois rougissements mesurés sur le journal de la file
(1er passage de 51, deux passages de 55).

## Ce que j'ai mesuré

AVANT (constat du ticket, confirmé en lisant le code sur `main` avant correction) :
`tests/e2e/sites.spec.ts:166-225` créait un site au libellé FIXE
(`"Site e2e du lot 41 (persistance)"`), puis visitait `/sites?sans_equipement=1` — SANS
recherche ni pagination — et y cherchait `article:has(a[href="${href}"])`. La liste est
paginée à 50 (`app/(back-office)/sites/page.tsx`, AT-07) ; une scène concurrente qui pose assez
de sites peut repousser la carte hors de la première page selon le tri alphanumérique.

APRÈS :
- `pnpm test:e2e` (suite complète), lancé DEUX FOIS de suite après le correctif : **vert les
  deux fois** — 231 tests passés, 3 ignorés (les 3 mêmes ignorés qu'avant, sans lien avec ce
  lot), 0 échec, chaque fois.
- `pnpm test:e2e tests/e2e/sites.spec.ts --repeat-each=3` (seul, sans `selecteurs-1.spec.ts`) :
  **vert** — 21 tests (7 × 3 répétitions), dont 3 exécutions CONCURRENTES du scénario
  CONTRAT-SITE-1 sur 3 workers différents, chacune avec son propre jeton, sans collision ni
  carte introuvable. C'est la preuve directe que le correctif tient sous une charge
  concurrente réelle, pas seulement en isolation.
- `pnpm test:e2e tests/e2e/sites.spec.ts tests/e2e/selecteurs-1.spec.ts --repeat-each=3` (la
  commande EXACTE demandée par le ticket) : **rouge**, deux fois de suite — voir « Le conflit
  non résolu » ci-dessous. Le rougissement est entièrement à l'intérieur de
  `selecteurs-1.spec.ts`, jamais dans `sites.spec.ts`.
- `pnpm exec tsc --noEmit`, `pnpm exec eslint`, `pnpm exec prettier --check` et
  `pnpm exec vitest run tests/unit/e2e-mise-en-scene.test.ts` (34 tests, dont les 4 nouveaux) :
  tous verts sur les deux fichiers touchés.

## Ce que j'ai tranché et pourquoi

- **Le filtre `q` plutôt qu'une pagination suivie à la main.** La liste `/sites` sait déjà
  chercher par texte (libellé + client, LISTES-1) ; composer `q=<jeton>` avec
  `sans_equipement=1` rend la carte cherchée UNIQUE dans le résultat, ce qui rend le scénario
  indépendant de la taille de la liste — pas seulement moins probable d'échouer, mais
  STRUCTURELLEMENT immunisé contre la pagination.
- **Un jeton court (`crypto.randomUUID().slice(0, 8)`) plutôt qu'un UUID complet** dans le
  libellé : assez d'entropie pour ne jamais collisionner entre deux exécutions concurrentes,
  assez court pour rester un libellé lisible dans une capture d'écran ou un journal d'échec.
- **La suppression du site en fin de scénario, dans un `finally`** plutôt qu'en `afterAll` :
  c'est un site propre à CETTE épreuve unique (pas partagé entre plusieurs tests d'un même
  fichier comme `historique-site.spec.ts`), donc son cycle de vie tient tout entier dans le
  test qui le crée. Le `finally` protège aussi le cas où une assertion du corps du test échoue
  avant la fin : le site est quand même supprimé.
- **Le gardien reste au ras de l'appel `.fill()`, sans suivre la déclaration de la variable.**
  Le ticket demandait la règle « seulement si elle s'écrit simplement, sinon ne pas forcer » :
  vérifier qu'un argument littéral n'est pas une chaîne fixe est une regex simple ; vérifier
  qu'une VARIABLE référencée est bien composée d'une source d'entropie demanderait de suivre le
  graphe des déclarations (alias, ré-affectations, imports) — un gardien qui grossit pour un
  bénéfice marginal. La règle actuelle attrape exactement le défaut mesuré (un littéral figé) et
  ne prétend pas plus.
- **Pas touché `imports.spec.ts`**, qui cherche aussi un texte forgé (`RAISON_INVENTEE`,
  « Atelier Lisière Bleue ») sur `/clients?sans_equipement=1` sans filtre `q` ni pagination
  suivie. Revu en détail : ce nom commence par « A », et le jeu de démonstration + les 65
  clients `SEL1-` d'une scène concurrente trient tous APRÈS lui (ordre alphanumérique,
  `lib/tri/collation.ts`) — la carte reste structurellement sur la première page tant qu'aucun
  nom ne trie avant elle. Ce n'est PAS la même construction que le défaut de `sites.spec.ts`
  (un jeton aléatoire n'a aucune garantie de tri), donc je ne l'ai pas requalifiée en instance
  du même bug ; je note sa fragilité de principe ci-dessous, sous « ce qui reste à faire ».

## Ce que je n'ai PAS fait

- Aucune migration, aucun écran, aucune route touchés (hors territoire du ticket).
- Aucune assertion MÉTIER changée : la persistance de la case, la lecture qui suit, la pastille
  qui n'apparaît que cochée — les trois preuves originales sont intactes, seule la MISE EN
  SCÈNE (libellé, navigation, nettoyage) a changé.
- Pas touché `depot/` ni `11-FILE.sh`.
- Pas de `workers: 1`, pas de `fullyParallel: false`, pas de `retries`, aucun `skip`/`fixme`,
  aucun délai ajouté — dans `playwright.config.ts` ni dans mes commandes de vérification
  finales (les commandes exploratoires avec `--workers=1` n'ont servi qu'au DIAGNOSTIC du
  conflit ci-dessous, jamais à faire passer une preuve).
- Pas modifié `tests/e2e/selecteurs-1.spec.ts`, ni son schéma d'identifiants fixes — voir « Le
  conflit non résolu ».
- Pas ajouté d'exemption ni modifié une règle existante du gardien de 54 : la nouvelle règle
  est additive, dans le même fichier.

## Les pièges pour la session suivante

- **`--repeat-each` n'est PAS équivalent à « rejouer le fichier plusieurs fois en série ».**
  Avec `fullyParallel: true` et `workers` non forcé (donc plusieurs workers), Playwright peut
  exécuter les répétitions d'un MÊME fichier — y compris un fichier qui déclare
  `test.describe.configure({ mode: "serial" })` — sur des workers DIFFÉRENTS, EN PARALLÈLE. La
  série ne garantit l'ordre qu'À L'INTÉRIEUR d'un worker donné ; elle ne sérialise pas les
  répétitions entre elles. Un fichier dont le `beforeAll` pose des identifiants FIXES (comme
  `selecteurs-1.spec.ts`) est donc structurellement incompatible avec `--repeat-each` sous
  plusieurs workers, indépendamment de tout autre fichier lancé à côté.
- **Le jeton `STAB3-<uuid court>` est un exemple à suivre pour toute future épreuve qui forge
  une entité et la cherche dans une liste partagée** : composer le critère de recherche de la
  liste avec le même jeton rend l'épreuve indépendante de la pagination ET de la concurrence,
  plutôt que de compter sur un ordre de tri favorable (voir la note sur `imports.spec.ts`
  ci-dessus, qui s'appuie sur un tri favorable sans garantie structurelle).
- La revue du ticket (grep `goto("/sites`, `/clients`, `/parc`, `/interventions` suivi de
  `article:has(`, `row:has(`, `getByRole("row"`) n'a trouvé qu'UNE seule occurrence du sélecteur
  `article:has(a[href=...])` dans tout `tests/e2e/` : celle de `sites.spec.ts`, déjà corrigée.
  Les autres fichiers qui visitent ces listes utilisent soit `.first()` sur un jeu de données
  du semis (stable), soit une recherche déjà filtrée par `q` (`parc.spec.ts`,
  `registre-1.spec.ts`), soit un sélecteur de type `SelecteurRecherche` qui filtre par saisie
  (`site-client-inactif-masque-a-la-creation.spec.ts`).

### Le conflit non résolu

**L'épreuve : `tests/e2e/selecteurs-1.spec.ts:170:5` (« le 60e client SEL1- est trouvable et
reçoit un site depuis /sites/nouveau »), sous la commande EXACTE demandée par le ticket :**
`pnpm test:e2e tests/e2e/sites.spec.ts tests/e2e/selecteurs-1.spec.ts --repeat-each=3`.

**Ce qu'elle attend :** que son `beforeAll` (posant 65 clients et 215 sites à identifiants
FIXES, `idClient(1..65)`, `idSite(1..215)`) s'exécute sans collision, puis que le 60e client
`SEL1-` soit trouvable dans le sélecteur de `/sites/nouveau`.

**Ce qu'elle obtient :** `Unique constraint failed on the fields: (id)` sur
`clientAcces.client.createMany` — deux répétitions du fichier (`--repeat-each=3` en crée trois)
exécutent leur `beforeAll` EN PARALLÈLE sur deux workers différents, et la deuxième répétition
heurte les lignes que la première vient de poser, qui n'ont pas encore été supprimées par son
`afterAll` (lequel, plus tard, échoue à son tour : `modeleMateriel.delete()` sur une ligne que
l'autre répétition a déjà supprimée).

**Les deux tentatives et ce qui les sépare :** j'ai lancé exactement la même commande deux fois
de suite (voir « Ce que j'ai mesuré ») — même échec, même endroit, même cause. Puis j'ai isolé
la variable en lançant `selecteurs-1.spec.ts` SEUL sous `--repeat-each=3` (sans `sites.spec.ts`) :
**même échec** — la preuve que le conflit n'a AUCUN lien avec mon changement sur
`sites.spec.ts` ni avec la combinaison des deux fichiers ; c'est une propriété du fichier
`selecteurs-1.spec.ts` lui-même sous répétition multi-worker. Un dernier essai avec
`--workers=1` (diagnostic seul, jamais utilisé comme preuve finale) confirme : sous un seul
worker, les 12 exécutions (répétitions × scénarios) passent toutes, dans l'ordre, sans
collision — ce qui confirme que la cause est bien la concurrence entre répétitions, pas un
défaut de logique du fichier.

**Les options, et leur coût :**
1. **Réécrire le schéma d'identifiants de `selecteurs-1.spec.ts`** pour qu'il varie par
   répétition/worker (par exemple en y mêlant `test.info().parallelIndex` ou un composant
   aléatoire, comme le jeton de ce lot). Coût : ce fichier documente lui-même, dans son en-tête,
   que « le territoire de ce lot n'autorise qu'un seul fichier neuf sous `tests/e2e/` »
   (`fiche-machine.spec.ts`, écrit pour ne pas le toucher) — le modifier en profondeur (65 + 215
   identifiants, une machine, une famille, un modèle, tous fixes) est un chantier à part entière,
   hors du périmètre de ce ticket (`sites.spec.ts` et son gardien), avec son propre risque de
   régression sur trois scènes qui en dépendent.
2. **Ne rien changer** : `--repeat-each` est un outil de STRESS-TEST, absent de
   `pnpm test:e2e` normal et de `pnpm verify:full` — les deux portes réelles de la file de nuit.
   Les deux preuves qui comptent pour l'exploitation (`pnpm test:e2e` complet, deux fois) sont
   VERTES. La preuve `--repeat-each` combinée demandée par CE ticket documente un défaut réel
   mais préexistant et hors de son périmètre déclaré (aucun écran, aucune route, et
   `selecteurs-1.spec.ts` n'est pas le fichier que ce ticket vise).

J'ai choisi l'option 2, conformément à la règle « deux rouges et tu t'arrêtes » : la même
épreuve a échoué deux fois de suite pour la même cause, et je n'ai pas tenté de troisième
correctif ni de contournement (pas de `workers: 1` dans la config, pas de `skip`, pas
d'assertion changée).

## Ce qui reste à faire

- Traiter le conflit ci-dessus : soit accepter que `--repeat-each` sur plusieurs fichiers à
  `beforeAll` figé n'est utilisable qu'avec `--workers=1` (documenté quelque part, jamais dans
  la config globale), soit ouvrir un ticket dédié pour rendre `selecteurs-1.spec.ts` robuste à
  la répétition multi-worker (option 1 ci-dessus).
- `imports.spec.ts` cherche `RAISON_INVENTEE` (« Atelier Lisière Bleue ») sur
  `/clients?sans_equipement=1` sans filtre `q` — sûr aujourd'hui parce que ce nom trie
  alphabétiquement avant toute donnée concurrente connue du dépôt, mais ce n'est PAS une
  garantie structurelle comme le jeton de ce lot. Si un futur scénario pose un jour des clients
  dont le libellé trie avant « A » en nombre (plus de 50), cette épreuve développerait le même
  symptôme que celui corrigé ici. Non corrigé maintenant : ce n'est pas une instance du défaut
  mesuré par ce ticket, seulement un risque de même famille.
