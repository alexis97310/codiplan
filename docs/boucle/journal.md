# Journal de la file de nuit — 12/09/2026

*Une entrée par ticket. Ce journal est relu commit par commit par l'arbitre du projet,
qui lit le dépôt directement : il est écrit **pour être vérifié**, jamais pour être cru.*

**Lieu de ce travail** : la branche `claude/vibrant-pasteur-hczbqx`, partie de `main`
à l'empreinte `461c9d1`. *Rien de ce journal n'affirme un état de `main` au-delà de
cette empreinte* (§8 du protocole de session).

## Le socle de mesure, avant tout ticket

| Ce qui a été fait | Ce qui a été mesuré |
|---|---|
| PostgreSQL 16 local démarré, bases `codiplan_test`, `codiplan_e2e`, `codiplan_mesure` | `pg_isready` → `accepting connections` |
| `pnpm install --frozen-lockfile` | **`read-excel-file` n'était pas installé** : `pnpm verify` échouait en `TS7006` sur `lib/excel/classeur.ts` avant toute modification de ma part. Ce n'est pas un défaut du dépôt, c'est un `node_modules` incomplet dans l'environnement de session. |
| `pnpm verify` | **EXIT=0**, 142 fichiers de tests, 1567 tests, `08:36:25 UTC` le 12/09/2026. |

> **CE VERT N'EST PAS UNE LIGNE DE BASE, ET JE LE DIS PLUTÔT QUE DE LE LAISSER CROIRE.**
> La seule exécution verte de cette session porte **déjà** les amendements de N-01 : les
> deux exécutions lancées avant eux ont échoué pour des raisons d'environnement — client
> Prisma périmé, puis `read-excel-file` absent — et quand l'environnement a été réparé,
> les amendements étaient écrits. **Je n'ai donc jamais mesuré `461c9d1` intact dans
> cette session**, et « c'était vert avant » ne s'écrit pas. Ce que je peux affirmer est
> plus étroit : `461c9d1` + les amendements de N-01 est vert. *Un vert mesuré à un
> endroit et annoncé pour un autre est un vert inventé* (§11 du protocole).

---

## N-01 — Le cahier des charges contredisait D109, D4 et D68

**Pourquoi en premier.** `L1-12` — la table `prestation` — est LIBRE dans la file. Née
en suivant le §7 du cahier des charges, elle serait née avec une colonne de **taux**,
c'est-à-dire un **second endroit où un prix s'écrit** — exactement ce que D109 interdit.
*Cinq minutes maintenant, une migration après.*

### Ce que j'ai mesuré

`grep -n "taux applicable\|Référentiel partageable\|surchargeable" docs/cahier-des-charges.md`
rend **quatre** emplacements, et non trois :

| Ancre de texte | Ce qu'il disait | Ce qui le contredit |
|---|---|---|
| `**Taux horaire.** Taux horaire de main-d'œuvre par défaut au niveau de la société` (§4.3) | un taux par défaut **sur la société**, « surchargeable par technicien, par type d'intervention et par contrat » | la colonne `societe.taux_horaire_defaut` est **retirée** (chapitre 11, ligne barrée du 09/09/2026) ; et `taux_horaire` porte `@@unique([societe_id, date_effet])` — **un taux par société et par date**, sans aucun axe de surcharge |
| `Référentiel partageable entre sociétés.` (§7, familles et modèles) | un référentiel de plateforme | **D4 amendé le 08/09/2026** : `societe_id NOT NULL`, tables métier cloisonnées, mécanisme « référentiel + copie masquante » **retiré** |
| `Catalogue des prestations (code, libellé, durée standard, taux applicable, …)` (§7) | une prestation porte un **taux** | **D109** : une prestation porte une **durée**, jamais un taux ; un prix fixe **désigne** un forfait |
| `\| Taux horaire \| 7 000 XPF par défaut pour CODIMA SAV, surchargeable et historisé \|` (tableau de synthèse final) | le même taux par défaut surchargeable | **D68** : 7 000 XPF **hors taxes**, et la mention « hors taxes » fait partie de la décision |

Le quatrième — le tableau de synthèse — n'était pas nommé dans la consigne. Il répétait
la même phrase fausse, et une phrase corrigée à un endroit sur deux est la moitié
manquante qui a la forme de la moitié faite (§9 du `CLAUDE.md`, 31/08).

### Ce que j'ai changé

Les quatre phrases sont **barrées et non effacées**, chacune suivie de la décision qui
l'amende, de sa date et de son motif — la convention déjà en vigueur dans ce document
(`RG-INT-07`, `RG-PLA-05`, `taux_horaire_defaut`, `reference_interne`). Rien d'autre du
cahier des charges n'a bougé.

**Ce que je n'ai PAS fait, et c'est délibéré** : je n'ai pas corrigé l'entrée
« Techniciens » du §7 (`coût horaire interne, taux de facturation par défaut`), qui
décrit elle aussi des colonnes qui n'existent pas. Elle n'est contredite par **aucune
décision écrite** — c'est une description de ce qui n'est pas encore construit, pas une
règle fausse. La barrer serait inventer un arbitrage.

### Message d'échec initial

**Aucun** — et c'est la nature de ce ticket. Rien dans le dépôt ne confronte le §7 et le
§4.3 au chapitre 11 : le gardien de câblage (`tests/unit/docs/cablage-arbitrages.test.ts`)
confronte les arbitrages aux règles du **chapitre 10**, et ces quatre phrases sont du
narratif — rang 5, jamais normatif. *C'est précisément pour cela qu'elles ont survécu
trois jours après les décisions qui les tuaient.* Le défaut n'était pas détectable par
une porte ; il était détectable par une lecture, et c'est ce que la consigne a fait.

### Vert mesuré

