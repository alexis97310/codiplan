# Registre — nuit du 9 septembre 2026 : l'horloge, le rang, et la notice qui ne pouvait pas être suivie

*Écrit au fil de l'eau. Chaque état est observé dans le même geste que son écriture (§9, 07/09) ; les durées sont lues à l'horloge (§9, 09/09) ; et **chaque affirmation portant sur un artefact construit nomme l'empreinte du commit où elle se vérifie** — c'est l'inscription du jour au §9.*

**Point de départ :** `main` à `fda75dc`, #85 et #86 fusionnées, CI verte. Branche assignée `claude/clock-compartmentalization-principle-3umuye`.

---

## 1 — LE PRINCIPE QUI AVAIT DISPARU, ET LA DIFFÉRENCE ENTRE DEUX RÉPONSES

**La question :** *« l'horloge n'entre pas dans le cloisonnement » existe-t-il écrit dans le dépôt, sous un numéro ou sans ?*

**Ce qui a été cherché — le TEXTE, jamais le numéro.** `grep -rniE "horloge"` sur tout le dépôt hors `node_modules` ; puis `matérialis` ; puis les fonctions temporelles de PostgreSQL dans `prisma/migrations/`, sur les instructions `CREATE POLICY` isolées.

**Ce que la mesure rend :**

| Où | Ce qui y est écrit | Est-ce le principe ? |
| --- | --- | --- |
| `docs/arbitrages.md`, D84 | « RG-DRO-02 dépend de l'horloge, ce qui en ferait une dixième forme » | **Non** — un motif, pour une table et une règle |
| `docs/arbitrages.md`, registre du 11/09 | la même phrase, comme mesure préalable | Non |
| `README.md` ligne 473, migration `20260909200000` | la même phrase, recopiée près de la table | Non |
| `CLAUDE.md` §9 (09/09) | « lire une horloge » — le rapport d'une durée | Sans rapport |
| `matérialis` | deux occurrences : le seed, une vue de consolidation | **Rien** |

**La réponse est donc « IL N'Y EN A PAS », et non « je n'en ai pas trouvé »** — parce que la recherche a porté sur le texte de **chacune des deux moitiés**, pas sur le numéro d'une décision. La première moitié existait **quatre fois comme argument** ; c'est exactement la forme qu'a une règle avant d'en être une : vraie chaque fois qu'on l'invoque, **inopposable la fois où personne ne l'invoque**. La seconde moitié — la matérialisation — n'existait **nulle part**.

**D85 est écrit**, avec sa condition de réouverture : *s'il existe un cas où le cloisonnement doit se fermer sans aucun écrivain — ni travail, ni évènement, ni acteur —, le principe est faux.* Nous n'en connaissons pas ; nous ne prétendons pas qu'il n'en existe pas.

**L'état mesuré, avec son témoin : 58 politiques, ZÉRO évaluant le temps.** Le témoin est le premier chiffre — *un décompte nul ressemble toujours à un sans-faute.* Gardien : `tests/unit/db/horloge-hors-cloisonnement.test.ts`, éprouvé sur les six formes du §9 (26/08) **et** sur le cas qui doit rester vert pour sa propre raison — une politique lit `date_planifiee` et une colonne nommée `date_maj_snowball` sans rougir, parce que *ce qui est interdit est l'horloge, pas le temps : c'est la PROVENANCE qui décide, jamais le type.*

**Rencontré en chemin :** `sansCommentairesSql` était recopiée dans **deux** gardiens et allait l'être dans un troisième — trois lectures d'un même critère que rien ne confrontait (§9, 01/09). Elle a désormais une maison.

*Vérifiable à `35eeebc`.*

---

## 2 — LE RANG DES FORFAITS, ET UN DÉFAUT D'ARGENT PLUS GRAVE QUE L'ORDRE

**« Le premier forfait applicable l'emporte » ne définissait pas « premier ».** Le code ordonnait par `code`, c'est-à-dire par l'**alphabet** ; l'ordre naturel suivant eût été celui d'insertion, c'est-à-dire le **passé**.

**Ce qui est arrêté (D86) :** `forfait.rang`, entier strictement positif, **sans défaut** — un défaut serait une décision prise par personne. **L'égalité de rang est un état interdit que la BASE refuse**, sur `(societe_id, type, rang)` : un contrôle qui se contenterait de signaler laisserait partir la facture. La clé porte le **type** parce que le rang ne se compare qu'entre pairs.

