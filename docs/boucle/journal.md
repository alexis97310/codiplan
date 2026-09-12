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
