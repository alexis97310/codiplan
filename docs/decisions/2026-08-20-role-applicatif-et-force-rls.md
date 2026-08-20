# Rôle applicatif non propriétaire et `FORCE ROW LEVEL SECURITY`

## Contexte

La revue du ticket L0-04 a relevé une faiblesse de fond : les politiques posées
par la migration `20260820120000_rls_policies` étaient introduites par un simple
`ENABLE ROW LEVEL SECURITY`. Or PostgreSQL n'applique pas les politiques au
propriétaire des tables, ni à un superutilisateur, ni à un rôle portant
`BYPASSRLS`. Tant que le service applicatif se connecte avec le rôle qui applique
les migrations — ce qui est le réglage par défaut d'un projet Prisma, une seule
`DATABASE_URL` pour tout — le filet base de données ne protège de personne. Il
donne l'apparence du cloisonnement sans en donner la substance, ce que l'invariant
I1 exige pourtant explicitement : « toute requête est filtrée côté serveur, et la
base applique **en plus** une politique RLS ».

## Options écartées

- **Ne poser que le filtre applicatif.** C'est la lecture minimale d'I1, et elle
  la contredit : l'invariant demande deux barrières, précisément parce qu'une
  requête oubliée passe au travers de la première. Écarté.
- **Se contenter de `FORCE ROW LEVEL SECURITY`, sans rôle dédié.** FORCE soumet
  le propriétaire aux politiques, mais reste sans effet sur un superutilisateur
  ou sur un rôle `BYPASSRLS` ; et rien n'empêcherait alors le service de se
  connecter avec un tel rôle. La protection dépendrait d'une convention non
  vérifiée. Écarté.
- **Créer le rôle applicatif à la main sur l'hébergeur, hors migration.** L'état
  de la base ne serait plus décrit par le dépôt : une nouvelle table pourrait
  rester invisible au rôle applicatif, sans que rien ne le signale. Écarté au
  profit d'un rôle créé et doté par la migration, l'attribution du mot de passe
  restant seule hors dépôt (I9).
- **Donner `BYPASSRLS` au rôle qui applique le seed.** Seul un superutilisateur
  peut accorder cet attribut ; l'hébergeur n'en fournit pas. Techniquement
  impossible, et de toute façon contraire à l'intention.

## Choix

Trois pièces indissociables, livrées ensemble par la migration
`20260820130000_force_rls_role_applicatif` et par `lib/db/garde-role.ts`.

**Un.** `FORCE ROW LEVEL SECURITY` sur les quatre tables cloisonnées — `societe`,
`agence`, `utilisateur_societe`, `utilisateur_client`. Les référentiels de
plateforme `devise` et `parite` en sont exclus : ils n'ont pas de `societe_id`,
sont lisibles par toutes les sociétés (D4), et leur amorçage relève du
propriétaire.

**Deux.** Un rôle `codiplan_app`, `NOSUPERUSER NOBYPASSRLS NOCREATEDB
NOCREATEROLE NOINHERIT`, propriétaire de rien, doté des seuls droits de
manipulation de données — y compris sur les tables des migrations à venir, via
`ALTER DEFAULT PRIVILEGES`. Il est créé **sans mot de passe** : le dépôt ne porte
aucun secret (I9).

**Trois.** Un contrôle au démarrage, `lib/db/garde-role.ts`, joué une fois par
processus depuis `lib/db/client.ts` et mémorisé — échec compris. Il interroge la
base sur `current_user` et refuse la connexion si le rôle est propriétaire de la
base (ou membre du rôle propriétaire), superutilisateur, ou porteur de
`BYPASSRLS`. Le client Prisma est fermé dans la foulée : le refus est un vrai
refus de se connecter, pas un avertissement.

**Les migrations et le seed conservent le rôle propriétaire.** `prisma/seed.ts`
instancie son propre client et ne passe pas par `lib/db/client.ts` ; le contrôle
ne le concerne pas. En revanche, `FORCE` s'applique désormais à lui : chaque
écriture sur une table cloisonnée est encadrée par `avecSociete`, qui pose
`app.societe_id`. C'est pourquoi les sociétés du jeu de démonstration portent
maintenant un identifiant **fixe** dans `prisma/seed-data.ts` : la politique de
`societe` étant `id = app.societe_id`, le seed doit connaître l'identifiant avant
d'écrire — une recherche préalable par `code` serait elle-même filtrée. Le
décompte de contrôle post-migration compte pour la même raison société par
société, sous le contexte de chacune.