`pnpm verify` → **EXIT=0**, 1567 tests, le 12/09/2026 à `08:36:25 UTC`.

## N-02 — Le lot 8 : cinq tickets étaient faits et disaient le contraire, un seul manquait

### Ce que j'ai mesuré AVANT d'écrire une ligne

`pnpm file` ne désignait pas L8-01 : il désignait **L3-04a**. Les six tickets du lot 8
portaient `LIBRE` **alors que le paragraphe de tête du lot, dans le même document, dit
« LE SOCLE DE DONNÉES EST CONSTRUIT le 13/09/2026 — L8-01 à L8-06 »**. Deux affirmations
contradictoires à trois paragraphes d'écart, et `pnpm file` lit la seconde.

Mesure ticket par ticket, contre le schéma et les scénarios — jamais contre le texte :

| Ticket | Acceptation | Ce que j'ai trouvé |
|---|---|---|
| L8-01 | contrainte nommée, jumeau | `document_cible_unique` posée ; `tests/isolation/document.test.ts` porte les deux refus **et** le jumeau qui la retire et compte la ligne écrite |
| L8-02 | l'union, sans copie | **la seule moitié réellement manquante** — voir ci-dessous |
| L8-03 | toute valeur hors des deux refusée par la base | `enum ClasseDocument { client, interne }` au schéma |
| L8-04 | héritage, ascendance, listes closes | les deux formes de D93 posées, gardées par `TABLES_HERITAGE` et `TABLES_ASCENDANCE` |
| L8-05 | aucune colonne binaire | `objet_cle text` et rien d'autre ; la région est une consigne de `docs/mise-en-ligne.md` |
| L8-06 | deux dates nullables, non lues, et c'est écrit | `date_document` et `date_expiration`, `@db.Date`, avec le commentaire qui dit pourquoi |

### Le défaut réel, et il n'était pas là où le marqueur le disait

L'union de L8-02 **existait, et seulement dans le scénario d'isolation** : le bloc
`describe("L'UNION de L8-02…")` composait son `where` à la main —
`OR: [{ machine_id }, { modele_id }]` — et il était vert. **Aucun module de `lib/` ne
portait cette lecture, et aucun écran ne l'appelait.**

*C'est mot pour mot la divergence de L1-02b inscrite au §9 du `CLAUDE.md` : « les
scénarios étaient verts parce que le HARNAIS armait une garantie que la PRODUCTION
n'armait pas ».* Ici, avec une aggravation : il n'y avait pas deux implémentations qui
pouvaient diverger — **il n'y en avait qu'une, et elle était dans le test.**

### Ce que j'ai changé

- `lib/documents/depot.ts` → **`documentsDeLaMachine`**. La machine est **relue sous le
  même contexte** plutôt que son `modele_id` reçu en argument : *une borne qui vit dans
  la bonne volonté de l'appelant n'en est pas une* (L1-02e). Elle rend `null` pour une
  machine invisible et `[]` pour une machine sans document — **les deux ne se corrigent
  pas au même endroit**. L'`origine` est **déduite** de la colonne renseignée, jamais
  stockée : `document_cible_unique` garantit qu'il y en a une et une seule.
- `lib/machines/depot.ts` → **`lireMachine`**. Une fiche hors périmètre et une fiche
  inexistante rendent la même chose : les distinguer ferait un oracle (D35, D50).
- **`app/(back-office)/parc/[id]/page.tsx`** — l'appelant qui manquait. La référence de
  chaque ligne du parc y mène. L'**origine est une colonne**, pas une nuance de gris :
  *supprimer une notice de modèle en croyant nettoyer un exemplaire porterait sur cinq
  cents machines sans que rien ne le dise.* **Aucun lien de téléchargement** — `objet_cle`
  n'est remplie par personne, et l'écran dit en une ligne pourquoi il n'y en a pas
  plutôt que d'offrir un lien qui se lirait comme une panne.
- Le scénario d'isolation **appelle désormais `documentsDeLaMachine`** au lieu de
  composer son `where`, et reçoit `clientApp()` par le paramètre `client?` — le même
  chemin que `lib/absences/depot.ts` ouvre à ses scénarios.

### Messages d'échec initiaux, mesurés en cassant réellement le code

Deux cas, chacun cassé puis restauré :

```
# 1 — l'union amputée de la branche « modèle »
FAIL tests/isolation/document.test.ts > L'UNION de L8-02 >
     l'écran d'une machine voit ses documents ET ceux de son modèle
AssertionError: expected [ Array(1) ] to deeply equal [ …(2) ]

# 2 — la machine invisible rendant [] au lieu de null
FAIL tests/isolation/document.test.ts > L'UNION de L8-02 >
     une machine HORS PÉRIMÈTRE rend `null`, jamais une liste vide
AssertionError: expected [] to be null
```

**Et la première tentative de casser le second cas n'a RIEN cassé** : mon `sed` visait
une indentation que Prettier venait de changer, la substitution n'a pas eu lieu, et la
suite est restée verte — *19 passed*. J'ai failli l'écrire comme une mesure. C'est le §9
du 30/08 en miniature : **vérifier que la violation a bien eu lieu**, et le seul moyen
est de relire le fichier cassé, jamais de croire la commande qui l'a cassé.

### Ce que je n'ai PAS fait

**Aucune migration.** Le socle existe ; ce ticket n'ajoute pas une colonne. Le §12 ne
s'applique donc pas à N-02 — *et je l'écris plutôt que de laisser l'absence de geste
passer pour un oubli.*

**Aucun module de stockage.** Il n'a toujours pas d'appelant : l'écran affiche des
fiches, pas des octets. C'est le refus que l'exploitation a ratifié le 13/09/2026 (§3 du
protocole), et il tient encore.

### Vert mesuré

