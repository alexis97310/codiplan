# Les formes de politique RLS, et le contrat des fixtures d'isolation

*Ticket R0-a — traitement des écarts de la revue R0 qui peuvent produire un
défaut réel dès L1-01. Invariant I1 ; arbitrages D4, D10, D22, D32, D36, D42,
D50 ; tickets L0-04, L0-05, L0-10.*

---

## 1. Contexte

La revue R0 a mesuré l'écart entre un backlog écrit avant D1 et cinquante-deux
décisions. Elle a classé quatorze écarts. Ce ticket n'en traite que ceux qui
produisent un **défaut réel dès le premier ticket du lot 1** — les autres
périment un plan, celui-ci ouvrirait une brèche.

Deux d'entre eux ont la même forme, et c'est cette forme qui rend le ticket
cohérent : **une source qu'on croit juste, et une réparation qu'on croit
correcte.**

- **É9 — « la forme imposée ».** Le ticket L0-04 énonce une forme de politique
  RLS au singulier. Il y en a cinq en vigueur. Une session du lot 1 qui recopie
  cette phrase sur `client` ou `site` écrit une politique fausse **dans le sens
  permissif** : elle perd le filtre portail de D10 et le chemin QR de D22. La
  revue l'appelle « le texte de ticket le plus dangereux des trois lots », et
  c'est le seul défaut du dépôt qu'on produit **en obéissant**.
- **É14 — le contrat des fixtures.** `client`, `site`, `machine` et
  `modele_materiel` existent comme **tables fixtures** du harnais
  d'isolation, avec les politiques que les vraies tables devront porter. Ce
  contrat ne vivait que dans des commentaires de test. Le jour où L1-01 crée la
  vraie table `client`, le harnais échoue sur `CREATE TABLE` — et **la
  réparation la plus naturelle est la mauvaise** : supprimer la fixture,
  pointer les scénarios sur la vraie table, lui donner la clause société seule.
  Tout redevient vert, sur moins de choses.

C'est la vacuité du §9 sous sa forme la plus difficile à voir : non pas un
gardien qui ne regarde rien, mais **un gardien à qui l'on retire ce qu'il
regardait**.

## 2. Options écartées

**Réécrire les six politiques du lot 0 pour en retirer la branche
`OR societe_id IS NULL`.** C'était la façon la plus simple de rendre la forme
« société » exacte : une seule écriture, aucun cas particulier. Écartée pour
deux raisons. La branche est **inerte** sur une colonne `societe_id NOT NULL` —
aucune ligne ne peut la satisfaire —, donc la réécriture ne corrigerait aucun
défaut ; et toucher une politique de cloisonnement appliquée à une base réelle
relève du §8 du CLAUDE.md (« tout ce qui touche au cloisonnement : s'arrêter,
exposer, attendre »). Le gardien ne l'interdit donc pas : **il mesure son
inertie**, et la nomme le jour où elle cesse. Une table nouvelle s'écrit sans
elle, et le CLAUDE.md le dit.

**Lire les politiques dans le SQL des migrations**, comme `perimetre-audit` lit
les déclencheurs. Écartée parce que c'est plus faible sur tous les axes. Le SQL
demande d'éprouver les six formes équivalentes du §9 ; le catalogue les dissout
— `pg_policies` rend l'expression **analysée**, si bien que la graphie (forme
1), l'enveloppe `DO $$ … $$` (forme 2), la pose en deux temps (forme 3) et
jusqu'au nom assemblé à l'exécution (forme 6, l'angle mort avoué de tout gardien
statique) produisent tous une ligne de catalogue ordinaire. **C'est l'état final
qui est lu, jamais le verbe qui l'installe.**

**Écrire le contrat des fixtures dans le CLAUDE.md, et s'arrêter là.** C'est la
recommandation de la revue, et elle est nécessaire — mais insuffisante : une
prose ne fait échouer personne. La revue demandait elle-même mieux : « les
scénarios D10/D22 doivent rester **plus nombreux** après la reprise, jamais
moins ». Cela se compte.

