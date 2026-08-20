# Configuration Prisma hors de `package.json`

## Contexte

`prisma migrate deploy` avertit à chaque exécution — donc à chaque migration, et
à chaque `pnpm install` par le `postinstall` — que la configuration déposée dans
`package.json#prisma` est dépréciée et disparaîtra en Prisma 7. Le dépôt n'y
mettait qu'une chose, la commande d'amorçage (`seed: "tsx prisma/seed.ts"`), mais
c'est celle dont dépend `pnpm db:seed`, et donc le workflow « DB migrate & seed »
qui amorce la base hébergée. Un avertissement que l'on apprend à ignorer finit
par masquer celui qui compte : il fallait le faire taire en le traitant, pas en
le supprimant.

## Options écartées

- **Ne rien faire jusqu'à Prisma 7.** L'avertissement s'affiche déjà dans chaque
  journal de migration et d'installation, et le jour de la montée en version il
  faudrait traiter le déplacement de configuration en même temps que les ruptures
  de la version majeure. Deux changements mêlés dans un même ticket, dont un qui
  touche à la base : écarté.
- **Monter en Prisma 7 tout de suite.** C'est un changement d'un autre ordre —
  ruptures d'API, client régénéré, comportement des migrations — qui mérite sa
  propre décision et son propre ticket. Le déplacement de configuration se fait
  ici **à version inchangée** (6.19.3), et n'engage rien de la version suivante.
- **Ajouter `dotenv` pour recharger `.env`** (voir la conséquence ci-dessous).
  `process.loadEnvFile` est natif depuis Node 20.12 et le dépôt exige Node 22 :
  une dépendance pour trois lignes serait un réflexe, pas une décision
  (CLAUDE.md §2).

## Choix

La configuration passe dans `prisma.config.ts` à la racine, avec la même commande
d'amorçage, désormais sous `migrations.seed`. La clé `prisma` de `package.json`
est retirée : laissée en place, elle serait silencieusement ignorée au profit du
fichier — Prisma le signale d'ailleurs par un nouvel avertissement, ce qui aurait
troqué une dette contre une autre.

Ce déplacement a un **effet de bord que la dépréciation ne mentionne pas** : dès
qu'un fichier de configuration existe, la CLI Prisma cesse de charger `.env`
d'elle-même (« Prisma config detected, skipping environment variable loading »).
Sans rattrapage, `pnpm db:migrate` et `pnpm db:seed` échoueraient sur un poste de
développement avec « Environment variable not found: DATABASE_URL » alors qu'un
`.env` est bien là. Le fichier de configuration reprend donc ce chargement à son
compte, via `process.loadEnvFile`, qui — comme `dotenv` avant lui — **ne remplace
pas une variable déjà posée dans l'environnement**. Cette précédence n'est pas un
détail de confort : le harnais d'isolation impose `DATABASE_URL` au
`migrate deploy` qu'il lance pour viser la base jetable, et un `.env` de
développement pointant vers la base hébergée ne doit jamais pouvoir la supplanter.

## Conséquences

Le workflow de migration est inchangé pour l'appelant : mêmes commandes, mêmes
variables, mêmes secrets — seul l'avertissement disparaît. Il a été éprouvé sur
un cluster jetable neuf : `prisma migrate deploy` puis `pnpm db:seed`, avec
`DATABASE_URL` posée dans l'environnement, puis avec `DATABASE_URL` présente dans
le seul `.env`. La configuration Prisma se lit maintenant à un seul endroit, et
la montée en Prisma 7, quand elle sera décidée, n'aura plus ce déplacement à
porter. Un gardien statique (`tests/unit/prisma-config.test.ts`) refuse le retour
de la clé `package.json#prisma` et la disparition du rechargement de `.env`.