`pnpm verify` → **EXIT=0**, 1567 tests unitaires + 762 tests d'isolation, le 12/09/2026
à `08:50:37 UTC`, sur la branche `claude/vibrant-pasteur-hczbqx`.

## N-03 — Le lot 9 : le registre existe désormais, et trois tickets butent sur UN seul fait

### Ce que j'ai mesuré AVANT d'écrire une ligne

Même défaut qu'au lot 8, et dans les deux sens cette fois. Le paragraphe de tête du lot
dit « LA COLONNE VERTÉBRALE EST CONSTRUITE le 12/09/2026 — L9-03, L9-04, L9-05, L9-06 et
L9-07 », et les cinq portaient `LIBRE`. À l'inverse, **L9-11 portait `LIBRE` et ne
pouvait pas l'être**.

| Ticket | Mesure |
|---|---|
| L9-03 | `tests/isolation/vgp-assujettissement.test.ts` porte « la naissance est `a_determiner`, et personne ne l'a demandée ». **La seconde moitié manquait** — *« la liste des indéterminés est atteignable en un clic depuis le registre »*, et il n'y avait pas de registre. |
| L9-04 | scénario « la base REFUSE `soumis` sans sa base » |
| L9-05 | `tests/unit/vgp/aucune-duree-en-dur.test.ts` |
| L9-06 | scénario « une exception sans sa raison est refusée par la base » |
| L9-07 | scénario « ces colonnes sont AUDITÉES sans qu'on l'ait demandé » |
| L9-11 | `lib/sync/` est marqué `(prévu)` au §6 du `CLAUDE.md` ; `ls lib/sync` → **No such file or directory**. L3-07 et L3-08 sont eux-mêmes `BLOQUÉ`. Marqueur corrigé en `BLOQUÉ`, avec ce motif. |

### Ce que j'ai construit — L9-02 et la seconde moitié de L9-03

- **`lib/vgp/registre.ts`** — la lecture. La cascade de `resoudreAssujettissement` et
  l'état de `etatDeLInformation` existaient tous deux depuis le 12/09 **sans appelant** ;
  ce module leur en donne un. `aujourdHui` est **reçu**, jamais lu — D85.
- **`lib/vgp/libelles.ts`** — **le seul endroit où un état devient du texte**, et c'est
  ce qui rend L9-02 gardable. Écrite dans le composant, la règle n'aurait été éprouvable
  que par un rendu, et le deuxième écran du lot l'aurait réécrite à sa façon *sans qu'un
  test rougisse* (§9, 01/09).
- **`/vgp`** — le registre, et **`/vgp/a-determiner`** — la liste des familles que
  personne n'a examinées, atteinte par un lien qui porte son compte. *Sans elle, la
  troisième valeur ne sert à rien* (D88 §3).
- Ni l'un ni l'autre n'est une entrée de la barre : elle est **close et confrontée à la
  maquette** (D95), qui ne porte aucune entrée « VGP ». Une douzième la ferait rougir à
  raison. Le registre se rejoint depuis le parc, comme l'écran des lieux.

### Ce que l'écran dit de lui-même, et c'est le cœur de D88

**Toutes les machines soumises s'affichent « sans information »**, et l'écran écrit
pourquoi en toutes lettres : rien n'enregistre encore ce qu'un organisme a dit. *Ce n'est
pas un défaut du registre, c'est le registre qui dit vrai* — le danger que D88 nomme est
l'inverse, *un registre à moitié rempli qui ressemble à un registre complet*.

### Le gardien, et son message d'échec initial mesuré

`tests/unit/vgp/aucun-verdict-de-conformite.test.ts` tient deux comportements : **aucun
état ne prononce un verdict**, **aucun état ne sort sans sa date**. Éprouvé en
remplaçant réellement un libellé par « Conforme » :

```
FAIL tests/unit/vgp/aucun-verdict-de-conformite.test.ts >
     « vgp.information.recue » ne dit ni conforme, ni à jour, ni en retard
AssertionError: expected 'conforme' not to contain 'conforme'
```

**Sa population est étroite exprès**, et c'est la leçon du §9 du 11/09. Le sous-titre de
l'écran dit *« CODIPLAN n'affirme jamais la conformité »* — et il doit le dire. Un gardien
qui refuserait le mot partout rougirait **sur la phrase qui énonce la règle**. La
population est donc `vgp.information.*` et `vgp.regime.*`, dérivée du dictionnaire, avec
un cas qui **doit rester vert pour sa propre raison** : le sous-titre contient le mot, et
il n'est pas dans la population.

### Les trois derniers tickets butent sur UN fait, et je ne l'ai pas inventé

L9-08, L9-09 et L9-10 supposent tous qu'une information reçue d'un organisme soit
enregistrable. **Elle ne l'est pas** : `document` porte une classe et une cible, jamais
une **nature**, et aucune table ne porte de date de vérification.

*Le compteur qui descend de L9-08 ne pourrait donc jamais descendre* — et **un compteur
figé est pire qu'une alerte de trop, parce qu'il a l'air de mesurer**. Les trois sont
marqués `BLOQUÉ` avec cette mesure, et la question part à Alexis : le §1 du protocole lui
réserve **une obligation légale**, et il nomme les VGP. Voir Q4.

### Le rouge que j'ai réparé du premier coup

```
app/(back-office)/vgp/page.tsx
  179:46  error  Strings not allowed in JSX files: "·"  react/jsx-no-literals
```

Un séparateur `·` écrit dans le JSX. La règle a raison : *aucune chaîne en dur dans un
composant* (§5), et un séparateur en est une. La composition est remontée dans une
fonction.

### Vert mesuré