## 3. Décision

**Les cinq formes sont écrites au pied de I1**, chacune avec son cas et une
table existante qui la porte, et **celle qui ne s'applique jamais à une table
métier ordinaire est nommée avec sa raison** : la forme « référentiel ». Ses
deux moitiés sont fausses séparément — sa lecture `USING (true)` ouvre toutes
les lignes à toutes les sociétés ; son écriture `app_est_role_editeur()` donne
le droit au salarié de l'éditeur et le retire à la société propriétaire,
l'inverse exact de ce que le §22.5 promet au client. Le texte de L0-04 est barré
sur place et renvoie ici : on corrige la source, on ne s'aligne pas sur elle en
silence (méthode de D44).

**Un gardien mesure la forme en base**, jamais dans une déclaration :
`scripts/lib/politiques-rls.ts`, partagé par `tests/isolation/politiques-rls.test.ts`
(base jetable) et `scripts/controle-cloisonnement.mts` (base hébergée), comme
`rls-declaree.ts` l'est déjà. Il part des **colonnes observées** — `societe`
par exception, plus toute table portant `societe_id` — et non d'une liste :
c'est le renversement de D41 appliqué aux politiques.

**Le contrat des fixtures devient structurel**, tenu par trois gardiens
indépendants dans les trois sens :

1. la **forme**, mesurée dans `pg_policies` — fixture ou table réelle, le
   gardien ne fait pas la différence : remplacer l'une par l'autre avec la
   clause société seule le fait rougir, et il nomme le filtre perdu ;
2. la **liste close `TABLES_PARC`**, dont le **retrait** d'une entrée est
   refusé — ici c'est le retrait, et non l'addition, qui ouvre la brèche ;
3. le **plancher de scénarios** par exigence de L0-05
   (`tests/unit/db/contrat-isolation.test.ts`), qui compte les appels
   `exigence("…")` dans `tests/isolation/` et refuse que le nombre baisse. Il
   est **statique** : il parle encore le jour où le harnais ne démarre plus,
   c'est-à-dire précisément le jour de L1-01.

Et `tests/isolation/setup/global.ts` **ne crée plus la fixture quand la vraie
table existe** : il s'efface, laisse les gardiens juger la table réelle, et
écrit sur sa sortie ce qui reste dû. C'est le seul message du dépôt rédigé pour
une session qui n'existe pas encore, à l'endroit et à la seconde où la faute se
commettait.

**Deux points sont enregistrés sans être construits**, parce que les
construire maintenant serait prématuré et les taire serait pire :

- **Le conflit double du lot 5 (É1)**, au registre, avec sa phrase mesurée :
  *la première ligne du repli portable de D36 fait passer `pnpm verify` au
  rouge, deux fois* — `motifRefusReporting` qui exige `BYPASSRLS` du rôle même
  pour lequel le repli existe, et le gardien `SECURITY DEFINER` de D50 dont la
  liste d'exceptions est close et vide alors que le repli **est** une fonction
  `SECURITY DEFINER`. Les deux remèdes sont écrits ; les prendre est un
  arbitrage du lot 5.
- **D32 reçoit une maison, et une seule (É2)** : le ticket **L7-03**. Ni lot
  seul, ni ligne au registre, ni les trois — un point rangé à trois endroits
  est un point qu'on croit rangé, et c'est la maladie que É4 a diagnostiquée
  sur le registre. Le lot 7 parce que le §22.5 est tenu : un rôle éditeur n'a
  aucune habilitation par défaut, il n'y a **rien à journaliser tant que la
  console éditeur n'existe pas**.

## 4. Conséquences

