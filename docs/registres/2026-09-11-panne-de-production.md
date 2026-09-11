# 11/09/2026 — LA PRODUCTION EST CASSÉE, ET LA BASE EST BLOQUÉE

_Registre au fil de l'eau. Cinq travaux, chacun fusionné avant que le suivant commence._

## L'état mesuré à l'ouverture — 20:51 UTC

| Ce qui a été observé | Commande | Résultat |
| --- | --- | --- |
| tête de `main` | `git log --oneline -1` | `647083b` (L3-16, #147) |
| CI sur cette tête | run `34644702951` | `success` |
| PR #148 | API GitHub | ouverte, `clean`, CI `success` sur `6b3680e` |
| file de nuit | `pnpm file` | 133 tickets — 32 libres, 79 livrés, 22 bloqués ; premier libre L3-15 |
| migrations en retard | `comm` entre `a5c63f6` et la tête | **sept**, nommées ci-dessous |

Les sept, mesurées et non supposées — `20260913120000_lot_dimport_l1_08e`,
`…130000_annulation_import_l1_08j`, `…140000_demande_l2_06`,
`…150000_intervention_machines_l2_08a`, **`…160000_suspension_l2_10`**,
`…170000_technicien_l3_01a`, `…180000_absence_l3_04`. La cinquième est celle qui
échoue ; les deux dernières sont coincées derrière elle.

## 1 — #148 fusionnée

`b75c156`. La sonde `/sante` ne peut plus répondre « migrations à jour » à la
question « une migration a-t-elle échoué ? ».

## 2 — LA PANNE REJOUÉE EN LOCAL, avant d'écrire une ligne

Un PostgreSQL jetable, les 44 premières migrations, **une intervention
`suspendue` insérée comme le seed d'avant L2-10 l'aurait laissée**, puis
`prisma migrate deploy` :

```
Error: P3018 … Database error code: 23514
ERROR: check constraint "intervention_suspension_a_son_motif" of relation
"intervention" is violated by some row
```

**Le même code, la même contrainte.** Et deux mesures que la suite entière
utilise :

- `applied_steps_count = 0`, et **aucune des quatre colonnes n'existe en base** —
  Prisma joue le fichier comme une seule commande, donc dans une transaction :
  l'échec n'a rien laissé. _La migration n'a donc pas « touché une base
  réelle » au sens du §7 : elle se réécrit sur place._
- Après `migrate resolve --rolled-back`, **Prisma a rejoué un fichier MODIFIÉ
  sans se plaindre d'empreinte.** Mesuré en ajoutant un commentaire au fichier :
  il repart sur l'ancienne faute, jamais sur un `P3006`.

Ces deux faits n'étaient pas connus ; ils ont été mesurés parce que tout le
reste en dépend.

## 3 — LE DÉBLOCAGE, par un flux GitHub

`pnpm db:resoudre` et le flux **« DB resolve — débloquer une migration en
échec »**. Le geste manquant : la chaîne de connexion ne vit que dans les
secrets du dépôt, et _une procédure qui suppose un terminal portant le secret
n'est pas une procédure._

**Un seul verbe est exposé, et ce n'est pas un oubli.** `--applied` marque une
migration appliquée **sans l'exécuter** : il écrit dans l'historique une chose
qui n'a pas eu lieu. Un gardien refuse qu'il apparaisse, dans le flux comme
dans le script.

**Le garde qui porte tout est `applied_steps_count`.** Une migration non
transactionnelle — un `CREATE INDEX CONCURRENTLY` — s'applique par morceaux ;
la déclarer annulée affirmerait qu'elle n'a rien laissé. Le flux **refuse** ce
cas et le renvoie à un arbitrage.

**Il n'applique AUCUNE migration.** Enchaîner rejouerait aussitôt celle qui
vient d'échouer : sans correction entre-temps, le geste qui débloque
rebloquerait. _Un verbe par flux._

Les deux chemins ont été exercés contre la base rejouée : refus sur un nom qui
ne correspond pas, acceptation et déblocage sur le bon.

## 4 — LES 47 MIGRATIONS PASSÉES AU MÊME CRIBLE

Mesuré, pas supposé : **15 migrations resserrent une table qui existait déjà**
— contrainte `CHECK`, clé étrangère, `SET NOT NULL`, index unique, colonne
`NOT NULL` sans défaut. La liste et son verdict sont au travail 5.

## Où reprendre

Travail 3 — réparer la migration pour qu'elle passe sur une base peuplée.

## 5 — LA MIGRATION RÉPARÉE (D104)

**L'issue (a) a été mesurée impossible.** Une valeur qui dit son ignorance se
défend pour le motif — `SN-INCONNU-` en est le précédent exact — et **échoue sur
`suspendue_le`** : aucune valeur de date ne dit son propre inconnu, et celle
qu'on écrirait deviendrait l'ancienneté que la file affiche et que l'alerte
« > 30 jours » surveille. Deux mécanismes pour une règle, ou un chiffre faux
dans un écran de pilotage.

**`NOT VALID` sur les deux contraintes qui cassent, les deux autres validées.**
Mesuré sur la base rejouée : les trois migrations restantes s'appliquent ;
`convalidated` vaut `f, f, t, t` ; une ligne nouvelle suspendue sans motif est
**refusée** ; la ligne ancienne **modifiée sans se mettre en règle** est refusée
aussi, et acceptée dès qu'elle s'y met.

C'est cette avant-dernière ligne qui décide : *le rattrapage tombe au moment où
quelqu'un est là pour dire le motif.*

**L'état non validé est visible, ou la décision n'en est pas une.**
`scripts/lib/contraintes-non-validees.ts`, gardé dans les trois sens, lu par
`pnpm veille` (douzième contrôle) **et** par un scénario d'isolation à chaque
`pnpm verify`. Rattrapage : **R3-02**, bloqué avec sa mesure.

## 6 — LE GARDIEN QUI MANQUAIT : les migrations rejouées contre des données

`tests/isolation/migrations-sur-base-agee.test.ts`, dans `pnpm verify` — donc
sur **chaque proposition**, et non la nuit d'après.

**Comment, et pourquoi pas autrement.** Par `prisma migrate deploy`, le chemin
exact de la production. *Mesuré : `$executeRawUnsafe` refuse un lot
multi-instructions — `42601`, « cannot insert multiple commands into a prepared
statement ». Rejouer le SQL à la main n'était pas seulement moins fidèle, c'était
impossible.*

**La population est DÉRIVÉE**, jamais déclarée : **52 resserrements dans 15
migrations**, sur les 47 du dépôt. Un resserrement est un ordre qui réduit ce
qu'une table accepte, posé sur une table qu'une migration **antérieure** a créée.
Une table née dans la même migration n'en est pas un — elle naît vide ; une
contrainte `NOT VALID` non plus — c'est sa définition.

**Le harnais s'est piégé lui-même à sa première exécution**, et c'est la mesure
la plus utile de la soirée : il a annoncé *« All migrations have been
successfully applied »* sur une base où `intervention = 0`, l'amorce ayant échoué
sur une contrainte. **Un décompte nul ressemble toujours à un sans-faute.** D'où
le témoin : une table vide au resserrement fait échouer, et nomme l'amorce à
écrire.

### Éprouvé dans les DEUX directions, sur des fautes réellement écrites

| Faute rejouée | Résultat |
| --- | --- |
| la contrainte de D104 remise en `VALID` | **rouge** — `P3018`, `23514`, `intervention_suspension_a_son_motif` : le `P3018` exact du 11/09 |
| une migration neuve resserrant `jour_ferie`, table sans lignes | **rouge** — et le message nomme l'amorce à écrire |

Les deux fautes ont été retirées après mesure.

### Ce qu'il ne prétend pas

Il ne dit pas qu'une migration est sûre : il dit qu'elle a été **éprouvée contre
des lignes**. L'amorce décrit une base plausible de cette époque ; *si une
migration échoue ici, c'est ou bien qu'elle manque son rattrapage, ou bien que
l'amorce décrit une base impossible* — et la seconde lecture se vérifie, elle ne
se suppose pas.

## 7 — LES 46 AUTRES MIGRATIONS PORTENT-ELLES LA MÊME FAUTE ?

**Mesuré sur les 47, pas supposé.** `resserrements()` lit chaque fichier, retire
les commentaires, et retient tout ordre qui **réduit ce qu'une table accepte**
sur une table qu'une migration **antérieure** a créée.

**52 resserrements dans 15 migrations** — `ALTER COLUMN TYPE` 14, `CHECK` 14,
index ou contrainte unique 12, `FOREIGN KEY` 9, `SET NOT NULL` 3.

| migration | resserrements | appliquée à la démo ? | rejouée contre des données ? |
| --- | --- | --- | --- |
| `20260820140000_identifiants_uuid` | 19 | oui | — |
| `20260821120000_calendriers_agence_et_feries` | 2 | oui | — |
| `20260823130000_territoire_du_ferie_reference` | 7 | oui | — |
| `20260828120000_charte_societe_optionnelle` | 2 | oui | — |
| `20260906120000_site_l1_02` | 3 | oui | — |
| `20260907120000_perimetre_sites_l1_02b` | 2 | oui | — |
| `20260907140000_contact_l1_03` | 1 | oui | — |
| `20260909200000_intervention_l2_planning` | 1 | oui | — |
| `20260909210000_parametrage_par_agence` | 2 | oui | — |
| `20260910030000_forfait_rang_d86` | 2 | oui | — |
| `20260911020000_assujettissement_vgp_l9` | 5 | oui | — |
| `20260913130000_annulation_import_l1_08j` | 2 | **non** | **oui** |
| `20260913140000_demande_l2_06` | 1 | **non** | **oui** |
| `20260913160000_suspension_l2_10` | 2 | **non** | **oui** |
| `20260913170000_technicien_l3_01a` | 1 | **non** | **oui** |

**La partition « inventoriée » coïncide EXACTEMENT avec « appliquée à la
démonstration » — zéro incohérence**, et c'est un contrôle, pas une coïncidence
arrangée : le partage est calculé depuis `git ls-tree a5c63f6`, la source qui dit
ce que la base a réellement reçu.

### LE VERDICT, en une phrase

**Les onze premières sont closes par `_prisma_migrations`, pas par ma lecture** :
la base réelle les a acceptées. Une base de production neuve les reçoit toutes
d'un coup sur un schéma vide. *Le rejeu contre des données ne répondrait à
aucune question ouverte pour elles.*

**Les quatre dernières sont les seules vivantes, et les quatre sont rejouées :**

| migration | ce qu'elle resserre | verdict mesuré |
| --- | --- | --- |
| `…130000` | 2 `CHECK` sur `import_lot` | passe, contre un lot **`applique`** |
| `…140000` | index unique sur `contact` | passe — l'index porte `id`, **il ne peut rien refuser** |
| `…160000` | 2 `CHECK` sur `intervention` | passe **depuis D104** ; sans lui, `23514` |
| `…170000` | index unique sur `technicien_calendrier` | **table prouvée vide** — voir ci-dessous |

### CE QUE L'AUDIT A TROUVÉ EN PASSANT

**`technicien_calendrier` n'a jamais pu recevoir une seule ligne.** Son
déclencheur d'audit est posé **à sa naissance** (`20260909210000`, ligne 103) et
refuse toute écriture sur une table sans colonne `id` (I10) :

> `journal_audit : la table « technicien_calendrier » n'expose aucune colonne`
> `« id ». Le journal désigne la ligne journalisée par sa clé technique.`

`id` n'arrive qu'avec `20260913170000_technicien_l3_01a`. **La table est donc
restée inécrivable du 09/09 au 13/09**, et rien ne l'a dit — c'est le §9 du 08/09
*(un défaut invisible parce que ce qu'il casse n'existe pas encore)* : aucun
appelant ne l'exerçait. La migration qui la resserre est celle qui la répare ;
rien à reprendre, mais l'index unique qu'elle pose **ne peut rien refuser**, et
c'est pour cela qu'il est inscrit à `TABLES_VIDES_AU_RESSERREMENT` plutôt
qu'amorcé.

### TROIS FORMES QUE LE DÉPÔT N'ÉCRIT PAS, et qui sont reconnues quand même

`VALIDATE CONSTRAINT`, `ATTACH PARTITION`, `EXCLUDE` : **zéro occurrence** sur
les 47. Le lecteur les reconnaît tout de même, éprouvé sur des migrations
fabriquées faute de réelles — *un lecteur qui ne connaît que ce qui existe
devient faux le jour où quelqu'un écrit autre chose, et il le devient en
silence.* Et un témoin garde l'affirmation elle-même : le jour où l'une d'elles
apparaît, il rougit, parce que la phrase « le dépôt ne les écrit pas » aura cessé
d'être vraie.

### CE QUE CET AUDIT NE PROUVE PAS

Il lit du SQL statiquement : un ordre assemblé à l'exécution lui échappe (§9,
26/08, forme 6). Et **l'amorce du rejeu décrit une base plausible, pas la base de
démonstration** — je ne peux pas la joindre depuis une session. *La seule mesure
qui fermera vraiment la question est le geste d'Alexis* : « DB migrate & seed »
qui passe au vert, et `/sante` qui répond quatre oui.