`pnpm verify` → **EXIT=0**, 1582 tests unitaires + 762 d'isolation, le 12/09/2026 à
`09:05:41 UTC`. *Cette exécution portait aussi N-04a* (voir ci-dessous) : les deux
travaux sont dans deux commits distincts, la mesure est commune, et je l'écris plutôt que
de l'annoncer deux fois comme si elle avait été jouée deux fois.

## N-04a — `minutesHorsOuvertureTechnicien` : écartée par D108, et dite écartée

### Ce que j'ai mesuré

```
grep -rn "minutesHorsOuvertureTechnicien" lib/ app/ tests/ scripts/ components/
  lib/calendar/index.ts:103            ← réexportation
  lib/calendar/usages.ts:82            ← la définition
  tests/unit/calendar/usages.test.ts   ← deux appels
```

**Aucun appelant applicatif**, et la réexportation ne servait qu'au scénario.

### Pourquoi ce n'est pas un oubli

D108 : *« LA MAJORATION PAIE LA CONTRAINTE D'UN CRÉNEAU POSÉ HORS OUVERTURE, PAS LES
MINUTES EFFECTIVEMENT TRAVAILLÉES. »* Cette fonction prend un `debut` et une `fin` — les
bornes de ce qui a été **fait** — et rend des minutes : **c'est l'issue (b) que D108 a
écartée**, parce qu'elle exigeait une hypothèse invérifiable. Ce qui calcule la
majoration est `lib/tarification/majoration.ts`, et il lit le **créneau**.

### Ce que j'ai changé

- L'en-tête porte l'ancienne phrase **barrée**, puis la décision, sa date, l'issue
  écartée et **la condition de réouverture de D108** — *le jour où `intervention` porte
  l'heure réelle de début et de fin*. Elle n'est donc pas morte : elle est **en attente
  d'une donnée qui n'existe pas.**
- **La réexportation de `lib/calendar/index.ts` est retirée.** Le scénario l'importe
  désormais depuis `@/lib/calendar/usages`. *Une fonction écartée qui reste sur la façade
  d'un module est une invitation* : le prochain appelant pressé la trouve par
  autocomplétion et ne lit pas l'en-tête.
- Les deux scénarios qui l'exercent portent **`FONCTION ÉCARTÉE PAR D108`** dans leur
  titre, en tête. Ils continuent d'éprouver D13 — le bon calendrier de référence — et ils
  disent maintenant qu'ils n'éprouvent rien qui soit appelé.

### Message d'échec initial

**Aucun, et c'est la nature du travail.** Rien ne rougissait : une fonction sans appelant
ne casse rien, et c'est exactement pourquoi elle pouvait rester là indéfiniment en
paraissant utile. Ce que le travail supprime n'est pas un défaut, c'est un **piège**.

### Vert mesuré

`pnpm verify` → **EXIT=0**, le 12/09/2026 à `09:05:41 UTC` — la même exécution que N-03.

## N-04b — D6 : l'unicité de `reference_interne` est posée

### Le dénombrement, AVANT la migration — et c'est une ABSENCE DE MESURE

```sql
-- base de démonstration, migrée et semée le 12/09/2026
machine                          → 0
reference_interne IS NOT NULL    → 0
clés (societe_id, réf) en double → 0
```

**Zéro sur zéro n'est pas un résultat** (§4 du protocole). La table est **vide** : ce
dénombrement ne dit rien de la base qui compte. Je l'écris comme une absence de mesure et
non comme un vert.

Ce que je peux ajouter sans l'avoir mesuré, et je le dis : le registre d'arbitrages porte
*« la base hébergée ne porte aucune machine (inventaire n° 37) »*. **Je le cite** — une
session ne touche pas la base de production.

**Témoin que la mesure n'était pas aveugle** : `SELECT rolsuper FROM pg_roles WHERE
rolname = current_user` rend `t`. Un superutilisateur contourne RLS ; sans ce témoin, un
zéro sous `FORCE ROW LEVEL SECURITY` aurait eu la même allure (§9, 07/09).

### Ce que j'ai changé

`prisma/migrations/20260913200000_reference_interne_unique_d6` :

```sql
CREATE UNIQUE INDEX "machine_societe_reference_interne_key"
    ON "machine" ("societe_id", "reference_interne")
 WHERE "reference_interne" IS NOT NULL;
```

**L'index est PARTIEL, et il est donc en SQL et non dans `schema.prisma`.** Un `@@unique`
accepterait autant de `NULL` qu'on veut — ce qui n'est pas faux, deux `NULL` étant
distincts pour un index unique — mais **il ne dirait pas la règle** : « lorsqu'elle est
présente » est la moitié qui compte, toutes les machines n'ayant pas de référence interne.
Le schéma porte un commentaire qui dit où l'index vit et pourquoi.

Le **bloc de garde** lève `FORCE ROW LEVEL SECURITY` sur `machine`, **refuse de compter
tant que la levée n'est pas constatée**, et rend le refus LISIBLE plutôt que de laisser
une violation de clé brute. Sans la levée, le rôle de migration — propriétaire non
superutilisateur sur la base hébergée — verrait zéro ligne et ne refuserait rien.

### D104 NE S'APPLIQUE PAS, et ce n'est pas un choix

**PostgreSQL n'admet `NOT VALID` que sur `CHECK` et `FOREIGN KEY`.** Un index unique se
construit sur toutes les lignes ou ne se construit pas : il n'existe pas d'état non
validé à rendre visible, et rien à inscrire dans `CONTRAINTES_NON_VALIDEES`. **La
conséquence est nommée** : si la base visée portait des doublons, la migration
ÉCHOUERAIT. C'est le bon sens de défaillance — bruyant, réparable par `pnpm db:resoudre`,
jamais silencieux.

### Messages d'échec initiaux, tous mesurés

```
# 1 — le scénario, écrit avant la colonne manquante dans l'INSERT
Raw query failed. Code: `42601`. Message: `ERROR: INSERT has more target columns
than expressions`

