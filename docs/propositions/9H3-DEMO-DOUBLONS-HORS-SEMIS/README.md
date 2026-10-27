# 9H3-DEMO-DOUBLONS-HORS-SEMIS

Aucun écran n'est touché ni créé par ce lot : pas de capture AVANT/APRÈS. Ce
qui suit remplace les captures — la sortie du rapport (`rapportDoublons`),
mesurée sur un état FABRIQUÉ qui reproduit la FORME du refus mesuré par
Alexis le 24/10/2026 sur la vraie démonstration (flux « DB doublons machine
— démonstration », `appliquer` décoché) : les identifiants d'intervention et
de société sont ceux nommés dans le refus réel ; les identifiants de ligne et
les dates de pose (`cree_le`) sont fabriqués, faute de connexion permise par
ce lot — l'ordre entre les deux dates est ce qui compte pour la démonstration
du tri, pas leur valeur.

État fabriqué (deux lignes sur la même intervention, aucune du semis) :

```
ligne1 = { id: "01a0c25e-705a-709a-86ac-9ad75f70c9b1",
           intervention_id: "0192f0a0-6000-7000-8000-000000000001",
           societe_id: "0192f0a0-0000-7000-8000-000000000001",
           cree_le: 2026-10-10T08:00:00Z }
ligne2 = { id: "02b1d36f-816b-81ab-97bd-ae86861da2c2",
           intervention_id: "0192f0a0-6000-7000-8000-000000000001",
           societe_id: "0192f0a0-0000-7000-8000-000000000001",
           cree_le: 2026-10-18T14:00:00Z }
```

## AVANT (le refus RÉELLEMENT mesuré par Alexis le 24/10/2026, flux en lecture seule)

```
REFUS : la ligne 01a0c25e-705a-709a-86ac-9ad75f70c9b1 (intervention 0192f0a0-6000-7000-8000-000000000001,
société 0192f0a0-0000-7000-8000-000000000001) ne porte pas un identifiant du jeu de
démonstration (préfixe attendu 0192f0a0-b000-7000-8000-…). Ce n'est plus la démo telle que le semis
la connaît : rien n'est proposé, rien ne sera retiré.
```

Code de sortie du script sur cet état : `1`. C'est le refus cité intégralement
dans le ticket, d'où viennent les deux identifiants ci-dessus.

## APRÈS (ce lot, état fabriqué ci-dessus — mesuré, `npx tsx` sur `scripts/lib/doublons-machine.ts`)

```
1 intervention(s) avec un doublon de machine :
  intervention 0192f0a0-6000-7000-8000-000000000001 (société 0192f0a0-0000-7000-8000-000000000001) — garder 01a0c25e-705a-709a-86ac-9ad75f70c9b1 (première machine par date de pose, décision du 24/10/2026), retirer 02b1d36f-816b-81ab-97bd-ae86861da2c2 (hors semis sur une intervention du semis — retirée, décision du 24/10/2026)

Total à retirer : 1 ligne(s).
```

La ligne la plus ANCIENNE par `cree_le` (`01a0c25e-…`, posée le 10/10) est
gardée ; la plus récente (`02b1d36f-…`, posée le 18/10, identifiant pourtant
lexicographiquement PLUS GRAND) est retirée — la preuve que le tri s'appuie
bien sur `cree_le`, jamais sur `id`, dans ce nouveau cas. Si les deux lignes
portaient la même date de pose, l'identifiant le plus petit départagerait
(couvert par un test dédié).

## Méthode

Sortie produite par un script jetable (`npx tsx`, non conservé) important
`planDeNettoyage` / `rapportDoublons` sur l'état fabriqué ci-dessus, après ce
lot. Aucune connexion à une base réelle ou de démonstration n'a eu lieu —
conforme à l'interdit du lot. L'AVANT n'a pas été rejoué : c'est le texte
exact du refus mesuré par Alexis le 24/10/2026, cité dans le ticket.
