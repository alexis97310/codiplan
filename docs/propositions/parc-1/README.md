# PARC-1 — l'aperçu du parc ne ramène que les trois lignes qu'il affiche

Travail commité **sur `main` en local**, sans proposition ni branche distante
(processus du 22/09/2026), en `3077023`. Rien n'a été poussé.

Capture prise le **2026-09-22 à 07:58 UTC** (18:58 à Nouméa), contre le
serveur de production compilé (`next start`) sur la base d'épreuve locale de
`pnpm test:e2e` : migrations, semis de `prisma/seed.ts`, plus la scène du
scénario. Aucune donnée de la base hébergée (I9) — les 1751 interventions
d'archive et les 298 vérifications d'Alexis ne sont pas dans le dépôt, et la
machine à quinze ans d'histoire ci-dessous est fabriquée par le scénario.
Largeur 1280 px. `mesure.json` est la sortie brute de
`tests/e2e/parc-apercu-borne.spec.ts` : empreinte du commit sous lequel il a
tourné, horodatage, ce qu'il a compté en base et ce que la page a rendu.

## Le constat, re-mesuré avant de coder

`app/(back-office)/parc/page.tsx:188` (état `11b6d9b`) :

    (await historiqueDeLaMachine(contexte, selection.id)).slice(0, 3)

`lib/machines/historique.ts` : `findMany` avec `where`, `select`, `orderBy`
— **aucun `take`**. La requête ramenait tout, la page jetait tout sauf trois.

Deux appelants, et deux seulement (`grep` sur le dépôt) : l'aperçu de
`/parc` et la fiche `/parc/[id]` (`[id]/page.tsx:122`), qui en fait
l'historique complet, le bandeau de l'intervention ouverte et l'annuaire des
personnes à nommer. La fiche est légitime à tout lire.

## Ce qui a changé

**`lib/machines/historique.ts`** — une fonction nouvelle,
`teteDeLHistorique(contexte, machineId, limite, client?)`. La borne est un
**argument** : l'appelant sait combien il affiche, la requête ne le devine
pas. Une borne qui n'est pas un entier strictement positif est **refusée
avant toute requête** — Prisma lit un `take` négatif comme « depuis la
fin », et `-3` rendrait les trois plus *anciennes* sous le titre « Derniers
événements », sans qu'une ligne ne manque ni ne rougisse.

`historiqueDeLaMachine` garde sa signature et son résultat. Son corps
délègue à une lecture privée `lireLHistorique(…, limite | undefined)` que
les deux fonctions partagent — une seule requête écrite, parce que deux
requêtes d'un même critère divergent en silence (§9, 01/09) et que le
filtre « la machine, jamais le site » de L2-05 n'a pas à être juste deux
fois. C'est la seule retouche à la fonction existante, et c'est dit ici
plutôt que passé sous silence : le ticket demandait de ne pas la modifier,
au sens de ne pas la borner — elle ne l'est pas, et
`tests/isolation/historique-machine.test.ts` (L2-05, le déménagement) le
garde comme avant.

**`app/(back-office)/parc/page.tsx`** — `EVENEMENTS_DE_L_APERCU = 3`,
déclarée dans la page, passée à `teteDeLHistorique`. Plus de `.slice`.

## Les comptes, avant et après

Sur une machine posée exprès avec **quinze** interventions rattachées, sous
le rôle applicatif `codiplan_app`, contexte société A
(`tests/isolation/historique-machine-borne.test.ts`, joué sur `3077023`) :

| lecture | lignes ramenées |
|---|---|
| `historiqueDeLaMachine` — ce que l'aperçu appelait | **15** |
| `teteDeLHistorique(…, 3)` — ce qu'il appelle | **3** |
| `historiqueDeLaMachine` — ce que la fiche appelle toujours | **15** |

Le même fichier, joué sur `11b6d9b` avant que le code n'existe : la mesure
« AVANT » passe (15), les trois scénarios bornés tombent sur
`teteDeLHistorique is not a function`. L'épreuve tombait donc sur le code
d'origine, et elle compte ce que la requête **ramène** : « trois lignes à
l'écran » passait aussi avec l'ancien code, puisque la page tronquait déjà.

