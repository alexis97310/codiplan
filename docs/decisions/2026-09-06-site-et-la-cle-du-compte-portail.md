# Le site d'intervention, et la clé du compte portail

_Ticket L1-02 — 6 septembre 2026._

## Contexte

Deux choses sont livrées ensemble, et c'est délibéré : la table `site` avec sa
couche serveur, et la clé étrangère `utilisateur_client → client` que L1-01
avait laissée ouverte. L1-01 les avait nouées lui-même — « chaîner une moitié de
D10 ici et l'autre au ticket suivant scinderait une seule décision : que devient
un compte portail quand son client disparaît ? »

## La forme de la politique, DÉDUITE

`scripts/lib/politiques-rls.ts` tient cinq formes. La déduction pour `site` :

| Forme | Pourquoi elle ne convient pas — ou convient |
| --- | --- |
| **référentiel** | Sa lecture est `USING (true)`. Un site est la donnée d'un client, pas un fait de plateforme comme la parité du franc Pacifique. |
| **identité** | Ne vise que `societe`, seule table que `societe_id` désigne (D42). `site` porte un `societe_id`, elle n'en EST pas un. |
| **journal** | Ne vise que `journal_audit` (I8). |
| **société** | Insuffisante, et c'est le point. Deux clients d'une même société ne sont pas séparés par le filtre société ; et **deux sites d'un même client ne sont séparés par aucun des deux premiers filtres**. |
| **parc** | La seule qui couvre les trois séparations. Déjà déclarée pour `site` dans `TABLES_PARC`, avec `perimetre: true`. |

**Aucune sixième forme n'est nécessaire, et la question méritait d'être posée
plutôt que supposée.** `site` est la table où les TROIS filtres du parc mordent
ensemble ; `client` n'en portait que deux, parce qu'il n'y a pas de site
au-dessus d'un client. La colonne de périmètre est ici `id` : c'est le site
lui-même que `utilisateur_client.perimetre_sites` énumère.

C'est RG-DRO-01 — « un client n'accède qu'aux données de son propre
**périmètre** » —, et `app.perimetre_sites` n'existe que pour dire ce périmètre.

## Ce que la mesure a trouvé, et qui n'existait que sur la base hébergée

**`FORCE ROW LEVEL SECURITY` rend un bloc de diagnostic de migration
AVEUGLE — mais seulement là où personne ne regarde.** Mesuré le 06/09 sur un
propriétaire non superutilisateur, deux lignes en table :

| Configuration | Lignes vues sans contexte société |
| --- | --- |
| propriétaire non superutilisateur, `FORCE` actif | **0** |
| le même, `NO FORCE` | 2 |
| superutilisateur (le rôle de migration en local) | 2 |

La réparation de l'habilitation orpheline devait donc lire `client` et
`utilisateur_client` depuis une migration. Écrite naïvement, elle aurait compté
**zéro orphelin**, serait passée au vert, et aurait posé la clé — qui aurait
ensuite échoué sur un message de PostgreSQL ne disant ni quoi ni pourquoi. Et
elle aurait été verte en local, où le rôle de migration est superutilisateur et
contourne RLS. **Le seul environnement où le défaut existe est le seul qui ne
soit jamais exercé** — la leçon du 23/08, mot pour mot.

La levée de `FORCE` est donc explicite, bornée à la transaction, et rendue dans
la même transaction. Surtout, le bloc **refuse de compter** tant qu'il n'a pas
constaté que la levée a eu lieu : c'est un témoin de non-vacuité qui porte sur
le MÉCANISME de l'aveuglement plutôt que sur un décompte, qu'un zéro légitime
rendrait muet. Éprouvé par retrait — les deux `NO FORCE` retirés, la migration
refuse en nommant la cause au lieu de ne rien voir.

**Second défaut, trouvé au même endroit : la réparation faisait échouer le
journal d'audit.** `utilisateur_client` est auditée (D55), donc le `DELETE`
déclenche `journal_audit_tracer()`, dont l'`INSERT` est gardé par une politique
ancrée sur `societe_id = app.societe_id`. Sans contexte :

```
ERROR: new row violates row-level security policy for table "journal_audit"
```

Deux sorties. Lever `FORCE` sur le journal aussi — desserrer la garantie du
journal pour réparer une donnée. Ou poser le contexte société avant de
supprimer. **C'est la seconde**, et le raisonnement compte plus que le geste :
une réparation faite par une migration reste une suppression sur une table
auditée. Elle se journalise, elle ne se soustrait pas à I8. La suppression se
fait donc société par société, et la ligne d'audit part sous la bonne société —
mesuré : `entite=utilisateur_client, action=suppression`, avec le client visé
dans `valeurs_avant`.