# 2 — le refus obtenu, mais Prisma ne rend PAS le nom de l'index
AssertionError: expected 'PrismaClientKnownRequestError: …' to contain
'machine_societe_reference_interne_key'
   → reçu : Code: `23505` … Key (societe_id, reference_interne)=(…) already exists

# 3 — le gardien du rejeu sur base âgée, et il avait raison
AssertionError: 20260913200000_reference_interne_unique_d6 resserre « machine »
et la table est VIDE : la migration ne serait éprouvée contre rien.
```

Le **deuxième** a changé la forme du scénario plutôt que son exigence. §9 du 24/08 :
*l'assertion NOMME la contrainte, sans quoi un refus venu d'ailleurs passe pour le bon.*
Prisma masquant le nom sur un `$executeRawUnsafe`, le **couple de colonnes** tient ce
rôle — **et un second scénario prouve qu'il le tient** : un seul index unique de `machine`
porte exactement `(societe_id, reference_interne)`. *Assertion et témoin ensemble disent
ce que le nom aurait dit seul ; l'un sans l'autre ne le dirait pas.*

Le **troisième** a demandé une amorce de base vieillie — quatre machines, dont **deux
sans référence interne**. Ces deux-là ne sont pas décoratives : *sans elles, un index NON
partiel passerait aussi, et le rejeu ne dirait pas ce qu'on croit qu'il dit.*

### Vert mesuré

`pnpm verify` → **EXIT=0**, 1589 tests unitaires + 767 d'isolation, le 12/09/2026 à
`09:25:26 UTC`.

## N-05 — R3-02 : le dénombrement est fait, et il ne répare rien

### Ce que j'ai construit

`pnpm suspensions:denombrer` — `scripts/denombrer-suspensions.mts` et
`scripts/lib/suspensions-anterieures.ts`. **Il compte, il n'écrit rien** : ni `UPDATE`,
ni `VALIDATE CONSTRAINT`, ni motif générique. *Ce dernier serait exactement l'issue (a)
que D104 a écartée, reprise par la porte de service — et elle porterait cette fois sur
des données réelles.*

### Le chiffre, mesuré

Sur la base de **démonstration**, migrée et semée le 12/09/2026 :

```
  interventions au total   : 32
  au statut « suspendue »  : 2
  SANS MOTIF               : 0
  SANS DATE                : 0
  résidus hors suspension  : 0
```

**La population n'est pas vide** — 32 interventions, dont 2 suspendues : le zéro est une
mesure, pas une absence. Et le témoin de lecture est imprimé avec le compte : rôle
`postgres`, superutilisateur, `FORCE` actif sur `intervention`.

### ET CE ZÉRO NE VEUT PAS DIRE « C'EST FAIT » — c'est la mesure qui compte le plus

**Une base bâtie depuis zéro par `prisma migrate deploy` ne PEUT pas porter de
violation** : la contrainte y précède la première ligne. Mesuré, et c'est ce qui l'a
établi — j'ai tenté de fabriquer une ligne fautive :

```sql
BEGIN;
UPDATE intervention SET motif_suspension = NULL WHERE statut = 'suspendue';
-- ERROR: new row for relation "intervention" violates check constraint
--        "intervention_suspension_a_son_motif"
ROLLBACK;
```

`NOT VALID` vaut pour toute ligne **nouvelle ou modifiée** : elle refuse. **Le seul
chiffre qui décide du coût du rattrapage est celui d'une base qui portait déjà des
interventions `suspendue` AVANT la migration `20260913160000_suspension_l2_10`** — et une
session ne touche pas la base de production (§2 du protocole). Le script est versionné
pour qu'Alexis puisse le jouer là où ce chiffre existe.

*Le rapport porte cette phrase en toutes lettres.* Sans elle, un zéro se lirait comme une
absence de dette, et c'est le §9 du 06/09 : **un chiffre juste qui fait conclure faux.**

### Les deux colonnes sont comptées SÉPARÉMENT

Elles ne se rattrapent pas pareil : `suspendue_le` se reprend depuis le journal d'audit
(I8), `motif_suspension` ne se reprend pas du tout. *Un total unique ferait croire à un
seul travail, et ferait chiffrer le plus cher au prix du moins cher.*

Et **les deux sens de l'équivalence sont comptés**. Les `CHECK` de D104 sont des
équivalences — `(statut = 'suspendue') = (colonne IS NOT NULL)` — et non des
implications : une ligne **non suspendue qui porte un motif** les viole autant. *Ne
compter que le second sens rendrait un chiffre trop bas, et il aurait l'air juste.*

### Le refus de compter, et pourquoi il est nécessaire

`intervention` est sous `FORCE ROW LEVEL SECURITY`. Un rôle **propriétaire non
superutilisateur** — l'état réel du rôle de migration sur la base hébergée — sans contexte
de société verrait **zéro ligne**. Le script **refuse** dans ce cas plutôt que de rendre
un zéro creux : *« il n'y a rien à rattraper » et « je ne vois rien » rendent le même
zéro.* Le témoin porte sur le **mécanisme**, jamais sur un décompte.

### Message d'échec initial

**Aucun test ne rougissait avant** : il n'y avait rien à faire rougir, le chiffre
n'existait pas. `tests/unit/db/denombrement-suspensions.test.ts` garde désormais les
parties pures — le refus de compter sous `FORCE`, les deux sens de l'équivalence, et le
fait que le rapport **dit ce qu'un zéro ne veut pas dire**.

### CE QUE JE N'AI PAS FAIT

**Rien réparé.** R3-02 reste `BLOQUÉ`, et son motif n'a pas bougé : *le motif d'une
suspension est une donnée que seul l'exploitant peut énoncer, ligne par ligne.* Le ticket
s'arrête au chiffre, comme la consigne le demande.

### Vert mesuré

`pnpm verify` → **EXIT=0**, le 12/09/2026 à `09:25:26 UTC` — la même exécution que N-04b.

## N-04c — D8 : `envoyee` devient `affectee`, et le mot était AFFICHÉ

### Ce que j'ai mesuré

```
grep -rn "envoyee" --include=*.ts --include=*.tsx --include=*.prisma --include=*.sql .
  prisma/migrations/20260909200000_intervention_l2_planning/migration.sql:24
  prisma/schema.prisma:1691
  prisma/seed-data.ts:1391
  lib/theme/statuts.ts:60, 76, 97
  lib/interventions/saisie.ts:60
  lib/interventions/statistiques.ts:75
  lib/i18n/fr.ts:694          ← « Envoyée », LU PAR UN HUMAIN
  tests/unit/interventions/suspension.test.ts:31
  tests/unit/interventions/cycle-de-vie.test.ts:34
