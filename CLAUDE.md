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
| 1 | `docs/protocole-session.md` — **comment une session travaille** |
| 1 | `docs/doctrine-arbitrage.md` — **les familles de règles déjà tranchées** |
| 2 | `docs/cahier-des-charges.md` **chapitre 10** — les règles de gestion |
| 3 | `docs/cahier-des-charges.md` **chapitre 11** — le modèle de données |
| 4 | `docs/backlog.md` — les tickets |
| 5 | Le reste du cahier des charges — narratif, jamais normatif |

**Les trois sources de rang 1 ne se recouvrent pas** *(écrit le 10/09/2026, complété le 11/09/2026)*. `arbitrages.md` dit **ce qui a été décidé** — des décisions particulières, datées, numérotées ; `protocole-session.md` dit **comment une session travaille** — qui décide quoi, les deux seuls cas d'arrêt, la forme d'un ticket `arbitrage`, l'économie de contexte, la forme du rapport ; `doctrine-arbitrage.md` dit **quand une session peut trancher seule sans reposer la question** — les familles de règles, hors ce qui touche l'argent facturé, une obligation légale ou ce qu'un client voit. Elles sont à égalité parce qu'aucune ne peut trancher les autres : une contradiction entre elles est un **défaut à signaler**, jamais une préséance à appliquer. Ces sept sections étaient recopiées à l'identique en tête de chaque consigne depuis dix jours ; *une règle recopiée à la main est une règle qui s'érode.*

**Une règle métier ne s'écrit qu'au chapitre 10.** Une règle trouvée ailleurs et absente du chapitre 10 est non normative.

~~`docs/maquette/CODIPLAN_Maquette.html` est une illustration d'intention, **pas une spécification**.~~ **ELLE FAIT FOI SUR LA DISPOSITION ET SUR LES COULEURS** *(D95, 11/09/2026)*. Ce qu'elle montre se suit ; ce qu'elle ne dit pas reste libre, et un écart s'écrit avec sa mesure et le point précis où elle est muette — jamais « la maquette ne prévoyait pas ce cas ». La phrase d'origine est conservée barrée : elle a gouverné le dépôt pendant trois semaines, et ce qui a été décidé un jour se relit. Les deux exceptions qu'elle promouvait déjà — le formatage monétaire et les codes couleur des statuts — restent des règles ; elles ne sont plus des exceptions, elles sont le cas général.

**IL N'EN EXISTE QU'UN EXEMPLAIRE, et c'est gardé** *(11/09/2026)*. Le fichier a vécu quelques heures en double — `docs/` et `docs/maquette/` —, octet pour octet identiques, et rien ne l'aurait dit le jour où l'un des deux aurait bougé : *une source qui fait foi en deux exemplaires n'est plus une source.* `tests/unit/docs/maquette-unique.test.ts` refuse le second.

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
| Excel | ~~SheetJS~~ — **`read-excel-file`** *(tranché le 10/09/2026, D90)* ; `.xlsx` uniquement, jamais de CSV | — |
| PDF | React-PDF | — |
| Stockage objet | Stockage S3-compatible de l'hébergeur | — |
| Email | Resend | — |
| File de jobs | Table PostgreSQL + tâche planifiée | Pas de service dédié |
| CI | GitHub Actions | — |
| Paquets | pnpm | Pas de npm ni yarn |

**Le §2 nommait SheetJS, et il a été écrit quand SheetJS était sur npm** *(amendement du 09/09/2026)*. Le paquet `xlsx` y est figé sur `0.18.5` — c'est ce que le registre annonce comme `latest` —, et **deux avis de sécurité HAUTS le visent sans correctif atteignable depuis npm** : `patched_versions: <0.0.0` pour les deux, l'éditeur ne publiant plus que sur sa propre distribution. Le premier, CVE-2023-30533, est une pollution de prototype **qui se déclenche à la lecture d'un fichier apporté** — l'usage exact et unique de ce module. *« Borner par l'usage » ne borne rien quand l'usage EST le vecteur.*

**TRANCHÉ LE 10/09/2026 — la bibliothèque est `read-excel-file`** *(D90)*. Ce qui manquait à la comparaison du 09/09 était **un vrai fichier d'Excel** : elle le disait elle-même — *« aucun fichier produit par Excel lui-même n'a été lu »*. L'exploitation a fourni le sien, une fixture en a été tirée **par retrait** (`tests/fixtures/dates-excel.xlsx`), et les quatre dates relevées en sortent **identiques sous trois fuseaux**, dont `Pacific/Noumea`. Le sérial était le proxy d'un critère — *« le jour ne bouge pas »* — qu'on sait maintenant mesurer directement : §9 du 01/09, *une borne posée faute de savoir mesurer se retire quand la mesure existe.* Le paragraphe qui suit reste écrit : il dit pourquoi SheetJS est écarté, et c'est cela qu'on relit.

**Ce n'était donc pas une contrainte qu'on contourne, c'était une contrainte devenue CADUQUE** — un vestige, comme la borne du déclencheur d'événement. *Une décision qui nomme un fournisseur sur une prémisse fausse ne lie plus.* Le §2 exige désormais **une bibliothèque de lecture `.xlsx` maintenue** ; il n'en nomme plus aucune, et le choix est un arbitrage que la comparaison du registre du 09/09/2026 instruit. Le nom est **barré et non effacé** : ce qui a été décidé un jour se relit, sinon on le redécide.

**Ajouter une dépendance est une décision, pas un réflexe.** Toute nouvelle dépendance se justifie en une phrase dans le message de commit. En cas de doute, écrire les 30 lignes plutôt qu'ajouter 200 Ko.

---

## 3. Invariants non négociables

Dix règles. Une modification qui en viole une est un défaut, même si elle compile et que les tests passent.

### I1 — Cloisonnement multi-société
Quatre catégories de tables, et quatre seulement.

**1. Tables métier** — `societe_id NOT NULL`. Cas général. `societe` fait exception à la forme, non au fond : étant la table que `societe_id` désigne, elle est cloisonnée par son identité (`id = app.societe_id`). *(D42)*

**L'exception est nommée, pas déduite — et c'est une liste close de plus.** Le gardien la tient sous le nom `CLOISONNEE_PAR_IDENTITE` et **échoue si elle contient autre chose que son unique entrée `societe`** : toute addition passe par un arbitrage, elle ne se décide pas dans un ticket. Une exception qu'on lit vaut mieux qu'une règle qu'on élargit — élargir la règle à « cloisonnée d'une manière ou d'une autre » ferait entrer sans décision la table suivante qui s'en réclamerait.

**Toute autre table métier porte donc `societe_id NOT NULL`, ou passe par un arbitrage.** Aux lots 1 à 3 — `client`, `site`, `machine`, `intervention`, `contrat` — ce n'est **pas une friction à contourner : c'est l'objectif**. Le seul moment où la question de cloisonnement se pose sans effort est celui où la table est créée ; un ticket qui la traite comme un obstacle la reporte de trois arbitrages.

**2. Référentiels de plateforme** — `societe_id NULL` ou pas de `societe_id` du tout, lisibles par toutes les sociétés, modifiables par les seuls rôles éditeur. **Liste close et énumérée** : `devise`, `parite` *(D41)*, `jour_ferie` *(D46)*.

**Elle a PERDU trois entrées le 08/09/2026** — ~~`famille_materiel`~~, ~~`modele_materiel`~~, ~~`checklist_modele`~~ *(D4 amendé, ticket L1-05)*. D4 se contredisait : il les rangeait sous « modifiables par les seuls rôles éditeur » et écrivait dans la même page qu'« une société qui veut l'adapter en crée une copie ». *Une société qui ne peut pas écrire ne peut pas créer de copie.* Et « la copie masque l'original » est une règle de **sélection**, que RLS ne sait pas porter. Le mécanisme est **retiré**, pas arbitré : ce sont des tables métier cloisonnées. Quatrième fois que ce dépôt tranche ainsi — zones, rôles de contact, habilitations, et ici.

**Et un effet de bord mesuré :** après ce retrait, **plus aucun référentiel ne porte de colonne `societe_id`**. La première moitié de la phrase ci-dessus — « `societe_id` NULL » — reste vraie sans avoir d'exemplaire, et un témoin le dit à l'endroit où on pourrait la lire comme la preuve qu'un cas existe.

`jour_ferie` dit ce qui **est férié** sur un territoire — un fait, comme la parité légale du franc Pacifique. Elle ne dit jamais ce qui est **chômé** : ce choix appartient à l'agence et vit dans `calendrier_ferie`, qui est cloisonnée *(D13, RG-PLA-02)*.

**L'ordre de lecture ne s'inverse jamais** *(D46)* : le **fait public** du territoire d'abord (`jour_ferie`), l'**écart local** de l'agence ensuite (`calendrier_ferie` — un férié travaillé, un pont). Lire dans l'autre sens donnerait à une agence le pouvoir de décréter un férié pour son territoire.

**Le territoire n'est pas le fuseau, et ne s'en déduit jamais** *(D46)*. L'agence porte deux attributs distincts et indépendants : son **fuseau** IANA (quelle heure il est) et son **territoire** en ISO 3166-1 alpha-2 (quels jours sont fériés). `Europe/Paris` couvre plusieurs territoires aux fériés différents. Ni l'un ni l'autre ne se calcule à partir de l'autre — un gardien statique le refuse.

**Un écart local ne s'adosse qu'à un férié de SON territoire** *(D48)*, et c'est la base qui le tient : `calendrier_ferie` porte une colonne `territoire` recopiée de son agence, chaînée par deux clés étrangères composites — `(agence_id, territoire)` vers l'agence, `(jour_ferie_id, date, territoire)` vers le fait public. `agence.territoire` est `NOT NULL` pour cette raison : une clé étrangère dont une colonne vaut NULL n'est pas contrôlée en PostgreSQL. Le **pont** — `jour_ferie_id` nul — reste possible.

**Et ce chaînage ne propage rien** *(D49)* : `ON UPDATE RESTRICT` des deux côtés. Changer le territoire d'une agence est **refusé** tant qu'il lui reste un écart de calendrier — un changement de territoire les invalide réellement. La procédure est de traiter les écarts d'abord, et un déclencheur la rappelle dans le message du refus, à côté du verrou et jamais à sa place.

**3. Tables techniques d'authentification** *(D34, D39, amendée par L1-02d)* — **pas de `societe_id` du tout**. Elles portent la trace technique de l'authentification, jamais de la donnée métier : l'authentification doit pouvoir chercher un compte avant qu'aucune société ne soit active, et une bascule refusée de A vers B ne se range ni sous A ni sous B. **Liste close et énumérée** : `session`, `compte`, `verification`, `second_facteur`, `journal_acces`.

