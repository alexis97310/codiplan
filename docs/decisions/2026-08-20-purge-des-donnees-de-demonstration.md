# Purge des données de démonstration avant le seed

> **RÉSERVÉ AUX DONNÉES DE DÉMONSTRATION.** L'entrée `reinitialiser_demo` du
> workflow « DB migrate & seed » efface des données sans les regarder. Elle n'est
> légitime que tant que la base ne contient que le jeu de `prisma/seed.ts`.
> **Dès qu'une donnée réelle existera — premier client, première société vendue,
> première reprise de parc — cette option devra être RETIRÉE du workflow, ou à
> défaut verrouillée** (voir « Conséquences »). Ce n'est pas une précaution de
> style : la purge ne demande aucune confirmation sur le contenu de la base et
> n'a aucun moyen de distinguer une donnée de démonstration d'une donnée réelle.

## Contexte

Le premier passage du seed a écrit les deux sociétés de démonstration avec des
identifiants tirés à l'écriture. Depuis `FORCE ROW LEVEL SECURITY`
(voir `2026-08-20-role-applicatif-et-force-rls.md`), la politique de `societe`
est `id = current_setting('app.societe_id')::uuid` : le seed doit connaître
l'identifiant **avant** d'écrire, pour poser le contexte. Il porte donc désormais
des identifiants fixes (entête de `prisma/seed-data.ts`). Conséquence : l'`upsert`
par `id` ne retrouve plus les lignes déjà en base et tente une création, qui bute
sur `Unique constraint failed on the fields: (code)`. Le workflow de migration
échoue à l'étape de seed, et rien ne repart.

Aucun rapprochement automatique n'est possible. Retrouver la ligne existante par
son `code` supposerait de la lire, or toute lecture de `societe` est elle-même
filtrée par la politique et ne rend rien tant que le contexte n'est pas posé sur
l'identifiant recherché — celui que précisément on ignore. Le `DELETE` du
propriétaire est filtré de la même façon : vérifié sur un PostgreSQL 16 local
avec un propriétaire non superutilisateur, `DELETE FROM societe` sans contexte
renvoie `DELETE 0` alors que les lignes sont bien là.

## Options écartées

- **Rendre le seed tolérant : `upsert` par `code` avec reprise de l'identifiant
  existant.** Impossible sous `FORCE RLS` pour la raison ci-dessus, et cela
  ferait porter au seed une logique de rattrapage d'un incident ponctuel. Écarté.
- **Assouplir la politique de `societe` le temps du seed** (`NO FORCE ROW LEVEL
  SECURITY`, ou une politique plus large pour le propriétaire). Touche à un
  invariant (I1) pour un problème d'exploitation. Écarté sans hésitation.
- **Purger à la main depuis la console de l'hébergeur.** Fonctionne une fois,
  ne laisse aucune trace, n'est pas reproductible, et demande de manipuler la
  base de production à la main — exactement ce que le workflow de migration a
  été créé pour éviter (`2026-08-20-migration-par-github-actions.md`). Écarté.
- **Une migration Prisma qui vide les tables.** Une migration s'applique à toute
  base, y compris une future base contenant des données réelles, et sans
  possibilité de la refuser. Absolument écarté.

## Choix

Une entrée `workflow_dispatch` booléenne `reinitialiser_demo`, **`default:
false`**, ajoutée au workflow `db-migrate.yml`. Quand — et seulement quand —
elle est cochée au déclenchement, l'étape « Purger les données de démonstration »
s'exécute entre la migration et le seed et lance
`scripts/purge-demonstration.mts`. Le workflow reste par ailleurs inchangé :
`workflow_dispatch` demeure son seul déclencheur, aucune exécution automatique.

Deux barrières indépendantes, parce qu'une seule ne suffit pas pour une
opération destructive : le `if: ${{ inputs.reinitialiser_demo }}` de l'étape, et
le refus du script lui-même tant que la variable d'environnement
`PURGE_DEMONSTRATION_CONFIRMEE` ne vaut pas `oui` — variable que seule cette
étape positionne. Une exécution ordinaire du workflow, un appel du script à la
main ou un futur enchaînement malencontreux ne purgent rien.

La purge est un `TRUNCATE` des cinq tables du socle — `utilisateur_client`,
`utilisateur_societe`, `agence`, `societe`, `utilisateur` — et non des `delete`
Prisma : sous `FORCE RLS`, un `DELETE` du propriétaire est filtré (voir
« Contexte »), là où `TRUNCATE` relève de la propriété de la table et n'est pas
soumis aux politiques de ligne. Corollaire utile : le rôle applicatif
`codiplan_app`, qui n'a que `SELECT, INSERT, UPDATE, DELETE`, ne peut pas
exécuter ce script. Le `TRUNCATE` est écrit **sans `CASCADE`** et énumère ses
tables : si une table future en référence une sans figurer dans la liste, la
commande échoue bruyamment au lieu de vider plus que prévu. Les référentiels de
plateforme `devise` et `parite` (liste close de I1) ne sont pas purgés — ce ne
sont pas des données de démonstration, et le seed les réécrit par leur clé
naturelle. Enfin, la purge écrit dans le journal de l'exécuteur un message en
capitales nommant les tables vidées : une purge ne doit jamais passer inaperçue
dans l'historique des exécutions.

## Conséquences

Le seed redevient applicable sur la base actuelle : un déclenchement du workflow
avec `reinitialiser_demo` coché purge, réamorce, et le décompte de contrôle
affiche à nouveau deux sociétés, quatre agences et un compte portail. Enchaînement
vérifié bout en bout sur un PostgreSQL 16 local avec un propriétaire non
superutilisateur : sur une base « héritée » aux identifiants tirés, le seed échoue
bien sur l'unicité de `code`, la purge passe malgré `FORCE RLS`, et le seed
suivant aboutit.

Les deux barrières sont couvertes par `tests/unit/purge-demonstration.test.ts` :
entrée booléenne à `false` par défaut, étape conditionnée et placée entre
migration et seed, refus du script sans confirmation, absence de `CASCADE`,
référentiels de plateforme épargnés. Un `default: true` ou un `if:` retiré fait
échouer `pnpm verify`.

**Condition de retrait.** Cette option est datée. Tant que la base ne porte que
des données de démonstration, elle est un outil d'exploitation commode. À la
première donnée réelle, elle devient une arme pointée sur le client. Deux issues
alors, à trancher à ce moment-là et pas avant : **retirer** purement et
simplement l'entrée et le script du dépôt (à privilégier — la reprise d'un
incident sur des données réelles ne se fait pas par un bouton), ou, s'il faut
conserver un moyen de réamorcer un environnement de recette, **verrouiller**
l'option — workflow séparé, restreint à l'environnement de recette, avec une
base distincte et un garde-fou refusant toute URL de production. Aucune des deux
ne doit être décidée par réflexe : elle exige une décision, consignée ici.
