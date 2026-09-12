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

## N-07 — Les écrans : cinq écarts à la maquette, et ce qu'ils déplaçaient

### a. Le bloc d'intervention portait trois écarts, et `creneau_debut` n'était jamais affiché

La maquette écrit `<div class="ev bl"><b>08:00 Garage Boulari</b>Préventif — pont
2 col.</div>` : une **heure**, un **client**, puis l'**objet**. Le bloc rendait une
**référence interne**, le client **et** le site. *`creneau_debut` était lu depuis toujours
sans jamais être affiché* — et l'heure est la seule information qu'un planificateur
cherche dans une case qu'il survole.

`enTeteDuBloc` et `objetDuBloc` vivent dans `presentation.ts`. L'heure est lue **dans le
fuseau de l'AGENCE** — `fuseauPour` est une fonction et non une valeur : *une
intervention de Koné et une de Ducos peuvent tomber dans la même semaine*, et passer un
fuseau unique serait juste aujourd'hui et faux à la première agence métropolitaine.

**Ce que l'objet ne dit pas est écrit** : la maquette montre « Préventif — pont 2 col. »,
c'est-à-dire une nature ET le matériel. Le matériel vit dans `intervention_machine`, que
`listerPlanning` ne charge pas, et RG-INT-01 ne l'exige qu'au passage en statut de
travail — *le dépannage à l'aveugle est le cas ordinaire.*

**Et « (démonstration) » sort des DONNÉES.** Le mot venait de `prisma/seed-data.ts`,
aucun code d'affichage ne l'ajoutait, et un bloc rendant un client ET un site le montrait
**deux fois par intervention, six fois par cellule**. *C'est la longueur du contenu qui
fait grandir les lignes, pas la feuille de style.*

**Ce qui remplace la marque n'est pas un mot, c'est un fait** : ces fiches portent des
UUID v7 **fixes** d'une plage réservée au seed, des courriels en `.test` et `.invalid`,
et `pnpm db:seed` est **sauté sur la cible « production »**. *Un identifiant qu'aucune
fiche réelle ne peut porter distingue mieux une base de démonstration qu'un mot dans un
libellé — le mot, lui, se recopie dans un export et survit à la fiche.* Les deux phrases
d'origine sont **barrées et non effacées**.

### b. L'action primaire passe au bleu, et elle n'a plus qu'une maison

Cinq écrans écrivaient la même classe avec `bg-app-accent` — **le rouge de la marque**,
qui sert déjà à la marque et à l'alerte. *Un troisième sens sur la même couleur est une
couleur qui ne dit plus rien.*

`components/ui/action-primaire.tsx` porte l'apparence, en deux formes qui partagent le
style et **pas la balise** : `ActionPrimaire` soumet, `LienPrimaire` mène quelque part —
*un lien n'est pas un bouton pour un lecteur d'écran.*

**La maquette ne porte AUCUN bouton de création en version bureau, et ce n'est pas une
contradiction : c'est un SILENCE.** D95 lui donne foi sur ce qu'elle montre, et *« ce
qu'elle ne dit pas reste libre, et un écart s'écrit avec sa mesure et le point précis où
elle est muette »*. Le point est celui-là, et il est écrit dans le composant.

`tests/unit/theme/action-primaire.test.ts` refuse **deux** choses : qu'un écran écrive
`bg-app-accent`, et qu'il **recopie l'apparence** même en bleu — *la duplication sous un
autre nom est la même duplication.*

### c. Le bandeau société — deux causes, deux remèdes

`shrink-0` sur le groupe de droite **et** `min-w-0` sur la navigation : par défaut un
enfant de flex ne rétrécit pas sous la largeur de son contenu, si bien que **onze entrées
de menu poussaient le bandeau hors de la barre**. Puis `whitespace-nowrap` sur le bandeau,
qui répond à l'autre moitié — son libellé se repliait dans la place restante. *Poser l'un
sans l'autre déplace le défaut au lieu de le fermer.*

### d. La colonne technicien — 190 dans le code, 170 à la maquette

La largeur part dans `lib/theme/apparence.ts`, à côté de `LARGEUR_UTILE_PX` et pour la
même raison : *une largeur écrite dans un écran est une largeur par écran.* **Vingt
pixels ne se voient pas seuls ; ils se voient sur la grille** — six colonnes de jour se
partagent ce qui reste.

**Les spécialités ne sont PAS affichées, et c'est écrit.** La maquette veut « agence ·
spécialités ». Mesuré : `grep -n "competence\|specialite"` sur `prisma/schema.prisma` et
`lib/` rend **zéro ligne**. Le cahier des charges distingue d'ailleurs les **compétences**
des **habilitations**, qui existent (`technicien_habilitation`, L1-04) et ne sont pas la
même notion : *une habilitation est un droit daté qui expire, une spécialité est un
savoir-faire.* Les afficher l'une pour l'autre montrerait un droit périmé comme une
compétence.