*Corollaire hors périmètre de ce ticket, relevé et non corrigé :* le bloc de
garde de la migration `20260823130000_territoire_du_ferie_reference` lit
`agence` et `societe`, toutes deux sous `FORCE`. Sur la base hébergée, il voit
donc zéro agence et ne peut pas refuser. La migration étant déjà appliquée, elle
est immuable ; le point est porté au registre.

## Les deux moitiés de la clé, et pourquoi l'une est impossible

**`utilisateur_client → client` est posée, et elle est COMPOSITE** —
`(societe_id, client_id)` vers `(societe_id, id)`, sur le modèle de D48. Une clé
sur `client_id` seul aurait laissé un compte portail désigner le client d'une
autre société : les contrôles d'intégrité référentielle contournent les
politiques RLS par construction en PostgreSQL, et le verrou aurait été muet là
précisément où le cloisonnement doit mordre. Les deux actions refusent
(`RESTRICT`/`RESTRICT`) : `CASCADE` retirerait des habilitations sans que
personne ne l'ait demandé, et ni `client.id` ni `client.societe_id` ne changent.

**La ligne orpheline n'était pas l'empêchement, elle était la démonstration.**
L'argument de L1-01 — « on ne peut pas poser la clé à cause de cette ligne » —
se retourne en « cette ligne prouve qu'il fallait la poser ». La migration la
traite donc comme une donnée à réparer, avec un critère qui ne nomme aucun
identifiant de démonstration et ne compte aucun nombre magique : est réparable
une habilitation qui désigne un client inexistant **dans une société qui n'a
aucun client** — la table n'y a jamais été amorcée, l'habilitation ne donne
accès à rien. Tout le reste **bloque**, en nommant les lignes. Les deux branches
sont mesurées sur une base façonnée à l'identique de la base hébergée.

**`perimetre_sites → site` est IMPOSSIBLE, et ce n'est pas un report.**
PostgreSQL 16 ne sait pas contraindre les éléments d'un tableau. Les trois voies
déclaratives, mesurées :

```
FOREIGN KEY (perimetre_sites) REFERENCES site(id)
  → ERROR: foreign key constraint cannot be implemented
    DETAIL: Key columns are of incompatible types: uuid[] and uuid.
FOREIGN KEY (EACH ELEMENT OF perimetre_sites) REFERENCES site(id)
  → ERROR: syntax error at or near "ELEMENT"     (proposée, jamais intégrée)
CHECK (… SELECT …)
  → ERROR: cannot use subquery in check constraint
```

Les sorties — normaliser en table de jointure, ou doubler par un couple de
déclencheurs — touchent le cloisonnement et coûtent bien plus qu'une ligne.
Elles sont portées au registre des arbitrages avec leurs conséquences, et non
tranchées en séance (CLAUDE.md §8). Ce que la migration fait, c'est rendre le
trou **nommé** plutôt que tacite.

## Ce que le ticket n'a PAS eu à écrire, et qui est la mesure de D55

`site` naît auditée sans qu'aucune liste du dépôt soit touchée. Éprouvé en
retirant le déclencheur de la migration : **sept scénarios tombent**, et le
message nomme la table — « `site` est une table métier cloisonnée (1ʳᵉ catégorie
de I1) et ne porte pas le déclencheur `journal_audit` ». La seule chose écrite à
la main est l'ATTENDU d'une assertion (`les neuf tables auditées…`), qui
constate le périmètre au lieu de le décider, et qui rougit dans les deux sens.

Même chose pour la purge de démonstration, fermée par le schéma depuis #29 :
`site` est purgée, et la chaîne « site » n'apparaît **pas une fois** dans
`scripts/purge-demonstration.mts`.

La veille, avant et après, sur deux bases propres :

| | 1ʳᵉ catégorie de I1 | forme « parc » | à auditer | déclencheurs |
| --- | --- | --- | --- | --- |
| avant (L1-01) | 9 | `client` | 8 | 8 |
| après (L1-02) | 10 | `client`, `site` | 9 | 9 |

## Ce que la table porte, et les décisions qui s'y attachent

**Aucune unicité sur le libellé**, pour la raison qui avait écarté l'unicité de
la raison sociale à L1-01 : rien au chapitre 10 n'en fait une clé, et une
contrainte transformerait en refus de saisie ce que RG-IMP-05 range en
rapprochement puis arbitrage humain. Deux ateliers « Zone industrielle » chez le
même client sont un cas réel.

