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

pnpm deploiement:verifier # LA PRODUCTION DÉPLOYÉE EST-ELLE DEBOUT ? (R3-01)
                      # 0 sain · 1 écart CONSTATÉ · 75 rien constaté
                      # elle NE MIGRE RIEN : elle nomme le geste
                      # sans URL_PRODUCTION elle ROUGIT, elle ne saute pas

pnpm suspensions:denombrer # COMBIEN COÛTE LE RATTRAPAGE DE R3-02 ? (D104)
                      # il COMPTE, il ne répare RIEN : ni UPDATE, ni
                      # VALIDATE CONSTRAINT, ni motif générique — ce
                      # dernier serait l'issue (a) que D104 a écartée
                      # il REFUSE de rendre un zéro creux : « intervention »
                      # est sous FORCE, et un rôle non superutilisateur sans
                      # contexte verrait zéro ligne — le témoin porte sur le
                      # MÉCANISME, jamais sur un décompte
                      # et son rapport dit ce qu'un zéro ne veut PAS dire :
                      # une base bâtie depuis zéro ne PEUT pas porter de
                      # violation, la contrainte y précédant la première ligne

pnpm db:resoudre      # une migration a ÉCHOUÉ : déclarer l'échec annulé
                      # et rendre la base rejouable — il n'applique RIEN
pnpm file             # LE PREMIER TRAVAIL NON BLOQUÉ de docs/backlog.md
                      # la session nocturne LIT ce qu'il imprime, elle
                      # n'interprète pas le backlog — trois états et trois
                      # seulement : LIBRE, LIVRÉ, BLOQUÉ — <motif>
                      # un ticket sans marqueur fait échouer `pnpm verify`
                      # (tests/unit/docs/file-de-nuit.test.ts)
