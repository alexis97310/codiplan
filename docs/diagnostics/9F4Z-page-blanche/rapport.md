# 9F4Z — Diagnostic page blanche : rapport

T0 = 19:01 (Pacific/Noumea), 18/10/2026. Limite 180 min → arrêt des mesures à 21:31.
Ce lot **mesure, il ne corrige rien** (D112). Aucune modification de `app/`, `components/`,
`lib/`, `prisma/`, `tests/` n'a été commise — les retraits décrits plus bas n'ont eu lieu que
dans `/tmp/garde`, jamais commités, et ont été restaurés avant la suppression du worktree.

## Point 1 — Branche de garde

`9EWB4B-REPRISE-garde` existe localement (ainsi que `9EWB4B-REPRISE`, dont elle descend).

Commits de `9EWB4B-REPRISE-garde` absents de `origin/main` (7b8e4cfa) :

```
7ede49de 9EWB4B-REPRISE — passation : mesures de reprise, devis de ce qui n'a pas pu tourner
359ca8d4 9EWB4B-REPRISE — point 2 : retrait du bouton « en cours » de l'e2e et de la passation (D111)
b27a872f 9EWB4-INDICATEURS-CHARGEMENT — point 4 : épreuves, captures, passation
cddf481b 9EWB4-INDICATEURS-CHARGEMENT — point 2 : barre de progression à la navigation
d702ad0b 9EWB4-INDICATEURS-CHARGEMENT — point 1 : écran de chargement par espace
```

Le code exécutable de ce lot se limite à trois fichiers :
`app/(back-office)/loading.tsx`, `app/(mobile)/loading.tsx`, `app/(portail)/loading.tsx`
(trois fichiers quasi identiques, corps commun `components/ui/squelette-chargement.tsx`),
et `components/navigation/barre-progression.tsx`.

## Point 2 — Worktree de mesure, et devis de la suite ENTIÈRE

`git worktree add /tmp/garde 9EWB4B-REPRISE-garde`, `.env`/`.env.example` copiés,
`pnpm install --frozen-lockfile --prefer-offline`.

`CI=1 pnpm verify:full` lancé EN ENTIER au premier plan (sortie complète :
`verify-garde.txt`) :

- `format:check`, `typecheck`, `lint` : verts.
- `pnpm test` : **437 fichiers, 4721 tests, verts.**
- `pnpm test:isolation` : **175 fichiers, 1554 tests, verts.**
- `pnpm build`, `pnpm feries:horizon`, `pnpm audit:partitions` : verts (confirmés par les
  marqueurs de lancement dans `verify-garde.txt`, lignes 105 et 281-300).
- `pnpm test:e2e` (1370 tests, 1 worker, `CI=1` donc **reconstruction `next build` forcée à
  chaque run, pas de réutilisation de serveur**) : lancé, **tué par la limite de l'outil à 60
  min sans avoir fini** — même mesure que 9EWB4B (40 min puis 60 min, jamais fini). **Devis
  confirmé une troisième fois : la suite e2e complète sous `CI=1`, 1 worker, ne finit pas dans
  une fenêtre d'outil d'une heure, et le budget total du lot (180 min) ne permet pas de la
  relancer une quatrième fois jusqu'au bout.**

**Mesure de repli retenue** (la même que 9EWB4B, reproduite indépendamment) : les fichiers
« voisins » du ticket (`*connexion*`, `terrain*`, `fiche-*`, `tous-les-ecrans-rendent*`,
`barre-*`, `9ewb4*` — 30 fichiers trouvés par ce motif, liste dans `subset-garde-run1.txt`)
joués seuls, `CI=1 pnpm exec playwright test <30 fichiers>` :

**108 passés, 4 rouges, 57 non joués** (6,4 min) — sortie complète : `subset-garde-run1.txt`.

Les 4 rouges :