**Un gardien a trouvé un défaut dans le gardien, et il faut le dire.** La
première rédaction de `tablesPremiereCategorie` ne retenait que les colonnes
`societe_id NOT NULL`. L'épreuve « la branche `OR societe_id IS NULL` devenue
vivante » — écrite comme le §9 l'exige, en retirant réellement le `NOT NULL` —
est passée au **vert** : la table quittait le périmètre du gardien au lieu d'y
être condamnée. **Le contrôle passait au vert sur le geste même qui ouvre la
porte qu'il surveille.** C'est la vacuité du §9 apparue dans le gardien écrit
pour la combattre, et seul son jumeau pouvait la voir. La nullité est désormais
un **écart**, jamais une sortie.

**É12 est mesuré, et son résultat est écrit au registre.** Onze exécutions
planifiées depuis le 20 août, **toutes réussies** — la première question n'a
donc jamais été posée à la base et ne peut l'être qu'en produisant une nuit
rouge. Ce qui se mesure : la notification d'un flux planifié part au dernier
compte ayant modifié le `cron`, ici le propriétaire, **la boîte même où les deux
échecs manuels du 20 août sont restés non lus**. La seconde question se répond
non : la règle des 60 jours ne vise que les dépôts **publics**, et celui-ci est
privé — mais la protection tient alors à un **attribut du dépôt**, qui change
d'un clic. La contre-mesure est **proposée et non construite** : une issue
ouverte automatiquement sur échec nocturne, **et** un battement de cœur qui
échoue si la dernière exécution planifiée est trop ancienne. Les deux sont
indépendants, comme le préventif et le détectif des partitions du 30/08 : le
premier dit qu'une nuit a rougi, le second dit que les nuits ont cessé. **Sans
le second, une planification désactivée produit zéro échec, donc zéro alarme —
et le silence a exactement la forme du succès.**

**Ce qui reste hors de portée, et qui se dit plutôt que se tait.** Le gardien de
forme ne juge que les tables **présentes dans la base observée** : `client`,
`site` et `machine` n'existent pas en production et y seront jugées le jour où
la migration les crée — comme `perimetre-audit` juge le déclencheur d'audit.
Sur la base jetable elles existent en fixtures et sont jugées dès aujourd'hui.
Et un plancher de scénarios se baisse : un chiffre dans `contrat.ts`. C'est
délibéré — le geste **se voit dans une revue**, là où la suppression d'un
fichier de test ne se voyait pas. On ne rend pas un test creux impossible à un
adversaire ; on le rend impossible **par accident**.

---

## 5. L'espèce nouvelle, et l'audit qu'elle a déclenché

Le défaut trouvé au §4 n'est **pas** une assertion creuse : l'assertion était
juste. C'est la **POPULATION** qui s'auto-sélectionnait pour exclure le cas à
attraper. Filtrer sur `NOT NULL` fait sortir du périmètre la table qui perd son
`NOT NULL` — c'est-à-dire le geste même qu'on surveille.

**La forme générale, inscrite au §9 du CLAUDE.md :** *tout gardien dont le
critère de sélection porte sur une propriété qu'il est censé faire respecter
s'aveugle exactement là où il compte. Un `WHERE` qui recoupe l'assertion est un
trou.* La question à poser à chaque filtre : **l'objet qui viole ma règle est-il
encore dans ma population ?** La parade est toujours la même — élargir la
population et faire de la propriété une **assertion**.

Les gardiens **qui sélectionnent** ont été audités sous cet angle. Trois
constats, et deux d'entre eux sont mesurés plutôt que raisonnés.

### Ce qui a été corrigé (mécanique, aucune règle touchée)

