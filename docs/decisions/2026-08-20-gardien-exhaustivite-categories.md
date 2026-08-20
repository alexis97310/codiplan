# Un gardien qui part du schéma, pas de la liste

*Ticket L0-06b. Arbitrage D41, réparant la cause commune à D34, D39 et D4.
Invariant I1.*

## Contexte

Trois oublis du même type se sont succédé en deux jours. `second_facteur` et
`utilisateur` manquaient à la liste close de D34 ; `parite` manquait à celle de
D4. À chaque fois, le même enchaînement : une liste est fermée un jour, une
décision ultérieure crée une table — D20 remplace `devise.parite_reference` par
`parite`, L0-06 ajoute le greffon second facteur —, et personne ne revient ranger
la nouvelle venue.

Le résultat est une liste qui garde **l'autorité d'une décision** et prend **le
contenu d'un oubli**. C'est pire qu'une liste ouverte : une liste ouverte se
relit, une liste close ne se relit plus — c'est même son intérêt. Et l'invariant
qu'elle sert continue de s'énoncer comme s'il couvrait tout, alors qu'il ne
couvre plus que ce qu'on avait en tête le jour où on l'a écrit.

Réparer le troisième cas à la main ne protège pas du quatrième. D41 ajoute donc
`parite` à la liste — c'est un oubli à réparer, pas une décision à prendre — mais
l'essentiel est ailleurs : dans le gardien qui rend le quatrième oubli
impossible.

## Options écartées

**Se contenter d'ajouter `parite`.** C'est ce que les deux arbitrages précédents
avaient fait, chacun pour ses tables. Le troisième cas prouve que la méthode ne
converge pas : à ce rythme, chaque nouvelle table métier des lots 1 à 3 est une
occasion de recommencer. Écarté.

**Relire les listes à chaque revue.** Une discipline humaine contre un oubli
humain, appliquée par la personne qui vient précisément d'ajouter la table sans y
penser. C'est demander de la vigilance là où il faut un mécanisme.

**Rendre la liste ouverte — tout ce qui n'est pas cloisonné est réputé
référentiel.** Cela supprimerait les oublis en supprimant la garantie : une table
métier livrée sans `societe_id` deviendrait un référentiel de plateforme par
défaut, c'est-à-dire lisible par toutes les sociétés. Exactement la panne que I1
existe pour empêcher. Écarté sans hésitation.

**Poser la contrainte en base plutôt qu'en test.** Séduisant — un `CHECK` sur le
catalogue, ou un trigger d'événement DDL. Mais la faute se commet dans
`prisma/schema.prisma`, en revue, avant toute migration ; la base ne la verrait
qu'à l'application, c'est-à-dire trop tard et sur le mauvais poste. Le contrôle
doit tomber là où l'erreur s'écrit.

## Choix

**Le gardien renverse la charge de la preuve.** Les autres gardiens statiques du
dépôt partent d'une liste et vérifient que le code s'y conforme. Celui-ci part du
**schéma** : `modelesDuSchema` énumère toutes les tables réellement déclarées, et
chacune doit trouver **exactement une** des quatre catégories de I1 — cloisonnée
par `societe_id NOT NULL`, référentiel de plateforme, technique
d'authentification, identité de plateforme.

**Zéro et deux échouent également.** Zéro, c'est l'oubli : la table n'a nulle part
où se ranger, et cela tombe le jour où elle est écrite. Deux, c'est l'inverse et
c'est aussi grave : une table technique d'authentification qui se mettrait à
porter `societe_id NOT NULL` cesserait d'être technique sans que personne ne
l'ait décidé — la liste dirait une chose et le schéma une autre, et l'une des
deux serait fausse.

**Trois détails qui font la différence entre un gardien et un décor.** Le message
d'échec **nomme la table et rappelle les quatre catégories**, pour qu'on
comprenne ce qu'on doit faire sans ouvrir le CLAUDE.md. Le `?` est significatif :
un `societe_id String?` est la forme des référentiels surchargeables de D4, pas
celle d'une table métier — les confondre rendrait la deuxième catégorie
inapplicable. Et le gardien est **éprouvé d'abord sur des schémas fabriqués** —
une table sans catégorie, une table à deux, les quatre formes légitimes —, comme
ceux de D34 et D39 : une classification trop permissive rendrait le test vert sur
n'importe quoi, y compris sur le schéma d'avant D41.

## Conséquences

**Le premier passage a trouvé deux tables, pas une.** `parite`, attendue, que D41
range. Et **`societe`**, qui ne l'était pas : elle est bien cloisonnée — la
politique de L0-04 s'écrit `id = app.societe_id` — mais **par son identité**, pas
par une colonne `societe_id NOT NULL`. Rien n'est ouvert, le cloisonnement est en
place et éprouvé par `force-rls.test.ts` ; c'est la **rédaction** de la première
catégorie de I1 qui est incomplète. Corriger un invariant relevant d'un
arbitrage, le gardien **nomme l'exception** (`CLOISONNEE_PAR_IDENTITE`) plutôt que
d'assouplir sa règle, et le point est porté au registre de `docs/arbitrages.md`.
Une exception qu'on lit vaut mieux qu'une règle qu'on élargit.

**Les listes closes restent recopiées à la main dans le gardien**, et c'est
délibéré — même parti pris que l'énumération des rôles. Un gardien qui tirerait
ses listes de la même source que le code ne vérifierait rien ; ici, c'est la
constitution qui est confrontée au schéma, et une divergence entre les deux fait
tomber le test.

**Ce que cela coûte aux lots suivants.** Chaque table livrée aux lots 1 à 3 —
`client`, `site`, `machine`, `intervention`, `contrat` — devra porter
`societe_id NOT NULL` ou passer par un arbitrage. C'est le comportement voulu, et
c'est aussi le seul moment où la question se pose sans effort : au moment de
créer la table, pas trois arbitrages plus tard.