### e. Le portail — l'écran le plus vu par un client externe

Deux écarts. **La largeur** : ce `main` portait `mx-auto max-w-5xl px-6 py-10` et
**annulait** la largeur utile que sa mise en page lui donne déjà — *une sixième largeur,
posée après D95.* **La typographie** : elle venait des jetons shadcn
(`text-muted-foreground`, `border-input`, `text-2xl`) et non de la charte du produit. *Un
écran nomme un rôle de l'apparence, jamais une échelle étrangère* — et le client voyait un
produit qui ne ressemblait pas au reste du produit.

### Vert mesuré

`pnpm verify` → **EXIT=0**, 1603 tests unitaires + 790 d'isolation, le 12/09/2026 à
`10:15:51 UTC`.

## LA PORTE DE LA MAIN RENDUE — `verify:full`, et ce qu'elle a trouvé

**`pnpm verify` était vert et il avait raison. `pnpm verify:full` a rougi**, et sur un
défaut réel, pas sur un détail d'environnement :

```
An error occurred while running the seed command:
new row for relation "intervention" violates check constraint
"intervention_cloture_a_son_statut_facturation"
Failing row contains (…, controle_reglementaire, p3, cloturee, …)
```

### La cause, et elle vaut d'être écrite

Le déclencheur de N-04d était `BEFORE UPDATE` **seul**. *Une intervention peut NAÎTRE
clôturée* : le semis en pose, et une reprise d'historique en posera par milliers — c'est
le cas ordinaire d'un import (chapitre 8, « Interventions historiques »). Un `INSERT` ne
passe par aucun `UPDATE` : la valeur n'était jamais posée, et **la contrainte refusait la
ligne honnête**.

> **`pnpm verify` migre une base VIDE. C'est `verify:full`, qui SÈME, qui a vu.**
> *Une porte qui ne garde pas ce que garde la porte suivante produit des verts sincères
> et faux* — §11 du protocole, §9 du `CLAUDE.md` du 02/09.

**La migration a été corrigée SUR PLACE et non doublée** : elle n'a touché aucune base
réelle — seulement les trois bases jetables de cette session —, et le §7 est explicite :
*« une migration se réécrit tant qu'elle n'a pas touché une base réelle ; la corriger sur
place vaut mieux que d'en ajouter une seconde. »* Le jugement ne porte que sur
l'avant-première-application, et nous y sommes.

Le déclencheur couvre désormais `INSERT` **et** `UPDATE`, `TG_OP` distinguant les deux —
sur un `INSERT` il n'y a pas d'`OLD`, et le lire y lèverait. Trois scénarios sont ajoutés,
dont le **cas qui doit rester vert pour sa propre raison** : une naissance NON clôturée
reste `NULL`. *Sans lui, « le déclencheur pose une valeur » serait aussi bien la preuve
qu'il en pose une à toute naissance — et toute intervention entrerait dans la file de ce
qui est à facturer dès sa création.*

### Vert mesuré, sur la porte de la MAIN

`pnpm verify:full` → **EXIT=0**, le 12/09/2026 à `10:30:35 UTC` :
**1603** tests unitaires · **793** tests d'isolation · **27** scénarios Playwright, plus
l'horizon des fériés et les deux contrôles de partitions.

---

# ÉTAT FINAL — nuit du 12/09/2026

## Où est ce travail

**Branche `claude/vibrant-pasteur-hczbqx`**, partie de `main` à `461c9d1`.
**Rien de ceci n'est sur `main`**, et je ne l'écris pas autrement : *une chose vraie
ailleurs que sur `main` se dit avec son lieu, ou ne se dit pas* (§8 du protocole).

| Commit | Ce qu'il porte |
|---|---|
| `18682b7` | N-01 — le cahier des charges disait quatre fois ce que trois décisions avaient retiré |
| `96ba4c2` | L8-02 — l'union du lot 8 ne vivait que dans son test ; cinq marqueurs mentaient |
| `78384a2` | L9-02, L9-03 — le registre des VGP dit ce qu'on nous a dit, et rien d'autre |
| `7996fcf` | N-04a — une fonction écartée par D108 le dit, et quitte la façade de son module |
| `debecb1` | N-04b — D6 : l'unicité de `reference_interne` est posée |
| `08d28a5` | N-05 — R3-02 : le rattrapage est chiffré, et le chiffre dit ce qu'il ne dit pas |
| `6187d9f` | N-04c — D8 : « envoyée » devient « affectée », vingt-quatre jours après la décision |
| `f3c5bb7` | N-04d — D8 : le second axe existe, et il naît `NULL` |
| `38826c9` | N-06 — cinq comportements qui n'étaient gardés nulle part |
| `1973efb` | N-07 — le planning, l'action primaire et le portail rejoignent la maquette |
| `c995f5c` | N-04d, correctif — une intervention peut NAÎTRE clôturée, et `verify:full` l'a dit |

