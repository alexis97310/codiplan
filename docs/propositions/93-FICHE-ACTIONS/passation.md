# 93-FICHE-ACTIONS — passation

## Ce que j'ai changé

- `lib/interventions/action-principale.ts` (nouveau) : `actionPrincipale(statut)`, une fonction
  pure qui répond, pour chacun des huit statuts du cycle de vie, laquelle des actions du panneau
  fait avancer l'intervention — `a_planifier` → `"planifier"`, `planifiee` → `"affecter"`,
  `suspendue` → `"reprendre"`, `terminee` → `"cloturer"`, tout autre statut (`affectee`,
  `en_cours`, `cloturee`, `annulee`) → `null`. Elle ne décide RIEN que
  `lib/interventions/cycle-de-vie.ts` ne décide déjà (permis/refusé) : elle dit seulement,
  parmi ce qui est permis, ce qui compte.
- `app/(back-office)/interventions/[id]/page.tsx` : la fonction `Action` prend une prop
  `principale?: boolean` (défaut `false`). Un refus (`verdict.refuse`) continue de s'afficher
  tel quel, inchangé — cette prop ne s'applique qu'à ce qui est permis. Une action `principale`
  garde son rendu actuel (bloc ouvert, `<h2>`, bouton plein `variant="default"`). Une action non
  `principale` est repliée dans un `<details>` natif dont le `<summary>` porte le titre ; son
  bouton reste `variant="outline"`. Le calcul `const principale = actionPrincipale(statut)` est
  posé une fois, à côté de `figee`, et chacun des cinq blocs concernés (planifier, affecter,
  cloturer, reprendre) reçoit `principale={principale === "..."}` ; déplacer, suspendre et
  annuler ne passent jamais cette prop et sont donc TOUJOURS repliés, comme le prescrit le
  ticket.
- **Pour l'exploitation** : sur une fiche `a_planifier`, seul le bloc « Planifier » s'ouvre
  désormais en plein, avec un bouton coloré (au lieu des sept blocs empilés d'avant, tous au
  même gris). Les autres actions restent accessibles d'un clic sur leur titre, qui fait office
  de `<summary>` — rien n'a disparu, rien n'a changé de route ni de règle de transition.
- Cinq épreuves e2e préexistantes interagissaient avec un bloc désormais replié (« Déplacer »
  dans trois fichiers, « Suspendre » dans un, « Annuler » dans deux) via un `<h2>` qui a quitté
  ce bloc pour le `<summary>` : `tests/e2e/avertissements-1.spec.ts`,
  `tests/e2e/fiche-annuler.spec.ts`, `tests/e2e/interventions-2.spec.ts`,
  `tests/e2e/fiche-intervention.spec.ts`, `tests/e2e/intervention-technicien-select.spec.ts`,
  `tests/e2e/planning-4.spec.ts` — chacune retouchée pour cliquer le `<summary>` avant
  d'atteindre ses champs ou son bouton ; aucune assertion métier n'a changé.
- `tests/unit/interventions/action-principale.test.ts` (nouveau) : les huit statuts, un par un,
  plus un test qui fige leur nombre à huit.
- `tests/e2e/fiche-actions.spec.ts` (nouveau) : sa propre scène, préfixée `ACT93-` (un client,
  un site, une intervention `a_planifier` posée par `INSERT` direct — même discipline que
  `interventions-2.spec.ts`), à 1280 px. Éprouve que « Planifier » est ouvert avec un bouton
  `bg-primary`, que « Suspendre » est replié (`<details>` sans `open`, champ `motif` caché), et
  que le clic sur son `<summary>` révèle ses champs et son bouton `outline`.
- Deux clés `lib/i18n/fr.ts` : `actionprincipale.e2e.client`, `actionprincipale.e2e.site` — la
  scène de l'épreuve neuve, jamais un texte en dur dans une requête d'écran.

## Ce que j'ai mesuré

- **AVANT** (lecture du code avant ce lot) : le panneau « Actions » de `/interventions/[id]`
  pouvait rendre jusqu'à sept blocs `<Action>` simultanément ouverts pour une même fiche
  (planifier/affecter/déplacer, clôturer, reprendre/suspendre, annuler), tous avec le même
  bouton `variant="outline"` — aucune distinction visuelle entre « ce qu'il faut faire ensuite »
  et le reste.
- **APRÈS** (mesuré, ce lot) :
  - `CI=1 pnpm test` : 265 fichiers, 2849 tests, tous verts (dont le gardien
    `e2e-mise-en-scene`, qui exige `test.describe.configure({ mode: "serial" })` sur l'épreuve
    neuve puisque son `beforeAll` écrit en base).
  - `pnpm typecheck` : vert. `pnpm lint` : vert (zéro avertissement). `pnpm format:check` :
    vert.
  - `CI=1 pnpm verify:full` (un seul appel au premier plan, ~13 min, code de sortie 0) :
    `format:check`, `typecheck`, `lint`, `test`, `test:isolation`, `build`, `feries:horizon`,
    `audit:partitions`, `test:e2e` — chaîne complète verte. `test:e2e` : 273 passés, 3 ignorés
    (préexistants, hors périmètre), 0 échec.
  - Deux captures prises par l'épreuve neuve, à 1280 px :
    `docs/propositions/93-FICHE-ACTIONS/captures/suspendre-replie-1280.png` (bloc fermé) et
    `suspendre-ouvert-1280.png` (après clic sur le `<summary>`). Ce ne sont PAS des captures
    ancien-code/nouveau-code (la recette à quatre pièges de `tests/e2e/vgp-2` n'a pas été
    rejouée ici) : les deux montrent l'écran APRÈS ce lot, dans ses deux états ouvert/fermé —
    suffisant pour ce que le ticket demande de montrer.