```

`pnpm test:e2e` compile lui-même l'application et la sert sur le port 3100 : c'est une compilation de production qui est mise sous test, pas le serveur de développement.

### Les migrations, rejouées contre une base qui a déjà vécu

_Écrit le 11/09/2026, après une panne de production de plus de quatre heures._

**`pnpm verify` migre une base VIDE puis la sème.** Toute ligne y respecte donc, par construction, la règle que la migration vient de poser : **aucune migration n'était jamais éprouvée contre des données préexistantes**, c'est-à-dire contre le seul monde où elle s'applique vraiment. La CI était verte, et elle avait raison — elle ne gardait pas ce monde-là.

`tests/isolation/migrations-sur-base-agee.test.ts` rejoue les migrations **avec `prisma migrate deploy`** — le chemin exact de la production, transaction implicite comprise. _Mesuré : `$executeRawUnsafe` refuse un fichier multi-instructions (`42601`), donc rejouer le SQL « à la main » n'était pas seulement moins fidèle, c'était impossible._

Il s'arrête **avant chaque migration qui resserre une table préexistante** — contrainte `CHECK` ou clé étrangère validée, `SET NOT NULL`, index unique, colonne obligatoire sans défaut, **et changement de type de colonne**, celle qu'on oublie parce qu'elle ne ressemble pas à une contrainte —, joue son amorce, **et compte les lignes de la table resserrée**. Un zéro fait échouer le scénario : _une migration éprouvée contre une table vide n'est pas éprouvée du tout_ — et c'est exactement la faute que ce harnais a commise à sa première exécution, où il a annoncé « toutes les migrations appliquées » sur une base dont l'amorce avait échoué en silence.

**La population est DÉRIVÉE du répertoire des migrations** : une migration écrite demain y entre d'elle-même. Deux listes closes l'accompagnent, gardées dans les deux sens — les resserrements **déjà appliqués partout**, fermés par le passé et non par une décision, et l'unique table **prouvée impossible à remplir** à son point d'histoire.

**Les 47 migrations ont été passées au même crible le 11/09/2026 : 52 resserrements dans 15 d'entre elles.** Onze sont closes par `_prisma_migrations` et non par une lecture — la base réelle les a acceptées, et une base neuve les reçoit toutes d'un coup sur un schéma vide. **Les quatre autres sont les seules encore vivantes, et les quatre sont rejouées** : les deux `CHECK` de `import_lot` passent contre un lot appliqué ; l'index unique de `contact` porte `id` et ne peut rien refuser ; les deux `CHECK` de `intervention` passent **depuis D104** ; et l'index unique de `technicien_calendrier` porte sur une table **prouvée vide** — son déclencheur d'audit refusait toute écriture tant que la table n'avait pas de colonne `id`, et `id` n'arrive qu'avec cette migration-là. _La table est restée inécrivable du 09/09 au 13/09, et rien ne l'a dit : aucun appelant ne l'exerçait._

`VALIDATE CONSTRAINT`, `ATTACH PARTITION` et `EXCLUDE` n'apparaissent **nulle part** dans les 47 — mesuré. Le lecteur les reconnaît quand même, et un témoin garde l'affirmation : le jour où l'une d'elles est écrite, il rougit, parce que cette phrase aura cessé d'être vraie.

_Éprouvé dans les deux directions, sur des fautes réellement écrites :_ la contrainte de D104 rendue `VALID` fait tomber le rejeu sur le `P3018`/`23514` exact du 11/09 ; une migration neuve qui resserrerait une table sans lignes rougit en nommant l'amorce à écrire.

`pnpm test:isolation` exige un PostgreSQL **local et jetable**, jamais la base hébergée. Le script `scripts/postgres-jetable.sh` le crée, le détruit et le recrée à chaque appel :

```bash
scripts/postgres-jetable.sh
export TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:5433/codiplan_test'
pnpm test:isolation
```

Voir [`docs/decisions/2026-08-20-tests-isolation-postgres-local.md`](docs/decisions/2026-08-20-tests-isolation-postgres-local.md).

`pnpm test:e2e` exige **une seconde base locale et jetable**, distincte de celle
du harnais d'isolation : les scénarios de bout en bout traversent une session et
un écran, donc une base **migrée et semée comme la production**, là où le harnais
d'isolation recrée son schéma et pose des tables fixtures. Les mêler ferait
mesurer aux scénarios d'écran un schéma que la migration n'a pas écrit.

```bash
scripts/postgres-jetable.sh
export E2E_DATABASE_URL='postgresql://postgres@127.0.0.1:5433/codiplan_e2e'
pnpm test:e2e
```

Le harnais **détruit et recrée** cette base à chaque exécution, applique
`prisma migrate deploy` puis le semis, et donne au serveur de test le rôle
applicatif restreint — jamais le propriétaire. Trois refus garantissent qu'elle
n'est jamais la base hébergée : une URL Neon, une URL identique à `DATABASE_URL`,
et **l'absence de la variable**. Le secret de session est tiré au sort à chaque
exécution et passé par l'environnement, jamais écrit nulle part (I9).

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

**Et le détectif a une DATE DE MISE EN SERVICE, parce qu'un argument qui repose
sur une surveillance doit dire depuis quand elle tourne.** La limite ci-dessus
n'est acceptable que si le détectif regarde la base réelle à échéance fixe. Ce
n'est vrai que **depuis le 8 septembre 2026 à 15:14 UTC** — première exécution
PLANIFIÉE du job `veille — base hébergée` (exécution `34243371255`, étape
`pnpm veille`, 15:14:03 → 15:14:09 UTC) ; le script est né avec le commit
`86e9c85` le 8 septembre à 00:54 UTC. **Avant cette date, le durcissement des
partitions n'était observé sur la base hébergée qu'au moment d'une migration**,
c'est-à-dire quand quelqu'un cliquait. Une garantie sans date de mise en service
se lit comme si elle avait toujours tenu.

**La preuve par LECTURE du cloisonnement a rejoint la même échéance le
11 septembre 2026 (D91)** — jusque-là elle ne tournait, elle aussi, qu'au moment
d'une migration. Ce que la nuit établit désormais : aucune ligne cloisonnée
n'est lisible sans contexte société, et la lecture n'est pas aveugle. Ce qu'elle
n'établit pas, faute d'une lecture exemptée des politiques : que chaque société
voie exactement ses lignes SOUS contexte — cette confrontation reste dans le
flux de migration, et sa condition de réouverture est écrite en D91.

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

**La liaison est arrivée le 13/09/2026** (`lib/excel/classeur.ts`, L1-08c), et elle tient la promesse que L1-08a avait écrite : _elle n'a aucune règle à porter._ Deux points en décident. Elle rend une **série** et non un `Date` — un `Date` est déjà une date valide, il a perdu ce qui permettait de la **refuser**, et les trois refus de D31 (le sérial fractionnaire, le 29 février 1900, la plage antérieure à mars 1900) deviendraient inexprimables. Et **le zéro ne s'écarte pas là** : `read-excel-file` rend `1899-12-30T00:00:00.000Z` pour les 171 cellules à zéro du classeur réel — _une date parfaitement formée et parfaitement fausse_ —, la liaison la transpose en série `0`, et c'est la grammaire qui la range en absence. Écarter dans le transport aurait mis une règle métier là où personne ne la relit.

**Et le rapport de I6 est construit avec elle** (`lib/excel/controle.ts`) : la moitié « d'abord » de _« un import produit d'abord un rapport, puis attend une validation explicite »_. Il n'écrit rien et ne connaît aucune base — le parc contre lequel il rapproche est un **paramètre**, l'appelant seul sachant sous quel contexte cloisonné il l'a obtenu. Les trois refus **précèdent toute ligne et ne comptent rien** : un rapport qui proposerait des créations sous une colonne obligatoire absente proposerait d'écrire des fiches amputées. Le total explique chaque ligne lue, et `lignesLues` est rendu à côté — _zéro contre zéro n'est pas une preuve._

## L'annulation est partielle et sûre, et une contrainte a été mise en défaut par elle

`lib/imports/annulation.ts` (L1-08j) **restaure ce qui peut l'être et refuse le reste avec son motif** — elle ne s'arrête pas au premier refus, et elle ne force rien. **Ni délai ni rang de lot** (D54), et c'est mesuré : _deux lots qui se recouvrent, et le premier s'annule sur ce que le second n'a pas touché._

**« Modifiée depuis » se constate en comparant**, sur **les seuls champs que l'import a écrits** : _il n'a pas touché le reste, il n'a donc rien à en dire._

**« Référencée depuis » est comptée AVANT, et ce n'est pas le choix qu'on ferait spontanément.** La déduplication du bac lit le refus de la base plutôt que de le prévenir, et c'est plus sûr — _ici, c'est impossible_ : **une violation de contrainte abandonne la transaction PostgreSQL entière** (`25P02`, mesuré), si bien que rattraper le `P2003` ferait cesser l'annulation d'être partielle au premier refus. **Ce que le comptage ne garantit pas est écrit** : une référence née entre le comptage et la suppression fait échouer l'annulation _entière_ — rien n'est défait à moitié, et on la rejoue.

**Et une contrainte de L1-08e a été mise en défaut par sa première annulation.** `(statut = 'applique') = (applique_le IS NOT NULL)` obligeait à **effacer la date d'application** pour annuler — _c'est-à-dire à perdre la seule trace du moment où les fiches ont été écrites._ Une **seconde migration** la remplace par une règle qui porte l'histoire : un lot annulé garde les deux dates. _Une seconde plutôt qu'une correction sur place parce que je ne peux pas savoir si la première a touché la base hébergée : elle est injoignable, et le geste est en attente d'une main._

## L'application n'applique QUE ce que le rapport a montré

C'est la seconde moitié de I6 (`lib/imports/application.ts`, L1-08h et L1-08i), et la première est en base depuis L1-08e : **le lot existe dès le contrôle**, avec ses lignes et leur action.

**Le rapport montre d'abord ce que la saisie refusera.** Le modèle porte sa validation comme il porte sa clé, et c'est **le schéma de création lui-même qui juge** — jamais une relecture de ses règles. _Une ligne que la saisie refusera et que le rapport annonce en création est un rapport qui ment : on valide 300 créations, on en obtient 297, et les trois manquantes ne se découvrent qu'après coup._

**L'application ne redécide rien** : elle lit `import_lot_ligne.action` et l'exécute. _Si elle recalculait, la validation humaine aurait porté sur un écran et l'écriture sur autre chose._

**Une seule transaction**, et ce n'est pas un détail : _une écriture par ligne laisserait, au premier incident, un lot « contrôlé » dont la moitié des fiches existe — un état que rien ne décrit et que l'annulation ne saurait pas défaire._ `creerClientDans` et `modifierClientDans` sont **extraites** de `lib/clients/depot.ts` plutôt que recopiées.

**`valeurs_avant` se lit AVANT d'écrire** — après, il est trop tard, et le journal d'audit porterait la seule trace, sur une table qu'aucune annulation ne lit (D15).

**Et la base a attrapé un oubli que la relecture n'avait pas vu** : le premier rejet réellement enregistré a fait rougir `import_lot_ligne_rejet_a_son_motif` (code 23514) — le rapport portait le motif, **et l'enregistrement le jetait**. _Aucun test ne pouvait le voir avant qu'un rejet traverse la chaîne entière._

**Ce qui reste (L1-08b) :** l'**annulation partielle**, et elle seule.

## L'ambiguïté est un fait du PARC, et elle devient un rejet

RG-IMP-05 pose **trois** cas et non deux : _« en cas d'ambiguïté, la ligne part en rejet pour arbitrage humain plutôt qu'en création silencieuse d'un doublon »._ Le contrôle ne recevait qu'un `Set<string>`, qui ne pouvait pas porter le troisième — la limite était **écrite** à L1-08f, et L1-08g la retire.

`ParcConnu` porte désormais **deux ensembles**, et `ambigues` **n'a aucune valeur par défaut** : un appelant qui ne sait pas répondre doit passer un ensemble vide, ce qui est une **affirmation** — _« ce parc ne porte aucune ambiguïté »._ Un défaut ferait de cette affirmation un oubli, et l'oubli retomberait du côté permissif.

**L'ordre est une décision** : le rejet précède la modification. _Une clé ambiguë est aussi une clé connue, et tester « connue » d'abord la rendrait modifiable — c'est-à-dire écraserait l'une des deux fiches au hasard, ce que RG-IMP-05 refuse précisément._

`lib/imports/parc-clients.ts` **lit l'ambiguïté d'une collision, jamais d'une ressemblance**, et calcule la clé par la **même fonction** que le contrôle : _une variante ferait que rien ne se rapproche jamais, et tout redeviendrait création._ La clé ambiguë est **retirée** de l'index et **reste** dans `cles` — laisser l'une des deux fiches ferait écraser celle-là plutôt que l'autre.

## Ce qui rend une clé utilisable n'est pas sa forme, c'est ce que la base garantit d'elle

D101 (L1-09c) tranche les deux règles qui manquaient, et **le schéma répond différemment pour chacune** :

|            | Ce que la base garantit                     | Ce qu'on rapproche                                       |
| ---------- | ------------------------------------------- | -------------------------------------------------------- |
| **agence** | `@@unique([societe_id, code])`              | **le code, et lui seul**                                 |
| **client** | `code_externe` unique, raison sociale libre | le code, **à défaut** le nom (RG-IMP-05)                 |
| **site**   | aucune unicité sur le libellé               | le **couple** (client, libellé) — ambigu, donc rejetable |

_Accepter le libellé d'une agence « à défaut », par analogie avec RG-IMP-05, ferait dépendre le rattachement d'un site d'une chaîne que rien n'empêche d'être en double_ — et un site rattaché à la mauvaise agence fausse **le temps de trajet** (D56), **le calendrier de référence** (I7) et **la majoration**.

**Et un scénario a dû changer de société, ce qui vaut d'être écrit** : chez la société A, l'agence a pour code « DUCOS » et pour libellé « Ducos » — _ils coïncident à la casse près, et aucun scénario ne pouvait y distinguer une règle de l'autre._ Chez B, « SIEGE » et « Siège » sont séparés par un accent. _Écrire l'épreuve chez A l'aurait fait passer pour une mauvaise raison : elle aurait montré une tolérance de casse, pas un refus de libellé._

## Un gabarit qui désigne un PARENT est une fonction du parc

`modeleContacts(parc)` (L1-09b) — _un gabarit qui désigne un parent ne peut pas être contrôlé sans ce parent_ : savoir si « Garage Dupont » existe demande de regarder le parc. Le modèle est **fabriqué** avec l'index, plutôt que de recevoir le parc à chaque appel — _ce qui aurait changé le contrat du contrôle pour tous les modèles, y compris ceux qui ne désignent rien._

**La même clé que le gabarit du parent, jamais une seconde** : _une seconde règle de rapprochement des clients se verrait au pire moment — des contacts accrochés au mauvais client._

**Deux motifs de rejet distincts, et c'est ce qui les rend utiles** : une **saisie refusée** se corrige dans le fichier, un **parent introuvable** se corrige dans le parc — ou dans la colonne qui le nomme. _Rendre le même code ferait chercher au mauvais endroit._

**Et deux mesures ont corrigé ce qui avait été écrit.** Le **courriel est obligatoire**, et ce n'est pas une décision du gabarit : `canaux` vaut `["email"]` par défaut, et la saisie refuse alors un contact sans courriel. L'**index du parc porte deux clés par fiche**, code **et** nom : _avec une seule, une ligne désignant « Client A1 » par son nom proposait une création alors que la fiche existait_ — le « s'il existe » de RG-IMP-05 porte sur **la ligne du fichier**, pas sur la fiche.

## Deux sortes de fichiers d'import, et les confondre bloquait les deux

_Mesuré en préparant l'application (L1-09a) : aucun modèle d'import concret n'existait dans `lib/`_ — `ModeleDImport` n'était qu'un type, et ses seuls exemplaires vivaient dans des tests.

|                                            | D'où viennent ses colonnes   | Peut-on l'écrire aujourd'hui ?        |
| ------------------------------------------ | ---------------------------- | ------------------------------------- |
| **le gabarit que CODIPLAN publie**         | de **nos** schémas de saisie | **oui** — ils sont dans le dépôt      |
| le fichier de **reprise** d'un outil tiers | du fichier réel du client    | non — il n'est pas dans le dépôt (I9) |

`lib/imports/modeles.ts` ne porte que la première sorte. _Un gabarit est un document que nous définissons et que le client remplit : ses colonnes se lisent dans `lib/clients/saisie.ts`, elles ne s'inventent pas._

**Le gabarit est confronté au schéma, dans les deux sens.** La population vient du **schéma** et non du gabarit — _sélectionner « les colonnes du modèle » exclurait exactement le champ qu'on a oublié d'exposer._ Chaque champ est **exposé** ou **écarté nommément avec son motif** ; aucune colonne n'est orpheline ; tout champ obligatoire a une colonne obligatoire, **et la réciproque** — _un gabarit dont tout serait obligatoire refuserait des fichiers que la saisie accepte._

**Deux champs écartés, avec leur motif.** `adresse_facturation` : le chapitre 11 ne lui fixe **aucune forme**, et l'aplatir dans un tableur la figerait pour tous les clients. `actif` : _un import ne désactive pas — une colonne « Actif » ferait d'un oubli de saisie une désactivation de masse._

**Ce qui reste dû (L1-09) :** les gabarits **sites, contacts, modèles, prestations** — ils butent sur une **résolution de référence** que le gabarit « clients » n'avait pas : un site désigne un client **et une agence**, et _RG-IMP-05 dit comment rapprocher un client, rien ne dit comment rapprocher une agence._ Et le **téléchargement**, qui exige une bibliothèque d'**écriture** `.xlsx` — donc une dépendance, donc une décision.

## Le rapprochement ne savait rapprocher que des MACHINES

_Mesuré le 11/09/2026 (L1-08f)_, sur un modèle « clients » écrit tel qu'on l'écrirait aujourd'hui, contre un parc qui connaissait **déjà** les deux codes :

```
clés rendues : LIGNE-3, LIGNE-4
actions      : creation, creation
créations    : 2 | modifications : 0
```

Le contrôle calculait lui-même la clé des machines — série, référence, rang — **quel que soit le type d'import**. Un modèle sans série ni référence tombait donc sur la clé de dernier recours, et **toutes ses lignes étaient des créations** : un second import du même fichier aurait créé 55 doublons sur l'onglet Clients, c'est-à-dire ce que RG-IMP-05 interdit.

**C'est désormais le MODÈLE qui dit ce qu'une ligne désigne**, jamais le contrôle. `ModeleDImport.cle` est **obligatoire et sans valeur par défaut** — _un défaut ferait qu'un modèle qui oublie reçoit la clé des machines en silence, ce qui est la faute qu'on vient de retirer._ La clé des machines n'a pas changé d'un caractère : **elle a changé de main**, et les 111 scénarios du module passent inchangés.

**RG-IMP-05 est enfin implémentée** (`cleDeClient`) : code externe s'il existe, à défaut **raison sociale normalisée**. La normalisation porte sur la **graphie** — accents, casse, ponctuation, espaces — et sur rien d'autre : _« SARL Dupont » et « Dupont » restent deux clés distinctes, parce qu'un rapprochement faux attribue les machines d'un client à un autre et que plus personne ne saura qu'il était automatique._ Trois espaces disjoints, prouvés comme ceux des machines.

**Ce qui reste dû, écrit plutôt qu'oublié :** RG-IMP-05 veut qu'en cas d'**ambiguïté** la ligne parte en rejet pour arbitrage humain. L'ambiguïté est un fait du **parc** — deux clients de même raison sociale normalisée —, et le contrôle ne reçoit qu'un `Set<string>`, qui ne peut pas la porter.

## Le lot d'import EXISTE DÈS LE CONTRÔLE, et il est fermé au portail

`import_lot` et `import_lot_ligne` (L1-08e). **Le lot naît au contrôle, pas à l'application** : I6 veut qu'un import _« produise d'abord un rapport, puis attende une validation explicite »_, et **l'application ne peut appliquer que ce que le rapport a MONTRÉ** — sans quoi la validation porte sur un écran et l'écriture sur autre chose. Le chapitre 11 le disait depuis l'origine sans qu'on l'ait lu ainsi : `import_lot.statut` vaut `controle`, `applique` ou `annule`.

`lib/imports/depot.ts` **écrit, il ne décide rien** : toute la décision — nature, clé, création ou modification — a été prise par `lib/excel/controle.ts`, qui ne connaît aucune base. _Recalculer là serait une seconde lecture d'un même critère, dans le pire endroit : entre ce qu'un humain a validé à l'écran et ce qui sera écrit._ Le module a d'ailleurs porté sa propre boucle de comptage pendant une demi-heure ; elle a été **retirée plutôt que gardée par un test d'égalité**, les décomptes venant désormais de `proposerDepuisLesLignes` et de lui seul.

**Les deux tables prennent la forme « interne » (D100), et elles la prennent à leur naissance.** `import_lot_ligne.valeurs` porte la ligne du fichier telle qu'elle a été lue : _un fichier d'import de parc contient TOUTES les machines de la société, qu'aucun périmètre de sites n'a jamais filtré._ Or une table de forme « société » est lisible par un compte de portail — sa clause ne lit pas `app.client_id`. Lui donner cette forme aurait rendu à un compte restreint à un atelier **la liste intégrale du parc de sa société**, par une table que personne n'aurait pensé à regarder. C'est la fuite que D94 ferme sur le bac de réception, un étage plus loin : là un nom de fichier révélait le parc, ici c'est le parc lui-même.

**Et la chaîne a un appelant** (`tests/isolation/chaine-import.test.ts`) : feuille → contrôle → enregistrement par le chemin de production → relecture sous contexte cloisonné. _Une suite qui éprouve tous les maillons n'éprouve pas la chaîne_ — et entre le contrôle, qui a ses 106 scénarios, et les politiques, qui ont les leurs, personne ne traversait.

**Ce qui reste dû :** l'application et l'annulation partielle (L1-08b), et l'écran (L1-09). `import_lot.objet_cle` existe et **reste nulle** : le stockage d'objets n'a pas d'appelant, et une colonne qui attend s'écrit comme telle plutôt que de se remplir d'un chemin fabriqué.

## Le catalogue de forfaits, et l'axe qui dort

`forfait` porte les trois axes de RG-TAR-06 — zone, famille de matériel, type d'intervention — et la règle qui décide. Le montant y prend la même forme que le taux horaire : un **entier** avec son code de devise, refusé s'il s'écarte de celle de sa société. **Zéro est permis** — une prestation offerte est un forfait à zéro, et c'est la façon de la dire ; négatif non, ce serait un avoir.

**Le cas qui décide de la justesse de la règle n'est pas celui où une condition échoue, c'est celui où il n'y en a pas.** Un forfait sans zone s'applique partout, et le confondre avec « aucune zone ne convient » retirerait du catalogue tous les forfaits généraux — la majorité. Réciproquement, une valeur d'intervention **absente** face à une condition posée n'est pas remplie : appliquer un forfait de zone à une intervention dont la zone est inconnue facturerait un déplacement que personne n'a constaté.

**Le troisième axe est inerte, et c'est écrit plutôt que tu.** Les types d'intervention n'existent nulle part dans ce dépôt — ni énumération, ni liste close, ni table —, et le lot 2 les décidera. La règle est pourtant écrite entière et éprouvée sur les trois axes, pour n'avoir pas à changer ce jour-là. Même forme que D63 : _ce n'est pas un défaut du code, c'est une donnée qui n'existe pas, et rien ne rougira tout seul._

**LE RANG DÉCIDE QUAND PLUSIEURS CONVIENNENT (D86), et il est explicite.** « Le premier applicable l'emporte » ne définissait pas « premier » : le code ordonnait par l'**alphabet** d'un code, et l'ordre naturel suivant eût été celui d'**insertion**. _Deux interventions identiques se factureraient alors différemment selon la minute d'une saisie passée._ `forfait.rang` est un entier strictement positif, **sans défaut** — le plus petit l'emporte —, et **l'égalité est un état interdit que la base refuse** sur `(societe_id, type, rang)` : le rang ne se compare qu'entre forfaits de même nature. L'écran `/parametres/forfaits` montre, pour une zone choisie, quels forfaits s'appliquent et dans quel ordre, avec **trois verdicts** — retenu, applicable mais devancé, écarté ; il appelle la fonction que la création d'intervention appelle, jamais une seconde lecture du même critère.

**Et « aucune condition » a DEUX écritures, ce qui a coûté un défaut d'argent.** La saisie Zod l'écrit `null` ; la base ne le peut pas — une liste scalaire PostgreSQL n'est pas nullable, et l'absence de condition y est le tableau **VIDE**. La règle ne lisait que la première : mesuré, **le forfait général ne s'appliquait jamais** par le chemin de production. Les deux formes se lisent désormais au même endroit.

**La table naît vide.** Quels forfaits mettre au catalogue et à quels montants appartient à l'exploitation. Et ce module ne **valorise** rien : ce qu'un forfait consomme du temps passé — à partir de quand une heure devient excédentaire — n'est tranché nulle part.

Deux limites mesurées : PostgreSQL **refuse toute sous-requête dans un `CHECK`** (`0A000`), donc « sans doublon » passe par une fonction `IMMUTABLE` ; et écrire chez une autre société est refusé **par le déclencheur de devise avant le `WITH CHECK`** — un `BEFORE` précède la politique. La garantie est donc exigée deux fois, et un second scénario va chercher le `WITH CHECK` derrière lui, déclencheur ôté.

## Familles et modèles — un mécanisme retiré plutôt qu'arbitré

`famille_materiel` et `modele_materiel` sont des **tables métier cloisonnées**, `societe_id NOT NULL`, RLS forcée, auditées. Elles portaient la forme « société » ; **depuis D93 (13/09/2026) elles portent la forme « ascendance »** — voir « La documentation des machines » plus bas. Elles étaient destinées à la deuxième catégorie de I1 — référentiels de plateforme — et **D4 est amendé** :

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

## Le socle PWA — et ce qu'un service worker n'a pas le droit de mettre en cache

`tests/e2e/offline/` **n'est plus vide**. Il l'était depuis L0-02, et sa condition de réouverture, corrigée le 13/09 contre `docs/guide-pilotage.md` §5, disait : _« au premier ticket du lot 3 qui touche le hors-ligne — L3-06 —, les scénarios de ce répertoire s'écrivent **avant** le code qu'ils éprouvent. »_ Les trois scénarios ont été écrits d'abord, et ils ont d'abord rougi.

### ⚠️ Un cache est un stockage, et I1 ne s'arrête pas au serveur

> Un service worker qui garderait le planning rendu pour la société A le resservirait à une session de la société B **sur le même appareil**. Aucune politique PostgreSQL ne s'applique à `caches` : **la lecture a déjà eu lieu.**

Un appareil partagé entre deux techniciens, ou une personne habilitée sur deux sociétés (RG-SOC-03, le cas ordinaire), suffit à rendre la fuite réelle. La règle est donc une **liste d'autorisés, jamais une liste d'interdits** — _une liste d'interdits oublie par construction la route créée demain._ Deux routes publiques, plus les ressources statiques, et rien d'autre.

**Le jumeau mord sur la faute telle qu'elle se commettrait** : la recette la plus répandue est « mettre en cache toute navigation réussie ». Écrite, le scénario tombe. _Il a été écrit avant le service worker, et c'est ce qui a contraint le service worker._

**Et l'assertion a été rendue plus stricte après avoir rougi, pas plus permissive.** Elle filtrait les URL contenant « /planning » et a pris trois entrées qui ne sont pas des pages — `_next/static/chunks/app/(back-office)/planning/page-<empreinte>.js`, c'est-à-dire les **modules** de la route : du code, identique pour toutes les sociétés. _Un filtre par sous-chaîne confondait le nom d'un fichier avec ce qu'il contient._ Ce qui l'a remplacé est **clos** : tout ce qui n'est pas statique doit être exactement la coquille publique.

### Réseau d'abord, jamais cache d'abord

Sur un réseau calédonien, le cache d'abord donnerait une page plus rapide et **parfois périmée**, sans que rien ne le dise. C'est la règle du glisser-déposer appliquée au cache — _l'écran ne montre jamais un état que la base n'a pas accepté._

### L'icône : la maquette est muette, et l'écart s'écrit avec sa mesure

D95 autorise l'écart _« avec sa mesure et le point précis où elle est muette »_. Mesuré : la maquette ne porte **aucun logo** — deux `<svg>`, une courbe de tendance et un QR de démonstration. Ce qui est posé est le minimum défendable : **le monogramme du produit sur sa couleur de marque**, tracé sans dépendance, dans la zone sûre de 80 % qu'une icône `maskable` exige. _Ce n'est pas une identité visuelle : c'est ce qu'une installation exige, et un placeholder nommé vaut mieux qu'une icône absente qui empêche l'installation._

### Les couleurs ne sont pas écrites dans le manifeste

Un manifeste n'est pas une feuille de style : le navigateur le lit hors de tout document et ne peut pas résoudre `var(--app-marque)`. Elles vivent dans `lib/theme/manifeste.ts` — **le répertoire que le gardien de L0-09 désigne déjà** comme l'endroit où une couleur s'écrit. _Poser une exemption de plus aurait élargi la règle ; poser le fichier dans le répertoire déjà désigné ne l'élargit pas d'un pouce._ Et **ce qui confronte les deux copies est un gardien qui lit `app/globals.css`**, pas la relecture.

_Ce gardien a d'ailleurs lu un commentaire au lieu d'une déclaration, et il l'a dit en rougissant_ : son motif cherchait `--app-fond:` n'importe où et trouvait la phrase d'entête de la feuille de style. Il est désormais ancré en début de ligne — la seule coupure légitime est « documentation contre exécution ».

## L'absence d'un technicien — et pourquoi aucun client ne la lit

RG-PLA-06 : _« Une absence validée bloque le créneau ; les interventions posées repassent en file à planifier avec alerte. »_ La table `absence` porte la période — **deux dates, bornes COMPRISES, et aucune heure** : _une borne ouverte aurait fait travailler quelqu'un le dernier jour de son arrêt._

**Le statut a TROIS valeurs, jamais un booléen.** RG-PLA-06 ne bloque que sur une absence **validée** ; un booléen `validee` n'aurait pas su distinguer « demandée, pas encore tranchée » de « refusée », et le planning aurait bloqué sur une demande qu'on venait de refuser.

### Sa forme de politique est « interne », et c'est décidé à sa NAISSANCE

D94 a créé cette forme pour `document_recu` — _une table de forme « société » est lisible par un compte de portail, sa clause ne lisant pas `app.client_id`_ — et il a écrit ce qu'il laissait ouvert : la question des tables **déjà existantes**. Celle-ci n'existait pas.

> _« Votre technicien habituel est en arrêt du 14 au 28 » est une donnée de santé par déduction, et ce n'est pas au client de la lire._

**Trancher à la création est le seul moment où cela ne coûte rien** — _une échéance qui tombe au pire moment est un report déguisé_ — et c'est la doctrine §2 sans détour : en cas de doute entre montrer et cacher, **on cache**. _Le coût, nommé_ : le jour où l'on dira à un client que son intervention est reportée, ce n'est pas cette table qu'il lira, c'est l'intervention, qui porte son statut et son motif. **Et c'est bien ainsi** : ce qu'un client a le droit de savoir est que SON rendez-vous bouge, jamais pourquoi la personne n'est pas là.

_Conséquence sur le gardien_ : chaque entrée de la liste close « interne » porte désormais **le motif de son propre retrait**. Le message parlait de **noms de fichiers** — vrai du bac et des lots d'import, **faux de l'absence** —, et _un gabarit qui affirme une cause que le contrôle ne mesure pas la réémet à chaque alarme._

### Le QUATRIÈME contrôle à la pose, et la déplanification

Une absence validée refuse le créneau **au déplacement comme à la pose** : c'est la leçon de L3-02, apprise la veille — _une règle tenue par un chemin sur deux n'est pas tenue._ Le refus nomme son motif sans nommer ni la personne ni la période : _un refus est un canal d'information soumis au cloisonnement comme une requête_ (D50).

**La validation et la déplanification sont dans la même transaction.** Une absence validée dont les interventions seraient restées posées ferait affirmer au planning qu'un absent travaille. Ce qui part est **la date et le créneau** ; **le technicien reste** — _une intervention qui perd son affectation perd l'information qui permet de la reposer au même endroit._ Et **une décision ne se reprend pas** : refuser après coup ne rendrait pas leurs créneaux aux interventions déjà rendues à la file.

## Le technicien a enfin une agence — et une table auditée était inécrivable

`technicien` existait dans le chapitre 11 et **nulle part ailleurs**. Trois documents s'y référaient : le §6 la marquait `(prévu)`, D72 en dépendait, et `occupation.ts` écrivait sa dette en toutes lettres. La table est créée avec ce que L3-01 réclame — utilisateur, société, **agence**, actif — et **trois colonnes du chapitre 11 n'y sont pas** : `cout_horaire` et `taux_facturation_defaut`, parce que _c'est le piège de `societe.taux_horaire_defaut`, retirée le 09/09_ — deux sources d'un même fait qui divergent en valeur ; et `vehicule`, parce que _une colonne inerte n'est pas neutre, elle est une invitation._

**La règle de priorité vit dans `lib/calendar/technicien.ts` et nulle part ailleurs** : horaires propres s'il en a, sinon ceux de son agence ; **fuseau, territoire, fériés et ponts toujours ceux de l'agence**. _Un technicien travaille le samedi par exception ; il ne décrète pas les fériés de son territoire._ C'est la ligne de partage de D46, appliquée à une personne au lieu d'une agence.

**Elle a un appelant le jour même**, et il était écrit : `occupation.ts` portait _« le calendrier de travail propre au technicien n'est pas encore consulté ici ; le jour où il le sera, c'est lui qui fera foi »_. La mise en cache du dénominateur suit désormais le **couple** (technicien, agence) — _deux techniciens de la même agence peuvent avoir deux dénominateurs._

### `technicien_calendrier` était INÉCRIVABLE, et personne ne l'avait vu

`journal_audit_tracer` désigne la ligne journalisée par sa clé technique (I10) et **lève quand la table n'expose aucune colonne `id`**. `technicien_calendrier` portait le déclencheur depuis le paramétrage par agence **sans avoir cette colonne** : tout `INSERT` y échouait en `P0001`.

> `ERROR : journal_audit : la table « technicien_calendrier » n'expose aucune colonne « id ».`

