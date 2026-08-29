# CODIPLAN

Plateforme de gestion des plannings d'intervention de techniciens et du parc machines de leurs clients. Multi-société, multi-devise, application mobile hors-ligne, console éditeur.

Contexte d'exploitation : Nouvelle-Calédonie — réseau mobile absent sur une partie du territoire, latence élevée vers l'hébergeur, monnaie sans décimale, fuseau UTC+11 sans changement d'heure.

## Documentation

`CLAUDE.md` fait autorité sur le fonctionnement du dépôt. En cas de divergence entre documents, l'ordre est celui qu'il fixe :

| Rang | Source                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------- |
| 1    | [`docs/arbitrages.md`](docs/arbitrages.md) — les décisions arrêtées                            |
| 2    | [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md) chapitre 10 — les règles de gestion |
| 3    | `docs/cahier-des-charges.md` chapitre 11 — le modèle de données                                |
| 4    | [`docs/backlog.md`](docs/backlog.md) — les tickets                                             |
| 5    | Le reste du cahier des charges — narratif, jamais normatif                                     |

Les choix techniques structurants sont consignés dans [`docs/decisions/`](docs/decisions/).

## Démarrer

Node 22 (voir `.nvmrc`) et pnpm 10. **Pas de npm ni de yarn.**

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

## Commandes

```bash
pnpm dev              # serveur de développement
pnpm typecheck        # tsc --noEmit — zéro erreur exigé
pnpm lint             # eslint — zéro avertissement exigé
pnpm format           # prettier --write
pnpm test             # vitest, projet « unit »
pnpm test:isolation   # vitest, projet « isolation » — cloisonnement multi-société
pnpm test:e2e         # playwright
pnpm build            # build de production

pnpm verify           # typecheck + lint + test + test:isolation + build
                      # → porte de sortie de CHAQUE TICKET
pnpm verify:full      # verify + test:e2e
                      # → porte de sortie de CHAQUE LOT, et exécution nocturne en CI
```

`pnpm test:e2e` compile lui-même l'application et la sert sur le port 3100 : c'est une compilation de production qui est mise sous test, pas le serveur de développement.

`pnpm test:isolation` exige un PostgreSQL **local et jetable**, jamais la base hébergée. Le script `scripts/postgres-jetable.sh` le crée, le détruit et le recrée à chaque appel :

```bash
scripts/postgres-jetable.sh
export TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:5433/codiplan_test'
pnpm test:isolation
```

Voir [`docs/decisions/2026-08-20-tests-isolation-postgres-local.md`](docs/decisions/2026-08-20-tests-isolation-postgres-local.md).

## Jours fériés — un horizon à entretenir

Les jours fériés sont **datés**, et une table alimentée une fois se périme sans
jamais être vide (D46). Deux commandes l'entretiennent :

```bash
pnpm feries:horizon   # chaque territoire a-t-il douze mois de fériés devant lui ?
pnpm feries:etendre   # ajoute les années manquantes
```

Le contrôle est une étape de `pnpm verify:full` et s'exécute donc chaque nuit en
intégration continue. Il nomme le territoire et sa dernière date connue. La base
visée vient de `HORIZON_DATABASE_URL` si elle est renseignée, de
`TEST_DATABASE_URL` sinon — une vérification locale ne part jamais d'elle-même
vers la base hébergée.

### Le territoire d'une agence est obligatoire, et le chaînage l'exige

`agence.territoire` est un code **ISO 3166-1 alpha-2** (`NC`, `FR`), et il est
**obligatoire** depuis L0-09a (D48). Il n'a rien à voir avec le fuseau : un
fuseau dit quelle heure il est, un territoire dit quels jours sont fériés, et
`Europe/Paris` couvre plusieurs territoires aux fériés différents.

Un écart local d'agence — un férié travaillé, un pont — ne peut s'adosser qu'à
un férié **de son propre territoire**. Ce n'est pas un contrôle applicatif :
`calendrier_ferie` porte une colonne `territoire` recopiée de son agence, et
deux clés étrangères composites la tiennent des deux côtés à la fois. C'est
PostgreSQL qui refuse, et le pont — sans férié en face — reste possible.

