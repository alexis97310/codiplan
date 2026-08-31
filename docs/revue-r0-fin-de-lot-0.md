# CODIPLAN — Revue R0 : l'écart entre le backlog et cinquante-deux décisions

|                 |                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| **Objet**       | Mesurer ce que le backlog, écrit avant D1, ne sait pas encore                                            |
| **Portée**      | `docs/arbitrages.md`, `CLAUDE.md`, chapitre 10, le registre « Ce qui reste à décider », `docs/backlog.md` |
| **Statut**      | **MESURE, non normative.** Aucun rang dans la hiérarchie du §1 du CLAUDE.md. Rien n'est tranché ici       |
| **Date**        | 31 août 2026                                                                                             |
| **Ticket**      | R0 — revue de fin de lot 0. Aucun code, aucune migration                                                 |

Ce document ne réécrit pas le backlog : il dit où il ment, où il est muet, et ce
qu'une session du lot 1 ne trouvera nulle part. Les écarts sont numérotés **É1** à
**É14** et récapitulés en fin de document avec leur rang et une recommandation.

---

## 1. Décisions orphelines

*Une décision qui renvoie à un lot futur sans ticket pour la porter est une
décision qu'on croit prise et qui ne se produira jamais.*

**Onze renvois, dont quatre portés par un ticket et sept qui ne le sont pas.**

| Décision                | Renvoi exact                                                                                        | Lot visé   | Registre | Ticket     | Verdict                    |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ---------- | -------- | ---------- | -------------------------- |
| D40                     | « une procédure de déblocage d'un `admin_societe` ayant perdu son second facteur »                    | 7          | oui      | **L7-01**  | **portée**                 |
| D50                     | « le message attend la console éditeur du lot 7 »                                                     | 7          | —        | **L7-02**  | **portée**                 |
| incident 23/08          | « écriture groupée des données de référence du seed »                                                 | déclencheur| —        | **L0-12**  | **portée** — mais É6       |
| D45                     | « à trancher avant L2-09 »                                                                            | 2          | oui      | **L2-09**  | **portée** — le seul modèle |
| D36 / D38               | « Chemin à construire au **lot 5** : une fonction `SECURITY DEFINER` … »                               | 5          | oui      | *aucun*    | **orpheline** — É1         |
| D32                     | « seuls sont journalisés les accès des **rôles éditeur** aux données d'une société cliente »           | *non dit*  | non      | *aucun*    | **orpheline** — É2         |
| R1 (L0-10)              | « une correction éditeur sur un férié n'est pas tracée »                                              | *non dit*  | sans échéance | *aucun* | **orpheline** — É3     |
| R2 (L0-10)              | « la POLITIQUE DE CONSERVATION du journal »                                                           | *non dit*  | sans échéance | *aucun* | **orpheline** — É3     |
| D51                     | « Logo de société … Rien n'est construit aujourd'hui »                                                | à la demande | note n°6 | *aucun*  | acceptable — É4 (rangement) |
| D51                     | « Faut-il viser 7:1 sur l'application terrain … à trancher **avec** le lot de l'application technicien » | **3**    | note n°6 | *aucun*    | **orpheline** — É5         |
| D51                     | « Mesurer le coût du rendu dynamique sur un téléphone en réseau dégradé »                              | **3**      | note n°6 | *aucun*    | **orpheline** — É5         |
| L0-11                   | « Hors périmètre, **au registre** : un client acheteur voudra peut-être son propre vocabulaire »       | *non dit*  | **non**  | *aucun*    | **orpheline** — É4         |
| D17                     | « Si ses limites se révèlent bloquantes au lot 3, l'arbitrage FullCalendar sera repris »               | 3          | non      | *aucun*    | orpheline mineure — É5     |
| D24                     | « ils seront réintroduits quand le volume le justifiera »                                             | *non dit*  | non      | *aucun*    | orpheline mineure          |

### Les conflits différés, nommément

**Le garde de rôle face à `BYPASSRLS` au lot 5 — É1.** Le conflit est réel et il
est **double**, et aucune de ses deux moitiés n'est inscrite au registre.