**Ce que la base ne sait pas refuser, écrit plutôt que tu :** « deux forfaits **applicables au même cas** » est un recouvrement sur trois axes où l'absence de condition vaut « toutes les valeurs ». Une contrainte d'exclusion sur `zone_geo && zone_geo` dirait **l'inverse** — pour PostgreSQL un tableau vide ne recouvre rien. *Une contrainte dont l'expression inverse le sens de sa colonne est une contrainte que personne ne relit.*

**LE DÉFAUT D'ARGENT, MESURÉ AVANT D'ÊTRE CORRIGÉ.** `forfaitApplicable` lisait « aucune condition » sous la forme `null`, celle de la **saisie Zod**. La **base** ne peut pas l'écrire : une liste scalaire PostgreSQL n'est pas nullable, et l'absence de condition y est le tableau **VIDE**, qui tombait dans la branche « une condition est posée ». **Le forfait général — celui que le module documente comme le cas le plus courant — ne s'appliquait JAMAIS** par le chemin de production. *Mesuré par un scénario écrit d'abord : `expected false to be true`.*

**L'écran `/parametres/forfaits`** montre, pour une zone choisie, le catalogue de chaque nature avec **trois verdicts** — retenu, **applicable mais devancé**, écarté. Le deuxième est celui qui manque partout ailleurs : sans lui, un forfait absent d'une facture paraît exclu par ses conditions alors qu'il l'est par son rang. **L'écran ne recalcule rien.**

**Le jumeau demandé** : les **six** permutations de trois candidats, ce qui démontre la propriété au lieu de l'échantillonner, avec un témoin contre « six fois la même absence ». Plus, en base, le refus de l'égalité et **son** jumeau, et le cas qui doit rester vert — deux **natures** différentes partagent le rang 7 sans rougir.

**La consigne qui disait l'agence est retirée par son auteur**, et le retrait est écrit : *une agence dessert plusieurs zones à des distances différentes.*

**LA MIGRATION A ÉTÉ ÉPROUVÉE SUR UNE BASE QUI PORTE DES LIGNES, pas seulement sur une base vide.** Le catalogue naît vide, donc le rétro-remplissage n'aurait jamais été exercé — *le seul environnement où le défaut existe est le seul qui ne soit jamais exercé* (§9, 23/08). Base reconstruite à l'état d'AVANT, trois forfaits posés, migration appliquée : `A-DEP → 1`, `B-DEP → 2` pour le déplacement, `C-CTL → 1` pour le contrôle. **Le rétro-remplissage conserve EXACTEMENT l'ordre d'avant** — `code` croissant, par société et par nature — de sorte qu'aucune facture ne change.

**Et le témoin du bloc de garde MORD, ce qui a été vérifié plutôt que supposé.** `FORCE` remis, le bloc rejoué : `ERROR: FORCE est encore actif`. *Ce qui NE peut pas se mesurer ici est dit : le rôle local est superutilisateur et contourne RLS, donc la NÉCESSITÉ de la levée ne s'observe pas en local — seul le mécanisme du témoin s'observe.* C'est exactement l'angle mort que le §9 du 07/09 décrit, et la raison pour laquelle le témoin porte sur le mécanisme et jamais sur un décompte.

*Vérifiable à `84f7827`.*

---

## 3 — LA MISE EN LIGNE : UNE NOTICE QUI NE POUVAIT PAS ÊTRE SUIVIE

### 3.1 La contradiction, et ce qu'elle coûtait

Le geste 1 disait de **créer une base** ; le geste 3 disait de **recopier le secret `DATABASE_URL` du dépôt** — or ce secret pointe la base qui existe déjà. **Quelqu'un qui suivait la notice branchait sa production sur la base de démonstration**, et aucune page ne le lui disait.

**Les deux bases sont nommées.** La **démonstration** est celle qui existe — `neondb`, deux sociétés fictives que le seed y réinstalle : *mesuré dans le journal du run #40, `societe : 2`, `CODIMA-EU` et `CODIMA-NC`.* La **production** est la base neuve, avec ses propres secrets. **Le secret existant ne bouge pas et ne se recopie nulle part.**

**Et sur une base neuve, le mot de passe de `codiplan_app` n'existe pas** : la migration crée le rôle **sans mot de passe**. La notice le dit maintenant, avec la commande.

### 3.2 Le flux de migration nomme sa CIBLE

Sur `production`, **le seed est sauté**, et la purge aussi. *« Les données de démonstration ne s'installent pas en production » était une recommandation ; c'est désormais une garantie du flux*, gardée par `tests/unit/ci/cible-de-migration.test.ts`.