**Quatre listes d'exemption sur cinq ne prouvaient pas leur adossement.** Une
exemption est une **sélection négative** : `sans-decimales-en-dur`,
`sans-fuseau-en-dur`, `sans-date-feriee-en-dur` et `conversion-reservee`
retirent du périmètre un chemin nommé. Le jour où ce fichier est renommé,
déplacé ou scindé, l'entrée survit et ne protège plus rien — silencieusement,
puisqu'une exemption qui ne s'applique à personne ne fait échouer personne — et
le premier fichier qui reprendra ce chemin héritera d'une exemption que personne
ne lui a accordée. `sans-date-courante-implicite` portait déjà le témoin ; les
quatre autres le portent désormais. **Éprouvé** : l'exemption repointée vers
`prisma/seed-donnees.ts` fait échouer le gardien en nommant le chemin mort.
Aucune règle, aucune liste close, aucun périmètre n'a bougé.

### Ce qui est rapporté et NON corrigé

**1. Le gardien des chaînes visibles (L0-11) perd sa population par le geste
même qui masque la faute — mesuré.** Sa population est faite des fichiers
portant l'une des trois marques, dont « rend du JSX ». Or `litterauxVisibles`
ne résout un identifiant que vers une constante **du même fichier**. Mesuré sur
le vrai analyseur, avec le même texte français :

| Écriture | Marques | Chaînes détectées |
|---|---|---|
| libellé écrit dans le composant | `rend du JSX` | **2** |
| le même, sorti dans `libelles.ts` | **aucune** | 0 |
| le composant qui le consomme | `rend du JSX` | **0** |

La faute disparaît entièrement. Et le geste qui l'efface — « sortir les libellés
dans un module de constantes » — est **exactement ce qu'un développeur pris par
ce gardien ferait spontanément**. C'est la même espèce sous une autre forme :
non pas un `WHERE` qui recoupe l'assertion, mais une population qu'on quitte en
déplaçant la faute. Non corrigé : la parade demande de résoudre les constantes
**à travers les imports** (graphe de modules, alias, ré-exports), ce qui n'est
pas mécanique et étend le périmètre d'une règle du §5.5.

**2. Le périmètre statique est une liste de cinq répertoires, recopiée dans huit
gardiens.** `["app", "components", "lib", "prisma", "scripts"]`. Tout ce qui
vit **à la racine** en sort. Aujourd'hui sans conséquence — seuls des fichiers
de configuration s'y trouvent (`next.config.ts`, `prisma.config.ts`,
`playwright.config.ts`, `vitest.config.mts`) — mais `middleware.ts` est un
emplacement **standard** de l'App Router, et c'est le domicile naturel de la
bascule de société. Il échapperait à huit gardiens à la fois, en silence. Non
corrigé : élargir le périmètre change ce que huit règles couvrent, et deux
d'entre elles deviendraient rouges sur des fichiers de configuration. **À
trancher avant le premier `middleware.ts`, c'est-à-dire au lot 1.**

### Ce qui a été vérifié et jugé SAIN — l'antidote, nommé

L'audit ne rapporte pas que des trous : les cas sains disent quelle forme prend
la parade, et il vaut mieux la nommer que la redécouvrir.

- **Le détectif des partitions** ne compte les lignes de la partition par défaut
  que si elle existe. Ce serait la même espèce — le contrôle dépend d'un filet
  dont l'absence le rendrait vert — **si `ecartsPartitionDefaut` ne faisait pas
  de cette absence un écart à part entière**. Elle en fait un, avec sa raison.
- **`perimetre-audit`** saute les tables du périmètre absentes du schéma, ce qui
  est une sélection ; le scénario « les entités encore sans table sont
  exactement celles des lots à venir » ferme le trou en nommant la liste.
- **Les exemptions par emplacement** — `lib/money/`, `lib/theme/`,
  `lib/reporting/` — ne sont pas des angles morts : elles **sont** la règle
  (« point de passage unique »), et `sans-couleur-en-dur` éprouve déjà la forme
  4 du §9 sur la sienne.

**Le motif commun de tous les cas sains est le TÉMOIN** : *zéro observé est un
échec*. C'est déjà l'antidote de la vacuité ; l'audit montre qu'il est aussi
celui de l'auto-sélection, à une condition — que le témoin porte sur la
**population**, et non sur le résultat.
