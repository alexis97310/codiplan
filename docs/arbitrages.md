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
| `famille_materiel` | Un compresseur est un compresseur |
| `modele_materiel` | Idem, avec possibilité de surcharge par société |
| `checklist_modele` | Attachée au modèle, suit son régime |

**Tout le reste porte `societe_id NOT NULL`** — y compris `prestation` et `forfait`, qui sont commerciaux et donc propres à chaque société.

**Mécanique retenue.** Un modèle de plateforme (`societe_id NULL`) est visible par toutes les sociétés. Une société qui veut l'adapter en crée une copie portant son `societe_id` ; la copie masque l'original. La politique RLS s'écrit : `societe_id = current_setting('app.societe_id')::uuid OR societe_id IS NULL`.

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

**Cas du numéro illisible ou absent** — il existe, la maquette le montrait déjà. Le technicien saisit `SN-INCONNU-<référence interne>`, valeur unique par construction, et la machine est marquée `complet = false`, ce qui la fait remonter dans la file de complétion. Un contrôle d'unicité SQL classique suffit, sans NULL et donc sans trou.

**Localisation et photo de plaque restent facultatives.** Le cahier des charges les listait comme obligatoires au §8.1 et §13.3 : ces deux passages sont désormais non normatifs (voir D1).

**Règles amendées :** RG-PAR-02

### D7 — Identifiants en création hors ligne (1.4)

C'est le point le plus profond de l'audit. Décision :

**Séparation stricte de la clé technique et du numéro affiché.**

- **Clé technique** : `id` UUID v7, généré sur l'appareil, y compris hors ligne. C'est elle qui porte toutes les relations, la synchronisation et le `qr_token`.
- **Numéro affiché** : `numero`, `NULL` tant que l'enregistrement n'a pas été synchronisé. Attribué **côté serveur**, séquentiellement par société, à la première synchronisation réussie.
- **Affichage hors ligne** : tant que `numero` est nul, l'interface affiche `Local-<6 derniers caractères de l'UUID>`, avec une pastille « non synchronisé ».

**Cas de l'étiquette QR posée hors ligne.** Le QR encode le `qr_token`, dérivé de l'UUID, jamais le numéro affiché. L'étiquette reste donc valide quel que soit le numéro attribué ensuite. Deux régimes possibles pour l'impression :

- planches de QR pré-imprimées, avec des jetons pré-générés et téléchargés sur l'appareil avant le départ — recommandé pour les campagnes de recensement ;
- impression à la demande sur imprimante portable, à partir du jeton local.

Ce mécanisme s'applique à l'identique aux interventions, demandes et rapports.

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

**Table `utilisateur_client`**, qui manquait :

| Colonne | Type |
|---|---|
| utilisateur_id | uuid FK |
| client_id | uuid FK |
| societe_id | uuid FK |
| perimetre_sites | uuid[] — vide = tous les sites du client |
| actif | boolean |

Un compte portail n'a **aucune entrée** dans `utilisateur_societe` : les deux tables sont exclusives. La politique RLS du portail filtre sur `client_id`, et sur `site_id` si `perimetre_sites` est renseigné.

**Cette table est créée au lot 0**, pas au lot 5 : sans elle, la politique RLS est incomplète et les tests d'isolation ne couvrent pas le scénario 9.

### D11 — Formule de valorisation (1.8)

Décisions arrêtées, sur la base de vos réponses :

| Point | Décision |
|---|---|
| **Arrondi** | Au **quart d'heure supérieur**, appliqué au total par technicien et par intervention, jamais ligne par ligne |
| **Où vit l'arrondi** *(D45)* | Au **module de valorisation** (L2-09), jamais dans `lib/calendar` ni dans `lib/money` : c'est une politique de facturation, pas une question de temps |
| **Multi-techniciens** | **Cumul** — 2 techniciens × 3 h = 6 h facturées |
| **Temps d'attente** | **Non facturé** par défaut, `facturable = false` ; le responsable peut le basculer à `true` avec motif |
| **Trajet** | Non facturé au temps ; couvert par le forfait de déplacement de la zone. En l'absence de forfait applicable, non facturé |
| **Heures excédentaires** | Comptées sur le seul temps d'intervention, hors trajet et hors attente, par rapport à `forfait.heures_incluses` |
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

**Deux portes, pas une :**

```bash
pnpm verify        # typecheck + lint + test + test:isolation + build
                   # porte de sortie de CHAQUE ticket
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
2. Toute requête passant par lui est journalisée avec l'utilisateur d'origine.
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

