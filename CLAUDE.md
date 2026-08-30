# CODIPLAN — Constitution du dépôt

Lu automatiquement par Claude Code à chaque session. Fait autorité sur tout le reste.
Si une instruction d'ici contredit une demande ponctuelle, **signaler la contradiction avant d'agir**.

*Version 2 — intègre la note d'arbitrage n°1 du 19 août 2026.*

---

## 1. Ce qu'est ce projet

Plateforme web de gestion des plannings d'intervention de techniciens et du parc machines de leurs clients. Multi-société, multi-devise, application mobile hors-ligne, console éditeur — la solution est destinée à être vendue.

Contexte d'exploitation : Nouvelle-Calédonie. Réseau mobile absent sur une partie du territoire, latence élevée vers l'hébergeur, monnaie sans décimale, fuseau UTC+11 sans changement d'heure.

### Hiérarchie des sources — en cas de divergence

| Rang | Source |
|---|---|
| 1 | `docs/arbitrages.md` — les décisions arrêtées |
| 2 | `docs/cahier-des-charges.md` **chapitre 10** — les règles de gestion |
| 3 | `docs/cahier-des-charges.md` **chapitre 11** — le modèle de données |
| 4 | `docs/backlog.md` — les tickets |
| 5 | Le reste du cahier des charges — narratif, jamais normatif |

**Une règle métier ne s'écrit qu'au chapitre 10.** Une règle trouvée ailleurs et absente du chapitre 10 est non normative.

`docs/maquette/CODIPLAN_Maquette.html` est une illustration d'intention, **pas une spécification**. Deux exceptions promues au rang de règle : le formatage monétaire et les codes couleur des statuts.

Si le cahier des charges est muet ou ambigu, **s'arrêter et poser la question** plutôt qu'inventer une règle métier.

---

## 2. Stack imposée

| Couche | Choix | Ne pas substituer |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript strict | — |
| Style | Tailwind CSS + shadcn/ui | Pas de librairie UI supplémentaire, **hors composant calendrier** |
| Calendrier | Schedule-X | Aucune dépendance payante en V1 |
| Base | PostgreSQL 16 + Row Level Security | — |
| ORM | Prisma | Pas de SQL brut hors migrations et politiques RLS |
| Auth | Better Auth, sessions serveur, MFA sur rôles sensibles | Pas Auth.js |
| Validation | Zod, sur toute entrée serveur sans exception | — |
| Tests unitaires | Vitest | — |
| Tests bout en bout | Playwright | — |
| Excel | SheetJS — `.xlsx` uniquement, jamais de CSV | — |
| PDF | React-PDF | — |
| Stockage objet | Stockage S3-compatible de l'hébergeur | — |
| Email | Resend | — |
| File de jobs | Table PostgreSQL + tâche planifiée | Pas de service dédié |
| CI | GitHub Actions | — |
| Paquets | pnpm | Pas de npm ni yarn |

**Ajouter une dépendance est une décision, pas un réflexe.** Toute nouvelle dépendance se justifie en une phrase dans le message de commit. En cas de doute, écrire les 30 lignes plutôt qu'ajouter 200 Ko.

---

## 3. Invariants non négociables

Dix règles. Une modification qui en viole une est un défaut, même si elle compile et que les tests passent.

### I1 — Cloisonnement multi-société
Quatre catégories de tables, et quatre seulement.

**1. Tables métier** — `societe_id NOT NULL`. Cas général. `societe` fait exception à la forme, non au fond : étant la table que `societe_id` désigne, elle est cloisonnée par son identité (`id = app.societe_id`). *(D42)*

**L'exception est nommée, pas déduite — et c'est une liste close de plus.** Le gardien la tient sous le nom `CLOISONNEE_PAR_IDENTITE` et **échoue si elle contient autre chose que son unique entrée `societe`** : toute addition passe par un arbitrage, elle ne se décide pas dans un ticket. Une exception qu'on lit vaut mieux qu'une règle qu'on élargit — élargir la règle à « cloisonnée d'une manière ou d'une autre » ferait entrer sans décision la table suivante qui s'en réclamerait.