**Les bornes de latitude et de longitude sont en base**, et ce n'est pas une
règle de gestion : ce sont les bornes de la mesure (WGS 84). Elles attrapent
l'inversion latitude/longitude, qui est la faute de saisie la plus fréquente sur
des coordonnées et qui est silencieuse sans contrainte — à Nouméa
(−22,27 ; 166,45), la seule borne de la latitude suffit.

**Les horaires sont portés par `site` en JSON, et non par une table fille.** Une
table `site_horaire` serait plus juste sur le papier ; elle porterait
`societe_id NOT NULL`, entrerait donc dans la première catégorie de I1, et
réclamerait une FORME de politique. Or aucune des cinq ne lui va : la forme
« société » laisserait un compte portail restreint au site S1 lire les horaires
du site S2 du même client, et **étendre `TABLES_PARC` est un arbitrage, pas une
décision de ticket**. Portées par `site`, ces données héritent de sa politique
et le périmètre les protège par construction. I7 borne le risque : les horaires
d'un site produisent un avertissement, jamais un blocage. La forme interne est
celle de `calendrier_plage` — jour ISO, minutes locales —, tenue close par Zod ;
une seconde façon d'écrire une récurrence hebdomadaire aurait été la divergence
silencieuse du 01/09.

**`contact principal` n'est pas ici** : le backlog de L1-02 ne le nomme pas, et
L1-03 livre les contacts avec leurs rôles. Une colonne de texte posée
aujourd'hui devrait être migrée dans trois semaines.

## Ce que les arbitrages du 07/09 ont tranché

Les quatre points ci-dessous étaient ouverts à la livraison ; ils sont fermés,
et ce qu'ils ont produit est resté dans ce ticket.

**1. `temps_trajet_min` — scalaire, confirmé, et il lui manquait son origine.**
L'exploitation a répondu : un site dépend d'une **agence et d'une seule**,
toujours la même. Le scalaire est donc juste, et « par agence » ne disait pas
« une valeur par couple ». Mais le nombre ne disait pas d'où l'on part : `site`
porte désormais `agence_id`, obligatoire, chaîné en composite, et un déclencheur
refuse d'en changer sans revoir le temps de trajet. Voir **D56** — la règle
RG-PLA-05 est réécrite, le backlog corrigé, et les deux sont câblés.

**2. Les zones — ne pas fermer en base, et la bascule porte sa condition.**
Le raisonnement est retenu tel quel. À terme, les zones ne sont ni un type ni
une énumération : ce sont un **référentiel par société**, une table cloisonnée
que chaque société peuple avec sa géographie. Le critère de bascule est
enregistré et **mécanique** : le jour où une société ayant sa propre géographie
emploie les zones, `tests/unit/sites/zones.test.ts` rougit et renvoie ici. Pas
une date — un fait observable.

**3. Les tables filles — le principe est tranché, la construction reportée.**
Une fille est visible si son parent l'est : c'est une **sixième forme**,
« filiation », dont la clause s'adosse à la clé étrangère qui la rattache, et
fermée par le schéma comme le reste. Elle n'est pas construite ; le critère qui
l'appellera est la première table fille réelle, et `ecartsTablesFilles` le tient
depuis le schéma. Son coût est **mesuré** et non annoncé (5 000 sites,
100 000 lignes filles) : balayage d'une société 7,1 → 10,5 ms ; lecture des
lignes d'un seul parent 0,04 → 0,26 ms. Deux corrections que la mesure apporte —
ce n'est **pas** « une sous-requête à chaque ligne lue », PostgreSQL en fait un
*hash semi-join* et ne visite le parent qu'une fois ; et le facteur ×6 de
l'accès pointé impressionne plus que son coût absolu, qui disparaît sous les
190 ms de latence vers Sydney.

Le critère a trouvé quelque chose dès son écriture, et ce n'était pas prévu :
**`utilisateur_client` est devenue fille de `client`** en recevant sa clé
étrangère. Elle n'est pas une fille au sens de cette forme — c'est
l'HABILITATION qui donne accès au parc, pas une donnée du parc, et la faire
hériter de la visibilité de son client serait circulaire. Elle est donc rangée
dans une liste close et gardée (`RATTACHEES_HORS_FILIATION`). **Mais sa vraie
question est ouverte, et elle est portée au registre** : sous la forme
« société » qu'elle porte, un compte portail du client A peut lire la ligne
d'habilitation d'un compte du client B de la même société. Cela précède ce
ticket — la table portait déjà `client_id` et cette politique ; la clé étrangère
n'a rien ouvert, elle a rendu la question visible.