## Ce que j'ai tranché et pourquoi

- **`principale` a un défaut `false`, jamais un défaut `true`** — un appelant qui oublierait la
  prop replie son action plutôt que de la laisser ouverte par erreur ; le risque d'un bloc replié
  à tort est une action à un clic de plus, celui d'un bloc ouvert à tort serait un panneau qui
  redevient celui d'avant ce lot sans que personne ne le remarque.
- **Un refus ignore complètement `principale`** — la branche `verdict.refuse` de `Action` n'a
  pas changé d'une ligne ; c'est exactement ce que le ticket demande (« Un refus … reste affiche
  tel quel, jamais replie ») et ce qui fait qu'aucune épreuve testant un refus n'a eu besoin
  d'être retouchée.
- **`détails-avec-résumé` plutôt qu'un composant d'accordéon** — le ticket demande explicitement
  un `<details>` natif ; pas de dépendance, pas de JS de contrôle d'ouverture à écrire, l'état
  ouvert/fermé est nativement accessible (`<summary>` porte le rôle bouton, `open` est lisible
  par `toHaveJSProperty`).
- **Les six épreuves retouchées ouvrent le `<summary>` puis conservent leur locator existant
  (`form[action$="..."]` ou un `<form>` scopé), jamais l'inverse** — c'est le geste que le ticket
  demandait explicitement pour ce piège connu (« elle ouvre d'abord le `<summary>` — n'en change
  aucune assertion metier »). Je n'ai changé aucune assertion sur le fond (refus, valeurs,
  libellés, statuts) dans ces six fichiers, seulement l'ouverture préalable du bloc.
- **`interventions-2.spec.ts` a reçu `test.describe.configure({ mode: "serial" })` restait déjà
  posé** — je n'ai eu qu'à ajouter un helper `detailsSuspendre()` et ouvrir le `<details>` deux
  fois (avant chaque suspension), la seconde suspension retombant elle aussi sur `a_planifier`
  après la reprise (l'intervention de l'épreuve n'a jamais reçu de créneau).
- **Aucune nouvelle clé de dictionnaire pour les titres des blocs repliés** — le `<summary>`
  réutilise le même `titre` (donc la même clé `intervention.action.*`) que le `<h2>` d'avant ;
  composer un second texte aurait été une seconde lecture du même titre (§9, 01/09).

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis (`prisma/seed*.ts`), aucun prix — vérifié
  (`git show --stat` de chaque commit : ni `prisma/migrations/`, ni `prisma/seed*.ts`).
- Aucune route API, aucun schéma Zod, aucune règle de `lib/interventions/cycle-de-vie.ts`
  changée — `actionPrincipale` est un module neuf, à côté, qui ne fait qu'y lire le statut.
- Je n'ai pas touché `tests/e2e/blocage-agenda-visible.spec.ts` ni
  `tests/e2e/fiche-technicien-nomme.spec.ts` ni `tests/e2e/captures-parcours-1.spec.ts` ni
  `tests/e2e/creation-jour-ferme.spec.ts` ni `tests/e2e/parcours-creer-puis-planifier.spec.ts` —
  vérifié un par un (`grep` de chaque occurrence de `intervention.action.*`) qu'ils
  n'interagissent qu'avec des blocs qui restent PRINCIPAUX pour le statut qu'ils forgent
  (`planifier` sur `a_planifier`, `affecter` sur `planifiee`) : aucune retouche nécessaire.
- Je n'ai pas retesté manuellement dans un navigateur (pas de session `pnpm dev` ouverte à la
  main) — `pnpm verify:full` (Playwright, Chromium réel) et les deux captures de l'épreuve sont
  la preuve disponible.

## Les pièges pour la session suivante

- **Le titre d'une action non principale n'est plus un `<h2>` — c'est un `<summary>`.** Toute
  future épreuve qui cible « Affecter », « Déplacer », « Suspendre » ou « Annuler » par
  `page.getByRole("heading", { name: … })` scopé à un `<form>` échouera dès que ce statut n'est
  pas celui où l'action est principale. Le repère sûr est `page.locator("details", { has:
  page.locator("summary", { hasText: … }) })`, dont il faut cliquer `.locator("summary")` avant
  d'atteindre le `<form>` qu'il contient.
- **`actionPrincipale` ne connaît que quatre valeurs non nulles** (`planifier`, `affecter`,
  `reprendre`, `cloturer`) — une nouvelle transition qui mériterait de devenir « principale »
  (par exemple si un jour `affectee`/`en_cours` gagnaient une action qui les fait avancer) doit
  passer par ce module, jamais par un `principale` posé à la main sur un `<Action>` du panneau.
- **Les captures binaires d'autres tickets sont ré-écrites par `pnpm verify:full`** (constaté à
  nouveau ici, comme documenté dans la passation de 92-CREATION-2) : 52 fichiers PNG hors
  périmètre de ce lot étaient déjà modifiés dans l'arbre de travail AVANT que je ne touche à
  quoi que ce soit — laissés tels quels, non commités, non touchés par mes commits.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce ticket. Un futur constat pourrait vouloir que
  l'état ouvert/fermé d'un `<details>` survive à un rechargement de page (aujourd'hui il revient
  toujours fermé) — hors périmètre ici, à trancher dans un ticket dédié si jugé utile.
