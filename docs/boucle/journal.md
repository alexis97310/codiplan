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