Et à l'écran (`mesure.json`) : machine `AC-GA11-2021-3310`,
**16 interventions en base** (les quinze de la scène, 2011 → 2025, plus une
de démonstration au 24/09/2026), **3 événements rendus** — 24/09/2026,
01/01/2025, 01/01/2024 : les trois plus récents, aucun de 2011.

## Ce que les épreuves tiennent

`tests/isolation/historique-machine-borne.test.ts` — 5 scénarios, un témoin
avant chacun (les quinze rattachements sont comptés en base sous le
propriétaire avant toute assertion, §9 du 30/08 : zéro est inférieur à
trois). La lecture bornée rend exactement sa borne ; la tête est bien la
**tête** — mêmes identifiants, même ordre, que le début de la lecture
complète, et la première ligne porte la date la plus haute ; la lecture
complète rend toujours quinze — *le cas qui doit rester vert pour sa propre
raison* (§9, 11/09), sans lequel borner la lecture partagée aurait fait
passer le reste en amputant la fiche ; et quatre bornes invalides (`0`,
`-3`, `1.5`, `NaN`) sont refusées.

`tests/unit/machines/apercu-parc-borne.test.ts` — 4 scénarios, le gardien
de l'**appelant** : une lecture bornée que personne n'appelle est une
politique juste que personne n'arme (§9, 09/09). `/parc` appelle
`teteDeLHistorique` avec une constante nommée et déclarée ; `/parc/[id]`
appelle `historiqueDeLaMachine` et pas l'autre ; dans le module, `take:
limite` et aucun `take: <nombre>`, et un seul `findMany`. Éprouvé sur la
faute **réelle** (§9, 21/08) : la ligne de `11b6d9b`, greffée dans la page
courante à la place de l'appel borné, est refusée — avec le témoin que la
greffe a eu lieu.

`tests/e2e/parc-apercu-borne.spec.ts` — 1 scénario : l'écran rendu garde
trois lignes, et ce sont les plus récentes. Il annonce lui-même ce qu'il ne
prouve pas — le nombre de lignes ramenées — pour ne pas être cru sur ce
point.

## `verify:full`, en entier

Deux passages. Le premier (07:47 → 07:51 UTC) a rougi sur **un seul
point : mon propre spec e2e**, dans sa première version — il cherchait le
n° de série dans le texte mono de l'en-tête, qui porte la référence
`Local-…`/`MAC-…`, pas la série. Corrigé (la ligne de liste, seule, porte
la série en sous-ligne), et **ce n'était pas** la course
`porte-capacites`/`imports.spec` signalée par AGENCE-2 : les 126 autres
scénarios e2e étaient verts du premier coup.

Le second, sur l'état commité en `3077023` (07:52 → 07:57 UTC, 4 min 27 s) :
`format:check`, `typecheck`, `lint`, **2534** unitaires (231 fichiers),
**1082** d'isolation (102 fichiers), `build`, `feries:horizon`,
`audit:partitions`, **127** e2e — exit 0, sans reprise.

## Ce que je n'ai pas fait

- **Pas touché à `prisma/`, `lib/imports/**`, `lib/planning/**`** — hors
  territoire, et rien ne l'exigeait.
- **Pas borné `historiqueDeLaMachine`** — la fiche l'appelle sans
  troncature, et c'est gardé dans les deux sens.
- **Pas mesuré la charge réseau elle-même** (octets, durée) — le ticket
  demandait le compte de lignes, et c'est le compte de lignes qui est
  prouvé. Une mesure de latence contre la base hébergée serait du ressort de
  la veille, pas d'une épreuve locale.
- **Pas inscrit PARC-1 au backlog** — le ticket n'y figure pas (il vient de
  la revue T-06), et `docs/backlog.md` n'est pas dans le territoire.
- **Rien poussé.** Deux commits sur `main` en local : `3077023` (le code et
  les épreuves), puis celui-ci (la capture, `mesure.json`, ce compte rendu).
