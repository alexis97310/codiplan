# `societe`, quatrième catégorie de cas — et non quatrième catégorie de tables

*Ticket D42. Arbitrage D42, complétant la rédaction de la première catégorie de
l'invariant I1. Suite immédiate de D41.*

## Contexte

**Rien n'était ouvert.** La politique de cloisonnement de `societe` existe depuis
L0-04 et s'écrit `id = current_setting('app.societe_id')::uuid`. Elle est
**éprouvée** : `tests/isolation/force-rls.test.ts` la met à l'épreuve comme les
autres, société positionnée et société absente. L'inventaire de
`scripts/inventaire.mts` **compte `societe` parmi les tables cloisonnées** — son
type `TableFille` n'existe même que pour dire « toutes les tables cloisonnées
*sauf* `societe` », c'est-à-dire pour désigner la forme particulière de cette
table, jamais son exclusion.

C'est donc **la phrase de l'invariant qui était incomplète, pas le
cloisonnement**. I1 écrivait « Tables métier — `societe_id NOT NULL`. C'est le
cas général, sans exception tacite. » Cette rédaction ne peut pas décrire la
table que `societe_id` **désigne** : une colonne qui pointerait vers la ligne
qui la porte serait une redondance, pas une garantie. La règle était juste pour
toutes les tables sauf une, et muette sur celle qui les fonde.

Le gardien d'exhaustivité de D41 l'a trouvée au premier passage, avec `parite`.
Le contraste entre les deux est ce qui rend ce ticket lisible : `parite` était un
**oubli de rangement** — une table réellement laissée hors catégorie ; `societe`
est un **défaut de rédaction** — une table correctement cloisonnée qu'aucune
phrase ne décrivait. Le même gardien a levé les deux ; ils ne se réparent pas au
même endroit.

## Options écartées

**Élargir la première catégorie à « cloisonnée d'une manière ou d'une autre ».**
La formulation la plus courte, et la plus coûteuse. Elle rendrait la règle
inapplicable mécaniquement : la table suivante qui se dirait « cloisonnée
autrement » entrerait sans décision, et le gardien de D41 n'aurait plus de quoi
la refuser. Une règle élargie ne se relit pas — c'est exactement le mécanisme qui
a produit les trois oublis de D34, D39 et D4.

**Faire de `societe` une cinquième catégorie.** Ce serait confondre une forme de
cloisonnement avec un régime de conservation. Les quatre catégories de I1 se
distinguent par **ce qu'elles autorisent** : cloisonnée, partagée en lecture,
technique et purgeable, identitaire et durable. `societe` est cloisonnée, point.
Elle n'autorise rien que les autres tables métier n'autorisent ; elle le fait par
une autre colonne. Une catégorie de plus dirait le contraire.

**Ajouter une colonne `societe_id` à `societe`, égale à `id`.** Rendre la règle
vraie en modifiant le schéma plutôt que la phrase. Une colonne dupliquant la clé
primaire, à maintenir cohérente par un `CHECK` ou un trigger, pour l'unique
bénéfice de faire passer un test statique. On ne déforme pas la base pour arranger
un gardien.

## Choix

**L'exception est nommée, non déduite.** La liste `CLOISONNEE_PAR_IDENTITE` du
gardien porte `societe`, et I1 l'écrit désormais mot pour mot : *`societe` fait
exception à la forme, non au fond : étant la table que `societe_id` désigne, elle
est cloisonnée par son identité (`id = app.societe_id`).* Une exception qu'on lit
vaut mieux qu'une règle qu'on élargit : la première se compte, la seconde se
suppose.

**Et cette liste est gardée comme les trois autres.** C'est une liste close de
plus, et la séquence D34–D41 vient précisément de montrer ce qui arrive à une
liste close que personne ne surveille. Celle-ci est même la plus exposée des
quatre : elle **dispense de la seule règle mécanique** de I1. Le gardien
`ecartsListeExceptions` échoue donc sur toute entrée autre que `societe`, comme
sur son retrait, avec un message qui dit ce qu'il faut faire : *toute addition
passe par un arbitrage, elle ne se décide pas dans un ticket.* Il est éprouvé sur
une addition fabriquée et sur une liste vidée — un gardien qu'on n'a pas vu
échouer est un décor.

## Conséquences

**Le gardien d'exhaustivité ne trouve plus rien.** Les deux tables du premier
passage sont rangées : `parite` par D41, `societe` par la rédaction que D42
corrige. Chaque table de `prisma/schema.prisma` appartient à exactement une
catégorie de I1, et la première catégorie décrit enfin les tables qu'elle
prétendait couvrir.

**Ce que les lots 1 à 3 doivent en retenir — et ce n'est pas un coût.** Chaque
table livrée aux lots 1 à 3 — `client`, `site`, `machine`, `intervention`,
`contrat` — portera `societe_id NOT NULL` ou passera par un arbitrage. D41
présentait cela comme le prix du gardien ; c'est **l'objectif**, et le CLAUDE.md
l'inscrit désormais comme tel, pour qu'aucun ticket futur ne le traite comme une
friction à contourner. Le seul moment où la question de cloisonnement se pose
sans effort est celui où la table est créée ; la reporter, c'est la retrouver
trois arbitrages plus tard sous la forme d'un oubli.

**Une leçon de méthode, distincte de celle de D41.** D41 disait : ne jamais
laisser une liste close être la seule source de vérité sur ce qu'elle prétend
couvrir. D42 ajoute : **un invariant qui a des exceptions doit les énumérer, pas
les sous-entendre.** « Sans exception tacite » était une intention, pas une
garantie — il aura fallu un gardien qui part du schéma pour découvrir que la
règle en avait une depuis le premier jour, et qu'elle marchait très bien.