## 8 — LA SONDE RÉPARÉE CRIAIT AU LOUP (12/09, après les deux gestes)

Les deux gestes joués, les sept migrations appliquées. Et `/sante` répondait
*« Les migrations sont à jour : non — Une migration a échoué ou a été annulée :
20260913160000_suspension_l2_10 »* — sur une base où cette migration venait
d'être **réappliquée avec succès**.

### L'hypothèse était juste, et elle a été MESURÉE avant d'être crue

La panne rejouée de bout en bout sur un PostgreSQL jetable : base peuplée,
migration dans sa version d'**avant** D104 → `P3018`/`23514` ; puis
`resolve --rolled-back` ; puis `deploy` avec D104 → appliquée.

```
20260913160000_suspension_l2_10 | 22:32:06 | fini=f | annulee=t | etapes=0
20260913160000_suspension_l2_10 | 22:32:09 | fini=t | annulee=f | etapes=1
```

**`_prisma_migrations` porte une ligne par TENTATIVE, pas une par migration.**
La sonde cherchait une tentative non appliquée *n'importe où* — `lignes.find((l)
=> !l.applique)` — et trouvait l'annulée.

*Et une mesure de plus, qui ferme une porte :* `resolve --rolled-back` sur une
migration dont la dernière tentative est **appliquée** est **refusé** par Prisma
(« cannot be rolled back because it is not in a failed state »). L'état « appliqué
puis annulé » n'est donc pas productible par le chemin supporté — mais le verdict
le lit quand même, et un scénario le mesure.

### UNE SEULE LECTURE, et c'est pourquoi la réparation est une fonction pure

Le défaut ne portait que sur la moitié « en échec » ; la moitié « absente » était
juste. **Réparer la seule moitié fautive aurait laissé deux lectures du même
critère dans la même fonction** — la divergence du §9 (01/09), au pire endroit.
`verdictDesMigrations` porte les deux, et ne connaît aucune base.

### TROIS ÉTATS, ET JAMAIS DEUX

| dernière tentative | sens | geste |
| --- | --- | --- |
| finie, non annulée | appliquée | — |
| ni finie ni annulée | **en échec** — bloque les suivantes | débloquer, puis migrer |
| annulée | rejouable | migrer |

*Les deux derniers étaient confondus sous « a échoué **ou** a été annulée », et
ils n'appellent pas le même geste.* L'échec est nommé **avant** l'absence, parce
qu'une migration en échec empêche d'appliquer celles qui manquent : nommer
l'absence d'abord enverrait jouer un geste qui ne peut pas aboutir.

### LA PAIRE, LUE SUR LA MÊME BASE

| sonde | verdict |
| --- | --- |
| celle d'hier | `ok: false` — « Une migration a échoué et bloque toutes les suivantes » |
| réparée | `ok: true`, aucun motif |

### Éprouvé dans les deux directions

La faute remise — `tentatives.find((t) => !t.finie)` — fait tomber **trois**
scénarios unitaires et **un** d'isolation. Et le scénario « annulée puis
réappliquée » porte son jumeau : la même ligne annulée, privée de la tentative
réussie, doit rendre « non » — *sans lui, il resterait vert sur une sonde qui
aurait cessé de lire la table en entier.*