**Elles sont désormais CLOISONNÉES PAR LA BASE** *(décision d'exploitation du 08/09/2026)*. Elles ne l'étaient pas — aucune RLS, aucune politique, les quatre verbes pour le rôle applicatif —, et la mesure du 07/09 a dit ce que cela valait : sous un contexte de `technicien`, une **empreinte de mot de passe** et un **jeton de session** lus, n'importe quelle ligne de `second_facteur` effacée, toutes sociétés confondues. *Ce n'est pas une donnée métier dont on discute le cloisonnement : c'est le matériel qui permet de devenir quelqu'un d'autre.*

**L'exemption était un VESTIGE, et c'est la forme du raisonnement qu'il faut retenir.** Ces cinq tables avaient été laissées sans plancher pour la même raison que `utilisateur` : l'authentification précède la société, et nous ne savions pas exprimer une garantie avant le contexte. Nous savons depuis L1-02c — c'est « désignation ». **Une borne posée faute de mieux ne se reconduit pas dès que le mieux existe : elle se retire.**

**La règle est uniforme, les formes ne le sont pas.** *Aucune table de cette catégorie n'est lisible sans une désignation ou un contexte*, et la forme de chacune est **déduite de son chemin d'accès réel** — tracé, jamais supposé : le **jeton** pour `session`, l'identifiant d'utilisateur pour `compte` et `second_facteur`, l'identifiant opaque pour `verification`.

**`second_facteur` n'a AUCUNE politique de suppression, et c'est le cœur du ticket** *(D58, D59)*. `mfa_actif` n'est qu'un drapeau : un cliquet posé sur lui seul aurait été **décoratif**, la ligne se supprimant sans jamais y toucher. PostgreSQL porte des politiques **par verbe** ; sous `FORCE`, un verbe sans politique est refusé pour tout le monde. Le retrait d'un second facteur est un acte administratif — L7-01, `admin_plateforme` seul, journalisé —, et ce ticket écrira sa propre politique.

`journal_acces` porte `societe_id_source` et `societe_id_cible`, **informatives et nullables**. Elles répondent à une question et à une seule — « qui a tenté d'accéder à mes données » — et **ne filtrent jamais** : ni requête applicative, ni politique, ni index. Un test le prouve.

**Et `journal_acces` n'est pas de la même espèce que les quatre autres** *(D59)* : c'est une **trace**, pas un matériau d'authentification. Elle reçoit donc la forme du journal — ni modification ni suppression, refusées deux fois plutôt qu'une, par l'absence de privilège **et** par l'absence de politique. L'**ajout seul** a été voulu puis **mesuré impossible** : `INSERT … RETURNING` est soumis à la politique de LECTURE, et sans politique de `SELECT` Prisma ne peut plus écrire du tout. Sa lecture est donc **bornée à la désignation** — plus fort que l'état d'avant, plus faible que l'ajout seul, et l'écart est écrit plutôt que tu.

**4. Table d'identité de plateforme** *(D39, amendée par L1-02c)* — **pas de `societe_id` du tout** non plus. **Liste close, et elle ne contient qu'une table : `utilisateur`.**

**Elle est désormais CLOISONNÉE PAR LA BASE** *(décision d'exploitation du 07/09/2026)*. Elle ne l'était pas : son cloisonnement vivait entièrement dans la couche applicative, et *une garantie qui ne vit que dans la couche applicative n'en est pas une*. Ce qui n'a pas changé : elle ne porte toujours aucun `societe_id`, parce qu'une même personne travaille légitimement pour deux sociétés. Ce qui a changé : elle porte les deux drapeaux RLS et trois politiques — lecture (« désignation » **ou** rattachement), ouverture, modification. **Elle reste une catégorie à elle seule** : son régime de conservation n'est pas celui des tables techniques, et c'était déjà la raison de la quatrième catégorie.

Pourquoi une catégorie à elle seule, et non la troisième. Une session expire, une vérification se consomme, un second facteur se révoque : ces tables sont **purgeables**. Une identité est **durable**, elle porte des **données personnelles**, et elle sera **exposée dans la console éditeur au lot 7**. Une future politique de purge des tables techniques ne doit jamais pouvoir emporter les identités : ce sont deux régimes de conservation, donc deux catégories.

**Règle attachée, et c'est elle qui rend son non-cloisonnement acceptable : aucune donnée métier sur `utilisateur`.** Tout cela vit du côté cloisonné, et `utilisateur` ne porte que ce qui sert à **trouver et authentifier** un compte. Un gardien statique lit `prisma/schema.prisma` et échoue si une colonne métier y apparaît.

**Et « du côté cloisonné » S'ÉNUMÈRE, avec la marque `(prévu)` du §6** *(réparé le 11/09/2026)*. La rédaction précédente disait « fonction, agence de rattachement, habilitations, préférences — tout cela **vit dans** `utilisateur_societe` » : au présent, comme un état. **Mesuré au schéma : `utilisateur_societe` porte `utilisateur_id`, `societe_id` et `role`, et rien d'autre.** Trois des quatre notions n'avaient aucune colonne nulle part — *la constitution affirmait un état que le schéma n'a pas*, ce qui est la pente du §9 du 07/09 appliquée à elle-même. La règle ne bouge pas d'un mot ; c'est son énumération qui devient exacte, et gardable :

| Ce qui vit du côté cloisonné | Où, aujourd'hui |
|---|---|
| le rôle | `utilisateur_societe.role` |
| les habilitations de technicien | `technicien_habilitation` *(L1-04)* |
| le rattachement portail et son périmètre | `utilisateur_client`, `utilisateur_client_site` *(D10, D79)* |
| la **fonction** | `(prévu)` — aucune colonne ne la porte |
| l'**agence de rattachement** | `(prévu)` — la table `technicien` du chapitre 11 la porte, et **elle n'existe pas** ; D72 en dépend |
| les **préférences** | `(prévu)` — aucune colonne ne la porte |

**Les deux sens sont gardés**, comme au §6 : une colonne énumérée sans marque doit exister au schéma, et une notion marquée `(prévu)` qui recevrait une colonne rendrait la marque fausse le jour même. Voir `tests/unit/docs/donnees-du-cote-cloisonne.test.ts`.

**Les quatre listes closes sont fermées** — les trois catégories énumérées ci-dessus et l'exception `CLOISONNEE_PAR_IDENTITE` — toute addition exige un arbitrage explicite, jamais une décision de session.

**Et l'exhaustivité est vérifiée, pas supposée** *(D41)*. Un gardien statique énumère toutes les tables de `prisma/schema.prisma` et exige que chacune appartienne à **exactement une** catégorie. Zéro échoue — c'est l'oubli ; deux échouent aussi — c'est la liste qui dit une chose et le schéma une autre. Trois oublis du même type s'étaient déjà succédé : une liste fermée un jour, une décision ultérieure qui crée une table sans revenir la ranger.

Toute requête est filtrée côté serveur, et la base applique en plus une politique RLS.

**Et cette politique a TREIZE formes, pas une** *(R0-a ; la sixième, L1-02b ; la septième, L1-02c ; la huitième, D61 ; la neuvième, D67 ; la dixième, D92 ; les onzième et douzième, D93 ; la treizième, D94)*. Le ticket L0-04 écrivait « la forme imposée » au singulier ; recopier cette phrase sur `client`, `site` ou `modele_materiel` écrit une politique **fausse dans le sens permissif — en obéissant**. Les treize, avec leur cas et une table qui les porte :

| Forme | Clause | S'applique à | Exemple en base |
|---|---|---|---|
| **identité** | `id = app.societe_id` | la CLAUSE que `societe` porte *(D42)* — depuis D67 elle est une MOITIÉ de la forme « adhésion », jamais une forme à elle seule | `societe` |
| **société** | `societe_id = app.societe_id` | toute table métier **ordinaire** | `agence`, `calendrier`, `utilisateur_societe` |
| **référentiel** | lecture `USING (true)`, écriture `app_est_role_editeur()` | la liste close des référentiels de plateforme *(D4)* | `devise`, `parite`, `jour_ferie` |
| **parc** | société **ET** `app.client_id` **ET** `app.perimetre_sites` | `client`, `site`, `machine` — le portail *(D10)* et le chemin QR *(D22)* | fixtures du harnais ; tables réelles aux lots 1 et 2 |
| **journal** | `SELECT` société **et** habilitation ; `INSERT` seul ; ni `UPDATE` ni `DELETE` | `journal_audit` *(I8)* | `journal_audit` |
| **habilitation** | société **ET** ( pas de `app.client_id` **OU** sa propre ligne ) | `utilisateur_client`, `utilisateur_client_site` — ce qui DONNE accès au parc *(L1-02b)* | `utilisateur_client` |
| **désignation** | la ligne que l'appelant NOMMAIT DÉJÀ, **plus** un rattachement à la société active pour `utilisateur` | `utilisateur` *(L1-02c)*, puis les quatre tables techniques d'authentification *(L1-02d)* — et uniquement pour ce qui PRÉCÈDE la société | `utilisateur`, `session`, `compte`, `verification`, `second_facteur` |
| **appartenance** | société pour tout le monde, **plus** SA PROPRE LIGNE en `SELECT` SEUL | `utilisateur_societe` *(D61)* — la table qui dit sur quelles sociétés une identité est habilitée | `utilisateur_societe` |
| **adhésion** | identité pour tout le monde, **plus** SES PROPRES SOCIÉTÉS en `SELECT` SEUL | `societe` *(D67)* — sans elle, un sélecteur ne peut afficher que des UUID | `societe` |
| **rattachement** | habilitation pour tout le monde, **plus** SES PROPRES RATTACHEMENTS en `SELECT` SEUL | `utilisateur_client` *(D92)* — sans elle, aucun compte portail n'atteint aucun écran | `utilisateur_client` |
| **héritage** | la CIBLE polymorphe est visible **ET** la classe RÉTRÉCIT | `document` *(D93)* — la cible est le modèle OU la machine, jamais les deux | `document` |
| **ascendance** | société pour tout le monde, **plus**, pour un compte portail SEUL, l'existence d'un ENFANT visible | `modele_materiel`, `famille_materiel` *(D93)* — sans elle, la présence d'une notice révèle le parc des autres sites | `modele_materiel`, `famille_materiel` |
| **interne** | société **ET** `app.client_id` ABSENT | `document_recu` *(D94)* — une table qu'aucun compte portail ne lit, quel que soit son client | `document_recu` |

**La sixième n'est pas une variante de « parc » : elle en est l'INVERSE fonctionnel** *(L1-02b)*. La forme « parc » lit `app.perimetre_sites` ; les tables d'habilitation sont celles d'où cette variable est CALCULÉE. Leur donner la forme « parc » serait circulaire — une politique qui lit la variable que sa propre lecture alimente ne se referme jamais. Leur laisser la clause société seule était la fuite mesurée le 07/09/2026 : un compte portail du client A lisait les lignes d'habilitation des comptes du client B de la même société, en tirait leurs identités par jointure, et énumérait par là les autres clients. Le **discriminant** est `app.client_id`, posée pour un compte portail et pour lui seul — c'est lui qui laisse un `admin_societe` voir les habilitations de SA société, ce qu'une clause « sa propre ligne » sans discriminant lui aurait retiré.

**La septième porte sa BORNE avant son nom** *(L1-02c)*. `utilisateur` n'a pas de `societe_id` et ne doit pas en avoir — RG-SOC-03, une même personne travaille légitimement pour deux sociétés. Et surtout : **l'authentification PRÉCÈDE la société.** Chercher « existe-t-il un compte pour ce courriel » se fait à un moment où aucune société n'est connue et ne peut l'être ; sous une clause de société, la lecture rend zéro et personne ne se connecte (mesuré). La forme « désignation » n'autorise donc que la lecture de **la ligne que l'appelant nommait déjà** — elle ne rend jamais plus que ce qu'il savait avant d'interroger.

**Elle ne vaut QUE pour les opérations qui précèdent le contexte de locataire**, et le motif d'addition recevable est unique et étroit : *l'opération se produit avant qu'une société soit connue, et par construction ne peut pas l'être.* « C'est plus simple ainsi » et « on posera le contexte plus tard » ne sont pas des motifs — ce sont des descriptions du code. Liste close, gardée dans les deux sens : `TABLES_DESIGNATION`.

**Elle passe de UNE à CINQ entrées au ticket L1-02d, par arbitrage** *(D59)*. Les quatre tables techniques d'authentification satisfont le motif étroit **sans qu'on l'élargisse d'un pouce** : elles sont lues avant qu'une société soit connue, et par construction elle ne peut pas l'être — c'est l'authentification elle-même. Chaque clé de désignation est déduite du chemin d'accès réel, et c'est là que la borne se joue : `session` se désigne **par son jeton et par lui seul**, jamais par l'identifiant de son compte — un jeton est un secret, un identifiant ne l'est pas. **Et « secret » qualifie le TIRAGE, jamais la valeur tirée** *(incise du 10/09/2026)* : « imprévisible » est une propriété de ce qui PRODUIT une valeur — `randomBytes` pour un jeton, un compteur ordonné dans le temps pour un UUID v7 —, et une valeur déjà stockée n'est ni secrète ni prévisible, elle est fixe dès qu'elle existe. Ce qui se juge, c'est d'où elle vient. *La phrase sans l'incise a été lue de travers par quelqu'un qui l'avait sous les yeux, le 09/09 : une session a exigé d'un jeton QR stocké dans une fixture la propriété qui n'appartient qu'à son tirage — treize scénarios rouges en trois minutes. Un invariant qui se lit de deux façons n'est pas un invariant.*

**Ce qui la tient n'est pas la clé, c'est qu'aucun chemin ne laisse CHOISIR sa valeur** *(L1-02e)*. Un identifiant d'utilisateur est un UUID v7 : il n'est pas un secret, et une politique qui le croit sur parole ne borne plus rien. La forme ne vaut donc que parce que la valeur posée est celle que l'appelant **nommait déjà** — le courriel qu'il vient de saisir, le jeton qu'il présente, l'identifiant que sa session porte. **Deux moitiés, et une seule est gardable.**

*La moitié gardable est la POSE.* Les variables `app.authentification_*` ne se posent que depuis les fichiers qui **composent le contexte** — `lib/db/rls.ts`, qui les remet à vide, et `lib/auth/lecture-identite.ts`, qui les renseigne depuis le `where` de la requête. Jamais depuis un chemin de requête, jamais depuis une valeur venue de l'extérieur. Liste close, gardée par `tests/unit/auth/pose-de-designation.test.ts`.

**Et une écriture peut NOMMER une ligne sans la désigner** *(D64)*. La bibliothèque d'authentification lit une ligne par sa clé de désignation, puis **réécrit celle qu'elle vient d'obtenir en la nommant par son `id`** — mesuré : sur les huit flux réels, 69 opérations, dont 7 nomment un `id`, et **les 7 sont des écritures**. `id` n'étant clé de désignation d'aucune de ces tables, la politique lisait une chaîne vide et refusait **en silence**.

*Ce qui répare n'est pas une clé de plus, c'est un REPORT* — `lib/auth/echange.ts`. À l'intérieur d'une requête entrante, une écriture qui nomme une ligne par sa clé primaire reçoit ce que la même requête avait déjà désigné : **le `where` dit QUELLE ligne, la politique dit à QUI elle est.** Aucune politique n'a changé ; elles exigeaient déjà la seconde moitié. **L'`id` ouvre donc les écritures et JAMAIS les lectures**, et le report ne franchit pas deux requêtes. Un point d'entrée qui oublierait d'ouvrir un échange **casse la fonctionnalité, il n'ouvre jamais rien** : c'est le seul sens de défaillance acceptable ici, et c'est ce qui rend la liste des ouvertures gardable sans être une promesse.

*Ce qui n'est pas exprimable est écrit plutôt qu'habillé :* sur `second_facteur` la seconde moitié est bien **l'appartenance au compte**, la colonne existant ; sur `verification` elle ne l'est pas — la table n'a pas de colonne de compte et `valeur` porte un **compteur** sur la ligne des tentatives (mesuré). Ce qui y compose est l'**identifiant opaque déjà présenté**, qui est un secret là où un `id` n'en est pas un. Au moins aussi fort contre le rejeu, **et pas la même garantie**.

*La moitié non gardable est la PROVENANCE*, et elle s'écrit ici parce qu'aucun motif statique ne peut la décider : **la valeur d'une désignation est dérivée d'un contexte authentifié, jamais reçue d'un appelant.** Le jour où un chemin la recevra de l'extérieur, la borne deviendra nominale — et rien ne le dira. C'est à lire avant d'ajouter un chemin, pas après.

**Et chaque table ne se désigne QUE par sa propre clé** *(L1-02d)*. Une branche avait été ajoutée à `utilisateur_lecture` pour que le jeton de session désigne aussi son identité ; le **jumeau l'a démentie** — retirée, la chaîne complète reste verte —, et elle a été supprimée plutôt que gardée « au cas où ». *Une branche inutile dans une politique d'identité est un élargissement sans objet.*

**La huitième abat un MUR, et il avait été mesuré avant d'être contourné** *(D61, ticket L1-02f)*. La connexion n'établit que l'identité (D35) ; `basculerSociete` exige qu'on lui NOMME la société visée ; et `utilisateur_societe` portait la forme « société », si bien que la question « sur quelles sociétés suis-je habilité ? » rendait **zéro ligne** tant qu'une société n'était pas déjà active. **Aucun chemin ne permettait donc à un utilisateur réel d'atteindre sa propre société** — le premier écran est venu buter dessus.

La forme ajoute une politique de `SELECT` ancrée sur l'identité connectée : *un compte lit SES lignes d'habilitation, toutes sociétés confondues ; jamais celles d'autrui.* C'est la première fois qu'une ligne de la **première catégorie de I1** devient lisible hors de sa société, et **le coût est nommé** : la liste des sociétés d'une personne est lisible par cette personne. Elle ne rend ni leurs NOMS — `societe` reste de forme « identité » —, ni aucune de leurs données.

**Et ce qui la borne est la COMMANDE, pas la clause** : la même branche sur une écriture laisserait un compte s'attribuer le rôle de son choix sur la société de son choix. Elle est donc en `SELECT` et en `SELECT` seul, l'écriture restant entièrement gouvernée par la clause de société ; un gardien le vérifie commande par commande, et une épreuve le montre sur la faute telle qu'elle se commettrait — en « simplifiant » vers `FOR ALL`. Liste close gardée dans les deux sens : `TABLES_APPARTENANCE`, dont le **retrait** est le sens silencieux — il fait retomber la table sur la forme « société », qui passe tous les gardiens, et le mur revient.

**La neuvième achève ce que la huitième avait commencé, et son coût se nomme comme le sien** *(D67, ticket L2-11)*. D61 rend à un compte la LISTE de ses sociétés ; il lui manquait de quoi en **NOMMER** une. `societe` étant de forme « identité », la lecture rendait **zéro ligne sans société active — pas même en nommant l'identifiant qu'on possède déjà** (mesuré, avec témoin : 0, 0, et 2 lignes réellement en base). **Un sélecteur ne pouvait donc proposer que des UUID**, et le livrer aurait fermé le ticket sans lever l'impasse.

La forme ajoute une politique de `SELECT` ancrée sur l'identité connectée à travers la table d'habilitation. **Le coût, nommé** : *une personne apprend le NOM des sociétés dont elle connaît déjà la liste.* Ni leurs données, ni leurs habilitations, ni l'existence d'aucune autre société. Ce qui a été écarté est un libellé **recopié** dans `utilisateur_societe` : il aurait évité la politique et serait devenu faux au premier renommage, **sans rougir** — la divergence silencieuse du §9 (01/09), soignée cinq fois déjà.

**Et ce qui la borne est la COMMANDE, pas la clause**, exactement comme pour la huitième : la même branche sur une écriture laisserait un compte **renommer** une société ou s'en attacher une. Elle est donc en `SELECT` et en `SELECT` seul ; un gardien le vérifie commande par commande, et une épreuve le montre sur la faute telle qu'elle se commettrait — en « simplifiant » vers `FOR ALL`. Liste close gardée dans les deux sens : `TABLES_ADHESION`, dont le **retrait** est le sens silencieux — il fait retomber `societe` sur la forme « identité » seule, qui passe tous les gardiens, et le mur revient.

**Et une politique qui n'énonce qu'un `USING` LÉGIFÈRE EN SILENCE sur les écritures** *(L1-02c)*. PostgreSQL y fait valoir la même expression en `WITH CHECK` — une décision prise par personne, exactement comme l'`ON UPDATE CASCADE` par défaut de Prisma. Mesuré : sous une expression de lecture reprise en écriture, la **création de compte est refusée**, parce qu'au moment où l'identité est insérée son habilitation n'existe pas encore. **Toute politique couvrant une écriture énonce donc son `WITH CHECK`, même quand il répète le `USING`** — pour que ce soit une décision et non une conséquence. Gardé par `ecartsWithCheckExplicite`, sur la base jetable et sur la base hébergée.

**La dixième ferme la boucle que D10 avait laissée ouverte** *(D92, ticket L2-12)*. D10 veut que « les deux tables soient exclusives » : un compte portail n'a **aucune** ligne dans `utilisateur_societe`. Et `utilisateur_client` portait la forme « habilitation », ancrée sur `app.societe_id`. **Rien ne pouvait donc lui donner une société, et sans société il ne lisait pas son propre rattachement** — mesuré sous `codiplan_app`, avec témoin (zéro société sans contexte) : *identité seule → **0 ligne**, identité + société → 3, `utilisateur_societe` de ce compte → **0***. Les deux zéros ensemble ferment la boucle : **aucun compte portail n'atteignait aucun écran**, et rien ne le disait — il n'existait pas d'écran de portail pour buter dessus.

La forme ajoute une politique de `SELECT` ancrée sur l'identité connectée. **Le coût, nommé** : *une personne apprend la liste des clients auxquels elle est déjà rattachée.* Ni leur NOM — `client` reste de forme « parc » —, ni leurs données, ni l'existence d'aucun autre. **Et ce qui la borne est la COMMANDE, pas la clause** : la même branche en écriture laisserait un compte **se rattacher au client de son choix**, c'est-à-dire s'ouvrir le parc d'un tiers ; `FOR SELECT` n'accepte d'ailleurs aucun `WITH CHECK`, si bien que la borne est structurelle. Liste close gardée dans les deux sens : `TABLES_RATTACHEMENT`, dont le **retrait** est le sens silencieux. *Et la neuvième forme s'étend au même compte sans changer de règle : D67 dit « les sociétés où il est habilité », et un compte portail EST habilité — par `utilisateur_client`.*

**Les ONZIÈME et DOUZIÈME ferment une fuite qui ne passe pas par les données mais par la LISTE** *(D93, lot 8)*. D87 avait laissé la question écrite : *un document de MODÈLE n'a ni machine ni site, et son cloisonnement est celui de `modele_materiel`.* La réponse d'exploitation du 13/09/2026 : **un compte de portail ne voit les documents d'un modèle que si une machine de ce modèle se trouve dans SON PROPRE PÉRIMÈTRE** — jamais parce que sa société en possède un ailleurs. *Sinon un compte restreint à Ducos déduit ce que Koné possède, et le cloisonnement fuit par la liste des documents au lieu de fuir par les données — il fuit quand même. Un « 0 document » affiché là où il n'y a rien à afficher est déjà une fuite : il dit que la question a un sens.*

**Ce n'est donc pas la forme du document qui change, c'est LE CHEMIN D'ACCÈS AU MODÈLE.** « Héritage » dit qu'un document suit sa cible et que la classe ne fait que rétrécir ; « ascendance » est l'INVERSE de la filiation — la filiation propage vers le bas une visibilité acquise, l'ascendance refuse vers le haut une visibilité que la clause de société donnait. **Le discriminant est `app.client_id`** : un utilisateur interne garde la clause de société seule, sans quoi créer un modèle avant sa première machine serait impossible. Les deux étages — modèle et famille — sont fermés le MÊME jour, une famille « ponts élévateurs » visible disant qu'il y a un pont quelque part. **Le coût, nommé** : *la documentation d'un matériel non recensé est inaccessible au client tant que le recensement n'est pas fait.* Listes closes gardées dans les deux sens, `TABLES_HERITAGE` et `TABLES_ASCENDANCE`, dont le **retrait** est le sens silencieux — il fait retomber la table sur la forme « société », qui passe tous les gardiens.

**La TREIZIÈME n'était PAS demandée, et c'est ce qui la rend utile à relire** *(D94, L8-07)*. Le bac de réception nomme des FICHIERS : `notice-KPX-337.pdf` dit qu'un pont élévateur existe quelque part. Or **une table de forme « société » est lisible par un compte portail** — sa clause ne lit pas `app.client_id`. Lui donner cette forme aurait **rouvert par la porte de service la fuite qu'on fermait par la porte principale, dans le ticket même**. Mesuré avec son jumeau, et avec le témoin qui le rend lisible : le même compte, au même instant, lit bien ses propres documents.

**Et elle DÉCOUVRE une question qu'elle ne tranche pas.** `taux_horaire`, `forfait`, `agence` et les autres tables de forme « société » sont dans le même cas aujourd'hui ; aucun écran ne les donne à un compte portail, et c'est le seul motif pour lequel personne ne l'a vu. *Cette forme ferme la table qu'elle crée et écrit ce qu'elle laisse ouvert* — l'étendre en séance aux dix tables concernées aurait été un arbitrage bien plus large qu'un ticket de bac, pris sans mesure sur chacune. Condition de réouverture : **le jour où un écran ou une route de portail lit une table de forme « société »**, la question vise la CLASSE et non une table.

**Et AUCUNE des treize n'évalue l'heure** *(D85)*. Le cloisonnement répond à « qui a le droit de lire cette ligne », et **cette réponse ne doit pas changer d'elle-même** : sinon un audit lancé à 23:59 et à 00:01 se contredit **sans qu'aucune écriture n'ait eu lieu**, et le vert d'un test devient fonction de l'heure — un jumeau passerait parce que l'horloge a bougé, non parce que le verrou a cédé. **Quand un fait de cloisonnement dépend du temps, il est MATÉRIALISÉ** : une colonne porte l'état, un travail écrit la colonne, la politique lit la colonne. **L'horloge ne touche que le travail.** Une politique lit sans peine une colonne de type date — `date_planifiee` est une donnée que quelqu'un a écrite, `now()` une valeur que personne n'a écrite : *c'est la provenance qui décide, jamais le type*. Le motif n'était écrit nulle part comme principe avant D85 : il vivait quatre fois comme argument d'une décision particulière — la forme exacte qu'a une règle avant d'en être une. Mesuré : 60 politiques écrites aux migrations, zéro évaluant le temps ; gardé par `tests/unit/db/horloge-hors-cloisonnement.test.ts`. Le code applicatif, lui, garde le droit de lire l'heure — la restriction des 7 jours de RG-DRO-02 y reste (D84).

**Celle qui NE s'applique JAMAIS à une table métier ordinaire est « référentiel »**, et ses deux moitiés sont fausses pour deux raisons distinctes. Sa lecture est `USING (true)` : toutes les sociétés lisent toutes les lignes — c'est la décision D4 sur `devise` (« le franc Pacifique est le même partout »), c'est la fin du cloisonnement sur `client`. Son écriture est `app_est_role_editeur()` : elle donne le droit au salarié de l'éditeur et le retire à la société propriétaire — l'objet même de la règle sur un référentiel, l'inverse exact de ce que le §22.5 promet au client sur une table métier.

**La branche `OR societe_id IS NULL` de la forme imposée est un vestige, pas une licence.** Sur une colonne `societe_id NOT NULL` — donc sur toute table de la première catégorie — elle est **inerte** : aucune ligne ne peut la satisfaire. Les six tables du lot 0 la portent encore parce que L0-04 l'a écrite ; le gardien ne l'interdit pas, il **mesure son inertie**. Une table nouvelle s'écrit sans elle.

**Et la forme est MESURÉE, pas déclarée** : `scripts/lib/politiques-rls.ts` lit `pg_policies`, qui rend l'expression *analysée*. Les formes 1, 2, 3 et 6 du §9 s'y dissolvent — graphie, enveloppe `DO $$ … $$`, pose en deux temps, nom assemblé à l'exécution : c'est l'état final qui est lu, jamais le texte qui l'installe. Le contrôle tourne sur la base jetable (`test:isolation`) **et** sur la base hébergée (`controle-cloisonnement`).

**Le CONTRAT des fixtures d'isolation est structurel** *(R0-a, écart É14)*. `client`, `site` et `machine` existent aujourd'hui comme tables **fixtures** du harnais et portent la forme « parc ». Le jour où les vraies tables arrivent, la réparation la plus naturelle — supprimer la fixture et donner à la vraie table la clause société seule — **réduisait la couverture sans qu'aucun gardien ne s'en aperçoive**. Trois gardiens indépendants la refusent désormais : la **forme** mesurée dans `pg_policies` (fixture ou table réelle, sans faire la différence) ; la **liste close `TABLES_PARC`**, dont le RETRAIT d'une entrée est refusé — c'est le retrait qui ouvre la brèche, pas l'addition ; et le **plancher de scénarios** par exigence de L0-05 (`EXIGENCES_L0_05`), qui ne se baisse jamais. Les scénarios D10 et D22 doivent rester **plus nombreux** après la reprise, jamais moins.

**Un message d'erreur est un canal d'information : il est soumis au cloisonnement comme une requête** *(D50)*. Ce qu'un refus donne à lire est une réponse, et se compte comme telle. L'exemple qui a fait la règle : un déclencheur explicatif sur `jour_ferie`, qui dirait « 3 écarts référencent ce férié », **apprendrait à un salarié de l'éditeur combien d'agences clientes chôment ce jour-là** — depuis un simple refus, sans avoir jamais lu une table. Un refus a donc le droit d'être **lisible**, jamais d'être **informatif** : il dit ce qui bloque et la marche à suivre, il ne compte pas et ne nomme pas ce que son destinataire n'a pas le droit de lire. Et le raccourci qui le rendrait bavard — une fonction `SECURITY DEFINER` posée pour voir par-dessus les politiques — est refusé par un gardien statique dont la liste d'exceptions est close et vide.

**Et une politique juste dont personne ne pose la variable ne garde RIEN** *(L1-02b)*. Les formes ci-dessus lisent six variables `app.*` ; `lib/db/rls.ts` n'en posait que quatre, et le harnais d'isolation posait les deux autres. Les scénarios étaient donc verts parce que le HARNAIS armait une garantie que la PRODUCTION n'armait pas — deux implémentations d'un même contrat, chacune verte, divergeant en silence (§9, 01/09), et dans le sens permissif : sans `app.client_id`, la forme « parc » se lit « utilisateur interne » et OUVRE. Deux gardiens ferment les deux sens, contre `pg_policies` et contre le répertoire du harnais : `scripts/lib/contexte-rls.ts`, `tests/isolation/contexte-arme.test.ts`, `tests/unit/db/contexte-harnais.test.ts`. **Toute variable réclamée par une politique est posée par le chemin de production, et le harnais n'en arme aucune de plus.**

**Et POSÉE ne suffit pas : elle doit être RENSEIGNABLE** *(D70)*. `app.client_id` figurait dans la liste des poses — le gardien de L1-02b était vert, et il avait raison — mais **rien ne pouvait lui donner de valeur** : un compte portail lisait donc le parc entier de sa société (mesuré : 2 machines d'un client dont il n'était pas habilité, contre 0 une fois la variable posée). La réparation n'est ni « l'appelant fournit » ni « la base dérive » — **c'est un faux couple**, et la mesure le dit : la dérivation n'est pas unique (`utilisateur_client` porte `UNIQUE (utilisateur_id, client_id)`, un compte tient plusieurs clients d'une même société), et une valeur venue de l'extérieur ne vaut rien sans validation (L1-02e). **L'appelant DÉSIGNE, la base DISPOSE** : `ContexteSession.clientId` dit pour quel client le compte agit, et `app_poser_perimetre_client` — `SECURITY INVOKER`, donc lue sous les politiques de l'appelant — **lève** si ce client n'est pas parmi ses habilitations. Elle ne retombe jamais sur la chaîne vide, qui rouvrirait la branche « utilisateur interne ». L'**ordre** est une décision : la variable est posée AVANT d'être validée, parce que valider d'abord ferait lire sous la branche « absent » de la forme « habilitation », c'est-à-dire sous le régime de l'utilisateur interne. Et l'appariement est fermé **des deux côtés** — portail sans client refusé, rôle interne avec client refusé.

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

**Ce que ce retrait coûte est payé au même endroit, et ÉPROUVÉ.** Le journal n'est pas audité, il est **inaltérable** : `UPDATE` et `DELETE` retirés au rôle applicatif, doublés par l'absence de politique pour ces verbes sous `FORCE ROW LEVEL SECURITY`. C'est plus fort qu'une trace, et cela se prouve par **TENTATIVE** — sur la table mère, et sur **chaque partition** énumérée par `pg_inherits`, jamais sur la mère seule : une partition est une table, elle n'hérite ni des privilèges ni des politiques du parent.

**La FONCTION empêche l'oubli, le DÉTECTIF rattrape la main.** Deux garanties de nature différente, nommées séparément parce que la première ne couvre pas la seconde : `journal_audit_partition_creer` durcit dans la même transaction, donc aucun ticket ne peut créer une partition nue par le chemin du dépôt ; mais un `CREATE TABLE … PARTITION OF` tapé dans une console ne passe par aucune fonction. **Tant que le rôle de migration n'est pas superutilisateur, `ddl_command_end` est hors de portée et l'état nu reste productible à la main** — le jour où la base est auto-hébergée ou l'hébergeur ouvre les déclencheurs d'événement, le préventif remplace le détectif et cette phrase se retire. En attendant, le détectif tourne **chaque nuit sur la base réelle** (`pnpm veille`), et non plus seulement quand quelqu'un migre.

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

pnpm veille           # LA BASE HÉBERGÉE a-t-elle dérivé ? (D55)
                      # les contrôles d'observation — ONZE aujourd'hui : RLS,
                      # formes de politique, périmètre d'audit, ajout seul du
                      # journal, durcissement des partitions, privilèges de
                      # consolidation, branche IS NULL de périmètre, WITH CHECK
                      # explicite, ARMEMENT DU CONTEXTE (L1-02b), et depuis D91
                      # le TÉMOIN DE LECTURE puis la LECTURE SANS CONTEXTE ;
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

**`(prévu)` marque ce qui n'existe pas encore.** L'arborescence dit deux choses de nature différente — ce qui EST et ce qui est PLANIFIÉ —, et sans cette marque le plan se fait passer pour un état. Elle rend les deux sens gardables : tout module non marqué doit exister, tout module qui existe doit être énuméré. Le jour où le module est écrit, la marque se retire avec le reste (`tests/unit/docs/organisation-du-code.test.ts`).

```
app/
  (sans-session)/ (back-office)/  (mobile)/  (portail)/  (editeur)/  api/
              le premier groupe porte les écrans qui PRÉCÈDENT la session — il
              est la règle de R2-16 elle-même : ce qui décide qu'un écran n'a
              pas de barre est le répertoire où il vit, jamais une liste
lib/
  db/         client Prisma, contexte société, helpers RLS
              sante.ts : l'état de l'installation, pour la page SANS COMPTE
              /sante — il NE LÈVE JAMAIS : une sonde qui tombe en même temps
              que ce qu'elle surveille ne surveille rien
              et il ne rend aucun secret — ni hôte, ni base, ni identifiant :
              le message brut d'un pilote nomme l'hébergeur et la région (D50)
              `app.client_id` est DÉSIGNÉE par l'appelant et VALIDÉE par la
              base dans la même transaction (D70) — jamais dérivée, la
              dérivation n'étant pas unique ; jamais crue, une désignation
              non validée ne bornant rien
              une désignation refusée LÈVE : un contexte vide rouvrirait la
              branche « utilisateur interne » de la forme « parc »
  auth/       authentification, et la DÉSIGNATION des cinq tables qui la portent
              (L1-02d) — `session`, `compte`, `verification`, `second_facteur`,
              `utilisateur` : chacune ne se lit qu'en NOMMANT sa ligne
              la surface HTTP est une liste close de chemins FERMÉS, jamais
              une liste de chemins ouverts (D58)
              amorcage.ts : l'ouverture du PREMIER compte (D65), et la
              RÉÉMISSION de son jeton (10/09) — son cliquet est un FAIT de
              `compte`, `mot_de_passe IS NULL`, que l'amorçage laisse et que
              le premier mot de passe choisi referme pour toujours
              premier-acces.ts : l'écran où l'on CHOISIT ce mot de passe —
              l'amorçage y redirigeait depuis le 09/09 et il RENDAIT 404
              (mesuré le 11/09) ; c'est la seule porte d'une base neuve, le
              seed n'attribuant aucun mot de passe
              les deux contrôles de SAISIE viennent avant le jeton : une
              discordance qui brûlerait le jeton coûterait un aller-retour
              humain, un lien de premier accès se transmettant hors bande
              un jeton inconnu et un jeton mort rendent LE MÊME refus (D35)
              enrolement.ts : la SEULE transition en libre-service (D58) —
              elle POSE, elle ne retire jamais ; les deux drapeaux y sont
              écrits par nous, la bibliothèque les désignant par un `id` que
              la politique ne reconnaît pas (L1-02f)
              arrivee.ts : ce qu'un écran a le droit de dire — qui vous êtes,
              pour quelle société, et rien d'autre
              societe-active.ts : `societesDuCompte` LIT ce que D61 et D67 ont
              ouvert, et l'ÉCRAN qui l'appelle est né le 10/09 — les deux
              politiques existaient depuis deux jours sans appelant, et un
              compte habilité sur deux sociétés n'atteignait aucun écran
              echange.ts : le REPORT d'une désignation à l'intérieur d'UNE
              requête (D64) — l'`id` par lequel la bibliothèque réécrit une
              ligne dit QUELLE ligne, la politique dit à QUI elle est ;
              l'`id` ouvre les écritures, JAMAIS les lectures
  clients/    référentiel client (L1-01) — saisie Zod, dépôt cloisonné,
              libellé du code externe paramétrable par société (D29)
              la politique de `client` est de forme « parc », jamais société seule
  habilitations/ qualifications des techniciens (L1-04) — saisie Zod, et
              RG-PLA-04 : l'affectation est BLOQUÉE, jamais signalée
              rien n'est clos ici, à l'inverse des zones et des rôles de
              contact : une société suit des qualifications qu'aucune
              nomenclature ne connaît (D60). La liste réglementaire française
              est un AMORÇAGE du seed, pas une énumération
              la règle vit ici et non en base : elle dépend d'une date
              d'intervention que la base ne connaît pas encore
  contacts/   interlocuteurs d'un client (L1-03) — saisie Zod
              un contact appartient au CLIENT, le site est FACULTATIF : sans
              site, c'est un contact du client, et il ne disparaît PAS pour un
              compte portail restreint (le comptable survit à la restriction
              d'un atelier)
              les rôles et les canaux sont clos ICI et pas en base : une société
              tierce aura d'autres rôles, une énumération en base ferait de leur
              ajout une migration — le raisonnement des zones, en sens inverse
              `signataire` est un rôle de l'ensemble, jamais une colonne à part
              (RG-INT-04) ; aucun envoi n'est écrit ici, L1-03 pose la DONNÉE
  sites/      référentiel des sites d'intervention (L1-02) — saisie Zod, dépôt
              cloisonné, zones géographiques de D23
              la politique de `site` est de forme « parc » AVEC le filtre de
              périmètre : c'est la table où les trois filtres mordent ensemble,
              et le troisième est le seul qui sépare deux sites d'un même client
              l'énumération des zones est close ICI, à l'entrée serveur, et
              délibérément pas en base — six valeurs d'UN territoire
  machines/   la fiche machine (L2-01) — saisie Zod, et les QUATRE champs
              obligatoires de D6 : modèle, client, site, numéro de série
              le numéro illisible se saisit `SN-INCONNU-<référence>` avec
              `complet = false` — JAMAIS `NULL` : deux `NULL` sont distincts
              pour un index unique, et une colonne nullable ferait de
              l'unicité une passoire sur les fiches les moins renseignées
              `complet` est DÉDUIT du numéro, jamais accepté depuis l'entrée
              ne fabrique NI `id`, NI `qr_token`, NI `numero` : les deux
              premiers naissent sur l'appareil (D7, I10), le troisième est
              attribué par le serveur — et personne ne l'attribue encore, le
              compteur par société venant avec la synchronisation
              qr.ts : le jeton est un SECRET, TIRÉ AU SORT (L2-02, D71) —
              130 bits, tous aléatoires ; `randomBytes`, jamais Math.random
              il ne DÉPEND DE RIEN qu'un tiers puisse connaître : ni l'`id`, ni
              le numéro de série, ni le client ne permettent de le prévoir
              hors ligne quand même (I4) : un tirage local n'exige aucun réseau
              — et n'exige pas non plus que l'`id` existe déjà, ce que les
              planches pré-générées de D7 réclamaient
              D7 se contredisait — « dérivé de l'UUID » et « jetons
              pré-générés avant le départ » ne peuvent pas être vrais
              ensemble ; D71 garde la moitié dont le recensement a besoin
              aucun test de DÉTERMINISME : leur disparition EST le ticket,
              un secret déterministe n'en est pas un
              depot.ts : LA LECTURE DU PARC (R2-21) — sous contexte cloisonné,
              forme « parc », et AUCUNE comparaison de société au-dessus : c'est
              ce qui fait que le même appel sert l'écran interne et le portail
              le résumé se compte SUR LES LIGNES RENDUES, jamais par une seconde
              requête — un bandeau qui compterait autrement que le tableau qu'il
              coiffe met les deux chiffres côte à côte sans dire lequel croire
              ni COMPTEUR ni CONTRAT : la maquette les montre, rien ne les
              porte, et une colonne vide dirait que la donnée manque là où un
              zéro dirait qu'elle vaut zéro (le motif de blocage de R2-13)
              resolution.ts : le contrôle de société de D22 n'est PAS écrit
              ici — on lit SOUS le contexte, et la politique décide ; une
              comparaison écrite au-dessus serait une seconde lecture du même
              critère, qui diverge en silence
              un jeton inconnu et le jeton d'une autre société rendent LA MÊME
              chose : les distinguer ferait un oracle (D35, D50)
              aucune vérification de FORME à la lecture — le jeton lu est une
              donnée STOCKÉE, et contrôler sa forme lierait les scans du jour à
              la génération du jour ; seule une borne de TAILLE demeure
  interventions/ l'ORDRE D'INTERVENTION et le planning agissant (lot 2, D84)
              pose.ts : les CONTRÔLES À LA POSE (R2-19) — il décide, il n'écrit
              rien et ne lit aucune base
              le calendrier qui décide est celui de L'AGENCE VISÉE, et d'elle
              seule : l'union affichée en vue semaine est un repère, jamais un
              droit de poser
              une agence SANS calendrier refuse — « inconnu » n'est pas
              « ouvert », et poser sans horaire connu promettrait un rendez-vous
              que personne ne peut tenir (I7)
              un chevauchement est une ERREUR, pas un avertissement : deux
              créneaux qui se TOUCHENT ne se chevauchent pas, une intervention
              annulée n'occupe plus rien, une clôturée si — elle a eu lieu
              saisie.ts : Zod sur toute entrée ; l'agence, le forfait de
              déplacement, le numéro et le statut NE SE SAISISSENT PAS — les
              deux premiers se déduisent du site, le troisième appartient à la
              synchronisation (I10), le quatrième au créneau
              cycle-de-vie.ts : ce qui est permis et ce qui est REFUSÉ, avec la
              raison écrite. Il ne GARDE rien — la base garde, par
              `intervention_cycle_de_vie` : une action refusée à l'écran mais
              acceptée par la base est un trou
              annulee > cloturee, jamais l'inverse : I5 donne à l'annulation la
              préséance, et une intervention clôturée par erreur doit pouvoir
              être annulée
              depot.ts : les cinq actions sous contexte cloisonné, forme
              « parc » (D84) — aucune comparaison de société écrite au-dessus
              de la politique, ce serait une seconde lecture du même critère
              l'instant courant se lit dans le FUSEAU DE L'AGENCE (L0-08), qui
              est celle qui décide du calendrier de référence (I7)
              le JOURNAL des déplacements n'est pas une table de plus : c'est
              `journal_audit`, par déclencheur, avec les valeurs avant et après
              statistiques.ts : la CHARGE par technicien — nombre, heures
              engagées, heures ouvrables, barre segmentée
              le type ne porte AUCUN pourcentage : `tauxOccupation` exige
              l'objet entier, si bien qu'un taux ne peut pas voyager sans ses
              deux termes (D56) — et l'écran affiche la FORMULE à côté
              un dénominateur nul rend `null`, jamais 0 % : « pas de
              calendrier » et « n'a rien fait » ne se corrigent pas pareil
              occupation.ts : le dénominateur vient du calendrier de l'AGENCE
              (I7) — d'où la maille (technicien, agence), une agence choisie
              en silence basculant d'une semaine à l'autre
  materiel/   familles et modèles de matériel (L1-05) — saisie Zod, et AUCUNE
              énumération : ni familles, ni marques, ni références. D4 est
              amendé — le mécanisme « référentiel de plateforme + copie
              masquante » est RETIRÉ, il se contredisait. Chez CODIMA les
              modèles viennent du fichier de suivi, pas d'un catalogue
              d'éditeur : ce sont des données saisies
              c'est le raisonnement des zones PRIS À L'ENVERS — les zones sont
              closes parce qu'elles ne bougeront pas, les familles bougeront à
              chaque société
  tarification/ taux horaire HISTORISÉ par date d'effet (L1-07, RG-TAR-04)
              une intervention se facture au taux en vigueur à SA date : une
              facture qui change quand le tarif change est une facture fausse
              AUCUNE fonction « le taux courant » — elle serait juste
              aujourd'hui et fausse demain, et le premier appelant pressé la
              prendrait pour une intervention du mois dernier
              rend un Montant, jamais un nombre : entier, et avec sa devise
              ne combine RIEN — la composition d'un forfait et d'un taux n'est
              pas tranchée, elle est au registre
              valorisation.ts : RG-TAR-05 amendée par D83 et D89 — arrondi au
              quart d'heure SUPÉRIEUR, puis plancher d'UNE HEURE, appliqués UNE
              SEULE FOIS sur l'intervention entière et jamais tâche par tâche
              le plancher est PAR INTERVENTION, SANS EXCEPTION (D89) : deux
              interventions le même jour sur le même site font DEUX heures, y
              compris si la seconde achève la première — la variante « sauf
              reprise rattachée » est écrite au registre, pas construite
              aucune fonction « valoriser une intervention » : le mode est
              décidé par l'appelant, la composition forfait + excédent n'étant
              pas tranchée — et le plancher ne vise NI le forfait, NI le
              trajet, NI le travail interne, aucun n'étant facturé à l'heure
              taux-initial.ts : le PREMIER taux d'une société, geste
              d'exploitation SÉPARÉ de l'amorçage (09/09) — refuse dès qu'un
              taux existe ; ni montant ni date codés ici, tous deux fournis
              forfaits.ts : RG-TAR-06, les trois axes d'un forfait (L1-06)
              l'ABSENCE de condition sur un axe n'est pas une condition qui
              échoue — un forfait sans zone s'applique partout, et c'est le cas
              majoritaire ; une valeur d'intervention absente face à une
              condition posée n'est PAS remplie
              le troisième axe est INERTE — les types d'intervention n'existent
              nulle part, le lot 2 les décidera ; la règle est écrite entière
              pour n'avoir pas à changer ce jour-là
              la liste des zones se LIT dans sites/zones.ts, jamais ne s'y
              recopie ; le catalogue naît VIDE, les valeurs sont à l'exploitation
              le RANG décide quand plusieurs conviennent (D86) : explicite,
              stocké, modifiable, le plus petit l'emporte — jamais l'ordre
              d'insertion, jamais l'alphabet d'un code
              l'égalité de rang est un état INTERDIT, refusé par la base sur
              (societe_id, type, rang) : le rang ne se compare qu'entre pairs
              « aucune condition » a DEUX écritures — `null` à la saisie, le
              tableau VIDE en base — et les deux se lisent ICI
  navigation/ LA BARRE À ONZE ENTRÉES de la maquette (D95)
              chrome.ts : ce qu'une mise en page a besoin de savoir pour
              peindre, LU UNE SEULE FOIS par rendu (R2-16) — la racine veut la
              société pour la charte, le segment veut le nom pour la pastille,
              et une mise en page ne transmet rien à celles qu'elle englobe
              elle ne lève jamais et n'accorde rien : une pastille absente
              n'est pas un refus, une barre affichée n'est pas une permission
              la barre est rendue par le SEGMENT et jamais par la racine — trois
              groupes de routes, `(sans-session)` sans barre, `(back-office)` et
              `(portail)` avec ; une liste de chemins tenue à la main oublierait
              le prochain écran d'authentification, un répertoire ne s'oublie pas
              la liste est CLOSE et confrontée à `docs/maquette/CODIPLAN_Maquette.html` :
              libellés et ordre compris — deux barres qui divergent, c'est la
              maquette qui a raison
              une entrée dont l'écran n'existe pas est INERTE, jamais absente
              et jamais un lien : un 404 dans une barre se lit comme une panne,
              une entrée manquante ment sur ce que le produit sera
              ce n'est JAMAIS un contrôle d'accès — masquer une entrée serait
              une seconde lecture d'un critère que la politique porte déjà, et
              c'est celle qui vieillit sans rougir
  money/      formatage et arithmétique — point de passage unique
              jamais de conversion : elle vit dans reporting/ (D19 amendé par D44)
  compteurs/  LES RELEVÉS, RÉORDONNÉS PAR LE TERRAIN (L2-03, question 3.12)
              regression.ts : l'ordre d'arrivée n'est PAS l'ordre des faits —
              un relevé fait à 8 h sans réseau arrive après un relevé de 10 h,
              et contrôler à l'arrivée signalerait une régression là où il n'y
              en a aucune, sans voir celle qui est là
              un relevé qui régresse est CONSERVÉ et SIGNALÉ, jamais refusé :
              I5 — le travail terrain n'est jamais perdu — et un compteur
              REMPLACÉ repart de zéro ; refuser rendrait impossible de saisir
              le premier relevé d'un compteur neuf, c'est-à-dire de dire vrai
              chaque couple (machine, type) est une SUITE À PART : les mélanger
              ferait de chaque nouvelle machine une régression
              le verdict est rendu pour TOUS les relevés, anomalie ou non —
              sinon « aucune anomalie » et « rien n'a été contrôlé » se lisent
              pareil
              à horodatage ÉGAL, l'ordre est celui de l'UUID v7 (I10), donc du
              temps de saisie : un tri instable rendrait le verdict dépendant
              de l'ordre d'arrivée, ce que 3.12 refuse
              aucune base ici : l'appelant seul sait sous quel contexte
              cloisonné il a lu ses relevés
  calendar/   calendriers d'agence, fériés, jours ouvrés — répond à « quand »
              fuseaux IANA, instants UTC, récurrences déroulées à la lecture
              territoire ISO et fuseau : deux attributs de l'agence, jamais
              l'un déduit de l'autre (D46)
              seul endroit où la date courante se lit — et avec un fuseau (L0-08)
              parametrage.ts : horaires, jours travaillés, PAS DE CRÉNEAU —
              réglés par agence et jamais écrits dans un composant (I7)
              l'exception par technicien est un RATTACHEMENT à un autre
              calendrier, jamais une copie de plages : recopier ferait deux
              lectures d'un même critère
              et elle ne MAJORE rien — elle dit quand on travaille, pas à quel
              prix ; la majoration relève de RG-TAR et de l'agence du technicien
              une grille de créneaux ne DÉBORDE jamais sa plage : un dernier
              créneau à cheval sur la fermeture proposerait un rendez-vous que
              l'agence ne peut pas tenir
              jamais de règle de facturation : l'arrondi au quart d'heure
              appartient à la valorisation (D45)
  sync/       (prévu) protocole hors-ligne
  documents/  LA DOCUMENTATION DES MACHINES (lot 8, D87, D93, D94)
              la CIBLE est une SOMME, pas deux champs facultatifs : le modèle
              OU la machine, et le type refuse à la COMPILATION ce que la base
              refuse par `num_nonnulls(...) = 1` — deux verrous qui ne se
              recouvrent pas, aucun ne remplaçant l'autre
              propositions.ts : il PROPOSE, il ne classe JAMAIS seul — un
              rapprochement faux accroche la notice d'un compresseur à un pont
              élévateur, et personne ne le voit avant qu'un technicien suive la
              mauvaise procédure ; c'est de la sécurité, pas de la qualité de
              données
              le rapprochement se fait sur la CLÉ, jamais sur une ressemblance :
              aucune distance d'édition, aucun score, aucun « probablement »
              la tolérance porte sur la GRAPHIE d'une clé, jamais sur la clé
              AUCUNE proposition est une ISSUE, pas un rejet — le fichier reste
              à traiter, et l'œil lui donne sa cible
              les MODÈLES d'abord, et c'est une règle de PRÉSENTATION : le bac
              ne peut pas savoir ce qu'un fichier vise avant qu'on le lui dise
              depot.ts : la DÉDUPLICATION est lue dans un refus `P2002`, jamais
              prévenue par une lecture — entre un SELECT et un INSERT, un
              second dépôt du même fichier passe, et le bac est l'endroit même
              où l'on redépose
              la REPRISE n'a aucune table de session : l'état de la reprise est
              l'état du bac, et il n'y a pas de travail partiel à sauvegarder
              RIEN pour le stockage : `objet_cle` est fournie, jamais fabriquée
              — le module n'existe pas faute d'appelant, et une interface sans
              appelant est la maladie que le portail vient de soigner
  excel/      la GRAMMAIRE des fichiers d'import (L1-08, D31) — et elle seule
              format.ts : marqueur de version, dates, nombres, colonnes
              classeur.ts : LA LIAISON (L1-08c) — elle ne porte AUCUNE règle,
              c'est tout son objet ; L1-08a l'avait promis en écrivant la
              grammaire sur une grille abstraite
              elle rend une SÉRIE et non un `Date` : un `Date` est déjà une date
              valide, il a perdu ce qui permettait de la REFUSER — les trois
              refus de D31 deviendraient inexprimables
              le ZÉRO ne s'écarte pas là : la liaison le transpose, la grammaire
              le range en absence — écarter dans le transport mettrait une règle
              métier là où personne ne la relit
              controle.ts : le RAPPORT de I6, la moitié « d'abord » — il n'écrit
              rien, ne connaît aucune base, et ne sait pas appliquer
              mais il RETIENT ce qu'il décide (L1-08d) : une ligne par ligne
              lue, son action et ses valeurs — l'application ne peut appliquer
              que ce que le rapport a MONTRÉ, et un rapport qui ne retient rien
              ne fait rien appliquer
              les décomptes sont DÉRIVÉS des lignes, jamais comptés à côté :
              décider deux fois la même chose est la divergence du §9 (01/09)
              un gabarit et une ligne vide ne portent AUCUNE clé — leur en
              inventer une les ferait entrer dans l'espace des clés réelles, où
              deux lignes muettes deviendraient la même machine
              les trois refus PRÉCÈDENT toute ligne et ne comptent RIEN : un
              rapport qui proposerait des créations sous une colonne obligatoire
              absente proposerait d'écrire des fiches amputées
              le parc est un PARAMÈTRE, jamais une lecture : l'appelant seul sait
              sous quel contexte cloisonné il l'a obtenu
              le ZÉRO est une ABSENCE, jamais le 30 décembre 1899 : la
              bibliothèque rend cette date-là, et c'est ici qu'on l'écarte —
              171 cellules du fichier réel en dépendent, et les ranger sous
              « hors plage » ferait rejeter 171 machines
              un nombre lu ne rend JAMAIS un flottant : les chiffres et leur
              échelle, pour que I3 ne soit pas enfreint une ligne après nous
              une date se lit en UTC, jamais par un Date local — UTC+11 décale
              le jour d'un cran, et un import du 1er se rangerait au 31
              rend des CODES, jamais du texte : les libellés sont au
              dictionnaire, la coupure de L0-11 s'appliquant au rapport lu par
              un humain (I6, RG-IMP-01)
              rapprochement.ts : ce qu'une ligne DÉSIGNE, et ce qu'elle ne
              désigne pas — écrit contre les MESURES du fichier réel, jamais
              contre une idée de ce qu'un fichier contient d'habitude
              la clé tolère l'absence de série SANS fabriquer de doublon : les
              trois espaces de clés — série nue, référence préfixée `SN-INCONNU-`,
              rang préfixé `LIGNE-` — sont DISJOINTS, et c'est prouvé plutôt
              qu'espéré ; deux lignes muettes ne sont pas la même machine
              72 % de l'historique ne se rattache À RIEN et se reprend QUAND
              MÊME : « non rattachée » est une ISSUE, jamais un rejet — les
              écarter perdrait les trois quarts de l'historique
              le rapprochement se fait sur la CLÉ, jamais sur une ressemblance :
              un rattachement faux attribue une facture à la mauvaise machine,
              et plus personne ne saura qu'il était automatique
              une ligne de GABARIT n'est ni une donnée ni un vide — 652 lignes
              pour 55 codes réels, et les rejeter ferait 597 erreurs sur un
              fichier sain, c'est-à-dire la panne par le bruit
              le total du rapport EXPLIQUE chaque ligne lue : « non rattachée »
              et « incomplète » QUALIFIENT des lignes déjà comptées, elles ne
              s'additionnent pas — sinon le témoin dirait faux dans le sens
              rassurant
  imports/    LE MOTEUR D'IMPORT — ce que `excel/` a décidé, posé en base (L1-08e)
              depot.ts : le LOT NAÎT AU CONTRÔLE, et le chapitre 11 le disait
              depuis l'origine — `import_lot.statut` vaut `controle`, `applique`
              ou `annule` ; I6 veut qu'un rapport précède la validation, et
              l'application ne peut appliquer que ce que le rapport a MONTRÉ
              il ÉCRIT, il ne décide RIEN : toute la décision a été prise par
              `excel/controle.ts`, qui ne connaît aucune base — recalculer ici
              serait une seconde lecture d'un même critère, et dans le pire
              endroit : entre ce qu'un humain a validé et ce qui sera écrit
              les décomptes viennent de `proposerDepuisLesLignes` et de lui
              seul ; ce module en a d'abord tenu un second, retiré plutôt que
              gardé par un test d'égalité
              aucune comparaison de société n'est écrite ici : la forme est
              « interne » (D100), et c'est la base qui prononce
              `valeurs_avant` est écrite par l'APPLICATION seule — avant elle,
              il n'y a rien à restaurer (D15)
              RIEN pour le stockage du fichier source : `objet_cle` existe et
              reste nulle, faute d'appelant — la maladie du portail, évitée
              modeles.ts : LES GABARITS QUE CODIPLAN PUBLIE (L1-09a), et eux
              seuls — deux sortes de fichiers ne se confondent pas : un gabarit
              tient ses colonnes de NOS schémas de saisie, un fichier de reprise
              les tient du fichier réel du client, qui n'est pas dans le dépôt
              chaque champ de saisie est EXPOSÉ ou ÉCARTÉ NOMMÉMENT, avec son
              motif : un champ écarté sans motif est un champ oublié, et rien
              ne les distingue
              `adresse_facturation` n'y est pas — le chapitre 11 ne lui fixe
              aucune forme, et l'aplatir dans un gabarit la figerait pour tous
              `actif` non plus : un import ne désactive pas, et une colonne
              « Actif » ferait d'un oubli de saisie une désactivation de masse
              le marqueur est DÉRIVÉ du modèle, jamais recopié
              un gabarit qui DÉSIGNE UN PARENT est une FONCTION du parc, jamais
              une constante (L1-09b) : savoir si « Garage Dupont » existe
              demande de regarder le parc, et passer celui-ci à chaque appel
              aurait changé le contrat pour les modèles qui ne désignent rien
              la MÊME clé que le gabarit du parent, jamais une seconde : une
              seconde règle de rapprochement se verrait au pire moment — des
              contacts accrochés au mauvais client
              « saisie refusée » et « parent introuvable » sont DEUX motifs :
              l'une se corrige dans le FICHIER, l'autre dans le PARC
              parc-agences.ts : une agence se rapproche par son CODE et JAMAIS
              par son libellé (D101) — `@@unique([societe_id, code])` fait du
              code une clé, le libellé n'en est pas une
              ce qui rend une clé utilisable n'est pas sa FORME, c'est ce que
              la BASE garantit d'elle : de là l'asymétrie entre l'agence (code
              seul), le client (code puis nom) et le site (client + libellé)
              un site rattaché à la mauvaise agence fausse le temps de trajet
              (D56), le calendrier de référence (I7) et la majoration
              parc-familles.ts : le MÊME motif que les agences, et il n'est PAS
              fusionné avec lui — ils partagent une forme, pas un critère : une
              fonction générique « indexer par code » ferait croire qu'un jour
              les deux changeront ensemble
              une cellule ILLISIBLE ne rend JAMAIS `undefined` : les schémas
              portent `.default(null)`, si bien qu'`undefined` déclenche le
              DÉFAUT — une faute de frappe deviendrait une absence en silence
              un gabarit ne REDIT aucune règle du schéma : « zéro n'est pas une
              périodicité » est écrit dans `materiel/saisie.ts`, et le modèle
              laisse le schéma juger
              parc-clients.ts : L'AMBIGUÏTÉ EST UN FAIT DU PARC (L1-08g) — deux
              fiches qui rendent la MÊME clé rendent indécidable ce qu'une ligne
              désigne, et RG-IMP-05 veut alors un REJET, jamais une création
              elle se lit d'une COLLISION, jamais d'une ressemblance
              une clé ambiguë est RETIRÉE de l'index et reste dans `cles` :
              laisser l'une des deux fiches ferait écraser celle-là plutôt que
              l'autre — un choix au hasard rendu stable par l'ordre de lecture
              la clé est calculée par la MÊME fonction que le contrôle : une
              variante ferait que RIEN ne se rapproche, et tout deviendrait
              création — le défaut même que L1-08f venait de réparer
              `actif` n'est PAS filtré : un client désactivé occupe toujours son
              code, et l'ignorer ferait qu'un import le recrée — un refus
              technique à la place d'un rapprochement
              application.ts : LA SECONDE MOITIÉ DE I6 (L1-08i) — elle
              n'applique QUE ce que le rapport a montré, et ne redécide RIEN :
              elle lit `import_lot_ligne.action` et l'exécute
              si elle recalculait, la validation humaine aurait porté sur un
              écran et l'écriture sur autre chose
              UNE SEULE TRANSACTION : une écriture par ligne laisserait, au
              premier incident, un lot « contrôlé » dont la moitié des fiches
              existe — un état que rien ne décrit et que l'annulation ne
              saurait pas défaire
              `valeurs_avant` se lit AVANT d'écrire : après, il est trop tard,
              et le journal d'audit porterait la seule trace — sur une table
              qu'aucune annulation ne lit
              le TYPE est dans le NOM (`…DeClients`) : une fonction « applique
              n'importe quel lot » tiendrait une liste close de plus, à la main,
              que le prochain type oublierait
              un lot introuvable et un lot d'une autre société rendent LE MÊME
              refus — les distinguer ferait un oracle (D35, D50)
              annulation.ts : PARTIELLE ET SÛRE (L1-08j, I6, D15, D54) — elle
              restaure ce qui peut l'être et refuse le reste AVEC SON MOTIF
              ni délai ni rang de lot (D54) : le critère ligne à ligne traite
              MIEUX le cas des imports qui se recouvrent
              « modifiée depuis » se CONSTATE en comparant, et la comparaison
              porte sur les seuls champs que l'import a écrits — il n'a pas
              touché le reste, il n'a rien à en dire
              « référencée depuis » est COMPTÉE avant, et ce n'est pas le choix
              qu'on ferait spontanément : une violation de contrainte ABANDONNE
              la transaction PostgreSQL entière (25P02, mesuré), si bien que
              lire le refus ferait cesser l'annulation d'être partielle
              ce que le comptage ne garantit pas est ÉCRIT : une référence née
              entre le comptage et la suppression fait échouer l'annulation
              ENTIÈRE — rien n'est défait à moitié, et on la rejoue
              JAMAIS DE SUPPRESSION EN CASCADE : ce qui référence la fiche la
              retient, et c'est la LIGNE qui est refusée
              un lot ANNULÉ garde sa date d'application — un lot annulé a bel
              et bien été appliqué, et l'effacer perdrait la seule trace du
              moment où le parc a changé
  portail/    le PORTAIL CLIENT, en CONSULTATION SEULE (L2-12, D92)
              rattachementsDuCompte lit la DIXIÈME forme de politique —
              « rattachement » : un compte lit SES rattachements SANS société
              active, ce que D10 rendait impossible en voulant les deux tables
              exclusives (mesuré : identité seule → 0 ligne, et 0 ligne dans
              `utilisateur_societe` — aucun compte portail n'atteignait rien)
              aucune comparaison de société ni de client n'est écrite ici : on
              lit SOUS le contexte, la forme « parc » décide, et une
              comparaison au-dessus serait une seconde lecture du même critère
              RIEN pour l'écriture : « demander une intervention » n'est pas
              tranché, donc ni construit NI PRÉPARÉ — pas de table qui
              l'attendrait, une place réservée étant une décision de personne
              les emplacements des documents (lot 8) et de l'état VGP (lot 9)
              sont TENUS et DITS VIDES — jamais un zéro ni un « à jour », qui
              se liraient comme des mesures ; « sans information » n'est ni
              l'un ni l'autre (D88)
  pdf/        (prévu) génération des rapports
  reporting/  SEULE zone autorisée à convertir des devises
  vgp/        le REGISTRE DES VÉRIFICATIONS PÉRIODIQUES (lot 9, D88)
              CODIPLAN N'AFFIRME JAMAIS LA CONFORMITÉ : les VGP sont commandées
              par les CLIENTS, et il n'apprend leur résultat que si on le lui
              dit. Aucune fonction ne rend un verdict ; le seul calcul est une
              DATE (L9-01)
              assujettissement.ts : TROIS valeurs sur la famille, jamais une
              case à cocher — une case décochée est indiscernable d'une famille
              jamais examinée, et un pont élévateur sortirait du registre en
              silence ; la naissance est « à déterminer »
              « soumis » exige la périodicité ET le texte qui la fonde : sans
              le texte, la périodicité est un chiffre indéfendable
              la CASCADE rend son ORIGINE avec sa valeur — le modèle PRÉCISE le
              rythme, la machine fait EXCEPTION sur la valeur, jamais l'inverse
              une exception sans motif est refusée, et un motif sans exception
              aussi : le second sens est celui qu'on oublie
              information.ts : « sans information depuis X » n'est NI « à jour »
              NI « en retard » — un registre à moitié rempli ressemble à un
              registre complet, et c'est le danger que D88 nomme
              aucune durée n'y est écrite : ni seuil, ni tolérance, ni
              « bientôt » — la périodicité est saisie, jamais inventée (§8)
              l'heure est un PARAMÈTRE, jamais une lecture : lue ici, elle
              rendrait un test vert parce que l'horloge a bougé
  theme/      charte de la société active — couleurs, encres, variables CSS
              apparence.ts : L'APPARENCE du produit, à distinguer de la charte
              (D95) — la charte est une DONNÉE propre à une société, l'apparence
              est le socle sur lequel elle se pose
              aucune couleur n'y est écrite : les palettes sont déclarées dans
              `app/globals.css`, sous la seule forme qu'une feuille de style
              admet pour une couleur — la déclaration de variable
              un écran ne nomme jamais une couleur, il nomme un RÔLE : ajouter
              un thème, c'est un bloc de style et une entrée de liste, et
              aucun écran à rouvrir
              PAS de sélecteur, et PAS d'apparence sombre : le premier serait un
              réglage sans usage tant qu'il n'y a qu'un thème, la seconde serait
              des couleurs que personne n'a validées
              statuts.ts : les couleurs des huit statuts d'intervention
              (annexe D, promue au rang de règle par le §1) — une RÈGLE du
              produit et non une charte : « en cours » est rouge chez tout le
              monde, c'est un code de lecture partagé, pas une préférence
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

  **Et le témoin a changé de MAIN le 08/09/2026, parce que la règle avait cessé d'être appliquée le jour même où elle a été écrite.** Mesuré : neuf listes d'exemption existaient, **quatre sans aucun témoin** — les quatre créées après cette entrée. Aucune n'était orpheline ; ce qui manquait était ce qui le dirait quand elles le deviendraient. C'est la première entrée du §9 une catégorie plus haut — *une liste close se re-vérifie à chaque objet créé, sinon elle devient fausse* —, l'objet étant ici le **gardien** lui-même. Le témoin n'est donc plus tenu liste par liste mais par **un gardien unique qui DÉDUIT la population du dépôt** (`tests/unit/gardiens/exemptions-adossees.test.ts`) : une exemption écrite dans six mois y entre d'elle-même. Il couvre les **deux formes**, et la seconde est celle qu'on oubliait — un **préfixe de répertoire** doit désigner un répertoire qui existe **et qui contient encore un fichier** : un répertoire vidé exempte toujours, et n'exempte plus rien. Sa limite est annoncée : il reconnaît une exemption à son nom, donc une liste baptisée autrement ou calculée à l'exécution lui échappe — la forme 6 du 26/08, qu'aucun motif statique n'arrête.

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

- **02/09/2026 — UNE PORTE QUI NE GARDE PAS CE QUE GARDE LA PORTE SUIVANTE PRODUIT DES VERTS SINCÈRES ET FAUX.** `pnpm verify` est « la porte de sortie de chaque ticket » ; la CI, elle, jouait `format:check` dans une étape à part. Mesuré sur l'état exact que la CI a refusé : **`pnpm verify` sort en 0 et ne prononce jamais le mot « prettier »**. La session qui a annoncé « verify vert, 600 tests » ne s'était donc trompée sur rien — elle avait franchi une porte qui ne jugeait pas ce que la suivante juge. C'est la divergence du 01/09, appliquée non plus à deux lectures d'un critère mais **aux portes elles-mêmes**, et elle est plus insidieuse : ici, personne ne ment et le rapport est exact.

  **Le remède n'est pas d'ajouter l'étape manquante — c'est de rendre l'écart impossible.** `format:check` entre dans `verify` (l'incident), et un gardien exige que **toute commande jouée par un job de CI soit couverte, transitivement, par la porte correspondante** (la classe). Éprouvé sur la faute réelle, rejouée : `verify` amputé de `format:check` et l'étape rendue à la CI, le gardien rougit en nommant la commande orpheline.

  *Corollaire de rapport, qui vaut même quand les portes coïncident :* **on ne rapporte un vert que sur l'état effectivement poussé**, jamais sur celui d'avant la dernière retouche. Un vert mesuré à un instant et annoncé pour un autre est un vert inventé, quelle que soit la bonne foi.

- **01/09/2026 — DEUX LECTURES D'UN MÊME CRITÈRE DIVERGENT EN SILENCE, PARCE QU'AUCUNE DES DEUX NE PRÉTEND ÊTRE L'AUTRE.** Espèce distincte de la recopie ci-dessus, et il faut la nommer séparément parce que la parade y est différente. Dans la recopie, une même DONNÉE est écrite deux fois, et l'on sait quoi comparer. Ici, un même CRITÈRE est **implémenté** deux fois, par deux modules légitimes, chacun écrit pour son usage — et rien, dans le code, ne dit qu'ils parlent de la même chose. Les deux sont verts. Aucun ne ment. Ils ne disent simplement plus la même chose.

  **Mesuré sur la première catégorie de I1**, le jour de D55. `categoriesDeLaTable` la lit pour ranger chaque table dans l'une des quatre catégories ; `tablesPremiereCategorieI1` la lit pour en dériver le périmètre d'audit. Même définition — `societe_id` non nullable, plus `societe` par identité, moins les référentiels — écrite deux fois, dans deux fichiers, pour deux raisons. Qu'elles dérivent, et l'une dit « cette table est métier » pendant que l'autre dit « elle n'a pas à être auditée ». **Le défaut ne serait apparu ni dans l'une ni dans l'autre suite** : chacune resterait juste sur sa propre lecture, et le trou vivrait dans l'espace entre les deux, que personne n'habite.

  **La question à poser, et c'est la même qu'à la recopie, un étage plus bas : *qu'est-ce qui les confronterait ?*** Si la réponse est « elles sont écrites pareil », ce n'est pas un contrôle — c'est une ressemblance, et une ressemblance ne survit pas au premier ticket qui touche l'une des deux. La parade est un test qui les fait **répondre l'une à côté de l'autre sur la population réelle**, table pour table, avec un témoin de non-vacuité : deux listes vides sont égales.

  **Corollaire, et c'est lui qu'il faut retenir avant d'écrire la deuxième lecture :** la seconde implémentation d'un critère n'est jamais gratuite. Soit on la remplace par un appel à la première — ce qui est presque toujours possible et presque toujours meilleur —, soit on écrit, dans le même geste, ce qui les confrontera. Ce qu'on ne fait pas, c'est les laisser vivre côte à côte en comptant sur la relecture : c'est exactement ce que le 31/08 disait des documents, et le code n'a pas de privilège.

- **01/09/2026 — UNE BORNE SUR LE TEMPS OU LE RANG EST SOUVENT L'APPROXIMATION D'UN CRITÈRE QU'ON NE SAVAIT PAS MESURER. QUAND LE CRITÈRE DEVIENT MESURABLE, L'APPROXIMATION NE SE CUMULE PAS : ELLE SE RETIRE.** RG-IMP-02 promettait une annulation d'import « pendant **24 heures** », et D15 ajoutait « seul le **dernier lot** est annulable ». Ni l'une ni l'autre ne mesurait quoi que ce soit — toutes deux pariaient sur la seule question qui compte : *cette annulation peut-elle encore faire des dégâts ?* Puis D15 a institué le critère qui la mesure vraiment, ligne par ligne : modifiée depuis, référencée depuis, refus motivé ; le reste est restauré. **Les deux bornes sont alors devenues du bruit défavorable** — elles refusent une annulation dont on peut prouver qu'elle est sans danger, et font perdre une journée à qui découvre son erreur le lendemain. D54 les supprime.

  **Et le critère mesuré traite MIEUX le cas qui avait motivé la borne** — c'est le test à faire avant de la garder « par prudence ». Sur deux imports qui se recouvrent, la règle du dernier lot refusait le premier **en entier**, y compris ses lignes que le second n'a jamais touchées ; le critère ligne à ligne refuse exactement les lignes touchées, avec leur motif, et laisse passer les autres. La borne était donc **à la fois plus permissive** dans un sens — elle autorisait l'annulation du dernier lot sans regarder ce qu'il avait écrasé — **et plus brutale** dans l'autre. Une approximation conservée à côté de sa mesure n'ajoute pas de sécurité : elle en retire, et elle masque le fait qu'on sait désormais répondre.

  *La question à poser à toute borne — un délai, un rang, un plafond, une fenêtre : quelle question ne savait-on pas poser le jour où on l'a écrite ? Si on sait la poser aujourd'hui, la borne n'est plus une garantie, c'est un vestige.*

- **06/09/2026 — UN CHIFFRE JUSTE, DANS UN RAPPORT VRAI, QUI FAIT CONCLURE FAUX : LE GARDIEN N'EST PAS CREUX, C'EST CE QU'IL RACONTE DE LUI-MÊME QUI L'EST.** Espèce nouvelle, et il faut la nommer à côté de la vacuité du 30/08 parce que le remède n'a rien à voir. Dans la vacuité, l'assertion ne regarde rien et le vert est faux. **Ici tout est juste** — la mesure, le verdict, le texte — et c'est le LECTEUR qui repart avec une conclusion fausse.

  Mesuré sur le rapport de la veille. Il rendait « 9 tables de la 1ʳᵉ catégorie : 6 société, 1 parc, 1 journal, 1 identité », sous un titre annonçant « observées dans pg_policies, non déclarées », au milieu de lignes qui, elles, venaient bien de la base. Ce décompte-là porte sur la forme **attendue** : il est calculé depuis `TABLES_PARC`, une liste close du dépôt, et **rien de ce qui arrive en base ne peut le déplacer**. Éprouvé en desserrant réellement la politique de `client` : le verdict est tombé en nommant la table et le filtre perdu, et le décompte est resté « 1 parc », impassible. Un lecteur du rapport — le directeur d'exploitation, en l'occurrence — l'a lu comme une mesure et a conclu que la veille comptait au lieu de contrôler. **N'importe qui l'aurait lu comme une mesure**, et c'est le critère : un chiffre affiché à côté de chiffres observés se lit comme observé.

  **La règle qui en sort, et elle est mécanique : toute ligne d'un rapport dit de quel côté du miroir elle vient — la base, ou l'attendu.** Corollaire, plus tranchant que la règle : **une ligne qui ne peut pas bouger sous une faute n'est jamais présentée à côté de celles qui le peuvent.** Soit on la nomme pour ce qu'elle est — une population, un témoin de non-vacuité —, soit on la remplace par ce qui bouge. Le rapport nomme désormais les tables de chaque forme et de chaque catégorie d'état RLS : un décompte se lit en trois secondes et ne se vérifie pas, un nom se vérifie.

  *La question à poser à chaque ligne qu'un contrôle imprime : si la faute que je surveille était commise à l'instant, cette ligne changerait-elle ? Si la réponse est non, elle n'a rien à faire dans la colonne des observations.* Et la parenté avec le 30/08 est exacte, un cran plus haut : un gardien ne peut pas se garder lui-même, et il ne peut pas davantage relire son propre rapport avec les yeux de celui qui n'a pas écrit le code.

- **07/09/2026 — UN BLOC DE GARDE QUI LIT SOUS `FORCE` VOIT ZÉRO ET SE CROIT RASSURÉ — et le défaut n'existe QUE là où rien ne l'exerce.** Une migration qui refuse de s'appliquer sur un état inattendu commence par regarder cet état : `SELECT … FROM "agence" WHERE "territoire" IS NULL`, puis `RAISE EXCEPTION`. C'est le bon réflexe, et le dépôt en compte plusieurs. **Mais `FORCE ROW LEVEL SECURITY` s'applique au propriétaire**, donc à la migration : sans contexte société, elle ne voit AUCUNE ligne des tables cloisonnées. Le bloc trouve zéro, ne lève rien, et **ne se trompe pas — il ne regarde rien.** C'est la population auto-sélectionnée du 31/08 dans sa forme la plus coûteuse : le `WHERE` qui exclut les lignes n'est pas écrit par l'auteur, il est posé par la base.

  *Mesuré le 06/09, propriétaire non superutilisateur, deux lignes en table : `FORCE` actif → **0 ligne vue** ; `NO FORCE` → 2 ; superutilisateur → 2.* Et c'est la seconde moitié qui fait le piège : **en local, le rôle de migration est superutilisateur et contourne RLS.** Le bloc voit tout ici et rien sur la base hébergée — le seul environnement où le défaut existe est le seul qui ne soit jamais exercé, exactement comme le délai de transaction du 23/08.

  **La règle, et elle ne vise pas une réparation : tout bloc de garde qui lit une table sous `FORCE` doit rendre visible le mécanisme qui pourrait l'aveugler.** Lever le drapeau pour la durée du diagnostic et le rendre dans la même transaction ; et surtout **refuser de compter tant que la levée n'est pas constatée**. Le témoin porte sur le MÉCANISME, jamais sur un décompte — un décompte légitimement nul le rendrait muet, ce qui est précisément le cas qu'on veut distinguer. `scripts/lib/gardes-migration.ts` tient la règle et l'INVENTAIRE des migrations déjà appliquées qui la violent : une seule, `20260823130000`, avec deux blocs, immuable et sans reprise à faire — ce qu'elle perd est la lisibilité du refus, pas le refus, la contrainte qui suit échouant d'elle-même. **Un défaut connu et inventorié n'est pas le même objet qu'un défaut connu et unique.**

- **07/09/2026 — LA DIVERGENCE ENTRE DEUX CHEMINS EST UN INSTRUMENT, PAS UN INCONVÉNIENT.** Le §9 nomme déjà la divergence comme un DÉFAUT — deux implémentations d'un même contrat, chacune verte, qui s'écartent en silence (01/09). Voici son autre face : **quand deux chemins qui devraient se ressembler ne se ressemblent pas, l'écart désigne l'endroit exact où une hypothèse est fausse.** C'est le seul instrument qui fonctionne sur un système dont on ne connaît pas la règle.

  Mesuré deux fois le 07/09, sur des objets sans rapport. **(1)** `signUpEmail` échouait sous une politique d'écriture, mais le SEED passait — même table, même politique, même rôle. La seule différence : le seed appelle `upsert`, qui porte un `where`, là où l'inscription appelle `create`, qui n'en a pas. L'écart a désigné la cause : **Prisma n'émet pas un `INSERT` nu mais un `INSERT … RETURNING`, et PostgreSQL soumet le `RETURNING` à la politique de LECTURE.** Une création refusait alors que son `WITH CHECK` l'autorisait, et aucun message ne le disait. **(2)** `TABLES_HORS_CLOISONNEMENT` contredisait la base, et **aucune suite locale ne pouvait l'attraper** — les témoins de l'inventaire exigent d'écrire puis de comparer, ce que `test:isolation` ne fait pas. Seul le contrôle de la base hébergée regardait là ; il a échoué exactement où il était seul à regarder, et c'est la définition d'un contrôle qui sert.

  **Corollaire de méthode.** Quand une épreuve échoue ici et passe là, ne cherchez pas d'abord laquelle a tort : cherchez **ce qui diffère entre les deux appels**, et faites-en varier une chose à la fois. Et corollaire de conception : **un contrôle qui n'échoue jamais là où les autres échouent déjà ne prouve rien.** Celui qui mérite d'exister est celui qui regarde où personne d'autre ne regarde.

- **07/09/2026 — UN RÉSULTAT QUI VOUS SURPREND EN BIEN EST UN SOUPÇON SUR LA MESURE AVANT D'ÊTRE UN FAIT SUR LE MONDE.** Espèce à nommer séparément de la vacuité du 30/08, parce que le SIGNAL est différent — et c'est le seul signal qu'un gardien creux émette jamais.

  Mesuré en écrivant L1-02c. Une politique venait d'être posée sur `utilisateur` ; l'épreuve de l'authentification passait, y compris une lecture IMBRIQUÉE `session → utilisateur` qui aurait dû être filtrée. Le résultat était trop bon. Vérification : `relrowsecurity` valait **`f`** — le harnais d'isolation recrée la base à chaque exécution, et la politique posée à la main avait disparu entre-temps. La mesure prouvait que l'authentification fonctionne **sans** politique, c'est-à-dire rien du tout, et elle l'aurait rapporté comme un succès.

  **Quand une épreuve passe alors que vous attendiez qu'elle échoue, la première hypothèse à écarter n'est pas « le système est meilleur que je croyais » mais « je n'ai pas mesuré ce que je crois ».** C'est l'inverse du réflexe naturel, et c'est pour cela qu'il faut l'écrire : un rouge inattendu déclenche une enquête, un vert inattendu déclenche un soulagement. Le second coûte plus cher que le premier.

  **La parade devient une règle, pas une vigilance : toute mesure d'une politique porte un TÉMOIN PRÉALABLE.** Il constate que la politique est bien en vigueur — les **deux drapeaux** (`relrowsecurity` et `relforcerowsecurity`, jamais un seul, §9 du 31/08) — **et** qu'elle mord : zéro ligne sans contexte. Sans lui, une base reconstruite entre-temps rend un vert qui ne parle de rien. Le témoin porte sur le MÉCANISME, comme celui des blocs de garde : un décompte légitimement nul le rendrait muet.

- **07/09/2026 — CONFIRMATION, sur son auteur, au ticket suivant : la règle des blocs de garde a payé son écriture en un jour.** L'entrée ci-dessus sur `FORCE ROW LEVEL SECURITY` a été écrite le 07/09 au ticket L1-02. Le lendemain, à L1-02b, la migration du périmètre lisait DEUX tables sous `FORCE` — l'habilitation et `site` — et son auteur n'avait levé le drapeau que sur la première. Sur la base hébergée, le bloc aurait vu **zéro site**, conclu que TOUS les périmètres étaient orphelins, et **refusé une migration parfaitement saine** ; en local, le rôle de migration étant superutilisateur, il n'aurait rien montré. C'est `tests/unit/db/gardes-migration.test.ts` qui a nommé `site`, pas la relecture et pas la base.

  **Ce qu'il faut en retenir n'est pas que la règle est juste — c'est le DÉLAI.** Une règle inscrite au §9 se vérifie d'ordinaire des mois plus tard, sur quelqu'un d'autre ; celle-ci a mordu en vingt-quatre heures, sur la personne qui venait de l'écrire. **Connaître une règle ne protège pas de l'enfreindre** : seul le gardien protège, et c'est l'argument pour en écrire un plutôt que de noter la leçon. Corollaire de méthode, à opposer à toute session qui proposerait « on fera attention » : l'auteur d'une règle est le premier à en avoir besoin.

- **07/09/2026 — UN NOMBRE DONT LA SIGNIFICATION DÉPEND D'UNE AUTRE COLONNE NE DOIT JAMAIS VOYAGER SEUL.** `site.temps_trajet_min` valait « 45 » et ne disait pas d'où l'on part. La valeur était juste, la colonne bien nommée, la règle RG-PLA-05 exacte — et le nombre n'était interprétable que par quelqu'un qui connaissait déjà la réponse. Le jour où une quatrième agence ouvre, personne n'aurait su quelles valeurs revoir. **Ce n'est pas une donnée manquante, c'est une donnée dont le RÉFÉRENTIEL est implicite**, et l'implicite ne survit pas au départ de celui qui le portait.

  Trois conséquences, et la troisième est celle qu'on saute. **Écrire la dépendance** — `site.agence_id`, obligatoire. **L'écrire là où quelqu'un la lira**, ce qui veut dire à plusieurs endroits parce que les lecteurs diffèrent : la règle métier pour qui cherche le métier, le schéma pour qui lit le modèle, un `COMMENT ON COLUMN` pour qui ouvre une console sans ouvrir le dépôt, le déclencheur pour qui n'aura rien lu. Et **la TENIR** : un commentaire ne refuse rien. `site_trajet_suit_agence` refuse de changer le rattachement en laissant le nombre inchangé ; il n'exige pas qu'on mesure, il exige qu'on décide — fournir la nouvelle valeur, ou `NULL` pour revenir à l'estimation. Voir D56.

  *Corollaire sur les FORMULES DE TICKET :* le backlog disait « `temps_trajet_min` **par agence** », ce qui se lit « une valeur par couple ». L'exploitation voulait dire « depuis l'agence dont le site dépend ». Une formule qui admet deux lectures dont l'une double la table est une ambiguïté, pas un raccourci — et elle se corrige dans le backlog, pas seulement dans le code.

- **07/09/2026 — AFFIRMER UN ÉTAT OBSERVABLE AU LIEU DE L'OBSERVER. Ce n'est plus l'accident de l'un ou de l'autre : c'est une PENTE DU DISPOSITIF, et elle a quatre occurrences en quatre jours.** Espèce à nommer séparément de la vacuité du 30/08 et du vert surprenant du 07/09, parce que le défaut n'est pas dans un gardien : il est dans la CONVERSATION qui pilote les gardiens. Un état du dépôt, de la base ou de la CI est **observable en une commande** — un `cat`, un `SELECT`, un `EXPLAIN`, un appel d'API. Et c'est précisément parce qu'il est bon marché à observer qu'on ne l'observe pas : on l'énonce de mémoire, avec la forme grammaticale d'un fait.

  **Les quatre, deux de chaque côté, sur des objets sans rapport.**

  | Qui | Ce qui a été affirmé | Ce que l'observation a rendu |
  |---|---|---|
  | Exploitation | « une sous-requête d'existence **à chaque ligne lue** » — un coût, énoncé pour trancher une forme de politique | `EXPLAIN` : *hash semi-join*, **une** visite du parent, 0,2 ms sous 190 ms de latence |
  | Exploitation | « la migration de #32 **n'est pas appliquée** » | Elle l'était |
  | Session | « la politique sur `utilisateur` est en vigueur et l'authentification passe dessous » | `relrowsecurity` valait **`f`** — le harnais avait recréé la base, la mesure ne parlait de rien |
  | Session | « vos quatre réponses **sont au backlog** » | Elles étaient dans le message de l'exploitation ; le fichier n'avait pas été rouvert |

  **Ce qui rend la pente structurelle, et non morale : nous parlons de fichiers que nous ne relisons pas.** La conversation porte des dizaines d'états — une branche, une migration, une ligne de backlog, un drapeau RLS, un résultat de CI — et chacun a été vrai *au moment où il a été observé*. Le dépôt bouge, la mémoire ne bouge pas avec lui, et rien dans une phrase ne distingue « je viens de le lire » de « je l'ai lu avant-hier ». **Un état affirmé de mémoire a exactement la forme d'un état observé** — même famille que le silence qui a la forme du succès (31/08) et que le chiffre attendu présenté à côté des chiffres observés (06/09).

  **La règle, et elle est symétrique : quand l'un de nous énonce un état du dépôt, de la base ou de la CI comme un fait, l'autre le traite comme une HYPOTHÈSE à vérifier, et dit quand elle est fausse.** Elle vaut dans les deux sens, y compris de la session vers l'exploitation — c'est l'exploitation qui l'a demandée, et la première des quatre occurrences a été corrigée ainsi. Corollaire à l'écriture : **on n'écrit pas « c'est au dépôt » sans avoir rouvert le fichier dans le même geste**, et une mesure se rend avec ce qui l'a produite — la commande, la requête, le décompte — jamais seule. Ce que cette règle ne prétend pas : aucun gardien ne peut la tenir. Elle vit entre deux relectures, là où le §9 a déjà mis la revue *(30/08 — un gardien ne peut pas se garder lui-même)*.

- **08/09/2026 — DEUX REQUÊTES QUI RENDENT LE MÊME SQL PEUVENT AVOIR DES FORMES DIFFÉRENTES, ET C'EST LA FORME QUE LE CODE LIT.** Espèce voisine des six formes équivalentes du 26/08, mais prise par l'autre bout : là, un gardien lisait le SQL et ratait une graphie ; ici, du code lit une STRUCTURE d'appel, et le SQL — identique — ne laisse rien voir de ce qui a changé.

  Mesuré sur l'enveloppe de désignation de L1-02d. Elle lit la clé de désignation au premier niveau du `where` Prisma. L'adaptateur de Better Auth écrit `{ utilisateur_id: … }` quand il n'a qu'une condition, et `{ AND: [{…}, {…}] }` dès qu'il en compose plusieurs. **Le SQL rendu est le même** — `a = $1 AND b = $2` —, si bien que la trace des requêtes, qui avait servi à déduire toutes les clés, ne pouvait pas montrer la différence. La désignation partait vide, la politique refusait, et l'appelant lisait « **Invalid password** » : *un message juste sur une cause fausse*, le pire des symptômes puisqu'il envoie chercher ailleurs.

  **Ce qu'il faut en retenir : quand on déduit un contrat depuis une TRACE, on n'observe que ce que la trace conserve.** Une trace SQL perd la structure de l'appel, une trace d'appels perdrait le SQL. La parade n'est pas de tracer davantage : c'est de **faire varier l'entrée** — une condition, puis deux — et de regarder si le code lit encore ce qu'il croit lire. C'est le corollaire du 07/09 sur la divergence comme instrument : ici les deux chemins qui devaient se ressembler étaient *une* condition et *deux*.

- **08/09/2026 — UN DÉFAUT INVISIBLE PARCE QUE CE QU'IL CASSE N'EXISTE PAS ENCORE.** L1-02c a cassé **toutes les pages authentifiées** : `obtenirSession` rendait `null` pour tout compte fraîchement connecté. Rien n'a rougi — ni `verify`, ni la CI, ni les 300 scénarios d'isolation. Non pas parce que les gardiens étaient mauvais : **parce qu'il n'y a pas encore de pages**, donc personne n'appelait cette chaîne.

  **Le dépôt ne peut pas détecter les régressions d'une couche qui n'a pas d'appelant**, et c'est une propriété du moment où l'on se trouve, pas un défaut d'exécution. Un lot 0 et un lot 1 posent des fondations que rien ne consomme encore ; chaque module ainsi posé est un endroit où un ticket ultérieur peut casser quelque chose en silence, jusqu'au jour lointain où le premier écran l'exercera — et ce jour-là, la cause aura dix tickets d'âge.

  **La parade n'est pas d'écrire les écrans en avance** — ce serait construire hors du plan. C'est de **donner un appelant à la chaîne** : un scénario qui la traverse de bout en bout, sans passer par le moindre écran. Ouvrir une session, la RELIRE, basculer de société, la RELIRE encore, puis s'en servir pour lire du cloisonné. `tests/isolation/chaine-session.test.ts` est cet appelant, et il aurait attrapé le défaut.

  **Le critère qui désigne la chaîne à écrire :** un module dont aucun test ne franchit la FRONTIÈRE avec le suivant. Chaque maillon avait ses scénarios — l'ouverture, l'habilitation, les politiques — et le défaut vivait exactement dans le maillon que personne ne traversait, entre `signInEmail` et `obtenirSession`. *Une suite qui éprouve tous les maillons n'éprouve pas la chaîne.*

- **08/09/2026 — UNE RÉPARATION DONT ON N'A PAS ISOLÉ LA CAUSE N'EST PAS UNE RÉPARATION : C'EST UNE COÏNCIDENCE, ET LE JUMEAU EST CE QUI LE DIT.** Espèce à nommer à côté du jumeau du 24/08, parce qu'elle prend l'outil par l'autre bout. Là, le jumeau prouvait qu'un verrou mordait. Ici, il a prouvé qu'un verrou **ne servait à rien**.

  Mesuré à L1-02d. `getSession` rendait `null` ; une branche a été ajoutée à `utilisateur_lecture` — « le jeton de session désigne aussi son identité » —, la chaîne s'est remise à fonctionner, et l'explication a été écrite partout : migration, arbitrage, constitution. **Le jumeau l'a démentie en une exécution** : branche retirée, toute la suite reste verte. La chaîne fonctionnait pour une autre raison, et la trace l'a confirmé — `getSession` émet DEUX opérations de client, l'identité s'y désignant par son propre identifiant.

  **Ce qu'il faut en retenir, et c'est inconfortable : « ça marche maintenant » ne dit pas « j'ai compris ».** Une explication écrite au moment où le rouge devient vert est une hypothèse, et elle a exactement la forme d'une conclusion — même famille que l'état affirmé au lieu d'être observé (07/09). Le geste qui les sépare coûte une minute : **retirer la réparation et regarder si le défaut revient.** S'il ne revient pas, on n'a pas réparé ce qu'on croit, et la ligne ajoutée est un élargissement sans objet — on la retire plutôt que de la garder « au cas où ».

  **Et quand la cause reste introuvable, on l'écrit.** ~~Ici elle l'est restée : l'isoler demanderait de rejouer l'ANCIEN code contre l'ANCIENNE base, et ni l'un ni l'autre n'existe plus ensemble.~~ **Cette phrase était fausse, et l'entrée du 08/09 ci-dessous dit comment** : la cause a été isolée à L1-02e, en vingt minutes. Ce qui garde la chaîne n'est pas pour autant une explication mais un APPELANT — et c'est plus solide, parce qu'un appelant attrape aussi les causes qu'on n'avait pas prévues.

- **08/09/2026 — UNE EXPLICATION CAUSALE QUI N'A PAS ÉTÉ MISE EN ÉCHEC N'EST PAS UNE CAUSE : C'EST UNE HYPOTHÈSE BIEN RACONTÉE. Et la règle est SYMÉTRIQUE.** L'entrée ci-dessus la posait du côté de celui qui écrit la réparation. L'exploitation l'a complétée du côté de celui qui la relit, en constatant sa propre faute : *« vous m'aviez donné une explication — le jeton de session désigne aussi son identité — et je l'ai acceptée. J'ai reçu une explication causale et je ne vous ai pas demandé de la faire tomber avant d'y croire. »*

  **Ce qui rend cette faute-là structurelle : une explication causale se juge sur sa VRAISEMBLANCE, et la vraisemblance est exactement ce que la rédaction fabrique.** Celle-ci était excellente — elle nommait un mécanisme réel de la bibliothèque, elle expliquait le symptôme, elle s'accordait au reste. Rien, dans le texte, ne la distinguait d'une cause. La seule chose qui les sépare est **une exécution** : retirer la réparation et regarder si le défaut revient. **Une explication non éprouvée ne se relit donc pas, elle se demande** — et la demande tient en une phrase : *« qu'avez-vous retiré pour voir le défaut revenir ? »*

- **08/09/2026 — UNE IMPOSSIBILITÉ AFFIRMÉE EST UN ÉTAT AFFIRMÉ AU LIEU D'ÊTRE OBSERVÉ, et elle coûte plus cher que les autres parce qu'elle CLÔT l'enquête.** D59 écrivait : « isoler la cause d'origine demanderait de rejouer l'ANCIEN code contre l'ANCIENNE base ; ni l'un ni l'autre n'existe plus ensemble. » La phrase est exacte dans ses termes et **fausse dans sa conclusion** : l'ancien code est dans l'historique, et l'ancienne base s'obtient en défaisant cinq `ALTER TABLE`, la migration fautive n'ayant touché que cinq tables. La passe a coûté **vingt minutes**, et la cause tient en une ligne — l'enveloppe de L1-02c lisait la forme `{ equals }` pour le courriel et l'identifiant nu, quand `getSession` relit l'identité sous `{ id: { equals: … } }`.

  **C'est la pente du 07/09 — affirmer un état observable au lieu de l'observer — dans sa variante la plus coûteuse.** Un état affirmé se corrige au premier regard ; une impossibilité affirmée **empêche le regard**, et personne ne vérifie ce qu'on lui a dit d'inutile. Elle a en outre la forme d'une prudence, ce qui la rend difficile à contredire : celui qui dit « je ne peux pas savoir » paraît plus rigoureux que celui qui dit « je sais ».

  **La règle : une impossibilité s'énonce avec son COÛT, ou pas du tout.** « Il faudrait rejouer X contre Y » n'est pas une conclusion, c'est un devis — et un devis se chiffre avant d'être refusé. La question à poser à toute phrase de cette famille : *combien de temps pour essayer ?* Si la réponse est « moins d'une heure », l'impossibilité n'en est pas une, c'est un renoncement.

  **Corollaire sur le REJEU.** Il est plus souvent à portée qu'on ne le croit, et pour une raison mécanique : le dépôt garde tout le code, et une migration ne touche qu'une poignée d'objets — donc l'état d'avant se reconstruit en défaisant ce qu'elle a fait, pas en rebâtissant la base. Le rejeu est éprouvé quand il **REPRODUIT** le défaut ; sans cette reproduction, on ne mesure rien (§9, 30/08 — la violation a-t-elle bien eu lieu ?).

- **08/09/2026 — UN CLIQUET QUI CONDAMNE AUSSI L'ISSUE DE SECOURS N'EST PAS UN CLIQUET, C'EST UN ENFERMEMENT. Quand on ferme un verbe pour empêcher un RETRAIT, on regarde ce que ce verbe portait d'autre.** L1-02d avait retiré à `second_facteur` toute politique de suppression, et c'était juste : *un compte peut modifier ce qui parle de lui, jamais ce qui gouverne son accès* (D58). Mais la même famille d'écritures portait autre chose que le retrait — **la consommation d'un code de secours**, qui est un usage et non un désenrôlement. Mesuré à D64 : le code de secours était **validé**, puis l'écriture qui le consomme était refusée, et l'appelant recevait `409`. Ajouté au défi de second facteur qui ne se consommait pas non plus, cela donnait un compte enrôlé **sans aucune porte de sortie** — ni le code, ni le code de secours — alors que l'enrôlement était ouvert depuis la veille.

  **Ce qui rend cette faute générale, et non une distraction : le raisonnement portait sur une INTENTION (« interdire de retirer ») et la fermeture portait sur un VERBE (« aucun `DELETE`, aucun `UPDATE` non désigné »).** Un verbe est plus large qu'une intention, toujours ; l'écart entre les deux est exactement ce qu'on ne voit pas au moment où l'on ferme, parce qu'on relit son intention et non sa portée. Corollaire pratique, à faire avant de fermer un verbe : **énumérer ce que ce verbe fait aujourd'hui**, chemin par chemin, et non ce qu'on veut lui interdire. La trace des opérations réellement émises le donne en une exécution ; la relecture ne le donne jamais.

  *Parenté :* c'est la vacuité du 30/08 prise par l'autre bout. Là, un gardien ne regardait rien et passait au vert ; ici, une fermeture regarde plus large qu'elle ne croit et **casse en silence** — car un refus de RLS est zéro ligne, pas une erreur.

- **08/09/2026 — POSTGRESQL APPLIQUE LES POLITIQUES DE `SELECT` AU `WHERE` D'UN `UPDATE` : un jumeau qui ne retire qu'une des deux moitiés mesure le refus du voisin.** Mesuré à D64, sur le jumeau censé prouver que la clause d'appartenance de `second_facteur` mordait. La politique d'`UPDATE` retirée et remplacée par `USING (true)`, l'écriture sur la ligne d'autrui **échouait quand même** — zéro ligne. Ce n'est pas la politique d'écriture qui refusait : c'est celle de LECTURE, qui filtre les lignes que le `WHERE` peut atteindre.

  Deux conséquences, et la seconde est la plus utile. **La garantie est plus forte qu'annoncé** — l'appartenance est exigée deux fois, une fois pour trouver la ligne et une fois pour l'écrire —, et cela ne se savait pas avant de l'avoir mise en échec. Et **un jumeau qui « ne viole rien » n'est pas une bonne nouvelle** : c'est le signal qu'il ne vise pas le verrou qu'on croit. C'est la règle du 24/08 (« le jumeau retire LE verrou visé, pas un voisin ») rejouée dans le sens inverse — ici le voisin ne fait pas échouer à la place, il **réussit à refuser** à la place, ce qui ressemble à s'y méprendre à une garantie éprouvée.

- **09/09/2026 — UNE GARANTIE ÉNONCÉE EN TERMES DE CE QU'IL FAUT FAIRE SE REFERME UN ÉTAGE PLUS BAS, ET LE GARDIEN RESTE VERT — IL A MÊME RAISON.** Espèce à nommer à côté de la vacuité du 30/08, parce que le gardien **n'est pas creux** : il regarde ce qu'il a promis de regarder, il le trouve, et la garantie n'est pourtant pas là.

  L1-02b avait fermé une faute exacte : *« une politique juste dont personne ne pose la variable ne garde RIEN »*. Son gardien exige donc que **toute variable réclamée par une politique soit POSÉE par le chemin de production**. Un mois plus tard, `app.client_id` est bien posée — elle figure dans `POSE`, le gardien est vert — et **rien ne peut lui donner de valeur** : `ContexteSession` ne porte aucun champ de client, et `avecContexteApplicatif` l'écrit donc toujours à vide. Or la forme « parc » traite une valeur vide comme « utilisateur interne » et **retire le filtre**. *Mesuré sous `codiplan_app`, après deux témoins — rôle non privilégié, zéro ligne sans contexte : un compte portail du client `c2` lit **2 machines du client `c1`** ; le même contexte, `app.client_id` posé, rend **0**.*

  **La faute n'a pas été rouverte : elle a RECULÉ D'UN CRAN**, de la pose vers la source, et elle est repartie invisible. Et c'est mécanique : *« la variable est posée »* est une exigence sur un **geste**, *« le filtre mord pour un compte portail »* est une exigence sur un **fait**. Un gardien écrit sur le geste est satisfait par un geste vide.

  **La règle : quand vous fermez un trou, demandez ce que votre gardien exige — un geste ou un fait. S'il exige un geste, nommez le fait qu'il est censé produire, et demandez ce qui le vérifie.** Ici : « `app.client_id` est posée » ne dit rien ; « un compte portail ne lit que le parc de son client » se mesure, et c'est ce que `tests/isolation/designation-client.test.ts` mesure désormais — avec son jumeau, qui montre un compte du client A1 lire la ligne du client A2 dès que la validation est retirée.

  **Et la réparation a suivi le lendemain, sans que la règle change** *(D70)*. Le trou n'était pas « il manque un poseur » mais « la garantie était énoncée sur un geste » : `app.client_id` est désormais **renseignable** — l'appelant la DÉSIGNE, la base la VALIDE contre les habilitations du compte dans la même transaction, et refuse plutôt que de rendre un contexte vide. *Le fait a remplacé le geste : « un compte portail ne lit que le parc de son client » se mesure maintenant, à travers le chemin de production.*

  *Parenté :* c'est la population auto-sélectionnée du 31/08 vue par la sortie plutôt que par l'entrée. Là, le `WHERE` faisait sortir l'objet fautif de la population ; ici, la FORMULATION fait sortir le cas fautif de ce qui est exigé.

- **09/09/2026 — UNE DURÉE EST UN ÉTAT, ET ELLE S'OBSERVE COMME LES AUTRES.** Le §9 (07/09) dit qu'un état du dépôt, de la base ou de la CI s'observe plutôt qu'il ne s'affirme. **Une DURÉE en est un, et c'est le seul qu'on ne pense pas à mesurer** — parce qu'on croit la vivre.

  Mesuré sur moi-même, en clôture de la journée du 09/09. Un travail de CI paraissait bloqué : je l'ai annoncé « immobile depuis plus de quarante-cinq minutes », j'ai annulé le run, et j'ai écrit à l'exploitation qu'un exécuteur était en panne. **Cinq minutes s'étaient écoulées.** Le run jumeau, lancé sur le MÊME commit à la même seconde, s'est terminé en **success** en 4 min 14 s ; celui que j'ai annulé était sain, et sa reprise a mis 5 min 10 s.

  **D'où venait le chiffre : du NOMBRE DE FOIS où j'avais interrogé l'état, jamais d'une horloge.** Une conversation n'a pas de durée propre — dix appels d'outil se suivent en quelques minutes ou en une heure, et rien dans le fil ne le dit. `date -u` coûte une seconde et je ne l'avais pas tapé une seule fois.

  **Le coût de cette espèce est ASYMÉTRIQUE, et c'est ce qui la distingue.** Un état affirmé se corrige au premier regard. Une durée affirmée **déclenche un geste** — ici l'annulation d'un travail sain, et un rapport faux à l'exploitation. Elle est proche de l'impossibilité affirmée du 08/09, qui clôt l'enquête ; celle-ci, elle, agit.

  **La règle : avant de qualifier quoi que ce soit de « lent », « bloqué », « trop long » ou « depuis N minutes », lire une horloge et donner les deux bornes.** Et le corollaire de rapport : un délai annoncé sans son point de départ mesuré est une impression, pas une observation — il ne s'écrit ni dans un registre, ni dans un message, ni dans un commentaire de PR.

- **09/09/2026 — DEUX CONTRATS SOUS UN MÊME NOM, DANS DEUX MODULES QU'UN MÊME FICHIER IMPORTE.** Troisième de la famille ouverte le 01/09 — après « deux lectures d'un même critère » et « une liste close recopiée » —, et la plus discrète des trois, parce que **rien ne les confronte** : ni le typage, qui juge chaque appel séparément, ni la relecture, pour qui `avecSociete(…)` a l'air d'être `avecSociete`.

  Mesuré à L2-01. `tests/isolation/setup/db.ts` exportait `avecSociete` et `avecSocieteEtRole`, **exactement comme `lib/db/rls.ts`** — avec un argument de moins et un contrat différent. Un fichier qui importe des deux choisit sans le savoir : appeler celle du harnais avec les arguments de la production passe un **client Prisma** là où un identifiant est attendu, et Prisma **récurse sans fin** en tentant de le sérialiser. Le scénario échoue sur *« Maximum call stack size exceeded »* — **un message juste sur une cause fausse**, celui qui envoie chercher du côté de la base pendant vingt minutes.

  **Et le typecheck le DISAIT** : « Expected 2 arguments, but got 3 ». Il a été lu après. *Corollaire de méthode, qui vaut au-delà de ce cas : quand une erreur d'exécution est incompréhensible, `tsc` a souvent déjà répondu — et il coûte deux secondes.*

  **La parade n'est pas la vigilance : c'est que le nom ne puisse plus être le même.** Le harnais préfixe ses aides par `sous` — le contexte SOUS lequel un scénario s'exécute —, et `tests/unit/db/noms-du-harnais.test.ts` refuse tout emprunt futur, sa population venant des deux modules eux-mêmes. Sa limite est annoncée : il compare des noms **exportés**, et une ombre locale lui échappe — il en existe une, inoffensive, parce qu'une variable locale n'est jamais appelée à la place d'un import. *Ce qu'il arrête est l'ambiguïté à la FRONTIÈRE entre deux modules.*

- **11/09/2026 — TOUTES MES MISES EN ÉCHEC FAISAIENT ROUGIR LE GARDIEN ; AUCUNE NE VÉRIFIAIT QU'UN VERT ÉTAIT MÉRITÉ.** Le §9 dit depuis le 30/08 qu'un gardien creux passe au vert sans rien regarder, et depuis le 24/08 qu'un refus se prouve par un jumeau. Voici ce que ces deux règles, appliquées à la lettre, laissent encore passer — et c'est arrivé la nuit même où elles ont été relues.

  Un gardien écrit le 11/09 tenait l'énumération de I1 contre `prisma/schema.prisma`. Il a été **éprouvé quatre fois sur le document réel** — une destination absente, une marque `(prévu)` devenue fausse, une destination sans accents graves, le tableau retiré —, et les quatre l'ont fait **rougir** comme voulu. Puis une question posée de l'extérieur, *« que regarde-t-il, au juste ? »*, a mesuré ceci : sa fonction `existe()` cherchait `` model … { … @@map("<table>") `` **depuis le début du fichier**, si bien que son corps paresseux traversait tous les modèles précédents. **`utilisateur_societe.email` était rendu PRÉSENT** — la colonne existe, mais sur `utilisateur`, un modèle plus haut. Le gardien aurait donc **admis** une énumération fausse, en restant vert.

  **La dissymétrie est structurelle, et c'est elle qu'il faut retenir.** Un gardien est un prédicat à **deux** directions : *il rougit quand il doit* et *il ne reste vert que quand il le doit*. Une mise en échec — retirer le verrou, écrire la faute — n'éprouve que la PREMIÈRE. La seconde ne s'éprouve que par un cas qui **doit passer et qui pourrait passer pour une mauvaise raison** : une destination réelle à côté d'une destination qui lui ressemble, un voisin qui porte le même nom. *Et c'est la direction permissive — celle qui ne produit aucun signal, jamais.*

  **La règle, à ajouter à celle du jumeau : à côté de chaque cas qui doit rougir, un cas qui doit rester vert POUR SA PROPRE RAISON.** Ici : `utilisateur_societe.role` est présent **et** `utilisateur_societe.email` est absent, `machine.numero_serie` est présent **et** `machine.email` est absent. La paire se lit d'un coup d'œil, et elle tombe dès que la fonction confond deux modèles — éprouvé en remettant la faute d'origine.

  *Parenté :* c'est le § du 30/08 pris par l'entrée plutôt que par la sortie. Là, on demandait *« la violation a-t-elle bien eu lieu ? »* ; ici on demande *« le succès a-t-il bien la cause que je crois ? »* — la question du 08/09 sur les réparations, appliquée aux gardiens.

  **Corollaire, mesuré la même nuit sur un autre gardien : QUAND UNE FAUTE A DEUX MOITIÉS, N'EN REJOUER QU'UNE NE VIOLE RIEN.** L'épreuve de `chaine-verification` prétendait rejouer l'incident du 02/09 en amputant la PORTE de `format:check`. Or la faute était double — *la CI joue `format:check` à part* **et** *`verify` ne le couvre pas* —, et la réparation de l'époque a retiré la première moitié : le job de CI ne nomme plus `format:check` du tout. **Amputer la porte ne produisait donc plus aucune violation**, et l'épreuve comparait deux ensembles au lieu de faire prononcer le contrôle. Elle rend désormais à la CI l'étape séparée qu'elle avait, et fait calculer le verdict par l'expression même du contrôle — refus sur la porte amputée, acceptation sur la porte saine. *Une réparation réussie efface la moitié de la faute qu'elle a corrigée ; l'épreuve qui la rejoue doit la remettre.*

- **11/09/2026 — UN GARDIEN DONT LE TAUX DE FAUSSES ALERTES CONDUIT À NE PLUS LE LIRE COÛTE PLUS QU'IL NE RAPPORTE. C'est É12 sous un autre costume, et il faut le nommer comme lui.** É12 disait : *une alarme qui ne se surveille pas elle-même n'a que la fiabilité de son déclencheur, et sa panne la plus probable est de se taire.* Voici l'autre panne, symétrique, et elle ne se taira jamais — **elle criera si souvent que personne ne l'écoutera.** Les deux finissent au même endroit : un signal auquel plus rien ne répond.

  Mesuré la nuit du 10/09 sur le gardien que D28 désignait — *toute valeur d'énumération qu'une décision de rang 1 nomme existe au schéma*. La forme qui **attrape le défaut** produit **onze faux positifs pour une prise**, dont **sept que rien de structurel ne retire** : « type » lu pour `TypeForfait` dans des phrases qui parlent de types d'intervention (D8 ×5, D74 ×2). Et le lot 2 parlera de types d'intervention à toutes les pages : le taux ne se stabilise pas, **il monte**. *Le refus est ratifié le 11/09 par l'exploitation, et cette règle est ce qu'il laisse derrière lui.*

  **Ce qui rend la faute structurelle, et non un jugement de goût :** un gardien bruyant n'échoue pas comme un gardien creux. Le creux est vert et ne dit rien ; le bruyant est rouge et dit trop. Or **la seule réponse disponible à un rouge fréquent et presque toujours faux est d'apprendre à passer outre** — d'abord sur ses onze alertes connues, puis sur la douzième, qui sera la vraie. **On ne mesure pas la valeur d'un gardien à ce qu'il attrape, mais au rapport entre ce qu'il attrape et ce qu'il exige de lire.** Un gardien qui exige onze lectures pour une prise a déjà dépensé son crédit avant la prise.

  **Le corollaire de conception, qui vaut avant d'écrire le gardien :** quand un motif ne sait pas distinguer le vrai du faux, ce n'est pas le motif qu'il faut affiner mais **le TEXTE qu'il lit qu'il faut rendre lisible**. Une valeur d'énumération qui voyage sans son énumération est un jeton dont la signification dépend d'un contexte que la machine ne lit pas — même famille que D56, *un nombre dont la signification dépend d'une autre colonne ne voyage jamais seul*. La sortie n'est donc pas un meilleur gardien, c'est une convention d'écriture qui rend le gardien trivial.

  **Et la classe reste OUVERTE, avec son critère de réouverture écrit** — sans quoi « écarté » deviendrait « oublié » : *le jour où une convention de qualification rend l'association décision ↔ énumération EXPLICITE, le gardien se réécrit sans heuristique ni exemption, et il est dû.* Le critère se vérifie, il ne s'interprète pas. Voir le registre « Ce qui reste à décider ».

- **10/09/2026 — UNE CORRECTION QUI BARRE LA LIGNE ENTIÈRE EMPORTE LA MOITIÉ VRAIE AVEC LA FAUSSE.** À L2-01, le chapitre 11 disait de `reference_interne` « unique par société, porté par le QR ». La seconde moitié était fausse (le QR encode `qr_token`, I10) ; la ligne a été barrée **entière**, et « unique par société » — la propriété sur laquelle D6 s'appuie — est partie avec. Personne ne l'a vu : une ligne barrée a l'air d'une ligne traitée. *La correction vise un mot ; elle barre le mot, jamais la ligne.* Restaurée le 10/09.
- **09/09/2026 — UN DÉFAUT PEUT ÊTRE INVISIBLE À TOUTE ASSERTION ET ÉVIDENT SUR UNE IMAGE : la capture d'écran attrape ce qu'aucune règle n'a été FORMULÉE pour attraper.** Espèce à nommer à côté de la vacuité du 30/08, parce que le gardien n'est pas creux — **il n'existe pas**, et personne ne s'en est aperçu.

  Mesuré en photographiant le premier planning. Trois lignes portaient le badge **« À planifier »** et une **date au 14 septembre**, rangées dans la section des interventions **posées**. La règle de statut ne regardait que le `creneau_debut` ; une intervention datée sans heure restait donc dans la file d'attente. **Chaque moitié était juste** — le statut suivait sa règle, la section suivait la date — et *rien, dans le dépôt, ne formulait qu'elles doivent s'accorder.* Aucun scénario ne pouvait rougir : on n'écrit pas d'assertion sur un invariant qu'on n'a pas encore vu.

  **Ce qui rend l'espèce distincte, et pourquoi elle ne se referme pas par un gardien de plus.** Un gardien éprouve une règle qu'on a su écrire. Ici la règle manquante est **« le badge et la ligne où il s'affiche disent la même chose »** — une propriété de la RENCONTRE de deux calculs, qu'aucun des deux ne connaît. On ne la formule qu'après l'avoir vue ; et on ne la voit qu'en **regardant le résultat à côté de son contexte**, ce qu'une assertion ne fait jamais : elle interroge une valeur, seule.

  **La règle, et elle est modeste exprès : quand un écran est écrit, il est REGARDÉ — pas seulement exercé.** Un scénario de rendu qui interroge l'écran prouve qu'un texte est présent ; il ne prouve pas que la page a du sens. *L'image, elle, met tout côte à côte, et c'est le seul instrument qui montre une incohérence qu'on n'attendait pas.* C'est la même famille que la question posée de l'extérieur (30/08) — un gardien ne peut pas se garder lui-même —, appliquée non plus au gardien mais à **l'absence de gardien**.

  *Corollaire, mesuré le même jour sur un autre objet :* **un seed idempotent suppose que toute ligne est réécrivable, et cette hypothèse devient fausse le jour où une table porte un verrou de cycle de vie.** L'`upsert` du seed a buté en `23514` sur les lignes `cloturee` et `annulee` qu'il venait de poser — *le verrou faisait son travail sur le premier chemin venu, y compris le nôtre.* Le seed ne réécrit donc plus : **il s'abstient**, ce qui est le bon sens de défaillance pour une donnée de démonstration.

- **09/09/2026 — UNE AFFIRMATION DE RAPPORT PORTANT SUR UN ARTEFACT CONSTRUIT NOMME L'EMPREINTE DU COMMIT SUR `main` OÙ ELLE SE VÉRIFIE. Sans empreinte, elle n'est pas écrite.** Le §9 dit depuis le 07/09 qu'affirmer un état observable sans l'observer est une faute. Voici sa forme dans un RAPPORT — et le rapport est le pire endroit pour cette faute, parce qu'il est **relayé à quelqu'un qui ne peut pas vérifier**.

  Mesuré sur le rapport du 9 septembre au matin. Il portait « les six écrans affichent ». Quatre existaient, et aucun n'était un planning : `/planning`, `/clients`, `/techniciens` et `/premier-acces` rendaient **404**. L'affirmation n'était pas mensongère — elle était vraie **sur une branche non fusionnée**, et le rapport ne le disait pas. Le même rapport citait D80, D81 et D82 : trois arbitrages qui n'ont jamais été écrits nulle part.

  **Ce qui rend la faute structurelle : un artefact construit a un LIEU, et ce lieu est un commit.** Une branche, un répertoire de travail, une session ouverte sont des lieux qui n'existent que pour celui qui les regarde ; `main` est le seul lieu que le destinataire d'un rapport puisse ouvrir. **« Six écrans existent » sans empreinte est une assertion ; avec l'empreinte du commit sur `main`, c'est une mesure** — et la différence n'est pas la sincérité de celui qui écrit, elle est la possibilité pour l'autre de constater.

  **La règle, et elle est mécanique : toute ligne d'un rapport qui affirme l'existence, l'état ou le vert d'un artefact construit nomme l'empreinte du commit sur `main` où elle se vérifie.** Une chose vraie ailleurs que sur `main` se dit avec son lieu — « sur la branche X, non fusionnée » — ou ne se dit pas. Corollaire de rangement, du même bois que le 06/09 : *une ligne qui ne peut pas être ouverte par son lecteur n'est pas présentée à côté de celles qui le peuvent.*

- **10/09/2026 — DEUX CÔTÉS D'UNE COMPARAISON PEUVENT PERDRE LA VUE ENSEMBLE, ET LEUR ACCORD DEVIENT ALORS MAXIMAL.** Le §9 tient depuis le 01/09 le remède aux deux lectures d'un même critère : *les faire répondre l'une à côté de l'autre sur la population réelle.* Voici ce que ce remède ne couvre pas — et c'est le contrôle de la base hébergée, le seul qui la regarde, qui l'a montré.

  L'inventaire compte sous une identité exemptée des politiques ; le contrôle relit sous le rôle applicatif et se confronte à lui. **Deux implémentations distinctes, deux rôles distincts, une confrontation écrite exprès — et une seule population, tenue à la main.** Chaque ticket ajoutait sa table à `TABLES_CLOISONNEES` sans écrire son compteur, des deux côtés. *Mesuré : la cécité naît au commit `97e8f95` le 07/09 à 01:28 UTC et se referme au commit `52173a1` le 09/09 à 22:48 UTC — **2 jours 21 h**, **14 tables sur 21** comptant zéro des deux côtés, dont `site`, `machine` et `intervention`.* La comparaison était parfaite. Elle portait sur rien.

  **Ce qui rend la faute structurelle : deux erreurs identiques ne se contredisent jamais.** Une confrontation ne mesure que ce sur quoi les deux termes DIVERGENT ; là où ils s'accordent en aveugle, elle certifie. *Zéro contre zéro n'est pas un résultat : c'est une absence de mesure, et elle a exactement la forme du succès* — même famille que le silence du 31/08 et que le chiffre attendu présenté parmi les observations (06/09).

  **La question à poser à toute comparaison : d'où vient la POPULATION de chacun des deux côtés ? Si c'est la même liste, la confrontation ne garde rien** — elle garde les valeurs, pas les clés. La parade est celle de D41 et de D55, un cran plus haut : **la population se DÉRIVE d'une source qu'aucun des deux côtés ne contrôle**, ici `prisma/schema.prisma`, et toute table qui n'y trouve pas son rang fait rougir le jour de sa création. Voir `docs/decisions/2026-09-10-population-de-l-inventaire-derivee-du-schema.md`.

  *Corollaire de rapport, et il vaut sans attendre la réparation :* une comparaison dont les deux côtés sont vides **sur une table** n'est ni un écart ni une preuve — `forfait` naît vide par décision. Elle est **nommée** et retranchée de ce que le rapport affirme. Ce qui a coûté deux jours n'est pas le zéro : c'est la phrase « exactement les lignes de chaque société sous son contexte », vraie de sept tables et imprimée pour vingt et une.

- **13/09/2026 — UNE CONSIGNE MESURÉE FAUSSE SE REFUSE, ET LE REFUS SE MOTIVE.** L'exploitation avait demandé que le lot 8 livre le stockage derrière une interface avec une implémentation locale. La réponse a été un refus : *c'eût été une interface sans appelant*, la maladie même que le portail venait de soigner — une politique juste que personne n'appelle, et qui dort jusqu'au jour où quelqu'un la découvre fausse. **L'exploitation a ratifié le refus et écrit que sa consigne était mauvaise.** La règle qui en sort n'est pas « discuter les consignes » : c'est que **la mesure prime sur l'origine de la demande**, et qu'un refus se paye en une phrase qui dit ce qui a été mesuré. Un refus sans motif est une désobéissance ; un refus motivé est le seul canal par lequel une consigne se corrige. *Corollaire, écrit le même jour : la numérotation des décisions appartient à celui qui les écrit — une consigne qui porte un numéro se lit pour son contenu, et le numéro se réattribue.*

- **10/09/2026 — UNE CAUSE ÉCRITE DANS UN GABARIT SE RÉPÈTE À CHAQUE ALARME, ET ELLE N'A JAMAIS ÉTÉ MESURÉE UNE SEULE FOIS.** Espèce à ranger à côté du chiffre attendu présenté parmi les observations (06/09) : le rapport ne se trompe pas de fait, il se trompe de **cause** — et il le fait avec l'aplomb d'une phrase préécrite.

  Le ticket ouvert par une veille rouge porte, en toutes lettres : *« Ces écarts ne viennent d'aucune migration — ce sont des gestes passés à la main sur la base. »* Or **la veille observe la base et rien d'autre** : elle ne compare jamais `_prisma_migrations` au répertoire `prisma/migrations/` du dépôt, et **ne peut donc pas savoir d'où vient un écart**. *Mesuré sur l'exécution `34493977325` du 10/09 : l'unique écart rapporté — `utilisateur_client` sans la forme « rattachement » — est **exactement** le contenu de `20260911010000_rattachement_portail_d92`, jamais appliquée ; quatre migrations étaient en retard, le dernier `db-migrate` réussi remontant au 09/09 à 22:55 UTC.* Le ticket a fait chercher un geste manuel qui n'existait pas, et il a coûté une journée.

  **Ce qui rend l'espèce plus coûteuse que l'affirmation ordinaire du 07/09 : elle est dans un GABARIT.** Une phrase dite une fois se corrige au premier regard ; une phrase préécrite se **réémet à chaque alarme**, avec la même assurance, longtemps après que son auteur a oublié l'avoir écrite. Et elle sera lue par quelqu'un qui n'a ni le contexte ni le dépôt sous les yeux — c'est même tout l'objet d'une alarme.

  **La règle : un gabarit d'alarme ne nomme une cause que si le contrôle qui le déclenche a MESURÉ cette cause.** Sinon il décrit ce qu'il a observé et **s'arrête là**. La question à poser à chaque phrase d'un gabarit : *quelle observation la rendrait fausse ?* Si la réponse est « aucune, elle est toujours imprimée », ce n'est pas un constat — c'est une opinion que le dispositif répète en votre nom. *Parenté exacte avec le 06/09, un cran plus haut : là, une ligne qui ne peut pas bouger sous une faute était présentée parmi les observations ; ici, c'est une CAUSE qui ne peut pas bouger.* La réparation est portée à la file (R1-01) plutôt que faite en passant : elle change ce que le dispositif de sécurité dit de lui-même, et cela ne se glisse pas dans un ticket d'automatisation.

- **19/08/2026 — Le gardien `tests/isolation/` est PROVISOIRE depuis L0-02.** Il vérifie que le répertoire s'exécute, pas le cloisonnement. Un `test:isolation` vert ne signifie rien tant que L0-05 n'est pas livré. L0-05 REMPLACE ce test provisoire, il ne s'y ajoute pas.
