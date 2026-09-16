# CODIPLAN — Constitution du dépôt

Lu automatiquement par Claude Code à chaque session. Fait autorité sur tout le reste.
Si une instruction d'ici contredit une demande ponctuelle, **signaler la contradiction avant d'agir**.

*Version 2 — intègre la note d'arbitrage n°1 du 19 août 2026.*

---

## 0. Où vit le reste de la constitution

**Ce fichier est un NOYAU, pas un résumé.** Ce qu'il énonce, il l'énonce en entier ; ce
qu'il n'énonce pas, il le NOMME. Le texte détaché n'a pas changé d'un mot et **garde le
rang 1** — `docs/constitution/` est la constitution au même titre que cette page.

*AT-05, 16/09/2026 : le fichier pesait 259 245 octets, lus à chaque démarrage de session
avant qu'une ligne de code ne soit écrite. Le contenu n'était pas en cause, le mode de
chargement l'était.*

**La numérotation n'a pas bougé** : une trentaine de fichiers citent « `CLAUDE.md` §8 »,
« §6 », « §9 » en toutes lettres — code, CI, décisions, backlog —, et renuméroter les
aurait rendues fausses **en silence**. Les § 6, 7 et 9 restent ci-dessous, comme portes.

| Fichier | Ce qu'il porte | Quand l'ouvrir |
|---|---|---|
| `docs/constitution/erreurs-a-ne-pas-refaire.md` | Le §9 **intégralement** | **Avant d'écrire un gardien** ; avant de croire qu'une réparation en est une ; avant d'affirmer un état sans l'avoir observé |
| `docs/constitution/organisation-du-code.md` | Le §6 intégralement — l'arborescence | Avant de créer un module ou un fichier dans `lib/` ; pour chercher où une règle vit déjà |
| `docs/constitution/invariants.md` | Le §3 intégralement — listes closes, treize formes de politique RLS | Dès qu'on touche au cloisonnement, à une politique, au périmètre d'audit, à une liste close |
| `docs/constitution/comment-travailler.md` | Le §7 intégralement | En ouvrant un ticket, et avant de toucher à `prisma/migrations/` |
| `docs/constitution/stack.md` | Le §2 moins son tableau — SheetJS et Schedule-X barrés | Avant d'ajouter une dépendance ou de rouvrir un choix de bibliothèque |
| `docs/constitution/sources.md` | Le §1 moins son tableau — les trois sources de rang 1, la maquette (D95) | Quand deux documents divergent ; avant de s'écarter de la maquette |

Aucun n'est orphelin, aucun n'est absent de ce tableau : les deux sens sont refusés par
`tests/unit/docs/constitution-indexee.test.ts`.

---

## 1. Ce qu'est ce projet

Plateforme web de gestion des plannings d'intervention de techniciens et du parc machines de leurs clients. Multi-société, multi-devise, application mobile hors-ligne, console éditeur — la solution est destinée à être vendue.

Contexte d'exploitation : Nouvelle-Calédonie. Réseau mobile absent sur une partie du territoire, latence élevée vers l'hébergeur, monnaie sans décimale, fuseau UTC+11 sans changement d'heure.

### Hiérarchie des sources — en cas de divergence

| Rang | Source |
|---|---|
| 1 | `docs/arbitrages.md` — les décisions arrêtées |
| 1 | `docs/protocole-session.md` — **comment une session travaille** |
| 1 | `docs/doctrine-arbitrage.md` — **les familles de règles déjà tranchées** |
| 2 | `docs/cahier-des-charges.md` **chapitre 10** — les règles de gestion |
| 3 | `docs/cahier-des-charges.md` **chapitre 11** — le modèle de données |
| 4 | `docs/backlog.md` — les tickets |
| 5 | Le reste du cahier des charges — narratif, jamais normatif |

**Une règle métier ne s'écrit qu'au chapitre 10.** Une règle trouvée ailleurs et absente du chapitre 10 est non normative.

Si le cahier des charges est muet ou ambigu, **s'arrêter et poser la question** plutôt qu'inventer une règle métier.

Le reste du §1 — les trois sources de rang 1, et la maquette depuis D95 — est dans
`docs/constitution/sources.md`.

---

## 2. Stack imposée

