# 9E2-E2E-MAIN-ROUGE-LUNDI — passation

T0 = lundi 12/10/2026, 07:57 (Pacific/Noumea). Départ : `origin/main` 291b074c, aucun
commit d'aucun lot dessus, `git status --porcelain` vide.

## 1. Reproduction — les deux épreuves, seules, un lundi

`pnpm exec playwright test tests/e2e/planning-creer-en-haut.spec.ts
tests/e2e/9eg2-tableau-de-bord-direction-admin.spec.ts --reporter=line` sur 291b074c,
sans aucun commit d'un lot : **5 échecs** (4 + 1), tous mesurés un lundi.

### `planning-creer-en-haut.spec.ts` — 4 des 5 épreuves à largeur de bureau

```
Error: locator.evaluate: Error: strict mode violation: locator('main header p') resolved to 2 elements:
    1) <p class="text-app-encre-faible mb-[20px] text-[13px] font-bold">…</p> aka getByRole('paragraph').filter({ hasText: 'lundi 12/10/2026 · 5' })
    2) <p class="text-12 font-bold">Laissées, à compléter</p> aka getByText('Laissées, à compléter').first()
```

(même défaut aux 4 couples largeur/vue ; seule « à 375 px » passait déjà.)

### `9eg2-tableau-de-bord-direction-admin.spec.ts:447` — « Priorités opérationnelles »

```
Error: expect(received).toContain(expected) // indexOf
Expected substring: "Retards"
Received string:    "Tous les besoins (3) Urgences (2) Pièces (1)"
```

## 2. Cause, par épreuve

### `planning-creer-en-haut.spec.ts`

**Cause** : le sélecteur `main header p` suppose un seul `<p>` sous `<header>` ; mais
`actions` (même `<header>`, posé par `components/mise-en-page/page.tsx`) porte aussi
`DialogueTransmettreDemain` (`components/planning/transmettre-demain.tsx`), un
`<dialog>` FERMÉ mais TOUJOURS DANS LE DOM — et son contenu porte lui-même un `<p>`
« Laissées, à compléter » dès que `laisseesDemain.length > 0`. Un lundi, « demain »
(mardi) a des interventions prêtes ET laissées dans le semis — les deux conditions sont
réunies, le sélecteur résout deux `<p>`. Le défaut est dans L'ÉPREUVE (sélecteur trop
large), jamais dans le produit : la mesure voulue (le bouton chevauche le sous-titre,
jamais rejeté dessous) reste exacte, seule la façon de retrouver CE `<p>`-là ne l'était
pas.

**Changement** : `page.locator("main header p")` → `page.locator("main header h1 + p")`
— le sous-titre est, dans `components/mise-en-page/page.tsx`, le `<p>` qui suit
IMMÉDIATEMENT le `<h1>` ; le `<p>` du dialogue, nesté plus profond et jamais adjacent au
`<h1>`, n'est plus jamais résolu. Aucune assertion retirée ni affaiblie.

### `9eg2-tableau-de-bord-direction-admin.spec.ts`

**Cause** : `optionsFiltrePriorites` (`app/(back-office)/tableau-de-bord/
presentation.ts:591`) n'affiche une option que pour une catégorie qui a AU MOINS UN
élément (`categoriesPresentes`) — comportement voulu (décisions 46/47 du 09/10). La
scène PROPRE `9EG2-` ne pose, elle, aucune ligne « en retard » ; la seule source
possible était la scène PARTAGÉE (`tests/e2e/setup/scene.ts`, intouchée par ce lot),
dont les deux seuls jours (`MARDI`, `MERCREDI`) sont posés à `rang` 1 et 2 DEPUIS LE
LUNDI DE LA SEMAINE COURANTE (`lundiDeLaSemaine`) — un lundi, ce lundi EST le jour 0 de
cette même semaine, et ni mardi ni mercredi n'est encore passé : zéro ligne ne peut
remplir `enRetard` (`lib/interventions/retard.ts`, date strictement avant aujourd'hui).
Le défaut est dans L'ÉPREUVE, qui comptait sur une donnée partagée day-dépendante sans
en porter la sienne propre.

**Changement** : la scène `9EG2-` pose désormais SA PROPRE ligne « en retard » —
`idEnRetard`, `statut: "planifiee"`, `date_planifiee: hier` (`instantDuJour(jourSuivant(
jour, -1))`, déjà calculé dans le fichier pour l'habilitation expirée), sans segment —
donc toujours strictement avant aujourd'hui, quel que soit le jour où l'épreuve tourne.
Nettoyée dans `effacerLaScene` avec les trois autres lignes de la scène. Aucune
assertion retirée ni affaiblie.

## 3. Rejeu — stabilité

Les deux fichiers rejoués ENSEMBLE, 3 fois de suite après le changement : **21/21
verts** à chaque passage (aucun flake mesuré).

## 4. `CI=1 pnpm verify:full`, en entier, au premier plan

Voir la section suivante — ajoutée après exécution, avec les 15 dernières lignes et le
SHA du commit testé.

## 5. Jours testés

Mesuré en conditions réelles un LUNDI (12/10/2026) — le seul jour que ce lot pouvait
observer. Le raisonnement (rang des jours de `scene.ts` depuis le lundi de la semaine)
couvre tous les jours de la semaine par construction : seul lundi expose `MARDI`/
`MERCREDI` comme encore-à-venir, donc seul lundi pouvait manquer de retard — la donnée
propre `hier` de la scène `9EG2-` ne dépend, elle, d'aucun jour particulier.

## 6. Commits

- `9E2-E2E-MAIN-ROUGE-LUNDI — passation : reproduction mesurée sur 291b074c`
- `9E2-E2E-MAIN-ROUGE-LUNDI — planning-creer-en-haut : sélecteur du sous-titre resserré (h1 + p)`
- `9E2-E2E-MAIN-ROUGE-LUNDI — 9eg2-tableau-de-bord : scène propre dotée d'une ligne en retard`
- `9E2-E2E-MAIN-ROUGE-LUNDI — passation : verify:full complet vert`
