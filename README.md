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

La mise en ligne — variables d'environnement, secrets, ce que l'hébergeur doit savoir, et ce qui est risqué à exposer en l'état — est décrite dans [`docs/mise-en-ligne.md`](docs/mise-en-ligne.md).

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

pnpm verify           # format:check + typecheck + lint + test + test:isolation + build
                      # → porte de sortie de CHAQUE TICKET
pnpm verify:full      # verify + feries:horizon + audit:partitions + test:e2e
                      # → porte de sortie de CHAQUE LOT, et exécution nocturne en CI

pnpm battement        # la vérification NOCTURNE tourne-t-elle encore ?
                      # → hors de verify:full, et c'est tout son objet
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

**Le périmètre est INVERSÉ : audité par défaut, exempté par écrit** (D55).
Toute table métier cloisonnée — première catégorie de I1 — est auditée, moins
une liste d'exemptions explicitement justifiées. Ce n'est pas un changement de
contenu mais de **sens** : une liste d'admis tenue à la main oublie, par
construction, la table que personne n'y a ajoutée. La fiche client l'a montré en
acte au lot 1 — elle naissait hors périmètre, non par décision mais par oubli.

**L'exhaustivité n'est plus tenue par personne : elle est héritée.** La première
catégorie de I1 est déjà énumérée par le schéma, et le gardien de D41 exige que
chaque table s'y range. Une table métier créée demain est donc réclamée par
`tests/unit/db/perimetre-audit.test.ts` **le jour où elle apparaît au schéma**,
sans qu'aucune liste ne soit à compléter — et le déclencheur se pose dans la
migration qui crée la table, jamais dans un rattrapage.

**UN SEUL motif d'exemption, et la liste est VIDE.** `rejouable` — l'information
perdue se reconstitue depuis une autre table auditée. Ne sont pas des motifs : le
volume (la table est partitionnée précisément pour cela), la sensibilité
supposée, et jamais une table dont les lignes sont saisies par un humain.

**Le journal lui-même est HORS DU DOMAINE**, et ce n'est pas une exemption : un
motif se rouvre par argument, une frontière est une liste close d'une entrée
gardée dans les deux sens. La raison est doctrinale — **un gardien ne peut pas se
garder lui-même** — et la récursion mesurée n'en est que le symptôme. Ce que ce
retrait coûte est payé au même endroit : **le journal n'est pas audité, il est
inaltérable**, et cela s'éprouve par TENTATIVE d'`UPDATE` et de `DELETE` sous le
rôle applicatif — sur la table mère, et sur **chaque partition** énumérée par
`pg_inherits`, jamais sur la mère seule.

**La fonction empêche l'oubli, le détectif rattrape la main.** Deux garanties de
nature différente : `journal_audit_partition_creer` durcit dans la même
transaction, donc aucun ticket ne crée de partition nue par le chemin du dépôt ;
mais un `CREATE TABLE … PARTITION OF` tapé dans une console ne passe par aucune
fonction. Tant que le rôle de migration n'est pas superutilisateur,
`ddl_command_end` est hors de portée et l'état nu reste productible à la main —
le jour où la base est auto-hébergée, le préventif remplacera le détectif.

**La règle et ses exemptions n'ont qu'une maison, celle que la machine lit** :
[`scripts/lib/perimetre-audit.ts`](scripts/lib/perimetre-audit.ts). L'invariant
I8, la règle RG-DRO-04 et cette page y renvoient ; aucun ne les recopie, et un
gardien refuse qu'une recopie y réapparaisse (D53). Le gardien est clos des deux
côtés : un déclencheur posé hors de la première catégorie de I1, ou sur une
table exemptée, est refusé — élargir ou restreindre la traçabilité est un
arbitrage.

La table des habilitations est auditée parce que **c'est ainsi qu'on se donne un
accès** (D52) : « qui a accordé ce droit, quand, depuis quelle valeur » est la
question de l'auditeur, et celle qui rend vérifiable la procédure de déblocage
de D40. Depuis D55 elle n'a plus besoin d'être nommée pour l'être.

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

## Veille de la base hébergée — le détectif, chaque nuit

`pnpm veille` ([`scripts/veille-hebergee.mts`](scripts/veille-hebergee.mts)) joue
les contrôles d'observation contre la **vraie** base — sept aujourd'hui : état
RLS, formes de politique, périmètre d'audit, ajout seul du journal, durcissement
des partitions, privilèges de consolidation, **armement du contexte de session**.

Le dernier est arrivé avec L1-02b et il regarde autre chose que les six autres :
ceux-là disent que les politiques sont JUSTES, celui-ci dit que quelqu'un pose
les variables qu'elles lisent. Une politique dont personne ne pose la variable ne
garde rien — et, sur la forme « parc », elle OUVRE.

**Sept est un instantané, pas une liste.** Le périmètre de la veille est
**inversé** comme celui de l'audit (D55) : toute fonction d'écart que
`scripts/lib/` déclare est un contrôle de veille par défaut, et n'y échappe que
par une exclusion écrite et justifiée. La liste vit dans
[`tests/unit/veille-hebergee.test.ts`](tests/unit/veille-hebergee.test.ts), et
elle est fermée contre le répertoire lui-même : un huitième contrôle écrit et
jamais câblé fait échouer la vérification le jour où il est écrit. Une première
rédaction du gardien exigeait « six », un nombre écrit à la main — elle
attrapait le contrôle qu'on décâble et laissait passer celui qu'on n'a jamais
câblé.

**Ce qu'elle répare, et il a été mesuré.** Ces contrôles ne s'exécutaient que
dans `db-migrate.yml`, dont le déclencheur est `workflow_dispatch` **et lui
seul** ; et le `verify:full` nocturne tourne contre un PostgreSQL **jetable**. Le
détectif n'avait donc jamais regardé l'endroit où la faute se produit — il ne
voyait la base hébergée que lorsqu'un humain cliquait pour migrer, et entre deux
migrations il peut se passer des semaines. **Une garantie dont le déclenchement
dépend de l'initiative de quelqu'un n'est pas une garantie, c'est une
intention.**

**Deux protections, contre deux risques différents.** Le **rôle** protège de
l'accréditation : la veille se connecte avec `codiplan_app`, le moins doté qui
voie encore le catalogue — ni superutilisateur, ni `BYPASSRLS`, ni DDL. Cela
suppose de lire les privilèges dans `pg_class.relacl` (`aclexplode`) et non dans
`information_schema.role_table_grants`, aveugle à ce que le rôle connecté n'a ni
reçu ni concédé ; mesuré, les deux rendent les mêmes lignes. Le **verrou**
protège de l'accident : toute la veille tient dans une transaction ouverte par
`SET TRANSACTION READ ONLY`, qui refuse les quatre verbes d'écriture **et tout le
DDL**. La distinction avec `SET SESSION CHARACTERISTICS` n'est pas de style, elle
a été mesurée : celle-ci ne verrouille pas la transaction en cours, et Prisma
répartit ses requêtes sur un pool.

**Deux rouges, pas un.** Neon suspend une base inactive et le premier réveil peut
expirer. Une veille qui rendrait le même rouge dans les deux cas apprendrait en
trois semaines à ne plus être lue. Le script sort en **75** (`EX_TEMPFAIL`) quand
la base est **injoignable** — incident d'exploitation, il ne dit rien de l'état
de la base — et en **1** quand elle a été jointe et qu'elle a **dérivé** —
incident de sécurité. Trois fils d'issues distincts : `[veille-injoignable]`,
`[veille-securite]`, `[nuit-rouge]`.

**Chaque contrôle refuse une population vide**, et le rapport dit ses effectifs :
« 0 faute sur 14 partitions » est une preuve, « 0 faute » n'en est pas une.

Éprouvée sur trois fautes réellement commises à la main sur une base — un
`DROP TRIGGER`, une partition créée nue, un `GRANT UPDATE` de dépannage : les
trois sont nommées.

## Le taux horaire est historisé, et la table naît vide

`taux_horaire` porte une ligne par **date d'effet** (RG-TAR-04). _Une intervention se facture au taux en vigueur à sa date, pas au taux d'aujourd'hui : une facture qui change quand le tarif change est une facture fausse._ Une colonne ne peut pas porter cela — elle porte la valeur de maintenant.

Le montant est un **entier** dans l'unité la plus fine de la devise — 7000 pour 7 000 XPF, 6500 pour 65,00 EUR —, exactement la forme de `Montant` dans `lib/money`, et il **ne voyage jamais sans son code de devise** (I2, I3). Un déclencheur refuse qu'il s'écarte de la devise de sa société.

**La table naît VIDE, et c'est délibéré.** Le taux de CODIMA est connu — 7 000 XPF —, mais **sa date d'effet ne l'est pas**, et c'est elle que la table exige. L'inventer serait inventer une donnée métier (§8). Tant qu'aucune ligne n'existe, `tauxEnVigueur` rend `null` : un taux manquant ne se lit **jamais** « gratuit ».