1. `motifRefusReporting` (`lib/db/garde-role.ts`) **refuse la connexion de
   consolidation quand `BYPASSRLS` manque** : « sans lequel la consolidation
   multi-sociétés ne lirait que la société active — un agrégat silencieusement
   tronqué ». Or le repli de D36 existe précisément pour l'hébergeur **qui ne
   peut pas accorder `BYPASSRLS`**. Le garde refusera donc exactement la
   configuration que le repli est fait pour servir. La décision le dit à moitié
   — « `verifierRoleReporting` refuse la connexion tant que l'attribut manque »
   en contexte, puis « un client qui ne peut pas la franchir aura le repli » en
   conséquence — sans jamais mettre les deux phrases côte à côte.
2. `tests/unit/db/security-definer-sous-arbitrage.test.ts` **échoue sur toute
   fonction `SECURITY DEFINER` apparaissant dans une migration**, liste
   d'exceptions **close et vide**. Le repli de D36 **est** une fonction
   `SECURITY DEFINER`. Le gardien le sait — il nomme D36 comme « le premier » à
   y entrer — mais l'entrée exige un arbitrage, et cet arbitrage n'est écrit
   nulle part comme un travail à faire.

**Conséquence mesurable : la première ligne du repli portable fait passer
`pnpm verify` au rouge, deux fois.** C'est le comportement voulu des deux
gardiens ; ce qui manque, c'est que le lot 5 le sache avant de commencer.

**Le regroupement d'écritures du seed (L0-12) — É6.** Le ticket existe, il est
bien écrit, et son **déclencheur n'existe pas**.

- Il dit : « Déclencheur explicite : le premier **avertissement** de
  `tests/unit/seed-delais.test.ts` ». Ce test n'a aucun niveau d'avertissement :
  il passe ou il **échoue**, et son échec bloque `pnpm verify`. Le déclencheur
  réel est donc plus dur que celui qui est écrit — ce qui est une bonne
  nouvelle, mais pas celle qui est annoncée.
- Le message de cet échec propose « relever `DUREE_MAXIMALE_MS` **en
  connaissance de cause**, ou réduire le nombre d'allers-retours » — dans cet
  ordre. Il recommande donc **en premier** ce que le ticket interdit
  explicitement, et il ne nomme jamais L0-12. La session qui rencontrera le
  gardien lira le remède avant de lire le ticket.
- Le budget est un **décompte tenu à la main** : `allersRetoursTransaction` ne
  compte que la transaction cloisonnée d'une société — `societe`, `calendrier`,
  `calendrier_plage`, `agence`, écarts. Les données de référence que le lot 1
  ajoutera au seed (clients, sites, prestations) **ne le feront pas bouger**
  tant que personne ne revient l'y ajouter. C'est l'enchaînement des listes
  closes du §9, appliqué à un compteur.
- Marge actuelle : **≈ 34 allers-retours sur 240**. Le déclencheur ne se
  déclenchera pas de lui-même pendant les lots 1 à 3.

**L'arrondi au quart d'heure (L2-09) — sans écart.** Registre et ticket se
nomment l'un l'autre : « Avant L2-09 » au registre, « À trancher AVANT d'écrire
ce ticket … inscrite au registre » dans le ticket. **C'est le seul point du
projet correctement câblé des deux côtés, et c'est le patron à recopier.**

**La console éditeur (L7-01, L7-02) — sans écart.** Les deux tickets sont
écrits, avec leur déclencheur et leur ambition bornée. Une seule réserve : R1
(É3) désigne L7-02 comme son déclencheur naturel — c'est là qu'un éditeur
corrigera un férié — sans que L7-02 le sache.

**La conservation du journal (R2) — É3.** Le registre du L0-10 pose lui-même la
règle : « rien ne s'y range sans **échéance ou déclencheur explicite** ». R1 et
R2 n'en ont ni l'un ni l'autre. Pour R2 la voie est arrêtée (détacher des
partitions, ne jamais supprimer) et la **durée** reste à ratifier — le §15
avance « 5 ans », narratif donc non normatif. Le déclencheur naturel est
identifiable : **le provisionnement du premier client**, c'est-à-dire le même
moment que celui que la note n°7 a refusé pour les partitions au motif qu'il
« tombe au pire moment ». Ce qui était vrai d'une migration l'est moins d'une
durée de conservation — mais il faut le dire, pas le supposer.

