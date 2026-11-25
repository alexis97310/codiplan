# 9L41C-E2E-CAPTURES-RELANCE-SURE — passation

Deux incidents sans rapport (9L38A le 25/11 03:23, 9L41 le 25/11 09:47) ont rougi au 1er passage de
`verify:full` pour la même raison : un worker Chromium meurt (SIGABRT) tard dans la suite e2e
(`zz-captures-*.spec.ts`, ~2100 tests, ~1h30), la relance automatique de Playwright (CI, `retries: 1`)
ouvre un worker NEUF contre la MÊME base, et retombe sur des données laissées par la tentative
interrompue. **Aucune migration.**

## Point 1 — mesure du SIGABRT

**Non reproduit, et je ne l'ai pas forcé.** Rejouer la suite entière jusqu'au point de crash (~1h30,
d'après le constat du pilote) dépasse largement le budget de ce lot et le rappel du pilote (épreuves au
premier plan, pas la file) ; je n'ai donc pas de mesure de mémoire PROUVÉE à livrer, et je ne corrige
rien sur la seule foi d'une hypothèse.

Ce que l'examen statique montre :
- `playwright.config.ts` : `workers: 1` en CI, un seul navigateur Chromium réutilisé pour TOUTE la
  suite d'un worker — c'est la forme par défaut de Playwright (un processus long-vécu, des milliers de
  pages ouvertes et fermées), pas un réglage propre à ce dépôt.
- Aucun plafond mémoire n'est posé pour `playwright test` lui-même (`--max-old-space-size=6144` existe
  pour `pnpm typecheck` et `pnpm build`, pas pour le processus Playwright/Node qui pilote les workers).
- J'ai cherché un contexte ou une page ouverte « à la main » (`browser.newContext()` /
  `context.newPage()`) et jamais refermée dans `tests/e2e/**/*.spec.ts` : les neuf fichiers qui en créent
  referment au moins autant qu'ils en ouvrent. Rien de probant trouvé par ce chemin.

**Hypothèse, non prouvée** : une croissance progressive de la mémoire du processus Chromium long-vécu
(normal après des milliers de navigations, Chromium durcit parfois ce cas par un `abort()` plutôt qu'un
`OOM-kill` silencieux côté noyau) — cohérente avec « meurt tard, après ~2100 tests » plutôt qu'après un
délai fixe, mais pas vérifiée ici.