**Le PREMIER taux s'écrit par un geste d'exploitation séparé de l'amorçage** (décision du 09/09/2026, construit le 10/09) — `scripts/taux-initial.mts`, `TAUX_INITIAL_CONFIRME=oui`, `--societe`, `--montant` dans l'unité la plus fine de la devise de la société (`7000` pour 7 000 XPF), `--date` facultative — à défaut, le jour du geste dans le fuseau de la société. Il refuse dès que la société porte un taux : c'est un geste de mise en service, pas de tarification, et une hausse passe par le chemin ordinaire. Il répète le montant formaté pour qu'une erreur d'échelle se voie ; ni le montant ni la date ne sont codés dans le dépôt. Séparé de l'amorçage parce qu'un geste de sécurité et un geste de tarif ne partagent ni leurs défaillances ni leurs cliquets.

**`societe.taux_horaire_defaut` A ÉTÉ RETIRÉE le 09/09/2026 (Q3).** Elle portait `65.0000` pour CODIMA-EU là où la forme entière vaut `6500` — _ce ne sont pas les mêmes nombres_, et deux sources d'un même fait divergeaient donc **avant même d'avoir été lues**. La prémisse a été mesurée avant d'être payée : l'inventaire de la base hébergée (run #31) rend **deux sociétés de démonstration, aucun site, aucun contact, aucune intervention** — `7000` et `65` sont des valeurs d'amorçage du seed, pas des tarifs de clients. Un bloc de garde refuse la migration si une société porte une valeur autre que celles du seed.

## La grammaire des imports, écrite avant la liaison au classeur

`lib/excel/format.ts` porte les six mécaniques de D31 — marqueur `CODIPLAN-<type>-v<n>` en `A1`, en-têtes ligne 2, données ligne 3, dates `JJ/MM/AAAA`, décimale virgule, colonnes inconnues ignorées avec avertissement. **Aucune dépendance, aucune base** : il travaille sur une grille de cellules abstraite.

**Ce découpage n'est pas d'esthète.** La liaison à SheetJS est en attente d'arbitrage : le paquet `xlsx` du registre npm est figé à `0.18.5`, et deux avis de gravité HAUTE le visent sans version corrigée atteignable depuis npm — dont CVE-2023-30533, une pollution de prototype qui se déclenche **à la lecture d'un fichier fabriqué**, c'est-à-dire dans l'usage exact de ce ticket. Ce que le découpage garantit en attendant : le jour où la liaison arrive, **elle n'a aucune règle à porter**.

Deux formes qui ne vont pas de soi. **Un nombre lu ne rend jamais un flottant** : les chiffres et leur échelle (`« 1234,56 »` → `{123456n, 2}`). Rendre `1234.56` obligerait le premier appelant à remultiplier par cent — l'arithmétique flottante que I3 interdit, une ligne après nous. **Une date se lit en UTC**, jamais par un `Date` local : UTC+11 décale le jour d'un cran, et un import saisi le 1ᵉʳ se rangerait au 31 du mois précédent.

Trois cas que D31 ne tranche pas sont **refusés plutôt qu'inventés**, et inscrits au registre : une version postérieure, un en-tête en double, une colonne obligatoire absente.

## Le catalogue de forfaits, et l'axe qui dort

`forfait` porte les trois axes de RG-TAR-06 — zone, famille de matériel, type d'intervention — et la règle qui décide. Le montant y prend la même forme que le taux horaire : un **entier** avec son code de devise, refusé s'il s'écarte de celle de sa société. **Zéro est permis** — une prestation offerte est un forfait à zéro, et c'est la façon de la dire ; négatif non, ce serait un avoir.

**Le cas qui décide de la justesse de la règle n'est pas celui où une condition échoue, c'est celui où il n'y en a pas.** Un forfait sans zone s'applique partout, et le confondre avec « aucune zone ne convient » retirerait du catalogue tous les forfaits généraux — la majorité. Réciproquement, une valeur d'intervention **absente** face à une condition posée n'est pas remplie : appliquer un forfait de zone à une intervention dont la zone est inconnue facturerait un déplacement que personne n'a constaté.

**Le troisième axe est inerte, et c'est écrit plutôt que tu.** Les types d'intervention n'existent nulle part dans ce dépôt — ni énumération, ni liste close, ni table —, et le lot 2 les décidera. La règle est pourtant écrite entière et éprouvée sur les trois axes, pour n'avoir pas à changer ce jour-là. Même forme que D63 : _ce n'est pas un défaut du code, c'est une donnée qui n'existe pas, et rien ne rougira tout seul._

**LE RANG DÉCIDE QUAND PLUSIEURS CONVIENNENT (D86), et il est explicite.** « Le premier applicable l'emporte » ne définissait pas « premier » : le code ordonnait par l'**alphabet** d'un code, et l'ordre naturel suivant eût été celui d'**insertion**. _Deux interventions identiques se factureraient alors différemment selon la minute d'une saisie passée._ `forfait.rang` est un entier strictement positif, **sans défaut** — le plus petit l'emporte —, et **l'égalité est un état interdit que la base refuse** sur `(societe_id, type, rang)` : le rang ne se compare qu'entre forfaits de même nature. L'écran `/parametres/forfaits` montre, pour une zone choisie, quels forfaits s'appliquent et dans quel ordre, avec **trois verdicts** — retenu, applicable mais devancé, écarté ; il appelle la fonction que la création d'intervention appelle, jamais une seconde lecture du même critère.

**Et « aucune condition » a DEUX écritures, ce qui a coûté un défaut d'argent.** La saisie Zod l'écrit `null` ; la base ne le peut pas — une liste scalaire PostgreSQL n'est pas nullable, et l'absence de condition y est le tableau **VIDE**. La règle ne lisait que la première : mesuré, **le forfait général ne s'appliquait jamais** par le chemin de production. Les deux formes se lisent désormais au même endroit.

**La table naît vide.** Quels forfaits mettre au catalogue et à quels montants appartient à l'exploitation. Et ce module ne **valorise** rien : ce qu'un forfait consomme du temps passé — à partir de quand une heure devient excédentaire — n'est tranché nulle part.

Deux limites mesurées : PostgreSQL **refuse toute sous-requête dans un `CHECK`** (`0A000`), donc « sans doublon » passe par une fonction `IMMUTABLE` ; et écrire chez une autre société est refusé **par le déclencheur de devise avant le `WITH CHECK`** — un `BEFORE` précède la politique. La garantie est donc exigée deux fois, et un second scénario va chercher le `WITH CHECK` derrière lui, déclencheur ôté.

## Familles et modèles — un mécanisme retiré plutôt qu'arbitré

`famille_materiel` et `modele_materiel` sont des **tables métier cloisonnées**, `societe_id NOT NULL`, forme « société », RLS forcée, auditées. Elles étaient destinées à la deuxième catégorie de I1 — référentiels de plateforme — et **D4 est amendé** :

| D4 disait                                                  | D4 disait aussi                                          | Incompatible parce que                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| « modifiables par les seuls **rôles éditeur** »            | « une **société** qui veut l'adapter en crée une copie » | une société qui ne peut pas écrire ne peut pas créer de copie          |
| clause `societe_id = app.societe_id OR societe_id IS NULL` | forme « référentiel » = lecture `USING (true)`           | ce ne sont pas la même clause : **la copie de A serait lisible par B** |

Et « la copie masque l'original » est une règle de **sélection**, que RLS ne sait pas porter. _Une contradiction interne dans une décision de rang 1 signale qu'elle a été écrite avant que quiconque essaie de l'appliquer_ : le mécanisme est retiré, pas arbitré.

**Le seed n'amorce rien** — la liste des familles et des modèles appartient à l'exploitation. Le catalogue de plateforme, s'il existe un jour, sera un amorçage, comme la liste réglementaire des habilitations.

**Un effet de bord, mesuré et écrit :** après ce retrait, plus aucun référentiel de plateforme ne porte de colonne `societe_id`. La phrase de I1 « `societe_id` NULL **ou pas de `societe_id` du tout** » reste vraie, mais sa première moitié n'a plus d'exemplaire — un témoin le dit, à l'endroit où on pourrait la lire comme la preuve qu'un cas existe.

## Le second facteur — son plancher, et l'issue de secours qu'il condamnait

La bibliothèque d'authentification lit une ligne par sa clé de désignation, puis **réécrit celle qu'elle vient d'obtenir en la nommant par son `id`**. Mesuré sur les huit flux réels : 69 opérations, dont **7 nomment un `id`, et les 7 sont des écritures**. Or `id` n'est clé de désignation d'aucune table d'authentification : la politique lisait une chaîne vide et refusait — **silencieusement**, un refus de RLS étant zéro ligne et non une erreur.

Trois défauts en découlaient, et le premier était le plus cher : **un compte enrôlé ne pouvait plus se connecter du tout**, même avec le bon code ; le code de secours échouait en `409` _après avoir été validé_ ; et le compteur d'échecs restait inerte.

`lib/auth/echange.ts` répare la **pose**, pas les politiques — elles étaient justes. À l'intérieur d'une requête entrante, une écriture qui nomme une ligne par sa clé primaire reçoit ce que la même requête avait déjà désigné :

| Table            | Ce que le `where` dit | Ce que la politique exige           |
| ---------------- | --------------------- | ----------------------------------- |
| `second_facteur` | QUELLE ligne (`id`)   | à QUI elle est (`utilisateur_id`)   |
| `verification`   | QUELLE ligne (`id`)   | quel SECRET l'ouvre (`identifiant`) |

**L'`id` ouvre les écritures, jamais les lectures**, et le report ne franchit pas deux requêtes. **Oublier d'ouvrir un échange casse la fonctionnalité ; cela n'ouvre jamais rien** — c'est le seul sens de défaillance acceptable pour un mécanisme de ce genre.

Le plancher lui-même est de **dix échecs consécutifs pour quinze minutes**, avec **escalade au troisième verrouillage enchaîné** : au-delà, le verrouillage cesse d'expirer et le déblocage devient l'acte administratif **L7-04**, livré le 09/09/2026 (D66) — voir la section suivante. Les trois valeurs et la raison de leur calibrage sont dans `lib/auth/config.ts` ; l'escalade est tenue par un déclencheur PostgreSQL, seul point que les **trois** chemins de vérification franchissent. Voir D64.

## La fiche machine — la TROISIÈME fixture s'efface, et le contrat est honoré

`machine` était une table du harnais depuis L0-05, et c'est elle qui portait la résolution QR inter-société de D22. **La réparation la plus naturelle — supprimer la fixture et donner à la vraie table la clause société seule — aurait réduit la couverture sans qu'aucun gardien ne s'en aperçoive** (écart É14 de la revue R0). La clause écrite dans la migration est donc **exactement** celle que le harnais posait : les scénarios de `qr-code.test.ts` et de `portail-client.test.ts` s'y sont reportés **sans qu'une ligne change**, et les planchers de `EXIGENCES_L0_05` **montent** — `qr_inter_societe` de 3 à 5, `perimetre_sites` de 4 à 6.

**Quatre champs obligatoires, et non trois** (D6) : `modele_id`, `client_id`, `site_id`, `numero_serie`. Le numéro de série redevient obligatoire, ce qui rend l'unicité `(société, modèle, n° de série)` définissable. La plaque illisible se saisit `SN-INCONNU-<référence>` avec `complet = false` — **jamais `NULL`** : sous un index unique, deux `NULL` sont distincts, et une colonne nullable aurait laissé passer autant de doublons qu'on veut, _précisément sur les fiches les moins bien renseignées_.

**Le jeton du QR est unique GLOBALEMENT**, et pas par société : le lecteur le présente **seul**, avant qu'aucune société ne soit connue, et une collision rendrait la résolution ambiguë au moment exact où l'on ne peut pas la lever. Le contrôle de société vient **après**, et c'est la politique qui le fait (D22).

**Ce qui n'est pas fait, et qui est écrit plutôt que tu :** personne n'attribue `numero`. La colonne existe et son unicité par société est posée ; le compteur appartient à la **synchronisation (lot 3)**, et l'inventer ici poserait une règle que personne n'a décidée.

## Le scan d'un QR — le jeton est un SECRET, et le chemin qui le résout

**Le jeton est TIRÉ AU SORT** _(D71)_ : `randomBytes`, base32, 26 caractères — **130 bits, tous aléatoires**. Il ne dépend de **rien** qu'un tiers puisse connaître : ni l'`id`, ni le numéro de série, ni le client ne permettent de le prévoir.

> **Il était DÉRIVÉ de l'`id`, et cela a été corrigé le jour même.** La version dérivée était honnête sur ce qu'elle était — _un identifiant, pas un secret_ — et inscrivait la question : RG-DRO-02 promet au technicien la résolution QR **en plus** de son périmètre, et ce jour-là le jeton devient ce qui **lève** une restriction. **L'exploitation a tranché, et l'argument est asymétrique** : le faire maintenant ne coûte rien — c'est une façon de tirer une valeur, pas une architecture —, le faire plus tard coûte de **réétiqueter physiquement tout le parc**, chez des clients, à travers la Nouvelle-Calédonie.
>
> **La règle générale, qui vaut au-delà de ce jeton :** _une valeur dont on sait qu'on lui demandera un jour de porter une autorité doit naître capable de la porter. Un identifiant qu'on promeut en secret après coup n'est pas un secret — c'est un identifiant que tout le monde a déjà vu._

**D7 se contredisait, et D71 le répare plutôt qu'il ne le contredit.** « Le `qr_token`, **dérivé de l'UUID** » et « planches de QR **pré-imprimées**, avec des **jetons pré-générés** et téléchargés sur l'appareil **avant le départ** » ne peuvent pas être vrais ensemble — _un jeton pré-généré avant le départ ne peut pas être dérivé de l'identifiant d'une machine qui n'existe pas encore._ La moitié conservée est celle que le recensement exige, et `engendrerPlancheDeJetons` la rend enfin réalisable.

**I4 est tenu** : `randomBytes` ne demande aucun réseau. Et ce que la dérivation apportait — recalculer le jeton depuis l'`id` pour réimprimer une étiquette — **ne coûte rien à perdre** : le jeton voyage avec la fiche, dans la même ligne que l'`id`. Le seul cas qu'un recalcul aurait sauvé ne peut pas se produire.

**Le contrôle de société de D22 n'est pas écrit dans le code** : `resoudreParJeton` lit **sous le contexte**, et la politique de forme « parc » décide. Une comparaison écrite au-dessus serait une seconde lecture du même critère, qui diverge en silence (§9, 01/09). Conséquence mesurée : **le QR ne lève aucune restriction** — un compte portail ne résout pas la machine de son propre client posée sur un site hors de son périmètre.

**Un jeton inconnu et le jeton d'une autre société rendent la MÊME chose.** Les distinguer ferait de ce chemin un oracle — _ce jeton existe-t-il quelque part ?_ (D35, D50).

**Et la lecture ne contrôle PAS la forme du jeton.** Le jeton lu est une donnée **stockée** : contrôler sa forme lierait les scans d'aujourd'hui à la génération d'aujourd'hui, et le jour où celle-ci changerait de longueur, les étiquettes déjà collées cesseraient de se résoudre **en silence**. Seule une borne de **taille** demeure.

**L'impression des étiquettes n'est pas construite** — la GÉNÉRATION l'est. Ce qui manque n'est pas un format mais un **fait de terrain** : planches autocollantes standard, ou imprimante portable dédiée. C'est la question ouverte n° 6 du cahier des charges.

## Le planning agissant — la table `intervention`, et sa forme de politique

`intervention` est la table sur laquelle tout le lot 2 converge, et ce qui la retenait n'était **pas** ses colonnes : c'était sa **forme de politique**, un arbitrage de cloisonnement que quatre sessions avaient à juste titre refusé de prendre en séance. **D84** la tranche — forme **« parc »**, société **ET** `app.client_id` **ET** `app.perimetre_sites` —, écrit son coût et sa condition de réouverture, et fait entrer la table dans `TABLES_PARC`, où un commentaire l'attendait nommément depuis la revue R0.

La clause de société **seule** est exclue par mesure : un compte portail y lirait les interventions des autres clients de sa propre société, et en tirerait leurs sites et leurs machines par jointure. La restriction des **7 jours** de RG-DRO-02 n'est **pas** exprimée en base — elle dépend de l'horloge, ce qui en ferait une dixième forme dont aucun jumeau ne peut mesurer deux fois le même verdict — **et depuis D85 c'est un principe et non plus un motif d'espèce : aucune politique de cloisonnement n'évalue l'heure, et un fait de cloisonnement qui dépend du temps se MATÉRIALISE en colonne qu'un travail écrit** (`tests/unit/db/horloge-hors-cloisonnement.test.ts`) — et reste applicative, comme elle l'est déjà pour `machine`.

**Deux verrous de cycle de vie sont dans la BASE, pas seulement à l'écran.** _Une action refusée à l'écran mais acceptée par la base est un trou_ : un écran se contourne par une requête, un déclencheur ne se contourne pas. `intervention_cycle_de_vie` refuse toute modification d'une intervention **annulée** ; toute modification d'une intervention **clôturée** autre que son annulation — I5 donne à `ANNULEE` la préséance sur `CLOTUREE`, et la lui retirer contredirait un invariant ; et la **clôture sans temps saisi**, `temps_reel_min` étant l'entrée de l'arrondi et du plancher de D83.

**Le journal des déplacements n'est pas une table de plus.** Qui, quand, d'où vers où : c'est `journal_audit`, que le périmètre inversé de D55 réclame le jour où la table apparaît, avec les valeurs avant et après.

Les cinq actions vivent dans `lib/interventions/` : la saisie sous Zod, le cycle de vie qui **explique** les refus, et le dépôt qui les applique sous le contexte cloisonné. **L'agence, le forfait de déplacement, le numéro et le statut ne se saisissent pas** — les deux premiers se déduisent du lieu d'intervention, le troisième appartient à la synchronisation (I10), le quatrième au créneau.

Écrans : `/planning`, `/planning/nouvelle`, `/planning/<id>`. Sur la fiche, **un refus prend la place de l'action**, en oxyde, avec sa raison écrite — jamais un bouton grisé, qui laisse croire qu'il suffirait d'insister. Et le calcul de D83 s'y lit **décomposé** : temps réel, arrondi, plancher, temps facturé, taux, total — _un total seul donne le résultat sans donner la raison, et c'est ce qui fait douter d'une facture._

## Amorcer une base de PRODUCTION — deux gestes qui manquaient

**Mesuré le 09/09/2026 sur une base neuve migrée SANS seed, et la chaîne était coupée deux crans plus bas qu'on ne le croyait.** L'ouverture du premier compte réclame `--societe <uuid>` ; or aucune société n'existe sur une base neuve et rien dans le dépôt n'en créait. Et une société porte une **devise** — or `devise` et `parite` sont des **référentiels de plateforme**, des FAITS et non de la démonstration (D4), et ils n'étaient écrits, eux aussi, que par `prisma/seed.ts`.

`pnpm db:referentiels` pose devises et parités par `upsert` ; `pnpm db:societe-initiale` ouvre **une** société et **n'invente aucune de ses sept valeurs** — la majoration hors ouverture est un pourcentage, c'est-à-dire un prix, et le §8 interdit d'en inventer un. Les deux sont portés par le flux GitHub **Amorcer une base**, cliquable depuis un téléphone. **Les jours fériés ne sont dans ni l'un ni l'autre** : leur horizon est glissant et se calcule par territoire, donc depuis les agences — `pnpm feries:etendre` reste le geste, et les recopier ici serait une seconde lecture d'un même critère.

_La chaîne complète a été jouée de bout en bout sur une base neuve : référentiels, société, première identité, URL de premier accès, porte refermée derrière elle._

**Et le flux de migration nomme désormais sa CIBLE.** `demonstration` — la base qui existe, celle que le seed peuple et que la veille observe — ou `production`, qui a ses propres secrets et où **le seed est sauté**. _Le choix ne se fait pas dans une expression : `cible == 'production' && secrets.PRODUCTION_… || secrets.…` a l'air d'un ternaire et n'en est pas un quand la première valeur est vide — un secret de production absent ferait migrer la démonstration, sans que rien ne soit vide ni ne le dise. Le choix se fait dans un shell, où « absent » ARRÊTE._

## La mise en ligne — une commande, une page, un geste

`docs/mise-en-ligne.md` se suit **depuis un téléphone, par quelqu'un qui n'a jamais ouvert ce dépôt** : huit gestes numérotés en tête, et chaque section explique celui qui la précède. Trois variables d'environnement, avec **ce qui casse quand chacune manque** — et le symptôme exact quand `DATABASE_URL` est fausse, parce qu'il égare : _un `HTTP 500` sur une route d'authentification, qui se lit comme un bogue d'authentification alors que le journal dit `P1001`._

Les migrations s'appliquent par **une seule commande**, `pnpm db:deploy`, sur une base neuve comme sur une base en service.

**`/sante` répond sans compte**, et elle dit en clair : la base répond-elle, le rôle de connexion est-il le bon, les migrations sont-elles à jour et laquelle manque. **Elle ne compte NI les sociétés NI les comptes, et elle dit pourquoi** : la lecture se ferait sans société active, les politiques rendraient **zéro**, et _un zéro se lirait « installation vide »_ — la conclusion opposée à la vraie (§9, 06/09). Mesuré à l'écran avant d'être corrigé. Ce qu'elle affiche à la place est plus fort qu'un nombre : que le décompte soit refusé **prouve que le cloisonnement mord sur cette connexion**. **Elle ne tombe jamais avec ce qu'elle surveille** — avec une base injoignable elle s'affiche quand même et répond « non », et un scénario l'éprouve en pointant la connexion sur un port où rien n'écoute. _Une sonde qui tombe en même temps que ce qu'elle surveille ne surveille rien._ Et elle ne montre **jamais** d'adresse, de nom de base ni d'identifiant : elle est sans compte, donc lisible par n'importe qui.

**La PWA n'est PAS installable, et rien n'y prépare** — mesuré le 09/09/2026 : ni `public/manifest.json`, ni agent de service, ni icône, ni répertoire `public/`. Ce n'est pas un réglage manquant, c'est le lot 3 (M7). Trois choses sont à écrire, dans cet ordre : un manifeste avec ses icônes, un agent de service qui met en cache la coquille de l'application, et la file de synchronisation hors ligne de I4 — la troisième est le vrai travail, les deux premières sont une heure.

## Le paramétrage par agence — parce qu'aucun calendrier n'est codé en dur

I7 est catégorique : _Ducos ouvre du lundi au samedi, Koné du lundi au vendredi. **Aucun calendrier global codé en dur.**_ Les horaires et les jours travaillés vivaient déjà dans `calendrier` et `calendrier_plage` depuis le lot 0. Il manquait le **pas des créneaux** — sans lui, la grille du planning aurait été une constante dans un composant, c'est-à-dire un réglage que personne ne peut changer — et le cas du **technicien dont la disponibilité n'est pas celle de son agence**.

`calendrier.pas_creneau_minutes` porte le pas, **par calendrier donc par agence** : rien ne dit que Ducos et Koné découpent leur journée pareil. 30 minutes est une valeur d'**amorçage**, réglable à l'écran `/parametres/agences`, jamais une règle métier.

`technicien_calendrier` porte l'exception — un temps partiel, une alternance, un renfort du matin. **C'est un rattachement à un autre calendrier de la même société, jamais une copie de plages** : recopier aurait fait deux lectures d'un même critère, et la seconde aurait cessé d'être vraie au premier changement d'horaires. Et **elle ne majore rien** : une exception dit _quand_ le technicien travaille, jamais _à quel prix_ — la majoration relève de RG-TAR et de l'agence du technicien (I7), et l'y mêler ferait payer au client la souplesse d'un contrat de travail.

**Une grille de créneaux ne déborde jamais sa plage.** Un créneau n'est proposé que s'il tient entièrement avant la fermeture : _une grille qui déborde est pire qu'une grille courte — la seconde se voit, la première se découvre sur place._ Le cas qui décide de la justesse n'est donc pas celui où le pas divise la plage, c'est celui où il ne la divise pas.

## Les captures d'écran, et ce qu'elles ne prouvent pas

`docs/captures/` porte les images de chaque écran, en thème clair et sombre, à 1280 px et 390 px. Elles sont produites en parcourant les chemins **réels** — la connexion, l'enrôlement, la création et la clôture y sont réellement jouées —, et leur README porte **l'empreinte du commit photographié, lue dans `git`**, avec la date lue à l'horloge.

_Elles montrent que les écrans s'affichent. Elles ne prouvent pas qu'ils fonctionnent, et elles vieillissent._ La seconde étape de l'enrôlement, celle qui affiche la clé TOTP et les codes de secours, n'est **jamais** photographiée : un secret dans une image du dépôt est un secret publié.

## Le chapitre 11 nomme-t-il toute table qui existe ?

L'écart signalé était `import_lot_ligne`, prescrite par **D15 (rang 1)** et absente du **chapitre 11 (rang 3)** : le rang 1 l'emporte, donc la table existera — _ce n'était pas une décision à prendre, c'était une omission à réparer._ La question posée ensuite — « y en a-t-il d'autres ? » — a rendu **seize** : `agence`, `calendrier`, `calendrier_plage`, `calendrier_ferie`, `jour_ferie`, `contact`, `taux_horaire`, `technicien_habilitation`, `site_habilitation_requise`, `utilisateur_client`, `utilisateur_client_site`, `session`, `compte`, `verification`, `second_facteur`, `journal_acces`.

Ce n'était pas seize décisions manquantes : **la même omission, seize fois** — un ticket crée une table, et personne ne revient compléter le chapitre. Le remède est celui de D41 : **renverser la charge et partir du schéma**, une source que le gardien ne contrôle pas (`scripts/lib/modele-de-donnees.ts`).

**Il ne contrôle qu'UN SENS, et il l'annonce.** Une table nommée au chapitre sans exister au schéma est légitime — le chapitre décrit le modèle complet, dont la plus grande part n'est pas construite. Il ne voit donc pas le défaut d'origine : aucun motif statique ne peut décider qu'une phrase de prose prescrit une table. _Un gardien qui annonce sa limite vaut mieux qu'un gardien qu'on croit complet._

## La neuvième forme de politique — « adhésion », et le sélecteur qui ne pouvait afficher que des UUID

D61 rend à un compte la **liste** des sociétés où il est habilité ; il lui manquait de quoi en **nommer** une. `societe` étant de forme « identité » (D42), la lecture rendait **zéro ligne sans société active — pas même en nommant l'identifiant qu'on possède déjà** (mesuré, avec témoin : 0, 0, et 2 lignes réellement en base). **Un sélecteur ne pouvait proposer que des UUID.**

D67 ajoute une politique de `SELECT` **et de `SELECT` seul**, ancrée sur `app.utilisateur_id` à travers la table d'habilitation. **Le coût se nomme, comme D61 a nommé le sien** : _une personne apprend le NOM des sociétés dont elle connaît déjà la liste_ — ni leurs données, ni leurs habilitations, ni l'existence d'aucune autre. Mesuré : un compte habilité sur **une seule** société lit **une seule** ligne, alors que la base en porte davantage.

**Ce qui la borne est la commande, pas la clause.** La même branche sur une écriture laisserait un compte renommer une société ou s'en attacher une ; un gardien le vérifie commande par commande, et une épreuve joue la faute telle qu'elle se commettrait — en « simplifiant » vers `FOR ALL`. Liste close gardée dans les deux sens : `TABLES_ADHESION`, dont le **retrait** est le sens silencieux.

## Le déverrouillage d'un compte parvenu à l'ESCALADE — sans jamais ouvrir une lecture

Au troisième verrouillage enchaîné, le verrouillage du second facteur cesse d'expirer. L'état est atteignable en **trente codes faux**, et il n'en existait **aucune sortie**. L7-04 la pose : `admin_societe` de la société concernée, journalisé. _Déverrouiller n'accorde aucun accès_ — la personne devra présenter un code valide, et n'a **rien** à réenrôler.

**La forme évidente ne fonctionne pas, et c'est le contenu du ticket** (D66). PostgreSQL applique les politiques de `SELECT` au `WHERE` d'un `UPDATE` : écrire `WHERE utilisateur_id = <sujet>` aurait exigé d'ouvrir la LECTURE de `second_facteur` à l'administrateur — mesuré, cela lui rend `secret` et `codes_secours`, c'est-à-dire **une prise de contrôle et non un déverrouillage**.

| Ce qui a été essayé, sous le rôle applicatif                | Lignes écrites                 |
| ----------------------------------------------------------- | ------------------------------ |
| politique d'`UPDATE` seule, `UPDATE … WHERE utilisateur_id` | **0**                          |
| politique de `SELECT` ajoutée, même `UPDATE`                | 1 — _et l'admin lit le secret_ |
| `UPDATE … SET <constantes>` **sans clause `WHERE`**         | **1**                          |

Le geste écrit donc un `UPDATE` **sans `WHERE`** : il ne lit aucune colonne, et c'est le `USING` de la politique — seul — qui choisit la ligne, désignée par `app.deverrouillage_sujet_id`. **Aucune lecture n'est ouverte à personne.** Deux filets pour le prix d'un `UPDATE` sans `WHERE` : en base, un déclencheur écrit **à l'envers** qui refuse toute colonne autre que les trois du verrouillage ; dans le code, l'annulation dès que le décompte n'est pas exactement un.

## Le geste d'ouverture du PREMIER compte — un cliquet, jamais une autorité qu'on s'accorde

`utilisateur_ouverture` exigeait une société active **et** le rôle qui administre. Pour la **première** identité d'une société, il n'existe personne à être : **personne ne pouvait se connecter à CODIPLAN**, et rien ne pouvait y remédier.

Un script qui poserait lui-même `app.role = 'admin_societe'` s'attribuerait une autorité que personne ne lui a accordée. La sortie n'est donc pas là : **c'est la BASE qui admet un cas, et le cas se détruit en s'exerçant** (D65). La politique reçoit une seconde branche — _une identité s'ouvre sans rôle qui administre si et seulement si la société ne porte AUCUNE habilitation_ —, et la première habilitation créée la rend inapplicable pour toujours. Le geste passe `role: null` : il ne se déclare rien.

**Ouvrir une identité n'accorde rien.** Sans ligne de `utilisateur_societe`, le compte ne lit aucune donnée cloisonnée ; ce qui accorde est l'habilitation, gouvernée par la clause de société.

```bash
AMORCAGE_PREMIER_COMPTE_CONFIRME=oui pnpm tsx scripts/amorcage-premier-compte.mts \
  --societe <uuid> --email <courriel> --nom "<nom>" --base https://…
```

Le geste **ne pose aucun mot de passe qui transite** : il en tire un au hasard, ne le rend à personne, et imprime **une fois** une URL de premier accès portant un jeton à usage unique et daté. Il ferme aussi la session que `signUpEmail` ouvre — _une porte d'amorçage qui laisse une session ouverte derrière elle est pire que celle qu'on voulait éviter._ La trace va à `journal_acces` sous `ouverture_identite`, jamais à `journal_audit` : une identité n'appartient à aucune société, et le journal d'audit est cloisonné et partitionné.

**Et si l'URL expire avant d'être ouverte** — elle vit une heure —, le même script la **réémet**, pour une identité qui n'a jamais servi et pour elle seule (10/09/2026, complément de D65) :

```bash
AMORCAGE_PREMIER_COMPTE_CONFIRME=oui pnpm tsx scripts/amorcage-premier-compte.mts \
  --reemettre --societe <uuid> --email <courriel> --base https://…
```

Son cliquet est un **fait** de la ligne de `compte` — `mot_de_passe IS NULL`, l'état dans lequel l'amorçage laisse le moyen de connexion depuis qu'il efface l'empreinte du mot de passe jetable. La première réinitialisation écrit une empreinte, et la réémission est fermée pour toujours ; un mot de passe oublié se traite par le chemin ordinaire. Elle ne rouvre jamais le chemin d'ouverture, ne laisse aucune session, et trace `reemission_premier_acces`.

**Sa condition de retrait est constatée par la machine :** `tests/unit/auth/amorcage-retrait.test.ts` échoue dès qu'un appel à `signUpEmail` apparaît hors du geste et hors des tests. Le jour où la porte principale s'ouvre, l'exception doit disparaître, et personne n'a à s'en souvenir.

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

**La troisième est VIDE depuis L1-02d, et c'est un ticket, pas un hasard**
(D59). Elle portait les cinq tables techniques d'authentification —
`session`, `compte`, `verification`, `second_facteur`, `journal_acces` — qui ne
portaient aucune RLS et donnaient les quatre verbes au rôle applicatif. Mesuré
sous un contexte de `technicien` : une empreinte de mot de passe et un jeton de
session lus, n'importe quelle ligne de `second_facteur` effacée, toutes sociétés
confondues. Elles portent désormais la forme « désignation », chacune avec la
clé de son chemin d'accès réel. **La liste vide n'est pas supprimée pour autant**
: elle est la branche où atterrirait une table qui perdrait sa RLS, et vide elle
dit « aucune table du dépôt n'est sans plancher ».

**L'`ENABLE` seul du milieu est une décision, pas un reste** (D4). `FORCE` ne
concerne que le PROPRIÉTAIRE des tables, et c'est lui qui amorce les
référentiels de plateforme : le seed devrait poser un contexte société pour
écrire la parité du franc Pacifique ou le 14 juillet, qui n'appartiennent à
aucune société. L'asymétrie est gardée **dans les deux sens** — un référentiel
qui perdrait `ENABLE` est un écart, un référentiel qui gagnerait `FORCE` en est
un autre, et chacun a son épreuve écrite. Elle se lit aussi dans le rapport
nocturne, qui **nomme** les tables de chaque catégorie plutôt que de les
compter : un décompte se lit en trois secondes et ne se vérifie pas.

### Et une troisième preuve : la FORME de la politique

Les deux précédentes disent que la sécurité est **activée** ; ni l'une ni
l'autre ne dit ce que la politique **laisse passer**. Une table peut porter les
deux drapeaux et une politique `USING (true)` : l'attribut est irréprochable et
le cloisonnement n'existe plus.

Il y a **sept formes** en vigueur, et le ticket L0-04 n'en énonçait qu'une :

| Forme            | Clause                                                                             | Exemple                                                                                |
| ---------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **identité**     | `id = app.societe_id`                                                              | `societe` (D42)                                                                        |
| **société**      | `societe_id = app.societe_id`                                                      | `agence`, `calendrier`                                                                 |
| **référentiel**  | lecture `true`, écriture `app_est_role_editeur()`                                  | `devise`, `jour_ferie` (D4)                                                            |
| **parc**         | société **et** `app.client_id` **et** `app.perimetre_sites`                        | `client`, `site`, `machine`, `contact` (D10, D22, L1-03)                               |
| **journal**      | `SELECT` habilité, `INSERT` seul                                                   | `journal_audit` (I8)                                                                   |
| **habilitation** | société **et** ( pas de `app.client_id` **ou** sa propre ligne )                   | `utilisateur_client`, `utilisateur_client_site` (L1-02b)                               |
| **désignation**  | la ligne que l'appelant nommait déjà, **plus** le rattachement à la société active | `utilisateur` (L1-02c), `session`, `compte`, `verification`, `second_facteur` (L1-02d) |
| **appartenance** | société pour tout le monde, **plus** sa propre ligne en `SELECT` SEUL              | `utilisateur_societe` (D61)                                                            |

La forme **« référentiel » ne s'applique jamais à une table métier** : sa lecture
ouvre toutes les lignes à toutes les sociétés, et son écriture donne le droit au
salarié de l'éditeur en le retirant à la société propriétaire.

La forme **« désignation »** porte sa **borne avant son nom** : elle ne vaut que
pour les opérations qui **précèdent** le contexte de locataire —
l'authentification, et rien d'autre. Chercher « existe-t-il un compte pour ce
courriel » se fait quand aucune société n'est connue et ne peut l'être. Elle
n'autorise que la lecture de **la ligne que l'appelant nommait déjà**, et ne rend
donc jamais plus que ce qu'il savait avant d'interroger. Liste close — une entrée
à L1-02c, **cinq** depuis L1-02d —, gardée dans les deux sens.

Ce qui la tient n'est pas la clé mais le fait qu'**aucun chemin ne laisse choisir
sa valeur** : un identifiant d'utilisateur est un UUID v7, donc pas un secret. La
moitié gardable de cette propriété est la **pose** — les variables
`app.authentification_*` ne s'écrivent que dans `lib/db/rls.ts`, qui les remet à
vide, et `lib/auth/lecture-identite.ts`, qui les renseigne depuis le `where` de
la requête ; `tests/unit/auth/pose-de-designation.test.ts` refuse tout autre
fichier applicatif. La moitié non gardable est la **provenance** : la valeur est
dérivée d'un contexte authentifié, jamais reçue d'un appelant — écrit au
CLAUDE.md faute de pouvoir être décidé par un motif (L1-02e).

Et une politique qui n'énonce qu'un `USING` **légifère en silence sur les
écritures** : PostgreSQL y fait valoir la même expression. Toute politique
couvrant une écriture énonce donc son `WITH CHECK`, **même quand il répète le
`USING`** — pour que ce soit une décision et non une conséquence.

La forme **« appartenance »** existe pour une raison mesurée : sans elle, aucun
chemin ne permettait à un compte de découvrir sur quelles sociétés il est
habilité — la connexion n'établit que l'identité, `basculerSociete` exige qu'on
lui nomme la société, et `utilisateur_societe` rendait zéro ligne tant qu'aucune
n'était active. Elle est en **`SELECT` seul** : la même branche sur une écriture
laisserait un compte s'attribuer le rôle de son choix sur la société de son
choix.

La forme **« habilitation »** vise les tables qui **donnent** accès au parc,
jamais les données du parc. Leur donner la forme « parc » serait circulaire :
cette forme lit `app.perimetre_sites`, et c'est de ces tables-là que la variable
est calculée. Le **discriminant** est `app.client_id`, posée pour un compte
portail et pour lui seul — c'est lui qui laisse un `admin_societe` voir les
habilitations de sa société, ce qu'une clause « sa propre ligne » sans
discriminant lui aurait retiré.

> **`app.client_id` est DÉSIGNÉE par l'appelant et VALIDÉE par la base**
> _(D70, 09/09/2026)_. La forme « parc » traite une valeur vide comme
> « utilisateur interne » : le filtre de client **disparaît**. Or
> `avecContexteApplicatif` — le seul chemin de production qui ouvre une
> transaction cloisonnée depuis une session — ne savait pas la renseigner.
> _Mesuré sur la base jetable, sous `codiplan_app` et après deux témoins : un
> compte portail du client `c2` lisait **2 machines du client `c1`** ; le même
> contexte avec `app.client_id` posé rendait **0**._
>
> Ni « l'appelant fournit » ni « la base dérive » — **un faux couple**. La
> dérivation n'est pas unique : `utilisateur_client` porte
> `UNIQUE (utilisateur_id, client_id)`, un compte tient légitimement plusieurs
> clients d'une même société (éprouvé en base). Et une valeur venue de
> l'extérieur ne borne rien sans validation (L1-02e). **L'appelant DÉSIGNE, la
> base DISPOSE** : `ContexteSession.clientId` dit pour quel client le compte
> agit ; `app_poser_perimetre_client` — `SECURITY INVOKER`, donc lue sous les
> politiques de l'appelant — **lève** si ce client n'est pas parmi ses
> habilitations, et ne retombe jamais sur la chaîne vide, qui rouvrirait la
> branche « utilisateur interne ». L'**ordre** est décidé : la variable est
> posée avant d'être validée, parce que valider d'abord ferait lire sous le
> régime de l'utilisateur interne. L'appariement rôle ↔ client est fermé **des
> deux côtés**, et `tests/isolation/designation-client.test.ts` le montre
> tomber. _Le gardien de L1-02b vérifie qu'une variable est **posée** ; il ne
> vérifiait pas qu'elle est **renseignable**._

`scripts/lib/politiques-rls.ts` porte la règle, partagée par
`tests/isolation/politiques-rls.test.ts` et le contrôle de la base hébergée. Elle
est **mesurée dans `pg_policies`**, qui rend l'expression _analysée_ : la
graphie, l'enveloppe `DO $$ … $$`, la pose en deux temps et le nom assemblé à
l'exécution s'y dissolvent — c'est l'état final qui est lu.

### Le contrat des fixtures d'isolation

`machine` et `modele_materiel` existent comme **tables fixtures** du
harnais, avec les politiques que les vraies tables porteront aux lots 1 et 2. Le
contrat est déclaré dans `tests/isolation/setup/contrat.ts` et tenu par **trois
gardiens indépendants** : la forme mesurée en base, la liste close `TABLES_PARC`
dont le _retrait_ d'une entrée est refusé, et un **plancher de scénarios** par
exigence de L0-05 qui ne se baisse jamais. Quand la vraie table arrive, le
harnais s'efface devant elle et dit ce qui reste dû — sans quoi la réparation la
plus naturelle réduisait la couverture en silence.

**`client` est la première à avoir franchi ce passage** (L1-01), et le contrat a
tenu : la migration lui donne la forme « parc », la fixture s'est effacée, les
scénarios portail se sont reportés sur la vraie table, et le plancher de D10 est
passé de 4 à 5 scénarios — plus nombreux après la reprise, jamais moins. Les
trois gardiens ont été éprouvés à cette occasion sur la réparation naïve
réellement écrite ; le détail est dans
`docs/decisions/2026-09-01-premiere-table-metier-client.md`.

**`site` a franchi le même passage à L1-02**, et elle y ajoute ce que `client`
ne pouvait pas porter : le **troisième** filtre. Sur `client`, la forme « parc »
n'a que deux moitiés — il n'y a pas de site au-dessus d'un client. Sur `site`
les trois mordent, et le troisième est le seul qui sépare deux sites d'un MÊME
client : ni la société ni `app.client_id` ne les distinguent. Le plancher du
périmètre de sites est passé de 2 à 4 scénarios. Voir
`docs/decisions/2026-09-06-site-et-la-cle-du-compte-portail.md`.

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

## Les exemptions des gardiens s'adossent à quelque chose qui existe

Un gardien qui exempte un chemin pose une **sélection négative**, et elle pourrit en silence : le fichier est renommé, l'entrée survit, elle ne protège plus rien — et le premier fichier qui reprendra ce nom héritera d'une exemption que personne ne lui a accordée. Le §9 du CLAUDE.md pose la règle depuis le 31/08 : _toute liste d'exemption porte le témoin de son adossement._

**Mesuré le 08/09 : neuf listes d'exemption existaient, et quatre ne portaient aucun témoin** — les quatre créées après que la règle a été écrite. Aucune n'était orpheline ; ce qui manquait était ce qui le dirait quand elles le deviendraient.

Le témoin n'est donc plus tenu liste par liste, mais par **un gardien unique qui déduit sa population du dépôt** — une exemption écrite dans six mois y entre d'elle-même. Il couvre les **deux formes**, et la seconde est celle qu'on oubliait : un préfixe de répertoire doit désigner un répertoire qui existe **et qui contient encore un fichier** — un répertoire vidé exempte toujours, et n'exempte plus rien. Trois jumeaux le montrent en le faisant tomber : un fichier exempté renommé, un préfixe vidé, et son propre motif rendu aveugle.

Sa limite est annoncée : il reconnaît une exemption **à son nom**, donc une liste baptisée autrement ou calculée à l'exécution lui échappe. Il arrête la distraction, pas le contournement.

## Les règles de gestion et les arbitrages qui les amendent

Le chapitre 10 du cahier des charges est la source **unique** des règles de
gestion, et il est de rang 2 : un arbitrage (rang 1) peut le réécrire. Jusqu'au
ticket R0-b, cette réécriture était une **promesse en prose** — dix règles
avaient été amendées par une décision sans que le texte bouge, et rien ne
pouvait le dire.

Le câblage est désormais bidirectionnel et vérifié :

- au chapitre 10, une règle amendée porte la mention `*(amendée par D6, D47)*` ;
- dans `docs/arbitrages.md`, la décision porte en retour la ligne
  `**Règles amendées :** RG-PAR-02` ;
- `tests/unit/docs/cablage-arbitrages.test.ts` exige que les deux listes
  s'accordent, et refuse en outre qu'une décision **affirme en prose** réécrire
  une règle — « RG-xxx est réécrite », ou une rédaction donnée en citation —
  sans la déclarer.

**Le gardien part de TOUTES les règles et de TOUTES les décisions.** Se limiter
aux règles qui portent déjà une mention aurait exclu exactement les dix qui
étaient cassées : la mention est une assertion, jamais un critère de sélection.
Il échoue sur zéro paire observée, et il est éprouvé dans les deux sens sur des
ruptures écrites dans les documents réels. Rejoué sur l'état d'avant R0-b, il
relève **treize écarts** ; sur l'état actuel, aucun.

Sa limite est annoncée : un arbitrage qui amende une règle **sans jamais en
écrire la référence** reste hors de portée d'un motif statique — seule la ligne
`**Règles amendées :**`, posée à la main, le rattrape.

### Le backlog, un rang plus bas

`docs/backlog.md` est de rang 4 et cite des règles de rang 2 et des décisions de
rang 1. Le même silence s'y rejouait : L1-08 portait « seul le dernier lot est
annulable » après que D54 l'eut supprimé.

`tests/unit/docs/coherence-backlog.test.ts` pose un contrôle **étroit** — un plan
bouge sans cesse, et le mode de défaillance réel est le ticket qui cite une règle
**ayant changé depuis**. Chaque ticket citant une règle ou une décision porte
l'empreinte du texte courant de ses sources :

```
*Relu contre les sources citées le 01/09/2026 — empreinte `961c49b1`.*
```

L'empreinte couvre la **clôture des amendements** — une décision amendée porte
`**Amendé par Dxx.**`, et bouger l'amendeur réveille les tickets qui citent
l'amendée. Sans quoi un ticket resterait vert alors qu'une décision qu'il ne cite
pas l'a rendu faux.

Ce gardien **ne prouve pas la cohérence** — aucun motif statique ne le peut. Il
force la relecture à l'instant où elle est due. Un ticket qui ne cite rien n'est
pas couvert : il sera lu contre le chapitre 10 le jour où on l'écrira.

## Intégration continue

`.github/workflows/ci.yml` — `verify` sur chaque proposition de fusion et chaque poussée hors `main` ; `verify:full` sur `main`, à la demande, et chaque nuit à 02h00 heure de Nouméa. `verify:full` ajoute le contrôle d'horizon des fériés, les deux contrôles des partitions du journal d'audit et les tests bout en bout.

### Qui voit une nuit rouge — deux alarmes, et la seconde garde la première

**Constaté, non supposé** : GitHub notifie bien par courriel l'échec d'une exécution, et les deux notifications d'échec du 20 août 2026 sont **restées non lues**. Pour un flux planifié, la notification part au dernier compte ayant modifié le `cron` — la même boîte. L'alarme sonnait, dans une pièce vide.

| Job                 | Répond à                                                                                                                                                           | Aveugle à                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `alarme-nuit-rouge` | **une nuit a-t-elle rougi ?** — une _issue_ s'ouvre dans le dépôt dès que `verify:full` échoue hors proposition de fusion. Une issue par épisode, pas une par nuit | une planification **arrêtée** : elle ne produit aucune exécution, donc aucun échec, donc aucune issue |
| `battement`         | **les nuits ont-elles cessé ?** — `pnpm battement` lit l'état du flux et l'âge de la dernière exécution planifiée                                                  | rien de ce que la première voit ; les deux sont indépendants dans les deux sens                       |

`battement` **ne tourne pas sur la planification**, et c'est tout son objet : un contrôle qui ne s'exécute que lorsque la planification s'exécute ne peut pas constater qu'elle a cessé. Il s'accroche à l'activité humaine — proposition de fusion, poussée sur `main`. Sa limite est écrite plutôt que tue : si personne ne pousse rien, il ne tourne pas davantage ; il garantit qu'**au premier retour de quelqu'un**, l'écran soit rouge.

### ⚠️ Avant de rendre ce dépôt public

La planification nocturne ne survit à l'inactivité **que parce que le dépôt est privé**. GitHub désactive automatiquement les flux planifiés après **60 jours** sans activité, et cette règle **ne vise que les dépôts publics** ; un fork la remet en vigueur lui aussi, les flux planifiés d'un dépôt forké étant désactivés par défaut.

La protection ne tient donc pas au fichier de flux : elle tient à un **attribut du dépôt**, qui change d'un clic et sans rien annoncer. C'est pourquoi la même mise en garde est écrite en tête de `.github/workflows/ci.yml` — là où quelqu'un qui change la visibilité la rencontrera —, et c'est le job `battement` qui rattrape le cas si elle est franchie quand même.

## Organisation

```
app/          routes Next.js (App Router)
components/   composants, dont components/ui pour shadcn/ui
lib/          l'ÉNUMÉRATION des modules et ce que chacun porte est au
              CLAUDE.md §6, et elle n'est pas recopiée ici — voir plus bas
              auth/amorcage.ts = le geste d'ouverture du PREMIER compte (D65),
              exception admise tant qu'aucun chemin administratif n'existe
              auth/deverrouillage.ts = L7-04, rompre la série de verrouillages
              d'un compte parvenu à l'escalade (D66) — sans ouvrir de lecture
prisma/       schema.prisma, migrations/, seed.ts, seed-data.ts, seed-delais.ts
scripts/      inventaire, contrôle de cloisonnement (privilèges compris), horizon des fériés
              amorcage-premier-compte.mts = l'ouverture de la PREMIÈRE identité
              d'une société (D65) — provisoire par construction, son retrait est
              gardé par la machine
              lib/schema-prisma.ts = LA lecture du schéma Prisma, partagée par
              les gardiens statiques ET par les scripts d'exploitation (10/09)
              lib/tables-comptees.ts = LA population de l'inventaire, PRODUITE
              par le schéma : toute table y est comptée, témoin, ou exemptée
              nommément avec son motif
tests/        unit/  isolation/  e2e/offline/   ← les trois derniers sont sanctuarisés
              fixtures/dates-excel.xlsx = un VRAI classeur Excel réduit PAR
              RETRAIT — plus une seule chaîne de caractères, et chaque cellule
              survivante byte-identique à son original (D90)
docs/         cahier des charges, arbitrages, backlog, décisions
```

> **L'énumération des modules de `lib/` A ÉTÉ RETIRÉE D'ICI le 11/09/2026, et elle n'est pas remplacée.** Elle était recopiée du CLAUDE.md §6, et elle avait **dérivé** : `lib/` porte **quinze** modules, ce bloc en nommait **dix** — `contacts/`, `excel/`, `habilitations/`, `materiel/` et `tarification/` manquaient, alors que la prose de ce même README les décrit plus bas. C'est le §9 du 01/09 en acte : _une liste close recopiée « pour la lisibilité » devient fausse le jour où la première grandit, sans rougir._ Le §6 la porte seul, et un gardien tient les deux sens, marque `(prévu)` comprise (`tests/unit/docs/organisation-du-code.test.ts`). **Retirer la seconde liste vaut mieux que la garder et la garder** — il n'y a plus rien à confronter.

Le domaine métier s'écrit en français (`intervention`, `machine`, `societe`, `agence`), le code technique en anglais (`createIntervention`, `useSyncQueue`). Jamais mélangés dans un même identifiant.

## État d'avancement

**Lot 0 terminé. Lot 1 livré jusqu'au bout de ce qu'il pouvait livrer** — ce qui reste y est **bloqué sur une décision**, jamais sur du travail :

| Reste du lot 1                     | Ce qui bloque                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **L1-08b** — le moteur d'import    | le §2 **ne nomme plus SheetJS** (amendé le 09/09/2026) : il exige une bibliothèque de lecture `.xlsx` **maintenue**. **La comparaison est faite et tient en un mot** — [`docs/decisions/2026-09-11-lecture-du-classeur-comparaison.md`](docs/decisions/2026-09-11-lecture-du-classeur-comparaison.md) : quatre voies lues sur deux vrais fichiers, la condition de l'arbitrage **ne tranche pas nettement**, et la branche de repli est **impraticable** — `cdn.sheetjs.com` est refusé par le mandataire sortant des sessions. Le choix engage la chaîne d'approvisionnement et appartient à l'exploitation |
| **L1-09** — modèles Excel          | même liaison                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **L1-10** — import de l'historique | dépend de L1-08b                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Ces deux chantiers-là sont **livrés depuis le 09/09/2026** : le **geste d'ouverture du premier compte** (D65) et **L7-04** (D66), qui en dépendait.

**Le LOT 2 est entamé** : **L2-01** — la fiche machine — a été livré le 09/09/2026, et avec lui la **troisième et dernière fixture du parc s'est effacée** devant sa table réelle. Le contrat de R0-a est honoré de bout en bout : `client`, `site` et `machine` sont désormais des tables réelles portant la forme « parc », et les planchers de scénarios ont **monté** à chaque reprise, jamais baissé.

**L'état ticket par ticket se lit dans [`docs/backlog.md`](docs/backlog.md), et nulle part ailleurs.** Il est de rang 4, et c'est lui que les gardiens confrontent aux règles et aux arbitrages : une seconde liste recopiée ici deviendrait fausse au premier ticket livré, sans rougir — c'est le §9 du 01/09. Ce qui suit n'énumère donc pas les tickets : ce sont les **décisions** que chacun a rendues visibles, et qui survivent à leur ticket.

**L1-08a** pose la **grammaire des imports** avant la liaison au classeur, et cette séparation est le fruit de la mesure de sécurité ci-dessus : le jour où la liaison arrive, elle n'aura **aucune règle à porter**. Deux formes y sont tranchées — un nombre lu ne rend **jamais un flottant** (I3 serait enfreint une ligne après nous), et une date se lit **en UTC** (UTC+11 décale le jour d'un cran).

