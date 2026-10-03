# 9CZA-DEMO-HORS-SEMIS

Aucun écran n'est touché ni créé par ce lot : pas de capture AVANT/APRÈS. Ce
qui suit remplace les captures — la sortie du rapport (`rapportDoublons`),
mesurée sur un état FABRIQUÉ qui reproduit exactement l'état mesuré en
démonstration le 03/10/2026 (refus observé par Alexis sur le flux « DB
doublons machine — démonstration », commit c34c6a8) : une intervention porte
la ligne posée par le semis **et** une ligne posée à la main par l'application
(`lib/interventions/depot.ts`), avec les mêmes identifiants que ceux nommés
dans le refus mesuré.

État fabriqué (deux lignes sur la même intervention) :

```
duSemis     = { id: "0192f0a0-b000-7000-8000-000000000001",
                intervention_id: "0192f0a0-6000-7000-8000-000000000001",
                societe_id: "0192f0a0-0000-7000-8000-000000000001" }
poseeAMain  = { id: "01a0c25e-705a-709a-86ac-9ad75f70c9b1",
                intervention_id: "0192f0a0-6000-7000-8000-000000000001",
                societe_id: "0192f0a0-0000-7000-8000-000000000001" }
```

## AVANT (code d'avant ce lot — `git show HEAD:scripts/lib/doublons-machine.ts`, le même que celui qui a produit le refus mesuré en démo)

```
REFUS : la ligne 01a0c25e-705a-709a-86ac-9ad75f70c9b1 (intervention 0192f0a0-6000-7000-8000-000000000001,
société 0192f0a0-0000-7000-8000-000000000001) ne porte pas un identifiant du jeu de
démonstration (préfixe attendu 0192f0a0-b000-7000-8000-…). Ce n'est plus la démo telle que le semis
la connaît : rien n'est proposé, rien ne sera retiré.
```

Code de sortie du script sur cet état : `1` — c'est exactement le refus
mesuré par Alexis le 03/10 (« VERDICT : SEED SEUL … » puis ce même REFUS,
code de sortie 1).

## APRÈS (ce lot, même état fabriqué)

```
1 intervention(s) avec un doublon de machine :
  intervention 0192f0a0-6000-7000-8000-000000000001 (société 0192f0a0-0000-7000-8000-000000000001) — garder 0192f0a0-b000-7000-8000-000000000001, retirer 01a0c25e-705a-709a-86ac-9ad75f70c9b1 (posée hors du semis — retirée, décision du 03/10/2026)

Total à retirer : 1 ligne(s).
```

La ligne du semis est gardée ; la ligne posée à la main est nommée comme
« posée hors du semis » et proposée au retrait, conformément à la décision
d'Alexis du 03/10/2026 (`claude/decisions-alexis-03-10.md` point 6). Le
script `scripts/nettoyer-doublons-machine-demo.mts` n'a pas changé : il
affiche ce même rapport (`rapportDoublons`) et, sous `APPLIQUER=oui`, retire
exactement les lignes du champ `retirees` du plan — donc, sur cet état, la
ligne posée à la main, jamais la machine elle-même (seul le rattachement est
retiré).

## Méthode

Reproduit par `git show HEAD:scripts/lib/doublons-machine.ts` (AVANT) et le
fichier du dépôt après ce lot (APRÈS), les deux important `planDeNettoyage` /
`rapportDoublons` et appelés sur le même état fabriqué ci-dessus. Aucune
connexion à une base réelle ou de démonstration n'a eu lieu pour produire
cette sortie — conforme à l'interdit du lot.