Une agence sans territoire n'existe donc plus, et la migration qui a posé cette
obligation **refuse de s'appliquer** sur une base où il en resterait une, en la
nommant, plutôt que d'inventer une valeur par défaut.

### Changer le territoire d'une agence — la procédure

Le chaînage **ne propage rien** (D49) : changer le territoire d'une agence est
**refusé** tant qu'il lui reste un écart de calendrier. Ce n'est pas une
rigidité gratuite — un changement de territoire invalide réellement ces écarts,
qui désignent les fériés d'ailleurs. Mieux vaut bloquer et forcer une décision
humaine que laisser une correction anodine réécrire un calendrier en silence.

1. **Constater** : le message du refus nomme l'agence, les deux territoires, le
   nombre d'écarts et leurs dates extrêmes.
2. **Décider écart par écart** — c'est le point, et cette décision appartient à
   l'exploitant : un **pont** reste valable si la décision d'entreprise tient
   sur le nouveau territoire ; un **férié travaillé** désigne un fait public qui
   n'est plus le sien.
3. **Traiter les écarts** : supprimer ceux qui tombent, réadosser les autres au
   férié équivalent du **nouveau** territoire.
4. **Changer le territoire.** L'écriture passe alors.
5. **`pnpm feries:horizon`** : le nouveau territoire doit avoir douze mois de
   fériés devant lui.

Une agence **sans écart** change de territoire sans obstacle. Détail et
justification :
[`docs/decisions/2026-08-24-territoire-agence-sans-propagation.md`](docs/decisions/2026-08-24-territoire-agence-sans-propagation.md).

## Thématisation par société — la lisibilité est calculée

La charte d'une société est un **paramétrage**, jamais une constante du code :
nom d'affichage, couleur d'identité et couleur d'accentuation vivent dans
`societe`, et un client change ses couleurs sans qu'on redéploie. La
thématisation est par **société** — les agences partagent l'identité de la leur.

`lib/theme/` en tire six variables CSS, posées **côté serveur** sur le document
depuis la société active de la session :

```
--societe-primaire           la couleur choisie par la société
--societe-primaire-encre     noir ou blanc, CALCULÉ pour être lisible dessus
--societe-primaire-lisible   la même couleur, rendue lisible comme TEXTE
--societe-accent  --societe-accent-encre  --societe-accent-lisible
```

Les composants ne connaissent que ces noms : aucun littéral de couleur dans
`app/`, `components/` ou `lib/` hors `lib/theme/`, et aucune feuille de style ne
DÉFINIT une variable de société — ce serait un thème écrit à la main. Deux
gardiens statiques le tiennent
(`tests/unit/theme/sans-couleur-en-dur.test.ts`).

**Le seuil, et d'où il vient.** L'encre posée sur une couleur de société est
choisie entre le noir et le blanc. Ce choix garantit **√21 ≈ 4,58:1** sur
n'importe quel fond sRGB — au-dessus des **4,5:1** exigés par WCAG 2.1, critère
1.4.3 « Contrast (Minimum) », niveau AA, texte courant (3:1 pour le grand texte
et les éléments non textuels, critères 1.4.3 et 1.4.11). Sur le jaune pâle
`#fff9c4`, du blanc donnerait 1,07:1 ; l'encre calculée est noire et donne
19,60:1. Une couleur n'est donc **jamais refusée pour sa teinte** ; seule sa
**forme** l'est — ce qui n'est pas une couleur sRGB, refusé par Zod et par une
contrainte `CHECK` en base. Voir
[`docs/decisions/2026-08-28-thematisation-par-societe.md`](docs/decisions/2026-08-28-thematisation-par-societe.md)
(D51).

La variante `-lisible` — la couleur de société employée comme **texte** — est
obtenue en déplaçant la seule clarté, teinte et saturation conservées, et elle
**atteint le seuil de façon garantie** : les extrémités de la clarté HSL sont le
noir et le blanc purs, et la direction est celle de l'encre lisible du fond, si
bien que la fin de la course vaut au moins √21. Tout seuil ≤ √21 est donc
atteint sur n'importe quel couple couleur/fond ; au-delà, la fonction **dit**
qu'elle n'y arrive pas au lieu de le taire.