**Toute autre table métier porte donc `societe_id NOT NULL`, ou passe par un arbitrage.** Aux lots 1 à 3 — `client`, `site`, `machine`, `intervention`, `contrat` — ce n'est **pas une friction à contourner : c'est l'objectif**. Le seul moment où la question de cloisonnement se pose sans effort est celui où la table est créée ; un ticket qui la traite comme un obstacle la reporte de trois arbitrages.

**2. Référentiels de plateforme** — `societe_id NULL` ou pas de `societe_id` du tout, lisibles par toutes les sociétés, modifiables par les seuls rôles éditeur. **Liste close et énumérée** : `devise`, `parite` *(D41)*, `jour_ferie` *(D46)*, `famille_materiel`, `modele_materiel`, `checklist_modele`.

`jour_ferie` dit ce qui **est férié** sur un territoire — un fait, comme la parité légale du franc Pacifique. Elle ne dit jamais ce qui est **chômé** : ce choix appartient à l'agence et vit dans `calendrier_ferie`, qui est cloisonnée *(D13, RG-PLA-02)*.

**L'ordre de lecture ne s'inverse jamais** *(D46)* : le **fait public** du territoire d'abord (`jour_ferie`), l'**écart local** de l'agence ensuite (`calendrier_ferie` — un férié travaillé, un pont). Lire dans l'autre sens donnerait à une agence le pouvoir de décréter un férié pour son territoire.

**Le territoire n'est pas le fuseau, et ne s'en déduit jamais** *(D46)*. L'agence porte deux attributs distincts et indépendants : son **fuseau** IANA (quelle heure il est) et son **territoire** en ISO 3166-1 alpha-2 (quels jours sont fériés). `Europe/Paris` couvre plusieurs territoires aux fériés différents. Ni l'un ni l'autre ne se calcule à partir de l'autre — un gardien statique le refuse.

**Un écart local ne s'adosse qu'à un férié de SON territoire** *(D48)*, et c'est la base qui le tient : `calendrier_ferie` porte une colonne `territoire` recopiée de son agence, chaînée par deux clés étrangères composites — `(agence_id, territoire)` vers l'agence, `(jour_ferie_id, date, territoire)` vers le fait public. `agence.territoire` est `NOT NULL` pour cette raison : une clé étrangère dont une colonne vaut NULL n'est pas contrôlée en PostgreSQL. Le **pont** — `jour_ferie_id` nul — reste possible.

**Et ce chaînage ne propage rien** *(D49)* : `ON UPDATE RESTRICT` des deux côtés. Changer le territoire d'une agence est **refusé** tant qu'il lui reste un écart de calendrier — un changement de territoire les invalide réellement. La procédure est de traiter les écarts d'abord, et un déclencheur la rappelle dans le message du refus, à côté du verrou et jamais à sa place.

**3. Tables techniques d'authentification** *(D34, D39)* — **pas de `societe_id` du tout**. Elles portent la trace technique de l'authentification, jamais de la donnée métier : l'authentification doit pouvoir chercher un compte avant qu'aucune société ne soit active, et une bascule refusée de A vers B ne se range ni sous A ni sous B. **Liste close et énumérée** : `session`, `compte`, `verification`, `second_facteur`, `journal_acces`.

`journal_acces` porte `societe_id_source` et `societe_id_cible`, **informatives et nullables**. Elles répondent à une question et à une seule — « qui a tenté d'accéder à mes données » — et **ne filtrent jamais** : ni requête applicative, ni politique, ni index. Un test le prouve.

**4. Table d'identité de plateforme** *(D39)* — **pas de `societe_id` du tout** non plus. **Liste close, et elle ne contient qu'une table : `utilisateur`.**

Pourquoi une catégorie à elle seule, et non la troisième. Une session expire, une vérification se consomme, un second facteur se révoque : ces tables sont **purgeables**. Une identité est **durable**, elle porte des **données personnelles**, et elle sera **exposée dans la console éditeur au lot 7**. Une future politique de purge des tables techniques ne doit jamais pouvoir emporter les identités : ce sont deux régimes de conservation, donc deux catégories.

