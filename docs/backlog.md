# CODIPLAN — Backlog exécutable

**Tickets des lots 0 à 3 — chemin critique jusqu'à la mise en service terrain**

*Version 3 — intègre les notes d'arbitrage n°1 et n°2. Les tickets modifiés par un arbitrage portent la référence `[Dxx]`.*

Format : `[identifiant] but — critères d'acceptation`. Chaque critère doit être vérifiable par une machine.
Source de la règle métier : **chapitre 10 du cahier des charges**, complété par `docs/arbitrages.md` qui prévaut.

---

## La file de nuit — comment ce document se lit à la machine

**Ce document est la FILE que lit la session nocturne** *(posé le 10/09/2026)*. « Le premier travail non bloqué » devait être une **lecture** et non une interprétation : chaque ticket porte donc, sur la ligne qui suit immédiatement son titre, un marqueur d'état, et une commande le lit.

```bash
pnpm file      # nomme le premier travail non bloqué, et dit pourquoi les précédents sont écartés
```

| Marqueur | Sens |
|---|---|
| `*File :* LIBRE` | à prendre — le premier dans l'ordre de ce document |
| `*File :* LIVRÉ` | fait ; on passe au suivant |
| `*File :* BLOQUÉ — <motif>` | **motif obligatoire et non vide** : par quoi, en une ligne |

Un ticket sans marqueur, ou un `BLOQUÉ` sans motif, fait échouer `pnpm verify` — `tests/unit/docs/file-de-nuit.test.ts`. *Une file dont un élément n'a pas d'état n'est pas une file, c'est une liste de vœux.*

**LE SENS DE DÉFAILLANCE EST CHOISI, ET IL EST ÉCRIT.** La marque `LIVRÉ` ne se pose que sur **preuve** ; dans le doute on laisse `LIBRE`. Les deux fautes ne coûtent pas la même chose : *un travail repris à tort se referme en cinq minutes — la session ouvre le ticket, constate que le code existe, marque `LIVRÉ` et passe ; un travail sauté à tort ne revient jamais, parce que rien ne le réclame.*

**D'où viennent les 83 marques posées le 10/09/2026 :** de la mesure, jamais de la mémoire — la prose du ticket quand elle porte « LIVRÉ », l'existence du module dans `lib/`, et l'existence de la table dans la base hébergée telle que la veille l'énumère. Tout le reste est `LIBRE`.

**Un écart relevé en les posant, inscrit plutôt que corrigé en silence :** **L2-07 se disait `BLOQUÉ` sur un arbitrage de cloisonnement, et il est livré.** `lib/interventions/cycle-de-vie.ts`, la table `intervention` et sa contrainte `intervention_cycle_de_vie` existent ; l'arbitrage a été rendu par D84, qui donne à la table la forme « parc ». La prose de blocage datait du 11/09 et personne n'était revenu la retirer — *exactement ce qu'un marqueur lisible à la machine existe pour empêcher.* Le paragraphe reste écrit sous le marqueur : ce qui a été décidé un jour se relit.

---

---

## Lot 0 — Socle (3 semaines)

**L0-01 — Initialiser le dépôt.**
*File :* LIVRÉ
Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui, ESLint, Prettier, pnpm.
*Acceptation :* `pnpm build` et `pnpm typecheck` passent ; la page d'accueil affiche « CODIPLAN ».

