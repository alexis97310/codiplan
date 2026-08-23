# Le seed et la latence — pourquoi ce défaut ne peut pas se voir en local

## Contexte

Le 23 août 2026, le workflow « Migration de la base » échoue à l'étape de seed
sur la base hébergée. La migration, elle, passe : sept migrations trouvées,
aucune en attente, six secondes. Seul le seed tombe, après quinze secondes, sur
une erreur Prisma **P2028** — « Transaction not found. Transaction ID is
invalid, refers to an old closed transaction » — à `prisma/seed.ts:180`,
c'est-à-dire au premier `upsert` d'agence.

Le même seed passe en local en **trois dixièmes de seconde**.

Deux causes étaient plausibles et il fallait les départager, parce qu'elles ne
se corrigent pas au même endroit : l'une dans le code, l'autre dans un secret.

**(a) La transaction interactive dépasse son délai.** Prisma ferme une
transaction interactive au bout de 5 000 ms par défaut, et attend 2 000 ms au
plus pour obtenir une connexion. La transaction cloisonnée du seed enchaîne
des écritures **séquentielles** : la société, ses calendriers, chacune de ses
plages horaires, chacune de ses agences, chacun de ses écarts locaux. Depuis le
ticket L0-08, cette liste s'est allongée de vingt-et-une plages.

**(b) La connexion passe par le point d'entrée mutualisé de Neon.** En mode
transaction, un tel intermédiaire ne garantit pas qu'une même connexion serve
toute la transaction — ce qui casse précisément les transactions interactives.

### Ce qui a départagé les deux

Le journal des instructions de PostgreSQL, capturé sur un cluster jetable pour
une exécution complète du seed, donne le décompte exact :

| | |
|---|---|
| Instructions émises avant celle qui échoue | **67** |
| Position du `BEGIN` de la transaction fautive | 40ᵉ |
| Position du premier `INSERT INTO "agence"` | 67ᵉ |
| Donc, **dans** la transaction, instructions précédant l'agence | **27** |
| Instructions de la transaction complète | 34 |

Chaque instruction est un aller-retour complet vers Sydney. Quinze secondes pour
soixante-sept allers-retours donnent **~190 ms l'unité**, ce qui est l'ordre de
grandeur attendu entre un exécuteur GitHub et `ap-southeast-2`. À cette latence,
le plafond de 5 000 ms est atteint après vingt-six ou vingt-sept allers-retours
— soit exactement entre la **dernière plage horaire** et la **première agence**.

C'est cette coïncidence qui fait la démonstration : la cause (a) ne prédit pas
seulement *qu'*il y a échec, elle prédit *où*, et l'endroit prédit est celui
observé. Il faudrait une latence comprise entre 185 et 192 ms pour que le
plafond tombe précisément là, et c'est celle que la durée totale mesure.

La cause (b) est **écartée**. Elle n'a pas été vérifiée sur le secret — la valeur
de `MIGRATION_DATABASE_URL` ne se lit pas depuis le dépôt, et il n'y avait pas à
la demander — mais elle n'avait pas besoin de l'être : deux observations la
réfutent, et elles sont plus concluantes que ne le serait la lecture de l'hôte.

1. **Les instructions de cette transaction ont bien partagé une connexion.** Les
   deux `set_config($1, $2, true)` de `avecSociete` sont **locaux à la
   transaction**. Si une instruction ultérieure changeait de connexion, elle les
   perdrait, et la toute première écriture — celle de `societe` — tomberait sur
   la politique `id = app.societe_id` : **violation de politique à la 4ᵉ
   instruction**. Or la transaction a exécuté vingt-sept instructions sous ce
   contexte, dont vingt-et-une écritures cloisonnées de plages horaires, avant
   d'échouer en P2028 à la 28ᵉ. Un intermédiaire en mode transaction ne produit
   pas ce comportement ; il produit l'autre.
2. **`prisma migrate deploy` a réussi.** Il prend un verrou consultatif de
   **session** et le tient d'une instruction à l'autre — ce qu'un intermédiaire
   en mode transaction ne permet pas.

La correction porte donc sur (a), dans le code, et elle est complète : rien
n'est en attente du côté du secret. Ce qui reste écrit dans le README n'est pas
une réserve sur ce diagnostic, c'est une piste de dépannage pour un **futur**
P2028 qui ne s'expliquerait pas par le budget de temps.

## Options écartées