### 3.3 UNE FAUTE DE MA MAIN, ATTRAPÉE PAR UN GARDIEN EXISTANT

J'avais écrit `inputs.cible == 'production' && secrets.PRODUCTION_… || secrets.…`. **Cela a l'air d'un ternaire et n'en est pas un quand la première valeur est VIDE** : `&&` rend la chaîne vide, `||` rend la seconde. **Un secret de production absent aurait fait migrer LA DÉMONSTRATION** — sans que rien ne soit vide, sans que rien ne le dise, et ma propre garde `[ -z "$DATABASE_URL" ]` n'aurait pas sonné.

C'est le gardien de l'inventaire, écrit le 20/08 contre un repli d'une tout autre forme, qui l'a refusée. **Le choix se fait maintenant dans un shell, où « absent » se distingue de « autre chose » et où l'absence ARRÊTE.**

*C'est le §9 du 07/09 confirmé une fois de plus, et sur moi : connaître une règle ne protège pas de l'enfreindre — seul le gardien protège.*

### 3.4 DEUX GESTES MANQUAIENT, ET LA CHAÎNE ÉTAIT COUPÉE DEUX CRANS PLUS BAS

En jouant la chaîne sur une base neuve migrée **sans seed** :

1. **Aucune société n'existe, et rien dans le dépôt n'en créait.** `prisma/seed.ts` en écrit deux, mais il est réservé à la démonstration. `--societe <uuid>` n'avait rien à nommer.
2. **Et une société porte une devise.** `devise` et `parite` sont des **référentiels de plateforme** — des faits, pas de la démonstration (D4) — et ils n'étaient écrits, eux aussi, que par le seed. *Le script de création de société a refusé en disant « la devise XPF n'est pas au référentiel de plateforme ».* **Le refus était juste, et c'est lui qui a rendu le trou visible** — un script qui aurait créé la devise « au passage » aurait fait disparaître le symptôme en laissant la question.

`pnpm db:referentiels` et `pnpm db:societe-initiale` comblent les deux, **sans inventer aucune valeur** : la majoration hors ouverture est un **pourcentage**, donc un prix, et le §8 interdit d'en inventer un.

**La chaîne complète, jouée de bout en bout sur une base neuve :** référentiels posés (2 devises, 1 parité), société ouverte, première identité ouverte, URL de premier accès imprimée, **porte refermée derrière elle**.

**Les jours fériés ne sont dans aucun des deux, et ce n'est pas un oubli** : leur horizon est glissant et se calcule **par territoire**, donc depuis les agences. `pnpm feries:etendre` est le geste, et le recopier ici serait une seconde lecture d'un même critère.

### 3.5 Les gestes 4 et 7 sont cliquables depuis un téléphone

Chemin exact **en clics** pour les migrations, et un flux **Ouvrir le PREMIER compte** pour l'amorçage — même script, même cliquet, même URL imprimée une fois.

**Le coût est écrit avant le premier clic** : l'URL de premier accès entre dans le **journal du flux** et y est **une clé vivante pendant une heure**, lisible par quiconque a accès en lecture au dépôt. Deux conditions, toutes deux vérifiables : le dépôt est privé ; l'URL est suivie dans l'heure. *Sinon, jouer le script depuis un poste — le journal n'existe alors pas.*

### 3.6 Ce que `/sante` dit si l'on s'est trompé de base — et ce qu'elle NE PEUT PAS dire

**Trois cas sur quatre, elle le dit** : base jamais migrée (elle **nomme** la migration manquante), base injoignable, mauvais rôle.

**Le quatrième : la base de DÉMONSTRATION. Elle ne peut pas le savoir, et c'est écrit plutôt que tu.** La démonstration est en parfaite santé — elle répond, le rôle est bon, les migrations sont à jour. Les trois questions de `/sante` portent sur l'**état** d'une base, jamais sur son **identité**, et lui faire dire laquelle c'est afficherait un nom d'hôte sur une page **sans compte** (D50). **Le signe qui ne trompe pas est écrit à la place** : sur la démonstration, une connexion réussit avec un compte de démonstration ; sur la vôtre, rien n'ouvre avant le geste 7.

### 3.7 Les migrations du jour sont appliquées à la base réelle