| Fichier:ligne | Titre |
|---|---|
| `tests/e2e/9ewb3-connexion-maquette.spec.ts:219` | `captures › captures — connexion, mot de passe oublié, premier accès, lien plus valide` |
| `tests/e2e/fiche-onglets-sur-place.spec.ts:193` | `sous le rôle ADV › les cinq onglets naviguent, et chacun marque aria-current` |
| `tests/e2e/terrain.spec.ts:84` | `le compteur démarre, se met en pause, et ne se dédouble JAMAIS` |
| `tests/e2e/tous-les-ecrans-rendent.spec.ts:313` | `/arrivee rend 200` |

(Les 57 « non joués » sont, comme mesuré par 9EWB4B, des tests du même fichier qu'un rouge
précédent fait sauter — Playwright n'isole pas un `test.describe` de ceux qui le précèdent
hors de l'ordre de la suite entière.)

**Écart avec la liste de 9EWB4B** (4 rouges + 1 instable : les quatre ci-dessus plus
`fiche-machine.spec.ts`) : dans CETTE mesure, `fiche-machine.spec.ts` n'a pas rougi du tout —
cohérent avec une sensibilité à l'ORDRE d'exécution au sein du sous-ensemble plutôt qu'avec un
défaut stable (voir point 4, `terrain.spec.ts`).

## Point 3 — Liste des épreuves rouges (titres exacts, message, ligne)

1. **`9ewb3-connexion-maquette.spec.ts:219`** — `Test timeout of 30000ms exceeded.` en
   attendant `getByRole('link', { name: 'Technicien', exact: true })` — ligne 212
   (`ouvrirLeVoletTechnicien`), appelée depuis la ligne 225. Capture :
   `test-results/.../error-context.md` montre la page restée sur
   `/parametres/equipe?ajouter=1` SANS que le volet (qui doit afficher le lien « Technicien »)
   soit apparu.
2. **`fiche-onglets-sur-place.spec.ts:193`** — `expect(page).toHaveURL(/onglet=temps/)` a
   échoué, ligne 209 : l'URL reste sur `http://127.0.0.1:3210/interventions/<uuid>` (le clic
   sur l'onglet « Temps » ne fait pas avancer l'URL vers `?onglet=temps`).
3. **`terrain.spec.ts:84`** — `expect(locator).toBeVisible()` a échoué, ligne 90 : le bouton
   « Démarrer l'intervention » n'est pas trouvé ; en retry, `toHaveURL` échoue ligne 123 sur
   l'URL du compteur attendu. **Classé B, voir point 4** — non reproduit hors du sous-ensemble
   de 30 fichiers.
4. **`tous-les-ecrans-rendent.spec.ts:313`** — `expect(pathname).toBe("/planning")` a échoué,
   ligne 346 : `/arrivee` rend 200 mais **reste sur `/arrivee`** au lieu de rediriger vers
   `/planning` pour le compte `COMPTE_ADMIN_SOCIETE_EPREUVE`.

Traces Playwright (`trace.zip`) disponibles sous `/tmp/garde/test-results/` pour les quatre —
non copiées dans ce dépôt (le worktree est supprimé en fin de lot, territoire hors
`docs/diagnostics/`).

## Point 4 — Classement A/B/C

Protocole : chaque rouge rejoué SEUL (avec les trois autres fichiers du même motif, pour
limiter le nombre de combinaisons sans changer le contexte), 3 fois sur `origin/main`
(worktree `/tmp/main`, 7b8e4cfa) puis 3 fois sur la garde (`/tmp/garde`), même
`E2E_DATABASE_URL`. Sorties complètes : `main-4reds-run{1,2,3}.txt`,
`garde-4reds-run{1,2,3}.txt`.