**Le stockage du logo — É4.** Déclencheur réel (« à la première demande d'un
client »), aucun ticket, ce qui est légitime. Le défaut est de rangement : il
vit dans la table de la note n°6, pas dans le registre qui se dit unique.

**Le 7:1 du terrain — É5.** Échéance **lot 3**, trois voies écrites, et la
décision dit « à trancher **avec** le lot de l'application technicien, pas
après ». Aucun ticket du lot 3 ne le mentionne — ni L3-06 (socle PWA), ni L3-13
(saisie de rapport). Une échéance qui ne se voit pas depuis le ticket qui la
rencontre est une échéance qu'on découvre après.

### É4 — le registre n'est plus unique

La ligne 594 de `docs/arbitrages.md` annonce un « **Registre unique du projet** —
les notes n°1 à n°3 y déposent leurs points ouverts ». Il y a aujourd'hui
**quatre** endroits où se rangent des points ouverts :

1. le registre de la note n°2 (« Ce qui reste à décider, et quand ») ;
2. la table « Ce que la note n°6 ajoute au registre » (logo, 7:1, coût du rendu) ;
3. le « Registre ouvert par le ticket L0-10 » (R1, R2, R3) ;
4. `docs/backlog.md` L0-11, qui écrit « au registre » un point **qui n'est dans
   aucun des trois**.

C'est exactement la maladie que D1 devait éradiquer, sur le registre au lieu des
règles : la même chose écrite à plusieurs endroits, jusqu'à ce que personne ne
sache lequel fait foi. Le point 4 est le plus parlant — il **affirme** un
rangement qui n'a pas eu lieu.

### É7 — le symbole du XPF a un déclencheur qui ne peut pas se déclencher

D43 inscrit la question avec pour déclencheur « la conception du **premier
document destiné à un client** — devis, facture ou rapport d'intervention ».
Or, dans les lots 1 à 3, le seul document produit est le rapport d'intervention
(L3-15), et le ticket porte : « **Aucun montant** sur le rapport [3.8] ». Un
document sans montant ne pose pas la question du symbole monétaire. Le premier
document qui la posera est le **devis** (lot 4) ou le **portail client** (lot 5).
Le déclencheur, tel qu'il est écrit, se lit comme s'il tombait au lot 3 et il n'y
tombe pas.

---

## 2. Tickets périmés

### É8 — neuf règles du chapitre 10 qu'un arbitrage a dit réécrire, et qui ne l'ont pas été

**C'est le plus gros écart du projet, et c'est la leçon de D47 non apprise neuf
fois.** La note n°4 conclut : « **un arbitrage qui corrige un mot doit dire où ce
mot est écrit**, sinon il corrige le glossaire et laisse les règles ». D47 l'a
dit — et RG-PLA-01 et RG-PLA-02 sont, avec RG-DRO-05 ajoutée par D40, les
**seules** lignes du chapitre 10 jamais touchées. Les neuf autres réécritures
annoncées n'ont pas été faites.

