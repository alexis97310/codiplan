# La population du contrôle de cloisonnement est PRODUITE PAR LE SCHÉMA

*Décision de session du 10 septembre 2026, prise sous le protocole du même jour.
Elle ne change aucune règle métier : elle change la SOURCE d'une liste.*

---

## Contexte — un contrôle aveugle des deux côtés

Le workflow « DB migrate & seed » porte les deux seules étapes qui regardent la
base hébergée : `scripts/inventaire.mts` compte sous une identité exemptée des
politiques, `scripts/controle-cloisonnement.mts` relit sous le rôle applicatif
et se confronte au premier. Les deux tenaient leur population dans une liste
close écrite à la main, `TABLES_CLOISONNEES`.

Chaque ticket ajoutait sa table à la liste — donc à la ligne imprimée — et
personne ne revenait écrire son compteur. **Les deux côtés de la comparaison ont
donc perdu la vue ensemble, et leur accord est devenu maximal :** zéro contre
zéro, sur quatorze tables, dont `site`, `machine` et `intervention` — les trois
qui portent la forme « parc ».

## MESURE — depuis quand, et combien de nuits

La question a été posée par l'exploitation, et elle se mesure.

| Fait | Valeur mesurée |
|---|---|
| Naissance de la cécité | commit `97e8f95`, fusion de #32 (ticket L1-02), **07/09/2026 01:28 UTC** — `site` entre dans la liste, son compteur n'est jamais écrit |
| Fin de la cécité | commit `52173a1`, **09/09/2026 22:48 UTC** — les deux côtés réparés |
| Durée | **2 jours et 21 h 20 min** |
| Tables aveugles au pire | **14 sur 21** (`site`, `contact`, `habilitation`, `technicien_habilitation`, `site_habilitation_requise`, `famille_materiel`, `modele_materiel`, `taux_horaire`, `machine`, `forfait`, `intervention`, `technicien_calendrier`, `utilisateur_client_site`, et le décompte de `client` du côté visible) |

*Comment la date a été obtenue :* le dépôt a été **désuperficialisé**
(`git fetch --unshallow` — la session travaillait sur un clone tronqué à 33
commits, ce qui rendait la mesure impossible et l'aurait fait conclure trop
tôt), puis chaque commit de `main` en premier parent a été rejoué en comparant
le nombre d'entrées de `TABLES_CLOISONNEES` au nombre de regroupements de
`scripts/inventaire.mts`. La première inégalité est `97e8f95`.