**Règle attachée, et c'est elle qui rend son non-cloisonnement acceptable : aucune donnée métier sur `utilisateur`.** Fonction, agence de rattachement, habilitations, préférences — tout cela vit dans `utilisateur_societe`, qui est cloisonnée. `utilisateur` ne porte que ce qui sert à **trouver et authentifier** un compte. Un gardien statique lit `prisma/schema.prisma` et échoue si une colonne métier y apparaît.

**Les quatre listes closes sont fermées** — les trois catégories énumérées ci-dessus et l'exception `CLOISONNEE_PAR_IDENTITE` — toute addition exige un arbitrage explicite, jamais une décision de session.

**Et l'exhaustivité est vérifiée, pas supposée** *(D41)*. Un gardien statique énumère toutes les tables de `prisma/schema.prisma` et exige que chacune appartienne à **exactement une** catégorie. Zéro échoue — c'est l'oubli ; deux échouent aussi — c'est la liste qui dit une chose et le schéma une autre. Trois oublis du même type s'étaient déjà succédé : une liste fermée un jour, une décision ultérieure qui crée une table sans revenir la ranger.

Toute requête est filtrée côté serveur, et la base applique en plus une politique RLS.

**Un message d'erreur est un canal d'information : il est soumis au cloisonnement comme une requête** *(D50)*. Ce qu'un refus donne à lire est une réponse, et se compte comme telle. L'exemple qui a fait la règle : un déclencheur explicatif sur `jour_ferie`, qui dirait « 3 écarts référencent ce férié », **apprendrait à un salarié de l'éditeur combien d'agences clientes chôment ce jour-là** — depuis un simple refus, sans avoir jamais lu une table. Un refus a donc le droit d'être **lisible**, jamais d'être **informatif** : il dit ce qui bloque et la marche à suivre, il ne compte pas et ne nomme pas ce que son destinataire n'a pas le droit de lire. Et le raccourci qui le rendrait bavard — une fonction `SECURITY DEFINER` posée pour voir par-dessus les politiques — est refusé par un gardien statique dont la liste d'exceptions est close et vide.

*Vérification : `pnpm test:isolation`.*

### I2 — Jamais de conversion de devise ligne à ligne
Les montants sont stockés dans la devise de la société avec leur code. La seule fonction de conversion est `convertForConsolidation`, réservée à `lib/reporting`, et elle exige une date de parité explicite.

### I3 — Décimales portées par la devise
XPF : zéro décimale. EUR : deux. Jamais de `toFixed(2)` en dur. Tout formatage passe par `formatMoney(montant, devise)` — symbole si la devise en a un, code sinon.

### I4 — Le terrain fonctionne sans réseau
Toute fonctionnalité de l'application technicien est utilisable en mode avion : consultation, saisie, photos, signature, création de machine. Une fonctionnalité mobile qui exige le réseau est refusée.

### I5 — Préséance en cas de conflit de synchronisation
**Terrain** : temps, diagnostic, checklist, photos, signature, création de machine.
**Back-office** : affectation, créneau, priorité.
**Statut** : par préséance — `ANNULEE` > `CLOTUREE` > `TERMINEE` > `EN_COURS` > `SUSPENDUE` > statuts de planification. Le travail terrain n'est jamais perdu, même sur une intervention annulée ; le conflit est journalisé et remonté.

### I6 — Aucun import appliqué sans contrôle préalable
Un import Excel produit d'abord un rapport (créations, modifications, rejets motivés), puis attend une validation explicite. L'annulation est **partielle et sûre** : refus motivé sur les lignes modifiées ou référencées depuis, jamais de suppression en cascade.

### I7 — Calendriers propres à chaque agence
Ducos ouvre du lundi au samedi, Koné du lundi au vendredi. Les jours fériés sont portés par le calendrier de l'agence et peuvent être travaillés. **Aucun calendrier global codé en dur.**
Calendrier de référence par usage : SLA → agence de l'intervention ; majoration → agence du technicien ; conflit à la pose → calendrier de travail du technicien ; site fermé → horaires du site, avertissement seulement.

### I8 — Traçabilité
Toute création, modification ou suppression sur une table du périmètre ci-dessous est journalisée avec auteur, horodatage et valeurs avant/après. Le journal est protégé par trigger PostgreSQL, pas seulement par un intercepteur applicatif.