| Règle (rang 2) | Ce que le chapitre 10 dit **encore**                              | Décision (rang 1) qui l'a réécrite                                     | Ticket qui la lira |
| -------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------ |
| RG-PAR-02      | « champs obligatoires … limités à : modèle, client, site »          | **D6** : « RG-PAR-02 est réécrite en conséquence » — **quatre** champs    | L2-01              |
| RG-INT-01      | « sauf pour les types « expertise » et « installation » »           | **D16** : « RG-INT-01 est réécrite » — plus **`recensement`**            | L2-07, L2-08       |
| RG-INT-10      | « la même machine et le **même symptôme** »                         | **D25** : « La règle est reformulée sur un critère machine »             | L2-07              |
| RG-IMP-02      | « annulable **intégralement** pendant 24 heures »                   | **D15** : « RG-IMP-02 est réécrite en ce sens » — refus motivé partiel   | L1-08              |
| RG-IMP-05      | « Le code client **Winpro** sert de clé … la ligne est **rejetée** » | **D29** : `code_externe`, « RG-IMP-05 est **assouplie** »                | L1-01, L1-08       |
| RG-DRO-02      | « plus la recherche par QR code sur site »                          | **D22** : « RG-DRO-02 est réécrite » — parc complet des clients à 7 jours | L3-07              |
| RG-DRO-04      | « intervention, contrat, fiche machine, paramétrage société »       | **D32** : « RG-DRO-04 est alignée » sur I8 ; puis **D52** : dix tables    | L2-01, L2-07       |
| RG-CON-03      | « un seul contrat actif à la fois »                                 | **D30** : « RG-CON-03 est précisée » — la garantie coexiste              | lot 4              |
| RG-PLA-05      | « estimé à partir de la zone géographique »                         | **D23** : « RG-PLA-05 est précisée » — `site.temps_trajet_min` fait foi  | L1-02              |

Et le **chapitre 11** (rang 3) porte deux colonnes que des décisions de rang 1
ont supprimées ou renommées :

- `client.code_winpro` — D29 : « `client.code_winpro` **devient**
  `client.code_externe` ». Le §11 l'écrit encore `code_winpro`, et c'est la
  fiche que L1-01 lira.
- `devise.parite_reference` — D20 : « `devise.parite_reference` et
  `devise.parite_date` sont **supprimées** ». Le §11 les liste encore.

**Pourquoi c'est grave et pas seulement inélégant.** La hiérarchie du CLAUDE.md
fonctionne : une session lit le chapitre 10 pour écrire ses tests, et le guide
de pilotage lui dit expressément de le faire (« Relis le §7/M3 … et les règles
RG-INT-01 à RG-INT-11 »). D44 a nommé le mécanisme : « une source de rang 1
qu'on sait fausse est plus dangereuse qu'une source absente. Une source absente
fait poser la question ; une source fausse fait confiance. » Ici la source
fausse est de rang 2, la vraie de rang 1 — l'ordre normal, donc, et pourtant la
session qui écrira « quatre champs » devra désobéir au chapitre 10 pour obéir à
D6.

### É9 — la « forme imposée » de la politique RLS n'est plus unique, et le backlog n'en connaît qu'une

Le ticket L0-04 écrit : « **Forme imposée** :
`societe_id = current_setting('app.societe_id')::uuid OR societe_id IS NULL` ».
Il y a aujourd'hui **trois** formes en vigueur, et la quatrième est en fixture :

| Forme                                                             | Pour                                              | Source        |
| ------------------------------------------------------------------- | ------------------------------------------------- | ------------- |
| `id = app.societe_id`                                               | `societe`                                         | **D42**       |
| `societe_id = app.societe_id`                                       | tables métier                                     | I1            |
| lecture `… OR societe_id IS NULL` / écriture `… AND app_est_role_editeur()` | référentiels de plateforme                | **D4**, I1    |
| `… AND app.client_id AND app.perimetre_sites`                       | `client`, `site`, `machine` (parc, portail)       | **D10**, D22  |

Une session du lot 1 qui recopie « la forme imposée » du backlog pour `client`,
`site` ou `modele_materiel` écrit une politique **fausse dans le sens
permissif** : elle ouvre `societe_id IS NULL` sur une table qui n'a aucune ligne
de plateforme, elle omet le contrôle éditeur en écriture sur celles qui en ont, et
elle perd le filtre portail. C'est le texte de ticket le plus dangereux des
trois lots.

### É10 — critères devenus impossibles, déjà satisfaits, ou contradictoires

