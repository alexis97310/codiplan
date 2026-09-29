# 9BO-TP-UX0-DOCS — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- Copié à l'identique, depuis `/mnt/c/Users/aplou/OneDrive/Bureau/Développement/CODIPLAN/ergonomie-28-09/` (poste local, hors
  dépôt), vers `docs/propositions/ergonomie-2026-09-28/` :
  - `ergonomie-graphisme-usage-2026-09-28.md`, `lots-ux.md`, `maquette-toutes-pages.html` ;
  - le dossier `captures/` entier (`README.md`, `index.json`, `bureau-1440/` 73 fichiers, `telephone-390/` 22 fichiers,
    `etats/` 12 fichiers).
- Ajouté une ligne juste sous le titre de `docs/audit-ergonomie-2026-09-28.md` :
  « Complément du 28/09/2026 : ergonomie, graphisme et usage, avec la maquette de toutes les pages —
  `docs/propositions/ergonomie-2026-09-28/ergonomie-graphisme-usage-2026-09-28.md`. » Rien d'autre n'a changé dans ce
  fichier.
- Pour l'exploitation : la spécification « ergonomie, graphisme et usage » du 28/09/2026, ses lots TP-UX, sa maquette de
  toutes les pages et ses captures sont désormais dans le dépôt, sous rang 4/5 (narratif, pas normatif — aucune règle
  métier n'y a été ajoutée), consultables par quiconque clone `main` sans dépendre du poste local ni de OneDrive.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- Empreintes MD5 des trois fichiers racine et de `captures/README.md`, `captures/index.json`, comparées **avant** copie
  (mesure du pilote, 29/09) et **après** copie dans le dépôt — identiques dans les six cas :
  - `ergonomie-graphisme-usage-2026-09-28.md` : `97d414cf1549761770129b148f4c2558`
  - `lots-ux.md` : `cfa239949ae2ab50f522a80fc8f3ce90`
  - `maquette-toutes-pages.html` : `dd79840e52a3bc1766dcea77c645aaf3`
  - `captures/README.md` : `9437a02a8cbbb2788cca947db0750131`
  - `captures/index.json` : `e8b214ecd9b7207a11a3dbcc50c56aae`
- Comptage des fichiers de captures, AVANT (source) / APRÈS (dépôt) — identiques : `bureau-1440/` 73/73,
  `telephone-390/` 22/22, `etats/` 12/12. Total du dossier `captures/` copié : 109 fichiers (73+22+12+README.md+index.json).
- Contrôle I9 :
  ```
  grep -rniE 'Plouvier|Gu[eé]rin|Wamytan|Poigoune|Tjibaou|Prony|Plum' docs/propositions/ergonomie-2026-09-28/ \
    --include="*.md" --include="*.html" --include="*.json"
  ```
  Résultat : aucune correspondance (code de sortie 1). Aucun nom réel trouvé.
- Contrôle hors ligne :
  ```
  grep -oE '(src|href)="https?://' docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html
  ```
  Résultat : aucune correspondance (code de sortie 1). La maquette ne référence aucune ressource distante ; police
  embarquée comme annoncé par le pilote.
- `CI=1 pnpm verify:full` : `format:check`, `typecheck`, `lint`, `test` (3203 tests, 309 fichiers), `test:isolation`
  (1281 tests, 134 fichiers), `build`, `feries:horizon`, `audit:partitions` — tous verts, aucun gardien n'a rougi sur les
  fichiers copiés. `test:e2e` : 613 passed, 3 skipped, **1 failed** — voir « le conflit non résolu » ci-dessous.
- `git show --stat HEAD` (après commit) :
  ```
  9BO-TP-UX0-DOCS — spécification ergonomie, lots TP-UX, maquette et captures du 28/09

   docs/audit-ergonomie-2026-09-28.md                                         |   2 +
   docs/propositions/9BO-TP-UX0-DOCS/passation.md                             | ...
   docs/propositions/ergonomie-2026-09-28/ergonomie-graphisme-usage-2026-09-28.md | ...
   docs/propositions/ergonomie-2026-09-28/lots-ux.md                          | ...
   docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html          | ...
   docs/propositions/ergonomie-2026-09-28/captures/... (109 fichiers)
  ```
  (voir la sortie réelle de la commande, collée telle quelle par la session suivante si besoin — le chiffre exact de
  fichiers modifiés/ajoutés est celui rendu par git, non recompté ici à la main).

## Ce que j'ai tranché et pourquoi

- Je n'ai touché à aucun octet des trois fichiers texte ni des images de captures : copie strictement à l'identique
  (`cp`), conformément à la consigne — les empreintes MD5 le prouvent.
- Je n'ai pas retouché `docs/audit-ergonomie-2026-09-28.md` au-delà de la ligne demandée : ce fichier appartient à un
  autre lot (9BK) et rien n'indiquait d'y ajouter autre chose.
- Je n'ai pas ajouté `prompt-pilote-ergonomie.md` ni `captures-28-09.zip` au dépôt : la consigne les exclut explicitement.
- Le seul rouge rencontré (`tests/e2e/planning-fenetre-pose.spec.ts`) est étranger à mon territoire (aucun fichier de
  code ni de test dans ce lot) et le fichier de test a été modifié pour la dernière fois par un autre lot (9BGA,
  `a4eb16c`) — je n'ai donc pas touché à ce fichier, ni à son assertion, ni à sa mise en scène, conformément à
  l'interdiction de ce lot de toucher au code ou aux tests.

## Ce que je n'ai PAS fait

- Je n'ai pas diagnostiqué en profondeur la cause du rouge `planning-fenetre-pose.spec.ts` (pas de lecture du fichier
  au-delà de son nom et de son historique git) : mon territoire ne couvre ni le code ni les tests, et le lot interdit
  explicitement d'y toucher.