**L0-02 — Chaîne de vérification. [D14]**
*File :* LIVRÉ
Vitest, Playwright, et **deux portes distinctes** :
`pnpm verify` = ~~typecheck + lint + test + test:isolation + build~~ **format:check + typecheck + lint + test + test:isolation + build** — porte de chaque ticket *(`format:check` y est entré le 02/09/2026 — la CI le jouait à part, et un `verify` vert pouvait être rouge en CI ; D14 marquée le 10/09, l'incident **numéroté D78** le 11/09)*.
`pnpm verify:full` = verify + test:e2e — porte de chaque lot.
CI **GitHub Actions** : `verify` à chaque commit, `verify:full` sur `main` et chaque nuit.
*Acceptation :* les deux commandes passent ; un test volontairement faux fait échouer la commande et la CI.
*Relu contre les sources citées le 11/09/2026 — empreinte `b8b84049`.*
**L0-03 — Schéma multi-société. [D4] [D5]**
*File :* LIVRÉ
Tables `societe`, `agence`, `devise`, `parite`, `utilisateur`, `utilisateur_societe`, `utilisateur_client`.
`agence` est nouvelle (D5) : code, libellé, adresse, fuseau, calendrier, actif.
`parite` remplace `devise.parite_reference` (D20) : devise, date d'effet, taux, source.
`utilisateur_client` (D10) : utilisateur, client, société, ~~périmètre de sites~~ *(le périmètre est devenu la table `utilisateur_client_site` à L1-02b — PostgreSQL ne sait pas contraindre les éléments d'un tableau ; D10 marquée le 10/09/2026, l'amendement **numéroté D79** le 11/09/2026)*.
*Acceptation :* migration appliquée ; `pnpm db:seed` crée deux sociétés — CODIMA-NC en XPF avec ses trois agences (Ducos, Koné, Dolbeau) et CODIMA-EU en EUR avec son unique agence (Siège) —, soit **quatre agences au total**, et au moins un compte portail rattaché à un client.
> Le critère « migration appliquée / seed exécuté » est validé par le déclenchement **manuel** du workflow `.github/workflows/db-migrate.yml`, **et non depuis une session cloud** : le proxy sortant de l'environnement cloud ne relaie pas le TCP, la base Neon y est donc injoignable (P1001). Voir `docs/decisions/2026-08-20-migration-par-github-actions.md`.
*Relu contre les sources citées le 09/09/2026 — empreinte `967dc212`.*
**L0-04 — Politiques RLS. [D4]**
*File :* LIVRÉ
Sécurité au niveau des lignes sur toutes les tables portant `societe_id`, pilotée par une variable de session.
~~Forme imposée : `societe_id = current_setting('app.societe_id')::uuid OR societe_id IS NULL`.~~
> **CORRIGÉ le 31/08/2026 (ticket R0-a, écart É9 de la revue R0).** Cette phrase était **le texte de ticket le plus dangereux des trois lots** : elle énonce « la forme imposée » au singulier alors qu'il en existe **cinq**, et la recopier sur `client`, `site` ou `modele_materiel` écrit une politique fausse **dans le sens permissif — en obéissant**. Les cinq formes, leur cas d'emploi et la table qui les porte sont désormais **au CLAUDE.md, au pied de I1** ; celle qui ne s'applique jamais à une table métier ordinaire y est nommée (« référentiel »), avec la raison. La branche `OR societe_id IS NULL` est un **vestige inerte** sur une colonne `NOT NULL`, jamais une licence. Un gardien mesure la forme dans `pg_policies` — `tests/isolation/politiques-rls.test.ts` et `scripts/controle-cloisonnement.mts`.
*Acceptation :* une requête sans société positionnée retourne **zéro ligne sur les tables cloisonnées**, et **uniquement les référentiels de plateforme** sur les tables partagées — ~~`devise`, `famille_materiel`, `modele_materiel`, `checklist_modele`~~ **`devise`, `parite`, `jour_ferie`** *(D4 amendé le 08/09/2026 : les trois tables de matériel sont devenues des tables métier cloisonnées, le mécanisme « référentiel + copie masquante » se contredisait)*.
*Relu contre les sources citées le 08/09/2026 — empreinte `b4688e11`.*
**L0-05 — Tests d'isolation. [D22]**
*File :* LIVRÉ
Répertoire `tests/isolation/`. Pour chaque ressource : lecture, écriture et suppression tentées depuis une autre société.
Inclut obligatoirement : le chemin **`GET /machines/qr/{token}`**, qui doit refuser un jeton appartenant à une autre société ; l'accès d'un compte portail aux données d'un autre client ; le respect du périmètre de sites.
*Acceptation :* au moins 12 scénarios, tous verts. **Vérification manuelle documentée** dans `docs/decisions/` : retirer un filtre société fait échouer les tests.
*Relu contre les sources citées le 01/09/2026 — empreinte `75515868`.*
**L0-06 — Authentification et rôles. [D21]**
*File :* LIVRÉ
Better Auth, sessions serveur, MFA sur `admin_plateforme` et `direction`.
Énumération canonique des rôles, complète dès maintenant : `admin_plateforme`, `editeur_commercial`, `editeur_support`, **`admin_societe`** [D37], `direction`, `responsable_materiel`, `responsable_sav`, `adv`, `technicien`, `client` — **dix rôles**.
Rôle PostgreSQL `codiplan_reporting` avec `BYPASSRLS`, en `SELECT` seul, réservé à `lib/reporting`. **La journalisation de ses requêtes est écrite par l'APPLICATION, sur sa propre connexion, avant la consolidation** (D21 précisée le 10/09/2026) : un rôle en `SELECT` seul ne peut pas écrire un journal, et un scénario mesure qu'il en est refusé.
*Acceptation :* un utilisateur habilité sur A ne peut pas basculer sur B ; tout changement de société active est journalisé ; un test vérifie qu'aucun chemin hors `lib/reporting` n'utilise la connexion `codiplan_reporting`.
*Relu contre les sources citées le 10/09/2026 — empreinte `3c01a3aa`.*
**L0-06b — Arbitrages consécutifs à L0-06. [D34] [D35] [D36] [D37] [D38] [D39] [D40] [D41]**
*File :* LIVRÉ
Troisième catégorie de I1 — **tables techniques d'authentification**, liste close : `session`, `compte`, `verification`, `journal_acces` [D34].
`journal_acces.societe_id_source` et `societe_id_cible`, informatives et nullables : elles répondent à « qui a tenté d'accéder à mes données », jamais à un filtre.
Identités globales, habilitations par société ; **réponses d'authentification indiscernables** — compte inexistant, mot de passe faux, compte sans habilitation [D35].
Dixième rôle `admin_societe`, colonne « Admin » du §5.2 scindée [D37].
Mot de passe de `codiplan_reporting` dans `REPORTING_DATABASE_URL` seulement, et contrôle permanent de ses privilèges [D38].
`second_facteur` rejoint les tables techniques d'authentification ; `utilisateur` reçoit la **quatrième catégorie** de I1, à elle seule, et ne porte **aucune donnée métier** [D39].
Second facteur obligatoire étendu à `admin_societe` — `admin_plateforme`, `admin_societe`, `direction` [D40], règle produit **RG-DRO-05**.
`parite` rejoint les référentiels de plateforme, et surtout : **gardien d'exhaustivité** des catégories de I1, qui part du schéma et non des listes [D41].
*Acceptation :* un test prouve qu'aucune requête applicative ne filtre sur `societe_id_source` ni `societe_id_cible` ; un test prouve que les trois refus rendent le même message et répondent dans le même ordre de grandeur de temps ; le contrôle de cloisonnement échoue si `codiplan_reporting` détient un privilège autre que `SELECT`, lu dans `information_schema.role_table_grants` ; les scénarios positifs et négatifs couvrent les dix rôles ; un gardien statique échoue si une colonne s'ajoute à `utilisateur` hors de sa liste close ; tout rôle capable d'administrer des utilisateurs exige un second facteur ; **toute table de `prisma/schema.prisma` appartient à exactement une catégorie de I1** — zéro comme deux font échouer la vérification.
*Relu contre les sources citées le 11/09/2026 — empreinte `fb44a35c`.*
**L0-06c — `societe`, quatrième catégorie de cas. [D42]**
*File :* LIVRÉ
Rédaction de la **première catégorie de I1** : `societe` fait exception à la forme, non au fond — étant la table que `societe_id` désigne, elle est cloisonnée par son identité (`id = app.societe_id`) [D42].
Rien n'était ouvert : la politique existait depuis L0-04, `force-rls.test.ts` l'éprouvait, l'inventaire comptait `societe` parmi les tables cloisonnées. C'est la phrase de l'invariant qui était incomplète.
L'exception est **nommée** (`CLOISONNEE_PAR_IDENTITE`) plutôt que la règle élargie, et elle devient une **liste close de plus**, gardée comme les trois autres.
Inscrit au CLAUDE.md : toute autre table métier porte `societe_id NOT NULL` ou passe par un arbitrage — **c'est l'objectif des lots 1 à 3, pas une friction à contourner**.
Trois arbitrages relevés à la revue de cette livraison [D43] [D44] [D45] : le symbole du XPF reste `XPF` et la question part au registre avec son déclencheur ; **D19 est amendé** — la conversion vit dans `lib/reporting` ; l'arrondi au quart d'heure est rangé en L2-09.
*Acceptation :* le gardien d'exhaustivité de D41 ne relève plus aucune table hors catégorie ; le gardien de la liste d'exceptions **échoue sur toute entrée autre que `societe`** comme sur son retrait, avec le message « toute addition passe par un arbitrage, elle ne se décide pas dans un ticket », et il est éprouvé sur une addition fabriquée et sur une liste vidée.
*Relu contre les sources citées le 10/09/2026 — empreinte `284f1870`.*
**L0-07 — Module monétaire. [D19]**
*File :* LIVRÉ
`lib/money` : `formatMoney(montant, devise)` — symbole si la devise en a un, code sinon.
`lib/reporting` : `convertForConsolidation(montant, source, cible, dateParite)`, exigeant une date de parité explicite. **La conversion vit dans `lib/reporting`, jamais dans `lib/money`** [D44] — D19 disait `lib/money` contre I2, le §6 et ce ticket ; il est amendé, pas contourné.
L'arrondi au quart d'heure **ne fait pas partie de ce ticket** : c'est une politique de facturation, elle est rangée en L2-09 [D45].
*Acceptation :* `7 000 XPF` sans décimale [D19] [D43], `100,00 €` avec deux ; un appel à `convertForConsolidation` hors de `lib/reporting` fait échouer un test.
*Relu contre les sources citées le 10/09/2026 — empreinte `a773ee6b`.*
**L0-08 — Module calendrier. [D5] [D13] [D46] [D47]**
*File :* LIVRÉ
`lib/calendar` : calendriers rattachés à l'**agence**, jours fériés **portés par un référentiel territorial** `jour_ferie` (D46) et surchargeables par agence via le booléen `travaille`, calcul des jours et heures ouvrés. Fuseau IANA porté par l'agence, instants en `timestamptz`, récurrences stockées sous forme de règle locale et déroulées à la lecture.
Fonctions distinctes par usage : SLA (agence de l'intervention), majoration (agence du technicien), conflit à la pose (calendrier du technicien).
*Acceptation :* le samedi est ouvré pour Ducos et non pour Koné ; un férié marqué travaillé compte comme ouvré ; un délai SLA de 4 h ouvrées démarré vendredi 16 h échoit lundi.
*Relu contre les sources citées le 10/09/2026 — empreinte `60cb9b05`.*
**L0-09a — Le territoire d'un jour férié référencé. [D48] [D49]**
*File :* LIVRÉ
Fermeture du point que L0-08 avait soumis sans le trancher : un écart local pouvait s'adosser au férié d'un **autre territoire**. Fermé **en base**, par chaînage de clés composites — `agence` gagne un `UNIQUE (id, territoire)`, `calendrier_ferie` une colonne `territoire` liée à l'agence par `(agence_id, territoire)` et au fait public par `(jour_ferie_id, date, territoire)`.
**`agence.territoire` devient `NOT NULL`** : une clé étrangère dont une colonne vaut NULL n'est pas contrôlée en PostgreSQL, le verrou aurait été muet là où la donnée manque. La migration **refuse de s'appliquer** sur une base portant une agence sans territoire, en la nommant — jamais de valeur inventée.
La colonne `territoire` de `calendrier_ferie` est une **redondance assumée** : elle rend la contrainte déclarative, c'est le prix du verrou [D48].
**Aucune propagation** [D49] : `ON UPDATE RESTRICT` des deux côtés. Changer le territoire d'une agence est **refusé** tant qu'il lui reste un écart — `CASCADE`, mesuré en base, réécrivait les écarts **en silence** sur une agence n'ayant que des ponts. Un déclencheur double le refus d'un message qui donne la **marche à suivre** ; retiré, la clé refuse encore.
*Acceptation :* un écart adossé au férié d'un autre territoire est refusé par la base, dans les deux sens (en faisant concorder l'écart avec le fait public, c'est la clé vers l'agence qui mord) ; le **pont** — `jour_ferie_id` nul — reste possible ; une agence sans territoire est refusée ; **chaque refus est éprouvé en retirant réellement la contrainte**, dans une transaction annulée qui rejoue à chaque `pnpm verify` (forme désormais attendue de tout test de refus, §9 du CLAUDE.md) ; changer le territoire d'une agence est refusé tant qu'un écart subsiste, avec un message qui **dit quoi faire** — et le scénario échoue si quelqu'un raccourcit ce message.
*Relu contre les sources citées le 01/09/2026 — empreinte `9b249a44`.*
**L0-09 — Thématisation par société. [D51]**
*File :* LIVRÉ
Nom d'affichage, couleur d'identité et couleur d'accentuation issus du paramétrage de la société active — jamais de l'agence : les agences partagent l'identité de leur société. Six variables CSS posées **côté serveur** depuis la société active de la session ; aucun fichier de style propre à une société, aucun nom de société dans le code. Une société sans charte reçoit le **thème neutre CODIPLAN**, défini une fois et identifié comme LE défaut — les deux colonnes de couleur deviennent nullables pour que « sans charte » soit un état représentable.
**Lisibilité tranchée par le calcul, pas par un refus** [D51] : l'encre posée sur une couleur de société est choisie entre le noir et le blanc, ce qui garantit **√21 ≈ 4,58:1** sur n'importe quel fond sRGB, au-dessus du seuil **4,5:1** de WCAG 2.1 (critère 1.4.3, niveau AA, texte courant ; 3:1 pour le grand texte et le non-textuel, critères 1.4.3 et 1.4.11). Le seul refus à la saisie porte sur la FORME — ce qui n'est pas une couleur sRGB —, jamais sur la teinte.
**Logo hors périmètre**, inscrit au registre : il suppose un stockage de fichiers, décision d'architecture à part entière. `societe.logo_url` existe déjà et le mécanisme ne l'empêche pas.
*Acceptation :* basculer de société change l'identité visuelle sans redéploiement — éprouvé en base sur deux sociétés aux chartes distinctes, sous le rôle applicatif restreint ; une session active sur A n'obtient pas la charte de B même en demandant son identifiant, et le portail affiche la charte de la société qui le sert ; les cas extrêmes du contraste — très clair, très sombre, saturé — sont couverts, et le plancher 4,5826 est retrouvé par balayage exhaustif du cube sRGB ; le refus de forme est éprouvé **par retrait** de la contrainte, dans une transaction annulée ; le gardien « aucun littéral de couleur » est éprouvé sur les six formes du §9 **et sur trois violations réellement écrites** dans les fichiers où la faute se commettrait.
*Relu contre les sources citées le 01/09/2026 — empreinte `d2ffc22d`.*
**L0-10 — Journal d'audit. [D32] [D52] [D53] [D55]**
*File :* LIVRÉ
**Trigger PostgreSQL**, pas un intercepteur applicatif. Droits `UPDATE` et `DELETE` révoqués sur `journal_audit` pour le rôle applicatif.
Périmètre **INVERSÉ** [D55] : toute table métier cloisonnée est auditée par défaut, moins des exemptions écrites et justifiées — il n'y en a aucune aujourd'hui. Le journal lui-même est **hors du domaine**, et non exempté : un gardien ne peut pas se garder lui-même. Ce retrait est payé par l'**inaltérabilité**, éprouvée par TENTATIVE d'`UPDATE` et de `DELETE` sur la table mère et sur chaque partition. La **fonction** de création empêche l'oubli, le **détectif** rattrape la main — et ce détectif tourne désormais chaque nuit sur la base réelle (`pnpm veille`), plus seulement quand quelqu'un migre. La règle et ses exemptions vivent une seule fois dans `scripts/lib/perimetre-audit.ts` [D53] — ni ici, ni au CLAUDE.md, ni au chapitre 10, qui y renvoient tous les trois. D32 l'énonçait en **notions**, D52 en **liste close de tables** ; ces deux rédactions sont périmées. Plus les accès des rôles éditeur (L7-03) et les basculements de société.
*Acceptation :* toute écriture sur une table sensible produit une ligne d'audit ; une tentative de suppression d'une ligne d'audit échoue au niveau de la base.
*Relu contre les sources citées le 10/09/2026 — empreinte `1304dcce`.*
**L0-11 — Vocabulaire français centralisé. [D26] [D5] [D47]**
*File :* LIVRÉ
`lib/i18n/fr.ts`, dictionnaire plat, **source unique** de tout ce qu'un utilisateur lit. Aucune chaîne visible en dur — ni dans un composant, ni dans un attribut lu par un lecteur d'écran, ni dans les `metadata`, ni dans le texte attendu par un test de rendu.
**La coupure est écrite une fois**, en tête du dictionnaire : ce qu'un humain lit en se servant de l'application y passe ; ce qu'un développeur ou une machine lit — gardien, exception technique, trace, migration — n'y passe pas. Même famille que « documentation contre exécution » de D50 : c'est la destination du texte qui décide, jamais le fichier.
**Le vocabulaire imposé y a son domicile** : « agence » et « site » sont définis sous les clés `vocabulaire.*`, avec leur pluriel et une définition qui nomme ce que la notion n'est pas. Le code nomme la notion — `mot("agence")` —, jamais le mot. C'est la leçon de D47 rendue mécanique.
**Ce qui décide qu'un fichier est concerné se DÉDUIT** — trois marques : il contient du JSX, il exporte des `metadata`, il interroge l'écran. Le gardien part du dépôt entier, pas d'une liste de répertoires qu'un ticket ultérieur aurait oublié de compléter : c'est le renversement de D41 appliqué aux fichiers.
*Acceptation :* la règle ESLint `react/jsx-no-literals` signale toute chaîne littérale dans le JSX — elle est **l'écho** de la règle dans l'éditeur, et le gardien `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` en est la portée réelle ; il est éprouvé sur les six formes du §9, dont les trois que le ticket nomme — chaîne dans un attribut, chaîne concaténée, texte d'un test de rendu — et sur huit greffes faites dans les **fichiers réels** où la faute se commettrait ; il échoue si l'une des trois marques ne reconnaît aucun fichier réel du dépôt ; ses limites sont annoncées, dont celle qu'il ne peut pas tenir — une chaîne qui arrive à l'écran par une variable venue d'un module.
**Hors périmètre, au registre :** un client acheteur voudra peut-être son propre vocabulaire — « atelier » plutôt qu'« agence ». Le dispositif ne l'empêche pas (le code nomme la notion) ; il n'est pas construit.
*Relu contre les sources citées le 01/09/2026 — empreinte `1c57df06`.*
---

## Lot 1 — Référentiels, tarification, imports (4 semaines)

> **AVANT L1-01, L1-02, L1-05 et L2-01 — le CONTRAT des fixtures d'isolation.** *(ticket R0-a, écart É14)* `client`, `site`, `machine` et `modele_materiel` existent déjà comme **tables fixtures** du harnais `tests/isolation/`, avec leurs politiques. Le jour où la vraie table est créée, le harnais **cesse de la fabriquer et la laisse en place** — il l'annonce sur sa sortie et dit ce qui reste dû. Ce qui reste dû : la migration pose la forme **« parc »** (société **ET** `app.client_id` **ET** `app.perimetre_sites`, D10/D22) sur `client`, `site` et `machine`, **et non** la clause société seule ; les scénarios de L0-05 se **reportent** sur la vraie table au lieu de partir avec la fixture. Trois gardiens le tiennent et refusent la réduction : la forme mesurée dans `pg_policies`, la liste close `TABLES_PARC`, et le plancher de `EXIGENCES_L0_05`. Voir `tests/isolation/setup/contrat.ts` et le pied de I1 au CLAUDE.md.

**L1-01** Clients — CRUD, **`code_externe`** [D29] avec libellé paramétrable par société, recherche. Forme de politique : **parc** (D10, D22), jamais la clause société seule.
*File :* LIVRÉ
*Relu contre les sources citées le 11/09/2026 — empreinte `bc023258`.*
**L1-02** Sites — adresses, zones géographiques (`grand_noumea`, `sud`, `cote_est`, `cote_ouest`, `nord`, `iles`) [D23], horaires, **agence de rattachement** et `temps_trajet_min` qui **fait foi** sur l'estimation par zone. ~~`temps_trajet_min` **par agence**~~ [D56] : cette formule se lisait « une valeur par couple (site, agence) », et ce n'est pas ce qu'elle voulait dire. Un site dépend d'une **agence et d'une seule**, toujours la même ; `temps_trajet_min` est un **scalaire**, et c'est le trajet **depuis l'agence de rattachement du site**. Le site nomme donc son agence (`site.agence_id`, obligatoire), et le nombre perd son sens si ce rattachement change sans être revu — la base le refuse. Forme de politique : **parc**, filtre de périmètre de sites compris.
*File :* LIVRÉ
*Relu contre les sources citées le 10/09/2026 — empreinte `9cce9327`.*
**L1-02b** Normaliser `utilisateur_client.perimetre_sites` en table de jointure. **[D10] [D79]**
*File :* LIVRÉ
Arbitrage du 07/09/2026, issu de L1-02, **numéroté D79 le 11/09/2026** — l'amendement qu'il porte est de rang 1, et un ticket n'a pas de numéro de décision : des trois voies possibles, une seule met la garantie là où elle ne rouille pas. PostgreSQL 16 ne sait pas contraindre les ÉLÉMENTS d'un tableau — mesuré sur les trois formes déclaratives —, et un couple de déclencheurs serait une clé étrangère écrite à la main. La table de jointure porte une **vraie** clé étrangère, composite comme les autres.
Deux exigences, et la seconde est une contrainte de forme : la lecture du périmètre doit **voyager avec les instructions qui posent déjà le contexte** plutôt qu'ajouter un aller-retour — `set_config` accepte une sous-requête, `lib/db/rls.ts` en pose déjà quatre — et l'aller-retour ajouté doit être **mesuré**, pas estimé (leçon du 23/08 : à 190 ms vers Sydney, un aller-retour se calcule) ; et `app.perimetre_sites` reste **exactement** la forme que lisent les politiques — la normalisation change d'où vient la valeur, jamais ce que voient les politiques. **Aucune des cinq formes ne bouge.**
*Acceptation :* la clé étrangère refuse un périmètre désignant un site inexistant ou d'une autre société, éprouvée par retrait ; le nombre d'allers-retours de `lib/db/rls.ts` est inchangé, et un test le compte ; les scénarios de périmètre de L0-05 restent au moins aussi nombreux.
*Relu contre les sources citées le 11/09/2026 — empreinte `99a39e5c`.*

> **L1-02b NE PART PAS SEUL : il voyage avec l'arbitrage sur la forme de politique de `utilisateur_client`.** *(mesure du 07/09/2026, base jetable locale, rôle `codiplan_app`)*
>
> Ce qui a été mesuré, et rien de plus — la forme de la clause n'est pas tranchée ici. `utilisateur_client` porte aujourd'hui la forme **société** (`societe_id = app.societe_id`, lue dans `pg_policies`). Sous un compte portail du client A1 de la société A, avec le contexte que pose réellement `lib/db/rls.ts` : **oui**, il lit les lignes d'habilitation des comptes d'un AUTRE client de sa société ; **oui**, la jointure sur `utilisateur` rend leurs `nom` et `email` — `utilisateur` ne porte aucune sécurité au niveau des lignes (`relrowsecurity = false`, mesuré), son cloisonnement est entièrement applicatif ; **oui**, `DISTINCT client_id` énumère par là les autres clients de la société. Le cloisonnement **société** tient (zéro ligne de la société B) : ce qui fuit est le carnet de clients d'UNE société, pas l'inter-société.
>
> **Pourquoi les deux tickets ne se séparent pas.** La table de jointure que L1-02b crée porte le périmètre d'un compte portail : elle recevra **la forme que l'arbitrage aura décidée pour `utilisateur_client`**, sans quoi on écrit deux fois la même clause à corriger. Et les deux atterrissent dans le même fichier — `lib/db/rls.ts`, qui pose le contexte que les politiques lisent.
>
> **Deux constats de contexte, mesurés au passage.** `app.utilisateur_id` **existe** : `lib/db/rls.ts` le pose depuis L0-10 (avec `app.adresse_ip`), mais **aucune politique ne le lit** — seul le déclencheur d'audit s'en sert. En revanche `app.client_id` et `app.perimetre_sites` ne sont **posés par aucun chemin de production** : seul le harnais `tests/isolation/setup/db.ts` les pose. Conséquence mesurée : sous le contexte que `lib/db/rls.ts` pose aujourd'hui, la forme **parc** de `client` et de `site` tombe dans sa branche « utilisateur interne » et ouvre tout le parc de la société. Aucun chemin portail n'existe encore (`app/(portail)/` est *(prévu)*), donc rien n'est ouvert en exploitation — mais ce trou est sur le chemin de L1-02b, pas à côté. Voir RG-DRO-01.


**L1-02c** Cloisonner les IDENTITÉS par la base. **[D39]**
*File :* LIVRÉ
Arbitrage du 07/09/2026 : *les identités doivent être cloisonnées par la base, pas seulement par l'application. Une garantie qui ne vit que dans la couche applicative n'en est pas une.* Cela déplace `utilisateur` hors de la QUATRIÈME catégorie de I1 — changement de rang constitutionnel, donc arbitrage explicite.
**La forme est DÉDUITE et MESURÉE, elle n'est pas proposée ici.** `utilisateur` ne porte pas de `societe_id` et ne doit pas en porter : RG-SOC-03 autorise un utilisateur habilité sur plusieurs sociétés. Aucune des six formes en vigueur ne s'applique. La seule clause possible est un **rattachement** — une identité est visible si la société active a une habilitation sur elle —, dont les deux sous-requêtes (`utilisateur_societe`, `utilisateur_client`) sont elles-mêmes soumises aux politiques et se recomposent au lieu d'être recopiées.
**LIVRÉ le 07/09/2026.** La demande avait été REFORMULÉE par l'exploitation, et la reformulation était la clé : « cloisonner les identités par la société » demandait à la mauvaise couche de répondre à la mauvaise question, **l'authentification PRÉCÉDANT la société**. Deux lectures étaient confondues — la **vérification d'identifiants**, qui porte déjà en entrée la seule ligne qu'elle a le droit de voir, et la **lecture d'identités**, opération de locataire.
`utilisateur` porte donc les deux drapeaux RLS et **trois** politiques : lecture (forme « **désignation** » **ou** rattachement à la société active), **ouverture** et **modification**. Elle reste une catégorie à elle seule dans I1 — son régime de conservation n'est pas celui des tables techniques — mais elle n'est plus « sans RLS ».
*Les trois mesures demandées avant arbitrage, jouées sous témoin préalable :* **(1) la borne tient** — variable nommant un courriel : 1 ligne, exactement celle-là ; une autre nommément : 0 ; par identifiant : 0 ; balayage `LIKE` : 1 ; variable vide : 0 ; aucun contexte : 0. **(2) la variable ne survit pas** — `set_config(…, false)` persiste sur la connexion (danger réel, mesuré), `is_local => true` meurt au `COMMIT` comme au `ROLLBACK` ; l'adaptateur de Better Auth n'est **pas déformé**, une extension Prisma place chaque lecture dans sa propre transaction. **(3) l'indiscernabilité tient** — même message dans les deux refus, et ce que l'appelant observe est **inchangé**.
**Trois lectures de production ont dû être séparées**, et c'est la même classe à chaque fois : une relation imbriquée ou une lecture par identifiant qui ne désignait rien. `lib/auth/connexion.ts`, `lib/auth/societe-active.ts`, et le `RETURNING` d'un `INSERT` Prisma — **PostgreSQL soumet le `RETURNING` à la politique de LECTURE**, si bien qu'une création refusait alors que son `WITH CHECK` l'autorisait.
**L'INSCRIPTION EN LIBRE-SERVICE EST FERMÉE.** *Personne ne crée son propre compte, jamais, dans aucun mode* — un compte portail est délivré par CODIMA à un client, un compte interne est ouvert par l'administrateur de la société, et en mode éditeur par la console (lot 7). Ce n'est pas une restriction, c'est le métier. Le gestionnaire attrape-tout de Better Auth exposait `/sign-up/email` sans que personne l'ait décidé : la surface est refermée au plus près de l'extérieur, en 404 et non en 403 (D35 — un refus qui explique est un renseignement).
**Une règle générale en sort** : une politique qui n'énonce qu'un `USING` **légifère en silence sur les écritures**. Toute politique couvrant une écriture énonce son `WITH CHECK`, même quand il répète le `USING`. Gardée sur la base jetable et sur la base hébergée.
*Acceptation :* ce que voient un compte portail, un compte interne et un `admin_societe` est mesuré, sous **témoin préalable** — les deux drapeaux constatés, et zéro ligne sans contexte ; l'authentification est éprouvée sur le chemin réel de Better Auth ; la séquence complète — ouverture par un administrateur puis habilitation — est jouée ; la base et `lib/auth/habilitations.ts` répondent à l'identique **rôle par rôle** sur les dix rôles ; `TABLES_SANS_RLS` perd `utilisateur` et le gardien de `rls-declaree` le constate.
**Ce qui reste ouvert, et qui n'est pas de ce ticket :** l'ouverture par la **console éditeur** de la première identité d'une société cliente (lot 7) — un rôle éditeur n'a aucune société active, elle exigera sa propre branche ; et les chemins de **modification en libre-service** (enrôlement du second facteur, vérification d'adresse), qui n'ont aujourd'hui aucune branche et qu'aucun flux mesuré n'emprunte.

~~**Ne se fusionne pas seule**~~ — L1-02b est partie seule le 07/09/2026, l'exploitation étant revenue sur sa propre règle : elle visait à ce que l'ARBITRAGE soit pris d'un bloc, pas à ce que le code attende. Vérifié avant la fusion : rien n'était à moitié armé — six variables réclamées, six posées.
*Relu contre les sources citées le 11/09/2026 — empreinte `b88998a0`.*

**L1-02e** La POSE de la désignation, rendue gardable. **[D58] [D59]**
*File :* LIVRÉ
Demande d'exploitation du 08/09/2026, et sa formulation est la borne : *« ce qui tient n'est pas la clé, c'est qu'aucun chemin ne laisse choisir sa valeur »* — **mais un invariant qui repose sur ce qu'aucun ticket futur ne fera est un invariant qui tombera, et sans bruit.**
**La moitié gardable est la POSE, pas la valeur.** Les variables `app.authentification_*` ne se posent que depuis les fichiers qui **composent le contexte** — `lib/db/rls.ts`, qui les remet à vide, et `lib/auth/lecture-identite.ts`, qui les renseigne depuis le `where` de la requête. Jamais depuis un chemin de requête, jamais depuis une valeur venue de l'extérieur. Le cas que cela attrape est nommé : quelqu'un qui, dans six mois, posera la variable « juste pour ce cas ». Le reste — que la valeur soit dérivée d'un contexte authentifié — n'est pas décidable statiquement : il s'écrit dans la BORNE de la forme « désignation », à l'endroit où on la lit avant d'ajouter un chemin.
**Et la cause du `NULL` de `getSession` est ISOLÉE**, ce que D59 déclarait hors de portée. La passe a coûté vingt minutes : l'ancien module remis en place depuis l'historique, les cinq tables ramenées sans RLS, le défaut **reproduit**, la trace des opérations de client relevée, puis **une seule ligne** changée pour le faire disparaître. `getSession` émet deux opérations, et la seconde est `Utilisateur.findFirst { where: { id: { equals: … } } }` : l'enveloppe de L1-02c lisait la forme `{ equals }` **pour le courriel seul**, l'identifiant étant lu nu. La désignation partait vide, la politique refusait, Better Auth concluait « pas de session ». Même espèce que le `AND` du 08/09 — *le SQL est le même, c'est la forme de l'APPEL que le code lit* — et c'est pourquoi la connexion marchait quand la relecture de session ne marchait pas : deux clés, une seule forme reconnue.
*Acceptation :* un gardien statique refuse qu'un fichier hors de la liste close nomme une variable de désignation, et il est **vu tomber** sur la faute réelle écrite dans le fichier réel où elle se commettrait ; le gardien porte le témoin de son adossement — les fichiers qu'il nomme existent, et les titulaires nomment bien les variables ; toute clé de `CLES_DESIGNATION` est lue sous les **deux formes d'appel** (`{ k: v }` et `{ k: { equals: v } }`), sous le premier niveau comme sous un `AND`, et la liste éprouvée est DÉRIVÉE de `CLES_DESIGNATION` plutôt que recopiée.
*Relu contre les sources citées le 08/09/2026 — empreinte `17dfad96`.*

**L1-02f** LE PREMIER ÉCRAN — connexion, enrôlement du second facteur, page d'arrivée. **[D58] [D59] [D61] [D62]**
*File :* LIVRÉ
**Inscrit au backlog AVANT d'être écrit, et à sa place**, sur demande de l'exploitation du 08/09/2026 : *je ne veux pas de travail hors plan, même quand c'est moi qui le demande — le plan doit dire ce qui a été fait et pourquoi.*
**Pourquoi il passe devant l'import de masse, que le plan annonçait.** RG-DRO-05 impose le second facteur à `admin_plateforme`, `admin_societe` et `direction` ; D58 en a fait un cliquet et D59 lui a donné son plancher ; **et l'enrôlement ne se fait pas sans écran.** Personne ne peut donc devenir administrateur, et c'était le seul point réellement bloquant du registre. *La mesure gagne sur le plan.*
**Le périmètre est ÉTROIT, et l'étroitesse est une exigence** : une page de connexion ; si le rôle exige un second facteur et qu'il n'est pas enrôlé, le parcours d'enrôlement — présentation du secret, saisie du code, remise des codes de secours ; une page d'arrivée qui dit qui vous êtes et pour quelle société. Pas de liste de clients, pas de navigation, pas de menu. Chaque donnée de plus serait un écran de lot 2 écrit en avance.
**L'enrôlement passe par un chemin à NOUS**, borné par `second_facteur_enrolement`, et **jamais** par les points d'entrée que D59 a fermés nommément — ils restent fermés, seule l'API serveur est appelée, comme `signUpEmail` l'est pour l'ouverture administrative. **Et le cliquet ne se desserre pas** : un compte enrôle, il ne désenrôle jamais.
**CE QUE LA MESURE A TROUVÉ, et qui a décidé de la forme du ticket.** L'enrôlement **répondait « c'est fait » sans rien faire** : `enableTwoFactor` réussissait, `verifyTOTP` rendait HTTP 200 avec un code juste, et le compte se reconnectait ensuite **sans qu'aucun second facteur ne lui soit demandé**. Les deux écritures étaient refusées en silence — la bibliothèque désigne `second_facteur` par son `id`, qui n'est pas une clé de désignation, et `utilisateur_modification` exige une société active que le sujet ne peut pas avoir, son rôle exigeant justement le facteur qu'il pose. *Le pire sens de défaillance : l'utilisateur se croit protégé, la règle se croit tenue, et la base dit non aux deux sans que personne l'entende.*
**Et un second mur, mesuré à la conception** *(D61)* : aucun chemin ne permettait à un compte de découvrir sur quelles sociétés il est habilité. D'où la **huitième forme de politique — « appartenance »**, en `SELECT` SEUL.
**RLS EST PAR LIGNE, PAS PAR COLONNE**, et c'est le point de conception : la politique du cliquet dit « cette ligne passait de `false` à `true` » et ne dit RIEN des autres colonnes — sous elle seule, le sujet changerait son courriel dans la même instruction. Un **déclencheur** tient ce que la politique ne peut pas tenir, et il le tient par DIFFÉRENCE de la ligne entière plutôt que par une liste de colonnes qui se périmerait au premier `ALTER TABLE`.
*Acceptation :* l'enrôlement se constate **en base et à la reconnexion suivante**, jamais sur un code de retour ; un code faux n'enrôle rien et ne laisse pas le compte enfermé ; un mot de passe faux ne prépare rien ; le cliquet refuse le retour du drapeau à `false`, et son **jumeau** rend au `WITH CHECK` le droit de dire `false` pour montrer qu'il cède alors ; le chemin d'enrôlement ne change **rien d'autre** que le drapeau, et son **jumeau** retire le déclencheur pour montrer que le courriel part avec ; la branche « sa propre ligne » est refusée sur une écriture **et** son retrait est refusé aussi ; et **la dette est payée** — de la connexion à l'écran, un compte de la société A ne voit rien de la société B, mesuré sur ce que la page rend et non sur une requête.
**AMENDÉ PAR D64 le 08/09/2026, et il faut dire ce qui a cessé d'être vrai.** Ce ticket concluait que l'enrôlement fonctionnait et que le cliquet tenait. Les deux sont exacts et **la chaîne était pourtant sans issue** : le défi de second facteur ne se consommait pas, si bien qu'un compte enrôlé ne pouvait plus se connecter du tout, et le code de secours échouait après avoir été validé. *Un cliquet qui condamne aussi l'issue de secours n'est pas un cliquet, c'est un enfermement.* Rien de ce que ce ticket a posé n'est retiré ; ce qui manquait est réparé en L1-02g.
*Relu contre les sources citées le 08/09/2026 — empreinte `ca370040`.*

**L1-02g** LE PLANCHER DU SECOND FACTEUR, et la porte de sortie qu'il n'avait pas. **[D58] [D59] [D62] [D64]**
*File :* LIVRÉ
**Passe devant L1-05 sur décision d'exploitation du 08/09/2026**, et la raison est durcie : *ce n'est pas seulement le point le plus cher, c'est celui qui rend faux tout ce qu'on vient d'écrire.* Une garantie qu'on peut contourner par la force brute n'est pas affaiblie — elle est fausse, et elle fait croire le contraire à celui qui s'y fie. L'enrôlement étant ouvert, la fenêtre où cela ne coûte rien se referme au premier compte réel.
**CE QUE LA MESURE A TROUVÉ, ET QUI DÉPASSAIT LE TICKET.** Une cause commune à **trois** défauts : la bibliothèque réécrit par leur `id` des lignes qu'elle vient de lire par leur clé de désignation. Mesuré sur les huit flux réels — **69 opérations, 7 nomment un `id`, et les 7 sont des ÉCRITURES**. `id` n'étant clé de désignation d'aucune de ces tables, la politique lisait une chaîne vide et refusait **en silence**. D'où : un compte enrôlé ne pouvait plus se connecter **du tout**, même avec le bon code ; le code de secours échouait en `409` **après avoir été validé** ; et le compteur restait inerte.
**La forme ne touche AUCUNE politique** — elles étaient justes, personne ne les nourrissait. Un **report d'échange** repose, au moment d'une écriture qui nomme une ligne par sa clé primaire, ce que la même requête entrante avait déjà désigné. *Le `where` dit QUELLE ligne, la politique dit à QUI elle est* : un `id` rejoué venu d'un autre compte échoue sur la seconde moitié. **L'`id` n'ouvre jamais une lecture** [D64].
**Ce qui n'est pas exprimable est dit** : sur `verification`, l'appartenance au compte ne l'est pas — la table n'a pas de colonne de compte et `valeur` porte un **compteur** sur la ligne `2fa-attempts-…` (mesuré). Ce qui compose y est l'identifiant opaque déjà présenté, qui est un secret là où un `id` n'en est pas un. **Ce n'est pas la même garantie.**
**Dix échecs, quinze minutes, escalade au troisième verrouillage enchaîné** [D64]. L'escalade vit dans un **déclencheur**, seul point que les trois chemins de vérification franchissent, et elle compte dans la même instruction que le verrouillage qu'elle compte.
*Acceptation :* le nombre de codes présentables est mesuré **en essayant** et non en lisant le code, jamais sous RLS levée ; la **contre-épreuve** retire la politique qui autorise l'écriture du compteur et montre que les codes cessent d'être comptés et que la porte ne se ferme plus ; un `id` valide appartenant à un **autre compte**, présenté par un compte authentifié, est refusé, et son jumeau retire les **deux** moitiés — `SELECT` comprise — pour montrer que la ligne d'autrui redevient atteignable ; une **lecture** par `id` ne reçoit aucun report ; le report ne franchit pas deux échanges, y compris concurrents ; la purge d'un verrou expiré ne rompt **pas** la série quand une connexion réussie la rompt ; le déclencheur retiré, la série ne s'accumule plus ; le sujet ne remet pas sa propre série à zéro (D58).
*Relu contre les sources citées le 08/09/2026 — empreinte `444dec1d`.*


**L1-03** Contacts — rôles, préférences de notification.
*File :* LIVRÉ
Le ticket ne disait que cela : ni entrée au chapitre 11, ni règle au chapitre 10. Une session s'est **arrêtée** plutôt que de promouvoir le narratif du chapitre 3 au rang de modèle de données. **Les quatre décisions manquantes ont été prises par l'exploitation le 07/09/2026**, et les voici.
**(1) Rattachement.** Un contact appartient au **CLIENT**, avec un rattachement de site **facultatif**. Le donneur d'ordre et le comptable sont ceux du client ; chez un client à plusieurs sites, certains interlocuteurs ne concernent qu'un site. Les deux lectures du chapitre 3 étaient vraies — elles ne parlaient pas du même contact.
**(2) Forme de politique : PARC, et ce n'est PAS une huitième forme.** La clause est conditionnelle — le filtre de sites ne s'applique que si le contact porte un site —, mais les trois axes sont exactement ceux du parc : `société ET client ET (pas de périmètre OU pas de site OU site du périmètre)`. La branche `site_id IS NULL` n'ajoute pas un axe, elle dit qu'une ligne sans valeur sur l'axe du périmètre n'est pas filtrée par cet axe. `site` et `machine` ne posaient pas la question : leur colonne de périmètre est `NOT NULL`.
**Le piège, nommé AVANT qu'il ne se produise :** *un contact sans site ne doit pas disparaître pour un compte portail restreint — sinon on perd le comptable en restreignant un atelier.* L'oublier ne casse **rien de visible** : la liste se raccourcit, et personne ne sait ce qui manque. Un scénario l'éprouve nommément, et `ecartsPerimetreNullable` l'exige désormais **dès que la colonne de périmètre est nullable** — la nullabilité venant d'`information_schema`, une source que le gardien ne contrôle pas.
**(3) Rôles.** Un **ensemble**, jamais un scalaire : le donneur d'ordre est souvent aussi le signataire. `text[]` et **pas d'énumération en base** — une société tierce aura d'autres rôles, et une énumération en ferait une migration ; c'est le raisonnement des zones **en sens inverse**, les zones étant closes parce qu'elles ne bougeront pas, les rôles parce qu'ils bougeront. La liste connue est close à l'entrée serveur. **RG-INT-04 lit « signataire » DANS l'ensemble**, il n'y a pas de colonne à part — une colonne aurait été une seconde source du même fait.
**(4) Canaux.** **E-mail seulement** : aucune passerelle SMS n'est en service ni décidée. Le modèle ne fait pas du SMS une migration — les préférences sont un ensemble dont un seul membre est implémenté, et `CANAUX_CONNUS` est distinct de `CANAUX_IMPLEMENTES` pour qu'on ne promette jamais un envoi qui ne partira pas. **Critère de bascule non daté** : le jour où une passerelle SMS est en service. **Aucun envoi n'est écrit ici** — L1-03 pose la DONNÉE ; RG-INT-05 la consommera.
*Acceptation :* un compte portail restreint à un site voit le contact **sans site** et pas celui de l'autre site — exactement un des deux, mesuré ; la clé porte le **triplet** (société, client, site), si bien qu'un contact ne peut pas se rattacher au site d'un autre client ; la base tient les PROPRIÉTÉS des ensembles (non vides, sans doublon) et l'entrée serveur leur CONTENU ; le canal e-mail sans adresse est refusé des deux côtés ; le gardien de la branche `IS NULL` est éprouvé sur la clause recopiée depuis `site` — la faute telle qu'elle se commettrait, en obéissant.
*Relu contre les sources citées le 07/09/2026 — empreinte `df5ae552`.*
**L1-04** Techniciens et habilitations. **[D9] [D60]**
*File :* LIVRÉ
Trois tables : `habilitation`, `technicien_habilitation` (datée), `site_habilitation_requise` (avec booléen bloquant).
**`habilitation` est une table MÉTIER cloisonnée, pas un référentiel de plateforme** [D60] : une nomenclature nationale est un fait de la France, pas un fait de la plateforme, et une société suit aussi des qualifications non réglementaires. La liste réglementaire française est un **AMORÇAGE** posé à l'ouverture d'une société, qu'elle complète ou réduit. Les **durées de validité** restent nulles — la périodicité de recyclage est une pratique d'entreprise, pas une valeur que la norme chiffre : au registre.
**`site_habilitation_requise` est la PREMIÈRE table fille réelle du parc**, et porte donc la sixième forme de politique — **filiation** —, tranchée à L1-02 et construite ici : *une fille est visible si son parent l'est.* La forme « société » aurait laissé un compte portail restreint au site S1 lire les exigences du site S2 ; la forme « parc » aurait exigé de recopier `client_id`.
**RG-PLA-04 vit dans `lib/habilitations/`, pas en base** : elle dépend d'une date d'intervention que la base ne connaît pas encore. L1-04 pose la DONNÉE ; le lot 2 la consommera.
*Acceptation :* l'affectation est **bloquée** — et non signalée — si le site exige une habilitation bloquante absente ou expirée à la date d'intervention. Test sur RG-PLA-04 ; un compte portail restreint à S1 voit l'exigence de S1 et pas celle de S2 — exactement une des deux, mesuré ; le jumeau remplace la filiation par la clause de société et montre S2 réapparaître ; les chaînages composites refusent d'exiger l'habilitation d'une autre société et d'habiliter quelqu'un qui n'appartient pas à la société.
*Relu contre les sources citées le 08/09/2026 — empreinte `6c6d2baf`.*
**L1-04b** L'amorçage des habilitations couvre les TROIS familles suivies. **[D60] [D63]**
*File :* LIVRÉ
Décision d'exploitation du 08/09/2026 : *CODIMA suit trois familles — les habilitations électriques, les CACES et engins, et le travail en hauteur.* L'amorçage de L1-04 n'en couvrait qu'une et demie ; **une liste amorcée sur l'électrique seul se lit comme un catalogue complet**, et personne ne s'aperçoit que deux tiers du métier manquent.
**La famille organise l'AMORÇAGE, elle n'entre pas en base.** Une société qui ajoutera « formé sur telle presse » n'a aucune famille à choisir — c'est D60 mot pour mot. La poser en colonne ferait de l'ajout d'une famille une migration : c'est le raisonnement des zones pris à l'envers. Ce qu'elle permet, en revanche, c'est un gardien — les trois familles doivent être PEUPLÉES.
**Les codes et libellés restent des FAITS** — symboles de NF C 18-510, catégories des recommandations R489, R482, R484, R486 et R408. **Une seule entrée n'est pas réglementaire**, le port du harnais, et son libellé le dit : c'est l'illustration en acte de D60.
**Les durées de validité restent NULLES** [D63], et leur coût est désormais écrit plutôt que tu : RG-PLA-04 ne peut refuser que sur l'ABSENCE, jamais sur l'EXPIRATION, et rien ne le signalera tant que rien n'expire.
*Acceptation :* chacune des trois familles porte au moins une entrée, et le gardien est **vu tomber** sur une famille vidée ; aucune famille inconnue ne s'y glisse ; les codes sont uniques ; **aucune entrée ne porte de durée de validité**, et le gardien tombe aussi sur une durée inventée ; le budget d'allers-retours du seed est **mesuré** et non estimé — la marge est comptée avant l'ajout, et `DUREE_MAXIMALE_MS` n'est pas relevé.
*Relu contre les sources citées le 08/09/2026 — empreinte `e40f167e`.*

**L1-05** Familles et modèles de matériel. **[D4 AMENDÉ]**
*File :* LIVRÉ
~~`societe_id` nullable pour les référentiels de plateforme [D4] ; une copie portant un `societe_id` masque l'original. Forme de politique : **référentiel** — lecture ouverte, écriture aux seuls rôles éditeur —, et RLS **activée sans être forcée**.~~
**Ce ticket s'est ouvert sur une CONTRADICTION dans sa propre source, et l'exploitation a retiré le mécanisme plutôt que d'arbitrer entre ses moitiés** *(08/09/2026)*. D4 rangeait ces tables sous « modifiables par les seuls **rôles éditeur** » et écrivait dans la même page qu'« une **société** qui veut l'adapter en crée une copie » — *une société qui ne peut pas écrire ne peut pas créer de copie*. Et la clause que D4 proposait n'était pas la forme « référentiel » du CLAUDE.md, dont la lecture est `USING (true)` : sous celle-ci, **la copie de A serait lisible par B**. Troisième point, un manque plutôt qu'une contradiction : « la copie masque l'original » est une règle de **SÉLECTION**, que RLS ne sait pas porter — rien ne disait où elle vivrait.
**`famille_materiel` et `modele_materiel` sont donc des tables MÉTIER cloisonnées**, `societe_id NOT NULL`, forme **société**, RLS **forcée**, **auditées**. Quatrième fois que le dépôt tranche ainsi — zones, rôles de contact, habilitations, et ici : *une nomenclature partagée fige un territoire dans un produit destiné à être vendu ailleurs.* Et chez CODIMA, les modèles viennent du **fichier de suivi** — équipement, marque, modèle, numéro de série —, pas d'un catalogue d'éditeur : ce sont des **données saisies**.
**Le seed n'amorce RIEN**, et c'est délibéré : la liste des familles et modèles suivis appartient à l'exploitation, l'inventer serait inventer une donnée métier (CLAUDE.md §8). Le catalogue de plateforme, s'il existe un jour, sera un **amorçage**, comme la liste réglementaire des habilitations.
*Acceptation :* un modèle appartient à sa société et A ne voit jamais celui de B, **avec témoin de non-vacuité** ; le chaînage composite `(societe_id, famille_id)` refuse la famille d'une AUTRE société ; les deux tables entrent au périmètre d'audit **sans qu'aucune liste d'admis ne soit touchée** (D55) ; un rôle éditeur, qui n'a aucune société active, ne voit **aucun** modèle — ce qui est nouveau, il en voyait la ligne partagée ; et le contrat des fixtures est honoré, la fixture `modele_materiel` s'effaçant devant la table réelle.
**Effet de bord mesuré, inscrit plutôt que tu :** après ce retrait, **plus aucun référentiel de plateforme ne porte de colonne `societe_id`**. La branche du gardien de D41 qui reconnaît cette forme survit à son dernier exemplaire, et un témoin le dit.
*Relu contre les sources citées le 10/09/2026 — empreinte `3c40909a`.*
**L1-06** Prestations et forfaits — `societe_id NOT NULL`. Conditions d'application par zone, famille, type. **[RG-TAR-06] [D4] [D23] [D57]**
*File :* LIVRÉ
*Mécanisme tranché par la session le 08/09/2026 ; les VALEURS restent à l'exploitation.* Forme de politique **société**, déduite comme celle de L1-07 : un forfait est un prix de vente, propre à chaque société — D4 le range nommément là — et il n'est la donnée d'aucun client. Montant **ENTIER** dans l'unité la plus fine avec son code de devise (I2, I3) ; le chapitre 11 l'écrit `numeric`, et la forme entière l'amende pour la raison de I3 — les décimales appartiennent à la DEVISE, un `numeric` obligerait chaque lecture à se rappeler laquelle. **Zéro est permis** — une prestation offerte est un forfait à zéro —, négatif non : ce serait un avoir.
**LA TABLE NAÎT VIDE, et le vide est le ticket.** Quels forfaits mettre au catalogue et à quels montants est une question d'exploitation, inscrite au registre. Ce que ce vide empêche : rien ne se propose, et RG-TAR-06 n'a rien à filtrer.
**Le troisième axe est INERTE, et c'est écrit plutôt que tu.** Les types d'intervention n'existent nulle part dans le dépôt — ni énumération, ni liste close, ni table —, et le lot 2 les décidera. La règle est pourtant écrite entière et éprouvée sur les trois axes : le jour où le lot 2 posera des types, elle n'aura pas à changer. Même forme que D63 sur les durées de validité — *ce n'est pas un défaut du code, c'est une donnée qui n'existe pas, et rien ne rougira tout seul.*
**`zone_geo` réutilise la liste close de `lib/sites/zones.ts`** [D23], jamais une seconde écrite ici : ce serait la divergence silencieuse du 01/09, deux lectures d'un même critère chacune juste sur la sienne. **`type` est en revanche une énumération EN BASE** — c'est le raisonnement des zones à l'endroit : les quatre natures ne décrivent pas un territoire, elles décrivent ce qu'un forfait FAIT dans le moteur de valorisation.
~~**Ce qui n'est PAS fait, et qui est au registre :** ce module ne **valorise** rien. RG-TAR-05 donne l'ORDRE du calcul, jamais la composition d'un forfait et d'un taux horaire ; `heures_incluses_minutes` est donc posé (en minutes, entier, pour l'arrondi au quart d'heure de [D57]) et consommé par personne.~~ **TRANCHÉ le 09/09/2026 (Q4) : un forfait s'ajoute TOUJOURS aux heures.** C'est un montant fixe qui vient EN PLUS du temps passé ; il n'absorbe aucune heure, et la notion d'heure excédentaire ne s'applique pas à lui. `heures_incluses_minutes` **a donc été retirée** — *une colonne qui modélise un cas qui n'existe pas est pire qu'une colonne absente.* La réciproque est écrite dans `lib/tarification/forfaits.ts` : si une société a un jour besoin qu'un forfait inclue du temps, ce sera un besoin réel avec un cas réel derrière, jamais « la colonne existait déjà ». Le module ne **valorise** toujours rien : c'est le lot 2.
*Acceptation :* un forfait sans condition sur un axe s'applique — **l'absence de condition n'est pas une condition qui échoue**, et c'est le cas majoritaire ; un seul axe non satisfait suffit à écarter le forfait ; une valeur d'intervention **absente** face à une condition posée écarte le forfait, sur chacun des trois axes ; B ne lit pas le catalogue de A, **avec témoin de non-vacuité**, et le même code existe des deux côtés ; le chaînage composite refuse la famille d'une AUTRE société ; devise étrangère, montant négatif, ensemble vide et doublon sont refusés — **chacun avec son jumeau vu tomber**.
**Deux limites mesurées, inscrites plutôt que tues.** *(1)* PostgreSQL **refuse toute sous-requête dans une contrainte `CHECK`** (`0A000`) : « sans doublon » ne s'exprime pas sur un tableau sans en écrire une, et la propriété passe donc par une fonction `IMMUTABLE`. *(2)* Écrire chez une AUTRE société est refusé **par le déclencheur de devise, pas par le `WITH CHECK`** — un `BEFORE` s'exécute avant que la politique ne juge la ligne, et sous le contexte de A il ne peut pas lire la société B. C'est le voisin qui échoue à la place du verrou visé (§9, 24/08) ; la garantie est donc exigée deux fois, et **un second scénario va chercher le `WITH CHECK` derrière lui**, déclencheur ôté.
**[D89] relu le 10/09/2026 : il ne touche rien ici.** Il tranche la MAILLE du plancher — par intervention, sans exception — et le plancher ne vise **pas** les forfaits (D83, inchangé). Ce ticket ne valorise toujours rien : c'est le lot 2.
*Relu contre les sources citées le 10/09/2026 — empreinte `ee456c88`.*
**L1-07** Taux horaire — par société, **historisé par DATE D'EFFET**. **[RG-TAR-01] [RG-TAR-03] [RG-TAR-04] [D68]**
*File :* LIVRÉ
*Mécanisme tranché par l'exploitation le 08/09/2026 ; les VALEURS restent à elle.* Une table et non une colonne : une colonne porte la valeur de maintenant, et *une intervention se facture au taux en vigueur à SA date — une facture qui change quand le tarif change est une facture fausse*. Montant **ENTIER** dans l'unité la plus fine de la devise, avec son code de devise, exactement la forme de `Montant` dans `lib/money` : jamais un flottant (I3), jamais un montant sans sa devise (I2). Forme de politique **société**, déduite : un tarif n'est la donnée d'aucun client, et ce n'est pas un référentiel de plateforme — D4 le dit déjà de `prestation` et `forfait`.
**LA TABLE NAÎT VIDE, et le vide est le ticket.** ~~Le taux de CODIMA est connu — 7 000 XPF, chapitre 1 et seed~~ **arrêté au RANG 1 le 09/09/2026 [D68] : 7 000 XPF HORS TAXES** — mais **sa date d'effet ne l'est pas**, et c'est elle que la table exige. Ce que ce vide empêche : `tauxEnVigueur` rend `null`, et **un taux manquant ne se lit jamais « gratuit »**. Tant qu'aucune ligne n'est saisie, RG-TAR-04 n'a rien à appliquer.
~~**Ce qui n'est PAS fait, et qui est au registre :** `societe.taux_horaire_defaut` reste en place.~~ **RETIRÉE le 09/09/2026 (Q3)** : elle portait `65.0000` pour CODIMA-EU là où la forme entière vaut `6500` — *ce ne sont pas les mêmes nombres*, et les deux sources divergeaient avant même d'avoir été lues. La prémisse a été **mesurée** : la base hébergée ne porte que les deux sociétés du seed. `taux_horaire` est désormais la seule source, et elle reste VIDE — c'est la **date d'effet** qui manque, pas le montant.
**Le PREMIER taux a son geste depuis le 10/09/2026 — `scripts/taux-initial.mts`, SÉPARÉ de l'amorçage** (décision du 09/09, D68 complété). La date d'effet est arrêtée — la mise en service — et fournie au geste, comme le montant ; le geste refuse dès que la société porte un taux, et le jumeau retire la ligne pour le voir repasser. La table naît toujours vide : c'est l'exploitation qui la remplit, au jour de la mise en service.
*Acceptation :* une hausse ne réécrit pas le passé — mars au taux de mars, septembre au taux de septembre, et le jour même de la date d'effet c'est le NOUVEAU taux ; le montant rendu est un `bigint` avec sa devise ; avant toute date d'effet la lecture rend `null` et non zéro ; B ne lit pas le taux de A, avec témoin de non-vacuité ; deux taux au même jour sont refusés, un montant nul ou négatif aussi, une devise étrangère à la société aussi — **chacun avec son jumeau**.
**Limite mesurée de l'outillage, inscrite plutôt que tue :** sur une violation d'unicité en requête brute, **Prisma efface le nom de la contrainte** (« Unique constraint failed: » vide) là où il le garde sur une clé étrangère. L'assertion s'assied donc sur le code SQLSTATE `23505`, et c'est **le jumeau qui nomme le verrou en le retirant** — ce qu'aucun message ne peut faire à sa place.
*Relu contre les sources citées le 08/09/2026 — empreinte `f8011bfa`.*
**L1-08a** La GRAMMAIRE des fichiers d'import. **[D31] [D69]**
*File :* LIVRÉ
Version en cellule A1 (`CODIPLAN-<type>-v<n>`), en-têtes ligne 2, données ligne 3. Dates `JJ/MM/AAAA`, décimale virgule. Colonnes inconnues ignorées avec avertissement. **Aucune dépendance, aucune base** : `lib/excel/format.ts` porte les six mécaniques de D31 sur une grille de cellules abstraite.
**Ce découpage n'est pas d'esthète : la LIAISON au classeur est en attente d'arbitrage** (question au registre du 08/09/2026). Ce qu'il garantit en attendant : le jour où la liaison arrive, **elle n'a aucune règle à porter** — elle rend une grille, et tout ce qui suit est déjà écrit et éprouvé.
**Un nombre lu ne rend JAMAIS un flottant** : les chiffres et leur échelle (`« 1234,56 »` → `{123456n, 2}`). Rendre `1234.56` obligerait le premier appelant à remultiplier par cent, c'est-à-dire à faire l'arithmétique flottante que I3 interdit, une ligne après nous. **Une date se lit en UTC**, jamais par un `Date` local : UTC+11 décale le jour d'un cran, et un import saisi le 1ᵉʳ se rangerait au 31 du mois précédent.
**Trois cas que D31 ne tranche pas, refusés plutôt qu'inventés**, et inscrits au registre : une version **postérieure** (lire un v3 avec du code v2 suppose ce que v3 a changé), un **en-tête en double** (lire la seconde écraserait la première sans dire laquelle a gagné), et une **colonne obligatoire absente** (ce n'est pas une ligne qui manque, c'est le fichier qui n'est pas celui qu'on croit). L'appariement est **exact après élagage** : une tolérance de casse choisirait à la place de celui qui a écrit le fichier.
**RATIFIÉS le 09/09/2026 [D69], et une paire réparée.** Les trois refus et l'appariement exact sont confirmés tels quels. Ce qui change est le RAPPORT : ~~un en-tête mal orthographié ressort DEUX fois, « colonne obligatoire absente » et « colonne inconnue », et cette paire se lit sans explication~~ — les deux sont désormais dits **en une seule anomalie qui les nomme tous les deux**, et l'en-tête sort des inconnues. **La ressemblance ne déplace RIEN** : elle n'apparie pas, elle explique. *Une tolérance choisit ; une explication décrit* — et un scénario mesure qu'après le message la colonne reste illisible.
*Acceptation :* les quatre refus de marqueur sont **distincts** — c'est le mot « reconnu » de D31 ; `31/02` est refusé et `29/02/2028` passe ; le sérial fractionnaire et toute la plage antérieure au 1ᵉʳ mars 1900 sont refusés — le bogue bissextile du tableur fermé en classe ; les trois confusions de séparateur sont distinguées, **espace insécable compris**, et le jumeau qui restreint le motif à l'espace ordinaire est **vu tomber** ; chaque code d'anomalie a son libellé au dictionnaire, et réciproquement.
*Relu contre les sources citées le 08/09/2026 — empreinte `b7cef973`.*
**L1-08d** LE RAPPORT RETIENT CE QU'IL DÉCIDE — le mur devant L1-08b. **[mesuré le 11/09/2026]**
*File :* LIVRÉ
**Mesuré :** `controlerFeuille` décidait ligne à ligne — nature, clé, création ou modification — puis **jetait tout** et ne rendait que des décomptes. Or I6 veut qu'un import produise d'abord un rapport, PUIS attende une validation explicite : *l'application ne peut appliquer que ce que le rapport a MONTRÉ*, et un rapport qui ne retient rien ne peut rien faire appliquer. **C'était le mur devant L1-08b, et il n'était écrit nulle part** — le chapitre 11 le disait pourtant par la bande, `import_lot.statut` valant `controle`, `applique` ou `annule` : le lot EXISTE dès le contrôle.
**Et ce ticket RETIRE une divergence plutôt que d'en ajouter une.** Les décomptes étaient incrémentés **à côté** des décisions, dans la même boucle : deux lectures d'un même critère, qui divergent en silence (§9, 01/09). Ils sont désormais DÉRIVÉS des lignes retenues — la décision est prise une fois, et le rapport la compte. *Un décompte qui ne peut plus contredire ce qu'il compte n'est plus un décompte à surveiller.*
*Acceptation :* une ligne retenue par ligne lue, dans l'ordre du fichier ; chaque ligne nomme son action et porte ses valeurs ; un gabarit et une ligne vide ne portent AUCUNE clé — leur en inventer une les ferait entrer dans l'espace des clés réelles, où deux lignes muettes deviendraient la même machine ; et la dérivation est éprouvée sur des décomptes NON NULS — zéro contre zéro n'est pas un résultat.

**L1-08e — LE LOT D'IMPORT EXISTE DÈS LE CONTRÔLE. [I6] [D15] [D100]**
*File :* LIVRÉ
**LIVRÉ le 11/09/2026.** `import_lot` et `import_lot_ligne` naissent, et le lot naît **au contrôle** : I6 veut qu'un import produise d'abord un rapport, PUIS attende une validation explicite — *l'application ne peut appliquer que ce que le rapport a MONTRÉ.* Le chapitre 11 le disait depuis l'origine sans qu'on l'ait lu ainsi (`statut` ∈ {controle, applique, annule}).
**LA FORME EST « INTERNE », ET ELLE EST CHOISIE À LA NAISSANCE [D100].** `import_lot_ligne.valeurs` porte la ligne du fichier telle qu'elle a été lue : *un fichier d'import de parc contient TOUTES les machines de la société, qu'aucun périmètre de sites n'a jamais filtré.* Sous la forme « société » — dont la clause ne lit pas `app.client_id` —, un compte portail restreint à un atelier y aurait lu le parc entier, **par une table que personne n'aurait pensé à regarder**. C'est la fuite que D94 ferme sur le bac, un étage plus loin : là un NOM DE FICHIER, ici le parc lui-même. Mesuré avec son jumeau : sous la clause de société seule, le compte portail lit `SN-A2`, qui n'est pas dans son périmètre.
**LA CHAÎNE A SON APPELANT** (`tests/isolation/chaine-import.test.ts`) : feuille → contrôle → enregistrement par le chemin de PRODUCTION → relecture sous contexte cloisonné. *Une suite qui éprouve tous les maillons n'éprouve pas la chaîne* — entre `controle.ts`, qui a ses 106 scénarios, et les politiques, qui ont les leurs, personne ne traversait.
**ET UNE SECONDE LECTURE A ÉTÉ RETIRÉE PLUTÔT QUE GARDÉE.** `lib/imports/depot.ts` a d'abord porté sa propre boucle de comptage — le §9 du 01/09 écrit une fois de plus. Elle appelle désormais `proposerDepuisLesLignes`, *ce qui est presque toujours possible et presque toujours meilleur.*
*Acceptation :* les deux tables portent la forme « interne » et leur déclencheur d'audit ; un gabarit qui porterait une clé est refusé par la base, et un rejet sans motif aussi — dans les deux sens ; la chaîne traverse ; et le jumeau montre la fuite que la forme « société » ouvrirait.
*Relu contre les sources citées le 11/09/2026 — empreinte `fee2009c`.*

**L1-08f — LE RAPPROCHEMENT NE SAVAIT RAPPROCHER QUE DES MACHINES. [RG-IMP-05] [D29]**
*File :* LIVRÉ
**Mesuré le 11/09/2026 en préparant l'application**, sur un modèle « clients » écrit tel qu'on l'écrirait aujourd'hui, contre un parc qui connaissait **déjà** les deux codes :
```
clés rendues : LIGNE-3, LIGNE-4
actions      : creation, creation
créations    : 2 | modifications : 0
```
*Le contrôle calculait lui-même la clé des MACHINES — série, référence, rang — quel que soit le type d'import.* Un modèle qui n'a ni série ni référence tombait donc sur la clé de dernier recours, et **toutes ses lignes étaient des créations** : un second import du même fichier aurait créé 55 doublons sur l'onglet Clients, c'est-à-dire exactement ce que RG-IMP-05 interdit.
**LA RÉPARATION : c'est le MODÈLE qui dit ce que la ligne désigne**, jamais le contrôle. `ModeleDImport.cle` est **obligatoire et sans défaut** — *un défaut ferait qu'un modèle qui oublie reçoit la clé des machines en silence, ce qui est la faute qu'on vient de retirer.* `colonneSerie` et `colonneReference` disparaissent du modèle : elles ne servaient qu'à cela.
**La clé des machines n'a pas changé d'un caractère — elle a changé de MAIN.** *Les 111 scénarios du module passent inchangés, et c'est la meilleure preuve que le contrat visible n'a pas bougé.*
**RG-IMP-05 est enfin implémentée** : code externe s'il existe, à défaut **raison sociale normalisée**. La normalisation porte sur la GRAPHIE — accents, casse, ponctuation, espaces — et sur **rien d'autre** : *« SARL Dupont » et « Dupont » restent deux clés distinctes, parce qu'un rapprochement faux attribue les machines d'un client à un autre et que plus personne ne saura qu'il était automatique.* Trois espaces disjoints, prouvés comme ceux des machines.
**CE QUI RESTE DÛ, écrit plutôt qu'oublié :** RG-IMP-05 veut qu'*en cas d'ambiguïté, la ligne parte en rejet pour arbitrage humain*. L'ambiguïté est un fait du PARC — deux clients de même raison sociale normalisée —, et le contrôle ne reçoit qu'un `Set<string>`, qui ne peut pas la porter. *La lever demande que le parc voyage autrement, ce qui est un ticket et non une ligne.*
*Acceptation :* un code déjà connu du parc devient une MODIFICATION ; un parc qui connaît le NOM rapproche aussi — l'inverse exact, sur la même feuille ; les trois espaces de clés sont disjoints ; et le modèle des machines rend exactement ce qu'il rendait.
*Relu contre les sources citées le 11/09/2026 — empreinte `0fc7924a`.*

**L1-08g — L'AMBIGUÏTÉ EST UN FAIT DU PARC, ET ELLE DEVIENT UN REJET. [RG-IMP-05] [D29]**
*File :* LIVRÉ
**LIVRÉ le 11/09/2026 — et c'est la limite que L1-08f avait ÉCRITE plutôt que tue qui se retire.** RG-IMP-05 pose **trois** cas et non deux : *« en cas d'ambiguïté, la ligne part en rejet pour arbitrage humain plutôt qu'en création silencieuse d'un doublon ».* Un `Set<string>` nu ne pouvait pas porter le troisième.
**`ParcConnu` porte DEUX ensembles**, et `ambigues` **n'a aucun défaut** : un appelant qui ne sait pas répondre doit passer un ensemble vide, ce qui est une AFFIRMATION — *« ce parc ne porte aucune ambiguïté ».* Un défaut ferait de cette affirmation un oubli, et l'oubli retomberait du côté permissif.
**L'ORDRE EST UNE DÉCISION** : le rejet précède la modification. *Une clé ambiguë est aussi une clé connue, et tester « connue » d'abord la rendrait modifiable — c'est-à-dire écraserait l'une des deux fiches au hasard, ce que RG-IMP-05 refuse précisément.*
**L'ambiguïté se lit d'une COLLISION, jamais d'une ressemblance** (`lib/imports/parc-clients.ts`). La clé du parc est calculée par la **même fonction** que le contrôle : *une variante ferait que rien ne se rapproche jamais, et tout redeviendrait création — le défaut que L1-08f venait de réparer.* La clé ambiguë est **retirée** de l'index et **reste** dans `cles` : laisser l'une des deux fiches ferait écraser celle-là plutôt que l'autre.
**Mesuré à travers la BASE**, et non sur un ensemble fabriqué : deux fiches réelles de même raison sociale normalisée, l'homonyme posé puis retiré, **et une assertion constate la remise en état** — *une remise en état qu'on ne vérifie pas est une intention.*
*Acceptation :* la clé partagée est ambiguë, ne désigne plus aucune fiche et reste connue ; la ligne qui la porte est rejetée avec son motif ; le rejet s'additionne au total ; une autre ligne du même fichier passe quand même — *ce n'est pas le fichier qui est refusé, c'est une ligne* ; et la société B ne voit aucune clé de la société A, tout en voyant son propre « C-001 ».
*Relu contre les sources citées le 11/09/2026 — empreinte `0fc7924a`.*

**L1-08h — LE RAPPORT MONTRE CE QUE LA SAISIE REFUSERA. [I6] [RG-IMP-01]**
*File :* LIVRÉ
**LIVRÉ le 11/09/2026.** I6 veut qu'un import produise d'abord un rapport, PUIS attende une validation explicite. *Une ligne que la saisie refusera et que le rapport annonce en création est un rapport qui ment* : on valide 300 créations, on en obtient 297, et les trois manquantes ne se découvrent qu'après coup.
**Le MODÈLE porte sa validation**, comme il porte sa clé — et c'est **le schéma de création lui-même qui juge**, jamais une relecture de ses règles : *une seconde lecture d'un même critère diverge en silence* (§9, 01/09), et ici la divergence se verrait au pire moment.
**`valider` est FACULTATIVE, la seule des deux à l'être** : un modèle peut n'avoir aucune règle au-delà de sa grammaire, et l'absence est alors une affirmation lisible. *La clé, elle, ne peut pas manquer : il n'existe pas d'import sans rapprochement.*
**L'AMBIGUÏTÉ PASSE AVANT LA SAISIE**, et l'ordre se lit : *une ligne indécidable ne vaut pas la peine d'être validée, et rendre le motif de saisie ferait chercher une correction dans le FICHIER là où le problème est dans le PARC.*
*Acceptation :* une raison sociale vide est rejetée PAR LE RAPPORT ; une ligne saine passe — le cas qui doit rester vert pour sa raison ; l'ambiguïté l'emporte sur la saisie ; et une ligne traduite ne porte aucune chaîne vide.
*Relu contre les sources citées le 11/09/2026 — empreinte `5e551eff`.*

**L1-08i — L'APPLICATION D'UN LOT DE CLIENTS. [I6] [D15] [RG-IMP-04]**
*File :* LIVRÉ
**LIVRÉ le 11/09/2026 — la seconde moitié de I6.** L'application **n'applique QUE ce que le rapport a montré** et **ne redécide rien** : elle lit `import_lot_ligne.action` et l'exécute. *Si elle recalculait, la validation humaine aurait porté sur un écran et l'écriture sur autre chose.*
**UNE SEULE TRANSACTION**, et ce n'est pas un détail : *une écriture par ligne laisserait, au premier incident, un lot « contrôlé » dont la moitié des fiches existe — un état que rien ne décrit et que l'annulation ne saurait pas défaire.* `creerClientDans` et `modifierClientDans` sont **extraites** de `lib/clients/depot.ts` plutôt que recopiées : la seconde implémentation d'un critère n'est jamais gratuite.
**`valeurs_avant` SE LIT AVANT D'ÉCRIRE** — après, il est trop tard, et le journal d'audit porterait la seule trace, sur une table qu'aucune annulation ne lit (D15).
**ET LA BASE A ATTRAPÉ CE QUE J'AVAIS OUBLIÉ.** Le premier rejet réellement enregistré a fait rougir `import_lot_ligne_rejet_a_son_motif` (code 23514) : le rapport portait le motif depuis L1-08h, **et `enregistrerLeControle` le jetait**. *Aucun test ne pouvait le voir avant qu'un rejet traverse la chaîne entière* — c'est l'appelant de bout en bout qui l'a produit, pas la relecture.
*Acceptation :* la fiche existe RÉELLEMENT en base, avec son témoin d'absence préalable ; la ligne porte l'entité et son identifiant ; un second passage est refusé — le cliquet ; une modification garde l'état d'avant ; un lot d'une autre société est « introuvable » et rien de plus ; une ligne rejetée n'écrit rien.
*Relu contre les sources citées le 11/09/2026 — empreinte `72efc376`.*

**L1-08j — L'ANNULATION PARTIELLE ET SÛRE. [I6] [D15] [D54] [RG-IMP-02]**
*File :* LIVRÉ
**LIVRÉ le 11/09/2026 — la dernière pièce de L1-08b.** Elle **restaure ce qui peut l'être et refuse le reste avec son motif** : elle ne s'arrête pas au premier refus, et elle ne force rien.
**NI DÉLAI NI RANG DE LOT [D54]**, et c'est mesuré plutôt qu'affirmé : *deux lots qui se recouvrent, et le PREMIER s'annule sur ce que le second n'a pas touché* — la ligne intacte est défaite, la ligne écrasée est refusée avec « modifiée depuis ». C'est exactement ce que la règle du dernier lot ne savait pas faire.
**« MODIFIÉE DEPUIS » SE CONSTATE EN COMPARANT**, et la comparaison porte sur **les seuls champs que l'import a écrits** : *il n'a pas touché le reste, il n'a donc rien à en dire* — comparer davantage ferait refuser une annulation parce que quelqu'un a renseigné une adresse.
**« RÉFÉRENCÉE DEPUIS » EST COMPTÉE AVANT, et ce n'est PAS le choix qu'on ferait spontanément.** La déduplication du bac (L8-07) lit le refus de la base plutôt que de le prévenir, et c'est plus sûr — *ici c'est impossible* : **une violation de contrainte ABANDONNE la transaction PostgreSQL entière** (`25P02`, mesuré). Rattraper le `P2003` ne rend pas la main, et l'annulation cesserait d'être partielle au premier refus. **Ce que le comptage ne garantit pas est écrit** : une référence née entre le comptage et la suppression fait échouer l'annulation ENTIÈRE — *rien n'est défait à moitié, et on la rejoue.*
**ET UNE CONTRAINTE DE L1-08e A ÉTÉ MISE EN DÉFAUT PAR SA PREMIÈRE ANNULATION.** `(statut = 'applique') = (applique_le IS NOT NULL)` obligeait à **effacer la date d'application** pour annuler — *c'est-à-dire à perdre la seule trace du moment où les fiches ont été écrites.* Une **seconde migration** la remplace par une règle qui porte l'HISTOIRE : un lot annulé garde les deux dates. *Une seconde plutôt qu'une correction sur place parce que je ne peux pas savoir si la première a touché la base hébergée — elle est injoignable, et le geste est en attente d'une main.*
*Acceptation :* une création se défait et la fiche disparaît réellement ; une modification se restaure ; une fiche modifiée depuis est refusée avec son motif ET reste intacte ; une fiche référencée est refusée sans que rien ne soit supprimé en cascade ; un lot non appliqué ne s'annule pas ; et un lot ANTÉRIEUR s'annule sur ses lignes intactes.
*Relu contre les sources citées le 11/09/2026 — empreinte `ac752694`.*

**L1-08b** Le MOTEUR d'import — lecture du classeur, rapport, application, annulation. **[D15] [D31] [D54]**
*File :* LIVRÉ
**LIVRÉ le 11/09/2026**, par neuf tickets successifs : la grammaire (L1-08a), le classeur et le rapport (L1-08c), le rapport qui RETIENT (L1-08d), les tables (L1-08e), le rapprochement hors machines (L1-08f), l'ambiguïté (L1-08g), la validation au rapport (L1-08h), l'application (L1-08i) et l'annulation (L1-08j).
**Ce qui reste HORS de ce ticket, et qui était déjà écrit :** le **rapprochement assisté** — celui qui PROPOSE un rattachement qu'un humain confirme —, et la reprise de l'historique Winpro (L1-10), qui attend son fichier.
**CE QUI RESTE, au 11/09/2026 :** l'**application** et l'**annulation partielle**. *Les tables qu'elles écrivent existent depuis L1-08e*, `valeurs_avant` comprise — la colonne que D15 exige pour restaurer, et qu'**aucun code ne remplit encore** : avant l'application, il n'y a rien à restaurer. *Et le rapprochement sait désormais rapprocher autre chose que des machines (L1-08f), ce qui était le mur devant l'application.*
**CE QUI MANQUE ENCORE, mesuré le 11/09/2026 :** **aucun modèle d'import concret n'existe dans `lib/`** — `ModeleDImport` n'est qu'un type, et ses seuls exemplaires vivent dans des tests. *Les noms de colonnes du fichier réel ne sont pas dans le dépôt (I9), et les inventer ferait un gabarit que personne ne pourrait remplir.* C'est l'objet de **L1-09**, qui devient le prérequis de l'application.
**CE QUI LE BLOQUAIT VRAIMENT A ÉTÉ RETIRÉ le 11/09/2026 par L1-08d** — le rapport retient désormais ses lignes. *Ce qui restait à construire n'était pas seulement l'application : c'était d'abord ce qu'elle appliquerait.*
**CE QU'IL RESTE EXIGE UNE MIGRATION**, et donc un geste d'exploitation : `import_lot` et `import_lot_ligne` n'existent pas au schéma (mesuré le 11/09/2026). Une migration non appliquée fait rougir la veille nocturne — c'est l'incident du 10/09 —, et c'est la raison pour laquelle la file de nuit du 11/09 a pris les tickets d'écran avant celui-ci.
~~**BLOQUÉ sur un arbitrage**, et le blocage porte sur la liaison au classeur, pas sur le reste (question au registre du 08/09/2026).~~ **DÉBLOQUÉ le 10/09/2026 par D90** — la bibliothèque est `read-excel-file`, tranchée sur un vrai fichier d'Excel sous trois fuseaux. *La phrase est barrée et non effacée : ce qui a été décidé un jour se relit.*

**LE RAPPROCHEMENT EST CONSTRUIT le 12/09/2026** (`lib/excel/rapprochement.ts`), et il est écrit contre les **mesures du fichier réel** de l'exploitation, jamais contre une idée de ce qu'un fichier contient d'habitude :

| Mesure | Ce qu'elle impose, et ce qui a été construit |
|---|---|
| 292 machines, **aucun n° de série en double** | la série est une clé sûre *quand elle existe* |
| **4 %** sans série exploitable | la clé tolère l'absence **sans fabriquer de doublon** — trois espaces de clés DISJOINTS, prouvé plutôt qu'espéré ; *deux lignes muettes ne sont pas la même machine* |
| année de fabrication sur **96 / 292** | facultative ; son absence n'est pas une anomalie |
| **1 996** lignes d'historique, **72 %** rattachées à aucune machine | elles se reprennent **NON RATTACHÉES** — c'est une ISSUE, jamais un rejet. *Les écarter perdrait les trois quarts de l'historique* |
| onglet Clients : **652 lignes**, **55 codes réels** | `gabarit` est une nature à part, distincte de `vide` — les rejeter ferait **597 erreurs sur un fichier sain**, la panne par le bruit (§9, 11/09) |

**LA LIAISON ET LE RAPPORT SONT CONSTRUITS le 13/09/2026** (L1-08c, `lib/excel/classeur.ts` et `lib/excel/controle.ts`) : la chaîne classeur → grammaire → rapprochement → rapport est traversée de bout en bout, et éprouvée sur le VRAI fichier d'Excel — les quatre dates relevées sur la source ressortent au bon jour **à travers la couture**, là où D90 ne les avait mesurées qu'avec un appel direct à la bibliothèque. *Une suite qui éprouve tous les maillons n'éprouve pas la chaîne.*
**Ce qui RESTE de ce ticket** : l'application, l'annulation partielle, et le **rapprochement assisté** — celui qui PROPOSE un rattachement qu'un humain confirme. *Il est délibérément hors de cette couche : le rapprochement automatique se fait sur la CLÉ et jamais sur une ressemblance, un rattachement faux étant pire qu'une absence de rattachement.* Le rapprochement des 38 clients et 22 sites du parc contre les 55 codes Winpro est **un chantier à part**, et il n'est pas commencé.
~~**La comparaison est FAITE et le blocage tient à un mot** *(nuit du 11/09/2026)*.~~ *Le paragraphe qui suit est conservé barré : il dit ce qui a été mesuré, et D90 dit ce qui a été décidé à partir de là — la mesure qui manquait était **un vrai fichier d'Excel**, que l'exploitation a fourni le 10/09.* L'arbitrage conditionnel du 11/09 a été mesuré en lisant deux vrais fichiers, et **la condition ne tranche pas nettement** : à la lettre aucune bibliothèque maintenue ne rend le numéro de série, à son motif `read-excel-file` rend un `Date` **UTC invariant** par exactement la conversion de `lireDate` ; et la branche de repli est **impraticable** — `cdn.sheetjs.com` est refusé par le mandataire sortant des sessions, `pnpm install` casserait. Une troisième voie mesurée existe : **94 lignes sans dépendance**. Tout est dans `docs/decisions/2026-09-11-lecture-du-classeur-comparaison.md` ; la réponse attendue tient en un mot. **Rien n'a été installé, `package.json` est inchangé.**
Annulation **partielle et sûre** : refus motivé sur les lignes modifiées ou référencées depuis ; jamais de suppression en cascade. **Ni délai ni rang de lot** [D54] : la fenêtre de 24 h et « seul le dernier lot est annulable » sont supprimées — le critère ligne à ligne mesure directement ce que ces deux bornes approchaient, et il traite mieux le cas des imports qui se recouvrent.
**Écart mesuré entre les rangs, inscrit plutôt que tu :** D15 (rang 1) nomme `import_lot_ligne.valeurs_avant`, et le **chapitre 11 (rang 3) ne porte pas cette table** — il n'énumère qu'`import_lot`. Le rang 1 l'emporte, la table existe donc ; mais c'est le modèle de données qui est incomplet, et le corriger appartient à l'exploitation.
*Acceptation :* un fichier de 300 lignes avec 5 erreurs produit un rapport exact ; l'annulation restaure ce qui peut l'être et refuse le reste avec motif ; l'annulation d'un lot **antérieur** réussit sur ses lignes intactes et refuse, avec leur motif, celles qu'un import ultérieur a touchées ; tests sur RG-IMP-01 à 05.
*Relu contre les sources citées le 12/09/2026 — empreinte `5cca8826`.*
**L1-09a — LE GABARIT « CLIENTS », défini en code et confronté à la saisie. [D31] [RG-IMP-05]**
*File :* LIVRÉ
**LIVRÉ le 11/09/2026, et il lève le mur mesuré devant L1-08b.** *Aucun modèle d'import concret n'existait dans `lib/`* — `ModeleDImport` n'était qu'un type, ses seuls exemplaires vivaient dans des tests.
**LA DISTINCTION QUI REND CE TICKET POSSIBLE**, et sans laquelle il ne l'est pas : il y a **deux sortes de fichiers d'import**. Le **gabarit que CODIPLAN publie** tient ses colonnes de NOS schémas de saisie — ils sont dans le dépôt, on peut l'écrire aujourd'hui. Le **fichier de reprise** d'un outil tiers tient les siennes du fichier réel du client, *qui n'est pas dans le dépôt (I9)* — c'est L1-10, et il attend son fichier. Les confondre bloquait les deux.
**LE GABARIT EST CONFRONTÉ AU SCHÉMA, dans les deux sens.** La population vient du SCHÉMA et non du gabarit — *sélectionner « les colonnes du modèle » exclurait exactement le champ qu'on a oublié d'exposer* (§9, 31/08). Chaque champ est **exposé** ou **écarté nommément avec son motif** ; aucune colonne n'est orpheline ; tout champ obligatoire a une colonne obligatoire, **et la réciproque** — *un gabarit dont tout serait obligatoire refuserait des fichiers que la saisie accepte.*
**DEUX CHAMPS ÉCARTÉS, avec leur motif.** `adresse_facturation` : le chapitre 11 ne lui fixe **aucune forme**, et l'aplatir dans un tableur la figerait pour tous les clients. `actif` : *un import ne désactive pas — une colonne « Actif » ferait d'un oubli de saisie une désactivation de masse*, et la désactivation se fait fiche par fiche.
*Acceptation :* un champ retiré du gabarit sans motif rougit ; un obligatoire perdu rougit ; un obligatoire de trop rougit aussi ; et la chaîne réelle lit le gabarit — marqueur dérivé, zéro anomalie, zéro colonne inconnue.
*Relu contre les sources citées le 11/09/2026 — empreinte `5b65ed27`.*

**L1-09b — LE GABARIT « CONTACTS », et le premier qui DÉSIGNE UN PARENT. [RG-IMP-05] [D29]**
*File :* LIVRÉ
**LIVRÉ le 11/09/2026.** C'est le gabarit qui devient possible en premier parmi les quatre restants : *un contact appartient au CLIENT, et le site est FACULTATIF* (§6) — il ne désigne donc qu'un parent, et **RG-IMP-05 dit comment le rapprocher**.
**LE MODÈLE EST UNE FONCTION DU PARC**, et c'est la forme qui rend la chose possible sans changer le contrat du contrôle : *un gabarit qui désigne un parent ne peut pas être contrôlé sans ce parent* — savoir si « Garage Dupont » existe demande de regarder le parc. Passer le parc à chaque appel aurait changé la signature pour tous les modèles, y compris ceux qui ne désignent rien.
**LA MÊME CLÉ QUE LE GABARIT DES CLIENTS**, jamais une seconde : *une seconde règle de rapprochement des clients se verrait au pire moment — des contacts accrochés au mauvais client.*
**DEUX MOTIFS DE REJET DISTINCTS, et c'est ce qui les rend utiles** : une **saisie refusée** se corrige dans le FICHIER, un **parent introuvable** se corrige dans le PARC — ou dans la colonne qui le nomme. *Rendre le même code ferait chercher au mauvais endroit.*
**ET DEUX MESURES ONT CORRIGÉ CE QUE J'AVAIS ÉCRIT.** (1) Le **courriel est obligatoire**, et ce n'est pas une décision du gabarit : `canaux` vaut `["email"]` par défaut, et `exigerCourrielSiCanalEmail` refuse alors un contact sans courriel — *une ligne parfaitement remplie par ailleurs partait en rejet.* (2) L'**index du parc porte DEUX clés par fiche**, code ET nom : *avec une seule, une ligne désignant « Client A1 » par son nom proposait une CRÉATION alors que la fiche existait.* Le « s'il existe » de RG-IMP-05 porte sur **la ligne du fichier**, pas sur la fiche.
**Et le gardien a refusé une exemption que j'avais écrite par symétrie** : `actif` n'existe pas dans `schemaCreationContact` — un contact naît actif. *Une exemption qui ne s'adosse à rien n'exempte plus personne ; celle-ci a rougi le jour où elle a été écrite.*
*Acceptation :* un client désigné par son code est résolu, par son nom aussi ; un client introuvable est rejeté avec SON motif ; un client d'une autre société est introuvable — le cloisonnement passe par le parc, aucune comparaison de société n'est écrite ; un rôle inconnu change de motif ; et sans parc, tout est rejeté.
*Relu contre les sources citées le 11/09/2026 — empreinte `0fc7924a`.*

**L1-09c — LE GABARIT « SITES », et les deux règles de rapprochement qui manquaient. [D101] [D56]**
*File :* LIVRÉ
**LIVRÉ le 11/09/2026, avec D101.** Ce qui bloquait n'était plus le mécanisme — il existe depuis L1-09b — mais **la règle** : rien ne disait comment rapprocher une agence ni un site. *Le schéma a répondu, et il répond DIFFÉREMMENT pour les deux.*
**UNE AGENCE SE RAPPROCHE PAR SON CODE, ET JAMAIS PAR SON LIBELLÉ** [D101] : `@@unique([societe_id, code])` fait du code une clé ; le libellé n'en est pas une. *Un site rattaché à la mauvaise agence fausse le temps de trajet (D56), le calendrier de référence (I7) et la majoration.*
**UN SITE SE RAPPROCHE PAR LE COUPLE (client, libellé normalisé)** — *un site n'existe pas sans son client, et deux ateliers du même nom chez deux clients différents sont deux lieux.* L'ambiguïté y est possible, et elle rejette : le mécanisme de L1-08g s'applique sans une ligne de plus.
**L'ASYMÉTRIE EST UN RENSEIGNEMENT, non une incohérence** : *ce qui rend une clé utilisable n'est pas sa forme, c'est ce que la base garantit d'elle.*
**ET UN SCÉNARIO A DÛ CHANGER DE SOCIÉTÉ**, ce qui vaut d'être écrit : chez la société A, l'agence a pour code « DUCOS » et pour libellé « Ducos » — *ils coïncident à la casse près, et aucun scénario ne pouvait y distinguer une règle de l'autre.* Chez B, « SIEGE » et « Siège » sont séparés par un accent. *Écrire l'épreuve chez A l'aurait fait passer POUR UNE MAUVAISE RAISON — elle aurait montré une tolérance de casse, pas un refus de libellé.*
*Acceptation :* les deux parents résolus, la ligne passe ; le code tolère la casse ; le libellé est refusé, mesuré là où la distinction est observable ; une agence d'une autre société est introuvable ; une zone inconnue change de motif.
*Relu contre les sources citées le 11/09/2026 — empreinte `5b3d4504`.*

**L1-09d — LE GABARIT « MODÈLES DE MATÉRIEL ». [D101] [D4]**
*File :* LIVRÉ
**LIVRÉ le 11/09/2026**, et c'était bien *un ticket et non une question* : `famille_materiel` porte `@@unique([societe_id, code])`, et le motif de D101 s'y applique tel quel.
**CE QUI IDENTIFIE UN MODÈLE est le couple MARQUE + RÉFÉRENCE**, jamais la famille : *deux familles peuvent contenir un « KPX-337 » de marques différentes, et une même marque ne réédite pas sa référence.* La famille est un parent à résoudre, pas une part de l'identité.
**ET UN PIÈGE MESURÉ, QUI VAUT POUR TOUT GABARIT À VENIR :** une cellule illisible ne doit **jamais** rendre `undefined`. Le schéma porte `.default(null)` — *`undefined` déclenche donc le DÉFAUT, et une faute de frappe deviendrait une périodicité absente EN SILENCE.* Elle rend le **texte brut**, qui fait échouer `z.number()`, et le rapport dit « saisie refusée ».
**Et le gabarit ne REDIT aucune règle** : « zéro n'est pas une périodicité » est écrit dans `lib/materiel/saisie.ts`, et le modèle laisse le schéma juger.
*Acceptation :* la famille résolue par son code ; une famille d'une autre société introuvable — mesuré sur un code qui n'existe QUE chez A, **avec son témoin sur la même feuille** ; une périodicité illisible refusée ; une périodicité vide acceptée ; et zéro refusé par la saisie.
*Relu contre les sources citées le 11/09/2026 — empreinte `741868f5`.*

**L1-09** Modèles Excel téléchargeables et documentés — clients, sites, contacts, modèles, prestations.
*File :* BLOQUÉ — deux motifs distincts : la table `prestation` n'existe pas et son « taux applicable » touche l'argent facturé (issue #127) ; et le téléchargement n'aurait AUCUN appelant avant l'écran d'import (L1-11).
**QUATRE GABARITS SUR CINQ SONT LIVRÉS** — clients (L1-09a), contacts (L1-09b), sites (L1-09c), modèles (L1-09d). *Ce ticket ne reste ouvert que pour les deux moitiés qui ne sont pas des tickets.*
**PRESTATIONS — la table n'existe pas, et sa forme touche l'ARGENT.** Le §4.3 la décrit avec un **« taux applicable »** ; un catalogue qui porte un prix est un second endroit où un prix est écrit, et il faudrait dire lequel gagne quand les deux existent — *sans quoi une facture de l'an dernier changerait le jour où quelqu'un corrige le catalogue.* C'est le §1 du protocole de session : **l'argent facturé appartient à Alexis.** Ticket d'arbitrage ouvert (#127), avec trois issues chiffrées.
**TÉLÉCHARGEMENT — il n'a aucun appelant.** Il exige une bibliothèque d'**écriture** `.xlsx` (`read-excel-file` lit et n'écrit pas, D90 ; le §2 interdit le CSV), et *un gabarit téléchargeable sans écran d'où le télécharger est une interface sans appelant* — la maladie que le portail a soignée et que le lot 8 a refusé de recommencer. **Il vient avec L1-11**, l'écran d'import, et pas avant.
**LE MÉCANISME EXISTE (L1-09b) ET LES RÈGLES DE RAPPROCHEMENT AUSSI (D101, L1-09c).** Ce qui reste aux deux derniers gabarits est d'une autre nature, et **c'est MESURÉ au schéma** :
| | Ce que le schéma porte | Ce qui manque |
|---|---|---|
| ~~**modèles**~~ | ~~`modele_materiel`, dont le parent `famille_materiel` porte `@@unique([societe_id, code])`~~ | **LIVRÉ par L1-09d** |
| **prestations** | *aucune table.* Le mot désigne une **valeur de `TypeForfait`** (`prisma/schema.prisma:1289`) et un **catalogue décrit au §4.3** du cahier des charges, qui n'a jamais été créé | **la table elle-même** |
*Le SITE est désormais rapprochable (D101) : un contact pourra le désigner le jour où L1-09b sera repris.*
**Le TÉLÉCHARGEMENT exige une bibliothèque d'ÉCRITURE `.xlsx`** — `read-excel-file` lit et n'écrit pas (D90), et le §2 interdit le CSV. *C'est une dépendance, donc une décision, et elle ne se prend pas en passant.*
*Relu contre les sources citées le 11/09/2026 — empreinte `5adbee82`.*
**L1-10** Import de l'historique des ventes matériel — fiches créées avec `complet = false`, remontées en file de complétion.
*File :* BLOQUÉ — les colonnes du fichier réel ne sont pas dans le dépôt, et la fixture en a été vidée (I9). Mesuré le 11/09/2026.
**LA MESURE, plutôt qu'une supposition.** `tests/fixtures/dates-excel.xlsx` a été *« tirée PAR RETRAIT »* du fichier de l'exploitation (D90) : elle porte la **structure** — cinq feuilles, dont « 3-Parc machines » à **293 lignes sur 22 colonnes** — et **aucune cellule**. *Lu par `lireClasseur` : **0 ligne portant au moins une cellule sur 293**.* Les en-têtes sont partis avec les données, ce qui est exactement ce que I9 demande.
**CE QUI SÉPARE CE TICKET DE L1-09**, et la distinction est celle de L1-09a : un **gabarit** que CODIPLAN publie tient ses colonnes de NOS schémas — on peut l'écrire. Un fichier de **reprise** tient les siennes du fichier du client, *et les inventer ferait un lecteur qui ne lit rien.*
**CE QU'IL FAUDRAIT POUR LE DÉBLOQUER**, et c'est peu : **la ligne d'en-têtes** des feuilles « 3-Parc machines » et « 1-Demandes SAV » — 22 et 16 noms de colonnes. *Ce ne sont pas des données client ; elles peuvent entrer au dépôt sans enfreindre I9.* Le reste est construit : la grammaire, le classeur, le rapprochement, le rapport, l'application et l'annulation.
*Relu contre les sources citées le 11/09/2026 — empreinte `844fc8ec`.*

---

## Lot 2 — Parc et interventions (4 semaines)

**L2-01** Fiche machine. **[D6] [D7] [D10] [D22] [D55]**
*File :* LIVRÉ
**Quatre champs obligatoires** : `modele_id`, `client_id`, `site_id`, `numero_serie`. Numéro illisible → `SN-INCONNU-<référence>` et `complet = false`.
`id` en UUID v7 généré côté client ; `numero` attribué par le serveur à la synchronisation ; affichage `Local-<6 car.>` tant qu'il est nul.
**LIVRÉ le 09/09/2026.** La TROISIÈME et dernière fixture du parc s'est effacée devant la vraie table, et le contrat de R0-a a été honoré : la clause de politique est **exactement** celle que le harnais posait, si bien que les scénarios de `qr-code.test.ts` et de `portail-client.test.ts` s'y sont reportés **sans qu'une ligne change**. Les planchers de `EXIGENCES_L0_05` MONTENT — `qr_inter_societe` de 3 à 5, `perimetre_sites` de 4 à 6.
**Ce qui n'est PAS fait, et qui est écrit plutôt que tu :** **personne n'attribue `numero`.** La colonne existe, son unicité par société est posée, et le compteur par société appartient à la **synchronisation (lot 3)** — l'inventer ici poserait une règle que personne n'a décidée. Toute fiche créée aujourd'hui porte donc `numero = NULL`, ce qui est exactement l'état que D7 décrit pour une machine non synchronisée.
**Un écart de rang corrigé au passage :** le chapitre 11 écrivait que `reference_interne` était « portée par le QR ». **I10 et D7 disent le contraire** — le QR encode le `qr_token`, jamais autre chose. La ligne est amendée, et `numero` entre au chapitre 11, où elle manquait.
*Acceptation :* unicité (société, modèle, n° de série) sans NULL ; aucun doublon silencieux possible.
*Relu contre les sources citées le 11/09/2026 — empreinte `f8c8ec52`.*
**L2-02** QR codes — le jeton est ~~dérivé de l'`id`~~ **TIRÉ AU SORT** (D71), jamais du numéro. Résolution serveur avec **contrôle de société** [D22] [D7] [D71]. Le filet base de données est déjà éprouvé sur la fixture `machine` ; les scénarios se reportent sur la vraie table, ils ne disparaissent pas avec la fixture (contrat R0-a). Planches pré-générées pour le recensement.
*File :* LIVRÉ
**LIVRÉ EN PARTIE le 09/09/2026 — la dérivation et la résolution ; PAS l'impression.**
`lib/machines/qr.ts` **tire** le jeton au sort — `randomBytes`, base32, 26 caractères, soit **130 bits tous aléatoires** —, calculable **hors ligne** (I4) : `randomBytes` ne demande aucun réseau. `lib/machines/resolution.ts` et `GET /api/machines/qr/{jeton}` résolvent **sous le contexte**, le contrôle de société étant fait par la politique et non par une comparaison écrite au-dessus. Les planchers de `EXIGENCES_L0_05` **montent** — `qr_inter_societe` de 5 à 8, `perimetre_sites` de 6 à 7.
**Trois choses écrites plutôt que tues.** L'entropie du jeton est **réelle** — 130 bits tirés, là où la version dérivée en affichait 130 et n'en portait que 74, ceux de l'UUID. Un jeton inconnu et le jeton d'une autre société rendent **la même chose**, faute de quoi ce chemin serait un oracle (D35, D50). Et la lecture ne contrôle **pas la forme** du jeton : il est stocké, et un contrôle de forme lierait les scans du jour à la génération du jour.
**LE JETON EST UN SECRET, tranché le 09/09 (D71), et le rendez-vous est LEVÉ.** Il était dérivé, donc prévisible pour qui connaît l'`id` ; il est désormais tiré au sort. La raison est asymétrique : le faire maintenant ne coûte rien, le faire quand RG-DRO-02 sera implémentée coûterait de **réétiqueter physiquement tout le parc**. *Une valeur dont on sait qu'on lui demandera un jour de porter une autorité doit naître capable de la porter.* Il n'y a plus de décision à prendre avant la première campagne de recensement.
**D7 se contredisait, et D71 le répare** : « dérivé de l'UUID » et « jetons pré-générés téléchargés avant le départ » ne peuvent pas être vrais ensemble. `engendrerPlancheDeJetons` rend enfin réalisable la moitié dont le recensement a besoin.
**CE QUI RESTE :** l'**impression** des planches attend une décision d'exploitation — planches autocollantes standard ou imprimante portable dédiée —, qui est la **question ouverte n° 6** du cahier des charges. Ce n'est pas un format à choisir mais un fait de terrain à constater. La GÉNÉRATION, elle, est livrée.
*Relu contre les sources citées le 10/09/2026 — empreinte `01b2854a`.*
**L2-03** Compteurs — non-régression après réordonnancement par `horodatage_terrain` [3.12].
*File :* LIVRÉ
**LIVRÉ le 11/09/2026** — la RÈGLE, en pur, sans base. *L'ordre d'arrivée n'est pas l'ordre des faits* : un technicien relève un compteur à 8 h dans un atelier sans réseau, un autre à 10 h dans un atelier couvert, et le second arrive le premier. **Contrôler dans l'ordre d'arrivée signalerait une régression là où il n'y en a aucune — et n'en verrait pas une là où elle est.** Les deux moitiés sont mesurées.
**CE QUE 3.12 NE DIT PAS, ET QUI EST TRANCHÉ ICI :** elle dit qu'un contrôle s'applique, **pas ce qu'il fait d'un relevé qui régresse**. *Il est CONSERVÉ et SIGNALÉ*, pour deux raisons qui se renforcent — I5, *le travail terrain n'est jamais perdu* ; et le métier, **un compteur remplacé repart de zéro**, si bien que *refuser la régression rendrait impossible de saisir le premier relevé d'un compteur neuf, c'est-à-dire de dire la vérité.* **Le coût est nommé** : une anomalie signalée réclame un œil ; refuser aurait coûté la donnée, ce qui est pire et irréversible.
**CE QUI RESTE, et c'est un AUTRE ticket :** la table `compteur_releve` (chapitre 11) et son écriture. *Une table sans appelant est la maladie que ce dépôt soigne* — elle viendra avec ce qui la remplit : la saisie à l'intervention, ou la synchronisation du lot 3. La règle, elle, sera prête.
*Acceptation :* deux relevés arrivés à l'envers ne régressent pas ; une vraie régression est vue même arrivée dans le bon ordre ; à horodatage égal l'ordre est STABLE ; deux machines et deux types ne se comparent pas, **mais deux relevés de la même suite si** ; rien n'est jeté ; un verdict est rendu pour tous.
**L2-04** Documents machine — visibilité client, marquage « embarqué mobile ».
*File :* LIVRÉ — **par le LOT 8, et ce ticket ne le savait pas.** Constaté le 11/09/2026.
**LE RENDEZ-VOUS CI-DESSOUS A EU LIEU, et il a été tenu ailleurs.** Ce ticket posait trois formes possibles pour le polymorphisme et concluait *« ce n'est pas tranché ici »*. **Il l'a été depuis** — D87 pour la forme, D93 pour la politique —, et le texte qui suit est resté à décrire une question déjà close. *C'est l'exact défaut que le gardien de cohérence du backlog attrape sur les SOURCES, et qu'il ne peut pas attraper sur l'ÉTAT du dépôt : un ticket rendu faux par du code, non par une décision.*
**Mesuré, plutôt que supposé :** `document` existe au schéma (2 occurrences de `model Document`) ; la troisième forme est celle qui vit — `CHECK (num_nonnulls("modele_id", "machine_id") = 1)`, migration `20260913100000_documents_l8` ; la **visibilité client** est la colonne `classe`, qui *RÉTRÉCIT et n'ouvre rien* (L8-04) ; la politique est la **onzième forme**, « héritage » (D93) ; et `lib/documents/` porte `depot.ts`, `saisie.ts`, `propositions.ts`.
**CE QUI N'EST PAS REPRIS, et le chapitre 11 l'écrit déjà :** le marquage **« embarqué mobile »**. *Le cache hors ligne est décidé au lot 3, pas par une colonne posée d'avance.* Ce n'est donc pas un reste de ce ticket : c'est une décision qui appartient à un autre lot.
**UN RENDEZ-VOUS PLUTÔT QU'UNE EMBUSCADE, posé le 11/09/2026 avec ses mesures.** Le chapitre 11 décrit `document` comme une **entité polymorphe** rattachée à machine, contrat, client **ou** intervention. C'est la classe exacte de `perimetre_sites uuid[]` (D79) : *une forme que la base ne sait pas contraindre*. Trois formes mesurées sur PostgreSQL 16, base jetable :
| Forme | Ce que la base en fait |
|---|---|
| une colonne `entite_id` + deux clés étrangères | **acceptée au DDL**, et elle **refuse toute ligne légitime** — la valeur devrait exister dans les DEUX tables (`violates foreign key constraint "fk_client"` sur un document de machine). *Pire qu'une absence de verrou : elle a l'air d'un verrou et rend la table inutilisable* |
| une colonne `entite_id` + un `CHECK` qui interroge la table cible | **refusée** — `cannot use subquery in check constraint` |
| **une colonne NULLABLE par cible + `num_nonnulls(...) = 1`** | **fonctionne** : de vraies clés étrangères, et exactement une cible — la deuxième insertion à deux cibles est refusée par la contrainte nommée |
**Ce n'est pas tranché ici** : le choix de forme engage le modèle, et la **politique** de `document` pose en outre la même question que `intervention` — RG-DRO-01 veut qu'un client ne voie que ses propres documents. Deux des quatre cibles n'existent pas encore. *Ce qui est acquis, et qui évite de le redécouvrir : la première forme est un piège mesuré, la troisième marche.*
*Relu contre les sources citées le 11/09/2026 — empreinte `90f32e53`.*
**L2-05** Historique machine — conservé au changement de site.
*File :* LIVRÉ
**LIVRÉ le 11/09/2026.** La faute que ce ticket existe pour éviter est **SILENCIEUSE** : *la façon naturelle d'écrire cette lecture est de partir du site de la machine* — « les interventions de ce site, sur cette machine ». Elle rend un historique **amputé de tout ce qui précède le déménagement**, sans rien dire : *l'écran affiche trois interventions au lieu de douze, et personne ne sait qu'il en manque neuf.*
**La lecture part donc de la MACHINE, et `site_id` n'apparaît dans AUCUN filtre.**
**ÉPROUVÉ SUR LA FAUTE TELLE QU'ELLE SE COMMETTRAIT** : le filtre de site remis dans la lecture, deux scénarios rougissent — dont le témoin —, et le vert revient une fois défait.
**LES SITES TRAVERSÉS SE DÉDUISENT**, aucune table ne les porte : *une colonne « site précédent » serait une seconde écriture du même fait, qui diverge en silence* (§9, 01/09). **Ce qu'ils ne disent pas est écrit** : un déménagement SANS intervention entre les deux ne laisse aucune trace — le journal d'audit la porte (`machine` est auditée, I8/D55), et c'est là qu'il faudra la lire le jour où quelqu'un la demandera.
*Acceptation :* l'historique porte deux sites distincts (témoin) ; après un déménagement RÉELLEMENT constaté — la machine a bien changé de site, mesuré — il ne bouge pas d'une ligne ; et un compte portail restreint ne voit que son périmètre, **par la base et non par un filtre applicatif**.
*Relu contre les sources citées le 11/09/2026 — empreinte `375e74a3`.*
**L2-06** Demandes — statuts `NOUVELLE`, `QUALIFIEE`, `TRANSFORMEE`, `CLOSE_SANS_SUITE` ; motifs `resolue_telephone`, `hors_perimetre`, `refus_client`, `doublon` [3.5]. Horodatage de l'accusé de réception en **heures ouvrées de l'agence** [D13]. **[D102]**
*File :* LIVRÉ
**LIVRÉ le 11/09/2026.** La table `demande`, ses trois énumérations, son cycle de vie tenu **deux fois** — par `lib/demandes/cycle-de-vie.ts` qui EXPLIQUE et par le déclencheur `demande_cycle_de_vie` qui GARDE —, et le standard des 30 minutes mesuré en heures ouvrées de l'agence.
**LA FORME DE POLITIQUE EST « PARC » (D102), et ce n'est pas `intervention` bis.** C'est la **seule table du lot 2 où un compte de PORTAIL ÉCRIT** (chapitre 9, parcours P5) : une clause trop large n'y aurait pas fait fuir une lecture, elle aurait laissé **un client déposer une demande au nom d'un autre**. Le `WITH CHECK` est donc écrit explicitement plutôt que laissé à PostgreSQL.
**LA MESURE QUI VAUT D'ÊTRE RELUE**, prise avant de déclarer l'entrée : la table portait **déjà** la forme « parc » et le gardien de forme était **VERT** — `formeAttendue` rend « société » pour une table non déclarée, et *une politique plus stricte satisfait une attente plus lâche*. Politique remplacée par la clause de société seule, `demande` non déclarée : **0 écart**. La même faute, l'entrée déclarée : le gardien **nomme la table et le filtre perdu**. *Une table jamais déclarée est dans le même état qu'une table retirée* — le sens silencieux de R0-a, manifesté avant qu'une entrée existe.
**L'ACCUSÉ DE RÉCEPTION PORTE DEUX INSTANTS, pas un.** Le dépôt, et le **départ du compteur** — *« une demande déposée un dimanche à 22 h déclenche son compteur à l'ouverture du lundi »* (D13). Le second est **MATÉRIALISÉ et jamais recalculé** : un calendrier se modifie, et déclarer un férié travaillé ferait reculer des mois plus tard le départ d'un compteur déjà consommé, **sans qu'aucune écriture ne le dise** (le motif de D85, hors cloisonnement).
**TROIS ÉTATS, JAMAIS UN BOOLÉEN** : *« sans réponse »* n'est ni *« dans les temps »* ni *« hors délai »*, et les trois ne se corrigent pas pareil. `departCompteurAccuse` existait depuis L0-08 **sans aucun appelant** ; ce ticket est son premier.
**CE QUI N'EST PAS FAIT, et qui est nommé plutôt que simulé :** la transformation **ne crée pas l'intervention**. Le lien vit sur `intervention.demande_id` (chapitre 11), la colonne n'existe pas, et *une transformation que rien ne peut relire est pire qu'une absente.* Le statut et son verrou sont livrés ; la création appartient à la qualification.
*Acceptation :* les trois filtres de la forme « parc » se séparent sur des demandes réelles (société, client, périmètre) ; chaque transition refusée par le module l'est aussi par la base, **avec le jumeau qui retire le déclencheur et montre l'écriture fautive passer** ; une clôture sans motif ET un motif sans clôture sont refusés ; le départ du compteur diffère du dépôt un dimanche soir et lui est égal en pleine ouverture.
*Relu contre les sources citées le 11/09/2026 — empreinte `1e672720`.*
**L2-07** Cycle de vie des interventions. **[D8]**
*File :* LIVRÉ
**BLOQUÉ sur un ARBITRAGE DE CLOISONNEMENT, posé avec sa mesure le 11/09/2026** — et le blocage vaut pour tout le reste du lot 2, qui dépend de cette table. La clause de société seule est **exclue par mesure** (RG-DRO-01, rang 2 : un compte portail lirait toutes les interventions de sa société) ; le plancher est la forme **« parc »** ; ce qui reste à trancher est **RG-DRO-02**, la restriction du technicien, qui serait une **dixième** forme et la première dont la vérité dépendrait de l'horloge. Trois voies et leur mesure au registre « Ce qui reste à décider ». **Rien de cette table ne s'écrit avant.**
Huit statuts : `A_PLANIFIER`, `PLANIFIEE`, `AFFECTEE`, `EN_COURS`, `SUSPENDUE`, `TERMINEE`, `CLOTUREE`, `ANNULEE`. `statut_facturation` est une colonne **distincte**.
Matrice des transitions autorisées : voir D8 du document d'arbitrage.
*Acceptation :* chaque transition hors matrice est refusée avec un message explicite ; `SUSPENDUE` peut revenir vers `A_PLANIFIER`, `PLANIFIEE` et `EN_COURS` ; tests sur RG-INT-01 à 11.
**Un écart de rang relevé à la relecture du 11/09/2026, inscrit plutôt que corrigé en passant :** RG-INT-10 (rang 2) marque une intervention `retour = true`, et **le chapitre 11 ne porte pas cette colonne** sur `intervention`. C'est l'espèce exacte de `import_lot_ligne.valeurs_avant`, réparée le 09/09 : le rang 1 ou 2 nomme, le modèle de données ne porte pas. Le rang l'emporte, donc la colonne existera ; c'est le chapitre 11 qui est incomplet, et le corriger appartient à l'exploitation.
*Relu contre les sources citées le 11/09/2026 — empreinte `05e393cf`.*
**L2-08** Interventions multi-machines et multi-techniciens. Machine facultative pour `expertise`, `installation` et **`recensement`** [D16].
*File :* BLOQUÉ — scindé en L2-08a (livré) et L2-08b, qui n'est pas du travail de ticket : voir L2-08b.
**SCINDÉ le 11/09/2026, et le motif est mesuré.** Les deux moitiés n'ont ni la même taille ni la même nature. *La multiplicité des MACHINES est une table fille et une règle ; celle des TECHNICIENS change le sujet d'une règle de rang 2 et l'axe de tout le planning.* Les livrer ensemble aurait fait un commit qui couvre deux tickets, ce que le §7 du CLAUDE.md refuse.
*Relu contre les sources citées le 11/09/2026 — empreinte `88a7dc5a`.*

**L2-08a** Interventions multi-machines — `intervention_machine`, et RG-INT-01 vérifiable. **[D16] [D103]**
*File :* LIVRÉ
**LIVRÉ le 11/09/2026.** `intervention_machine`, forme de politique **« filiation »** (D103), et `intervention.machine_id` **SUPPRIMÉE** — pas conservée « pour la principale », ce qui aurait fait deux écritures d'un même fait (§9, 01/09). Les lignes existantes sont **reprises par la migration** avant la suppression.
**LE PARENT EST `intervention`, ET PAS `machine`**, et c'est la seule décision de fond : *l'intervention est ce qui décide QUI a le droit de voir cette ligne ; la machine n'est que ce dont elle parle.* Adosser la clause à `machine` aurait rendu visible le rattachement d'une visite qu'on n'a pas le droit de lire, dès lors qu'on voit le matériel.
**LA POLITIQUE NE RECOPIE RIEN**, et un scénario le prouve en **LISANT la clause** : elle ne nomme ni `app.client_id` ni `app.perimetre_sites`, les trois filtres se propageant depuis le parent. *Recopier les filtres aurait passé tous les autres scénarios* — c'est le seul moyen de distinguer les deux.
**RG-INT-01 DEVIENT VÉRIFIABLE**, au moment que la règle nomme elle-même : *« avant de démarrer »*, jamais à la création — le dépannage à l'aveugle est le cas ordinaire. **Trois statuts, pas un** : la base garde des ÉTATS et non des trajets, et ne surveiller que `en_cours` laisserait passer un saut direct vers `terminee`.
**LA LIMITE EST ÉCRITE PLUTÔT QUE TUE :** le contrôle ne voit que les TRANSITIONS, un `INSERT` direct dans un statut de travail lui échappe, et la contrainte différée qui le fermerait refuserait les interventions de démonstration — **`prisma/seed.ts` ne crée AUCUNE machine** (mesuré). Condition de réouverture au registre D103.
*Acceptation :* les trois filtres se propagent sans être réécrits (mesuré sur la clause ET sur les lignes) ; une intervention curative sans machine refuse de démarrer, la même avec une machine démarre, et les trois types dispensés démarrent sans ; le saut direct vers `terminee` est gardé aussi ; **le jumeau retire le contrôle et montre le démarrage sans machine passer** ; la cascade est mesurée, pas déclarée.
*Relu contre les sources citées le 11/09/2026 — empreinte `64b7b93d`.*

**L2-08b** Interventions multi-techniciens — affectation multiple, technicien référent.
*File :* BLOQUÉ — ce n'est pas du travail de ticket : c'est l'AXE du planning, et une règle de rang 2 change de sujet. Mesuré le 11/09/2026.
**CE QUE LE CAHIER DEMANDE :** *« Une pose de pont élévateur mobilise deux personnes : affectation multiple avec un technicien référent responsable du rapport »* (chapitre 7/M3).
**POURQUOI CE N'EST PAS UN TICKET, mesuré par `grep` plutôt que supposé.** `intervention.technicien_id` est lu par **neuf modules** — `grille.ts`, `journee.ts`, `occupation.ts`, `statistiques.ts`, `pose.ts`, `depot.ts`, `saisie.ts` — et par **trois écrans**. Le planning tient une **ligne par personne** ; l'affectation multiple ne remplace pas une colonne par une table, *elle change ce qu'une ligne du planning représente.*
**ET UNE RÈGLE DE RANG 2 CHANGE DE SUJET, D99 l'avait ÉCRIT :** *« Le jour où une intervention pourra être posée sur DEUX techniciens — une pose à plusieurs, que le modèle ne porte pas aujourd'hui —, la notion de chevauchement change de sujet et RG-PLA-03 se relit. »* **La condition de réouverture posée par Alexis cette nuit se déclenche donc ici.** Le prolongement naturel — *chaque technicien affecté, pris séparément, ne se chevauche pas* — n'est pas une évidence à décider en séance : il décide aussi ce que devient la CHARGE (deux personnes sur une intervention de deux heures font-elles deux heures ou quatre ?), et cela se lit dans `occupation.ts`, qui alimentera les indicateurs.
**CE QU'IL FAUDRAIT POUR LE DÉBLOQUER, et c'est court :** un mot sur les deux questions ci-dessus — le chevauchement par technicien, et le décompte de la charge. *Le reste est du travail, et il est chiffré : une table `intervention_technicien` avec son drapeau `referent`, la forme « filiation » déjà construite, et la reprise des neuf lectures.*
*Relu contre les sources citées le 11/09/2026 — empreinte `a9644953`.*
**L2-09** Valorisation. **[D11] [D12] [D45] [D57] [D74] [D77] [D83]**
*File :* BLOQUÉ — scindé le 11/09/2026 : **L2-09a** est livré, **L2-09b** attend un arbitrage (issue #133) et **L2-09c** deux tables qui n'existent pas.
Quart d'heure supérieur, cumul par technicien, attente non facturée, trajet couvert par le forfait de zone **et jamais facturé au temps** [D74], un seul forfait de déplacement par intervention, majoration +50 % sur la main-d'œuvre seule au prorata. **Les « heures excédentaires » de D11 sont, depuis Q4 (09/09/2026, **numérotée D77** le 11/09), TOUTES les heures d'intervention** : un forfait s'ajoute toujours aux heures, `forfait.heures_incluses` n'existe plus.
Ordre : forfaits → **arrondi au quart d'heure supérieur, puis plancher d'une heure** [D83] → heures excédentaires → majoration → total HT. **L'arrondi et le plancher s'appliquent UNE SEULE FOIS, sur l'intervention entière**, jamais tâche par tâche : `lib/tarification/valorisation.ts` les porte tous deux.
**L'arrondi au quart d'heure vit ici** [D45], et nulle part ailleurs — ni dans `lib/calendar`, ni dans `lib/money`. Raison : le calendrier répond à « quand » — jours ouvrés, horaires, fuseaux — et n'a pas à connaître la politique de facturation, sinon un changement de tarif pourra casser un planning ; le module monétaire formate et calcule, il ne décide pas ce qu'on facture.
~~**À trancher AVANT d'écrire ce ticket** [D45] : l'arrondi s'applique-t-il à **chaque intervention** ou au **total d'une journée** ?~~ **TRANCHÉ le 07/09/2026 [D57] : PAR INTERVENTION** — cinq passages de cinq minutes font ~~1 h 15~~ **cinq heures depuis [D83]** (09/09/2026), qui ajoute un **plancher d'une heure** par intervention à l'arrondi. La MAILLE de D57 ne bouge pas ; c'est le plancher qui change le prix, et il ne s'applique **ni au forfait, ni au trajet, ni au travail interne**.
*Relu contre les sources citées le 11/09/2026 — empreinte `28ebdc1d`.*

**L2-09a** Le total hors taxes — la composition, et deux totaux qui étaient faux. **[D11] [D77] [RG-INT-07]**
*File :* LIVRÉ
**LIVRÉ le 11/09/2026, et le ticket n'a pas commencé par du code : il a commencé par deux MESURES sur ce que l'écran affichait.**
**1. LE FORFAIT DE DÉPLACEMENT N'ENTRAIT DANS AUCUN TOTAL.** `intervention.forfait_deplacement_id` le désignait depuis D84, et la clôture écrivait `montant_ht = mainDoeuvre` — *« Total hors taxes » portait la main-d'œuvre seule*, alors que RG-INT-07 fait du forfait de zone LE mode de facturation du déplacement et que D77 écrit qu'*un forfait s'ajoute toujours aux heures*.
**2. UNE INTERVENTION AU FORFAIT SE CLÔTURAIT À ZÉRO.** `totalHT: montant(0, …)`. *Zéro est une réponse : il dit « cela ne coûte rien » là où il faut lire « je ne sais pas encore »* — rien ne sélectionne de forfait de PRESTATION, `forfaitRetenu` n'étant appelé que pour le déplacement. Le total est désormais **`null` avec son motif**, jamais nul (doctrine §3).
**LA COMPOSITION ÉTAIT « NON TRANCHÉE », ET ELLE NE L'EST PLUS.** L'en-tête de `valorisation.ts` refusait toute fonction « valoriser une intervention » au motif que *la composition forfait + excédent n'est pas tranchée*. **D77 l'a tranchée le 09/09** — la phrase d'origine est conservée en tête, comme le dépôt conserve ce qu'il barre.
**CE QUI N'EST PAS FAIT, ET POURQUOI :** la **majoration hors ouverture** (D12). Son taux et son assiette sont écrits ; **la BASE de son prorata ne l'est pas** — voir L2-09b.
*Acceptation :* au temps passé, le montant ÉCRIT EN BASE vaut main-d'œuvre + forfait ; sans forfait applicable il vaut la main-d'œuvre seule, et c'est un PRIX et non une inconnue (D11) ; au forfait, la base porte `NULL` et non zéro, avec le motif rendu à l'écran ; le même décor au temps passé écrit un montant — **le `null` vient bien du mode** ; deux devises rendent un total inconnu plutôt qu'une somme (I2).
*Relu contre les sources citées le 11/09/2026 — empreinte `3a0dc31c`.*

**L2-09b** La majoration hors ouverture. **[D12] [D13]**
*File :* BLOQUÉ — arbitrage d'Alexis, **issue #133** : cela touche l'argent facturé (§8).
**CE QUI EST DÉCIDÉ ET NE SE ROUVRE PAS :** taux **+50 %**, assiette **main-d'œuvre seule**, calendrier de l'**agence du technicien** (D12, D13).
**CE QUI NE L'EST PAS :** *« au prorata, quart d'heure par quart d'heure »* suppose que la durée facturée et le créneau COÏNCIDENT. **Ils ne coïncident pas** — la main-d'œuvre se calcule sur `temps_reel_min` arrondi puis planché (D83), les minutes hors ouverture se lisent sur le créneau. Créneau 16 h–18 h, fermeture à 17 h, travail de 30 minutes : **50 % ou 0 % selon la base retenue**, et l'écart se voit sur la facture. Deux issues chiffrées et une recommandation à l'issue #133.
*Relu contre les sources citées le 11/09/2026 — empreinte `8c46ece6`.*

**L2-09c** Les lignes de temps — trajet, attente, cumul par technicien. **[D11] [D74]**
*File :* BLOQUÉ — deux dépendances mesurées le 11/09/2026, et aucune n'est du travail de ce ticket.
**`intervention_temps` N'EXISTE PAS** (mesuré : aucune occurrence au schéma). Le chapitre 11 la décrit — technicien, type (trajet, intervention, attente, pause), début, fin, durée, facturable — et c'est elle qui porte *« attente non facturée par défaut »* et *« une ligne de type trajet n'est jamais facturable »* (D11, D74, RG-INT-07). Aujourd'hui `intervention.temps_reel_min` est **un seul nombre**, qui EST le temps d'intervention : la règle « hors trajet et hors attente » est donc satisfaite **par construction**, et c'est pour cela que L2-09a a pu être livré sans elle.
**LE CUMUL PAR TECHNICIEN DÉPEND DE L2-08b**, lui-même bloqué : *« 2 techniciens × 3 h = 6 h facturées »* (D11) n'a pas de sujet tant qu'une intervention ne porte qu'un technicien.
*Relu contre les sources citées le 11/09/2026 — empreinte `bb397ccd`.*
**L2-10** File « en attente de pièce » — motif, référence, date prévisionnelle, ancienneté. **[RG-INT-06]**
*File :* LIVRÉ
**LIVRÉ le 11/09/2026.** Le statut `suspendue` existait depuis D84 ; **rien ne portait le motif**, et une intervention pouvait s'arrêter sans qu'on sache pourquoi.
**CE QUI DÉSIGNE UNE ATTENTE DE PIÈCE EST LA RÉFÉRENCE, PAS UN CODE.** *Aucune énumération de motifs n'est inventée* — le chapitre 10 n'en pose pas, et fermer une énumération avant d'avoir tranché à qui l'on vend est une erreur que ce dépôt a déjà faite (§9, 20/08). La présence de `piece_attendue_ref` dit que la suspension en est une.
**QUATRE CONTRAINTES, ÉCRITES DANS LES DEUX SENS** : motif ⟺ suspension, date de suspension ⟺ suspension, référence ⟺ horizon, et une attente de pièce SUPPOSE la suspension. *Une référence sans date ferait une file sans horizon — celle que l'alerte « > 30 j » du chapitre 16.1 ne saurait pas trier.*
**LA REPRISE N'EFFACE RIEN CÔTÉ APPLICATIF** : le déclencheur `intervention_sortie_de_suspension` remet les quatre colonnes à NULL, parce que les contraintes l'exigent déjà — le faire aussi en TypeScript serait une seconde lecture du même critère. Et **le nom du déclencheur décide de l'ordre** : PostgreSQL exécute les `BEFORE` par ordre alphabétique, `intervention_cycle_de_vie` prononce donc ses refus AVANT ce nettoyage.
**UNE INTERVENTION DÉJÀ SUSPENDUE NE SE RE-SUSPEND PAS**, et ce n'est pas de la prudence : ce serait écraser `suspendue_le`, c'est-à-dire **rajeunir l'attente** que la file mesure.
**`suspendue_le` EST AJOUTÉE, et le chapitre 11 ne la nomme pas** — écart de rang inscrit plutôt que tu. Sans elle, l'ancienneté se lirait dans le journal d'audit : *une trace n'est pas un index.* `cloturee_le` et `annulee_le` existent pour la même raison.
**L'ANCIENNETÉ SE COMPTE EN JOURS D'HORLOGE, pas en jours ouvrés** : le fournisseur ne livre pas le samedi, mais la pièce n'arrive pas non plus. C'est l'inverse du compteur d'accusé de réception (D13), et l'écart est délibéré.
*Acceptation :* la base refuse les quatre états interdits **en nommant sa contrainte**, et le jumeau retire celle du motif et montre la suspension sans motif passer ; la reprise rend le statut que le créneau dicte et la base efface les quatre colonnes ; une seconde suspension est refusée ; la file ne retient que les attentes de pièce, les ordonne de la plus vieille, et l'instant courant y est un PARAMÈTRE — la même file à deux instants rend deux anciennetés.
*Relu contre les sources citées le 11/09/2026 — empreinte `90b24657`.*

---

## Lot 3 — Planning et PWA (5 semaines)

**L3-01** Vue calendrier ressources avec **Schedule-X** [D17], glisser-déposer, redimensionnement. **[D72]**
*File :* BLOQUÉ — scindé le 11/09/2026 : **L3-01a** (la table `technicien` et la règle de priorité) est LIVRÉ ; l'écran reste à faire, et c'est L3-01b.
*Relu contre les sources citées le 11/09/2026 — empreinte `2f11cb5b`.*

**L3-01a** La table `technicien`, et la règle de priorité du calendrier de travail. **[D72] [D12] [D13]**
*File :* LIVRÉ
**LIVRÉ le 11/09/2026.** Le ticket L3-01 écrit lui-même sa dépendance : *« la table `technicien` (utilisateur, société, **agence**, actif), à créer au lot 3 AVANT l'écran »*. Ce n'est donc pas un scindement de confort — c'est la décomposition que le ticket porte.
**TROIS COLONNES DU CHAPITRE 11 NE SONT PAS CRÉÉES, et chacune pour une raison écrite.** `cout_horaire` et `taux_facturation_defaut` : *c'est le piège de `societe.taux_horaire_defaut`, RETIRÉE le 09/09* — deux sources d'un même fait qui divergent en valeur, et le taux vit dans `taux_horaire` historisé (RG-TAR-04). `vehicule` : rien ne le lit, et *une colonne inerte n'est pas neutre, elle est une invitation* (D77).
**LE CALENDRIER PROPRE N'EST PAS DANS CETTE TABLE** : `technicien_calendrier` le porte déjà, sur la MÊME clé. L'y ajouter aurait fait deux écritures d'un même fait.
**LA RÈGLE DE PRIORITÉ VIT DANS `lib/calendar/technicien.ts` ET NULLE PART AILLEURS** (D72) : horaires propres s'il en a, sinon ceux de son agence ; **fuseau, territoire, fériés et ponts TOUJOURS ceux de l'agence**. *Un technicien travaille le samedi par exception ; il ne décrète pas les fériés de son territoire* — c'est la ligne de partage de D46, appliquée à une personne.
**ELLE A UN APPELANT LE JOUR MÊME**, et il était écrit : `occupation.ts` portait *« le calendrier de travail PROPRE au technicien n'est pas encore consulté ici ; le jour où il le sera, c'est lui qui fera foi »*. C'est ce jour. La mise en cache du dénominateur suit désormais le COUPLE (technicien, agence) — *deux techniciens de la même agence peuvent avoir deux dénominateurs.* Le repli reste l'agence de l'intervention, et il est nommé : *rendre « inconnu » là où l'on savait répondre serait une régression déguisée en rigueur.*
**ET LE SEED ÉCRIT ENFIN CE QU'IL SAVAIT DÉJÀ** : `TECHNICIENS_PAR_AGENCE` portait le rattachement **sans avoir où l'écrire**.
**TROIS DÉFAUTS MESURÉS AU PASSAGE, ET LE PREMIER EST GRAVE.** *(1)* **`technicien_calendrier` était INÉCRIVABLE** : `journal_audit_tracer` lève quand la table n'expose aucune colonne `id`, le déclencheur y était posé depuis le paramétrage par agence, et **aucun `INSERT` n'a jamais abouti** — personne ne l'avait vu parce que personne n'écrivait. La colonne est ajoutée, et **un gardien nouveau confronte toute table auditée à l'existence d'un `id`** : mesuré, il nomme `technicien_calendrier` dès qu'on la lui retire. *(2)* Le seed lisait `agence` **sans filtre société** : le rôle de migration étant superutilisateur en local, il a rendu l'agence d'une autre société et la clé étrangère l'a refusé (§5.6, §9 du 07/09). *(3)* Un scénario voisin comptait « exactement un calendrier » là où la question est « à qui sont-ils » — l'assertion porte désormais sur les sociétés.
*Acceptation :* sans calendrier propre, le technicien travaille aux horaires de son agence ; avec, ce sont les siens — **et le fuseau, le territoire et les fériés restent ceux de l'agence**, avec le témoin qui montre que les plages, elles, diffèrent ; le nombre d'heures ouvrées de la semaine en change ; un technicien sans rattachement rend `null`, et le même appel rattachement posé rend un calendrier.
*Relu contre les sources citées le 11/09/2026 — empreinte `ab5664c5`.*

**L3-01b** L'ÉCRAN de planning ressources — Schedule-X, glisser-déposer, redimensionnement. **[D17] [D72]**
*File :* LIVRÉ
**LIVRÉ le 11/09/2026 — MOINS Schedule-X, et cet écart est un ARBITRAGE porté au registre, pas une décision de ticket.** *Mesuré avant d'écrire une ligne :* l'écran que ce ticket décrit **existe depuis R2-12 et R2-19** — vue jour, colonnes par personne, axe d'heures réglé au pas de l'agence, glisser-déposer natif, refus nommés. **La seule pièce manquante était le REDIMENSIONNEMENT**, et `components/planning/pose.tsx` le disait lui-même : *« Schedule-X viendra au lot 3 avec le redimensionnement, qui lui n'est pas natif ».* Cette phrase est fausse des deux moitiés, et elle est corrigée : le redimensionnement se fait avec le **même** `draggable` que le déplacement. **Adopter Schedule-X aujourd'hui serait une RÉÉCRITURE d'un écran qui répond, pas une installation** — le §2 l'impose et D17 le nomme, si bien que le trancher en séance dépasserait un ticket. Voir l'issue d'arbitrage.
**UN SEUL MÉCANISME POUR LES DEUX GESTES, ET C'EST DÉLIBÉRÉ.** La poignée engage son propre glissé avec `bord: "fin"` ; la case visée devient la **dernière occupée**, si bien que `duree = minutes + pas − début`. La case, la route, le cloisonnement, le refus nommé — tout était déjà écrit, et un second chemin aurait été une seconde lecture d'un même critère (§9, 01/09). **Le pas vient de la VUE** (`journee.pasMinutes`), jamais d'une constante : un pas écrit dans le composant deviendrait faux le jour où une agence règle le sien (I7).
**LA LIGNE QUI PORTE LE TICKET EST `stopPropagation`, ET SON JUMEAU LE PROUVE** : retirée, le scénario tombe (mesuré). Sans elle, le `dragstart` remonte au bloc, qui réécrit la charge en `bord: "bloc"` — **l'intervention se DÉPLACE au lieu de s'allonger, sans erreur ni refus.** *Une première réparation — retirer `draggable` du bloc au survol de la poignée — a été écrite, documentée, puis **démentie par son propre jumeau** : retirée, tout reste vert. Elle a été supprimée plutôt que gardée « au cas où » (§9, 08/09).*
**ET LE SCÉNARIO ÉCHOUAIT SUR UN GESTE, PAS SUR UNE RÈGLE.** Il rechargeait la page aussitôt après le `mouseup` ; le dépôt n'attend pas sa requête, si bien que la navigation partait pendant que le `POST` était en vol et l'annulait. **Le symptôme accusait la règle ; la trace des requêtes a nommé le geste** — la route répondait `{"accepte":true}` dès qu'on lui en laissait le temps. L'écran s'assure d'abord (une assertion réessaie), la base ensuite (une navigation, non).
*Acceptation :* la poignée allonge l'intervention et la base le garde après rechargement complet ; tirée au-dessus du début, elle est refusée et le motif est **nommé** (`duree_invalide`), l'écran ne montrant jamais un état que la base n'a pas accepté ; aucune poignée là où le début est inconnu — file d'attente et vue semaine.
**LE PLANNING EST UNE JOURNÉE, PAS UNE SEMAINE** (D72, 09/09/2026). La vue par défaut est le jour ; une intervention se pose sur un **créneau horaire** — début et fin en instants — sur le calendrier de travail du technicien affecté. Les horaires et jours travaillés se paramètrent **par agence** — `calendrier`, `calendrier_plage`, `calendrier_ferie`, qui existent depuis L0-08 : rien à ajouter pour eux — **avec exception par technicien, qui prime** : `technicien.calendrier_id` (nullable), sur la table `technicien` du chapitre 11 qui n'existe pas encore et porte l'agence de rattachement. Règle de priorité écrite une fois dans `lib/calendar` : horaires propres s'il en a, sinon ceux de son agence ; fériés et ponts toujours ceux de son agence ; agence sans calendrier ⇒ refus de poser, aucun horaire inventé (I7).
*Dépend de :* la table `technicien` (utilisateur, société, **agence**, actif — chapitre 11), à créer au lot 3 avant l'écran. **LIVRÉE** — L3-01a, 11/09/2026.
*Relu contre les sources citées le 11/09/2026 — empreinte `2f11cb5b`.*
**L3-02** Contrôles à la pose — **blocage strict** sur une habilitation **bloquante** absente ou expirée à la date d'intervention, **avertissement** sur une exigence non bloquante [D9], comme sur les autres contrôles. Voir RG-PLA-04. **[D73]**
*File :* LIVRÉ
**UNE AFFECTATION REFUSÉE S'AFFICHE ET NOMME SON MOTIF** (D73, 09/09/2026) : « habilitation BR absente », « habilitation CACES expirée le 12/08/2026 » — jamais « impossible ». Le planificateur lit déjà ces deux tables ; un refus qui lui cacherait ce qu'il a le droit de voir ne protège personne. Le message vient du dictionnaire et nomme le code de l'habilitation, jamais une donnée d'une autre société (D50).
**LIVRÉ le 11/09/2026, et le ticket a trouvé un TROU avant d'écrire une ligne.** RG-PLA-04 avait **un seul appelant** — `affecterTechnicien`, le formulaire de la fiche. Le glisser-déposer du planning écrit pourtant `technicien_id` par un tout autre chemin, `deplacerIntervention`, et **ce chemin ne consultait rien** : *mesuré, le même technicien sans l'habilitation bloquante de son site était refusé par le formulaire et accepté par un glissé.* **Une règle tenue par un chemin sur deux n'est pas tenue.** Et rien ne pouvait le voir — la règle avait ses tests unitaires, qui la jugent sur des tableaux, jamais sur un chemin : *une suite qui éprouve tous les maillons n'éprouve pas la chaîne* (§9, 08/09).
**LA DATE EST CE QUE LA SEULE AFFECTATION NE POUVAIT PAS VOIR.** RG-PLA-04 compare l'expiration à la **date d'intervention**, et un déplacement CHANGE cette date : une habilitation valable le 14 ne l'est plus le 28, et la même personne devient inaffectable sans que personne ne l'ait réaffectée. Un scénario le mesure des deux côtés de l'échéance.
**LA SECONDE MOITIÉ DE LA RÈGLE N'AVAIT AUCUN APPELANT.** `verdictAffectation` rendait ses deux listes depuis L1-04 ; seule celle qui bloque était lue, **l'autre était calculée puis jetée**. *Une règle dont une moitié n'a pas d'appelant n'est pas appliquée à moitié : elle n'est pas appliquée.* Elle arrive désormais jusqu'à l'écran.
**LE CODE NE TRAVERSE PAS L'URL, ET C'EST CE QUI DÉCIDE DE LA FORME.** D73 veut lire « habilitation BR absente » ; un code est une donnée de société, et un paramètre d'URL recopié à l'écran est un canal d'écriture ouvert à qui forge un lien (L1-02f, D50). Les canaux de refus et d'avertissement ne portent donc que des **clés** ; **le détail — quel code, expiré quel jour — est LU par la fiche**, sous le contexte cloisonné, à côté du technicien qu'elle affiche. C'est moins riche qu'un message composé au dépôt, et c'est la seule forme qui ne s'ouvre pas.
**ET LA DATE NE VOYAGE JAMAIS SEULE** (D56) : `ExigenceNonSatisfaite` est une **somme** — « absente », ou « expirée » AVEC son jour. *Un champ facultatif aurait laissé écrire une absence datée et une expiration sans date, deux états qui n'existent pas.*
*Acceptation :* un déplacement qui affecte un technicien sans l'habilitation bloquante du site est refusé **et rien n'est écrit** ; le jumeau montre que l'habilitation accordée, le même déplacement passe ; une exigence non bloquante passe **et avertit**, l'avertissement étant **absent** — jamais `[]` — quand il n'y a rien à dire ; les deux chemins rendent le **même** verdict, et un scénario le dit.
*Relu contre les sources citées le 11/09/2026 — empreinte `49d5393b`.*
**L3-03** File d'attente à planifier, tri par urgence et échéance.
*File :* LIVRÉ
**LIVRÉ le 11/09/2026 — MOINS l'échéance, qui n'existe pas, et c'est L3-03a.** L'écran de file existe depuis R2-12 ; **ce qui manquait était son ORDRE**, et le défaut était plus grave que « pas trié ». *Mesuré avant d'écrire une ligne :* toutes les lignes de la file ont `date_planifiee` et `creneau_debut` **nuls** — c'est ce qui les y met —, or c'étaient **les deux seuls critères de tri**. La file entière était donc ex æquo, et PostgreSQL rend les ex æquo dans l'ordre du parcours.
**LA FILE ÉTAIT RANGÉE PAR LA PLACE PHYSIQUE DES LIGNES.** Observé sur la base d'isolation : l'ordre affiché était **p1, p1, p3, p2, p2** — pas par urgence du tout —, et **un simple `UPDATE` sur une ligne l'a envoyée en fin de file**, le tuple étant réécrit à la fin du tas. *Le planificateur voyait sa file se réordonner à chaque modification, sans qu'aucune règle le décide.*
**L'ORDRE EST DÉSORMAIS TOTAL** : date, créneau, **urgence**, **ancienneté**, `id`. Les deux premiers rangs gardent les deux vues du planning — une intervention de 8 h précède celle de 14 h quelle que soit sa priorité, et un témoin le tient. Le dernier ferme le cas qu'on vient de fermer : deux interventions créées dans la même milliseconde restent possibles, la synchronisation hors ligne en remontant par lots.
**L'ANCIENNETÉ N'EST PAS L'ÉCHÉANCE, et l'écart est écrit plutôt que tu.** Le ticket dit « urgence et échéance » ; **aucune échéance n'existe au schéma** — mesuré : pas de table `contrat`, zéro occurrence de `sla`, et `echeance_contrat` n'est qu'une *source* de demande, pas une date. Ranger `cree_le` sous le nom d'« échéance » aurait été inventer une règle métier (§8). Ce second rang dit ce qu'il fait : *à urgence égale, la plus ancienne passe devant.*
**ET DEUX SCÉNARIOS SUR SIX NE PROUVENT PAS CE QU'ILS SEMBLENT PROUVER — leur jumeau l'a dit, et ils portent l'aveu.** Le tri retiré, le scénario qui rejoue le défaut d'origine reste **vert** : PostgreSQL ne renvoie le tuple en fin de tas que si sa page est pleine, et cela ne se force pas depuis un scénario. Ce qui prouve le tri est la **population adverse** des trois premiers — des lignes écrites dans l'ordre inverse de l'attendu —, qui rougissent toutes les trois. *Un scénario vert sans le verrou qu'il croit mesurer est la direction permissive du §9 (11/09) : on ne le supprime pas, on écrit ce qu'il ne prouve pas.*
*Acceptation :* la file rend p1 avant p2 avant p3 avant p4 sur une population écrite à l'envers ; à urgence égale la plus ancienne passe devant ; **l'urgence prime sur l'ancienneté**, et un scénario où les deux se contredisent le dit ; les interventions datées restent devant la file, rangées par leur date.
**L3-03a** L'**échéance** de la file d'attente, et l'**indicateur de risque de dépassement**. Voir RG-CON-01, RG-CON-02.
*File :* BLOQUÉ — les deux moitiés demandent une donnée qui n'existe pas, mesuré le 11/09/2026.
**CE N'EST PAS UN REPORT DE CONFORT : c'est une mesure.** `grep -n "model Contrat" prisma/schema.prisma` → **rien** ; `grep -c "sla"` → **0** ; `echeance_contrat` existe, mais c'est une valeur de `SourceDemande` — *d'où vient une demande*, jamais une date. **Une échéance naît d'un contrat** (RG-CON-01 : « les échéances préventives sont générées à la création du contrat sur toute sa durée »), et le **risque de dépassement** se mesure contre un SLA, porté par `contrat` au chapitre 11. Les deux arrivent au **lot 4**.
**Ce qui serait faux si on le construisait maintenant** : un « risque de dépassement » calculé sans SLA serait un seuil inventé, et *un indicateur qui affiche un état sans donnée pour le fonder est la faute que D88 nomme sur le registre des VGP* — un registre à moitié rempli ressemble à un registre complet.
*Condition de déblocage, vérifiable :* la table `contrat` existe au schéma avec son SLA, et l'intervention porte la date cible de son échéance.
*Relu contre les sources citées le 11/09/2026 — empreinte `5ef2baa6`.*
**L3-04** Absences, alerte de rupture de service à effectif unique, report groupé.
*File :* LIBRE
**L3-05** Tournées — regroupement, ordonnancement, estimation des trajets. **[D74]** L'estimation lit `site.temps_trajet_min`, **donnée de planification et rien d'autre** : le trajet ne s'ajoute jamais aux heures facturées, le déplacement se facture par forfait de zone (RG-INT-07, RG-PLA-05).
*File :* LIBRE
*Relu contre les sources citées le 10/09/2026 — empreinte `a29dca26`.*
**L3-06** Socle PWA — manifeste, service worker, installabilité. **Pas de notifications push** [3.19].
*File :* LIBRE
**L3-07** Cache local — IndexedDB, dont **le parc complet des clients visités sous 7 jours** [D22].
*File :* LIBRE
*Relu contre les sources citées le 01/09/2026 — empreinte `75515868`.*
**L3-08** File d'opérations et synchronisation — priorisation, reprise, indicateur d'état.
*File :* LIBRE
*Acceptation :* test bout en bout — intervention complète en mode avion puis synchronisation intégrale sans perte.
**L3-09** Résolution de conflits. **[D27]**
*File :* LIBRE
Terrain sur l'exécution, back-office sur la planification, **statut par préséance** : `ANNULEE` > `CLOTUREE` > `TERMINEE` > `EN_COURS` > `SUSPENDUE` > planification.
*Acceptation :* une intervention annulée pendant sa réalisation hors ligne conserve temps, diagnostic, photos et signature, et le conflit est remonté.
*Relu contre les sources citées le 01/09/2026 — empreinte `afd95cea`.*
**L3-10** Doublons hors ligne — détection **et fusion**. **[D28]**
*File :* LIBRE
La fiche la plus ancienne survit ; le `qr_token` de l'absorbée **redirige** vers elle ; historiques fusionnés ; divergences arbitrées champ par champ ; réversible 30 jours. **Ce ticket est le SEUL PRODUCTEUR du statut `fusionnee`** (D28, valeur ajoutée à l'énumération le 10/09/2026) : il l'écrit sur la fiche absorbée, et amende `lib/machines/resolution.ts` pour qu'un QR qui la désigne rende la survivante ; jusque-là, rien ne produit ni ne lit cette valeur.
**CE QUE CE TICKET DÉDUPLIQUE, nommé le 11/09/2026** (D28, décision d'exploitation) : le parc se construit par **deux chemins qui ne se connaissent pas** — l'import de masse de L1-10 et le recensement terrain (D16, planches de L2-02, hors ligne par I4). La même machine y sera saisie deux fois, une fois par le fichier et une fois devant elle : **ce n'est pas une erreur à prévenir, c'est l'arithmétique d'un parc alimenté des deux côtés.** Deux conséquences à ne pas redécouvrir ici : la fiche du **fichier** survit presque toujours (créée en premier), donc c'est celle du **terrain** qui est absorbée — et c'est elle qui porte le `qr_token` de l'étiquette réellement collée, ce qui fait de la redirection la condition pour ne pas réétiqueter le parc ; et la divergence majoritaire sera `numero_serie`, `SN-INCONNU-<référence>` (D6) face au numéro exact du fichier, donc **le premier champ que la présentation côte à côte doit faire choisir**.
*Relu contre les sources citées le 11/09/2026 — empreinte `22a1fa76`.*
**L3-11** Scan QR et création express — moins de 60 secondes. **Pas de reconnaissance de plaque** [D33] : photo conservée en pièce jointe, saisie manuelle.
*File :* LIBRE
*Relu contre les sources citées le 01/09/2026 — empreinte `0c1dddde`.*
**L3-12** Recensement en série — enchaînement sans retour au menu, compteur de saisies.
*File :* LIBRE
**L3-13** Saisie de rapport — checklist, temps, pièces, photos compressées, préconisations. Absence de checklist = condition satisfaite ; un point non conforme impose une préconisation [3.10].
*File :* LIBRE
**L3-14** Signature client — `appareil_id` et `horodatage_terrain`, pas d'adresse IP [3.9].
*File :* LIBRE
**L3-16** Écran « Sites ». **[D75]** Un client a plusieurs sites, dans des villes différentes — c'est le cas courant. La table, la saisie Zod et le dépôt existent depuis L1-02 ; il manque l'écran : sites d'un client, fiche, création, modification, avec le rattachement à l'agence et le temps de trajet présentés comme une donnée de planification (D74). *Acceptation :* un compte portail ne voit que les sites de son périmètre (RG-DRO-01) ; changer le rattachement sans revoir le temps de trajet est refusé à l'écran avec le message de D56.
*File :* LIBRE
*Relu contre les sources citées le 10/09/2026 — empreinte `3fe87448`.*
**L3-17** Le TAUX D'OCCUPATION par technicien. **[D76]** Par semaine : nombre d'interventions, et **heures d'intervention ÷ heures travaillées** — tout le temps d'intervention compte, facturé ou non. Le nom vient du dictionnaire (`vocabulaire.taux_occupation`, formule à côté), et **jamais « productivité »** — un gardien le tient. **DÉPEND de D72 / L3-01** : les heures travaillées sont celles du calendrier de travail du technicien, absences déduites (L3-04). *Acceptation :* une intervention de garantie compte dans le numérateur ; un technicien sans calendrier résolu n'a pas de taux — jamais zéro.
*File :* LIBRE
*Relu contre les sources citées le 10/09/2026 — empreinte `7af72f40`.*
**L3-15** Génération et envoi du PDF. **Validation systématique** avant diffusion [D24]. Le **PDF serveur fait foi** ; la version locale porte la mention « provisoire ». **Aucun montant** sur le rapport [3.8].
*File :* LIBRE
*Acceptation :* contrôle visuel humain obligatoire — aucun test automatique ne remplace ce point.
*Relu contre les sources citées le 01/09/2026 — empreinte `73c7382a`.*
---

## Lots 4 à 7

Même format, à découper au moment de les aborder. Contrats et générateur de propositions (lot 4), portail client et tableaux de bord (lot 5), exports et flux BI (lot 6), console éditeur et abonnements (lot 7).

Un backlog écrit six mois à l'avance est périmé quand on y arrive.

## Lot 8 — Documentation des machines

*Inscrit au plan le 09/09/2026 sur consigne d'exploitation.*

**LE SOCLE DE DONNÉES EST CONSTRUIT le 13/09/2026** — L8-01 à L8-06. La question que D87 laissait ouverte — le cloisonnement d'un document de MODÈLE — a été tranchée par l'exploitation le matin même et instruite avec sa mesure : **D93**, deux formes de politique, « héritage » et « ascendance ». **LE BAC DE RÉCEPTION EST CONSTRUIT le même jour** — L8-07 : la déduplication par empreinte tenue par l'INDEX, les propositions qui ne classent jamais seules, la reprise sans table de session, le compteur dont le total explique chaque fichier reçu. Il a produit une **treizième forme de politique**, « interne » (**D94**), parce que le bac nomme des fichiers et qu'un nom de fichier révèle le parc — la fuite de D93 rentrait par la porte de service. Ce qui reste **écrit et non construit** : le **stockage**, *quand il aura un appelant* : `document.objet_cle` et `document_recu.objet_cle` disent où sont les octets, et aucun code ne les remplit. **L'écran du bac** manque aussi, et c'est lui l'appelant qui rendra le stockage dû.

**Ce lot remplace le ticket L2-04**, qui posait la bonne question — la forme polymorphe de `document` — et n'en tirait pas un périmètre. La mesure de L2-04 reste acquise et ne se refait pas : *une colonne `entite_id` avec deux clés étrangères est un piège qui a l'air d'un verrou et rend la table inutilisable ; une colonne nullable par cible avec `num_nonnulls(...) = 1` fonctionne.*

**L8-01** Le rattachement d'un document : au MODÈLE ou à la MACHINE, jamais aux deux.
*File :* LIBRE
Un document s'accroche **au modèle** — notice, fiche technique, manuel d'atelier, identiques pour tous les exemplaires — **ou à la machine** — certificat de conformité, procès-verbal de mise en service, propres à un exemplaire. **Jamais aux deux, et c'est le SCHÉMA qui l'interdit**, pas une validation applicative : deux colonnes nullables et `num_nonnulls(modele_id, machine_id) = 1`, la forme que L2-04 a mesurée comme fonctionnelle.
*Acceptation :* une ligne à deux cibles est refusée par la contrainte NOMMÉE ; une ligne sans cible aussi ; le jumeau retire la contrainte et montre la ligne à deux cibles passer.

**L8-02** L'écran d'une machine affiche l'UNION de ses documents et de ceux de son modèle.
*File :* LIBRE
**C'est ce qui évite de dupliquer un PDF sur cinq cents machines et de ne jamais pouvoir le corriger.** La distinction reste visible à l'écran — un document de modèle se corrige une fois pour toutes, un document de machine n'existe que là.
*Acceptation :* un document ajouté au modèle apparaît sur toutes ses machines sans qu'aucune ligne ne soit copiée ; sa correction se voit partout.

**L8-03** Deux classes de visibilité, et deux seulement : `client` et `interne`.
*File :* LIBRE
**Liste close, produite par le SCHÉMA** — une énumération PostgreSQL, comme les statuts. *À cinq valeurs, personne ne classe juste* : une classification que l'on hésite à appliquer est appliquée au hasard, et un document mal classé est pire qu'un document absent.
*Acceptation :* toute valeur hors des deux est refusée par la base.

**L8-04** Le cloisonnement d'un document est HÉRITÉ de sa machine, et la classe ne fait que le RÉTRÉCIR.
*File :* LIBRE
Société, site, habilitation : un document suit sa machine, **et rien n'est inventé ici**. La classe `interne` retire l'accès au portail ; elle n'ajoute aucun axe. **N'inventez pas une forme de politique de plus** — la forme « parc » existe, `intervention` vient de la prendre, et une dixième forme est un arbitrage, jamais un effet de bord.
**TRANCHÉ LE 13/09/2026 — D93.** *Un compte de portail ne voit les documents d'un MODÈLE que si une machine de ce modèle se trouve dans son PROPRE PÉRIMÈTRE.* Sinon la présence d'une notice révèle la composition du parc des autres sites — un compte restreint à Ducos déduirait ce que Koné possède, et le cloisonnement fuirait par la liste des documents au lieu de fuir par les données. **Ce n'est donc pas la forme du document qui change, c'est le chemin d'accès au MODÈLE** : machine → site → habilitation, jamais société → modèle. Deux formes en sont sorties, et ce sont bien des ARBITRAGES et non des effets de bord : « héritage » pour `document`, « ascendance » pour `modele_materiel` et `famille_materiel`.
*Acceptation :* un compte portail ne voit d'un document que ce que sa machine lui laisse voir ; **et rien du modèle dont il ne possède aucune machine visible** — ni la notice, ni son existence, ni un compteur à zéro qui la trahirait. Les deux formes nouvelles sont ARBITRÉES (D93) et gardées par des listes closes dans les deux sens.
*Relu contre les sources citées le 13/09/2026 — empreinte `d20d6a8b`.*

**L8-05** Fiche en base, octets dans un stockage d'objets, **même région que la base**.
*File :* LIBRE
**Jamais de PDF dans PostgreSQL.** La région est la même pour la raison qui a déjà coûté un incident : la latence vers Sydney se paye à chaque aller-retour, et un objet qui traverse le Pacifique deux fois n'arrive pas.
*Acceptation :* aucune colonne binaire sur `document` ; la région du stockage est vérifiée par le contrôle de mise en ligne.

**L8-06** `date_document` et `date_expiration` **dès le premier jour**, même inutilisées.
*File :* LIBRE
*Trois minutes maintenant, une migration douloureuse plus tard.* Ce n'est pas une colonne « au cas où » : un certificat porte une date d'émission et une date de fin de validité, et le lot 9 s'en servira.
*Acceptation :* les deux colonnes existent et sont nullables ; aucun code ne les lit encore, et c'est écrit plutôt que tu.

**L8-07** LE BAC DE RÉCEPTION — l'entrée principale du lot, et la partie qui décide de sa réussite.
*File :* LIVRÉ
Les documents existants sont **numériques mais rangés en vrac**, sans structure exploitable. Le bac les reçoit et **propose** ; il ne classe jamais seul.
- **Dédupliquer par empreinte AVANT de rapprocher** : deux fois le même PDF est un seul document, et le découvrir après le rapprochement fait deux fois le travail.
- **Afficher LA PREMIÈRE PAGE à côté du choix.** La couverture porte la marque et le modèle ; **l'œil fait le travail, pas la reconnaissance de caractères.** Aucune dépendance d'OCR en V1.
- **Proposer, jamais classer seul.** *Un rapprochement faux accroche la notice d'un compresseur à un pont élévateur, et personne ne le voit avant qu'un technicien suive la mauvaise procédure.* **C'est une question de sécurité, pas de qualité de données**, et c'est ce qui interdit l'automatisme silencieux.
- **Téléversement REPRENABLE** : plusieurs gigaoctets depuis Nouméa, ça se coupe.
- **Traiter les MODÈLES d'abord** : une notice classée sert toutes les machines du modèle d'un coup.
- **Tranches de dix minutes**, reprise là où l'on s'est arrêté, **aucun travail partiel perdu**, compteur visible. *Ce travail sera délégué*, et un travail délégué qui perd une session perd la personne avec.
*Acceptation :* une session interrompue reprend au même document ; deux fichiers identiques ne produisent qu'une fiche ; aucun rapprochement n'est appliqué sans un geste humain.

**HORS V1, et nommé pour que personne ne l'ajoute en passant :** import automatique en masse, chaînes de versions, liens vers les sites constructeurs, téléversement depuis le téléphone.

---

## Lot 9 — Registre des VGP

*Inscrit au plan le 09/09/2026 sur consigne d'exploitation.*

**LA COLONNE VERTÉBRALE EST CONSTRUITE le 12/09/2026** — L9-03, L9-04, L9-05, L9-06 et L9-07. Ce qui reste **écrit et non construit** : L9-01 et L9-02 le sont **à moitié** (la règle est en code et éprouvée, aucun écran ne l'affiche encore), et L9-08 à L9-11 attendent — la campagne datée, le rapport de classe `client` (lot 8), l'intervention engendrée par une observation (lot 2 livré, la liaison reste à écrire), et la saisie hors ligne du technicien (lot 3).

*Ce qui a été construit, et où :* l'énumération `AssujettissementVgp` à quatre valeurs dont la NAISSANCE ; les colonnes de `famille_materiel`, `modele_materiel` et `machine` ; les quatre contraintes qui font REFUSER la base plutôt que signaler ; `lib/vgp/assujettissement.ts` (saisie Zod et cascade avec son origine) ; `lib/vgp/information.ts` (« sans information depuis X », qui ne rend jamais de verdict) ; le gardien statique de L9-05 (`tests/unit/vgp/aucune-duree-en-dur.test.ts`) ; et six scénarios d'isolation avec leur jumeau.

**Vérifications générales périodiques** (APAVE, Bureau Veritas). **Chez CODIMA, ce sont les CLIENTS qui commandent ces visites, pas CODIMA. Tout ce lot découle de là.**

**L9-01** CODIPLAN NE CALCULE JAMAIS LA CONFORMITÉ.
*File :* LIVRÉ
Il **enregistre ce que l'organisme agréé a écrit**, et ne calcule que des **dates**. *« Conforme » ne s'affiche que parce qu'APAVE l'a écrit.* Un logiciel qui déduirait la conformité d'une règle qu'il porte engagerait une responsabilité que personne ne lui a donnée.
*Acceptation :* aucune fonction du dépôt ne rend un verdict de conformité ; le seul calcul est une échéance.

**L9-02** CE N'EST PAS UN REGISTRE DE CONFORMITÉ, C'EST UN REGISTRE DE CE QU'ON NOUS A DIT.
*File :* LIBRE
Chaque écran porte **la date de la dernière information reçue**. Sans nouvelles : **« sans information depuis X »** — jamais « à jour », jamais « en retard », **jamais blanc**. *Le danger est qu'un registre à moitié rempli ressemble à un registre complet* — c'est le zéro de `/sante` lu comme « installation vide », à l'échelle d'un parc.
*Acceptation :* aucun écran du lot ne rend un état sans le dater ; l'absence d'information a un libellé propre, distinct de « conforme » et de « non conforme ».

**L9-03** L'assujettissement se déclare À LA FAMILLE et se propage — **mais PAS par une case à cocher**.
*File :* LIBRE
**TROIS valeurs** : `soumis` · `non_soumis`, et `verifie` · `a_determiner`. **Une famille nouvelle naît « à déterminer »**, parce qu'*une case décochée est indiscernable d'une famille jamais examinée*, et qu'un pont élévateur sortirait du registre en silence. **Les « à déterminer » apparaissent dans une liste visible** : c'est la moitié détective du couple, et sans elle la valeur ne sert à rien.
*Acceptation :* une famille créée porte `a_determiner` sans qu'on l'ait demandé ; la liste des indéterminés est atteignable en un clic depuis le registre.

**L9-04** Déclarer « soumis » rend OBLIGATOIRES la périodicité et **la référence du texte qui la fonde**.
*File :* LIBRE
Sans le texte, la périodicité est un chiffre que personne ne peut défendre.
*Acceptation :* la base refuse `soumis` sans périodicité ni référence.

**L9-05** AUCUNE PÉRIODICITÉ EN DUR.
*File :* LIBRE
Elle dépend du matériel et du texte applicable ; **la Nouvelle-Calédonie a son propre code du travail**, et la solution sera vendue sur d'autres territoires. **C'est une donnée saisie par un humain**, comme la majoration hors ouverture et le taux horaire.
*Acceptation :* aucune constante de durée dans le code du lot ; un gardien statique le vérifie, sur le modèle de celui des couleurs.

**L9-06** Le MODÈLE peut préciser, la MACHINE peut faire exception — **avec motif écrit obligatoire**.
*File :* LIBRE
Les caractéristiques techniques vivent sur le modèle, donc c'est là que la précision a un sens. L'exception au niveau d'un exemplaire existe — un usage particulier, une modification — et **elle ne se pose jamais sans sa raison**.
*Acceptation :* une exception sans motif est refusée par la base.

**L9-07** La déclaration est JOURNALISÉE : qui, quand, **sur quelle base**.
*File :* LIBRE
Pas une table de plus : `journal_audit`, par déclencheur, avec les valeurs avant et après. « Sur quelle base » est la référence du texte de L9-04.
*Acceptation :* toute déclaration d'assujettissement est retrouvable avec son auteur et sa justification.

**L9-08** Faire passer une famille de « non soumise » à « soumise » n'ouvre PAS deux cents alertes : cela ouvre **UNE CAMPAGNE DATÉE avec un compteur qui descend**.
*File :* LIBRE
*Un gardien dont on ignore les alertes coûte plus qu'il ne rapporte* — c'est déjà écrit au §9 du CLAUDE.md, et deux cents alertes le jour d'une déclaration, c'est la panne par le bruit, la plus sûre.
*Acceptation :* une déclaration produit un objet unique, daté, avec un reste-à-faire visible ; aucune notification par machine.

**L9-09** Le rapport de VGP est de classe `client`.
*File :* LIBRE
**L'obligation pèse sur celui qui utilise le matériel : le rapport lui appartient.** C'est la classe de L8-03, et c'est tout — le lot 9 ne crée aucun axe de visibilité.
*Acceptation :* un compte portail retrouve les rapports de ses machines, et rien d'autre.

**L9-10** Un rapport AVEC OBSERVATIONS engendre des interventions à planifier.
*File :* LIBRE
**C'est le seul point où ce lot alimente le planning, et c'est celui qui rapporte de l'argent.** Une observation d'organisme est un travail à faire, daté, sur une machine identifiée : elle a exactement la forme d'une intervention `a_planifier`.
*Acceptation :* une observation saisie produit une intervention en file d'attente, rattachée à la machine et au rapport qui l'a motivée.

**L9-11** Le TECHNICIEN saisit sur site ce qu'il voit — **vignette, date — en cinq secondes**, pendant une intervention.
*File :* LIBRE
**C'est ce qui remplira le registre**, et rien d'autre ne le remplira : personne ne saisira deux cents fiches un dimanche. La saisie doit fonctionner **hors ligne**, comme tout ce que le terrain fait.
*Acceptation :* la saisie tient en deux champs et se fait en mode avion ; elle se synchronise comme le reste.

**HORS V1 :** la commande des visites aux organismes. *Elle viendra le jour où l'exploitation vendra ce service — et c'est le registre rempli qui le lui permettra.*

---

## POINT DE VIGILANCE COMMUN AUX LOTS 8 ET 9 — à instruire avant le portail

**Le jour où le portail sert à un client un certificat de conformité ou un état de VGP, la question de ce dont CODIMA RÉPOND se pose.** Publier un document réglementaire, même reçu d'un tiers, n'est pas la même chose que publier un compte rendu d'intervention : le client peut s'en prévaloir, et un document périmé ou mal rattaché devient une affirmation de CODIMA.

**Ce n'est pas un blocage**, et ce n'est pas une question technique : c'est un **avis à prendre avant d'ouvrir le portail sur ces deux lots**. Les deux lots se construisent sans lui ; c'est la publication qui l'attend.

---

### Tickets déjà arrêtés hors du chemin critique

Ils ne sont pas à construire maintenant ; ils sont écrits parce qu'un arbitrage les a rendus obligatoires, et qu'un corollaire non écrit est un corollaire perdu.

**L0-12 — Écriture groupée des données de référence du seed. [incident du 23/08/2026]**
*File :* LIBRE
**Déclencheur explicite : le premier avertissement de `tests/unit/seed-delais.test.ts`.** Tant que le budget tient, ce ticket ne s'ouvre pas — et lorsqu'il s'ouvre, la réponse n'est pas de relever `DUREE_MAXIMALE_MS` une seconde fois, c'est de réduire le nombre d'allers-retours.
Deux jeux de données du seed sont écrits **en bloc**, ligne à ligne : `jour_ferie` (69 lignes) et `calendrier_plage` (31 lignes), soit **cent instructions** dont chacune coûte un aller-retour vers Sydney. Ils n'existent que comme ensembles ; personne n'en modifie une ligne isolément. Une écriture groupée par bloc ramènerait à elle seule la transaction fautive de **trente-quatre allers-retours à quatorze**.
**Ce qui ne bouge pas :** les `upsert` idempotents sur clé naturelle — `societe`, `agence`, `calendrier`, `utilisateur`, `utilisateur_societe`, `utilisateur_client` — restent tels quels ; ils portent l'idempotence entité par entité, et les regrouper échangerait une propriété qui compte contre des millisecondes qui ne comptent pas. L'atomicité ne bouge pas non plus : une écriture groupée s'exécute dans la même transaction.
**Le piège à traiter dans le ticket, pas maintenant :** une écriture groupée idempotente ne peut pas être un simple `createMany` (il ignore les lignes existantes au lieu de les corriger), et le SQL brut est interdit hors migrations (CLAUDE.md §2). La forme probable est un remplacement de bloc — `deleteMany` puis `createMany` sur le périmètre exact du bloc, dans la transaction. Or `calendrier_ferie.jour_ferie_id` référence `jour_ferie` : un remplacement de bloc ne doit ni orpheliner ni annuler un écart local d'agence. C'est ce point, et lui seul, qui rend le ticket non trivial.
*Acceptation :* `pnpm db:seed` reste idempotent — deux exécutions successives produisent le même état, et une correction de libellé se propage ; aucun écart local n'est perdu ni délié après réexécution ; `allersRetoursTransaction` retombe sous vingt pour chaque société ; le test de budget passe sans que `DUREE_MAXIMALE_MS` ait été relevé.

**L7-02 — Le refus de corriger un jour férié, rendu LISIBLE. [D50]**
*File :* LIBRE
**Déclencheur explicite : la console éditeur du lot 7**, c'est-à-dire le premier écran depuis lequel un rôle éditeur corrigera la date ou le territoire d'une ligne de `jour_ferie`. Aujourd'hui aucun chemin de code ne le permet — le seed n'écrit en `update` que `libelle` et `mobile`, `etendre-feries` n'écrit que des `create` —, la correction se fait donc en SQL à la main, et le refus qu'elle reçoit nomme une contrainte et un UUID.
La console intercepte l'erreur `23503` sur `calendrier_ferie_jour_ferie_id_date_territoire_fkey` et la traduit. **Elle n'interroge pas `calendrier_ferie`** : c'est la clé étrangère qui a vu, pas elle.
**L'AMBITION EST BORNÉE, ET C'EST LE CŒUR DU TICKET [D50].** Même dans la console, le message ne pourra **ni nommer les agences ni les compter** sans franchir le cloisonnement : l'éditeur n'a aucune société active, et un décompte lui apprendrait combien d'agences clientes chôment ce jour-là. Le message dira « ce jour férié est référencé par des écarts de calendrier, ils doivent être traités d'abord » — **et rien de plus**. L'objectif est un refus **LISIBLE**, pas un refus **INFORMATIF**. Une session qui promettrait le décompte retomberait sur le même mur, ou pire, le franchirait par une fonction `SECURITY DEFINER` — que `tests/unit/db/security-definer-sous-arbitrage.test.ts` refuse.
*Acceptation :* la correction d'une date de férié référencée affiche un message en français nommant la marche à suivre, sans aucun décompte ni nom d'agence ; aucune requête de la console ne lit `calendrier_ferie` pour composer ce message ; le gardien de D50 reste vert.
*Relu contre les sources citées le 01/09/2026 — empreinte `58941835`.*
**L2-11 — Le SÉLECTEUR de société. [D61] [D67]**
*File :* LIVRÉ
**Déclencheur explicite : le premier compte habilité sur PLUS D'UNE société.** Ce n'est pas « quand on y pensera » : c'est un état observable en une requête, et il arrivera probablement par la direction — une personne habilitée à la fois sur CODIMA-NC et sur CODIMA-EU.
**LE DÉCLENCHEUR, PRIS À LA LETTRE, A DÉJÀ SONNÉ — ET IL SONNE À FAUX** *(mesuré le 11/09/2026, base jetable après `pnpm db:seed`)*. `direction@codima.test` est habilitée sur les DEUX sociétés : c'est très exactement la personne que ce ticket prédisait, et **le seed la crée**. Mais elle porte **zéro moyen de connexion** — le seed écrit `utilisateur` et `utilisateur_societe`, jamais `compte` —, si bien qu'elle **ne peut pas atteindre l'impasse**. *Un déclencheur observable en une requête est un bon déclencheur ; celui-ci observait la mauvaise moitié.* **Sa seconde moitié est ajoutée** : « habilité sur plus d'une société **ET portant un moyen de connexion** ». La requête qui le dit, à jouer sur la base HÉBERGÉE — la seule où « réel » a un sens :
```sql
SELECT u.email, count(DISTINCT us.societe_id) AS societes,
       (SELECT count(*) FROM compte c WHERE c.utilisateur_id = u.id) AS moyens_de_connexion
FROM utilisateur u JOIN utilisateur_societe us ON us.utilisateur_id = u.id
GROUP BY u.id, u.email HAVING count(DISTINCT us.societe_id) > 1;
```
**Le ticket reste donc FERMÉ**, et il s'ouvre le jour où cette requête rend une ligne dont la dernière colonne n'est pas zéro.

> **LA SECONDE MOITIÉ DU DÉCLENCHEUR EST LEVÉE LE 12/09/2026, et ce n'est pas le ticket qui l'a levée.** Le seed écrit désormais une ligne de `compte` pour chaque identité de démonstration — à `mot_de_passe NULL`, l'état exact que l'amorçage laisse —, parce que l'absence de cette ligne rendait **une base neuve inaccessible à quiconque** : ni l'amorçage ni la réémission ne pouvaient servir les identités semées. *`direction@codima.test` porte donc maintenant un moyen de connexion, et la requête ci-dessus rendrait une ligne non nulle sur la base de démonstration.* Le ticket est livré depuis le 10/09 ; ce qui change ici est que **son déclencheur observe enfin la bonne chose**, et l'observation reste à faire sur la base HÉBERGÉE — la seule où « réel » a un sens.
D61 a écrit que sa décision *n'ouvre aucun sélecteur de société*, et c'était juste : le premier écran active la société d'un compte qui n'en a qu'une, et DIT qu'aucune n'est active quand il y en a plusieurs. **Ce que D61 n'a pas écrit, c'est le coût de cette phrase** — et c'est ce que ce ticket inscrit. Un compte habilité sur deux sociétés se connecte, arrive, et ne peut RIEN faire : `app/api/session/connexion/route.ts` n'active que sur exactement une habilitation, aucun écran ne laisse en désigner une, et sans société active aucune donnée cloisonnée ne se lit. **Ce n'est pas une gêne, c'est une impasse.**
~~**Le verrou n'est pas en base, et c'est ce qui rend le ticket petit.**~~ `basculerSociete` fonctionne, contrôle l'habilitation et journalise ; `habilitationsDuCompte` rend la liste depuis la forme « appartenance » (D61). Ce qui manque est l'ÉCRAN qui laisse NOMMER la société — un scénario passe l'identifiant en dur, un utilisateur ne le peut pas.
**MAIS LE VERROU EST BIEN EN BASE, et il a été mesuré le 08/09/2026** — la phrase barrée ci-dessus est conservée plutôt qu'effacée, un amendement qui efface sa trace se rejouant au prochain doute *(méthode de D44)*. Un écran doit afficher **quelque chose sur quoi cliquer**, et ce quelque chose n'existe pas : `societe` est de forme **« identité »** (`id = app.societe_id`, D42), si bien que sans société active la lecture rend **zéro ligne — pas même en nommant l'identifiant qu'on possède déjà**. Mesuré sous le rôle applicatif, avec témoin : 0 à l'aveugle, 0 en nommant les deux, **2 lignes réellement en base**. Et `habilitationsDuCompte` le documente : *« Ce qu'elle ne rend pas, et c'est délibéré : le NOM des sociétés. »*
**Ce ticket est donc un ARBITRAGE DE CLOISONNEMENT, plus un écran** — et l'arbitrage vient d'abord. ~~Trois options au registre du 08/09/2026 (Q8)~~ **TRANCHÉ le 09/09/2026 [D67] : c'est l'option 1**, la **neuvième forme de politique** sur `societe` — « adhésion » —, symétrique de celle que D61 a posée sur `utilisateur_societe`, en `SELECT` et en `SELECT` seul. Le coût est nommé : *une personne apprend le NOM des sociétés dont elle connaît déjà la liste* ; ni leurs données, ni leurs habilitations, ni l'existence d'aucune autre. Les deux options écartées le sont pour leur raison : un **libellé recopié** dans `utilisateur_societe` serait la divergence silencieuse du §9 (01/09), et **pas de sélecteur** un report qui tomberait sur la direction.
**La première moitié est LIVRÉE** — politique, liste close `TABLES_ADHESION` gardée dans les deux sens, `societesDuCompte` qui la lit, et six scénarios dont celui que l'arbitrage réclame nommément : *un compte habilité sur UNE seule société ne gagne pas une ligne au passage.* **Ce qui reste est l'ÉCRAN.**
**Livrer un écran qui propose des UUID fermerait le ticket sans lever l'impasse** — elle changerait seulement de forme.
**L'impasse est CONSTATÉE ET NOMMÉE dès aujourd'hui**, plutôt que découverte en exploitation : `tests/isolation/premier-ecran.test.ts`, section « L'IMPASSE MULTI-SOCIÉTÉ ». Même traitement que la console éditeur et que L7-01 — *le silence a exactement la forme du succès* (§9, 31/08), et une limite qu'aucun scénario ne prononce devient une embuscade.
**Hors périmètre, et il faut le dire ici :** le sélecteur n'invente aucun ordre de préférence et ne mémorise aucune « dernière société ». Choisir à la place de l'usager est précisément ce que l'activation automatique s'interdit dès qu'il y a un choix à faire.
*Acceptation :* un compte habilité sur deux sociétés choisit la sienne et arrive dessus ; il ne peut désigner qu'une société sur laquelle il est habilité, et un identifiant qu'il n'a pas reçoit le refus uniforme de `basculerSociete` ; le changement est journalisé comme tout basculement (L0-06) ; l'épreuve de l'impasse est REMPLACÉE par celle du choix, jamais simplement supprimée — le plancher de scénarios ne se baisse pas.
*Relu contre les sources citées le 10/09/2026 — empreinte `e06a3352`.*

**L2-12 — Le PORTAIL CLIENT, en consultation seule. [D10] [D92]**
*File :* LIVRÉ
**LIVRÉ le 12/09/2026**, et il n'était pas un écran : c'était un **arbitrage de cloisonnement**, plus un écran.
**Le mur, mesuré avant d'être contourné.** D10 veut que « les deux tables soient exclusives » : un compte portail n'a **aucune** ligne dans `utilisateur_societe`. Et `utilisateur_client` portait la forme « habilitation », ancrée sur `app.societe_id`. Rien ne pouvait donc lui donner une société, et sans société il ne lisait pas son propre rattachement. *Mesuré sous `codiplan_app` (`rolbypassrls` = f), avec témoin — zéro société lisible sans contexte : **identité seule → 0 ligne**, identité + société → 3, `utilisateur_societe` de ce compte → **0**.* Les deux zéros ensemble ferment la boucle : **aucun compte portail n'atteignait aucun écran**, et rien ne le disait — *il n'existait pas d'écran de portail pour buter dessus.*
**L'arbitrage : la DIXIÈME forme de politique, « rattachement » [D92]** — un `SELECT`, et un `SELECT` seul, ancré sur `utilisateur_id = app.utilisateur_id`. Coût nommé, comme celui de D61 et de D67 : *une personne apprend la liste des clients auxquels elle est déjà rattachée* ; ni leur nom, ni leurs données, ni l'existence d'aucun autre. Ce qui la borne est la **commande** : `FOR SELECT` n'accepte aucun `WITH CHECK`, si bien que la borne est structurelle et non déclarative. Et **la neuvième forme s'étend au même compte sans changer de règle** : D67 dit « les sociétés où il est habilité », et un compte portail EST habilité — par `utilisateur_client`.
**CONSULTATION SEULE, et rien n'est préparé pour l'écriture.** « Demander une intervention » n'est pas tranché : il n'est ni construit **ni préparé** — aucune table ne l'attend, aucun champ mort ne le devance. *Une place réservée pour une décision qu'on n'a pas prise est une décision prise par personne.*
**Les emplacements des documents (lot 8) et de l'état VGP (lot 9) sont TENUS ET DITS VIDES** : ni un compte de documents à zéro, ni un état « à jour » — le premier se lirait comme une mesure, et le second serait faux au sens de D88.
**L'ÉCRAN A REÇU SON APPELANT DANS LE MÊME TICKET**, et il a failli ne pas l'avoir : la page d'arrivée ne menait nulle part, si bien que le portail aurait été *une politique posée, un module écrit, un écran écrit, et rien pour y mener* — la faute que ce dépôt a déjà payée deux fois avec D61 et D67.
*Acceptation :* un compte portail restreint à un site ne voit pas la machine d'un autre site du MÊME client, et le jumeau retire cette branche de la politique pour la faire reparaître ; un compte rattaché à DEUX sociétés atteint les deux, avec son témoin — un compte à une seule n'en rend qu'une ; une désignation qui n'est pas la sienne LÈVE, elle ne rend pas une liste vide.
*Relu contre les sources citées le 12/09/2026 — empreinte `e55edc71`.*

**L2-13 — LE LIEN D'INVITATION AU PORTAIL. [D96] [D10]**
*File :* LIBRE
**Mesuré le 11/09/2026, et c'est le constat qui a ouvert le ticket :** *aucun client ne peut se connecter au portail.* D10 veut les deux tables exclusives — un compte de portail n'a **aucune** ligne dans `utilisateur_societe` — et le seul dispositif d'ouverture de compte du dépôt, `lib/auth/amorcage.ts`, exige une société puis **crée précisément cette ligne**. L'enrôlement (D58) n'est pas une porte : il pose un second facteur sur un compte qui existe déjà.
*La boucle que D92 avait fermée côté LECTURE restait ouverte côté ENTRÉE : la politique était juste, l'écran existait depuis L2-12, et il n'y avait personne pour les franchir.*
**TRANCHÉ [D96] — le lien d'invitation est une porte DISTINCTE.** Il n'exige aucune habilitation de société et **porte lui-même le rattachement au client**, et le cas échéant le périmètre de sites. *Réutiliser l'amorçage aurait obligé à donner une habilitation de société à un compte de portail, c'est-à-dire à défaire D10 pour ouvrir une porte.*
**Quatre exigences, tenues par la BASE et jamais par l'écran** : usage unique, durée limitée, révocable, tracé — qui a invité qui, quand. *Un lien d'invitation est un matériau d'authentification ; « l'écran ne le propose qu'une fois » n'est pas un usage unique.*
**L'ENVOI N'EST PAS CONSTRUIT, et la raison est mesurée** : aucun expéditeur de courriel n'est configuré, et poser une clé est un geste hors du dépôt. *Une fonction d'envoi sans expéditeur est pire qu'une interface sans appelant — elle en a un, et elle échoue en production, à l'instant où une agence croit avoir invité un client.* V1 : le lien est ENGENDRÉ dans le back-office, l'agence le transmet par ses propres moyens.
**Le coût, nommé :** un lien transmis hors bande ne prouve pas l'adresse de son destinataire — il vaut pour **qui le reçoit**, et c'est l'agence qui répond de la transmission. Même régime que le lien de premier accès interne, et pour la même raison.
**Ce ticket crée une table, donc une migration, donc un GESTE d'exploitation** (§12 du protocole).
*Acceptation :* un rôle habilité engendre un lien depuis le back-office, pour un client de sa société ; le lien consommé crée un compte SANS ligne dans `utilisateur_societe` et AVEC sa ligne dans `utilisateur_client` ; un second usage du même lien est refusé, et un lien expiré et un lien inconnu rendent LE MÊME refus (D35) ; une révocation rend le lien inutilisable sans le supprimer ; le compte créé atteint `/portail` et n'y voit que le parc de son client — mesuré par un scénario de bout en bout, avec son témoin ; aucun chemin ne permet d'inviter sur le client d'une autre société, et un jumeau le montre en retirant le contrôle.
*Relu contre les sources citées le 11/09/2026 — empreinte `bd3c5254`.*

**L7-04 — Déverrouillage d'un compte parvenu à l'ESCALADE. [D62] [D64] [D66]**
*File :* LIVRÉ
**Déclencheur explicite : le premier compte réellement verrouillé après trois verrouillages enchaînés.** L'état est atteignable en trente codes faux, et aucun chemin n'en sort aujourd'hui.
**Ce n'est PAS L7-01, et la distinction est de fond : L7-01 rend un accès PERDU, L7-04 ne rend que le droit de RÉESSAYER.** Le facteur est intact ; seule la série de verrouillages est à rompre. Exiger un réenrôlement après une suite de fautes de frappe serait absurde.
**Exécuté par l'`admin_societe` de la société concernée**, journalisé [D64]. *Déverrouiller n'accorde aucun accès : la personne devra toujours présenter un code valide.* C'est une gêne d'exploitation, pas un événement de sécurité, et exiger l'administrateur de plateforme pour une gêne d'exploitation ferait dépendre CODIMA d'un appel extérieur un vendredi soir — c'est-à-dire du contournement de la mesure, exactement ce que L7-01 s'emploie à éviter.
~~**Ce qui existe déjà, et qui rend le ticket petit**~~ **— LIVRÉ le 09/09/2026 [D66], et il n'était pas petit.** Le déclencheur `second_facteur_escalade` laissait bien passer la remise à zéro ; ce qui manquait était le DROIT, et l'écrire a buté sur un mur que le ticket ne prévoyait pas. **La forme évidente — une politique d'`UPDATE` et un `WHERE utilisateur_id`** — ne fonctionne pas : PostgreSQL applique les politiques de `SELECT` au `WHERE` d'un `UPDATE`, si bien qu'il aurait fallu **ouvrir la lecture de `second_facteur` à l'administrateur**, c'est-à-dire lui donner le secret et les codes de secours de la personne qu'il dépanne. Mesuré, les deux sens. La sortie est un `UPDATE` **sans clause `WHERE`**, que PostgreSQL ne soumet à aucune politique de lecture : la ligne est désignée par `app.deverrouillage_sujet_id`, et bornée par le seul `USING`. **Aucune lecture n'est ouverte à personne.**
*Acceptation :* aucun autre rôle ne peut l'exécuter, y compris `direction` de la société concernée et le sujet lui-même ; chaque déverrouillage laisse une ligne au journal des accès portant l'auteur, la société et le compte ; le compte déverrouillé doit présenter un code valide pour entrer, et n'a **rien** à réenrôler ; le refus opposé aux autres rôles est éprouvé **par retrait** de la politique, dans une transaction annulée.
*Relu contre les sources citées le 09/09/2026 — empreinte `cf2368ac`.*

**L7-01 — Déblocage d'un `admin_societe` ayant perdu son second facteur. [D40]**
*File :* LIBRE
RG-DRO-05 rend le second facteur obligatoire sur `admin_societe`. Ce rôle est, chez un client, le seul à pouvoir administrer les comptes : son titulaire bloqué ne peut être débloqué par personne de sa société. Sans procédure, cela se règle par un appel au support puis par un second compte `admin_societe` créé « au cas où » — c'est-à-dire par le contournement de la mesure.
Exécutable par **`admin_plateforme` seul**. Journalisée dans **`journal_acces`** — la seule table qui puisse la porter, puisqu'elle enjambe les sociétés par construction (D34).
*Acceptation :* aucun autre rôle ne peut l'exécuter, y compris `direction` de la société concernée ; chaque déblocage laisse une ligne au journal des accès portant l'auteur, la société cible et le compte débloqué ; le compte débloqué doit réactiver un second facteur avant de retrouver ses droits d'administration.
*Relu contre les sources citées le 01/09/2026 — empreinte `d1cbe258`.*
**L7-03 — Journalisation des accès des rôles ÉDITEUR aux données d'une société cliente. [D32]**
*File :* LIBRE
**C'est l'unique maison de ce point** *(ticket R0-a, écart É2 de la revue R0)*. D32 réduit l'exigence du §15 — « toute consultation de données client par un utilisateur interne est journalisée » — à deux choses : **les basculements de société active**, livrés à L0-06 et éprouvés par `bascule-societe.test.ts`, et **les accès des rôles éditeur aux données d'une société cliente**, qui n'existaient nulle part. La moitié livrée faisait passer la seconde pour livrée aussi. Elle a désormais un ticket, un lot, et un seul des deux : ni ligne au registre, ni renvoi — un point rangé à trois endroits est un point qu'on croit rangé.
**Pourquoi le lot 7, et pas plus tôt.** Le §22.5 est tenu : un rôle éditeur n'a **aucune** habilitation par défaut, et les scénarios d'isolation le prouvent aujourd'hui — il ne lit rien de cloisonné. Il n'y a donc **aucun accès éditeur à journaliser tant que la console éditeur n'existe pas**. Ce ticket naît avec elle, et avec L7-01 dont il enregistrera le déblocage.
**Ce qui manque au socle, et qui est le vrai travail.** `EvenementAcces` porte `bascule_societe`, `bascule_refusee` et `requete_consolidation` : **aucune valeur ne peut porter un accès éditeur**. Le ticket ajoute la valeur à l'énumération, et rien d'autre au schéma — `journal_acces` porte déjà `societe_id_source` et `societe_id_cible`, **informatives et nullables** (D34), et c'est exactement à cette question qu'elles répondent : « qui a tenté d'accéder à mes données ». Elles ne filtrent toujours pas, et le gardien `journal-acces-informatif.test.ts` reste vert.
**Ce que le ticket ne fait pas :** journaliser les lectures métier ordinaires d'un utilisateur **interne** d'une société. D32 les a écartées — le volume serait sans rapport avec la valeur, et le §15 est narratif donc non normatif (D1). Élargir ce périmètre serait un arbitrage.
*Acceptation :* toute lecture, par un rôle éditeur, d'une donnée appartenant à une société cliente laisse une ligne dans `journal_acces` portant l'auteur, l'horodatage, le rôle et la société visée ; un test prouve qu'un rôle **interne** lisant les données de sa propre société n'en produit **aucune** ; les deux colonnes de société restent informatives — aucune requête, aucune politique, aucun index ne les prend pour filtre.
*Relu contre les sources citées le 10/09/2026 — empreinte `8ddb2c10`.*

**R1-01 — La veille dit d'où vient un écart, au lieu de l'affirmer. [incident du 10/09/2026, ticket #95]**
*File :* LIBRE
**Déclencheur : immédiat.** Le gabarit de l'issue ouverte par une veille rouge écrit, en toutes lettres : *« Ces écarts ne viennent d'aucune migration — ce sont des gestes passés à la main. »* **C'est une phrase fixe, pas une mesure.** La veille observe la base ; elle ne compare **jamais** `_prisma_migrations` au répertoire `prisma/migrations/` du dépôt, et ne peut donc pas savoir d'où vient un écart.
**Mesuré le 10/09/2026 sur l'exécution `34493977325`** : l'unique écart rapporté — `utilisateur_client` sans la forme « rattachement » — est **exactement** le contenu de `20260911010000_rattachement_portail_d92`, **jamais appliquée**. Quatre migrations étaient en retard, le dernier `db-migrate` réussi remontant au 09/09 à 22:55 UTC. Le ticket de sécurité nommait une cause qu'il n'avait pas mesurée, et il a envoyé chercher au mauvais endroit.
*C'est la pente du §9 (07/09) — affirmer un état observable au lieu de l'observer — logée dans un GABARIT, c'est-à-dire à l'endroit où elle se répétera à chaque alarme.*
*Acceptation :* la veille compare les migrations appliquées en base au répertoire du dépôt et **nomme le décompte en retard** ; le gabarit n'affirme le geste manuel **que** lorsque ce décompte est nul, et écrit sinon « N migration(s) en retard — appliquer `db-migrate` avant de conclure » ; un scénario montre les deux verdicts, dont celui qui ne conclut pas au geste manuel.

**R1-02 — Le README des captures dit comment savoir si un écran a changé depuis. [10/09/2026]**
*File :* LIBRE
**Déclencheur : la prochaine prise de vue.** Le README nomme le commit photographié, et c'est la règle du §9. Ce qu'il ne dit pas : *comment un lecteur sait qu'aucun écran n'a bougé depuis.* La question se répond en une commande — `git diff --name-only <empreinte> main` restreint aux chemins d'écran — et cette commande est aujourd'hui tapée à la main, donc pas tapée.
**Mesuré le 10/09/2026** : entre `b8c3f76` (photographié) et `2fe6e8b`, **67 fichiers changés et aucun sous `app/`, `components/`, `lib/theme/` ni `lib/i18n/`** — les images étaient exactes, et rien dans le dossier ne le disait.
*Acceptation :* `scripts/captures.mts` énumère les chemins qu'il tient pour « surface d'écran » et les écrit dans le README avec l'empreinte ; une commande dit si l'un d'eux a changé depuis la prise, et rend un état — jamais un silence.

**~~R1-03~~ — Chiffrer ce que la limitation de `ci.yml` à `push.branches ["main"]` a réellement économisé. [demande d'exploitation du 11/09/2026, issue #103]**
~~Écrit cette nuit-là, et **sans objet depuis le matin** : automatisation GitHub Actions abandonnée le 11/09/2026.~~ Le ticket est **barré, jamais effacé** — ce qui a été décidé un jour se relit, sinon on le redécide (CLAUDE.md §2). Il mesurait le gain d'une borne posée sur un flux qui ne tourne plus. *Condition de réouverture : le jour où un flux planifié consomme à nouveau des minutes de CI.*

**~~R1-04~~ — Le compteur de budget dans le rapport de nuit. [demande d'exploitation du 11/09/2026, issue #103]**
~~Sans objet : automatisation GitHub Actions abandonnée le 11/09/2026.~~ Il n'y a plus de rapport de nuit, donc plus de budget à y compter. *Condition de réouverture : le jour où une exécution non humaine dépense à nouveau un budget mesurable.*

**~~R1-05~~ — Le trou de vérification à la fusion. [demande d'exploitation du 11/09/2026, issue #103]**
~~Sans objet en tant que travail sur le rapport de nuit : automatisation GitHub Actions abandonnée le 11/09/2026.~~ **Mais le trou lui-même ne l'est pas, et c'est pourquoi ce ticket se relit plutôt qu'il ne disparaît** : un commit de fusion produit avec un jeton d'application ne déclenche pas la CI sur `main`, et cela reste vrai d'une fusion faite à la main par un agent. *Condition de réouverture : elle est déjà remplie si une fusion vit sur `main` sans exécution de CI qui la couvre — la moitié « rapport de nuit » tombe, la moitié « rendre la fusion non vérifiée visible » reste due.*

**~~R1-06~~ — La note de `nuit.yml` sur `github_token` est devenue fausse. [demande d'exploitation du 11/09/2026, issue #103]**
~~Sans objet : automatisation GitHub Actions abandonnée le 11/09/2026.~~ **Remplacé par R1-11**, qui traite le même fichier pour une raison plus forte : sa planification est trompeuse, pas seulement sa note.

**R1-07 — Le gabarit d'un paragraphe d'arbitrage, TRANSPOSÉ au mode manuel. [demande d'exploitation du 11/09/2026, issues #103 et suivante]**
*File :* LIBRE
**Déclencheur : immédiat.** Le ticket d'origine demandait `.github/ISSUE_TEMPLATE/arbitrage.md` — un gabarit de TICKET. L'automatisation étant abandonnée le 11/09/2026, **un arbitrage ne s'ouvre plus en ticket : il s'écrit dans le compte rendu que la session rend.** La demande survit, sa destination change : ce n'est plus un fichier de gabarit GitHub, c'est une section de `docs/protocole-session.md` qui impose la forme.
*Un ticket incompréhensible par quelqu'un sans contexte est un ticket raté* — et un paragraphe d'arbitrage l'est tout autant : Alexis le lit sur son téléphone entre deux rendez-vous.
*Acceptation :* `docs/protocole-session.md` porte la forme imposée d'un paragraphe d'arbitrage — un titre sans jargon de moins de 80 caractères ; ce qui est en jeu en deux phrases ; ce qui a été **mesuré**, avec ses chiffres ; deux ou trois issues, chacune avec ce qu'elle coûte et ce qu'elle interdit ; ce qui est bloqué et ce qui continue. Un gardien statique lit le document et échoue si l'une des cinq sections manque à la forme — la forme se garde, le contenu ne se garde pas.

**~~R1-08~~ — La relecture adverse — `.github/workflows/relecture.yml`. [demande d'exploitation du 11/09/2026, issue #103]**
~~Sans objet sous cette forme : automatisation GitHub Actions abandonnée le 11/09/2026.~~ **Ce qui tombe est le FLUX, pas le besoin** — *une relecture qui ne trouve jamais rien est elle-même un gardien vide*, et c'est le §9 qui le dit, pas ce ticket. *Condition de réouverture : le jour où une seconde exécution à contexte neuf redevient possible, par un flux ou par une passe manuelle explicitement demandée.*

**R1-09 — `docs/mise-en-ligne.md` §5.1 affirme un état que le code contredit. [mesuré le 11/09/2026]**
*File :* LIBRE
**Déclencheur : immédiat, et c'est le ticket le plus coûteux de ce lot** — il fait perdre une demi-journée à qui suit la note.
**Mesuré le 11/09/2026.** Le §5.1 écrit : *« `prisma/seed.ts` n'écrit toujours **aucune ligne de `compte`** »*. `prisma/seed.ts:148` appelle `compte.create({ …, mot_de_passe: null })`, par `poserLeMoyenDeConnexionAuRepos`, appelée aux lignes **722** (les quatre identités internes) et **771** (le compte portail) ; introduite par le commit `62bf554`, le 10/09/2026 à 05:51:46 UTC. Et le semis a tourné **après** — exécution #44 de « DB migrate & seed », 10/09 22:05:33 UTC : *« utilisateurs internes — 4 identités »*, *« comptes portail — 1 rattachement »*.
**Ce que la phrase fausse coûte.** `lib/auth/amorcage.ts` réémet un jeton de premier accès à trois conditions : l'identité existe, elle est habilitée sur la société visée, et son `compte` porte `mot_de_passe IS NULL`. **Les quatre identités de démonstration les remplissent toutes les trois.** La note envoie donc créer une base de production, y déposer deux secrets et amorcer une société — pour un écran connecté qu'on peut ouvrir sans rien de tout cela.
*Acceptation :* la phrase est **barrée et non effacée** (CLAUDE.md §2), avec sa date et le commit qui l'a rendue fausse ; une section « voie courte » donne les clics littéraux de la connexion sur la base de démonstration, en nommant l'identité et l'identifiant de société mesurés ; et le README ou un gardien dit ce qui rendrait la nouvelle phrase fausse à son tour.

**R1-10 — Clore l'issue #95 avec sa cause mesurée. [mesuré le 11/09/2026]**
*File :* LIBRE
**Déclencheur : immédiat.** L'issue *« [veille-securite] la base hébergée a DÉRIVÉ »*, ouverte le 10/09/2026 à 15:18 UTC, est **toujours ouverte** alors que sa cause est traitée.
**Mesuré le 11/09/2026.** L'écart unique qu'elle rapportait — `utilisateur_client` sans la forme « rattachement » — était le contenu de la migration `20260911010000_rattachement_portail_d92`, jamais appliquée. L'exécution #44 de « DB migrate & seed », 10/09 22:04:51 UTC, imprime `All migrations have been successfully applied.`, et le contrôle de cloisonnement de la même exécution nomme désormais `rattachement (1) : utilisateur_client`. La dérive est refermée.
*C'est le corollaire de R1-01, vu par l'autre bout : une alarme laissée ouverte à tort apprend à ne plus lire les alarmes, exactement comme un gabarit qui affirme une cause qu'il n'a pas mesurée.*
*Acceptation :* l'issue est close en nommant la migration en cause, l'exécution qui l'a appliquée et la ligne du contrôle qui le constate ; la clôture ne dit jamais « geste manuel » — c'est la phrase que R1-01 vient retirer du gabarit.

**R1-11 — Retirer de `nuit.yml` une planification devenue trompeuse. [mesuré le 11/09/2026]**
*File :* LIBRE
**Déclencheur : immédiat.** Le flux est désactivé — état `disabled_manually`, mis à jour le 11/09/2026 à 12:54:55 +11:00 — et **le fichier porte toujours `schedule: cron "0 16 * * *"`**. Un flux désactivé manuellement ne part pas ; mais l'état vit dans l'interface de GitHub, et le dépôt dit le contraire.
*C'est l'espèce du §9 du 31/08 prise à l'envers : là, une garantie reposait sur un attribut extérieur à la chose garantie ; ici, c'est une NEUTRALISATION qui repose sur un attribut extérieur, et le fichier qu'on relira dans trois mois annonce une nuit qui tourne.*
*Acceptation :* `nuit.yml` ne porte plus de déclencheur `schedule` ; son en-tête dit que l'automatisation a été abandonnée le 11/09/2026, et à quelle condition elle se rouvrirait ; `claude.yml` reçoit la même mention si son état le justifie, mesuré et non supposé.

---

## Reprise de l'interface d'après la maquette — D95

*Ouvert le 11/09/2026. La maquette fait foi sur la disposition et les couleurs ; `/planning` a été refait le jour même comme écran de référence, et **rien n'a été propagé aux autres** — Alexis juge `/planning` en ligne avant. Chaque ticket nomme l'écran de la maquette auquel il se confronte, ou dit qu'il n'en a pas.*

**Le socle est posé et n'est pas à refaire :** les jetons d'apparence, la barre à onze entrées, la largeur utile de 1400 px et l'échelle typographique vivent dans la mise en page racine. Un écran repris n'a donc **aucune couleur à écrire, aucune largeur à choisir, aucune barre à rendre** — s'il en écrit une, c'est un défaut.

**R2-01 — Le SECOND THÈME : « le tableau », l'apparence d'avant D95. [D95]**
*File :* LIBRE
**Déclencheur : immédiat.** D95 a fait de l'apparence d'avant un thème alternatif, et n'en a construit aucun : `APPARENCES` ne contient qu'une entrée. **Tant qu'il n'y en a qu'une, le mécanisme n'est pas éprouvé** — il est seulement écrit. *C'est l'espèce du §9 (08/09) : un défaut invisible parce que ce qu'il casse n'existe pas encore.*
**Ce que « le tableau » désigne est MESURABLE, et D95 le dit** : l'apparence en vigueur sur `main` au commit `d03a4a5` — les jetons `oklch` de `app/globals.css` et les gris ardoise de `lib/theme/defaut.ts`. Le nom lui-même ne désigne aucun document du dépôt.
*Acceptation :* un bloc `[data-apparence="tableau"]` déclare les vingt-neuf jetons, une entrée rejoint `APPARENCES`, et le gardien d'apparence passe sans être touché ; **un scénario montre que basculer l'attribut change le rendu sans qu'aucun fichier d'écran ne bouge** — c'est la promesse de D95, et elle n'est tenue que quand deux thèmes existent.

**R2-02 — Le thème est une PROPRIÉTÉ DE LA SOCIÉTÉ. [D95]**
*File :* BLOQUÉ — arbitrage de schéma : ajouter une colonne à `societe` touche la table que `societe_id` désigne, et le §8 du CLAUDE.md en fait un point d'arrêt. R2-01 d'abord.
**Déclencheur : quand R2-01 est livré.** C'est l'exigence commerciale que D95 nomme : *un client tiers voudra ses propres couleurs.* Aujourd'hui l'apparence est une constante du code.
**À ne pas confondre avec la charte de L0-09**, et c'est tout le piège : la charte porte DEUX couleurs d'identité, propres à une société, déjà en base et déjà nullables. Le thème porte le SOCLE entier — surfaces, bordures, encres, familles de statut. Les deux se posent ensemble et ne se remplacent pas.
*Acceptation :* une colonne de `societe` porte le nom du thème, nullable — « pas de thème choisi » doit rester un état représentable, comme pour la charte ; `themeDuContexte` la lit sous le contexte cloisonné ; une société sans thème reçoit l'apparence par défaut ; un scénario d'isolation montre que deux sociétés voient deux apparences, et qu'aucune ne peut lire celle de l'autre.

**R2-03 — Le SÉLECTEUR de thème. [D95]**
*File :* BLOQUÉ — un sélecteur sans second thème est un réglage sans usage, et c'est la faute que `parametrage.ts` évite déjà sur les créneaux. R2-01 et R2-02 d'abord.
**Déclencheur : quand deux thèmes existent et qu'une société peut en porter un.** *Un thème que personne ne peut choisir est un thème que personne ne verra* — c'est la condition de réouverture que D95 écrit.
*Acceptation :* l'écran de réglage d'une société laisse choisir son thème parmi `APPARENCES` ; le choix est journalisé comme toute modification d'une table auditée (I8) ; aucun écran n'a été touché pour l'ajouter.

**R2-04 — `/arrivee` — 448 px et centré à mi-hauteur. [D95]**
*File :* LIVRÉ
**Rien n'a été inventé, et c'était le risque du ticket.** *« Ce qu'il affiche ne change pas d'un mot »* : « qui vous êtes, pour quelle société, et rien d'autre » est une décision de L1-02f, pas une question d'apparence. Seule la FORME bouge — une accroche a été ajoutée, et elle ne dit rien de plus que le titre, elle le situe.
**Mesuré à travers un navigateur, fenêtre 1700 × 1000 :** contenu 448 px → **1360 px**, et le cadre commence désormais **sous la barre** au lieu d'être centré à mi-hauteur. *Un contenu centré à mi-hauteur sous une barre ancrée en haut flotte sans rien pour le tenir.*
**L'écart avec la maquette est écrit avec sa raison** : elle ne décrit aucun écran d'arrivée. Ce qui est repris est le seul point où elle parle — ses écrans commencent en haut, sur la largeur utile, titre 22 px extra-gras et accroche grise 13 px. Ce qui reste libre est la disposition interne, tenue en trois colonnes plutôt qu'en une bande étroite.
**Écran de la maquette : AUCUN.** Elle ne décrit pas d'écran d'arrivée — elle s'ouvre directement sur le tableau de bord. *C'est donc le ticket le plus exposé du lot : il n'a pas de modèle, et la tentation sera d'en inventer un.*
**Mesuré le 11/09/2026, à 1700 px : contenu de 448 px de large, centré verticalement, document de 1072 px.** Il porte `max-w-md` et `justify-center` — la forme d'une page de connexion, pas celle d'un écran d'arrivée dans un back-office de 1400 px.
*Acceptation :* l'écran occupe la largeur utile et commence en haut ; ce qu'il affiche ne change pas d'un mot — *qui vous êtes, pour quelle société, et rien d'autre* est une décision de L1-02f, pas une question d'apparence ; si la maquette reste muette sur la forme, l'écart est écrit avec sa raison.

**R2-05 — `/parametres/agences` — des cartes là où la maquette met un tableau dense. [D95]**
*File :* LIVRÉ
**Mesuré à travers un NAVIGATEUR, pas déduit** — c'est le harnais de R2-18 qui le rend possible, et l'acceptation l'exigeait depuis le début : *« le nombre d'établissements visibles sans défiler est mesuré avant et après, et il augmente. »*

| Fenêtre 1700 × 1000, trois établissements | avant | après |
|---|---|---|
| largeur du contenu | 896 px | **1360 px** (la largeur utile) |
| hauteur du document | 1428 px | **1000 px** — aucun défilement |
| établissements entièrement visibles | **2 sur 3** | **3 sur 3** |

**Le formulaire de réglage du pas est DANS la ligne**, et un scénario le vérifie : *on règle un pas en regardant celui des autres établissements*, et le sortir dans un écran de détail ferait perdre la comparaison que le tableau vient de gagner.
**Un écart avec la maquette, écrit avec sa raison :** elle intitule son tableau « par site » et ses lignes sont Ducos, Koné, Dolbeau — qui sont des ÉTABLISSEMENTS. Le vocabulaire imposé prime (D5, D47) : la colonne vient de `mot("agence")`. *La maquette fait foi sur la disposition et sur les couleurs, jamais sur le vocabulaire.*
**« Sans calendrier » se DIT plutôt que de laisser des tirets** : c'est un état qui interdit toute pose (I7), pas une donnée manquante.
**Écran de la maquette : « Sociétés & tarifs ».**
**Mesuré le 11/09/2026 : contenu de 896 px, document de 1354 px pour trois agences** — soit environ 380 px de hauteur par agence de huit champs. La maquette range ce genre de contenu en tableau : en-têtes en majuscules fines, lignes de 11 px de padding, pas de carte par enregistrement.
*Acceptation :* l'écran occupe la largeur utile et présente les agences en tableau ; le formulaire de réglage du pas reste atteignable sans quitter la ligne ; le nombre d'agences visibles sans défiler à 1700 px est mesuré avant et après, et il augmente.

**R2-06 — `/parametres/forfaits` — même écran de maquette, même reprise. [D95]**
*File :* LIVRÉ
**La forme est PARTAGÉE, pas recopiée** : `components/ui/tableau.tsx`, une seule fois, et ses valeurs sont LUES dans la maquette — en-tête 10,5 px capitales, interlettrage 0,6 px, cellules à 11 px de padding. *Deux implémentations d'un même critère divergent en silence, et une forme visuelle est un critère comme un autre — c'est même celui dont la divergence se voit le plus et se mesure le moins.*
**Mesuré à travers un navigateur, fenêtre 1700 × 1000 : contenu 896 → 1360 px, document 1146 → 1000 px.** Et un scénario compare la forme d'en-tête des DEUX écrans — capitales, 10,5 px : *« les deux écrans se ressemblent » est une impression tant que personne ne la mesure.*
**Le regroupement par nature reste** : le rang ne se compare qu'entre forfaits de même nature, et l'écran le dit par sa structure plutôt que dans une note.
**Écran de la maquette : « Sociétés & tarifs »** — le même que R2-05, et c'est pourquoi les deux tickets sont séparés mais jumeaux : la barre les allume tous deux, ils doivent se ressembler.
*Acceptation :* mêmes critères que R2-05 ; et les deux écrans partagent leur forme de tableau plutôt que d'en écrire deux — *deux implémentations d'un même critère divergent en silence* (§9, 01/09).

**R2-07 — `/portail` — le portail client. [D95] [D92]**
*File :* LIBRE
**Écran de la maquette : « Portail client »** — bandeau dégradé, cartes de parc, et le ton d'un espace client plutôt que d'un back-office.
**Ce ticket a une CONDITION D'ÉPREUVE que les autres n'ont pas** : aucun compte portail ne peut se connecter aujourd'hui — le seul émetteur de lien de premier accès exige une habilitation dans `utilisateur_societe`, qu'un compte portail n'a pas par D10. *Mesuré le 10/09/2026 et toujours vrai : les quatre captures du portail sont refusées pour cette raison.* La reprise est donc écrite à l'aveugle tant que ce mur tient.
*Acceptation :* l'écran suit la maquette ; et le ticket dit explicitement s'il a été VU ou seulement écrit — une reprise d'apparence non photographiée est une intention.

**R2-08 — `/planning/[id]` et `/planning/nouvelle` — la fiche et la saisie. [D95]**
*File :* LIVRÉ
**La forme de fiche est LUE dans la maquette, pas approchée** : `.mach`, deux colonnes `1fr 300px` ; `.dl`, une grille `132px 1fr` à 13 px, étiquettes grises en 12 px et valeurs en demi-gras. *Mesuré avant : `max-w-3xl`, soit 768 px dans une fenêtre de 1700, et cinq actions empilées à la file sous l'identification ; après : **1360 px**, identification et actions côte à côte.*
**Les actions passent en colonne latérale sans changer de régime** : un refus reste affiché À LA PLACE de l'action, avec sa raison. Ce qui change est qu'on les voit AVEC l'identification — *on décide d'annuler une intervention en regardant ce qu'elle est, pas en s'en souvenant après avoir défilé.* Un scénario compte les quatre formulaires : « il en reste » ne dit pas combien ont disparu.
**La SAISIE reste étroite, et c'est une décision écrite** : un formulaire à champs pleine largeur sur 1360 px est plus difficile à remplir qu'un formulaire étroit — l'œil parcourt la ligne entière entre l'étiquette et le champ. *La largeur utile est celle de l'ÉCRAN ; celle d'un formulaire est celle de sa colonne.* Le titre occupe la page, le cadre est borné à 640 px.
**Écran de la maquette : AUCUN pour la saisie ; « Fiche machine » donne la FORME d'une fiche** — deux colonnes, `dl` de 132 px, colonne latérale de 300 px, frise verticale. C'est cette forme qui se reprend, pas son contenu.
**Mesuré le 11/09/2026 : `max-w-3xl` (768 px) pour la fiche, `max-w-2xl` (672 px) pour la saisie**, dans une fenêtre de 1700.
*Acceptation :* les deux écrans occupent la largeur utile et suivent la forme de fiche de la maquette ; les cinq actions de D84 restent atteignables et leur refus reste lisible.

**R2-09 — Les écrans d'authentification — connexion, code, enrôlement, premier accès. [D95]**
*File :* LIVRÉ
**Constaté conforme sur la FORME, et corrigé sur un défaut que personne n'avait vu.** La colonne étroite et centrée est la bonne forme pour ces quatre écrans — le ticket le disait, et rien ne la contredit : ce ne sont pas des écrans de travail.
**La moitié « barre de navigation » a été livrée par R2-16**, mesurée plutôt que supposée.
**Le défaut trouvé, et il tient à 88 px.** *Mesuré : `min-h-dvh` posé sur la page, à l'intérieur d'un cadre portant 88 px de gouttière verticale — document de 1088 px dans une fenêtre de 1000.* Une page de connexion qui défile de 88 px pour rien. La hauteur est désormais tenue par la mise en page du SEGMENT, et les pages n'occupent que ce qui reste : plus de nombre magique, et un scénario mesure qu'aucun des trois écrans ne déborde.
**Écran de la maquette : AUCUN.** Elle s'ouvre sur une session déjà établie. *Et c'est le seul endroit du produit où une colonne étroite et centrée est la bonne forme* — ces quatre écrans ne sont pas des écrans de travail.
**Ils n'ont donc peut-être RIEN à reprendre, et le ticket existe pour que ce soit constaté plutôt que supposé.** Ce qui les concerne sûrement : la barre de navigation n'a rien à faire au-dessus d'une page de connexion, et elle s'y affiche aujourd'hui.
*Acceptation :* la barre ne s'affiche pas sur les écrans qui précèdent la session ; le reste est constaté conforme ou corrigé, avec la raison écrite dans les deux cas.

**R2-10 — `/` et `/sante` — les deux écrans sans compte. [D95]**
*File :* LIVRÉ
**Même défaut, même réparation que R2-09** : les deux écrans débordaient de 88 px. Ils sont dans le même segment, et c'est le segment qui tient la hauteur.
**`/sante` NE LIT RIEN DE PLUS.** La reprise n'a touché que sa mise en page ; son jumeau — *elle s'affiche avec une base injoignable* — reste vert, et la mise en page de son segment ne lit rien non plus, délibérément.
**Écran de la maquette : AUCUN pour l'un ni pour l'autre.**
`/sante` a une contrainte que rien d'autre n'a : *elle ne lève jamais, et elle ne rend aucun secret.* Une reprise d'apparence ne doit pas lui faire lire quoi que ce soit de plus — pas même le thème d'une société.
*Acceptation :* les deux écrans portent l'apparence du produit ; `/sante` continue de s'afficher avec une base injoignable, et son jumeau le prouve toujours.

**R2-11 — LE NOM D'UN TECHNICIEN dans la grille. [D95]**
*File :* LIVRÉ
**ET LE BLOCAGE ÉTAIT FAUX.** Il disait : *« la table `technicien` du chapitre 11 n'existe pas, et la créer touche le modèle de données »*. Aucune table n'a été créée, et aucun élargissement du cloisonnement n'a été nécessaire — **le droit existait depuis L1-02c, le 07/09/2026**, par la branche « rattachement » de `utilisateur_lecture`.
*Mesuré le 11/09/2026 sous `codiplan_app`, avec trois témoins — rôle non privilégié, les deux drapeaux RLS actifs, zéro identité lue sans contexte :* **interne sous contexte société → 4 identités d'un seul tenant ; compte portail, même société, même instant → 0.**
*C'est la maladie que le §6 nomme à propos du portail, prise par l'autre bout : ce qui manquait n'était pas un droit, c'était un APPELANT.* `lib/auth/annuaire.ts` est cet appelant, et il ne rend que le NOM.
**Ce qui reste dû, et qui n'a PAS été fait :** la SPÉCIALITÉ d'un technicien — « compresseurs, ponts » chez Guérin — n'a de colonne nulle part, et son rattachement d'agence non plus. La grille les DÉRIVE de ses interventions. Le jour où une personne devra être rattachée à une agence sans y avoir travaillé, la question revient et c'est un arbitrage de schéma.
**Déclencheur : immédiat pour la question, différé pour la construction.** La maquette écrit « D. Guérin · Ducos · Compresseurs, ponts ». La grille rend `Technicien 0192f0a0` — l'identifiant abrégé, exactement comme la charge par technicien depuis le 10/09.
**Deux choses manquent, et elles ne se règlent pas au même endroit.** Le NOM : `utilisateur` porte la forme de politique « désignation », il ne se lit qu'en nommant sa ligne, une par une — lire quatre noms demanderait quatre lectures, et lire un planning entier en demanderait autant qu'il y a de techniciens. La SPÉCIALITÉ : aucune colonne ne la porte nulle part.
*Acceptation :* l'arbitrage tranche d'où vient le nom d'un technicien dans un écran cloisonné — table `technicien` du chapitre 11, colonne recopiée, ou lecture par désignation en lot — avec le coût de chacune ; puis la grille l'affiche.

**R2-12 — Les interventions de démonstration n'ont AUCUN technicien. [D95]**
*File :* LIVRÉ
**Déclencheur : immédiat.** *Mesuré le 11/09/2026 sur une base fraîchement semée : les douze interventions de démonstration portent `technicien_id = NULL`.* La grille du planning affiche donc des lignes « Interventions non affectées », une par agence — ce qui est **exact** et ne montre pas ce que l'écran est fait pour montrer.
**Ce n'est pas un défaut de la grille, et il ne se corrige pas dans la grille.** Le semis crée pourtant un technicien par société — `technicien.nc@codima.test`, `technicien.eu@codima.test` — et ne leur affecte rien.
~~**Ce ticket n'a PAS été fait dans la passe de D95, délibérément** : modifier les données de démonstration pour flatter un écran qu'on vient d'écrire est le geste qu'il faut se refuser.~~ **LE REFUS ÉTAIT MAL FONDÉ, et l'exploitation l'a retourné le 11/09/2026** : *« Alexis a décidé le 09/09 que la démonstration doit présenter un planning GARNI, parce que c'est ce qui montre le multi-société à un acheteur. Ce n'est donc pas retoucher les données pour flatter un écran : c'est un défaut du semis vis-à-vis de sa raison d'être, antérieur à l'écran. »*
*La leçon est celle du §9 du 13/09 prise dans l'autre sens : la mesure prime sur l'origine de la demande — y compris quand c'est MA prudence qui est mesurée fausse. Un refus se motive ; il se retire aussi quand le motif tombe.*
**Ce qui a été fait, au-delà de l'affectation :** les quatre techniciens viennent de la MAQUETTE, qui les nomme et qui dit pourquoi ils sont quatre. Et les DATES sont devenues relatives à la semaine courante — le §9 du 21/08 sur les fériés, appliqué au jeu de démonstration : *une démonstration datée se périme sans jamais être vide.*
*Acceptation :* le semis affecte une partie des interventions de démonstration aux techniciens qu'il crée déjà, et en laisse au moins une non affectée — la ligne « non affectées » est un cas réel du produit, elle doit rester démontrable ; aucun technicien n'est inventé.

**R2-13 — Le « Tableau de bord », premier écran de la maquette. [D95]**
*File :* BLOQUÉ — il affiche des indicateurs qui n'existent pas (taux d'occupation consolidé, préventif dans les délais, portefeuille de contrats). Lot 4.
**Écran de la maquette : « Tableau de bord »** — quatre indicateurs, interventions du jour, alertes.
**C'est la PREMIÈRE entrée de la barre, et elle est inerte.** Elle le restera visiblement jusqu'à ce lot, et c'est voulu : une entrée inerte dit ce que le produit sera, un lien vers un écran vide dirait qu'il est cassé.
*Acceptation :* hors périmètre tant que les indicateurs n'ont pas de source. Le ticket existe pour que l'entrée inerte de la barre ait un ticket, et non une promesse.

**R2-14 — La VUE JOUR du planning, à axe horaire. [demande d'exploitation du 11/09/2026]**
*File :* LIVRÉ
**Écran de la maquette : AUCUN** — elle ne décrit qu'un planning hebdomadaire. C'est donc un écran NOUVEAU, et le ticket existe pour dire d'où il vient et à quoi il se juge.
**Son objet, et le seul critère qui le juge :** *« montrer les trous — un créneau libre doit se distinguer au premier coup d'œil d'un créneau occupé, sinon l'écran ne sert à rien. »* Le compte des créneaux libres est donc affiché à l'écran et rendu par le module : *« on voit bien les trous » est une impression, pas une observation.*
**Trois états, jamais deux** — occupé, libre, hors ouverture. Le troisième n'est pas un confort : sans lui, 07:00 chez une agence qui ouvre à 09:00 se lirait comme un trou à remplir, et l'écran ferait promettre un rendez-vous intenable.
**Mesuré le 11/09/2026, à 1700 px : 25 créneaux libres, les 25 visibles sans défiler.**
*Ce qui reste dû :* aucune pose n'est possible depuis cet écran — il MONTRE, il ne pose pas. Le glisser-déposer est au lot 3.

**R2-15 — UNE TRAME VEUT DIRE UNE SEULE CHOSE. [règle rendue le 11/09/2026]**
*File :* LIVRÉ
**C'est une règle générale, rendue à l'occasion des couleurs de statut et inscrite ici pour qu'elle survive au ticket qui l'a fait naître.** L'annexe D demande « orange hachuré » pour une intervention suspendue ; la maquette réserve sa hachure au SITE FERMÉ. Sur l'écran qui sert à poser un rendez-vous, confondre « suspendu » et « fermé » serait un piège à erreur.
**La hachure dit « ce jour n'est pas ouvert », et rien d'autre, nulle part.** La vue jour, qui avait besoin d'un troisième état, emploie donc un aplat creux et non une trame.
*Acceptation :* tenue par `lib/theme/statuts.ts` et par `lib/interventions/journee.ts`, qui l'écrivent tous deux. *Ce qu'aucun gardien ne tient : rien n'empêche un écran futur d'inventer une seconde trame. La règle vit à la relecture, et elle est écrite là où on la cherchera.*

**R2-16 — La barre de navigation ne doit pas coiffer les écrans SANS SESSION. [mesuré le 11/09/2026]**
*File :* LIVRÉ
**Ce qui a été fait, et la forme compte plus que le résultat.** La barre a quitté la mise en page RACINE pour celle du SEGMENT. Trois groupes de routes, et chaque page en habite exactement un : `(sans-session)` — `/`, `/sante`, `/connexion`, `/connexion/code`, `/enrolement`, `/premier-acces` — sans barre ; `(back-office)` et `(portail)` avec.
*Ce qui décide n'est donc pas une liste de chemins mais le RÉPERTOIRE où le fichier est écrit* — une liste oublierait le prochain écran d'authentification, un répertoire se choisit au moment où l'on crée le fichier. `tests/unit/app/barre-par-segment.test.ts` DÉRIVE sa population de `app/` et refuse une page qui n'habiterait aucun des trois ; éprouvé sur les deux fautes réelles — la barre remise à la racine (6 pages en écart, nommées), une page posée hors groupe (nommée).
**Un effet de bord qui n'était pas demandé :** la largeur utile était posée par la racine, ce qui rendait la barre à l'intérieur d'un conteneur centré. Elle est passée dans `components/mise-en-page/largeur-utile.tsx`, rendu par les trois mises en page — une seule écriture des valeurs, comme avant.
**Et le gardien de « la racine ne lève jamais » a été ÉLARGI plutôt que déplacé** : il regardait UN fichier, il y a désormais quatre mises en page et trois lisent une session. *C'est le §9 du 09/09 en acte — la garantie était énoncée pour un fichier, un second appelant l'aurait traversée sans la rencontrer.* Sa population vient maintenant du répertoire.
**Ce qui N'A PAS été fait, et qui est porté en R2-17 :** le portail continue d'afficher les onze entrées d'une barre de back-office.
**Déclencheur : immédiat.** La barre est du chrome de mise en page racine, donc elle s'affiche AUSSI sur `/connexion`, `/premier-acces`, `/enrolement` et `/sante`. *Onze entrées dont dix inertes au-dessus d'un formulaire de connexion ne disent rien à personne, et la pastille d'identité y est vide par construction.*
**Ce n'est pas un défaut de sécurité** — la barre n'a jamais été un contrôle d'accès, et `lib/navigation/entrees.ts` l'écrit. C'est un défaut de lecture.
*Acceptation :* les écrans qui précèdent la session ne portent pas la barre ; la règle est portée par la mise en page du segment et non par une liste de chemins tenue à la main — une liste oublierait le prochain écran d'authentification. C'est la moitié de R2-09 qui est mesurée plutôt que supposée.

**R2-17 — LE PORTAIL A SA PROPRE BARRE. [D97]**
*File :* LIVRÉ
**Mesuré en écrivant R2-16 :** `app/(portail)/portail` recevait la barre depuis la mise en page racine, et la reçoit désormais de la mise en page de son segment — inchangé, délibérément. Les onze entrées viennent de la maquette, qui est une maquette de BACK-OFFICE : « Planning », « Techniciens », « Facturation », « Paramètres ».
**Ce n'est pas une fuite de cloisonnement.** Aucune entrée ne mène à une route servie, et une entrée inerte n'est pas un lien (D95) : un compte de portail n'atteint rien par là. C'est la même faute de LECTURE que R2-16 corrige un segment plus loin — sauf qu'ici elle est vue par un client.
**TRANCHÉ le 11/09/2026 — le portail a SA barre [D97].** Elle ne porte que **ce qui existe** et **ce qui appartient au client**. *Un client qui lit « Facturation » ou « Techniciens » au-dessus de son espace apprend l'existence d'un outil qui n'est pas le sien* — c'est la règle du §2 de la doctrine, « une fuite par déduction est une fuite », appliquée à un LIBELLÉ : une entrée de menu renseigne par son existence, sans qu'aucune donnée soit derrière elle.
**Les deux issues écartées.** *Pas de barre du tout* — le moins cher, et le portail perd son point de retour. *Ne rien changer tant qu'aucun client ne voit le portail* — gratuit aujourd'hui, et c'est exactement le raisonnement qui a laissé onze entrées au-dessus de l'écran de connexion jusqu'à R2-16.
**Aucune entrée inerte ici, et c'est la différence avec la barre du back-office :** une entrée inerte est admise dans une barre que la maquette PRESCRIT ; elle ne l'est pas dans une barre qu'on dessine soi-même — *inventer une entrée inerte, c'est promettre au client un outil qu'on n'a pas décidé de lui donner.*
*Acceptation :* la barre du portail est rendue par la mise en page du SEGMENT `(portail)` et non par une liste de chemins ; aucune de ses entrées ne mène à une route non servie ; un scénario mesure qu'aucun libellé du back-office n'apparaît sur un écran de portail ; la barre n'est toujours pas un contrôle d'accès, et rien ne s'y adosse.
**LIVRÉ le 11/09/2026.** `ENTREES_PORTAIL` est une **seconde liste** et non un sous-ensemble de la première. **Une seule entrée aujourd'hui**, et c'est un état plutôt qu'un choix : le portail n'a qu'un écran servi (L2-12). Ce qu'une barre d'une entrée apporte quand même est le **point de retour** — c'est-à-dire exactement le coût que l'issue « pas de barre du tout » faisait payer.
**LA MOITIÉ QU'ON AURAIT OUBLIÉE : LE POINT DE RETOUR.** La marque menait à `/planning`, **que ce compte ne peut pas ouvrir** (D10) — elle envoyait donc le client dehors. Elle mène à `/portail`, et c'est une propriété du segment, passée explicitement.
**Le défaut est RETIRÉ plutôt que déplacé** : `BarreDeNavigation` n'a **aucune valeur par défaut** pour ses entrées. *Un défaut ferait qu'une mise en page qui oublie de choisir reçoit la barre du back-office en silence — la faute exacte que ce ticket répare.* Sans défaut, l'oubli ne compile pas.
**Et le gardien du segment a reçu son SENS SILENCIEUX.** `tests/unit/app/barre-par-segment.test.ts` ne regardait que la PRÉSENCE de la barre : un segment qui reprendrait la liste du voisin passait. Il vérifie désormais quelle liste chaque segment passe, avec son témoin — *les deux attendus sont distincts, sans quoi la vérification serait satisfaite par la faute même qu'elle surveille.* Éprouvé : `entrees={ENTREES}` remis au portail rougit en nommant le fichier.
**CE QUI NE PEUT PAS ÊTRE MESURÉ À TRAVERS UN NAVIGATEUR, et la limite est écrite avec sa levée.** *Aucun compte de portail ne peut ouvrir de session* : le harnais passe par `reemettreJetonPremierAcces`, qui refuse quand `utilisateurSociete.count` vaut zéro — l'état même d'un compte portail (D10), **lu dans `lib/auth/amorcage.ts`**. Un scénario Playwright irait buter sur `/connexion` et mesurerait une redirection, jamais une barre. La barre est donc mesurée **par rendu** (`tests/unit/navigation/barre-du-portail.test.tsx`), et **le jour où L2-13 livre le lien d'invitation, la scène de bout en bout devient due.**

**R2-18 — LES SCÉNARIOS DE BOUT EN BOUT N'AVAIENT AUCUNE BASE. [mesuré le 11/09/2026]**
*File :* LIVRÉ
**Mesuré :** `pnpm test:e2e` tournait sans base et sans secret de session. Trois scénarios y vivaient, et **aucun ne franchissait un écran authentifié** — le premier `goto("/planning")` aurait été redirigé vers `/connexion`. *Tout ce qui se passe après la connexion était hors de portée d'un scénario de bout en bout, c'est-à-dire tout le produit.*
*C'est le §9 du 08/09 un étage plus haut : une suite qui éprouve tous les maillons n'éprouve pas la chaîne. Le dépôt avait un appelant de la chaîne de SESSION ; il n'en avait aucun de la chaîne ÉCRAN.*
**Ce qui a été construit :** `E2E_DATABASE_URL` pilote une base locale détruite et recréée à chaque exécution, migrée et semée **par le chemin de production** (`prisma migrate deploy`, puis le semis). Le serveur de test la voit sous le rôle **applicatif restreint**, jamais sous le propriétaire — *un scénario joué sous le propriétaire ne mesurerait rien du cloisonnement, il verrait tout.*
**Trois refus, et le troisième est celui qu'on oublie :** une URL Neon, une URL identique à `DATABASE_URL`, et l'**absence** de la variable — qui ferait retomber le serveur de test sur la base de développement de qui l'exécute.
**Le mot de passe ne s'écrit pas en base** : le harnais réémet un jeton de premier accès et le consomme par la même fonction que le formulaire. Le secret de session est tiré au sort à chaque exécution, jamais écrit nulle part (I9).
*Acceptation :* un scénario ouvre une session par l'écran de connexion et atteint le planning ; la CI provisionne la base dans le travail `verify:full`.

**R2-19 — LE GLISSER-DÉPOSER DU PLANNING. [maquette ; règles rendues le 11/09/2026]**
*File :* LIVRÉ
**Ce n'était pas un choix, c'était un manquement** : la maquette le prescrit depuis le premier jour — « Glisser-déposer pour réaffecter », `cursor: grab` sur `.ev` —, et D95 en fait une source qui FAIT FOI.
**Ce qui a été fait.** En vue semaine, le dépôt change de technicien et de jour ; en vue jour, de technicien et d'heure de début, **la durée étant conservée**. Le glissé depuis la file d'attente vaut AFFECTATION — c'est l'usage principal, et le dépôt donne alors à la fois un jour et une personne.
**Les deux refus sont CÔTÉ SERVEUR**, dans le dépôt cloisonné, et pas seulement à l'écran : *une action refusée à l'écran mais acceptée par la base est un trou.* (1) Hors du calendrier de **l'agence visée** — celle de l'intervention, déduite du site : *l'union affichée en vue semaine est un repère, jamais un droit de poser*, et `grille.ts` l'avait écrit avant que le contrôle existe. (2) Chevauchement d'une autre intervention du même technicien : pour un exploitant, un chevauchement est une ERREUR, pas un avertissement. Une agence sans calendrier refuse aussi — *« inconnu » n'est pas « ouvert »* (I7).
**Tout refus NOMME son motif** à l'écran, par une clé de dictionnaire filtrée — jamais un texte venu de la réponse (L1-02f).
**Le bloc ne revient pas à sa place : IL N'EN PART JAMAIS.** L'écran n'anticipe rien ; il se relit du serveur quand la base a accepté. *La façon la plus sûre de ne jamais montrer un état que la base n'a pas accepté est de ne jamais l'anticiper* — et il n'y a alors aucun chemin de code qui puisse laisser l'écran en avance.
**L'heure voyage en MINUTES LOCALES, jamais en instant** : l'instant demande le fuseau de l'agence, que ni un formulaire ni un navigateur ne connaissent. Le dépôt le résout **une seule fois**, et ce que les contrôles ont jugé est exactement ce qui est écrit.
**La voie sans glissé existe** : le formulaire « Déplacer » de la fiche, même route, même décision, mêmes refus — *une fonction qui n'existe qu'à la souris exclut le tactile et le clavier.*
**Aucune dépendance ajoutée** : le glisser-déposer natif du navigateur fait ce que la maquette décrit. Schedule-X vient au lot 3 avec le redimensionnement, qui lui n'est pas natif.
*Acceptation :* quatre scénarios Playwright écrits AVANT l'implémentation — un déplacement accepté, un refus pour jour fermé, un refus pour chevauchement, la position d'origine conservée après refus.

**R2-20 — LE CATALOGUE DE FORFAITS N'A AUCUN CHEMIN D'ÉCRITURE. [mesuré le 11/09/2026]**
*File :* LIBRE
**Mesuré en construisant R2-06 :** L1-06 a livré la RÈGLE (`forfaitRetenu`, les trois axes, le rang), la BASE (contraintes, unicité composite sur `(societe_id, type, rang)`) et l'ÉCRAN DE LECTURE — *mais rien qui crée un forfait.* `lib/tarification/forfaits.ts` n'exporte aucun dépôt d'écriture, et aucune route n'en pose. Le catalogue naît vide par décision, et **il le reste** : l'exploitation n'a aujourd'hui aucun moyen d'y mettre une ligne autrement qu'en SQL.
**Conséquence déjà payée :** sur une base semée, `/parametres/forfaits` n'affiche AUCUN tableau. La scène de bout en bout pose deux forfaits — une fixture d'épreuve — pour que la reprise d'apparence de R2-06 soit VUE et non seulement écrite.
**Et une mesure à connaître avant d'écrire le formulaire :** « aucune condition » se stocke en **NULL**, jamais en tableau vide — `forfait_types_intervention_non_vides` refuse `{}` (code 23514). *Le tableau vide est ce que Prisma REND à la lecture d'une colonne nulle*, et le type Prisma d'une liste scalaire n'admet pas `null` à l'écriture : le chemin d'écriture devra passer par du SQL explicite ou par un champ nullable déclaré autrement. La phrase du §6 du CLAUDE.md — « le tableau VIDE en base » — décrit donc la LECTURE, et le ticket qui écrira la saisie devra la préciser.
*Acceptation :* un rôle habilité crée, modifie et désactive un forfait depuis `/parametres/forfaits` ; le refus d'un rang déjà pris nomme son motif ; « aucune condition » est écrit en base sous la forme que la contrainte accepte, et un scénario le prouve par une lecture qui rend le forfait applicable partout.

**R2-21 — L'ÉCRAN « PARC MACHINES », et l'entrée de barre qu'il allume. [D95, D6, I10]**
*File :* LIVRÉ
**Écran de la maquette : « Parc machines clients ».** L'entrée était INERTE depuis D95, marquée « ouverte par L2-01 (écran) » — *la fiche machine existe depuis L2-01 ; ce qui manquait n'était pas le droit de lire le parc, c'était un APPELANT.* C'est la maladie que le §6 nomme à propos du portail, soignée de la même façon.
**DEUX COLONNES DE LA MAQUETTE SONT ABSENTES, ET C'EST ÉCRIT.** Elle en montre huit, dont **« Compteur »** et **« Contrat »** : ni l'un ni l'autre n'existe — aucune table de relevés, et les contrats sont au lot 4. *Afficher une colonne vide dirait que la donnée manque ; afficher un zéro dirait qu'elle vaut zéro.* C'est exactement le motif pour lequel R2-13 reste bloqué, appliqué ici AVANT de commettre la faute. Ses quatre indicateurs de tête ne sont pas repris non plus, pour la même raison.
**Ce qui est affiché se compte SUR LES LIGNES RENDUES**, jamais par une seconde requête : un bandeau qui compterait autrement que le tableau qu'il coiffe met deux chiffres côte à côte sans dire lequel croire.
**Les fiches INCOMPLÈTES d'abord** (D6) : ce sont celles qui demandent un geste, et un parc trié par date les enterrerait sous les fiches saines. La borne d'affichage est DITE à l'écran — *un tableau tronqué en silence fait croire à un parc plus petit qu'il n'est.*
*Acceptation :* l'écran rend des lignes réelles sous le rôle applicatif (scénario de bout en bout, avec son témoin) ; l'entrée de la barre est un lien et non plus une entrée inerte ; aucune colonne n'affiche une donnée qui n'existe pas.
*Ce qui reste dû :* la recherche, l'export Excel, la pagination, et l'écran « Fiche machine » — qui reste une entrée inerte, une fiche de détail n'étant pas une section de navigation.

**R2-22 — « FICHE MACHINE » SORT DE LA BARRE. [D98]**
*File :* LIVRÉ
**Mesuré en livrant R2-21 :** l'entrée portait « ouverte par L2-01 (écran) », et cet écran vient d'être livré — *la mention désignait donc un ticket déjà fait, ce qui ne casse rien et ment doucement.* Elle pointe maintenant sur ce ticket-ci, faute de mieux, et c'est le ticket qui doit dire ce qu'elle devient.
**La question n'est pas celle d'un écran manquant.** Une fiche a besoin d'un **identifiant** : « Fiche machine » ne peut pas être une section de navigation, quel que soit le travail qu'on y mette. La maquette la liste parce qu'elle est une suite d'écrans à montrer ; un produit, lui, y accède depuis le parc, depuis un QR code ou depuis une intervention.
**TRANCHÉ le 11/09/2026 — l'entrée DISPARAÎT, la barre passe à dix [D98].** C'est un **écart délibéré** à la maquette, qui fait foi sur la disposition (D95), et il est consigné comme tel pour que personne ne le prenne demain pour un oubli. *La maquette liste « Fiche machine » parce qu'elle est un CATALOGUE D'ÉCRANS, pas un menu* : elle montre onze écrans pour qu'on les voie tous, quand une barre donne accès à des SECTIONS. Les trois chemins réels vers une fiche portent tous un identifiant, et ils existent : le parc (R2-21), le QR code (D22), l'intervention.
**Les deux issues écartées.** *Rester inerte pour toujours* — honnête, et une place de menu se paie sur tous les écrans, tous les jours. *Mener à une RECHERCHE de machine* — ce serait inventer un écran que la maquette ne décrit pas pour sauver une entrée qu'elle décrit ; la recherche viendra si le parc la réclame, et elle vivra DANS l'écran du parc.
*Acceptation :* `lib/navigation/entrees.ts` porte dix entrées ; le gardien qui confronte la barre à la maquette accepte CET écart et lui seul, nommément — jamais par un assouplissement de sa comparaison ; un scénario mesure que « Fiche machine » n'est plus rendu.
**LIVRÉ le 11/09/2026.** `ECARTS_MAQUETTE` est une **liste close d'une entrée**, avec son motif, et l'écart se désigne par le **libellé tel que la maquette l'écrit** — jamais par une clé du dictionnaire, qui disparaît avec l'entrée quand le libellé, lui, reste dans le document. *C'est ce qui rend l'écart ADOSSÉ* : un gardien vérifie que la maquette porte bien ce libellé, sans quoi l'entrée n'écarterait plus rien et personne ne le dirait (§9, 31/08). Trois épreuves, toutes jouées : un **second écart** non décidé rougit (trois scénarios), un écart **mal orthographié** rougit en nommant l'adossement, et le vert revient une fois la faute défaite.
**Et la clé a quitté le dictionnaire, ce qui a fait parler un autre gardien.** Le scénario de bout en bout voulait écrire « Fiche machine » pour mesurer son absence : *« aucune chaîne visible en dur »* l'a refusé en nommant la ligne. Le libellé est donc lu dans `ECARTS_MAQUETTE`, **son seul domicile depuis que l'entrée a quitté le dictionnaire** — et le scénario devient juste d'avance le jour où un second écart serait décidé.