**Une société sans charte** reçoit le thème neutre CODIPLAN, défini une seule
fois dans `lib/theme/defaut.ts` et identifié comme LE défaut : les deux colonnes
de couleur sont nullables, précisément pour qu'un provisionnement n'invente pas
deux couleurs qu'on prendrait ensuite pour un choix.

**Le logo de société est hors périmètre** — il suppose un stockage de fichiers,
décision d'architecture inscrite au registre des arbitrages. La colonne
`societe.logo_url` existe et le mécanisme ne l'empêche pas.

## Amorçage de la base hébergée — la latence est la contrainte

La base est à Sydney (`ap-southeast-2`) et les exécuteurs GitHub sont ailleurs :
**chaque écriture coûte environ deux cents millisecondes**. La transaction
cloisonnée du seed enchaîne une trentaine d'écritures séquentielles ; les délais
par défaut de Prisma — 5 000 ms pour une transaction, 2 000 ms pour obtenir une
connexion — sont des valeurs de réseau local et ne tiennent pas ici.

`prisma/seed-delais.ts` les fixe donc explicitement, avec l'arithmétique qui les
justifie, et `tests/unit/seed-delais.test.ts` échoue le jour où le seed grossit
au-delà de son budget. Le seed reste **atomique** : on ne découpe pas la
transaction pour rentrer dans un délai mal choisi.

Le seed annonce chaque section **avant** de l'exécuter, préfixée du temps
écoulé — la dernière ligne du journal désigne la section qui a échoué :

```
[seed +   0.2 s] CODIMA-NC — transaction cloisonnée : ouverture (~34 allers-retours, délai 120 s)
[seed +   0.2 s] CODIMA-NC — calendriers : 2, plages : 21
```

**Si un jour le seed échoue en P2028** — « Transaction not found » — sans que le
budget de temps l'explique, vérifier l'hôte de `MIGRATION_DATABASE_URL` : s'il contient `-pooler`, c'est le point
d'entrée **mutualisé** de Neon, qui ne garantit pas qu'une même connexion serve
toute une transaction interactive. Le remplacer par l'hôte **direct**, c'est-à-dire
le même privé de `-pooler` (`ep-xxx-1234567-pooler.ap-southeast-2.aws.neon.tech`
→ `ep-xxx-1234567.ap-southeast-2.aws.neon.tech`) ; tout le reste de l'URL est
inchangé. Voir `docs/decisions/2026-08-23-seed-transaction-latence-neon.md`.

## Intégration continue

`.github/workflows/ci.yml` — `verify` sur chaque proposition de fusion et chaque poussée hors `main` ; `verify:full` sur `main`, à la demande, et chaque nuit à 02h00 heure de Nouméa. `verify:full` ajoute le contrôle d'horizon des fériés et les tests bout en bout.

## Organisation

```
app/          routes Next.js (App Router)
components/   composants, dont components/ui pour shadcn/ui
lib/          auth/  calendar/  db/  i18n/  money/  reporting/  theme/  utils.ts
prisma/       schema.prisma, migrations/, seed.ts, seed-data.ts, seed-delais.ts
scripts/      inventaire, contrôle de cloisonnement, horizon des fériés
tests/        unit/  isolation/  e2e/offline/   ← les trois derniers sont sanctuarisés
docs/         cahier des charges, arbitrages, backlog, décisions
```

Le domaine métier s'écrit en français (`intervention`, `machine`, `societe`, `agence`), le code technique en anglais (`createIntervention`, `useSyncQueue`). Jamais mélangés dans un même identifiant.

## État d'avancement

Lot 0 en cours. Faits : **L0-01** (initialisation du dépôt), **L0-02** (chaîne de vérification), **L0-03** à **L0-06b** (socle multi-société, RLS, tests d'isolation, authentification et rôles), **L0-07** (module monétaire), **L0-08** (module calendrier), **L0-09a** (le territoire d'un jour férié référencé) et **L0-09** (thématisation par société). Aucune fonctionnalité métier : elles commencent au lot 1.