**Proposition pour un prochain lot**, si le pilote veut la mesure prouvée : un hook `afterEach` (actif
seulement sous une variable d'environnement de diagnostic, jamais en service normal) qui journalise
`process.memoryUsage()` et, si possible, la mémoire du processus Chromium sous-jacent
(`browser.process()?.pid`, lu via `/proc/<pid>/status` sous Linux) toutes les N exécutions — à jouer une
fois en conditions réelles (CI, suite entière) pour obtenir une vraie courbe plutôt qu'une supposition.

## Point 2 — amorçages rejouables (le cœur de ce lot)

### Le mécanisme exact de la collision

Chaque fichier `zz-captures-*.spec.ts` déclare ses identifiants en portée MODULE — `uuidv7()` ou
`randomUUID()` pour la plupart, tirés une fois par CHARGEMENT du fichier. Un crash dur (SIGABRT) tue le
worker AVANT que `afterAll` n'ait pu nettoyer ; la relance recharge le fichier dans un processus NEUF,
qui tire de NOUVEAUX identifiants aléatoires. Ceux-ci ne collisionnent jamais avec ceux de la tentative
précédente — mais un identifiant FIXE (littéral), lui, reste identique d'une tentative à l'autre et
percute une contrainte unique.

Les `nettoyer()` déjà en place dans certains fichiers (`9do`, `9eb1`, `9i6`…), appelés en tête de
`beforeAll`, suppriment par les IDs aléatoires DE LEUR PROPRE exécution — utiles contre une relance
Playwright DANS LE MÊME worker (un retry qui recharge le même module n'existe pas ; ce qui existe, c'est
un `beforeAll` qui s'exécute deux fois dans le même processus après un échec intra-fichier), mais inertes
contre le scénario mesuré ici : un worker NEUF, donc des IDs neufs, qui ne reconnaissent jamais la trace
laissée par le worker mort.

### Les cinq fichiers corrigés

J'ai cherché, dans tous les `zz-captures-*.spec.ts` (29 fichiers), toute valeur LITTÉRALE posée sur un
champ que `prisma/schema.prisma` contraint par `@@unique` et qui n'est PAS `(societe_id, id)` (ces
dernières sont sans risque : l'`id` est aléatoire à chaque exécution). Trois familles trouvées :

| Fichier | Identifiant fixe | Contrainte percutée |
|---|---|---|
| `zz-captures-9l08d-terrain-tailles-maquette.spec.ts` | `checklist_modele.code = "ZZ9L08D-GENERIQUE"` | `(societe_id, code)` — **l'incident 9L38A, constaté** |
| `zz-captures-9g9b.spec.ts` | adresse `9g9b.${phase}-${largeur}@codima.test` passée à `signUpEmail` | `utilisateur.email` — **l'incident 9L41, constaté** |
| `zz-captures-9h5-correctifs-9g6.spec.ts` | `EMAIL_ENROLEMENT = "9h5.capture@codima.test"` passée à `signUpEmail` | `utilisateur.email` — même défaut, pas encore observé |
| `zz-captures-9do.spec.ts` | `client.code_externe = "9DOA"` / `"9DOB"` | `(societe_id, code_externe)` — même défaut, pas encore observé |
| `zz-captures-9eb1.spec.ts` | `client.code_externe = "9EB1-CAPT-001"` | `(societe_id, code_externe)` — même défaut, pas encore observé |

`9do` et `9eb1` sont inertes sans leur variable `CAPTURES_9DO`/`CAPTURES_9EB1` (`test.skip` en tête) :
hors du chemin nocturne ordinaire, mais pas hors de portée de `scripts/captures.mts`, qui les joue avec
ces variables posées — donc le même défaut, à une échelle d'usage plus rare.

**Le correctif, identique dans son principe pour les cinq** : juste avant de créer la ligne qui porte
l'identifiant fixe, chercher une ligne EXISTANTE sous ce même identifiant (jamais sous l'ID aléatoire de
l'exécution en cours) et, si elle existe, la supprimer — avec ses dépendants, dans l'ordre que les clés
étrangères `Restrict` imposent (intervention → contact/site → client ; version → modèle de checklist ;
journal d'accès → rattachement société → utilisateur) — avant de poser la ligne neuve.

### Les 24 autres fichiers, examinés et jugés sans ce défaut

Pour les 24 autres `zz-captures-*.spec.ts` : soit ils ne créent aucune ligne sous un champ `@@unique`
littéral (la quasi-totalité — leurs `beforeAll` ne font que des `findFirstOrThrow` sur `societe`/`agence`
existantes, puis des créations sous des identifiants aléatoires sur des champs sans contrainte, ex.
`contact.email`, qui n'est PAS unique au schéma), soit ils sont eux-mêmes gardés par `test.skip` sans
leur variable `CAPTURES_*` ET ne portent aucun champ `@@unique` littéral dans leurs créations (`9dn`,
`9g8e`, `9g8f`, `9g3-point1/2/3`, `9i6` — celui-ci nettoie déjà par ses propres IDs aléatoires, qui
suffisent puisque RIEN n'y est fixe).

Je n'ai pas cherché au-delà des champs que `prisma/schema.prisma` contraint par `@@unique` — c'est le
seul risque de BLOCAGE (un échec qui empêche la relance de réussir) ; des données orphelines sous des IDs
aléatoires fuiteraient toujours d'un crash non nettoyé, mais ne font échouer personne.

`tests/e2e/setup/scene-*.ts` : aucun n'est importé par un `zz-captures-*.spec.ts` (vérifié par recherche
textuelle) — hors du périmètre de ce lot.

## Pourquoi ceci n'est pas une entrée dans `docs/arbitrages.md`

Rien n'est une règle métier, ni un arbitrage au sens du §8 du `CLAUDE.md` : c'est une correction de
harnais de test, sans effet sur le comportement de l'application. Aucune règle ne change, donc aucune
condition de réouverture à écrire.

## Captures

**Aucun écran touché ni créé** — ce lot ne modifie que des amorçages de scènes e2e (`beforeAll`), jamais
du code d'écran. Pas de capture AVANT/APRÈS, pas de relance de `scripts/captures.mts`.

## Épreuves jouées

- `pnpm typecheck`, `pnpm lint` : verts.
- Simulation directe (hors suite, scripts jetables non commités) : pour chacun des cinq fichiers, pose
  d'une ligne « fuyante » sous l'identifiant fixe exactement comme un worker mort l'aurait laissée, puis
  rejeu de la logique de nettoyage ajoutée — la seconde création réussit sans collision, pour les trois
  champs `code`/`code_externe` (Prisma direct) ET pour les deux adresses passées à `signUpEmail`
  (`creerAuth`/`better-auth`, par `tsx` avec les alias `@/lib/...`).
- `pnpm exec playwright test` sur les cinq fichiers, base e2e réelle : 25 passants (9do/9eb1 retombent
  sur leur `test.skip` sans `CAPTURES_*`, comportement attendu, inchangé).
- `pnpm exec playwright test zz-captures-9do.spec.ts zz-captures-9eb1.spec.ts` avec
  `CAPTURES_9DO`/`CAPTURES_9EB1` posées (pour exercer réellement leurs créations, pas le `skip`) : 22
  passants.
- `pnpm test` : 539 fichiers, 6080 tests, vert. `pnpm test:isolation` : 266 fichiers, 2573 tests, vert.
- Je n'ai PAS rejoué la suite e2e entière (`pnpm test:e2e` sans filtre) : chaque invocation détruit et
  recrée la base (`recreerLaBase`, « jetable veut dire jetée »), ce qui rend impossible, par cette seule
  commande, de prouver « une seconde tentative dans la MÊME base » — et la suite entière dépasse de loin
  le budget de ce lot. `verify:full`, laissé à la file comme demandé, la jouera en entier.

## Ce qui reste dû

- La mesure PROUVÉE du SIGABRT (point 1) — hypothèse posée, pas vérifiée, instrumentation proposée
  ci-dessus pour un prochain lot si le pilote la veut.
- Si un futur incident montre qu'un `setup/scene-*.ts` est désormais importé par un `zz-captures-*`, la
  même revue (identifiants fixes contre `@@unique`) s'y applique.