**Règle attachée à cette catégorie, et c'est elle qui rend son non-cloisonnement acceptable : aucune donnée métier sur `utilisateur`.** Fonction, agence de rattachement, habilitations, préférences — tout cela vit dans `utilisateur_societe`, qui est cloisonnée. `utilisateur` ne porte que ce qui sert à **trouver et authentifier** un compte.

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
| **Avant L2-09** *(D45)* | **L'arrondi au quart d'heure supérieur s'applique-t-il à chaque intervention ou au total d'une journée ?** Cinq passages de cinq minutes font **1 h 15** dans un cas et **30 minutes** dans l'autre. D11 règle l'agrégation à l'intérieur d'une intervention, pas entre interventions. C'est une **décision commerciale**, à prendre **avant** que la valorisation ne soit écrite, pas pendant |
| ~~**Avant le lot 1** *(L0-08)*~~ **TRANCHÉ le 23/08/2026** *(D48, ticket L0-09a)* | **Un écart local pouvait s'adosser au férié d'un AUTRE territoire.** Fermé en base par **chaînage de clés composites** — l'option *(a)*, celle qui ferme en base : `agence` gagne un `UNIQUE (id, territoire)`, `calendrier_ferie` gagne une colonne `territoire` liée à l'agence par `(agence_id, territoire)` et au fait public par `(jour_ferie_id, date, territoire)`. Conséquence assumée : **`agence.territoire` devient `NOT NULL`** — une clé étrangère dont une colonne vaut NULL n'est pas contrôlée en PostgreSQL, le verrou aurait été muet là où la donnée manque. Le pont reste possible (`jour_ferie_id` nul, `MATCH SIMPLE`). Ligne conservée au registre : un point tranché se raye, il ne s'efface pas |
| **Avant le lot 1** *(L0-08)* — **MESURÉ le 31/08/2026** *(ticket R0-a, écart É12)* | **Qui voit une nuit rouge ?** Les contrôles nocturnes sur `main` s'accumulent — `verify:full`, l'horizon des fériés, les deux contrôles de partitions — et personne ne consulte GitHub chaque matin. **Les deux vérifications demandées le 26/08 ont été faites, et elles ne se répondent pas de la même façon.**<br>**(1) L'échec d'une exécution PLANIFIÉE notifie-t-il comme un échec manuel ? — Oui, dans la même boîte, et l'observation directe est impossible.** Mesuré : **onze** exécutions planifiées de `ci.yml` depuis le 20 août, du 20/08 au 31/08, **toutes réussies**. La question n'a donc jamais été posée à la base, et elle ne peut l'être qu'en produisant une nuit rouge pour de bon. Ce qui SE mesure : GitHub attribue chaque exécution planifiée à un `triggering_actor` réel — `alexis97310`, le propriétaire —, et la notification d'échec d'un flux planifié part au **dernier compte ayant modifié le `cron`**, ici le même. C'est **la boîte où les deux échecs manuels du 20 août sont arrivés, et où ils sont restés non lus**. Réponse : l'alarme sonnerait, dans la même pièce vide.<br>**(2) GitHub désactive-t-il la planification après inactivité ? — NON pour ce dépôt, et pour une raison qui peut changer d'un clic.** La règle des 60 jours ne vise que les dépôts **publics** ; `alexis97310/codiplan` est **privé** (`visibility: private`, mesuré). La protection ne tient donc pas à la planification mais à un **attribut du dépôt** : rendre le dépôt public — ou le forker, ce qui désactive les flux planifiés par défaut — remet la règle en vigueur, sans que rien ne le dise.<br>**Conséquence, et elle ne dépend d'AUCUNE des deux réponses :** le point (1) suffit à lui seul. **TRANCHÉ le 31/08/2026 — les deux contre-mesures sont CONSTRUITES**, et *(b)* est celle qui compte. *(a)* Le job `alarme-nuit-rouge` ouvre automatiquement une **issue** dès que `verify:full` échoue hors proposition de fusion : la question du courriel devient sans objet — l'issue est créée quoi qu'il arrive, elle vit dans le dépôt, et sa notification suit un autre chemin que celui qui a laissé passer les deux échecs du 20 août. Une issue par ÉPISODE, pas une par nuit. *(b)* Le job `battement` (`pnpm battement`, `scripts/lib/battement.ts`) refuse un flux qui a **cessé de battre** — deux signaux : l'`state` du flux, où `disabled_inactivity` nomme la règle des 60 jours, et l'âge de la dernière exécution planifiée. Il tourne sur l'activité **humaine**, jamais sur la planification : un contrôle qui ne s'exécute que lorsqu'elle s'exécute ne peut pas constater qu'elle a cessé. Les deux sont indépendants dans les deux sens, comme le préventif et le détectif des partitions : *(a)* dit qu'une nuit a rougi, *(b)* dit que les nuits ont cessé. Sans *(b)*, une planification désactivée produit **zéro échec, donc zéro alarme** — le silence a exactement la forme du succès (inscrit au §9). **Et la dépendance à la visibilité du dépôt est écrite là où on la change** : en tête de `.github/workflows/ci.yml` et au README, pas seulement ici |
| **À la première demande d'un client concerné** *(D46)* | **Jours fériés INFRA-NATIONAUX.** Certains territoires en ont : l'Alsace-Moselle chôme le Vendredi saint et le 26 décembre, le reste de la métropole non ; plusieurs États fédéraux fonctionnent ainsi. Le modèle `(territoire, date)` **le permettra sans être refait** — par un code de subdivision, sur le patron d'ISO 3166-2. Rien n'est construit aujourd'hui : la question se tranchera quand un client la posera, et non par anticipation |
| **Au paramétrage réel des agences** *(L0-08)* | **Horaires d'ouverture réels de Ducos, Koné et Dolbeau, et liste des fériés effectivement chômés par chacune.** Le seed porte des valeurs de **démonstration**, dites comme telles dans le libellé de chaque calendrier. Ce qui n'est PAS de la démonstration et doit le rester : Ducos ouvre le samedi, Koné non (RG-PLA-01). La saisie des vrais horaires est une opération de paramétrage, pas un développement |
| Lot 1 | Colonnes exactes de chaque modèle d'import ; montants du catalogue de forfaits |
| Lot 3 | Reconnaissance de plaque signalétique — **retirée du périmètre V1** faute de solution hors ligne raisonnable ; à réévaluer si un moteur embarqué léger apparaît |
| Lot 4 | Grille tarifaire des contrats, types proposés en premier |
| **Lot 5** | **Repli de consolidation portable (D36)** : fonction `SECURITY DEFINER`, et mot de passe de `codiplan_reporting` déposé dans `REPORTING_DATABASE_URL`.<br>**ET DEUX GARDIENS DU LOT 0 LE REFUSERONT** *(inscrit le 31/08/2026, ticket R0-a, écart É1 de la revue R0)*. **La première ligne du repli portable fait passer `pnpm verify` au rouge, deux fois.** C'est le comportement voulu des deux gardiens ; ce qui manquait, c'est que le lot 5 le sache **avant** de commencer plutôt que de le découvrir dans l'urgence.<br>1. `motifRefusReporting` (`lib/db/garde-role.ts`) **refuse la connexion de consolidation quand `BYPASSRLS` manque** — « sans lequel la consolidation multi-sociétés ne lirait que la société active ». Or le repli de D36 existe **précisément pour l'hébergeur qui ne peut pas accorder `BYPASSRLS`** : le garde refusera donc exactement la configuration que le repli est fait pour servir. Remède prévu : `motifRefusReporting` distingue **chemin rapide** et **repli**, et n'exige `BYPASSRLS` que du premier.<br>2. `tests/unit/db/security-definer-sous-arbitrage.test.ts` **échoue sur toute fonction `SECURITY DEFINER` apparaissant dans une migration**, liste d'exceptions **close et vide**. Le repli **EST** une fonction `SECURITY DEFINER`. Remède prévu : D36 entre **nommément** dans la liste d'exceptions de D50 — ce qui est un arbitrage, pas une décision de ticket, et doit donc être pris avant l'écriture du repli. |
| **Lot 7** | **Déblocage d'un `admin_societe` ayant perdu son second facteur (D40)** : exécutable par `admin_plateforme` seul, journalisé dans `journal_acces` |
| Lot 7 | Opérateur SMS, structure juridique, plafond de responsabilité ; durcissement de la visibilité des comptes entre sociétés |

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