_Personne ne l'avait vu parce que personne n'écrivait dans cette table_ — un défaut invisible parce que ce qu'il casse n'existe pas encore. Le périmètre d'audit, lui, était **vert** : il vérifie que le déclencheur **est posé**, pas qu'il **peut s'exécuter**.

**La moitié qui manquait est désormais un contrôle** : toute table portant le déclencheur d'audit doit exposer une colonne `id`. Mesuré — la colonne retirée, il nomme `technicien_calendrier`.

## Les temps de trajet par zone — un défaut qui se règle, jamais une constante

RG-PLA-05 pose une cascade depuis D23 : _la valeur saisie sur le site fait foi ; l'estimation par zone n'est qu'un défaut appliqué en son absence._ **Les six durées de cette estimation n'étaient écrites nulle part** — mesuré à L3-05, et le §8 est net : _un délai non spécifié ne s'invente pas._ **D107 les a arrêtées** : `grand_noumea` 30, `sud` 90, `cote_ouest` 150, `cote_est` 240, `nord` 240.

**Ce sont des défauts MODIFIABLES, et c'est ce qui commande la forme.** _« C'est l'ADV qui remplit les données, elle ne doit pas dépendre d'un déploiement »_ : une constante du dépôt ferait d'une correction de terrain une demande de fusion. Les valeurs de référence restent au code — c'est ce qu'un déploiement neuf propose —, et la table `temps_trajet_zone` porte ce qu'une société en **corrige**. Elle ne remplace pas le défaut : elle le **surcharge**, et **retirer un réglage rend la main à la référence, jamais à zéro** — _zéro se lirait « l'établissement est sur place » là où il faut lire « je ne sais pas encore »_, et la base le refuse.

