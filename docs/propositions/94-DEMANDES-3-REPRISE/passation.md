# 94-DEMANDES-3-REPRISE — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

1. **Fusion de `89-DEMANDES-3-garde`** dans `main` : « Demandes » entre au
   menu (écart nommé D133), avec le bouton « Créer une intervention » sur
   `/demandes` et l'épreuve `tests/e2e/demandes-3.spec.ts`. Fusion propre
   (`git merge`, pas de conflit) — pour l'exploitation, rien de nouveau par
   rapport à ce que `89-DEMANDES-3` décrivait déjà dans sa propre
   passation (conservée telle quelle sous
   `docs/propositions/89-DEMANDES-3/passation.md`).
2. **`tests/e2e/registre-5.spec.ts`** : le texte recherché (et le libellé
   du client cible qui doit le contenir) porte désormais un suffixe tiré
   au sort **par exécution** (`uuidv7()`), composé à partir de la clé i18n
   `registre5.e2e.texte_recherche` — jamais un littéral. Pour
   l'exploitation, rien ne change à l'écran ; ce qui change, c'est que la
   scène d'une exécution ne peut plus jamais être confondue avec celle
   d'une exécution précédente restée en base (`afterAll` non joué, base de
   test non réinitialisée entre deux lancements de `playwright test`).
3. Je n'ai touché à aucune ligne de `tests/e2e/
   parcours-creer-puis-planifier.spec.ts` : voir « Ce que j'ai tranché ».

## Ce que j'ai mesuré

- **AVANT** (constat du 25/09 16h26, non rejoué ici — je pars de sa
  description) : `tests/e2e/registre-5.spec.ts:161` — `table tbody tr`
  attendu 1, trouvait 2 pour `?q=RG5-cible` (texte fixe, ligne restée
  d'une exécution précédente).
- **APRÈS**, mesuré :
  - `registre-5.spec.ts` seul, **rejoué deux fois de suite** (chaque
    lancement reconstruit la base via le setup global) : **2/2 tests
    passés les deux fois** — `table tbody tr` trouve bien 1 ligne, la
    scène étant désormais nommée par un texte unique à l'exécution.
  - `parcours-creer-puis-planifier.spec.ts` seul, **rejoué trois fois de
    suite** : **3/3 tests passés les trois fois** (51,7 s / 49,8 s /
    51,8 s) — jamais rouge, donc non touché (règle du ticket : « s'il
    reste vert, écris-le et n'y touche pas »).
  - `pnpm typecheck` : vert, aussitôt après la fusion.
  - `pnpm test` (unitaires) : **2843 tests passés** sur 264 fichiers.
  - `pnpm verify:full` **en entier, en un seul appel, au premier plan**
    (`CI=1`) : **vert de bout en bout** — format, typecheck, lint, 2843
    tests unitaires, 1239 tests d'isolation, build de production,
    `feries:horizon`, `audit:partitions`, et **la suite e2e complète :
    274 tests passés, 3 skips préexistants et nommés (hors de ce lot,
    dans `tests/e2e/tous-les-ecrans-rendent.spec.ts`), zéro échec**. Les
    deux épreuves ciblées par ce ticket sont vertes à l'intérieur de cette
    même exécution complète, sous `fullyParallel`.

## Ce que j'ai tranché, et pourquoi

- **`parcours-creer-puis-planifier.spec.ts` n'a reçu aucune modification.**
  Rejoué seul trois fois (3/3 vert) puis à l'intérieur de la suite
  complète (vert), il n'a jamais rougi dans cette session. Le ticket est
  explicite : « s'il reste vert, écris-le dans la passation et n'y touche
  pas ». Je n'ai donc pas cherché de cause UTC+11 à corriger — il n'y a
  rien à diagnostiquer sur une épreuve qui n'a pas échoué ici.
- **Le mécanisme d'unicité de `registre-5.spec.ts`** : un suffixe
  `uuidv7()` composé avec la clé i18n plutôt qu'un littéral ajouté à côté.
  `CLIENT_CIBLE_RAISON` est dérivé par `String.replace` du texte de
  `registre5.e2e.client_cible`, en y substituant le texte de recherche
  unique — ce qui préserve automatiquement la propriété exigée par
  l'épreuve (`client_cible` contient `texte_recherche` en sous-chaîne,
  `client_autre` ne le contient jamais) sans dupliquer le reste du
  libellé (« — Client de l'épreuve ») en un second littéral dans le
  fichier de test.
- **Aucune assertion modifiée** dans `registre-5.spec.ts` : le témoin
  « exactement 1 » (ligne 171) est resté à l'identique, seule la donnée
  cherchée a changé de valeur.

## Ce que je n'ai pas fait

- Aucune migration, aucune ligne de semis, aucun prix.
- Aucun `skip`/`fixme`, aucun `retries`, aucun `workers: 1` ajouté — la
  configuration e2e existante (`workers: 1` déjà présent dans
  `playwright.config.ts`) n'a pas été touchée.
- Je n'ai rien changé dans `depot/` ni dans `11-FILE.sh`.
- Je n'ai pas cherché ni corrigé de cause UTC+11 dans
  `parcours-creer-puis-planifier.spec.ts` : hors mandat, l'épreuve n'a
  jamais rougi (voir « Ce que j'ai tranché »).
- Je n'ai pas relu `registre-2.spec.ts` ni d'autres épreuves du registre
  au-delà de `registre-5.spec.ts`, hors périmètre du ticket.

## Les pièges pour la session suivante

- **La base de test locale n'est pas réinitialisée entre deux lancements
  de `playwright test`** : seules les migrations manquantes sont
  appliquées et le semis est rejoué par-dessus (`db.seed` ignore les
  lignes déjà présentes). Toute épreuve qui pose une scène propre doit
  donc soit nommer ses données de façon unique par exécution (le geste
  posé ici), soit garantir que son `afterAll` nettoie même en cas
  d'échec — sinon une exécution interrompue laisse une trace qui peut
  fausser la suivante.
- `CLIENT_CIBLE_RAISON` est **dérivé par substitution de chaîne**, pas
  recomposé à la main : si `registre5.e2e.client_cible` change de forme
  dans `lib/i18n/fr.ts` au point de ne plus contenir exactement
  `registre5.e2e.texte_recherche` comme sous-chaîne, `.replace()` ne
  remplacera rien et le témoin « exactement 1 » redeviendra faux — sans
  message d'erreur explicite avant l'échec de l'assertion elle-même.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce ticket. `pnpm verify:full`
  est vert de bout en bout, fusion comprise.