**L1-06** et **L1-07** posent la **tarification**, mécanisme d'un côté et valeurs de l'autre : les deux tables naissent **vides**, parce que les montants appartiennent à l'exploitation. `tauxEnVigueur` rend `null` plutôt que zéro — _un taux manquant ne se lit jamais « gratuit »_ — et aucune fonction « le taux courant » n'existe : elle serait juste aujourd'hui et fausse demain.

**L1-05** retire un mécanisme au lieu de l'arbitrer : D4 se contredisait dans sa propre page, et `famille_materiel` et `modele_materiel` deviennent des **tables métier cloisonnées**. Quatrième fois que le dépôt tranche ainsi — _une nomenclature partagée fige un territoire dans un produit destiné à être vendu ailleurs._

**L1-04** pose les **habilitations** : la qualification
(`habilitation`), l'instance datée d'un technicien (`technicien_habilitation`) et
l'exigence d'un site (`site_habilitation_requise`), plus RG-PLA-04 dans
`lib/habilitations/` — _l'affectation est **bloquée**, jamais signalée_.

Deux décisions y sont visibles. **`habilitation` est une table métier
cloisonnée, pas un référentiel de plateforme** (D60) : une nomenclature
nationale est un fait de la France, pas un fait de la plateforme, et une société
suit aussi des qualifications que nulle norme ne connaît. La liste réglementaire
française est un **amorçage** posé à l'ouverture d'une société. Et
`site_habilitation_requise` est **la première table fille réelle du parc**, donc
la première à porter la sixième forme de politique — **« filiation »**, tranchée
à L1-02 et construite ici : _une fille est visible si son parent l'est._ Son
jumeau remplace la clause par celle de « société » et montre l'exigence du site
S2 réapparaître pour un compte portail restreint à S1 — la faute n'aurait rien
cassé de visible, elle aurait **allongé** la liste.