## La porte de la main

**`pnpm verify:full` → EXIT=0**, le 12/09/2026 à **`10:30:35 UTC`** :
**1603** tests unitaires · **793** tests d'isolation · **27** scénarios Playwright ·
horizon des fériés · les deux contrôles de partitions.

*C'est bien `verify:full` qui a été jouée, et non `verify` : la première a rougi sur un
défaut que la seconde ne pouvait pas voir, et c'est écrit plus haut.*

**ET ELLE A ÉTÉ MESURÉE SUR `c995f5c`, PAS SUR LA TÊTE DE BRANCHE.** Les deux commits qui
suivent — le README et cette clôture — ne touchent que des documents, et ils ont été
mesurés par `pnpm verify` (**EXIT=0**, `10:37:21 UTC`), qui porte `format:check` et les
huit gardiens de documents. *Je l'écris plutôt que de laisser « verify:full vert »
couvrir un état qu'il n'a pas vu : un vert mesuré à un endroit et annoncé pour un autre
est un vert inventé, quelle que soit la bonne foi* (§11).

## Les chiffres dénombrés

| Ce qui a été compté | Résultat | Sur quoi |
|---|---|---|
| Lignes violant l'unicité de `reference_interne` | **0** — *sur 0 machine, donc une absence de mesure* | base de démonstration |
| Interventions | **32**, dont **2** suspendues | base de démonstration |
| Suspensions sans motif / sans date / résidus (R3-02) | **0 / 0 / 0** — *et un zéro ne se lit pas « c'est fait »* | base de démonstration |
| Interventions affectées / hors agence | **26 / 0** | base de démonstration |
| Interventions clôturées sans statut de facturation | **2** | base de démonstration |
| Occurrences de `envoyee` dans le code | **11**, toutes remplacées | dépôt |
| Fonctions, contraintes et politiques citant `envoyee` en texte | **0 / 0 / 0** | base |
| Occurrences de « (démonstration) » dans les libellés du seed | **11**, toutes retirées | dépôt |

*Aucun de ces chiffres ne vient de la base hébergée : une session ne la touche pas.*

## Les questions en attente — `docs/boucle/questions-pour-alexis.md`

| | La question | Ce qui est bloqué |
|---|---|---|
| **Q1** | Le pourcentage de charge sous le nom du technicien : lequel, quand il y en a deux ? | l'affichage du taux dans la colonne |
| **Q2** | Un technicien peut-il être posé sur une intervention d'une autre agence ? | rien — **aucun refus n'a été ajouté** |
| **Q3** | La forme du catalogue des prestations | **L1-12** |
| **Q4** | Sous quelle forme enregistrer « ce qu'on nous a dit » d'une vérification ? | **L9-08, L9-09, L9-10** |
| **Q5** | Les interventions déjà clôturées : à facturer, ou déjà facturées ? | rien — le second axe marche pour toute clôture à venir |

## Ce que je n'ai pas pris, et pourquoi

**L9-11** était marqué `LIBRE` et ne pouvait pas l'être : sa saisie « en mode avion »
exige un cache local et une file de synchronisation qui n'existent ni l'un ni l'autre —
`ls lib/sync` rend « No such file or directory ». Marqueur corrigé en `BLOQUÉ`.

**L9-08, L9-09, L9-10** butent sur un seul fait mesuré, et sont marqués `BLOQUÉ` avec
lui.

**R3-02** reste `BLOQUÉ`, et son motif n'a pas bougé : le ticket s'arrêtait au chiffre,
et il y est arrivé.

---

# LES GESTES POUR ALEXIS — ils sont les derniers, et ils sont seuls

**Cette session a touché `prisma/migrations/` (trois migrations) et
`prisma/seed-data.ts`.** Le §12 du protocole exige un geste NOMMÉ, et il l'exige *même
quand il paraît évident* : *« il faudra migrer » n'est pas un geste, c'est un rappel, et
un rappel se lit sans être fait.*

**Ces gestes ne valent qu'APRÈS la fusion de la branche
`claude/vibrant-pasteur-hczbqx` sur `main`** — Vercel reconstruit à la fusion, la base
attend une main.

### 1. Appliquer les migrations et régénérer la démonstration

> **Lancer « DB migrate & seed » (onglet Actions → *Run workflow*) — branche : `main` —
> `cible` : `demonstration` — `reinitialiser_demo` : LAISSER DÉCOCHÉ.**

Sans ce geste : `/planning` et `/parc` **tomberont**. Le code déployé lira
`intervention.statut_facturation`, `machine.reference_interne` sous son index, et
l'énumération `affectee` — trois objets que la base de démonstration n'a pas encore.
C'est la panne du 11/09, à l'identique.

