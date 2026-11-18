# 9L22-CI-DURCIE — passation

Démarré le 19/11/2026 à 06:31 (Nouméa), budget 90 min.

## La règle tenue

Décision d'Alexis du 10/11/2026 : les flux GitHub qui écrivent sur une base
réelle — `db-migrate.yml`, `premier-compte.yml`, `amorcage-base.yml`,
`db-resolve.yml` — épinglent leurs actions tierces par empreinte de commit,
descendent leurs secrets au niveau de l'étape qui les lit, portent un bloc
`permissions:` minimal, et (pour les trois purement manuels) un
`environment: production`. Le détail est en D273 (`docs/arbitrages.md`).

Ce lot vient d'une revue indépendante d'Alexis des réglages du dépôt ; le
détail de cette revue n'entre pas ici — seules la règle et l'épreuve qui la
prouve y sont.

## Ce qui est livré

### Point 1 — actions tierces épinglées par empreinte

Les trois actions communes aux quatre flux sont désormais référencées par
leur empreinte de commit à quarante caractères, la version lisible restant
en commentaire :

- `actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09` (`# v5.1.0`)
- `actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444` (`# v5.0.0`)
- `pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1` (`# v4.3.0`)

Les trois empreintes sont celles vers lesquelles les étiquettes `@v5.1.0`,
`@v5.0.0` et `@v4.3.0` pointent au 19/11/2026 (lues sur l'API publique de
GitHub). Aucun changement de version : seule la référence mobile est
remplacée par une référence fixe.

### Point 2 — secrets descendus à l'étape

Dans les quatre flux, les secrets de connexion (`MIGRATION_DATABASE_URL`,
`PRODUCTION_MIGRATION_DATABASE_URL`, et pour `db-migrate.yml` les deux
applicatifs) ne sont plus déclarés dans l'`env:` du JOB — visible de toutes
ses étapes, y compris « Installer les dépendances », qui exécute le code
`postinstall` d'une dépendance tierce — mais dans celui de la seule étape
« Choisir la base, et refuser plutôt que se rabattre », qui les lit. Les
secrets déjà posés au niveau de l'étape (`COURRIEL_API_CLE`,
`COURRIEL_EXPEDITEUR` dans `premier-compte.yml`) n'ont pas bougé : ils
l'étaient déjà.

### Point 3 — bloc `permissions:` minimal

Chaque job des quatre flux porte désormais :

```yaml
permissions:
  contents: read
```

Même forme que celle déjà posée sur `db-doublons-machine-demo.yml`
(hors du périmètre de ce ticket, mais la convention est reprise).

### Point 4 — `environment: production`

`premier-compte.yml`, `amorcage-base.yml` et `db-resolve.yml` déclarent
`environment: production` sur leur job. `db-migrate.yml` ne le reçoit PAS :
il mélange un déclenchement automatique (`push`, cible toujours
« demonstration », D116) et un déclenchement manuel ; un `environment:`
fixe au niveau du job aurait aussi mis en attente d'approbation le chemin
automatique que D116 a voulu libre. Si une protection est voulue sur son
seul chemin manuel-production, cela suppose soit un `environment:`
conditionnel (à vérifier sur l'état actuel de GitHub Actions), soit de
scinder le flux en deux jobs — hors budget de ce ticket, à trancher.

**Geste d'Alexis, pas à pas** :

1. Réglages du dépôt → *Settings* → *Environments* → *New environment*.
2. Nommer l'environnement exactement `production` (l'environnement se crée
   aussi tout seul à la première exécution d'un flux qui le référence, s'il
   n'existe pas déjà — ce geste permet de poser la protection AVANT la
   première exécution).
3. Dans l'environnement `production`, cocher *Required reviewers* et
   désigner au moins un réviseur. C'est cette case, et elle seule, qui rend
   `environment: production` bloquant plutôt que décoratif.
4. Vérifier que la case *Deployment branches* n'est PAS restreinte à une
   branche — ces trois flux se déclenchent depuis `workflow_dispatch`, pas
   depuis une branche de déploiement nommée.

### Point 5 — refus d'une « base » non chiffrée

`premier-compte.yml` refuse désormais, avant tout autre geste, une entrée
« base » (l'URL publique de l'application, utilisée pour composer le lien
de premier accès) qui ne commence pas par `https://`.

### Point 6 — journaux réduits à des totaux

- `scripts/inventaire.mts` (`rapport`) : n'imprime plus que le nombre de
  sociétés présentes et les totaux table par table, toutes sociétés
  confondues, plus les témoins hors cloisonnement. Le détail par société
  (code, identifiant, décompte table par table) reste porté par la donnée
  `Inventaire` elle-même — `ecartsInventaire`, `ecartsAvecContexte` et le
  fichier d'échange `inventaire-controle.json` (jamais versionné, I9) en
  ont besoin pour NOMMER une fuite le jour où il y en a une.
- `scripts/decrire-connexions.mts` (`ligne`) : n'imprime plus l'hôte ni le
  nom de la base de chaque connexion — seulement si elle est lisible, si
  elle est mutualisée, sa région, si un port est renseigné, et le nombre de
  paramètres de requête. La comparaison d'hôte entre les deux connexions
  reste faite (elle est l'objet même de cette étape), mais seul le résultat
  « oui »/« non » est rendu, jamais les deux valeurs comparées.

### Point 7 — épreuve des bornes 1, 3 et 5

`tests/unit/ci/durcissement-flux.test.ts` (nouveau) lit les quatre fichiers
de flux et vérifie :

- qu'aucun `uses:` ne porte un nom de version mobile (toute référence est
  une empreinte à quarante caractères hexadécimaux), et que la version
  reste lisible en commentaire ;
- que chaque flux porte un bloc `permissions:` qui ne concède que
  `contents: read`, jamais un droit d'écriture ;
- que le refus d'une « base » non chiffrée (point 5) est RÉEL : le fragment
  de shell de l'étape est extrait du flux et exécuté sous `bash -c`, avec
  quatre entrées (une URL `https://` valide, une URL `http://`, une chaîne
  quelconque, une entrée vide) — ce n'est pas une mesure de texte, c'est une
  exécution.

`tests/unit/db/inventaire.test.ts` a dû être mis à jour sur un seul point :
le gardien « aucun repli entre les deux secrets » lisait le bloc `env:` du
JOB de `db-migrate.yml`, qui n'existe plus sous cette forme depuis le point
2 ; il lit désormais le bloc `env:` de l'étape « Choisir la base », qui
porte la même propriété.

## Ce qui n'a pas été construit, et pourquoi

Aucune migration — ce ticket ne touche à aucun schéma.

**`scripts/controle-cloisonnement.mts` porte le même défaut que le point 6**
(son rapport nomme le code de chaque société avec son détail table par
table), et ce n'est PAS corrigé par ce lot : ce fichier n'est l'un des
quatre flux nommés par le ticket, et le corriger sous pression de budget
risquait d'introduire une régression sur un rapport dont dépendent
plusieurs scénarios d'isolation. **À planifier en suite directe de ce
lot.**

Aucune capture d'écran : ce ticket ne touche aucun écran de l'application —
seuls des flux GitHub Actions et deux scripts de journal sont modifiés.

`pnpm verify` (format, typecheck, lint, test, isolation, build) passe sans
erreur ni avertissement. `pnpm verify:full` est laissé à la file, comme
demandé. `pnpm test:e2e` n'a pas été rejoué : aucun écran n'est concerné par
ce lot.
