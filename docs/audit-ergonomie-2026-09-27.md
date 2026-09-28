# Audit d'ergonomie CODIPLAN — complément du 27 septembre 2026

*Bugs, incohérences, évolutions page par page — et le diagnostic GMAO du planning.*
*La cible détaillée du planning est dans `docs/propositions/planning-gmao/specification.md`, avec sa maquette cliquable `maquette-planning-gmao.html` et le découpage en tickets `lots.md`.*

---

## Ce qui a été mesuré, et comment

| | |
|---|---|
| **Version mesurée** | `main` = production = **`e2b8421`** (27/09/2026 06:44 NC) — `/api/sante` sert ce commit, base et migrations « ok ». |
| **Écrans** | Site en ligne, compte bureau, **en lecture seule** (aucun formulaire envoyé, aucun glisser-déposer), à 1280 px et à 375 px (émulation téléphone). Mesures prises dans la page (largeurs, polices, ordre, classes), pas à l'œil. |
| **Code** | Lu au même commit `e2b8421`. Chaque bug cite `fichier:ligne`. Une relecture contradictoire a repris chaque citation dans le code avant publication. |
| **Références** | Cahier des charges : M4 « Planning et dispatch », RG-PLA-01 à 08, annexe D, parcours P1 et P3. Maquette complète (D124, D125, D128). Décisions D8 (§3.6), D88, D106, D107, D111, D125, D133, PARCOURS-1 (23/09), LISTES-1 (23/09), 82-PLANNING-6 (25/09). |
| **Déjà traité ailleurs** | L'audit du 26/09 (GR1 à GR17 — GR1 à GR4, G9, GR7 à GR10 publiés entre le 26 et le 27/09) et l'audit « captures » (C-…) ne sont pas répétés. Ce qui est déjà en file (`9AA` → `9AV`, `99UA`, AGENCE-ACTIVE, C-B1, DEPLANIFIEE-1) est marqué **« déjà prévu »**. |

**Deux niveaux de preuve, toujours dits :**
- **vu en production** — constaté à l'écran le 27/09 ;
- **déduit du code** — établi par lecture du code publié ; non rejoué en production pour n'y rien écrire. **À rejouer en recette** avant correction.

**Noms.** Pour éviter toute confusion avec les décisions (`D8`…) et les priorités (`P1`…) : les **questions** posées à Alexis s'appellent ici **QG-1 à QG-12**, et les **lots** du planning **PG-0, PG-A à PG-E**.

**Anonymat (I9).** Aucune donnée de production ici : ni client, ni technicien, ni référence d'intervention réels.

---

## À faire tout de suite (gestes d'exploitation, pas de code)

1. **Compléter l'heure ET la durée des 5 interventions « Planifiée » qui n'en ont pas** (semaine 39), par « Déplacer » en donnant date, heure et durée ensemble. Tant qu'elles n'ont pas de durée, **aucune modification ne passe** (bug 4) — et leur technicien ne peut probablement pas les ouvrir sur son téléphone. Donner la durée seule ne suffit pas : sans heure, elle est refusée.
2. **Annuler les deux interventions d'essai** (libellés de test) visibles dans la file et les « Priorités opérationnelles ». Elles resteront affichées barrées dans la file tant que l'incohérence I-17 n'est pas corrigée.

---

## Résumé

1. **Le planning n'est pas encore un planning GMAO** : il *montre* ce qui est posé, mais on ne peut presque pas y *poser*. Glisser une carte « À planifier » est refusé **toujours** en vue Semaine (bug 1, refus voulu par PARCOURS-1 mais geste toujours proposé) et en vue Jour pour toute intervention créée par le formulaire, qui ne demande pas la durée (bug 2).
2. **Il ment sur les disponibilités** : un jour férié s'affiche ouvert avec « 60 créneaux libres » alors que le serveur y refuse toute pose et que la charge le retire (bug 5) ; les techniciens libres n'ont ni ligne de charge ni pourcentage (I-4).
3. **Il perd des interventions et des heures** : une intervention planifiée dont la date est passée sans démarrage n'est signalée nulle part et sort de la vue au changement de semaine (bug 8 — 6 cas au 27/09) ; déplacer une carte d'un jour à l'autre en vue Semaine **efface son heure** sans le dire (bug 9).
4. **« Affectée » n'existe qu'à moitié** : D8 §3.6 le définit (« transmise au technicien, non encore démarrée ») et autorise Planifiée → Affectée, mais aucun chemin de l'application ne réalise la transition ; le bouton principal d'une « Planifiée » ne la fait pas avancer (bug 7).
5. **Messages faux** : deux chemins affichent « Tirez la poignée sous le début du bloc » à quelqu'un qui n'a rien tiré (bugs 2 et 3 ; un troisième : une durée 0 saisie dans un formulaire) ; un autre conseille « réessayez » sur une erreur qui se reproduira à chaque essai (bug 4).
6. **À garder** : les refus nommés côté serveur (RG-PLA-03/04/06/07), la file triée par urgence puis ancienneté (L3-03), les absences déjà dessinées dans les cases (PLANNING-1), le pré-remplissage de « Déplacer » (99S), le repli de « Clôturer » (99T), la liste Semaine sur téléphone (N-02).
7. **La cible** : un tableau de répartition — techniciens en lignes et temps en colonnes dans toutes les vues (cahier M4 et maquette complète), une colonne « À traiter » à onglets (À planifier · En retard · Sans durée · Suspendues · Déplanifiées après DEPLANIFIEE-1), une **fenêtre de pose** qui s'ouvre au dépôt au lieu d'un refus, un tiroir latéral au clic (maquette), la charge en pourcentage par technicien (D111) et en barre par jour, vues Jour / Semaine / 2 semaines / Mois, et une vue téléphone à onglets.
8. **12 questions pour Alexis (§6)** : QG-4 conditionne PG-A3b ; QG-1 et QG-2 les cartes et la disposition (PG-C3) ; QG-3 la vue Jour (PG-D1) ; QG-5 à QG-12 les tickets PG-B5 et PG-E.
9. **Ordre proposé** : PG-0 (documents, 1 ticket) → PG-A (ce qui trompe, 9) → PG-B (poser sans échec, 6) → PG-C (voir ce qui compte, 8) → DEPLANIFIEE-1 → PG-D (vues GMAO, 5) → PG-E (après décisions). Aucune migration jusqu'à PG-E.