| Couche | Choix | Ne pas substituer |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript strict | — |
| Style | Tailwind CSS + shadcn/ui | Pas de librairie UI supplémentaire, **hors composant calendrier** |
| Calendrier | ~~Schedule-X~~ — **aucun composant imposé** *(tranché le 12/09/2026, D105)* | Aucune dépendance payante en V1 |
| Base | PostgreSQL 16 + Row Level Security | — |
| ORM | Prisma | Pas de SQL brut hors migrations et politiques RLS |
| Auth | Better Auth, sessions serveur, MFA sur rôles sensibles | Pas Auth.js |
| Validation | Zod, sur toute entrée serveur sans exception | — |
| Tests unitaires | Vitest | — |
| Tests bout en bout | Playwright | — |
| Excel | ~~SheetJS~~ — **`read-excel-file`** *(tranché le 10/09/2026, D90)* ; `.xlsx` uniquement, jamais de CSV | — |
| PDF | React-PDF | — |
| Stockage objet | Stockage S3-compatible de l'hébergeur | — |
| Email | Resend | — |
| File de jobs | Table PostgreSQL + tâche planifiée | Pas de service dédié |
| CI | GitHub Actions | — |
| Paquets | pnpm | Pas de npm ni yarn |

**Ajouter une dépendance est une décision, pas un réflexe.** Toute nouvelle dépendance se justifie en une phrase dans le message de commit. En cas de doute, écrire les 30 lignes plutôt qu'ajouter 200 Ko.

Pourquoi SheetJS et Schedule-X sont barrés plutôt qu'effacés : `docs/constitution/stack.md`.

---

## 3. Invariants non négociables

Dix règles. Une modification qui en viole une est un défaut, même si elle compile et que
les tests passent.

**Ce tableau est un INDEX, jamais la règle** — on ne se réclame pas d'un invariant sur la
foi d'une ligne. Chaque ligne a sa section dans `docs/constitution/invariants.md`, où
l'invariant est écrit en entier, avec ses listes closes et ce qui les garde. Un gardien
exige que les dix titres ci-dessous existent là-bas à l'identique : les deux ne peuvent
pas diverger en silence.

| # | Invariant | En une ligne |
|---|---|---|
| I1 | Cloisonnement multi-société | Quatre catégories de tables et quatre seulement ; toute requête filtrée côté serveur **et** une politique RLS en base — treize formes, listes closes énumérées au fichier |
| I2 | Jamais de conversion de devise ligne à ligne | Montants stockés dans la devise de la société avec leur code ; seule `convertForConsolidation`, réservée à `lib/reporting`, convertit, et elle exige une date de parité explicite |
| I3 | Décimales portées par la devise | XPF zéro décimale, EUR deux ; jamais de `toFixed(2)` en dur, tout formatage passe par `formatMoney(montant, devise)` |
| I4 | Le terrain fonctionne sans réseau | Toute fonctionnalité de l'application technicien est utilisable en mode avion ; une fonctionnalité mobile qui exige le réseau est refusée |
| I5 | Préséance en cas de conflit de synchronisation | Terrain sur le travail, back-office sur la planification, statut par préséance `ANNULEE` > `CLOTUREE` > … ; le travail terrain n'est jamais perdu |
| I6 | Aucun import appliqué sans contrôle préalable | Un rapport d'abord, une validation explicite ensuite ; annulation partielle et sûre, jamais de suppression en cascade |
| I7 | Calendriers propres à chaque agence | Aucun calendrier global codé en dur ; le calendrier de référence dépend de l'usage — SLA, majoration, conflit à la pose, site fermé |
| I8 | Traçabilité | Toute écriture sur une table du périmètre est journalisée (auteur, horodatage, avant/après) par déclencheur PostgreSQL ; périmètre **inversé** — audité par défaut, exempté par écrit — et une seule maison, `scripts/lib/perimetre-audit.ts` |
| I9 | Aucune donnée de production dans le dépôt | Pas de client réel, pas de photo, pas de clé, pas de `.env` ; les jeux de test viennent de `prisma/seed.ts` |
| I10 | Identifiants : clé technique et numéro affiché sont distincts | `id` est un UUID v7 généré sur l'appareil et porte les relations ; `numero` est attribué par le serveur à la première synchronisation. **Le QR encode le jeton, jamais le numéro** |

