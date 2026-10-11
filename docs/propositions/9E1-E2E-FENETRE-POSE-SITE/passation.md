# 9E1-E2E-FENETRE-POSE-SITE — passation

## La cause, en une phrase

`creerInterventionAPlanifier` (tests/e2e/planning-fenetre-pose.spec.ts) prenait le premier
site de l'agence par `orderBy: { libelle: "asc" }`, sans filtrer sur le client : une
fixture étrangère au libellé trié avant (ex. un témoin `0E1-TEMOIN-…`), rattachée à un
client **inactif**, devenait la cible — le planning exclut les clients inactifs
(`filtreClientActif(false)`, lib/interventions/depot.ts, RG-PLA-08), la carte forgée
n'apparaissait jamais à l'écran, et `expect(source).toBeVisible()` expirait.

## La réparation

Chaque scénario forge désormais son propre client et son propre site, **actifs**,
libellés `PGFP-<uuid>` (jamais un libellé qui pourrait trier avant une fixture du semis
ou d'un autre scénario), et les supprime avec l'intervention en `finally`. La carte est
en outre posée en tête de file (`priorite: "p1"`, `cree_le` au 01/01/2000) pour ne
dépendre de rien que d'autres scénarios laissent dans la file « À planifier ».

## Reproduction du rouge (AVANT la correction)

Témoin forgé en base par un fichier de test jetable (jamais commité) : client
`0E1-TEMOIN-<uuid>` **inactif** + site du même libellé, agence DUCOS, avec le code
ORIGINAL (bugué) de `creerInterventionAPlanifier` repris tel qu'il vivait sur
`main` (6a9f48ae). 11/10/2026, ≈13:49 Nouméa :

```
  ✘  1 [chromium] › _temp-reproduction-0e1.spec.ts › REPRODUCTION — le témoin 0E1 masque la carte forgée (code original) (7.0s)

    Error: expect(locator).toBeVisible() failed
    Locator: locator('[data-bloc="01a128dd-663e-7c93-805b-e66c1e917281"]')
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found

      144 |     await expect(source).toBeVisible();
          |                          ^

  1 failed
```

Témoin retiré immédiatement après (`afterAll` du fichier jetable, puis vérifié par
requête directe : 0 ligne restante).

## Preuve du vert (APRÈS la correction, témoin présent)

Même témoin recréé (DUCOS + KONE cette fois), injecté par un `beforeAll`/`afterAll`
temporaire directement dans `planning-fenetre-pose.spec.ts` (jamais commité — retiré par
`git checkout` juste après ce passage). 11/10/2026, ≈13:51 Nouméa :

```
  ✓  1 … un technicien absent ce jour-là : « Planifier » reste inactif, le motif est affiché (2.4s)
  ✓  2 … le dépôt d'une carte de la file ouvre la fenêtre de pose, sans écrire — puis planifie au créneau choisi (2.4s)

  2 passed (1.0m)
```

## La spec seule, 3 fois, témoin absent (11/10/2026, ≈13:52–13:55 Nouméa)

Trois essais, verts 3/3 (2 tests chacun, ≈1.0m par essai — la préparation globale
recrée et resème la base à chaque appel).

## `CI=1 pnpm verify:full`, en entier, au premier plan, un seul appel (11/10/2026, 14:28–14:56 Nouméa pour la phase `test:e2e`)

Vert de bout en bout (code de sortie 0). `planning-fenetre-pose.spec.ts` passe dans
la suite complète, sans retry.

**Une autre épreuve a flanché UNE fois** (retry CI=1, repassée verte ensuite, donc
`1 flaky` et non `1 failed` dans le rapport) :
`tests/e2e/9du-recherche-rail.spec.ts:84` — la boîte de dialogue « Rechercher »
(Ctrl+K) n'était pas visible sous 5 s. Ce fichier ne contient aucun
`site.findFirst…` trié par `libelle` : ce n'est pas le même mécanisme. Non touché,
nommé ici comme demandé.

## Point 5 — les autres `site.findFirst(OrThrow)` triés par `libelle` sans filtre sur le client

Même motif que celui réparé ici (`orderBy: { libelle: "asc" }`, aucun `client: { actif:
true }` dans le `where`) — **non corrigés**, parce qu'aucun n'est tombé rouge au point 4 :

- `tests/e2e/planning-cibles-375.spec.ts:94`
- `tests/e2e/planning-survol-cases.spec.ts:45`
- `tests/e2e/affichage-materiel.spec.ts:62`
- `tests/e2e/planning-3.spec.ts:84`
- `tests/e2e/planning-technicien-actions-refusees.spec.ts:94`
- `tests/e2e/planning-filtres-aujourdhui.spec.ts:40`
- `tests/e2e/planning-jour-suite.spec.ts:63`
- `tests/e2e/captures-pgd1b-jour-suite.spec.ts:68`
- `tests/e2e/planning-tiroir.spec.ts:31`
- `tests/e2e/fiche-trouver-creneau.spec.ts:52`
- `tests/e2e/bon-intervention.spec.ts:74`
- `tests/e2e/planning-file-onglets.spec.ts:42`
- `tests/e2e/porte-capacites.spec.ts:53`
- `tests/e2e/setup/scene-glisser.ts:46` (partagé par les scénarios « glisser »)
- `tests/e2e/setup/scene.ts:252` (partagé par la scène globale)

Déjà filtrés sur `client: { actif: true }` (donc hors de ce motif, non listés ci-dessus) :
`parcours-creer-puis-planifier.spec.ts`, `blocage-agenda-visible.spec.ts`,
`fiche-intervention.spec.ts`, `priorite-ton-partage.spec.ts`.

`equipe-1.spec.ts` trie par `id: "asc"` (un UUID v7, donc par ANCIENNETÉ, pas par
libellé) : un site forgé par un autre scénario, plus récent, ne peut pas lui passer
devant — motif différent, non listé.

## Fin (point 7)

`git fetch origin` + `git rebase origin/main` : rien à rejouer (déjà à jour).
`CI=1 pnpm verify` : vert. `git status --porcelain` : vide.