**Le périmètre est une LISTE DE TABLES, pas une liste de notions** *(D52)*. Il énumérait des entités — « paramétrage société », « compte client » — et il fallait donc l'interpréter pour savoir ce qui était couvert. `utilisateur_societe` est le cas qui l'a montré : la table des habilitations, dont la modification est l'acte le plus lourd de conséquences du système, n'était rangée nulle part avec certitude. On corrige la source plutôt que l'interprétation *(méthode de D44)* : la liste est désormais explicite, et une table s'y ajoute par arbitrage.

| Table | Ce qu'elle porte | Lot |
|---|---|---|
| `societe` | paramétrage de la société | livrée |
| `agence` | établissements *(D5)* | livrée |
| `calendrier`, `calendrier_plage` | heures d'ouverture *(D13)* | livrée |
| `calendrier_ferie` | écarts locaux de calendrier *(D46)* | livrée |
| `utilisateur_societe` | **habilitations** — qui a accordé quel droit *(D52)* | livrée |
| `utilisateur_client` | comptes portail *(D10)* | livrée |
| `machine` | fiches machine | L2-01 |
| `intervention` | interventions | L2-07 |
| `contrat` | contrats | lot 4 |

`utilisateur_societe` y entre parce que **c'est ainsi qu'on se donne un accès** : « qui a accordé ce droit, quand, depuis quelle valeur » est la question qu'un auditeur pose chez un client, et c'est elle qui rend vérifiable la procédure de déblocage de D40 *(L7-01)*. Elle porte `societe_id NOT NULL` : elle entre sans élargir aucune liste close.

**La liste est close des DEUX côtés, et gardée.** `tests/unit/db/perimetre-audit.test.ts` part de cette table-ci : une table du périmètre présente au schéma sans déclencheur fait échouer la vérification **le jour où elle est créée** ; un déclencheur posé sur une table absente de la liste la fait échouer aussi — élargir la traçabilité est un arbitrage, jamais une décision de ticket.

### I9 — Aucune donnée de production dans le dépôt
Pas de client réel, pas de photo, pas de clé, pas de `.env`. Les jeux de test viennent de `prisma/seed.ts`.

### I10 — Identifiants : clé technique et numéro affiché sont distincts
`id` est un UUID v7 généré sur l'appareil, y compris hors ligne, et porte toutes les relations et le `qr_token`. `numero` est attribué par le serveur, séquentiellement par société, à la première synchronisation. Tant qu'il est nul, l'interface affiche `Local-<6 caractères>` avec une pastille « non synchronisé ». **Le QR encode le jeton, jamais le numéro.**

### Vocabulaire imposé
**Agence** = établissement CODIMA (Ducos, Koné, Dolbeau). **Site** = lieu d'intervention chez un client. Ces deux mots ne sont jamais interchangeables.

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
pnpm db:seed          # deux sociétés, l'une en XPF, l'autre en EUR
pnpm build            # build de production

pnpm feries:horizon   # les fériés de chaque territoire couvrent-ils 12 mois ? (D46)
pnpm feries:etendre   # étend l'horizon des fériés en base

pnpm verify           # typecheck + lint + test + test:isolation + build
                      # → porte de sortie de CHAQUE TICKET
pnpm verify:full      # verify + feries:horizon + test:e2e
                      # → porte de sortie de CHAQUE LOT, et exécution nocturne en CI