**`reinitialiser_demo` décoché** : les trois migrations s'appliquent sans rien effacer.
Le semis repasse ensuite sur les mêmes identifiants fixes et corrige les libellés — c'est
ce qui retirera « (démonstration) » des fiches existantes.

### 2. Vérifier que la base a suivi

> **Lancer « `pnpm deploiement:verifier` »** — ou simplement ouvrir **`/sante`** et lire
> la ligne « migrations à jour ».

Trois migrations sont attendues :
`20260913200000_reference_interne_unique_d6`, `20260913210000_statut_affectee_d8`,
`20260913220000_statut_facturation_d8`.

### 3. Ce que je n'ai PAS fait, et qui vous appartient

**Rien sur la base de PRODUCTION.** La cible `production` n'est jamais nommée par une
session, et le semis ne s'y exécute pas. Si cette base porte des interventions
**déjà clôturées**, elles n'ont pas de statut de facturation et la contrainte
`intervention_cloture_a_son_statut_facturation` est posée `NOT VALID` **exprès** pour ne
pas les refuser : voir **Q5**, qui demande quoi en faire.

**Le dénombrement de R3-02 sur la base réelle.** `pnpm suspensions:denombrer` est
versionné et attend d'être joué là où le chiffre a un sens. *Le zéro que j'ai mesuré vaut
pour une base bâtie depuis zéro, et une base bâtie depuis zéro ne PEUT pas porter de
violation.*

---

# APRÈS LES RÉPONSES D'ALEXIS — 12/09/2026, soir

