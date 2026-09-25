# 91A-STAB-PLANIFIER — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Rien. Aucune ligne de `tests/e2e/parcours-creer-puis-planifier.spec.ts`,
aucune ligne de `tests/e2e/registre-5.spec.ts`, aucun code applicatif. Pour
l'exploitation, rien ne change : les deux épreuves visées par ce ticket
étaient déjà vertes avant que je ne commence.

`tests/e2e/registre-5.spec.ts` porte déjà le correctif décrit par le
constat (« texte cherché unique par exécution ») — posé par la session
précédente, `docs/propositions/94-DEMANDES-3-REPRISE/passation.md`, fusionné
sur `main` au commit `5f5a6c8`, présent à la racine de ce lot (`18e160e`).
Je n'ai rien eu à y ajouter.

## Ce que j'ai mesuré (comptes AVANT/APRES)

Je n'ai pas de mesure « AVANT » à moi : le constat du 25/09 (16h20 et 17h30,
journal de la file) décrit deux rougissements sur des lots différents
(`89-DEMANDES-3`, `91-VGP-4-REPRISE`), tous deux antérieurs à `main` tel
qu'il est aujourd'hui. Je n'ai pas rejoué ces lots eux-mêmes — hors de portée,
ils sont fusionnés depuis. Ce que j'ai mesuré, c'est l'état ACTUEL :

- `tests/e2e/parcours-creer-puis-planifier.spec.ts` seul, **rejoué CINQ fois
  de suite** (base reconstruite par le setup global à chaque lancement,
  `CI=1`) : **3/3 tests passés les cinq fois** (48,0 s à 51,4 s par
  exécution) — jamais un seul rouge, ni sur le test « PLANIFIER refuse… »
  nommé par le constat, ni sur les deux autres.
- `pnpm test:e2e` (les 277 épreuves du dépôt, `CI=1`, 1 worker) : **274
  passés, 3 skips préexistants et nommés (hors de ce lot), zéro échec** —
  les deux fichiers visés sont verts À L'INTÉRIEUR de cette exécution
  complète, aux côtés de tous les autres scénarios du dépôt.
- `pnpm test` (unitaires) : **2843 tests passés** sur 264 fichiers.
- `pnpm verify:full` **en entier, en un seul appel, au premier plan**
  (`CI=1`) : **vert de bout en bout** — format, typecheck, lint, les 2843
  tests unitaires, l'isolation, le build de production, `feries:horizon`,
  `audit:partitions`, et la suite e2e complète (mêmes 274 passés / 3 skips
  que ci-dessus, rejouée une seconde fois dans cette même commande).

Aucun rouge nulle part, sur aucune des deux épreuves nommées par le constat.

## Ce que j'ai tranché, et pourquoi

- **Aucune épreuve modifiée.** Le ticket est explicite : « corrige la CAUSE
  MESURÉE » — pas une cause supposée. L'hypothèse écrite dans le constat
  (« une intervention laissée par une exécution précédente occupe déjà ce
  créneau pour ce technicien ») ne s'est produite à aucun des cinq
  lancements isolés ni dans les deux suites complètes rejouées ici : je n'ai
  donc rien à corriger sans introduire une modification que rien ne motive.
- **Je n'ai pas cherché à fabriquer une collision artificiellement** (relancer
  la suite avec plusieurs workers, ou reproduire l'état exact des deux lots
  fautifs à coup de `git checkout`) : le ticket fixe le territoire à ces
  deux fichiers d'épreuve et à la passation, pas à une reconstitution
  d'historique. `playwright.config.ts` fixe `workers: 1` sous `CI` — la
  seule configuration que `pnpm verify:full`/`11-FILE.sh` jouent réellement
  — ce qui exclut par construction une collision par concurrence RÉELLE
  entre fichiers dans le mode où la file rejoue ce dépôt. Les deux
  rougissements du constat viennent donc soit d'un état de `main` déjà
  corrigé depuis (fusion d'un des deux lots fautifs, ou d'un autre), soit
  d'un artefact propre à ces lots (base non reconstruite entre deux
  tentatives, scène laissée par un `afterAll` qui n'a pas joué) — dans les
  deux cas, un état que je ne peux ni mesurer ni corriger ici sans réécrire
  l'historique.
- **`registre-5.spec.ts` : rien à faire.** Le correctif (suffixe `uuidv7()`
  par exécution) déjà présent sur `main` couvre exactement la même famille
  d'hypothèse (« texte cherché fixe, retrouvé par une exécution
  précédente ») que le constat range dans la « même famille probable » —
  et les mesures ci-dessus le confirment vert.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix.
- Aucun `skip`/`fixme`, aucun `retries`, aucun `workers: 1` ajouté (celui de
  `playwright.config.ts` est préexistant, propre à `CI`).
- Je n'ai touché ni `depot/` ni `11-FILE.sh`.
- Je n'ai pas relancé la suite avec plusieurs workers pour tenter de
  provoquer artificiellement une collision : hors du mode que la file
  rejoue réellement, une telle collision ne dirait rien de la cause que le
  constat visait.
- Je n'ai pas ouvert les lots `89-DEMANDES-3` ni `91-VGP-4-REPRISE`
  eux-mêmes pour comparer leur état exact à celui de `main` aujourd'hui —
  hors du territoire fixé par ce ticket.

## Les pièges pour la session suivante

- **Une hypothèse n'est pas une mesure.** Celle du constat (collision de
  créneau technicien/date entre exécutions) reste NON VÉRIFIÉE — ni
  confirmée, ni infirmée avec certitude : je ne l'ai simplement jamais vue
  se produire, cinq fois de suite en isolé et deux fois en suite complète.
  Si elle revient, le premier réflexe utile est de lire `error-context.md`
  du rouge (le ticket le demandait déjà) : le message exact affiché après
  « Planifier » tranchera entre un refus d'agenda réel (deux interventions
  sur le même créneau du même technicien) et une toute autre cause
  (sélecteur introuvable, timing réseau).
- `options.first()` (ligne 212-219 du spec) reste un choix DYNAMIQUE — le
  technicien choisi n'est jamais nommé par le test, seulement « le premier
  de la liste ». Si un scénario futur pose une intervention pour LE PREMIER
  technicien de la liste, au MÊME mardi (+49 jours depuis le mardi de la
  scène, 11:00, 60 min) ou au mardi +63 (le test du glisser-déposer), la
  collision redeviendrait possible sans qu'aucun gardien statique ne la
  voie venir — seule l'exécution le dirait.
- `playwright.config.ts` fixe `workers: 1` **uniquement sous `CI`** (ligne
  79) ; en local sans `CI=1`, Playwright choisit un nombre de workers par
  défaut (plusieurs cœurs), ce qui réintroduit une VRAIE concurrence entre
  fichiers. Toute reproduction locale de ce genre de rougissement doit donc
  explicitement poser `CI=1`, sans quoi elle mesure une autre chose que ce
  que la file rejoue.

## Ce qui reste à faire

Rien d'identifié dans le périmètre de ce ticket : les deux épreuves visées
sont vertes, isolées et dans la suite complète, et `pnpm verify:full` est
vert de bout en bout. Si le rougissement revient sur un lot futur, la trace
utile à conserver est le contenu de `error-context.md` — absent des deux
constats précédents au-delà de la ligne et du sélecteur manquant.
