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

**Et cette politique a CINQ formes, pas une** *(R0-a)*. Le ticket L0-04 écrivait « la forme imposée » au singulier ; recopier cette phrase sur `client`, `site` ou `modele_materiel` écrit une politique **fausse dans le sens permissif — en obéissant**. Les cinq, avec leur cas et une table qui les porte :

| Forme | Clause | S'applique à | Exemple en base |
|---|---|---|---|
| **identité** | `id = app.societe_id` | `societe` SEULE — la table que `societe_id` désigne *(D42)* | `societe` |
| **société** | `societe_id = app.societe_id` | toute table métier **ordinaire** | `agence`, `calendrier`, `utilisateur_societe` |
| **référentiel** | lecture `USING (true)`, écriture `app_est_role_editeur()` | la liste close des référentiels de plateforme *(D4)* | `devise`, `parite`, `jour_ferie` |
| **parc** | société **ET** `app.client_id` **ET** `app.perimetre_sites` | `client`, `site`, `machine` — le portail *(D10)* et le chemin QR *(D22)* | fixtures du harnais ; tables réelles aux lots 1 et 2 |
| **journal** | `SELECT` société **et** habilitation ; `INSERT` seul ; ni `UPDATE` ni `DELETE` | `journal_audit` *(I8)* | `journal_audit` |

**Celle qui NE s'applique JAMAIS à une table métier ordinaire est « référentiel »**, et ses deux moitiés sont fausses pour deux raisons distinctes. Sa lecture est `USING (true)` : toutes les sociétés lisent toutes les lignes — c'est la décision D4 sur `devise` (« le franc Pacifique est le même partout »), c'est la fin du cloisonnement sur `client`. Son écriture est `app_est_role_editeur()` : elle donne le droit au salarié de l'éditeur et le retire à la société propriétaire — l'objet même de la règle sur un référentiel, l'inverse exact de ce que le §22.5 promet au client sur une table métier.

**La branche `OR societe_id IS NULL` de la forme imposée est un vestige, pas une licence.** Sur une colonne `societe_id NOT NULL` — donc sur toute table de la première catégorie — elle est **inerte** : aucune ligne ne peut la satisfaire. Les six tables du lot 0 la portent encore parce que L0-04 l'a écrite ; le gardien ne l'interdit pas, il **mesure son inertie**. Une table nouvelle s'écrit sans elle.

**Et la forme est MESURÉE, pas déclarée** : `scripts/lib/politiques-rls.ts` lit `pg_policies`, qui rend l'expression *analysée*. Les formes 1, 2, 3 et 6 du §9 s'y dissolvent — graphie, enveloppe `DO $$ … $$`, pose en deux temps, nom assemblé à l'exécution : c'est l'état final qui est lu, jamais le texte qui l'installe. Le contrôle tourne sur la base jetable (`test:isolation`) **et** sur la base hébergée (`controle-cloisonnement`).

**Le CONTRAT des fixtures d'isolation est structurel** *(R0-a, écart É14)*. `client`, `site` et `machine` existent aujourd'hui comme tables **fixtures** du harnais et portent la forme « parc ». Le jour où les vraies tables arrivent, la réparation la plus naturelle — supprimer la fixture et donner à la vraie table la clause société seule — **réduisait la couverture sans qu'aucun gardien ne s'en aperçoive**. Trois gardiens indépendants la refusent désormais : la **forme** mesurée dans `pg_policies` (fixture ou table réelle, sans faire la différence) ; la **liste close `TABLES_PARC`**, dont le RETRAIT d'une entrée est refusé — c'est le retrait qui ouvre la brèche, pas l'addition ; et le **plancher de scénarios** par exigence de L0-05 (`EXIGENCES_L0_05`), qui ne se baisse jamais. Les scénarios D10 et D22 doivent rester **plus nombreux** après la reprise, jamais moins.

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
Toute création, modification ou suppression sur une table du périmètre est journalisée avec auteur, horodatage et valeurs avant/après. Le journal est protégé par trigger PostgreSQL, pas seulement par un intercepteur applicatif.

**Le périmètre est INVERSÉ : audité par défaut, exempté par écrit** *(D55)*. Toute table de la **première catégorie de I1** — table métier cloisonnée — est auditée, **moins une liste d'exemptions explicitement justifiées**. C'est un renversement de sens, pas un changement de contenu : une liste d'ADMIS tenue à la main oublie, par construction, la table que personne n'y a ajoutée. D52 en avait corrigé le contenu — des tables plutôt que des notions —, D53 la maison ; ni l'un ni l'autre le sens, et c'est le sens qui dérivait. `client` (L1-01) l'a montré en acte : elle naissait hors périmètre, non par décision mais par oubli.