**La cascade a trois étages et rend son ORIGINE avec sa valeur** : site, société, défaut. C'est D56 appliqué à un second nombre — _un nombre dont la signification dépend d'autre chose ne voyage jamais seul._ « 90 » sans son origine ferait revoir les mauvaises lignes le jour d'une correction, et l'écran affiche donc les deux.

### `iles` ne porte aucun nombre, et une seule source le tient

D107, mot pour mot : _« déplacement par avion — estimation impossible, à saisir par intervention. »_ Ce n'est pas une valeur qui manque, c'est une valeur qui **n'existe pas à la maille de la zone** — Lifou, Bélep et Ouvéa n'ont ni le même vol ni la même fréquence, et un nombre unique pour « Îles » finirait dans le numérateur d'un taux d'occupation.

**Trois lecteurs, une source.** `DEFAUTS_TRAJET_ZONE` décide, et le schéma de saisie, la résolution et l'écran le lisent — une seconde liste « les zones sans estimation » aurait divergé en silence. Et la résolution rend `null` **même si une ligne existait** : _une garantie qui ne vit que dans la validation d'entrée n'en est pas une._ Le refus vit au serveur et non en base, parce qu'un `CHECK "zone" <> 'iles'` aurait inscrit un nom de zone calédonien dans le schéma — ce que `lib/sites/zones.ts` refuse depuis D23, et ce dont R3-04 traitera.

### Et un écart d'habilitation est mesuré plutôt que tranché en passant

_Mesuré le 12/09/2026 :_ `parametrer_societe` donne `●` à `admin_societe` et `○` à `direction` — **`adv` n'y est pas** — et la matrice des capacités n'a **qu'un seul appelant dans tout le dépôt**. Ni `/parametres/agences` ni `/parametres/forfaits` ne gardent leur accès par capacité, et le nouvel écran fait comme eux : _poser un filtre ici et nulle part ailleurs refuserait l'ADV que D107 désigne, sur le seul écran qu'elle doit remplir._ Les **deux moitiés** sont portées au ticket : ou bien la matrice est fausse et RG-DRO-03 se réécrit, ou bien le filtrage arrive partout à la fois.

## Le trajet entre dans la charge — la lecture C, et les deux autres chiffrées à côté

RG-PLA-05 exige que _« le temps de trajet soit intégré au calcul de charge »_, et il ne l'était pas : `minutesEngagees` ne comptait que la durée de l'intervention. **La barre et le taux sous-estimaient la journée réelle** de plusieurs heures par semaine et par technicien.

**Trois lectures étaient possibles avec la colonne telle qu'elle est**, et le scénario les chiffre **côte à côte** sur la journée à trois sites de L3-05 — 60, 30, 45 minutes : A donne **270**, B donne **120**, C donne **105**. _Un scénario qui n'éprouverait que la lecture retenue ne dirait pas qu'elle en est une._

**D107 retient C : l'aller vers le premier lieu de la journée, le retour depuis le dernier.** La raison décisive : sur une journée à un seul lieu, C donne **exactement A** — le lieu étant à la fois premier et dernier — et dès que la journée est groupée, elle **cesse de compter un retour à l'agence qui n'a pas eu lieu**. A supposait un retour entre chaque site, faux pour un fourgon chargé d'outillage ; B — `2 × max` — décrit une journée qui n'a pas eu lieu.

**Le temps d'un lieu à un autre n'est pas compté, et l'écran l'ÉCRIT.** La colonne ne porte que des durées depuis l'agence (D56), et _soustraire deux distances à un point commun n'est pas une distance_ — la discipline du `NOT VALID` de D104 : ce qu'on ne sait pas, on le dit.

### Trois décisions de forme, et chacune ferme une pente

**Le trajet est un champ À PART, jamais fondu dans les heures engagées.** La barre est segmentée par statut et un trajet n'en a pas — l'y verser ferait une barre dont les segments ne somment plus à leur largeur. Et surtout : _un taux dont on ne peut plus retrouver les termes n'est plus vérifiable._ La formule affichée porte donc ses **trois** termes, et le gardien « jamais le pourcentage seul » l'exige.

**L'argument est OBLIGATOIRE, sans valeur par défaut** : un appelant qui oublierait le trajet **ne compile pas**. C'est la leçon de D70 — _une garantie énoncée sur un geste est satisfaite par un geste vide._ Les treize appels existants disent maintenant `SANS_TRAJET` en clair.