```

---

## 5. Définition de « terminé »

1. `pnpm verify` passe sans erreur ni avertissement — et `pnpm verify:full` en fin de lot.
2. Les critères d'acceptation du ticket sont couverts par au moins un test automatisé.
3. Aucun `any`, aucun `@ts-ignore`, aucun `eslint-disable` sans commentaire justifiant la ligne.
4. Aucun `console.log` résiduel.
5. Interface en français, terminologie du glossaire, **aucune chaîne en dur dans un composant** — tout passe par `lib/i18n/fr.ts`.
6. Les nouvelles requêtes portent le filtre société.
7. Le message de commit décrit le *pourquoi*.

**Interdit absolu :** modifier, désactiver ou assouplir un test pour faire passer la vérification. Si un test échoue, c'est le code qui est faux — ou le test révèle une ambiguïté, auquel cas il faut s'arrêter et le signaler.

**Interdit absolu :** placer le mot de passe du rôle PostgreSQL `codiplan_reporting` dans `DATABASE_URL` ou dans `MIGRATION_DATABASE_URL` *(D38)*. Ce rôle voit **toutes** les sociétés et peut se connecter : c'est une clé passe-partout, et elle se range comme telle. Son mot de passe va dans un secret **distinct**, `REPORTING_DATABASE_URL`, lu par le seul `lib/reporting`. Il n'en a pas aujourd'hui, et n'en aura pas avant le lot 5. Deux gardiens le tiennent : un test statique refuse que la variable soit nommée hors de `lib/reporting/`, et `scripts/controle-cloisonnement.mts` vérifie à chaque migration, par `information_schema.role_table_grants` et non par déclaration, que le rôle ne détient **aucun privilège autre que `SELECT`**.

---

## 6. Organisation du code

```
app/
  (back-office)/  (mobile)/  (portail)/  (editeur)/  api/
lib/
  db/         client Prisma, contexte société, helpers RLS
  auth/
  money/      formatage et arithmétique — point de passage unique
              jamais de conversion : elle vit dans reporting/ (D19 amendé par D44)
  calendar/   calendriers d'agence, fériés, jours ouvrés — répond à « quand »
              fuseaux IANA, instants UTC, récurrences déroulées à la lecture
              territoire ISO et fuseau : deux attributs de l'agence, jamais
              l'un déduit de l'autre (D46)
              seul endroit où la date courante se lit — et avec un fuseau (L0-08)
              jamais de règle de facturation : l'arrondi au quart d'heure
              appartient à la valorisation (D45)
  sync/       protocole hors-ligne
  excel/      imports et exports
  pdf/
  reporting/  SEULE zone autorisée à convertir des devises
  theme/      charte de la société active — couleurs, encres, variables CSS
              la lisibilité se CALCULE : seuil 4,5:1 (WCAG 2.1, 1.4.3 AA),
              garanti par le choix noir/blanc, qui plancher à √21 ≈ 4,58 (D51)
              seul endroit du code où une couleur s'écrit en clair
  i18n/       dictionnaire fr.ts
components/
prisma/       schema.prisma, migrations/, seed.ts
tests/
  unit/  isolation/  e2e/offline/   ← les trois derniers sont sanctuarisés
docs/
  cahier-des-charges.md  arbitrages.md  backlog.md  guide-pilotage.md
  decisions/  maquette/