**L1-03** pose les **contacts** d'un client. Un contact appartient
au client, avec un rattachement de site **facultatif** — et cette nullité porte
du sens : _un contact sans site ne doit pas disparaître pour un compte portail
restreint à certains sites, sinon on perd le comptable en restreignant un
atelier._ La forme de politique est **déduite, et ce n'est pas une huitième** :
c'est « parc », avec la disjonction que la nullité impose. Un gardien l'exige
désormais dès que la colonne de périmètre est nullable — la nullabilité venant
d'`information_schema`, une source qu'il ne contrôle pas.

**L1-02c** cloisonne les **identités par la base** : `utilisateur`
ne l'était que par l'application, et une garantie qui ne vit que là n'en est pas
une. La difficulté était réelle — l'authentification **précède** la société —, et
elle se résout en séparant deux lectures qu'on avait confondues : la
**vérification d'identifiants**, qui porte déjà en entrée la seule ligne qu'elle a
le droit de voir, et la **lecture d'identités**, qui est une opération de
locataire. Au passage, l'inscription en libre-service est **fermée** : personne ne
crée son propre compte, jamais — ce n'est pas une restriction, c'est le métier.

**L1-02b** ferme deux choses d'un coup : le périmètre de sites
devient une table (`utilisateur_client_site`) avec une vraie clé étrangère, et
le contexte de session est enfin **armé** — `lib/db/rls.ts` posait quatre
variables là où les politiques en réclamaient six, si bien que les scénarios
d'isolation étaient verts parce que le harnais armait une garantie que la
production n'armait pas.