| Ticket    | Critère                                                                | Défaut                                                                                                                                                                                                     |
| --------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L2-07** | « tests sur RG-INT-01 à 11 »                                           | **Impossible** sur RG-INT-10 telle que le chapitre 10 l'écrit : D25 dit lui-même que « le même symptôme » n'est pas implémentable sur du texte libre. Un test par règle bute sur la dixième                 |
| **L1-08** | « seul le dernier lot est annulable »                                  | **Contradictoire** avec RG-IMP-02, « annulable intégralement pendant 24 heures ». Et la fenêtre de **24 heures** n'a plus de maison : ni D15 ni L1-08 ne la reprennent, aucun critère ne la vérifie          |
| **L1-05** | « `societe_id` nullable pour les référentiels de plateforme [D4] »     | **Déjà satisfait par construction** — les trois tables sont dans la liste close, et `scripts/lib/rls-declaree.ts` refusera tout autre état. Ce que le ticket ne dit pas, c'est ce qu'il faut vraiment faire : classer les trois tables en `TABLES_RLS_SIMPLE` (RLS **activée, jamais forcée**) et retirer la fixture `modele_materiel` |
| **L1-04** | « Trois tables : `habilitation`, `technicien_habilitation`, `site_habilitation_requise` » | D9 n'accorde `societe_id NOT NULL` qu'à la **première**. Les deux autres tomberont dans **zéro catégorie** de I1 et feront échouer le gardien d'exhaustivité de D41 le jour où elles sont écrites. Même situation pour `import_lot` / `import_lot_ligne` (D15, ticket L1-08) et pour `contact` (L1-03) |
| **L1-10** | « Import de l'historique des ventes matériel — fiches créées avec `complet = false` » | **Ordre impossible** : un ticket du **lot 1** qui a besoin de la table `machine`, créée en **L2-01**. Et cette table entre au périmètre d'audit (I8) au même moment                                     |
| **L3-15** | « contrôle visuel humain obligatoire — aucun test automatique ne remplace ce point » | **Contradictoire** avec le §5.2 du CLAUDE.md (« couverts par au moins un test automatisé »). L'exception est délibérée — le guide §5 la justifie — mais elle n'est nommée comme exception nulle part |

### É11 — le guide de pilotage est resté au 18 août

`docs/guide-pilotage.md` est antérieur à D1 et n'a aucun rang dans la
hiérarchie, mais il est dans `docs/` et sa §4.2 est le patron des prompts de
session. Il porte quatre affirmations que des décisions de rang 1 ont
contredites :

- « les **neuf** invariants » — il y en a dix ;
- « les fériés sont paramétrés par **site** et parfois travaillés » — D5 et D47 :
  **par agence**, et le fait public est territorial (D46) ;
- « Créer une machine depuis le mobile requiert **3 champs** et pas un de plus » —
  D6 : **quatre**, et c'est son exemple de critère vérifiable ;
- « l'annulation **sous 24 heures** » — D15 : partielle et sûre, dernier lot seul.

---

## 3. Déclencheurs échus ou imminents

| Entrée du registre                                         | Déclencheur              | État                                                                                                                                                                                    |
| ---------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **« Qui voit une nuit rouge ? »**                          | **avant le lot 1**       | **ÉCHU — É12.** Rien n'est construit et les deux vérifications demandées n'ont pas été faites                                                                                              |
| **« Au paramétrage réel des agences »** *(L0-08)*          | L0-08                    | **ÉCHU — É13.** L0-08 est livré depuis le 21 août ; le seed porte toujours des valeurs de démonstration, correctement dites comme telles, et personne ne porte la saisie des vraies         |
| « Colonnes exactes de chaque modèle d'import ; montants du catalogue de forfaits » | **Lot 1** | **Imminent.** Rencontré par L1-06, L1-08 et L1-09 — aucun des trois ne le mentionne. Seul le §8 du CLAUDE.md rattrape (« ne jamais inventer de valeur par défaut »)                       |
| « Avant L2-09 — l'arrondi s'applique-t-il à chaque intervention ou au total d'une journée ? » | **Lot 2** | **Imminent et correctement câblé.** Le seul                                                                                                                       |
| D51 — « 7:1 sur l'application terrain » et « coût du rendu dynamique » | **Lot 3**  | **Imminents et invisibles — É5.** Aucun ticket du lot 3 ne les porte                                                                                                                       |
| D17 — « limites de Schedule-X »                            | Lot 3                    | Conditionnel ; L3-01 ne le porte pas                                                                                                                                                       |
| D43 — « symbole du XPF, au premier document client »       | ambigu                   | **É7** — ne peut pas se déclencher au lot 3                                                                                                                                                |
| D46 — fériés infra-nationaux                               | demande client           | Sans écart                                                                                                                                                                                 |