---

## 1. Les bugs — le logiciel fait autre chose que ce qu'il annonce

### Bug 1 — Glisser une carte « À planifier » sur la vue Semaine est toujours refusé · **bloquant** · *déduit du code*

- **Ce qui se passe.** La vue Semaine est la vue par défaut ; son sous-titre dit « Glisser-déposer pour réaffecter », et chaque carte de la file est déplaçable (`app/(back-office)/planning/page.tsx:606-613`, `BlocPosable` autour de chaque carte, commentaire « glisser depuis la file vaut affectation — c'est l'usage principal »). Une case de la vue Semaine ne porte pas de minutes (`page.tsx:919-928`) : au dépôt, la requête n'envoie **que la date et le technicien** — heure et durée ne partent que si la cible porte des minutes (`components/planning/pose.tsx:244-264`). Pour une intervention « À planifier », `peutPlanifier` exige les quatre valeurs ensemble (`lib/interventions/cycle-de-vie.ts:239-281`) : **refus** « L'heure de début et la durée prévue sont obligatoires pour planifier cette intervention. » (`lib/i18n/fr.ts:1332-1333`).
- **Ce refus est voulu** : PARCOURS-1 (arbitrage d'Alexis du 23/09) exige les quatre valeurs d'un coup, et sa passation le dit (« une carte « à planifier » déposée sur une case de la vue semaine […] est refusée exactement de la même façon »). **Ce qui ne l'est pas** : que l'écran propose, dans sa vue par défaut, un geste qui échoue 100 % du temps — et seulement après que la carte a été relâchée. C'est le geste n° 1 d'un planificateur (parcours P1 du cahier : « pose l'intervention par glisser-déposer »).
- **Correctif, conforme à PARCOURS-1.** Au dépôt, ouvrir une **fenêtre de pose** pré-remplie (date et technicien de la case) qui demande l'heure et la durée et affiche les contrôles **avant** d'écrire : les quatre valeurs partent ensemble (spécification §3.10, ticket PG-B2). *En attendant, si Alexis le veut :* rendre les cartes de la file non déplaçables (en vue Semaine, et en vue Jour tant qu'elles n'ont pas de durée) et le dire : « Posez depuis la fiche (bloc « Planifier ») ».

### Bug 2 — En vue Jour, glisser une carte sans durée est refusé avec un message de redimensionnement · **bloquant** · *déduit du code*

- **Ce qui se passe.** Le formulaire « Créer une intervention » ne demande pas la durée (vu en production ; le schéma de création n'a pas ce champ, `lib/interventions/saisie.ts:144-198`). La carte de la file reçoit alors une durée de 0 (`planning/page.tsx:2098-2105`, `dureeDe` se termine par `?? 0`), le dépôt en vue Jour envoie `duree_min=0` (`pose.tsx:259-263`, branche sans redimensionnement), Zod refuse (`saisie.ts:234`, `positive()`), la route rend `duree_invalide` (`app/api/interventions/[id]/deplacer/route.ts:109-116`) et l'écran affiche : *« Une intervention dure au moins un créneau. Tirez la poignée sous le début du bloc, jamais au-dessus. »* (`fr.ts:1426`). Personne n'a tiré de poignée.
- **Correctif.** La fenêtre de pose (la durée y est demandée) ; à défaut, un refus nommé : « Cette intervention n'a pas de durée prévue : indiquez-la pour la poser. » Et la durée, facultative, dès la création (§4.3).

### Bug 3 — « Déplacer » : vider l'heure, comme le libellé y invite, déclenche « Tirez la poignée… » · **gênant** · *déduit du code*

- **Ce qui se passe.** Le champ s'appelle « Heure de début (laisser vide pour une journée sans heure) » (`fr.ts:1417-1418`) ; depuis 99S la durée est pré-remplie (fiche, `interventions/[id]/page.tsx:955-958`). Heure vide + durée remplie viole la règle « une heure et une durée, ou rien » (`saisie.ts:237-240`) ; la route n'isole que le cas inverse (heure donnée, durée vide, `route.ts:109`) et rend `duree_invalide` → « Tirez la poignée… ».
- **Deux lectures du même libellé.** Dans « Déplacer », il décrit la règle actuelle : PARCOURS-1 exempte les interventions déjà planifiées des quatre valeurs (`cycle-de-vie.ts:220-224`) — c'est seulement le message qui est faux. Dans « Planifier », le même libellé est posé juste sous « Les quatre valeurs — date, heure, durée prévue et technicien — se donnent ensemble » (vu en production), où l'heure est obligatoire : là, il contredit la règle.
- **Correctif.** Message nommé « L'heure de début est obligatoire » ou « Heure vidée : videz aussi la durée pour une journée sans heure » selon QG-4 ; libellé retiré du bloc « Planifier » dans tous les cas. Garder ou non la « journée sans heure » au déplacement est la question QG-4.

### Bug 4 — Les « Planifiée » héritées sans durée ne peuvent plus être modifiées, et l'écran dit « réessayez » · **bloquant** · *déduit du code*

- **Ce qui se passe.** 5 interventions planifiées de la semaine 39 n'ont pas de durée (vu en production : « Charge incomplète — 5 sans durée saisie »), dont 3 sans heure. La contrainte `intervention_planifiee_a_sa_duree` a été posée « NOT VALID » (`prisma/migrations/20260923130000_parcours_1_creer_puis_planifier/migration.sql:132-135`) : PostgreSQL ne revérifie pas l'existant, **mais contrôle toute ligne réécrite**. `peutPlanifier` laisse passer tout ce qui n'est pas « À planifier » (`cycle-de-vie.ts:248-250`), `verdictALaPose` ne regarde pas la durée, et le dépôt ne réécrit la durée que si elle est fournie (`lib/interventions/depot.ts:1032`, `?? undefined`) en gardant le statut `planifiee` (l. 1038). L'écriture finit en exception de base (23514), rattrapée par `avecFilet` (`app/api/interventions/actions.ts:88-108`), qui renvoie vers la fiche avec *« Une erreur est survenue pendant l'enregistrement. Rien n'a été modifié : réessayez. »* (`fr.ts:1451-1452`) — au glisser-déposer aussi (`interpreterReponseDepot`, `pose.tsx`). Réessayer échouera toujours.
- **Plus large que le déplacement : toute écriture sur ces lignes échoue** — « Affecter un technicien » (`depot.ts:641-653`), la « Note interne » (`depot.ts:2167`), et, côté terrain, l'ouverture de la fiche par le technicien : `/terrain/[id]` appelle `marquerVuParTechnicien` sans garde (`app/(mobile)/terrain/[id]/page.tsx:115` → `depot.ts:1975-2002`), qui réécrit la ligne quand `vue_technicien_le` est vide. **Le technicien ne peut probablement pas ouvrir ces fiches sur son téléphone.**
- **Correctif.** (1) Le geste d'exploitation en tête de ce document ; (2) dans le code, un refus nommé *avant* l'écriture pour toute modification d'une ligne qui resterait planifiée sans durée (« Cette intervention planifiée n'a pas de durée prévue : complétez-la (Déplacer, avec heure et durée) »), et l'ouverture terrain qui ne dépend pas de l'écriture du « vu ». **Ne jamais assouplir la contrainte** (D104, §8). *Le test de reproduction ne peut pas insérer une telle ligne — la contrainte s'applique aussi à l'insertion : il se fait par une fonction pure et par un compte en lecture seule sur la base.*

### Bug 5 — Jours fériés : la grille les montre ouverts, le serveur les refuse, la charge les retire · **bloquant** · *vu en production + code*

- **Ce qui se passe.** Jeudi 24/09/2026 (Fête de la citoyenneté, férié du territoire — `prisma/seed-data.ts:364`) : la vue Semaine ne hachure pas la colonne (seul le samedi l'est), la vue Jour annonce **« 60 créneaux libres »** (vu en production). La charge de la semaine compte **40:00 ouvrables** pour un technicien (4 jours × 10 h, calendrier 07:00-17:00, 5 jours ouvrés) : elle, retire le férié.
- **Cause.** Deux lectures d'un même critère. La page ne charge que le paramétrage hebdomadaire, sans les fériés (`planning/page.tsx:214-222`, `256-272`) ; la grille Semaine ne regarde que le jour de la semaine (`lib/interventions/grille.ts:259-267`, `ouvertePour`), la vue Jour aussi (`lib/interventions/journee.ts:390-392` et `456-465`). La pose juge avec `estJourOuvre` (`lib/interventions/pose.ts:133`, fériés et ponts compris, `lib/calendar/ouverture.ts:67-84`) ; la charge lit le calendrier complet (`lib/interventions/occupation.ts:288-305`).
- **Pourquoi c'est grave.** L'écran propose des trous qu'on ne peut pas remplir, et le refus tombe après le geste. C'est la faute que le §9 du 01/09 nomme : « deux lectures d'un même critère divergent en silence ».
- **Correctif.** Pour chaque agence, la grille et la vue Jour montrent un jour ouvert **si et seulement si** `estJourOuvre(calendrier de l'agence, jour)` le rend — le critère même de la pose ; la colonne fériée est tramée et nommée (« Jeu. 24 — férié ») ; un férié travaillé par l'agence (RG-PLA-02) reste ouvert. L'union des calendriers par personne reste un repère, jamais un droit de poser (RG-PLA-07).

### Bug 6 — L'ordre des techniciens change entre Semaine et Jour · **gênant** · *vu en production + code*

- **Ce qui se passe.** Semaine : ordre alphabétique des noms (`grille.ts:282-293`, `comparerLignes`). Jour : ordre de l'**identifiant technique** (`journee.ts:499-506`, `comparerColonnes` compare `technicienId`, un UUID). En production, les quatre techniciens n'apparaissent pas dans le même ordre d'une vue à l'autre.
- **Correctif.** Un seul comparateur (par nom, « Non affectées » en tête), partagé par les deux vues.

### Bug 7 — « Affectée » est inatteignable ; le bouton principal d'une « Planifiée » ne la fait pas avancer · **gênant** · *code + vu en production*

- **Ce que dit la décision.** D8 (`docs/arbitrages.md:161`, §3.6 à `:528`) : `AFFECTEE` signifie « **transmise au technicien, non encore démarrée** » ; la matrice D8 autorise Planifiée → Affectée.
- **Ce que fait le code.** **Aucun chemin de l'application** (`lib/`, `app/`, déclencheurs) ne pose `affectee` : `statutALaCreation` ne rend que `a_planifier`/`planifiee`, `statutApresDeplacement` ne produit jamais `affectee`, la migration de rattrapage R3-02 le dit (« `affectee` n'y figure PAS, et c'est délibéré »). *Seules les données de démonstration en contiennent* (`prisma/seed-data.ts:1583`, `1813`, `1853`, `1873`) — les captures de la scène montrent donc des « Affectée » que la production ne peut pas produire. L'action principale d'une « Planifiée » est « Affecter un technicien » (`lib/interventions/action-principale.ts:20`), qui ne change que `technicien_id` (`depot.ts:644`). Depuis PARCOURS-1, une intervention ne quitte la file qu'avec un technicien (elle peut le perdre ensuite : « Déplacer » vers « Aucun technicien », dépôt sur la ligne « Non affectées ») : dans le cas ordinaire, le bouton principal ré-enregistre la même personne, déjà sélectionnée (vu en production), et la fiche repropose le même bouton.
- **Conséquences.** Filtre « Affectée » du registre toujours vide en production ; aucun moyen de distinguer ce que le planificateur prépare de ce que le technicien a reçu.
- **Correctif.** Réaliser la transition que D8 a écrite : action principale « Transmettre au technicien » (Planifiée → Affectée) et, au planning, « Transmettre la journée de demain » (spécification §3.13). **Question QG-5**, avec deux faits à peser : depuis AVERTISSEMENTS-1 (24/09), le technicien — et le client — reçoivent déjà un courriel à chaque planification et à chaque déplacement (`lib/avertissements/planification.ts:11-27`) ; et la migration du renommage (`20260913210000_statut_affectee_d8`) garde une autre lecture du mot (« une AFFECTATION […] rien n'envoie »).

### Bug 8 — Une intervention planifiée dont la date est passée sans démarrage n'est signalée nulle part · **bloquant** · *vu en production*

- **Ce qui se passe.** Au dimanche 27/09 : 6 interventions « Planifiée » du 23 et du 25/09, jamais démarrées (fiche : « le compteur n'a pas encore tourné »). Aucun signe « en retard » sur la carte, la fiche, le tableau de bord (« Priorités opérationnelles » liste les P1 du jour, les pièces attendues et la file à planifier — jamais une planifiée en retard) ni le registre (onglets : Toutes, À planifier, Aujourd'hui, En cours, Bloquées, À contrôler, Historique — `saisie.ts:101-108`). Lundi, la vue passe à la semaine 40 : **elles sortent de l'écran**.
- **Correctif.** Mention calculée « En retard » : statut planifiée ou affectée, date passée dans le fuseau de l'agence, **aucun segment de travail** (une intervention reprise repasse `planifiee` même après un début de travail, `depot.ts:2357`). Contour rouge et mention sur la carte ; onglet « En retard » dans la colonne « À traiter » ; tuile au tableau de bord ; onglet au registre. Rien à stocker : c'est une lecture.

### Bug 9 — En vue Semaine, déplacer une carte d'un jour à l'autre efface son heure · **gênant** · *déduit du code*

- **Ce qui se passe.** Une case Semaine ne porte pas de minutes : le dépôt d'une carte **déjà planifiée à 08:00** n'envoie ni heure ni durée (`pose.tsx:249`) ; `demandeDeDeplacement` rend alors un créneau vide (`depot.ts:717-735`) et l'écriture met `creneau_debut` et `creneau_fin` à `NULL` (`depot.ts:1015-1016`) en gardant la durée. L'intervention devient une « journée sans heure » **sans que personne l'ait décidé ni vu**. Le seul scénario de bout en bout de ce geste part d'une carte sans heure (`tests/e2e/glisser-deposer.spec.ts:164-170`) : le cas n'est pas éprouvé.
- **Correctif.** En vue Semaine, un déplacement garde l'heure et la durée de la carte (elles sont connues de la page) ; si cette heure ne tient pas dans la case d'arrivée, la fenêtre de pose s'ouvre. Lié à QG-4.

---

## 2. Les incohérences — deux écrans, ou deux règles, se contredisent

| # | Incohérence | Preuve | Correctif proposé |
|---|---|---|---|
| I-1 | **Vue Jour : techniciens en colonnes.** Le cahier (M4, l. 435 : « Techniciens en lignes, temps en colonnes ») et la maquette complète (`dayPlan()` : techniciens en lignes, 08:00 / 10:00 / 13:00 / 15:00 en colonnes) les veulent en lignes. R2-14 (11/09) a construit l'inverse en écrivant « Écran de la maquette : AUCUN » (`docs/backlog.md:1384`) — la maquette complète est arrivée le 17/09 et D125 l'a rendue normative le 18/09. Passer de Semaine à Jour fait pivoter les axes. | code + maquette | ⚠ **QG-3** : vue Jour en frise horizontale. |
| I-2 | **Colonnes de 79 px.** À 1280 px : barre 272 + file 290 (`page.tsx:572`) + colonne technicien 170 → 6 colonnes de jour de **79 px**, cartes de **67 px** en **11 px** (mesuré). La maquette complète fixe `minmax(150px,1fr)` avec `min-width:920px` et une file de 255 px ; 82-PLANNING-6 (25/09) a retiré ce minimum parce que vendredi et samedi disparaissaient sans indice de défilement (`page.tsx:831-844`). | mesure + maquette | ⚠ **QG-1** : revenir aux 150 px de la maquette **avec un indice de défilement visible**, jours fermés réduits à 36 px, file repliable, « Plein écran ». |
| I-3 | **Clic sur une carte.** La maquette ouvre un tiroir latéral (`openDrawer` : client, créneau, machine, technicien, « Déplacement contrôlé ») ; l'écran vivant quitte le planning pour la fiche. | maquette | Tiroir au clic (D125), « Ouvrir la fiche » dedans. |
| I-4 | **Qui est libre ?** « 5 % » sous le nom d'un technicien alors que 5 de ses 6 interventions n'ont pas de durée (la réserve n'est que dans le panneau du bas) ; les trois techniciens sans intervention n'ont **ni pourcentage** (`page.tsx:2013-2015`) **ni ligne** dans « Charge par technicien ». C'est pourtant ce que cherche le planificateur. | vu en production | Chaque technicien a son pourcentage, **0 % compris** (D111 : le taux seul dans la colonne) ; « ≥ 5 % » quand des durées manquent. |
| I-5 | **« Sans durée » : trois populations, un libellé.** Tableau de bord « Planifiées sans durée prévue : 3 » — ce sont les 3 interventions **À planifier** (critère : non terminée, sans durée, date nulle OU ≥ aujourd'hui, `depot.ts:1696-1704`) ; aucune n'est planifiée. Planning : « 5 sans durée saisie » (semaine affichée, dates passées). Et le lien « Voir les interventions sans durée → » du planning (`statistiques.tsx:297`) mène aux 3, pas aux 5. | vu + code | Un seul onglet « Sans durée » (non terminées sans durée, dates passées comprises) ; libellés exacts. |
| I-6 | **Un mot pour une chose : l'indisponibilité.** Menu « Absences », titre de page « Blocages d'agenda », tuile « Absences ce mois », case « Agenda bloqué », légende « Suspendue / absence », lien « Blocages d'agenda » dans le planning, lien « Voir la semaine dans les blocages d'agenda ». | vu en production | ⚠ **QG-8** — recommandation « Absence » partout (menu, cahier M4, maquette). |
| I-7 | **« Aujourd'hui » à moitié.** Le bouton n'existe qu'en vue Semaine, et seulement hors de la semaine courante (82-PLANNING-6, `page.tsx:1642-1660`) ; la vue Jour n'en a pas. Le dimanche, le planning montre la semaine écoulée. | code + vu | « Aujourd'hui » toujours présent, dans toutes les vues ; un jour fermé ouvre sur le prochain jour ouvré. *Revient sur le choix de 82-PLANNING-6 : à dire dans le ticket.* |
| I-8 | **Agence inactive affichée.** Bandeau du planning : « DUCO : lundi au vendredi · DUCOS : lundi au vendredi » alors que DUCO est « Inactif » (/parametres/agences) ; filtre du registre « DUCO — 1 ». | vu | **Déjà prévu** (AGENCE-ACTIVE) — **y ajouter le bandeau du planning**, qui n'est ni un choix ni un filtre et serait oublié. |
| I-9 | **Samedi de Ducos.** RG-PLA-01 (l. 719) : « Ducos du lundi au samedi » ; calendrier en production : lundi au vendredi. | vu + cahier | ⚠ **QG-7** : donnée ou règle ? |
| I-10 | **« Dernière intervention »** de la fiche client = la plus récente par date, statut compris (`depot.ts:2539-2546`) : une intervention planifiée non réalisée s'y affiche (« 25/09/2026 · Curatif »). | vu + code | « Dernière intervention réalisée » + « Prochaine intervention ». |
| I-11 | **Registre : « Planifiées cette semaine 6 »**, tuile sans lien, et aucun onglet ne les montre : il faut passer par « Toutes (1761) », dont 1751 d'historique. | vu | Onglets « À venir » et « En retard » ; la tuile ouvre « À venir ». |
| I-12 | **Historique repris présenté comme des faits** : 1751 lignes « Aucun technicien affecté » et « P3 — normale » — la reprise garde la valeur par défaut du schéma. | vu | « — » quand la donnée n'existe pas dans la source ; priorité non affichée sur l'historique repris. |
| I-13 | **Deux fiches, deux modes.** Fiche machine : lecture + bouton « Modifier ». Fiche client : formulaire d'identité toujours ouvert, plus « Clients › X » ET « ← Tous les clients ». | vu | Fiche client en lecture + « Modifier », un seul retour. |
| I-14 | **Téléphone : la P1 est au fond.** À 375 px, la file « À planifier » (et sa P1) commence à 1652 px sur 2461, après toute la semaine de chaque technicien. | mesure | Onglets téléphone « Aujourd'hui · À traiter · Semaine » (spécification §4) — **remplace C-B1**. |
| I-15 | **Priorité colorée comme un statut.** La pastille « P1 — critique » de la file prend la classe du **statut** (`page.tsx:623`, `CLASSES_STATUT[ligne.statut]`) : grise comme une P3. | code + vu | **Déjà prévu** (99UA-GR5). |
| I-16 | **Clients : 104 sur 129 cachés par défaut.** La liste n'inclut les clients sans équipement que si la case est cochée (`clients/page.tsx:137-145` ; `lib/clients/depot.ts:338`) ; la page dit « 25 clients » sans dire que 104 sont masqués, et la **recherche par nom** suit le même filtre : un client qu'on vient de créer (donc sans équipement) est introuvable. | vu (25 → 129 en cochant) | Même correctif que GR12 pour les sites : « 25 clients avec équipement · 104 sans équipement masqués — Afficher » ; la recherche par nom ignore ce filtre. |
| I-17 | **Les annulées restent affichées.** L'annexe D dit « Annulée — gris barré — **masqué par défaut** » ; `listerPlanning` rend toute ligne sans date quel que soit son statut (`depot.ts:1583-1596`) et `fileDAttente` ne filtre que sur la date (`affichage.ts:95-99`) : une annulée sans date reste dans la file « À planifier », barrée ; une annulée datée reste sur la grille. | code | Annulées masquées par défaut, filtre « Afficher les annulées ». *À rejouer en recette.* |

---

## 3. Les données visibles à l'écran (reprise) — gestes d'exploitation, pas de code

| # | Constat (vu en production) | Geste |
|---|---|---|
| R-a | Deux interventions d'essai (libellés de test) dans la file et les « Priorités opérationnelles ». | Les annuler (elles resteront visibles barrées jusqu'à PG-A8). |
| R-b | Numéro de série de remplacement de la reprise affiché tel quel : « S/N SN-INCONNU-MAC-… ». | Afficher « N° de série inconnu » (code, une ligne) ; la donnée reste. |
| R-c | Familles sans accents : « Pont Elevateur », « Demonte-Pneu », « Equilibreuse », « Secheur Air », « Cric / Verin », « Banc Geometrie ». | Renommer une fois le référentiel (« Pont élévateur »…). |
| R-d | Statut de la ressource écrit dans le nom : « Prénom (patenté) ». | ⚠ **QG-9** : un champ salarié / patenté. |
| R-e | Temps de trajet connu pour 3 sites sur une quarantaine ; « 1 journée dont le trajet est inconnu ». | Renseigner la zone des sites : le défaut par zone (D107) s'applique alors. |
| R-f | « 0 équipements » (liste clients). | « 0 équipement ». |
| R-g | Une P1 « critique » créée le 22/09, non planifiée le 27/09, champ « Panne signalée » vide. | Rien à coder ici : c'est ce que l'ancienneté affichée (spécification §3.4) doit rendre visible. |
| R-h | Un des noms de client *fictifs* de la maquette complète du dépôt (`docs/maquette/codiplan-maquette-complete.html`) coïncide avec un client réel de la base (vérifié en lecture seule le 27/09 ; le nom n'est pas écrit ici). | Le renommer dans la maquette (I9) — Alexis sait lequel ; la maquette de ce lot n'emploie aucun nom de la base. |

---

## 4. Page par page — ce qu'il faut faire évoluer

*Chaque ligne : ce qui change à l'écran. « Déjà prévu » = en file, ne pas refaire.*

### 4.1 Tableau de bord

| Évolution | Pourquoi | Priorité |
|---|---|---|
| Tuile **« En retard »** (planifiées/affectées, date passée, aucun segment) → planning, onglet « En retard ». | Bug 8. | haute |
| Jour fermé (dimanche, férié) : « Prochain jour ouvré : lundi 28/09 — N interventions » au lieu de « Interventions aujourd'hui 0 ». | I-7. | moyenne |
| Tuile « sans durée » : libellé exact de sa population. | I-5. | haute |
| « Priorités opérationnelles » : **ancienneté** (« créée il y a 5 j ») et durée prévue ; « Planifier » ouvre la fenêtre de pose. | Voir d'un coup ce qui attend depuis trop longtemps. | moyenne |
| « Non calculé » en très gros. | — | **déjà prévu** (9AP, GR17) |

### 4.2 Planning

Diagnostic complet en §5, cible dans la spécification. En une ligne : **réparer les bugs 1, 2, 4, 5, 6, 9 et I-17 ; poser par une fenêtre au lieu d'un refus ; tout ce qui est à faire dans une colonne à onglets ; techniciens en lignes partout ; tiroir au clic ; la charge là où l'on pose.**

### 4.3 Créer une intervention

| Évolution | Pourquoi | Priorité |
|---|---|---|
| Champ **« Durée prévue »** facultatif, choix rapides (30 min · 1 h · 1 h 30 · 2 h · 3 h · 4 h · autre). Aucune valeur par défaut. | Sans elle la carte ne se pose pas (bug 2) ; PARCOURS-1 l'exige au planning, autant la saisir quand on la connaît. La création reste « sans date, sans heure, sans technicien » (PARCOURS-1). | haute |
| Après « Créer » : **« Planifier maintenant »** (fenêtre de pose) ou « Laisser dans la file ». | Enchaîner l'appel client et le rendez-vous. | haute |
| ⚠ Case **« Machine à l'arrêt »** (parcours P1 : « coche machine à l'arrêt, urgence P1 ») qui propose P1 et passe la machine « En panne » jusqu'à la clôture. | Le statut d'une machine se choisit à sa création et **aucun geste ultérieur** — intervention ou modification de la fiche — ne le change (`lib/machines/depot.ts:1032-1045`) : la tuile « En panne ou arrêtées » ne compte que des fiches créées ainsi. | QG-10 |

### 4.4 Fiche intervention

| Évolution | Pourquoi | Priorité |
|---|---|---|
| Résumé : **« jeu. 25/09 · 08:00–10:00 (2 h) »** au lieu de « 25/09/2026 08:00 » — la durée prévue n'est affichée nulle part dans le résumé. | Obligatoire pour planifier, et invisible. | haute |
| Mention **« En retard »** en tête quand la date est passée sans démarrage. | Bug 8. | haute |
| **Chronologie** : elle montre création, suspension, reprise, clôture, annulation — **aucun événement de planification** (planifiée pour quand, avec qui ; déplacée ; technicien changé ; vue par le technicien). Le journal d'audit (I8) porte déjà ces écritures. | « Qui a déplacé mon rendez-vous ? » | moyenne |
| Action principale d'une « Planifiée » : **« Transmettre au technicien »**. | Bug 7, D8 §3.6. | après QG-5 |
| Bloc « Planifier » : **« Trouver un créneau »**, qui ouvre la fenêtre de pose. | Aujourd'hui : lire le planning, revenir, retaper date, heure, durée. | haute |
| Libellé de l'heure (bug 3). | — | selon QG-4 |

### 4.5 Registre des interventions

| Évolution | Pourquoi | Priorité |
|---|---|---|
| Onglets **« À venir »** et **« En retard »** ; la tuile « Planifiées cette semaine » ouvre « À venir ». | I-11, bug 8. | haute |
| Historique repris : « — » au lieu de « Aucun technicien affecté » ; pas de priorité affichée quand la source n'en donnait pas. | I-12. | basse |
| Agence inactive hors du filtre. | **déjà prévu** (AGENCE-ACTIVE). | — |

### 4.6 Demandes

PARCOURS-1 a tranché : au bureau, un appel client devient directement une intervention « À planifier » ; l'écran « Demandes » (D133) reçoit les demandes à qualifier. Une intervention d'essai trouvée en production, intitulée comme une demande, montre que ce chemin n'est pas évident. **Évolution (texte seulement)** : sur « Demandes », sous « Créer une intervention » : « Un appel client ? Créez l'intervention : elle arrive dans la file « À planifier » du planning. » — priorité basse.

### 4.7 Absences (« Blocages d'agenda »)

| Évolution | Pourquoi | Priorité |
|---|---|---|
| Un seul mot (I-6). | — | QG-8 |
| ⚠ Demi-journée ou plage horaire (aujourd'hui « Du / Au » en jours entiers). | Un rendez-vous médical de 2 h bloque toute la journée du technicien. | QG-8 (schéma) |
| Astreinte (cahier M4 : « planning d'astreinte séparé, technicien de garde visible en un coup d'œil »). | Non construite. | plus tard |

### 4.8 Clients et fiche client

| Évolution | Pourquoi | Priorité |
|---|---|---|
| « 25 clients avec équipement · 104 masqués — Afficher » ; la recherche par nom trouve tous les clients. | I-16. | haute |
| Tuile « 0 Sans code externe » : seulement si le nombre est > 0. | Un « 0 » en tête de page est du bruit. | basse |
| Fiche : « Dernière intervention réalisée » + « Prochaine intervention » ; colonne Machine dans l'historique (**déjà prévu**, 9AA). | I-10. | moyenne |
| Fiche en lecture + « Modifier » ; un seul lien de retour. | I-13. | basse |

### 4.9 Sites

| Évolution | Pourquoi | Priorité |
|---|---|---|
| Trajet « — » : liste filtrée « trajet inconnu » et **« Renseigner la zone »** en série. | R-e : la charge et la future tournée en dépendent. | moyenne |
| « Client — Site », « site » au lieu de « lieu », sites masqués comptés. | **déjà prévu** (9AB). | — |

### 4.10 Parc et fiche machine

| Évolution | Pourquoi | Priorité |
|---|---|---|
| Familles normalisées (R-c). | Lisibilité partout, planning compris. | moyenne |
| « N° de série inconnu » au lieu du numéro de remplacement (R-b). | — | basse |
| ⚠ Statut machine mis à jour par l'intervention curative « machine à l'arrêt ». | Aucun geste ultérieur ne change le statut d'une machine (§4.3). | QG-10 |

### 4.11 VGP

Rien à changer au principe (D88 : CODIMA n'affirme jamais la conformité et ne commande pas les VGP ; une échéance VGP n'est **pas** du travail à planifier). Seul lien avec le planning : **une observation d'organisme devient une intervention à planifier** (D88 point 10) — elle apparaît dans la colonne « À traiter » comme toute intervention « À planifier », avec l'origine « Observation VGP ».

### 4.12 Paramètres

| Évolution | Pourquoi | Priorité |
|---|---|---|
| Équipe : badge « Patenté / Salarié » au lieu du nom (R-d). | Filtre du planning. | QG-9 |
| Agences : l'agence inactive en fin de liste, grisée. | **déjà prévu** (AGENCE-ACTIVE). | — |

---

## 5. Le planning, diagnostic GMAO

**Ce que fait un planning de maintenance itinérante, et où en est CODIPLAN** (références : tableau de répartition de Dynamics 365 Field Service, console de répartition de Salesforce Field Service — et le cahier M4 lui-même, qui décrivait déjà presque tout) :

| Fonction attendue | Cahier M4 | Aujourd'hui | Cible |
|---|---|---|---|
| Ressources en lignes, temps en colonnes | oui | Semaine oui ; **Jour non** (I-1) | toutes les vues (QG-3) |
| Vues Jour, Semaine, 2 semaines, Mois | oui | Jour, Semaine | les quatre + liste téléphone |
| Filtres agence, compétence, type, client, statut | oui | **aucun** filtre sur le planning | technicien, nature, priorité, client, statut (agence quand plusieurs seront actives) |
| File des travaux à planifier, triée urgence + échéance, risque de dépassement | oui | file triée urgence + ancienneté, **ancienneté non affichée** | colonne « À traiter » à onglets + ancienneté ; échéance quand une règle la donnera (QG-11) |
| Poser par glisser-déposer | oui | **refusé** (bugs 1, 2, 4) | fenêtre de pose au dépôt |
| Contrôles à la pose | oui | tenus côté serveur ; absences et fermetures hebdomadaires déjà dessinées, **fériés non**, le reste dit **après** le geste | dits pendant le glissé (case rouge + motif) et dans la fenêtre de pose |
| Disponibilités justes | oui | **fériés faux** (bug 5) | une seule lecture du calendrier |
| Charge / capacité par ressource | oui | pourcentage sous le nom, techniciens libres sans chiffre (I-4) | pourcentage pour chacun (D111), barre par jour |
| Travaux en retard / non réalisés | implicite | **invisibles** (bug 8) | onglet + contour + tuile |
| Préparé vs transmis au technicien | D8 §3.6 | **inatteignable** (bug 7) | « Transmettre » (QG-5) |
| Détail rapide sans quitter l'écran | maquette | page fiche | tiroir latéral |
| Création par sélection d'une plage | oui | non | « Créer ici » → création inchangée (PARCOURS-1) → fenêtre de pose pré-remplie |
| Tournées (ordre + trajets) | oui | aller/retour seulement (D107) | après la stabilisation, comme Alexis l'a placé |
| Astreinte | oui | non | plus tard |

La **spécification** décrit l'écran cible bloc par bloc, ses règles et ses critères d'acceptation ; la **maquette cliquable** le montre à 1440 px et au téléphone, avec des données fictives.

---

## 6. Questions pour Alexis

*Une question = une décision. Recommandation en premier. Ordre = ordre de pose des questions.*

| # | Question | Options | Recommandation | Conditionne |
|---|---|---|---|---|
| QG-4 | Une intervention **déjà planifiée** peut-elle devenir « journée sans heure » en la déplaçant ? (Aujourd'hui : oui, PARCOURS-1 l'exempte ; et le bug 9 le fait sans le dire.) | (a) Non : heure obligatoire au déplacement aussi ; (b) Oui, mais seulement volontairement (heure ET durée vidées ensemble, message clair). | (a) — une seule règle pour « planifié ». | PG-A3b |
| QG-1 | Colonnes de jour : revenir aux **150 px minimum** de la maquette complète (D125) avec défilement horizontal — ce que 82-PLANNING-6 a retiré faute d'indice de défilement ? | (a) Oui, avec indice de défilement visible, jours fermés à 36 px et « Plein écran » ; (b) Non, colonnes qui rétrécissent (état actuel, cartes de 67 px). | (a). | PG-C3 |
| QG-2 | Accepter ces **écarts à la disposition de la maquette complète** (D125) : onglets et recherche dans la file, rangée de filtres, vues 2 semaines et Mois, repères cliquables sous l'encadré, jours fermés réduits, bouton « Transmettre », actions dans le tiroir. | (a) Oui, en bloc ; (b) au cas par cas. | (a) — ce sont des ajouts ; aucun bloc de la maquette n'est retiré. | PG-C, PG-D |
| QG-3 | **Vue Jour en frise horizontale** (techniciens en lignes), comme le cahier M4 et la maquette complète ? | (a) Oui ; (b) garder les colonnes (R2-14). | (a). | PG-D1 |
| QG-5 | Réaliser « Affectée = transmise au technicien » (D8 §3.6) ? Faits : le technicien reçoit déjà un courriel à chaque planification (AVERTISSEMENTS-1). | (a) Oui : « Planifiée » = préparée par le bureau, invisible du terrain ; « Transmettre » envoie le courriel et rend visible ; (b) Oui, mais le terrain voit tout, « Transmettre » ne fait que marquer ; (c) Non : retirer « Affectée » de l'écran et l'action « Affecter » d'une Planifiée. | (a) — c'est la lecture de D8 §3.6, et elle permet de préparer la semaine sans déranger le terrain. | PG-E1 |
| QG-6 | « **Annuler** » juste après un déplacement : c'est un second déplacement, donc un second courriel au client et au technicien (AVERTISSEMENTS-1). | (a) Accepter ; (b) retarder l'envoi des courriels de planification de quelques secondes ; (c) pas de bouton « Annuler ». | (b) — ce que le client reçoit reste un seul message. | PG-B5 |
| QG-7 | **Samedi à Ducos** : RG-PLA-01 dit lundi-samedi, les données lundi-vendredi. | (a) Corriger la donnée ; (b) amender RG-PLA-01. | À trancher par l'exploitation. | — |
| QG-8 | **Absence** : un mot partout, et à l'heure ? | (a) « Absence » partout + demi-journée / plage horaire (migration) ; (b) « Blocage d'agenda » partout, jours entiers. | (a). | PG-E3 |
| QG-9 | **Salarié / patenté** : un champ de la fiche technicien (badge, filtre) ? | (a) Oui (migration) ; (b) Non, rester dans le nom. | (a). | PG-E2 |
| QG-10 | **Machine à l'arrêt** : une case à la création qui propose P1 et passe la machine « En panne » jusqu'à la clôture ? | (a) Oui ; (b) Non. | (a) — c'est le parcours P1 du cahier. | PG-E4 |
| QG-11 | **Échéance et risque de dépassement** (cahier M4) : L3-03a (`docs/backlog.md:782-786`, BLOQUÉ) les fait naître du contrat et d'un SLA (lot 4). Faut-il, en attendant, un délai cible par priorité ? | (a) Oui — nouvelle règle au chapitre 10, délais saisis par Alexis (jamais inventés, §8) ; (b) Non, ancienneté seule jusqu'aux contrats. | (b). | PG-E5 |
| QG-12 | **Durées types** par nature pour pré-remplir la fenêtre de pose ? | (a) Oui, saisies par Alexis ; (b) Non, choix rapides seulement. | (b) maintenant. | PG-E6 |

---

## 7. Ordre de passage proposé

*Détail, ticket par ticket, dans `lots.md`. Rien ne commence avant la fin du lot ERGO en cours ; AGENCE-ACTIVE reste avant.*

| Lot | Contenu | Migration | Tickets |
|---|---|---|---|
| **PG-0 — Documents** | Cet audit, la spécification, le découpage et la maquette dans le dépôt | non | 1 |
| **PG-A — Ce qui trompe** | Fériés (bug 5) ; ordre des techniciens (bug 6) ; messages justes (bugs 2, 3) ; libellé de l'heure (bug 3, après QG-4) ; refus nommé avant écriture (bug 4) ; durée et fin au résumé de la fiche ; libellé « sans durée » (I-5) ; l'heure gardée en vue Semaine (bug 9) ; annulées masquées (I-17) | non | 9 |
| **PG-B — Poser sans échec** | Verdict de pose en lecture seule ; fenêtre de pose au dépôt (bugs 1, 2) ; « Trouver un créneau » depuis la fiche ; cases incompatibles en rouge pendant le glissé ; « Annuler » après un déplacement (après QG-6) ; durée facultative à la création | non | 6 |
| **PG-C — Voir ce qui compte** | En retard (bug 8 : planning, tableau de bord, registre) ; colonne « À traiter » à onglets + ancienneté ; cartes et colonnes (après QG-1, QG-2) ; charge par technicien ; tiroir ; filtres + « Aujourd'hui » | non | 8 |
| **PG-D — Vues GMAO** | Vue Jour en frise (après QG-3) ; 2 semaines ; Mois ; téléphone à onglets (remplace C-B1) ; « Créer ici » | non | 5 |
| **PG-E — Après décisions** | Transmettre (QG-5) ; salarié/patenté (QG-9) ; absence à l'heure (QG-8) ; machine à l'arrêt (QG-10) ; délais cibles (QG-11) ; durées types (QG-12) | selon décision | 6 |

---

## Annexe — les preuves, rassemblées (commit `e2b8421`)

| Bug / incohérence | Fichier : ligne |
|---|---|
| 1 | `components/planning/pose.tsx:244-264` ; `lib/interventions/cycle-de-vie.ts:239-281` ; `app/(back-office)/planning/page.tsx:606-613`, `:919-928` ; `lib/i18n/fr.ts:1332-1333` ; `docs/propositions/38-PARCOURS-1/passation.md` |
| 2 | `app/(back-office)/planning/page.tsx:2098-2105` ; `components/planning/pose.tsx:259-263` ; `lib/interventions/saisie.ts:234` ; `app/api/interventions/[id]/deplacer/route.ts:93-116` ; `lib/i18n/fr.ts:1426` |
| 3 | `lib/i18n/fr.ts:1417-1418` ; `app/(back-office)/interventions/[id]/page.tsx:948-958`, `:865-870` ; `lib/interventions/saisie.ts:237-240` ; `lib/interventions/cycle-de-vie.ts:220-224` |
| 4 | `prisma/migrations/20260923130000_parcours_1_creer_puis_planifier/migration.sql:132-138` ; `lib/interventions/cycle-de-vie.ts:248-250` ; `lib/interventions/depot.ts:641-653`, `:1032`, `:1038`, `:1975-2002`, `:2167` ; `app/api/interventions/actions.ts:88-108` ; `app/(mobile)/terrain/[id]/page.tsx:115` ; `lib/i18n/fr.ts:1451-1452` |
| 5 | `app/(back-office)/planning/page.tsx:214-222`, `:256-272` ; `lib/interventions/grille.ts:259-267` ; `lib/interventions/journee.ts:390-392`, `:456-465` ; `lib/interventions/pose.ts:133` ; `lib/calendar/ouverture.ts:67-84` ; `lib/interventions/occupation.ts:288-305` ; `prisma/seed-data.ts:364` |
| 6 | `lib/interventions/grille.ts:282-293` ; `lib/interventions/journee.ts:499-506` |
| 7 | `docs/arbitrages.md:161`, `:528` ; `lib/interventions/action-principale.ts:20` ; `lib/interventions/depot.ts:644` ; `prisma/migrations/20260913250000_rattrapage_suspensions_r3_02/migration.sql:189` ; `prisma/seed-data.ts:1583` ; `lib/avertissements/planification.ts:11-27` |
| 8 | `lib/interventions/saisie.ts:101-108` ; `lib/interventions/depot.ts:2357` |
| 9 | `components/planning/pose.tsx:249` ; `lib/interventions/depot.ts:717-735`, `:1015-1016` ; `tests/e2e/glisser-deposer.spec.ts:164-170` |
| I-5 | `lib/interventions/depot.ts:1696-1704` ; `app/(back-office)/planning/statistiques.tsx:297` ; `lib/i18n/fr.ts:2955-2956` |
| I-15 | `app/(back-office)/planning/page.tsx:623` |
| I-16 | `app/(back-office)/clients/page.tsx:137-145` ; `lib/clients/depot.ts:338` |
| I-17 | `lib/interventions/depot.ts:1583-1596` ; `lib/interventions/affichage.ts:95-99` ; `docs/cahier-des-charges.md:1735` |

*Sources externes consultées pour la cible GMAO :* [Tableau de répartition — Dynamics 365 Field Service (Microsoft Learn)](https://learn.microsoft.com/en-us/dynamics365/field-service/work-with-schedule-board) · [Gantt de la console de répartition — Salesforce Field Service](https://help.salesforce.com/s/articleView?id=sf.pfs_gantt.htm&language=en_US&type=5) · [Violations de règles sur le Gantt — Salesforce](https://help.salesforce.com/s/articleView?id=service.pfs_violations.htm&language=en_US&type=5).