Le critère qui sortira les **horaires** du JSON est enregistré de la même façon :
le jour où un critère de recherche porte sur eux, `tests/unit/sites/saisie.test.ts`
rougit. Tant qu'on ne fait que les lire avec leur site, le JSON est le bon choix.

**4. `perimetre_sites` — normaliser, et c'est un ticket à part.** La table de
jointure est retenue : elle met la garantie là où elle ne rouille pas. Le ticket
est **L1-02b**, avec ses deux exigences — la lecture du périmètre voyage avec les
instructions qui posent déjà le contexte (`set_config` accepte une sous-requête,
`lib/db/rls.ts` en pose déjà quatre) et l'aller-retour est mesuré ; et
`app.perimetre_sites` reste exactement la forme que lisent les politiques.
Séparé parce qu'il touche la plomberie du portail — `lib/db/rls.ts`, la couche
d'authentification, le harnais — et non le référentiel des sites, et parce qu'un
commit ne couvre jamais deux tickets.

## Le bloc de garde de 20260823130000 : une classe, pas un incident

Relevé hors périmètre à la livraison, et l'inventaire a été fait. **Une seule
migration déjà appliquée porte le défaut** — `20260823130000`, avec deux blocs.
Elle est immuable, et il n'y a rien à reprendre : ce qu'elle perd est la
LISIBILITÉ du refus, pas le refus — les contraintes qui suivent (`SET NOT NULL`,
les clés composites) échouent d'elles-mêmes sur un état fautif, avec un message
de PostgreSQL qui ne dit ni quelle agence ni quoi faire.

Ce qui est écrit, c'est la **règle** : tout bloc de garde qui lit une table sous
`FORCE` doit rendre visible le mécanisme qui pourrait l'aveugler — lever le
drapeau, le rendre dans la même transaction, et **refuser de compter tant que la
levée n'est pas constatée**. `scripts/lib/gardes-migration.ts` la tient et porte
l'inventaire, clos des deux côtés ; le gardien est éprouvé sur la faute écrite
dans la forme qu'elle prendrait réellement, sur la levée sans témoin, sur un bloc
qui ne lit aucune table cloisonnée, et sur trois graphies.

## Les points restés au registre

**1. `utilisateur_client` sous la forme « société ».** Voir plus haut : un compte
portail lit-il l'habilitation d'un compte d'un autre client de la même société ?
La question est antérieure au ticket, elle a été rendue visible par lui.

**2. Les anciens points, tels qu'ils étaient posés à la livraison :**

**1. `temps_trajet_min` : porté par le site, ou par le couple (site, agence) ?**
D23 (rang 1) et RG-PLA-05 (rang 2) écrivent tous deux `site.temps_trajet_min` —
une valeur portée par le site. Le chapitre 11.2 (rang 3) et le backlog (rang 4)
disent « par agence », et le chapitre 2 « depuis chaque agence ». La hiérarchie
des sources tranche pour les deux premiers, et c'est ce qui est livré. Mais
l'écart est réel : à Ducos et à Koné, le même site n'est pas à la même distance.
Une table `site_temps_trajet` reste ajoutable sans rien défaire — et elle
rouvrirait la question de `TABLES_PARC` ci-dessus.

**2. L'énumération des zones de D23 est close à l'entrée serveur, pas en base.**
D23 arrête bien six zones, et `lib/sites/zones.ts` les tient closes par Zod, sur
tous les chemins. Mais ces six valeurs sont la géographie de la
Nouvelle-Calédonie : `grand_noumea` n'a aucun sens à Lyon, et le jeu de
démonstration porte déjà un site européen à `zone_geo` nul. Les figer en `CHECK`
ou en type énuméré ferait de la carte d'un territoire une contrainte du produit,
et demanderait une migration au premier client hors territoire — la forme exacte
de `code_winpro` (19/08) et de l'énumération des rôles fermée trop tôt (20/08).
D23 date d'ailleurs du 19 août, **avant** l'arbitrage « il faut prévoir de
vendre la solution ». Un gardien
(`tests/unit/sites/zones.test.ts`) rougira le jour où quelqu'un voudra fermer
l'énumération en base, et le renverra ici.

**3. `perimetre_sites` sans intégrité référentielle.** Voir plus haut : c'est
une impossibilité déclarative de PostgreSQL, pas un choix. Deux sorties, et
aucune n'est gratuite — une table de jointure normaliserait le périmètre mais
obligerait `lib/db/rls.ts` à la lire pour composer `app.perimetre_sites`, et un
couple de déclencheurs serait une clé étrangère écrite à la main, donc une chose
qui rouille.