### Vocabulaire imposé

**Agence** = établissement CODIMA (Ducos, Koné, Dolbeau). **Site** = lieu d'intervention
chez un client. Ces deux mots ne sont jamais interchangeables.

Ils ont un domicile dans le code — les clés `vocabulaire.*` de `lib/i18n/fr.ts` — et le
code nomme la notion, `mot("agence")`, jamais le mot.

---

## 4. Commandes

```bash
pnpm dev              # serveur de développement
pnpm typecheck        # tsc --noEmit — zéro erreur exigé
pnpm lint             # eslint — zéro avertissement exigé
pnpm test             # vitest
pnpm test:isolation   # cloisonnement multi-société (bloquant)
pnpm test:e2e         # playwright, dont le gardien hors-ligne
pnpm db:migrate       # prisma migrate dev
pnpm db:deploy        # prisma migrate deploy — LA commande de mise en ligne :
                      # applique les migrations manquantes sur une base neuve
                      # ou existante, sans jamais en réécrire une appliquée
pnpm db:seed          # deux sociétés, l'une en XPF, l'autre en EUR
                      # DÉMONSTRATION UNIQUEMENT — le flux de migration le
                      # SAUTE sur la cible « production » (gardien :
                      # tests/unit/ci/cible-de-migration.test.ts)
pnpm db:referentiels  # devises et parités sur une base qui n'a PAS vu le seed
                      # ce sont des FAITS (I1, 2e catégorie), pas de la
                      # démonstration — et sans eux aucune société n'existe
pnpm db:societe-initiale # LA première société d'une base de production
                      # aucune de ses sept valeurs n'a de défaut : la
                      # majoration est un POURCENTAGE, donc un prix (§8)
pnpm build            # build de production

pnpm db:resoudre      # UNE MIGRATION A ÉCHOUÉ, et la base est bloquée (P3018)
                      # elle déclare l'échec ANNULÉ et rend la migration
                      # rejouable — elle n'en APPLIQUE aucune : un verbe par
                      # flux, sinon le geste qui débloque rebloque
                      # elle REFUSE sans rien écrire quand la migration a
                      # appliqué au moins une étape : la base en porte une
                      # partie, et « annulée » serait faux
                      # « --applied » n'est exposé nulle part (flux GitHub
                      # « DB resolve », gardien :
                      # tests/unit/db/resolution-migration.test.ts)

pnpm feries:horizon   # les fériés de chaque territoire couvrent-ils 12 mois ? (D46)
pnpm feries:etendre   # étend l'horizon des fériés en base

pnpm audit:partitions # DEUX contrôles sur le journal d'audit (L0-10) :
                      #   préventif — reste-t-il 12 mois de partitions devant ?
                      #   détectif  — la partition par défaut est-elle vide ?
pnpm partitions:etendre # étend l'horizon des partitions du journal

pnpm file             # LE PREMIER TRAVAIL NON BLOQUÉ de docs/backlog.md
                      # la file de nuit se LIT, elle ne s'interprète pas :
                      # trois états — LIBRE, LIVRÉ, BLOQUÉ — <motif> —, posés
                      # sur la ligne qui suit le titre du ticket. Un ticket
                      # sans marqueur, ou un BLOQUÉ sans motif, fait échouer
                      # `pnpm verify`. La POPULATION est dérivée du document :
                      # un ticket écrit demain y entre ce jour-là.

pnpm chemins          # QUELLE COUCHE UN HUMAIN PEUT-IL ATTEINDRE ? (R3-12)
                      # pour chaque module de lib/ et pour chaque fonction de
                      # ses dépôts : est-elle atteinte depuis app/, et PAR QUOI
                      # — nommément, jamais par un décompte
                      # la marque LIVRÉ se posait sur trois preuves, dont
                      # « l'existence du module dans lib/ » : les trois prouvent
                      # qu'une COUCHE a été écrite, aucune qu'un humain
                      # l'atteigne. L1-01 était LIVRÉ avec zéro route
                      # la commande DÉCRIT ; ce qui échoue est le gardien
                      # (tests/unit/gardiens/chemins-de-depot.test.ts), dont la
                      # population se dérive du dépôt et dont la liste
                      # d'exemptions est close DANS LES DEUX SENS — une
                      # exemption dont la fonction a retrouvé un appelant
                      # échoue, parce qu'une exemption qui ne protège plus rien
                      # survit à ce qu'elle exemptait
                      # ce qu'elle ne prouve PAS : qu'un chemin soit TROUVABLE
                      # — une fonction appelée depuis un écran mort compte

pnpm veille           # LA BASE HÉBERGÉE a-t-elle dérivé ? (D55)
                      # les contrôles d'observation — DOUZE aujourd'hui : RLS,
                      # formes de politique, périmètre d'audit, ajout seul du
                      # journal, durcissement des partitions, privilèges de
                      # consolidation, branche IS NULL de périmètre, WITH CHECK
                      # explicite, ARMEMENT DU CONTEXTE (L1-02b), depuis D91
                      # le TÉMOIN DE LECTURE puis la LECTURE SANS CONTEXTE, et
                      # depuis D104 les CONTRAINTES POSÉES « NOT VALID » —
                      # une règle qui ne vaut que pour une partie des lignes
                      # est une DÉCISION, et sans ce contrôle « NOT VALID »
                      # serait le raccourci qui fait taire une migration ;
                      # la liste est FERMÉE CONTRE scripts/lib/, inversée comme
                      # le périmètre d'audit, et onze n'est qu'un instantané
                      # (tests/unit/veille-hebergee.test.ts)
                      # — joués CHAQUE NUIT contre la vraie base, sous le rôle
                      # APPLICATIF et en LECTURE SEULE (SET TRANSACTION READ
                      # ONLY). Le contrôle statique ne voit pas ce qu'une main
                      # fait hors migration. Deux rouges distincts : 75 si la
                      # base est INJOIGNABLE (exploitation), 1 si elle a DÉRIVÉ
                      # (sécurité) — les mêler apprendrait à ne lire ni l'un
                      # ni l'autre.

pnpm deploiement:verifier # LA PRODUCTION DÉPLOYÉE EST-ELLE DEBOUT ? (R3-01)
                      # elle ouvre /api/sante EN LIGNE et rend un verdict —
                      # mêmes codes que la veille : 0 sain, 1 écart CONSTATÉ,
                      # 75 rien constaté. Elle NE MIGRE RIEN : elle nomme le
                      # geste, un humain le joue et le regarde
                      # elle refuse de conclure tant qu'elle n'a pas reconnu
                      # LE COMMIT visé — l'ancienne version répond « tout va
                      # bien » en toute sincérité, sa base lui suffisant, et
                      # un vert tomberait dans la fenêtre où la panne naît
                      # sans URL_PRODUCTION elle ROUGIT, elle ne saute pas :
                      # un contrôle qui se tait quand il n'est pas configuré
                      # est le contrôle qu'on croit avoir

pnpm battement        # la vérification NOCTURNE tourne-t-elle encore ? (R0-a, É12)
                      # état du flux + âge de la dernière nuit. Tourne sur
                      # l'activité HUMAINE, jamais sur la planification : un
                      # contrôle qui ne s'exécute que quand elle s'exécute ne
                      # peut pas constater qu'elle a cessé.

pnpm verify           # format:check + typecheck + lint + test + test:isolation
                      # + build → porte de sortie de CHAQUE TICKET
                      # `format:check` en fait partie depuis l'incident du
                      # 02/09 : la CI le jouait à part, si bien qu'un `verify`
                      # vert et sincère pouvait être rouge en CI. La porte du
                      # ticket et la porte de la CI gardent la MÊME chose, et
                      # un gardien l'exige (tests/unit/chaine-verification).
pnpm verify:full      # verify + feries:horizon + audit:partitions + test:e2e
                      # → porte de sortie de CHAQUE LOT, et exécution nocturne en CI
```

