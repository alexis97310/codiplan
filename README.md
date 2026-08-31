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

## Journal d'audit — écrit par la base, en ajout seul

Toute création, modification ou suppression sur une table du périmètre de I8
laisse une ligne dans `journal_audit` : société, entité, identifiant, action,
auteur, horodatage, adresse, et la ligne **entière** avant et après. Elle est
écrite par un **déclencheur PostgreSQL**, jamais par du code applicatif — aucun
chemin d'écriture n'y échappe, pas même un `UPDATE` tapé à la main dans `psql`.

Le périmètre est une **liste de tables**, énumérée par I8 depuis D52 — et non
une liste de notions qu'il faudrait interpréter. Sept tables aujourd'hui :
`societe`, `agence`, `calendrier`, `calendrier_plage`, `calendrier_ferie`,
`utilisateur_societe` et `utilisateur_client`. `machine`, `intervention` et
`contrat` le rejoindront **dans la migration qui les crée** : le gardien
`tests/unit/db/perimetre-audit.test.ts` le réclame dès que la table apparaît au
schéma, plutôt que trois lots plus tard — et il refuse aussi un déclencheur posé
sur une table absente de la liste, car élargir la traçabilité est un arbitrage.

`utilisateur_societe` y figure parce que **c'est ainsi qu'on se donne un
accès** (D52) : « qui a accordé ce droit, quand, depuis quelle valeur » est la
question de l'auditeur, et celle qui rend vérifiable la procédure de déblocage
de D40.

**Le journal est en ajout seul.** Le rôle applicatif détient `SELECT` et
`INSERT`, et rien d'autre : `UPDATE`, `DELETE` et `TRUNCATE` lui sont retirés, et
aucune politique ne les autorise sous `FORCE ROW LEVEL SECURITY`. Deux verrous
indépendants, contrôlés à chaque migration par `scripts/controle-cloisonnement.mts`
— **par observation de `information_schema`, jamais par déclaration**, comme pour
`codiplan_reporting`.

**Le lire est cloisonné, et par rôle.** Une société ne lit que son propre
journal ; dans sa société, seuls `admin_societe` et `direction` le lisent
(matrice §5.2).

**Pas de `SECURITY DEFINER`** : D50 reste close et vide. Ce contre quoi le
journal protège est la réécriture de l'histoire, pas l'insertion d'une ligne — et
`INSERT` sans `UPDATE` ni `DELETE` suffit à le garantir. Détail, options écartées
et mesures : `docs/decisions/2026-08-29-journal-audit-par-declencheur.md`.

**La table NAÎT partitionnée par mois**, et c'est ce qui rend la purge possible
sans brèche : on ne supprimera pas de lignes, on **détachera des périodes** —
`ALTER TABLE … DETACH PARTITION` est du DDL, il passe par le canal des
migrations, et aucun rôle ne gagne jamais `DELETE`. Créée partitionnée, la
migration de reprise n'existe jamais : PostgreSQL ne convertit pas une table sur
place, et cette reprise coûterait 0,11 s aujourd'hui, 2,4 s à deux ans, 17 s à
dix ans — chaque fois comme **indisponibilité en écriture de toute
l'application**, puisque toute écriture métier insère dans le journal par le
déclencheur.

Deux conséquences à connaître. La clé primaire est `("id", "horodatage")` :
PostgreSQL exige la clé de partitionnement dans toute contrainte d'unicité. Et
**chaque partition est durcie** — `REVOKE ALL`, RLS **activée et forcée**, sans
politique — par la même fonction qui la crée : une partition est une table, elle
hérite des privilèges par défaut mais pas des politiques du parent, et sans ce
durcissement le rôle applicatif lirait, réécrirait et effacerait les lignes
d'autres sociétés en nommant la partition (mesuré au ticket, §9 du CLAUDE.md).

`scripts/controle-cloisonnement.mts` le vérifie à chaque migration, **partition
par partition** et non sur le seul parent — lequel ne dit rien de ses
partitions —, en exigeant de chacune aucun privilège et **les deux drapeaux** de
RLS : `FORCE` sans `ENABLE` laisse les politiques inappliquées. Zéro partition
observée est un échec.

**Deux contrôles, pas un**, dans `pnpm verify:full` :

| Contrôle                                                   | Ce qu'il dit                                   | Ce qu'il ne peut pas dire      |
| ---------------------------------------------------------- | ---------------------------------------------- | ------------------------------ |
| **préventif** — `pnpm audit:partitions`, horizon ≥ 12 mois | il reste des partitions devant                 | si une partition a déjà manqué |
| **détectif** — la partition par défaut est vide            | aucune ligne n'est jamais tombée dans le filet | ce qui va manquer demain       |

Le préventif protège du problème, le détectif prouve qu'il ne s'est pas produit :
une partition manquante ne fait pas échouer l'écriture, elle la fait tomber par
défaut. Le remède du premier est `pnpm partitions:etendre`.

Reste ouvert au registre : le journal des référentiels de plateforme, et la
**durée** de conservation.

## Sécurité au niveau des lignes — deux preuves, et l'une a un angle mort

Le cloisonnement se prouve d'abord par la **lecture** : les scénarios
d'isolation et `scripts/controle-cloisonnement.mts` lisent de vraies lignes sous
de vrais rôles. C'est la preuve la plus forte — une RLS éteinte n'y survit pas.