```

Le domaine métier est en français (`intervention`, `machine`, `societe`, `agence`), le code technique en anglais (`createIntervention`, `useSyncQueue`). Jamais mélangés dans un même identifiant.

---

## 7. Comment travailler

- **Un ticket à la fois.** Lire le ticket, relire le chapitre 10 correspondant et `docs/arbitrages.md`, écrire le test, écrire le code, `pnpm verify`, commiter, pousser sur `origin main`.
- **Test d'abord** pour toute règle de gestion, avec le numéro de règle en commentaire.
- **Commits atomiques.** Un commit ne couvre jamais deux tickets.
- **Une migration se réécrit tant qu'elle n'a pas touché une base réelle ; après, elle est immuable.** Avant sa première application hors des bases jetables, la corriger sur place vaut mieux que d'en ajouter une seconde : deux migrations dont la seconde défait la première se relisent mal. Une fois appliquée à une base réelle, elle ne se touche plus — on en ajoute une seconde, sans exception. Prisma tient déjà cette seconde moitié tout seul, par empreinte : modifier une migration déjà appliquée fait échouer `migrate deploy`. **Le jugement ne porte donc que sur l'avant-première-application** — et c'est le seul endroit où il faut l'exercer.
- **Le README suit le dépôt, dans la même demande de fusion.** Un ticket qui ajoute un **module**, une **table** ou une **commande** met le README à jour avec le reste. Un README qui ment est le même défaut qu'une procédure fausse : on lui fait confiance, et il est lu par ceux qui connaissent le moins le projet.
- **Décisions structurantes** → un fichier dans `docs/decisions/` : contexte, options écartées, choix, conséquences. Trois paragraphes.
- **En cas de blocage** : ne pas contourner, ne pas réduire le périmètre en silence. S'arrêter, décrire ce qui bloque et les options.

---

## 8. Points où il faut s'arrêter et demander

- une **règle métier absente ou ambiguë** au chapitre 10 et non tranchée dans `docs/arbitrages.md` ;
- un **montant, un taux, un délai** non spécifié — ne jamais inventer de valeur par défaut ;
- un **changement de schéma** touchant `societe_id`, les devises, les statuts d'intervention ou la liste close de I1 ;
- l'**assouplissement d'un invariant** ;
- l'ajout d'une **dépendance lourde** ou d'un service externe payant ;
- tout ce qui touche au **cloisonnement** ou aux données personnelles.

Dans ces cas : s'arrêter, exposer le problème, proposer deux options avec leurs conséquences, attendre.

---

## 9. Erreurs à ne pas refaire

- **20/08/2026 — Une liste close se re-vérifie à chaque table créée, sinon elle devient fausse.** `second_facteur` et `utilisateur` manquaient à D34, `parite` manquait à D4 : trois fois le même enchaînement — la liste est fermée, une décision ultérieure crée une table, personne ne revient la ranger. Une liste close qui a l'autorité d'une décision et le contenu d'un oubli est pire qu'une liste ouverte. Le gardien d'exhaustivité de D41 renverse la charge : il part du schéma, pas de la liste.
- **19/08/2026 — Ne jamais écrire la même règle métier à deux endroits.** Le cahier des charges v1.2 formulait certaines règles trois fois avec des variantes, ce qui a produit 60 points d'ambiguïté. Le chapitre 10 est la source unique ; tout le reste y renvoie.
- **19/08/2026 — Ne jamais nommer une colonne d'après l'outil d'un seul client.** `code_winpro` est devenu `code_externe` : le produit est destiné à être vendu à des sociétés qui n'utilisent pas Winpro.
- **20/08/2026 — Ne jamais fermer une énumération avant d'avoir tranché à qui l'on vend.** L'énumération des rôles a été arrêtée à neuf avant l'arbitrage « il faut prévoir de vendre la solution » ; il y manquait un administrateur au niveau société, si bien que créer un compte chez un client serait passé par l'éditeur. `admin_societe` est le dixième rôle (D37). Une énumération se ferme après la question « et chez le client ? », jamais avant.
- **20/08/2026 — Un refus qui explique pourquoi est un renseignement.** « Compte inexistant », « mot de passe faux » et « compte sans habilitation » se répondaient différemment : cela suffisait à découvrir, depuis la seule page de mot de passe oublié, quels concurrents sont clients de la plateforme. Un seul message, un seul plancher de durée (D35).
- **21/08/2026 — Une donnée datée se périme en silence ; il faut un gardien du TEMPS.** Les jours fériés sont datés. Une table alimentée une fois cesse de connaître les fériés deux ans plus tard **sans jamais être vide** : elle est périmée, le planning propose des créneaux un 1ᵉʳ mai, et aucun décompte ne le signale — un décompte non nul ressemble beaucoup trop à des données justes. D'où trois pièces indissociables *(D46)* : un **horizon glissant** dans le seed (jamais une liste d'années écrite à la main), un **script versionné** pour l'étendre, et un **contrôle daté** dans `verify:full` qui échoue en nommant le territoire et sa dernière date connue. C'est le principe des listes closes appliqué au temps : une donnée qui se périme en silence vaut une liste close que personne ne surveille.
- **21/08/2026 — Un gardien vert sur un cas fabriqué n'est pas un gardien éprouvé.** Les trois gardiens de L0-08 passaient tous leurs scénarios fabriqués. Mis à l'épreuve d'une violation réellement écrite dans le code puis retirée, l'un d'eux s'est révélé aveugle : l'interdiction d'appeler le calcul de Pâques depuis le métier ne reconnaissait que la forme lointaine de l'import (`lib/calendar/paques`) et laissait passer `./paques` — c'est-à-dire **la seule forme qu'un fichier voisin puisse écrire**. Un cas fabriqué prouve que le motif sait mordre ; seule une violation réelle prouve qu'il mord là où la faute se commet.
- **23/08/2026 — Le seed s'éprouve sur le chemin réel, pas seulement sur une base jetable.** Le seed passait en 0,3 s en local et échouait en P2028 sur la base hébergée, au 28ᵉ aller-retour d'une transaction dont le délai valait 5 000 ms par défaut. Le code était identique des deux côtés ; **la seule variable était la latence** — une milliseconde en local, cent-quatre-vingt-dix vers Sydney, un facteur deux cents. Aucune suite du dépôt ne pouvait l'attraper : `test:isolation` vise un PostgreSQL jetable et local *par exigence*, et le seul chemin qui touche la base hébergée est déclenché à la main *par décision*. Le seul environnement où le défaut existe est donc le seul qui ne soit jamais exercé. Deux conséquences. **Un défaut de latence ne se mesure pas, il se calcule** : le gardien compte les allers-retours, les multiplie par une latence majorée, et échoue quand le produit dépasse le délai fixé (`tests/unit/seed-delais.test.ts`) — même mécanique que l'horizon des fériés. Et **un délai par défaut est une valeur de réseau local** : tout ce qui s'exécute contre la base hébergée dit ses délais, ou hérite d'un chiffre écrit pour une autre géographie. Voir `docs/decisions/2026-08-23-seed-transaction-latence-neon.md`.
- **24/08/2026 — LA FORME ATTENDUE D'UN TEST DE REFUS : chaque refus a son jumeau qui retire réellement le verrou.** Un test de refus prouve que le verrou mordait **le jour où on l'a écrit**. Rien ne dit qu'il mord **encore** : la contrainte a pu être desserrée, remplacée par une variante permissive, ou le test devenir vert pour une autre raison que la sienne. **Tout test qui prouve un refus s'accompagne donc d'un jumeau qui défait réellement le verrou** — retrait de la contrainte, du déclencheur, de la politique — **et montre que l'écriture fautive passe alors.** Le jumeau s'exécute dans une transaction annulée : le DDL est transactionnel en PostgreSQL, la contrainte revient au `ROLLBACK`, et le jumeau rejoue à chaque `pnpm verify` au lieu d'être une vérification faite une fois à la main. Trois exigences, et la troisième est celle qu'on oublie : le jumeau retire **le verrou visé**, pas un voisin ; il place le scénario dans la configuration où le défaut **réussit** plutôt que dans celle où il échoue autrement ; et l'assertion **nomme la contrainte**, sans quoi un refus venu d'ailleurs passe pour le bon. C'est éprouvé : le premier gardien de D49 était vert avec `ON UPDATE CASCADE` rétabli, parce qu'une autre clé échouait à sa place. Prolonge la leçon du 21/08 — un gardien vert sur un cas fabriqué n'est pas un gardien éprouvé — et la rend systématique.
- **24/08/2026 — Une action référentielle est une règle de gestion déguisée en modalité technique.** `ON UPDATE CASCADE` n'avait été décidé par personne : c'est le défaut de Prisma, recopié dans une migration. Il répondait pourtant tout seul à une question qui appartient au métier — que devient un calendrier quand l'agence change de territoire ? Réponse mesurée en base : réécriture **silencieuse** quand l'agence n'a que des ponts, échec désignant la mauvaise table sinon. **Une valeur par défaut qui répond à une question qu'on n'a pas posée est une décision prise par personne** — même enchaînement que le délai de 5 000 ms écrit pour une autre géographie. Corollaire : **toute clé étrangère nouvelle dit ses DEUX actions, et les justifie.** `ON DELETE` était déjà regardé, supprimer étant visible ; `ON UPDATE` ne l'était pas, au motif que les identifiants ne changent jamais — vrai des identifiants techniques, faux de toute colonne métier qu'un chaînage fait entrer dans une clé. Voir `docs/decisions/2026-08-24-territoire-agence-sans-propagation.md` *(D49)*.
- **23/08/2026 — Une colonne nullable posée « faute de défaut légitime » devient obligatoire au moment où une contrainte s'appuie dessus, et ce moment est le bon.** `agence.territoire` avait été laissée nullable à bon droit : il n'existe aucun défaut légitime, et un `DEFAULT 'NC'` aurait été un territoire codé en dur. Puis un chaînage de clés est venu s'appuyer dessus — et **une clé étrangère dont une colonne vaut NULL n'est pas contrôlée en PostgreSQL** (`MATCH SIMPLE`). Le verrou aurait été muet exactement là où la donnée manque, c'est-à-dire chez l'agence la moins bien paramétrée : un verrou qui s'ouvre tout seul sur les cas mal renseignés est pire qu'une absence de verrou, il donne le sentiment d'une garantie. Le corollaire, pour la suite : **poser une contrainte sur une colonne nullable, c'est poser une contrainte facultative.** La question n'est jamais « peut-on chaîner quand même » mais « rend-on la colonne obligatoire maintenant, ou renonce-t-on au chaînage ». Le coût ne sera jamais plus bas qu'au moment où la question se pose. Voir `docs/decisions/2026-08-23-territoire-du-ferie-reference.md` *(D48)*.
- **26/08/2026 — UN GARDIEN QUI INSPECTE DU SQL S'ÉPROUVE SUR UNE LISTE FIXE DE FORMES ÉQUIVALENTES.** Troisième fois qu'un gardien est vérifié sur la forme *canonique* d'un défaut plutôt que sur celle qu'il prendrait *réellement* — l'import `./paques` du 21/08, le jumeau qui retire le bon verrou du 24/08. La parade cesse donc d'être une vigilance et devient une liste : **tout gardien qui lit du SQL est éprouvé sur les six formes ci-dessous, et son verdict sur chacune est une mesure consignée dans le ticket, pas une opinion.**
  1. **Graphie** — casse, espaces multiples, retour à la ligne entre deux mots-clés (`security\ndefiner`), identifiant entre guillemets ou nu, nom qualifié par un schéma, `CREATE OR REPLACE`.
  2. **Enveloppe d'exécution** — la faute écrite *à l'intérieur* d'un `DO $$ … $$`, d'un `EXECUTE '…'` ou d'un `EXECUTE format(…)`. Corollaire, et c'est le plus important : **le périmètre examiné ne retire jamais les chaînes littérales.** La seule coupure légitime est « documentation contre exécution » — `--` et `COMMENT ON … IS '…'` —, jamais « code contre chaîne ».
  3. **Deux temps** — créer l'objet innocent puis le basculer : `ALTER FUNCTION … SECURITY DEFINER`, `ALTER TABLE … DISABLE ROW LEVEL SECURITY`, `DROP` puis re-`CREATE`. Un gardien qui ne surveille que le verbe de création ne lit que la moitié de l'histoire : **c'est l'état final qui compte, pas le verbe qui l'installe.**
  4. **L'exemption elle-même** — toute soustraction au périmètre se prouve **avec une vraie faute dans le même fichier**, sinon l'exemption devient un passage : un fichier qui porte une note licite ne doit pas faire entrer la faute avec elle.
  5. **La forme voisine** — celle qu'un correcteur **bien intentionné** écrirait, greffée dans le fichier réel où la faute se commettrait, jamais dans un fichier fabriqué (leçon du 21/08).
  6. **Ce qui reste hors de portée, et qui se dit dans le gardien** — l'assemblage délibéré (`'SECU' || 'RITY DEFINER'`, nom construit à l'exécution). Un gardien statique arrête la correction bien intentionnée, pas un contournement décidé ; l'écrire vaut mieux que laisser croire le contraire.

  *Mesuré sur le gardien `SECURITY DEFINER` de D50 : les formes 1 à 5 sont refusées — y compris `CREATE FUNCTION … SECURITY DEFINER` dans un bloc `DO`, y compris adossée à la note `COMMENT ON` du même fichier —, la forme 6 passe, et c'est la limite qu'il annonce lui-même.*
- **19/08/2026 — Le gardien `tests/isolation/` est PROVISOIRE depuis L0-02.** Il vérifie que le répertoire s'exécute, pas le cloisonnement. Un `test:isolation` vert ne signifie rien tant que L0-05 n'est pas livré. L0-05 REMPLACE ce test provisoire, il ne s'y ajoute pas.
