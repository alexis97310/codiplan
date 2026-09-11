# CODIPLAN — Note d'arbitrage n°1

**Réponses aux points soulevés par l'audit de la session zéro**

| | |
|---|---|
| **Objet** | Trancher les contradictions, ambiguïtés et trous relevés dans le cahier des charges v1.2 |
| **Statut** | Décisions arrêtées — fait autorité sur le cahier des charges en cas de divergence |
| **Date** | 19 août 2026 |
| **À placer dans** | `docs/arbitrages.md` |

---

## Préambule — validité de l'audit et décision structurelle

L'audit est fondé. Les 60 points relevés sont réels, à deux nuances près signalées plus bas, et il en manquait même un : la note de révision du cahier des charges annonce encore « six lots, 21 semaines », valeur résiduelle de la v1.0 qui aurait dû passer à 25 semaines.

Sa conclusion transverse est la plus importante du document et elle est adoptée telle quelle :

> Le cahier des charges ne se contredit presque jamais sur ses intentions ; il se contredit sur ses formalisations — les mêmes règles reformulées à trois endroits avec des variantes.

### D1 — Hiérarchie des sources

À compter de maintenant, en cas de divergence, l'ordre d'autorité est le suivant :

| Rang | Source | Portée |
|---|---|---|
| 1 | **La présente note d'arbitrage** | Tranche tout conflit |
| 2 | **Chapitre 10 du cahier des charges** — les règles de gestion | Source unique de la règle métier |
| 3 | **Chapitre 11** — le modèle de données | Dérive du chapitre 10, ne le contredit jamais |
| 4 | **Le backlog** | Dérive des chapitres 10 et 11 |
| 5 | Le reste du cahier des charges | Narratif et justificatif, jamais normatif |

Conséquence pratique : **une règle métier ne s'écrit qu'au chapitre 10**. Les autres chapitres y renvoient. Toute règle trouvée ailleurs et absente du chapitre 10 est réputée non normative.

### D2 — Statut de la maquette (point 0.2)

`CODIPLAN_Maquette.html` **ne fait pas foi**. C'est une illustration d'intention, pas une spécification d'interface. Elle est déplacée dans `docs/maquette/` et porte désormais un bandeau le disant.

Deux exceptions, promues au rang de spécification et reprises ci-dessous : la convention de formatage monétaire (D19) et les codes couleur des statuts (annexe D du cahier des charges).

### D3 — Chemins de fichiers (point 0.1)

Arborescence normative, à créer avant toute session :

```
docs/
  cahier-des-charges.md      ← renommé depuis la racine
  arbitrages.md              ← la présente note
  backlog.md                 ← extrait du guide, tickets seuls
  guide-pilotage.md          ← méthode, sans les tickets
  decisions/                 ← un fichier par décision technique
  maquette/CODIPLAN_Maquette.html
```

---

## Gravité 1 — les douze points bloquants

### D4 — Invariant I1 et référentiels partagés (1.1)

**I1 est réécrit :**

> Toute table métier porte `societe_id NOT NULL`, **à l'exception de la liste close des référentiels de plateforme** ci-dessous, qui portent `societe_id NULL` et sont lisibles par toutes les sociétés, modifiables par les seuls rôles éditeur.

**Liste close, exhaustive et fermée** — toute addition exige une décision explicite :

| Table | Justification |
|---|---|
| `devise` | Le franc Pacifique est le même partout |
| ~~`famille_materiel`~~ | ~~Un compresseur est un compresseur~~ — **RETIRÉE le 08/09/2026, voir ci-dessous** |
| ~~`modele_materiel`~~ | ~~Idem, avec possibilité de surcharge par société~~ — **RETIRÉE** |
| ~~`checklist_modele`~~ | ~~Attachée au modèle, suit son régime~~ — **RETIRÉE, par cette justification même** |

**Tout le reste porte `societe_id NOT NULL`** — y compris `prestation` et `forfait`, qui sont commerciaux et donc propres à chaque société.

~~**Mécanique retenue.** Un modèle de plateforme (`societe_id NULL`) est visible par toutes les sociétés. Une société qui veut l'adapter en crée une copie portant son `societe_id` ; la copie masque l'original.~~

> ### AMENDÉ le 08/09/2026 — le mécanisme est RETIRÉ, pas arbitré (ticket L1-05)
>
> **Cette décision se contredisait**, et la contradiction a été mesurée à l'ouverture de L1-05 :
>
> | D4 dit | D4 dit aussi | Incompatible parce que |
> |---|---|---|
> | ces tables sont « modifiables par les seuls **rôles éditeur** » | « une **société** qui veut l'adapter en crée une copie » | une société qui ne peut pas écrire ne peut pas créer de copie |
> | clause `societe_id = app.societe_id OR societe_id IS NULL` | forme « référentiel » du CLAUDE.md = lecture `USING (true)` | ce ne sont pas la même clause : sous la seconde, **la copie de A est lisible par B** |
>
> Et un troisième point, qui n'est pas une contradiction mais un **manque** : « la copie masque l'original » est une règle de **SÉLECTION**, pas de visibilité par ligne. RLS filtre des lignes ; il ne sait pas dire « cache X parce que Y existe ». Rien n'avait jamais dit où cette règle vivrait.
>
> **Une contradiction interne dans une décision de rang 1 signale qu'elle a été écrite avant que quiconque essaie de l'appliquer.** L'exploitation retire donc le mécanisme plutôt que d'arbitrer entre ses moitiés.
>
> **`famille_materiel`, `modele_materiel` et `checklist_modele` sont des tables MÉTIER cloisonnées**, `societe_id NOT NULL`, forme « société ». La liste close des référentiels de plateforme devient : `devise`, `parite`, `jour_ferie`. `checklist_modele` n'existe pas encore et sort par la justification que D4 lui donnait — « attachée au modèle, suit son régime » : elle naîtra cloisonnée.
>
> **La raison, et c'est la quatrième fois que ce dépôt tranche dans ce sens** — zones géographiques (L1-02), rôles de contact (L1-03), habilitations (D60), et ici : *une nomenclature partagée fige un territoire dans un produit destiné à être vendu ailleurs.* Et une raison de plus, propre à celle-ci : **chez CODIMA les modèles ne viendront pas d'un catalogue d'éditeur mais de leur propre fichier de suivi** — équipement, marque, modèle, numéro de série. Ce sont des données saisies, pas un référentiel reçu.
>
> **Une conséquence disparaît avec le mécanisme**, et elle avait été mesurée avant d'être évitée : L2-01 rend `modele_id` obligatoire sur une machine. Sous le masquage, une société qui copiait un modèle laissait ses machines déjà créées pointer vers un modèle que sa propre société ne voyait plus.
>
> **Un effet de bord mesuré, et écrit plutôt que tu** : après ce retrait, **plus aucun référentiel de plateforme ne porte de colonne `societe_id`** — `devise`, `parite` et `jour_ferie` n'en ont pas. La phrase de I1 « `societe_id` NULL **ou pas de `societe_id` du tout** » reste vraie, mais sa première moitié n'a plus aucun exemplaire. La branche du gardien qui la reconnaît survit à son dernier cas, et `tests/unit/db/categories-i1.test.ts` porte le témoin qui le dit.
>
> **Le catalogue de plateforme, s'il existe un jour, sera un AMORÇAGE** — comme la liste réglementaire des habilitations (D60) : posé à l'ouverture d'une société, complété ou réduit par elle, et aucune migration le jour d'un nouveau territoire.

**Le critère d'acceptation de L0-04 est corrigé** : « une requête sans société positionnée retourne zéro ligne **sur les tables cloisonnées**, et uniquement les référentiels de plateforme sur les tables partagées ».

### D5 — Agences (1.2)

**Ducos, Koné et Dolbeau sont des agences CODIMA, pas des sites clients.** L'audit a raison, et le cahier des charges est fautif de les appeler « sites ».

**Création de la table `agence`** — elle manquait :

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| societe_id | uuid FK NOT NULL | |
| code, libelle | text | DUCOS, KONE, DOLBEAU |
| adresse | jsonb | |
| fuseau_horaire | text | Hérité de la société, surchargeable |
| calendrier_id | uuid FK | Son calendrier d'ouverture |
| actif | boolean | |

**Vocabulaire imposé, à corriger partout :** « agence » désigne un établissement CODIMA ; « site » désigne un lieu d'intervention chez un client. Ces deux mots ne sont jamais interchangeables. Le glossaire est complété en ce sens.

Le gardien `tests/unit/calendar/` porte donc sur **`agence`**.

### D6 — Champs obligatoires à la création d'une machine (1.3)

**Quatre champs obligatoires**, et non trois — le guide se trompait :

`modele_id`, `client_id`, `site_id`, `numero_serie`.

**RG-PAR-02 est réécrite en conséquence.** Le numéro de série redevient obligatoire, ce qui rend RG-PAR-01 définissable et supprime le risque de doublons silencieux au recensement.

**Cas du numéro illisible ou absent** — il existe, la maquette le montrait déjà. Le technicien saisit `SN-INCONNU-<référence interne>`, ~~valeur unique par construction~~ **valeur unique par CONTRAINTE** *(précisé le 10/09/2026 — mesuré : `reference_interne` est SAISIE, texte libre facultatif dans `lib/machines/saisie.ts`, jamais engendrée ni importée ; une valeur saisie par un humain n'est unique par aucune construction)*, et la machine est marquée `complet = false`, ce qui la fait remonter dans la file de complétion. Un contrôle d'unicité SQL classique suffit, sans NULL et donc sans trou.

**Localisation et photo de plaque restent facultatives.** Le cahier des charges les listait comme obligatoires au §8.1 et §13.3 : ces deux passages sont désormais non normatifs (voir D1).

**`reference_interne` est unique PAR SOCIÉTÉ ET LORSQU'ELLE EST PRÉSENTE** *(décision d'exploitation du 09/09/2026, inscrite le 10/09)*. Toutes les machines n'en ont pas ; deux machines d'une même société n'en partagent jamais une. Le chapitre 11 le disait — « unique par société » — et la ligne avait été barrée entière à L2-01 en corrigeant « porté par le QR » ; la moitié vraie est restaurée. **La contrainte n'est pas encore posée** : l'exploitation a demandé la mesure de l'origine de la valeur AVANT la migration — elle est rendue au registre du 10/09, avec l'index partiel prêt à poser.

**Règles amendées :** RG-PAR-02

### D7 — Identifiants en création hors ligne (1.4)

**Amendé par D71.**

C'est le point le plus profond de l'audit. Décision :

**Séparation stricte de la clé technique et du numéro affiché.**

- **Clé technique** : `id` UUID v7, généré sur l'appareil, y compris hors ligne. C'est elle qui porte toutes les relations, la synchronisation et le `qr_token`.
- **Numéro affiché** : `numero`, `NULL` tant que l'enregistrement n'a pas été synchronisé. Attribué **côté serveur**, séquentiellement par société, à la première synchronisation réussie.
- **Affichage hors ligne** : tant que `numero` est nul, l'interface affiche `Local-<6 derniers caractères de l'UUID>`, avec une pastille « non synchronisé ».

**Cas de l'étiquette QR posée hors ligne.** Le QR encode le `qr_token`, ~~dérivé de l'UUID~~ **TIRÉ AU SORT** *(amendé par D71 — voir ci-dessous)*, jamais le numéro affiché. L'étiquette reste donc valide quel que soit le numéro attribué ensuite. Deux régimes possibles pour l'impression :

- planches de QR pré-imprimées, avec des jetons pré-générés et téléchargés sur l'appareil avant le départ — recommandé pour les campagnes de recensement ;
- impression à la demande sur imprimante portable, à partir du jeton local.

Ce mécanisme s'applique à l'identique aux interventions, demandes et rapports.

**D7 SE CONTREDISAIT, et D71 le répare** *(09/09/2026)*. Les deux moitiés ci-dessus sont incompatibles : « dérivé de l'UUID » exige que le jeton se calcule depuis l'`id`, et « jetons **pré-générés** et téléchargés sur l'appareil **avant le départ** » exige qu'il existe **avant** la machine. *Un jeton pré-généré avant le départ ne peut pas être dérivé de l'identifiant d'une machine qui n'existe pas encore.* La seconde moitié est celle dont l'usage réel a besoin — le recensement en série —, et c'est celle qui reste. **Amendé par D71.**

### D8 — Cycle de vie de l'intervention (1.5)

**Décision en trois parties.**

**1. Séparation des deux axes.** Le statut d'avancement et le statut de facturation sont deux colonnes distinctes. Le modèle de données a raison, le diagramme a tort. La chaîne d'états s'arrête à `CLOTUREE` ; `A_FACTURER` et `FACTUREE` disparaissent de `statut` et vivent uniquement dans `statut_facturation`.

**2. Énumération arrêtée** — huit valeurs pour `statut`, alignées sur l'annexe D qui devient normative :

`A_PLANIFIER`, `PLANIFIEE`, `AFFECTEE`, `EN_COURS`, `SUSPENDUE`, `TERMINEE`, `CLOTUREE`, `ANNULEE`

`ENVOYEE` est renommé **`AFFECTEE`** (voir 3.6) : le mot décrivait mal l'état.

`BROUILLON` et `REPORTEE` sont supprimés : le premier fait doublon avec `demande`, le second n'est qu'un retour à `A_PLANIFIER`. Un statut `RAPPORT_A_VALIDER` n'est pas nécessaire — c'est un état du rapport, pas de l'intervention, et `rapport.statut` le porte déjà.

**3. Matrice des transitions autorisées** — elle manquait, la voici :

| Depuis \ Vers | A_PLANIFIER | PLANIFIEE | AFFECTEE | EN_COURS | SUSPENDUE | TERMINEE | CLOTUREE | ANNULEE |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **A_PLANIFIER** | — | ● | | | | | | ● |
| **PLANIFIEE** | ● | — | ● | ● | | | | ● |
| **AFFECTEE** | ● | ● | — | ● | | | | ● |
| **EN_COURS** | | | | — | ● | ● | | ● |
| **SUSPENDUE** | ● | ● | | ● | — | | | ● |
| **TERMINEE** | | | | ● | | — | ● | |
| **CLOTUREE** | | | | | | | — | |
| **ANNULEE** | | | | | | | | — |

`SUSPENDUE` retrouve ses sorties vers `A_PLANIFIER`, `PLANIFIEE` et `EN_COURS` — l'audit a raison, une attente de pièce de quatre mois doit pouvoir revenir au planning. `TERMINEE → EN_COURS` couvre la réouverture pour correction. `CLOTUREE` est terminal.

**Gardes conservées** : RG-INT-02 sur `→ TERMINEE`, RG-INT-03 et RG-INT-04 sur `→ CLOTUREE`.

**Facturation** : `statut_facturation` passe à `a_facturer` automatiquement à l'entrée en `CLOTUREE`, sauf si le type est `garantie`, `recensement` ou si l'intervention est couverte par un contrat forfaitaire — auquel cas `non_facturable`.

### D9 — Habilitations par site (1.6)

**Trois tables, la structure manquait entièrement :**

- `habilitation` — référentiel : code, libellé, durée de validité, `societe_id NOT NULL`
- `technicien_habilitation` — instance datée : technicien, habilitation, date d'obtention, date d'expiration
- `site_habilitation_requise` — exigence : site, habilitation, bloquant oui/non

**RG-PLA-04 est précisée :** l'affectation est **bloquée** si le site exige une habilitation marquée bloquante que le technicien n'a pas, ou dont la date d'expiration est antérieure à la date d'intervention. Une exigence non bloquante produit un avertissement.

**Le ticket L1-04 est corrigé** : il disait « signalée », la règle dit « bloquée ». La règle l'emporte.

**Règles amendées :** RG-PLA-04

### D10 — Rattachement des comptes portail (1.7)

**Amendé par D79.**

**Table `utilisateur_client`**, qui manquait :

| Colonne | Type |
|---|---|
| utilisateur_id | uuid FK |
| client_id | uuid FK |
| societe_id | uuid FK |
| ~~perimetre_sites~~ | ~~uuid[] — vide = tous les sites du client~~ *(amendé le 07/09/2026 par le ticket L1-02b, marqué le 10/09, **numéroté D79 le 11/09** : PostgreSQL ne sait pas contraindre les éléments d'un tableau — remplacée par la table `utilisateur_client_site`, forme « habilitation »)* |
| actif | boolean |

Un compte portail n'a **aucune entrée** dans `utilisateur_societe` : les deux tables sont exclusives. La politique RLS du portail filtre sur `client_id`, et sur `site_id` si `perimetre_sites` est renseigné.

**Cette table est créée au lot 0**, pas au lot 5 : sans elle, la politique RLS est incomplète et les tests d'isolation ne couvrent pas le scénario 9.

### D11 — Formule de valorisation (1.8)

**Amendé par D77.**

Décisions arrêtées, sur la base de vos réponses :

| Point | Décision |
|---|---|
| **Arrondi** | Au **quart d'heure supérieur**, appliqué au total par technicien et par intervention, jamais ligne par ligne |
| **Où vit l'arrondi** *(D45)* | Au **module de valorisation** (L2-09), jamais dans `lib/calendar` ni dans `lib/money` : c'est une politique de facturation, pas une question de temps |
| **Multi-techniciens** | **Cumul** — 2 techniciens × 3 h = 6 h facturées |
| **Temps d'attente** | **Non facturé** par défaut, `facturable = false` ; le responsable peut le basculer à `true` avec motif |
| **Trajet** | Non facturé au temps ; couvert par le forfait de déplacement de la zone. En l'absence de forfait applicable, non facturé |
| **Heures excédentaires** | Comptées sur le seul temps d'intervention, hors trajet et hors attente, ~~par rapport à `forfait.heures_incluses`~~ *(amendé le 09/09/2026 par la question Q4, marquée le 10/09, **numérotée D77 le 11/09** : la colonne est RETIRÉE — un forfait s'ajoute TOUJOURS aux heures, la notion d'heure incluse n'existe plus ; voir L1-06)* |
| **Multi-machines** | **Un seul forfait de déplacement par intervention**, quel que soit le nombre de machines. Les forfaits de prestation, eux, sont par machine |
| **Ordre de calcul** | forfaits applicables → heures excédentaires au taux horaire → majoration hors ouverture → total HT |

*Ce que ce tableau ne tranche pas, et qu'il faudra trancher avant L2-09 :* « au total par technicien et par intervention » règle l'agrégation **à l'intérieur** d'une intervention — les lignes ne s'arrondissent pas une à une. Il ne dit rien de **plusieurs interventions dans la même journée**. Question ouverte D45, inscrite au registre « Ce qui reste à décider ».

### D12 — Majoration hors horaires (1.9)

| Point | Décision |
|---|---|
| **Taux** | **+50 %** |
| **Assiette** | **Main-d'œuvre seule** — ni les forfaits, ni les pièces |
| **Priorité** | Le taux du **contrat** l'emporte sur celui de la **société**. Aucun taux au niveau du site |
| **Calendrier de référence** | Celui de l'**agence du technicien** (voir D13) |
| **Intervention à cheval** | **Au prorata**, quart d'heure par quart d'heure |

### D13 — Calendrier de référence (1.10)

**Amendé par D46.**

C'est le point qui conditionne le gardien calendrier. Décision, par usage :

| Usage | Calendrier de référence |
|---|---|
| **Heures ouvrées des SLA** | Agence de l'intervention |
| **Majoration hors ouverture** | Agence du technicien |
| **Détection de conflit à la pose** | Calendrier de travail du technicien |
| **Contrôle « site fermé »** | Horaires du site client — avertissement, jamais blocage |
| **Jours ouvrés des indicateurs** | Agence, agrégé par société |

**Accusé de réception sous 30 minutes : en heures ouvrées de l'agence.** Une demande déposée sur le portail un dimanche à 22 h déclenche son compteur à l'ouverture du lundi. L'audit avait raison de poser la question — la réponse inverse aurait généré des alertes toutes les nuits.

**Jours fériés (3.3)** : portés par le **calendrier**, lui-même rattaché à l'agence. Héritage depuis la société avec surcharge possible par agence. Un férié porte un booléen `travaille`.

### D14 — Portée de `pnpm verify` (1.11)

**Amendé par D78.**

**Deux portes, pas une :**

```bash
pnpm verify        # format:check + typecheck + lint + test + test:isolation + build
                   # porte de sortie de CHAQUE ticket
                   # (`format:check` y est entré le 02/09/2026 — incident de la
                   #  porte qui ne gardait pas ce que garde la suivante, §9 ;
                   #  marqué ici le 10/09, NUMÉROTÉ D78 le 11/09)
pnpm verify:full   # verify + test:e2e (dont le gardien hors-ligne)
                   # porte de sortie de CHAQUE LOT, et exécution nocturne en CI
```

Faire payer Playwright à chaque ticket ralentirait tout pour un bénéfice marginal — le hors-ligne ne casse pas en modifiant un écran de référentiel. Mais un lot ne peut pas être déclaré terminé sans `verify:full` vert.

**La CI est GitHub Actions** — cela manquait au CLAUDE.md. `verify` à chaque commit, `verify:full` sur la branche principale et chaque nuit.

### D15 — Sémantique de l'annulation d'import (1.12)

| Cas | Décision |
|---|---|
| Ligne créée par l'import, modifiée depuis | **L'annulation est refusée** pour cette ligne, et le rapport le signale. Les autres lignes du lot sont annulées |
| Ligne créée par l'import, référencée depuis (une machine rattachée à un client importé) | **Refus d'annuler** cette ligne. Jamais de suppression en cascade |
| Deux imports se recouvrant | *(retirée par D54)* — chaque ligne est jugée sur elle-même : celles qu'un import ultérieur a touchées sont refusées avec leur motif, les autres sont annulées |
| Modifications apportées par l'import | Restauration des valeurs antérieures, conservées dans `import_lot_ligne.valeurs_avant` |

**Principe :** l'annulation est **partielle et sûre** plutôt que totale et destructrice. Le rapport d'annulation liste exactement ce qui a été restauré et ce qui ne pouvait pas l'être. RG-IMP-02 est réécrite en ce sens — « annulable intégralement » devient « annulable, avec refus motivé sur les lignes modifiées ou référencées depuis ».

**Amendé par D54.**

La ligne « Deux imports se recouvrant » disait : « Seul **le
dernier lot** est annulable. Annuler un lot antérieur est refusé » — rédaction
d'origine conservée ici, un amendement qui efface sa trace se rejoue au prochain
doute *(méthode de D44)*. Elle est retirée, comme la fenêtre de 24 heures de
RG-IMP-02, pour la raison exposée en D54 : le critère ligne à ligne que cette
décision même institue mesure directement ce que ces deux bornes approchaient.

**Règles amendées :** RG-IMP-02

---

## Gravité 2 — décisions structurantes

### D16 — Machine obligatoire et recensement (2.1)

**RG-INT-01 est réécrite :**

> Une intervention est rattachée à un client et à un site. Elle porte au moins une machine, **sauf pour les types `expertise`, `installation` et `recensement`**.

Le parcours P2 redevient cohérent : l'intervention de recensement est créée sans machine, et les machines créées pendant la visite lui sont rattachées au fur et à mesure.

**Règles amendées :** RG-INT-01

### D17 — Composant calendrier (2.2)

**Schedule-X**, gratuit et sous licence libre. Aucune dépendance payante en V1.

Si ses limites se révèlent bloquantes au lot 3 — c'est possible sur la vue ressources multi-techniciens —, l'arbitrage FullCalendar sera repris à ce moment-là, avec le coût connu et une raison précise. Pas avant.

Le CLAUDE.md est corrigé : « pas de librairie UI supplémentaire » devient « pas de librairie UI supplémentaire **hors composant calendrier** ».

### D18 — Briques d'infrastructure (2.3)

Trois choix arrêtés, tous à palier gratuit suffisant pour la V1 :

| Brique | Choix | Pourquoi |
|---|---|---|
| **Stockage objet** | Le stockage intégré de l'hébergeur, S3-compatible | Aucun compte supplémentaire, URL signées natives |
| **Email transactionnel** | Resend | Palier gratuit largement suffisant, intégration simple |
| **File de jobs** | Table PostgreSQL + tâche planifiée | Le volume ne justifie pas un service dédié. On ne complexifie que si la charge l'exige |

Ils sont ajoutés à la stack imposée du CLAUDE.md, ce qui lève l'obligation de s'arrêter du §8.

### D19 — Formatage monétaire (3.1, 3.2)

**Convention :** symbole si la devise en a un, code sinon. `100,00 €` et `7 000 XPF`. C'est ce qu'appliquait la maquette, et c'est promu au rang de règle. *(Le symbole du XPF — `XPF` ou `F` — est une question ouverte depuis D43 : elle sera tranchée à la conception du premier document destiné à un client, et toute réponse autre que `XPF` sera un **amendement de cette décision**. Voir le registre « Ce qui reste à décider ».)*

**Amendé par D44.**

**Frontière de conversion (3.2)** — ***amendée le 21 août 2026 par D44.*** Les deux fonctions sont nommées sans ambiguïté et **ne vivent pas dans le même module** :

- `formatMoney(montant, devise)` — dans **`lib/money`**, jamais de conversion, utilisable partout ;
- `convertForConsolidation(montant, deviseSource, deviseCible, dateParite)` — dans **`lib/reporting`**, réservée aux agrégats, refuse d'être appelée sur un montant unitaire, et **exige une date de parité explicite**.

Aucune autre fonction de conversion n'existe. Un test du gardien monétaire vérifie qu'aucun appel à `convertForConsolidation` n'existe hors de `lib/reporting`.

*Rédaction d'origine, conservée pour mémoire : « `lib/money` expose deux fonctions distinctes ». Elle logeait la conversion dans `lib/money`, contre l'invariant I2 et le §6 du CLAUDE.md qui disent l'un et l'autre `lib/reporting`. Corrigée plutôt que contournée — voir D44.*

### D20 — Table des parités (2.6)

`devise.parite_reference` et `devise.parite_date` sont **supprimées**. Nouvelle table `parite` : `devise_code`, `date_effet`, `taux`, `source`.

**Date de conversion retenue : la date de clôture de la période analysée.** Un comparatif N/N-1 utilise donc la parité de fin de chaque période, ce qui rend le comparatif reproductible — c'est la propriété qui compte, davantage que l'exactitude économique.

### D21 — Vue consolidée et rôles éditeur (2.7)

**Décision :** un rôle PostgreSQL distinct, `codiplan_reporting`, disposant de `BYPASSRLS`, utilisé **exclusivement** par les fonctions d'agrégation multi-sociétés de `lib/reporting`, et par rien d'autre.

Trois garde-fous, sans lesquels ce rôle serait une porte dérobée :

1. Il n'a que le droit `SELECT`, sur aucune table portant de données personnelles détaillées.
2. Toute requête passant par lui est journalisée avec l'utilisateur d'origine — **par l'APPLICATION, sur sa propre connexion (`codiplan_app`), AVANT la requête de consolidation, et jamais par le rôle de consolidation** *(précisé le 10/09/2026)*. Sans cette précision, les garde-fous 1 et 2 se contredisaient : journaliser est une écriture, et un rôle qui n'a que `SELECT` ne peut pas l'écrire. Mesuré : `lib/reporting/connexion.ts` écrit `journal_acces` par `avecDesignationAuth(clientApplicatif)` avant d'ouvrir la connexion de consolidation, et le rôle de consolidation reçoit `permission denied` sur un `INSERT` dans `journal_acces` — un scénario le tient. D38 reste vraie telle quelle.
3. Un test d'isolation vérifie qu'aucun chemin applicatif hors `lib/reporting` n'utilise cette connexion.

**Les rôles éditeur (§22.5) suivent le même mécanisme** et sont créés dès le lot 0 dans l'énumération des rôles, même si la console éditeur n'arrive qu'au lot 7. L'audit a raison : la dette se prend au lot 0.

### D22 — Périmètre du technicien et QR (2.8)

**RG-DRO-02 est réécrite** pour lever la contradiction :

> Un technicien accède aux machines des interventions qui lui sont ou lui ont été affectées, **et à l'intégralité du parc des clients chez qui il a une intervention planifiée dans les 7 jours**, plus la résolution par QR code.

C'est ce que la PWA met en cache, et c'est indispensable au recensement. La restriction reste réelle : il ne voit pas le parc des clients qu'il ne visite pas.

**Résolution QR (sous-question de l'audit, excellente) :** `qr_token` est unique globalement, mais `GET /machines/qr/{token}` **vérifie côté serveur que la machine appartient à la société active** et refuse sinon. Un test d'isolation dédié couvre ce chemin — c'était effectivement un contournement possible du filtre société.

**Règles amendées :** RG-DRO-02

### D23 — Zones géographiques (2.9)

Énumération arrêtée : `grand_noumea`, `sud`, `cote_est`, `cote_ouest`, `nord`, `iles`.

**Temps de trajet :** la valeur saisie dans `site.temps_trajet_min` fait foi quand elle existe ; l'estimation par zone n'est qu'un défaut quand elle est absente. RG-PLA-05 est précisée en ce sens.

**Amendé par D56.**

**Règles amendées :** RG-PLA-05

### D24 — Validation des rapports (2.10)

**Validation systématique en V1.** Les modes « échantillonnage » et « au-delà d'un seuil » sont retirés du périmètre — ils seront réintroduits quand le volume le justifiera, avec des paramètres décidés à ce moment-là.

RG-INT-03 reste donc simple et testable : pas de clôture sans rapport `valide`.

### D25 — Retour sous 30 jours (2.11)

L'audit a raison : « le même symptôme » n'est pas implémentable sur du texte libre. **La règle est reformulée sur un critère machine :**

> RG-INT-10 — Une intervention de type `curatif` sur une machine ayant déjà fait l'objet d'une intervention `curatif` **clôturée** dans les 30 jours calendaires précédents est marquée `retour = true` et remonte au suivi qualité.

Le symptôme disparaît du critère. Les visites préventives ne comptent pas. Le point de départ est la **date de clôture** de l'intervention antérieure. C'est plus large que l'intention initiale, mais c'est déterministe, donc testable — et un faux positif coûte moins qu'une règle inapplicable.

**Règles amendées :** RG-INT-10

### D26 — Internationalisation (2.12)

**Français en dur en V1.** `societe.langue` est conservée au modèle mais **non exploitée** — elle documente une intention, pas une fonctionnalité.

Une seule contrainte imposée au code, qui coûte zéro maintenant et évite la réécriture plus tard : **aucune chaîne visible par l'utilisateur n'est écrite en dur dans un composant**. Toutes passent par un module `lib/i18n/fr.ts` exportant un dictionnaire plat. Ajouter une langue reviendra à ajouter un fichier, pas à parcourir 200 composants.

### D27 — Conflit de synchronisation sur le statut (2.13)

L'invariant I5 est complété, le statut lui manquait :

> **Le statut suit une règle de préséance, pas une règle de camp.** L'ordre de priorité est : `ANNULEE` (back-office) > `CLOTUREE` > `TERMINEE` > `EN_COURS` (terrain) > `SUSPENDUE` > les statuts de planification.

Cas concret de l'audit : l'ADV annule pendant que le technicien réalise l'intervention hors ligne. `ANNULEE` l'emporte, **mais** le travail du technicien n'est jamais perdu — temps, diagnostic, photos et signature sont enregistrés sur l'intervention annulée, et le conflit est signalé au responsable pour arbitrage commercial. Une intervention annulée qui porte un rapport signé est une anomalie qui doit être vue par un humain, pas résolue par une règle.

### D28 — Fusion des doublons (2.14)

**Procédure arrêtée :**

- La fiche **la plus ancienne par date de création** survit et conserve son `numero` et son `qr_token`.
- La fiche absorbée passe au statut `fusionnee`, conserve son `qr_token` qui **redirige** vers la survivante — l'étiquette déjà collée reste donc valide, c'était le point critique.
- Interventions, relevés et documents des deux fiches sont rattachés à la survivante, dans un historique unique trié par date.
- Les divergences de champs — modèle différent, localisation différente — sont présentées côte à côte, l'humain choisit champ par champ.
- L'opération est journalisée et **réversible pendant 30 jours**.

Le ticket L3-10 est étendu en conséquence : il ne couvrait que le signalement.

**`fusionnee` entre dans `StatutMachine` le 10/09/2026** — l'énumération avait été fermée à L2-01 à cinq valeurs sans relire cette décision, et le rang 1 l'emporte. **Ce que la valeur veut dire, et qui l'écrira, écrit ici pour qu'elle ne s'implémente pas de travers :** c'est l'état TERMINAL de la fiche absorbée — elle sort du parc actif, des contrats et des échéanciers comme `remplacee` et `ferraillee` (RG-PAR-05), elle conserve son `qr_token`, et la résolution d'un QR qui la désigne rend la SURVIVANTE. Son seul PRODUCTEUR est la fusion de L3-10 (lot 3) ; ses LECTEURS sont la résolution QR (`lib/machines/resolution.ts`, à amender à L3-10) et les listes du parc, qui l'excluent. La réversibilité de 30 jours rend à la fiche son statut d'avant. **Jusqu'à L3-10, rien ne la produit et rien ne la lit** — même situation que `heures_incluses_minutes` ; si l'exploitation préfère amender D28 plutôt que porter une valeur sans producteur pendant un lot, c'est inscrit au registre.

**LE PRODUCTEUR EST NOMMÉ, et ce n'est pas un ticket : c'est un FAIT DE CONSTRUCTION DU PARC** *(décision d'exploitation du 11/09/2026 — elle ferme la question ouverte au registre)*. La valeur n'est pas orpheline en attendant L3-10 ; ce qui manquait était de dire **d'où viendront les doublons**, et la réponse est dans la manière même dont ce parc se remplit : **il se construit par DEUX chemins indépendants qui ne se connaissent pas.**

| Chemin | Ce qu'il crée | Ce qu'il ignore de l'autre |
|---|---|---|
| l'**import de masse** — L1-10, l'historique des ventes matériel, fiches `complet = false` | une fiche par ligne du fichier de suivi | il ne sait pas si la machine a déjà été recensée sur le terrain |
| le **recensement** — `SourceCreationMachine.recensement`, D16 et les planches de jetons de L2-02 | une fiche par machine trouvée devant soi | le technicien ne peut pas savoir si le fichier la portait déjà, et **hors ligne il ne peut rien vérifier** (I4) |

**La même machine sera donc saisie deux fois** — une fois par le fichier, une fois devant elle — et ce n'est pas une erreur d'exploitation à prévenir : c'est la conséquence arithmétique d'un parc alimenté des deux côtés. *La DÉDUPLICATION du parc est donc l'usage réel de la fusion*, et elle est ce qui écrit `StatutMachine.fusionnee`. **Le producteur existe avant le ticket qui le code** ; ce que L3-10 livrera est l'écran et la mécanique de cette déduplication, pas le besoin.

*Deux conséquences, écrites pour L3-10 plutôt que redécouvertes :* la fiche du **fichier** est presque toujours la plus ancienne par date de création, donc **c'est elle qui survit** et la fiche du terrain qui est absorbée — or c'est la fiche du terrain qui porte le `qr_token` de l'étiquette réellement collée sur la machine. La règle du `qr_token` conservé qui redirige n'est donc pas un raffinement : **c'est elle qui rend la déduplication praticable sans réétiqueter le parc.** Et le cas majoritaire de divergence sera `numero_serie` — `SN-INCONNU-<référence>` côté terrain (D6) face au numéro exact du fichier —, ce qui est très exactement le champ que la présentation côte à côte doit faire choisir en premier.

### D29 — Code Winpro (2.15)

L'audit a parfaitement raison : nommer une colonne d'après l'ERP d'un seul client dans un produit destiné à la vente est un défaut de conception.

**`client.code_winpro` devient `client.code_externe`**, avec `societe.libelle_code_externe` pour l'affichage — « Code Winpro » chez CODIMA, autre chose ailleurs.

**RG-IMP-05 est assouplie :** en l'absence de code externe, la ligne n'est plus rejetée. Le rapprochement se fait sur le code externe s'il existe, à défaut sur la raison sociale normalisée, et en cas d'ambiguïté la ligne part en **rejet pour arbitrage humain** plutôt qu'en création silencieuse d'un doublon.

Un client créé directement dans CODIPLAN sans code externe est donc rapproché par raison sociale au prochain import, ou signalé.

**Règles amendées :** RG-IMP-05

### D30 — Contrat de garantie (2.16)

**RG-CON-03 est précisée :**

> Une machine ne peut être couverte que par un seul contrat actif **de type commercial** à la fois. Un contrat de type `garantie` peut coexister avec un contrat commercial.

**« Actif » est défini** : le contrat a le statut `actif` **et** la date du jour est comprise dans la fenêtre `contrat_ligne.date_entree` / `date_sortie`.

**Règles amendées :** RG-CON-03

### D31 — Formats des imports Excel (2.17)

Décisions de mécanique, les colonnes elles-mêmes étant définies ticket par ticket au lot 1 :

- **Version du format** : cellule `A1` contenant `CODIPLAN-<type>-v<n>`, contrôlée avant lecture. Un fichier d'une version antérieure est reconnu et refusé avec un message explicite.
- **En-têtes** en ligne 2, données à partir de la ligne 3.
- **Dates** au format `JJ/MM/AAAA`, seul format accepté.
- **Nombres** : séparateur décimal virgule, aucun séparateur de milliers.
- **Encodage** : `.xlsx` uniquement, pas de CSV — cela supprime toute la classe des problèmes d'encodage et de séparateur.
- **Colonnes inconnues** : ignorées avec avertissement, jamais bloquantes.

### D32 — Journal d'audit (2.5)

L'audit a raison : un intercepteur Prisma ne rend rien inaltérable. Décision en trois points.

**Protection réelle.** Le journal est écrit par un **trigger PostgreSQL**, pas par la couche applicative. Les droits `UPDATE` et `DELETE` sur la table `journal_audit` sont révoqués pour le rôle applicatif. C'est ce qui donne un sens au mot « inaltérable ».

**Amendé par D52, D53, D55.**

**Périmètre unifié** — I8 et RG-DRO-04 divergeaient. Le périmètre retenu est celui de I8 : `intervention`, `contrat`, `machine`, paramétrage société, compte client. RG-DRO-04 est alignée dessus.

**Audit des lectures.** L'exigence du §15 — « toute consultation de données client par un utilisateur interne est journalisée » — est **réduite** : seuls sont journalisés les accès des **rôles éditeur** aux données d'une société cliente, et les basculements de société active. Journaliser toute lecture métier produirait un volume sans rapport avec sa valeur, et §15 est narratif donc non normatif (D1).

**Règles amendées :** RG-DRO-04

### D33 — Reconnaissance de plaque signalétique (2.4)

**Retirée du périmètre V1.** L'exigence était contradictoire : fonctionner hors ligne interdit une interface distante, et un moteur embarqué de plusieurs mégaoctets est exactement la dépendance lourde que le CLAUDE.md impose d'arbitrer.

Le ticket L3-11 reste tel qu'il est écrit — photo de la plaque conservée comme pièce jointe, saisie manuelle du numéro de série. Les passages du cahier des charges qui l'exigent (§8.1, §13.3) sont non normatifs.

À réévaluer au lot 3 si un moteur léger et fiable apparaît, avec un critère d'acceptation chiffré — taux de lecture correcte sur un échantillon de 30 plaques réelles — et une saisie manuelle toujours disponible en repli.

---

## Gravité 3 — précisions

| Réf | Point | Décision |
|---|---|---|
| 3.4 | Calendrier site ou technicien | Voir D13 — table par usage |
| 3.5 | Cycle de vie de la demande | `NOUVELLE`, `QUALIFIEE`, `TRANSFORMEE`, `CLOSE_SANS_SUITE`. Motifs de clôture : `resolue_telephone`, `hors_perimetre`, `refus_client`, `doublon` |
| 3.6 | Statut ENVOYEE | Signifie « transmise au technicien, non encore démarrée ». Renommé **`AFFECTEE`**, plus clair. La notification de départ du technicien est un événement, pas un statut |
| 3.7 | Prix des pièces | Issus du catalogue articles importé. `intervention_piece.prix_unitaire` est renseigné côté serveur à la saisie, jamais par le technicien |
| 3.8 | Montants sur le portail et le rapport | **Aucun montant** ni sur le rapport PDF, ni sur le portail client en V1. Le rapport est un document technique ; la facture vient de Winpro. Le `○` de la matrice devient `—` |
| 3.9 | Adresse IP de la signature | Remplacée par `appareil_id` et `horodatage_terrain`. **Le PDF serveur fait foi** ; la version locale porte la mention « provisoire » |
| 3.10 | Checklist complétée | Absence de checklist = condition satisfaite. Un point non conforme ne bloque pas `TERMINEE` mais **impose une préconisation** |
| 3.11 | Notifications de modification | Créneau, technicien et annulation uniquement. Hors ligne, la notification part à la synchronisation, horodatée au moment de l'action terrain |
| 3.12 | Relevés de compteur désordonnés | Réordonnés par `horodatage_terrain`, jamais par ordre d'arrivée. Le contrôle de non-régression s'applique après réordonnancement |
| 3.13 | TVA / TGC | L'export « éléments à facturer » est **purement HT**. Winpro calcule la taxe. Aucun montant TTC n'existe dans CODIPLAN |
| 3.14 | Crédit d'heures épuisé | **Alerte à 80 %, bascule automatique au taux horaire à 100 %.** Jamais de blocage : on ne refuse pas une intervention pour un solde |
| 3.15 | Tacite reconduction | Les échéances sont générées sur **12 mois glissants**, régénérées automatiquement 60 jours avant épuisement tant que le contrat est actif |
| 3.16 | Comparaisons N/N-1 | À nombre de jours ouvrés égal, par agence, sur la fenêtre la plus courte des deux périodes. Méthode documentée dans `lib/reporting` |
| 3.17 | Technicien et clôture | Le `○` est supprimé : **le technicien ne clôture pas**. Il termine, le responsable valide et clôture |
| 3.18 | Traitements planifiés | Exécutés **par société**, à l'heure locale de chaque société |
| 3.19 | Notifications push | **Hors périmètre V1.** Le technicien consulte sa tournée, il n'est pas notifié. §13.5 est corrigé |
| 3.20 | Performance « moins de 2 secondes » | Devient un objectif de recette manuelle, pas un critère automatisé. Retiré des critères d'acceptation |

---

## Gravité 4 — corrections rédactionnelles

Toutes acceptées, plus une trouvée en complément :

- **« six lots » → « sept lots (0 à 6) »**, et surtout **« 21 semaines » → « 25 semaines »** dans la note de révision — valeur résiduelle de la v1.0 que l'audit n'avait pas relevée.
- **Better Auth** tranche définitivement, `Auth.js` disparaît du §12.1.
- **Énumération canonique des rôles** : `admin_plateforme`, `editeur_commercial`, `editeur_support`, `direction`, `responsable_materiel`, `responsable_sav`, `adv`, `technicien`, `client`. *(Complétée par D37 : `admin_societe` s'y ajoute, en quatrième position — l'énumération compte dix rôles.)*
- **`docs/decisions/`** créé avec un premier fichier reprenant D7, D13 et D21.
- **Glossaire complété** : agence, tournée, échéancier, habilitation, préconisation, avenant, valorisation, recensement, forfait.
- **CI désignée** : GitHub Actions.
- **L0-05** : le critère « retirer le filtre société fait échouer les tests » devient une **vérification manuelle documentée**, à faire une fois au lot 0 et à consigner dans `docs/decisions/`. Un test de mutation automatisé serait disproportionné.

---

## Deux remarques sur la méthode

**Ce que cet audit démontre.** Une session de critique avant la première ligne de code a produit 60 points, dont 12 auraient figé des erreurs dans les gardiens — c'est-à-dire dans les tests censés protéger le projet pendant six mois. Le coût : une heure. Le coût de les découvrir au lot 3 : plusieurs semaines.

**Ce qu'il faut en retenir pour la suite.** La faiblesse du cahier des charges n'était pas l'intention mais la redondance : la même règle écrite trois fois, avec des variantes. La décision D1 — le chapitre 10 comme source unique, tout le reste en dérive — supprime la cause plutôt que les symptômes. Elle doit être tenue à chaque évolution, sans quoi la liste se reconstituera.

*Note d'arbitrage n°1 — CODIPLAN — 19 août 2026*

---

# CODIPLAN — Note d'arbitrage n°2

**Réponses aux points soulevés par la livraison du ticket L0-06**

| | |
|---|---|
| **Objet** | Trancher les questions ouvertes par l'authentification, les rôles et le rôle de consolidation |
| **Portée** | D34 à D42 — les cinq premiers relevés à la livraison de L0-06, les suivants soumis puis arbitrés au cours de L0-06b et L0-06c |
| **Statut** | Décisions arrêtées — même autorité que la note n°1, qu'elle complète et ne remplace pas |
| **Date** | 20 août 2026 |
| **Ticket** | L0-06b |

### D34 — `journal_acces` et les tables techniques

**La lecture faite à L0-06 est validée, et elle cesse d'être une interprétation.** L'invariant I1 gagne une **troisième catégorie, fermée et énumérée** : les **tables techniques d'authentification**, qui ne portent **pas de `societe_id` du tout**.

**Aujourd'hui** : `session`, `compte`, `verification`, `journal_acces`. **Toute addition à cette liste passe par un arbitrage.**

Ce ne sont pas des référentiels de plateforme — elles ne sont pas partagées, elles sont *hors* du cloisonnement. Elles portent l'identité et la trace technique : l'authentification cherche un compte avant qu'aucune société ne soit active, et une bascule refusée de A vers B ne se range ni sous A ni sous B.

**`journal_acces` gagne deux colonnes, `societe_id_source` et `societe_id_cible`**, informatives et nullables. Elles répondent à une question, et à une seule : *qui a tenté d'accéder à mes données*. Elles **ne filtrent jamais** — ni requête applicative, ni politique, ni index, ni clé étrangère : un journal qui enjambe les sociétés ne peut pas être rangé sous l'une d'elles, et une requête qui filtrerait dessus donnerait l'apparence d'un cloisonnement qu'aucune politique ne garantit. Un test statique parcourt le dépôt et échoue si l'une d'elles apparaît dans un `where`, en Prisma comme en SQL.

*(La colonne `societe_id_precedente` de L0-06 est renommée `societe_id_source` : c'est la même donnée, sous le nom que cet arbitrage retient.)*

### D35 — Identités globales et réponses indiscernables

**Une même personne travaille légitimement pour deux sociétés.** L'identité est **unique au niveau plateforme** — un compte, une adresse, un mot de passe —, les **habilitations sont par société**. C'est ce que L0-06 a construit ; c'est désormais une décision explicite, et non une conséquence de l'implémentation.

**Ce qui ne peut pas attendre le lot 7.** Les réponses d'authentification doivent être **indiscernables**. Compte inexistant, mot de passe faux, compte sans habilitation : **même message, même ordre de grandeur de temps de réponse**. Sans quoi un client découvre, par la seule page de mot de passe oublié, quels de ses concurrents sont clients de la plateforme — sans mot de passe, sans effraction, sans trace anormale.

Le message réel du refus reste écrit au journal des accès, qui est interne. Le refus « second facteur absent » reste distinct : il n'est atteignable qu'une fois le mot de passe validé et l'habilitation établie, il ne dit donc rien à un tiers.

Un test le prouve, sur les deux chemins à la fois — connexion et activation de société.

### D36 — Consolidation : `BYPASSRLS` accordé, repli obligatoire quand même

**Vérification faite sur Neon le 20 août 2026** : `codiplan_reporting` porte bien `rolbypassrls = true`, `codiplan_app` porte `rolbypassrls = false`. Le chemin rapide de D21 fonctionne sur notre hébergement, et l'avertissement prévu dans la migration n'y est jamais déclenché. **Il reste en place** : il est destiné aux clients qui hébergeront ailleurs.

**Le repli reste obligatoire, pour la portabilité — nous vendons la solution.** Chemin à construire au **lot 5** : une fonction `SECURITY DEFINER` appartenant au rôle **propriétaire**, `search_path` **fixe**, ne renvoyant que des **agrégats déjà consolidés**, `EXECUTE` accordé au seul `codiplan_reporting`. Aucune ligne ne sort, seulement des agrégats — ce qui rend l'invariant I2 structurellement impossible à violer.

Détail dans `docs/decisions/2026-08-20-consolidation-repli-portable.md`.

### D37 — Rôle `admin_societe`

**L'énumération manquait d'un administrateur au niveau société.** Rattacher la colonne « Admin » du §5.2 à `admin_plateforme` signifiait que créer un compte chez un client passait par l'éditeur : intenable dès la première vente. L'énumération avait été fermée **avant** l'arbitrage « il faut prévoir de vendre la solution ».

**`admin_societe` est le dixième rôle.** Il administre les **comptes, agences et habilitations de SA société**. Il **ne lit pas les données financières** — montants de vente, marges et éléments à facturer restent à la direction. Ce n'est pas un rôle éditeur : il ne modifie pas les référentiels de plateforme (I1).

**La colonne « Admin » du §5.2 est scindée** : lignes de portée plateforme à `admin_plateforme`, lignes de portée société à `admin_societe`. Toutes les lignes du §5.2 étant de portée société, elles reviennent à `admin_societe` ; les capacités de portée plateforme sont celles du §22.5.

**Le §5.2 du cahier des charges fait foi une fois corrigé — pas de rôle recopié ailleurs.**

### D38 — `codiplan_reporting` est une clé passe-partout

Le rôle voit **toutes** les sociétés et **peut se connecter**. Il n'a pas de mot de passe et n'en aura pas avant le lot 5. Il se traite comme ce qu'il est.

**Règle, écrite aux interdits de `CLAUDE.md`** : son mot de passe ne sera **jamais** placé dans `DATABASE_URL` ni dans `MIGRATION_DATABASE_URL`, mais dans un secret **distinct**, `REPORTING_DATABASE_URL`, lu par le seul `lib/reporting`.

**Contrôle permanent**, ajouté au script de cloisonnement : `codiplan_reporting` ne détient **aucun privilège autre que `SELECT`**, vérifié par `information_schema.role_table_grants` et **non par déclaration**. Le contrôle échoue si un droit d'écriture apparaît un jour — et il échoue aussi s'il n'observe **rien**, un contrôle aveugle ressemblant beaucoup trop à la conformité.

### D39 — `second_facteur` et `utilisateur`

Les deux tables laissées hors catégorie par D34 sont rattachées, et **pas à la même**.

**`second_facteur` est une omission, pas une décision.** C'est une table Better Auth de même nature que `compte` et `verification`. Elle rejoint la **troisième catégorie** de I1 — tables techniques d'authentification —, dont la liste close devient : `session`, `compte`, `verification`, `second_facteur`, `journal_acces`.

**`utilisateur` est un cas différent, et reçoit sa propre catégorie**, la **quatrième** : **table d'identité de plateforme**. Liste close, et elle ne contient qu'elle.

**Le motif, à écrire dans I1.** Une session expire, une vérification se consomme, un second facteur se révoque : ces tables sont **purgeables**. Une identité est **durable**, elle porte des **données personnelles**, et elle sera **exposée dans la console éditeur au lot 7**. Une future politique de purge des tables techniques ne doit jamais pouvoir emporter les identités. Ce sont deux régimes de conservation ; les ranger ensemble serait préparer une purge qui efface des personnes.

**Règle attachée à cette catégorie, et c'est elle qui rend son non-cloisonnement acceptable : aucune donnée métier sur `utilisateur`.** Tout cela vit du côté cloisonné, et `utilisateur` ne porte que ce qui sert à **trouver et authentifier** un compte.

> **L'ÉNUMÉRATION A ÉTÉ RETIRÉE D'ICI le 11/09/2026, et elle n'est pas remplacée : elle a UNE maison, et c'est I1.** La phrase d'origine disait « fonction, agence de rattachement, habilitations, préférences — tout cela **vit dans** `utilisateur_societe` », au présent. **Mesuré : `utilisateur_societe` porte `utilisateur_id`, `societe_id` et `role`, et rien d'autre** ; trois des quatre notions n'avaient de colonne nulle part. La règle était juste, son énumération était fausse, et elle était **écrite deux fois** — ici et au CLAUDE.md —, c'est-à-dire condamnée à diverger (§9, 01/09). I1 la porte désormais seule, sous forme de tableau, avec la marque `(prévu)` du §6 et un gardien qui tient les deux sens (`tests/unit/docs/donnees-du-cote-cloisonne.test.ts`).

Un gardien statique lit `prisma/schema.prisma` et échoue si une colonne s'ajoute hors de la liste close, relations comprises — une relation `agence Agence` rattacherait une identité à un établissement aussi sûrement qu'un `agence_id`. Il est éprouvé d'abord sur un schéma fabriqué, comme le gardien des blocs `where:` de D34.

### D40 — Second facteur obligatoire sur `admin_societe`

`admin_societe` administre les **comptes** et les **habilitations** de sa société : compromettre ce seul compte permet de se créer un accès n'importe où chez ce client, sous n'importe quel rôle. La liste de L0-06 est étendue et devient : **`admin_plateforme`, `admin_societe`, `direction`**.

**Une distinction que D37 n'avait pas vue.** Sur `admin_plateforme` et `direction`, la contrainte est **la nôtre** : nous l'imposons à nos propres salariés. Sur `admin_societe`, elle est **imposée à l'utilisateur d'un client payant**, qui ne l'a pas choisie et qui découvrira à sa première connexion qu'il lui faut une application d'authentification.

C'est donc une **règle produit**, et pas seulement une règle technique : elle doit être **annoncée à l'ouverture de toute nouvelle société**. Elle est inscrite au chapitre 10 comme **RG-DRO-05**. Détail dans `docs/decisions/2026-08-20-second-facteur-admin-societe.md`.

**Règles amendées :** RG-DRO-05

**Corollaire, au lot 7** : une procédure de déblocage d'un `admin_societe` ayant perdu son second facteur, exécutable par `admin_plateforme` seul et journalisée dans `journal_acces`. Une contrainte sans porte de sortie se paie en appels au support et finit par se faire contourner. Elle n'est **pas construite maintenant**.

### D41 — `parite` rejoint les référentiels de plateforme, et l'exhaustivité devient vérifiable

**Le symptôme.** `parite` ne portait aucune catégorie. La liste close des référentiels de plateforme (D4) a été arrêtée **avant** que D20 ne crée cette table en remplacement de `devise.parite_reference`. Elle se comporte pourtant exactement comme `devise` — la parité légale du franc Pacifique est la même pour tout le monde. C'est un oubli à réparer, pas une décision à prendre : elle rejoint la liste, qui devient `devise`, **`parite`**, `famille_materiel`, `modele_materiel`, `checklist_modele`.

**La cause, et c'est elle qui compte.** C'est le **troisième** oubli du même type. `second_facteur` et `utilisateur` manquaient à D34 ; `parite` manquait à D4. À chaque fois le même enchaînement : une liste est fermée un jour, une décision ultérieure crée une table, et personne ne revient ranger la nouvelle venue. La liste garde l'autorité d'une décision et prend le contenu d'un oubli — ce qui est pire qu'une liste ouverte, parce qu'on ne la relit plus. Réparer le troisième cas à la main ne protège pas du quatrième.

**Le gardien d'exhaustivité.** Il renverse la charge de la preuve. Les autres gardiens partent d'une liste et vérifient que le schéma s'y conforme ; celui-ci part du **schéma** — il énumère toutes les tables de `prisma/schema.prisma` — et exige que chacune appartienne à **exactement une** catégorie de I1.

- **Zéro catégorie fait échouer** : c'est l'oubli, et il tombe désormais le jour où la table est écrite, pas trois arbitrages plus tard.
- **Deux catégories font échouer aussi** : une table technique d'authentification qui se mettrait à porter `societe_id NOT NULL` cesserait d'être technique sans que personne ne l'ait décidé.
- Le message d'échec **nomme la table et rappelle les quatre catégories**, pour qu'on n'ait pas à ouvrir le CLAUDE.md pour le comprendre.

Il est éprouvé d'abord sur des schémas fabriqués — une table sans catégorie, une table à deux, et les quatre formes légitimes —, comme les gardiens de D34 et D39. Détail dans `docs/decisions/2026-08-20-gardien-exhaustivite-categories.md`.

**Ce que le premier passage a trouvé.** Deux tables, et non une : `parite`, attendue, et **`societe`**, qui ne l'était pas. Elle est tranchée par D42.

### D42 — `societe` est cloisonnée par son identité : c'est la rédaction de I1 qui était incomplète

**Rien n'était ouvert.** La politique de cloisonnement de `societe` existe depuis L0-04 et s'écrit `id = current_setting('app.societe_id')::uuid`. `tests/isolation/force-rls.test.ts` l'éprouve comme les autres. `scripts/inventaire.mts` compte `societe` **parmi les tables cloisonnées** — son type `TableFille` ne dit rien d'autre que « toutes les tables cloisonnées *sauf* `societe` », c'est-à-dire la forme particulière de cette table, jamais son exclusion. C'est donc la **phrase de l'invariant** qui était incomplète, pas le cloisonnement : « `societe_id NOT NULL`, sans exception tacite » ne peut pas décrire la table que `societe_id` **désigne**.

**La rédaction retenue**, qui remplace celle de la première catégorie de I1 :

> **1. Tables métier** — `societe_id NOT NULL`. Cas général. `societe` fait exception à la forme, non au fond : étant la table que `societe_id` désigne, elle est cloisonnée par son identité (`id = app.societe_id`).

**L'exception est nommée, non déduite.** Le gardien de D41 la tient sous le nom `CLOISONNEE_PAR_IDENTITE` plutôt que d'élargir sa règle à « cloisonnée d'une manière ou d'une autre » — une règle élargie ne se relit pas, et la table suivante qui s'en réclamerait entrerait sans décision. Écartées de même : une cinquième catégorie, qui confondrait une forme de cloisonnement avec un régime de conservation ; et une colonne `societe_id` dupliquant la clé primaire, qui déformerait la base pour arranger un gardien.

**C'est une liste close de plus, et elle est gardée comme les trois autres** — la plus exposée, même, puisqu'elle dispense de la seule règle mécanique de I1. Le gardien **échoue si elle contient autre chose que son unique entrée `societe`**, comme si elle la perd, avec ce message : *toute addition passe par un arbitrage, elle ne se décide pas dans un ticket.* Il est éprouvé sur une addition fabriquée et sur une liste vidée.

**Et ce que D41 comptait comme un coût est inscrit comme l'objectif.** Chaque table des lots 1 à 3 — `client`, `site`, `machine`, `intervention`, `contrat` — portera `societe_id NOT NULL` ou passera par un arbitrage. Le CLAUDE.md l'écrit désormais **comme l'objectif et non comme une friction**, pour qu'aucun ticket futur ne cherche à le contourner. Détail dans `docs/decisions/2026-08-20-societe-cloisonnee-par-identite.md`.

---

## Ce qui reste à décider, et quand

**Registre unique du projet** — les notes n°1 à n°3 y déposent leurs points ouverts, et rien ne s'y range sans **échéance ou déclencheur explicite**.

Rien ne bloque plus le lot 0. Le seul point que la note n°2 avait laissé ouvert — la rédaction de la première catégorie de I1 pour `societe` — est **tranché par D42** ; le gardien d'exhaustivité de D41 ne trouve plus aucune table hors catégorie. La note n°3 y ajoute deux points, l'un déclenché par un événement et l'autre par un ticket. Les points suivants attendent donc leur tour :

| Échéance | Point |
|---|---|
| **Au premier document client** *(D43)* | **Symbole du XPF — `XPF` ou `F`.** Déclencheur explicite : la **conception du premier document destiné à un client** — devis, facture ou rapport d'intervention. D19 dit `7 000 XPF`, la maquette l'écrit ainsi, `prisma/seed-data.ts` porte `symbole: null` pour le XPF : rien à changer aujourd'hui. Si le choix se porte alors sur `F`, ce sera un **amendement de D19 et une ligne de seed** (`symbole: "F"`), jamais une modification discrète |
| ~~**Avant L2-09** *(D45)*~~ **TRANCHÉ le 07/09/2026** *(D57)* — **PAR INTERVENTION.** Cinq passages de cinq minutes font **1 h 15**. | ~~**L'arrondi au quart d'heure supérieur s'applique-t-il à chaque intervention ou au total d'une journée ?** Cinq passages de cinq minutes font **1 h 15** dans un cas et **30 minutes** dans l'autre. D11 règle l'agrégation à l'intérieur d'une intervention, pas entre interventions. C'est une **décision commerciale**, à prendre **avant** que la valorisation ne soit écrite, pas pendant~~ — prise le 07/09/2026, voir D57. Ligne conservée : un point tranché se raye, il ne s'efface pas |
| ~~**Avant le lot 1** *(L0-08)*~~ **TRANCHÉ le 23/08/2026** *(D48, ticket L0-09a)* | **Un écart local pouvait s'adosser au férié d'un AUTRE territoire.** Fermé en base par **chaînage de clés composites** — l'option *(a)*, celle qui ferme en base : `agence` gagne un `UNIQUE (id, territoire)`, `calendrier_ferie` gagne une colonne `territoire` liée à l'agence par `(agence_id, territoire)` et au fait public par `(jour_ferie_id, date, territoire)`. Conséquence assumée : **`agence.territoire` devient `NOT NULL`** — une clé étrangère dont une colonne vaut NULL n'est pas contrôlée en PostgreSQL, le verrou aurait été muet là où la donnée manque. Le pont reste possible (`jour_ferie_id` nul, `MATCH SIMPLE`). Ligne conservée au registre : un point tranché se raye, il ne s'efface pas |
| **Avant le lot 1** *(L0-08)* — **MESURÉ le 31/08/2026** *(ticket R0-a, écart É12)* | **Qui voit une nuit rouge ?** Les contrôles nocturnes sur `main` s'accumulent — `verify:full`, l'horizon des fériés, les deux contrôles de partitions — et personne ne consulte GitHub chaque matin. **Les deux vérifications demandées le 26/08 ont été faites, et elles ne se répondent pas de la même façon.**<br>**(1) L'échec d'une exécution PLANIFIÉE notifie-t-il comme un échec manuel ? — Oui, dans la même boîte, et l'observation directe est impossible.** Mesuré : **onze** exécutions planifiées de `ci.yml` depuis le 20 août, du 20/08 au 31/08, **toutes réussies**. La question n'a donc jamais été posée à la base, et elle ne peut l'être qu'en produisant une nuit rouge pour de bon. Ce qui SE mesure : GitHub attribue chaque exécution planifiée à un `triggering_actor` réel — `alexis97310`, le propriétaire —, et la notification d'échec d'un flux planifié part au **dernier compte ayant modifié le `cron`**, ici le même. C'est **la boîte où les deux échecs manuels du 20 août sont arrivés, et où ils sont restés non lus**. Réponse : l'alarme sonnerait, dans la même pièce vide.<br>**(2) GitHub désactive-t-il la planification après inactivité ? — NON pour ce dépôt, et pour une raison qui peut changer d'un clic.** La règle des 60 jours ne vise que les dépôts **publics** ; `alexis97310/codiplan` est **privé** (`visibility: private`, mesuré). La protection ne tient donc pas à la planification mais à un **attribut du dépôt** : rendre le dépôt public — ou le forker, ce qui désactive les flux planifiés par défaut — remet la règle en vigueur, sans que rien ne le dise.<br>**Conséquence, et elle ne dépend d'AUCUNE des deux réponses :** le point (1) suffit à lui seul. **TRANCHÉ le 31/08/2026 — les deux contre-mesures sont CONSTRUITES**, et *(b)* est celle qui compte. *(a)* Le job `alarme-nuit-rouge` ouvre automatiquement une **issue** dès que `verify:full` échoue hors proposition de fusion : la question du courriel devient sans objet — l'issue est créée quoi qu'il arrive, elle vit dans le dépôt, et sa notification suit un autre chemin que celui qui a laissé passer les deux échecs du 20 août. Une issue par ÉPISODE, pas une par nuit. *(b)* Le job `battement` (`pnpm battement`, `scripts/lib/battement.ts`) refuse un flux qui a **cessé de battre** — deux signaux : l'`state` du flux, où `disabled_inactivity` nomme la règle des 60 jours, et l'âge de la dernière exécution planifiée. Il tourne sur l'activité **humaine**, jamais sur la planification : un contrôle qui ne s'exécute que lorsqu'elle s'exécute ne peut pas constater qu'elle a cessé. Les deux sont indépendants dans les deux sens, comme le préventif et le détectif des partitions : *(a)* dit qu'une nuit a rougi, *(b)* dit que les nuits ont cessé. Sans *(b)*, une planification désactivée produit **zéro échec, donc zéro alarme** — le silence a exactement la forme du succès (inscrit au §9). **Et la dépendance à la visibilité du dépôt est écrite là où on la change** : en tête de `.github/workflows/ci.yml` et au README, pas seulement ici |
| **À l'écriture de la console éditeur** *(L1-02c)* | **Qui ouvre la PREMIÈRE identité d'une société cliente ?** La politique `utilisateur_ouverture` exige une société active ; les trois rôles éditeur n'en ont **aucune**, par construction (§22.5). Il n'y a donc personne pour ouvrir le premier compte d'un nouveau client — et c'est un refus que **personne n'a arbitré**. Construire le chemin aujourd'hui figerait la forme du provisionnement avant qu'on en sache la première chose ; ce qui est mûr, c'est le refus. **Un RENDEZ-VOUS remplace l'embuscade** : `tests/isolation/identite-cloisonnee.test.ts` constate ce refus et le nomme, si bien que celui qui écrira la console lira « n'est pas décidée — voir le registre » au lieu d'un « new row violates row-level security policy » |
| **Quand le chemin administratif d'ouverture de compte existera** *(L1-02c)* | **`disableSignUp` de Better Auth se pose alors, et pas avant.** Aujourd'hui la SURFACE est fermée — la route `/sign-up` rend 404 — mais l'API serveur `auth.api.signUpEmail` reste appelable par notre propre code, et c'est ce qui rend l'acte administratif possible ; la politique `utilisateur_ouverture` la borne en base. `disableSignUp` fermerait les deux d'un coup — **mesuré le 07/09/2026** : il refuse aussi l'appel serveur, « Email and password sign up is not enabled ». Le poser aujourd'hui retirerait le seul moyen de créer une identité avec ses identifiants. Déclencheur explicite : le jour où un chemin administratif d'ouverture existe, `disableSignUp` devient la fermeture juste, et l'asymétrie actuelle disparaît |
| ~~**Avant le premier `admin_societe` réel** *(D58)*~~ **TRANCHÉ le 08/09/2026** *(D59)* — la CATÉGORIE ENTIÈRE reçoit son plancher. | ~~Le plancher de la troisième catégorie de I1 : cinq tables sans RLS, sans politique, avec les quatre verbes pour le rôle applicatif ; une empreinte de mot de passe et un jeton de session lus sous un contexte de `technicien` ; un cliquet sur `mfa_actif` seul aurait été décoratif~~ — pris le 08/09/2026, voir **D59**, qui porte le tableau des cinq formes déduites et ce que voient les trois profils. Ligne conservée : un point tranché se raye, il ne s'efface pas. **Ce qui RESTE ouvert et change de nature :** la transition d'ENRÔLEMENT de D58 n'est toujours pas ouverte — son plancher existe (`second_facteur_enrolement`), le chemin qui l'empruntera reste à écrire, et il sera à nous plutôt qu'un point d'entrée générique. Déclencheur inchangé : avant le premier `admin_societe` réel |
| **Avant le premier chemin qui laisse CHOISIR un identifiant d'utilisateur** *(D59)* | **CE QUE VAUT UNE DÉSIGNATION PAR UN IDENTIFIANT, ET NON PAR UN SECRET.** `session` se désigne par son **jeton** — une valeur imprévisible, un vrai secret. `compte`, `second_facteur` et `journal_acces` se désignent par l'**identifiant de l'utilisateur** concerné, et `journal_acces` par celui du compte, jamais par le sien — la borne est donc réelle au sens où une lecture non désignée rend zéro. **Mais un identifiant d'utilisateur est un UUID v7** : ordonné dans le temps, donc devinable en principe, exactement l'argument qui fait écarter l'identifiant de session. Ce qui tient aujourd'hui n'est donc pas la force de la clé : c'est qu'**aucun chemin ne laisse un appelant CHOISIR la valeur désignée** — elle vient toujours de nos propres requêtes. **Ce que ça coûte à dormir :** rien tant que cela reste vrai ; le jour où une route accepte un identifiant d'utilisateur en entrée, la borne devient nominale et il faudra soit une clé secrète, soit une clause de rattachement en plus. Déclencheur explicite : le premier chemin qui laisse choisir cette valeur |
| **Le jour où un écran ou une route de portail lit une table de forme « société »** *(D94, 13/09/2026)* | **LES TABLES PUREMENT INTERNES SONT LISIBLES PAR UN COMPTE PORTAIL, ET PERSONNE NE L'AVAIT VU.** La clause de la forme « société » ne lit pas `app.client_id` : un compte portail muni d'une société lirait `taux_horaire`, `forfait`, `agence`, `habilitation` — la grille tarifaire, le catalogue de forfaits, la liste des agences. **Aucun écran ne les lui donne aujourd'hui, et c'est le seul motif pour lequel la question ne s'est jamais posée.** Elle a été VUE en écrivant le bac de réception, dont la table nomme des fichiers — `notice-KPX-337.pdf` dit qu'un pont élévateur existe quelque part —, c'est-à-dire la fuite exacte que D93 venait de fermer un étage plus haut. **D94 ferme `document_recu` par une treizième forme, « interne », et ne tranche PAS la classe** : l'étendre en séance aux dix tables concernées aurait été un arbitrage bien plus large qu'un ticket de bac, pris sans mesure sur chacune. *Ce que ça coûte à dormir : rien tant qu'aucun écran de portail ne lit ces tables — les écrans de portail ne touchent aujourd'hui que `utilisateur_client`, `client`, `site`, `machine` et `document`, toutes de forme « rattachement », « parc » ou « héritage ». Le critère se vérifie en lisant les appelants sous `app/(portail)/`* |
| **Au lot 7, avant d'écrire L7-01** *(D59)* | **LE RETRAIT D'UN SECOND FACTEUR N'EST OUVERT À PERSONNE.** `second_facteur` n'a aucune politique de suppression : sous `FORCE`, le verbe est refusé pour tout le monde — le sujet comme l'administrateur. C'est le bon défaut et il est gardé. Mais **L7-01 est aujourd'hui inimplémentable**, et son refus est SILENCIEUX : zéro ligne, pas d'erreur. **Un RENDEZ-VOUS remplace l'embuscade** — `tests/isolation/categorie-authentification.test.ts` constate le refus et nomme ce qu'il faudra faire : L7-01 ouvrira UNE politique de suppression, `admin_plateforme` seul, et elle sera la seule. Tout autre élargissement est un arbitrage |
| **À la première demande d'un client concerné** *(D46)* | **Jours fériés INFRA-NATIONAUX.** Certains territoires en ont : l'Alsace-Moselle chôme le Vendredi saint et le 26 décembre, le reste de la métropole non ; plusieurs États fédéraux fonctionnent ainsi. Le modèle `(territoire, date)` **le permettra sans être refait** — par un code de subdivision, sur le patron d'ISO 3166-2. Rien n'est construit aujourd'hui : la question se tranchera quand un client la posera, et non par anticipation |
| **Au paramétrage réel des agences** *(L0-08)* | **Horaires d'ouverture réels de Ducos, Koné et Dolbeau, et liste des fériés effectivement chômés par chacune.** Le seed porte des valeurs de **démonstration**, dites comme telles dans le libellé de chaque calendrier. Ce qui n'est PAS de la démonstration et doit le rester : Ducos ouvre le samedi, Koné non (RG-PLA-01). La saisie des vrais horaires est une opération de paramétrage, pas un développement |
| Lot 1 | Colonnes exactes de chaque modèle d'import ; montants du catalogue de forfaits |
| **Au premier mot de l'exploitation** *(nuit du 10/09/2026)* | **L'index d'unicité de `reference_interne`, MESURÉ et prêt.** D6 promet une valeur unique ; l'exploitation a tranché **unique par société ET lorsqu'elle est présente**, et a demandé la mesure de son origine AVANT la migration. *Mesuré :* la valeur est **SAISIE** — `lib/machines/saisie.ts` la lit en texte libre facultatif, le seed n'écrit aucune machine, l'import n'existe pas. D6 dit donc « unique par **contrainte** », et la contrainte n'est pas posée. Elle tient en une ligne : `CREATE UNIQUE INDEX "machine_societe_reference_interne_key" ON "machine" ("societe_id", "reference_interne") WHERE "reference_interne" IS NOT NULL;`. L'index est **partiel**, donc écrit en SQL et non dans `schema.prisma` — un `@@unique` accepterait autant de `NULL` qu'on veut, ce qui n'est pas faux mais ne dit pas « lorsqu'elle est présente ». La base hébergée ne porte **aucune machine** (inventaire n°37) : rien à réparer avant. **Un mot suffit** |
| ~~**Avant la prochaine décision qui en amende une autre** *(nuit du 10/09/2026)*~~ **TRANCHÉ le 11/09/2026 — NUMÉROTÉES.** Q4 devient **D77** (D11), l'incident du 02/09 devient **D78** (D14), le ticket L1-02b devient **D79** (D10). Les trois paires sont câblées des deux côtés et **tenues par le gardien** — mesuré en retirant chaque marque : `D79 déclare amender D10, mais D10 ne porte pas « **Amendé par D79.** »` d'un côté, `D14 se dit amendée par D78, mais D78 ne déclare pas …` de l'autre. Aucun fond n'a changé : ce qui change est que la machine peut désormais les tenir. Ligne conservée : un point tranché se raye, il ne s'efface pas | ~~**TROIS DÉCISIONS DE RANG 1 SONT AMENDÉES PAR AUTRE CHOSE QU'UNE DÉCISION.** Le gardien `amendements-arbitrages` tient les paires décision ↔ décision ; il ne peut rien tenir de ce qui n'a pas de numéro. Or D11 est amendée par la **question Q4** (retrait de `forfait.heures_incluses`), D14 par l'**incident du 02/09** (`format:check` entre dans `verify`), et D10 par le **ticket L1-02b** (`perimetre_sites` devient une table). Les trois sont marquées dans le texte, datées, et **hors de portée du gardien**. Faut-il les numéroter — D77, D78, D79 — pour qu'il les tienne, ou accepter qu'une décision de rang 1 puisse être amendée par un objet sans numéro ? *Lecture de la session : les numéroter, trois lignes chacune ; une amendante sans numéro est très exactement ce que ce gardien ne voit pas, et l'on vient de mesurer ce que coûte ce qu'il ne voit pas*~~ |
| **Quand une convention de qualification existera** *(nuit du 10/09/2026 — REFUS RATIFIÉ le 11/09/2026)* | **AUCUN GARDIEN NE TIENT « une valeur d'énumération nommée par une décision de rang 1 existe au schéma ».** C'est l'écart de D28 (`fusionnee`), et le gardien décision ↔ décision ne pouvait pas le voir : l'écart est entre une décision et une énumération. Trois voies mesurées au registre du 10/09 §5 — (a) l'association par le mot-notion, qui **attrape le défaut** mais laisse **onze faux** dont sept que rien ne retire ; (b) l'association déclarée au schéma, qui les supprime tous mais dont **quatre entrées sur sept diraient « aucune décision »**, c'est-à-dire une liste d'admis avec sa porte de sortie ; (c) une convention de rédaction — toute décision qui nomme une valeur écrit `` `Enum.valeur` ``, qualifié —, qui rend le gardien mécanique et sans exemption. *Lecture de la session : (c), même famille que D56 — une valeur qui voyage sans son énumération est un jeton dont la signification dépend d'un contexte que la machine ne lit pas*.<br>**RATIFIÉ le 11/09/2026 : ne rien livrer.** L'exploitation retient le refus et en tire la règle, inscrite au §9 du CLAUDE.md — *un gardien dont le taux de fausses alertes conduit à l'ignorer coûte plus qu'il ne rapporte ; c'est É12 sous un autre costume, une alarme qu'on apprend à ne plus lire.* **La classe reste OUVERTE**, et son **critère de réouverture est écrit pour être vérifié, non interprété** : le jour où les décisions de rang 1 qualifient les valeurs d'énumération qu'elles nomment (`` `Enum.valeur` ``), l'association devient explicite, le gardien se réécrit **sans heuristique ni exemption**, et il est dû. *Ce qui reste vrai en attendant : `StatutMachine.fusionnee` est au schéma, D28 est alignée, le CAS est bouché ; c'est la CLASSE qui dort* |
| **Avant L2-09** *(nuit du 10/09/2026, issu de D72)* | **L'EXCEPTION D'HORAIRES PAR TECHNICIEN S'APPLIQUE-T-ELLE À L'ASSIETTE DE LA MAJORATION ?** D12 et D13 calculent la majoration hors ouverture sur le calendrier de l'**agence** du technicien. D72 donne au technicien des horaires PROPRES qui priment pour la planification. Un technicien qui travaille le samedi par exception : son intervention du samedi est-elle majorée ? *Lecture de la session : NON — la majoration suit l'AGENCE, D12 et D13 inchangés, l'exception n'étant qu'un fait de planification. Une majoration qui suivrait l'individu ferait varier le prix facturé au client selon le technicien envoyé* |
| ~~**À l'ouverture de L3-10** *(nuit du 10/09/2026, issu de D28)*~~ **TRANCHÉ le 11/09/2026** — la valeur RESTE, et son producteur est NOMMÉ : la **déduplication du parc**, conséquence d'un parc alimenté par l'import de masse (L1-10) ET par le recensement terrain (D16, L2-02), deux chemins qui ne se connaissent pas. Voir D28. Ligne conservée : un point tranché se raye, il ne s'efface pas | ~~**`fusionnee` N'A NI PRODUCTEUR NI LECTEUR JUSQU'À L3-10.** La valeur est ajoutée parce que le rang 1 l'exige, et ce qu'elle veut dire est écrit dans D28 — état terminal de la fiche absorbée, seul producteur la fusion de L3-10, lecteurs la résolution QR et les listes du parc. Mais c'est la situation de `heures_incluses_minutes`, retirée le 09/09 précisément pour cela : *une valeur qui modélise un cas que rien ne produit s'implémente un jour de travers*. **Si l'exploitation préfère amender D28 plutôt que porter une valeur inerte pendant un lot, c'est ici que ça se décide**~~ |
| **Quand quelqu'un touchera au parseur des décisions** *(nuit du 10/09/2026)* | **`lireDecisions` FERME UNE SECTION AU PREMIER SOUS-TITRE.** Mesuré : le corps de D65 s'arrête avant son premier `###`, celui de D68 aussi — l'empreinte que les tickets du backlog calculent ne couvre donc que le **préambule** de chaque décision citée, et un complément écrit sous un sous-titre ne réveille aucune estampille. Deux conséquences tenues aujourd'hui : les marques d'amendement se posent dans le préambule, et une décision dont le fond change sous un sous-titre ne prévient personne. Élargir le corps jusqu'au titre suivant de MÊME NIVEAU est le correctif ; il réveillerait des dizaines d'estampilles d'un coup, donc il vient avec la relecture qui va avec — un ticket à lui seul, jamais un effet de bord |
| **AVANT L1-08b, et c'est le blocage le plus ancien** *(question du 08/09/2026 — arbitrage CONDITIONNEL rendu le 11/09, condition MESURÉE la même nuit)* | **COMMENT LE CLASSEUR EST LU — un mot suffit, et la comparaison est faite.** Le §2 n'exige plus qu'*une bibliothèque de lecture `.xlsx` MAINTENUE* ; il ne nomme plus SheetJS depuis le 09/09. L'exploitation a rendu une condition : *une bibliothèque maintenue qui rende le texte brut ET le numéro de série d'une date, sinon SheetJS depuis la distribution de l'éditeur.* **Mesurée en lisant deux vrais fichiers** — un écrit à la main en OOXML, un écrit par openpyxl — plus les bornes du bogue bissextile de 1900, une bombe d'entités XML et une bombe zip. **Elle ne tranche pas nettement, et l'écart est nommé :** à la LETTRE, aucune bibliothèque maintenue ne rend le sérial (`xlsx-populate` le rend et date de **mars 2020**), donc branche SINON ; à son MOTIF — *jamais un `Date` qui décalerait le jour à UTC+11* —, `read-excel-file` (publiée il y a **un mois**) rend un `Date` **UTC invariant sous trois fuseaux**, par **exactement la conversion de notre `lireDate`**, si bien que les deux refus fondés sur le sérial restent exprimables. **Et la branche SINON a été mesurée impraticable** : `cdn.sheetjs.com` est **refusé par le mandataire sortant** des sessions (403), donc `pnpm install` casserait à chaque session neuve. Une **troisième voie** existe, hors condition : **94 lignes sans aucune dépendance**, qui rendent le sérial et lisent les deux fichiers à l'identique — jamais éprouvées sur un fichier d'Excel. **Tout est dans `docs/decisions/2026-09-11-lecture-du-classeur-comparaison.md`, et la réponse attendue tient en un mot** : « read-excel-file », « les 94 lignes », ou « SheetJS quand même » (qui exige alors d'ouvrir `cdn.sheetjs.com` dans la politique de sortie) |
| **AVANT LA PREMIÈRE TABLE DU LOT 2, et c'est le verrou de tout le reste du lot** *(nuit du 11/09/2026 — question posée avec sa mesure)* | **QUELLE FORME DE POLITIQUE POUR `intervention` ?** Tout ce qui reste du lot 2 en dépend : `compteur_releve` la référence (ch. 11), `document` est polymorphe et la vise, `demande` porte le statut `TRANSFORMEE` qui n'existe que par elle. **Ce qui n'est PAS une opinion, mais une mesure de rang 2 :** la clause de société SEULE est exclue — RG-DRO-01 dit qu'un client n'accède qu'à son propre périmètre, `intervention` porte `client_id` et `site_id`, et un compte portail sous la forme « société » lirait **toutes** les interventions de sa société. C'est la fuite mesurée le 07/09 sur `utilisateur_client`, à l'identique. **Le plancher est donc la forme « parc »** (société ET `app.client_id` ET `app.perimetre_sites`), et `TABLES_PARC` gagnerait une cinquième entrée — une ADDITION, que le gardien admet, le RETRAIT étant le sens qu'il refuse. **Ce qui reste à trancher est la SECONDE moitié : RG-DRO-02.** Elle promet au technicien *« les machines de ses interventions, plus l'intégralité du parc des clients chez qui il a une intervention planifiée dans les 7 jours »* — une **troisième dimension qu'aucune des neuf formes ne porte**, et elle serait la dixième. *Mesuré sur la base jetable, sous un rôle NON privilégié, avec témoin (zéro ligne sans contexte) :* la fenêtre EST exprimable en RLS — `technicien = app.technicien` ET `date_planifiee <= now()::date + 7` rend **1 ligne sur 2** au technicien concerné, la seconde étant hors fenêtre. **Et le coût est d'une espèce nouvelle dans ce dépôt : la visibilité d'une ligne changerait SANS QU'AUCUNE ÉCRITURE N'AIT LIEU.** `now()` est stable dans une transaction (mesuré), donc une requête reste cohérente ; mais entre deux requêtes le même compte voit un autre ensemble. Deux conséquences de méthode : les fixtures se datent **relativement** à `now()`, jamais en absolu, et le jumeau d'un refus pourrait passer parce que **l'horloge a bougé** plutôt que parce que le verrou a cédé. **Trois voies :** *(a)* « parc » maintenant, RG-DRO-02 au lot 3 avec L3-07 — le technicien lit tout le parc de sa société en attendant, ce qui est **exactement l'état d'aujourd'hui** pour `client`, `site` et `machine` ; *(b)* « parc » **plus** la dixième forme tout de suite — le plus fort, et il faut alors que `app.technicien_id` soit **renseignable et validée** par la base, jamais seulement posée (la leçon de D70) ; *(c)* autre chose. *Lecture de la session : **(a)**, parce que la restriction manque déjà sur trois tables et qu'elle se pose d'un seul geste quand elle se posera ; et parce qu'introduire une politique dépendante de l'horloge mérite son propre ticket, pas un effet de bord de la création d'`intervention`.* **Je ne tranche pas : c'est du cloisonnement** |
| Lot 3 | Reconnaissance de plaque signalétique — **retirée du périmètre V1** faute de solution hors ligne raisonnable ; à réévaluer si un moteur embarqué léger apparaît |
| Lot 4 | Grille tarifaire des contrats, types proposés en premier |
| **Lot 5** | **Repli de consolidation portable (D36)** : fonction `SECURITY DEFINER`, et mot de passe de `codiplan_reporting` déposé dans `REPORTING_DATABASE_URL`.<br>**ET DEUX GARDIENS DU LOT 0 LE REFUSERONT** *(inscrit le 31/08/2026, ticket R0-a, écart É1 de la revue R0)*. **La première ligne du repli portable fait passer `pnpm verify` au rouge, deux fois.** C'est le comportement voulu des deux gardiens ; ce qui manquait, c'est que le lot 5 le sache **avant** de commencer plutôt que de le découvrir dans l'urgence.<br>1. `motifRefusReporting` (`lib/db/garde-role.ts`) **refuse la connexion de consolidation quand `BYPASSRLS` manque** — « sans lequel la consolidation multi-sociétés ne lirait que la société active ». Or le repli de D36 existe **précisément pour l'hébergeur qui ne peut pas accorder `BYPASSRLS`** : le garde refusera donc exactement la configuration que le repli est fait pour servir. Remède prévu : `motifRefusReporting` distingue **chemin rapide** et **repli**, et n'exige `BYPASSRLS` que du premier.<br>2. `tests/unit/db/security-definer-sous-arbitrage.test.ts` **échoue sur toute fonction `SECURITY DEFINER` apparaissant dans une migration**, liste d'exceptions **close et vide**. Le repli **EST** une fonction `SECURITY DEFINER`. Remède prévu : D36 entre **nommément** dans la liste d'exceptions de D50 — ce qui est un arbitrage, pas une décision de ticket, et doit donc être pris avant l'écriture du repli. |
| **Lot 7** | **Déblocage d'un `admin_societe` ayant perdu son second facteur (D40)** : exécutable par `admin_plateforme` seul, journalisé dans `journal_acces` |
| Lot 7 | Opérateur SMS, structure juridique, plafond de responsabilité ; durcissement de la visibilité des comptes entre sociétés |
| ~~**Question POSÉE le 09/09/2026, sans réponse par défaut** *(D83)*~~ **TRANCHÉ le 10/09/2026** *(D89)* — **PAR INTERVENTION, SANS EXCEPTION.** | ~~**Le plancher d'une heure s'applique-t-il PAR INTERVENTION, ou PAR SITE ET PAR JOUR ?** D83 pose le plancher et le laisse **par intervention**, comme l'arrondi de D57 — c'est-à-dire par la maille déjà tranchée, et non par un choix nouveau. **La conséquence chiffrée, mesurée :** deux interventions courtes sur le même site le même jour facturent **deux heures** ; sous la maille « site et jour » elles en factureraient **une**. Un facteur deux sur un mode d'exploitation ordinaire — la tournée qui repasse l'après-midi finir le matin. *Ce n'est pas une modalité d'implémentation : c'est le prix que paie un client, et c'est pourquoi rien n'est tranché ici.* Aucune valeur par défaut n'est déguisée en réponse : le code d'aujourd'hui applique la maille de D57, et le jour où l'exploitation répond « par site et par jour », c'est un **amendement de D83** et non un réglage. Déclencheur : la première facture réelle portant deux interventions le même jour sur le même site~~ — tranché le 10/09/2026, voir **D89**, qui porte la variante connue et sa condition de réouverture. Ligne conservée : un point tranché se raye, il ne s'efface pas |

---

## Une remarque sur la méthode

**Ce que cette seconde note démontre.** Les soixante points de la note n°1 venaient d'une **lecture** ; ceux qui précèdent viennent d'une **livraison**. Écrire le code a fait apparaître ce qu'aucune relecture n'avait vu : une énumération fermée trop tôt, une catégorie de tables laissée à l'interprétation, un rôle de base de données traité comme une connexion ordinaire, et trois refus qui, mis côte à côte, formaient un annuaire de clients. Aucun de ces points n'était une erreur d'exécution — tous étaient des trous de spécification que seule l'exécution pouvait révéler.

Deux d'entre eux — D39 et D40 — ont d'ailleurs été **soumis et non tranchés** dans un premier temps : la session qui les avait relevés s'est arrêtée devant une liste close et une règle de sécurité, comme le §8 du CLAUDE.md l'impose. Un troisième, `parite`, a suivi le même chemin et est devenu D41.

**Ce que D41 ajoute à la méthode.** Les trois premiers oublis étaient le même oubli, répété : une liste fermée, une table créée plus tard, personne pour revenir la ranger. Tant qu'on réparait cas par cas, on ne réparait rien — le quatrième était déjà en route, et il est effectivement apparu au premier passage du gardien (`societe`). La leçon n'est pas « mieux relire les listes » : c'est **ne jamais laisser une liste close être la seule source de vérité sur ce qu'elle prétend couvrir.** Un gardien qui part de la réalité et interroge la liste vaut mieux que dix relectures de la liste.

**Ce que D42 y ajoute.** Le quatrième cas n'était pas un quatrième oubli : `societe` était cloisonnée, éprouvée, inventoriée — seule la phrase de l'invariant ne la décrivait pas. Un gardien qui part de la réalité ne trouve donc pas que des tables mal rangées : il trouve aussi **les règles dont la rédaction n'a jamais couvert ce qu'elles prétendaient couvrir**. D'où la seconde leçon : **un invariant qui a des exceptions doit les énumérer, pas les sous-entendre** — et énumérer une exception, c'est créer une liste close de plus, donc un gardien de plus.

La conséquence pratique : **arbitrer après le premier ticket d'un domaine, pas seulement avant** ; ne jamais laisser une session compléter une liste close, fût-ce d'une évidence ; et **doubler toute liste close d'un gardien d'exhaustivité** qui la confronte à ce qui existe.

*Note d'arbitrage n°2 — CODIPLAN — 20 août 2026*


---

# CODIPLAN — Note d'arbitrage n°3

**Trois points relevés à la revue de la livraison D42**

| | |
|---|---|
| **Objet** | Une source de rang 1 fausse, une frontière de module, et une question jamais posée |
| **Portée** | D43 à D45 |
| **Statut** | Décisions arrêtées — même autorité que les notes n°1 et n°2, qu'elle complète et ne remplace pas |
| **Date** | 21 août 2026 |
| **Ticket** | L0-06c |

### D43 — `7 000 XPF`, et non `7 000 F` : un texte de ticket n'est pas une source de vérité

**Le texte du ticket écrivait « F » par inadvertance**, contre D19 qui écrit `7 000 XPF` et qui est de **rang 1**. La session n'a rien changé au code : c'est la bonne conduite, et elle est ici confirmée comme règle. Un énoncé de ticket est de **rang 4** dans la hiérarchie du CLAUDE.md ; il ne peut pas amender un arbitrage, fût-ce par une lettre. Une session qui aurait « corrigé » le formatage aurait fait passer une décision commerciale — comment la monnaie s'affiche devant un client — pour une correction de détail.

**Rien ne change dans le code.** D19 dit `7 000 XPF`, la maquette l'écrit ainsi, et `prisma/seed-data.ts` porte `symbole: null` pour le XPF, ce qui produit exactement cet affichage par la convention « symbole si la devise en a un, code sinon ».

**Mais la question est réelle et elle est inscrite au registre**, avec son **déclencheur explicite** : elle sera tranchée à la **conception du premier document destiné à un client** — devis, facture ou rapport d'intervention. C'est là que la question se pose pour de bon, parce que c'est là qu'un lecteur néo-calédonien lit le montant. Et si le choix se porte alors sur `F`, ce sera un **amendement de D19 et une ligne de seed**, décidés comme tels — jamais une modification discrète glissée dans un ticket d'affichage.

### D44 — D19 est corrigé, pas contourné : la conversion vit dans `lib/reporting`

**Décisions amendées :** D19

**L'invariant I2, le §6 du CLAUDE.md et le ticket disaient tous `lib/reporting`. D19 seul disait `lib/money`** — « `lib/money` expose deux fonctions distinctes », dont `convertForConsolidation`. Trois sources contre une, et la seule dissidente était de **rang 1**.

**Une source de rang 1 qu'on sait fausse est plus dangereuse qu'une source absente.** Une source absente fait poser la question ; une source fausse fait confiance. Le prochain lecteur de D19 aurait logé la conversion dans `lib/money` **en respectant la hiérarchie**, et il aurait eu raison de le faire. C'est exactement la maladie que D1 devait éradiquer : la même règle écrite à deux endroits avec des variantes, jusqu'à ce que personne ne sache laquelle fait foi.

**D19 est donc amendé, et non contourné.** La frontière de conversion s'écrit désormais : `formatMoney` dans `lib/money`, `convertForConsolidation` dans **`lib/reporting`**. La rédaction d'origine est conservée en note sous la décision — un amendement qui efface sa trace se rejoue au prochain doute. **Vérification faite sur les autres sources** : `docs/backlog.md` (L0-07) portait encore l'ancienne formulation, il est corrigé ; le CLAUDE.md (I2 et §6) et le chapitre 10 (RG-TAR-02) étaient déjà justes.

### D45 — L'arrondi au quart d'heure appartient à la valorisation

**Ni `lib/calendar`, ni `lib/money`.** Le calendrier répond à **« quand »** : jours ouvrés, horaires d'agence, fériés, fuseau. Il n'a pas à connaître la politique de facturation — sinon un changement de tarif pourra casser un planning, et le gardien calendrier se mettra à défendre deux règles qui n'ont aucune raison d'évoluer ensemble. Le module monétaire, lui, répond à **« combien s'écrit comment »** : formatage et arithmétique. L'arrondi au quart d'heure supérieur ne répond à aucune des deux questions : il dit **ce qu'on facture**, et il appartient au **module de valorisation** — ticket **L2-09**, où D11 est désormais rangé.

**Et une question que personne n'avait posée.** L'arrondi au quart d'heure supérieur s'applique-t-il **à chaque intervention** ou **au total d'une journée** ? Cinq passages de cinq minutes font **1 h 15** dans le premier cas et **30 minutes** dans le second — un facteur deux et demi sur la facture, sur le type de tournée le plus courant en dépannage urbain. D11 dit « au total par technicien et par intervention, jamais ligne par ligne » : cela règle l'agrégation **à l'intérieur** d'une intervention, et ne dit rien **entre interventions**.

C'est une **décision commerciale**, pas une modalité d'implémentation. Elle doit être prise **avant** que la valorisation ne soit écrite, pas pendant : une session qui découvrirait la question au milieu de L2-09 la trancherait par le plus simple à coder, et le premier client qui compterait ses quarts d'heure la découvrirait à sa facture. Inscrite au registre « Ce qui reste à décider » avec pour échéance **avant L2-09**.

---

## Une remarque sur la méthode

**Les trois points ont la même forme : une règle qui n'était pas là où on la cherchait.** Le symbole du XPF dans un texte de ticket plutôt que dans D19 ; la frontière de conversion dans D19 en contradiction avec trois autres sources ; l'arrondi dans un module qui n'a aucune raison de le connaître. Aucun n'était un défaut de code — les trois étaient des défauts de **rangement**, et c'est le troisième ticket d'affilée où le rangement est le vrai sujet.

**Ce que D44 ajoute à D1.** D1 disait : une règle ne s'écrit qu'à un seul endroit. D44 y ajoute le cas où le mal est déjà fait : **quand deux sources divergent, on corrige la fausse, on ne s'aligne pas sur la vraie en silence.** Contourner D19 — écrire le code juste et laisser la décision fausse — aurait produit un dépôt correct et une constitution menteuse. C'est la pire des deux erreurs, parce qu'elle ne se voit pas à l'exécution.

*Note d'arbitrage n°3 — CODIPLAN — 21 août 2026*


---

# CODIPLAN — Note d'arbitrage n°4

**Deux points soulevés par la livraison du module calendrier**

| | |
|---|---|
| **Objet** | Une sixième entrée à une liste close, et une divergence de vocabulaire au chapitre 10 |
| **Portée** | D46 et D47 |
| **Statut** | Décisions arrêtées — même autorité que les notes n°1 à n°3, qu'elle complète et ne remplace pas |
| **Date** | 21 août 2026 |
| **Ticket** | L0-08 |

### D46 — `jour_ferie` rejoint les référentiels de plateforme

**Décisions amendées :** D13

**Le point, soumis avant d'être tranché.** Le ticket L0-08 demande une table de jours fériés « par territoire et par date, alimentée par seed ». Une telle table ne porte pas de `societe_id` : elle est donc un **référentiel de plateforme** au sens de la deuxième catégorie de I1 — dont la liste est **close**. Le §8 du CLAUDE.md interdit qu'une session la complète, et le gardien d'exhaustivité de D41 aurait fait échouer la vérification. La session s'est donc arrêtée et a soumis la question, comme D39, D40 et D41 avant elle.

**La décision.** `jour_ferie` **rejoint la liste close**, qui devient : `devise`, `parite`, **`jour_ferie`**, `famille_materiel`, `modele_materiel`, `checklist_modele`.

**Le raisonnement est celui de D41 pour `parite`, mot pour mot.** Le 14 juillet est un **fait du territoire**. Il ne dépend d'aucune société, et deux sociétés opérant en Nouvelle-Calédonie n'ont aucune raison d'en tenir deux listes qui pourraient diverger — pas plus qu'elles ne tiennent deux parités du franc Pacifique. La clé de la table est le couple `(territoire, date)` : c'est la juridiction qui décide des jours fériés, pas l'entreprise. Régime identique à `devise` et `parite` : **lecture pour toutes les sociétés, écriture réservée aux rôles éditeur**, pas de `FORCE ROW LEVEL SECURITY` pour que le propriétaire puisse amorcer le référentiel.

**Ce que `jour_ferie` ne dit PAS, et qui reste cloisonné.** Elle dit ce qui **est férié**, jamais ce qui est **chômé**. RG-PLA-02 pose qu'« un férié n'est pas systématiquement chômé » et D13 que « le férié porte un booléen `travaille` », rattaché au calendrier de l'agence. Ce booléen vit donc dans **`calendrier_ferie`**, table métier portant `societe_id NOT NULL`, avec `calendrier` et `calendrier_plage`. **Trois tables cloisonnées, une seule partagée** — et c'est la ligne de partage qui compte : les faits du territoire sont communs, les décisions d'ouverture appartiennent à chaque société.

**L'option écartée, et son coût.** Porter les fériés dans la seule table `calendrier_ferie`, avec date et libellé, n'aurait touché à aucune liste close. Elle aurait aussi recopié la liste néo-calédonienne dans chaque calendrier de chaque agence de chaque société ; deux sociétés d'un même territoire auraient pu diverger sans que rien ne le signale, et ouvrir un territoire au lot 7 se serait fait calendrier par calendrier. Le ticket dit « par territoire » ; l'éviter aurait consisté à déformer la base pour ne pas avoir à prendre une décision.

**Trois gardiens accompagnent la décision**, chacun éprouvé d'abord sur un cas fabriqué puis sur une violation réelle introduite temporairement : aucun identifiant de fuseau hors du schéma et de son seed, aucune date fériée en dur, aucune lecture de la date courante sans fuseau explicite. Détail dans `docs/decisions/2026-08-21-module-calendrier.md`.

#### D46, complément 1 — le territoire n'est pas le fuseau, et ne s'en déduit jamais

**`Europe/Paris` couvre plusieurs territoires aux jours fériés différents.** L'Alsace-Moselle y chôme le Vendredi saint et le 26 décembre, le reste de la métropole non. Un code qui écrirait `territoire = fuseau.startsWith("Pacific") ? "NC" : "FR"` aurait l'air juste sur les deux sociétés du jeu de démonstration et se tromperait chez le premier client strasbourgeois — **en silence**, puisque le planning proposerait simplement des créneaux un jour chômé.

**L'agence porte donc DEUX attributs distincts et indépendants**, documentés côte à côte :

| Attribut | Format | Question à laquelle il répond |
|---|---|---|
| `agence.fuseau_horaire` | identifiant IANA — `Pacific/Noumea` | **Quelle heure il est** |
| `agence.territoire` | ISO 3166-1 alpha-2 — `NC`, `FR` | **Quels jours sont fériés** |

Ni l'un ni l'autre ne se calcule à partir de l'autre. Le territoire quitte la table `calendrier`, où il avait été posé au premier jet : deux agences de territoires différents peuvent parfaitement partager des horaires, et le calendrier ne porte plus que des HEURES.

**Le format est contrôlé, la liste des codes ne l'est pas.** Un `CHECK` en base et un schéma Zod exigent deux lettres majuscules ; aucune liste de pays n'est recopiée — elle vieillirait, et le ticket dit expressément qu'un client sur un autre territoire aura les siens.

**Trois gardiens, et non un.** Le gardien statique `territoire-independant-du-fuseau` refuse toute rencontre des deux mots dans une même expression — affectation, signature de fonction, table de correspondance, `fuseau.split()`. Le jeu de fixtures d'isolation est rendu **adversaire** : l'agence B y surcharge son fuseau pour valoir celui de l'agence A tout en gardant un territoire différent, si bien que tout code qui déduirait l'un de l'autre tombe dans la suite d'isolation. Et un scénario unitaire éprouve le comportement : même fuseau, deux territoires, deux jeux de fériés.

**`agence.territoire` est NULLABLE, et c'est délibéré.** Il n'existe aucun défaut légitime — un `DEFAULT 'NC'` serait un territoire codé en dur, exactement ce que le ticket interdit. Une agence sans territoire n'a donc pas de fériés ; mais cela ne dure pas en silence : `chargerCalendrierAgence` refuse de rendre un calendrier, et le contrôle d'horizon la nomme à chaque `verify:full`.

#### D46, complément 2 — l'ordre de lecture, écrit noir sur blanc

**Le fait public d'abord, l'écart local ensuite. Jamais l'inverse.**

1. **`jour_ferie`** porte le **fait public du territoire** — ce qui EST férié. Référentiel de plateforme : lisible par tous, écrivable par les seuls rôles éditeur.
2. **`calendrier_ferie`** porte **l'écart local** — ce que l'agence en fait. Table métier, `societe_id NOT NULL` **et `agence_id NOT NULL`**.

Lire dans l'autre sens donnerait à une agence le pouvoir de décréter un férié pour son territoire, ce qui n'appartient à aucune entreprise — et que les politiques de la base refusent déjà. `appliquerEcarts`, dans `lib/calendar/calendrier.ts`, est **le seul endroit du dépôt où les deux sources se rencontrent** ; l'ordre y est écrit une fois pour toutes, et `tests/unit/calendar/ordre-de-lecture.test.ts` ne fait que le prouver, y compris par l'absurde.

**`agence_id` et non `calendrier_id`**, bien que la table porte le mot « calendrier ». Plusieurs agences partagent un calendrier d'ouverture (D13), mais un pont est la décision d'**une** agence : Ducos et Dolbeau ouvrent aux mêmes heures et divergent sur la veille de Noël. Le jeu de démonstration porte précisément ce cas.

**Deux écarts, une seule table.** Un **férié travaillé** (`jour_ferie_id` renseigné, `travaille = true` — RG-PLA-02) ; un **pont** propre à l'entreprise (`jour_ferie_id` nul, `travaille = false`), c'est-à-dire un jour ordinaire que l'agence chôme. Une **clé étrangère composite** vers `jour_ferie(id, date)` empêche la date de l'écart de diverger de celle du fait public qu'il surcharge : la redondance est rendue sûre par la base, pas par une convention.

**L'écart ne crée pas d'horaires**, il autorise ou retire ceux du jour de semaine. Les horaires vivent dans `calendrier_plage`, à un seul endroit.

#### D46, complément 3 — l'horizon des jours fériés

**Le point que personne n'avait soulevé.** Les jours fériés sont **datés**. Une table alimentée aujourd'hui cessera de connaître les fériés dans deux ans, et le planning proposera des créneaux un 1ᵉʳ mai sans rien signaler. **Aucun test ordinaire ne le verra** : la table ne sera pas vide, elle sera **périmée** — et un décompte non nul ressemble beaucoup trop à des données justes.

Trois pièces, et elles ne se séparent pas :

1. **Un horizon GLISSANT dans le seed** — année en cours plus deux, l'année en cours étant lue **dans le fuseau de la société** (le 1ᵉʳ janvier n'arrive pas au même instant à Nouméa et à Paris). Jamais une liste d'années écrite à la main : elle serait juste aujourd'hui et fausse en 2029, et sa fausseté serait silencieuse.
2. **Un script versionné pour étendre** — `pnpm feries:etendre`. Il ajoute les années manquantes pour les territoires déjà présents dans `agence`, sans jamais modifier une ligne existante, et **refuse d'extrapoler** un territoire inconnu de `FERIES_FIXES` : les fériés d'un nouveau territoire sont une décision, pas une déduction.
3. **Un contrôle daté dans `verify:full`** — `pnpm feries:horizon`. Il échoue si un territoire présent dans la table `agence` a moins de **douze mois** de jours fériés devant lui, et **le message nomme le territoire et la dernière date connue**. Il échoue aussi sur une agence sans territoire, et sur zéro territoire — une base vide produit le même silence qu'une base à jour, ce qui n'est pas la même chose.

Douze mois : c'est la durée d'un cycle d'échéances préventives (RG-CON-01) et celle d'une comparaison N/N-1 à jours ouvrés constants (chapitre 8). En deçà, un planning peut être posé au-delà de ce que la table connaît.

**C'est le principe des gardiens du lot 0 appliqué au temps.** Une donnée qui se périme en silence vaut une liste close que personne ne surveille : elle garde l'autorité d'une donnée et prend le contenu d'un oubli. La leçon est inscrite au §9 du CLAUDE.md.

### D47 — RG-PLA-01 et RG-PLA-02 disent « site » là où D5 impose « agence »

**La divergence.** Le chapitre 10 — source de **rang 2** — écrit : « Le calendrier d'ouverture est propre à chaque **site** : Ducos du lundi au samedi, Koné du lundi au vendredi » (RG-PLA-01), et « les jours fériés sont paramétrés par société et par **site** » (RG-PLA-02). Or D5 — **rang 1** — a tranché que **Ducos, Koné et Dolbeau sont des agences CODIMA, pas des sites clients**, et a imposé le vocabulaire : « ces deux mots ne sont jamais interchangeables ». Les exemples cités par RG-PLA-01 sont donc des **agences** ; la règle dit « site » en désignant des agences.

**Ce n'est pas une ambiguïté résiduelle, c'est le mot fautif que D5 avait déjà corrigé** — resté au chapitre 10 parce que D5 corrigeait le glossaire et non chaque règle. La hiérarchie des sources tranche seule : D5 l'emporte, I7 le confirme (« calendriers propres à chaque agence »), et le code n'avait aucune décision à prendre.

**La rédaction retenue** pour RG-PLA-01 et RG-PLA-02, qui remplace celle du chapitre 10 :

> **RG-PLA-01** — Le calendrier d'ouverture est propre à chaque **agence** : Ducos du lundi au samedi, Koné du lundi au vendredi. Aucun calendrier global unique n'est valide pour l'ensemble des agences.
>
> **RG-PLA-02** — Les jours fériés sont **des données du territoire** (D46) ; leur caractère chômé ou travaillé est paramétré **par agence**, via le calendrier. Un férié n'est pas systématiquement chômé.

**Règles amendées :** RG-PLA-01, RG-PLA-02

**Les horaires d'un SITE client ne disparaissent pas pour autant** : ils existent, la table `site` les portera au lot 1, et D13 leur donne leur place exacte — le contrôle « site fermé » produit un **avertissement, jamais un blocage**. La distinction est donc utile, et c'est une raison de plus pour que les deux mots ne se confondent pas.

---

## Une remarque sur la méthode

**Le rangement, encore — et c'est le quatrième ticket d'affilée.** D46 est le cinquième cas d'une même série : une liste close, une table créée plus tard, et la question « où va-t-elle ? ». À la différence des quatre premiers, celui-ci **n'est pas un oubli** : le gardien d'exhaustivité de D41 a posé la question **le jour où la table a été écrite**, avant même qu'elle ne soit écrite. La série D34–D41 se réparait après coup ; celle-ci s'est arrêtée avant. C'est exactement ce que D41 promettait, et c'est la première fois qu'on l'observe.

**Ce que D47 ajoute à D44.** D44 disait : quand deux sources divergent, on corrige la fausse. D47 en montre un cas où la fausse est de **rang 2** et la vraie de **rang 1** — l'ordre normal, donc, et pourtant la source fautive avait survécu à l'arbitrage qui la corrigeait. La leçon est étroite mais utile : **un arbitrage qui corrige un mot doit dire où ce mot est écrit**, sinon il corrige le glossaire et laisse les règles.

**Et une épreuve qui a payé.** Les trois gardiens du ticket ont été éprouvés sur des violations réellement introduites dans le code, puis retirées. L'un des sept essais est passé au travers : l'interdiction d'appeler le calcul de Pâques depuis le métier ne voyait que la forme lointaine de l'import (`lib/calendar/paques`) et laissait passer la forme proche (`./paques`) — c'est-à-dire **la seule qui pouvait réellement être écrite**, puisque le métier voisin est dans le même répertoire. Un gardien vert sur un cas fabriqué n'est pas un gardien éprouvé.

*Note d'arbitrage n°4 — CODIPLAN — 21 août 2026*

---

# CODIPLAN — Note d'arbitrage n°5

**Le point que la note n°4 avait laissé ouvert au registre**

| | |
|---|---|
| **Objet** | Un écart local pouvait s'adosser au férié d'un autre territoire, ce que devient un calendrier quand l'agence change de territoire, et jusqu'où un refus a le droit de s'expliquer |
| **Portée** | D48, D49 et D50 |
| **Statut** | Décisions arrêtées — même autorité que les notes n°1 à n°4, qu'elle complète et ne remplace pas |
| **Date** | 23 et 24 août 2026 |
| **Ticket** | L0-09a |

### D48 — Le territoire d'un jour férié référencé : chaînage de clés, et `agence.territoire` obligatoire

**Le point, constaté en base et inscrit au registre.** La livraison de L0-08 a
trouvé, et vérifié contre un vrai PostgreSQL, qu'une agence de territoire `NC`
pouvait écrire dans `calendrier_ferie` une ligne dont le `jour_ferie_id`
désignait un férié `FR` tombant le même jour. La clé étrangère composite
`(jour_ferie_id, date)` empêche les **dates** de diverger, pas les
**territoires**. La portée était faible — `appliquerEcarts` compose par date, le
planning restait juste — mais `jour_ferie_id` cessait de vouloir dire ce que son
nom annonce. Deux options avaient été soumises ; touchant le schéma et la forme
de I1, elles ne se tranchaient pas en séance.

**La décision : on ferme en base, par CHAÎNAGE DE CLÉS.** Même mécanique que
celle qui empêche déjà les dates de diverger — c'est PostgreSQL qui refuse, et
aucun chemin d'écriture n'y échappe. `calendrier_ferie` porte une colonne
`territoire`, et deux clés étrangères composites la tiennent des deux côtés à la
fois :

| Clé | Cible | Contrôlée quand |
|---|---|---|
| `(agence_id, territoire)` | `agence(id, territoire)` | **toujours** — aucune colonne nullable |
| `(jour_ferie_id, date, territoire)` | `jour_ferie(id, date, territoire)` | dès que `jour_ferie_id` est renseigné |

L'agence fixe le territoire de l'écart, le fait public doit s'y conformer. Les
deux clés ne peuvent pas être satisfaites en même temps par un férié d'ailleurs :
faire concorder l'écart avec le fait public le fait diverger de son agence.

**L'option écartée, et pourquoi.** Un contrôle applicatif aurait suffi
aujourd'hui, où un seul chemin écrit dans cette table. Il y en aura d'autres :
l'import Excel du lot 1, la synchronisation hors ligne du lot 2, la console
éditeur du lot 7. Un contrôle applicatif protège les chemins qu'on connaît ; une
contrainte de base protège aussi ceux qu'on écrira dans trois ans sans avoir relu
D46.

**`agence.territoire` devient `NOT NULL`, et c'est le cœur de la décision.** Une
clé étrangère dont une colonne vaut NULL n'est **pas contrôlée** en PostgreSQL
(`MATCH SIMPLE`, la règle par défaut) : le chaînage aurait été muet exactement là
où la donnée manque, c'est-à-dire chez l'agence la moins bien paramétrée. Un
verrou qui s'ouvre tout seul sur les cas mal renseignés est pire qu'une absence
de verrou — il donne le sentiment d'une garantie. La migration **refuse de
s'appliquer** si une ligne existante est vide, en nommant l'agence et sa société,
plutôt que d'inventer une valeur : il n'existe aucun défaut légitime, et un
`DEFAULT 'NC'` serait le territoire codé en dur que D46 interdit.

**La redondance est dite, pas glissée.** Oui, le chaînage impose une colonne
`territoire` sur `calendrier_ferie`. Elle ne porte aucune information nouvelle —
elle est toujours celle de l'agence, et la base refuse toute autre valeur. Elle
n'existe que pour rendre la contrainte **déclarative** : sans colonne portée par
la ligne, aucune clé étrangère ne peut relier en un seul geste l'agence et le
fait public. **Une redondance qui rend une contrainte déclarative n'est pas une
duplication de données : c'est le prix du verrou.**

**Ce que le NULL reste.** `jour_ferie_id` demeure nullable : c'est le **pont**, un
jour ordinaire que l'agence chôme, sans fait public en face. `MATCH SIMPLE`, qui
rendait l'option dangereuse sur `agence.territoire`, la rend ici utile — et le
pont n'échappe pas pour autant à la première clé, qui tient son territoire.

**Ce que le contrôle d'horizon perd, et pourquoi c'est un gain.** Le rapport
« agence sans territoire » de `pnpm feries:horizon` disparaît : il existait parce
que rien en base ne l'empêchait. La garantie a changé de nature — d'un rapport
nocturne qui **nommait** une agence fautive à une contrainte qui l'**empêche**
d'exister.

#### D48, ce que l'épisode enseigne — une colonne nullable et le moment où elle devient obligatoire

**Une colonne nullable posée « faute de défaut légitime » est un choix honnête,
et elle devient obligatoire au moment où une contrainte s'appuie dessus. Ce
moment est le bon, pas plus tard.**

`agence.territoire` avait été posée nullable à bon droit : il n'existait aucune
valeur par défaut qui ne soit pas un mensonge, et l'imposer d'emblée aurait fait
échouer la migration sur une base portant déjà des agences. Elle est aujourd'hui
renseignée partout, et le coût de l'obligation ne sera **jamais plus bas** :
deux sociétés, quatre agences, uniquement des données de démonstration. Attendre,
c'est le payer au centuple — et, entre-temps, laisser un verrou muet sur les
lignes qu'il devait précisément protéger.

Le corollaire vaut pour la suite : **poser une contrainte sur une colonne
nullable, c'est poser une contrainte facultative**. Chaque fois qu'une clé
composite s'appuiera sur une colonne « pas encore obligatoire », la question à
trancher n'est pas « peut-on chaîner quand même » mais « rend-on la colonne
obligatoire maintenant, ou renonce-t-on au chaînage ».

**Et une épreuve, encore, plutôt qu'une déclaration.** Trois retraits réels, pas
un cas fabriqué. Chaque refus du chaînage a, dans la suite d'isolation, un jumeau
qui **retire réellement la contrainte** dans une transaction annulée et montre
que l'écriture fautive passe alors — il rejoue à chaque `pnpm verify`. Le
chaînage a ensuite été retiré de la migration elle-même : six scénarios sont
passés au rouge. Enfin, les deux préalables de la migration ont été éprouvés sur
une base réelle portant les données fautives — et le second a montré que la ligne
« agence `NC`, férié `FR`, même date » **était bel et bien acceptée** par le
schéma L0-08. Le défaut n'était pas théorique.

### D49 — Le territoire d'une agence ne se change pas en silence : aucune propagation

**Le point, soulevé par le chaînage de D48 et non tranché par lui.** Que se
passe-t-il si le territoire d'une agence change ? Le cas est réel et banal — une
faute de saisie corrigée trois semaines plus tard.

**Il avait été répondu sans être décidé.** `ON UPDATE CASCADE` est le défaut de
Prisma ; il avait été recopié dans la migration. **Vérifié en base, et non déduit
du code**, voici ce qu'il produisait :

| Contenu du calendrier de l'agence | Effet de `UPDATE agence SET territoire = …` |
|---|---|
| Uniquement des **ponts** | **Réécriture silencieuse** des écarts. `UPDATE 1`, pas un mot |
| Au moins un **férié travaillé** | Échec, mais en désignant `jour_ferie` — pas le vrai problème |

Une même correction qui **passe ou casse selon le contenu du calendrier**, et qui
ne dit jamais ce qu'elle a fait. Le cas qui réussit est le plus dangereux :
c'est celui qui ne prévient pas.

**La décision : PAS de `ON UPDATE CASCADE`.** `RESTRICT` des deux côtés du
chaînage. Un changement de territoire **invalide réellement** les écarts de
calendrier de cette agence — ils désignent les fériés d'ailleurs. Le refus de
PostgreSQL est le bon comportement : mieux vaut bloquer et forcer une décision
humaine que laisser une correction anodine réécrire un calendrier en silence.
`RESTRICT` vaut **aussi** vers `jour_ferie` : corriger la date d'un fait public
ne doit pas réécrire en silence l'écart d'une société.

**Un message à côté du verrou, jamais à sa place.** `RESTRICT` refuse en parlant
de clés ; il dit que c'est interdit, pas quoi faire. Le déclencheur
`agence_territoire_verrou_ecarts` lève avant lui, nomme l'agence, les deux
territoires, le décompte des écarts et leurs dates extrêmes, et donne la marche
à suivre. **Retiré, la clé refuse encore** — le verrou reste déclaratif, le
déclencheur n'est qu'une voix, et un test éprouve les deux séparément.

**La procédure** — traiter les écarts, PUIS changer le territoire — est écrite
dans `docs/decisions/2026-08-24-territoire-agence-sans-propagation.md` et
rappelée dans le message d'erreur lui-même. Une agence sans écart change de
territoire sans obstacle : le verrou ne gêne que le cas où il y a réellement
quelque chose à décider.

#### D49, ce que l'épisode enseigne — une action référentielle est une règle de gestion déguisée

**`ON UPDATE CASCADE` n'avait été décidé par personne.** C'était un défaut,
recopié. Il répondait pourtant tout seul à une question qui appartient au
métier : que devient un calendrier quand l'agence change de territoire ? **Une
valeur par défaut qui répond à une question qu'on n'a pas posée est une décision
prise par personne** — et c'est le même enchaînement que le délai de transaction
de 5 000 ms qui avait fait échouer le seed, une valeur écrite pour une autre
géographie et jamais choisie.

Corollaire pratique : **toute clé étrangère nouvelle dit ses DEUX actions, et les
justifie**. `ON DELETE` était déjà regardé — supprimer, c'est visible.
`ON UPDATE` ne l'était pas, au motif que « les identifiants ne changent jamais ».
C'est vrai des identifiants techniques ; c'est faux de toutes les colonnes
métier qu'un chaînage fait entrer dans une clé.

**Et l'épreuve par retrait a mordu sur elle-même.** Le premier gardien écrit pour
D49 passait au vert **avec `CASCADE` rétabli** : la propagation échouait alors
sur la clé du fait public, et le motif d'erreur générique s'en accommodait. Seul
le retrait réel l'a montré. C'est la deuxième fois en deux tickets — et c'est ce
qui fait passer l'épreuve par retrait du rang de bonne pratique à celui de forme
attendue, inscrite au §9 du CLAUDE.md.

### D50 — Un message d'erreur est un canal d'information : il est soumis au cloisonnement

**Le point, né d'une question posée sur D49.** Le chaînage porte `ON UPDATE
RESTRICT` des deux côtés, mais un seul des deux refus a un déclencheur
explicatif. Côté `jour_ferie` — une date de férié saisie de travers, corrigée un
mois plus tard alors qu'une agence a posé un écart dessus — PostgreSQL répond en
nommant une contrainte et un UUID. Un refus juste, illisible : exactement le
défaut que D49 venait de corriger côté agence.

**La demande était de recopier le modèle. La mesure a montré qu'il ne se
transpose pas.** Un prototype à l'identique — `SECURITY INVOKER`, décompte des
écarts —, exécuté sous le SEUL rôle qui peut écrire dans `jour_ferie`, voit
**0 écart** là où la vérité en compte 1. L'écrivain est un rôle éditeur, qui par
construction n'a aucune société active (§22.5) ; `calendrier_ferie` est
cloisonnée en `FORCE ROW LEVEL SECURITY`, tandis que les contrôles d'intégrité
référentielle s'exécutent hors RLS. C'est pourquoi la clé refuse correctement
pendant que le déclencheur est aveugle. **Recopié, le jumeau serait du code mort
dans le seul chemin réel.**

**Et lui donner la vue serait une fuite.** Une fonction `SECURITY DEFINER`
détenue par un rôle `BYPASSRLS` ferait d'un message d'erreur un lecteur
inter-sociétés. **Un décompte apprendrait à un salarié de l'éditeur combien
d'agences clientes chôment ce jour-là** — depuis un simple refus, sans avoir
jamais lu une table.

**La décision.** Le verrou reste, le message attend la console éditeur du lot 7
(ticket L7-02). Et le principe est inscrit au CLAUDE.md, au pied de I1 : **un
message d'erreur est un canal d'information, soumis au cloisonnement comme une
requête.** Un refus a le droit d'être **lisible**, jamais d'être **informatif** :
il dit ce qui bloque et la marche à suivre ; il ne compte pas et ne nomme pas ce
que son destinataire n'a pas le droit de lire.

**Ce qui rend la décision tenable, et c'est le point le plus important.**
L'asymétrie — un déclencheur d'un côté, rien de l'autre — **ressemble de loin à
un oubli**, et un oubli appelle quelqu'un pour le corriger, c'est-à-dire pour
recopier le déclencheur en `SECURITY DEFINER`. La correction irait exactement
dans la direction dangereuse. La note est donc posée **à l'endroit de la
tentation** et pas seulement dans la décision : `COMMENT ON` sur la fonction, sur
le déclencheur et sur la contrainte concernée, déposés dans la base même par la
migration `20260824040000` — `\df+` les montre —, et dans le commentaire du
modèle `CalendrierFerie` du schéma.

**Un gardien vaut mieux qu'une note**, et celui-ci ferme la porte plutôt que de
la signaler : `tests/unit/db/security-definer-sous-arbitrage.test.ts` échoue si
une fonction `SECURITY DEFINER` apparaît dans une migration. La liste
d'exceptions est **close et vide** ; le repli de consolidation de D36 (lot 5) y
entrera par arbitrage, avec son nom écrit — jamais par une décision de session
qui trouverait le gardien encombrant.

**Deux épreuves, et la première a corrigé le gardien.** Écrit d'abord pour
ignorer les commentaires `--`, il a refusé la note de D50 elle-même : la phrase
qui énonce la règle vit dans une chaîne de `COMMENT ON`, et un gardien qui
interdit d'écrire sa raison d'être apprend surtout à ne plus l'écrire. La coupure
juste n'était pas « commentaires » mais **documentation contre exécution** —
`COMMENT ON` ne crée rien, tout le reste est examiné, chaînes littérales
comprises. Ensuite, la violation a été **réellement écrite** dans un fichier de
migration, sous la forme qu'un correcteur bien intentionné lui donnerait — un
jumeau `jour_ferie_correction_verrou_ecarts` —, et `pnpm test` est passé au
rouge en la nommant.

*Note d'arbitrage n°5 — CODIPLAN — 23 et 24 août 2026*

---

# CODIPLAN — Note d'arbitrage n°6

**Une question de lisibilité posée par le ticket, et tranchée par le calcul**

| | |
|---|---|
| **Objet** | Ce qu'on écrit sur la couleur qu'un client a choisie |
| **Portée** | D51 |
| **Statut** | Décision arrêtée — même autorité que les notes n°1 à n°5, qu'elle complète et ne remplace pas |
| **Date** | 28 août 2026 |
| **Ticket** | L0-09 |

### D51 — Le contraste se calcule, il ne se refuse pas

**Ratifiée le 28 août 2026.** Et ce qui emporte la décision n'est pas le calcul,
c'est l'argument **opérationnel** : un refus posé sur un formulaire ne garde que
ce formulaire, tandis que les couleurs arriveront aussi par **import Excel** et
par **reprise de données**. Le rendu est le point de passage obligé. C'est le
principe de L0-04 — le filtrage ne vaut que là où tous les chemins passent —
appliqué à l'affichage. Le calcul, lui, dit seulement que la voie retenue tient
sa promesse.

**Le point, posé par le ticket lui-même.** La charte d'une société est un
paramétrage (RG-SOC-06) : un client change ses couleurs sans qu'on redéploie.
Un client choisira donc un **jaune pâle**, et du texte blanc posé dessus sera
illisible — dans une application qu'un technicien lit **au soleil**, sur un
écran de téléphone. Deux voies étaient ouvertes : refuser la couleur à la
saisie, ou choisir l'encre selon le fond.

**Le chiffre, avant la décision.** Le seuil appliqué est **4,5:1** — WCAG 2.1,
critère de succès 1.4.3 « Contrast (Minimum) », niveau AA, texte courant ;
**3:1** pour le grand texte et pour les éléments non textuels (critères 1.4.3 et
1.4.11). Mesuré sur le cas du ticket : du blanc sur `#fff9c4` donne **1,07:1**,
soit quatre fois sous le seuil.

**La décision : le choix automatique de l'encre**, et il se démontre plutôt
qu'il ne se plaide. Entre le noir et le blanc, le meilleur des deux ne descend
jamais sous **√21 ≈ 4,5826:1** sur aucun fond sRGB — le pire fond possible est
celui de luminance relative `√(1,05 × 0,05) − 0,05 ≈ 0,1791`, qui contraste
aussi mal avec l'un qu'avec l'autre, et c'est le minimum de la fonction.
**4,58 > 4,5** : le seuil AA est franchi **par construction**. Sur le jaune pâle,
l'encre calculée est noire et donne 19,60:1.

**Pourquoi pas le refus à la saisie.** Il ne garantit rien de plus — le calcul
garantit déjà le seuil — et il coûte davantage : la solution est **vendue**, et
refuser une couleur revient à refuser l'identité visuelle d'un client, qui
choisira alors « la couleur la plus proche que le logiciel accepte ». Surtout,
un refus posé sur un formulaire ne tient que ce formulaire : la couleur est une
donnée, elle arrivera aussi par un import, une reprise, une console d'éditeur.
Le choix de l'encre, lui, est fait au **rendu** — le seul point par lequel tous
les chemins d'écriture passent.

**Ce qui reste refusé à la saisie est d'une autre nature** : une valeur qui
n'est pas une couleur sRGB. Un schéma Zod et une contrainte `CHECK` en base la
refusent, éprouvée par retrait comme le §9 l'exige. **Refus de forme, jamais de
teinte.**

**Le cas inverse est traité à part, et nommé.** Le choix de l'encre couvre le
texte posé SUR la couleur. La couleur de société employée elle-même comme encre
sur la surface de l'application reste illisible si elle est pâle : une troisième
variable est donc calculée par déplacement de la seule **clarté**, teinte et
saturation conservées. La couleur d'origine n'est jamais altérée — elle reste le
fond.

**Et ce déplacement est GARANTI, question posée à la revue.** Une clarté
déplacée n'a aucune garantie a priori — c'est le noir et le blanc qui en ont
une. Celle-ci repose sur trois faits, et sur eux seuls : *(1)* les extrémités de
la clarté HSL sont le noir et le blanc **purs**, quelles que soient la teinte et
la saturation, puisque `C = (1 − |2L − 1|) × S` s'annule aux deux bouts ; *(2)*
la direction du déplacement est celle de **l'encre lisible du fond**, jamais
devinée, si bien que la fin de la course EST cette encre ; *(3)* la course
atteint toujours son extrémité. Conséquence : **tout seuil inférieur ou égal à
√21 est atteint, sur n'importe quel couple couleur/fond**, et le seuil AA en
fait partie. Au-delà, le seuil peut être hors d'atteinte et la fonction le
**dit** au lieu de le taire. La frontière est mesurée, et elle tombe exactement
où le calcul l'annonce : à √21 elle tient sur les 1 728 couples couleur/fond
balayés par le test, à √21 + 0,01 elle cède sur le pire fond.

**Une société sans charte reçoit le thème neutre CODIPLAN**, défini une seule
fois et identifié comme LE défaut. Les deux colonnes de couleur deviennent
nullables pour cela : « société sans charte » doit être un état représentable,
sinon le provisionnement d'un client inventerait deux couleurs, et plus personne
ne distinguerait ensuite un choix d'un remplissage.

Détail, mesures et options écartées :
`docs/decisions/2026-08-28-thematisation-par-societe.md`.

### Ce que la note n°6 ajoute au registre

| Échéance | Point |
|---|---|
| **À la première demande d'un client** *(D51)* | **Logo de société.** Hors périmètre de L0-09, et pour une raison qui n'est pas la difficulté du rendu : l'afficher suppose un **stockage de fichiers**, décision d'architecture à part entière — hébergement, quotas, purge, accès cloisonné aux objets. La colonne `societe.logo_url` existe depuis L0-03 et le mécanisme de thème ne l'empêche pas : le logo entrera par le même chemin que les couleurs, une colonne lue de plus. Rien n'est construit aujourd'hui |
| **Lot 3** *(D51)* | **Faut-il viser 7:1 sur l'application terrain, et par quelle voie ?** Le seuil AAA de WCAG 2.1 (critère 1.4.6) est de 7:1, et un écran de téléphone en plein soleil est le cas qui le justifierait. Il n'est **pas** atteignable par le seul choix noir/blanc : sur un fond de luminance moyenne, ce choix plafonne à 4,58:1 — propriété de la fonction, pas limite d'implémentation. **Trois voies, et non deux.** *(a)* S'en tenir à 4,58 sur l'application terrain comme ailleurs. *(b)* **Déplacer la couleur du client** jusqu'à 7:1 — le mécanisme sait le faire, mais il faut alors trancher : à partir de quel écart la charte d'un client cesse-t-elle d'être la sienne ? *(c)* **L'application technicien ne porte pas l'identité visuelle du client** : elle sert le thème neutre à contraste maximal et n'emprunte à la société que son NOM. C'est un outil qu'on lit au soleil, pas une vitrine — le back-office et le portail, eux, restent à la charte. Le mécanisme la permet déjà sans rien changer : le thème neutre existe, il est identifié comme le défaut, et un segment de routes peut le servir sans lire la société. À trancher **avec** le lot de l'application technicien, pas après |
| **Lot 3** *(D51)* | **Mesurer le coût du rendu dynamique sur un téléphone en réseau dégradé.** Lire la session pour choisir des couleurs rend chaque page dynamique : c'est la conséquence nécessaire d'un thème qui est une donnée, et elle est acceptée. Le risque est **borné** — l'application technicien fonctionne hors ligne (I4), et une page qui ne part pas sur le réseau ne paie pas ce coût — mais il **se mesure, il ne se suppose pas**. Rien à faire aujourd'hui : la mesure demande le module terrain, et elle se fait sur un vrai téléphone en réseau calédonien, jamais sur un chiffre de laboratoire. Si le coût s'avère réel, la voie *(c)* de la ligne précédente le supprime au passage — une page qui sert le thème neutre n'a aucune session à lire |

## Une remarque sur la méthode

**Un gardien peut en contredire un autre, et ce n'est pas toujours une faute.**
Le gardien des parités (L0-07) refuse tout décimal à quatre chiffres ou plus
dans le code applicatif. Les coefficients de luminance de WCAG 2.1 — `0,2126`,
`0,7152`, `0,0722`, et le seuil `0,04045` — ont exactement cette forme sans être
des taux. Deux issues étaient possibles : contourner le motif en écrivant les
coefficients sous forme de fractions, ou exempter.

**Contourner aurait été la mauvaise.** Le motif lit le fichier brut : écrire
`2126 / 10000` aurait rendu le code incomparable au texte de la norme **et
interdit jusqu'à citer les coefficients en commentaire**. C'est exactement la
faute que le gardien `SECURITY DEFINER` de D50 avait commise puis corrigée — un
gardien qui interdit d'écrire sa raison d'être apprend surtout à ne plus
l'écrire.

**Mais la première exemption écrite était trop large, et la revue l'a vu.**
Elle exemptait le **répertoire** `lib/theme/` ; or ce qui mérite exemption, ce
sont **quatre constantes nommées**, pas l'endroit où elles vivent. Un fichier
futur de ce répertoire qui aurait écrit un taux fabriqué serait passé au travers
— le trou existait le jour même où l'exemption a été posée. L'exemption porte
donc désormais sur les **valeurs**, où qu'elles soient dans le dépôt, bornées
des deux côtés pour que `10,2126` et `0,21267` restent pris ; et un scénario
éprouve la fermeture du trou en écrivant un taux fabriqué **dans un vrai fichier
de `lib/theme/`**, qui est bien refusé.

**La règle générale, et c'est la troisième fois qu'elle se vérifie.** Après
`CLOISONNEE_PAR_IDENTITE` et la liste close des tables techniques : **une
exemption est aussi étroite que le fait qui la fonde, et elle est gardée.** Un
répertoire, un fichier, un préfixe de chemin sont des commodités de rédaction —
jamais des faits. Le fait, ici, tient en quatre nombres et une référence de
norme.

*Note d'arbitrage n°6 — CODIPLAN — 28 août 2026*

---

# CODIPLAN — Registre ouvert par le ticket L0-10

**Trois questions posées par le journal d'audit, et non tranchées en séance**

| | |
|---|---|
| **Objet** | Ce que le journal d'audit laisse ouvert |
| **Portée** | Registre — **aucune décision arrêtée ici** |
| **Statut** | À arbitrer. Rien de ce qui suit n'a l'autorité des notes n°1 à n°6 |
| **Date** | 29 août 2026 |
| **Ticket** | L0-10 |

Le ticket L0-10 est livré sous la **voie A** ci-dessous, la seule qui n'exige
aucun arbitrage : aucune liste close n'a été élargie, aucune catégorie de I1 n'a
été créée. Les trois questions attendent une décision écrite.

### R1 — Le journal des RÉFÉRENTIELS DE PLATEFORME *(question ouverte)*

Le journal porte `societe_id NOT NULL` et relève de la première catégorie de I1.
`devise`, `parite` et `jour_ferie` n'ont aucune société à porter : ou bien le
journal ne les couvre pas, ou bien son `societe_id` cesse d'être obligatoire, ou
bien il faut une cinquième catégorie.

| Voie | Ce qu'elle coûte | Ce qu'elle laisse |
|---|---|---|
| **A — ne pas les couvrir** *(implémentée)* | rien : c'est le périmètre de I8 et de D32, où ces trois tables n'ont jamais figuré | une correction éditeur sur un férié n'est pas tracée. Le trou est antérieur au ticket, et il a déjà une maison probable — `journal_acces`, qui enjambe les sociétés par construction (D34) |
| **B — `societe_id` nullable** | un arbitrage, forcément : le gardien d'exhaustivité de D41 ne reconnaît la première catégorie qu'à un `societe_id` obligatoire, et une colonne nullable range la table dans **zéro** catégorie | **une brèche de lecture** : la forme D4 est `= app.societe_id OR societe_id IS NULL`, si bien qu'une ligne à société nulle serait lisible par toutes les sociétés — dans la table même qui porte les valeurs avant/après de tout le métier |
| **C — cinquième catégorie de I1** | un arbitrage, une liste close de plus à surveiller, et la définition d'un cloisonnement propre | le risque exact que D42 a écarté : élargir la règle à « cloisonnée d'une manière ou d'une autre » ferait entrer sans décision la table suivante qui s'en réclamerait. Et le précédent va dans l'autre sens — `journal_acces` est en troisième catégorie **parce qu'il ne porte aucune valeur métier**, ce qui est faux du journal d'audit |

**Recommandation portée par le ticket : la voie A.** Elle est la seule à ne
demander aucun arbitrage, la seule conforme au périmètre déjà unifié par D32, et
la seule où le cloisonnement en lecture est **structurel** — `NOT NULL` rend
impossible la ligne lisible par tous, sans qu'aucune vigilance n'ait à s'exercer.
Elle est en outre tenue par la base et non par une intention : le déclencheur
**refuse d'écrire** sur une table qui n'expose aucune société, et deux scénarios
d'isolation le mesurent.

Mesures et conséquences détaillées :
`docs/decisions/2026-08-29-journal-audit-par-declencheur.md`, section 3.

### R2 — La POLITIQUE DE CONSERVATION du journal *(hors périmètre, à nommer)*

Un journal grossit sans fin. Combien de temps le garde-t-on, et qu'en fait-on
ensuite ? La question est **réglementaire autant que technique**. Le §15 du
cahier des charges avance « conservé 5 ans » ; il est narratif, donc non normatif
(D1), et le chiffre attend d'être ratifié.

**Et le ticket vient de lui donner une conséquence technique qu'il vaut mieux
nommer maintenant : purger suppose de supprimer, c'est-à-dire exactement la clé
que l'ajout seul retire.** Aucun rôle ne peut aujourd'hui effacer une ligne du
journal — ni `codiplan_app`, dont les privilèges d'écriture sont retirés, ni le
propriétaire, faute de politique `DELETE` sous `FORCE ROW LEVEL SECURITY`. Une
politique de conservation devra donc décider **qui** purge et **par quel
chemin**, et ce chemin sera par construction une brèche dans la propriété qu'on
vient d'établir. C'est une décision d'architecture, pas une tâche planifiée.

Rien n'est construit aujourd'hui, et c'est délibéré : construire une purge avant
d'avoir la durée reviendrait à inventer un délai (CLAUDE.md §8).

**Le dilemme est écarté par l'arbitrage du 30 août : on ne supprimera pas de
lignes, on détachera des périodes.** Une table partitionnée par mois se purge en
détachant une partition — du DDL, pas du DML. Aucun rôle ne gagne jamais
`DELETE`, la propriété d'ajout seul reste **littéralement** vraie, et la purge
passe par le canal des migrations : tracée, délibérée, impossible par
inadvertance. La mesure de son échéance est en note n°7 ci-dessous.

### R3 — `utilisateur_societe` appartient-il au périmètre d'audit ? — **TRANCHÉE par D52**

Question portée le 29 août, arbitrée le 30 : **oui**. Voir la note d'arbitrage
n°7 ci-dessous. La table est couverte depuis le même ticket, et le gardien
`tests/unit/db/perimetre-audit.test.ts` la **réclame** au lieu de la refuser.

*Registre ouvert par le ticket L0-10 — CODIPLAN — 29 août 2026*

---

# CODIPLAN — Note d'arbitrage n°7

**Le périmètre de la traçabilité, et l'échéance de la purge**

| | |
|---|---|
| **Objet** | Ce que le journal d'audit couvre, et comment il se purgera |
| **Portée** | D52 ; réponse à R2 et R3 |
| **Statut** | D52 : décision arrêtée, même autorité que les notes n°1 à n°6. La section « échéance » est une MESURE et une recommandation, pas une décision |
| **Date** | 30 août 2026 |
| **Ticket** | L0-10 |

## D52 — `utilisateur_societe` entre au périmètre de l'audit, et I8 énumère désormais des TABLES

**Décisions amendées :** D32

**Amendé par D55.**

**La décision.** `utilisateur_societe` est journalisée. C'est la table des
habilitations, et **la modifier est l'acte le plus lourd de conséquences du
système : c'est ainsi qu'on se donne un accès.** Accorder `admin_societe` à un
compte, c'est lui donner le droit d'ouvrir des comptes chez le client.
« Qui a accordé ce droit, quand, depuis quelle valeur » est la question qu'un
auditeur posera chez un client, et c'est elle qui rend **vérifiable** la
procédure de déblocage de D40 (ticket L7-01) : sans cette ligne, la procédure
existerait sans preuve qu'elle a été suivie.

La table porte `societe_id NOT NULL`. Elle entre donc **par la voie A de R1**,
sans élargir aucune liste close, sans nouvelle catégorie de I1, et sa ligne
d'audit est cloisonnée comme les autres.

**Et surtout : on corrige la source du doute, pas le doute** *(méthode de D44)*.
I8 énumérait des **notions** — « paramétrage société », « compte client » —
qu'il fallait interpréter pour savoir ce qui était couvert. Une règle
interprétable n'est pas une règle close : la session qui a livré L0-10 a eu
raison de ne pas ranger seule `utilisateur_societe`, mais la prochaine table
ambiguë reposera la même question, et rien ne garantit qu'on s'arrêtera une
seconde fois. **I8 énumère désormais des TABLES**, chacune avec son lot, et
l'ambiguïté disparaît là où elle était née.

**Ce que l'énumération rend possible, et qui n'existait pas avant : la clôture
DANS LES DEUX SENS.** Tant que le périmètre était une liste de notions, le
gardien ne pouvait refuser qu'un élargissement **nommé d'avance** — il fallait
avoir prévu la table qu'on craignait. Depuis D52, la comparaison est exacte :
une table du périmètre présente au schéma sans déclencheur échoue, **et** un
déclencheur posé sur une table absente de la liste échoue aussi, quelle qu'elle
soit. Éprouvé dans les deux sens sur des violations réellement écrites dans la
migration puis retirées — le déclencheur d'`utilisateur_societe` supprimé, puis
un déclencheur ajouté sur `session`.

**Une remarque de méthode, et c'est la quatrième fois.** Après
`CLOISONNEE_PAR_IDENTITE`, la liste close des tables techniques et l'exemption
des coefficients WCAG : **une règle est aussi close que sa formulation le
permet.** Une liste de notions a l'autorité d'une décision et le contenu d'une
interprétation — c'est le défaut du 19/08 sous une autre forme. Le remède est
toujours le même : nommer, au lieu de laisser déduire.

**Règles amendées :** RG-DRO-04

## L'échéance de la purge — MESURE et recommandation, pas décision

*La voie est arrêtée : on détachera des partitions, on ne supprimera pas de
lignes. Reste à savoir QUAND adopter le partitionnement, puisque PostgreSQL ne
convertit pas une table ordinaire en table partitionnée sur place.*

### Ce que la conversion exige réellement

`CREATE TABLE … PARTITION BY RANGE` sur une table neuve, création des
partitions mensuelles et d'une partition `DEFAULT`, `INSERT … SELECT` intégral,
reconstruction des deux index, `DROP` de l'ancienne table et `RENAME`.

Deux conséquences qui ne se voient pas dans cette énumération :

1. **La clé primaire change.** PostgreSQL exige que la clé de partitionnement
   appartienne à toute contrainte d'unicité : `PRIMARY KEY ("id")` devient
   `PRIMARY KEY ("id", "horodatage")`. Aujourd'hui cela ne coûte rien —
   **aucun code du dépôt ne lit `journal_audit` par le modèle Prisma**, tout
   passe par du SQL. Au lot 5 ou 7, la console d'administration le lira.
2. **La copie doit prendre `ACCESS EXCLUSIVE` D'EMBLÉE.** Sans le verrou, les
   écritures survenues *pendant* la copie seraient **perdues** — la copie a déjà
   lu la table. La durée de la conversion **est** donc une fenêtre
   d'indisponibilité. Et elle ne porte pas que sur le journal : **toute écriture
   métier insère dans `journal_audit` par le déclencheur**, si bien que la
   fenêtre est une indisponibilité en écriture de **l'application entière**.

### La mesure

PostgreSQL 16, disque local, cache chaud. Procédure complète, verrou compris,
deux exécutions par volume. Lignes de forme réelle : deux copies `jsonb` d'une
ligne d'intervention plausible, soit ≈ 2,1 ko par ligne d'audit.

| Volume | Taille de la table | Fenêtre d'indisponibilité |
|---|---|---|
| **50 lignes** — la démonstration, aujourd'hui | 104 ko | **0,11 s** et 0,14 s |
| **100 000 lignes** — deux ans, hypothèse haute | 210 Mo | **2,4 s** et 3,4 s |
| **500 000 lignes** — dix ans, ou plusieurs clients | 1 049 Mo | **17,0 s** et 17,4 s |

*D'où vient le volume à deux ans.* Chapitre 11.3 : 600 à 1 500 interventions par
an ; la matrice de transitions de D8 en compte huit statuts, soit une dizaine
d'écritures par intervention en comptant rapport, valorisation et clôture — 15
à 22 000 lignes par an. Plus les fiches machine (800 à 2 500, quelques écritures
chacune), les contrats, le paramétrage et les comptes. **Ordre de grandeur réel :
25 000 à 30 000 lignes par an, donc 50 000 à 60 000 à deux ans.** Les 100 000
lignes mesurées sont donc une hypothèse **haute d'un facteur deux**, et les
500 000 correspondent à dix ans ou à un parc client bien plus large.

*Ce que ces chiffres ne disent pas.* Ils sont un **plancher**, pas une
prévision : disque local, cache chaud, aucune concurrence. Sur un stockage
réseau, le rapport entre les trois lignes tient — la conversion est linéaire en
volume — mais les valeurs absolues montent.

### Décision : **la table NAÎT partitionnée, dans L0-10** *(arrêtée le 30 août)*

*La recommandation ci-dessous a été acceptée, et resserrée : pas de ticket
ultérieur. La migration n'ayant touché aucune base réelle, le §7 permet de la
corriger sur place — et **créée partitionnée, la migration de reprise n'existe
jamais, ni la fenêtre d'indisponibilité qu'elle porterait.** Le meilleur moyen
de ne pas payer une reprise est de n'avoir jamais à la faire.*

### Recommandation d'origine : **partitionner tout de suite**

Trois raisons, dans cet ordre.

1. **Le coût est aujourd'hui de 0,11 seconde sur une table de 104 ko.** Il sera
   de quelques secondes à deux ans, et de vingt à dix ans — chaque fois comme
   **indisponibilité en écriture de toute l'application**, pas seulement du
   journal. Ce n'est pas un coût qui s'amortit en attendant : il ne fait que
   croître, linéairement, et il porte sur le service rendu aux clients.
2. **L'échéance choisie tomberait au pire moment.** « Avant que la première
   donnée de production réelle n'entre » signifie, en pratique : le jour où l'on
   provisionne le premier client. C'est-à-dire le jour où l'on veut le moins
   jouer une migration qui réécrit intégralement la table d'audit — et où l'on
   sera le plus tenté de la reporter « après la mise en service ». Une échéance
   qui se présente au moment le plus défavorable n'est pas une échéance, c'est
   un report.
3. **La clé primaire change, et c'est aujourd'hui que ce changement est
   gratuit.** Aucun code ne lit `journal_audit` par le modèle Prisma. Chaque lot
   qui passe rapproche du moment où quelque chose le lira.

*Et pour être juste envers l'autre voie : elle est GARDABLE, contrairement à ce
qu'on pourrait croire.* Un contrôle daté existerait — `controle-cloisonnement.mts`
énumère déjà les sociétés à chaque migration contre la base hébergée, et pourrait
échouer le jour où une société hors du jeu de démonstration apparaît alors que la
table n'est pas partitionnée. C'est la condition que la décision du 20/08 sur la
purge de démonstration a déjà écrite. L'argument contre le report n'est donc pas
« on l'oublierait » — c'est le **coût croissant** et le **moment défavorable**.

*Ce qui a été livré, et rien de plus :* la table créée partitionnée ; la clé
primaire portée à `("id", "horodatage")` — PostgreSQL exige la clé de
partitionnement dans toute contrainte d'unicité ; une partition `DEFAULT`
**obligatoire**, sans quoi une écriture dont l'horodatage sort des partitions
existantes échouerait — et ferait échouer l'écriture métier avec elle, le
déclencheur vivant dans sa transaction ; le mois courant et douze suivants ; et
**deux** contrôles datés dans `verify:full`, un préventif et un détectif. **Et deux contrôles plutôt qu'un, c'est le point ajouté à la revue.** Le
**préventif** — `pnpm audit:partitions`, horizon de douze mois, sur le modèle de
`pnpm feries:horizon` — protège du problème. Le **détectif** — la partition
`DEFAULT` doit être **vide** — prouve qu'il ne s'est pas produit, ce que le
premier ne peut pas faire : si une partition a manqué, l'écriture a **réussi**,
et la ligne rangée par défaut est le seul signal qui en subsiste. Les deux sont
indépendants dans les deux sens, et c'est mesuré : l'horizon amputé fait mordre
le préventif pendant que le détectif reste vert, une ligne rangée par défaut fait
l'inverse. Mesuré aussi, le coût qui croît : **une fois une ligne du mois M
rangée par défaut, PostgreSQL refuse de créer la partition de M** — « updated
partition constraint for default partition would be violated by some row ». Le
détectif ne signale donc pas une imperfection, il signale une réparation qui
devient plus chère chaque jour.

### Ce que la mise en œuvre a trouvé, et qui n'était pas dans la mesure

**Un partitionnement naïf aurait détruit les deux invariants du ticket.** Mesuré
avant d'être corrigé : une partition est une **table**, elle hérite donc
d'`ALTER DEFAULT PRIVILEGES` — `SELECT, INSERT, UPDATE, DELETE` au rôle
applicatif sur toute table nouvelle — et elle n'hérite **pas** des politiques du
parent, qui ne s'appliquent que si l'on interroge le parent. Sous le rôle
applicatif, contexte de la société A : par le parent, 1 ligne vue, le
cloisonnement tient ; **en nommant la partition, 2 lignes vues dont celle d'une
autre société, `UPDATE` les réécrit toutes, `DELETE` les efface.** Dans la table
qui porte les valeurs avant/après de tout le métier.

D'où le durcissement — `REVOKE ALL` et `FORCE ROW LEVEL SECURITY` sans politique
— appliqué à chaque partition, présente et à venir, **par la même fonction qui la
crée** : les séparer serait garantir qu'un jour une partition naisse sans l'un
des deux. Le routage des lignes n'exige aucun privilège sur la partition (mesuré
également), le durcissement ne coûte donc rien. La leçon est inscrite au §9 du
CLAUDE.md.

**L'idempotence du seed est INCHANGÉE — vérifiée, pas supposée.** Trois
exécutions successives de `pnpm db:seed` sur une base vierge : 50 lignes d'audit
après la première, 50 après la troisième, 50 identifiants distincts, toutes
rangées dans la partition du mois courant et **aucune** par défaut. La clé
composite ne touche rien, pour une raison simple : le seed n'écrit jamais
`journal_audit`, c'est le déclencheur qui l'écrit — et seulement quand une ligne
change réellement.

**La durée de conservation elle-même reste ouverte (R2).** Le partitionnement ne
la décide pas : il rend seulement la purge possible sans jamais accorder de
`DELETE`. Le pas mensuel convient à toute durée exprimée en mois ou en années.

*Note d'arbitrage n°7 — CODIPLAN — 30 août 2026*


---

# CODIPLAN — Registre ouvert par le ticket R0-b

**Deux points du chapitre 10 qu'aucune décision ne rédige**

| | |
|---|---|
| **Objet** | Ce que l'alignement des chapitres 10 et 11 n'a pas pu appliquer |
| **Portée** | Registre — **aucune décision arrêtée ici** |
| **Statut** | À arbitrer. Rien de ce qui suit n'a l'autorité des notes n°1 à n°7 |
| **Date** | 31 août 2026 |
| **Ticket** | R0-b, écart É8 de `docs/revue-r0-fin-de-lot-0.md` |

Le ticket R0-b applique au texte les décisions déjà prises ; il n'en interprète
aucune. Deux points ne sont pas rédigés par la décision qui les prescrit : ils
sont laissés en l'état, signalés dans le texte, et posés ici.

### R4 — La rédaction exacte de RG-DRO-04 — **TRANCHÉE par D53**

D32 tranche : « le périmètre retenu est celui de I8 … RG-DRO-04 est **alignée
dessus** ». À la date de D32, I8 énumérait des **notions** — intervention,
contrat, machine, paramétrage société, compte client — et l'alignement se
lisait tout seul. D52 a remplacé ces notions par une **liste de tables**, et
c'est ce remplacement qui rouvre la question : *aligner sur une liste de tables*
peut vouloir dire deux choses, et aucune des deux décisions ne dit laquelle.

| Voie | Ce qu'elle donne | Ce qu'elle coûte |
|---|---|---|
| **A — RG-DRO-04 renvoie à I8** | « Toute création, modification ou suppression sur une table du périmètre de traçabilité **défini par l'invariant I8** est journalisée avec auteur, horodatage et valeurs avant/après. » Une seule écriture de la liste, donc aucun risque de divergence — c'est la leçon du 19/08 | une règle de **rang 2** qui renvoie au CLAUDE.md, lequel n'a pas de rang dans la hiérarchie du §1. Le chapitre 10 cesse d'être lisible seul |
| **B — RG-DRO-04 énumère les dix tables** | le chapitre 10 reste lisible seul, conformément à « une règle métier ne s'écrit qu'au chapitre 10 » | **la même liste écrite à deux endroits** — le défaut du 19/08 exactement, et celui qui a produit soixante points d'ambiguïté. Il faudrait alors un gardien de plus pour tenir les deux listes accordées |
| **C — l'inverse : I8 renvoie au chapitre 10** | la liste vit là où les règles métier vivent, et le CLAUDE.md la cite | I8 est un invariant du dépôt, pas seulement une règle produit ; le gardien `tests/unit/db/perimetre-audit.test.ts` lit aujourd'hui le CLAUDE.md |

**Réponse : aucune des trois voies ci-dessus.** Voir **D53** — la liste n'a
qu'une maison, et c'est celle que la machine lit.

### R5 — La fenêtre de 24 heures de RG-IMP-02, et le rang de « seul le dernier lot est annulable » — **TRANCHÉE par D54**

D15 prescrit une substitution **littérale** : « annulable intégralement »
devient « annulable, avec refus motivé sur les lignes modifiées ou référencées
depuis ». Elle a été appliquée telle quelle. Deux choses restent en suspens, et
ni D15 ni le ticket L1-08 ne les tranchent :

1. **La fenêtre de 24 heures survit-elle ?** La substitution ne la touche pas,
   donc elle est restée. Elle a un point d'appui au chapitre 11
   (`import_lot.date_limite_annulation`) mais **aucun critère d'acceptation ne
   la vérifie** — c'est le constat de la revue R0 : elle « n'a plus de maison ».
2. **Où vit « seul le dernier lot est annulable » ?** C'est une règle de gestion
   au sens plein, elle figure dans le tableau de D15 et dans le critère
   d'acceptation de L1-08 — mais **dans aucune RG du chapitre 10**. D15 ne dit
   pas qu'elle y entre, et l'y écrire serait interpréter.

Les deux se combinent, et c'est ce qui rend la question réelle : deux imports
qui se recouvrent à moins de 24 heures d'intervalle rendent le premier
inannulable **avant la fin de sa fenêtre**. Une règle qui promet 24 heures et
une autre qui les retire ne peuvent pas cohabiter sans qu'on dise laquelle
l'emporte.

**Réponse : les deux bornes sont supprimées.** Voir **D54**.

*Registre R0-b — CODIPLAN — 31 août 2026*


---

# CODIPLAN — Note d'arbitrage n°8

**Où vit une liste close, et ce qu'on fait d'une borne devenue mesurable**

| | |
|---|---|
| **Objet** | D53 et D54 — réponses à R4 et R5 du registre R0-b |
| **Portée** | Décisions arrêtées, même autorité que les notes n°1 à n°7 |
| **Date** | 1ᵉʳ septembre 2026 |
| **Ticket** | R0-b |

## D53 — Le périmètre d'audit n'a qu'une maison, et c'est celle que la machine lit

**Décisions amendées :** D32

**Amendé par D55.**

**La décision.** Le périmètre du journal d'audit s'écrit **une seule fois**,
dans `scripts/lib/perimetre-audit.ts`. **RG-DRO-04 est réécrite** pour y
renvoyer, l'invariant I8 y renvoie, le README y renvoie ; **aucun ne le
recopie**. La onzième table s'ajoutera à un seul endroit parce qu'il n'y en aura
qu'un.

**Pourquoi ni « énumérer » ni « renvoyer à I8 ».** Le registre R0-b posait la
question entre deux voies, et toutes deux acceptaient la prémisse fausse : que
la liste vive dans un document. Énumérer au chapitre 10 aurait écrit la même
liste à deux endroits — le défaut du 19/08, celui qui a produit soixante points
d'ambiguïté. Renvoyer à I8 aurait fait dépendre une règle de rang 2 d'un
document sans rang, sans supprimer pour autant la vraie duplication : le
gardien portait déjà, lui, une **troisième** copie.

**Et cette troisième copie était le vrai défaut, découvert en répondant.** Le
gardien `tests/unit/db/perimetre-audit.test.ts` recopiait le périmètre « en
toutes lettres », délibérément, au motif que « c'est la constitution qui est
confrontée au dépôt ». L'argument ne tient pas à l'examen : **rien ne
confrontait la recopie à la constitution.** Deux listes qui pouvaient diverger
en silence, dont l'une serait restée juste et l'autre serait devenue fausse sans
rougir — c'est É8 une catégorie plus bas, et cela se serait produit le jour où
une onzième table serait entrée par arbitrage.

L'indépendance du gardien ne venait pas de la recopie. Elle vient de ce qu'il
confronte la liste aux **migrations** et au **schéma**, deux sources qu'il ne
contrôle pas — et cela n'a pas bougé.

**L'objection « le chapitre 10 doit se lire seul » se règle par une référence
explicite.** Un lecteur de RG-DRO-04 sait où est la liste ; il ne risque pas
d'en lire une périmée, ce qui est exactement le risque qu'une recopie lui
faisait courir. Une référence coûte un aller-retour ; une copie coûte une
divergence.

**C'est gardé.** Un test vérifie que le CLAUDE.md, le chapitre 10 et le README
citent le chemin et n'énumèrent pas le périmètre, et il est éprouvé sur une
recopie fabriquée : « aucune recopie trouvée » et « le détecteur ne sait pas en
trouver » se ressemblent trait pour trait.

**Règles amendées :** RG-DRO-04

## D54 — La fenêtre de 24 heures et le rang du dernier lot sont supprimés

**Décisions amendées :** D15

**La décision.** **RG-IMP-02 est réécrite** : l'annulation d'un import n'est
bornée **ni par un délai, ni par le rang du lot**. La règle « seul le dernier
lot est annulable » est retirée de D15, et `import_lot.date_limite_annulation`
disparaît du chapitre 11.

**Ce que ces deux bornes approchaient.** Toutes deux répondaient, faute de
mieux, à une seule question : *cette annulation peut-elle encore faire des
dégâts ?* Vingt-quatre heures était une approximation du temps qu'il faut pour
qu'une donnée importée soit reprise ; « seul le dernier lot » une approximation
du recouvrement entre deux imports. Ni l'une ni l'autre ne mesurait quoi que ce
soit — elles pariaient.

**Or D15 amendé mesure la chose directement**, ligne par ligne : une ligne
modifiée depuis l'import est refusée, une ligne référencée depuis est refusée, le
reste est restauré. Garder les bornes par-dessus ce critère revient à **refuser
une annulation dont on peut prouver qu'elle est sans danger**, et à faire perdre
une journée à qui découvre son erreur le lendemain matin.

**Et le critère mesuré traite MIEUX le cas qui avait motivé le rang.** Deux
imports qui se recouvrent : la règle du dernier lot refusait le premier
**en entier**, y compris ses lignes que le second n'a jamais touchées. Le
critère ligne à ligne refuse exactement les lignes touchées, avec leur motif, et
laisse passer les autres. La borne était donc à la fois plus permissive dans un
sens — elle autorisait l'annulation du dernier lot sans regarder ce qu'il avait
écrasé — et plus brutale dans l'autre. C'est cette conséquence qui justifie la
suppression, et non un allègement.

**Ce qui ne change pas.** L'annulation reste **partielle et sûre**, jamais
totale et destructrice ; le rapport d'annulation liste toujours ce qui a été
restauré et ce qui ne pouvait pas l'être ; et la traçabilité du lot
(`import_lot`, `import_lot_ligne.valeurs_avant`) est inchangée — c'est elle qui
rend le critère calculable, et c'est pourquoi la borne peut tomber.

**Règles amendées :** RG-IMP-02

*Note d'arbitrage n°8 — CODIPLAN — 1ᵉʳ septembre 2026*

## D55 — Le périmètre d'audit est INVERSÉ : audité par défaut, exempté par écrit

**Décisions amendées :** D32, D52, D53

**La décision.** **RG-DRO-04 est réécrite.** Le périmètre du journal d'audit
cesse d'être une **liste d'admis** et devient une **règle avec exceptions** :
toute table de la **première catégorie de I1** — table métier cloisonnée,
`societe_id NOT NULL`, plus `societe` qui est cloisonnée par son identité (D42)
— est auditée, **moins une liste d'exemptions explicitement justifiées**. Elle
vit au même endroit qu'avant, `scripts/lib/perimetre-audit.ts` : D53 n'est pas
défait, il est conservé — ce fichier n'est simplement plus la maison d'une
liste, mais celle d'une règle.

**Ce que la liste d'admis faisait, et que ni D52 ni D53 n'ont corrigé.** D52 a
corrigé son CONTENU — des tables plutôt que des notions. D53 a corrigé sa
MAISON — un fichier plutôt que trois. Ni l'un ni l'autre n'a touché à son
**sens**, et c'est le sens qui dérivait : une liste d'admis tenue à la main
oublie, par construction, la table que personne n'y a ajoutée. C'est
exactement l'enchaînement du 20/08 — la liste est fermée un jour, une décision
ultérieure crée une table, personne ne revient la ranger — appliqué au
périmètre qui prétendait le corriger.

**Le cas qui l'a montré en acte.** Le ticket L1-01 crée `client`. Elle porte
`societe_id NOT NULL`, ses lignes sont saisies par un humain, et « qui a changé
la raison sociale de ce compte, quand, depuis quelle valeur » est une question
d'auditeur. Elle naissait pourtant **hors périmètre** — non parce que quelqu'un
l'avait décidé, mais parce que personne n'avait ajouté la ligne. La revue R0
l'avait d'ailleurs vu venir (écart É-b) et posait la question pour
`taux_horaire` et `forfait` : trois tables, un seul défaut, et il n'est pas dans
leur contenu.

**Pourquoi l'inversion ne crée pas une nouvelle liste à tenir.** La première
catégorie de I1 est déjà énumérée **exhaustivement par le schéma**, et le
gardien d'exhaustivité de D41 exige que chaque table du schéma appartienne à
exactement une catégorie. Le périmètre d'audit **hérite** donc de cette
fermeture sans que personne n'ait rien à tenir : une table métier créée demain
est auditée à sa naissance, et le gardien la réclame le jour où elle apparaît au
schéma.

**Le motif d'exemption est UNIQUE, et la liste est VIDE aujourd'hui.**

| Motif | Ce qu'il exige |
|---|---|
| `rejouable` | L'information qu'une écriture non tracée ferait perdre se **reconstitue** depuis une autre table, elle-même auditée. C'est le seul motif recevable, et en ouvrir un second est un arbitrage. |

Une liste vide qui reste vide est un meilleur signal qu'une liste à une entrée
qu'on cesse de regarder.

**Ce qui n'est PAS un motif**, et qui est écrit pour ne pas être réinventé :

- **« c'est bruyant ».** Le journal est partitionné depuis L0-10 précisément
  pour que le volume ne soit jamais un argument. La conservation détache des
  périodes ; elle ne trie pas les tables.
- **« la table est peu sensible ».** C'est une appréciation, et elle se révise
  au premier client qui pose la question.
- **une table dont les lignes sont saisies par un HUMAIN.** Aucune exemption,
  jamais : c'est exactement là que « qui, quand, depuis quelle valeur » se pose.

**`journal_audit` n'est PAS une exemption : elle est HORS DU DOMAINE.** La
distinction n'est pas de vocabulaire. Un motif d'exemption est une porte qu'on
rouvre par argument, et « impossibilité » serait élastique : quelqu'un plaidera
un jour l'impossibilité pour cause de volume, de récursion indirecte ou de
verrou, mesure à l'appui, et il aura raison sur la forme. La frontière, elle,
est une **liste close d'une entrée, gardée dans les deux sens** — la forme de
`CLOISONNEE_PAR_IDENTITE` (D42), et elle tient.

**Et la raison est doctrinale, pas technique.** Elle porte déjà un nom au §9 du
CLAUDE.md : **un gardien ne peut pas se garder lui-même.** La récursion existe —
mesurée, déclencheur posé sur `journal_audit` et une ligne insérée, PostgreSQL
rend `ERROR: stack depth limit exceeded` — mais elle n'en est que le SYMPTÔME.
Même contournée par un second journal ou un déclencheur conditionnel, auditer le
journal depuis le journal produirait un gardien vert par construction, donc sans
valeur.

**Ce que ce retrait coûte, et comment il est payé.** Écrire que le journal n'est
pas tracé laisse un trou pour un lecteur futur, et le trou n'est acceptable que
si la garantie de substitution est écrite au même endroit et **éprouvée** :
le journal n'est pas audité, il est **INALTÉRABLE** — `UPDATE` et `DELETE`
retirés au rôle applicatif depuis L0-10, doublés par l'absence de toute politique
pour ces verbes sous `FORCE ROW LEVEL SECURITY`. C'est plus fort qu'une trace,
pas plus faible : une trace dit ce qui a été changé, une inaltérabilité dit que
rien ne l'a été. Trois exigences, et par TENTATIVE plutôt que par lecture de
privilèges — une lecture ne regarde qu'un des deux verrous :

1. `UPDATE` et `DELETE` tentés sur `journal_audit` sous `codiplan_app`, les deux
   refusés ;
2. les mêmes tentés sur **chaque partition**, énumérée par `pg_inherits` et
   jamais sur la table mère — une partition est une table, elle n'hérite ni des
   privilèges ni des politiques du parent, et c'était la faille mesurée à L0-10 ;
3. le durcissement posé par la fonction qui **crée** la partition, dans la même
   transaction — `journal_audit_partition_creer` appelle
   `journal_audit_partition_durcir` avant de rendre. Mesuré : une partition
   créée par cette fonction naît sans aucun privilège et sous RLS forcée.

**LA FONCTION EMPÊCHE L'OUBLI, LE DÉTECTIF RATTRAPE LA MAIN.** Ce sont deux
garanties de nature différente, et il faut les nommer séparément — sinon un
lecteur futur croira que la première couvre la seconde. La fonction de création
protège du **ticket distrait** : personne ne peut créer une partition par le
chemin du dépôt sans la durcir, parce que c'est la même transaction. Le détectif
protège du **geste manuel** : un `CREATE TABLE … PARTITION OF` tapé dans une
console ne passe par aucune fonction, et rien de préventif ne peut l'arrêter.

**La limite du troisième point, annoncée, avec sa CONDITION DE LEVÉE.** Rendre
l'état non durci *inproductible* demanderait un déclencheur d'événement
(`ddl_command_end`), dont PostgreSQL réserve la création au superutilisateur —
que le rôle de migration n'est pas sur la base hébergée. La borne n'est donc pas
un choix, c'est un privilège que l'hébergeur ne donne pas. Et parce qu'une limite
héritée sans date se transmet indéfiniment, elle porte ici sa propre condition de
retrait :

> **Tant que le rôle de migration n'est pas superutilisateur, l'état nu reste
> productible à la main, et c'est le détectif qui le rattrape. Le jour où la
> base est auto-hébergée, ou le jour où l'hébergeur ouvre `ddl_command_end`, le
> déclencheur d'événement remplace le détectif — et cette phrase se retire.**

Une borne qui porte sa condition de retrait ne devient pas un vestige ; c'est ce
que D54 disait des bornes de temps et de rang, appliqué à une borne d'exécution.

**ET LE DÉTECTIF TOURNE MAINTENANT À ÉCHÉANCE FIXE, SUR LA VRAIE BASE.** Il ne
le faisait pas, et c'est mesuré : les contrôles détectifs ne s'exécutaient que
dans `db-migrate.yml`, dont le déclencheur est `workflow_dispatch` **et lui
seul** ; et le `verify:full` nocturne tourne contre un PostgreSQL **jetable**.
Le détectif n'avait donc jamais regardé l'endroit où la faute se produit — il ne
voyait la base hébergée que lorsqu'un humain cliquait pour migrer, et entre deux
migrations il peut se passer des semaines. **Une garantie dont le déclenchement
dépend de l'initiative de quelqu'un n'est pas une garantie, c'est une
intention** — le même refus que celui opposé à la réparation « à lancer avant »
de la clé étrangère de L1-02.

`scripts/veille-hebergee.mts` (`pnpm veille`) joue donc chaque nuit, contre la
base réelle, tous les contrôles d'observation que `scripts/lib/` déclare — six
aujourd'hui, et le périmètre est **inversé** comme celui de l'audit : câblé par
défaut, exclu par écrit. Une veille rouge ouvre la même issue qu'un
`verify:full` rouge. Elle est en **lecture seule par la base**,
pas par promesse : toute la veille tient dans une transaction ouverte par
`SET TRANSACTION READ ONLY`, qui refuse les quatre verbes d'écriture et tout le
DDL. C'est ce qui rend acceptable de l'exécuter avec le rôle de migration,
nécessaire pour lire `information_schema.role_table_grants` (D38). Éprouvée sur
trois fautes réellement commises à la main sur une base : un `DROP TRIGGER`, une
partition créée nue, un `GRANT UPDATE` de dépannage — les trois sont nommées.

**C'est gardé, et des deux côtés.** `tests/unit/db/perimetre-audit.test.ts`
réclame le déclencheur sur toute table métier non exemptée ; refuse un
déclencheur posé hors de la première catégorie de I1, sur une table exemptée, ou
sur le journal lui-même ; refuse l'addition comme le RETRAIT d'une entrée à la
frontière du domaine ; refuse un motif d'exemption inventé, une exemption sans
justification écrite, et une exemption qui ne s'adosse à aucune table existante
— corollaire du 31/08 sur les sélections négatives. La propriété centrale est
éprouvée sur une table fabriquée : une table métier nouvelle est réclamée **sans
qu'aucune liste n'ait été touchée**.

**Conséquence immédiate, à traiter à son ticket et pas ici.** `taux_horaire`
(L1-07) et `forfait` (L1-06) entreront au périmètre par la seule vertu de leur
`societe_id NOT NULL`, comme la revue R0 le souhaitait. Aucune décision ne reste
à prendre pour cela ; c'est le sens de l'inversion.

**Règles amendées :** RG-DRO-04

*Note d'arbitrage n°9 — CODIPLAN — 1ᵉʳ septembre 2026*

## D56 — Le temps de trajet ne voyage jamais seul : le site nomme son agence de rattachement

**Décisions amendées :** D23

*Ticket L1-02, 6 septembre 2026.*

**La question.** D23 (rang 1) et RG-PLA-05 (rang 2) écrivent `site.temps_trajet_min` — une valeur portée par le site. Le chapitre 11.2 (rang 3) et le backlog (rang 4) écrivaient « temps de trajet **par agence** », ce qui se lit naturellement « une valeur par couple (site, agence) ». La hiérarchie des sources tranchait pour le scalaire, mais l'écart restait ouvert : à Ducos et à Koné, le même site n'est pas à la même distance.

**Ce que l'exploitation a répondu.** Un site dépend d'une **agence et d'une seule, toujours la même**. Le scalaire est donc juste, et D23 avait raison ; « par agence » ne disait pas « une valeur par couple », il disait « le trajet depuis l'agence dont le site dépend ».

**Mais il manquait l'origine, et c'est l'objet de cette décision.** `temps_trajet_min = 45` ne dit pas d'où l'on part. Tant que le rattachement n'est pas dans la donnée, ce nombre n'est interprétable que par quelqu'un qui connaît déjà la réponse — et le jour où une quatrième agence ouvre, personne ne sait quelles valeurs revoir. **Un nombre dont la signification dépend d'une autre colonne ne doit jamais voyager seul.**

`site` porte donc `agence_id`, **obligatoire**. La question de la nullité s'est posée au moment où elle coûte le moins (CLAUDE.md §9, 23/08) : une colonne nullable aurait rendu le chaînage composite facultatif — en `MATCH SIMPLE`, une clé étrangère dont une colonne vaut NULL n'est pas contrôlée — et surtout elle aurait laissé exister exactement les sites que cette décision veut faire disparaître, ceux dont le temps de trajet ne dit pas son origine.

**Le chaînage est COMPOSITE**, `(societe_id, agence_id)` vers `(societe_id, id)`, sur le modèle de D48 : sans la société dans la clé, un site pourrait se rattacher à l'agence d'une autre société, les contrôles d'intégrité référentielle contournant les politiques RLS par construction. Les deux actions refusent — `ON DELETE RESTRICT` (une agence dont des sites dépendent ne s'efface pas ; `SET NULL` est impossible, la colonne étant `NOT NULL`) et `ON UPDATE RESTRICT` (D49 : `agence.id` est un UUID v7 technique qui ne change jamais).

**Et la dépendance est TENUE, pas seulement écrite.** Un commentaire ne refuse rien. Le déclencheur `site_trajet_suit_agence` refuse de changer `agence_id` en laissant `temps_trajet_min` inchangé ; Zod pose la même exigence à l'entrée serveur, pour que le refus soit rendu à l'utilisateur avec son champ. Les deux ne se remplacent pas : Zod ne voit ni l'import Excel de L1-08 ni une correction faite à la main, et la base ne rend pas de message affichable. Ce qui reste permis est délibéré : fournir la nouvelle valeur, ou `NULL` pour revenir à l'estimation par zone. **Le déclencheur n'exige pas qu'on mesure — il exige qu'on décide.**

Le message nomme le verrou en toutes lettres, parce que Prisma n'expose pas le champ `constraint` d'une erreur de déclencheur : sans le nom dans le texte, aucune assertion ne pourrait citer la contrainte qu'elle éprouve. Il dit la marche à suivre et ne nomme ni agence ni client — un refus a le droit d'être lisible, jamais d'être informatif (D50).

**Où la dépendance est écrite, et c'est le point de méthode.** Elle l'est là où quelqu'un la lira, et à quatre endroits qui ne s'adressent pas aux mêmes lecteurs : la règle RG-PLA-05 pour qui cherche le métier ; `prisma/schema.prisma` pour qui lit le modèle ; un `COMMENT ON COLUMN` pour qui ouvre une console sans jamais ouvrir le dépôt ; et le déclencheur pour qui n'aura rien lu du tout.

**Ce que cette décision NE crée pas.** Aucune table `site_temps_trajet`, et la question ne se rouvre pas : elle supposait plusieurs valeurs pour un même site, ce que l'exploitation exclut. Le point de `TABLES_PARC` sur les tables filles (registre) reste ouvert pour son propre compte.

**Règles amendées :** RG-PLA-05

*Note d'arbitrage n°10 — CODIPLAN — 6 septembre 2026*

*Note d'arbitrage n°10 — CODIPLAN — 7 septembre 2026*

## D57 — L'arrondi au quart d'heure supérieur s'applique PAR INTERVENTION

**Amendé par D83.**

> *D83 (09/09/2026) — la MAILLE tranchée ici ne bouge pas ; D83 lui ajoute un **plancher d'une heure** et écrit la portée. La ligne « cinq passages de cinq minutes font 1 h 15 » devient donc **cinq heures** : c'est le plancher, pas un changement de maille.*

*Décision d'exploitation, 7 septembre 2026. Ferme la question ouverte par D45, inscrite au registre avec pour échéance « avant L2-09 ».*

**La question, telle qu'elle était posée.** D11 règle l'agrégation **à l'intérieur** d'une intervention — les lignes ne s'arrondissent pas une à une, le temps est cumulé par technicien puis arrondi. Il ne disait rien de **plusieurs interventions dans la même journée**. La question n'était pas une modalité d'implémentation : c'est le prix que paie un client, et les deux réponses ne donnent pas le même.

**La décision.** L'arrondi au quart d'heure supérieur se fait **PAR INTERVENTION**, jamais sur le total d'une journée.

**L'exemple chiffré fait partie de la décision, et il est là pour empêcher qu'on la relise de travers.** Cinq passages de cinq minutes chez le même client dans la même journée :

| | Calcul | Facturé |
|---|---|---|
| **Par intervention** *(la décision)* | 5 × (5 min → 15 min) | **1 h 15** |
| Par journée *(écarté)* | 25 min → 30 min | 30 minutes |

Un facteur deux et demi entre les deux, sur un cas qui n'a rien d'exceptionnel : une tournée de dépannages courts est un mode d'exploitation ordinaire. C'est précisément parce que l'écart est grand que la question ne pouvait pas se trancher « par le plus simple à coder » au milieu de L2-09.

**Ce que cette décision ne change pas.** D11 reste entier : à l'intérieur d'une intervention, le temps est cumulé par technicien **avant** l'arrondi, et les lignes ne s'arrondissent pas une à une. L'arrondi vit dans la valorisation (`lib/reporting` au sens de D45), jamais dans `lib/calendar` ni dans `lib/money` — le calendrier répond à « quand », le module monétaire formate et calcule, aucun des deux ne décide ce qu'on facture.

**Conséquence de rangement.** La ligne « Avant L2-09 » **sort du registre** « Ce qui reste à décider » : elle y est rayée, jamais effacée — un point tranché se raye, comme D48 l'a fait avant lui.

**Règles amendées :** RG-TAR-05

---

## D58 — Le libre-service est une EXCEPTION À JUSTIFIER TRANSITION PAR TRANSITION, jamais une surface à borner

*Décision d'exploitation, 7 septembre 2026. Elle pose un principe de rang 1, et elle SUSPEND sa propre mise en œuvre sur `second_facteur` — pour une raison mesurée, écrite plus bas.*

### Le principe, et il est plus large que cette table

**Dans ce produit, un accès est DÉLIVRÉ, jamais réclamé.** Un compte de portail est délivré par CODIMA à un client ; un compte interne est ouvert par l'administrateur de la société ; personne ne crée son propre compte, dans aucun mode — c'est le métier, pas une restriction (décision du 07/09/2026, déjà inscrite au registre).

Ce principe a une conséquence qu'on n'avait pas tirée :

> **Dans un produit où l'accès est délivré, le libre-service n'est pas une surface à borner, c'est une exception à justifier transition par transition. On n'ouvre pas ce qu'on saura refermer ; on ouvre ce qu'on a une raison d'ouvrir.**

La différence n'est pas rhétorique, elle change le sens de la charge de la preuve. « Borner une surface » part d'un ensemble ouvert et retranche : la question posée est *qu'est-ce qu'on interdit ?*, et tout ce qu'on n'a pas pensé à interdire reste permis. « Justifier une transition » part d'un ensemble vide et ajoute : la question posée est *qu'est-ce qu'on a une raison d'ouvrir ?*, et ce qu'on n'a pas pensé à ouvrir reste fermé. C'est la même inversion de sens que D55 a faite sur le périmètre d'audit — audité par défaut, exempté par écrit — appliquée cette fois aux **écritures qu'un sujet fait sur ce qui le concerne**.

**Ce qui est arbitré, en conséquence.** La modification par le sujet n'est PAS ouverte. **Exactement une transition l'est : l'enrôlement du second facteur, dans un seul sens.** Un compte peut se doter d'un second facteur ; il ne peut jamais s'en défaire. Le retrait passe par le déblocage administratif du lot 7 — `admin_plateforme` seul, journalisé dans `journal_acces` —, et c'est une conséquence assumée, pas un effet de bord : un compte qui perd son second facteur ne le désactive pas lui-même.

**Ce que L7-01 dit, vérifié mot pour mot avant d'écrire cette ligne** *(`docs/backlog.md`)* : « Déblocage d'un `admin_societe` ayant perdu son second facteur. Exécutable par **`admin_plateforme` seul**. Journalisée dans **`journal_acces`** […] le compte débloqué doit réactiver un second facteur avant de retrouver ses droits d'administration. » Il dit exactement cela, et rien d'autre. Le chemin de sortie existe donc et il est administratif : la conséquence est portée par un ticket, pas laissée à l'usager.

### Pourquoi la mise en œuvre est SUSPENDUE, et ce que la mesure a rendu

Le moyen envisagé était un **cliquet** : une politique `UPDATE` sur `utilisateur` dont le `USING` lit l'ancienne ligne et le `WITH CHECK` la nouvelle, si bien que `mfa_actif` ne puisse passer que de `false` à `true`. La question posée avant de le poser était la bonne : *`mfa_actif` n'est qu'un drapeau ; si le sujet peut supprimer sa ligne de `second_facteur`, il a désactivé son second facteur sans jamais toucher au drapeau.*

**Il le peut. Mesuré le 07/09/2026, base jetable du harnais d'isolation, sous le rôle `codiplan_app`, contexte de société A et rôle `technicien` :**

| Mesure | Résultat |
|---|---|
| `second_facteur` — drapeaux RLS | `relrowsecurity = f`, `relforcerowsecurity = f` |
| `second_facteur` — politiques | **0** |
| `second_facteur` — verbes du rôle applicatif | `SELECT, INSERT, UPDATE, DELETE` |
| `DELETE` de SA PROPRE ligne | **réussi — 1 ligne** |
| `DELETE` sans `WHERE` | **réussi — 2 lignes, toutes sociétés confondues** |
| `SELECT` du `secret` et des `codes_secours` d'autrui | **réussi — les deux lignes rendues** |
| `UPDATE utilisateur SET mfa_actif = false` par un `technicien` sur lui-même | 0 ligne — `utilisateur_modification` l'exclut déjà |
| `UPDATE utilisateur SET mfa_actif = false` par un `admin_societe` sur lui-même | **réussi — 1 ligne**, alors que D40 le lui impose |

**Donc : le cliquet sur le drapeau serait DÉCORATIF, et il n'est pas posé.** Il fermerait une porte à côté d'une porte ouverte, et — c'est le pire — il donnerait à lire une garantie là où il n'y en a pas. *Une garantie qu'on ne peut pas constater après coup est une intention* (§9, 30/08) ; une garantie qu'on peut contourner d'une table à côté est une décoration.

**Et la mesure a rendu plus que ce qu'elle cherchait.** Les CINQ tables de la troisième catégorie de I1 sont dans le même état — `session`, `compte`, `verification`, `second_facteur`, `journal_acces` : aucune RLS, aucune politique, et le rôle applicatif détient les quatre verbes (deux sur `journal_acces`, qui n'a ni `UPDATE` ni `DELETE`). Mesuré avec témoin de non-vacuité — population posée d'abord, une empreinte de mot de passe et un jeton de session : **les deux ont été lus** sous un contexte de `technicien`. Le cloisonnement de ces tables vit donc **entièrement dans la couche applicative**, ce qui est mot pour mot ce qui a fait déplacer `utilisateur` hors de sa catégorie le 07/09 : *une garantie qui ne vit que dans la couche applicative n'en est pas une.*

**Ce que la mesure n'établit PAS, et il faut le dire aussi nettement.** Aucune route n'expose aujourd'hui une lecture non filtrée de ces tables : rien ne montre un chemin par lequel un usager atteindrait ces lignes. Ce qui est établi est plus étroit et plus durable — **la base ne défend rien ici** : la première requête écrite sans filtre, dans n'importe quel ticket à venir, rendra tout. C'est la différence entre une fuite et une absence de plancher.

**Deux chemins de côté, vérifiés parce qu'ils étaient nommés.** La réinitialisation de mot de passe (`/reset-password`) ne touche ni `mfa_actif` ni `second_facteur` et ne crée aucune session — lu dans le code de la bibliothèque. La bascule de société **met à jour** la session existante et reporte `secondFacteurValide` sans le recalculer : elle ne défait rien. Le renouvellement de session recalcule `second_facteur_valide` depuis `mfa_actif` à la création — et le greffon supprime la session ouverte par les identifiants tant que le second facteur n'a pas été présenté. Une ligne `second_facteur` effacée avec le drapeau resté à `true` **verrouille** le compte au lieu de l'ouvrir : c'est le bon sens de défaillance, et c'est la seule bonne nouvelle du lot.

**Et une troisième chose, que la question n'appelait pas et qui pèse plus que les deux autres : `/two-factor/disable` est aujourd'hui INERTE, pour une raison que personne n'a décidée.** L'attrape-tout de `app/api/auth/[...all]/route.ts` ne ferme que `/sign-up` ; les deux points d'entrée du greffon sont donc exposés. Mesuré end to end, compte ouvert par le chemin administratif puis connecté par ses identifiants : **`/two-factor/enable` et `/two-factor/disable` répondent tous deux `Unauthorized`.** Les deux passent par l'intergiciel de session du greffon, qui lit l'identité **jointe** à la session — et depuis L1-02c cette lecture n'est pas désignée.

Le témoin discriminant est là pour qu'on ne lise pas ce refus comme un verrou : **la session EXISTE bien en base sous ce jeton** (trouvée par le rôle applicatif, `session` n'ayant pas de politique), et la jointure `session × utilisateur` sans désignation rend **0 ligne**. Le refus vient donc de la politique d'identité, pas du cookie — c'est exactement le défaut que `lib/auth/connexion.ts` a corrigé chez nous en scindant la lecture en deux, et que la bibliothèque n'a pas.

**Conséquence à porter dans l'arbitrage, dans les deux sens.** Ce qui ferme aujourd'hui la désactivation en libre-service n'est pas une décision : c'est un effet de bord, et il se refermera le jour où quelqu'un fera fonctionner l'intergiciel — sans que rien ne le signale. Et symétriquement, **la transition d'enrôlement ne peut pas se construire sur `/two-factor/enable` tel quel** : le point d'entrée que D58 veut ouvrir est celui-là même qui est inerte. Ce n'est pas une mauvaise nouvelle — c'est le bon moment : la transition s'écrira comme un chemin à nous, borné par une politique, plutôt qu'en rallumant un point d'entrée générique dont on hériterait aussi le jumeau.

**Un dernier point, qui n'est pas de la sécurité de base mais de la configuration :** les codes de secours sont stockés **en clair**. Le greffon ne les chiffre que si `storeBackupCodes: "encrypted"` est demandé ; il ne l'est pas. Le `secret` TOTP, lui, est chiffré par la clé de signature.

### Ce que cette décision attend

Le principe ci-dessus est **arrêté** et ne dépend d'aucune mesure. Ce qui attend un arbitrage, parce qu'il touche à la troisième catégorie de I1 — donc à une liste close et au cloisonnement, où le §8 impose l'arrêt :

**La transition d'enrôlement ne peut pas se poser seule.** Elle exige, dans le même geste, que `second_facteur` cesse d'être une table sans plancher — sans quoi on écrit une garantie fausse. Et la question ne s'arrête pas à cette table : ou bien on traite `second_facteur` seule, et l'on nomme pourquoi les quatre autres attendent ; ou bien la troisième catégorie de I1 reçoit son propre régime, ce qui est un changement de rang constitutionnel. **Inscrit au registre « Ce qui reste à décider » avec pour déclencheur : avant le premier `admin_societe` réel, et avant toute écriture d'un chemin d'enrôlement.**

---

## D59 — La troisième catégorie de I1 reçoit son plancher, ENTIÈRE

*Décision d'exploitation, 8 septembre 2026. Ferme le point ouvert par la mesure de D58, inscrit au registre avec pour déclencheur « avant le premier `admin_societe` réel, et avant toute écriture d'un chemin d'enrôlement ».*

### Ce qui est tranché, et les trois raisons dans l'ordre où elles comptent

**La catégorie entière, pas la table mesurée.** Traiter `second_facteur` et laisser ses quatre voisines dans le même état, ce serait **réparer une liste au lieu de la fermer** — la maladie que le §9 a nommée cinq fois cette année, et qu'on ne réintroduit pas par la porte des droits.

**L'exemption était un VESTIGE.** Ces cinq tables avaient été laissées sans plancher pour la même raison que `utilisateur` avant L1-02c : l'authentification précède la société, et nous ne savions pas exprimer une garantie avant le contexte. Nous savons — c'est « désignation ». **Une borne posée faute de mieux ne se reconduit pas dès que le mieux existe : elle se retire.**

**Et ce que la mesure a lu n'est pas une donnée métier.** Une empreinte de mot de passe, un jeton de session, sous un contexte de `technicien` : *c'est le matériel qui permet de devenir quelqu'un d'autre.*

**La règle est uniforme, les formes ne le sont pas.** *Aucune table de cette catégorie n'est lisible sans une désignation ou un contexte.*

### Le tableau, DÉDUIT du chemin d'accès réel

Non pas d'une lecture de la bibliothèque : d'une **trace des requêtes réellement émises** à l'inscription, à la connexion, à la lecture de session et à l'enrôlement.

| Table | Chemin d'accès réel | Forme déduite | Ce qu'elle refuse |
|---|---|---|---|
| `session` | lue par son **jeton** ; ouverte à la connexion ; mise à jour à la bascule ; supprimée à la déconnexion | **désignation par le jeton**, plus « sa propre ligne » sous `app.utilisateur_id`. Ouverture bornée à l'identité que l'authentification vient de désigner | un balayage ; la session d'autrui ; l'ouverture d'une session pour un compte qu'on n'a pas désigné. **Et le jeton, et lui seul** : l'identifiant de la ligne n'ouvre rien, un UUID v7 n'étant pas un secret |
| `compte` | lu par l'**identifiant d'utilisateur**, que l'appelant vient de trouver par le courriel | **désignation par `utilisateur_id`** | la lecture d'une empreinte de mot de passe qu'on n'a pas nommée. **Aucune politique de suppression** |
| `verification` | lue par son **identifiant opaque**, présenté par celui qui le détient ; consommée aussitôt | **désignation par l'identifiant**, sur les quatre verbes | tout le reste : cette table n'est jamais parcourue ni listée, et un contexte de société n'en montre rien |
| `second_facteur` | lu par l'**identifiant d'utilisateur** | **désignation**, sur `SELECT`, `INSERT` et `UPDATE`. **AUCUNE politique de `DELETE`** | le secret et les codes de secours d'autrui ; **et le retrait du second facteur, par le sujet comme par quiconque** |
| `journal_acces` | écrite par le code applicatif ; lue par personne aujourd'hui | **journal** : ajout libre, lecture bornée à la désignation, ni modification ni suppression | la réécriture et l'effacement d'une trace — refusés **deux fois**, par l'absence de privilège et par l'absence de politique |

**Ce que voient les trois profils, mesuré et non déduit** *(`tests/isolation/categorie-authentification.test.ts`)* :

| | `second_facteur` | `compte` | `session` | `verification` |
|---|---|---|---|---|
| **compte interne** (`technicien`) | sa ligne, et elle seule | rien qu'il n'ait nommé | sa session ; jamais celle d'autrui | rien |
| **compte portail** (`client`) | rien | rien | rien | rien |
| **`admin_societe`** | **rien** | **rien** | sa session | rien |

**La dernière ligne est le résultat le moins évident, et c'est pourquoi elle a son scénario : administrer n'est pas voir.** `admin_societe` administre les *identités* — matrice §5.2 —, pas le matériau d'authentification. Aucune des cinq politiques ne lit son rôle.

### `second_facteur` : le verbe, et pourquoi le cliquet ne suffisait pas

`mfa_actif` n'est qu'un drapeau. Un cliquet posé sur lui seul aurait été **décoratif** : le sujet supprimait sa ligne sans jamais y toucher, et la base disait que tout allait bien. PostgreSQL porte des politiques **par verbe** ; sous `FORCE ROW LEVEL SECURITY`, un verbe sans politique est refusé pour tout le monde.

**Le refus est SILENCIEUX**, et il fallait le dire : un `USING` qui ne retient aucune ligne n'est pas une erreur, c'est zéro ligne effacée. Le scénario l'affirme sous cette forme, et son **jumeau** rend la politique de suppression dans une transaction annulée pour montrer que l'effacement passe alors — un décompte de 1, sans lequel le jumeau serait creux.

**Le chemin de sortie existe et il est administratif** : L7-01, `admin_plateforme` seul, journalisé, avec réactivation obligatoire avant retour des droits. Ce ticket écrira sa propre politique de suppression.

### Le défaut que ce ticket a trouvé, et ce qu'on en sait exactement

**`getSession` rendait NULL pour tout compte fraîchement connecté** — donc `obtenirSession`, donc toute page authentifiée. Mesuré deux fois, avec témoin : les lignes de session étaient bien en base. Personne ne s'en était aperçu, et c'est le point : **aucune page ne s'en sert encore.**

Après ce ticket la chaîne fonctionne, et la trace dit comment : `getSession` émet **deux opérations de client distinctes**, chacune désignée pour son compte — `session` par son jeton, `utilisateur` par son identifiant.

**Ce qui n'est PAS établi, et se dit plutôt que se raconte : la cause exacte du NULL d'avant.** Une explication avait été écrite — la lecture jointe de la bibliothèque, qu'une branche de `utilisateur_lecture` aurait réparée. Le **jumeau l'a démentie** : cette branche retirée, la chaîne complète reste verte. Elle a donc été supprimée. Isoler la cause d'origine demanderait de rejouer l'ancien code contre l'ancienne base ; ni l'un ni l'autre n'existe plus ensemble.

**Ce qui garde désormais cette chaîne n'est pas une explication, c'est un APPELANT** — `tests/isolation/chaine-session.test.ts`, qui ouvre une session, la relit, bascule de société et la relit encore. C'est ce qui manquait, et c'est la vraie leçon du ticket.

### Les deux points annexes, tranchés avec

**Les codes de secours ne sont plus stockés en clair.** *Un code de secours est un identifiant de connexion.* Ce que l'option fait exactement, dit plutôt que supposé : un **chiffrement symétrique par la clé de signature**, et non une empreinte — la bibliothèque n'en offre pas, les codes devant être rendus une fois puis comparés. Conséquence à connaître : une copie de la base seule ne les livre plus ; une copie de la base **et** du secret, si. Un scénario mesure que ce qui est rendu à l'utilisateur ne se retrouve pas en base.

**La fermeture par effet de bord devient délibérée.** `/two-factor/enable` et `/two-factor/disable` étaient inertes — mais par accident : l'intergiciel de session lisait l'identité jointe, ce que la politique de L1-02c filtrait. *Une fermeture par effet de bord n'est pas une fermeture.* Et ce ticket répare précisément cette lecture : les deux points d'entrée allaient se **rallumer tout seuls**. Ils sont donc fermés explicitement, dans le même geste que la réparation. Les chemins de **vérification** restent ouverts : les fermer interdirait la connexion de tout compte portant un second facteur.

### Ce que cette décision ne fait pas

Elle n'ouvre **pas** la transition d'enrôlement de D58. Elle en pose le plancher — `second_facteur_enrolement` existe et borne l'insertion — mais le chemin qui l'empruntera reste à écrire, et il sera **à nous** plutôt qu'un point d'entrée générique dont on hériterait le jumeau.

---

## D60 — `habilitation` est une table MÉTIER cloisonnée, et la liste réglementaire n'est qu'un amorçage

*Décision d'exploitation, 8 septembre 2026. Tranche la question posée à l'ouverture de L1-04.*

**La question.** Les habilitations électriques françaises sont réglementaires et nationales, ce qui plaide pour un référentiel de plateforme ; mais une société tierce en définira d'autres, ce qui plaide pour le cloisonnement.

**Ce qui tranche, et c'est le troisième argument.** Nous avons déjà pris cette décision deux fois — pour les **zones géographiques** (L1-02) et pour les **rôles de contact** (L1-03). *Une nomenclature nationale est un fait de la France, pas un fait de la plateforme*, et le produit est destiné à être vendu ailleurs. La forme « référentiel » dit « ceci vaut pour tout le monde » ; ce n'est pas vrai ici. Et une société suivra des qualifications qui ne sont **pas réglementaires du tout** — « formé sur telle presse » — que rien ne rattache à une nomenclature.

**La décision.** Table **métier**, `societe_id NOT NULL`, comme les autres. La liste réglementaire française garde sa valeur, **comme AMORÇAGE** : une société qui s'ouvre reçoit la liste par défaut, qu'elle peut ensuite compléter ou réduire. On a le bénéfice des deux, et aucune migration le jour d'un nouveau territoire.

**Une différence avec les zones, soulignée pour qu'elle ne se lise pas comme une contradiction.** Les zones ont été enregistrées avec un déclencheur de bascule parce qu'elles **existaient déjà** sous une autre forme. `habilitation` n'existe pas encore : elle naît donc directement dans sa forme juste. **On ne reporte que ce qui est déjà là.**

---

## D61 — La huitième forme de politique : « appartenance », et le mur qu'elle abat

*Décision d'exploitation, 8 septembre 2026. Prise en cours de ticket L1-02f, sur une mesure qui a arrêté la session.*

### Le mur, mesuré avant d'être contourné

**Aucun chemin ne permettait à un compte de découvrir sur quelles sociétés il est habilité.** La connexion n'établit que l'identité — c'est D35, et c'est juste : *une même personne travaille légitimement pour deux sociétés.* `basculerSociete` exige donc qu'on lui NOMME la société visée. Et `utilisateur_societe` portait la forme « société » (`societe_id = app.societe_id`), si bien que la question « sur quelles sociétés suis-je habilité ? » rendait **zéro ligne tant qu'une société n'était pas déjà active**.

Un cercle parfait. Il n'avait jamais mordu parce qu'aucun écran n'existait : les scénarios passent l'identifiant de la société en dur, ce qu'un test peut faire et qu'un utilisateur ne peut pas. **Le premier écran est venu buter dessus au premier essai**, et c'est la seconde fois dans ce lot qu'une couche sans appelant cachait un défaut (§9, 08/09).

### Ce qui est arbitré

Une politique de `SELECT` sur `utilisateur_societe`, ancrée sur l'identité connectée : *un compte lit SES lignes d'habilitation, toutes sociétés confondues ; jamais celles d'autrui.*

**Le coût est nommé plutôt que tu.** C'est la première fois qu'une ligne de la **première catégorie de I1** devient lisible hors de sa société. Ce qui rend la chose acceptable n'est pas qu'elle soit petite, c'est ce qu'elle porte : la liste des sociétés d'une personne est un fait sur **l'identité**, pas une donnée d'exploitation d'une société — de la même famille que « existe-t-il un compte pour ce courriel », que D35 a déjà tranché. Elle ne rend ni les NOMS de ces sociétés (`societe` reste de forme « identité », D42), ni aucune de leurs données.

### Ce qui la borne est la COMMANDE, et non la clause

C'est le point de conception, et il décide de tout. `cloisonnement_societe` couvre les QUATRE commandes ; y ajouter `OR utilisateur_id = app.utilisateur_id` aurait laissé un compte **ÉCRIRE sa propre habilitation** — c'est-à-dire s'attribuer le rôle de son choix sur la société de son choix, `admin_societe` compris. La branche est donc une politique **distincte**, en `SELECT` et en `SELECT` seul.

Le gardien le vérifie commande par commande, et deux épreuves le montrent sur les fautes telles qu'elles se commettraient : l'une « simplifie » la politique vers `FOR ALL` — refusée en nommant la promotion ; l'autre la retire comme redondante — refusée aussi, parce que **le retrait est le sens silencieux** : la table retombe sur la forme « société », qui passe tous les gardiens de forme, et le mur revient sans que rien ne rougisse.

### Ce que cette décision ne fait pas

Elle n'ouvre **aucun sélecteur de société**. Le premier écran active automatiquement la société d'un compte qui n'en a qu'une — il n'y a alors aucun choix à faire —, et se contente de DIRE qu'aucune n'est active quand il y en a plusieurs. Le sélecteur est un écran de back-office ; il viendra avec lui.

---

## D62 — Le compteur d'échecs du second facteur est INERTE, et le rendez-vous est pris

*Décision d'exploitation, 8 septembre 2026. Trouvée en mesurant l'enrôlement, tranchée avec lui.*

**Ce qui a été mesuré.** `recordTwoFactorFailure`, `resetTwoFactorFailures` et `assertTwoFactorNotLocked` désignent la ligne de `second_facteur` par son `id`, qui n'est pas une clé de désignation de cette table — seul `utilisateur_id` l'est. Leurs écritures sont donc **refusées en silence** : zéro ligne, aucune erreur. `echecs_verification` ne s'incrémente jamais et `verrouille_jusqu_a` ne se pose jamais.

**Ce que cela coûte, dit sans l'adoucir.** Il n'y a **aucune limitation de débit** sur la présentation d'un code TOTP : un code à six chiffres se devine en 10⁶ essais, et rien ne verrouille jamais le compte. C'est la seule protection de la fenêtre de trente secondes, et elle n'existe pas.

**Ce que cela ne coûte pas aujourd'hui, et pourquoi le rendez-vous est acceptable.** Aucun compte ne portait de second facteur avant L1-02f — la garantie ne protégeait donc rien. C'est la distinction que D58 avait déjà posée : *ce n'est pas une fuite, c'est une absence de plancher*, et elle devient exploitable le jour où le premier compte s'enrôle.

**Déclencheur explicite : le premier `admin_societe` réellement enrôlé sur une société cliente.** Ce n'est pas « quand on y pensera » : c'est un état observable, et le même jour que celui où RG-DRO-05 commence à mordre.

**Ce que le ticket devra trancher, et qui n'est pas tranché ici.** Ou bien `second_facteur` reçoit une clé de désignation par `id` — addition à une liste close, et un `id` de `second_facteur` est un UUID v7, donc **pas un secret** : la borne y serait *nominale*, exactement la réserve déjà inscrite au registre pour `journal_acces` ; ou bien les deux compteurs sont écrits par nous, par `utilisateur_id`, comme L1-02f l'a fait des deux drapeaux d'enrôlement. **Aucune des deux ne se décide dans un ticket.**

---

## D63 — Les durées de validité restent NULLES, et ce que leur absence coûte

*Décision d'exploitation, 8 septembre 2026. Confirme l'arbitrage ouvert à L1-04 et en chiffre le coût, plutôt que de le laisser au silence.*

**La décision ne bouge pas, et elle était juste.** Une périodicité de recyclage est une **pratique d'entreprise**, pas un chiffre que la norme donne : l'écrire dans l'amorçage reviendrait à inventer une valeur métier que personne n'a arbitrée (CLAUDE.md §8 — *un montant, un taux, un délai non spécifié : ne jamais inventer de valeur par défaut*). Les durées seront **saisies**, société par société.

**Ce que l'absence coûte, dit en une phrase :** RG-PLA-04 ne peut refuser une affectation que sur l'**absence** d'une habilitation, jamais sur son **expiration**.

**Et voici pourquoi il fallait l'écrire.** `date_expiration` nulle se lit « n'expire pas » — ce qui est le bon défaut, il ne bloque personne à tort. Mais tant qu'aucune date n'est saisie, **rien n'expire jamais**, et la moitié « ou expirée » de la règle est inerte sans que rien ne le signale. *Le silence a exactement la forme du succès* (§9, 31/08) : le blocage fonctionne, les scénarios sont verts, et personne ne s'apercevra que la seconde moitié dort — jusqu'au jour où un technicien interviendra sous une habilitation périmée et où l'on cherchera le défaut dans le moteur de planning plutôt que dans une colonne vide.

**Ce n'est donc PAS un défaut du code**, et c'est ce qui le rend dangereux : le code est juste, la donnée manque. Le remède n'est pas un correctif mais un **paramétrage**, et il n'a pas de déclencheur technique — aucun test ne peut rougir sur une donnée que personne n'a saisie.

**Le rendez-vous, faute de déclencheur automatique :** au paramétrage de la première société cliente, la saisie des durées de validité fait partie de la mise en service, au même titre que les calendriers d'agence. Tant qu'elle n'est pas faite, l'exploitation sait que RG-PLA-04 ne tient qu'à moitié — et le sait parce que c'est écrit ici.

---

## D64 — Le plancher du second facteur : la composition, l'escalade, et le cliquet qui condamnait l'issue de secours

*Décision d'exploitation, 8 septembre 2026. Ferme D62, et corrige un effet que personne n'avait vu.*

### Ce que la mesure a trouvé, et qui n'était pas ce qu'on cherchait

D62 annonçait un compteur inerte. La mesure a trouvé la cause commune de **trois** défauts, et le premier était bien plus coûteux que celui qu'on venait chercher.

La bibliothèque lit une ligne par sa clé de désignation, puis **réécrit celle qu'elle vient d'obtenir en la nommant par son `id`**. Mesuré sur les huit flux réels : **69 opérations, dont 7 nomment un `id`, et les 7 sont des ÉCRITURES** — aucune lecture, dans aucun flux, ne désigne par `id`. Or `id` n'est une clé de désignation d'aucune de ces tables. L'écriture partait donc sans variable, la politique lisait une chaîne vide, et le refus était **silencieux** : zéro ligne, aucune erreur.

Conséquences, mesurées puis reproduites :

1. **le défi de second facteur ne se consommait jamais**, si bien qu'un compte enrôlé ne pouvait plus se connecter **du tout**, même avec le bon code ;
2. **le code de secours échouait en `409` après avoir été validé** ;
3. le compteur d'échecs de D62 ne s'incrémentait jamais.

### La forme : rien de nouveau en base, tout dans la POSE

La réparation ne touche **aucune politique**. `second_facteur_modification` exigeait déjà `utilisateur_id = app.authentification_utilisateur_id` ; `verification_consommation` exigeait déjà `identifiant = app.authentification_identifiant`. Ces clauses étaient justes ; personne ne les nourrissait.

Ce qui manquait est un **report d'échange** : au moment d'une écriture qui nomme une ligne par sa clé primaire, l'enveloppe repose ce que la même requête entrante avait déjà désigné. La sonde l'a mesuré avant que rien ne soit écrit : **aux quatre écritures par `id`, le compte avait déjà été désigné dans le même échange**, sans exception.

**La clause compose donc deux choses, et c'est le cœur de l'arbitrage** — *le danger n'est pas la devinette (`uuidv7()` laisse 74 bits aléatoires) mais la REJOUABILITÉ : un `id` sorti d'une trace ou d'un journal peut resservir.*

| Table | Ce que le `where` dit | Ce que la politique exige |
|---|---|---|
| `second_facteur` | QUELLE ligne (`id`) | à QUI elle est (`utilisateur_id`) |
| `verification` | QUELLE ligne (`id`) | quel SECRET l'ouvre (`identifiant`) |

**Et l'`id` n'ouvre JAMAIS une lecture** — ni maintenant ni « au cas où ». La mesure le dictait : puisque aucune lecture ne désigne par `id`, en ouvrir une serait élargir sans nécessité.

### Ce qui n'est PAS exprimable, et qui est dit plutôt qu'habillé

Sur `second_facteur`, la seconde moitié est bien **l'appartenance au compte** : la colonne existe. **Sur `verification`, elle ne l'est pas.** La table n'a pas de colonne de compte, et le lien passe par `valeur`, qui ne porte l'identifiant de l'utilisateur que pour *certaines* lignes : mesuré, la ligne `2fa-attempts-…` porte un **compteur** (`"0"`). Une clause « `valeur` = le compte » casserait le décompte des tentatives.

Ce qui compose sur `verification` est donc l'**identifiant opaque déjà présenté** — vingt caractères aléatoires portés par un cookie signé, c'est-à-dire un secret, là où un `id` n'en est pas un. C'est au moins aussi fort contre le rejeu, **et ce n'est pas la même garantie** : il faut le lire ainsi.

### Une garantie plus forte qu'annoncée, découverte en la mettant en échec

Le jumeau qui retire l'appartenance a d'abord **échoué à violer quoi que ce soit** : zéro ligne écrite alors qu'on venait de retirer la politique d'`UPDATE`. La raison : **PostgreSQL applique les politiques de `SELECT` au `WHERE` d'un `UPDATE`**. L'appartenance est donc exigée deux fois — une fois pour trouver la ligne, une fois pour l'écrire — et un jumeau qui n'en retire qu'une mesure le refus du voisin (§9, 24/08). Il retire désormais les deux.

### Le calibrage, et la raison écrite plutôt que le chiffre seul

**Dix échecs consécutifs, quinze minutes, escalade au troisième verrouillage enchaîné.**

L'arithmétique borne la discussion. La fenêtre de vérification est de ±1 période — mesuré : `createOTP().verify()` ne reçoit pas d'option et retient `window = 1` —, donc **trois codes sont valides à tout instant** et l'espace utile est 3,3·10⁵, pas 10⁶. À dix échecs par quinze minutes, un attaquant qui détient **déjà** le mot de passe dispose d'environ 350 000 codes par an : près de deux chances sur trois d'aboutir en un an. **Aucune paire (seuil, durée) supportable ne ferme cette arithmétique** — c'est l'escalade qui la ferme, en plafonnant l'attaque soutenue à trente codes au total.

*Dix et pas trois* : la bibliothèque ne compare que **cinq** codes par défi. Un seuil de cinq verrouillerait au moment même où le défi s'épuise — une seule session maladroite suffirait. Dix laisse deux défis entiers de fautes de frappe.

*Quinze minutes* : le verrouillage temporaire se purge seul, et c'est ce qui compte. Un `admin_societe` est, chez son client, le seul à pouvoir administrer les comptes ; personne dans sa société ne peut le débloquer.

### L'escalade vit en BASE, et pas dans une route

La vérification a **trois** chemins — `/two-factor/verify-totp`, `/verify-backup-code`, `/verify-otp` — atteignables depuis l'extérieur par le gestionnaire attrape-tout. Une escalade écrite dans notre route ne serait donc pas au point de passage obligé : deux des trois la contourneraient. Un déclencheur `BEFORE UPDATE`, lui, est franchi par les trois, et **il compte dans la même instruction que le verrouillage qu'il compte**.

**Le point délicat, et il a failli rendre la garantie creuse.** « Trois verrouillages CONSÉCUTIFS » suppose de distinguer une connexion réussie d'une simple expiration du verrou. Or la bibliothèque produit dans les deux cas la **même nouvelle ligne** — c'est le piège du 08/09 au §9. Un déclencheur ne voit pas la forme de l'appel, mais il voit l'**ancienne** ligne, et elle suffit : la purge d'un verrou expiré part de `verrouille_jusqu_a` non nul, la remise à zéro après succès part de `NULL`. Sans cette distinction, la purge aurait remis la série à zéro toutes les quinze minutes et **l'escalade ne se serait jamais déclenchée**.

### Ce que le déblocage est, et ce qu'il n'est pas — L7-04

Exécuté par l'**`admin_societe` de la société concernée**, journalisé. *Déverrouiller n'accorde aucun accès : la personne devra toujours présenter un code valide.* C'est une gêne d'exploitation, pas un événement de sécurité, et exiger l'administrateur de plateforme pour une gêne d'exploitation ferait dépendre CODIMA d'un appel extérieur un vendredi soir.

**La différence de fond avec L7-01, et c'est elle qu'il faut retenir : L7-01 rend un accès PERDU, L7-04 ne rend que le droit de RÉESSAYER.**

### Ce qui reste ouvert

Le ticket L7-04 n'est pas construit. Tant qu'il ne l'est pas, **un compte parvenu à l'escalade n'a aucun chemin de sortie** : aucune politique n'accorde aujourd'hui le droit de remettre la série à zéro, et le déclencheur se contente de laisser passer ce geste quand il viendra. C'est un état atteignable en trente codes faux, et il est écrit ici plutôt que découvert.

---

## D65 — Le geste d'ouverture du PREMIER compte : un cliquet en base, jamais une autorité que le script s'accorde

*Décision d'exploitation, 9 septembre 2026. Débloque tout le reste : avant elle, personne ne pouvait se connecter à CODIPLAN.*

### L'impasse, et le refus qui était juste

`utilisateur_ouverture` exigeait une société active **et** `app_peut_administrer_identites()`, c'est-à-dire le rôle `admin_societe` (D37). Pour la **première** identité d'une société, il n'existe personne à être : aucun compte n'y est habilité, donc aucun rôle ne peut être tenu. Aucun compte de la base hébergée ne portait de mot de passe, et rien ne pouvait en poser un.

La session de la nuit du 08/09 avait **refusé de poser le geste**, et le motif du refus est retenu tel quel : un script d'amorçage qui poserait lui-même `app.role = 'admin_societe'` **s'attribuerait une autorité que personne ne lui a accordée**. Ce n'est pas un contournement de RLS — la politique serait satisfaite — c'est une **auto-habilitation**, et elle appartient à l'exploitation.

### La troisième voie : la base admet un cas, et le cas se détruit en s'exerçant

Entre « le script s'octroie un rôle » et « rien n'est possible », il y a la forme retenue :

> Une identité peut être ouverte sans rôle qui administre **si et seulement si la société visée ne porte AUCUNE habilitation.**

Pas « aucun administrateur » — **aucune habilitation, quelle qu'elle soit**. Le script n'affirme donc plus rien : il ne pose aucun rôle, ne se déclare rien, et passe `role: null`. Il franchit une porte que la base ouvre, et **l'acte lui-même la referme** : la première habilitation créée rend la branche inapplicable pour toujours.

**Ce n'est pas une auto-habilitation, c'est un CLIQUET** — la même forme que celui de l'escalade du second facteur (D62) : un état qui ne se rouvre pas tout seul.

### Ce que la branche ne donne pas

Elle n'ouvre qu'un `INSERT` sur `utilisateur`. **Ouvrir une identité n'accorde rien** : sans ligne de `utilisateur_societe`, le compte ne lit aucune donnée cloisonnée. Ce qui accorde est l'habilitation, gouvernée par la clause de société — et la branche est déjà refermée quand elle s'écrit.

### Pourquoi la lecture qui décide est FIDÈLE, et non seulement plausible

`app_societe_active_vierge()` est `SECURITY INVOKER` : sa sous-requête est soumise aux politiques de `utilisateur_societe`, ce qui pourrait en théorie **masquer** des lignes et répondre « vierge » à tort — le sens permissif. Ce n'est pas atteignable, et la raison est exacte : la politique `cloisonnement_societe` porte `societe_id = app.societe_id`, et le `WHERE` de la fonction porte la **même** condition ; les deux coïncident. La seule autre politique de la table, `utilisateur_societe_mes_habilitations` (D61), n'**ajoute** que des lignes — une addition ne peut que fermer la branche.

### Les quatre points du geste, arrêtés

1. **Aucun mot de passe ne transite.** Better Auth en exige un à la création : il est tiré au hasard, utilisé une fois, et **jamais rendu à personne**. Ce qui est remis est un **jeton de premier accès** — une ligne de `verification` émise par la mécanique de la bibliothèque, donc **à usage unique et datée** —, imprimé une fois par le script et transmis hors bande.
2. **La trace est un ÉVÉNEMENT D'ACCÈS, et c'est une règle générale.** *La création et la suppression d'une identité vont à `journal_acces`, jamais à `journal_audit`.* La raison est mécanique et non doctrinale : **une identité n'appartient à aucune société**, alors que `journal_audit` est cloisonné par société et partitionné — l'y faire entrer casserait son partitionnement. **Cette règle vaudra telle quelle pour le chemin administratif d'ouverture de compte du lot 7.** La valeur ajoutée à `EvenementAcces` nomme donc l'ÉVÉNEMENT (`ouverture_identite`) et non le chemin, qui va dans `detail` : une valeur d'énumération qui nommerait un script provisoire deviendrait un vestige le jour où le script disparaît.
3. **Le refus de servir deux fois existe déjà en base** — `utilisateur.email` est `@unique`. Le geste ne le rattrape pas.
4. **La condition de retrait est GARDÉE PAR LA MACHINE, et c'est le point le plus important.** *Le jour où le chemin administratif d'ouverture de compte existe, ce geste disparaît* : `tests/unit/auth/amorcage-retrait.test.ts` échoue dès qu'un appel à `signUpEmail` apparaît hors du geste et hors des tests. La porte se referme le jour où la porte principale s'ouvre, et c'est la machine qui le constate — pas une intention.

### La session laissée ouverte par l'inscription : une EXIGENCE, pas une note

`signUpEmail` **ouvre une session** au nom du compte créé — mesuré la nuit du 08/09, une ligne de `session` après l'appel. *Celui qui ouvre un compte en repartirait avec une session à ce nom.* **Une porte d'amorçage qui laisse une session ouverte derrière elle est pire que celle qu'on voulait éviter.** Le geste la ferme explicitement, par le chemin de la bibliothèque, et un scénario compte les sessions avant et après.

### Ce que l'écriture a fait apparaître, et qui n'était pas prévu

**Émettre un jeton et le consommer sont deux droits distincts, et un seul est ouvert au monde.** Mesuré le 09/09 : Better Auth n'expose `/request-password-reset` que si `emailAndPassword.sendResetPassword` est fourni — sans lui, `RESET_PASSWORD_DISABLED`, sur un courriel existant comme inexistant. L'instance de PRODUCTION ne le fournit pas et ne doit jamais le fournir ; le geste construit **sa propre instance** avec ce canal. `/reset-password`, lui, n'exige rien de tel et refuse `INVALID_TOKEN` sur un jeton inventé. **Personne ne peut donc faire émettre un jeton de premier accès depuis un navigateur.**

**Et la relecture de l'identité passe par la DÉSIGNATION, pas par la société.** Mesuré : sous un simple contexte de société, `utilisateur_lecture` refuse la ligne qu'on vient de créer — la branche « rattachement » exige une habilitation, et l'identité n'en a pas encore. Le geste nomme donc la ligne par le courriel qu'il vient de saisir.

### Ce qui reste ouvert

Le lien de premier accès conduit à `/reset-password/<jeton>`, servi par la route générique de Better Auth. **Aucune PAGE ne le rend** aujourd'hui : le premier accès se termine par un appel d'API, pas par un écran. C'est écrit ici plutôt que découvert le jour de la mise en ligne.

### Complément du 10/09/2026 — la RÉÉMISSION, et le fait qui la borne

*Décision d'exploitation du 09/09 : la durée du jeton reste à une heure, la voie de réémission se construit. Construite dans la nuit du 10/09.*

**L'enfermement, mesuré avant d'être réparé.** Deux scénarios existaient, chacun de son côté — *le second appel du geste sur la même société est refusé* et *l'instance de production n'émet aucun jeton*. Ensemble : **jeton expiré ⇒ le compte existe, personne ne peut lui donner de mot de passe, et rien ne peut en émettre un autre.** Le cliquet qui protège l'ouverture condamnait l'issue de secours (§9, 08/09).

**Le geste, et son cliquet PLUS ÉTROIT que celui de l'amorçage.** `--reemettre` ne regarde pas les habilitations : il lit un fait de la ligne de `compte` de l'identité visée — **`mot_de_passe IS NULL`** — et refuse dès qu'une empreinte existe. Il ne sert donc qu'une identité qui n'a **jamais** servi, et il se ferme au premier usage réel, pour toujours. *Mesuré sur la même identité, avant et après ; le jumeau remet le fait en place et montre la réémission repasser.* Il n'ouvre aucune identité, ne pose aucun rôle, **ne rouvre jamais le chemin d'ouverture**, ne laisse aucune session, et trace `reemission_premier_acces` dans `journal_acces` — l'événement, jamais le chemin (point 2).

**Ce que ce complément change au geste d'amorçage — RATIFIÉ le 11/09/2026, et le raisonnement est CORRIGÉ.** L'amorçage **efface l'empreinte du mot de passe jetable** après l'inscription. La justification écrite la nuit du 10/09 était « pour que le fait soit observable » — c'est-à-dire *je modifie l'état pour que mon verrou fonctionne*, **et ce serait une mauvaise habitude même avec un bon résultat**. La bonne raison est l'inverse, et l'exploitation l'a rendue telle quelle : **l'empreinte jetable était un MENSONGE DANS LA DONNÉE.** Un compte qui n'a pas de mot de passe ne doit pas en porter un ; l'effacer rend la donnée VRAIE. Le cliquet devient possible **en conséquence** de cette réparation, jamais l'inverse. Le point 1 en sort plus fort : non seulement le mot de passe jetable ne transite pas, mais son empreinte ne survit pas au geste.

**Et la mesure qui pouvait tout renverser a été faite** *(nuit du 11/09/2026)*. Écrire `NULL` dans une colonne d'empreinte ne vaut que si **une empreinte nulle refuse TOUTE tentative** : si elle comparait vrai une seule fois, l'effacement aurait ouvert une porte en croyant en fermer une. Trois tentatives sur le chemin réel, sur l'identité amorcée elle-même :

| Mot de passe présenté | Ce qui refuse | Message |
|---|---|---|
| une chaîne quelconque | `sign-in.mjs`, `if (!currentPassword)` — la bibliothèque journalise « Password not found » | `Invalid email or password` |
| la chaîne **vide** | le même, **la validation d'entrée ne l'arrête pas** : elle atteint le compte et bute sur la même garde | `Invalid email or password` |
| la valeur **nulle** | la **validation d'entrée** — elle n'atteint jamais le compte | `[body.password] Invalid input: expected string, received null` |

**Trois refus, deux mécanismes distincts**, et aucune session ouverte (témoin : zéro ligne de `session` après les trois). Une seconde couche, indépendante, a été mesurée sous la garde : `verifyPassword` **ne rend pas `false` sur une empreinte nulle, elle LÈVE** (`TypeError` sur `null`, `Invalid password hash` sur `""` et sur une chaîne malformée) — un refus par exception, là où un `false` pourrait se négliger. Le témoin de non-vacuité est dans le même fichier : la même fonction rend `true` sur une empreinte réelle. Voir `tests/unit/auth/empreinte-nulle.test.ts` et `tests/isolation/amorcage-premier-compte.test.ts`.

*Ce que la mise en échec a appris, et qui n'était pas prévu :* l'effacement neutralisé dans le code, **un seul scénario rougit — le TÉMOIN**, et les trois tentatives restent vertes. C'est juste : elles ne mesurent pas l'effacement, elles mesurent qu'une empreinte nulle refuse ; face à l'empreinte jetable laissée en place, elles échouent pour une autre raison — personne ne connaît ce mot de passe. **Deux affirmations, deux gardiens**, et le jumeau qui les sépare remet une empreinte RÉELLE et montre la connexion passer, puis la rend nulle et voit le refus revenir.

**Pourquoi ce fait-là.** Il est le seul à être à la fois lisible par le geste — `compte` se désigne par l'identifiant de l'utilisateur — et irréversible par construction — aucun chemin du produit ne remet une empreinte à `NULL`. Une trace du journal aurait fait d'une trace un verrou ; une session est effacée à son expiration ; un horodatage de modification bouge pour d'autres raisons.

**Ce que le geste ne sait pas faire, écrit plutôt que tu.** Invalider un jeton précédent encore vivant : `verification` ne se lit que par l'identifiant opaque qu'on présente, et le geste ne l'a pas gardé. Deux jetons peuvent donc être valides pendant l'heure du premier — la fenêtre est celle qui existait déjà.

---

## D66 — L7-04 : déverrouiller sans jamais ouvrir une lecture, et ce que la mesure a changé à la forme

*Décision d'exploitation, 9 septembre 2026 (question Q2). Ferme l'impasse que D64 avait laissée ouverte et nommée.*

### L'état qu'on ferme

Au troisième verrouillage enchaîné, `second_facteur_escalade` remplace la date d'expiration par une sentinelle : le verrouillage cesse d'expirer. **L'état est atteignable en trente codes faux, et aucun chemin n'en sortait** — le déclencheur laissait déjà passer la remise à zéro, mais aucune politique n'accordait le droit de l'écrire.

Le fond était tranché et ne l'est pas rediscuté : **`admin_societe` de la société concernée, journalisé, et cela ne rend que le droit de RÉESSAYER.** Le facteur est intact, la personne devra présenter un code valide, elle n'a rien à réenrôler. C'est ce qui distingue L7-04 de L7-01, qui rend un accès **perdu** — et c'est pourquoi il n'appartient pas à l'éditeur : *exiger un appel extérieur un vendredi soir pour une gêne d'exploitation, c'est organiser le contournement de la mesure.*

### CE QUI A CHANGÉ, ET QUI N'EST PAS UN DÉTAIL D'IMPLÉMENTATION

La forme évidente — une politique d'`UPDATE` pour l'administrateur, et du code qui écrit `WHERE utilisateur_id = <sujet>` — **ne fonctionne pas, et elle échoue en silence.** Mesuré le 09/09/2026, sous le rôle applicatif :

| Ce qui a été essayé | Lignes écrites |
|---|---|
| politique d'`UPDATE` seule, `UPDATE … WHERE utilisateur_id = $1` | **0** |
| politique de `SELECT` ajoutée, même `UPDATE` | 1 |
| `UPDATE … SET <constantes>` **sans clause `WHERE`** | **1** |
| `updateMany` de Prisma **sans `where`** | count **1** |

**PostgreSQL applique les politiques de `SELECT` au `WHERE` d'un `UPDATE`** (§9, 08/09). La deuxième ligne aurait donc exigé d'**ouvrir la lecture de `second_facteur` à l'administrateur** — et la mesure dit exactement ce que cela lui donnerait : `[{"secret":"…","codes_secours":"…"}]`, c'est-à-dire **le matériel du second facteur de la personne qu'il est censé dépanner.** Un `admin_societe` aurait pu générer des codes valides au nom d'un membre de sa société : *une prise de contrôle, pas un déverrouillage.*

**La sortie est la troisième ligne, et c'est la divergence qui l'a désignée** — *quand deux chemins qui devraient se ressembler ne se ressemblent pas, l'écart désigne l'endroit exact où une hypothèse est fausse* (§9, 07/09). Ici les deux chemins étaient « avec `WHERE` » et « sans ». Un `UPDATE` dont le `SET` ne porte que des constantes et qui n'a pas de `WHERE` **ne lit aucune colonne** : les politiques de `SELECT` ne s'y appliquent pas, et c'est le `USING` de la politique d'`UPDATE`, seul, qui choisit les lignes.

**Aucune lecture de `second_facteur` n'est donc ouverte à qui que ce soit.** L'administrateur ne peut ni lire le secret, ni lire les codes de secours, ni même constater que la ligne existe — un scénario le mesure, avec témoin.

### Ce qui désigne la ligne, et pourquoi la variable ne suffit jamais seule

Puisqu'il n'y a pas de `WHERE`, c'est `app.deverrouillage_sujet_id` qui dit QUELLE ligne. C'est la forme de D64 prise un cran plus loin : *la variable dit quelle ligne, la politique dit qui a le droit et dans quel état.* Trois exigences s'ajoutent, et aucune n'est décorative — `admin_societe` seul ; le sujet **habilité sur la société active** ; et la ligne **déjà à la sentinelle**. Cette politique ne peut donc atteindre aucune ligne saine.

La variable est posée par le seul chemin de production qui compose le contexte, et **remise à vide par tout contexte ordinaire** — comme les désignations d'authentification. C'est cette pose-là qui compte : sur une connexion mutualisée, une variable non posée hérite de ce que la transaction précédente y a laissé.

### Le prix d'un `UPDATE` sans `WHERE`, payé par deux filets de natures différentes

Un `UPDATE` sans `WHERE` s'appuie **entièrement** sur sa politique : celle-ci un jour élargie, il écrirait toute la table, et personne ne le verrait. Deux filets, et ils ne sont pas redondants :

- **en base**, un déclencheur écrit **à l'envers** — sous un contexte de déverrouillage, tout est refusé sauf les trois colonnes du verrouillage. Une colonne ajoutée demain est protégée le jour où elle apparaît, sans que personne n'ait à compléter une liste. C'est le renversement de D55, appliqué aux colonnes ;
- **dans le code**, le geste **annule** dès que le décompte n'est pas exactement un. On n'écrit pas « probablement bon ».

### Ce que le geste ne fait pas

Il n'accorde aucun accès, ne touche pas au secret, ne remet pas `verifie` à `false`, et **n'ouvre pas de console**. La trace est écrite **même quand rien n'a été rompu** : une tentative de déverrouillage est un accès administratif à un compte tiers, et ce qu'elle a trouvé ne change pas ce qu'elle était.

---

## D67 — La neuvième forme de politique : « adhésion », et le sélecteur qui ne pouvait afficher que des UUID

*Décision d'exploitation, 9 septembre 2026 (question Q8). Première moitié du ticket L2-11 ; la seconde est un écran.*

### Le mur, mesuré avant d'être abattu

D61 a rendu à un compte la **liste** des sociétés où il est habilité. Il lui manquait de quoi en **nommer** une : `societe` est de forme « identité » (`id = app.societe_id`, D42), si bien que sans société active la lecture rend **zéro ligne — pas même en nommant l'identifiant qu'on possède déjà**. Mesuré le 08/09/2026 sous le rôle applicatif, avec témoin : 0 à l'aveugle, 0 en nommant les deux, **2 lignes réellement en base**.

**Un sélecteur de société ne pouvait donc proposer que des UUID.** Le livrer aurait fermé le ticket sans lever l'impasse — elle aurait seulement changé de forme.

### La forme, et ce qui a été écarté

Une politique de `SELECT` **et de `SELECT` seul**, symétrique de celle que D61 a posée sur `utilisateur_societe` : un compte lit les lignes des sociétés où il est habilité, et rien d'autre. La sous-requête traverse `utilisateur_societe`, elle-même bornée par la forme « appartenance » : la règle est écrite **une fois** et se recompose, plutôt que deux clauses jumelles qui divergeront.

**Ce qui a été écarté :** un libellé **recopié** dans `utilisateur_societe`. Il aurait évité la politique, et serait devenu faux au premier renommage **sans rougir** — la divergence silencieuse du §9 (01/09), la maladie que ce dépôt a déjà soignée cinq fois. Et « pas de sélecteur du tout » était un report qui serait tombé sur la direction, premier cas d'un compte habilité sur deux sociétés.

### LE COÛT, NOMMÉ COMME D61 A NOMMÉ LE SIEN

*Une personne apprend le NOM des sociétés dont elle connaît déjà la liste.* C'est un libellé de plus sur un ensemble qu'elle possède. Elle n'obtient ni les données de ces sociétés, ni leurs habilitations, ni l'existence d'aucune autre société — mesuré, avec témoin : un compte habilité sur **une seule** société lit **une seule** ligne, alors que la base en porte davantage.

### Ce qui la borne est la COMMANDE, pas la clause

La même branche sur une écriture laisserait un compte **renommer** une société, changer sa devise, ou s'en attacher une. Elle est donc en `SELECT` et en `SELECT` seul ; l'écriture reste entièrement gouvernée par la forme « identité ». Un gardien le vérifie **commande par commande**, et une épreuve le montre sur la faute telle qu'elle se commettrait — *en « simplifiant » vers `FOR ALL` pour que ce soit cohérent.*

**Liste close gardée dans les deux sens : `TABLES_ADHESION`.** Le retrait est le sens silencieux — il fait retomber `societe` sur la forme « identité » seule, qui passe tous les gardiens de forme, et le mur revient sans qu'aucun scénario ne rougisse.

### Une conséquence sur le gardien lui-même, écrite parce qu'elle surprend

**La forme « identité » n'est plus une forme à elle seule dans le gardien** : elle est la moitié que « adhésion » exige. La laisser vivre à côté aurait produit une branche sans aucune table — *et un gardien qui ne garde rien passe au vert sans avoir rien regardé* (§9, 30/08). La clause, elle, est intacte : `ecartsAdhesion` refuse toute politique qui ne serait ancrée ni sur `id = app.societe_id`, ni sur `app.utilisateur_id`, et **échoue si aucune ne porte l'ancrage d'identité**.

---

## D68 — Le taux horaire de référence de CODIMA NC, et ce qui bloque n'est PAS le montant

*Décision d'exploitation, 9 septembre 2026. Corrige la source, pas la valeur.*

### Ce que la nuit du 08/09 avait mesuré

La consigne disait « le taux de 7 000 XPF est déjà décidé au rang 1 — reprends-le de là ». **Mesuré : il n'y était pas.**

| Où `7 000 XPF` apparaissait | Rang | Ce que c'était |
|---|---|---|
| D19 / D43 | **1** | un exemple de **FORMATAGE**, pas un tarif |
| `docs/cahier-des-charges.md` §1 | **5** — narratif, jamais normatif | « Taux horaire 7 000 XPF » |
| `prisma/seed-data.ts` | exécutable | une valeur d'amorçage |

*La consigne était juste sur le fond et fausse sur la source*, et la session ne l'a reprise de nulle part. **Ce refus était le bon**, et il est ratifié : une valeur monétaire ne se promeut pas d'un narratif à une règle.

### La décision

**Le taux horaire de référence de CODIMA NC est de 7 000 XPF HORS TAXES.** Confirmé par l'exploitation, et arrêté ici, au rang 1. La mention « hors taxes » fait partie de la décision : un taux dont on ne sait pas s'il porte la taxe est un taux qu'on ne peut pas facturer.

### CE QUI BLOQUE EST LA DATE D'EFFET, ET C'EST ÉCRIT POUR QU'ON NE LE RELISE PAS DE TRAVERS

La table `taux_horaire` reste **VIDE**. Ce n'est pas le montant qui manque : c'est sa **date d'effet**, que l'exploitation demande et n'a pas encore. Et `taux_horaire` l'exige, parce que RG-TAR-04 l'exige — *une intervention se facture au taux en vigueur à SA date, et une facture qui change quand le tarif change est une facture fausse.*

Inventer une date d'effet écrirait une **histoire fausse** plutôt qu'une histoire absente : toutes les interventions antérieures à cette date inventée se retrouveraient sans taux, ou avec le mauvais. `tauxEnVigueur` rend donc `null`, et *un taux manquant ne se lit jamais « gratuit »*.

### Une conséquence immédiate

`societe.taux_horaire_defaut` est **retirée** le même jour (Q3) : elle était la seconde source d'un fait dont `taux_horaire` est désormais la seule.

### Complément du 10/09/2026 — la date d'effet est ARRÊTÉE, et le mécanisme est un geste SÉPARÉ

**La date d'effet est la mise en service de CODIPLAN** — décidée par l'exploitation le 09/09. Pour une société vendue plus tard, « le jour où elle entre en service » est le jour de son amorçage : la formule se généralise.

**Le mécanisme n'est PAS le geste d'amorçage**, et c'est l'objection de la session que l'exploitation a retenue : un geste de sécurité qui écrirait un tarif couple deux défaillances sans rapport — un problème de tarif bloquerait le seul chemin d'entrée, ou le geste cesserait d'être atomique — et deux cliquets sans rapport dans un même geste finissent par être relus l'un pour l'autre. **`scripts/taux-initial.mts`** écrit la première ligne de `taux_horaire` à une date fournie (à défaut, le jour du geste dans le fuseau de la société), dans la devise de la société, et **refuse dès que la société porte un taux**. Ni le montant ni la date ne sont codés dans le dépôt. Même moment dans la procédure, même date en pratique, défaillances séparées.

---

## D69 — Les trois silences de D31, ratifiés ; et la paire du rapport, réparée

*Décision d'exploitation, 9 septembre 2026 (question Q6). Elle ne change rien au refus, elle change ce que le rapport DIT.*

### Ce qui est ratifié tel quel

Les trois cas sur lesquels D31 se tait sont traités **par le refus**, et le refus est la bonne lecture — c'est la seule qui ne détruit rien :

| Cas | Ce que D31 dit | Ce qui est ratifié |
|---|---|---|
| version **postérieure** | rien — D31 ne parle que de l'« antérieure » | **refus** : lire un v3 avec du code v2 suppose ce que v3 a changé |
| **en-tête en double** | rien | **refus** : lire la seconde écraserait la première, et rien ne dirait laquelle a gagné |
| colonne **obligatoire absente** | rien | **refus au niveau du fichier**, avant toute ligne : trois cents rejets identiques là où une phrase suffit |

**L'appariement exact après élagage est ratifié aussi** : *une tolérance choisit à la place de celui qui a écrit le fichier, et un import de masse est précisément le moment où l'on ne veut pas qu'un outil devine.*

### CE QUI EST RÉPARÉ, ET POUR QUI

Un en-tête mal orthographié ressortait **deux fois** dans le rapport — « colonne obligatoire absente » et « colonne inconnue » —, et cette paire se lisait sans explication. *Le rapport est lu par quelqu'un qui n'a pas le schéma en tête : c'est lui qu'il faut servir, pas la complétude du diagnostic.*

Quand une colonne obligatoire manque **et** qu'un en-tête inconnu lui ressemble, les deux sont désormais dits **en une seule anomalie qui les nomme tous les deux**, et l'en-tête sort de la liste des inconnues : il n'est pas silencié, il est **expliqué**.

### La distinction qui tient la réparation, et qu'il ne faut pas perdre

**La ressemblance ne déplace RIEN.** Elle n'apparie pas, ne lit aucune colonne, ne change aucune donnée : elle ne fabrique qu'une phrase. *Une tolérance choisit ; une explication décrit.* Un scénario le mesure explicitement — après le message, la colonne reste **illisible** —, parce que c'est exactement là que la réparation pourrait se transformer en la décision que l'exploitation vient de refuser.

Deux formes de ressemblance, choisies sur ce qu'un tableur produit réellement : la même chaîne **à la casse, aux accents et à la ponctuation près**, et la **faute de frappe** jusqu'à deux caractères sur un nom assez long pour que ce ne soit pas un hasard. Et **un intrus n'explique qu'une seule colonne manquante** : sans cette borne, un fichier ayant perdu sa ligne d'en-têtes verrait le même intrus cité partout.

---

### D70 — L'appelant désigne, la base dispose : la pose de `app.client_id` (09/09/2026)

**Contexte.** Le registre du 09/09 (§13) a mesuré qu'`app.client_id` — la variable dont dépend le cloisonnement du portail — **n'avait aucun poseur de production**. `ContexteSession` ne portait aucun champ de client, et la forme « parc » traite une valeur vide comme « utilisateur interne » : le filtre disparaît. *Mesuré sous `codiplan_app`, après deux témoins (rôle non privilégié, zéro ligne sans contexte) : un compte portail du client `c2` lisait **2 machines du client `c1`** ; le même contexte, `app.client_id` posé, rendait **0**.* Le registre posait la question comme un couple — l'appelant fournit, ou la base dérive.

**C'en était un FAUX, et la mesure le dit.** *Pas la base seule* : la dérivation n'est pas unique. `utilisateur_client` porte `UNIQUE (utilisateur_id, client_id)` et non `(utilisateur_id, societe_id)` — **éprouvé en base : une seconde habilitation insérée pour le même compte dans la même société est acceptée, et il en porte alors deux.** La base ne peut pas choisir sans inventer une règle que personne n'a décidée. *Pas l'appelant seul* : c'est l'invariant que L1-02c et L1-02e ont protégé — une valeur qui désigne ne vient jamais de l'extérieur sans être validée.

**Décision.** **L'appelant DÉSIGNE, la base DISPOSE.** `ContexteSession` porte un champ `clientId` **obligatoire** — le compte dit pour quel client il agit —, et `app_poser_perimetre_client(utilisateur, client)` refuse la pose si ce client ne figure pas parmi les habilitations actives de ce compte, **dans la même transaction que la pose**. C'est exactement la forme de `app.societe_id`, et la seule qui compose les deux contraintes au lieu d'en sacrifier une.

**Trois propriétés, chacune décidée et non subie.**

**Elle LÈVE, elle ne rend jamais un contexte vide.** Une désignation refusée qui retomberait sur la chaîne vide rouvrirait la branche « utilisateur interne » et ouvrirait tout le parc — le trou même qu'on ferme. L'exception annule la transaction entière ; un scénario mesure que le travail ne commence même pas.

**Elle est `SECURITY INVOKER`, et c'est le cœur.** Sa lecture de `utilisateur_client` est soumise aux politiques de l'appelant : elle ne peut confirmer qu'une habilitation qu'il a lui-même le droit de voir. Une fonction `DEFINER` aurait validé contre la table entière, et la désignation serait redevenue une parole sur l'honneur — outre qu'un gardien statique la refuse (D50).

**L'ORDRE des deux gestes est une décision.** `app.client_id` est posée **avant** d'être validée. La politique « habilitation » s'écrit *société ET (`app.client_id` absent OU ma propre ligne)* : valider d'abord ferait lire sous la branche « absent », c'est-à-dire sous le régime de l'utilisateur interne, qui voit **toutes** les habilitations de la société. Poser d'abord RESSERRE la validation à ses propres lignes. Ce que l'inversion coûte est nommé : une fenêtre d'une instruction où la variable porte une valeur non vérifiée, dans laquelle **rien ne s'exécute**.

**Et l'appariement est fermé DANS LES DEUX SENS.** Un rôle du portail sans client désigné est refusé (il rouvrirait la branche « utilisateur interne ») ; un rôle interne qui désigne un client l'est aussi (il déplacerait en silence le discriminant de la forme « habilitation », L1-02b). Un gardien vérifie que l'appariement ne concerne qu'un rôle sur les dix, dans les deux sens.

**Conséquences.** Le coût en allers-retours est **nul** : l'appel remplace l'instruction qui posait déjà le périmètre (L1-02b). Le quatrième motif de refus posé le 09/09 — « le rôle du portail ne peut pas ouvrir de transaction » — est **remplacé** par l'appariement : le portail devient constructible, sous validation. `lib/auth/session.ts` et `lib/auth/societe-active.ts` posent `clientId: null` — l'état honnête : la désignation est un geste de requête, pas une propriété de session, et une session de rôle `client` reste donc refusée tant que le portail n'est pas construit. **Vu tomber** : la validation retirée de la migration, trois scénarios rougissent ; le jumeau montre qu'un compte du client A1 désignant le client A2 lit alors sa ligne.

*Aucune règle du chapitre 10 n'est amendée : D70 pose une MÉCANIQUE de
cloisonnement, elle ne change aucune règle de gestion.*

---

### D71 — Le jeton QR est un SECRET, et il doit naître capable de l'être (09/09/2026)

**Décisions amendées :** D7

**Contexte.** L2-02 avait livré un jeton **dérivé** de l'`id` — `sha256` d'un domaine versionné —, en écrivant honnêtement ce qu'il était : *un identifiant, pas un secret*. La mesure le confirmait : résoudre un jeton n'ouvrait rien de plus, un compte hors périmètre ne résolvait pas la machine, et connaître le jeton équivalait à connaître l'`id`. La question était **inscrite** au registre : *RG-DRO-02 promet au technicien « la résolution par QR code » EN PLUS de son périmètre ; le jour où cette restriction sera implémentée, le jeton deviendra ce qui la LÈVE, c'est-à-dire un secret — et une dérivation publique cesserait de borner quoi que ce soit.*

**Décision de l'exploitation : le jeton se génère comme un secret DÈS MAINTENANT.** Entropie suffisante, non dérivable de l'identifiant, non devinable. Pas plus tard, pas quand RG-DRO-02 sera implémentée.

**La raison est ASYMÉTRIQUE, et c'est elle qui décide.** Le faire maintenant ne coûte rien : c'est une façon de tirer une valeur, pas une architecture. Le faire plus tard coûte de **réétiqueter physiquement tout le parc**, chez des clients, à travers la Nouvelle-Calédonie. *Entre un coût nul aujourd'hui et une campagne physique demain, il n'y a pas d'arbitrage à rendre.*

**La règle générale, qui vaut au-delà de ce jeton :** *une valeur dont on sait qu'on lui demandera un jour de porter une autorité doit naître capable de la porter. Un identifiant qu'on promeut en secret après coup n'est pas un secret — c'est un identifiant que tout le monde a déjà vu.*

**D7 se contredisait, et cette décision le répare plutôt qu'elle ne le contredit.** « Dérivé de l'UUID » et « jetons pré-générés téléchargés avant le départ » ne peuvent pas être vrais ensemble. La moitié conservée est celle que la campagne de recensement exige — et `engendrerPlancheDeJetons` la rend enfin réalisable, ce que la dérivation interdisait.

**Ce que la dérivation apportait, et ce que sa perte coûte : rien.** L'argument qui la portait était le RECALCUL — réimprimer l'étiquette d'une machine créée hors ligne dont le jeton n'aurait jamais été synchronisé. Il ne coûte rien parce que **le jeton voyage avec la fiche** : il naît sur l'appareil dans la même ligne que l'`id`. Le seul cas qu'un recalcul aurait sauvé — « l'appareil a perdu le jeton mais garde l'`id` » — ne peut pas se produire.

**I4 est tenu.** `randomBytes` ne demande aucun réseau : un tirage local satisfait le mode avion aussi bien qu'une dérivation, et mieux — il n'exige pas que l'`id` existe déjà.

**Conséquences.** 130 bits **tous tirés**, contre 74 hérités de l'UUID auparavant : *c'est la première fois que la longueur de ce jeton mesure quelque chose*. Le rendez-vous inscrit au registre du 09/09 est **levé** — il n'y a plus de décision à prendre avant la première campagne de recensement. Les scénarios de déterminisme ont **disparu**, et leur disparition est le ticket : *un secret déterministe n'en est pas un*. **Vu tomber** : la source aléatoire remplacée par une dérivation, cinq scénarios rougissent.

*Aucune règle du chapitre 10 n'est amendée : D71 amende D7, qui est de rang 1.*

# CODIPLAN — Six décisions de l'exploitation, inscrites dans la nuit du 10 septembre 2026

*Décisions arrêtées par l'exploitation le 09/09/2026 (protocole de nuit), inscrites par la session le 10/09 avec la mesure préalable exigée pour la première. Même autorité que les notes précédentes. **Aucun écran n'est construit** : ces points entrent au backlog, à construire au lot 3. Là où la session INTERPRÈTE — une règle de priorité, une forme de table —, c'est écrit comme tel, à ratifier à la relecture.*

## D72 — Le planning est une JOURNÉE, l'intervention se pose sur un CRÉNEAU, et les horaires se paramètrent par agence avec exception par technicien

### La mesure préalable, exigée avant de proposer une table de plus

**Ce que `calendrier`, `calendrier_plage` et `calendrier_ferie` portent déjà** — lu dans `prisma/schema.prisma`, `lib/calendar/` et `prisma/seed-data.ts`, pas dans le cahier :

| Table | Ce qu'elle porte | Ce qu'elle ne porte pas |
|---|---|---|
| `calendrier` | un **jeu d'horaires nommé** par société (`code`, `libelle`, `actif`), partagé par plusieurs agences — Ducos et Dolbeau partagent `DEMO-NOUMEA`, Koné a le sien | aucun horaire lui-même, aucun rattachement à une personne |
| `calendrier_plage` | les **horaires hebdomadaires** : jour ISO, minute d'ouverture, minute de fermeture — plusieurs plages par jour (coupure de midi), un jour sans plage est fermé ; règle LOCALE, le fuseau vient de l'agence à la lecture | aucune date : c'est une récurrence |
| `calendrier_ferie` | les **jours travaillés ou chômés par AGENCE** : un férié travaillé (`travaille = true` sur un fait public) ou un pont (`jour_ferie_id` nul, `travaille = false`) — unique par (agence, date), chaîné au territoire (D48) | aucun horaire : l'écart autorise ou retire les plages du jour, il n'en invente pas |
| `agence.calendrier_id` | le rattachement de l'agence à son jeu d'horaires — **nullable** | — |
| `lib/calendar` | tout ce que le planning demande : `plagesDuJour`, `creneauxDuJour`, `estOuvert`, `prochainCreneauOuvert`, `minutesOuvrees`, `minutesHorsOuverture`, `joursOuvres` ; et `usages.ts` nomme déjà **`conflitPose(calendrierTravailTechnicien, …)`** — D13 | ce paramètre n'a **aucune source** : rien au schéma ne porte le calendrier d'un technicien |

**Conclusion de la mesure : les horaires de travail et jours travaillés PAR AGENCE existent depuis le lot 0, sous ces trois tables, et rien n'est à ajouter pour eux.** Ce qui manque, et qui est mesuré :

1. **le technicien n'a pas d'agence** — `utilisateur_societe` ne porte que `utilisateur_id`, `societe_id`, `role`. Le CLAUDE.md (I1) écrit pourtant « fonction, agence de rattachement… vivent dans `utilisateur_societe` », D12 et D13 disent « agence du technicien », et le chapitre 11 prévoit une table **`technicien`** (utilisateur, société, **agence**, coût horaire, véhicule, actif) qui n'existe pas. *Trois documents affirment un état que le schéma n'a pas* — la pente du 07/09 ;
2. **aucune exception par technicien** : ni table, ni colonne, alors que D13 la nomme pour la détection de conflit.

### La décision

**Le planning s'affiche par JOURNÉE.** Une intervention se pose sur un **créneau horaire** — un début et une fin, en instants, sur le calendrier du technicien affecté. *(Le narratif du cahier, §« Vue calendrier », dit « semaine par défaut » ; il est de rang 5 et n'est pas normatif — D1. La journée est la vue par défaut ; les autres granularités restent des vues, jamais l'unité de pose.)*

**Les horaires de travail et les jours travaillés sont paramétrables PAR AGENCE** — c'est ce qui existe : `calendrier` + `calendrier_plage` pour les heures, `calendrier_ferie` pour les jours, `agence.calendrier_id` pour le rattachement. Rien n'est ajouté ici.

**Avec EXCEPTION PAR TECHNICIEN, qui prime.** *Forme proposée par la session, à ratifier :* l'exception est un **jeu d'horaires propre** — une ligne de `calendrier` de plus, portée par le technicien (`technicien.calendrier_id`, nullable, sur la table que le chapitre 11 prévoit). Elle réutilise `calendrier_plage` telle quelle : rien de nouveau à inventer pour dire « mi-temps » ou « travaille le samedi ». Ce qu'elle ne fait PAS : décider des fériés et des ponts, qui restent ceux de l'AGENCE du technicien — l'écart local est la décision de l'agence (D46), jamais d'une personne.

### La règle de priorité, et ce qu'elle fait quand aucune exception n'existe

> **Le calendrier de travail d'un technicien est : ses horaires propres s'il en a (`technicien.calendrier_id`), sinon les horaires de son agence (`agence.calendrier_id`) ; dans les deux cas, les jours particuliers — fériés, ponts, fériés travaillés — sont ceux de son agence, et le fuseau et le territoire viennent de son agence.**
>
> Quand aucune exception n'existe, c'est donc **exactement le calendrier de l'agence** — l'état d'aujourd'hui, inchangé. Quand l'agence elle-même n'a pas de calendrier (`calendrier_id` nul), le planning **refuse de poser** et dit que le paramétrage est incomplet : aucun horaire n'est inventé (I7), et `chargerCalendrierAgence` rend déjà `null` dans ce cas.

**Dépendances, à construire au lot 3 avant l'écran :** la table `technicien` du chapitre 11 (avec `agence_id` obligatoire pour un technicien), `technicien.calendrier_id` nullable, et la résolution `calendrierDeTravail(technicien)` qui écrit la règle ci-dessus une fois. **L3-01** et **L3-02** sont amendés en conséquence ; **L3-04** (absences) reste la seule exception datée d'un technicien — une absence bloque le créneau, elle ne change pas ses horaires.

**Une question que la règle ne tranche pas, inscrite :** D12 et D13 calculent la **majoration hors ouverture** sur le calendrier de l'**agence** du technicien. Si un technicien a des horaires propres — travaille le samedi —, une intervention posée un samedi est-elle « hors ouverture » pour la facturation ? *La session lit :* oui, la majoration suit l'AGENCE (D12, D13 inchangés), l'exception n'est qu'un fait de planification. Ce n'est pas tranché ici.

*Aucune décision amendée — D13 n'est pas contredite : le « calendrier de travail du technicien » qu'elle nomme reçoit une source.*

## D73 — Une affectation refusée S'AFFICHE et NOMME son motif

**La règle.** Quand RG-PLA-04 bloque une affectation, l'écran dit **quelle habilitation** manque ou a expiré, et **à quelle date** — « habilitation BR absente », « habilitation CACES expirée le 12/08/2026 » —, jamais « impossible ».

**La distinction, écrite parce que D50 pourrait se lire contre elle :** *un refus se tait quand il protège d'un tiers ; il s'explique quand il s'adresse à celui qui peut corriger.* D50 borne ce qu'un refus **donne à lire** à ce que son destinataire a le droit de lire — son exemple est un salarié de l'éditeur qui apprendrait, par un décompte, combien d'agences clientes chôment un jour. Ici, le planificateur lit déjà les habilitations de ses techniciens et les exigences de ses sites — tables de sa société, formes « société » et « parc » —, et c'est lui qui corrigera : en affectant quelqu'un d'autre, ou en faisant renouveler l'habilitation. Un refus qui lui cache ce qu'il a le droit de voir ne protège personne ; il fait perdre une matinée. **D50 et D73 sont la même règle vue des deux côtés : le refus dit tout ce que son destinataire peut lire, et rien de ce qu'il ne peut pas.** Le message vient du dictionnaire (`lib/i18n/fr.ts`, L0-11) et nomme le code de l'habilitation, jamais une donnée d'une autre société.

*Aucune décision ni règle amendée — RG-PLA-04 dit « bloquée » ; D73 dit comment le blocage se présente.*

## D74 — Le TRAJET est un FORFAIT : le temps de trajet ne s'ajoute JAMAIS aux heures facturées

**La règle.** Le déplacement se facture par un **forfait conditionné par zone** (RG-TAR-06, `forfait` de type déplacement, un seul par intervention — D11). **Le temps de trajet ne s'ajoute jamais aux heures facturées**, ni par contrat, ni par barème, ni par bascule manuelle : une ligne `intervention_temps` de type `trajet` n'est jamais facturable.

**Ce que cela change, et c'est le point important : `site.temps_trajet_min` devient une donnée de PLANIFICATION et rien d'autre.** Elle sert au calcul de charge et à l'ordonnancement des tournées (RG-PLA-05, L3-05). Sans cette phrase, quelqu'un l'additionnerait un jour aux heures et facturerait le déplacement deux fois — une fois par le forfait, une fois au temps. Elle est écrite **aux endroits où on la lira au moment de s'en servir**, sur le modèle de D56 : la règle métier (RG-PLA-05 et RG-INT-07), le schéma (`prisma/schema.prisma`), la base (`COMMENT ON COLUMN`), le code qui la rend (`lib/sites/depot.ts`) et l'aide du champ à l'écran (`site.temps_trajet_min.aide`).

**Ce que D74 confirme sans le changer :** D11 (« Trajet — non facturé au temps ; couvert par le forfait de déplacement de la zone ; en l'absence de forfait applicable, non facturé »), D12 (assiette de la majoration : main-d'œuvre seule).

**Ce que D74 CONTREDIT, et qui est amendé :** RG-INT-07 laissait une porte — « facturé selon la règle du contrat, du forfait ou du barème applicable » — par laquelle un contrat aurait pu facturer le trajet **au temps**. Elle est fermée.

**Règles amendées :** RG-INT-07, RG-PLA-05

## D75 — « Sites » entre au menu

Un client a plusieurs sites, dans des villes différentes — c'est le cas courant, pas l'exception. La table existe depuis L1-02 avec sa saisie Zod et son dépôt cloisonné ; **il manque l'écran** : liste des sites d'un client, fiche, création, modification — avec le rattachement à l'agence et le temps de trajet **présentés comme une donnée de planification** (D74). Au lot 3 : ticket **L3-16**.

*Aucune décision amendée.*

## D76 — Le TAUX D'OCCUPATION, et le mot qu'il ne faut pas employer

**Le rapport.** Par technicien et par semaine : le **nombre d'interventions**, et le **taux d'occupation = heures d'intervention ÷ heures travaillées**.

**Ce qu'il mesure, et pourquoi il ne s'appelle PAS « taux de productivité ».** Tout le temps passé en intervention compte — **y compris non facturé** : garantie, geste commercial, reprise, recensement. C'est une **occupation**. « Productivité » ferait lire un **rendement** — du temps facturé, ou de la marge — là où il y a du temps occupé, et quelqu'un déciderait sur ce chiffre. Le mot est **taux d'occupation, partout** : le cahier l'emploie déjà (§« Activité », §« Direction »), le dictionnaire le porte avec **sa formule à côté du nom**, et un gardien refuse que « productivité » entre dans le dictionnaire.

**DÉPEND de D72 :** « heures travaillées » n'existe pas tant que le calendrier de travail du technicien n'est pas résolu — c'est `minutesOuvreesAgence` appliquée au calendrier de D72, sur la semaine, absences déduites (L3-04). Au lot 3, après D72 : ticket **L3-17**.

*Aucune décision amendée.*

## F — Ce que ces six décisions contredisent, et ce qu'elles ne contredisent pas

| Décision | Contredit | Verdict |
|---|---|---|
| **D72** | le narratif « semaine par défaut » (cahier, rang 5) | non normatif (D1) — la journée l'emporte, écrit dans D72 |
| **D72** | D13, I7, RG-PLA-01, RG-PLA-02 | **aucune** contradiction — D72 donne une source à ce que D13 nommait déjà |
| **D72** | l'affirmation du CLAUDE.md (I1) et de D12/D13 que le technicien A une agence | **pas une contradiction de règle, une affirmation sans schéma** — la table `technicien` du chapitre 11 la porte ; à construire |
| **D73** | D50, D35 | **aucune** — même règle vue de l'autre côté, écrite dans D73 |
| **D74** | **RG-INT-07** (« selon la règle du contrat… ») | **OUI**, sur un point : la porte du trajet facturé au temps par contrat — **amendée** |
| **D74** | D11, D12, RG-TAR-06, RG-PLA-05 | **aucune** — D11 disait déjà « non facturé au temps » |
| **D75** | — | aucune |
| **D76** | le cahier | **aucune** — le cahier dit déjà « taux d'occupation » (§Activité, §Direction) ; « productivité terrain » n'y est qu'un objectif, jamais un indicateur |

**Et une question que F fait apparaître, inscrite au registre :** l'exception par technicien de D72 s'applique-t-elle à l'**assiette de la majoration** (D12, D13 : agence du technicien) ? La session lit que non. À trancher avant L2-09.

---

## D77 — Le forfait s'AJOUTE toujours aux heures : `forfait.heures_incluses` est retirée

*Décision d'exploitation du 9 septembre 2026, prise sous le nom de « question Q4 ». **Numérotée le 11/09/2026** — non pour changer son fond, qui ne bouge pas d'un mot, mais parce qu'une décision de rang 1 amendée par un objet SANS NUMÉRO est hors de portée du gardien `amendements-arbitrages`, et que l'on vient de mesurer ce que coûte ce qu'un gardien ne voit pas (§9, 10/09).*

**Décisions amendées :** D11

**Le fond.** Un forfait s'ajoute **toujours** au temps facturé ; il n'en absorbe jamais une partie. La colonne `forfait.heures_incluses` — qui aurait décompté des heures « déjà comprises » dans le forfait — est **RETIRÉE** du modèle. Les heures excédentaires de D11 se comptent donc sur le seul temps d'intervention, hors trajet et hors attente, sans aucune soustraction préalable.

**Pourquoi le retrait plutôt qu'un défaut à zéro.** Une colonne qui vaudrait zéro partout modélise un cas que **rien ne produit** : elle s'implémenterait un jour de travers, par quelqu'un qui la trouverait au schéma et lui chercherait un sens. C'est le motif qui a fait retirer `heures_incluses_minutes` le 09/09, et c'est le même ici — *une valeur inerte n'est pas neutre, elle est une invitation.*

**Ce que la numérotation change, et ce qu'elle ne change pas.** Elle ne rouvre rien : la marque était déjà posée dans le tableau de D11, datée du 09/09. Elle rend seulement la paire **tenable par la machine** — `D11 ← D77`, des deux côtés. *Voir L1-06, qui porte le catalogue de forfaits sans jamais lire d'heures incluses.*

---

## D78 — `format:check` entre dans `pnpm verify` : une porte garde ce que garde la porte suivante

*Incident du 2 septembre 2026, tranché le jour même. **Numéroté le 11/09/2026**, pour la même raison que D77 : un incident n'a pas de numéro, et le gardien ne tient que ce qui en a un.*

**Décisions amendées :** D14

**Le fond.** `pnpm verify` porte désormais `format:check` en première étape. Avant l'incident, la CI le jouait dans un job à part : **`pnpm verify` sortait en 0 sans jamais prononcer le mot « prettier »**, si bien qu'un ticket pouvait franchir sa porte de sortie, sincèrement vert, et être refusé par la CI une minute plus tard.

**Ce qui a été retenu au-delà du correctif.** Le remède n'est pas d'avoir ajouté l'étape manquante — c'est d'avoir rendu l'écart **impossible** : un gardien (`tests/unit/chaine-verification`) exige que toute commande jouée par un job de CI soit couverte, transitivement, par la porte correspondante. *Une porte qui ne garde pas ce que garde la porte suivante produit des verts sincères et faux* — inscrit au §9 du CLAUDE.md le 02/09.

**Ce que la numérotation change.** Rien au fond, déjà appliqué depuis le 02/09 et écrit dans D14, dans le CLAUDE.md §4 et dans le README. Elle rend la paire `D14 ← D78` tenable par la machine.

---

## D79 — `perimetre_sites` devient une TABLE : PostgreSQL ne sait pas contraindre les éléments d'un tableau

*Mesure et correctif du 7 septembre 2026, portés par le ticket L1-02b. **Numérotés le 11/09/2026** — un ticket n'a pas de numéro de décision, et l'amendement qu'il porte est de rang 1.*

**Décisions amendées :** D10

**Le fond.** D10 donnait à `utilisateur_client` une colonne `perimetre_sites uuid[]`, « vide = tous les sites du client ». Un tableau d'identifiants **ne peut porter aucune clé étrangère** : PostgreSQL ne contraint pas les éléments d'un tableau. Un périmètre pouvait donc désigner un site inexistant, un site d'un autre client, ou un site d'une autre société — et **rien en base ne l'aurait dit**. La colonne est remplacée par la table **`utilisateur_client_site`**, chaînée, cloisonnée, et de forme **« habilitation »** (la sixième forme de politique, I1).

**Pourquoi la forme « habilitation » et non « parc ».** La forme « parc » LIT `app.perimetre_sites` ; `utilisateur_client_site` est l'une des deux tables d'où cette variable est **calculée**. Lui donner la forme « parc » serait circulaire — *une politique qui lit la variable que sa propre lecture alimente ne se referme jamais.* Et lui laisser la clause de société seule était la fuite mesurée le 07/09 : un compte portail du client A lisait les habilitations des comptes du client B de la même société, et énumérait par là les autres clients.

**Ce que la numérotation change.** Rien au fond : la table existe, la forme est posée, la ligne de D10 est barrée et datée depuis le 10/09. Elle rend la paire `D10 ← D79` tenable par la machine.

---

## Correction d'exploitation du 9 septembre 2026 — *sans numéro, et c'est voulu* : la veille atteint bien la base hébergée

*Cette entrée ne porte PAS de numéro `Dnn`. Elle n'arbitre rien : elle RETIRE une instruction fondée sur une prémisse fausse, et un numéro l'aurait fait ranger parmi les décisions. **D80, D81 et D82 n'existent pas** — la file de travail du jour les citait, la mesure dit qu'aucune n'a jamais été écrite, et occuper l'un de ces numéros ici aurait rendu leur écriture future ambiguë.*

*Une ligne, et elle rectifie une consigne de l'exploitation.* Il avait été écrit que la veille n'atteignait plus la base hébergée et demandé que la limite du partitionnement soit déclarée à découvert : **c'était un état observable affirmé sans être observé** — la mesure l'a démenti, l'instruction est retirée, et la limite reste couverte comme elle l'était. *L'espèce est déjà au §9 du CLAUDE.md (07/09) ; rien n'y est ajouté.*

---

## D83 — Arrondi au quart d'heure supérieur ET plancher d'une heure, appliqués UNE SEULE FOIS sur l'intervention entière

*Décision d'exploitation, 9 septembre 2026. Elle complète D57, qui avait tranché la MAILLE de l'arrondi sans jamais poser de plancher.*

**Décisions amendées :** D57

**CE QUI EST ARRÊTÉ.**

RG-TAR-05 devient :

> Le temps d'intervention est arrondi **au quart d'heure supérieur**. La main-d'œuvre facturée ne peut être inférieure à **une heure** au taux en vigueur. **Arrondi puis plancher s'appliquent une seule fois, sur l'intervention entière, jamais tâche par tâche.**

**L'ordre est écrit, et il n'est pas indifférent à la relecture.** Arrondir puis plancher, dans cet ordre. Sur les valeurs d'aujourd'hui les deux ordres coïncident — le plancher, 60 minutes, est lui-même un multiple du pas de 15 — mais l'écrire fige la lecture, et le jour où le plancher cesserait d'être un multiple du pas, la règle resterait lisible au lieu de devenir ambiguë.

**LA PORTÉE, écrite pour qu'elle ne dérive pas.**

| Ce qui est valorisé | Arrondi | Plancher | Pourquoi |
|---|---|---|---|
| **temps passé** | oui | **oui** | c'est la main-d'œuvre facturée à l'heure, et le seul cas où les deux mordent |
| **forfait** | sans objet | **non** | *le prix d'un forfait ne dépend pas de la durée* ; un plancher horaire facturerait une heure par-dessus un prix déjà convenu |
| **trajet** | sans objet | **non** | non facturé à l'heure — c'est une donnée de planification (D74, RG-PLA-05) |
| **travail interne** | sans objet | **non** | facturé à personne |

**Une intervention étalée sur deux jours reste UNE intervention** : un seul arrondi, un seul plancher. C'est la conséquence directe de « sur l'intervention entière », et elle est écrite parce que c'est le cas où la relecture hésite.

**Ce que D83 ne change pas de D57.** La maille reste l'intervention, jamais la journée : cinq passages de cinq minutes chez le même client dans la même journée sont cinq interventions. Avec le plancher, ils facturent désormais **cinq heures** là où D57 seul en facturait 1 h 15 — l'écart avec la lecture « par journée » (30 minutes, écartée) s'agrandit encore, et c'est voulu : un déplacement a un coût que la durée du geste ne mesure pas.

**OÙ CELA VIT DANS LE CODE.**

`lib/tarification/valorisation.ts` — le domaine tarifaire, pas `lib/calendar` (qui répond à « quand ») ni `lib/money` (qui formate et calcule sans décider ce qu'on facture). Le module n'expose **aucune** fonction générale « valoriser une intervention » : il expose la valorisation du **temps passé**, et l'appelant doit avoir décidé du mode avant de l'appeler. *Une fonction qui aurait accepté un mode en argument aurait porté la composition forfait + heures excédentaires, qui n'est pas tranchée et reste au registre.*

**LE JUMEAU QUI COMPTE, et il est double.**

**12 minutes facturent une heure** ; **3 h 47 facturent 4 h 00**. Aucun des deux ne suffit seul : le premier passe déjà si l'on n'a écrit que le plancher — l'arrondi (12 → 15) y est invisible ; le second passe déjà si l'on n'a écrit que l'arrondi — le plancher ne mord pas à 227 minutes. *Si l'un passe sans l'autre, la règle est mal posée.* Les deux mises en échec sont écrites à côté d'eux, chacune rejouant la règle amputée de la moitié que l'autre éprouve. `tests/unit/tarification/valorisation.test.ts`.

**CE QUI RESTE OUVERT, et n'est pas tranché ici.**

**Deux interventions courtes sur le même site le même jour facturent aujourd'hui deux heures.** Le plancher s'applique **par intervention**, comme l'arrondi de D57. La question — *le plancher s'applique-t-il par intervention, ou par site et par jour ?* — est inscrite au registre « Ce qui reste à décider » **sans réponse par défaut déguisée** : la conséquence chiffrée est écrite là-bas, et c'est l'exploitation qui tranchera.

**Règles amendées :** RG-TAR-05

---

## D84 — `intervention` prend la forme « parc », et la restriction des 7 jours reste applicative

*Décision de session, 9 septembre 2026, prise sous protocole d'absence. **Elle est réversible et sa condition de réouverture est écrite** — c'est ce qui la rend prenable sans l'exploitation.*

**CE QUI ÉTAIT BLOQUÉ, ET DEPUIS QUAND.** Tout le lot 2 converge sur une table qui n'existait pas, et ce qui la retenait n'était pas ses colonnes : c'était sa **forme de politique**, un arbitrage de cloisonnement. Il était inscrit au registre depuis le 11/09 avec sa mesure déjà faite : *la clause de société seule est exclue par mesure (RG-DRO-01) ; le plancher est « parc » ; RG-DRO-02 serait la dixième forme, exprimable en RLS mais dépendante de l'horloge.* Quatre nuits de suite, rien du lot 2 n'a été construit.

**CE QUI EST ARRÊTÉ.** `intervention` reçoit la forme **« parc »** — société **ET** `app.client_id` **ET** `app.perimetre_sites` —, celle que portent déjà `client`, `site` et `machine`. La colonne de périmètre est `site_id` : une intervention a lieu sur un site.

**Pourquoi le plancher et pas plus.** C'est **la forme la plus restrictive qui existe déjà**. Elle n'ajoute aucune dixième forme, elle ne dépend pas de l'horloge, et elle est éprouvée par les scénarios d'isolation depuis L0-05. *Une décision de session doit être celle qui ferme le plus, pas celle qui arrange le mieux.*

**Pourquoi pas la clause de société seule.** Mesuré le 07/09 sur `utilisateur_client`, et le raisonnement est identique : un compte portail du client A lirait les interventions du client B de la même société, en tirerait leurs sites et leurs machines par jointure, et énumérerait par là les autres clients. RG-DRO-01 — *« un client n'accède qu'aux données de son propre périmètre »* — l'exclut.

**CE QUI N'EST PAS EXPRIMÉ EN BASE, ET C'EST ÉCRIT PLUTÔT QUE TU.** RG-DRO-02 donne à un technicien l'accès *« à l'intégralité du parc des clients chez qui il a une intervention planifiée dans les 7 jours »*. Cette restriction **dépend de l'horloge** : une politique qui la porterait serait la **dixième** forme, et une politique dont le verdict change à minuit sans qu'aucune écriture n'ait lieu est une garantie qu'aucun jumeau ne peut éprouver deux fois de suite. Elle reste donc **applicative**, exactement comme elle l'est déjà pour `machine` : au niveau de la base, un rôle interne voit les interventions de sa société ; c'est la couche serveur qui restreint la vue d'un technicien.

**Le coût est nommé** : un technicien qui contournerait la couche applicative verrait les interventions de toute sa société. C'est l'état d'aujourd'hui pour `machine`, et cette décision ne l'aggrave pas — elle ne le répare pas non plus.

**CONDITION DE RÉOUVERTURE, et elle se vérifie sans s'interpréter.** *Le jour où un rôle de technicien reçoit un accès direct à l'API sans passer par nos points d'entrée serveur — ou le jour où l'exploitation demande que RG-DRO-02 morde en base — la forme « parc » ne suffit plus, et la dixième forme devient un arbitrage dû.* Elle exigera alors d'écrire ce qu'une politique dépendante de l'horloge signifie pour un jumeau : ce qui est refusé aujourd'hui doit l'être encore demain, ou le gardien ne mesure rien.

**LES DEUX VERROUS DE CYCLE DE VIE SONT EN BASE, ET C'EST LE CŒUR.** *Une action refusée à l'écran mais acceptée par la base est un trou* — un écran se contourne par une requête, un déclencheur ne se contourne pas. `intervention_cycle_de_vie` refuse donc, en base : **toute** modification d'une intervention `annulee` ; toute modification d'une intervention `cloturee` **autre que son annulation** — I5 donne à `ANNULEE` la préséance sur `CLOTUREE`, et la lui retirer ici contredirait un invariant ; et **la clôture sans temps saisi**, `temps_reel_min` étant l'entrée de D83.

**Ce que cette décision ne crée pas.** Aucune table `intervention_machine`, `intervention_temps` ni `intervention_piece` : elles sont au chapitre 11 et appartiennent au lot 3. `numero` existe et **personne ne l'attribue** — le compteur par société appartient à la synchronisation (I10), comme pour `machine`. Le journal des **déplacements** n'est pas une table de plus : c'est `journal_audit`, que le périmètre inversé de D55 réclame le jour où la table apparaît, et qui porte les valeurs avant et après.

*Aucune règle du chapitre 10 n'est amendée : cette décision met en œuvre RG-DRO-01 et RG-DRO-02 sans en réécrire le texte, et elle ne porte donc pas de ligne de déclaration — en porter une vide serait déclarer un câblage qui n'existe pas.*

---

## D85 — L'HORLOGE N'ENTRE PAS DANS LE CLOISONNEMENT

*Décision de session, 9 septembre 2026, prise sous protocole d'absence. **Elle est réversible et sa condition de réouverture est écrite** — c'est ce qui la rend prenable sans l'exploitation.*

**CE QUI A ÉTÉ CHERCHÉ, ET LA DIFFÉRENCE ENTRE « JE N'EN AI PAS TROUVÉ » ET « IL N'Y EN A PAS ».** La question posée était : *ce principe existe-t-il écrit dans le dépôt, sous un numéro ou sans ?* La recherche a porté sur le **texte**, jamais sur un numéro : `grep -rniE "horloge"` sur tout le dépôt hors `node_modules`, puis `matérialis`, puis les fonctions temporelles de PostgreSQL dans les migrations.

Ce qu'elle rend — et c'est une mesure, pas un souvenir :

| Où le mot apparaît | Ce qui y est écrit | Est-ce le principe ? |
| --- | --- | --- |
| `docs/arbitrages.md`, D84 | *« RG-DRO-02 dépend de l'horloge, ce qui en ferait une dixième forme »* | **Non.** C'est un **motif**, invoqué pour une table et une règle. |
| `docs/arbitrages.md`, registre du 11/09 | la même phrase, comme mesure préalable à D84 | Non. |
| `README.md` ligne 473, migration `20260909200000` ligne 205 | la même phrase, recopiée à l'endroit de la table | Non. |
| `CLAUDE.md` §9, 09/09 | *« lire une horloge »* — le rapport d'une durée | Sans rapport. |
| Partout ailleurs | l'horloge de la BASE contre celle de Node, l'heure d'été | Sans rapport. |

**Le principe n'existait donc PAS comme principe.** Il existait quatre fois comme **argument d'une décision particulière** — ce qui est exactement la forme qu'a une règle avant d'en être une : elle est vraie à chaque fois qu'on l'invoque, et rien ne la rend opposable la fois où personne ne l'invoque. Et la **seconde moitié** — *un fait de cloisonnement dépendant du temps se MATÉRIALISE* — n'existait **nulle part** : `grep -rniE "matérialis"` rend deux occurrences, l'une sur le seed, l'autre sur une vue matérialisée de consolidation. Aucune ne parle de cela.

*Ce n'est donc pas « je n'en ai pas trouvé » : c'est « il n'y en a pas », et la différence tient à ce que la recherche a porté sur le texte de chacune des deux moitiés, pas sur le numéro d'une décision.*

**CE QUI EST ARRÊTÉ.**

> **Aucune politique de cloisonnement n'évalue l'heure.** Le cloisonnement répond à *« qui a le droit de lire cette ligne »*, et cette réponse ne doit pas changer d'elle-même : sinon un audit lancé à 23:59 et à 00:01 se contredit **sans qu'aucune écriture n'ait eu lieu**, et le vert d'un test devient fonction de l'heure.
>
> **Quand un fait de cloisonnement dépend du temps, il est MATÉRIALISÉ** : une colonne porte l'état, un travail écrit la colonne, la politique lit la colonne. **L'horloge ne touche que le travail.**

**Ce que « évaluer l'heure » désigne, sans ambiguïté possible.** L'expression d'une politique — `USING` ou `WITH CHECK` — n'appelle ni `now()`, ni `current_date`, ni `current_timestamp`, ni `clock_timestamp()`, ni `localtimestamp`, ni `statement_timestamp()`, ni `transaction_timestamp()`, directement ou par une fonction qui les appelle. **Une politique peut lire une colonne DE TYPE date sans évaluer l'heure** : `date_planifiee` est une donnée écrite par quelqu'un ; `now()` est une valeur que personne n'a écrite. *C'est la provenance qui décide, jamais le type.*

**L'ÉTAT MESURÉ, avec son témoin.** 58 politiques `CREATE POLICY` dans `prisma/migrations/`, **zéro** évaluant le temps. Le témoin est le premier chiffre : un gardien qui trouverait zéro politique rendrait aussi « zéro violation », et *un décompte nul ressemble toujours à un sans-faute* (§9, 30/08). Le gardien est `tests/unit/db/horloge-hors-cloisonnement.test.ts`.

**POURQUOI CE N'EST PAS UNE PRÉFÉRENCE DE STYLE.** Trois conséquences, chacune déjà rencontrée ailleurs dans ce dépôt :

1. **Le jumeau cesse de mesurer.** Le §9 (24/08) exige que tout refus s'accompagne d'un jumeau qui retire le verrou et montre la faute passer. Sous une politique horaire, un jumeau vert ne distingue plus « le verrou a cédé » de « l'horloge a bougé » — et il ne le dit pas, il passe.
2. **L'audit se contredit lui-même.** `pnpm veille` lit la base sous le rôle applicatif et compare à l'attendu. Une visibilité qui change à minuit rend deux verdicts opposés sur un état identique, et le §9 (06/09) dit ce qu'un rapport ainsi fait produit chez son lecteur.
3. **La faute est SILENCIEUSE dans le sens permissif.** Une politique horaire ne lève pas : elle rend un autre ensemble de lignes. C'est la forme exacte de la fuite mesurée le 07/09 sur `utilisateur_client`, avec en plus l'impossibilité de la reproduire à volonté.

**CE QUE LA MATÉRIALISATION VEUT DIRE, sur le cas réel qui l'attend.** RG-DRO-02 promet au technicien *« l'intégralité du parc des clients chez qui il a une intervention planifiée dans les 7 jours »*. La forme horaire s'écrit `date_planifiee <= now()::date + 7` et tombe sous l'interdiction. La forme matérialisée s'écrit : une table `technicien_perimetre_actif` — ou une colonne — qu'un travail planifié écrit chaque nuit, que la politique **lit**, et dont la trace dit **quand** elle a été écrite. La fenêtre se déplace alors par une **écriture**, qui se date, se journalise, se rejoue et s'éprouve deux fois de suite avec le même verdict. *La restriction n'est pas affaiblie : elle est rendue observable.*

**Ce que cela coûte, nommé.** Un décalage : le périmètre d'un technicien est celui qu'un travail a écrit, pas celui de la seconde présente. C'est le prix, et il est plus faible que celui d'une garantie qu'aucun jumeau ne peut mesurer. *Le §9 (01/09) dit qu'une approximation ne se garde pas à côté de sa mesure ; ici c'est l'inverse et il faut l'écrire : on préfère un fait daté à une vérité instantanée qu'on ne sait pas contrôler.*

**CE QUE CETTE DÉCISION NE FAIT PAS.** Elle ne touche à **aucune** politique existante — il n'y en a aucune à corriger, c'est la mesure ci-dessus. Elle ne rouvre pas D84 : elle en **généralise le motif** et lui donne le rang que ce motif avait déjà en fait. Elle n'interdit pas au **code applicatif** de lire l'heure : la restriction des 7 jours reste applicative, elle y est légitime, et `lib/calendar` reste le seul endroit où la date courante se lit (L0-08). Elle ne dit rien des **déclencheurs** ni des **contraintes de cycle de vie** : ceux-là s'exécutent au moment d'une écriture, et une écriture est précisément ce que l'horloge a le droit de dater.

**CONDITION DE RÉOUVERTURE, et elle se vérifie sans s'interpréter.** *S'il existe un cas où le cloisonnement doit se fermer **sans aucun écrivain** — ni travail planifié, ni évènement, ni acteur —, le principe est faux et cette décision est due à réécriture.* Un tel cas est reconnaissable à une propriété : personne, humain ni machine, n'a de raison d'écrire au moment où la fermeture doit prendre effet. *Nous n'en connaissons pas ; nous ne prétendons pas qu'il n'en existe pas.* Le premier qui se présentera devra être décrit avec sa mesure, comme D84 l'a été.

*Aucune règle du chapitre 10 n'est amendée : cette décision porte sur la FORME des politiques, et pas sur ce qu'une règle promet. Elle ne porte donc pas de ligne de déclaration — en porter une vide serait déclarer un câblage qui n'existe pas.*

---

## D86 — Le forfait porte un RANG explicite, et « le premier applicable » cesse d'être un ordre du hasard

*Ratification d'exploitation du 9 septembre 2026, complétée par la session. La ratification porte sur le PRINCIPE ; le rang, sa forme et son verrou sont la mise en œuvre.*

**CE QUI ÉTAIT FAUX, ET CE N'EST PAS UNE MODALITÉ D'IMPLÉMENTATION.** Le registre du 09/09 avait tranché *« le premier forfait applicable l'emporte »* et laissé la condition de réouverture suivante : *le jour où deux forfaits de déplacement se disputeront la même zone, ce sera un arbitrage, pas un `orderBy` choisi en séance.* L'exploitation ratifie le principe et refuse le mot : **« premier » n'était pas défini.** Le code ordonnait par `code`, c'est-à-dire par l'**alphabet** ; avant lui, l'ordre naturel eût été celui d'**insertion**, c'est-à-dire le **passé**. Dans les deux cas, *deux interventions identiques se factureraient différemment selon un fait sans rapport avec le tarif* — la casse d'un code, ou la minute où quelqu'un a saisi une ligne six mois plus tôt. **Un tarif qui dépend de cela ne se défend pas devant un client.**

**CE QUI EST ARRÊTÉ.**

1. **Le forfait porte un RANG explicite, stocké, modifiable** — `forfait.rang`, entier strictement positif, **sans valeur par défaut**. Le plus petit l'emporte : « rang 1 » se lit « le premier », et un forfait plus spécifique s'insère devant sans renuméroter ce qui le suit. *Un défaut aurait été une décision prise par personne* — c'est le §9 du 24/08 sur les actions référentielles, appliqué à un nombre.
2. **L'égalité de rang est un état INTERDIT, et c'est la BASE qui refuse** — index unique `(societe_id, type, rang)`. Le choix entre « la base refuse » et « un contrôle signale » se tranche par une seule question : *que se passe-t-il si personne ne lit le signal ?* La facture part. Un état d'où sort un montant faux se refuse à l'écriture.
3. **La clé porte le TYPE, et ce n'est pas un détail** : le rang ne se compare qu'entre forfaits de **même nature** — un déplacement n'est jamais en concurrence avec une prestation. Un rang unique sur tout le catalogue obligerait à renuméroter des lignes sans rapport, et *une contrainte qui force un geste inutile finit par être contournée*.

**CE QUE LA BASE NE SAIT PAS REFUSER, ET POURQUOI ON NE LE LUI DEMANDE PAS.** L'énoncé exact — *« deux forfaits de même rang applicables au même cas »* — est un recouvrement sur trois axes où **l'absence de condition vaut « toutes les valeurs »**. Une contrainte d'exclusion sur `zone_geo && zone_geo` dirait l'inverse : pour PostgreSQL un tableau vide ne recouvre rien, alors qu'il signifie ici « partout ». Il faudrait encoder la négation dans la colonne, et *une contrainte dont l'expression inverse le sens de sa colonne est une contrainte que personne ne relit.* **L'unicité du rang par nature est plus FORTE** — elle interdit aussi les égalités entre forfaits disjoints —, totale et lisible : elle rend le cas litigieux **impossible** au lieu de le détecter.

**LE FORFAIT SE DÉDUIT DE LA ZONE DU SITE, ET LA CONSIGNE QUI DISAIT L'AGENCE EST RETIRÉE.** *Une agence dessert plusieurs zones à des distances différentes* : faire porter le forfait par l'agence facturerait le même déplacement pour le Grand Nouméa et pour la brousse. C'est aussi ce que la règle écrite dit depuis L1-06 — les conditions d'un forfait portent sur la **zone**, la famille et le type, jamais sur l'agence (RG-TAR-06, D23). *La consigne d'exploitation qui nommait l'agence est retirée par son auteur ; la correction est écrite ici pour que le retrait se relise, et non seulement dans le code qui n'a jamais suivi la consigne.*

**UN DÉFAUT D'ARGENT TROUVÉ EN CHEMIN, ET IL ÉTAIT PLUS GRAVE QUE L'ORDRE.** *Mesuré avant d'être corrigé* : `forfaitApplicable` lisait « aucune condition » sous la forme `null`, celle que la **saisie Zod** écrit. La **base** ne peut pas l'écrire — une liste scalaire PostgreSQL n'est pas nullable, Prisma rend toujours un `String[]`, et l'absence de condition y est le tableau **VIDE**. Le tableau vide tombait donc dans la branche « une condition est posée », et **le forfait général — celui que le module documente comme le cas le plus courant — ne s'appliquait JAMAIS** par le chemin de production. *C'est la frontière du §9 (08/09) : deux formes d'un même fait, dont une seule était lue, et le SQL n'en laissait rien voir.* La note du schéma qui écrivait « `NULL` veut dire sans condition » pour les trois axes était fausse pour deux d'entre eux ; elle est corrigée.

**UN ÉCRAN, PARCE QU'UN TARIF QU'ON NE PEUT PAS INSPECTER EST UN TARIF QU'ON NE PEUT PAS DÉFENDRE.** `/parametres/forfaits` montre, pour une zone choisie, le catalogue de chaque nature avec son rang, ses conditions et **trois verdicts** — retenu, applicable mais devancé, écarté. *Le deuxième est celui qui manque partout ailleurs* : sans lui, un forfait absent d'une facture paraît exclu par ses conditions alors qu'il l'est par son rang. **L'écran ne recalcule rien** : il appelle `forfaitRetenu`, la fonction que la création d'intervention appelle — un écran qui referait le tri serait une seconde lecture d'un même critère (§9, 01/09), et il montrerait un forfait pendant que la facture en porterait un autre.

**LE JUMEAU DEMANDÉ, ET CE QU'IL MESURE.** Deux forfaits qui se recouvrent, **facturation identique quel que soit l'ordre de création des lignes** : les **six** permutations de trois candidats sont jouées, ce qui démontre la propriété au lieu de l'échantillonner, avec un témoin qui refuse « six fois la même absence ». S'y ajoutent, en base, le refus de l'égalité de rang **et** son jumeau — l'index retiré dans une transaction annulée, deux forfaits de déplacement se disputent le rang 7, et la violation a bien eu lieu. Et le **cas qui doit rester vert pour sa propre raison** (§9, 11/09) : deux **natures** différentes partagent le rang 7 sans rougir — une unicité sur `(societe_id, rang)` seule aurait fait tomber ce scénario.

**CONDITION DE RÉOUVERTURE, et elle se vérifie sans s'interpréter.** *Le jour où l'ordre d'application devra dépendre d'autre chose que d'un nombre réglé par l'exploitation — la spécificité des conditions, par exemple, « le plus précis l'emporte » —, ce sera un amendement de RG-TAR-06 et non un tri choisi en séance.* La spécificité a été écartée ici pour une raison mesurable : elle n'est pas un ordre total (un forfait conditionné par zone et un forfait conditionné par famille ne se comparent pas), et *un ordre partiel présenté comme une règle de facturation laisse exactement le trou qu'on vient de refermer*.

*Aucune règle du chapitre 10 n'est amendée : RG-TAR-06 dit qu'un forfait s'applique si ses conditions sont remplies, et cette décision dit lequel l'emporte quand plusieurs les remplissent — elle complète sans réécrire. Le chapitre 11 gagne la colonne `rang`.*

---

## D87 — La documentation des machines : au MODÈLE ou à la MACHINE, deux classes de visibilité, et un bac de réception qui PROPOSE

*Décision d'exploitation du 9 septembre 2026, inscrite par la session. **Elle est écrite, pas construite** — c'est le lot 8 du backlog. Une décision qui n'existe que dans une conversation n'existe pas : la conversation se ferme.*

**CE QUI EST ARRÊTÉ, EN CINQ POINTS.**

1. **Un document s'accroche AU MODÈLE ou À LA MACHINE, jamais aux deux, et c'est le SCHÉMA qui l'interdit.** Notice, fiche technique, manuel d'atelier sont identiques pour tous les exemplaires : ils vivent sur le modèle. Certificat de conformité, procès-verbal de mise en service sont propres à un exemplaire : ils vivent sur la machine. *Le ticket L2-04 avait déjà mesuré la forme qui marche* — deux colonnes nullables et `num_nonnulls(...) = 1` —, et celle qui piège : une colonne `entite_id` avec deux clés étrangères est **acceptée au DDL et refuse toute ligne légitime**. Cette mesure est acquise et ne se refait pas.
2. **L'écran d'une machine affiche l'UNION** de ses documents et de ceux de son modèle. *C'est ce qui évite de dupliquer un PDF sur cinq cents machines et de ne jamais pouvoir le corriger.*
3. **DEUX classes de visibilité, `client` et `interne`, produites par le schéma.** *À cinq valeurs, personne ne classe juste* : une classification qu'on hésite à appliquer est appliquée au hasard, et un document mal classé est pire qu'un document absent. C'est la même famille que les listes closes de I1 — une valeur s'ajoute par arbitrage, jamais dans un ticket.
4. **Le cloisonnement d'un document est HÉRITÉ de sa machine — société, site, habilitation — et la classe ne fait que le RÉTRÉCIR.** *Ce n'est pas un nouvel axe, et il ne faut pas inventer une forme de politique de plus* : la forme « parc » existe, D84 vient de la donner à `intervention`, et une dixième forme est un arbitrage, jamais un effet de bord. **Ce qui reste ouvert et n'est pas tranché ici** : un document de MODÈLE n'a ni machine ni site, et son cloisonnement est celui de `modele_materiel`, table métier cloisonnée depuis le retrait du mécanisme « référentiel de plateforme + copie masquante ». *La question s'instruit avec sa mesure au moment du ticket, comme D84 l'a été.*
5. **Fiche en base, octets dans un stockage d'objets, même région que la base. Jamais de PDF dans PostgreSQL.** Et **`date_document` et `date_expiration` dès le premier jour**, même inutilisées : *trois minutes maintenant, une migration douloureuse plus tard* — c'est la leçon du 30/08 sur les échéances qui tombent au pire moment, prise par le bon bout.

**LE BAC DE RÉCEPTION EST L'ENTRÉE PRINCIPALE, ET SA RÈGLE CARDINALE EST DE PROPOSER SANS JAMAIS CLASSER SEUL.** Les documents existants sont numériques mais **rangés en vrac**, sans structure exploitable. Six exigences, et la troisième est celle qui décide du reste : dédupliquer **par empreinte avant** de rapprocher ; afficher **la première page** à côté du choix — *la couverture porte la marque et le modèle, l'œil fait le travail, pas la reconnaissance de caractères* ; **proposer, jamais classer seul** ; téléversement **reprenable** — plusieurs gigaoctets depuis Nouméa, ça se coupe ; traiter **les modèles d'abord**, une notice classée servant toutes les machines du modèle d'un coup ; **tranches de dix minutes**, reprise au même endroit, aucun travail partiel perdu, compteur visible — *ce travail sera délégué, et un travail délégué qui perd une session perd la personne avec.*

**POURQUOI LE RAPPROCHEMENT AUTOMATIQUE EST REFUSÉ, ET CE N'EST PAS UN ARGUMENT DE QUALITÉ DE DONNÉES.** *Un rapprochement faux accroche la notice d'un compresseur à un pont élévateur, et personne ne le voit avant qu'un technicien suive la mauvaise procédure.* **C'est de la sécurité.** Le mode de défaillance n'est pas « une fiche est mal remplie » : c'est un geste dangereux exécuté avec confiance. *Même famille que le badge « à planifier » sur une ligne datée — un objet qui a l'air juste et qui ne l'est pas —, avec un blessé au bout.*

**HORS V1, nommé pour que personne ne l'ajoute en passant :** import automatique en masse, chaînes de versions, liens vers les sites constructeurs, téléversement depuis le téléphone.

**CONDITION DE RÉOUVERTURE.** *Le jour où une troisième classe de visibilité est réclamée avec un cas réel derrière — un document que le client peut voir mais pas télécharger, par exemple —, c'est un arbitrage, et il devra dire ce que la troisième valeur fait à celui qui classe.* La question à lui poser sera celle qui a fermé la liste à deux : *qui classera, et se trompera-t-il moins avec trois choix qu'avec deux ?*

*Aucune règle du chapitre 10 n'est amendée : le chapitre décrit déjà `document` comme une entité du modèle ; cette décision en arrête la forme et la visibilité. Le chapitre 11 recevra les colonnes au moment du ticket.*

---

## D88 — Le registre des VGP : CODIPLAN n'affirme jamais la conformité, il enregistre ce qu'on lui a dit

*Décision d'exploitation du 9 septembre 2026, inscrite par la session. **Écrite, pas construite** — c'est le lot 9 du backlog.*

**LE FAIT DONT TOUT DÉCOULE, ET IL EST D'EXPLOITATION, PAS DE CONCEPTION.** Les vérifications générales périodiques (APAVE, Bureau Veritas) sont **commandées par les CLIENTS, pas par CODIMA**. CODIMA ne les déclenche pas, ne les reçoit pas de droit, et n'apprend leur résultat que si on le lui dit. *Tout ce qui suit est la conséquence de cette phrase, et une conception qui l'oublierait produirait un registre qui ment.*

**CE QUI EST ARRÊTÉ.**

1. **CODIPLAN NE CALCULE JAMAIS LA CONFORMITÉ.** Il enregistre ce que l'organisme agréé a écrit, et ne calcule que des **dates**. *« Conforme » ne s'affiche que parce qu'APAVE l'a écrit.* Déduire la conformité d'une règle que le produit porterait serait engager une responsabilité que personne ne lui a donnée — et le faire dans un logiciel vendu à d'autres sociétés, sur d'autres territoires, avec d'autres textes.
2. **Ce n'est pas un registre de conformité : c'est un REGISTRE DE CE QU'ON NOUS A DIT.** Chaque écran porte **la date de la dernière information reçue**. Sans nouvelles : **« sans information depuis X »** — jamais « à jour », jamais « en retard », **jamais blanc**. *Le danger est qu'un registre à moitié rempli ressemble à un registre complet* : c'est le §9 du 06/09 — un chiffre juste qui fait conclure faux —, et c'est exactement le zéro de `/sante` lu comme « installation vide », à l'échelle d'un parc de machines.
3. **L'assujettissement se déclare À LA FAMILLE et se propage, mais PAS par une case à cocher : TROIS valeurs** — `soumis` · `non_soumis`, et `verifie` · `a_determiner`. **Une famille nouvelle naît « à déterminer ».** *Une case décochée est indiscernable d'une famille jamais examinée*, et un pont élévateur sortirait du registre en silence. **Les « à déterminer » apparaissent dans une liste visible** : c'est la moitié détective du couple, et sans elle la troisième valeur ne sert à rien — *une garantie qu'on ne peut pas constater après coup est une intention* (§9, 30/08).
4. **Déclarer « soumis » rend obligatoires la PÉRIODICITÉ et LA RÉFÉRENCE DU TEXTE qui la fonde.** Sans le texte, la périodicité est un chiffre que personne ne peut défendre.
5. **AUCUNE PÉRIODICITÉ EN DUR.** Elle dépend du matériel et du texte applicable ; **la Nouvelle-Calédonie a son propre code du travail**, et la solution sera vendue ailleurs. **C'est une donnée saisie par un humain** — même famille que le taux horaire (D68) et que la majoration hors ouverture : le §8 interdit d'inventer un délai.
6. **Le MODÈLE peut préciser** — les caractéristiques techniques vivent là. **La MACHINE peut faire exception, avec MOTIF ÉCRIT OBLIGATOIRE.** Une exception sans sa raison est une exception que personne ne pourra rejuger.
7. **La déclaration est JOURNALISÉE : qui, quand, sur quelle base.** Pas une table de plus — `journal_audit`, par déclencheur, comme le reste (I8, D55).
8. **Faire passer une famille de « non soumise » à « soumise » n'ouvre PAS deux cents alertes : cela ouvre UNE CAMPAGNE DATÉE avec un compteur qui descend.** *Un gardien dont le taux de fausses alertes conduit à ne plus le lire coûte plus qu'il ne rapporte* — c'est écrit au §9 depuis le 11/09, et deux cents alertes le jour d'une déclaration sont la panne par le bruit, la plus sûre de toutes.
9. **Le rapport de VGP est de classe `client`** au sens de D87 : *l'obligation pèse sur celui qui utilise le matériel, le rapport lui appartient.*
10. **Un rapport AVEC OBSERVATIONS engendre des interventions à planifier.** *C'est le seul point où ce lot alimente le planning, et c'est celui qui rapporte de l'argent.* Une observation d'organisme est un travail à faire, daté, sur une machine identifiée : elle a exactement la forme d'une intervention `a_planifier`.
11. **Le TECHNICIEN saisit sur site ce qu'il voit — vignette, date — en cinq secondes, pendant une intervention.** *C'est ce qui remplira le registre, et rien d'autre ne le remplira* : personne ne saisira deux cents fiches un dimanche. La saisie fonctionne **hors ligne** (I4), comme tout ce que le terrain fait.

**HORS V1 :** la commande des visites aux organismes. *Elle viendra le jour où l'exploitation vendra ce service — et c'est le registre rempli qui le lui permettra.* L'ordre compte : le registre est ce qui rend le service vendable, pas l'inverse.

**CONDITION DE RÉOUVERTURE.** *Le jour où CODIMA commandera elle-même des visites — c'est-à-dire le jour où elle vendra ce service —, la phrase dont tout découle cesse d'être vraie, et cette décision est due à réécriture entière.* Le registre deviendrait alors partiellement un registre de faits connus de première main, et la distinction « ce qu'on nous a dit » / « ce que nous savons » devrait être portée par la donnée, pas par une note.

*Aucune règle du chapitre 10 n'est amendée : ce lot n'existe pas encore au cahier des charges, et cette décision est ce qui l'y fera entrer.*

---

## D89 — Le plancher d'une heure s'applique PAR INTERVENTION, sans exception

*Décision d'exploitation, 10 septembre 2026. Ferme la question ouverte par D83, inscrite au registre le 09/09 sans réponse par défaut.*

**LA RÈGLE, telle qu'Alexis l'a tranchée.**

> Le plancher d'une heure s'applique **par intervention, sans exception**. Deux interventions le même jour sur le même site déclenchent **deux planchers**, quelle qu'en soit la raison, **y compris si la seconde achève la première**.

**Portée inchangée par rapport à D83** — et elle est rappelée ici parce qu'une décision qui ne dit que ce qu'elle ajoute laisse croire qu'elle change le reste : le plancher ne vise **ni les forfaits**, **ni le trajet**, **ni le travail interne** ; l'arrondi au quart d'heure supérieur précède le plancher ; et les deux s'appliquent **une seule fois par intervention**, jamais tâche par tâche.

**CE QUE CELA COÛTE À UN CLIENT, écrit avant d'être facturé.** Deux passages de vingt minutes le même jour sur le même site facturent **deux heures**. Sous la maille « site et jour » — celle qui a été écartée — ils en factureraient **une**. *C'est un facteur deux sur un mode d'exploitation ordinaire, et le chiffre est écrit ici pour que personne n'ait à le redécouvrir sur une facture.* Ce que la maille « par intervention » dit en retour, et qui est l'argument de la décision : **un déplacement a un coût que la durée du geste ne mesure pas**, et deux déplacements en coûtent deux.

**AUCUNE EXCEPTION, et l'exception qu'on aurait pu écrire est nommée.** La tentation naturelle est d'exempter la reprise — le second passage causé par une pièce oubliée ou un travail non terminé. Elle n'est pas retenue : une exception dont le déclencheur est *la cause du second passage* exige de qualifier cette cause, donc d'arbitrer chaque cas au moment de facturer. **Une règle qui se discute à chaque facture n'est pas une règle**, et c'est la faute que le §9 nomme depuis le 11/09 sous un autre nom — le taux de fausses discussions finit par emporter la règle elle-même.

**CONDITION DE RÉOUVERTURE, écrite avec la décision.** *Le jour où un client conteste un second plancher facturé pour un passage causé par CODIMA elle-même — pièce oubliée, travail non terminé —, la règle est à rouvrir.* La variante alors retenue serait **« par intervention, sauf reprise rattachée à la précédente »**, ce qui exige une notion de rattachement entre deux interventions que le modèle ne porte pas aujourd'hui. **Elle est écrite comme variante connue et n'est pas construite** : la construire maintenant, c'est payer une notion de rattachement pour un cas qui ne s'est pas produit.

**LE JUMEAU QUI COMPTE.** *Deux interventions de vingt minutes, le même jour, sur le même site, facturent DEUX heures.* Si le scénario passe avec une seule, la règle est mal posée — c'est-à-dire que le calcul a agrégé deux interventions, ce que D57 interdit depuis le 07/09. Le scénario est écrit sur la maille et non sur la fonction : il valorise **deux fois** et somme, comme le fera l'appelant réel. `tests/unit/tarification/valorisation.test.ts`.

**CE QUE CETTE DÉCISION NE CHANGE PAS DANS LE CODE.** `lib/tarification/valorisation.ts` applique déjà la maille de D57 : `valoriserTempsPasse` valorise **une** intervention et n'a jamais su en agréger deux. *La décision ne corrige donc aucun défaut — elle retire une incertitude*, et c'est le scénario qui rend la maille non contournable par un futur appelant tenté d'additionner les minutes avant d'appeler.

**Règles amendées :** RG-TAR-05

---

## D90 — La lecture du classeur est TRANCHÉE, sur un vrai fichier Excel : `read-excel-file`

*Décision de session du 10 septembre 2026. Elle ferme la comparaison instruite le 11/09 et laissée ouverte à dessein — « les deux lectures ne donnent pas la même réponse, et je ne choisis pas laquelle des deux vous vouliez ».*

### D80 N'EXISTE PAS, et cela se dit avant tout le reste

Le protocole de session demandait de **lever la réserve « NON PORTANT » de D80**. *Mesuré, avant d'écrire une ligne : **il n'existe aucun D80 dans ce dépôt.*** La correction d'exploitation du 09/09 l'écrit déjà — « D80, D81 et D82 n'existent pas : la file de travail du jour les citait, la mesure dit qu'aucune n'a jamais été écrite ». **Une décision qui n'existe pas ne peut pas perdre une réserve qu'elle n'a jamais portée**, et lui en faire perdre une l'aurait fait naître par ricochet, avec un contenu que personne n'a écrit.

*C'est la règle du §9 (07/09) appliquée dans le sens qui compte le plus — de la session vers l'exploitation : un état énoncé comme un fait est une hypothèse, et il faut dire quand elle est fausse.* Ce que le protocole visait est reconstituable sans ambiguïté : **la condition du §2 sur la bibliothèque de lecture `.xlsx`**, dont la comparaison du 11/09 disait qu'elle ne tranchait pas nettement. C'est elle qui est tranchée ici.

### CE QUE LA MESURE DU 10/09 AJOUTE, et que la comparaison n'avait pas

La comparaison du 11/09 annonçait sa propre limite : *« LibreOffice a refusé de charger les deux classeurs ; openpyxl a servi de sérialiseur indépendant à sa place. **Aucun fichier produit par Excel lui-même n'a été lu.** »* **Cette limite est levée.** L'exploitation a fourni son fichier de suivi réel — réenregistré par **Microsoft Excel 16.0300** le 09/09/2026 à 22:04 UTC, 292 machines, 1 996 lignes d'historique — et c'est sur lui que la mesure porte.

**La fixture est fabriquée PAR RETRAIT**, jamais par réécriture : on dézippe, on retire tout `<c>` qui n'est pas une cellule numérique portant un format de date, on vide `sharedStrings`, on rezippe. *Aucune cellule survivante n'est passée par une bibliothèque d'écriture* — sinon la mesure porterait sur ce que cette bibliothèque sait faire, et non sur ce qu'un fichier venu du terrain contient. **4 390 cellules survivent, toutes byte-identiques à leur original**, et il ne reste **aucune** chaîne de caractères : `t="s"`, `t="str"` et `t="inlineStr"` à zéro, `sharedStrings` vide. *S'il ne reste pas une chaîne, il ne reste pas un nom de client.*

**Le fichier source n'entre jamais au dépôt** (I9) : son nom est inscrit à `.gitignore` avant d'être touché.

### CE QUI A ÉTÉ MESURÉ, et le verdict

| Ce qui était annoncé par l'exploitation | Ce que la vérification rend |
|---|---|
| calendrier 1900, `date1904` absent | **confirmé** |
| 4 219 cellules de date à valeur plausible | **confirmé, au chiffre près** |
| la plus ancienne 2016-05-09, la plus récente 2027-07-07 | **confirmé** — `5-Observations VGP!B290` (sérial 42499) et `3-Parc machines!W85` (sérial 46575) |
| 0 date stockée en texte | **confirmé** — les 1 246 cellules date-stylées non numériques portent toutes la chaîne **VIDE**, résultat de formule |
| 0 date portant une partie horaire | **confirmé** |
| 171 cellules à zéro, toutes dans `3-Parc machines` colonne R | **confirmé** |
| sérials 44613 → 2022-02-21 et 45013 → 2023-03-28 | **confirmé** — huit occurrences chacun, dans les deux onglets annoncés |

*Une seule chose s'écarte, et elle n'infirme rien :* l'onglet `1-Demandes SAV` porte une trentaine de cellules **au format date** dont la valeur est un petit entier (94, 95, 129) ou une valeur absurde (4 999 999). Ce sont les résultats d'une colonne de **délai en jours** qui a hérité du format de sa voisine. Elles sortent de la plage plausible et n'entrent dans aucun des chiffres ci-dessus — *c'est ce que « plausible » veut dire dans la formule de l'exploitation, et la lecture le confirme plutôt que de le contredire.*

**LES QUATRE DATES SORTENT IDENTIQUES SOUS TROIS FUSEAUX** — `UTC`, `Pacific/Noumea` (UTC+11) et `America/Los_Angeles`, de part et d'autre du méridien. Les trois lectures sont rigoureusement le même objet. *Aucun décalage d'un jour : la condition qui aurait condamné la bibliothèque n'est pas remplie.*

### LA DÉCISION

**`read-excel-file` est la bibliothèque de lecture `.xlsx` du projet**, en dépendance de développement pour l'instant — l'import de masse n'a pas de chemin serveur avant le lot 4.

Ce qui la fonde, et rien d'autre : elle est **maintenue** (9.3.10, publiée le 10/08/2026, un mois avant cette mesure), elle ne porte **aucun avis de sécurité**, et sa conversion de date est **exactement la nôtre** — `Date.UTC(1899, 11, 30) + sérial × 86 400 000 —, mesurée sur un fichier écrit par Excel.

**Ce qui a été écarté et pourquoi**, en une ligne chacun : `xlsx` (SheetJS sur npm) porte deux avis **HAUTS sans correctif atteignable**, dont une pollution de prototype **qui se déclenche à la lecture d'un fichier apporté** — l'usage exact et unique de ce module ; sa distribution d'éditeur est **refusée par le mandataire sortant** (403), donc `pnpm install` deviendrait impossible ici. `exceljs` a trois ans et un avis modéré. `xlsx-populate` a **six ans et demi**.

**LE SÉRIAL ÉTAIT LE PROXY D'UN CRITÈRE QU'ON SAIT MAINTENANT MESURER.** La condition d'origine exigeait le **numéro de série**, au motif qu'un `Date` de bibliothèque « décalerait le jour d'un cran à UTC+11 ». Mesuré deux fois — le 11/09 sur des fichiers fabriqués, le 10/09 sur un fichier d'Excel — **ce décalage n'existe pas**. C'est la situation du §9 du 01/09 : *une borne posée faute de savoir mesurer, quand la mesure existe, n'est plus une garantie — elle se retire.*

### LE ZÉRO N'EST PAS UNE DATE, et la bibliothèque ne le sait pas

*Mesuré :* `read-excel-file` rend **`1899-12-30T00:00:00.000Z`** pour les 171 cellules à zéro — **une date parfaitement formée, et parfaitement fausse**. La colonne est « Dernière intervention » : zéro y veut dire **jamais d'intervention**.

C'est donc `lib/excel/format.ts` qui l'écarte, et il l'écarte comme une **ABSENCE** (`cellule_vide`) et non comme une anomalie de plage. La distinction n'est pas cosmétique : rangé sous `date_hors_plage`, le zéro ferait **rejeter 171 machines** pour un champ légitimement vide, ce qui est le contraire de ce que I6 promet. *Le sérial 60 — le 29 février 1900 qui n'a jamais existé — reste une anomalie : personne ne saisit « pas de date » en tapant 60.*

**LE JUMEAU :** le même code rend une absence sur `0` et le 21 février 2022 sur `44613`.

### CE QUI NE PEUT PAS ÊTRE MESURÉ ICI, écrit plutôt que laissé croire

**Le bogue du 29 février 1900 n'est PAS couvert par ce fichier.** Aucune de ses dates n'est antérieure à 1901 — la plus ancienne est le 2016-05-09. Les sérials 59, 60 et 61 sont éprouvés par des cas **FABRIQUÉS, clairement marqués comme tels** dans le scénario : ils prouvent que `lireDate` sait mordre, ils ne prouvent rien de ce qu'un fichier du terrain contient (§9, 21/08).

### CONDITION DE RÉOUVERTURE

*Le jour où `read-excel-file` cesse d'être maintenue — au sens mesurable : aucune publication depuis vingt-quatre mois — ou reçoit un avis de sécurité HAUT sans correctif atteignable depuis npm, la décision est due à réexamen, et la comparaison du 11/09 est le document à rouvrir.* Le critère se vérifie, il ne s'interprète pas. Et un second déclencheur, plus étroit : *si une lecture rend un jour différent de celui que `lireDate` calcule sur un même sérial, la mesure du 10/09 est infirmée et la liaison passe au sérial brut.*

*Aucune règle du chapitre 10 n'est amendée : D31 fixe la grammaire du fichier, pas le moyen de le lire.*

---

## Contraintes connues de l'import de masse — MESURÉES sur le fichier réel, le 10/09/2026

*Ce n'est pas une décision : ce sont des FAITS, relevés sur le classeur de suivi de CODIMA (Excel 16.0300, 09/09/2026 22:04 UTC). Ils sont inscrits ici parce qu'ils contraignent la conception de l'import de masse, et qu'un fait mesuré vaut mieux qu'une hypothèse raisonnable. **Le fichier n'entre jamais au dépôt** (I9) ; seuls ces nombres en sortent.*

| Ce qui a été mesuré | Valeur | Ce que cela impose |
|---|---|---|
| Machines au parc | **292** | — |
| Numéros de série en double | **aucun** | l'unicité par société est tenable comme clé de rapprochement |
| Machines **sans série exploitable** | **14, soit 4,8 %** | **la clé de rapprochement doit tolérer l'absence de série SANS fabriquer de doublon.** C'est déjà la forme de D6 : `SN-INCONNU-<référence>` avec `complet = false`, jamais `NULL` |
| Année de fabrication renseignée | **96 sur 292** | champ **facultatif**, jamais obligatoire |
| Lignes d'historique | **1 996**, de mars 2019 à août 2026 | dont **1 965 factures** et **31 avoirs** |
| Historique **non rattaché à une machine** | **1 443, soit 72 %** | **l'import les reprend NON RATTACHÉES.** Les écarter perdrait les trois quarts de l'historique — et l'historique est ce qui donne sa valeur au parc |
| Onglet Clients | **652 lignes**, dont **55** portant un code Winpro réel | **l'import doit distinguer une ligne de GABARIT d'une ligne vide.** Une ligne de gabarit porte des formules et des mises en forme sans donnée : elle n'est ni vide au sens du XML, ni une ligne à importer |
| Clients côté parc / sites côté parc | **38** / **22** | contre **55** codes côté Winpro : **le rapprochement des deux listes est un chantier à part**, pas un effet de bord de l'import |
| Contrôles Bureau Veritas | **333**, de 2020 à 2026 | — |
| Observations | **670**, dont **608 sans document de réponse rattaché** | **« sans document rattaché » ne veut PAS dire « non levée ».** C'est une ABSENCE D'INFORMATION, et elle s'affiche comme telle — jamais comme un manquement. C'est **D88 appliqué à la lettre** : le registre enregistre ce qu'on nous a dit, il n'affirme rien |

**Le point qui coûterait le plus cher à découvrir tard est le dernier.** 608 observations sur 670 sans document de réponse : un écran qui les afficherait « non levées » accuserait des clients de manquements sur la seule foi d'un fichier de suivi incomplet. *Le danger n'est pas le chiffre, c'est le mot qu'on met à côté.*

---

## Constat d'exploitation du 10 septembre 2026 — *sans numéro* : une politique ouverte n'est pas un accès rendu

*Cette entrée n'arbitre rien : elle CONSTATE un écart entre ce que la base permet et ce que l'application fait, et elle le range là où les prochaines décisions du même genre le chercheront.*

**D61 (08/09) rend à un compte la LISTE de ses sociétés ; D67 (10/09) leur NOM.** Les deux politiques ont été posées, mesurées, gardées par un contrôle de forme, et éprouvées par des scénarios d'isolation. `societesDuCompte`, la fonction écrite pour les lire, existait. **Et elle n'était importée nulle part.**

*Mesuré le 10/09/2026 en photographiant la page d'arrivée d'un compte de démonstration habilité sur deux sociétés :* « Aucune société active. Le choix d'une société parmi plusieurs arrivera avec le back-office. » Ce compte n'atteignait **aucun** écran cloisonné — le planning, la création d'intervention et la fiche redirigent tous vers l'arrivée faute de société active. *Le mur que D61 disait avoir abattu tenait encore, un étage plus haut.*

**Ce qui rend le constat utile au-delà de son cas** : deux décisions successives ont été prises, chacune avec sa mesure, son coût nommé et son gardien — et le geste qui les rend utiles n'appartenait à aucune des deux. **Une politique RLS ouverte est une permission, pas une fonctionnalité.** C'est la parenté exacte du §9 du 08/09 — *un défaut invisible parce que ce qu'il casse n'existe pas encore* — vu par l'autre bout : ici ce n'est pas un appelant qui manque à une couche, c'est un ÉCRAN qui manque à une permission.

**Et rien ne pouvait le dire, sauf une image.** Aucun scénario n'échouait : les politiques rendaient exactement ce qu'on leur demandait, la fonction faisait ce qu'elle promettait, la page affichait un texte parfaitement grammatical. *La règle absente était « une permission ouverte a un chemin », et on ne l'écrit qu'après l'avoir vue.* Voir le §9 du CLAUDE.md, 09/09.

**Ce qui a été fait le jour même :** l'écran de choix, un formulaire HTML sans JavaScript, et la route `/api/session/societe` qui ne juge rien — `basculerSociete` porte déjà toute la décision.

**Ce qui reste à faire, et qui n'est pas tranché ici :** l'écran ne permet pas encore de CHANGER de société une fois l'une active depuis un autre écran que l'arrivée. Un compte doit repasser par `/arrivee`. C'est suffisant pour aujourd'hui et insuffisant le jour où le back-office aura une navigation.

---

## Point de vigilance commun à D87 et D88 — ce dont CODIMA RÉPOND, à instruire avant le portail

*Écrit comme point de vigilance et **non comme blocage**, à la demande de l'exploitation.*

**Le jour où le portail sert à un client un certificat de conformité ou un état de VGP, la question de ce dont CODIMA répond se pose.** Publier un document réglementaire, même reçu d'un tiers, n'est pas la même chose que publier un compte rendu d'intervention : **le client peut s'en prévaloir**, et un document périmé, mal rattaché ou incomplet devient une affirmation de CODIMA plutôt qu'une simple mise à disposition.

**Ce que cela ne bloque pas :** les deux lots se construisent entièrement sans cette réponse. Le bac de réception, le rattachement, le registre, la saisie terrain — rien n'en dépend.

**Ce que cela bloque :** l'ouverture de ces deux lots **sur le portail client**. *Avis à prendre avant, jamais après.* Et le déclencheur se vérifie sans s'interpréter : **le premier écran de portail qui affiche un document de classe `client` provenant d'un organisme tiers.**

---

## D91 — Le contrôle de cloisonnement rejoint la VEILLE : la preuve par lecture cesse de dépendre de l'initiative de quelqu'un

*Décision de session du 11 septembre 2026, sur demande d'exploitation. Elle prolonge D55 et la veille nocturne de R0-a, et elle ne crée aucun flux.*

### CE QUI ÉTAIT ÉCRIT, ET LA CONSÉQUENCE QUI NE L'ÉTAIT PAS

La veille nocturne existe depuis R0-a et son en-tête énonce déjà le défaut qu'elle répare : *« une garantie dont le déclenchement dépend de l'initiative de quelqu'un n'est pas une garantie, c'est une intention. »* **Elle ne l'avait appliqué qu'à ses propres contrôles.** Le contrôle de cloisonnement — celui qui LIT DES LIGNES — est resté câblé dans `db-migrate.yml`, dont le déclencheur est `workflow_dispatch` et lui seul. *Entre deux migrations, personne ne lisait.* Le fait était écrit ; la conséquence ne l'était pas.

**Et la limite du partitionnement non durci a été acceptée SUR LA FOI d'une surveillance de ce genre.** Le CLAUDE.md (I8) écrit que le détectif « tourne chaque nuit sur la base réelle » et que c'est ce qui rend supportable qu'un `CREATE TABLE … PARTITION OF` tapé dans une console reste productible. Cet argument valait pour les partitions, qui sont bien dans la veille. **Il ne valait pas pour le cloisonnement**, et rien ne le disait.

### LA MESURE — 26 EXÉCUTIONS PENDANT LA CÉCITÉ

L'exploitation demandait, sans deviner : combien d'exécutions du flux de migration pendant les 2 j 21 h de cécité de l'inventaire (commit `97e8f95`, 07/09 01:28 UTC → commit `52173a1`, 09/09 22:48 UTC) ?

***Vingt-six.*** Les exécutions n° 17 à n° 42 du flux « DB migrate & seed », toutes en `workflow_dispatch`, de `34073696123` (07/09 01:38:57 UTC) à `34413382407` (09/09 22:40:30 UTC) ; trois d'entre elles rouges (n° 20, 34, 42), vingt-trois vertes. *Datées à la seconde par l'API GitHub Actions, pas estimées.*

**Ce chiffre renverse la lecture naturelle du défaut.** On croit volontiers qu'une cécité dure parce que personne ne regarde. Ici quelqu'un a regardé **vingt-six fois en trois jours**, et **vingt-trois fois le contrôle a rendu vert** une comparaison qui portait sur rien pour 14 tables sur 21. *Un contrôle qui tourne souvent et regarde mal est plus dangereux qu'un contrôle qui ne tourne pas : le second n'affirme rien.* C'est le §9 du 06/09 — un chiffre juste dans un rapport vrai qui fait conclure faux — mesuré en fréquence.

### LA DÉCISION, ET CE QU'ELLE COUPE EN DEUX

**La preuve par LECTURE rejoint la veille nocturne** — deux contrôles de plus, sur les onze qu'elle joue désormais, dans la même transaction en lecture seule et sous le même rôle applicatif :

1. **`ecartsSansContexte`** — sous un rôle soumis aux politiques et hors de tout contexte société, chacune des tables cloisonnées rend **zéro ligne**. C'est la preuve la plus forte du dépôt (§9, 31/08) : une RLS éteinte n'y survit pas.
2. **`ecartsTemoinLecture`**, écrit pour ce ticket — les référentiels de plateforme, de forme « référentiel » donc lisibles `USING (true)`, rendent **au moins une ligne**. Sans lui, *une connexion aveugle rendrait exactement le même résultat qu'un cloisonnement parfait*, et la veille aurait rapporté vert sur du vide (§9, 30/08).

**Ce qui NE rejoint pas la veille, et c'est écrit plutôt que tu.** La confrontation à l'inventaire à plat — *« chaque société voit exactement ses lignes, ni plus ni moins »* — exige une lecture **exemptée des politiques**, donc l'accréditation de migration. La veille a été construite pour ne pas la porter : *« on exposait chaque nuit, dans un travail automatique, une accréditation capable de tout écrire — pour lire un catalogue. »* Cette raison n'a pas faibli. `ecartsAvecContexte`, `ecartsTemoins` et `ecartsMesureVide` restent donc dans le flux de migration.

**Ce que la nuit prouve désormais** : aucune ligne cloisonnée n'est lisible sans contexte, et la lecture n'est pas aveugle. **Ce qu'elle ne prouve pas** : qu'une société ne voie pas les lignes d'une autre SOUS contexte. La coupure passe exactement là où passe le privilège.

**CONDITION DE RÉOUVERTURE, vérifiable et non interprétable :** le jour où un rôle lecteur **non privilégié et exempté des politiques** dispose d'un secret propre — `codiplan_reporting` et `REPORTING_DATABASE_URL`, attendus au lot 5 (D38) —, l'inventaire à plat se produit la nuit sans accréditation d'écriture, et la confrontation complète rejoint la veille. *Le critère se vérifie : le secret existe, ou il n'existe pas.*

### UNE EXCLUSION MESURÉE FAUSSE, ET RETIRÉE

`ecartsSansContexte` figurait dans `HORS_OBSERVATION` — la liste close des contrôles que la veille ne joue pas — avec ce motif : *« elle juge un décompte obtenu après un seed, que la veille ne joue pas. »* **Mesuré à la lecture de la fonction : elle ne prend que les décomptes observés, et aucun inventaire.** Elle n'a jamais eu besoin d'un seed. L'exclusion était juste pour ses voisines et fausse pour elle — recopiée depuis `ecartsAvecContexte`, à qui le motif appartient réellement. Elle est retirée.

*C'est la pente du §9 du 07/09 dans une liste d'exemptions : un motif énoncé de mémoire a exactement la forme d'un motif observé, et une exemption n'a personne pour la contredire — elle ne produit aucun signal.*

---

## D92 — LA DIXIÈME FORME DE POLITIQUE : « rattachement ». Aucun compte portail n'atteignait aucun écran

*Décision de session du 11 septembre 2026, ticket L2-12. Elle est la sœur de D61 et de D67, prise de l'autre côté : celles-ci ouvraient un chemin aux comptes INTERNES, celle-ci l'ouvre aux comptes PORTAIL.*

### LE MUR, MESURÉ AVANT D'ÊTRE CONTOURNÉ

D10 veut que « les deux tables soient exclusives » : un compte portail n'a **aucune** ligne dans `utilisateur_societe`. Et `utilisateur_client` portait la forme « habilitation », dont la première clause est `societe_id = app.societe_id`. **Rien ne pouvait donc donner une société à un compte portail, et sans société il ne lisait pas son propre rattachement.**

*Mesuré le 11/09/2026 sous `codiplan_app` — rôle non privilégié (`rolbypassrls` = f) —, avec témoin préalable : zéro société lisible sans contexte.*

| Ce qui est posé | Lignes de `utilisateur_client` vues |
|---|---|
| `app.utilisateur_id` seul | **0** |
| `app.utilisateur_id` + `app.societe_id` | 3 |
| *(pour mémoire)* `utilisateur_societe` de ce compte | **0** |

A = 0 et C = 0 **ensemble** : la boucle est fermée sur elle-même. Aucun compte portail n'atteignait aucun écran, et **rien ne le disait** — il n'existait pas d'écran de portail pour buter dessus. *C'est le silence qui a la forme du succès (§9, 31/08), et c'est la deuxième fois qu'une politique juste attendait un appelant qui n'existait pas : D61 et D67 avaient dormi deux jours dans le même état.*

### LA DÉCISION

**`utilisateur_client` reçoit une politique de `SELECT` — et de `SELECT` seul — ancrée sur `utilisateur_id = app.utilisateur_id`.** Un compte lit SES rattachements, toutes sociétés confondues ; jamais ceux d'autrui. La forme « habilitation » n'est pas touchée : elle continue de gouverner tout le reste, écritures comprises.

**LE COÛT, NOMMÉ comme D61 et D67 ont nommé le leur** : *une personne apprend la liste des clients auxquels elle est déjà rattachée.* Elle n'apprend ni leur NOM — `client` reste de forme « parc » —, ni aucune de leurs données, ni l'existence d'aucun autre client, ni le rattachement de quiconque d'autre.

**ET CE QUI LA BORNE EST LA COMMANDE, PAS LA CLAUSE.** La même branche sur une écriture laisserait un compte **se rattacher au client de son choix**, c'est-à-dire s'ouvrir le parc d'un tiers — la fuite exacte que la forme « parc » existe pour empêcher. `FOR SELECT` n'accepte d'ailleurs aucun `WITH CHECK` : la borne est structurelle et non déclarative. Un gardien le vérifie commande par commande, et un scénario montre l'insertion refusée.

Liste close gardée dans les **deux** sens — `TABLES_RATTACHEMENT`. Le **retrait** est le sens silencieux : il fait retomber la table sur la forme « habilitation », qui passe tous les gardiens, et le mur revient.

### ET LA NEUVIÈME FORME S'ÉTEND, SANS CHANGER DE RÈGLE

D67 dit : « un compte lit les lignes des sociétés **où il est habilité** ». Sa politique ne traversait que `utilisateur_societe` — la seule table d'habilitation qui existât quand elle a été écrite. **Un compte portail EST habilité, par `utilisateur_client` (D10)** ; la règle ne bouge pas d'un mot, c'est son énumération qui devient exacte. Sans cette moitié, D92 rendrait au compte portail la LISTE de ses sociétés et lui refuserait leur NOM : *exactement l'impasse que D67 a levée pour les comptes internes.* La sous-requête est elle-même soumise aux politiques, donc la règle est écrite **une fois** et se recompose.

### CE QUE LE PORTAIL EST, ET CE QU'IL N'EST PAS

**Consultation seule.** Le bouton « demander une intervention » n'est pas tranché : il n'est ni construit **ni préparé** — aucune table ne l'attend, aucun champ mort ne le devance. *Une place réservée pour une décision qu'on n'a pas prise est une décision prise par personne (§9, 24/08).*

**Aucune comparaison de société ni de client n'est écrite au-dessus des politiques.** On lit SOUS le contexte, la forme « parc » décide, et les trois filtres — société, client, périmètre de sites — mordent ensemble. Une comparaison écrite dans l'écran serait une seconde lecture d'un même critère (§9, 01/09), verte aujourd'hui et permissive le jour où elle divergerait.

**Les emplacements des documents (lot 8, D87) et de l'état VGP (lot 9, D88) sont TENUS ET DITS VIDES.** Ni un compte de documents à zéro — il se lirait comme une mesure (§9, 06/09) —, ni un état « à jour » — il serait faux au sens de D88, *« sans information » n'étant ni « à jour » ni « en retard »*.

### CONDITION DE RÉOUVERTURE, vérifiable et non interprétable

*Le jour où un compte portail devra écrire quoi que ce soit — une demande d'intervention, une remarque —, cette forme ne suffira pas : elle est en lecture, par construction. Ce jour-là, c'est un arbitrage NOUVEAU qu'il faudra, jamais un élargissement de celui-ci.* Le critère se vérifie : la politique porte `FOR SELECT`, ou elle ne le porte plus.

---

## D93 — LE CHEMIN D'ACCÈS AU MODÈLE PASSE PAR LA MACHINE : deux formes de politique, la onzième et la douzième

*Décision d'exploitation du 13 septembre 2026, prise par Alexis et instruite par la session au ticket du lot 8. **Elle répond à la question que D87 avait laissée ouverte** — « un document de MODÈLE n'a ni machine ni site, et son cloisonnement est celui de `modele_materiel` ; la question s'instruit avec sa mesure au moment du ticket ». C'est ce moment, et voici la mesure.*

### LA DÉCISION, DANS LES MOTS DE L'EXPLOITATION

> Un compte de portail ne voit les documents d'un MODÈLE que si une machine de ce modèle se trouve DANS SON PROPRE PÉRIMÈTRE — sa société, son site, son habilitation. Jamais parce que sa société en possède un ailleurs.

**La raison, et c'est elle qui décide de la forme :** sinon la présence d'une notice révèle la composition du parc des autres sites. *Un compte restreint à Ducos déduirait ce que Koné possède. Le cloisonnement fuirait par la LISTE DES DOCUMENTS au lieu de fuir par les données — et il fuirait quand même.*

**Ce n'est donc pas la forme du document qu'il faut changer, c'est LE CHEMIN D'ACCÈS AU MODÈLE.** Le chemin passe par machine → site → habilitation, jamais par société → modèle.

### CE QUI A ÉTÉ MESURÉ, ET AVEC QUOI

*Sous `codiplan_app` — rôle non privilégié —, avec témoin préalable : les deux drapeaux RLS posés sur `document`, et zéro ligne lisible sans contexte pour six lignes réellement en base.* La fixture est délibérément adversaire : `MACHINE_A3` est installée sur le site S2, **chez le même client et dans la même société** que le compte portail restreint au site S1, et son modèle `MODELE_A_AILLEURS` n'a aucune autre machine.

| Ce que lit le compte portail restreint à S1 | Sous la forme « société » | Sous la forme « ascendance » |
|---|---|---|
| documents visibles | 4 dont la notice du modèle d'ailleurs | **2** |
| modèles visibles | 2 | **1** |
| familles visibles | 2 | **1** |
| `count(*)` sur le modèle d'ailleurs | 1 | **0** |
| `count(*)` sur son propre modèle *(témoin)* | 1 | **1** |

La dernière ligne est le témoin qui rend les autres lisibles : *zéro serait aussi bien la preuve que la lecture ne marche pas.*

### LES DEUX FORMES

**LA ONZIÈME — « héritage », pour `document`.** *Un document est visible si sa CIBLE l'est, et la classe ne fait que RÉTRÉCIR.* C'est la filiation de L1-04 avec deux différences, et ce sont elles qui font l'arbitrage que L8-04 réclamait :

1. **La cible est POLYMORPHE** — deux parents possibles, exactement un renseigné (`num_nonnulls(modele_id, machine_id) = 1`). La forme « filiation » n'en connaît qu'un, et lui en donner deux en silence aurait été l'effet de bord que le ticket refuse.
2. **La classe RÉTRÉCIT** — `interne` disparaît pour un compte portail. C'est un axe de RESTRICTION, jamais un axe d'accès : il n'ouvre rien à personne.

**Aucune clause de société n'y est écrite**, et c'est la doctrine de la filiation : elle serait une seconde source du même fait (§9, 01/09). Ce qui empêche un document de dériver de la société de sa cible n'est pas une clause mais la clé étrangère composite. **Tout le cloisonnement de D10 et D22 est donc porté par la sous-requête**, `machine` étant de forme « parc ».

**LA DOUZIÈME — « ascendance », pour `modele_materiel` et `famille_materiel`.** *Un parent n'est visible, pour un compte portail, que si l'un de ses ENFANTS l'est.* C'est l'INVERSE exact de la filiation, et c'est pourquoi ce n'est pas la même forme : la filiation propage vers le bas une visibilité déjà acquise, l'ascendance REFUSE vers le haut une visibilité que la clause de société donnait.

**Le DISCRIMINANT est `app.client_id`**, comme dans la forme « habilitation » et pour la même raison : la restriction ne vise que le compte portail. Un utilisateur interne garde la clause de société seule — sans quoi créer un modèle avant sa première machine serait impossible, la table se refusant à elle-même.

### POURQUOI `famille_materiel` REÇOIT LA MÊME FORME LE MÊME JOUR

La fuite est identique un étage plus haut : une famille « ponts élévateurs » visible dit qu'il y a un pont quelque part. Écrire « le jour où un écran de portail lira les familles, la question sera due » aurait été la laisser filer — *le silence a exactement la forme du succès* (§9, 31/08). La chaîne est donc fermée sur les deux étages : famille visible si un de ses modèles l'est, modèle visible si une de ses machines l'est, machine visible selon la forme « parc ». **Trois maillons, un seul critère, écrit une seule fois** — chaque politique lit celle du dessous, et rien n'est recopié.

### LE COÛT, NOMMÉ comme D61, D67 et D92 ont nommé le leur

- *Un compte portail ne voit plus les modèles dont il ne possède aucune machine visible* — y compris un modèle qu'il exploite réellement mais dont la fiche machine n'a pas encore été saisie, et y compris un modèle commandé et non encore livré. **La documentation d'un matériel non recensé est inaccessible au client tant que le recensement n'est pas fait**, et c'est le prix exact de la fuite refusée.
- *L'utilisateur interne ne perd rien.* Mesuré : il lit les deux modèles et les deux familles.
- *Le coût d'exécution est MESURÉ, pas affirmé* (§9, 07/09 — la même phrase a déjà été démentie une fois par un `EXPLAIN`). `EXPLAIN SELECT "id" FROM "modele_materiel"` sous contexte portail rend `filter: (… or (hashed subplan 2))` : **le sous-plan est évalué UNE fois et haché**, chaque ligne de modèle n'étant ensuite qu'une recherche dans la table de hachage. Ce n'est pas « une sous-requête à chaque ligne lue ». La mesure est rejouée à chaque `pnpm test:isolation`.

### CE QUI LES BORNE, ET LES DEUX LISTES CLOSES

`TABLES_HERITAGE` et `TABLES_ASCENDANCE`, gardées **dans les deux sens**. Le RETRAIT est ici le geste dangereux : il fait retomber la table sur la forme « société », **qui passe tous les gardiens de forme sans rien dire**, et rouvre la fuite. Le jumeau le montre en acte — la politique d'ascendance remplacée par la clause de société seule, dans une transaction annulée, et la notice du modèle d'ailleurs reparaît au compte restreint.

### CE QUE CE TICKET NE CONSTRUIT PAS, ET C'EST ÉCRIT PLUTÔT QUE TU

**Le module de stockage n'existe pas.** La colonne `objet_cle` dit où sont les octets ; **aucun code ne la remplit**, parce qu'aucun écran ne l'appelle. *Une interface sans appelant est la maladie que le portail vient de soigner* — c'est la consigne d'exploitation du 13/09 (« stockage en dernier, quand il aura un appelant ») et c'est aussi la raison pour laquelle une consigne antérieure, qui demandait cette interface au lot 8, a été refusée avec sa mesure.

**`document` naît donc VIDE**, et le rapport d'inventaire la nomme comme telle : une table dont les deux côtés de la comparaison valent zéro n'est ni un écart ni une preuve, elle est retranchée de ce que le rapport affirme (§9, 10/09).

### CONDITION DE RÉOUVERTURE, vérifiable et non interprétable

*Le jour où un compte portail devra voir la documentation d'un matériel qu'il n'a pas encore reçu — une notice envoyée avant la livraison —, l'ascendance ne suffira plus : elle est ancrée sur l'existence d'une machine, par construction.* Ce jour-là, c'est un arbitrage NOUVEAU qu'il faudra, et il devra dire **ce qui remplace la machine comme preuve du lien** — une commande, un contrat, un rattachement explicite. Le critère se vérifie : la clause porte `EXISTS (SELECT 1 FROM machine …)`, ou elle ne le porte plus.

*Aucune règle du chapitre 10 n'est amendée — le chapitre n'y traite pas de la documentation des machines. Le chapitre 11 reçoit en revanche la forme réelle de `document`, que D87 avait annoncée « au moment du ticket » : elle y était encore décrite comme « polymorphe rattachée à machine, contrat, client ou intervention ».*

---

## D94 — LA TREIZIÈME FORME : « interne ». Le bac nomme des fichiers, et un nom de fichier révèle le parc

*Décision de session du 13 septembre 2026, prise au ticket L8-07 et écrite avec sa condition de réouverture. **Elle n'a pas été demandée** : elle est née d'une mesure faite dans le ticket qui la crée, et c'est ce qui la rend intéressante à relire.*

### CE QUI A ÉTÉ VU, ET QUAND

D93 venait de fermer, le matin même, une fuite qui ne passe pas par les données mais par la LISTE : *la présence d'une notice révèle la composition du parc des autres sites.* Le bac de réception, écrit l'après-midi, porte des **noms de fichiers** — `notice-KPX-337.pdf` dit qu'un pont élévateur existe quelque part dans la société.

Or **une table de forme « société » est lisible par un compte portail** : sa clause ne lit pas `app.client_id`. Donner cette forme au bac aurait **rouvert par la porte de service ce qu'on fermait par la porte principale, dans le ticket même qui la ferme.**

*Mesuré, avec le jumeau : la politique du bac remplacée par la clause de société seule, un compte portail du client A1 lit `notice-KPX-337.pdf`. Le témoin qui rend la mesure lisible est que le MÊME compte, au MÊME instant, lit bien ses propres documents — ce n'est donc pas la session qui est muette, c'est le bac qui est fermé.*

### LA DÉCISION

**`document_recu` porte la forme « interne » : société ET `app.client_id` absent.** *Une table interne n'est pas lisible par un compte portail, quel que soit son client.* Le discriminant est celui des formes « habilitation » et « ascendance », employé ici dans son sens le plus simple.

**LE COÛT, NOMMÉ** : aucun, pour le portail — il n'a jamais rien eu à faire dans le bac. Le coût réel est ailleurs, et il est de méthode : **une treizième forme dans une session qui en avait déjà pris deux.** Elle se justifie parce qu'elle ferme une fuite mesurée, pas parce qu'elle range mieux.

### CE QU'ELLE DÉCOUVRE ET NE TRANCHE PAS — c'est la partie qui compte

**`taux_horaire`, `forfait`, `agence`, `habilitation` et les autres tables de forme « société » sont dans le MÊME CAS AUJOURD'HUI.** Un compte portail muni d'une société les lirait : la grille tarifaire, le catalogue de forfaits, la liste des agences. Aucun écran ne les lui donne — c'est le seul motif pour lequel personne ne l'a vu.

**Cette forme ne prétend donc pas fermer la classe : elle ferme la table qu'elle crée, et écrit ce qu'elle laisse ouvert.** L'étendre en séance aux dix tables concernées aurait été un arbitrage bien plus large qu'un ticket de bac de réception, pris sans mesure sur chacune — *exactement le geste que « une addition passe par un arbitrage » existe pour empêcher.*

**CONDITION DE RÉOUVERTURE, vérifiable et non interprétable** : *le jour où un écran ou une route de portail lit une table de forme « société », la question du discriminant `app.client_id` sur les tables purement internes est due, et elle vise la CLASSE et non une table.* Le critère se vérifie en lisant les appelants sous `app/(portail)/` : ils ne touchent aujourd'hui que `utilisateur_client`, `client`, `site`, `machine`, `document` — toutes de forme « rattachement », « parc » ou « héritage ».

*Aucune règle du chapitre 10 n'est amendée. Le chapitre 11 reçoit `document_recu`.*

---

## D95 — LA MAQUETTE FAIT FOI SUR L'APPARENCE, et l'apparence devient un THÈME parmi plusieurs

*Arbitrage rendu par l'exploitation le 11/09/2026, à la lecture des captures d'écran de l'application en ligne. Écrit ici dans le compte rendu de la session, et non ouvert en ticket : l'automatisation ayant été abandonnée le matin même, un arbitrage ne se pose plus en ticket qu'un agent viendrait relever.*

### CE QUI A ÉTÉ VU

`docs/maquette/CODIPLAN_Maquette.html` a été validée au départ du projet : onze écrans, autoportante. Le §1 du `CLAUDE.md` la rangeait comme *« une illustration d'intention, pas une spécification »*, avec deux exceptions promues au rang de règle — le formatage monétaire et les codes couleur des statuts.

**Mesuré le 11/09/2026 sur les captures d'Alexis, en fenêtre de 1700 px, puis reproduit en local :** l'application ne ressemblait à cette maquette sur aucun des cinq points regardés. Colonne utile de **1024 px** là où la maquette en veut **1400** — et **448 px** sur `/arrivee`, contenu centré à mi-hauteur. **Aucune navigation** : zéro fichier trouvé par `grep -rln 'nav\b\|Navigation' app components`, et l'on ne circulait qu'en tapant une URL. `/planning` empilait trois blocs de charge et deux listes verticales là où la maquette montre une grille. Des cartes là où la maquette met des tableaux denses. Et une palette `oklch` neutre, sans rapport avec l'annexe C.

**Le fichier déposé le 11/09 sous `docs/maquette/CODIPLAN_Maquette.html` est OCTET POUR OCTET celui qui vit dans `docs/maquette/` depuis le 08/09** — `cmp` est muet, les deux empreintes MD5 valent `99c7f9f3c8ea1237d2b419b7766c9631`. *Ce n'est donc pas un document nouveau : c'est le même document, dont le RANG change.* Il était dans le dépôt, lisible, et personne ne construisait contre lui.

### LA DÉCISION

**1. La maquette fait foi sur la DISPOSITION et sur les COULEURS.** Elle cesse d'être une illustration d'intention pour ces deux aspects. Ce qu'elle ne dit pas reste libre ; ce qu'elle dit se suit.

**2. La charte « le tableau » du 09/09 ne fait plus foi comme apparence par défaut. Elle devient un THÈME ALTERNATIF.** *Le nom « le tableau » ne désigne aucun document de ce dépôt — il n'apparaît nulle part, mesuré.* La décision le définit donc par ce qui est observable : **l'apparence en vigueur sur `main` au commit `d03a4a5`**, c'est-à-dire les jetons `oklch` neutres de `app/globals.css` et les gris ardoise de `lib/theme/defaut.ts`. C'est cet ensemble-là qui devient un second thème, à construire.

**3. CODIPLAN prévoit PLUSIEURS THÈMES, et le thème est une propriété de la SOCIÉTÉ.** C'est une exigence commerciale avant d'être un confort : la solution est vendue, et un client tiers voudra ses propres couleurs. *Ce n'est pas la charte de société de L0-09, qui ne porte que deux couleurs d'identité : c'est le socle entier — surfaces, bordures, encres, familles de statut.*

### CE QUI EST CONSTRUIT AUJOURD'HUI, ET CE QUI NE L'EST PAS

**Construit** : le mécanisme. Toutes les couleurs passent par des jetons ; **aucune valeur n'est écrite dans un composant** ; le thème par défaut reprend ceux de la maquette, à la valeur près — un gardien confronte huit d'entre eux au bloc `:root` du document lui-même, et la largeur utile à son `.wrap`. La barre à onze entrées est confrontée à la barre de la maquette, libellés et ordre compris. `/planning` est refait en grille.

**Délibérément PAS construit** : le **sélecteur** de thème — un réglage sans usage tant qu'il n'existe qu'un thème, et c'est la faute que `parametrage.ts` évite déjà sur les créneaux ; le **second thème** lui-même ; le **rattachement du thème à la société**, qui suppose une colonne, donc une migration, donc un arbitrage de schéma. Les trois sont inscrits au backlog.

**Ce qui est exigé en revanche, et qui est le vrai livrable : qu'ajouter un thème plus tard ne demande de toucher à AUCUN écran.** Un écran nomme un RÔLE — `bg-app-surface` —, jamais une couleur. Ajouter « le tableau », ce sera un bloc `[data-apparence="tableau"]` dans la feuille de style et une entrée dans `APPARENCES`, et rien d'autre.

### DEUX POINTS OÙ LA MAQUETTE ET L'ANNEXE D NE SE RECOUVRENT PAS

*Ils sont écrits plutôt que tranchés — la source est ambiguë, et le §8 dit ce qu'on fait alors. La lecture retenue en attendant n'introduit AUCUNE valeur nouvelle : elle n'emploie que des jetons que la maquette porte déjà.*

**« Envoyée » et « clôturée ».** L'annexe D les distingue de leurs voisines par la profondeur — *bleu FONCÉ* contre bleu, *vert* contre *vert CLAIR*. La maquette ne porte qu'un style de bloc bleu et un vert : sa légende compte **six entrées pour huit statuts**. Les deux jetons « pleins » retenus sont ceux de son onglet actif et de son bouton de validation, c'est-à-dire les mêmes couleurs à pleine saturation.

**« Suspendue : orange HACHURÉ ».** L'annexe D demande une hachure ; la maquette réserve sa trame au **site fermé** et peint la suspension en orange plein. Donner la trame aux deux rendrait indiscernables *« ce technicien est suspendu »* et *« ce jour n'est pas ouvert »* — un contresens de lecture sur l'écran même qui sert à poser un rendez-vous. L'orange plein est retenu.

### CE QUE LA MAQUETTE PRESCRIT ET QUE LE DÉPÔT NE PEUT PAS SERVIR

**Le NOM d'un technicien.** La maquette écrit « D. Guérin · Ducos · Compresseurs, ponts ». Le dépôt n'a ni la table `technicien` du chapitre 11 — marquée `(prévu)` au §6 du `CLAUDE.md` — ni aucune colonne de spécialité, et `utilisateur` porte la forme de politique « désignation » : son nom ne se lit qu'en NOMMANT sa ligne, une par une. La grille rend donc l'identifiant abrégé, exactement comme la charge par technicien depuis le 10/09. *Inventer un libellé serait inventer une donnée.*

**Une apparence SOMBRE.** La maquette n'en décrit aucune. Le bloc `prefers-color-scheme` qui vivait dans la feuille de style servait des jetons neutres sans rapport avec la charte, et aucun code ne posait la classe : il rendait une moitié d'application hors charte au premier téléphone réglé en sombre. Il est **retiré**, et une apparence sombre sera un thème — donc une décision, avec ses couleurs validées.

### CONDITION DE RÉOUVERTURE, vérifiable

*Le jour où un écran devra s'écarter de la maquette, l'écart s'écrit avec sa mesure et le point précis où la maquette est muette — jamais « la maquette ne prévoyait pas ce cas ».* Et le jour où un second thème existe, le sélecteur devient dû : un thème que personne ne peut choisir est un thème que personne ne verra.

*Aucune règle du chapitre 10 n'est amendée. L'annexe D est CONSERVÉE, dans ses huit lignes ; ce qui change est la manière de les écrire.*

---

## D96 — LE LIEN D'INVITATION AU PORTAIL : une porte DISTINCTE de celle du premier compte interne

*Arbitrage rendu par l'exploitation le 11/09/2026, en réponse au ticket ouvert le même jour — « Aucun client ne peut se connecter au portail — par quel canal reçoit-il son premier accès ? ». Inscrit ici par la session de nuit du 11/09.*

### CE QUI A ÉTÉ MESURÉ

**Aucun client ne peut se connecter au portail aujourd'hui, et les trois moitiés du constat se lisent dans trois fichiers.**

- **D10 veut les deux tables exclusives** : un compte de portail n'a **aucune** ligne dans `utilisateur_societe` ; son rattachement vit dans `utilisateur_client`, et D92 a ouvert la politique qui le lui rend lisible sans société active.
- **Le seul dispositif d'ouverture de compte du dépôt exige précisément cette ligne.** `lib/auth/amorcage.ts` réclame une société (`demande.societeId`) et crée l'habilitation (`tx.utilisateurSociete.create`) — *mesuré en lisant le fichier le 11/09/2026.* Ce qu'il ouvre est donc un compte **interne**, par construction.
- **L'enrôlement n'est pas une porte** : `lib/auth/enrolement.ts` est la seule transition en libre-service (D58), et elle POSE un second facteur sur un compte qui existe déjà. Elle ne crée aucun compte et ne pose aucun rattachement.

*La boucle que D92 avait fermée côté lecture restait donc ouverte côté ENTRÉE : la politique était juste, l'écran existait depuis L2-12, et il n'y avait personne pour les franchir.* C'est la maladie du §6 sous sa forme la plus complète — non plus une interface sans appelant, mais un produit entier sans utilisateur possible.

### LA DÉCISION

**1. Le lien d'invitation est une porte DISTINCTE de celle du premier compte interne.** Il n'exige **aucune** habilitation de société, et il **porte lui-même le rattachement au client** — et, le cas échéant, le périmètre de sites que ce rattachement restreint. *Réutiliser l'amorçage aurait obligé à donner une habilitation de société à un compte de portail, c'est-à-dire à défaire D10 pour ouvrir une porte.*

**2. Personne ne s'inscrit seul.** Les clients sont des garages professionnels que l'agence connaît ; l'invitation part du **back-office**, jamais d'un formulaire public. Il n'existe donc aucune route d'inscription ouverte, et l'inscription fermée de `lib/auth/inscription-fermee.ts` reste la règle.

**3. Quatre exigences, et elles sont tenues par la BASE, jamais par l'écran** : **usage unique**, **durée limitée**, **révocable**, **tracé** — qui a invité qui, quand. *Un lien d'invitation est un matériau d'authentification : il se range comme tel (I1, troisième catégorie), et « l'écran ne le propose qu'une fois » n'est pas un usage unique.*

**4. V1 : le lien est ENGENDRÉ dans le back-office, et l'agence le transmet par ses propres moyens.**

### CE QUI N'EST PAS CONSTRUIT, ET LA RAISON EST MESURÉE

**L'ENVOI.** Le §2 nomme Resend, et **aucun expéditeur n'est configuré** : poser la clé est un geste hors du dépôt, donc un cas d'arrêt (§2 du protocole de session). *Une fonction d'envoi sans expéditeur est une promesse vide* — et elle est pire qu'une interface sans appelant, puisqu'elle a un appelant : elle échoue **en production**, à l'instant où une agence croit avoir invité un client.

### LE COÛT, NOMMÉ

**Un lien transmis hors bande ne prouve pas l'adresse de son destinataire.** Le lien vaut donc pour **qui le reçoit**, et c'est l'agence qui répond de la transmission. C'est exactement le régime du lien de premier accès interne, assumé pour la même raison et avec la même conséquence : *un lien d'invitation se traite comme un mot de passe tant qu'il n'a pas été consommé.* La durée limitée et la révocation sont ce qui borne ce coût ; elles ne le suppriment pas.

### CE QUE CETTE DÉCISION LAISSE À LA SESSION, ET CE N'EST PAS UN OUBLI

Le ticket d'arbitrage posait une seconde question — *« qui, chez CODIMA, a le droit d'ouvrir un accès à un client ? »* —, et la réponse rendue n'en dit qu'une moitié : **le back-office**, jamais un formulaire public. **Le RÔLE exact relève de la session** : il ne touche ni l'argent facturé, ni une obligation légale, ni ce qu'un client voit (§1 du protocole), et la matrice du §5.2 du cahier des charges le décide déjà pour les actes voisins. *Ce qui est tranché ici est qu'une invitation est un acte d'AGENCE, pas un acte de client ; lequel de ses rôles le porte est une question de matrice.*

### CONDITION DE RÉOUVERTURE, vérifiable

*Le jour où un expéditeur de courriel est configuré — une clé Resend présente dans l'environnement de production —, **l'envoi devient dû** et le lien cesse d'être transmis à la main.* Et une seconde, distincte : *le jour où un client devra inviter lui-même ses propres collaborateurs*, la délégation se rouvre — elle n'est pas tranchée ici, et la décision ci-dessus ne la préjuge pas : elle dit qui invite aujourd'hui, pas qui pourra inviter demain.

*Aucune règle du chapitre 10 n'est amendée : RG-DRO-01 borne ce qu'un client voit, jamais la façon dont il reçoit son accès.*

---

## D97 — LE PORTAIL A SA PROPRE BARRE, et elle ne porte que ce qui existe et appartient au client

*Arbitrage rendu par l'exploitation le 11/09/2026 sur le ticket R2-17, qui était bloqué depuis sa mesure : la barre touche **ce qu'un client voit**, et c'est l'un des trois domaines réservés du §1 du protocole de session.*

### CE QUI A ÉTÉ MESURÉ

`app/(portail)/portail` recevait la barre à onze entrées **du back-office** — celle que D95 confronte à la maquette, laquelle est une maquette de back-office : « Planning », « Techniciens », « Facturation », « Paramètres ». *Ce n'est pas une fuite de cloisonnement* : aucune entrée ne mène à une route servie, et une entrée inerte n'est pas un lien (D95). **C'est une fuite de LECTURE**, et elle est vue par un client.

### LA DÉCISION

**Le portail a SA barre, jamais celle du back-office.** Elle ne porte que **ce qui existe** et **ce qui appartient au client**.

Le motif est écrit pour être relu : *un client qui lit « Facturation » ou « Techniciens » au-dessus de son espace apprend l'existence d'un outil qui n'est pas le sien.* C'est la règle du §2 de la doctrine — **une fuite par déduction est une fuite** — appliquée non plus à un compteur mais à un **libellé**. Une entrée de menu n'a besoin d'aucune donnée derrière elle pour renseigner : elle renseigne par son existence.

**Les deux issues écartées, avec ce qu'elles coûtaient.** *Pas de barre du tout* : le moins cher, et le portail perd son point de retour — un client qui ouvre une fiche n'a plus de chemin vers sa liste. *Ne rien changer tant qu'aucun client ne voit le portail* : gratuit aujourd'hui, et c'est **exactement** le raisonnement qui a laissé onze entrées au-dessus de l'écran de connexion jusqu'à R2-16.

**Et la règle de composition est celle de R2-16, sans exception nouvelle** : la barre est rendue par la **mise en page du segment**, jamais par une liste de chemins tenue à la main. Le segment `(portail)` rend la sienne comme `(back-office)` rend la sienne. *Une liste de chemins oublierait le prochain écran ; un répertoire ne s'oublie pas.*

**Ce que cette barre n'est pas, et ce point ne s'assouplit jamais : un contrôle d'accès.** Masquer une entrée serait une seconde lecture d'un critère que la politique porte déjà — et c'est celle qui vieillit sans rougir. Ce qui protège le parc d'un client est la forme « parc » et la forme « rattachement », pas l'absence d'un lien.

### CONDITION DE RÉOUVERTURE, vérifiable

*Le jour où une maquette de portail existe*, elle fait foi sur cette barre comme la maquette de back-office fait foi sur l'autre (D95), et les entrées retenues ici se confrontent à elle. En attendant, **chaque entrée du portail s'adosse à un écran servi** : une entrée inerte est admise dans une barre que la maquette prescrit, elle ne l'est pas dans une barre qu'on dessine soi-même — *inventer une entrée inerte, c'est promettre au client un outil qu'on n'a pas décidé de lui donner.*

*Aucune règle du chapitre 10 n'est amendée. RG-DRO-01 dit ce qu'un client a le droit de lire ; cette décision dit ce qu'on lui montre, et elle ne peut que réduire.*

---

## D98 — « FICHE MACHINE » SORT DE LA BARRE : un écart DÉLIBÉRÉ à la maquette, écrit comme tel

*Arbitrage rendu par l'exploitation le 11/09/2026 sur le ticket R2-22, mesuré en livrant R2-21.*

### CE QUI A ÉTÉ MESURÉ

L'entrée « Fiche machine » de la barre portait la mention d'ouverture « ouverte par L2-01 (écran) ». **Cet écran a été livré** — R2-21, commit `774351d` sur `main` —, et l'entrée est restée inerte : *la mention désignait un ticket déjà fait, ce qui ne casse rien et ment doucement.*

**La question n'est pas celle d'un écran manquant.** Une fiche a besoin d'un **identifiant**. « Fiche machine » ne peut donc pas être une section de navigation, **quel que soit le travail qu'on y mette** : il n'existe aucune machine « par défaut » vers laquelle une entrée de menu pourrait pointer.

### LA DÉCISION

**L'entrée disparaît. La barre passe de onze entrées à dix.**

**C'est un ÉCART DÉLIBÉRÉ à la maquette, qui fait foi sur la disposition (D95), et il est consigné ici pour que personne ne le prenne demain pour un oubli.** La raison, écrite une fois : *la maquette liste « Fiche machine » parce qu'elle est un **catalogue d'écrans**, pas un menu.* Elle montre onze écrans pour qu'on les voie tous ; une barre de navigation donne accès à des **sections**, et une fiche n'en est pas une. Un produit atteint une fiche **depuis le parc**, depuis un **QR code** (D22, `lib/machines/resolution.ts`) ou depuis une **intervention** — trois chemins qui portent tous un identifiant, et qui existent.

**Les deux issues écartées, avec ce qu'elles coûtaient.** *L'entrée reste inerte pour toujours* : honnête, et elle occupe une place dans une barre de dix — le prix d'une place de menu se paie sur tous les écrans, tous les jours. *L'entrée mène à une RECHERCHE de machine* : elle donnerait un sens à la place qu'elle occupe, et ce serait **inventer un écran que la maquette ne décrit pas** pour sauver une entrée que la maquette décrit — le remède plus coûteux que le mal. La recherche viendra si le parc la réclame, et elle vivra alors **dans** l'écran du parc, où elle est utile.

### CE QUE CETTE DÉCISION APPREND SUR LA MAQUETTE, et qui vaut au-delà d'elle

*Une source qui fait foi sur la DISPOSITION ne fait pas foi sur la NAVIGATION.* D95 dit « ce qu'elle montre se suit ; ce qu'elle ne dit pas reste libre ». La maquette **montre** une barre — ses libellés et son ordre font foi — mais elle ne dit **pas** ce qu'est une section : c'est une propriété du produit, pas du dessin. *Le point précis où elle est muette est donc nommé, comme D95 l'exige, et il n'est pas « elle ne prévoyait pas ce cas ».*

### CONDITION DE RÉOUVERTURE, vérifiable

*Le jour où un écran de RECHERCHE de machines existe — une route servie qui rend une liste depuis une saisie —, l'entrée peut revenir en pointant sur lui, et la barre repasse à onze.* Elle ne revient jamais inerte.

*Aucune règle du chapitre 10 n'est amendée.*

---

## D99 — LES DEUX REFUS DE LA POSE SONT DES RÈGLES DE GESTION, et RG-PLA-03 disait le contraire

**Règles amendées :** RG-PLA-03, RG-PLA-07

*Arbitrage rendu par l'exploitation le 11/09/2026 : les deux règles de refus livrées par R2-19 sont des règles de MÉTIER, pas des détails d'implémentation, et elles doivent survivre au code qui les porte. Inscrit ici par la session de nuit, qui a trouvé en l'écrivant que l'une des deux **contredisait le chapitre 10**.*

### CE QUI A ÉTÉ MESURÉ EN ÉCRIVANT CETTE DÉCISION

**RG-PLA-03 disait l'inverse de ce qui est livré, et rien ne l'avait vu.**

| | |
|---|---|
| **Le chapitre 10, avant ce jour** | « Un chevauchement sur un même technicien est **signalé mais reste possible** : le planificateur garde la main. » |
| **Ce que le dépôt fait** | `lib/interventions/pose.ts` REFUSE, côté serveur, dans le dépôt cloisonné — livré par R2-19, commit `774351d` sur `main` |
| **Ce que la constitution écrit** | §6 du `CLAUDE.md` : « un chevauchement est une ERREUR, pas un avertissement » |

*Deux sources de rang 1 et 2 se contredisaient, et le code suivait la plus haute — ce qui est juste — sans que personne ne revienne corriger l'autre.* C'est **exactement** le défaut d'É8 que le câblage de R0-b a été écrit pour attraper : une décision qui réécrit une règle ailleurs qu'où elle s'écrit. Le gardien ne pouvait pas le voir, la réécriture ayant été faite **par un ticket** — un objet sans numéro de décision, que le câblage ne tient pas. *Numéroter est le geste qui la lui rend*, et c'est l'objet de cette section.

### LA DÉCISION — LES DEUX REFUS, ÉCRITS COMME RÈGLES

**RG-PLA-03 est réécrite.** Un chevauchement sur un même technicien est **refusé**, à la pose comme au déplacement. *Pour un exploitant, deux interventions au même moment sur la même personne ne sont pas une situation à surveiller : c'est une promesse qu'on ne peut pas tenir.* Trois précisions, toutes déjà tenues par le code et désormais écrites là où on les relira : **deux créneaux qui se TOUCHENT ne se chevauchent pas** ; une intervention **annulée** n'occupe plus rien ; une intervention **clôturée** occupe toujours — elle a eu lieu.

**RG-PLA-07 est introduite.** Une intervention ne se pose et ne se déplace que **dans le calendrier de l'agence visée** — celle de l'intervention, déduite de son site. Deux précisions : *l'union des calendriers affichée en vue semaine est un repère, jamais un droit de poser* ; et **une agence sans calendrier refuse** — *« inconnu » n'est pas « ouvert »*, et poser sans horaire connu promettrait un rendez-vous que personne ne peut tenir (I7).

**Les deux refus sont CÔTÉ SERVEUR, et l'écran n'en est que le messager.** *Une action refusée à l'écran mais acceptée par la base est un trou.* Tout refus **nomme son motif**, par une clé de dictionnaire — jamais par un texte venu de la réponse.

### POURQUOI CES DEUX-LÀ SONT DU MÉTIER ET NON DE L'IMPLÉMENTATION

*Le critère n'est pas « où est-ce écrit » mais « qu'est-ce qui décide ».* Un détail d'implémentation se corrige en changeant d'avis sur du code ; **ces deux règles se corrigent en changeant d'avis sur le métier** — un exploitant qui voudrait autoriser le chevauchement ne demanderait pas une modification technique, il demanderait une autre règle de planification. Et le test qui tranche est celui du §9 : *le jour où `lib/interventions/pose.ts` est réécrit, que reste-t-il ?* Avant ce jour, rien. C'est la définition d'une règle qui ne survit pas à son code.

### CE QUE CETTE DÉCISION NE TRANCHE PAS

**RG-PLA-04 n'est pas touchée** : l'habilitation bloquante refuse déjà, et pour une autre raison (D9). **RG-PLA-06 non plus** : l'absence validée n'existe pas encore en base. Et **le site fermé reste un avertissement** (I7) : ce sont les horaires du **client**, pas ceux de CODIMA, et un exploitant a le droit de convenir d'une intervention hors des heures d'ouverture d'un atelier.

### CONDITION DE RÉOUVERTURE, vérifiable

*Le jour où une intervention pourra être posée sur DEUX techniciens* — une pose à plusieurs, que le modèle ne porte pas aujourd'hui, `intervention` n'ayant qu'un technicien —, la notion de chevauchement change de sujet et RG-PLA-03 se relit. Et *le jour où une agence pourra intervenir sur le site d'une autre*, RG-PLA-07 doit dire laquelle des deux est « l'agence visée » ; elle dit aujourd'hui « celle du site », et c'est vrai tant qu'un site dépend d'une agence et d'une seule (RG-PLA-05).

---

## D100 — LE LOT D'IMPORT PREND LA FORME « INTERNE », et il la prend À SA NAISSANCE

*Tranché par la session de nuit du 11/09/2026, en construisant L1-08e. **Ce n'est pas une extension de la classe que D94 a laissée ouverte** : c'est le choix de la forme de DEUX TABLES NOUVELLES, au seul moment où la question se pose sans effort — celui où on les crée (I1).*

### CE QUI A ÉTÉ MESURÉ

`import_lot_ligne` porte, en clair, **la ligne du fichier telle qu'elle a été lue** — c'est `LigneControlee.valeurs`, et c'est ce que D15 exige pour restaurer à l'annulation. Un fichier d'import de parc contient **toutes** les machines de la société : *aucun périmètre de sites ne l'a jamais filtré, et aucun ne le filtrera — un fichier d'import n'est pas une vue, c'est une source.*

**Or une table de forme « société » est lisible par un compte de portail** : sa clause ne lit pas `app.client_id`. Lui donner cette forme aurait rendu à un compte restreint à un atelier la liste intégrale du parc de sa société, **par une table que personne n'aurait pensé à regarder**. C'est exactement ce que D94 venait de fermer sur le bac de réception, un étage plus loin : là un NOM DE FICHIER révélait le parc ; ici c'est **le parc lui-même**.

### LA DÉCISION

**`import_lot` et `import_lot_ligne` prennent la forme « interne » (D94)** — société **ET** `app.client_id` absent.

**Et le choix est fait à la naissance, ce qui est la seule chose qui le rend bon marché.** I1 l'écrit : *« le seul moment où la question de cloisonnement se pose sans effort est celui où la table est créée ; un ticket qui la traite comme un obstacle la reporte de trois arbitrages ».* Cette décision n'a coûté que le temps de l'écrire ; la même sur une table peuplée coûterait une migration et une reprise.

**Ce que cela ferme, nommé** : aucun compte de portail ne lit un lot d'import ni ses lignes, **quel que soit son client**. **Ce que cela ne ferme pas** : un utilisateur interne de la société les lit tous, comme il lit le parc — l'import est un acte de back-office, et le restreindre par agence serait une règle que personne n'a demandée.

### CE QUE CETTE DÉCISION N'EST PAS

*Elle ne répond pas à la question que D94 a laissée ouverte* — « le jour où un écran ou une route de portail lit une table de forme *société*, la question vise la CLASSE ». Cette condition-là n'est pas remplie : aucune route de portail ne lit `taux_horaire`, `forfait` ou `agence` aujourd'hui. **Deux tables nouvelles reçoivent leur forme ; les anciennes gardent la leur, et la question reste ouverte où D94 l'a laissée.**

### CONDITION DE RÉOUVERTURE, vérifiable

*Le jour où un client devra voir ce qui a été importé le concernant* — un rapport d'import remis au client, par exemple —, cette forme ne suffira plus : il faudra une vue filtrée par périmètre, et non l'ouverture de ces deux tables. **La forme « interne » se retire alors, elle ne s'assouplit pas** : assouplir la clause rendrait le parc entier, ce qui est précisément ce que cette décision refuse.

*Aucune règle du chapitre 10 n'est amendée. RG-IMP-01 dit ce qu'un import produit ; elle ne dit pas qui a le droit de le lire.*

---

## D101 — RAPPROCHER UNE AGENCE ET UN SITE : le CODE pour l'une, le COUPLE pour l'autre

*Tranché par la session de nuit du 11/09/2026, en construisant L1-09c. **Ce n'est pas un arbitrage d'Alexis** (§1 du protocole) : cela ne touche ni l'argent facturé, ni une obligation légale, ni ce qu'un client voit — un gabarit d'import est un document interne que l'agence remplit. La décision est écrite avec sa condition de réouverture, et la session continue.*

### CE QUI MANQUAIT, ET CE QUE LE SCHÉMA A RÉPONDU

RG-IMP-05 dit comment rapprocher un **client**. Rien ne disait comment rapprocher une **agence** ni un **site**, et les trois gabarits restants de L1-09 butaient dessus — *le mécanisme existait depuis L1-09b, c'était la règle qui manquait.*

**Le schéma répond, et il répond différemment pour les deux :**

| | Ce que la base garantit | Ce qu'on peut donc rapprocher |
|---|---|---|
| **agence** | `@@unique([societe_id, code])` — DUCOS, KONE, DOLBEAU | **le code, et lui seul** |
| **site** | aucune unicité sur le libellé | **le couple (client, libellé)**, qui peut être ambigu |

### LA DÉCISION

**1. Une agence se rapproche par son CODE, et JAMAIS par son libellé.** Le code est unique par société ; le libellé ne l'est pas. *Accepter le libellé « à défaut », par analogie avec RG-IMP-05, ferait dépendre le rattachement d'un site d'une chaîne que rien n'empêche d'être en double* — et un site rattaché à la mauvaise agence fausse **le temps de trajet** (D56), **le calendrier de référence** (I7) et **la majoration** (RG-TAR). *Un code absent du fichier est un parent introuvable, pas une invitation à deviner.*

**2. Un site se rapproche par le COUPLE (client, libellé normalisé)**, la normalisation étant celle de RG-IMP-05 — graphie seule. *Un site n'existe pas sans son client, et deux ateliers du même nom chez deux clients différents sont deux lieux.*

**3. Et l'ambiguïté d'un site est un REJET, comme celle d'un client.** Rien n'empêche deux sites du même client de porter le même libellé — la base ne l'interdit pas —, et le mécanisme de L1-08g s'applique sans une ligne de plus : *deux fiches qui rendent la même clé rendent indécidable ce qu'une ligne désigne.*

### POURQUOI L'ASYMÉTRIE EST UN RENSEIGNEMENT, ET NON UNE INCOHÉRENCE

*On aurait pu vouloir « la même règle partout ».* Elle aurait été fausse : **ce qui rend une clé utilisable n'est pas sa forme, c'est ce que la base garantit d'elle.** Le code d'agence est une clé parce qu'un index unique le dit ; le libellé d'un site n'en est pas une pour la même raison, et lui en donner le statut aurait produit des rattachements silencieusement faux.

### CONDITION DE RÉOUVERTURE, vérifiable

*Le jour où `site` recevra une unicité — un code de site, ou `UNIQUE (societe_id, client_id, libelle)` —*, le rapprochement d'un site cesse d'être ambigu et la règle se relit. Et *le jour où une agence pourra être importée* — elle ne l'est pas : les agences se créent à l'écran —, il faudra dire ce qui se passe quand le code n'existe pas encore.

*Aucune règle du chapitre 10 n'est amendée : RG-IMP-05 parle du rapprochement des CLIENTS, et elle reste exacte. Cette décision dit ce qu'elle ne dit pas.*

---

## D102 — LA DEMANDE EST DE FORME « PARC », ET C'EST LA SEULE TABLE DU LOT 2 OÙ UN CLIENT ÉCRIT

*Tranché par la session de nuit du 11/09/2026, en construisant L2-06. **Ce n'est pas un arbitrage d'Alexis** (§1 du protocole) : la question tombe sous la doctrine §2 — « l'accès à un objet partagé passe par les objets que le compte possède déjà, jamais par sa société » —, et la réponse est en outre imposée par une règle de rang 2 qui existe déjà. La décision est écrite avec sa condition de réouverture, et la session continue.*

### POURQUOI LA QUESTION SE POSE MALGRÉ TOUT

`TABLES_PARC` porte, en toutes lettres, que **toute addition passe par un arbitrage, jamais par une ligne ajoutée en séance**. Ce texte en est un.

### CE QUE LA RÈGLE DE RANG 2 IMPOSE DÉJÀ

RG-DRO-01 : *« Un client n'accède qu'aux données de son propre périmètre. Le contrôle est appliqué côté serveur, jamais seulement à l'affichage. »* Une demande porte `client_id` et `site_id`. **La clause de société seule est donc exclue par mesure**, comme elle l'a été pour `intervention` (D84) : sous elle, un compte de portail lirait les demandes des autres clients de sa propre société.

### CE QUI DISTINGUE `demande` DE `intervention`, ET QUI FAIT L'INTÉRÊT DE CE TEXTE

**Un compte de portail ÉCRIT dans cette table.** Le parcours P5 du chapitre 9 est explicite : *« Le client sélectionne la machine dans son parc, décrit le symptôme, joint une photo. La demande arrive dans la file de qualification avec accusé de réception immédiat. »* C'est la première et la seule table du lot 2 dans ce cas.

*La conséquence n'est pas décorative* : sur `intervention`, une clause trop large aurait fait fuir une lecture ; ici, elle aurait laissé **un client déposer une demande au nom d'un autre**. C'est pourquoi le `WITH CHECK` est écrit explicitement plutôt que laissé à PostgreSQL — *une politique qui n'énonce qu'un `USING` légifère en silence sur les écritures* (L1-02c), et il ne s'agit plus ici de silence théorique.

### DEUX CONSÉQUENCES DE SCHÉMA, ÉCRITES PARCE QU'ELLES SE DÉDUISENT MAL

**1. `site_id` est `NOT NULL`.** C'est la colonne de périmètre de la politique. *Une demande sans site serait une ligne qu'aucun compte restreint ne pourrait lire — c'est-à-dire invisible à celui qui vient de la déposer.* Le chapitre 7 ne rend facultative que la **machine** (« machine concernée **ou déclarée inconnue** »), jamais le site.

**2. La demande porte une `agence_id`, que le chapitre 11 ne nomme pas.** Elle est **déduite du site** (D56) et jamais saisie. Sans elle, *« accusé de réception en heures ouvrées de l'agence » (D13) n'a pas de sujet* : le départ du compteur se calcule sur un calendrier, et un calendrier appartient à une agence.

### LA MESURE QUI JUSTIFIE LA DÉCLARATION, ET NON SEULEMENT LA POLITIQUE

*Elle a été prise avant d'ajouter l'entrée, et elle est le vrai enseignement de ce ticket.* La table portait **déjà** la forme « parc » en base, et le gardien de forme était **VERT** — parce que `formeAttendue` rendait « société » pour une table non déclarée, et qu'**une politique plus stricte satisfait une attente plus lâche**.

> Mesuré : `demande` absente de `TABLES_PARC`, la politique remplacée par la clause de société seule → **0 écart**. La même faute, l'entrée déclarée → le gardien **nomme la table et le filtre perdu**.

**Rien n'aurait donc signalé l'affaiblissement.** C'est le sens silencieux que R0-a nomme déjà sur cette liste — *le RETRAIT ouvre la brèche, pas l'addition* —, et il se manifeste ici avant même qu'une entrée existe : une table jamais déclarée est dans le même état qu'une table retirée. L'épreuve qui le montre vit dans `tests/isolation/politiques-rls.test.ts`, avec sa sonde.

### CONDITION DE RÉOUVERTURE, vérifiable

*Le jour où une demande pourra naître sans site* — une demande déposée par téléphone par un client qui n'a qu'une adresse, par exemple —, la colonne de périmètre cesse d'être `site_id` et la forme se relit : il faudra dire si une telle ligne est visible de son déposant, et par quel chemin. *Et le jour où `intervention.demande_id` existera*, la transformation cessera d'être un simple changement de statut ; la politique ne bouge pas pour autant, les deux tables portant la même forme.

*Aucune règle du chapitre 10 n'est amendée : RG-DRO-01 est appliquée, pas corrigée.*

---

## D103 — UNE VISITE, PLUSIEURS MACHINES : LA FORME « FILIATION » S'ÉTEND, ET RG-INT-01 DEVIENT VÉRIFIABLE

*Tranché par la session de nuit du 11/09/2026, en construisant L2-08a. **Ce n'est pas un arbitrage d'Alexis** (§1 du protocole) : la question tombe sous la doctrine §2, et la forme retenue existe déjà — elle est simplement étendue à une seconde table. La décision porte sa condition de réouverture, et la session continue.*

### POURQUOI UN TEXTE

`TABLES_FILIATION` est une liste close, gardée dans les deux sens : *toute addition passe par un arbitrage.* Elle n'avait qu'une entrée depuis L1-04.

### LA TABLE, ET CE QU'ELLE REMPLACE

Le chapitre 7/M3 : *« Une visite peut couvrir plusieurs machines : plusieurs lignes machine, chacune avec sa checklist et son état de sortie, un seul déplacement, un seul rapport. »* `intervention_machine` porte ce rattachement.

**Elle REMPLACE `intervention.machine_id`, elle ne s'y ajoute pas.** Garder la colonne « pour la machine principale » aurait fait **deux écritures d'un même fait**, et personne n'aurait su laquelle fait foi le jour où elles se contrediraient (§9, 01/09). La migration **reprend les lignes existantes** avant de supprimer la colonne.

### LE PARENT EST `intervention`, ET PAS `machine`

C'est la seule décision de fond de ce texte, et elle n'est pas évidente : la table a deux parents possibles.

> **L'intervention est ce qui décide QUI a le droit de voir cette ligne ; la machine n'est que ce dont elle parle.**

Adosser la clause à `machine` aurait rendu visible le rattachement d'une visite qu'on n'a pas le droit de lire, dès lors qu'on voit le matériel — *et le parc est plus largement visible qu'une intervention, un compte de portail voyant toutes ses machines.*

### CE QUE LA FORME APPORTE, ET QUI SE MESURE

La politique ne nomme **ni `app.client_id` ni `app.perimetre_sites`** : elle demande seulement si le parent est visible, et les trois filtres de la forme « parc » s'y propagent. *Les recopier serait une seconde lecture du même critère, et c'est celle qui vieillit sans rougir.* Un scénario le prouve en **lisant la clause**, pas seulement en observant ses effets : recopier les filtres passerait tous les autres scénarios.

### RG-INT-01 DEVIENT VÉRIFIABLE, ET LE MOMENT EST CELUI QUE LA RÈGLE NOMME

> *« Elle porte au moins une machine, SAUF pour les types `expertise`, `installation` et `recensement`. Si la machine n'existe pas, elle est créée **avant de démarrer**. »*

Le contrôle est donc **au passage en statut de travail**, pas à la création : le dépannage à l'aveugle est le cas ordinaire — *on sait qu'un compresseur est en panne, pas lequel* — et exiger la machine à la création aurait rendu impossible d'enregistrer un appel.

**Trois statuts, pas un.** La règle nomme le démarrage ; **la base garde des ÉTATS, pas des trajets**. Ne surveiller que `en_cours` laisserait passer une intervention qui saute directement à `terminee`, et la règle serait vraie du chemin ordinaire et fausse de tous les autres.

### LA LIMITE, ÉCRITE PLUTÔT QUE TUE

**Le contrôle ne voit que les TRANSITIONS.** Une ligne insérée directement dans un statut de travail lui échappe, et c'est inévitable : au moment d'un `INSERT`, aucune ligne fille ne peut exister. La forme qui fermerait ce chemin est une `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`, évaluée au commit.

**Elle n'est pas posée, et le motif est mesuré :** `prisma/seed.ts` ne crée **aucune machine**, et il crée des interventions `en_cours`, `terminee` et `cloturee` de types non dispensés. La contrainte différée les refuserait toutes, et y répondre demanderait de décider ce que la démonstration doit montrer — *ce qui appartient à l'exploitation.*

### CONDITION DE RÉOUVERTURE, vérifiable

*Le jour où la synchronisation du lot 3 insérera des interventions déjà terminées depuis un appareil hors ligne*, ce chemin cessera d'être théorique : le contrôle devra passer en contrainte différée, et la démonstration recevoir ses machines. *Et le jour où `intervention_machine` portera le diagnostic, les travaux et l'état de sortie* — le chapitre 11 les nomme, ils sont saisis sur le terrain —, la question de savoir si un compte de portail les lit se posera : la forme « filiation » les lui donnerait, et ce n'est pas tranché.

*Aucune règle du chapitre 10 n'est amendée : RG-INT-01 est rendue vérifiable, pas corrigée. D16 l'avait déjà réécrite.*