```

D8 écrit, depuis le 19/08/2026 : *« `ENVOYEE` est renommé `AFFECTEE` (voir 3.6) : le mot
décrivait mal l'état. »* **La décision avait vingt-quatre jours et le schéma ne l'avait
jamais suivie** — et le mot faux était à l'écran. *Une décision qui prescrit une
réécriture ailleurs qu'où elle s'écrit n'est prise qu'à moitié* (§9, 31/08).

### Pourquoi le mot compte, et ce n'est pas de l'esthétique

« Envoyée » décrit un **envoi** — un message parti vers quelqu'un. L'état décrit une
intervention **dont le technicien est désigné** : une **affectation**, et c'est ce que le
planificateur fait à l'écran. Le mot faux entretenait l'idée qu'une notification part à
ce moment-là ; **rien n'en envoie**, et la passerelle SMS n'existe pas (cahier des
charges, synthèse : *« Passerelle SMS — Aucune »*).

### Ce que j'ai mesuré AVANT la migration, et qui aurait pu casser en silence

`ALTER TYPE … RENAME VALUE` conserve l'OID : aucune ligne n'est réécrite. **Mais il ne
suit PAS un littéral écrit dans un corps de fonction, une contrainte ou une politique.**
Trois requêtes, et les trois rendent **zéro ligne** :

```sql
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND prosrc LIKE '%envoyee%';          -- 0
SELECT conname FROM pg_constraint
 WHERE pg_get_constraintdef(oid) LIKE '%envoyee%';                 -- 0
SELECT policyname FROM pg_policies
 WHERE qual LIKE '%envoyee%' OR with_check LIKE '%envoyee%';       -- 0
```

Elles sont recopiées dans la migration **pour qu'on puisse les rejouer plutôt que me
croire.** C'est le seul endroit où le renommage aurait pu casser sans rien dire.

*Mesuré aussi* : le renommage s'exécute **dans une transaction** sous PostgreSQL 16, ce
qui est nécessaire — Prisma joue chaque migration dans une transaction implicite.

### Un écart avec la maquette, nommé plutôt que tu

`docs/maquette/CODIPLAN_Maquette.html` écrit **« Envoyée » quatre fois**. D95 lui donne
foi **sur la disposition et sur les couleurs** — un libellé de statut n'est ni l'une ni
les autres, et D8 est de rang 1 sur l'énumération elle-même. *Aucun gardien ne confronte
les libellés de statut à la maquette* (mesuré : les trois gardiens qui la lisent portent
sur les jetons de couleur, les entrées de barre et l'unicité du fichier). **Il n'y a donc
pas de contradiction mécanique à résoudre, mais un écart de prose à signaler**, et je le
signale ici plutôt que de le laisser découvrir.

### Message d'échec initial

**Aucun** : rien ne confrontait l'énumération de la base au texte de D8. C'est le défaut
type du §9 du 31/08 — la moitié manquante a la forme de la moitié faite —, et il se
corrige par une lecture, pas par une porte.

### Vert mesuré

`pnpm verify` → **EXIT=0**, 1589 tests unitaires + 767 d'isolation, le 12/09/2026 à
`09:33:25 UTC`.

## N-04d — D8 : `statut_facturation`, le second axe qui n'existait nulle part

### Ce que j'ai mesuré

```
grep -rn "statut_facturation\|StatutFacturation" prisma/ lib/
  (aucun résultat)