**L'exhaustivité n'est plus tenue par personne : elle est HÉRITÉE.** La première catégorie de I1 est déjà énumérée exhaustivement par le schéma, et le gardien de D41 exige que chaque table s'y range. Une table métier créée demain est donc auditée à sa naissance, et le gardien la réclame le jour où elle apparaît — sans qu'aucune liste ne soit à compléter.

**UN SEUL motif d'exemption, et la liste est VIDE.** `rejouable` — l'information perdue se reconstitue depuis une autre table auditée. Ne sont **pas** des motifs : le volume (le journal est partitionné précisément pour cela), la sensibilité supposée, et jamais une table dont les lignes sont saisies par un humain. Une liste vide qui reste vide est un meilleur signal qu'une liste à une entrée qu'on cesse de regarder.

**Le journal lui-même est HORS DU DOMAINE, et ce n'est pas une exemption.** Un motif d'exemption est une porte qu'on rouvre par argument ; la frontière est une **liste close d'une entrée, gardée dans les deux sens** — la forme de `CLOISONNEE_PAR_IDENTITE`. Et la raison est doctrinale : **un gardien ne peut pas se garder lui-même** (§9). La récursion mesurée — `stack depth limit exceeded` — n'en est que le symptôme.

**Ce que ce retrait coûte est payé au même endroit, et ÉPROUVÉ.** Le journal n'est pas audité, il est **inaltérable** : `UPDATE` et `DELETE` retirés au rôle applicatif, doublés par l'absence de politique pour ces verbes sous `FORCE ROW LEVEL SECURITY`. C'est plus fort qu'une trace, et cela se prouve par **TENTATIVE** — sur la table mère, et sur **chaque partition** énumérée par `pg_inherits`, jamais sur la mère seule : une partition est une table, elle n'hérite ni des privilèges ni des politiques du parent. Le durcissement est posé par la fonction qui **crée** la partition, dans la même transaction.

**Et tout cela n'a QU'UNE MAISON, celle que la machine lit** *(D53)* : `scripts/lib/perimetre-audit.ts`. L'invariant que vous lisez y renvoie, RG-DRO-04 y renvoie, le README y renvoie — aucun ne le recopie. Une recopie réintroduite ici est refusée par un gardien.

**La liste des exemptions est close des DEUX côtés, et gardée.** `tests/unit/db/perimetre-audit.test.ts` part du schéma : une table métier sans déclencheur fait échouer la vérification **le jour où elle est créée** ; un déclencheur posé hors de la première catégorie de I1 la fait échouer aussi ; un déclencheur posé sur une table exemptée également ; et une exemption qui ne s'adosse à aucune table existante est refusée. Élargir ou restreindre la traçabilité est un arbitrage, jamais une décision de ticket.

### I9 — Aucune donnée de production dans le dépôt
Pas de client réel, pas de photo, pas de clé, pas de `.env`. Les jeux de test viennent de `prisma/seed.ts`.

### I10 — Identifiants : clé technique et numéro affiché sont distincts
`id` est un UUID v7 généré sur l'appareil, y compris hors ligne, et porte toutes les relations et le `qr_token`. `numero` est attribué par le serveur, séquentiellement par société, à la première synchronisation. Tant qu'il est nul, l'interface affiche `Local-<6 caractères>` avec une pastille « non synchronisé ». **Le QR encode le jeton, jamais le numéro.**

### Vocabulaire imposé
**Agence** = établissement CODIMA (Ducos, Koné, Dolbeau). **Site** = lieu d'intervention chez un client. Ces deux mots ne sont jamais interchangeables.

**Et ils ont un domicile dans le code** *(L0-11)* : les clés `vocabulaire.*` de `lib/i18n/fr.ts`, avec leur pluriel et une définition qui nomme ce que la notion **n'est pas**. Le code nomme la notion — `mot("agence")` —, jamais le mot ; un gardien refuse que l'un des deux soit écrit ailleurs dans le dictionnaire. C'est la leçon de D47 rendue mécanique : *un arbitrage qui corrige un mot doit dire où ce mot est écrit* — il est écrit là, et nulle part ailleurs. Ce qu'aucun gardien ne peut faire, et qui reste à la relecture : savoir laquelle des deux notions l'auteur voulait désigner.

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

