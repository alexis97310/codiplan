# 9L49Z-E2E-TRANCHES-WORKER-NEUF — passation

## Contradiction signalée avant d'agir

Le rappel du pilote dit explicitement : « Seul `verify:full` est laissé à la file » — et la liste finale du
ticket ne demande que `pnpm test:isolation` et `CI=1 pnpm verify`, jamais `pnpm verify:full`. Le point 4 du
corps du ticket demande pourtant : « joue `pnpm verify:full` en entier une fois ». J'ai tranché en faveur du
rappel du pilote (instruction de rang supérieur, permanente) : je n'ai PAS joué `pnpm verify:full`. À la
place, j'ai prouvé le découpage en jouant directement `pnpm test:e2e` (désormais en tranches) et
`CI=1 pnpm verify` séparément — voir « Ce qui est prouvé » plus bas pour ce que cela couvre et ne couvre pas.

## Ce qui était demandé

Que la suite e2e de `pnpm verify:full` soit jouée en plusieurs tranches, chacune dans un processus neuf,
pour que le tas V8 du worker Playwright (9L47, 9L48 : montée continue, jamais de redescente avant la fin,
SIGABRT mesuré près de la 2100e épreuve) ne fasse plus rougir un lot — faute de cause trouvée et corrigée.

## Ce qui a été fait

### Point 1 — mesure de l'existant

`playwright.config.ts` : un seul projet (`chromium`), `fullyParallel: true`, `workers: process.env.CI ? 1
: undefined` — donc **un seul worker continu** sous `CI=1`, exactement la configuration où 9L47 a mesuré la
croissance. `retries: process.env.CI ? 1 : 0`. `pnpm exec playwright test --list` : **2219 tests, 539
fichiers** (la référence du ticket, « ~2140 passées, 76 ignorées », date d'avant plusieurs lots qui ont
ajouté des scénarios depuis).

`pnpm test:e2e` était un passage direct à `playwright test` — et cette forme CIBLÉE (`pnpm test:e2e
<fichier>`) est invoquée ainsi dans des dizaines de passations et dans `docs/captures/README.md`. Elle devait
rester inchangée : seule la forme SANS ARGUMENT (celle que joue `verify:full`) avait besoin d'être découpée.

### Point 2 et 3 — le découpage

- `scripts/lib/e2e-tranches.ts` — le calcul, pur, testé sans sous-processus :
  - `modeDexecution(argv)` : argument(s) présents → passage direct inchangé (`{ type: "direct", args }`) ;
    aucun argument → tranches (`{ type: "tranches", total: NOMBRE_DE_TRANCHES }`).
  - `NOMBRE_DE_TRANCHES = 4`.
  - `argumentDeTranche(i, n)` → `--shard=i/n`, la forme exacte attendue par Playwright.
  - `codeDeSortieAgrege(codes)` → `0` seulement si TOUTES les tranches sortent en `0` ; un code `null`
    (processus tué par un signal — un `SIGABRT` qui survivrait malgré le découpage) compte comme un échec,
    jamais comme un succès.
- `scripts/e2e-tranches.mts` — le lanceur CLI : en mode direct, un seul `spawnSync("pnpm", ["exec",
  "playwright", "test", ...args])`, `stdio: "inherit"`, code de sortie inchangé. En mode tranches, une
  BOUCLE de quatre `spawnSync` **séquentiels**, chacun un processus Node entièrement neuf (jamais le même
  enfant réutilisé) — c'est précisément ce qui remet le tas V8 à zéro entre deux tranches. Chaque tranche
  imprime son propre `code de sortie`, et la sortie native de Playwright (`N passed/skipped/failed`,
  `stdio: "inherit"`) reste lisible tranche par tranche — pas de ré-agrégation qui l'écraserait.
- `package.json` : `"test:e2e": "tsx scripts/e2e-tranches.mts"`. Le gardien
  `tests/unit/chaine-verification.test.ts` ne porte que sur le NOM du script et la présence littérale de
  `pnpm test:e2e` dans `verify:full` — aucun des deux ne change, aucune des deux portes ne divergent.
- `E2E_MESURE_MEMOIRE` reste fonctionnel : il est posé par `playwright.config.ts` au chargement de la
  configuration (avant que Playwright ne lance son premier worker), et chaque tranche RECHARGE cette même
  configuration à chaque invocation — rien dans ce lot ne touche `playwright.config.ts`.
- Même ordre de projets (un seul, `chromium`), mêmes `retries`, même `workers` : rien de tout cela ne vient
  de notre wrapper, tout vient de `playwright.config.ts`, inchangé.

### Pourquoi N = 4