docs/cahier-des-charges.md:943  | statut_facturation | enum | non_facturable, a_facturer, facturee |
docs/backlog.md:505             « statut_facturation est une colonne DISTINCTE »
```

**La première moitié de D8 était faite** — `statut` porte bien huit valeurs, sans
`A_FACTURER` ni `FACTUREE`. **La seconde ne l'était pas** : la colonne est au chapitre 11
depuis l'origine, et rien ne la portait.

### Ce que D8 dit, et ce que j'ai appliqué SANS RIEN AJOUTER

> `statut_facturation` passe à `a_facturer` automatiquement à l'entrée en `CLOTUREE`,
> sauf si le type est `garantie`, `recensement` ou si l'intervention est couverte par un
> contrat forfaitaire — auquel cas `non_facturable`.

- **Les trois valeurs sont celles du chapitre 11, mot pour mot.**
- **Deux exemptions sur trois sont vivantes** : `TypeIntervention` porte `garantie` et
  `recensement` (mesuré au schéma). La troisième — *« couverte par un contrat
  forfaitaire »* — est **écrite dans le déclencheur et INERTE** : aucune table `contrat`
  n'existe, `intervention` ne porte pas de `contrat_id`. *La règle est écrite entière
  pour n'avoir pas à rouvrir la fonction ce jour-là* — le traitement du troisième axe de
  `forfaits.ts`.
- **La règle vit dans un déclencheur, pas en TypeScript.** D8 dit « automatiquement » :
  écrite dans un dépôt applicatif, elle serait hors d'un `UPDATE` direct, d'un import,
  d'une reprise ; écrite des deux côtés, elle serait **deux lectures d'un même critère**
  — dans l'endroit qui décide si un client est facturé.
- **Le nom place le déclencheur entre les deux autres** :
  `intervention_cycle_de_vie` < `intervention_facturation_a_la_cloture` <
  `intervention_sortie_de_suspension`. *Une transition refusée n'a jamais rien écrit.*

### LÀ OÙ D8 EST MUETTE, et ce que j'ai décidé plutôt qu'inventé

**D8 ne dit pas ce que vaut la colonne AVANT la clôture.** Et aucune des trois valeurs ne
porte « pas encore décidé » : naître `a_facturer` ferait entrer toute intervention non
clôturée dans la file de ce qui est à facturer ; naître `non_facturable` confondrait
**« pas encore »** et **« jamais »** — et `non_facturable` est précisément la valeur que
les exemptions visent.

La colonne est donc **nullable**, et `NULL` porte cette quatrième réponse **sans toucher
à l'énumération close** : *ajouter une quatrième valeur serait un changement de schéma
touchant les statuts d'intervention*, que le §8 range parmi les points d'arrêt. La
doctrine d'arbitrage §3 couvre exactement ce cas — *une nouvelle ligne ne naît jamais sur
la réponse négative* —, ce qui en fait une décision de session et non un ticket.
**Condition de réouverture** : *le jour où un écran doit distinguer « pas encore décidé »
d'une valeur absente pour une autre raison.*

### Trois messages d'échec initiaux, tous mesurés

```
# 1 — mon scénario de RÉOUVERTURE ne peut pas exister
Code: `23514`. ERROR: Intervention clôturée : elle ne se modifie plus sans trace.
Seule l'annulation reste possible (I5 donne à ANNULEE la préséance sur CLOTUREE).

# 2 — l'exemption « garantie » mesurée sur la mauvaise ligne
ERROR: Clôture refusée : le temps réel n'est pas saisi. (RG-TAR-05, D83)