**Et deux déclencheurs qui ne sont pas au registre mais dans le code**, que les
lots 1 et 2 rencontreront à coup sûr :

- `tests/unit/db/perimetre-audit.test.ts` passe au **rouge le jour où `machine`
  est écrite** (L2-01), puis `intervention` (L2-07). C'est voulu — D52 : « une
  table du périmètre présente au schéma sans déclencheur fait échouer la
  vérification **le jour où elle est créée** » — mais ni L2-01 ni L2-07 ne
  l'annoncent, et une session découvrira le journal d'audit par un test rouge.
- `tests/isolation/setup/global.ts` échouera sur `CREATE TABLE "client"` le jour
  où L1-01 crée la vraie table. Voir É14 : l'échec est bruyant, la réparation
  tentante est mauvaise.

---

## 4. Ce que le lot 0 impose au lot 1

**La bonne nouvelle d'abord : l'essentiel est écrit, et à l'endroit qu'une
session lit sans qu'on le lui demande.** Le CLAUDE.md est chargé à chaque
session, et il porte déjà :

| Ce que le lot 1 doit tenir                                    | Où c'est écrit                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| `societe_id NOT NULL` sur toute table métier                   | I1 — et nommément « l'objectif » pour `client`, `site`, `machine`… |
| Chaque table dans exactement une catégorie de I1               | I1, gardien d'exhaustivité (D41) : « zéro échoue, deux échouent aussi » |
| Le périmètre d'audit, clos des deux côtés                      | I8 — depuis D52, une **liste de tables**, avec le lot de chacune       |
| Les montants par `lib/money`, la conversion par `lib/reporting` | I2, I3, §6                                                            |
| Les dates par `lib/calendar`, seul lieu de la date courante     | §6                                                                    |
| Les textes visibles par `lib/i18n/fr.ts`, avec la coupure humain/machine | §5.5                                                        |
| Les **deux** actions référentielles de toute clé étrangère      | §9 (D49)                                                              |
| Une migration se réécrit tant qu'elle n'a pas touché une base réelle | §7                                                               |
| Le README suit le dépôt, dans la même demande de fusion         | §7                                                                    |

**Il ne faudra donc pas le redire à chaque ticket.** Ce qui reste ne l'est pas,
et se concentre en quatre points.

### É14 — le contrat des fixtures d'isolation n'existe que dans des commentaires de test

`client`, `site`, `machine` et `modele_materiel` existent aujourd'hui comme
**tables fixtures** du harnais d'isolation (`tests/isolation/setup/global.ts`),
avec leurs politiques : `politiqueParcSql` porte le filtre portail de D10
(`app.client_id`, `app.perimetre_sites`) et `politiqueCloisonnementSql` porte le
régime des référentiels. Ce sont les chemins que **L0-05 a déclarés
obligatoires** — résolution QR inter-société (D22), accès portail à un autre
client, respect du périmètre de sites.

Cette obligation n'est écrite qu'à deux endroits, tous deux dans `tests/` :
« Quand les vraies tables seront livrées, elles devront honorer ce même contrat,
réutilisant les mêmes constructeurs de politique » (`fixtures.ts`), et l'écart
assumé de `modele_materiel` sur `FORCE` (`force-rls.test.ts`).

**Le risque est précis.** Le jour où L1-01 crée la vraie table `client`, le
harnais échoue bruyamment sur `CREATE TABLE` — et la réparation la plus
naturelle (supprimer la fixture, pointer les scénarios sur la vraie table avec la
politique de société seule) **fait disparaître en silence** les scénarios portail
de D10 et le chemin QR de D22. C'est le seul endroit du dépôt où une réparation
plausible **réduit** la couverture sans qu'aucun gardien ne s'en aperçoive :
les scénarios continueront de passer, sur moins de choses. C'est la vacuité du
§9 sous sa forme la plus difficile à voir — non pas un gardien qui ne regarde
rien, mais un gardien à qui l'on retire ce qu'il regardait.