**Découper la transaction.** Une transaction par calendrier, une par agence :
chacune tient largement sous les 5 000 ms. Écartée sans hésitation. Le seed
écrit un socle dont les morceaux se référencent — `agence.calendrier_id` pointe
vers un calendrier, `calendrier_ferie.jour_ferie_id` vers un férié — et une
société dotée de ses calendriers mais privée de ses agences est un état que rien
ne rattrape : ni le rejeu du seed, qui repartirait du même endroit, ni un
opérateur, qui ne saurait pas où il s'est arrêté. Faire tenir le code dans un
délai mal choisi en abandonnant l'atomicité, c'est réparer l'horloge en
raccourcissant l'heure.

**Grouper les écritures.** Remplacer les boucles d'`upsert` par des
`createMany`/`updateMany`, pour passer de trente-quatre allers-retours à trois
ou quatre. Séduisant, et c'est bien la cause profonde — le seed est bavard. Mais
`createMany` ne fait pas d'`upsert` sur clé naturelle sans réécrire
l'idempotence à la main, et l'idempotence du seed est une propriété qu'on ne
troque pas contre de la vitesse dans un correctif d'incident. La porte reste
ouverte, elle n'est pas prise ici.

**Relever le délai par défaut de Prisma pour tout le dépôt.** Écartée : les
chemins de session font deux ou trois allers-retours et doivent continuer
d'échouer vite si quelque chose les bloque. Un délai de deux minutes sur une
requête d'interface est un défaut, pas une protection. Les délais se posent donc
là où le besoin existe — le seed — et `avecSociete` les accepte en argument
facultatif.

## Choix