| Épreuve | main (3 essais) | garde (3 essais) | Classe |
|---|---|---|---|
| `9ewb3-connexion-maquette.spec.ts:219` | ✓✓✓ | ✘✘✘ | **A — cassée par le lot** |
| `fiche-onglets-sur-place.spec.ts:193` | ✓✓✓ | ✘✘✘ | **A — cassée par le lot** |
| `tous-les-ecrans-rendent.spec.ts:313` | ✓✓✓ | ✘✘✘ | **A — cassée par le lot** |
| `terrain.spec.ts:84` | ✓✓✓ | ✓✓✓ | **B — instable** (rouge UNIQUEMENT dans le sous-ensemble de 30 fichiers, point 2 ; vert à chaque fois une fois isolé à ce groupe de 4) |

Aucune des quatre n'est de classe C (étrangère) : les trois premières sont bien causées par le
lot, la quatrième n'a jamais été reproduite rouge hors du contexte du sous-ensemble de 30
fichiers, où elle dépend probablement de l'ordre d'exécution et/ou de l'état partagé de la base
e2e (même hypothèse, non prouvée davantage ici, que celle déjà posée par 9EWB4B pour ses 5
rouges/instables).

## Point 5 — Cause prouvée des trois (A)

**Méthode** : dans `/tmp/garde` (jamais commité), déplacement temporaire du seul
`app/(back-office)/loading.tsx` hors de l'arborescence, puis rejeu de l'épreuve seule ;
fichier restauré immédiatement après chaque mesure.

| Épreuve | Sans `app/(back-office)/loading.tsx` | Verdict |
|---|---|---|
| `9ewb3-connexion-maquette.spec.ts:219` | ✓ (5,9 s) | Cause confirmée |
| `fiche-onglets-sur-place.spec.ts:193` | ✓ (2,4 s) | Cause confirmée |
| `tous-les-ecrans-rendent.spec.ts:313` | ✓ (3,1 s) | Cause confirmée |

**Les trois rougissent et reverdissent avec la seule présence de ce fichier.**
`components/navigation/barre-progression.tsx` et `components/ui/squelette-chargement.tsx`
sont restés en place pendant ces trois essais : ils sont donc hors de cause pour ces trois
rouges précis.

**Mécanisme probable (plausible, non instrumenté davantage dans le budget de ce lot)** : un
`loading.tsx` dans un groupe de routes installe automatiquement une limite `<Suspense>`
autour de `{children}` pour CHAQUE page du groupe. Les trois rouges partagent un même symptôme
compatible avec cette limite :

- **`/arrivee`** appelle `redirect("/planning")` conditionnellement, en profondeur dans l'arbre
  serveur (`app/(back-office)/arrivee/page.tsx:107`). Sans `loading.tsx`, Next peut,
  avant d'envoyer le moindre octet, détecter le `redirect()` et répondre par une redirection HTTP que
  le navigateur suit avant que `page.goto()` ne se résolve. Avec `loading.tsx`, le groupe est
  rendu en flux (streaming) : l'enveloppe (habillage + `loading.tsx`) part côté client avec un
  200 avant que le `redirect()` ne soit atteint, qui ne peut plus changer le code HTTP déjà
  parti — la redirection devient alors un geste CÔTÉ CLIENT, après l'évènement `load` que
  `page.goto()` attend, donc jamais observée par l'épreuve au moment où elle regarde l'URL.