**Le module ne trie pas** : l'ordre reçu est celui que le planning affiche. Trier là serait une seconde lecture de l'ordre, et le total compterait les extrémités d'une journée que personne ne voit.

### Et une épreuve verte pour la mauvaise raison a été corrigée

La première version prétendait prouver « l'ordre compte » en **renversant** la journée. Or `premier + dernier` est **symétrique** : elle passait dans les deux cas. C'est la dissymétrie du 11/09 — _une mise en échec n'éprouve que la direction qui rougit ; le vert, lui, peut avoir la mauvaise cause._ Ce qui le prouve est de déplacer un lieu d'une extrémité vers le milieu : **220 contre 30**.

### Ce qui n'est pas connu est compté à part, et la prémisse est écrite

Une journée dont une **extrémité** a un trajet inconnu — un lieu sans zone, ou les Îles (D107) — n'additionne pas zéro : elle se compte à part, et l'écran le dit. Un **milieu** inconnu, lui, ne gêne pas : la lecture C ne lit pas le milieu.

**La prémisse de D107 est satisfaite aujourd'hui et elle est écrite** : la durée lue est mesurée depuis l'agence du **site**, et D107 la prend pour le départ du **technicien** parce que tous partent de Ducos. _Le jour où une seconde agence fait partir un technicien, la valeur cesse d'être celle de son départ_ — c'est la condition de réouverture que D107 pose sur ce point seul, et **aucun gardien ne la surveille.**

## La file « en attente de pièce » — ce qui la désigne n'est pas un code

Le statut `suspendue` existait depuis le planning agissant ; **rien ne portait le motif**, et une intervention pouvait donc s'arrêter sans qu'on sache pourquoi. RG-INT-06 : _« une intervention SUSPENDUE porte un motif et, pour une attente de pièce, la référence attendue et la date de disponibilité prévisionnelle. »_

**Aucune énumération de motifs n'est inventée.** Le chapitre 10 n'en pose pas, et _fermer une énumération avant d'avoir tranché à qui l'on vend_ est une erreur que ce dépôt a déjà faite. Ce qui **désigne** une attente de pièce est donc la présence de `piece_attendue_ref` — pas un code choisi en séance.

**La référence et sa date vont ensemble, ou pas du tout**, et la base le tient : _une référence sans date fait une file d'attente sans horizon_, c'est-à-dire une file que l'alerte « en attente de pièce depuis > 30 j » du chapitre 16.1 ne saurait pas trier. Quatre contraintes l'écrivent **dans les deux sens** — un motif sans suspension est refusé comme une suspension sans motif.

**La reprise n'efface rien côté applicatif.** Le déclencheur `intervention_sortie_de_suspension` remet les quatre colonnes à `NULL`, parce que les contraintes l'exigent déjà : _les effacer aussi en TypeScript serait une seconde lecture du même critère._ Et le statut retrouvé est celui que le **créneau** dicte, jamais celui d'avant — _le planificateur a pu déplacer l'intervention entre-temps._

**Une intervention déjà suspendue ne se re-suspend pas**, et ce n'est pas de la prudence : ce serait écraser `suspendue_le`, c'est-à-dire **remettre à zéro l'ancienneté** que la file mesure.

**L'ancienneté se compte en jours d'horloge, pas en jours ouvrés.** _Le fournisseur ne livre pas le samedi, mais la pièce n'arrive pas non plus._ C'est l'inverse du compteur d'accusé de réception (D13), et l'écart est délibéré : là on mesure une réactivité humaine, ici un délai subi.

## Le total hors taxes en était un faux — deux mesures

Le ticket de valorisation n'a pas commencé par du code : il a commencé par **deux mesures sur ce que l'écran affichait**.

**1. Le forfait de déplacement n'entrait dans AUCUN total.** `intervention.forfait_deplacement_id` le désignait, et la clôture écrivait `montant_ht = mainDoeuvre` — _« Total hors taxes » portait la main-d'œuvre seule_, alors que RG-INT-07 fait du forfait de zone **le** mode de facturation du déplacement et que **D77** écrit qu'_un forfait s'ajoute toujours aux heures_.

**2. Une intervention au forfait se clôturait à ZÉRO.** _Zéro est une réponse_ : il dit « cela ne coûte rien » là où il faut lire « je ne sais pas encore » — rien ne sélectionne de forfait de **prestation**, `forfaitRetenu` n'étant appelé que pour le déplacement. Le total est désormais **`null` avec son motif**, jamais nul, et l'écran affiche ce qui manque à la place du montant.

**La composition était « non tranchée », et elle ne l'est plus.** L'en-tête de `valorisation.ts` refusait toute fonction « valoriser une intervention » au motif que _la composition forfait + excédent n'est pas tranchée_. **D77 l'a tranchée le 09/09.** La phrase d'origine est conservée en tête, barrée — _elle a gouverné ce module, et ce qui a été décidé un jour se relit._

**Ce qui n'est pas fait, et pourquoi :** la **majoration hors ouverture**. Son taux (+50 %) et son assiette (main-d'œuvre seule) sont écrits par D12 ; **la base de son prorata ne l'est pas**. _« Au prorata, quart d'heure par quart d'heure »_ suppose que la durée facturée et le créneau coïncident — ils ne coïncident pas : la main-d'œuvre se calcule sur `temps_reel_min` arrondi puis planché, les minutes hors ouverture se lisent sur le créneau. Créneau 16 h–18 h, fermeture à 17 h, travail de 30 minutes : **50 % ou 0 % selon la base retenue**, et l'écart se voit sur la facture. C'est l'argent facturé : la question est portée à l'exploitation, pas tranchée en séance.

## Une visite, plusieurs machines — et la fille suit son parent

`intervention.machine_id` a **disparu** : une visite peut couvrir plusieurs matériels (chapitre 7/M3), et `intervention_machine` porte le rattachement. La colonne n'est pas conservée « pour la machine principale » — ce serait **deux écritures d'un même fait**, et personne ne saurait laquelle fait foi le jour où elles se contrediraient. La migration **reprend les lignes existantes** avant de supprimer la colonne.

**Le parent de la politique est `intervention`, et pas `machine`** (**D103**). C'est la seule décision de fond, et elle n'est pas évidente puisque la table a deux parents possibles : _l'intervention est ce qui décide QUI a le droit de voir cette ligne ; la machine n'est que ce dont elle parle._ Adosser la clause à `machine` aurait rendu visible le rattachement d'une visite qu'on n'a pas le droit de lire, dès lors qu'on voit le matériel — et le parc est plus largement visible qu'une intervention.

**La politique ne recopie rien**, et c'est tout l'intérêt de la forme « filiation » : elle ne nomme ni `app.client_id` ni `app.perimetre_sites`, elle demande seulement si le parent est visible. _Recopier les filtres aurait passé tous les scénarios d'effet_ — le seul moyen de distinguer les deux est de **lire la clause**, et un scénario le fait.

**RG-INT-01 devient vérifiable**, au moment que la règle nomme elle-même : _« si la machine n'existe pas, elle est créée **avant de démarrer** »_. Jamais à la création — le dépannage à l'aveugle est le cas ordinaire, _on sait qu'un compresseur est en panne, pas lequel_. **Trois statuts, pas un** : la base garde des ÉTATS et non des trajets, et ne surveiller que `en_cours` laisserait passer un saut direct vers `terminee`.

**La limite est écrite plutôt que tue :** le contrôle ne voit que les **transitions**. Un `INSERT` direct dans un statut de travail lui échappe, et c'est inévitable — au moment de l'insertion, aucune ligne fille ne peut exister. La contrainte différée qui fermerait ce chemin refuserait les interventions de démonstration, **`prisma/seed.ts` ne créant aucune machine** (mesuré). Condition de réouverture : la synchronisation du lot 3.

## La demande d'intervention — la seule table du lot 2 où un CLIENT écrit

`demande` est le point d'entrée du flux : un appel saisi par l'ADV, un dépôt sur le portail, une échéance contractuelle, un seuil de compteur, une détection par un technicien. Elle porte la forme de politique **« parc »** (**D102**) — société **ET** `app.client_id` **ET** `app.perimetre_sites` —, et ce n'est pas `intervention` bis : **le parcours P5 du chapitre 9 fait ÉCRIRE un compte de portail dans cette table.** Une clause trop large n'y aurait pas fait fuir une lecture : elle aurait laissé **un client déposer une demande au nom d'un autre**. Le `WITH CHECK` est donc écrit explicitement plutôt que laissé à PostgreSQL.

**La mesure qui a justifié la déclaration, et non seulement la politique.** Avant d'ajouter l'entrée à `TABLES_PARC`, la table portait **déjà** la bonne politique — et le gardien de forme était **VERT** : `formeAttendue` rend « société » pour une table non déclarée, et _une politique plus stricte satisfait une attente plus lâche_. Politique remplacée par la clause de société seule, entrée absente : **0 écart**. La même faute, entrée déclarée : le gardien **nomme la table et le filtre perdu**. _Une table jamais déclarée est dans le même état qu'une table retirée_ — le sens silencieux que la revue R0 nomme sur cette liste, manifesté avant même qu'une entrée existe. L'épreuve vit dans `tests/isolation/politiques-rls.test.ts`, avec sa sonde.

**L'accusé de réception porte DEUX instants, pas un.** Le **dépôt**, et le **départ du compteur** des 30 minutes — _« une demande déposée sur le portail un dimanche à 22 h déclenche son compteur à l'ouverture du lundi »_ (**D13**). Le second est **matérialisé et jamais recalculé** : un calendrier se modifie, et déclarer un férié travaillé ferait reculer, des mois plus tard, le départ d'un compteur déjà consommé — **sans qu'aucune écriture ne le dise**. C'est le motif de D85 appliqué hors du cloisonnement.

**Trois états, jamais un booléen.** _« Sans réponse »_ n'est ni _« dans les temps »_ ni _« hors délai »_, et les trois ne se corrigent pas de la même façon : l'un demande qu'on réponde, l'autre qu'on comprenne pourquoi on a répondu tard. `lib/demandes/accuse.ts` les rend distincts, et l'instant courant y est un **paramètre** — lu dans le module, il rendrait un test vert parce que l'horloge a bougé.

**Le cycle de vie est tenu deux fois.** `lib/demandes/cycle-de-vie.ts` **explique** le refus avant l'action ; le déclencheur `demande_cycle_de_vie` le **garde quoi qu'il arrive**. Les deux fins ne se ressemblent pas : une demande **devient une intervention**, ou elle est **close sans suite AVEC son motif** — _cette information est conservée : elle mesure le service rendu à distance._ Aucune ne se rouvre, et aucune ne revient à « nouvelle ».