---

## 5. Définition de « terminé »

1. `pnpm verify` passe sans erreur ni avertissement — et `pnpm verify:full` en fin de lot.
2. Les critères d'acceptation du ticket sont couverts par au moins un test automatisé.
3. Aucun `any`, aucun `@ts-ignore`, aucun `eslint-disable` sans commentaire justifiant la ligne.
4. Aucun `console.log` résiduel.
5. Interface en français, terminologie du glossaire, **aucune chaîne en dur dans un composant** — tout passe par `lib/i18n/fr.ts`.
   **La coupure est écrite une fois**, en tête du dictionnaire *(L0-11)* : ce qu'un **humain** lit en se servant de l'application y passe — texte, libellé, titre, attribut lu par un lecteur d'écran, message d'erreur **rendu à l'écran**, texte attendu par un test de rendu ; ce qu'un **développeur ou une machine** lit n'y passe pas — message de gardien, exception technique, trace, erreur de migration, nom de rôle ou de statut. Même famille que « documentation contre exécution » de D50 : c'est la **destination** du texte qui décide, jamais le fichier.
   Le gardien lit tout le dépôt et **déduit** ce qui est concerné — trois marques : le fichier contient du JSX, il exporte les `metadata` de Next.js, il interroge l'écran. Aucune liste de répertoires à compléter, donc aucune liste à oublier.