**Run #40 de « DB migrate & seed », sur `fda75dc`, 21:39:52 → 21:41:34 UTC, toutes étapes en `success`.** Ce que le journal rend : `intervention` et `technicien_calendrier` figurent à l'inventaire et dans les formes de politique — **les deux migrations du jour sont donc bien appliquées**. 31 tables dans l'état RLS que I1 exige, **52 politiques toutes à la forme imposée**, 28 en `ENABLE+FORCE`, 14 partitions du journal toutes durcies, `codiplan_reporting` en `SELECT` seul.

*La ligne du registre précédent — « la base hébergée n'a pas été observée » — cesse d'être vraie : elle l'a été, par la CI.*

### 3.8 Les deux défauts des captures

**« À planifier » veut dire « sans date », et rien d'autre** — corrigé, et **l'invariant est formulé** dans `statutALaCreation`, avec quatre scénarios qui couvrent les quatre combinaisons.

**`/sante` ne peut plus annoncer zéro société** — la page dit « non lisible d'ici ». **Ce qui manquait était la RÈGLE qui empêche d'y revenir**, car la correction bien intentionnée s'écrit toute seule : « il suffirait de compter les sociétés ». Elle est écrite : **la sonde ne compte AUCUNE table cloisonnée**, et sa population vient d'une liste qu'elle ne contrôle pas.

*Vérifiable à `4a0e37b`.*

---

## 3 bis — LE CONTRÔLE QUI COMPTAIT ZÉRO LÀ OÙ IL Y AVAIT DES LIGNES

*Trouvé en relisant le journal du run qui applique la migration du rang — c'est-à-dire en regardant un rapport plutôt qu'en lançant un test.*

**L'écart, brut.** Le seed annonce `CODIMA-NC — sites de démonstration : 4` et `interventions : 6` ; l'inventaire du même run, quinze secondes plus tard, imprime `site : 0` et `intervention : 0`. Deux chiffres, dans le même journal, qui ne peuvent pas être vrais ensemble.

**Ce que la mesure a désigné, et ce n'est pas ce qu'on croyait.** Base locale reconstruite, seed joué, puis DEUX lectures côte à côte : `psql` rend **5 sites et 6 interventions** ; `scripts/inventaire.mts` rend **0 et 0** sur la même base, à la même minute. *La base n'a rien : c'est le CONTRÔLE qui est aveugle.*

**La cause, isolée en une lecture.** `compterAPlat` groupait **SEPT** tables quand `TABLES_CLOISONNEES` en compte **vingt-deux**. Les quinze autres restaient à la valeur de `decompteVide()` — **zéro, pour toujours** — et le rapport les imprimait dans la colonne des observations.

**CE QUE CELA COÛTAIT, ET C'EST LE POINT.** Le contrôle de cloisonnement **se confronte à cet inventaire** : il comparait donc **zéro à zéro** et concluait au vert. *Le seul contrôle qui regarde la base hébergée ne prouvait RIEN sur `site`, `machine` et `intervention`* — c'est-à-dire sur les trois tables qui portent la forme « parc », celle dont D84 vient de faire un arbitrage. **La règle était juste et l'observation était creuse** : la vacuité du §9 (30/08), dans un contrôle d'exploitation plutôt que dans un test.

**Et c'est la maladie du 20/08, à la lettre :** *une liste close se re-vérifie à chaque table créée, sinon elle devient fausse.* Chaque ticket ajoutait sa table à `TABLES_CLOISONNEES` — donc à la **ligne imprimée** — et personne ne revenait écrire son **compteur**. La ligne apparaissait ; le chiffre restait zéro.

**La réparation renverse la charge, comme D41 et D55.** Le rapprochement passe par un `Record<TableFille, …>`, **exhaustif par construction** : une table ajoutée à la liste close **ne compile plus** tant que son regroupement n'est pas écrit. *Le gardien n'est pas un test, c'est le typage — et il sonne le jour de la création, pas le jour où quelqu'un relit un journal.* Vérifié après coup : l'inventaire rend **5 et 6**, exactement ce que `psql` compte.

**UN SECOND DÉFAUT EST TOMBÉ AVEC LE PREMIER.** Le seed imprimait `CODIMA-EU — interventions de démonstration : 6` alors que **zéro** y était écrite : les identifiants de `INTERVENTIONS_DEMONSTRATION` sont **FIXES**, donc déjà pris par CODIMA-NC, et la seconde société les saute tous. Le compte était celui des lignes **prévues**, imprimé **avant** la boucle. Il est désormais celui des lignes **écrites** — `0 écrite(s) sur 6 prévue(s)` —, et l'écart se voit au lieu de se taire. **La collision d'identifiants n'est PAS réparée** : décider ce que la démonstration doit montrer à la seconde société appartient à l'exploitation, et c'est écrit plutôt que tu.

