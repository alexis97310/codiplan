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

La cause (b) est, elle, **restée une hypothèse non vérifiable depuis le dépôt** :
la valeur de `MIGRATION_DATABASE_URL` est un secret, et une session ne la lit
pas. Deux observations l'écartent néanmoins sans la réfuter :

1. Si les instructions d'une même transaction changeaient de connexion, les deux
   `set_config($1, $2, true)` de `avecSociete` — qui sont **locaux à la
   transaction** — seraient perdus. La toute première écriture, celle de
   `societe`, tomberait alors sur la politique `id = app.societe_id` et
   échouerait en violation de politique, non en P2028, et à la 4ᵉ instruction,
   non à la 28ᵉ.
2. `prisma migrate deploy` a réussi. Il prend un verrou consultatif de **session**
   et le tient d'une instruction à l'autre — ce qu'un intermédiaire en mode
   transaction ne permet pas.

La correction porte donc sur (a), dans le code. La vérification de (b) reste
à faire du côté du secret, une fois, à l'œil : si l'hôte contient `-pooler`,
c'est le point d'entrée mutualisé, et il faut le remplacer par l'hôte direct.

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

### Ce qui reste ouvert

- Le seed est bavard : trente-quatre allers-retours pour écrire une société.
  Tant que la latence est de deux cents millisecondes, cela coûte sept secondes.
  Le jour où le socle grossira vraiment — lots 1 à 3 — le regroupement des
  écritures redeviendra la bonne réponse, et le test de budget le dira.
- L'hypothèse (b) n'est pas close. Elle se vérifie à l'œil sur le secret, et le
  README dit quoi y chercher.
