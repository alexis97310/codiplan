# CODIPLAN

Plateforme de gestion des plannings d'intervention de techniciens et du parc machines de leurs clients. Multi-société, multi-devise, application mobile hors-ligne, console éditeur.

Contexte d'exploitation : Nouvelle-Calédonie — réseau mobile absent sur une partie du territoire, latence élevée vers l'hébergeur, monnaie sans décimale, fuseau UTC+11 sans changement d'heure.

## Documentation

`CLAUDE.md` fait autorité sur le fonctionnement du dépôt. En cas de divergence entre documents, l'ordre est celui qu'il fixe :

| Rang | Source                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------- |
| 1    | [`docs/arbitrages.md`](docs/arbitrages.md) — les décisions arrêtées                            |
| 2    | [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md) chapitre 10 — les règles de gestion |
| 3    | `docs/cahier-des-charges.md` chapitre 11 — le modèle de données                                |
| 4    | [`docs/backlog.md`](docs/backlog.md) — les tickets                                             |
| 5    | Le reste du cahier des charges — narratif, jamais normatif                                     |

Les choix techniques structurants sont consignés dans [`docs/decisions/`](docs/decisions/).

## Démarrer

Node 22 (voir `.nvmrc`) et pnpm 10. **Pas de npm ni de yarn.**

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

## Commandes

```bash
pnpm dev              # serveur de développement
pnpm typecheck        # tsc --noEmit — zéro erreur exigé
pnpm lint             # eslint — zéro avertissement exigé
pnpm format           # prettier --write
pnpm test             # vitest, projet « unit »
pnpm test:isolation   # vitest, projet « isolation » — cloisonnement multi-société
pnpm test:e2e         # playwright
pnpm build            # build de production

pnpm verify           # typecheck + lint + test + test:isolation + build
                      # → porte de sortie de CHAQUE TICKET
pnpm verify:full      # verify + test:e2e
                      # → porte de sortie de CHAQUE LOT, et exécution nocturne en CI
```

`pnpm test:e2e` compile lui-même l'application et la sert sur le port 3100 : c'est une compilation de production qui est mise sous test, pas le serveur de développement.

## Intégration continue

`.github/workflows/ci.yml` — `verify` sur chaque proposition de fusion et chaque poussée hors `main` ; `verify:full` sur `main`, à la demande, et chaque nuit à 02h00 heure de Nouméa.

## Organisation

```
app/          routes Next.js (App Router)
components/   composants, dont components/ui pour shadcn/ui
lib/          i18n/ (dictionnaire français), utils.ts
tests/        unit/  isolation/  e2e/offline/   ← les trois derniers sont sanctuarisés
docs/         cahier des charges, arbitrages, backlog, décisions
```

Le domaine métier s'écrit en français (`intervention`, `machine`, `societe`, `agence`), le code technique en anglais (`createIntervention`, `useSyncQueue`). Jamais mélangés dans un même identifiant.

## État d'avancement

Lot 0 — tickets **L0-01** (initialisation du dépôt) et **L0-02** (chaîne de vérification) faits. Aucune fonctionnalité métier, aucun schéma de base de données : ils commencent au ticket L0-03.