# 3 — l'alarme de dérive des NOT VALID, et elle avait raison
AssertionError: expected [ …(3) ] to have a length of 2 but got 3
```

Le **premier** a corrigé le scénario plutôt que le code : `cloturee` est **terminal**, et
la base le tient. La garde `statut_facturation IS NULL` ne protège donc **pas** d'une
réouverture — elle protège d'un autre chemin : un retour de facturation, un import, une
correction posant la valeur avant la clôture. *Écrire l'inverse aurait donné un scénario
vert sur une hypothèse fausse.*

Le **deuxième** est le §9 du 24/08 en acte : mon `UPDATE` avait changé le type sur une
autre ligne que celle que je clôturais, et le refus venait d'ailleurs. La fixture
renseigne désormais `temps_reel_min` pour que **seul** le verrou visé puisse parler.

### Le troisième, et il méritait mieux qu'un chiffre augmenté

`tests/unit/db/contraintes-non-validees.test.ts` exigeait **exactement deux** entrées.
J'en ajoute une troisième : *une clôture porte une réponse*, posée `NOT VALID` parce que
**les interventions déjà clôturées n'en ont pas** et que **la colonne qui dirait
lesquelles ont été facturées n'existe pas** — mesuré : `ERROR: column
"reference_facture" does not exist`. Choisir entre « à facturer » et « facturée » serait
choisir entre **refacturer** et **renoncer**.

**Je n'ai pas simplement mis 3 à la place de 2.** L'assertion exacte est une alarme *à
chaque mouvement* — elle rougit aussi sur un retrait —, et elle a joué son rôle : elle
m'a obligé à rouvrir le fichier et à écrire pourquoi. Ce qui manquait était le **plafond**
que la note d'origine nommait en prose — *« le jour où l'on en compte quatre »* — et qui
n'était vérifié par rien. Il est désormais une assertion : `toBeLessThan(4)`. *Une
prescription qui ne se vérifie pas est une intention* (§9, 31/08). Le compte exact porte
en outre son **historique**, pour que « 3 » ne s'écrive jamais sans sa raison.

La question du rattrapage part à Alexis (Q5) : **les deux réponses possibles décident de
l'argent, dans les deux sens.**

### Vert mesuré

`pnpm verify` → **EXIT=0**, 1590 tests unitaires + 775 d'isolation, le 12/09/2026 à
`09:46:06 UTC`.

## N-06 — Cinq comportements qui n'étaient gardés nulle part

Chacun est formulé comme un **comportement**, et chacun a été mis en échec avant d'être
déclaré bon.

### 1. La consolidation — le seul chemin qui traverse le cloisonnement

`avecConsolidation` ouvre la connexion `codiplan_reporting`, qui est **`BYPASSRLS`**.
D21 lui pose trois garde-fous ; les privilèges étaient gardés, **la fonction ne l'était
pas** — *la seule porte du dépôt qui contourne le cloisonnement, et personne ne l'avait
jamais poussée.*

`tests/isolation/consolidation-tracee.test.ts` garde : la trace précède la requête, **une
requête qui échoue laisse quand même la trace** — *sinon il suffirait de faire échouer sa
requête pour lire sans laisser d'ombre* —, une URL qui n'est pas celle du rôle est
refusée, une variable absente est refusée et le refus la NOMME, et un cas qui **doit
rester vert** pour que « ça rejette » ne soit pas la preuve que ça rejette toujours.

**Et j'ai trouvé en chemin ce qui empêchait ce test d'exister** :

```
PrismaClientInitializationError: Can't reach database server at
`ep-…-pooler.ap-southeast-2.aws.neon.tech:5432`
```

`avecConsolidation` écrit sa trace sur la connexion **applicative**, une variable de
module qui lit `DATABASE_URL`. **Aucun scénario ne pouvait donc l'exercer sans écrire
dans la base que `DATABASE_URL` désigne** — et dans cet environnement de session, cette
variable porte l'URL **hébergée**. *Rien n'y a été écrit, et pour une seule raison : le
réseau a refusé la connexion.* La fonction prend désormais son client de journal en
paramètre, comme `avecContexteApplicatif` et `declarerAbsence`. **Il ne change rien en
production, où l'argument est omis.**

### 2. L'annuaire des personnes

`nomsDesPersonnes` lit `utilisateur` **sans aucune clause de société**, et c'est le bon
choix — *une comparaison écrite au-dessus serait une seconde lecture d'un même critère*.
Mais cela veut dire que **rien dans ce fichier ne protège quoi que ce soit** : le jour où
la branche « rattachement » serait élargie, il rendrait des noms d'une autre société
**sans changer d'une ligne**.

Son en-tête portait une mesure **faite à la main le 11/09**. Elle est **barrée** et
remplacée par `tests/isolation/annuaire-des-personnes.test.ts` : sous le contexte d'une
société, l'identité de l'autre est absente ; **zéro sous un compte portail** ; et un
témoin préalable qui constate que les deux identités existent vraiment — *sans lui,
« une seule revient » serait aussi bien la preuve que la seconde n'existe pas.*

### 3. Le même PDF dans deux sociétés — et ce que la mesure a corrigé

La consigne disait : *« `depot.ts` relit un doublon par `where: { empreinte }` SANS
`societe_id` ; la RLS couvre, rien ne le constate. »* **La mesure a rendu une réponse
plus forte que la question.**

Premier jumeau écrit : *politique ouverte, B redépose et reçoit le reçu de A.* Il est
resté **vert** — `expected false to be true`. Raison : **la relecture n'est atteinte
qu'après une violation de `(societe_id, empreinte)`**, et une telle violation est par
construction **intra-société**. Le chemin « B lit le fichier de A » n'existe pas : *il y a
un verrou avant la politique, et c'est l'index.*

Ce qui reste vrai est plus fin, et c'est ce que le jumeau mesure désormais : **quand A et
B portent la même empreinte — ce que l'index autorise —, la relecture de A voit DEUX
candidats si la politique ne mord pas**, et `findFirst` sans ordre choisirait au hasard.
*Mesuré : 1 candidat sous la politique, 2 sans elle.*

**Et la première tentative de desserrage n'a rien desserré** : l'`ALTER POLICY` joué en
`psql` avant la suite a été effacé par le harnais, qui recrée le schéma à son démarrage.
La suite est restée verte pour une raison qui n'avait rien à voir. *C'est le §9 du 07/09 :
un résultat qui vous surprend en bien est un soupçon sur la mesure avant d'être un fait
sur le monde.* Le desserrage se fait donc **depuis le scénario**, et un témoin constate le
retour du verrou.

### 4. Le taux d'occupation — la population était UN chemin en dur

`tests/unit/interventions/occupation-affichee.test.ts` gardait bien quelque chose, et sa
population était une ligne : `app/(back-office)/planning/statistiques.tsx`. **Un second
écran affichant le taux serait né hors de sa portée**, et le gardien serait resté vert en
ne regardant rien de lui.

Elle se **déduit** désormais de l'usage — tout `.tsx` de `app/` ou `components/` qui
appelle `tauxOccupation` **ou** affiche l'étiquette du taux. *Les deux critères, et non le
premier seul : un écran qui recevrait le taux déjà calculé en propriété n'appellerait
jamais la fonction, et c'est exactement celui qu'on veut attraper.*

**Éprouvé sur un écran réellement créé puis retiré** :

```
FAIL … > TOUT composant qui montre un taux porte les DEUX termes et la formule
AssertionError: app/(back-office)/essai-gardien/page.tsx doit afficher
statistiques.heures_engagees
```

L'ancienne version serait restée verte sur ce même fichier.

### 5. L'accord panneau / grille — celui que j'avais signalé

La réparation du 11/09 filtrait **une fois** dans l'écran, et c'était juste. *Elle ne
tenait rien* : la règle vivait dans une variable locale d'un composant de neuf cents
lignes, et le prochain consommateur pouvait recevoir autre chose sans qu'aucun test ne
rougisse.

`lib/interventions/affichage.ts` porte désormais la règle — `lignesAffichees` et
`fileDAttente`, exacts compléments l'un de l'autre. Les **trois** consommateurs
(`construireJournee`, `construireGrille`, `occupationsDuPlanning`) reçoivent le même
`affichees`, et `tests/unit/interventions/planning-un-seul-jeu.test.ts` tient les **deux
moitiés** : la RÈGLE sur la fonction, l'USAGE sur l'écran. *La première sans la seconde
laisserait un écran juste appeler une fonction juste avec le mauvais argument.*

Éprouvé en redivisant réellement le filtrage dans l'écran, puis restauré :

```
FAIL … > chacun reçoit `affichees`, et rien d'autre
AssertionError: construireGrille ne reçoit pas « affichees »: expected 'lignes' to be
'affichees'
```

Le gardien porte aussi sa **limite annoncée** : un quatrième consommateur ajouté sans
être inscrit passerait. Ce qu'il arrête est la **redivision des trois qui existent**, qui
est la façon dont la faute est revenue la première fois.

### Vert mesuré

`pnpm verify` → **EXIT=0**, 1599 tests unitaires + 790 d'isolation, le 12/09/2026 à
`10:02:10 UTC`.