pnpm audit:partitions # DEUX contrôles sur le journal d'audit (L0-10) :
                      #   préventif — reste-t-il 12 mois de partitions devant ?
                      #   détectif  — la partition par défaut est-elle vide ?
pnpm partitions:etendre # étend l'horizon des partitions du journal

pnpm battement        # la vérification NOCTURNE tourne-t-elle encore ? (R0-a, É12)
                      # état du flux + âge de la dernière nuit. Tourne sur
                      # l'activité HUMAINE, jamais sur la planification : un
                      # contrôle qui ne s'exécute que quand elle s'exécute ne
                      # peut pas constater qu'elle a cessé.

pnpm verify           # typecheck + lint + test + test:isolation + build
                      # → porte de sortie de CHAQUE TICKET
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

**`(prévu)` marque ce qui n'existe pas encore.** L'arborescence dit deux choses de nature différente — ce qui EST et ce qui est PLANIFIÉ —, et sans cette marque le plan se fait passer pour un état. Elle rend les deux sens gardables : tout module non marqué doit exister, tout module qui existe doit être énuméré. Le jour où le module est écrit, la marque se retire avec le reste (`tests/unit/docs/organisation-du-code.test.ts`).

```
app/
  (back-office)/  (mobile)/  (portail)/  (editeur)/  api/
lib/
  db/         client Prisma, contexte société, helpers RLS
  auth/
  clients/    référentiel client (L1-01) — saisie Zod, dépôt cloisonné,
              libellé du code externe paramétrable par société (D29)
              la politique de `client` est de forme « parc », jamais société seule
  money/      formatage et arithmétique — point de passage unique
              jamais de conversion : elle vit dans reporting/ (D19 amendé par D44)
  calendar/   calendriers d'agence, fériés, jours ouvrés — répond à « quand »
              fuseaux IANA, instants UTC, récurrences déroulées à la lecture
              territoire ISO et fuseau : deux attributs de l'agence, jamais
              l'un déduit de l'autre (D46)
              seul endroit où la date courante se lit — et avec un fuseau (L0-08)
              jamais de règle de facturation : l'arrondi au quart d'heure
              appartient à la valorisation (D45)
  sync/       (prévu) protocole hors-ligne
  excel/      (prévu) imports et exports
  pdf/        (prévu) génération des rapports
  reporting/  SEULE zone autorisée à convertir des devises
  theme/      charte de la société active — couleurs, encres, variables CSS
              la lisibilité se CALCULE : seuil 4,5:1 (WCAG 2.1, 1.4.3 AA),
              garanti par le choix noir/blanc, qui plancher à √21 ≈ 4,58 (D51)
              seul endroit du code où une couleur s'écrit en clair
  i18n/       dictionnaire fr.ts — SEUL endroit où une chaîne visible s'écrit
              vocabulaire.ts : agence et site, définis une fois avec leur
              distinction (D5, D47) ; le code nomme la notion, pas le mot
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
- **30/08/2026 — UNE ÉCHÉANCE QUI TOMBE AU PIRE MOMENT EST UN REPORT DÉGUISÉ.** Le journal d'audit devait être partitionné pour que la conservation détache des périodes au lieu de supprimer des lignes. Deux voies : le faire tout de suite, ou inscrire un déclencheur — « avant que la première donnée de production réelle n'entre » — et le garder. Le déclencheur était pourtant **gardable** : le contrôle de cloisonnement énumère déjà les sociétés à chaque migration, il aurait suffi qu'il échoue dès qu'une société hors démonstration apparaît. L'argument qui a emporté la décision n'est donc pas l'oubli, c'est **le moment** : « avant la première donnée réelle » signifie le jour du provisionnement du premier client — c'est-à-dire le jour où l'on veut le moins jouer une migration qui réécrit toute la table, et où l'on sera le plus tenté de la repousser « après la mise en service ». **Une échéance qui se présente au moment le plus défavorable n'est pas une échéance, c'est un report.** Corollaire général, au-delà des partitions : quand une reprise est inévitable un jour, la question n'est pas « quel gardien la déclenchera » mais « à quel moment ce gardien sonnera » — et si la réponse est « au pire », faire la chose maintenant, où elle coûte 0,11 seconde plutôt que vingt. **Le meilleur moyen de ne pas payer une reprise est de n'avoir jamais à la faire.**
- **30/08/2026 — Une PARTITION est une table : elle hérite des privilèges par défaut, pas des politiques du parent.** Mesuré avant d'être corrigé, et le résultat est brutal. `ALTER DEFAULT PRIVILEGES` accorde `SELECT, INSERT, UPDATE, DELETE` au rôle applicatif sur **toute table nouvelle** — une partition en est une, y compris celle qu'un script créera dans dix-huit mois. Et les politiques du parent ne s'appliquent **que si l'on interroge le parent** : nommer la partition les contourne. Sur la forme naïve, sous le rôle applicatif et le contexte de la société A : par le parent, 1 ligne vue — le cloisonnement tient ; **par la partition, 2 lignes vues dont celle d'une autre société, puis `UPDATE` les réécrit toutes et `DELETE` les efface.** Partitionner sans y penser aurait détruit I1 et l'ajout seul de I8 dans la table qui porte les valeurs avant/après de tout le métier. Deux conséquences. **Une garantie posée sur une table ne suit pas ses partitions : elle se repose sur chacune** — `REVOKE ALL` et `FORCE ROW LEVEL SECURITY` sans politique, le routage des lignes n'exigeant aucun privilège sur la partition (mesuré aussi). Et **la création d'une partition et son durcissement ne se séparent jamais** : une seule fonction, appelée par la migration comme par le script d'extension, sinon une partition naîtra un jour sans l'un des deux.
- **30/08/2026 — LA VACUITÉ EST LE MODE DE DÉFAILLANCE DOMINANT DE CETTE MÉTHODE, PAS L'EXCEPTION.** Le dépôt fabrique des gardiens ; il faut donc regarder en face **comment ils échouent**. Ils ne se trompent presque jamais de règle : **ils passent au vert sans avoir rien regardé.** Six fois maintenant, et l'énumération vaut mieux qu'un principe. *21/08* — le motif ne reconnaissait que `lib/calendar/paques` et laissait passer `./paques`, la seule forme qu'un fichier voisin puisse écrire. *24/08* — le jumeau retirait un verrou voisin, si bien qu'une autre clé échouait à la place de celle qu'on croyait éprouver. *26/08* — le gardien SQL n'était vérifié que sur la graphie canonique de la faute, d'où la liste des six formes. *30/08, trois fois dans le même ticket* — une épreuve jouée sur une base vide, dont l'`INSERT … SELECT` n'a inséré aucune ligne : contrôle vert, violation inexistante ; le contrôle permanent des privilèges du journal interrogeant le PARENT, vert sur une partition portant les quatre verbes et aucune RLS ; et un scénario ne lisant que `relforcerowsecurity`, qui serait resté vert sur une RLS inerte. **Dans les six cas, la règle était juste et l'observation était creuse.**

  **UN GARDIEN NE PEUT PAS SE GARDER LUI-MÊME, et c'est une propriété de la méthode, pas un défaut de son exécution.** Un gardien vacuous est vert : il ne produit aucun signal, par définition. Rien à l'intérieur du système ne peut donc le contredire — ni sa propre assertion, qui passe, ni la suite qui l'entoure, qui passe aussi. **Le seul instrument qui démasque une observation creuse est une question posée de l'EXTÉRIEUR** : « ce contrôle regarde-t-il le parent ou les partitions ? », « la violation a-t-elle réellement eu lieu ? », « cette assertion existe-t-elle ailleurs sous sa forme faible ? ». Corollaire pratique : après avoir écrit un gardien, ne pas se demander s'il est juste — il l'est presque toujours — mais **ce qu'il regarde**, et le vérifier en dehors de lui. La revue n'est pas un filet de sécurité facultatif de cette méthode : elle en est l'organe de mesure.

  **Ce qui rend un gardien non vacuous est un TÉMOIN, et il s'écrit exprès.** Une assertion qui prouve que le gardien a bien regardé quelque chose de réel, et qui échoue quand il n'a rien vu : zéro privilège observé est un échec (D38), zéro partition énumérée est un échec, zéro territoire contrôlé est un échec, le nombre de migrations parcourues est minoré, la catégorie « peuplée » est vérifiée. **Un décompte nul ressemble toujours à un sans-faute.** Corollaire de méthode : après avoir écrit l'épreuve d'une violation, **vérifier que la violation a bien eu lieu** — c'est la sonde « la partition peut-elle encore être créée ? » qui a démasqué l'épreuve creuse du 30/08, pas le contrôle lui-même.
- **31/08/2026 — La preuve par LECTURE est la plus forte, et elle a un angle mort nommé : `FORCE`.** Lire de vraies lignes sous de vrais rôles bat toute assertion sur un attribut — une RLS éteinte ne peut pas y survivre : `DISABLE ROW LEVEL SECURITY` sur `societe`, et le rôle applicatif voit aussitôt les deux sociétés sans contexte. **Mais `FORCE ROW LEVEL SECURITY` ne concerne QUE le propriétaire des tables**, si bien qu'une lecture faite sous le rôle applicatif — non propriétaire — ne peut pas le voir. Mesuré sur un propriétaire non superutilisateur : `FORCE` retiré, le rôle applicatif voit toujours **zéro** ligne sans contexte, et le propriétaire en voit **deux**. Le cloisonnement paraît intact, et les migrations, le seed et toute connexion de maintenance lisent alors toutes les sociétés. **Ce qui ne se prouve pas par la lecture doit se prouver par l'attribut** — c'est le seul endroit du dépôt où l'attribut est la seule preuve possible, et il se lit en DEUX drapeaux, jamais un. `scripts/lib/rls-declaree.ts` porte la règle, partagée par le contrôle de la base hébergée et par `tests/isolation/force-rls.test.ts`. *Corollaire de méthode, découvert en cherchant l'assertion faible ailleurs qu'où elle avait mordu :* le contrôle de la base hébergée n'inspectait **aucun** drapeau, et la liste du scénario d'isolation en couvrait **quatre tables sur huit** — chacune ajoutée par un ticket qui n'était pas revenu compléter la liste. D'où la clôture par le schéma plutôt que par une liste : toute table de `public` doit relever d'exactement une des trois catégories d'état RLS.
- **30/08/2026 — Un contrôle PRÉVENTIF ne prouve pas qu'un problème ne s'est pas produit.** L'horizon des partitions dit qu'il reste de la place devant ; il ne dit rien de ce qui s'est déjà passé. Or si une partition a manqué, l'écriture a **réussi** — la partition par défaut l'a rattrapée — et il ne reste aucune trace ailleurs. D'où un second contrôle, **détectif** : la partition par défaut doit être vide, et une ligne qui s'y trouve est la seule preuve rétrospective qu'un mois a manqué. Le préventif protège du problème, le détectif prouve qu'il ne s'est pas produit ; ils sont indépendants dans les deux sens, et un test le montre. Même famille que le jumeau d'un test de refus (24/08) : **une garantie qu'on ne peut pas constater après coup est une intention, pas une garantie.**
- **31/08/2026 — UN `WHERE` QUI RECOUPE L'ASSERTION EST UN TROU : la POPULATION d'un gardien peut s'auto-sélectionner pour exclure le cas à attraper.** Espèce distincte de la vacuité du 30/08, et il faut la nommer séparément parce que le symptôme est le même — un gardien vert — et la cause à l'opposé. Dans la vacuité, l'assertion ne regarde rien. **Ici l'assertion est juste, et elle est juste sur une population dont le cas fautif vient de sortir.**

  Mesuré sur le gardien des formes de politique RLS (R0-a), le jour de son écriture. Il sélectionnait les tables de la première catégorie de I1 par `societe_id NOT NULL`, et il devait faire respecter, entre autres, que la branche `OR societe_id IS NULL` reste inerte — c'est-à-dire que `societe_id` soit `NOT NULL`. **Retirer le `NOT NULL` ne faisait donc pas échouer le gardien : cela faisait sortir la table de son périmètre.** Le contrôle passait au vert **sur le geste même qu'il surveille**, et son propre jumeau — l'épreuve qui retire réellement le verrou — est la seule chose qui l'ait montré.

  **La règle générale : tout gardien dont le critère de sélection porte sur une propriété qu'il est censé faire respecter s'aveugle exactement là où il compte.** La question à poser à chaque `WHERE`, chaque `.filter()`, chaque liste d'exemption : *l'objet qui viole ma règle est-il encore dans ma population ?* Si la réponse est non, le filtre est le trou. La parade est toujours la même — **élargir la population et faire de la propriété une ASSERTION** : ne pas sélectionner sur `NOT NULL`, mais retenir toute colonne `societe_id` et **échouer** sur celle qui est nullable.

  **Corollaire sur les EXEMPTIONS, qui sont des sélections négatives.** Une exemption nomme un chemin ; le jour où ce fichier est renommé, déplacé ou scindé, l'entrée survit et ne protège plus rien — silencieusement, une exemption qui ne s'applique à personne ne faisant échouer personne — et le premier fichier qui reprendra ce nom héritera d'une exemption que personne ne lui a accordée. **Toute liste d'exemption porte donc le témoin de son adossement** : les fichiers qu'elle nomme existent, et un test le dit. Quatre gardiens sur cinq ne le portaient pas ; ils le portent.

- **31/08/2026 — LE SILENCE A EXACTEMENT LA FORME DU SUCCÈS : un garde-fou qui cesse de sonner ne le dit pas.** Le couple préventif/détectif du 30/08 se rejoue sur les alarmes elles-mêmes, et c'est É12 qui l'a montré. Une **issue ouverte automatiquement sur échec nocturne** est le contrôle *détectif* : elle dit qu'une nuit a rougi, et elle le dit dans le dépôt plutôt que dans une boîte de courriel — mesuré le 31/08, la seule alarme existante partait vers la boîte même où deux échecs de « DB migrate & seed » du 20 août sont **restés non lus**. Mais une planification **désactivée** ne produit aucune exécution, donc aucun échec, donc **aucune issue** : le détectif est aveugle à sa propre disparition. D'où le **battement de cœur** — un contrôle qui échoue si la dernière exécution planifiée est trop ancienne. Les deux sont indépendants dans les deux sens, comme l'horizon des partitions et la partition par défaut. **Une alarme qui ne se surveille pas elle-même n'a que la fiabilité de son déclencheur**, et la panne la plus probable d'une alarme n'est pas de sonner à tort : c'est de se taire.

  *Corollaire de rangement, mesuré au même endroit :* la protection contre la désactivation automatique après 60 jours ne tient pas à la planification mais à un **attribut du dépôt** — la règle ne vise que les dépôts publics. Une garantie qui repose sur un attribut extérieur à la chose garantie **s'écrit là où l'on change cet attribut**, jamais seulement dans la décision qui l'a constatée.

- **31/08/2026 — UNE DÉCISION QUI PRESCRIT UNE RÉÉCRITURE AILLEURS QU'OÙ ELLE S'ÉCRIT N'EST PRISE QU'À MOITIÉ, ET LA MOITIÉ MANQUANTE A LA FORME DE LA MOITIÉ FAITE.** Dix règles du chapitre 10 — source de rang 2, celle contre laquelle les tickets métier s'écrivent — avaient été réécrites par un arbitrage de rang 1 sans que le texte bouge : D6 sur RG-PAR-02, D9 sur RG-PLA-04, D15, D16, D22, D23, D25, D29, D30, D32 puis D52. Mesuré par le gardien de R0-b rejoué sur l'état d'avant le ticket : **treize écarts**, zéro paire câblée. Et le chapitre 10 se lisait parfaitement — c'est tout le problème. Une réécriture non appliquée ne laisse **aucune trace** : pas de contradiction visible, pas de test rouge, une règle qui a l'air d'une règle. **Même silence que celui du 31/08 sur les alarmes : la panne ne se signale pas, elle se tait.**

  **D47 avait pourtant nommé le remède — et ne se l'est pas appliqué.** Sa conclusion est « un arbitrage qui corrige un mot doit dire **où** ce mot est écrit, sinon il corrige le glossaire et laisse les règles ». D47 a bien réécrit RG-PLA-01 et RG-PLA-02, et il a écrit dans le chapitre une note en prose libre — que rien ne pouvait lire. Neuf décisions plus anciennes n'avaient même pas cela. **Une prescription qui ne se vérifie pas est une intention**, exactement comme une garantie qu'on ne peut pas constater après coup (30/08).

  **Le remède n'est pas la vigilance, c'est la RÉCIPROCITÉ.** Chaque règle nomme les arbitrages qui l'amendent, chaque arbitrage nomme les règles qu'il amende, et un gardien exige que les deux listes s'accordent — `tests/unit/docs/cablage-arbitrages.test.ts`. Deux listes qui se contrôlent l'une l'autre ne peuvent plus être fausses en silence : il faut désormais mentir des deux côtés. Corollaire général, au-delà des documents : **quand une décision prescrit un changement ailleurs qu'où elle s'écrit, l'autre moitié n'est jamais sous les yeux de la relecture qui l'adopte** — et rien ne la verra si rien n'est posté pour la voir.

  **Et le piège de la population, vu venir pour la première fois AVANT d'y tomber.** La façon naturelle d'écrire ce gardien est « pour chaque règle qui porte une mention d'amendement, vérifier que l'arbitrage cité la cite en retour ». Cette sélection exclut **exactement les dix règles cassées** — celles qui n'en portent aucune. C'est le `WHERE` qui recoupe l'assertion du 31/08, et la parade est la même : partir de l'**ensemble** des règles et de l'**ensemble** des arbitrages, faire de la mention une **assertion** et jamais un critère de sélection. Le gardien échoue en outre sur zéro paire observée, et il est éprouvé dans les deux sens sur des ruptures réellement écrites dans les documents réels — une déclaration retirée, une mention retirée, une référence qui ne s'adosse à rien, une mention mal formée. Sa limite est annoncée : un arbitrage qui amende une règle **sans jamais en écrire la référence** reste hors de portée d'un motif statique.

  *Corollaire sur les listes closes recopiées : voir l'entrée du 01/09 ci-dessous.*

- **01/09/2026 — L'INDÉPENDANCE D'UN GARDIEN NE VIENT PAS DE CE QU'IL RECOPIE, MAIS DES SOURCES QU'IL NE CONTRÔLE PAS.** Le périmètre d'audit de I8 était écrit **trois** fois : au CLAUDE.md, au README, et « en toutes lettres » dans son propre gardien. Cette troisième recopie était délibérée et argumentée — « un gardien qui tirerait son périmètre de la même source que les migrations ne vérifierait rien ; ici, c'est la constitution qui est confrontée au dépôt ». L'argument est juste sur la moitié qui compte et faux sur l'autre : **rien ne confrontait la recopie à la constitution.** Deux listes qui pouvaient diverger en silence, et la divergence serait née le jour d'une onzième table, du côté qu'on n'aurait pas mis à jour. Ce qui faisait la force de ce gardien n'était pas la recopie : c'est qu'il confronte la liste aux **migrations** et au **schéma**, deux sources qu'il ne contrôle pas et qui ne se plient pas à ce qu'il déclare. D53 range la liste dans une seule maison — `scripts/lib/perimetre-audit.ts` — que les trois documents citent sans la recopier : la force du gardien est intacte, la seconde liste a disparu.

  **Le test à faire passer à toute duplication qui se prétend un contrôle :** *qu'est-ce qui confronterait les deux copies ?* Si la réponse est « la relecture », ce n'est pas un contrôle, c'est un doublon — et c'est **une liste close recopiée « pour la lisibilité »**, dont la seconde copie devient fausse le jour où la première grandit, sans rougir.

  **La même question, posée un rang plus bas, a ouvert le contrôle du backlog.** `docs/backlog.md` est de rang 4 et cite des règles de rang 2 et des décisions de rang 1 ; rien ne vérifiait que ce qu'il en dit soit encore vrai — L1-08 portait « seul le dernier lot est annulable » après que D54 l'eut supprimé. Le contrôle est **étroit par construction** : un plan bouge sans cesse, une réciprocité complète coûterait plus qu'elle ne rapporterait, et le mode de défaillance réel est le ticket qui cite une règle **ayant changé depuis**. Chaque ticket citant une source porte donc l'empreinte du texte courant de ses sources — **clôture des amendements comprise**, car un ticket peut être rendu faux par une décision qu'il ne cite pas : L0-10 décrivait le périmètre d'audit en notions, comme D32 qu'il cite, alors que D52 puis D53 l'avaient remplacé. Le gardien ne prouve pas la cohérence, ce qu'aucun motif statique ne peut faire : **il force la relecture à l'instant où elle est due**, et il annonce que c'est tout ce qu'il fait.

  **Et le piège de la population s'y ferme par la STRUCTURE, non par un plancher.** Retirer une citation d'un ticket ne l'en fait pas sortir : l'empreinte porte sur l'**ensemble** des sources citées, en retirer une la fait changer — c'est un écart. Les retirer toutes laisse une estampille qui ne s'adosse plus à rien — écart aussi. Un chiffre plancher n'aurait été qu'une approximation ; ici la propriété se démontre. *(Même famille que le 01/09 sur les bornes : quand on sait mesurer, on ne garde pas l'approximation à côté.)*

- **01/09/2026 — DEUX LECTURES D'UN MÊME CRITÈRE DIVERGENT EN SILENCE, PARCE QU'AUCUNE DES DEUX NE PRÉTEND ÊTRE L'AUTRE.** Espèce distincte de la recopie ci-dessus, et il faut la nommer séparément parce que la parade y est différente. Dans la recopie, une même DONNÉE est écrite deux fois, et l'on sait quoi comparer. Ici, un même CRITÈRE est **implémenté** deux fois, par deux modules légitimes, chacun écrit pour son usage — et rien, dans le code, ne dit qu'ils parlent de la même chose. Les deux sont verts. Aucun ne ment. Ils ne disent simplement plus la même chose.

  **Mesuré sur la première catégorie de I1**, le jour de D55. `categoriesDeLaTable` la lit pour ranger chaque table dans l'une des quatre catégories ; `tablesPremiereCategorieI1` la lit pour en dériver le périmètre d'audit. Même définition — `societe_id` non nullable, plus `societe` par identité, moins les référentiels — écrite deux fois, dans deux fichiers, pour deux raisons. Qu'elles dérivent, et l'une dit « cette table est métier » pendant que l'autre dit « elle n'a pas à être auditée ». **Le défaut ne serait apparu ni dans l'une ni dans l'autre suite** : chacune resterait juste sur sa propre lecture, et le trou vivrait dans l'espace entre les deux, que personne n'habite.

  **La question à poser, et c'est la même qu'à la recopie, un étage plus bas : *qu'est-ce qui les confronterait ?*** Si la réponse est « elles sont écrites pareil », ce n'est pas un contrôle — c'est une ressemblance, et une ressemblance ne survit pas au premier ticket qui touche l'une des deux. La parade est un test qui les fait **répondre l'une à côté de l'autre sur la population réelle**, table pour table, avec un témoin de non-vacuité : deux listes vides sont égales.

  **Corollaire, et c'est lui qu'il faut retenir avant d'écrire la deuxième lecture :** la seconde implémentation d'un critère n'est jamais gratuite. Soit on la remplace par un appel à la première — ce qui est presque toujours possible et presque toujours meilleur —, soit on écrit, dans le même geste, ce qui les confrontera. Ce qu'on ne fait pas, c'est les laisser vivre côte à côte en comptant sur la relecture : c'est exactement ce que le 31/08 disait des documents, et le code n'a pas de privilège.

- **01/09/2026 — UNE BORNE SUR LE TEMPS OU LE RANG EST SOUVENT L'APPROXIMATION D'UN CRITÈRE QU'ON NE SAVAIT PAS MESURER. QUAND LE CRITÈRE DEVIENT MESURABLE, L'APPROXIMATION NE SE CUMULE PAS : ELLE SE RETIRE.** RG-IMP-02 promettait une annulation d'import « pendant **24 heures** », et D15 ajoutait « seul le **dernier lot** est annulable ». Ni l'une ni l'autre ne mesurait quoi que ce soit — toutes deux pariaient sur la seule question qui compte : *cette annulation peut-elle encore faire des dégâts ?* Puis D15 a institué le critère qui la mesure vraiment, ligne par ligne : modifiée depuis, référencée depuis, refus motivé ; le reste est restauré. **Les deux bornes sont alors devenues du bruit défavorable** — elles refusent une annulation dont on peut prouver qu'elle est sans danger, et font perdre une journée à qui découvre son erreur le lendemain. D54 les supprime.

  **Et le critère mesuré traite MIEUX le cas qui avait motivé la borne** — c'est le test à faire avant de la garder « par prudence ». Sur deux imports qui se recouvrent, la règle du dernier lot refusait le premier **en entier**, y compris ses lignes que le second n'a jamais touchées ; le critère ligne à ligne refuse exactement les lignes touchées, avec leur motif, et laisse passer les autres. La borne était donc **à la fois plus permissive** dans un sens — elle autorisait l'annulation du dernier lot sans regarder ce qu'il avait écrasé — **et plus brutale** dans l'autre. Une approximation conservée à côté de sa mesure n'ajoute pas de sécurité : elle en retire, et elle masque le fait qu'on sait désormais répondre.

  *La question à poser à toute borne — un délai, un rang, un plafond, une fenêtre : quelle question ne savait-on pas poser le jour où on l'a écrite ? Si on sait la poser aujourd'hui, la borne n'est plus une garantie, c'est un vestige.*

- **19/08/2026 — Le gardien `tests/isolation/` est PROVISOIRE depuis L0-02.** Il vérifie que le répertoire s'exécute, pas le cloisonnement. Un `test:isolation` vert ne signifie rien tant que L0-05 n'est pas livré. L0-05 REMPLACE ce test provisoire, il ne s'y ajoute pas.