`prisma/seed-delais.ts` porte trois constantes et l'arithmétique qui les
justifie : une latence majorée (500 ms, contre ~190 ms observés), une durée
maximale de transaction (120 s), une attente de connexion (30 s, pour le réveil
d'une base Neon en veille). `avecSociete` et `avecSocieteEtRole` acceptent un
argument `delais` facultatif ; omis, les défauts de Prisma s'appliquent, et
c'est ce que veulent les chemins de session.

Le seed annonce chaque section **avant** de l'exécuter, avec le temps écoulé
depuis son démarrage. L'ordre importe : la dernière ligne du journal désigne
alors la section qui a échoué, et non la dernière qui a réussi. Le préfixe en
secondes n'est pas décoratif — c'est l'écart entre deux lignes voisines qui dit
la latence, et c'est elle qui manquait pour lire l'incident.

## Conséquences

### Ce qui rend ce défaut invisible en local, et le restera

C'est le point que ce document existe pour écrire.

Le seed n'a pas de bug. Son code est identique sur les deux chemins, il produit
les mêmes lignes, il est idempotent des deux côtés. **La seule variable est la
latence** : une milliseconde par aller-retour en local, cent-quatre-vingt-dix
depuis un exécuteur GitHub vers Sydney. Un facteur deux cents.

Il s'ensuit qu'**aucune suite de tests du dépôt ne pouvait attraper ce défaut** :

- `pnpm test:isolation` monte un PostgreSQL **jetable et local** — c'est même
  une exigence, un test d'isolation ne doit jamais viser la base hébergée. Sa
  latence est nulle par construction.
- `pnpm verify` ne se connecte à aucune base distante, et ne le doit pas.
- Le workflow de migration est le **seul** chemin qui touche la base hébergée,
  et il est déclenché **à la main** — donc il ne s'exécute pas dans une boucle
  de vérification, par décision (voir
  `2026-08-20-migration-par-github-actions.md`).

Autrement dit : le seul environnement où le défaut se manifeste est aussi le
seul qui ne soit jamais exercé automatiquement. Le budget de temps d'une
transaction est une propriété que le dépôt ne peut pas **mesurer** ; il peut
seulement la **calculer**. C'est ce que fait `tests/unit/seed-delais.test.ts` :
il compte les allers-retours du seed, les multiplie par une latence majorée, et
échoue si le produit dépasse le délai fixé. Il ne prouve pas que le seed passe ;
il prouve que personne n'a fait grossir le seed sans revenir se poser la
question. C'est la même mécanique que le contrôle d'horizon des fériés (D46) :
une propriété qui se dégrade en silence exige un gardien qui la recalcule, parce
qu'aucun test vert ne la signalera.

Un second gardien, statique, lit `prisma/seed.ts` et refuse une transaction qui
s'en remettrait au délai par défaut. Il a été éprouvé en retirant réellement
`DELAIS_SEED` du seed, pas seulement sur un cas fabriqué — CLAUDE.md §9,
21 août 2026.

### Un gardien qui a mordu au passage, et ce qu'on n'en a pas fait

Le journal de progression affiche des dixièmes de seconde. La première version
les composait avec un arrondi d'affichage, et le gardien I3 — « jamais de
décimales en dur, tout formatage passe par `formatMoney` » — l'a refusé.

Il avait raison de ne pas distinguer une durée d'un montant : un gardien qui
juge l'intention de celui qui écrit ne garde plus rien. Deux sorties étaient
donc possibles, et une seule est acceptable. Faire passer la durée par
`lib/money` aurait contenté le gardien **en franchissant la frontière que D45
vient d'établir** entre le temps et l'argent — un module monétaire qui formate
des secondes est le premier pas vers un module monétaire qui arrondit des
heures. La sortie retenue est l'autre : le littéral de décimales a été
**supprimé**, et le dixième de seconde se compose par division entière. Aucun
import de `lib/money` n'existe dans `prisma/`, et il ne doit pas en apparaître.

### Ce que le test de budget suppose, et ce qu'il faudra faire quand il avertira

Un gardien qui repose sur une hypothèse non écrite est un gardien qu'on
désarmera sans le savoir. Voici les siennes.

**La latence retenue : 500 ms l'aller-retour** (`LATENCE_PESSIMISTE_MS`), contre
**~190 ms mesurés** le 23 août 2026. Le facteur deux et demi n'est pas de la
prudence décorative, il couvre trois choses nommables : la **gigue** d'un réseau
transpacifique, qui ne tient aucune moyenne à la minute près ; le **réveil** d'une
base Neon mise en veille, qui rallonge les premiers allers-retours d'une
exécution ; et le fait que la mesure vient d'**une seule exécution, un seul jour,
depuis un seul exécuteur**. Une valeur au plus près de la mesure produirait un
gardien vert la veille de l'incident suivant.

**Ce que le test vérifie, et ce qu'il ne vérifie pas.** Il vérifie que
`allersRetoursTransaction(societe) × LATENCE_PESSIMISTE_MS < DUREE_MAXIMALE_MS`.
Il ne vérifie pas que le seed passe : aucun test du dépôt ne le peut, pour les
raisons dites plus haut. Il ne mesure rien non plus — il **recalcule un budget**.
Son décompte suit la forme de `seed.ts` et se relit avec lui ; un décompte
légèrement faux ne casse rien, un décompte absent laisserait revenir l'incident.

**Ce qu'il faut faire le jour où il échoue — et ce qu'il ne faut surtout pas
faire.** Relever `DUREE_MAXIMALE_MS` une seconde fois serait la mauvaise
réponse : le délai n'est pas la grandeur qui a bougé, c'est le nombre
d'allers-retours. Un délai qu'on relève à chaque avertissement finit par ne plus
rien mesurer, et l'échec réapparaît sous une autre forme — un `timeout-minutes`
de workflow, un verrou tenu trop longtemps.

**La réponse structurelle est de réduire le nombre d'allers-retours**, et elle
est déjà connue. Deux jeux de données du seed sont écrits **en bloc** — ils
n'existent que comme ensembles, et personne n'en modifie une ligne isolément :

| Données de référence écrites en bloc | Lignes aujourd'hui | Écritures |
|---|---|---|
| `jour_ferie` (2 territoires × 3 années) | 69 | 69, une par ligne |
| `calendrier_plage` (3 calendriers) | 31 | 31, une par ligne |
| **Total** | **100** | **100** |

Ces cent instructions peuvent devenir une poignée d'écritures groupées, une par
bloc. Dans la transaction qui a échoué, cela ramènerait à elles seules
**trente-quatre allers-retours à quatorze** : vingt-et-une plages remplacées par
une écriture.

**Ce qui ne bouge pas.** Les `upsert` idempotents sur clé naturelle — `societe`,
`agence`, `calendrier`, `utilisateur`, `utilisateur_societe`, `utilisateur_client`
— restent tels quels. Ils portent l'idempotence du seed entité par entité, ils
sont peu nombreux, et les regrouper échangerait une propriété qui compte contre
quelques centaines de millisecondes qui ne comptent pas. L'atomicité ne bouge
pas davantage : une écriture groupée s'exécute dans la même transaction.

Ce travail est inscrit au backlog sous **L0-12**, avec pour déclencheur explicite
le premier avertissement du test de budget. Une réserve qu'on sait déjà comment
lever n'est pas une dette.