Lot 0, pour mémoire — les fondations, toutes livrées : **L0-01** (initialisation du dépôt), **L0-02** (chaîne de vérification), **L0-03** à **L0-06c** (socle multi-société, RLS, tests d'isolation, authentification et rôles, `societe` cloisonnée par son identité), **L0-07** (module monétaire), **L0-08** (module calendrier), **L0-09a** (le territoire d'un jour férié référencé), **L0-09** (thématisation par société), **L0-10** (journal d'audit), **L0-11** (vocabulaire français centralisé) et **R0-a** (les formes de politique RLS, le contrat des fixtures d'isolation).

Et les deux premières tables métier du lot 1 :

**L1-01** — la fiche `client`, première table métier. Elle porte
`societe_id NOT NULL` et la politique de forme **« parc »** (société **et**
`app.client_id`, D10/D22), jamais la clause société seule ; `code_externe` (D29)
est unique **par société** et son libellé d'affichage est paramétrable
(`societe.libelle_code_externe`). Le module applicatif est `lib/clients/`.

Et **D55** en est sorti : le périmètre d'audit de I8 est désormais **inversé** —
audité par défaut, exempté par écrit. `client` naissait hors périmètre non par
décision mais par omission, et c'est le sens de la liste qui était en cause, pas
son contenu.