**Ce qui n'est pas fait, et qui est nommé plutôt que simulé :** la transformation **ne crée pas l'intervention**. Le lien vit sur `intervention.demande_id` (chapitre 11), la colonne n'existe pas encore, et _une transformation que rien ne peut relire est pire qu'une absente._

## Amorcer une base de PRODUCTION — deux gestes qui manquaient

**Mesuré le 09/09/2026 sur une base neuve migrée SANS seed, et la chaîne était coupée deux crans plus bas qu'on ne le croyait.** L'ouverture du premier compte réclame `--societe <uuid>` ; or aucune société n'existe sur une base neuve et rien dans le dépôt n'en créait. Et une société porte une **devise** — or `devise` et `parite` sont des **référentiels de plateforme**, des FAITS et non de la démonstration (D4), et ils n'étaient écrits, eux aussi, que par `prisma/seed.ts`.

`pnpm db:referentiels` pose devises et parités par `upsert` ; `pnpm db:societe-initiale` ouvre **une** société et **n'invente aucune de ses sept valeurs** — la majoration hors ouverture est un pourcentage, c'est-à-dire un prix, et le §8 interdit d'en inventer un. Les deux sont portés par le flux GitHub **Amorcer une base**, cliquable depuis un téléphone. **Les jours fériés ne sont dans ni l'un ni l'autre** : leur horizon est glissant et se calcule par territoire, donc depuis les agences — `pnpm feries:etendre` reste le geste, et les recopier ici serait une seconde lecture d'un même critère.

_La chaîne complète a été jouée de bout en bout sur une base neuve : référentiels, société, première identité, URL de premier accès, porte refermée derrière elle._

**Et le flux de migration nomme désormais sa CIBLE.** `demonstration` — la base qui existe, celle que le seed peuple et que la veille observe — ou `production`, qui a ses propres secrets et où **le seed est sauté**. _Le choix ne se fait pas dans une expression : `cible == 'production' && secrets.PRODUCTION_… || secrets.…` a l'air d'un ternaire et n'en est pas un quand la première valeur est vide — un secret de production absent ferait migrer la démonstration, sans que rien ne soit vide ni ne le dise. Le choix se fait dans un shell, où « absent » ARRÊTE._

## La mise en ligne — une commande, une page, un geste

`docs/mise-en-ligne.md` se suit **depuis un téléphone, par quelqu'un qui n'a jamais ouvert ce dépôt** : huit gestes numérotés en tête, et chaque section explique celui qui la précède. Trois variables d'environnement, avec **ce qui casse quand chacune manque** — et le symptôme exact quand `DATABASE_URL` est fausse, parce qu'il égare : _un `HTTP 500` sur une route d'authentification, qui se lit comme un bogue d'authentification alors que le journal dit `P1001`._

Les migrations s'appliquent par **une seule commande**, `pnpm db:deploy`, sur une base neuve comme sur une base en service.

**Et quand l'une d'elles ÉCHOUE, la base reste bloquée jusqu'à ce qu'une main la débloque.** Prisma refuse toute migration ultérieure tant que l'échec n'est pas résolu (`P3018`) : les migrations suivantes ne partent pas, le code déployé continue d'avancer sans elles, et l'application casse sur des colonnes qui n'existent pas. _Mesuré le 11/09/2026 : `/planning` a rendu une exception serveur pendant plus de quatre heures, sept migrations en retard derrière une seule en échec._

`pnpm db:resoudre`, porté par le flux GitHub **DB resolve — débloquer une migration en échec**, est ce déblocage. Il OBSERVE avant d'agir : il imprime l'historique et **refuse sans rien écrire** dans cinq cas — historique vide, aucune migration en échec, plusieurs en échec, nom saisi différent de celui que la base porte, et **migration ayant appliqué au moins une étape**. Ce dernier est le garde qui porte tout : une migration non transactionnelle laisse une partie d'elle-même en base, et la déclarer annulée écrirait une chose fausse dans l'historique. **Il n'applique AUCUNE migration** — enchaîner rejouerait aussitôt celle qui vient d'échouer, et la rebloquerait. _Un verbe par flux._ Et `--applied` n'est exposé nulle part : il marque une migration comme appliquée **sans l'exécuter**, c'est-à-dire qu'il fait diverger la base du dépôt en silence. La procédure en clics est au §7 bis de `docs/mise-en-ligne.md`.

**`/sante` répond sans compte**, et elle dit en clair : la base répond-elle, le rôle de connexion est-il le bon, les migrations sont-elles à jour et laquelle manque.

**Et « à jour » se lit sur la DERNIÈRE TENTATIVE de chaque migration, jamais sur une tentative quelconque.** `_prisma_migrations` porte **une ligne par essai** : après un déblocage, le même nom y figure deux fois — l'essai annulé et l'essai réussi. _Mesuré le 11/09/2026 en rejouant la panne : 22:32:06 annulée, 22:32:09 appliquée._ La sonde s'arrêtait à la première trouvée, et répondait donc « non » sur une base parfaitement à jour — _elle avait dit « oui » sans mesurer la veille, elle disait « non » sans mesurer davantage._ Les deux verdicts ont été lus sur la même base : sonde d'avant → « Une migration a échoué » ; sonde réparée → « à jour ».

**TROIS états, et jamais deux** : appliquée ; **en échec**, qui bloque toutes les suivantes (`P3018`) et demande d'abord un déblocage ; **annulée**, qui se rejoue toute seule au déploiement suivant. Les deux derniers étaient confondus sous « a échoué ou a été annulée », et _ils n'appellent pas le même geste_. L'échec est nommé **avant** l'absence, parce qu'il empêche de la corriger. **Elle ne compte NI les sociétés NI les comptes, et elle dit pourquoi** : la lecture se ferait sans société active, les politiques rendraient **zéro**, et _un zéro se lirait « installation vide »_ — la conclusion opposée à la vraie (§9, 06/09). Mesuré à l'écran avant d'être corrigé. Ce qu'elle affiche à la place est plus fort qu'un nombre : que le décompte soit refusé **prouve que le cloisonnement mord sur cette connexion**. **Elle ne tombe jamais avec ce qu'elle surveille** — avec une base injoignable elle s'affiche quand même et répond « non », et un scénario l'éprouve en pointant la connexion sur un port où rien n'écoute. _Une sonde qui tombe en même temps que ce qu'elle surveille ne surveille rien._ Et elle ne montre **jamais** d'adresse, de nom de base ni d'identifiant : elle est sans compte, donc lisible par n'importe qui.

### Et la sonde est OUVERTE après chaque fusion — une sonde que personne n'ouvre ne sonne pas

**Trois pannes de production en deux jours, toutes la même cause**, et la troisième est celle qui a fait écrire ce contrôle : `/sante` nommait le défaut en une ligne — _« Une migration n'est pas appliquée : 20260913190000_trajet_par_zone_r3_03 »_ — **et personne ne l'avait ouverte**. La sonde réparée la veille fonctionnait ; elle n'avait pas de lecteur.

**`/api/sante` rend la MÊME lecture à une machine.** Une lecture, deux rendus : une seconde lecture écrite « pour la machine » serait deux implémentations d'un même critère, chacune verte, divergeant en silence (§9, 01/09) — et dans le pire sens, puisque c'est la machine qui décide si quelqu'un est prévenu. Un scénario les fait répondre l'une à côté de l'autre sur des états réels. Elle répond **`200` même quand tout va mal**, et c'est une décision : un `503` indistinct confondrait _« l'application ne répond pas »_ et _« l'application répond et dit que sa base est en retard »_, qui ne se corrigent pas au même endroit.

`pnpm deploiement:verifier` ([`scripts/verifier-deploiement.mts`](scripts/verifier-deploiement.mts)) l'ouvre, et [`scripts/lib/verdict-deploiement.ts`](scripts/lib/verdict-deploiement.ts) rend le verdict **sans réseau** — ce qui le rend éprouvable sur la réponse exacte qu'a rendue la production. **Neuf natures**, parce que chacune se corrige ailleurs : la base en retard appelle une migration, un rôle inattendu est un cloisonnement tombé, une réponse illisible est un défaut du dépôt, une adresse absente est une variable à poser. Les codes de sortie sont ceux de `pnpm veille` — **75 quand on n'a rien pu constater, 1 quand on a constaté un écart** : _une même distinction se dit avec les mêmes chiffres, ou ce sont deux conventions qui divergeront._

**Le témoin est la pièce qui décide de tout le reste.** Un contrôle lancé après une fusion interroge, par défaut, **l'ancienne version** — qui répond « tout va bien » en toute sincérité, sa base lui suffisant. _Il aurait donc été vert précisément dans la fenêtre où la panne naît._ La réponse porte donc le **commit déployé**, et le contrôle refuse de conclure tant qu'il n'a pas reconnu celui qu'il visait.

**Il ne migre rien.** Une migration ne part jamais toute seule ; le contrôle **nomme le geste** — champ par champ, jusqu'à la case à laisser décochée — et un humain le joue en le regardant. Un gardien refuse que ce job porte jamais `migrate deploy`.

**Et le geste est devenu mécanique, pas mémoriel.** La règle du protocole voulait que tout travail touchant `prisma/` finisse par un geste nommé ; elle était écrite, juste, et elle n'a pas tenu — _une règle écrite dans un document que personne ne relit au bon moment n'est pas un gardien._ La fusion d'une proposition qui touche `prisma/migrations/` **écrit désormais elle-même l'avertissement** dans le résumé de son exécution, gratuitement, dans un job qui tourne déjà. **Le rappel se lit ou ne se lit pas ; la mesure rougit** : les deux, et ils sont indépendants.

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

**ET L'URL MÈNE ENFIN QUELQUE PART (11/09/2026).** Les deux gestes ci-dessus redirigent sur `/premier-acces` — écrit deux fois dans `lib/auth/amorcage.ts` depuis le 09/09. _Mesuré le 11/09 en suivant un lien réellement émis : cet écran n'existait pas, et la chaîne rendait **404**._ La conséquence n'était pas cosmétique : `pnpm db:seed` n'attribue aucun mot de passe — il n'en existe aucun tant qu'une personne n'en a pas choisi un —, si bien qu'**une base neuve n'avait aucune porte d'entrée, et rien ne le disait**. L'écran, sa route et `lib/auth/premier-acces.ts` existent désormais, et `tests/isolation/premier-acces.test.ts` traverse la chaîne entière : jeton émis → mot de passe choisi → connexion qui aboutit → jeton mort qui ne se rejoue pas.