*Les cinq questions ont reçu leur réponse. Elles entrent au recueil en **D111 à D115**,
chacune avec sa raison, sa date et sa condition de réouverture. `487b689`, fusionné sur
`main` en `64bef71` avec les neuf tickets de la nuit (proposition
[#162](https://github.com/alexis97310/codiplan/pull/162), écrasée — le dépôt refuse les
commits de fusion).*

## D111 — le taux compact, et une contradiction trouvée en l'appliquant

### Ce que j'ai construit

`tauxCompact` rend un **ÉTAT**, jamais du texte — trois valeurs qui ne se disent pas avec
le même mot : `sans_calendrier`, `infime`, `chiffre`. La colonne « Technicien » l'affiche
sous le nom.

### ET LA CONDITION DE D111 NE PORTE PAS SUR LA BONNE CHOSE

D111 s'appuie sur *« un technicien n'a qu'UNE agence de rattachement, donc jamais deux
taux »*, et sa condition de réouverture vise `technicien.agence_id` — **colonne simple et
`NOT NULL`, c'est exact.**

**Ce n'est pas la maille du taux.** `occupationsDuPlanning` rend une ligne par
**(technicien, agence de l'INTERVENTION)** : le dénominateur vient du calendrier de
l'agence **où le travail a lieu** (I7). Et **D112, rendu le même soir, autorise
expressément** qu'un technicien de Ducos soit posé sur une intervention de Koné.

> *Une personne qui fait un renfort porte donc DEUX lignes de charge, le jour même où les
> deux décisions sont écrites, sans qu'aucune table de rattachement multiple n'existe.*

**Le §1 du `CLAUDE.md` dit ce qu'on en fait** : une contradiction entre deux sources de
rang 1 est **un défaut à signaler, jamais une préséance à appliquer**. Elle est signalée —
au recueil sous D111, et en **Q6** pour Alexis.

**Et la voie qui restait ouverte a été prise** (§2 du protocole) : l'écran **MESURE** la
condition au lieu de la supposer. Une seule ligne de charge → le taux seul, D111 dans sa
lettre. Plusieurs → **chacune nomme son agence**, ce que D111 prescrit lui-même *« pour ce
jour-là »*. *Aucune des deux décisions n'est réduite, et l'écran ne peut plus mentir.*

### Le gardien tient la CONDITION, pas l'affichage

*Une condition de réouverture écrite en prose est une intention* (§9, 31/08) : elle ne
rougit pas le jour où elle est remplie. `tests/unit/interventions/taux-compact.test.ts`
rougit — sur la forme du schéma, qui est ce que D111 invoque. Éprouvé en rendant
réellement `agence_id` optionnelle :

```
FAIL … > `technicien` porte UNE agence, colonne simple et obligatoire
AssertionError: expected 'model Technicien {…' to match /\n\s+agence_id\s+String\s+@db\.Uuid/
```

### Le rouge que j'ai réparé

```
tests/unit/interventions/taux-compact.test.ts(103,24): error TS2345:
Property 'journees' is missing in type … but required in type 'TrajetDeLaPeriode'.
```

**`vitest` avait passé ce fichier au vert ; c'est `tsc` qui l'a dit.** La fixture n'était
pas typée, et un objet littéral qui satisfait une fonction aujourd'hui cesse de la
satisfaire au premier champ ajouté. Le type est désormais écrit — *la leçon du 09/09 :
quand une erreur d'exécution est incompréhensible, `tsc` a souvent déjà répondu, et il
coûte deux secondes.*

### Vert mesuré

`pnpm verify:full` → **EXIT=0**, le 12/09/2026 à `11:07:31 UTC` : **1611** unitaires ·
**793** d'isolation · **27** Playwright.

## L1-12 — le catalogue des prestations, débloqué par D113

### Ce que j'ai construit

La table `prestation` — `societe_id NOT NULL`, forme « société », son déclencheur
d'audit —, `lib/prestations/saisie.ts`, le gabarit d'import, et douze scénarios
d'isolation.

**Aucune colonne de montant, et aucun lien vers `forfait`.** D109 pour la première, D113
pour le second : *le pont passe par l'INTERVENTION, qui reçoit son forfait par les trois
axes de RG-TAR-06.* Une clé étrangère ici aurait fait naître une question que personne
n'a posée — *que se passe-t-il si le forfait désigné ne s'applique pas à la zone ?*

### LE GARDIEN A TROUVÉ UNE COLONNE QUE `prisma format` AVAIT ÉCRITE

C'est la mesure de ce ticket, et elle ne se devinait pas :

```
FAIL … > AUCUNE COLONNE du modèle ne nomme un montant ni un forfait
AssertionError: « devise     Devise?          @relation(fields: [deviseCode], …) »
nomme « devise »
```

**Je n'ai jamais écrit cette colonne.** Mon `python` avait inséré la relation inverse
`prestations Prestation[]` sur la **première** occurrence de `taux_horaires
TauxHoraire[]` — qui appartient à `Devise`, non à `Societe`. Et **`prisma format` a
complété la relation tout seul** : il a ajouté `devise Devise?` et une colonne
`deviseCode String?` **sur `prestation`**.

> *Une table dont la règle fondatrice est « aucun montant » a reçu une colonne de devise,
> écrite par un formateur, sans qu'aucune ligne de diff ne soit de moi.*

C'est la famille du §9 du 24/08 — *une valeur par défaut qui répond à une question qu'on
n'a pas posée est une décision prise par personne* —, appliquée à un outil de mise en
forme. **Et c'est le gardien qui l'a dit, pas la relecture.**

### Le second rouge, et il valait aussi son heure

```
tests/unit/prestations/gabarit.test.ts(101,7): error TS2722:
Cannot invoke an object which is possibly 'undefined'.
```

`ModeleDImport.valider` est **facultatif**. Un `?.()` silencieux aurait rendu `undefined`
partout : **les six scénarios de rejet seraient passés sans rien éprouver** — *un gardien
creux est vert, par définition.* Le scénario lève désormais plutôt que de rendre
l'absence, et le témoin est écrit.

### Ce qui a rougi ensuite, et c'est le dispositif qui fonctionne

Quatre gardiens ont réclamé la nouvelle table **sans qu'aucune liste n'ait été tenue à la
main** : le périmètre d'audit (D55), l'inventaire, le chapitre 11 (`modele-de-donnees`),
et le §6 du `CLAUDE.md` (`organisation-du-code`). *Chacun part d'une source qu'il ne
contrôle pas* — le schéma, le disque —, et c'est ce qui fait qu'une table créée demain
sera réclamée le jour même.

### La famille est un parent FACULTATIF — le premier du fichier des gabarits

Les autres gabarits qui désignent un parent le rendent obligatoire. Celui-ci ne l'exige
pas : *un déplacement, un diagnostic ou une formation ne visent aucune famille.* La
conséquence est écrite et mesurée — **une cellule vide passe, une cellule renseignée qui
ne désigne rien est un rejet**. *Les confondre ferait rejeter la moitié d'un catalogue
ordinaire.*

### Vert mesuré

`pnpm verify:full` → **EXIT=0**, le 12/09/2026 à `11:26:20 UTC` : **1631** unitaires ·
**806** d'isolation · **27** Playwright.

## L9-08, L9-09, L9-10 — le registre reçoit enfin ce qu'on lui dit (D114)

### Ce que j'ai construit

Trois tables — `vgp_verification`, `vgp_observation`, `vgp_campagne` —, trois modules,
et treize scénarios d'isolation.

**L'origine est une colonne, obligatoire et sans défaut.** *Un rapport reçu de
l'organisme, une vignette photographiée et une parole du client n'ont pas la même valeur
le jour d'un contrôle*, et **elle ne se reconstitue pas après coup**. Ses quatre valeurs
sont une **proposition** — D114 le demande —, portée en **Q7**.

### Aucune quatorzième forme de politique, et c'est mesuré

Les deux tables filles prennent la forme **« filiation »**. `site_habilitation_requise`
l'avait ouverte avec un parent qui **n'est pas une intervention** : *la forme est le
CHAÎNAGE, jamais l'identité du parent.* L'adossement se chaîne ici sur trois niveaux —
observation → vérification → machine —, et **aucune clause de société n'est écrite dans
cette branche** : elle serait une seconde source du même fait.

**`vgp_campagne` fait exception et prend « société »**, et le motif est écrit : son
parent serait `famille_materiel`, de forme « ascendance » — *une campagne ne doit pas
hériter du refus de remonter vers une famille dont aucune machine n'est visible*, sans
quoi un compte interne cesserait de voir ses propres campagnes le jour où la famille n'a
plus de machine.

### LE COMPTEUR N'EST PAS UNE COLONNE

*Un compteur stocké se désynchronise en silence* — la première saisie qui oublierait de
le décrémenter le figerait — **et un compteur figé est pire qu'une alerte de trop, parce
qu'il a l'air de mesurer**. Il se dérive des machines sans information **depuis
l'ouverture**, et un scénario prouve les deux moitiés : il descend d'un quand une
vérification arrive, et une information **antérieure** à l'ouverture ne solde rien.

### Le rouge, et il ne venait pas de ce que je croyais

```
FAIL tests/isolation/intervention.test.ts > un rôle INTERNE voit les interventions
de SA société, et elles seules
AssertionError: expected [ …(4) ] to deeply equal [ …(2) ]
```

**Mes scénarios ont cassé ceux d'un autre fichier.** L9-10 *alimente le planning* — c'est
son objet —, et le harnais partage **une** base entre tous les fichiers
(`fileParallelism: false`). Deux interventions engendrées et non reprises ont faussé les
décomptes de cloisonnement du parc.

*C'est le corollaire du ticket lui-même : un scénario qui alimente doit nettoyer ce qu'il
a versé.* Le nettoyage suit l'ordre des clés étrangères — `intervention_machine`, puis
`intervention` —, et c'est accessoirement la preuve que le chaînage tient.

### Ce que le registre affiche maintenant, et ce qui n'a PAS changé

`derniereInformation` est remplie. **Mais une machine dont personne n'a rien dit affiche
toujours « sans information depuis X », et jamais « à jour »** : *remplir la colonne ne
change rien à cette règle, elle lui donne seulement de quoi être vraie dans les deux
sens.*

### Vert mesuré

`pnpm verify:full` → **EXIT=0**, le 12/09/2026 à `11:48:31 UTC` : **1631** unitaires ·
**822** d'isolation · **27** Playwright.

---

# FILE DE NUIT DU 12/09 AU SOIR — la migration part seule, la suspension se répare

*Nouvelle session, démarrée à froid. Quatre migrations avaient été fusionnées entre 21 h 55 et 22 h 27 ; quatre fois le code s'est déployé et la base est restée en arrière ; `/planning` est tombé ; la réparation est passée par une purge qui a effacé les comptes.*

---

## N1 — Une migration fusionnée atteint la base sans main (D116)

### Ce qui a été mesuré avant d'écrire

Le §12 disait vrai, il avait été relu, et il n'a pas tenu. **Le rappel et la mesure de R3-01 n'ont pas suffi non plus** : ils existaient le 11/09 et la panne a eu lieu le 12/09.

### Le message d'échec initial

Le contrôle de la borne 3 est passé du premier coup — *ce qui n'est pas une preuve.* Il a donc été mis en échec sur la faute qu'un correcteur bien intentionné écrirait : tolérer le code `CODIMA-NC` pour « ne pas embêter la démonstration ».

```
AssertionError: expected 'seed_seul' to be 'donnees_reelles'
  ❯ tests/unit/ci/donnees-hors-seed.test.ts:75
```

*Le critère est la CLÉ, jamais la ressemblance* — une société baptisée « CODIMA Nouvelle-Calédonie » par une main humaine ne devient pas du seed en empruntant son nom.

### Ce qui fait tout le travail, et ce n'est pas la règle

`societe` est sous `FORCE ROW LEVEL SECURITY`. Un rôle de migration sans contexte voit **zéro société**, conclut « aucune étrangère », et **OUVRE sur une base pleine de données réelles**. *Il ne se tromperait pas : il ne regarderait rien.* D'où l'identité exemptée — **déplacée** depuis `scripts/inventaire.mts`, jamais recopiée.

### Deux gardiens ont rougi, et ils avaient raison

`cible-de-migration` et `purge-demonstration` tenaient la règle que D116 amende. Ils sont **réécrits, pas assouplis** ; celui de la purge garde désormais explicitement ce que l'absence de tout déclencheur automatique lui garantissait par ricochet. *Sa propre note prévoyait ce piège — « une graphie exacte refuse aussi ce qui est plus fort qu'elle » — et elle venait de le prouver sur elle-même.*

### Commits

`2e85483` — vert mesuré : `pnpm verify:full` → **EXIT=0**, le 12/09/2026 à `12:32:00 UTC`.

### CE QUE JE N'AI PAS PU PROUVER, et la consigne le demandait

> *« Prouve ensuite par une MESURE, pas par un raisonnement, que le job « déploiement » passe au vert de lui-même après une fusion touchant `prisma/`. »*

**Je ne peux pas le mesurer cette nuit, et voici pourquoi :** cette mesure exige une fusion sur `main` portant une migration, puis l'observation du flux qu'elle déclenche. *La fusion est le geste ; je peux l'accomplir, mais la mesure vient APRÈS et dépend de secrets d'hébergeur que je ne vois pas.* Les quatre bornes sont tenues par un gardien **statique**, qui lit le fichier du flux et **ne peut pas dire ce qu'un exécuteur fera** — il l'annonce lui-même.

**La première fusion portant une migration EST l'épreuve de D116**, et c'est celle de cette nuit : la branche porte `20260913250000_rattrapage_suspensions_r3_02`. *C'est le résumé de son exécution qu'il faut regarder demain, pas ce paragraphe.*

---

## N2 — Une suspension qui ne peut pas dire pourquoi n'est pas une suspension (R3-02, D117)

### Le message d'échec initial, et il n'était pas celui que j'attendais

La borne demandée par la consigne — refuser sur une base portant des données réelles — a été écrite **dans la migration**, les deux identifiants du seed recopiés dans le SQL. Le rejeu sur base âgée l'a démentie en une exécution :

```
ERROR: R3-02 refuse de réparer : 1 intervention(s) à rattraper appartiennent
à une société HORS du jeu de démonstration.
```

**Le refus s'est déclenché sur un cas parfaitement légitime**, et il aurait fait pareil sur la production. *Une migration ne sait pas ce qu'est une base de démonstration : c'est une propriété du déploiement, pas du schéma.* La borne est retirée, le refus est motivé en D117, et ce qui la remplace est écrit — la règle n'invente jamais, le journal garde tout, et le refus par société vit dans le flux (borne 3 de D116), où il peut être vrai.

### Un gardien a nommé ce que la relecture n'avait pas vu

```
« 20260913250000_rattrapage_suspensions_r3_02 » porte un bloc de garde qui lit
« journal_audit » sous FORCE ROW LEVEL SECURITY sans lever le drapeau ni
constater la levée.
```

Le bloc lit **deux** tables sous `FORCE`, et la première rédaction n'en levait qu'une. *Sur la base hébergée, la reprise des dates aurait lu zéro ligne de journal, n'aurait repris aucune date, et serait passée à la branche suivante sans rien dire.* **Troisième fois que cette règle mord son propre auteur cette semaine** — et c'est l'argument pour un gardien plutôt qu'une vigilance.

### Le témoin posé la veille a rougi, pour la raison qui l'avait fait écrire

```
/VALIDATE\s+CONSTRAINT/i apparaît désormais : le rejeu la reconnaît, mais la
phrase « le dépôt ne l'écrit pas » doit être retirée du README et du module.
```

Il est **inversé plutôt que retiré** : la forme n'est plus attendue absente, elle est attendue **là où un arbitrage l'a mise**.

### Ce qui prouve que le rattrapage a eu lieu

*Mesuré le 12/09/2026 sur le rejeu, qui porte depuis L1-08j la ligne même qui a cassé la production :* elle ressort en **`a_planifier`**, ses deux colonnes **nulles**, et les deux contraintes en **`convalidated = true`**. L'assertion du harnais qui affirmait `statut = 'suspendue'` décrivait le monde d'avant ; elle prouve désormais l'inverse.

### Le chiffre

`CONTRAINTES_NON_VALIDEES` passe de **trois à une**. *C'est la première fois que cette liste DESCEND.* `intervention_cloture_a_son_statut_facturation` reste ouverte, et D115 dit pourquoi.

### Commits

`5400020` — vert mesuré : `pnpm verify:full` → **EXIT=0**, le 12/09/2026 à `12:54:38 UTC` : **1671** unitaires · **822** d'isolation · **27** Playwright.

---

## N3 — La prise de vue, et R1-02 dans le même geste

### La première chose que la commande a dite

```
VERDICT : 51 fichier(s) de surface ont changé depuis b8c3f76.
```

*Les images étaient périmées, et rien dans le dossier ne le disait* — c'est exactement ce que R1-02 énonçait.

### Le troisième verdict s'est déclenché à sa première exécution réelle

```
VERDICT : INDÉCIDABLE — le commit b8c3f76 n'existe pas dans ce clone —
historique tronqué (`--depth`) ou réécrit.
```

**Ce clone était superficiel** (55 commits sur 355). *Sans ce troisième état, `git diff` aurait rendu une liste vide et « je ne sais pas » se serait lu « rien n'a changé »* — le silence qui a exactement la forme du succès.

### Les captures

**48 images à `23610b9`**, prise lue à l'horloge : `2026-09-12 13:04 UTC`. **Quatre refus**, et ce sont les **mêmes** que le 10/09 — **re-mesurés plutôt que recopiés** :

```
Refus : L'identité portail@example.test n'est pas habilitée sur la société
« CODIMA Nouvelle-Calédonie ».
```

*La chaîne d'ENTRÉE du portail reste murée un cran au-dessus de ce que D92 a ouvert.*

### Ce que l'image a montré, et qu'aucune assertion n'aurait dit

**Le planning est une GRILLE** — créneaux colorés, file d'attente à droite, taux compact sous chaque nom (18 %, 75 %, 69 %), panneau de charge portant les deux termes et la formule. *D111 et D56 côte à côte, chacun à sa place.*

**Et une fausse alerte que l'image a levée, vérifiée plutôt que crue :** le nom de l'agence apparaît sous chaque technicien, ce qui semble contredire D111 (« le pourcentage, et rien d'autre »). **Mesuré au code :** cette ligne est `ouTravaille`, l'étiquette de la LIGNE, antérieure à D111 ; le taux lui-même est rendu nu par `TauxCompactAffiche`. *D111 porte sur ce qui accompagne le CHIFFRE, pas sur ce qui identifie la ligne.* Aucun défaut — mais il a fallu ouvrir le fichier pour le dire.

### Le mot de passe

**Tiré au sort, écrit dans aucun fichier du dépôt (I9).** Le semis ne pose aucun mot de passe — *la base est en ligne et le dépôt est public* —, et la seule porte est le lien de premier accès.

### Commits

`23610b9` (R1-02) et `7a87b6e` (les images) — vert mesuré : `pnpm verify:full` → **EXIT=0**, le 12/09/2026 à `13:19:18 UTC`.

### UN ROUGE, ET IL N'ÉTAIT PAS DANS LE CODE

Deux `verify:full` ont rougi cette nuit sur le même symptôme — **huit scénarios Playwright, tous ceux qui ouvrent une session**, avec `connexion?motif=auth.refus`. **Ni l'un ni l'autre n'était un défaut du dépôt :**

1. la première fois, `E2E_DATABASE_URL` n'était pas posée et aucun PostgreSQL n'écoutait sur 5433 — *la préparation retourne alors sans rien faire, et chaque scénario échoue en nommant l'authentification* ;
2. la seconde, **mon propre serveur de prise de vue occupait encore le port 3100** — le harnais a mesuré une application branchée sur la base des captures. *C'est littéralement l'avertissement que le README des captures porte depuis le 10/09.*

*Aucun des deux ne se lit dans son message d'échec*, et c'est à noter : `auth.refus` est un message juste sur une cause fausse — la famille du 08/09.

---

## N4 — La condition de D111 vise la maille (Q6, issue 2)

La condition portait sur `technicien.agence_id` ; le taux dépend de `(technicien, agence de l'INTERVENTION)`. **Le gardien change de sujet avec elle** : il lisait la forme du schéma, il lit désormais la maille — et le cas qui doit rester vert pour sa propre raison est que `technicien.agence_id` **existe toujours** et décide encore de la majoration (D12) et du calendrier de conflit (D13).

*Éprouvé en fusionnant les clés de regroupement sur le technicien seul :*

```
AssertionError: expected 'import { periodesValidees } from "@/l…' to match
/cle\.technicienId[^\n]*\|[^\n]*cle\.agenceId/
```

### Commits

`ec4395e`.

---

## CE QUI EST ÉCRIT AU RECUEIL

| | |
|---|---|
| **D116** | une migration fusionnée atteint la base sans main — quatre bornes, condition de réouverture : *le jour où le refus de la borne 3 se déclenche sur la démonstration* |
| **D117** | une suspension qui ne peut pas dire pourquoi n'est pas une suspension — condition de réouverture : *le jour où une base portera une suspension RÉCENTE, dont un humain peut encore dire le motif* |
| **D111** | condition de réouverture **réécrite** : la maille du taux, et non la colonne de rattachement |

## CE QUI EST EN ATTENTE

**Q7** — les quatre valeurs d'origine d'une information de VGP (posée hier soir).
**Q8** — **par quel canal un lien de premier accès parvient-il à une personne ?** *Écrite sans être tranchée : un canal d'envoi demande un service externe et une clé.* C'est la question qui décide si Alexis peut rentrer dans son application depuis un téléphone.
