# Identifiants stockés en `uuid` natif

## Contexte

Le schéma du socle multi-société (L0-03) déclarait ses identifiants en `String`
Prisma, donc en `text` PostgreSQL. Ce choix n'était pas raisonné : il est
simplement celui que Prisma applique par défaut à un champ `String @id`. Il a eu
une conséquence visible au ticket suivant : la migration RLS de L0-04 a dû
écarter le `::uuid` de la forme de politique arrêtée par l'arbitrage D4
(`societe_id = current_setting('app.societe_id')::uuid OR societe_id IS NULL`),
sous peine de `operator does not exist: text = uuid`. La revue de L0-04 a relevé
cette divergence. Le remède retenu alors traitait le symptôme ; c'est le stockage
qui était fautif. Un identifiant qui **est** un UUID v7 (I10) doit être typé
`uuid`.

## Options écartées

- **Conserver `text` et documenter l'écart à D4.** C'est ce que faisait L0-04.
  L'écart aurait dû être réexpliqué à chaque table cloisonnée des lots suivants,
  et un arbitrage arrêté aurait vécu indéfiniment avec une note de bas de page.
  Écarté.
- **Convertir plus tard, quand le besoin se ferait sentir.** Une conversion de
  type sur les colonnes de clés primaires et étrangères se paie en indisponibilité
  dès qu'il y a des données, et devient franchement risquée une fois le produit
  vendu. La base ne contient aujourd'hui que le jeu de démonstration : c'est le
  moment, ou jamais. Écarté.
- **Laisser Prisma engendrer la migration.** `prisma migrate diff` propose
  `DROP COLUMN` / `ADD COLUMN`, c'est-à-dire la destruction des données. Cela
  aurait « marché » sur une base vide, en faisant dépendre la migration du fait
  qu'elle soit vide. La migration est donc écrite à la main en
  `ALTER COLUMN ... TYPE uuid USING ...::uuid`, non destructive. Écarté.

## Choix

La migration `20260820140000_identifiants_uuid` convertit toutes les colonnes
d'identifiants du socle en `uuid` — clés primaires, clés étrangères,
`agence.calendrier_id`, `utilisateur_client.client_id`, et
`utilisateur_client.perimetre_sites` en `uuid[]`. Seul `devise.code` reste
`text` : c'est un code ISO (XPF, EUR), pas un identifiant technique. Le schéma
Prisma porte les `@db.Uuid` correspondants ; `prisma migrate diff` entre les
migrations et le modèle ne renvoie plus aucune dérive.

Les politiques RLS sont déposées avant la conversion — PostgreSQL refuse
d'altérer le type d'une colonne citée par une politique — puis rétablies **dans
la forme imposée par D4, `::uuid` compris**. Deux durcissements sont conservés,
et eux seuls, à sémantique identique : `current_setting(..., true)` pour que
l'absence de contexte renvoie zéro ligne au lieu de lever, et `NULLIF(..., '')`
pour qu'une variable vide compte comme absente et que le cast ne bute pas
dessus. Les clés étrangères sont déposées et rétablies à l'identique autour de
la conversion, une contrainte ne survivant pas au changement de type d'un de ses
côtés.

Ce changement touche le type de `societe_id`, ce que CLAUDE.md §8 réserve à une
décision explicite. Elle a été demandée telle quelle, en connaissance de cause,
dans le cadre des corrections de revue de L0-04.

## Conséquences

La base contrôle désormais la forme des identifiants à l'écriture : une chaîne
qui n'est pas un UUID est refusée au lieu d'être stockée et de ne jamais rien
apparier. Le stockage et les index sont plus compacts (16 octets contre 36).
Surtout, la politique de cloisonnement s'écrit dans la forme arrêtée, sans écart
à justifier — ce qui compte pour les dizaines de tables cloisonnées des lots à
venir, qui la recopieront.

Une contrainte nouvelle en découle, à connaître : dans une requête **brute**, un
identifiant passé en paramètre lié part en `text` et doit être casté sur place
(`$1::uuid`), faute de quoi PostgreSQL lève `operator does not exist: uuid = text`.
Les requêtes passant par le client Prisma, elles, sont typées correctement sans
rien faire. Le point est rappelé dans `lib/db/rls.ts`, et un scénario
d'isolation (`identifiants-uuid.test.ts`) verrouille à la fois le type des
colonnes et la présence du `::uuid` dans les quatre politiques de cloisonnement.