**Les motifs d'exemption forment une liste close de DEUX, et le second n'est pas
un choix.**

| Motif | Ce qu'il exige |
|---|---|
| `rejouable` | L'information qu'une écriture non tracée ferait perdre se **reconstitue** depuis une autre table, elle-même auditée. Seul motif recevable pour une table ordinaire. |
| `impossible` | Poser le déclencheur produit une base qui **ne fonctionne pas**. Ce n'est pas une dispense, c'est un constat — et il se **mesure** dans la justification, jamais ne se suppose. |

**Ce qui n'est PAS un motif**, et qui est écrit pour ne pas être réinventé :

- **« c'est bruyant ».** Le journal est partitionné depuis L0-10 précisément
  pour que le volume ne soit jamais un argument. La conservation détache des
  périodes ; elle ne trie pas les tables.
- **« la table est peu sensible ».** C'est une appréciation, et elle se révise
  au premier client qui pose la question.
- **une table dont les lignes sont saisies par un HUMAIN.** Aucune exemption,
  jamais : c'est exactement là que « qui, quand, depuis quelle valeur » se pose.

**Une seule exemption est en vigueur, et elle est du second motif.**
`journal_audit` ne peut pas s'auditer lui-même : le déclencheur écrit dans la
table qui le déclenche. **Mesuré** sur la base jetable — déclencheur posé sur
`journal_audit`, une seule ligne insérée — PostgreSQL rend
`ERROR: stack depth limit exceeded` et la transaction échoue. L'information
n'est perdue nulle part pour autant : le journal est en **ajout seul** (I8,
D32), ni `UPDATE` ni `DELETE` ne lui sont accordés, si bien qu'il n'existe
aucune écriture à tracer au-delà de l'insertion qui, elle, EST déjà la trace.

**C'est gardé, et des deux côtés.** `tests/unit/db/perimetre-audit.test.ts`
réclame le déclencheur sur toute table métier non exemptée, refuse un
déclencheur posé hors de la première catégorie de I1, refuse un déclencheur posé
sur une table exemptée, et refuse une exemption qui ne s'adosse à aucune table
existante — corollaire du 31/08 sur les sélections négatives. La propriété
centrale est éprouvée sur une table fabriquée : une table métier nouvelle est
réclamée **sans qu'aucune liste n'ait été touchée**.

**Conséquence immédiate, à traiter à son ticket et pas ici.** `taux_horaire`
(L1-07) et `forfait` (L1-06) entreront au périmètre par la seule vertu de leur
`societe_id NOT NULL`, comme la revue R0 le souhaitait. Aucune décision ne reste
à prendre pour cela ; c'est le sens de l'inversion.

**Règles amendées :** RG-DRO-04

*Note d'arbitrage n°9 — CODIPLAN — 1ᵉʳ septembre 2026*