Elle a pourtant un angle mort nommé. **`FORCE ROW LEVEL SECURITY` ne concerne que
le propriétaire des tables** : une lecture faite sous le rôle applicatif, non
propriétaire, ne peut pas le voir. Mesuré sur un propriétaire non
superutilisateur — `FORCE` retiré, le rôle applicatif voit toujours zéro ligne
sans contexte, et le propriétaire voit toutes les sociétés. Le cloisonnement
paraît intact pendant que les migrations, le seed et toute connexion de
maintenance lisent tout.

Ce qui ne se prouve pas par la lecture se prouve donc par l'**attribut**, et il
se lit en **deux drapeaux, jamais un** — `FORCE` sans `ENABLE` laisse la sécurité
inerte. `scripts/lib/rls-declaree.ts` porte la règle, partagée par le contrôle de
la base hébergée et par `tests/isolation/force-rls.test.ts`, et le classement est
**clos par le schéma** : toute table de `public` relève d'exactement une des
trois catégories — cloisonnée (`ENABLE` + `FORCE`), référentiel de plateforme
(`ENABLE` seul), technique sans RLS.

## Français — le dictionnaire est la source unique

`lib/i18n/fr.ts` porte **toutes** les chaînes qu'un utilisateur lit (D26). Un composant, une page, un test de rendu n'en écrit aucune :

```tsx
import { t } from "@/lib/i18n";

<h1>{t("accueil.titre")}</h1>;
```

**La coupure est écrite en tête de `lib/i18n/fr.ts`**, et elle se dit en deux lignes. Ce qu'un **humain** lit en se servant de l'application passe par le dictionnaire — texte, libellé d'action, titre de page, attribut lu par un lecteur d'écran, message d'erreur rendu à l'écran. Ce qu'un **développeur ou une machine** lit n'y passe pas — message de gardien, exception technique, trace, erreur de migration, libellé de test, nom de rôle ou de statut : les traduire brouillerait la recherche dans les journaux.

Le vocabulaire imposé — **agence** (établissement CODIMA) et **site** (lieu d'intervention chez un client) — est défini sous les clés `vocabulaire.*`, avec son pluriel et une définition qui dit ce que la notion **n'est pas**. Le code nomme la notion, jamais le mot :

```ts
import { definition, mot } from "@/lib/i18n";

mot("agence"); // « Agence »   —  mot("agence", true) → « Agences »
definition("site"); // « Lieu d'intervention chez un client… »
```

### Deux gardiens, et leurs limites

| Gardien                                              | Ce qu'il refuse                                                                                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` | toute chaîne écrite dans un emplacement **visible** : texte JSX, attribut lu par un humain, `metadata` de Next.js, texte attendu par une requête d'écran |
| `tests/unit/i18n/vocabulaire-impose.test.ts`         | « agence » ou « site » écrits ailleurs que sous une clé `vocabulaire.*`                                                                                  |
| `react/jsx-no-literals` (ESLint)                     | l'écho du premier dans l'éditeur, à la frappe — il en dit moins, jamais autre chose                                                                      |

**Ce qui décide qu'un fichier est concerné se déduit, il ne s'énumère pas.** Le gardien lit tout le dépôt ; un fichier est concerné s'il porte l'une de trois marques — il contient du JSX, il exporte les `metadata` de Next.js, il interroge l'écran. Une page écrite demain l'est le jour où elle est écrite, sans qu'aucune liste soit à compléter. Il n'y a donc **aucune exemption de fichier** : le seul laissez-passer est une référence au dictionnaire, déduite des accesseurs réellement exportés par `lib/i18n` et résolue à travers les alias d'import.

Les limites sont annoncées : une chaîne qui **vient d'un module** et arrive à l'écran par une variable n'est pas lisible statiquement, et un libellé passé en **propriété** d'un composant non plus — la parade y est un type (`CleTraduction`, jamais `string`), pas un gardien. Détail dans [`docs/decisions/2026-08-31-vocabulaire-francais-centralise.md`](docs/decisions/2026-08-31-vocabulaire-francais-centralise.md).

## Intégration continue

`.github/workflows/ci.yml` — `verify` sur chaque proposition de fusion et chaque poussée hors `main` ; `verify:full` sur `main`, à la demande, et chaque nuit à 02h00 heure de Nouméa. `verify:full` ajoute le contrôle d'horizon des fériés et les tests bout en bout.

## Organisation

```
app/          routes Next.js (App Router)
components/   composants, dont components/ui pour shadcn/ui
lib/          auth/  calendar/  db/  i18n/  money/  reporting/  theme/  utils.ts
              i18n/ = dictionnaire français + vocabulaire imposé (agence, site)
prisma/       schema.prisma, migrations/, seed.ts, seed-data.ts, seed-delais.ts
scripts/      inventaire, contrôle de cloisonnement (privilèges compris), horizon des fériés
tests/        unit/  isolation/  e2e/offline/   ← les trois derniers sont sanctuarisés
docs/         cahier des charges, arbitrages, backlog, décisions
```

Le domaine métier s'écrit en français (`intervention`, `machine`, `societe`, `agence`), le code technique en anglais (`createIntervention`, `useSyncQueue`). Jamais mélangés dans un même identifiant.

## État d'avancement

Lot 0 en cours. Faits : **L0-01** (initialisation du dépôt), **L0-02** (chaîne de vérification), **L0-03** à **L0-06b** (socle multi-société, RLS, tests d'isolation, authentification et rôles), **L0-07** (module monétaire), **L0-08** (module calendrier), **L0-09a** (le territoire d'un jour férié référencé), **L0-09** (thématisation par société), **L0-10** (journal d'audit) et **L0-11** (vocabulaire français centralisé). Aucune fonctionnalité métier : elles commencent au lot 1.
