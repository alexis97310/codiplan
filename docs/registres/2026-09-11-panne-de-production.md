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