6. Les nouvelles requêtes portent le filtre société.
7. Le message de commit décrit le *pourquoi*.

**Interdit absolu :** modifier, désactiver ou assouplir un test pour faire passer la vérification. Si un test échoue, c'est le code qui est faux — ou le test révèle une ambiguïté, auquel cas il faut s'arrêter et le signaler.

**Interdit absolu :** placer le mot de passe du rôle PostgreSQL `codiplan_reporting` dans `DATABASE_URL` ou dans `MIGRATION_DATABASE_URL` *(D38)*. Ce rôle voit **toutes** les sociétés et peut se connecter : c'est une clé passe-partout, et elle se range comme telle. Son mot de passe va dans un secret **distinct**, `REPORTING_DATABASE_URL`, lu par le seul `lib/reporting`. Il n'en a pas aujourd'hui, et n'en aura pas avant le lot 5. Deux gardiens le tiennent : un test statique refuse que la variable soit nommée hors de `lib/reporting/`, et `scripts/controle-cloisonnement.mts` vérifie à chaque migration, par `information_schema.role_table_grants` et non par déclaration, que le rôle ne détient **aucun privilège autre que `SELECT`**.

---

## 6. Organisation du code

**Détaché le 16/09/2026 (AT-05) : ce § vit mot pour mot, et au même rang, dans
`docs/constitution/organisation-du-code.md`.** Arborescence inchangée, marque `(prévu)` comprise ; le gardien qui la tient la lit désormais là.

---

## 7. Comment travailler

**Détaché le 16/09/2026 (AT-05) : ce § vit mot pour mot, et au même rang, dans
`docs/constitution/comment-travailler.md`.** Un ticket à la fois, test d'abord, commits atomiques, la règle des migrations et celle du README.

---

## 8. Points où il faut s'arrêter et demander

**Avant de s'arrêter, vérifier `docs/doctrine-arbitrage.md`.** Si la question tombe sous une des familles qui y sont écrites, trancher en s'y appuyant, écrire la décision avec sa condition de réouverture, et ne pas ouvrir de ticket — sauf si elle touche l'argent facturé à un client, une obligation légale, ce qu'un client voit, ou plus largement tout ce qui serait irréversible dans une relation client (§1 de `docs/doctrine-arbitrage.md`), auquel cas elle reste un point d'arrêt malgré tout.

- une **règle métier absente ou ambiguë** au chapitre 10 et non tranchée dans `docs/arbitrages.md` ;
- un **montant, un taux, un délai** non spécifié — ne jamais inventer de valeur par défaut ;
- un **changement de schéma** touchant `societe_id`, les devises, les statuts d'intervention ou la liste close de I1 ;
- l'**assouplissement d'un invariant** ;
- l'ajout d'une **dépendance lourde** ou d'un service externe payant ;
- tout ce qui touche au **cloisonnement** ou aux données personnelles.

Dans ces cas : s'arrêter, exposer le problème, proposer deux options avec leurs conséquences, attendre.

---

## 9. Erreurs à ne pas refaire

**Détaché le 16/09/2026 (AT-05) : ce § vit mot pour mot, et au même rang, dans
`docs/constitution/erreurs-a-ne-pas-refaire.md`.** Le plus long des six, et celui à avoir lu avant d'écrire un gardien : pas une ligne n'a été abrégée.

---