**ET LA RÉPARATION D'UN SEUL CÔTÉ A PRODUIT UN ROUGE FAUX — mesuré dans l'heure qui a suivi.** Le flux rejoué avec l'inventaire réparé est tombé en **échec**, avec six lignes de la forme *« société CODIMA-NC, site : 4 ligne(s) attendue(s), 0 observée(s) — la société ne voit pas toutes ses propres lignes »*. **Le message accuse la base.** Or `scripts/controle-cloisonnement.mts` portait **la même cécité, sur les mêmes tables** : il comptait HUIT tables et laissait les quatorze autres à zéro. *Le rôle applicatif n'avait tout simplement pas été interrogé.*

**La leçon tient en une phrase, et elle est écrite dans le code plutôt qu'au §9, dont le quota du jour est pris : une comparaison n'est réparée que des DEUX côtés à la fois.** Réparer le côté « attendu » seul transforme une cécité silencieuse en accusation fausse — et une accusation fausse contre le cloisonnement est le pire des deux, parce qu'elle fait chercher un trou qui n'existe pas.

**Les deux côtés sont désormais exhaustifs par construction**, et le contrôle est **éprouvé en local sous le rôle applicatif** : CODIMA-NC lit **4 sites, 18 habilitations, 6 interventions** sous son contexte, exactement ce que l'inventaire compte. *Pour la première fois, le contrôle de la base hébergée vérifie vraiment `site`, `machine` et `intervention`* — vingt-deux tables au lieu de huit.

**ET LA MESURE FINALE, SUR LA BASE HÉBERGÉE, EST VERTE — pour la première fois avec un contrôle qui regarde.** Run #43 de « DB migrate & seed », sur `699d33f`, 22:55:18 → 22:57:15 UTC : *« aucune ligne sans contexte, exactement les lignes de chaque société sous son contexte »*, **22 tables** confrontées à leur forme, 52 politiques, 14 partitions durcies. **La base hébergée est saine**, et ce n'est plus une conclusion tirée de zéros.

*Vérifiable à `699d33f`.*

---

## 4 — LES DEUX LOTS INSCRITS AU PLAN

**Écrits, pas construits** — au backlog **et** aux arbitrages, *parce qu'un lot qui n'existe que dans une conversation n'existe pas : la conversation se ferme.*

**Lot 8 — documentation des machines (D87).** Modèle **ou** machine, jamais les deux, et c'est le schéma qui l'interdit. L'écran affiche l'**union**. Deux classes de visibilité — *à cinq, personne ne classe juste*. Le cloisonnement est **hérité** et la classe ne fait que le rétrécir : **pas de dixième forme**. Le bac de réception **propose et ne classe jamais seul**, et l'argument n'est pas la qualité de données : *un rapprochement faux accroche la notice d'un compresseur à un pont élévateur, et personne ne le voit avant qu'un technicien suive la mauvaise procédure.*

**Lot 9 — registre des VGP (D88).** Le fait dont tout découle est d'exploitation : **ce sont les clients qui commandent ces visites**. Donc CODIPLAN **ne calcule jamais la conformité**. Donc ce n'est pas un registre de conformité mais **un registre de ce qu'on nous a dit**, daté à chaque écran, *jamais blanc* — un registre à moitié rempli ressemble à un registre complet. Trois valeurs pour l'assujettissement, parce qu'*une case décochée est indiscernable d'une famille jamais examinée*. Aucune périodicité en dur. Et une déclaration ouvre **une campagne datée**, pas deux cents alertes.

**Le point de vigilance sur ce dont CODIMA répond** est écrit comme tel, avec un déclencheur qui se vérifie sans s'interpréter : *le premier écran de portail qui affiche un document de classe `client` venu d'un organisme tiers.*

*Vérifiable à `03a3300`.*

---

## 5 — CE QUI EST VERT, ET OÙ

| Porte | État | Où |
| --- | --- | --- |
| `pnpm test` | **1 015** scénarios, 0 échec | `03a3300` |
| `pnpm test:isolation` | **527** scénarios, 0 échec | `03a3300` |
| `format:check` / `typecheck` / `lint` | 0 erreur, 0 avertissement | `03a3300` |
| `pnpm build` | **12 routes**, toutes dynamiques | `03a3300` |
| Migrations sur la BASE RÉELLE | run #40, `success` | `fda75dc` |
| Chaîne de mise en ligne sur base neuve SANS seed | de bout en bout | `03a3300` |