**L1-02** — la table `site`, et la clé étrangère que L1-01 avait laissée en
suspens. `site` porte la forme « parc » **avec** le filtre de périmètre : c'est
la table où les trois filtres mordent ensemble. Le module applicatif est
`lib/sites/`, et l'énumération des zones de D23 y est close **à l'entrée
serveur**, pas en base — six valeurs qui sont la géographie d'un seul
territoire.

`utilisateur_client.client_id` chaîne enfin vers `client`, par une clé
**composite** `(societe_id, client_id)` : une clé sur le client seul aurait
laissé un compte portail désigner le client d'une autre société. La migration
**répare elle-même** l'habilitation de démonstration devenue orpheline, et
refuse de s'appliquer si l'état réel n'est pas celui qu'elle décrit. Elle porte
un **témoin de non-vacuité** que la mesure a rendu nécessaire : sous
`FORCE ROW LEVEL SECURITY`, un propriétaire non superutilisateur — la
configuration de la base hébergée — ne voit AUCUNE ligne, si bien qu'un bloc de
diagnostic écrit naïvement compte zéro orphelin sans en avoir cherché un seul.
En local, le rôle de migration est superutilisateur et contourne RLS : le défaut
n'existait que là où rien ne l'aurait exercé.

`utilisateur_client.perimetre_sites` restait alors **sans** clé étrangère, par
une impossibilité mesurée : PostgreSQL 16 ne sait pas contraindre les éléments
d'un tableau — ni `FOREIGN KEY` sur la colonne, ni
`FOREIGN KEY (EACH ELEMENT OF …)`, ni `CHECK` avec sous-requête. **L1-02b l'a
fermée** : le périmètre est une table, `utilisateur_client_site`, avec une vraie
clé composite vers `site (societe_id, id)`. La colonne a disparu dans la même
transaction que la reprise — deux sources d'un même périmètre divergeraient en
silence.

