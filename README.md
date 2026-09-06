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
six contrôles d'observation contre la **vraie** base : état RLS, formes de
politique, périmètre d'audit, ajout seul du journal, durcissement des partitions,
privilèges de consolidation.

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

### Et une troisième preuve : la FORME de la politique

Les deux précédentes disent que la sécurité est **activée** ; ni l'une ni
l'autre ne dit ce que la politique **laisse passer**. Une table peut porter les
deux drapeaux et une politique `USING (true)` : l'attribut est irréprochable et
le cloisonnement n'existe plus.

Il y a **cinq formes** en vigueur, et le ticket L0-04 n'en énonçait qu'une :

| Forme           | Clause                                                      | Exemple                                |
| --------------- | ----------------------------------------------------------- | -------------------------------------- |
| **identité**    | `id = app.societe_id`                                       | `societe` (D42)                        |
| **société**     | `societe_id = app.societe_id`                               | `agence`, `calendrier`                 |
| **référentiel** | lecture `true`, écriture `app_est_role_editeur()`           | `devise`, `jour_ferie` (D4)            |
| **parc**        | société **et** `app.client_id` **et** `app.perimetre_sites` | `client`, `site`, `machine` (D10, D22) |
| **journal**     | `SELECT` habilité, `INSERT` seul                            | `journal_audit` (I8)                   |

La forme **« référentiel » ne s'applique jamais à une table métier** : sa lecture
ouvre toutes les lignes à toutes les sociétés, et son écriture donne le droit au
salarié de l'éditeur en le retirant à la société propriétaire.

`scripts/lib/politiques-rls.ts` porte la règle, partagée par
`tests/isolation/politiques-rls.test.ts` et le contrôle de la base hébergée. Elle
est **mesurée dans `pg_policies`**, qui rend l'expression _analysée_ : la
graphie, l'enveloppe `DO $$ … $$`, la pose en deux temps et le nom assemblé à
l'exécution s'y dissolvent — c'est l'état final qui est lu.

### Le contrat des fixtures d'isolation

`site`, `machine` et `modele_materiel` existent comme **tables fixtures** du
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
lib/          auth/  calendar/  clients/  db/  i18n/  money/  reporting/  theme/
              utils.ts
              clients/ = référentiel client (L1-01) : saisie Zod, dépôt cloisonné,
              libellé du code externe paramétrable par société (D29)
              i18n/ = dictionnaire français + vocabulaire imposé (agence, site)
prisma/       schema.prisma, migrations/, seed.ts, seed-data.ts, seed-delais.ts
scripts/      inventaire, contrôle de cloisonnement (privilèges compris), horizon des fériés
tests/        unit/  isolation/  e2e/offline/   ← les trois derniers sont sanctuarisés
docs/         cahier des charges, arbitrages, backlog, décisions
```

Le domaine métier s'écrit en français (`intervention`, `machine`, `societe`, `agence`), le code technique en anglais (`createIntervention`, `useSyncQueue`). Jamais mélangés dans un même identifiant.

## État d'avancement

Lot 0 en cours. Faits : **L0-01** (initialisation du dépôt), **L0-02** (chaîne de vérification), **L0-03** à **L0-06c** (socle multi-société, RLS, tests d'isolation, authentification et rôles, `societe` cloisonnée par son identité), **L0-07** (module monétaire), **L0-08** (module calendrier), **L0-09a** (le territoire d'un jour férié référencé), **L0-09** (thématisation par société), **L0-10** (journal d'audit), **L0-11** (vocabulaire français centralisé) et **R0-a** (les formes de politique RLS, le contrat des fixtures d'isolation).

Lot 1 commencé : **L1-01** — la fiche `client`, première table métier. Elle porte
`societe_id NOT NULL` et la politique de forme **« parc »** (société **et**
`app.client_id`, D10/D22), jamais la clause société seule ; `code_externe` (D29)
est unique **par société** et son libellé d'affichage est paramétrable
(`societe.libelle_code_externe`). Le module applicatif est `lib/clients/`.

Et **D55** en est sorti : le périmètre d'audit de I8 est désormais **inversé** —
audité par défaut, exempté par écrit. `client` naissait hors périmètre non par
décision mais par omission, et c'est le sens de la liste qui était en cause, pas
son contenu.
