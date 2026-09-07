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

## Les trois points portés à l'arbitrage

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
