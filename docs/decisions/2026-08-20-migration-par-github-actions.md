# Migration et seed appliqués depuis GitHub Actions

## Contexte

La base PostgreSQL du projet est hébergée sur Neon. Depuis une session Claude
Code exécutée dans l'environnement cloud, `pnpm prisma migrate deploy` échoue
systématiquement avec `P1001 : Can't reach database server`. La cause n'est pas
l'allowlist réseau — l'hôte Neon y a été ajouté — mais le fait que le proxy
sortant de l'environnement ne relaie que le HTTPS : Prisma ouvre une connexion
PostgreSQL en TCP sur le port 5432, que le proxy ne transporte pas. La base
restera donc injoignable depuis une session cloud, quel que soit le réglage de
l'allowlist. Il fallait un autre point d'exécution disposant d'un accès TCP
direct à Neon pour appliquer la migration et le seed du socle multi-société
(L0-03).

## Options écartées

- **Attendre un relais TCP dans l'environnement cloud.** Hors de notre contrôle
  et non prévu ; aurait bloqué L0-03 sans échéance. Écarté.
- **Exécuter la migration depuis un poste local branché sur Neon.** Fonctionne
  mais laisse l'opération hors trace, non reproductible et dépendante d'un poste
  détenant l'URL de production. Contraire à I9 (aucune donnée ni secret de
  production dans le dépôt ou sur un poste ad hoc). Écarté.
- **Ajouter la migration au workflow CI existant (`ci.yml`).** Le CI part à
  chaque push et chaque proposition de fusion : une migration s'y déclencherait
  toute seule, ce qui est exactement le risque à éviter. Écarté.

## Choix

Un workflow dédié `.github/workflows/db-migrate.yml`, déclenché **à la main
~~uniquement** (`workflow_dispatch`, aucun autre déclencheur)~~ **— AMENDÉ
LE 12/09/2026 par D116 : un `push` sur `main` touchant `prisma/migrations/`
déclenche désormais le flux, sous quatre bornes. La phrase est barrée et non
effacée ; voir `docs/decisions/2026-09-12-migration-automatique-sur-fusion.md`
—**, installe Node et
pnpm comme le workflow de vérification, puis enchaîne
`pnpm prisma migrate deploy`, le seed, et un décompte de contrôle (sociétés,
agences, comptes portail, parité XPF). L'exécuteur GitHub Actions a un accès TCP
direct à Neon. `DATABASE_URL` provient de `secrets.DATABASE_URL` : aucune valeur
de connexion n'entre dans le dépôt. Un verrou de concurrence (`group:
db-migrate`, `cancel-in-progress: false`) empêche deux migrations simultanées et
n'interrompt jamais une migration en cours.

## Conséquences

Le critère d'acceptation « migration appliquée / seed exécuté » de L0-03 est
désormais validé par le déclenchement manuel de ce workflow, et non depuis une
session cloud — laquelle ne peut structurellement pas atteindre la base. Toute
migration future suit le même chemin : commit du dossier `prisma/migrations/`,
puis déclenchement manuel du workflow. Le caractère manuel est un invariant de
ce workflow : n'y ajouter ni `push`, ni `pull_request`, ni `schedule` sans une
nouvelle décision explicite — une migration ne doit jamais partir toute seule.