### É-b — la question d'audit se pose à la création des tables, pas après

I8 est clos des deux côtés : `client`, `site`, `contact`, `prestation`,
`forfait`, `taux_horaire` n'y figurent pas, et le gardien **refusera** un
déclencheur posé sur elles. C'est cohérent, et c'est peut-être faux pour deux
d'entre elles : **`taux_horaire`** (historisé, RG-TAR-04) et **`forfait`**.
Modifier un tarif engage au moins autant qu'une fiche machine, et « qui a changé
ce taux, quand, depuis quelle valeur » est la question qu'un client posera. Le
§9 du 30/08 vaut ici mot pour mot : le seul moment où la reprise coûte zéro est
celui où la table n'existe pas encore. **C'est un arbitrage, pas une décision de
ticket** — I8 ne s'élargit que par arbitrage.

### É-a — aucun gardien sur les actions référentielles

Le §9 dit : « **toute clé étrangère nouvelle dit ses DEUX actions, et les
justifie** ». C'est la leçon de D49, et c'est aujourd'hui de la prose. Le lot 1
posera une trentaine de clés étrangères, et le défaut de Prisma est
`ON UPDATE CASCADE` — exactement la valeur que D49 a mesurée en base comme « une
décision prise par personne », dont l'effet le plus dangereux est celui qui
**réussit** en silence. C'est le seul enseignement du §9 qui soit mécanisable et
qui n'ait pas de gardien : lire les migrations et exiger que chaque
`FOREIGN KEY` porte `ON UPDATE` **et** `ON DELETE` explicites tient en un test
statique, sur le modèle de `perimetre-audit`.

### É6 (suite) — le budget du seed est tenu à la main

`allersRetoursTransaction` porte l'avertissement « doit être relu avec
`seed.ts` » et rien ne le garantit. Le lot 1 ajoutera des données de référence
au seed ; le compteur ne bougera que si quelqu'un s'en souvient.

---

## Récapitulatif des écarts

*Rang = celui de la source à corriger, au sens du §1 du CLAUDE.md. Rien de rang 1
n'a été touché.*

