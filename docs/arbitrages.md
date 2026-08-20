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
| **Multi-techniciens** | **Cumul** — 2 techniciens × 3 h = 6 h facturées |
| **Temps d'attente** | **Non facturé** par défaut, `facturable = false` ; le responsable peut le basculer à `true` avec motif |
| **Trajet** | Non facturé au temps ; couvert par le forfait de déplacement de la zone. En l'absence de forfait applicable, non facturé |
| **Heures excédentaires** | Comptées sur le seul temps d'intervention, hors trajet et hors attente, par rapport à `forfait.heures_incluses` |
| **Multi-machines** | **Un seul forfait de déplacement par intervention**, quel que soit le nombre de machines. Les forfaits de prestation, eux, sont par machine |
| **Ordre de calcul** | forfaits applicables → heures excédentaires au taux horaire → majoration hors ouverture → total HT |

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
| Deux imports se recouvrant | Seul **le dernier lot** est annulable. Annuler un lot antérieur est refusé |
| Modifications apportées par l'import | Restauration des valeurs antérieures, conservées dans `import_lot_ligne.valeurs_avant` |

**Principe :** l'annulation est **partielle et sûre** plutôt que totale et destructrice. Le rapport d'annulation liste exactement ce qui a été restauré et ce qui ne pouvait pas l'être. RG-IMP-02 est réécrite en ce sens — « annulable intégralement » devient « annulable, avec refus motivé sur les lignes modifiées ou référencées depuis ».

---

## Gravité 2 — décisions structurantes

### D16 — Machine obligatoire et recensement (2.1)

**RG-INT-01 est réécrite :**

> Une intervention est rattachée à un client et à un site. Elle porte au moins une machine, **sauf pour les types `expertise`, `installation` et `recensement`**.

Le parcours P2 redevient cohérent : l'intervention de recensement est créée sans machine, et les machines créées pendant la visite lui sont rattachées au fur et à mesure.

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

**Convention :** symbole si la devise en a un, code sinon. `100,00 €` et `7 000 XPF`. C'est ce qu'appliquait la maquette, et c'est promu au rang de règle.

**Frontière de conversion (3.2) :** `lib/money` expose deux fonctions distinctes et nommées sans ambiguïté :

- `formatMoney(montant, devise)` — jamais de conversion, utilisable partout ;
- `convertForConsolidation(montant, deviseSource, deviseCible, dateParite)` — réservée aux agrégats, refuse d'être appelée sur un montant unitaire, et **exige une date de parité explicite**.

Aucune autre fonction de conversion n'existe. Un test du gardien monétaire vérifie qu'aucun appel à `convertForConsolidation` n'existe hors de `lib/reporting`.

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

### D23 — Zones géographiques (2.9)

Énumération arrêtée : `grand_noumea`, `sud`, `cote_est`, `cote_ouest`, `nord`, `iles`.

**Temps de trajet :** la valeur saisie dans `site.temps_trajet_min` fait foi quand elle existe ; l'estimation par zone n'est qu'un défaut quand elle est absente. RG-PLA-05 est précisée en ce sens.

### D24 — Validation des rapports (2.10)

**Validation systématique en V1.** Les modes « échantillonnage » et « au-delà d'un seuil » sont retirés du périmètre — ils seront réintroduits quand le volume le justifiera, avec des paramètres décidés à ce moment-là.

RG-INT-03 reste donc simple et testable : pas de clôture sans rapport `valide`.

### D25 — Retour sous 30 jours (2.11)

L'audit a raison : « le même symptôme » n'est pas implémentable sur du texte libre. **La règle est reformulée sur un critère machine :**

> RG-INT-10 — Une intervention de type `curatif` sur une machine ayant déjà fait l'objet d'une intervention `curatif` **clôturée** dans les 30 jours calendaires précédents est marquée `retour = true` et remonte au suivi qualité.

Le symptôme disparaît du critère. Les visites préventives ne comptent pas. Le point de départ est la **date de clôture** de l'intervention antérieure. C'est plus large que l'intention initiale, mais c'est déterministe, donc testable — et un faux positif coûte moins qu'une règle inapplicable.

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

### D30 — Contrat de garantie (2.16)

