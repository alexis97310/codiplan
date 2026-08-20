# Consolidation : `BYPASSRLS` accordé, et le repli portable à construire au lot 5

*Ticket L0-06b. Arbitrages D36 et D38, prolongeant D21. Invariants I1, I2.*

## Contexte

D21 réserve la consolidation multi-sociétés à un rôle PostgreSQL distinct,
`codiplan_reporting`, portant `BYPASSRLS` : agréger plusieurs sociétés, c'est par
définition lire au-dessus d'elles. L0-06 a livré ce rôle, avec une réserve écrite
dans la migration — `BYPASSRLS` ne s'accorde que par un rôle qui le porte
déjà, et aucun hébergeur ne le garantit. La migration **avertit** au lieu
d'échouer, et `verifierRoleReporting` refuse la connexion tant que l'attribut
manque.

**Vérification faite sur Neon le 20 août 2026** : `codiplan_reporting` porte bien
`rolbypassrls = true`, et `codiplan_app` porte `rolbypassrls = false`. Le chemin
rapide fonctionne donc sur notre hébergement, et l'avertissement n'y est jamais
déclenché.

Restait la vraie question, celle que notre propre hébergement masque : **nous
vendons la solution.** Un client qui l'hébergera ailleurs — sur un PostgreSQL
managé qui n'expose pas les attributs de rôle, ou chez un hébergeur qui refuse
`BYPASSRLS` par politique — n'aura pas ce chemin. Sans repli, la consolidation
lui est simplement inaccessible, et l'avertissement de la migration devient une
impasse polie.

## Options écartées

**Retirer l'avertissement de la migration, puisqu'il ne se déclenche pas chez
nous.** C'est exactement l'inverse de ce qu'il faut faire : il ne se déclenche
pas *ici*, et il est écrit *pour ailleurs*. Le supprimer parce qu'il est muet sur
notre base reviendrait à supprimer un extincteur parce qu'il n'y a pas eu
d'incendie. Il reste, et cette note dit pour qui.

**Faire du repli le chemin unique, et abandonner `BYPASSRLS`.** Séduisant par
simplicité — un seul chemin à écrire, à tester, à maintenir. Écarté parce que le
repli contraint la forme des requêtes : il ne rend que des agrégats déjà
consolidés, décidés à l'avance, alors que `BYPASSRLS` laisse `lib/reporting`
composer librement. Fermer cette liberté aujourd'hui, alors que les indicateurs
du lot 5 ne sont pas arrêtés, serait un choix pris trop tôt.

**Accorder au rôle applicatif le droit de consolider quand `BYPASSRLS` manque.**
La solution de facilité, et la pire : elle rendrait au rôle applicatif exactement
ce que L0-04 lui a retiré, sur toutes les requêtes et pas seulement sur les
agrégats. Écartée sans hésitation.

**Une vue matérialisée hors politiques.** Elle contourne le problème sans le
résoudre : une vue appartient à son propriétaire et échappe aux politiques des
tables sous-jacentes, mais elle fige les agrégats à l'heure de son
rafraîchissement et laisse sortir des **lignes**, pas seulement des totaux. I2
redeviendrait une affaire de discipline.

## Choix

**Le repli reste obligatoire, pour la portabilité.** Il est à construire au
**lot 5**, avec les premiers indicateurs consolidés, et sa forme est arrêtée dès
maintenant pour que le lot 5 n'ait pas à la redécouvrir :

- une **fonction `SECURITY DEFINER`**, appartenant au **rôle propriétaire** du
  schéma — c'est ce qui lui donne le droit de lire par-dessus les politiques,
  sans qu'aucun rôle de connexion ne le porte ;
- un **`search_path` fixe** (`SET search_path = pg_catalog, public`), comme
  `app_role()` et `app_est_role_editeur()` : une fonction `SECURITY DEFINER`
  dont le chemin de recherche dépend de l'appelant est une élévation de
  privilèges qui attend son heure ;
- elle ne renvoie **que des agrégats déjà consolidés** — des totaux, des
  moyennes, des comptes, jamais une ligne de table ;
- **`EXECUTE` accordé au seul `codiplan_reporting`**, révoqué de `PUBLIC` — sans
  quoi le rôle applicatif l'appellerait aussi, et le repli deviendrait la porte
  dérobée qu'il est censé remplacer.

**Ce que cette forme achète.** Aucune ligne ne sort, seulement des agrégats. La
conversion de devise se fait donc sur des totaux déjà constitués, jamais ligne à
ligne : **I2 devient structurellement impossible à violer** par ce chemin, au
lieu de reposer sur la discipline de `lib/reporting`. C'est la raison principale
de préférer cette forme à toute autre, et elle vaut aussi chez nous — où le
chemin rapide, lui, ne l'offre pas.

**Ce que le lot 5 devra trancher en plus** : la liste des agrégats, et le
comportement quand les deux chemins sont disponibles. Le choix par défaut
proposé : le repli d'abord, le chemin `BYPASSRLS` seulement pour ce que le repli
ne couvre pas.

## Conséquences

**Trois garde-fous deviennent quatre.** D21 en posait trois — `SELECT` seul,
journalisation de chaque requête, et un test statique interdisant d'ouvrir la
connexion hors de `lib/reporting`. D38 en ajoute un quatrième, permanent :
`scripts/controle-cloisonnement.mts` vérifie **à chaque migration** que
`codiplan_reporting` ne détient aucun privilège autre que `SELECT`, lu dans
`information_schema.role_table_grants` et non déclaré. Le contrôle échoue si un
droit d'écriture apparaît, et il échoue aussi s'il n'observe **rien** — la vue ne
montrant que les droits dont le rôle connecté est bénéficiaire ou concédant, un
contrôle joué sous le mauvais rôle rendrait zéro ligne, et un vide ressemble
beaucoup trop à la conformité. C'est pourquoi l'étape exige désormais
`MIGRATION_DATABASE_URL` en plus de `DATABASE_URL`.

**Le mot de passe du rôle est traité comme une clé passe-partout (D38).** Il n'en
a pas aujourd'hui et n'en aura pas avant le lot 5. Quand il en aura un, il ira
dans `REPORTING_DATABASE_URL` — un secret **distinct**, jamais dans
`DATABASE_URL` ni dans `MIGRATION_DATABASE_URL`. La règle est écrite aux
interdits de `CLAUDE.md`, et un test statique refuse déjà que la variable soit
nommée hors de `lib/reporting/`.

**Vérification manuelle du garde-fou, faite le 20 août 2026** — sur la base
jetable locale, `GRANT INSERT ON "agence" TO "codiplan_reporting"` fait échouer
`scripts/controle-cloisonnement.mts` avec le message attendu (« détient INSERT
sur agence »), et le privilège retiré, l'étape repasse au vert. Le contrôle sait
donc échouer, ce qu'aucune exécution verte ne démontre à elle seule. Même
protocole que la vérification manuelle exigée par D22 pour L0-05.

**La marche à suivre côté hébergeur reste celle de L0-06**, inchangée : appliquer
la migration avec le rôle propriétaire, poser `ALTER ROLE codiplan_reporting
BYPASSRLS` si l'avertissement apparaît, puis attribuer le mot de passe et
composer `REPORTING_DATABASE_URL` hors dépôt (I9). Ce qui change, c'est que
l'étape 2 n'est plus un préalable absolu : un client qui ne peut pas la franchir
aura le repli.