## Révision du 20/08/2026 — ticket L0-06

Le garde décrit ci-dessus refusait **toute** connexion portant `BYPASSRLS`.
L'arbitrage D21 exige un rôle qui, lui, doit le porter : `codiplan_reporting`,
réservé aux agrégats multi-sociétés de `lib/reporting`. Le garde ne juge donc
plus l'attribut mais l'**usage** — la connexion applicative refuse `BYPASSRLS`,
la connexion de consolidation l'exige, et chacune a sa propre fonction de
décision. Ce qui est écrit ici de la connexion applicative reste vrai mot pour
mot ; voir `2026-08-20-authentification-et-deux-connexions.md` pour la seconde.

## Conséquences

Le cloisonnement ne repose plus sur la discipline du code applicatif seul. Une
requête qui oublierait son filtre société ne remonte rien : la base la coupe.
Le prix est une exigence d'exploitation nouvelle — **deux connexions, deux
rôles** — et une contrainte durable sur toute écriture de socle : plus rien ne
s'écrit sur une table cloisonnée sans contexte, seed compris. Les tests
d'isolation passent désormais par le rôle `codiplan_app` lui-même, et non plus
par un rôle de test créé pour l'occasion : ils éprouvent les droits réellement
accordés en production. Deux scénarios (`tests/isolation/garde-role.test.ts`,
`tests/isolation/force-rls.test.ts`) verrouillent le garde-fou et l'état `FORCE`
des quatre tables ; un test unitaire couvre la décision pure du garde-fou.

## Marche à suivre côté Neon

Sur Neon, le rôle propriétaire du projet (`neondb_owner` par défaut) n'est **ni
superutilisateur, ni `BYPASSRLS`** : il ne peut donc pas se donner d'exemption, et
la mise en place ci-dessous n'a pas d'alternative. Elle a été vérifiée en local
contre un rôle propriétaire non superutilisateur, reproduisant exactement cette
posture.

1. **Appliquer la migration** avec le rôle propriétaire, par le workflow manuel
   « DB migrate & seed ». Le secret GitHub qui l'alimente doit porter l'URL du
   **propriétaire** : `MIGRATION_DATABASE_URL` (le workflow retombe sur
   `DATABASE_URL` si le premier n'est pas défini, mais le nom explicite est
   préférable — il évite de confondre ce secret avec la variable d'environnement
   du service applicatif, qui portera l'URL de `codiplan_app`).
2. **Vérifier que le rôle a été créé.** La migration crée `codiplan_app` si le
   rôle propriétaire porte l'attribut `CREATEROLE` — c'est le cas de
   `neondb_owner`. Si l'instruction échoue faute de droits, créer le rôle depuis
   la console Neon (*Roles* → *New role*, nom `codiplan_app`) **avant** de
   relancer le workflow : la branche de création est alors sautée et seuls les
   `GRANT` s'appliquent.
3. **Attribuer un mot de passe.** Un rôle créé en SQL n'apparaît pas dans la
   console Neon et n'a pas de mot de passe. Depuis une session `psql` ouverte
   avec le rôle propriétaire :
   `ALTER ROLE codiplan_app WITH PASSWORD '<mot de passe engendré>';`
   Un rôle créé depuis la console, lui, arrive avec son mot de passe.
4. **Composer l'URL applicative** et la déposer dans la configuration du service
   qui exécute l'application, jamais dans le dépôt (I9) :
   `postgresql://codiplan_app:<mot de passe>@<hôte Neon>/<base>?sslmode=require`.
   Utiliser l'hôte *pooled* de Neon pour l'application ; l'hôte direct reste
   réservé aux migrations.
5. **Contrôler.** Au premier accès applicatif, `lib/db/garde-role.ts` refuse la
   connexion si l'URL déposée est restée celle du propriétaire. Le message
   nomme le rôle et la base fautifs.

**Ne jamais rendre `codiplan_app` propriétaire d'une table**, ni membre du rôle
propriétaire : les deux annulent `FORCE` et le garde-fou rejetterait alors la
connexion — ce qui est le comportement voulu, mais coûte une indisponibilité.