**D56** en est sorti : `site` nomme son **agence de rattachement**, et
`temps_trajet_min` est le trajet depuis elle. Le backlog disait « par agence »,
ce qui se lisait « une valeur par couple » ; l'exploitation a tranché — un site
dépend d'une agence et d'une seule. **Un nombre dont la signification dépend
d'une autre colonne ne doit jamais voyager seul** : la dépendance est écrite à
quatre endroits qui ne s'adressent pas aux mêmes lecteurs (la règle, le schéma,
un `COMMENT ON COLUMN`, le déclencheur), et surtout elle est TENUE — changer le
rattachement sans revoir le temps de trajet est refusé par la base, pas signalé.

Deux **bornes qui portent leur condition** plutôt qu'une date sont enregistrées
et mécaniques : les zones deviennent un référentiel cloisonné le jour où une
seconde géographie les emploie ; les horaires sortent du JSON le jour où on les
interroge. Une forme de plus — « filiation », une fille est
visible si son parent l'est — est tranchée en principe, non construite, et son
critère d'appel est la première table fille réelle. Son coût est mesuré :
7,1 → 10,5 ms sur un balayage de 100 000 lignes filles, et c'est un _hash
semi-join_, pas une sous-requête par ligne.

Et une **classe** de défaut est nommée : un bloc de garde de migration qui lit
sous `FORCE ROW LEVEL SECURITY` voit zéro et se croit rassuré — il ne se trompe
pas, il ne regarde rien. `scripts/lib/gardes-migration.ts` porte la règle et
l'inventaire des migrations déjà appliquées qui la violent : une seule.

Voir `docs/decisions/2026-09-06-site-et-la-cle-du-compte-portail.md`.