| #       | Écart                                                                  | Rang | Recommandation                                                                                                                                                   |
| ------- | ---------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **É1**  | Deux gardiens du lot 0 refuseront le repli portable de D36              | 1    | **Arbitrage.** Inscrire les deux conflits au registre sous la ligne « Lot 5 », avec leur remède prévu : `motifRefusReporting` doit distinguer *chemin rapide* et *repli*, et D36 doit entrer nommément dans la liste d'exceptions de D50 |
| **É2**  | La journalisation des accès des rôles éditeur (D32) n'a ni lot ni ticket | 1    | **Arbitrage.** Lui donner un lot (7, avec la console) et une ligne au registre ; `EvenementAcces` n'a aucune valeur pour la porter                                  |
| **É3**  | R1 et R2 sont au registre sans échéance ni déclencheur                  | 1    | **Arbitrage.** R1 : déclencheur L7-02. R2 : déclencheur « provisionnement du premier client », et ratifier ou écarter les 5 ans du §15                              |
| **É4**  | Le registre n'est plus unique ; L0-11 dit « au registre » un point absent | 1  | **Arbitrage léger.** Refondre les quatre tables en un registre unique ; y ajouter le vocabulaire client de L0-11                                                    |
| **É5**  | Trois échéances de lot 3 (7:1, coût du rendu, Schedule-X) invisibles     | 1/4  | Les rappeler dans L3-06 et L3-01 — le patron est L2-09, qui nomme le registre depuis le ticket                                                                     |
| **É6**  | Le déclencheur de L0-12 n'existe pas ; le message du gardien conseille le remède interdit | 4 | Réécrire le déclencheur (« le premier **échec** »), et corriger le message de `seed-delais` pour qu'il nomme L0-12 et inverse l'ordre des remèdes. **Ticket, pas cette revue** |
| **É7**  | Le déclencheur du symbole XPF ne peut pas tomber au lot 3               | 1    | **Arbitrage léger.** Le repointer sur le devis (lot 4) ou le portail (lot 5), et noter dans L3-15 que le rapport, sans montant, ne le déclenche pas                 |
| **É8**  | **Neuf règles du chapitre 10 et deux colonnes du chapitre 11 périmées** | 2/3  | **Le plus urgent. Un ticket dédié — « L1-00, aligner les chapitres 10 et 11 sur les arbitrages »** — avant le premier ticket du lot 1. Ce n'est pas un arbitrage : les neuf réécritures sont déjà décidées au rang 1, seule leur application manque. Deux exceptions à trancher : la fenêtre de **24 h** de RG-IMP-02, et la rédaction exacte de RG-DRO-04 depuis D52 |
| **É9**  | Le backlog n'énonce qu'une des trois formes de politique RLS            | 4    | Corriger le texte de L0-04 (ticket livré, texte encore lu) ou écrire les quatre formes dans le CLAUDE.md, au pied de I1                                             |
| **É10** | Six critères impossibles, déjà satisfaits ou contradictoires (L2-07, L1-08, L1-05, L1-04, L1-10, L3-15) | 4 | À reprendre dans le même ticket L1-00, ticket par ticket. L1-10 exige en plus une décision d'ordonnancement : le déplacer au lot 2, ou l'y adosser |
| **É11** | Le guide de pilotage porte quatre affirmations périmées                | —    | Corriger les quatre phrases, ou marquer le document « antérieur aux arbitrages, non normatif ». Il est lu par ceux qui connaissent le moins le projet                |
| **É12** | **« Qui voit une nuit rouge ? » est ÉCHU** (avant le lot 1)             | 1    | **À traiter avant le premier ticket du lot 1.** Faire les deux vérifications demandées, puis donner une adresse à l'alarme — l'ouverture automatique d'une *issue* sur échec nocturne est le mécanisme le moins coûteux. Un garde-fou dont l'alarme sonne dans une pièce vide n'en est pas un |
| **É13** | « Au paramétrage réel des agences » est échu, sans porteur              | 1    | Opération de paramétrage, pas un développement : lui donner une date et un responsable, ou la ranger explicitement au lot 1                                         |
| **É14** | Le contrat des fixtures d'isolation n'existe que dans `tests/`          | 1/4  | **Le plus dangereux du lot 1.** L'écrire au CLAUDE.md (au pied de I1) et dans L1-01, L1-02, L1-05, L2-01 : les vraies tables reprennent `politiqueParcSql` et `politiqueCloisonnementSql`, et les scénarios D10/D22 doivent rester **plus nombreux** après la reprise, jamais moins |
| **É-a** | Aucun gardien sur `ON UPDATE` / `ON DELETE` (§9, D49)                   | —    | Un test statique sur les migrations, à écrire **avant** le premier ticket du lot 1 : c'est là que trente clés étrangères vont être posées                           |
| **É-b** | `taux_horaire` et `forfait` hors périmètre d'audit                      | 1    | **Arbitrage**, à prendre avant L1-06 et L1-07 : I8 ne s'élargit que par arbitrage, et le coût est nul tant que les tables n'existent pas                            |

### Ce qui a été corrigé au passage

Trois écarts triviaux et sans conséquence, dans le seul `README.md` — dont le §7
du CLAUDE.md exige qu'il suive le dépôt :

1. le bloc « Commandes » annonçait `verify:full = verify + test:e2e` ; il vaut
   `verify + feries:horizon + audit:partitions + test:e2e` ;
2. la section « Intégration continue » omettait les deux contrôles des
   partitions du journal ;
3. l'état d'avancement s'arrêtait à **L0-06b** et sautait **L0-06c**.

Rien d'autre n'a été touché. Aucun code, aucune migration, aucune source de
rang 1.

*Revue R0 — CODIPLAN — 31 août 2026*