- Je n'ai pas relancé `pnpm test:e2e` une seconde fois en entier (24,5 minutes la première fois) : la même épreuve a
  déjà rougi deux fois de suite au sein du même passage (tentative initiale + reprise automatique de Playwright), ce qui
  correspond au seuil « deux rouges, tu t'arrêtes » du lot.
- Je n'ai touché à aucun des 81 fichiers PNG modifiés ailleurs dans le dépôt (visibles en `git status` en tête de
  session, sous des dossiers `docs/propositions/*/captures/` d'autres lots) : ils sont étrangers à mon territoire et
  n'ont pas été ajoutés à mon commit.

## Les pièges pour la session suivante

- `tests/e2e/planning-fenetre-pose.spec.ts:124` (« le dépôt d'une carte de la file ouvre la fenêtre de pose... »)
  échoue de façon reproductible dans ce passage (tentative + reprise) sur
  `locator('[data-fenetre-pose="..."]').locator('fieldset')...locator('button').first()` introuvable en 5 s. Le fichier
  n'a pas été touché depuis 9BGA (`a4eb16c`) — cette épreuve semble avoir régressé ou devenir flaky indépendamment de ce
  lot, qui n'a modifié aucun code ni test. À investiguer par une session qui a le droit de toucher au code/tests.
- Un `git status` en tête de session montrait déjà 81 fichiers PNG modifiés sous plusieurs `docs/propositions/*/captures/`
  (probablement le résidu d'une exécution e2e locale antérieure, non commitée) — je ne les ai pas touchés ; une session
  future devrait vérifier s'ils doivent être commités, réinitialisés, ou ignorés.
- Le dossier source sur le poste local (`.../ergonomie-28-09/`) contient encore `prompt-pilote-ergonomie.md` et
  `captures-28-09.zip`, volontairement exclus du dépôt — ne pas les copier par réflexe dans une session future.

## Ce qui reste à faire

- Traiter le lot TP-UX0 lui-même : lire `docs/propositions/ergonomie-2026-09-28/ergonomie-graphisme-usage-2026-09-28.md`
  et `lots-ux.md` pour dériver les tickets/lots TP-UX à ouvrir (hors périmètre de ce lot, qui n'était que le dépôt des
  documents).
- Faire diagnostiquer et corriger (ou confirmer comme flaky connu) l'échec de `planning-fenetre-pose.spec.ts` par une
  session habilitée à toucher au code/tests.
- Clarifier le sort des 81 PNG modifiés non commités observés en tête de session.