---

## 6 — CE QUI N'A PAS ÉTÉ FAIT, ET C'EST LA LIGNE FRANCHE

1. **Le lot 2 n'a pas avancé au-delà de D84.** Les cinq actions du planning existent depuis la veille ; rien de neuf ce soir.
2. **La grammaire de lecture du classeur n'a pas été liée à une bibliothèque.** Le §2 exige une bibliothèque `.xlsx` **maintenue** et n'en nomme plus aucune ; le choix reste un arbitrage instruit par la comparaison du 09/09.
3. **Le portail client en consultation n'a pas été construit.**
4. **Les statistiques technicien n'ont pas été construites** — la table `technicien` n'existe toujours pas.
5. **Les lots 8 et 9 ne sont pas construits**, et c'était la consigne : écrits, pas construits.

---

## 7 — CE QUI RESTE OUVERT SANS RÉPONSE PAR DÉFAUT DÉGUISÉE

**LE PLANCHER D'UNE HEURE : PAR INTERVENTION, OU UNE FOIS PAR SITE ET PAR JOUR ?**

Inchangé depuis le registre précédent, et la conséquence chiffrée aussi : deux interventions courtes sur le même site le même jour facturent **deux heures** ; sous la maille « site et jour », **une**. *Un facteur deux sur un mode d'exploitation ordinaire.* Le code applique la maille de D57 ; le jour où la réponse arrive, c'est un **amendement de D83**, pas un réglage.

---

## OÙ REPRENDRE

*Écrit en dernier et à la fin : une session neuve lit la fin d'un registre, pas son milieu.*

**L'état : #87 est FUSIONNÉE dans `main`** — `2eadfd3`, le 09/09/2026 à 22:21 UTC. **CI verte sur `5faa11a` avant la fusion** : run #382, 22:14:49 → 22:20:55 UTC. Six commits — `35eeebc` (D85), `84f7827` (D86), `4a0e37b` (la mise en ligne), `03a3300` (les deux lots), `c82ba86`, `5faa11a`.

*Ce paragraphe est ajouté APRÈS la fusion, sur `main` : la ligne qui dit une fusion ne peut pas s'écrire avant d'être vraie — et c'est l'inscription du jour au §9, appliquée à elle-même.*

**La migration du rang est appliquée à la base de démonstration** — run #41, 22:22:08 → 22:23:42 UTC, `Applying migration 20260910030000_forfait_rang_d86`.

**Deux propositions ont suivi, et elles ne sont pas de la couture : #88 et #89 réparent le CONTRÔLE qui regarde la base hébergée**, aveugle sur quatorze tables des deux côtés de sa comparaison. Fusionnées à `7a0dc82` et `699d33f`. **Dernière mesure : run #43, vert, 22 tables réellement vérifiées.**

**Ce qu'une session neuve doit savoir avant de mesurer quoi que ce soit :**

- **La base hébergée reste injoignable depuis une session** — `pnpm veille` sort en **75**, « je n'ai pas pu regarder ». **Mais la CI, elle, l'atteint** : le journal de « DB migrate & seed » est le seul endroit d'où l'on peut affirmer quoi que ce soit sur elle.
- **Pour travailler en local :** `service postgresql start`, une base jetable, `DATABASE_URL` passée **explicitement** à chaque commande — la variable d'environnement du conteneur pointe Neon et l'emporte sur `.env`. Et `pg_hba.conf` du conteneur exige `scram` : le harnais d'isolation demande `codiplan_app` **sans mot de passe**, donc passer les connexions locales en `trust` est le chemin le plus court.
- **Le client Prisma se régénère après toute migration**, et c'est ce qui explique la moitié des erreurs de typage qui n'ont pas de sens.

**Les deux premières choses à faire, dans cet ordre :**

1. **Répondre sur le plancher par site et par jour.** Une phrase suffit, et elle change ce qu'un client paie.
2. **La collision d'identifiants du seed** : `INTERVENTIONS_DEMONSTRATION` porte des identifiants FIXES, donc la seconde société n'en reçoit aucune — `0 écrite(s) sur 6 prévue(s)`. Le rapport le dit désormais ; **ce que la démonstration doit montrer à la seconde société appartient à l'exploitation**, et c'est la seule chose qui manque pour le réparer.
3. **Lire le journal du dernier « DB migrate & seed »** — c'est le seul endroit d'où l'on puisse affirmer quoi que ce soit sur la base hébergée.