**COMBIEN DE NUITS ? AUCUNE, et ce n'est pas une bonne nouvelle.** Le contrôle
aveugle **ne tourne pas la nuit** : il est câblé dans `db-migrate.yml`, déclenché
à la main. La veille nocturne (`pnpm veille`, `ci.yml`) joue sept autres
contrôles, aucun ne dépendant de cette population. Le décompte juste est donc
celui des **exécutions du flux de migration** sur la période — et il ne se lit
pas depuis le dépôt. *Je n'ai pas pu le dater ; je ne le devine pas.* Ce qui se
dit avec certitude : **toute exécution du flux entre ces deux instants a rendu un
vert qui ne prouvait rien de `site`, `machine` ni `intervention`**, et le rapport
du 09/09 au matin en cite au moins une (run #31, « aucun site, aucun contact,
aucune intervention » — un chiffre que l'on a lu comme un fait de la base).

## Ce qui a été écarté

**Porter la liste de 8 à 21 entrées** — c'est ce qu'ont fait les commits du
09/09, et c'était juste comme réparation, faux comme conclusion. *Vingt et un est
un nombre, et un nombre tenu à la main dérive comme les huit précédents.* La
liste a déjà dérivé cinq fois en trois jours ; rien n'indique qu'elle cesserait.

**Garder la liste et lui adjoindre un gardien de confrontation.** C'est le remède
du §9 (01/09) — deux lectures qu'on fait répondre côte à côte — et il ne
s'applique pas ici : les deux lectures tiraient leur population de la **même**
liste. Confronter deux aveugles ne rend la vue à personne.

## Décision

1. **La population vient du schéma.** `scripts/lib/tables-comptees.ts` dérive les
   tables comptées de `tablesPremiereCategorieI1` — la seule lecture du critère
   dans le dépôt, celle du périmètre d'audit — moins une liste d'exemptions
   nommées, chacune avec son motif écrit. Les témoins hors cloisonnement viennent
   de `REFERENTIELS_PLATEFORME`, liste close de I1, sans recopie.
2. **Toute table du schéma est comptée, témoin ou exemptée — exactement une des
   trois.** `ecartsCouverture` échoue sur une table qui n'est rien de tout cela,
   sur une exemption qui ne s'adosse à aucune table, sur une exemption sans
   justification, et sur une population vide. Le refus est prononcé **avant** la
   mesure, dans les deux scripts.
3. **La REQUÊTE aussi est fabriquée depuis la population.** Il n'existe plus
   d'endroit où une table puisse entrer dans la liste sans entrer dans la mesure :
   ce n'est plus un compteur à ne pas oublier, c'est une opération qui n'existe
   pas. *Effet de bord voulu : vingt et un allers-retours deviennent un seul —
   §9 du 23/08, on compte les allers-retours.*
4. **Zéro contre zéro n'est pas un résultat.** `ecartsMesureVide` refuse une
   comparaison dont les deux côtés sont vides sur toute la population, et le
   rapport NOMME, société par société, les tables comparées zéro à zéro. La
   phrase de conclusion ne les couvre plus.
5. **Le lecteur du schéma Prisma déménage** de `tests/unit/outils/` vers
   `scripts/lib/schema-prisma.ts`. C'est cette impossibilité pratique — un script
   d'exploitation ne pouvait pas partir du schéma — qui a produit la cécité.

## Le refus partiel, et pourquoi il n'est pas un refus

Une table dont les deux côtés valent zéro **pour une seule société** n'est pas un
écart : `forfait` naît vide par décision, `machine` et `contact` n'ont pas encore
de saisie. En faire un rouge serait la panne par le bruit du §9 (11/09) — *un
gardien dont le taux de fausses alertes conduit à ne plus le lire coûte plus
qu'il ne rapporte.* Mais ce n'est pas une preuve non plus, et c'est là qu'était
le trou : le rapport concluait « exactement les lignes de chaque société sous son
contexte », phrase vraie de sept tables et présentée comme vraie de vingt et une.

Elles sont donc **nommées et retranchées de ce que le rapport affirme**. Mesuré
sur la base de démonstration : `CODIMA-NC : 12 mesurée(s), 9 comparée(s) ZÉRO À
ZÉRO`, `CODIMA-EU : 9 mesurée(s), 12 comparée(s) ZÉRO À ZÉRO`. *Un lecteur voit
en trois secondes ce que la nuit n'a pas éprouvé — c'est très exactement ce que
personne n'a pu voir pendant deux jours et vingt et une heures.*

## Mise en échec — avant de le déclarer bon

Le refus a été mis en échec **sur le chemin de production**, pas seulement sur un
cas fabriqué : une société fantôme au décompte entièrement nul a été ajoutée à
`inventaire-controle.json`, et le contrôle est tombé en nommant les 21 tables et
en refusant de conclure. Sous le code d'avant, la même société passait au vert —
c'est le jumeau, joué au niveau unitaire dans
`tests/unit/db/tables-comptees.test.ts` : *`ecartsAvecContexte` ne trouve rien à
redire quand les deux côtés sont vides.*

Et la direction permissive est éprouvée à côté de chaque rouge, comme le §9 du
11/09 l'exige : `intervention` est comptée **parce qu'elle porte un `societe_id`
obligatoire**, `devise` ne l'est pas **parce qu'elle est un référentiel** — pas
parce que le gardien ne les regarde pas.

## LA MÊME MALADIE AILLEURS — ce qui a été regardé, et ce qui ne l'a pas été

*Une passe, pas une journée. Écrit avec ses limites.*

**Regardé :** les trente fonctions `ecarts*` exportées par `scripts/lib/`, une par
une, à la question « ton vert peut-il venir d'une population vide ? ».

**Trouvé :** deux recopies de la liste des témoins hors cloisonnement — une dans
`scripts/inventaire.mts` (`TABLES_TEMOINS`), une dans
`scripts/controle-cloisonnement.mts` (`compterTemoins`). Ni l'une ni l'autre
n'avait encore divergé ; toutes deux sont maintenant dérivées. Aucune autre
population vide n'a été trouvée : les contrôles qui observent la base portent
tous un témoin de non-vacuité explicite (`ecartsPolitiques`, `ecartsRlsDeclaree`,
`ecartsPrivilegesConsolidation`, `ecartsDeclencheurs`, `ecartsDurcissement
Partitions`), et les gardiens de listes closes échouent sur le RETRAIT autant que
sur l'addition, donc sur une liste vidée.

**Pas regardé :** les scénarios de `tests/isolation/` et de `tests/e2e/`, dont la
population est un répertoire et non une liste ; le harnais de fixtures ; les
gardiens de documents (`cablage-arbitrages`, `coherence-backlog`), dont la
population vient d'un fichier Markdown. *Ils peuvent porter la même maladie ; je
ne l'ai pas cherchée.*

## Conséquences

- Une table métier créée demain entre dans l'inventaire **le jour de sa
  migration**, ou fait rougir `pnpm verify` le jour même.
- `TABLES_RLS_FORCEE` hérite de la dérivation : une table cloisonnée nouvelle est
  réclamée en `ENABLE+FORCE` sans qu'aucune liste soit à compléter.
- Le rapport du contrôle distingue désormais **ce qu'il a mesuré** de **ce qu'il
  n'a pas pu mesurer**. C'est la règle du §9 du 06/09 appliquée à lui-même.

## Condition de réouverture

*Le jour où une table de la première catégorie de I1 devra légitimement sortir du
décompte comparé, elle entre dans `EXEMPTIONS_DECOMPTE` avec son motif — et si
aucun des deux motifs existants ne convient, c'est un arbitrage, pas une décision
de ticket.* Le critère se vérifie, il ne s'interprète pas : un motif nouveau est
une addition à une liste close.