**Le seed pose maintenant le moyen de connexion AU REPOS.** Il ne l'a jamais fait : mesuré le 11/09, `compte` portait **zéro ligne** après un seed, si bien que ni l'amorçage (« la société porte déjà des habilitations ») ni la réémission (« l'identité ne porte aucun moyen de connexion ») ne pouvaient servir les identités de démonstration. Chaque identité semée reçoit donc une ligne de `compte` à `mot_de_passe NULL` — **exactement l'état que l'amorçage laisse derrière lui** —, et la réémission sait s'en servir. _Aucun mot de passe n'entre au dépôt_ : il n'en existe aucun tant que personne n'en a choisi un, et le seed **s'abstient** dès qu'une ligne existe, le cliquet de D65 ne se rouvrant jamais.

**LE FLUX « Ouvrir le PREMIER compte » N'IMPRIME PLUS L'URL (12/09/2026).** Il l'imprimait, et il le disait en tête : _« elle entre dans le journal d'exécution, lisible par quiconque a accès en lecture à ce dépôt »_. Ce qui rendait cela acceptable était la condition _« le dépôt est PRIVÉ »_ — et cette condition tient à un **attribut du dépôt**, qui change d'un clic. **Le clic ne publie pas seulement l'avenir : il publie le passé**, jeton compris. Une garantie qui repose sur un attribut extérieur à la chose garantie n'en est pas une ; c'est la leçon d'É12 sur la planification nocturne, appliquée ici à un secret plutôt qu'à une alarme.

Le flux fait donc toujours le travail privilégié — ouvrir l'identité, ou réémettre — mais **il ne rend jamais l'URL** : elle est retirée de ce qui est imprimé, et masquée par surcroît. Les deux barrières ne se recouvrent pas et aucune ne remplace l'autre : le retrait garde, le masque rattrape un chemin qu'on n'aurait pas vu. `tests/unit/ci/url-hors-journal.test.ts` refuse le retour de la faute, et il fait **prononcer** l'expression d'expurgation sur une URL réellement formée plutôt que d'en comparer le texte.

**Le lien se récupère depuis un poste**, par la réémission ci-dessus, dont la sortie ne vit dans aucun journal. _Ce que cela coûte est écrit plutôt que tu_ : le geste n'est plus entièrement suivable depuis un téléphone — la moitié privilégiée l'est, la délivrance du lien demande un terminal. Le rendre de nouveau cliquable exige un canal **privé** ; Resend est à la pile (§2) mais n'est ni câblé ni doté d'un secret, et c'est un arbitrage d'exploitation, pas une décision de flux.

**Et « Amorcer une base » reçoit les deux mêmes barrières, pour une raison qui n'est pas la même.** Ce flux n'imprime aucun secret volontairement — un identifiant de société est un UUID de ligne, qui se relit en base. Ce qu'il peut imprimer **sans l'avoir voulu** en est un : le script relance toute erreur qu'il ne reconnaît pas, et le message brut d'un pilote nomme l'hébergeur et la région (D50). La faute a la même forme des deux côtés, et un gardien écrit pour un seul fichier laisse l'autre au premier ticket venu : `tests/unit/ci/url-hors-journal.test.ts` porte donc les deux flux dans sa population, et il éprouve l'expurgation de celui-ci sur une **chaîne de connexion**, que `https?://` ne reconnaîtrait pas.

**Sa condition de retrait est constatée par la machine :** `tests/unit/auth/amorcage-retrait.test.ts` échoue dès qu'un appel à `signUpEmail` apparaît hors du geste et hors des tests. Le jour où la porte principale s'ouvre, l'exception doit disparaître, et personne n'a à s'en souvenir.

## La documentation des machines — le chemin d'accès au modèle passe par la machine

`document` est une table métier cloisonnée dont la **cible est le modèle OU la machine, jamais les deux** : deux colonnes nullables et `num_nonnulls(modele_id, machine_id) = 1`, contrainte nommée, refusée par le schéma et non par une validation applicative (L8-01, D87). L'écran d'une machine affiche l'**union** de ses documents et de ceux de son modèle : aucune ligne n'est copiée, et corriger une notice la corrige partout (L8-02).

**La question que D87 avait laissée ouverte est tranchée par D93** : _un compte de portail ne voit les documents d'un modèle que si une machine de ce modèle se trouve dans son propre périmètre._ Sinon la présence d'une notice révèle la composition du parc des autres sites — un compte restreint à Ducos déduirait ce que Koné possède, et **le cloisonnement fuirait par la liste des documents au lieu de fuir par les données**. Ce n'est donc pas la forme du document qui change, c'est le chemin d'accès au modèle : machine → site → habilitation, jamais société → modèle.

Deux formes de politique en sortent, et ce sont des **arbitrages**, jamais des effets de bord :

- **« héritage »** sur `document` — la cible polymorphe est visible, et la classe `interne` disparaît pour un compte portail. La classe ne fait que retirer ; elle n'ouvre rien. Aucune clause de société n'y est écrite : elle serait une seconde source du même fait, la clé étrangère composite le tenant déjà.
- **« ascendance »** sur `modele_materiel` et `famille_materiel` — l'inverse exact de la filiation : un parent n'est visible, **pour un compte portail seul**, que si l'un de ses enfants l'est. Le discriminant est `app.client_id` ; un utilisateur interne garde la clause de société, sans quoi créer un modèle avant sa première machine serait impossible.

Les deux étages sont fermés **le même jour** : une famille « ponts élévateurs » visible dirait qu'il y a un pont quelque part.

**Le coût est nommé** : la documentation d'un matériel non recensé est inaccessible au client tant que le recensement n'est pas fait. **Et le coût d'exécution est mesuré, pas affirmé** — `EXPLAIN` sous contexte portail rend `hashed subplan` : le sous-plan est évalué une fois et haché, jamais par ligne. La mesure est rejouée à chaque `pnpm test:isolation`.

**Le bac de réception (L8-07) PROPOSE, il ne classe jamais seul.** Le rapprochement se fait sur la **clé** — le nom du fichier contient la référence d'un modèle ou le numéro de série d'une machine —, jamais sur une ressemblance : aucune distance d'édition, aucun score, aucun « probablement ». _Un rapprochement faux accroche la notice d'un compresseur à un pont élévateur, et personne ne le voit avant qu'un technicien suive la mauvaise procédure._ Ne rien proposer est une **issue**, pas un rejet. La **déduplication par empreinte** est tenue par l'index unique `(societe_id, empreinte)` et non par une lecture applicative : entre un `SELECT` et un `INSERT`, un second dépôt du même fichier passe — et le bac est justement l'endroit où l'on redépose, un téléversement depuis Nouméa se coupant. La **reprise** n'a aucune table de session : l'état de la reprise est l'état du bac, et il n'y a pas de travail partiel à sauvegarder.

**Et le bac a produit une treizième forme, « interne » (D94), qui n'était pas demandée.** Le bac nomme des fichiers — `notice-KPX-337.pdf` dit qu'un pont élévateur existe quelque part —, et une table de forme « société » est lisible par un compte portail. La fuite que D93 ferme par la porte principale rentrait par la porte de service, dans le ticket même. **D94 ferme la table qu'il crée et écrit ce qu'il laisse ouvert** : `taux_horaire`, `forfait`, `agence` posent la même question aujourd'hui, et la condition de réouverture est le jour où un écran de portail lit l'une d'elles.

**Ce que le lot 8 ne construit pas encore, et c'est écrit plutôt que tu** : le module de stockage, et l'écran du bac — c'est lui l'appelant qui rendra le stockage dû. `document.objet_cle` dit où sont les octets, et **aucun code ne la remplit** — une interface sans appelant est la maladie que le portail vient de soigner. `document` naît donc vide, et le rapport d'inventaire la nomme comme telle plutôt que de compter zéro contre zéro.

## Le registre des VGP — CODIPLAN n'affirme jamais la conformité

Les vérifications générales périodiques sont commandées par les **clients**, pas
par CODIMA : CODIMA ne les déclenche pas, ne les reçoit pas de droit, et
n'apprend leur résultat que si on le lui dit. **Tout le lot 9 découle de cette
phrase** (D88), et une conception qui l'oublierait produirait un registre qui
ment.

Trois conséquences, tenues par la base et non par une intention.

**Trois valeurs, jamais une case à cocher.** `a_determiner` est l'état de
naissance d'une famille de matériel, au même rang que les réponses. _Une case
décochée est indiscernable d'une famille jamais examinée_, et un pont élévateur
sortirait du registre en silence. Le `DEFAULT` de la colonne porte la règle :
rien n'a besoin de la demander.

**`soumis` exige sa périodicité ET le texte qui la fonde.** Sans le texte, la
périodicité est un chiffre que personne ne peut défendre. **Aucune durée n'est
écrite dans le code du lot** — ni seuil, ni tolérance, ni « en général » : la
Nouvelle-Calédonie a son propre code du travail, la solution sera vendue
ailleurs, et le §8 du CLAUDE.md interdit d'inventer un délai. Un gardien statique
le vérifie, avec sa liste close de conversions d'unité, adossée.

**« Sans information depuis X » n'est ni « à jour » ni « en retard ».** Le
danger que D88 nomme est qu'_un registre à moitié rempli ressemble à un registre
complet_ — c'est le zéro de `/sante` lu comme « installation vide », à l'échelle
d'un parc. `sans_information` est donc une valeur à part entière, distincte de
`hors_registre` : l'un dit « la question ne se pose pas ici », l'autre « elle se
pose et nous n'avons pas la réponse ». Le seul calcul du module est une **date**,
et il n'existe aucune fonction qui rende un verdict de conformité.

Voir [`lib/vgp/`](lib/vgp/), et les six scénarios de
`tests/isolation/vgp-assujettissement.test.ts`, chacun avec son jumeau.

**Le REGISTRE existe depuis le 12/09/2026** — `/vgp`, avec la liste des familles
« à déterminer » à un clic. [`lib/vgp/registre.ts`](lib/vgp/registre.ts) lit le
parc sous contexte cloisonné et résout la cascade ;
[`lib/vgp/libelles.ts`](lib/vgp/libelles.ts) est **le seul endroit où un état
d'information devient du texte**, et c'est ce qui rend la règle gardable : écrite
dans un composant, elle ne serait éprouvable que par un rendu, et le deuxième
écran du lot la réécrirait à sa façon sans qu'un test rougisse.

**Toutes les machines soumises s'affichent « sans information », et l'écran écrit
pourquoi** : rien n'enregistre encore ce qu'un organisme a dit — `document` porte
une classe et une cible, jamais une **nature**. _Ce n'est pas un défaut du
registre : c'est le registre qui dit vrai._ `L9-08`, `L9-09` et `L9-10` butent
tous les trois sur ce seul fait, et le chiffrent : le compteur qui descend de
L9-08 ne pourrait jamais descendre, et **un compteur figé est pire qu'une alerte
de trop, parce qu'il a l'air de mesurer**.

`tests/unit/vgp/aucun-verdict-de-conformite.test.ts` tient les deux moitiés —
aucun état ne prononce un verdict, aucun état ne sort sans sa date. Sa population
est **étroite exprès** : le sous-titre de l'écran dit « CODIPLAN n'affirme jamais
la conformité » et doit le dire ; _un gardien qui refuserait le mot partout
rougirait sur la phrase qui énonce la règle_, et on cesserait de le lire.

## La documentation d'une machine — l'union, et l'appelant qui manquait

Une machine montre **ses** documents **et ceux de son modèle** (L8-02). Aucune
ligne n'est copiée : _une notice accrochée au modèle apparaît sur ses cinq cents
exemplaires parce qu'elle est LUE depuis chacun_ — et le jour où le constructeur
la corrige, on corrige une ligne.

L'union vivait **uniquement dans un scénario d'isolation**, qui composait son
`where` à la main. Aucun module de `lib/` ne la portait, aucun écran ne
l'appelait : _le harnais armait une garantie que la production n'armait pas_,
la divergence de L1-02b avec l'aggravation qu'il n'existait pas deux
implémentations mais une seule, dans le test.
[`documentsDeLaMachine`](lib/documents/depot.ts) la porte, `/parc/[id]`
l'appelle, et le scénario emprunte ce chemin-là.

Elle **relit la machine** sous le même contexte plutôt que de recevoir son
`modele_id` : _une borne qui vit dans la bonne volonté de l'appelant n'en est pas
une_. Elle rend `null` pour une machine invisible et `[]` pour une machine sans
document — **les deux ne se corrigent pas au même endroit**. L'écran affiche
l'**origine** de chaque document en colonne : _supprimer une notice de modèle en
croyant nettoyer un exemplaire porterait sur cinq cents machines sans que rien ne
le dise._ Et **aucun lien de téléchargement** : `objet_cle` n'est remplie par
personne, et l'écran dit pourquoi plutôt que d'offrir un lien qui se lirait comme
une panne.

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

| Forme            | Clause                                                                                             | Exemple                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **identité**     | `id = app.societe_id`                                                                              | `societe` (D42)                                                                        |
| **société**      | `societe_id = app.societe_id`                                                                      | `agence`, `calendrier`                                                                 |
| **référentiel**  | lecture `true`, écriture `app_est_role_editeur()`                                                  | `devise`, `jour_ferie` (D4)                                                            |
| **parc**         | société **et** `app.client_id` **et** `app.perimetre_sites`                                        | `client`, `site`, `machine`, `contact` (D10, D22, L1-03)                               |
| **journal**      | `SELECT` habilité, `INSERT` seul                                                                   | `journal_audit` (I8)                                                                   |
| **habilitation** | société **et** ( pas de `app.client_id` **ou** sa propre ligne )                                   | `utilisateur_client`, `utilisateur_client_site` (L1-02b)                               |
| **désignation**  | la ligne que l'appelant nommait déjà, **plus** le rattachement à la société active                 | `utilisateur` (L1-02c), `session`, `compte`, `verification`, `second_facteur` (L1-02d) |
| **appartenance** | société pour tout le monde, **plus** sa propre ligne en `SELECT` SEUL                              | `utilisateur_societe` (D61)                                                            |
| **rattachement** | habilitation pour tout le monde, **plus** son propre rattachement en `SELECT` SEUL                 | `utilisateur_client` (D92)                                                             |
| **héritage**     | la CIBLE polymorphe est visible, **et** la classe RÉTRÉCIT                                         | `document` (D93)                                                                       |
| **ascendance**   | société pour tout le monde, **plus**, pour un compte portail SEUL, l'existence d'un ENFANT visible | `modele_materiel`, `famille_materiel` (D93)                                            |

La forme **« rattachement »** ferme la boucle que D10 avait laissée ouverte. D10
veut que « les deux tables soient exclusives » : un compte portail n'a **aucune**
ligne dans `utilisateur_societe`. Et `utilisateur_client` portait la forme
« habilitation », ancrée sur `app.societe_id`. Rien ne pouvait donc lui donner
une société, et sans société il ne lisait pas son propre rattachement. _Mesuré le
11/09/2026 sous `codiplan_app`, avec témoin — zéro société sans contexte :
identité seule → **0 ligne**, identité + société → 3, `utilisateur_societe` de ce
compte → **0**._ Les deux zéros ferment la boucle : **aucun compte portail
n'atteignait aucun écran**, et rien ne le disait — il n'existait pas d'écran de
portail pour buter dessus. Le coût est nommé, comme celui de D61 et de D67 : une
personne apprend la liste des clients auxquels elle est déjà rattachée ; ni leur
nom, ni leurs données, ni l'existence d'aucun autre. Et c'est la **commande** qui
la borne — `FOR SELECT`, qui n'accepte aucun `WITH CHECK` : la même branche en
écriture laisserait un compte se rattacher au client de son choix.

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

### ⚠ Les _Issues_ sont DÉSACTIVÉES sur ce dépôt — l'alarme d'É12 ne peut rien ouvrir

_Mesuré le 12/09/2026 à 05:59:13 UTC :_ `gh` répond **« the 'alexis97310/codiplan' repository has disabled issues »**, `list_issues` rend **0 issue / total 0**, et `pulls/133` rend **404** — donc **#133 était bien une issue** : elles ont existé, ont servi, et sont aujourd'hui désactivées.

**L'écart É12 est donc inopérant.** Il avait été fermé par la phrase _« une issue rend la question du courriel sans objet : elle vit DANS le dépôt »_, mesurée contre deux échecs nocturnes restés non lus dans une boîte le 20 août. Le canal est clos ; toute nuit rouge sonne dans le vide — la même pièce vide, sous un autre costume.

**Le sursis, et ce n'est pas une réparation** : l'alarme écrit son corps dans le **résumé de l'exécution** et en **annotation** _avant_ de tenter l'issue, puis rougit en nommant le geste. _Une alarme qui ne peut pas sonner doit le dire, et dire quand même ce qu'elle avait à dire._ Mais un résumé d'exécution **expire avec la rétention** ; une issue attend qu'on la lise.

**Le geste :** Settings → General → Features → cocher **Issues**. Voir **R3-07** au backlog.

### Qui voit une nuit rouge — deux alarmes, et la seconde garde la première

**Constaté, non supposé** : GitHub notifie bien par courriel l'échec d'une exécution, et les deux notifications d'échec du 20 août 2026 sont **restées non lues**. Pour un flux planifié, la notification part au dernier compte ayant modifié le `cron` — la même boîte. L'alarme sonnait, dans une pièce vide.

| Job                 | Répond à                                                                                                                                                                                          | Aveugle à                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `alarme-nuit-rouge` | **une nuit a-t-elle rougi ?** — une _issue_ s'ouvre dans le dépôt dès que `verify:full` échoue hors proposition de fusion. Une issue par épisode, pas une par nuit                                | une planification **arrêtée** : elle ne produit aucune exécution, donc aucun échec, donc aucune issue                                |
| `NOT VALID`         | **une règle qui ne vaut que pour une partie des lignes** — `pg_constraint.convalidated` confronté à `scripts/lib/contraintes-non-validees.ts`, gardé dans les trois sens (D104)                   | une contrainte non validée que personne n'a décidée, une entrée dont le rattrapage a eu lieu, une entrée qui ne s'adosse plus à rien |
| `deploiement`       | **la base déployée a-t-elle suivi le code déployé ?** — `pnpm deploiement:verifier` ouvre `/api/sante` en ligne après chaque fusion, chaque nuit et à la demande ; une _issue_ s'ouvre par nature | un écran cassé pour une AUTRE raison qu'une migration en retard — c'est R3-06, et il est bloqué sur un secret                        |
| `battement`         | **les nuits ont-elles cessé ?** — `pnpm battement` lit l'état du flux et l'âge de la dernière exécution planifiée                                                                                 | rien de ce que la première voit ; les deux sont indépendants dans les deux sens                                                      |

`battement` **ne tourne pas sur la planification**, et c'est tout son objet : un contrôle qui ne s'exécute que lorsque la planification s'exécute ne peut pas constater qu'elle a cessé. Il s'accroche à l'activité humaine — **poussée sur `main`**, c'est-à-dire chaque fusion, _mesuré 125 fois en septembre 2026_. Il a cessé de tourner sur les propositions le 12/09/2026 : **un job est facturé à la minute supérieure**, celui-ci met 23 secondes, et ses 159 exécutions de proposition coûtaient 159 minutes pour mesurer deux fois le même état à quelques minutes d'intervalle. Sa limite est écrite plutôt que tue : si personne ne pousse rien, il ne tourne pas davantage ; il garantit qu'**au premier retour de quelqu'un**, l'écran soit rouge.

### ⚠️ Avant de rendre ce dépôt public

La planification nocturne ne survit à l'inactivité **que parce que le dépôt est privé**. GitHub désactive automatiquement les flux planifiés après **60 jours** sans activité, et cette règle **ne vise que les dépôts publics** ; un fork la remet en vigueur lui aussi, les flux planifiés d'un dépôt forké étant désactivés par défaut.

La protection ne tient donc pas au fichier de flux : elle tient à un **attribut du dépôt**, qui change d'un clic et sans rien annoncer. C'est pourquoi la même mise en garde est écrite en tête de `.github/workflows/ci.yml` — là où quelqu'un qui change la visibilité la rencontrera —, et c'est le job `battement` qui rattrape le cas si elle est franchie quand même.

**Et la visibilité ne publie pas que le présent : elle publie LE PASSÉ.** Les journaux d'exécution déjà écrits deviennent lisibles le jour du clic, avec ce qu'ils portent. C'est ce qui a retiré au flux « Ouvrir le PREMIER compte » le droit d'imprimer son URL (voir plus haut), et c'est ce qu'il faut regarder avant de basculer :

| À vérifier avant le clic                                                                                                                                          | Où                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Aucune exécution passée ne porte un jeton dans son journal ou son résumé                                                                                          | onglet **Actions**, flux « Ouvrir le PREMIER compte » |
| Le courriel de l'auteur des commits devient public                                                                                                                | métadonnées git, 187 commits                          |
| `docs/arbitrages.md` et `docs/cahier-des-charges.md` portent le taux horaire, la doctrine de facturation, **et le modèle tarifaire et la marge** (§22.6 et §22.7) | sources de rang 1 et 5                                |
| `prisma/seed-data.ts` nomme quatre techniciens par leur patronyme                                                                                                 | jeu de démonstration                                  |

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
              captures.mts = les captures d'écran, prises par une COMMANDE et
              non à la main (10/09) — chaque écran porte un TÉMOIN lu sur le
              texte RENDU, et une image qui ne le porte pas est refusée plutôt
              que rangée sous un nom qu'elle dément
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