- **`/parametres/equipe?ajouter=1`** et **`/interventions/[id]?onglet=temps`** sont deux
  navigations qui ne changent QUE la recherche (`?...`) sur le MÊME chemin. Les deux pages
  lisent `searchParams` côté serveur pour décider quoi afficher (le volet, l'onglet actif) ; la
  même limite `<Suspense>` du groupe entier en profite pour démonter le contenu réel pendant le
  nouveau rendu — un aller-retour qui semble bloquer ou significativement ralentir ces deux cas
  précis (30 s de délai d'attente dépassé pour le premier, 5 s pour le second) alors qu'il ne
  devrait durer que quelques millisecondes en local.

**Ce qui EST prouvé** : la présence du fichier est la cause, à 100 % de reproduction (3/3 dans
les deux sens, plus la mesure A/B ci-dessus). **Ce qui N'EST PAS prouvé** : le mécanisme interne
exact de Next.js 15.5.23 qui transforme cette présence en ces trois symptômes précis — ceci
demanderait une instrumentation plus fine (lire les en-têtes de réponse HTTP de `/arrivee`,
inspecter le flux de streaming) hors du budget de ce lot de mesure.

`components/navigation/barre-progression.tsx` a été lu en détail (il ne fait
QU'écouter un clic document, sans jamais appeler `preventDefault()` ni `stopPropagation()`, et
renonce explicitement — ligne 82 — quand le chemin cible égale le chemin courant, précisément
le cas de ces deux navigations par recherche seule) : rien dans ce fichier n'explique les trois
rouges, cohérent avec la mesure A/B qui l'a laissé en place sans effet.

## Point 6 — Proposition de correction minimale, et ce qui peut être livré seul

**Proposition minimale** : retirer `app/(back-office)/loading.tsx` (et lui seul) de ce lot
avant toute nouvelle tentative de fusion, en conservant `app/(mobile)/loading.tsx`,
`app/(portail)/loading.tsx`, `components/navigation/barre-progression.tsx` et
`components/ui/squelette-chargement.tsx` tels quels — **aucun rouge de classe A mesuré dans ce
lot ne touche le groupe `(mobile)` ni `(portail)`.** Le retrait du seul fichier back-office a
été vérifié ci-dessus comme suffisant pour reverdir les trois (A).

**Épreuves à rejouer pour valider** : les trois lignes du point 5, PLUS — par prudence, les 57
tests « non joués » du point 2 n'ayant jamais pu s'exécuter dans cette mesure —
`tests/e2e/fiche-onglets-sur-place.spec.ts` et `tests/e2e/tous-les-ecrans-rendent.spec.ts` EN
ENTIER, et idéalement `CI=1 pnpm test:e2e` complet une fois que la cause est effectivement
corrigée (seule mesure qui engagerait vraiment la suite entière).

**Espace livrable seul** : sur cette seule mesure, **`(mobile)` et `(portail)` n'ont montré
aucun rouge de classe A** — le seul rouge touchant le terrain (`(mobile)`),
`terrain.spec.ts:84`, est classé B (instable, non reproduit hors du sous-ensemble de 30
fichiers) et non imputé au lot. **Réserve explicite** : la suite e2e complète (1370 tests)
n'a JAMAIS fini de jouer dans cette mesure ni dans les deux précédentes (9EWB4B) — ce constat
porte sur les 30 fichiers du motif « voisins », pas sur l'ensemble du dépôt. Une régression de
`(mobile)` ou `(portail)` ailleurs dans la suite n'est pas exclue par cette mesure.

**Ce qui N'A PAS pu être fait, et pourquoi** : la cause exacte (mécanisme Next.js) n'a pas été
creusée au-delà de la preuve empirique par retrait/remise du fichier — le budget restant après
les six mesures A/B/C et les trois essais de cause (point 5) ne permettait pas d'instrumenter
plus finement (en-têtes HTTP, flux de streaming) sans dépasser T0+150 min. La correction
elle-même (retrait du fichier, ou correctif plus fin dans `app/(back-office)/arrivee/page.tsx`
et les deux pages à recherche seule) est volontairement absente de ce lot (D112 : « ce lot
MESURE, il ne corrige rien »).

## Pièces jointes (sorties `tee` complètes)

- `verify-garde.txt` — `CI=1 pnpm verify:full` sur la garde, tué à 60 min pendant `test:e2e`.
- `subset-garde-run1.txt` — les 30 fichiers « voisins » sur la garde (mesure de repli).
- `main-4reds-run{1,2,3}.txt` — les 4 candidats, 3 essais, sur `origin/main`.
- `garde-4reds-run{1,2,3}.txt` — les 4 candidats, 3 essais, sur la garde.

Worktrees temporaires (`/tmp/garde`, `/tmp/main`) supprimés à la fin de ce lot.