**RG-CON-03 est précisée :**

> Une machine ne peut être couverte que par un seul contrat actif **de type commercial** à la fois. Un contrat de type `garantie` peut coexister avec un contrat commercial.

**« Actif » est défini** : le contrat a le statut `actif` **et** la date du jour est comprise dans la fenêtre `contrat_ligne.date_entree` / `date_sortie`.

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

**Périmètre unifié** — I8 et RG-DRO-04 divergeaient. Le périmètre retenu est celui de I8 : `intervention`, `contrat`, `machine`, paramétrage société, compte client. RG-DRO-04 est alignée dessus.

**Audit des lectures.** L'exigence du §15 — « toute consultation de données client par un utilisateur interne est journalisée » — est **réduite** : seuls sont journalisés les accès des **rôles éditeur** aux données d'une société cliente, et les basculements de société active. Journaliser toute lecture métier produirait un volume sans rapport avec sa valeur, et §15 est narratif donc non normatif (D1).

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
| **Portée** | D34 à D40 — les cinq premiers relevés à la livraison de L0-06, les deux derniers soumis puis arbitrés au cours de L0-06b |
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

**Corollaire, au lot 7** : une procédure de déblocage d'un `admin_societe` ayant perdu son second facteur, exécutable par `admin_plateforme` seul et journalisée dans `journal_acces`. Une contrainte sans porte de sortie se paie en appels au support et finit par se faire contourner. Elle n'est **pas construite maintenant**.

---

## Ce qui reste à décider, et quand

Rien ne bloque plus le lot 0. Les points suivants attendent leur lot :

| Échéance | Point |
|---|---|
| **Prochain arbitrage** | **Rattachement de `parite`.** Elle ne porte pas de `societe_id` et n'entre dans aucune des quatre catégories de I1 : la liste close des référentiels de plateforme (D4) a été arrêtée **avant** que D20 ne crée cette table en remplacement de `devise.parite_reference`. Elle se comporte pourtant exactement comme `devise` — la parité légale du franc Pacifique est la même pour tous. Relevé en écrivant D39, non tranché : la liste est fermée |
| Lot 1 | Colonnes exactes de chaque modèle d'import ; montants du catalogue de forfaits |
| Lot 3 | Reconnaissance de plaque signalétique — **retirée du périmètre V1** faute de solution hors ligne raisonnable ; à réévaluer si un moteur embarqué léger apparaît |
| Lot 4 | Grille tarifaire des contrats, types proposés en premier |
| **Lot 5** | **Repli de consolidation portable (D36)** : fonction `SECURITY DEFINER`, et mot de passe de `codiplan_reporting` déposé dans `REPORTING_DATABASE_URL` |
| **Lot 7** | **Déblocage d'un `admin_societe` ayant perdu son second facteur (D40)** : exécutable par `admin_plateforme` seul, journalisé dans `journal_acces` |
| Lot 7 | Opérateur SMS, structure juridique, plafond de responsabilité ; durcissement de la visibilité des comptes entre sociétés |

---

## Une remarque sur la méthode

**Ce que cette seconde note démontre.** Les soixante points de la note n°1 venaient d'une **lecture** ; ceux qui précèdent viennent d'une **livraison**. Écrire le code a fait apparaître ce qu'aucune relecture n'avait vu : une énumération fermée trop tôt, une catégorie de tables laissée à l'interprétation, un rôle de base de données traité comme une connexion ordinaire, et trois refus qui, mis côte à côte, formaient un annuaire de clients. Aucun de ces points n'était une erreur d'exécution — tous étaient des trous de spécification que seule l'exécution pouvait révéler.

Deux d'entre eux — D39 et D40 — ont d'ailleurs été **soumis et non tranchés** dans un premier temps : la session qui les avait relevés s'est arrêtée devant une liste close et une règle de sécurité, comme le §8 du CLAUDE.md l'impose. Le troisième point de la même nature, le rattachement de `parite`, est relevé ici et attend son tour.

La conséquence pratique : **arbitrer après le premier ticket d'un domaine, pas seulement avant** — et ne jamais laisser une session compléter une liste close, fût-ce d'une évidence.

*Note d'arbitrage n°2 — CODIPLAN — 20 août 2026*