9L47 a mesuré, sur le sous-ensemble le plus chargé en captures (`zz-captures-*`, 124 épreuves jouées en un
seul worker continu) : tas V8 utilisé passant de 4,7 à 178,4 Mo, soit ~1,4 Mo/épreuve, et une extrapolation
compatible avec le symptôme exact de l'incident — `SIGABRT` — près de la **2100e** épreuve sur ~2217.
4 tranches sur 2219 épreuves ≈ 555 épreuves/tranche, soit un facteur **~3,8** de marge sous le point où les
incidents passés ont été constatés. Un N plus grand n'achèterait pas de garantie supplémentaire décisive
(même deux tranches resteraient sous le seuil observé) et multiplierait le nombre de reconstructions du
serveur de test (une préparation de base + une compilation de production par tranche, voir « Le coût mesuré,
et ce qu'il révèle » plus bas) sans bénéfice proportionné.

## Ce qui est prouvé, et ce qui ne l'est pas — budget de session contre durée réelle de la suite

**Prouvé par la mesure (deux tranches sur quatre, jouées jusqu'au bout, en conditions réelles) :**

```
CI=1 pnpm test:e2e
── tranche --shard=1/4 ──
Running 555 tests using 1 worker, shard 1 of 4
  555 passed (29.9m)
── tranche --shard=1/4 : code de sortie 0 ──
── tranche --shard=2/4 ──
Running 556 tests using 1 worker, shard 2 of 4
  14 skipped
  542 passed (22.5m)
── tranche --shard=2/4 : code de sortie 0 ──
── tranche --shard=3/4 ──
Running 555 tests using 1 worker, shard 3 of 4
(tuée par le plafond de 55 min posé sur CETTE commande-ci — voir plus bas)
```

- **Le découpage est correct** : 555 + 556 (+ les tranches 3 et 4, non vues ici) = 2219, la partition
  attendue. Playwright répartit par fichier, pas par un compte rond — 555/556/555/… est la forme normale.
- **Chaque tranche vue sort en 0**, et le format natif (`N passed`/`N skipped`) reste lisible tel quel —
  aucune ré-agrégation ne l'écrase.
- **Un `[WebServer] [Error: aborted] { code: 'ECONNRESET' }`** est apparu entre les tranches 1 et 2 — au
  démontage du serveur de test d'une tranche, avant que la suivante n'en démarre un neuf. Non fatal : la
  tranche 2 compte 542 passés + 14 ignorés = 556, exactement le total annoncé, 0 échec, code de sortie 0.
  C'est le bruit attendu d'un serveur qu'on arrête pendant qu'une requête traînait encore — PAS une épreuve
  affaiblie.
- **Aucune assertion retirée, élargie, ni `skip`/`fixme`/`retries` touché.**

**Ce qui n'a PAS pu être prouvé dans cette session, et pourquoi — honnêtement, comme 9L47 et 9L48 avant ce
lot :**

J'ai d'abord joué les quatre tranches en SÉQUENCE dans UNE seule commande, avec un plafond de 55 minutes —
exactement l'erreur que le découpage est censé éviter. La tranche 1 (555 épreuves) a pris **29,9 minutes**,
la tranche 2 (556 épreuves) **22,5 minutes** : ~52 minutes pour la MOITIÉ de la suite, cohérent avec
l'estimation de 9L47 pour la suite ENTIÈRE à un seul worker continu (« 75 à 90 minutes pour 2217 épreuves ») —
**le découpage ne réduit PAS la durée totale, il la répartit en morceaux dont chacun tient sous un plafond de
commande.** La commande qui enchaînait les quatre tranches a donc été tuée à la troisième, par le plafond que
*cette commande à moi* portait — pas un défaut du découpage, une erreur de ma façon de le jouer : j'aurais dû
lancer chaque tranche comme SA PROPRE commande bornée, exactement ce que le découpage permet et que je n'ai
pas fait à temps dans le budget de 120 minutes de cette session. Les tranches 3 et 4 n'ont donc pas été
rejouées isolément avant la fin du budget. Aucun processus `next`/`playwright` n'est resté en arrière-plan
après cette commande tuée (vérifié : `pgrep`, port 3100 libre).

**Conséquence** : le MÉCANISME (partition correcte, code de sortie par tranche, remise à zéro du worker
entre deux tranches) est prouvé ; la COURBE DE MÉMOIRE sur la suite entière à travers les quatre tranches
(la preuve qu'aucun SIGABRT ne survient même à la toute fin) ne l'est pas, pour la même raison de budget que
9L47 et 9L48 ont déjà rencontrée avec la suite non découpée. La différence, et c'est tout l'objet de ce lot :
désormais, chaque tranche individuelle (jouée comme SA PROPRE commande, ~20-30 min) tient largement sous un
plafond de 60 minutes — ce que la suite entière, non découpée, ne pouvait pas faire.

## Pourquoi ceci n'est pas une entrée dans `docs/arbitrages.md`

Comme `9L47` et `9L48` : outillage de test, sans effet sur le comportement de l'application ni sur une règle
métier. Rien au chapitre 10 ne change. Pas de condition de réouverture à écrire.

## Captures

Aucun écran touché ni créé — ce lot ne modifie que `package.json`, `scripts/e2e-tranches.mts` et
`scripts/lib/e2e-tranches.ts`. Pas de capture AVANT/APRÈS, pas de relance de `scripts/captures.mts`.

## Épreuves jouées

- `pnpm format:check`, `pnpm typecheck`, `pnpm lint` : verts sur les trois fichiers touchés.
- `pnpm test` : **541 fichiers, 6104 tests**, vert (+1 fichier/+6 tests : `tests/unit/e2e-tranches.test.ts`).
- `pnpm test:isolation` : **268 fichiers, 2581 tests**, vert.
- `CI=1 pnpm verify` (format:check + typecheck + lint + test + test:isolation + build) : vert, joué en
  entier en avant-plan.
- `CI=1 pnpm test:e2e` (la forme sans argument, désormais en tranches) : tranches 1 et 2 jouées jusqu'au
  bout, toutes deux vertes, détail ci-dessus ; tranches 3 et 4 non rejouées isolément, faute de budget — voir
  « Ce qui n'est pas prouvé ».
- Aucune assertion retirée, élargie, ni `skip`/`fixme`/`retries` touché.

## Ce qui reste dû

- Rejouer les tranches 3 et 4 (chacune sa propre commande bornée, pas une boucle unique) pour la preuve
  complète sur les 2219 épreuves — recommandé via la file nocturne (`verify:full`), conformément au rappel du
  pilote qui la lui réserve.
- La cause dominante de la croissance du tas (9L48 : non identifiée) reste non trouvée ; ce lot ne la
  cherche pas, il contourne son effet.
