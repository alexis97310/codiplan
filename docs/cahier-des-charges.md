# CODIPLAN — Cahier des charges fonctionnel et technique

**Plateforme de gestion des plannings d'intervention et du parc machines clients**

| | |
|---|---|
| **Maître d'ouvrage** | CODIMA NC — Direction d'Exploitation |
| **Entité porteuse** | CODIMA SAV (site Dolbeau / SOBECA) |
| **Version** | 1.2 — Volet commercialisation intégré |
| **Date** | 18 août 2026 |
| **Statut** | Pour validation |

---

## Note de révision — ce qui change en v1.1

Huit questions étaient ouvertes à l'issue de la v1.0. Les réponses apportées modifient substantiellement la conception.

| Question | Réponse | Conséquence sur la conception |
|---|---|---|
| Winpro accessible en lecture ou en export automatisé ? | **Non** | Aucune intégration programmatique possible. Tous les échanges passent par des **imports et exports Excel manuels**. CODIPLAN doit être autonome et porter son propre référentiel client. |
| Nombre de techniciens | **1 aujourd'hui, 3 à terme** | Dimensionnement revu à la baisse. L'ergonomie prime sur la capacité : l'outil doit être adopté par une personne, pas administré par une équipe. |
| Contrats de maintenance en portefeuille | **0** | Aucune reprise de données. Le module contrats n'est pas un outil de gestion d'un existant, c'est un **outil de conquête** : il doit aider à créer le portefeuille, pas seulement à le suivre. |
| Inventaire du parc installé | **Aucun** | Le parc est à construire intégralement. C'est le **chemin critique du projet** et il fait l'objet d'un chapitre dédié (§8). |
| Utilisateur pilote | Responsable matériel, **plus responsable SAV et ADV** | Trois profils internes supplémentaires. Ajout du rôle **ADV** à la matrice des droits. |
| Périmètre | **Prévoir la modularité** — extension possible à d'autres sociétés, d'autres territoires, dans le groupe ou hors groupe | Changement d'architecture majeur : la plateforme devient **multi-société** dès la conception (§4). |
| Tarification | Taux horaire **7 000 XPF**, plusieurs forfaits, **plusieurs devises** à gérer | Ajout d'un référentiel de tarification par société : devise, taux horaire, catalogue de forfaits (§4.3). |
| Passerelle SMS | **Aucune aujourd'hui**, à prévoir | Couche de notification abstraite, opérateur enfichable. V1 en email, SMS activable sans refonte. |

### Ajout de la v1.2 — la solution sera vendue

Une décision supplémentaire est intervenue : **CODIPLAN est destiné à être commercialisé auprès de clients tiers**, et pas seulement déployé sur les entités du groupe. Le multi-société de la v1.1 rendait la plateforme techniquement capable d'héberger plusieurs entités ; il ne suffisait pas à en faire un produit vendable.

Le **chapitre 22** traite ce volet en entier : cycle de vie d'un compte client, console éditeur (module M12), rôles éditeur avec accès encadré aux données des clients, modèle tarifaire et économie du modèle, cadre juridique — dont le contrat de sous-traitance de données et la titularité des droits —, engagements de support, exigences techniques supplémentaires et lot 7 de réalisation.

Deux arbitrages complémentaires ont été pris :

- **Plan de réalisation complet** conservé — six lots, 21 semaines — avec des mises en service intermédiaires.
- **Amorçage du parc en double approche** : création au fil des interventions **et** campagne de recensement dédiée (§8).
- **Imports Excel en masse** érigés en module à part entière (M11), conséquence directe de la fermeture de Winpro.

---

## Sommaire

1. [Contexte et enjeux](#1-contexte-et-enjeux)
2. [Objectifs et indicateurs de succès](#2-objectifs-et-indicateurs-de-succès)
3. [Périmètre](#3-périmètre)
4. [Modularité : multi-société, devises et tarification](#4-modularité--multi-société-devises-et-tarification)
5. [Acteurs, rôles et droits](#5-acteurs-rôles-et-droits)
6. [Cartographie fonctionnelle](#6-cartographie-fonctionnelle)
7. [Description détaillée des modules](#7-description-détaillée-des-modules)
8. [Stratégie d'amorçage du parc machines](#8-stratégie-damorçage-du-parc-machines)
9. [Parcours utilisateurs de référence](#9-parcours-utilisateurs-de-référence)
10. [Règles de gestion](#10-règles-de-gestion)
11. [Modèle de données](#11-modèle-de-données)
12. [Architecture technique](#12-architecture-technique)
13. [Application mobile technicien](#13-application-mobile-technicien)
14. [Échanges de données : Winpro, Excel, BI](#14-échanges-de-données--winpro-excel-bi)
15. [Sécurité, confidentialité et conformité](#15-sécurité-confidentialité-et-conformité)
16. [Pilotage et reporting](#16-pilotage-et-reporting)
17. [Contraintes spécifiques Nouvelle-Calédonie](#17-contraintes-spécifiques-nouvelle-calédonie)
18. [Plan de réalisation par lots](#18-plan-de-réalisation-par-lots)
19. [Charge, coûts et hypothèses](#19-charge-coûts-et-hypothèses)
20. [Risques et parades](#20-risques-et-parades)
21. [Recette et critères d'acceptation](#21-recette-et-critères-dacceptation)
22. [Commercialisation de la solution : le mode éditeur](#22-commercialisation-de-la-solution--le-mode-éditeur)
23. [Annexes](#23-annexes)

---

## 1. Contexte et enjeux

### 1.1 Situation actuelle

L'activité matériel et service après-vente de CODIMA NC est portée par l'entité **CODIMA SAV** (site de Dolbeau / SOBECA), créée en 2026. Elle intervient sur le parc d'équipements d'atelier et industriels de ses clients — compresseurs, ponts élévateurs, équipements pneumatiques, électroportatif professionnel, matériel d'atelier — sur l'ensemble du territoire, du Grand Nouméa aux mines du Grand Sud en passant par Koné et le Nord.

Le point de départ du projet est un constat simple : **il n'existe aujourd'hui aucun système**. Pas d'inventaire du parc installé chez les clients. Pas de contrat de maintenance en portefeuille. Pas de planning outillé. Un seul technicien, dont l'activité n'est pilotée que par la mémoire et le téléphone. Et un ERP, Winpro, qui n'expose ni base accessible ni export automatisé.

Ce n'est pas une modernisation d'existant : c'est une création.

Deux conséquences en découlent, qui structurent tout le document :

- **Le projet ne peut pas s'appuyer sur des données de reprise.** Le parc, les contrats, l'historique n'existent pas. Ils se construiront par l'usage. La conception doit donc rendre la saisie initiale quasi gratuite, sans quoi rien ne démarrera.
- **Le projet ne peut pas s'appuyer sur l'ERP.** Winpro étant fermé, CODIPLAN doit fonctionner de façon autonome, avec des échanges Excel maîtrisés dans les deux sens.

### 1.2 Enjeux

| Enjeu | Traduction opérationnelle |
|---|---|
| **Créer l'actif « parc installé »** | Savoir ce qui est installé chez qui devient une donnée d'entreprise, pas une connaissance individuelle |
| **Ouvrir un portefeuille de contrats** | Passer d'un chiffre d'affaires SAV entièrement transactionnel à une part récurrente |
| **Productivité terrain** | Réduire la saisie administrative et les trajets improductifs, à mesure que l'effectif passe de 1 à 3 techniciens |
| **Preuve et litiges** | Disposer d'un rapport signé, horodaté et photographié, opposable en cas de contestation |
| **Pilotage économique** | Mesurer la marge réelle par intervention et par contrat, base du variable du responsable matériel |
| **Réplicabilité** | Concevoir un outil transposable à d'autres sociétés et d'autres territoires sans réécriture |

### 1.3 Positionnement du projet

CODIPLAN ne remplace pas Winpro sur la gestion commerciale, le stock et la facturation. Mais **Winpro n'étant accessible ni en lecture directe ni par export automatisé**, aucune intégration technique n'est possible. Les deux systèmes cohabitent, reliés par des échanges de fichiers Excel produits et repris manuellement.

```
   Client / Contrat            CODIPLAN                    Winpro (ERP)
  ┌───────────────┐      ┌────────────────────┐        ┌────────────────┐
  │ Demande       │─────▶│ Planning & dispatch │        │ Stock pièces   │
  │ Échéance      │      │ Intervention        │        │ Facturation    │
  │ Panne         │      │ Rapport signé       │        │ Comptabilité   │
  └───────────────┘      │ Parc machines       │        │ Fiches clients │
                         │ Contrats            │        └────────────────┘
                         └────────────────────┘                 ▲  │
                              ▲          │                      │  │
                              │          │  Export Excel        │  │
                              │          │  « à facturer »      │  │
                              │          └──────────────────────┘  │
                              │                                    │
                              │  Import Excel — clients, articles, │
                              └────────────  ventes matériel ──────┘
                                        (manuel, périodique)
```

**Ce que cela implique.** Le référentiel client de CODIPLAN est alimenté par import et vit ensuite sa propre vie. La saisie de facturation reste manuelle dans Winpro, à partir d'un export CODIPLAN. Il n'y a pas de synchronisation temps réel, donc pas de dépendance opérationnelle : si Winpro évolue ou est remplacé, seule la forme des fichiers d'échange change.

---

## 2. Objectifs et indicateurs de succès

### 2.1 Objectifs fonctionnels

| N° | Objectif | Mesure |
|---|---|---|
| O1 | Planifier et affecter toute intervention depuis un écran unique | 100 % des interventions passent par CODIPLAN à M+3 |
| O2 | Supprimer le rapport d'intervention papier | 0 rapport papier à M+3 |
| O3 | **Constituer le parc machines à partir de rien** | 300 machines référencées à M+6, 800 à M+12 |
| O4 | **Ouvrir un portefeuille de contrats de maintenance** | 10 contrats signés à M+9, 25 à M+18 |
| O5 | Déclencher automatiquement les visites préventives contractuelles | Taux de préventif réalisé dans la fenêtre > 90 % |
| O6 | Restituer les éléments facturables sans ressaisie de fond | Délai intervention → facturation < 5 jours ouvrés |
| O7 | Donner au client un accès autonome à son parc et à son historique | 30 % des clients sous contrat actifs sur le portail à M+6 |
| O8 | Rendre la plateforme transposable à une autre société | Une seconde société créable sans développement |

Les objectifs O3 et O4 sont les deux qui conditionnent la valeur de l'outil. Tous les autres sont des moyens.

### 2.2 Indicateurs de pilotage

**Constitution des actifs** — machines référencées (cumul et rythme mensuel), taux de couverture des clients actifs, contrats signés, valeur annualisée du portefeuille de contrats.

**Activité** — interventions par statut, par période, par type ; taux d'occupation des techniciens ; répartition préventif / curatif / installation / garantie.

**Qualité de service** — délai de prise en charge, délai d'intervention par niveau d'urgence, taux de résolution en une visite, respect des échéances contractuelles, retours sous 30 jours.

**Économie** — chiffre d'affaires et marge par intervention, par contrat, par client, par famille de matériel ; **marge brute hors main-d'œuvre**, base du variable du responsable matériel ; ratio heures facturées / heures travaillées ; coût des déplacements.

**Parc** — âge moyen, machines en fin de vie candidates au renouvellement, machines sans contrat = potentiel commercial chiffré.

---

## 3. Périmètre

### 3.1 Dans le périmètre — Version 1

| Module | Contenu |
|---|---|
| **M1 — Référentiels** | Sociétés, clients, sites, contacts, techniciens, familles et modèles de matériel, prestations, forfaits, compétences |
| **M2 — Parc machines** | Fiche machine, identification QR, localisation, garantie, compteurs, documents, historique complet |
| **M3 — Demandes et interventions** | Demande, qualification, ordre d'intervention, cycle de vie, checklists, pièces, temps |
| **M4 — Planning et dispatch** | Calendrier multi-techniciens, glisser-déposer, tournées, absences, alertes de conflit |
| **M5 — Rapport d'intervention** | Saisie mobile, photos, signature client, génération PDF, envoi automatique |
| **M6 — Contrats de maintenance** | Types de contrats, échéanciers, génération des visites, SLA, renouvellement, rentabilité |
| **M7 — Application mobile technicien** | PWA installable, hors-ligne, synchronisation différée |
| **M8 — Portail client** | Parc, historique, documents, demande en ligne, suivi |
| **M9 — Tableaux de bord** | Dashboards par rôle, exports, alertes |
| **M10 — Administration** | Sociétés, utilisateurs, rôles, paramétrage, tarification, journal d'audit |
| **M11 — Imports et exports Excel** | Imports en masse contrôlés, exports normalisés, journal des chargements |
| **M12 — Console éditeur** | Comptes clients, abonnements, facturation récurrente, supervision, support — voir chapitre 22 |

### 3.2 Version 2 (lot ultérieur)

Devis d'intervention et chiffrage ; consommation de pièces valorisée ; préparation de facturation détaillée ; gestion des prêts et du parc de remplacement ; géolocalisation temps réel et optimisation de tournées ; gestion des immobilisations et du matériel loué ; application native si un besoin de NFC ou de Bluetooth apparaît.

### 3.3 Hors périmètre

Comptabilité générale et paie ; achats et approvisionnements ; gestion du stock pièces détachées, qui reste dans Winpro ; site web commercial public.

---

## 4. Modularité : multi-société, devises et tarification

C'est la principale évolution de la v1.1. L'extension à d'autres sociétés, sur d'autres territoires, dans le groupe ou hors groupe, cesse d'être une hypothèse lointaine pour devenir une contrainte de conception.

### 4.1 Principe retenu : cloisonnement logique, base unique

Trois architectures étaient possibles.

| Option | Description | Verdict |
|---|---|---|
| Une installation par société | Un déploiement complet et une base par société | Écarté — coût d'exploitation multiplié, corrections à répliquer, aucune vision consolidée |
| **Base unique, cloisonnement logique** | Une seule installation, chaque enregistrement porte sa société, filtrage systématique côté serveur | **Retenu** |
| Base unique sans cloisonnement | Une société traitée comme un simple champ d'affichage | Écarté — risque de fuite de données entre entités inacceptable |

**Le cloisonnement est porté par le modèle de données, pas par l'interface.** Chaque table métier porte une colonne `societe_id`. Chaque requête est filtrée au niveau de la couche d'accès aux données, jamais seulement à l'affichage. Une politique de sécurité au niveau des lignes est appliquée dans PostgreSQL, de sorte qu'une erreur applicative ne puisse pas produire de fuite.

Le surcoût de cette approche, dès lors qu'elle est prise dès le départ, est de l'ordre de 5 % de la charge de développement. Le coût de sa mise en place après coup, sur une base déjà en production, serait de plusieurs semaines et à haut risque.

### 4.2 Ce qui est paramétrable par société

| Domaine | Élément |
|---|---|
| **Identité** | Raison sociale, logo, couleurs des documents générés, mentions légales, coordonnées |
| **Territoire** | Fuseau horaire, jours fériés, calendriers d'ouverture par site, langue de l'interface |
| **Financier** | Devise, arrondi, taux horaire par défaut, catalogue de forfaits, majorations heures non ouvrées |
| **Organisation** | Agences, techniciens, compétences, habilitations exigées |
| **Métier** | Familles et modèles de matériel, checklists, types d'intervention, niveaux d'urgence et engagements |
| **Notifications** | Modèles d'email et de SMS, opérateur d'envoi, expéditeur |
| **Numérotation** | Préfixes et compteurs propres à chaque société |

Le référentiel des **modèles de matériel** et des **checklists** peut être soit propre à une société, soit partagé au niveau de la plateforme puis repris par une société. Un compresseur reste un compresseur d'un territoire à l'autre : mutualiser ce référentiel évite de tout ressaisir à chaque déploiement.

### 4.3 Devises et tarification

**Devises.** XPF et EUR sont prévues dès la V1, la table des devises restant ouverte. Chaque société porte sa devise de référence. Les montants sont stockés dans la devise de la société, avec le code devise, et **ne sont jamais convertis ligne à ligne**. La conversion n'intervient que sur les agrégats de consolidation multi-sociétés, à une parité datée et paramétrée — conformément à la convention déjà en vigueur dans la chaîne décisionnelle.

Le XPF n'a pas de décimale, l'EUR en a deux : le nombre de décimales est une propriété de la devise, appliquée à l'affichage, aux arrondis et aux documents générés.

**Taux horaire.** Taux horaire de main-d'œuvre par défaut au niveau de la société — **7 000 XPF pour CODIMA SAV**. Il est surchargeable par technicien, par type d'intervention et par contrat. Historisé : un changement de taux ne modifie pas rétroactivement les interventions déjà valorisées.

**Forfaits.** Il n'existe pas de barème client spécifique, mais plusieurs forfaits. Le catalogue de forfaits est un référentiel à part entière :

| Attribut | Description |
|---|---|
| Code et libellé | Identifiant du forfait, intitulé porté sur le rapport |
| Type | Déplacement, mise en service, contrôle, prestation packagée |
| Montant | Dans la devise de la société |
| Conditions d'application | Zone géographique, famille de matériel, type d'intervention |
| Heures incluses | Au-delà, bascule au taux horaire |
| Cumulable | Avec le temps passé, ou exclusif |

Une intervention est valorisée soit au forfait, soit au temps passé, soit au forfait plus les heures excédentaires — le choix est fait à la qualification et reste modifiable jusqu'à la clôture.

### 4.4 Consolidation

Un utilisateur peut être habilité sur plusieurs sociétés. Un sélecteur de société est présent en permanence dans l'en-tête. Une vue **consolidée** est accessible aux profils de direction : elle agrège les indicateurs de plusieurs sociétés, avec conversion des montants à la parité paramétrée et affichage explicite de la devise de restitution.

---

## 5. Acteurs, rôles et droits

### 5.1 Personas

**Le directeur d'exploitation** — vision consolidée, arbitrage des priorités, suivi économique. Usage desktop. Attend des chiffres justes et immédiatement exploitables.

**Le responsable matériel** — utilisateur pilote de l'outil. Il pilote l'activité, la charge, la relation client et la rentabilité. Son variable dépend de la marge brute hors main-d'œuvre : la mesure doit être incontestable. C'est aussi lui qui portera la constitution du portefeuille de contrats, aujourd'hui inexistant.

**Le responsable SAV** — pilote l'atelier et la qualité des interventions, valide les rapports, suit les retours et les garanties.

**L'ADV** — administration des ventes. Prend les demandes entrantes, planifie, prévient les clients, prépare les éléments à facturer et assure la reprise vers Winpro. C'est l'utilisateur le plus assidu au quotidien.

**Le technicien** — sur le terrain, souvent hors réseau, les mains occupées. Il lui faut sa tournée du jour, la fiche machine avec son historique, un rapport rempli en moins de cinq minutes et une signature client. Il est aujourd'hui seul ; ils seront trois.

**Le client professionnel** — veut savoir quand le technicien passe, ce qui a été fait, et retrouver ses rapports sans téléphoner.

**L'administrateur de société** — paramètre **sa** société, gère ses comptes, ses agences et les habilitations, surveille les journaux. C'est un utilisateur du client, pas un salarié de l'éditeur : chez un client qui vient d'acheter, c'est lui qui ouvre les comptes de ses collègues, sans rien demander à personne (D37). Il ne lit pas les données financières.

**L'administrateur de plateforme** — salarié de l'éditeur. Il gère les comptes clients, les abonnements et le référentiel de plateforme. Il n'a **aucun accès par défaut** aux données d'un client : voir §22.5.

### 5.2 Matrice des rôles

*Corrigée par l'arbitrage D37 — la colonne « Admin » d'origine est **scindée**.*

| Fonction | Admin plateforme | Admin société | Direction | Resp. matériel | Resp. SAV | ADV | Technicien | Client |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Consulter le planning | — | ● | ● | ● | ● | ● | ○ | — |
| Modifier le planning | — | ● | ● | ● | ● | ● | — | — |
| Créer une demande | — | ● | ● | ● | ● | ● | ● | ● |
| Qualifier / affecter | — | ● | ● | ● | ● | ● | — | — |
| Saisir un rapport | — | ● | — | ● | ● | — | ● | — |
| Valider un rapport | — | ● | ● | ● | ● | — | — | — |
| Clôturer une intervention | — | ● | ● | ● | ● | ● | ○ | — |
| Créer / modifier un contrat | — | ● | ● | ● | — | ○ | — | — |
| Créer / modifier une machine | — | ● | ● | ● | ● | ● | ● | — |
| Consulter le parc complet | — | ● | ● | ● | ● | ● | ○ | — |
| Consulter son propre parc | — | — | — | — | — | — | — | ● |
| Voir les montants de vente | — | — | ● | ● | ● | ● | — | ○ |
| Voir les marges | — | — | ● | ● | ○ | — | — | — |
| Préparer les éléments à facturer | — | — | ● | ● | — | ● | — | — |
| Importer / exporter en masse | — | ● | ● | ● | ○ | ● | — | — |
| Paramétrer une société | — | ● | ○ | — | — | — | — | — |
| Administrer les utilisateurs | — | ● | — | — | — | — | — | — |
| Administrer les agences | — | ● | — | — | — | — | — | — |
| Consulter le journal d'audit | — | ● | ● | — | — | — | — | — |

● accès complet ○ accès restreint (périmètre limité ou lecture seule) — pas d'accès

**Cette matrice fait foi.** Les rôles ne sont recopiés nulle part ailleurs : `lib/auth/habilitations.ts` la transcrit ligne pour ligne, et un test compare la transcription au tableau ci-dessus, rôle par rôle.

**La colonne « Admin » est scindée en deux (D37).** Toutes les lignes de cette matrice sont de **portée société** — elles décrivent ce qui se fait *à l'intérieur* d'une société : elles reviennent donc à `admin_societe`, l'administrateur du client. La colonne « Admin plateforme » est vide à dessein, et c'est le principe du §22.5 rendu visible : **un salarié de l'éditeur n'a aucun accès par défaut aux données d'un client.** Les capacités de portée plateforme d'`admin_plateforme` sont énumérées au §22.5 et n'ont pas leur place ici.

Rattacher cette colonne à `admin_plateforme`, comme le faisait la version précédente, revenait à faire passer par l'éditeur la création d'un compte chez un client : intenable dès la première vente.

**Restrictions notables**

- Tout accès est d'abord filtré par **société** : un utilisateur non habilité sur une société ne voit rien de cette société, quel que soit son rôle.
- L'**administrateur de société** administre les comptes, les agences et les habilitations de **sa** société. Il ne lit pas les données financières : montants de vente, marges et éléments à facturer restent à la direction. Il n'est pas un rôle éditeur : il ne modifie pas les référentiels de plateforme (I1). **Son second facteur est obligatoire** (RG-DRO-05, D40) : compromettre ce seul compte permettrait de créer un accès n'importe où dans la société.
- Le technicien ne voit que son planning et les machines des interventions qui lui sont ou lui ont été affectées, plus la recherche par QR code sur site. Il ne voit aucun montant de vente : il saisit des temps et des pièces.
- L'ADV voit les montants de vente mais pas les marges.
- Le client ne voit que ses propres sites, machines, interventions et documents, et uniquement les rapports validés.

**Rôles éditeur.** La commercialisation de la solution (chapitre 22) introduit trois rôles supplémentaires — super-administrateur plateforme, administration commerciale éditeur, support éditeur — qui se situent **au-dessus** des sociétés et non à l'intérieur. Le principe qui les gouverne : un salarié de l'éditeur n'a aucun accès par défaut aux données d'un client ; tout accès est demandé, motivé, limité dans le temps, journalisé et notifié. Le seul chemin vers les données d'un client est la « connexion en tant que », sur demande explicite, tracée et notifiée. Voir §22.5.

---

## 6. Cartographie fonctionnelle

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CODIPLAN — plateforme multi-société               │
├──────────────┬──────────────┬───────────────┬────────────────────────┤
│  RÉFÉRENTIEL │  OPÉRATIONS  │  CONTRACTUEL  │      RESTITUTION       │
├──────────────┼──────────────┼───────────────┼────────────────────────┤
│ Sociétés     │ Demandes     │ Contrats      │ Tableaux de bord       │
│ Clients      │ Interventions│ Échéanciers   │ Rapports PDF           │
│ Sites        │ Planning     │ SLA           │ Exports Excel          │
│ Contacts     │ Tournées     │ Renouvellement│ Portail client         │
│ Techniciens  │ Rapports     │ Rentabilité   │ Alertes & notifications│
│ Matériel     │ Checklists   │ Avenants      │ Flux BI                │
│ Prestations  │ Pièces/temps │ Facturation   │ Journal d'audit        │
│ Forfaits     │ Recensement  │               │                        │
└──────────────┴──────────────┴───────────────┴────────────────────────┘
        │              │               │                  │
        └──────────────┴───────────────┴──────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┬──────────────────┐
        ▼                     ▼                     ▼                  ▼
  App back-office        PWA technicien       Portail client     Imports /
     (desktop)          (mobile offline)      (responsive)       exports Excel
```

---

## 7. Description détaillée des modules

### M1 — Référentiels

**Sociétés.** Entité racine. Raison sociale, identité graphique, territoire, fuseau, devise, taux horaire par défaut, préfixes de numérotation, agences rattachées. Créer une société ne demande aucun développement.

**Clients.** **Alimenté par import Excel** puis maintenu dans CODIPLAN. Champs : raison sociale, code client Winpro conservé comme référence de rapprochement, RIDET, catégorie client, adresse de facturation, conditions de règlement, commercial référent, statut actif. Winpro n'étant pas interfaçable, la fiche client de CODIPLAN devient une fiche autonome : elle peut porter des informations que l'ERP n'a pas — consignes d'accès, interlocuteurs techniques, historique de la relation SAV.

**Sites d'intervention.** Un client peut avoir plusieurs sites. Libellé, adresse, coordonnées GPS, commune, zone géographique, horaires d'accès, **consignes d'accès et de sécurité** — décisives pour les sites miniers : badge, EPI, induction sécurité, autorisation préalable —, contact sur site, temps de trajet de référence depuis chaque agence.

**Contacts.** Nom, fonction, téléphone, mobile, email, rôle (donneur d'ordre, signataire, contact technique, comptabilité), préférence de notification.

**Techniciens.** Nom, agence, compétences, habilitations avec date d'expiration, calendrier de travail, coût horaire interne, taux de facturation par défaut, véhicule.

**Familles et modèles de matériel.** Arborescence à deux niveaux : famille — compresseur, pont élévateur, démonte-pneu, équilibreuse, station de climatisation, poste à souder, groupe électrogène, outillage pneumatique, électroportatif — puis modèle : marque, référence constructeur, caractéristiques, périodicité de maintenance recommandée, gamme opératoire type, pièces d'usure. Référentiel partageable entre sociétés.

**Prestations et forfaits.** Catalogue des prestations (code, libellé, durée standard, taux applicable, famille concernée, checklist type) et catalogue des forfaits décrit au §4.3.

**Compétences.** Utilisé pour l'affectation : le système propose en priorité les techniciens compétents sur la famille concernée.

### M2 — Parc machines

Cœur différenciant de l'outil, et actif à construire intégralement — voir le chapitre 8 consacré à son amorçage.

**Fiche machine.** Identifiant interne, numéro de série constructeur, modèle, client, site, localisation précise, date de mise en service, date de vente et facture d'origine si vendue par la société, statut (en service, en panne, arrêtée, remplacée, ferraillée), garantie, contrat rattaché, **criticité pour le client** — une machine dont l'arrêt bloque la production du client change l'ordre de priorité.

**Création accélérée.** Trois voies, toutes disponibles : création complète en back-office, création depuis le mobile en moins de 60 secondes (photo de la plaque signalétique, modèle, numéro de série, localisation — le reste se complète plus tard), import Excel en masse.

**Identification physique.** Génération d'une **étiquette QR code** à coller sur la machine. Le scan ouvre la fiche, son historique, et permet de déclencher une intervention. C'est le geste qui fait vivre le référentiel.

**Compteurs.** Relevé d'heures ou de cycles à chaque intervention. Déclenche la maintenance conditionnelle et objective l'usure en cas de litige.

**Documents attachés.** Notice, schéma électrique, certificat de conformité, PV de mise en service, rapports de contrôle réglementaire, photos.

**Historique.** Chronologie unifiée : installation, interventions, pièces remplacées, relevés, changements de statut et de localisation. Une machine déplacée conserve son historique.

**Pièces d'usure.** Liste des consommables du modèle avec périodicité indicative. Alimente la préparation de tournée et la proposition commerciale.

### M3 — Demandes et interventions

**Demande d'intervention.** Point d'entrée. Sources : appel téléphonique saisi par l'ADV, portail client, email, échéance contractuelle, seuil de compteur, détection par un technicien.

Champs : client, site, machine concernée ou déclarée inconnue, symptôme, urgence, contact, date souhaitée, machine à l'arrêt.

**Qualification.** L'ADV ou le responsable transforme la demande en intervention : type, durée estimée, compétences requises, priorité, mode de valorisation (forfait ou temps passé), affectation. Une demande peut être close sans intervention — résolue par téléphone, hors périmètre, refus client — et cette information est conservée : elle mesure le service rendu à distance.

**Types d'intervention.** Préventif contractuel, préventif hors contrat, curatif, installation / mise en service, garantie, contrôle réglementaire, expertise / devis, reprise de matériel, **recensement de parc**.

**Niveaux d'urgence et engagements.**

| Niveau | Définition | Prise en charge cible | Intervention cible |
|---|---|---|---|
| P1 — Critique | Production client arrêtée, ou risque sécurité | 30 min | 4 h ouvrées |
| P2 — Haute | Machine dégradée, production ralentie | 2 h ouvrées | 24 h ouvrées |
| P3 — Normale | Panne sans impact immédiat | 4 h ouvrées | 5 jours ouvrés |
| P4 — Planifiée | Préventif, installation, contrôle, recensement | — | Fenêtre contractuelle |

Le standard interne de réactivité — toute demande client reçoit une réponse sous 30 minutes — s'applique à l'accusé de réception, quel que soit le niveau.

**Cycle de vie.**

```
  BROUILLON ──▶ À PLANIFIER ──▶ PLANIFIÉE ──▶ ENVOYÉE ──▶ EN COURS
                     ▲              │                          │
                     │              ▼                          ▼
                     └──────── REPORTÉE                    SUSPENDUE
                                    │                          │
                                    ▼                          ▼
                                ANNULÉE                    TERMINÉE
                                                               │
                                                               ▼
                                                     RAPPORT À VALIDER
                                                               │
                                                               ▼
                                              CLÔTURÉE ──▶ À FACTURER ──▶ FACTURÉE
```

Le statut **SUSPENDUE** est indispensable : il couvre l'attente de pièce, cas fréquent avec des délais d'approvisionnement maritime de l'ordre de quatre mois. Une intervention suspendue sort du planning actif mais reste dans les engagements et alimente une file « en attente de pièce » visible en permanence.

Le statut **FACTURÉE** est ici positionné manuellement ou par import du retour de facturation, Winpro ne pouvant pas le renseigner automatiquement.

**Contenu.** Client, site, machine(s), type, priorité, description, technicien(s), date et créneau, durée estimée, checklist, temps réel, diagnostic, travaux, pièces, état de sortie, préconisations, photos, signature.

**Interventions multi-machines.** Une visite peut couvrir plusieurs machines : plusieurs lignes machine, chacune avec sa checklist et son état de sortie, un seul déplacement, un seul rapport. C'est le format naturel des visites de recensement et des visites préventives de contrat.

**Interventions multi-techniciens.** Une pose de pont élévateur mobilise deux personnes : affectation multiple avec un technicien référent responsable du rapport.

### M4 — Planning et dispatch

**Vue calendrier.** Techniciens en lignes, temps en colonnes. Jour, semaine par défaut, deux semaines, mois. Filtres par société, agence, compétence, type, client, statut.

**Manipulation.** Glisser-déposer entre techniciens et créneaux, redimensionnement pour ajuster la durée, création par sélection d'une plage.

**Contrôles à la pose.** Alerte sans blocage sur : chevauchement, absence ou congé, jour de fermeture du site, compétence manquante, temps de trajet incompatible, dépassement d'engagement. **Blocage strict** en cas d'habilitation expirée requise par le site.

**File d'attente.** Colonne latérale des interventions à planifier, triées par urgence et échéance, avec indicateur de risque de dépassement.

**Tournées.** Regroupement d'interventions d'une journée avec ordonnancement et estimation des trajets. Vue carte optionnelle. Avec un seul technicien, la tournée est l'objet de pilotage central : c'est elle, et non le créneau isolé, qui détermine la capacité réelle de la journée.

**Absences.** Congés, formation, arrêt, astreinte, indisponibilité véhicule. Une absence bloque le créneau et alerte si des interventions y sont posées. **Avec un technicien unique, toute absence est un arrêt de service** : le système doit le signaler explicitement et proposer le report groupé des interventions concernées.

**Astreinte.** Planning d'astreinte séparé, technicien de garde visible en un coup d'œil.

### M5 — Rapport d'intervention

Livrable client et preuve de la prestation.

**Structure.** En-tête (référence, date, société émettrice, client, site, technicien), machines avec numéros de série, symptôme signalé, diagnostic, travaux réalisés, pièces remplacées, relevés de compteur, résultats de checklist, temps décomposé (trajet, intervention, attente), état de sortie, préconisations, photos, observations du client, signature du client avec nom et fonction, signature du technicien.

**Signature.** Capture manuscrite à l'écran, horodatée, avec nom et fonction du signataire. En l'absence de signataire habilité, mention « client absent » possible mais tracée et remontée au responsable.

**Génération PDF.** Mise en page **à la charte de la société émettrice** — couleurs, logo et mentions provenant du paramétrage société. Envoi automatique au contact client à la validation et dépôt sur le portail.

**Validation.** Contrôle par le responsable SAV ou le responsable matériel avant diffusion, avec renvoi possible au technicien. Paramétrable : systématique, par échantillonnage, ou au-delà d'un seuil.

**Préconisations.** Les travaux à prévoir saisis par le technicien génèrent automatiquement une demande à qualifier. C'est le principal gisement commercial de l'outil : un « courroie à changer à la prochaine visite » devient une opportunité au lieu d'une note perdue.

### M6 — Contrats de maintenance

Le portefeuille est vide. Le module n'est donc pas un outil de gestion d'un existant : **c'est l'instrument de constitution du portefeuille**. Sa conception en tient compte — il doit produire des propositions autant qu'il suit des engagements.

**Types de contrats.**

| Type | Contenu | Facturation |
|---|---|---|
| **Préventif simple** | N visites planifiées par an, main-d'œuvre incluse, pièces en sus | Forfait annuel, mensualisable |
| **Préventif + curatif** | Préventif inclus, dépannages illimités en main-d'œuvre | Forfait annuel |
| **Tout inclus** | Préventif, curatif, pièces d'usure et consommables inclus | Forfait annuel majoré |
| **Crédit d'heures** | Enveloppe d'heures prépayée, décomptée à chaque intervention | Paiement à la souscription |
| **Garantie constructeur** | Suivi des interventions sous garantie, refacturation constructeur | Non facturé au client |

**Contenu contractuel.** Société émettrice, client, périmètre machines explicite, dates, durée, tacite reconduction, préavis, montant et périodicité, devise, indexation annuelle, engagements de service, pénalités éventuelles, prestations incluses et exclues, taux horaire hors forfait, majoration heures non ouvrées.

**Générateur de propositions.** À partir du parc recensé chez un client, le module propose un contrat pré-chiffré : machines éligibles, périodicité recommandée par modèle, volume d'heures estimé, montant proposé. Sortie en PDF à la charte, prête à être présentée. **C'est la fonction qui transforme le recensement du parc en chiffre d'affaires récurrent.**

**Échéancier automatique.** À la création, génération des visites préventives sur toute la durée, avec fenêtre de tolérance paramétrable. Chaque échéance devient une intervention à planifier X jours avant la date cible.

**Déclenchement conditionnel.** Une visite peut être déclenchée par un compteur plutôt que par une date. Le relevé de chaque passage alimente une projection de la date d'atteinte du seuil.

**Suivi de rentabilité.** Par contrat : montant facturé, heures consommées valorisées au coût interne, pièces valorisées, marge, taux de consommation du forfait. Un contrat qui dérive doit être identifié avant son renouvellement.

**Renouvellement.** Alerte à J-90 avec dossier pré-constitué : historique, taux de consommation, marge, proposition d'ajustement tarifaire.

**Avenants.** Ajout ou retrait de machines en cours de contrat, avec effet sur l'échéancier et le montant.

### M7 — Application mobile technicien

Traitée au chapitre 13.

### M8 — Portail client

Accès web sécurisé, responsive, **à la charte de la société émettrice**.

**Fonctions.** Tableau de bord du parc, fiche machine avec historique et documents, liste et détail des interventions, téléchargement des rapports PDF, dépôt d'une demande avec sélection de la machine, suivi de l'avancement, consultation du contrat et de ses échéances, coordonnées.

**Notifications client.** Accusé de réception, confirmation de planification avec créneau, notification de départ du technicien, mise à disposition du rapport. Email en V1 ; SMS activable dès qu'une passerelle est retenue.

**Multi-utilisateurs.** Plusieurs comptes par client, avec périmètres distincts (un responsable d'atelier limité à son site, par exemple).

### M9 — Tableaux de bord

**Direction.** Vue société ou consolidée : activité, marge, taux d'occupation, respect des engagements, top clients, **progression du parc recensé et du portefeuille de contrats**. Comparaisons N/N-1 à périmètre et jours ouvrés constants.

**Responsable matériel.** Charge à venir sur 4 semaines, interventions en retard, en attente de pièce, contrats à renouveler, marge par contrat, **préconisations non transformées**, machines sans contrat par potentiel.

**Responsable SAV.** Rapports à valider, retours sous 30 jours, interventions sous garantie, qualité par famille de matériel.

**ADV.** Journée en cours, demandes non qualifiées, interventions à planifier, dépassements imminents, **file des éléments à facturer**.

**Technicien.** Sa semaine, ses rapports à compléter, ses habilitations à renouveler.

**Exports.** Tout tableau est exportable en Excel formaté, prêt à l'usage, sans retraitement manuel.

### M10 — Administration

Gestion des sociétés et de leur paramétrage complet (§4.2), utilisateurs et rôles avec habilitation par société, référentiels partagés, tarification et forfaits, modèles de checklist et de document, textes des notifications, journal d'audit filtrable, supervision des imports et des files de synchronisation mobile.

### M12 — Console éditeur

Espace d'administration réservé à l'éditeur, hors du périmètre de toute société cliente : gestion des comptes clients et de leur cycle de vie, abonnements et facturation récurrente, indicateurs éditeur, supervision technique, support, gestion des versions. **Décrit en détail au §22.4.** Réalisé au lot 7, après la mise en production interne.

### M11 — Imports et exports Excel

Module érigé au rang de fonction principale, conséquence directe de l'impossibilité d'interfacer Winpro.

**Imports en masse disponibles.**

| Import | Usage |
|---|---|
| Clients | Alimentation initiale et mises à jour périodiques depuis un export Winpro |
| Sites et contacts | Complément du référentiel client |
| Machines | Amorçage du parc, y compris depuis un historique de ventes matériel |
| Modèles de matériel | Constitution du référentiel technique |
| Prestations et forfaits | Grille tarifaire |
| Relevés de compteur | Reprise de relevés collectés hors outil |
| Interventions historiques | Reprise d'un historique tenu sur tableur |
| Retours de facturation | Numéro et date de facture, pour boucler le cycle |

**Fonctionnement.** Modèle Excel téléchargeable pour chaque import, avec colonnes documentées et exemples. Dépôt du fichier, **contrôle avant chargement** avec rapport ligne à ligne (valide, à corriger, doublon, rejet motivé), prévisualisation des modifications, puis validation explicite. Aucun chargement n'est appliqué sans que l'utilisateur ait vu ce qui va changer.

**Reprise et correction.** Le fichier de rejets est retourné annoté, corrigeable et rechargeable directement. Un import peut être **annulé intégralement** dans les 24 heures : chaque chargement est identifié et réversible.

**Journal des chargements.** Qui, quand, quel fichier, combien de lignes créées, modifiées, rejetées, et la possibilité de retélécharger le fichier source.

**Exports normalisés.** Éléments à facturer, parc machines, interventions, contrats, temps passé, indicateurs. Formats stables dans le temps pour être réutilisés dans les tableurs existants.

---

## 8. Stratégie d'amorçage du parc machines

Aucun inventaire n'existe. C'est le chemin critique : sans parc, le planning se réduit à un agenda, les contrats n'ont pas d'assiette et le portail client n'a rien à montrer. Ce chapitre traite l'amorçage comme un projet en soi, avec deux dispositifs complémentaires retenus.

### 8.1 Dispositif 1 — Création au fil des interventions

**Principe.** Toute intervention porte obligatoirement une machine. Si elle n'existe pas au référentiel, le technicien la crée sur place, depuis son téléphone, avant de commencer.

**Exigence de conception.** La création doit tenir en moins de 60 secondes : photo de la plaque signalétique, sélection du modèle dans une liste courte filtrée par famille, saisie du numéro de série avec **reconnaissance de caractères sur la photo de la plaque** pour éviter la frappe, localisation, et c'est tout. Le reste — garantie, date de mise en service, documents — se complète en back-office.

**Effet attendu.** Le parc se construit sans effort additionnel, mais lentement : au rythme d'un technicien, il faut compter 12 à 18 mois pour couvrir les clients réguliers. Ce dispositif garantit qu'aucune machine touchée ne reste inconnue ; il ne suffit pas à constituer une assiette commerciale.

### 8.2 Dispositif 2 — Campagne de recensement dédiée

**Principe.** Une tournée de visites de recensement chez les principaux clients, gratuite pour eux, dont l'objet affiché est d'inventorier et d'étiqueter leur parc.

**Pourquoi c'est le bon véhicule.** Le recensement n'est pas un coût administratif : c'est un prétexte commercial de premier ordre. Le technicien entre dans l'atelier, constate l'état réel du parc, identifie les machines vieillissantes et les défauts d'entretien, et repart avec la matière d'une proposition de contrat — dans un portefeuille qui compte aujourd'hui zéro contrat. **Le coût de la visite est un investissement commercial, pas une charge de saisie.**

**Outillage prévu dans CODIPLAN**

- **Type d'intervention « recensement »** : une visite, plusieurs machines créées, aucune facturation, durée estimée au nombre de machines attendues.
- **Écran de saisie en série** sur mobile : créer une machine, valider, enchaîner immédiatement sur la suivante, sans repasser par un menu.
- **Impression des étiquettes QR** : par lot en amont pour les modèles connus, ou à la demande depuis une imprimante d'étiquettes portable.
- **Fiche de restitution client** générée en fin de visite : l'inventaire de son parc, l'état constaté machine par machine, les préconisations. Document à valeur commerciale, remis et envoyé sur-le-champ.
- **Proposition de contrat pré-chiffrée** générée depuis le parc recensé (voir M6).
- **Suivi de campagne** : liste des clients cibles, statut de visite, machines recensées, propositions émises, contrats signés.

**Ciblage.** Priorité aux clients ayant acheté du matériel chez CODIMA — repérables par import de l'historique des ventes matériel —, aux comptes industriels à parc dense, et aux clients dont l'arrêt machine a un coût élevé. Un compte comme Prony Resources justifie à lui seul une visite dédiée.

### 8.3 Séquence recommandée

| Période | Action |
|---|---|
| Dès la fin du lot 1 | Import Excel des clients et de l'historique des ventes matériel — pré-création des fiches machines connues, même incomplètes |
| Lot 3 livré | Activation de la création au fil des interventions, obligatoire |
| Lots 3 à 5 | Campagne de recensement : 2 à 4 visites par semaine sur les comptes cibles |
| Continu | Suivi mensuel de l'indicateur « machines référencées » en comité |

**Objectif chiffré.** 300 machines à M+6, 800 à M+12. Ce n'est pas un objectif de saisie, c'est un objectif commercial : chaque machine référencée est une ligne d'un contrat futur.

### 8.4 Ce qui ferait échouer l'amorçage

Trois erreurs classiques, à écarter explicitement.

- **Vouloir un référentiel complet avant de démarrer.** Une fiche machine à quatre champs vaut mieux qu'une fiche parfaite jamais créée. Les champs obligatoires à la création sont réduits au strict minimum.
- **Faire du recensement une tâche administrative.** S'il est vécu comme de la saisie, il ne se fera pas. Il est cadré comme une visite commerciale avec un livrable client.
- **Ne pas mesurer.** Sans indicateur suivi mensuellement et porté par le responsable matériel, la dynamique s'éteint au troisième mois.

---

## 9. Parcours utilisateurs de référence

### P1 — Dépannage urgent chez un client

1. Le client appelle : son compresseur est à l'arrêt, l'activité pneumatiques est bloquée.
2. L'ADV crée la demande, sélectionne le client, retrouve la machine dans le parc, coche « machine à l'arrêt », urgence P1.
3. Le système affiche l'historique : deux interventions sur le pressostat dans les six derniers mois.
4. L'ADV voit dans la file d'attente que le technicien est disponible en fin de matinée et pose l'intervention par glisser-déposer.
5. Le client reçoit une confirmation avec le créneau.
6. Le technicien reçoit la notification sur sa PWA ; sa tournée se met à jour.
7. Sur place, il scanne le QR code, consulte l'historique, saisit son diagnostic, remplace la pièce, relève le compteur, prend deux photos, fait signer le chef d'atelier.
8. Il note une préconisation : « filtre à air à remplacer, prévoir au prochain passage ».
9. Le rapport part en validation ; le responsable SAV le valide ; le PDF est envoyé et déposé sur le portail.
10. La préconisation apparaît dans la file des opportunités à qualifier.

### P2 — Visite de recensement et proposition de contrat

1. Le responsable matériel sélectionne un compte cible dans le suivi de campagne et planifie une visite de recensement.
2. Le technicien se rend sur site avec un rouleau d'étiquettes QR vierges.
3. Il enchaîne les créations de machines en série : plaque photographiée, modèle, numéro de série, localisation, étiquette collée. Douze machines en une heure.
4. Il constate l'état de chacune et note les défauts.
5. En fin de visite, la fiche de restitution est générée et signée : inventaire du parc, état constaté, préconisations.
6. De retour, le responsable matériel génère la proposition de contrat pré-chiffrée à partir du parc recensé.
7. La proposition est présentée au client. Signée, elle devient un contrat dont l'échéancier se génère automatiquement.

### P3 — Visite préventive contractuelle

1. Le contrat prévoit une visite trimestrielle. L'échéance est générée et remonte à planifier 30 jours avant la date cible.
2. L'ADV regroupe la visite avec d'autres interventions sur la même commune pour constituer une tournée cohérente.
3. Le client est prévenu une semaine avant, puis la veille.
4. Le technicien déroule la checklist du modèle, point par point : conforme, à surveiller, non conforme.
5. Un point non conforme génère une préconisation et, si l'urgence le justifie, une demande curative.
6. Le compteur de visites du contrat s'incrémente ; le taux de consommation du forfait est mis à jour.

### P4 — Intervention hors couverture réseau

1. Avant de partir sur la côte Est, la PWA a synchronisé la tournée, les fiches machines, les historiques et les checklists.
2. Sur place, aucun réseau. Le technicien travaille normalement : consultation, saisie, photos, signature. Tout est stocké localement.
3. De retour en zone couverte, la synchronisation se déclenche en tâche de fond ; les photos partent en dernier, compressées.
4. En cas de conflit — l'ADV a modifié l'intervention entre-temps —, la règle de résolution s'applique et le cas est journalisé.

### P5 — Demande déposée par le client sur le portail

1. Le client sélectionne la machine dans son parc, décrit le symptôme, joint une photo.
2. La demande arrive dans la file de qualification avec accusé de réception immédiat.
3. L'ADV qualifie sous 30 minutes conformément au standard interne.
4. Le client suit l'avancement sans rappeler.

### P6 — Alimentation du référentiel client depuis Winpro

1. Une fois par mois, l'ADV exporte la liste des clients depuis Winpro au format Excel.
2. Elle dépose le fichier dans l'écran d'import de CODIPLAN.
3. Le contrôle avant chargement affiche : 14 clients nouveaux, 31 modifiés, 2 rejets pour code client manquant.
4. Elle corrige les deux lignes dans le fichier de rejets retourné et le recharge.
5. Le chargement est validé et journalisé, réversible pendant 24 heures.

### P7 — Restitution des éléments à facturer

1. À la clôture d'une intervention, celle-ci bascule dans la file « à facturer » avec son mode de valorisation — forfait, temps passé, ou les deux.
2. L'ADV exporte la file en Excel, en fin de semaine.
3. Elle saisit les factures dans Winpro à partir de cet export.
4. Elle réimporte le fichier complété des numéros et dates de facture ; les interventions passent au statut FACTURÉE et le bouclage est tracé.

---

## 10. Règles de gestion

*Chaque règle amendée par un arbitrage porte la mention `*(amendée par Dxx)*`, et
l'arbitrage cité porte en retour la ligne `**Règles amendées :**`. Les deux
listes sont vérifiées l'une par l'autre — `tests/unit/docs/cablage-arbitrages.test.ts`
part de **toutes** les règles et de **tous** les arbitrages, et une absence de
mention est un écart, jamais une sortie du périmètre.*

### RG — Multi-société

| Réf | Règle |
|---|---|
| RG-SOC-01 | Tout enregistrement métier appartient à une et une seule société. |
| RG-SOC-02 | Le filtrage par société est appliqué côté serveur sur chaque requête, et doublé d'une politique de sécurité au niveau des lignes en base. |
| RG-SOC-03 | Un utilisateur peut être habilité sur plusieurs sociétés, avec un rôle distinct pour chacune. |
| RG-SOC-04 | Aucune donnée client, machine, intervention ou contrat ne peut être partagée entre sociétés. Seuls les référentiels techniques marqués « partagés » le sont. |
| RG-SOC-05 | Les compteurs de numérotation sont propres à chaque société. |
| RG-SOC-06 | La création d'une société ne requiert aucun développement : elle est intégralement paramétrable. |

### RG — Devises et tarification

| Réf | Règle |
|---|---|
| RG-TAR-01 | Chaque société porte une devise de référence. Les montants sont stockés dans cette devise avec son code. |
| RG-TAR-02 | Aucune conversion n'est appliquée ligne à ligne. La conversion n'intervient que sur les agrégats de consolidation, à parité datée et paramétrée. |
| RG-TAR-03 | Le nombre de décimales est une propriété de la devise. XPF : zéro décimale. EUR : deux. |
| RG-TAR-04 | Le taux horaire est historisé. Un changement de taux ne modifie pas les interventions déjà valorisées. |
| RG-TAR-05 | Une intervention est valorisée au forfait, au temps passé, ou au forfait plus les heures excédentaires. Le mode est fixé à la qualification et modifiable jusqu'à la clôture. **Le temps passé est arrondi au quart d'heure supérieur PAR INTERVENTION**, jamais sur le total d'une journée : cinq passages de cinq minutes font **1 h 15**, et non 30 minutes. *(amendée par D57)* |
| RG-TAR-06 | Un forfait ne s'applique que si ses conditions sont remplies — zone, famille de matériel, type d'intervention. |

### RG — Interventions

| Réf | Règle |
|---|---|
| RG-INT-01 | Une intervention est rattachée à un client et à un site. Elle porte au moins une machine, **sauf pour les types `expertise`, `installation` et `recensement`**. Si la machine n'existe pas, elle est créée avant de démarrer. *(amendée par D16)* |
| RG-INT-02 | Une intervention ne peut passer à TERMINÉE que si le temps passé est renseigné et la checklist complétée. |
| RG-INT-03 | Une intervention ne peut être CLÔTURÉE sans rapport validé. |
| RG-INT-04 | La signature client est obligatoire pour clôturer, sauf motif d'exception tracé et notifié au responsable. |
| RG-INT-05 | Toute modification d'une intervention planifiée à moins de 24 h notifie le client et le technicien. |
| RG-INT-06 | Une intervention SUSPENDUE porte un motif et, pour une attente de pièce, la référence attendue et la date de disponibilité prévisionnelle. |
| RG-INT-07 | Le temps de trajet est saisi séparément et n'est facturé que selon la règle du contrat, du forfait ou du barème applicable. |
| RG-INT-08 | Une intervention hors horaires d'ouverture porte automatiquement la majoration paramétrée pour la société. |
| RG-INT-09 | Une intervention de type garantie ne génère aucun montant client mais est valorisée au coût pour le suivi de rentabilité. |
| RG-INT-10 | Une intervention de type `curatif` sur une machine ayant déjà fait l'objet d'une intervention `curatif` **clôturée** dans les 30 jours calendaires précédents est marquée `retour = true` et remonte au suivi qualité. *(amendée par D25)* |
| RG-INT-11 | Une intervention de type recensement ne génère ni montant ni engagement de délai, mais produit une fiche de restitution client. |

### RG — Planning

| Réf | Règle |
|---|---|
| RG-PLA-01 | Le calendrier d'ouverture est propre à chaque **agence** : Ducos du lundi au samedi, Koné du lundi au vendredi. Aucun calendrier global unique n'est valide pour l'ensemble des agences. *(amendée par D47 — la version d'origine disait « site » en désignant des agences, mot que D5 avait déjà corrigé.)* |
| RG-PLA-02 | Les jours fériés sont **des données du territoire** (D46) ; leur caractère chômé ou travaillé est paramétré **par agence**, via le calendrier. Un férié n'est pas systématiquement chômé. *(amendée par D47)* |
| RG-PLA-03 | Un chevauchement sur un même technicien est signalé mais reste possible : le planificateur garde la main. |
| RG-PLA-04 | L'affectation est **bloquée** si le site exige une habilitation marquée **bloquante** que le technicien n'a pas, ou dont la date d'expiration est antérieure à la date d'intervention. Une exigence non bloquante produit un **avertissement**. *(amendée par D9)* |
| RG-PLA-05 | Le temps de trajet inter-sites est intégré au calcul de charge. La valeur saisie dans `site.temps_trajet_min` **fait foi** quand elle existe ; l'estimation à partir de la zone géographique n'est qu'un **défaut**, appliqué en son absence. Cette valeur est le trajet **depuis l'agence de rattachement du site** (`site.agence_id`) : un site dépend d'une agence et d'une seule, et le temps de trajet **perd son sens si ce rattachement change sans être revu** — la base le refuse. *(amendée par D23, D56)* |
| RG-PLA-06 | Une absence validée bloque le créneau ; les interventions posées repassent en file à planifier avec alerte. Tant que l'effectif est d'un seul technicien, l'absence déclenche une alerte de rupture de service et propose le report groupé. |

### RG — Contrats

| Réf | Règle |
|---|---|
| RG-CON-01 | Les échéances préventives sont générées à la création du contrat sur toute sa durée. |
| RG-CON-02 | Une échéance non réalisée dans sa fenêtre de tolérance est marquée en dépassement et remonte en alerte quotidienne. |
| RG-CON-03 | Une machine ne peut être couverte que par un seul contrat actif **de type commercial** à la fois. Un contrat de type `garantie` peut coexister avec un contrat commercial. Un contrat est **actif** lorsqu'il porte le statut `actif` **et** que la date du jour est comprise dans la fenêtre `contrat_ligne.date_entree` / `date_sortie`. *(amendée par D30)* |
| RG-CON-04 | Le retrait d'une machine du périmètre fait l'objet d'un avenant daté ; les échéances futures correspondantes sont annulées. |
| RG-CON-05 | L'alerte de renouvellement se déclenche à J-90 du terme, ou au préavis contractuel s'il est plus long. |
| RG-CON-06 | Le crédit d'heures est décompté à la validation du rapport, jamais avant. |
| RG-CON-07 | Une proposition de contrat ne peut être générée que sur des machines effectivement recensées et rattachées au client. |

### RG — Parc machines

| Réf | Règle |
|---|---|
| RG-PAR-01 | Le couple (modèle, numéro de série) est unique au sein d'une société. Un doublon est bloqué à la création et signalé au technicien sur le terrain. |
| RG-PAR-02 | Les champs obligatoires à la création sont limités à **quatre** : modèle, client, site, **numéro de série**. Tout le reste peut être complété ultérieurement. Numéro de série illisible ou absent : il est saisi `SN-INCONNU-<référence interne>`, unique par construction, et la machine est marquée `complet = false`. La localisation et la photo de plaque restent facultatives. *(amendée par D6)* |
| RG-PAR-03 | Une machine déplacée change de site mais conserve son identifiant et son historique intégral. |
| RG-PAR-04 | Un relevé de compteur ne peut être inférieur au précédent, sauf motif de remplacement de compteur tracé. |
| RG-PAR-05 | Une machine « ferraillée » ou « remplacée » sort des contrats et des échéanciers ; son historique reste consultable. |
| RG-PAR-06 | Le lien de remplacement entre l'ancienne et la nouvelle machine est conservé pour la traçabilité commerciale. |

### RG — Imports et exports

| Réf | Règle |
|---|---|
| RG-IMP-01 | Aucun import n'est appliqué sans contrôle préalable présenté à l'utilisateur et validation explicite. |
| RG-IMP-02 | Chaque chargement est identifié, journalisé et **annulable, avec refus motivé sur les lignes modifiées ou référencées depuis**. L'annulation n'est bornée ni par un délai ni par le rang du lot : ce qui est sans danger est restauré, ce qui ne l'est pas est refusé avec son motif. *(amendée par D15, D54)* |
| RG-IMP-03 | Les lignes rejetées sont retournées dans un fichier annoté, corrigeable et rechargeable. |
| RG-IMP-04 | Un import ne peut créer de données que dans la société sur laquelle l'utilisateur est positionné. |
| RG-IMP-05 | Le rapprochement à l'import se fait sur le **code externe** du client s'il existe, à défaut sur la **raison sociale normalisée**. Son absence ne suffit plus à rejeter la ligne. En cas d'ambiguïté, la ligne part en **rejet pour arbitrage humain** plutôt qu'en création silencieuse d'un doublon. *(amendée par D29)* |

### RG — Droits et confidentialité

| Réf | Règle |
|---|---|
| RG-DRO-01 | Un client n'accède qu'aux données de son propre périmètre. Le contrôle est appliqué côté serveur, jamais seulement à l'affichage. |
| RG-DRO-02 | Un technicien accède aux machines des interventions qui lui sont ou lui ont été affectées, **et à l'intégralité du parc des clients chez qui il a une intervention planifiée dans les 7 jours**, plus la résolution par QR code. *(amendée par D22)* |
| RG-DRO-03 | Les montants de vente et les marges ne sont visibles que par les profils autorisés, selon la matrice du §5.2. |
| RG-DRO-04 | Toute création, modification ou suppression sur une table du **périmètre d'audit** est journalisée avec auteur, horodatage et valeurs avant/après. **Le périmètre est INVERSÉ** : toute table métier cloisonnée y est comprise **par défaut**, et n'en sort que par une **exemption écrite et justifiée**. La règle et ses exemptions s'écrivent **une seule fois**, dans `scripts/lib/perimetre-audit.ts` : cette règle y renvoie, l'invariant I8 y renvoie, et une exemption ne s'y ajoute que par arbitrage. Le journal est écrit par un déclencheur PostgreSQL, jamais par la couche applicative. *(amendée par D32, D52, D53, D55)* |
| RG-DRO-05 | Le second facteur est **obligatoire** pour les rôles `admin_plateforme`, `admin_societe` et `direction`. Pour `admin_societe`, la contrainte pèse sur un utilisateur du client : elle est **annoncée à l'ouverture de toute nouvelle société**, avant que le premier compte ne soit créé. Aucune société n'est ouverte sans que son administrateur ait été averti qu'une application d'authentification lui sera nécessaire. *(amendée par D40 — règle introduite par cet arbitrage.)* |

---

## 11. Modèle de données

### 11.1 Schéma relationnel

```
                    ┌──────────────┐
                    │   SOCIÉTÉ    │  devise, charte, taux horaire,
                    └──────┬───────┘  calendrier, numérotation
                           │  (toutes les entités ci-dessous portent societe_id)
        ┌──────────────────┼───────────────────┬─────────────────┐
        ▼                  ▼                   ▼                 ▼
 ┌──────────────┐   ┌─────────────┐    ┌──────────────┐  ┌──────────────┐
 │    CLIENT    │   │  TECHNICIEN │    │   FORFAIT    │  │  UTILISATEUR │
 └──────┬───────┘   └──────┬──────┘    │  PRESTATION  │  │  ×société    │
        │                  │           └──────────────┘  └──────────────┘
   ┌────┴─────┬────────────┼───────────┐
   ▼          ▼            ▼           ▼
┌────────┐ ┌───────┐ ┌──────────┐ ┌──────────┐
│  SITE  │ │CONTACT│ │ ABSENCE  │ │COMPÉTENCE│
└───┬────┘ └───────┘ │HABILITAT.│ └──────────┘
    │                └──────────┘
    ▼
┌──────────┐        ┌──────────┐        ┌──────────────┐
│ MACHINE  │◀───────│CONTRAT_LG│◀───────│   CONTRAT    │
└────┬─────┘        └────┬─────┘        └──────────────┘
     │                   ▼
     │            ┌──────────────┐
     │            │   ÉCHÉANCE   │
     │            └──────┬───────┘
     ├──────────┬────────┴────────┐
     ▼          ▼                 ▼
┌──────────┐ ┌────────┐    ┌──────────────┐
│ COMPTEUR │ │DOCUMENT│    │   DEMANDE    │
└──────────┘ └────────┘    └──────┬───────┘
                                  ▼
                          ┌───────────────┐
                          │ INTERVENTION  │  mode de valorisation,
                          └───────┬───────┘  forfait, montant, devise
   ┌──────────┬─────────────┬─────┴────┬──────────────┐
   ▼          ▼             ▼          ▼              ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  ┌─────────────┐
│INTERV_ │ │AFFECTA-│ │ TEMPS  │ │ PIÈCE  │  │   RAPPORT   │
│MACHINE │ │  TION  │ └────────┘ └────────┘  └──────┬──────┘
└───┬────┘ └────────┘                               ▼
    ▼                                        ┌─────────────┐
┌──────────────┐                             │PHOTO        │
│CHECKLIST_LIGNE│                            │SIGNATURE    │
└──────────────┘                             └─────────────┘

        ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
        │ IMPORT_LOT   │   │JOURNAL_AUDIT │   │ SYNC_JOURNAL │
        └──────────────┘   └──────────────┘   └──────────────┘
```

### 11.2 Tables principales

**societe** — nouvelle table racine

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| code | text unique | Préfixe de numérotation |
| raison_sociale | text | |
| pays, territoire | text | |
| fuseau_horaire | text | Ex. Pacific/Noumea |
| devise_code | text FK | XPF, EUR, … |
| ~~taux_horaire_defaut~~ | ~~numeric~~ | *(retirée le 09/09/2026 — Q3. Deux sources d'un même fait divergeaient en valeur ; le taux vit désormais dans `taux_horaire`, **historisé par date d'effet** (RG-TAR-04). Une facture qui change quand le tarif change est une facture fausse.)* |
| majoration_hors_ouverture_pct | numeric | |
| libelle_code_externe | text | Libellé d'affichage de `client.code_externe` — « Code Winpro » chez CODIMA (D29) |
| logo_url | text | |
| couleur_primaire, couleur_secondaire | text | Charte des documents générés |
| mentions_legales | text | Pied des documents |
| langue | text | |
| actif | boolean | |

**devise**

| Colonne | Type | Description |
|---|---|---|
| code | text PK | XPF, EUR, USD… |
| libelle | text | |
| decimales | integer | 0 pour XPF, 2 pour EUR |
| symbole | text | |

*`parite_reference` et `parite_date` ont été **supprimées** de cette table par D20 :
une parité est datée et multiple, elle ne tient pas dans une colonne. Elle vit
dans la table `parite` ci-dessous.*

**parite** *(D20, D41 — référentiel de plateforme)*

| Colonne | Type | Description |
|---|---|---|
| devise_code | text FK | |
| date_effet | date | Parité datée, jamais implicite |
| taux | numeric | |
| source | text | Origine de la parité |

**forfait**

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| societe_id | uuid FK | |
| code, libelle | text | |
| type | enum | deplacement, mise_en_service, controle, prestation |
| montant | numeric | Dans la devise de la société |
| heures_incluses | numeric | |
| zone_geo | enum[] | Conditions d'application |
| famille_id | uuid FK | |
| type_intervention | enum[] | |
| cumulable_temps | boolean | |
| actif | boolean | |

**client** — `societe_id`, `code_externe` (clé de rapprochement à l'import ; `code_winpro` avant D29), raison sociale, RIDET, catégorie client, adresse de facturation, conditions de règlement, commercial référent, actif.

**site** — `societe_id`, client, libellé, adresse, commune, zone géographique, latitude/longitude, consignes d'accès, horaires, contact principal, temps de trajet par agence.

**machine**

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| societe_id | uuid FK | |
| ~~reference_interne~~ | text | ~~Unique par société, porté par le QR~~ *(amendé le 09/09/2026 — L2-01. **Le QR encode le `qr_token`, jamais autre chose** (I10, D7) : cette ligne disait le contraire. `reference_interne` reste, NULLABLE, pour ce que D6 lui donne à porter — la référence que le technicien compose quand la plaque est illisible, `SN-INCONNU-<référence>`.)* |
| numero | integer | **Numéro AFFICHÉ**, attribué par le SERVEUR séquentiellement par société à la première synchronisation (D7, I10). `NULL` en attendant ; l'interface affiche alors `Local-<6 caractères>`. **Aucun code ne l'attribue à ce jour** — le compteur appartient à la synchronisation, lot 3 |
| cree_le, modifie_le | timestamptz | |
| modele_id | uuid FK | |
| numero_serie | text | **OBLIGATOIRE** (D6), unique par (société, modèle). Plaque illisible → `SN-INCONNU-<référence>` et `complet = false` : *jamais `NULL`*, deux `NULL` étant distincts pour un index unique |
| client_id, site_id | uuid FK | |
| localisation | text | |
| date_mise_en_service | date | Facultatif à la création |
| date_vente, facture_origine | date, text | |
| garantie_fin | date | |
| statut | enum | en_service, en_panne, arretee, remplacee, ferraillee |
| criticite | enum | bloquante, importante, normale |
| machine_remplacee_id | uuid FK | |
| qr_token | text unique | |
| source_creation | enum | terrain, recensement, import, back_office |
| complet | boolean | Fiche minimale ou complète — pilote les relances |

**modele_materiel** — ~~`societe_id` **nullable** : un modèle sans société est partagé par toute la plateforme.~~ *(amendé par D4 le 08/09/2026 — `societe_id` **NOT NULL**, table métier cloisonnée : le mécanisme « référentiel + copie masquante » est retiré, il se contredisait.)* Famille, marque, référence, caractéristiques, périodicité en jours, périodicité au compteur, checklist type, pièces d'usure.

**famille_materiel** — `societe_id` **NOT NULL**, code, libellé, actif *(D4 amendé)*.

**contrat** — `societe_id`, numéro, client, type, dates, tacite reconduction, préavis, montant, `devise_code`, périodicité de facturation, indexation, SLA, taux horaire hors forfait, crédit d'heures initial, statut.

**contrat_ligne** — rattache une machine à un contrat, périodicité propre, dates d'entrée et de sortie de périmètre.

**echeance** — contrat_ligne, date cible, fenêtre en jours, statut (a_planifier, planifiee, realisee, depassee, annulee), intervention rattachée.

**demande** — `societe_id`, numéro, source, client, site, machine, description, urgence, machine arrêtée, contact, date souhaitée, statut, horodatage de l'accusé de réception (mesure du standard 30 minutes).

**intervention**

| Colonne | Type | Description |
|---|---|---|
| id | uuid PK | |
| societe_id | uuid FK | |
| numero | text | Unique par société — INT-AAAA-NNNNN |
| demande_id, contrat_id | uuid FK | |
| client_id, site_id | uuid FK | |
| type | enum | preventif_contrat, preventif_hors_contrat, curatif, installation, garantie, controle_reglementaire, expertise, reprise, **recensement** |
| priorite | enum | p1, p2, p3, p4 |
| statut | enum | Voir cycle de vie §7/M3 |
| date_planifiee, creneau_debut, creneau_fin | date, timestamptz | |
| duree_estimee_min | integer | |
| technicien_referent_id | uuid FK | |
| agence | uuid FK | |
| mode_valorisation | enum | forfait, temps_passe, forfait_plus_heures |
| forfait_id | uuid FK | |
| taux_horaire_applique | numeric | Historisé à la qualification |
| montant_ht | numeric | |
| devise_code | text FK | |
| cout_interne | numeric | |
| motif_suspension, piece_attendue_ref | text | |
| date_dispo_prevue | date | |
| sla_prise_en_charge_at, sla_echeance_at | timestamptz | |
| statut_facturation | enum | non_facturable, a_facturer, facturee |
| reference_facture, date_facture | text, date | Renseignés par import du retour de facturation |

**intervention_machine** — une ligne par machine traitée : diagnostic, travaux, état de sortie, relevé de compteur, résultat de checklist.

**intervention_temps** — technicien, type (trajet, intervention, attente, pause), début, fin, durée, facturable.

**intervention_piece** — référence, désignation, quantité, origine (stock véhicule, commande, fourni client), prix et coût unitaires, devise.

**rapport** — intervention, contenu structuré, préconisations, statut (brouillon, a_valider, valide, refuse), validateur, url du PDF, horodatage d'envoi.

**signature** — rapport, image, nom et fonction du signataire, horodatage, adresse IP, motif d'absence le cas échéant.

**photo** — intervention ou machine, url, type (avant, apres, defaut, plaque_signaletique), légende, horodatage, coordonnées GPS de la prise de vue.

**technicien** — utilisateur, société, agence, coût horaire, taux de facturation par défaut, véhicule, actif.

**competence** / **technicien_competence** / **habilitation** (avec date d'expiration).

**absence** — technicien, type, dates, statut de validation.

**compteur_releve** — machine, intervention, type (heures, cycles, km), valeur, date.

**document** — entité polymorphe rattachée à machine, contrat, client ou intervention : type, nom, url, taille, visible client, embarqué mobile.

**utilisateur** — email, hash du mot de passe, actif, dernière connexion, MFA. **utilisateur_societe** — utilisateur, société, rôle : c'est cette table qui porte l'habilitation multi-société.

**import_lot** — société, type d'import, utilisateur, horodatage, nom du fichier, url du fichier source, lignes créées / modifiées / rejetées, statut (controle, applique, annule). *(`date_limite_annulation` est supprimée par D54 : l'annulation n'est plus bornée par un délai.)*

**journal_audit** — société, entité, identifiant, action, utilisateur, horodatage, valeurs avant et après, adresse IP.

**sync_journal** — appareil, technicien, opérations reçues, conflits détectés, résolution appliquée.

**import_lot_ligne** — `societe_id`, lot d'import, numéro de ligne dans le fichier, action (creation, modification, rejet), entité et identifiant visés, motif du rejet, et **`valeurs_avant`** : c'est cette colonne que D15 exige pour restaurer une ligne à l'annulation. *(Ajoutée le 09/09/2026. **D15, de rang 1, la prescrivait depuis le 19/08/2026** — « restauration des valeurs antérieures, conservées dans `import_lot_ligne.valeurs_avant` » — et le chapitre 11 ne la portait pas : ce n'était pas une décision à prendre, c'était une omission à réparer. La table n'existe pas encore au schéma ; elle naîtra avec L1-08b.)*

#### Les tables du socle, ajoutées le 09/09/2026

*Seize tables existaient au schéma sans figurer ici. Ce n'était pas seize décisions manquantes : c'était **la même omission, seize fois** — un ticket crée une table, et personne ne revient compléter le chapitre 11. Un gardien confronte désormais `prisma/schema.prisma` à cette section et réclame la table le jour où elle apparaît.*

**agence** — `societe_id`, code, libellé, adresse, **fuseau horaire IANA**, **territoire ISO 3166-1 alpha-2**, calendrier de travail, actif. *Le fuseau et le territoire sont deux attributs distincts et indépendants — `Europe/Paris` couvre plusieurs territoires aux fériés différents, et ni l'un ni l'autre ne se déduit de l'autre (D46). `territoire` est `NOT NULL` parce qu'une clé étrangère dont une colonne vaut NULL n'est pas contrôlée (D48).* **Agence** = établissement CODIMA, jamais un site client (D5).

**calendrier** — `societe_id`, code, libellé, actif. Le calendrier de travail d'une ou plusieurs agences (I7).

**calendrier_plage** — `societe_id`, calendrier, jour de la semaine, minute de début, minute de fin. Les heures d'ouverture, déroulées à la lecture.

**calendrier_ferie** — `societe_id`, agence, date, **territoire recopié de l'agence**, jour férié référencé (nul pour un pont), travaillé, motif. *L'ÉCART LOCAL d'une agence sur le fait public : un férié travaillé, un pont. Chaîné par deux clés composites — `(agence_id, territoire)` et `(jour_ferie_id, date, territoire)` — en `ON UPDATE RESTRICT` des deux côtés (D48, D49).*

**jour_ferie** — territoire, date, libellé, mobile. **Référentiel de plateforme** (D46), sans `societe_id`. Il dit ce qui **est férié** sur un territoire — un fait, comme la parité légale ; jamais ce qui est **chômé**, qui appartient à l'agence et vit dans `calendrier_ferie`. *L'ordre de lecture ne s'inverse jamais.*

**contact** — `societe_id`, client, **site facultatif**, nom, fonction, téléphone, mobile, courriel, rôles, canaux, actif. *Un contact appartient au CLIENT ; sans site, il ne disparaît pas pour un compte portail restreint — le comptable survit à la restriction d'un atelier.* `signataire` est un rôle de l'ensemble, jamais une colonne à part (RG-INT-04).

**taux_horaire** — `societe_id`, **date d'effet**, montant **entier** en unités les plus fines, code de devise. *Une table et non une colonne : une intervention se facture au taux en vigueur à SA date (RG-TAR-04), et une facture qui change quand le tarif change est une facture fausse.* Amende `societe.taux_horaire_defaut`, retirée le 09/09/2026 (Q3).

**technicien_habilitation** — `societe_id`, technicien, habilitation, date d'obtention, date d'expiration. RG-PLA-04 : l'affectation est **bloquée**, jamais signalée.

**site_habilitation_requise** — `societe_id`, site, habilitation, bloquant. Ce qu'un site exige de qui y intervient.

**utilisateur_client** — utilisateur, client, `societe_id`, actif. L'habilitation d'un compte **portail** (D10) ; exclusive de `utilisateur_societe`.

**utilisateur_client_site** — `societe_id`, habilitation portail, site. Le périmètre de sites d'un compte portail. *Vide = tous les sites du client.*

**session** — jeton, utilisateur, expiration, adresse IP, agent, **société active**, **rôle actif**, second facteur validé. C'est cette ligne, et rien d'autre, qui détermine `app.societe_id`.

**compte** — utilisateur, émetteur, identifiant externe, fournisseur, **empreinte du mot de passe**, jetons et leurs expirations, portée.

**verification** — identifiant opaque, valeur, expiration. Porte les jetons à usage unique et daté — dont le **jeton de premier accès** du geste d'amorçage (D65).

**second_facteur** — utilisateur, secret, codes de secours **chiffrés**, vérifié, échecs de vérification, verrouillage, **verrouillages consécutifs**. *Aucune politique de suppression : le retrait d'un second facteur est un acte administratif (D58, D62, D64).*

**journal_acces** — horodatage, utilisateur, événement, `societe_id_source`, `societe_id_cible`, rôle, détail. *Les deux colonnes de société sont **informatives et nullables** : elles répondent à « qui a tenté d'accéder à mes données » et ne filtrent JAMAIS (D34).* Elle porte les basculements de société, les requêtes de consolidation, **l'ouverture d'une identité** (D65) et **le déverrouillage d'un second facteur** (D66).

*Les quatre tables `session`, `compte`, `verification` et `second_facteur` sont la **troisième catégorie de I1** — techniques d'authentification, sans aucun `societe_id`, cloisonnées par la forme « désignation » (D34, D59). `journal_acces` les rejoint par sa catégorie et s'en distingue par sa nature : c'est une **trace**, pas un matériau d'authentification.*

### 11.3 Volumétrie estimée à 3 ans

Révisée à la baisse compte tenu de l'effectif réel.

| Entité | Volume |
|---|---|
| Sociétés | 1 à 4 |
| Clients actifs | 200 – 500 |
| Sites | 250 – 600 |
| Machines | 800 – 2 500 |
| Interventions / an | 600 – 1 500 (3 techniciens à terme) |
| Contrats actifs | 25 – 80 |
| Photos / an | 4 000 – 10 000 |

Volumétrie très modeste. Aucune contrainte de dimensionnement, y compris en multi-société. Le coût d'hébergement reste au palier d'entrée quelle que soit la trajectoire envisagée.

---

## 12. Architecture technique

### 12.1 Choix retenus

| Couche | Technologie | Justification |
|---|---|---|
| **Front et back-office** | Next.js (App Router) + TypeScript + Tailwind CSS | Rendu serveur pour la rapidité sur connexions lentes ; une base de code pour le back-office, le portail et la PWA |
| **Composants UI** | shadcn/ui + Radix | Accessibilité, thématisation par société sans dépendance propriétaire |
| **Calendrier** | FullCalendar (licence commerciale) ou Schedule-X | Glisser-déposer, vue ressources multi-techniciens |
| **Backend** | API Routes Next.js, contrats typés bout en bout | Un seul déploiement |
| **Base de données** | PostgreSQL 16 avec sécurité au niveau des lignes | Cloisonnement multi-société garanti en base, pas seulement dans le code |
| **ORM** | Prisma | Migrations versionnées, typage généré |
| **Authentification** | Better Auth + MFA | Sessions, rôles par société, MFA sur les profils sensibles — `admin_plateforme`, `admin_societe`, `direction` (RG-DRO-05) |
| **Stockage fichiers** | Stockage objet S3-compatible, préfixé par société | Photos, PDF, documents, fichiers d'import |
| **Génération PDF** | React-PDF ou rendu serveur | Rapports et propositions à la charte de la société |
| **Traitement Excel** | SheetJS côté serveur | Imports contrôlés et exports formatés |
| **Tâches planifiées** | File de jobs | Échéances, alertes, envois, purges |
| **Notifications** | Couche abstraite : email transactionnel en V1, **SMS enfichable** | Aucune passerelle SMS aujourd'hui ; le choix ultérieur ne doit rien casser |
| **Hébergement** | Plateforme managée + PostgreSQL managé | Aucune administration système |
| **Observabilité** | Journalisation structurée, supervision d'erreurs | Diagnostic à distance |

### 12.2 Cloisonnement multi-société

Trois barrières successives, dont aucune ne suffit seule.

1. **Session** — la société active est portée par la session ; un changement de société est un événement journalisé.
2. **Couche d'accès aux données** — toute requête est construite avec le filtre société ; il n'existe pas de chemin d'accès qui ne le porte pas.
3. **Base de données** — une politique de sécurité au niveau des lignes filtre sur la société positionnée dans le contexte de connexion. Même une requête applicative erronée ne peut pas retourner les lignes d'une autre société.

Le stockage objet est également préfixé par société, et les URL de fichiers sont signées et de durée limitée.

### 12.3 Schéma de déploiement

```
                        Internet
                            │
                ┌───────────┴────────────┐
                │      CDN / Edge        │
                └───────────┬────────────┘
        ┌───────────────────┼────────────────────┐
        ▼                   ▼                    ▼
 ┌─────────────┐    ┌──────────────┐     ┌──────────────┐
 │ Back-office │    │ PWA technicien│     │Portail client│
 └──────┬──────┘    └───────┬───────┘     └──────┬───────┘
        └───────────────────┼────────────────────┘
                            ▼
                 ┌────────────────────┐
                 │  Application Next  │
                 │  API + rendu SSR   │
                 │  filtre société    │
                 └─────────┬──────────┘
        ┌─────────┬────────┼─────────┬──────────────┐
        ▼         ▼        ▼         ▼              ▼
 ┌────────────┐ ┌──────┐ ┌───────┐ ┌────────┐ ┌───────────┐
 │ PostgreSQL │ │Stock.│ │ Jobs  │ │ Email  │ │ SMS       │
 │  RLS par   │ │objet │ │planif.│ │        │ │(enfichable│
 │  société   │ │      │ │       │ │        │ │ à venir)  │
 └─────┬──────┘ └──────┘ └───────┘ └────────┘ └───────────┘
       │
       ├────────────▶ Export Parquet ────▶ Entrepôt BI existant
       │
       └◀─── Imports Excel manuels ◀──── Exports Winpro (manuels)
```

### 12.4 Environnements

Développement local, recette avec données anonymisées, production. Déploiement continu depuis le dépôt Git, migrations automatisées, retour arrière possible.

### 12.5 Sauvegarde et continuité

Sauvegarde quotidienne, rétention 30 jours, restauration à un point dans le temps sur 7 jours, export mensuel complet sur un stockage tiers. Objectif de reprise : 4 heures. Perte maximale admissible : 1 heure.

---

## 13. Application mobile technicien

### 13.1 Principe

Application web progressive installable sur l'écran d'accueil, iOS et Android, sans passer par les magasins d'applications. Une seule base de code avec le reste de la plateforme. Mise à jour instantanée sans action de l'utilisateur.

### 13.2 Fonctionnement hors-ligne

**Mis en cache localement**, à chaque synchronisation : la tournée du jour et des 7 jours suivants ; les fiches des machines concernées avec leurs 10 dernières interventions ; les checklists des modèles ; les documents marqués « embarqué » ; les référentiels prestations, forfaits et pièces courantes ; **le parc complet du client visité**, indispensable en visite de recensement.

**Fonctionne sans réseau** : consultation intégrale du cache, démarrage et arrêt d'intervention, **création de machines en série**, saisie du diagnostic et des travaux, checklist, relevé de compteur, photos, saisie des pièces, signature client, génération de la version locale du rapport et de la fiche de restitution.

**Stockage local** : IndexedDB pour les données structurées, Cache Storage pour les ressources, file d'opérations en attente pour les écritures.

**Synchronisation** : automatique au retour du réseau, en tâche de fond, priorisée — statuts et données structurées d'abord, photos compressées ensuite. Indicateur permanent de l'état de synchronisation avec le nombre d'éléments en attente, et bouton de synchronisation forcée.

**Résolution de conflits** : chaque opération porte un horodatage et un identifiant d'appareil. Règle par défaut — **le terrain fait foi** sur les données d'exécution (temps, diagnostic, checklist, photos, signature, création de machine), **le back-office fait foi** sur la planification (affectation, créneau, priorité). Tout conflit est journalisé et remonté pour arbitrage.

**Doublons de machines créées hors ligne.** Deux techniciens hors réseau peuvent créer la même machine. La détection se fait à la synchronisation sur le couple (modèle, numéro de série) : le doublon est signalé, non supprimé, et fusionné après arbitrage humain en conservant les deux historiques.

### 13.3 Écrans

| Écran | Contenu |
|---|---|
| **Ma journée** | Tournée chronologique, code couleur par statut, indicateur hors-ligne, bouton scan QR |
| **Détail intervention** | Client, site, contact avec appel direct, itinéraire, machines, historique, checklist, démarrer / terminer |
| **Fiche machine** | Identification, statut, garantie, contrat, compteurs, historique, documents, photos |
| **Création machine express** | Photo de plaque avec reconnaissance de caractères, modèle, n° de série, localisation — moins de 60 secondes |
| **Recensement en série** | Enchaînement des créations sans repasser par un menu, compteur de machines saisies |
| **Saisie rapport** | Diagnostic, travaux, pièces, temps, état de sortie, préconisations, photos, signature |
| **Scan QR** | Ouverture directe de la fiche machine, création d'intervention à la volée |
| **Mes machines** | Recherche dans le parc mis en cache |
| **Profil** | Habilitations et échéances, planning de la semaine, état de synchronisation |

### 13.4 Contraintes d'usage terrain

Cibles tactiles d'au moins 44 pixels — l'application s'utilise avec des gants. Contraste renforcé pour la lisibilité en plein soleil. Saisie minimale : listes, boutons, valeurs pré-remplies depuis l'historique, dictée vocale pour les champs libres. Photos compressées à la prise, métadonnées GPS conservées. Synchronisation différentielle uniquement. Reprise de saisie à l'identique après interruption.

### 13.5 Application native — arbitrage

Non retenue en V1. Le surcoût de développement et de maintenance et la double distribution sur les magasins ne sont pas justifiés, a fortiori pour un à trois techniciens. La PWA couvre la caméra, la géolocalisation, le stockage et les notifications. Un passage au natif resterait possible en réutilisant l'API si un besoin de NFC ou de Bluetooth apparaissait.

---

## 14. Échanges de données : Winpro, Excel, BI

### 14.1 Le constat qui fonde ce chapitre

Winpro n'expose **ni base accessible en lecture, ni export automatisé**. Aucune intégration technique n'est donc possible, ni en V1 ni ultérieurement sans changement d'ERP. Ce n'est pas une contrainte à contourner : c'est un paramètre de conception.

**Conséquence assumée :** CODIPLAN est **autonome**. Il porte son propre référentiel client, ses propres identifiants, sa propre vérité opérationnelle. Winpro reste maître sur le stock, la facturation et la comptabilité. Les deux systèmes se parlent par fichiers Excel, manuellement, à une fréquence choisie.

Ce découplage a un avantage inattendu : **la plateforme ne dépend d'aucun ERP**. Elle est déployable chez une autre société utilisant un autre outil de gestion, sans redéveloppement — ce qui sert directement l'objectif de modularité.

### 14.2 Flux entrants — Winpro vers CODIPLAN

| Flux | Fréquence | Contenu | Traitement |
|---|---|---|---|
| Clients | Mensuelle | Code client, raison sociale, RIDET, adresse, catégorie, conditions | Import contrôlé, rapprochement sur le code client |
| Articles / pièces | Trimestrielle | Référence, désignation, famille | Alimente la saisie technicien |
| Historique des ventes matériel | Une fois, puis annuelle | Client, article, date, facture | **Pré-création des fiches machines** — amorçage du parc |
| Retours de facturation | Hebdomadaire | N° intervention, n° et date de facture | Passe les interventions en FACTURÉE |

### 14.3 Flux sortants — CODIPLAN vers Winpro

| Flux | Fréquence | Contenu |
|---|---|---|
| Éléments à facturer | Hebdomadaire | Client, intervention, prestation ou forfait, heures, pièces, montant, devise |
| Pièces consommées | Hebdomadaire | Référence, quantité, intervention — pour régularisation de stock |

La saisie de facturation reste manuelle dans Winpro. L'export est conçu pour être trié, filtré et recopié sans retraitement : colonnes stables, une ligne par élément facturable, totaux vérifiables.

### 14.4 Qualité des échanges

Trois exigences, faute de quoi l'échange manuel dégénère en source d'erreurs.

- **Formats figés.** Les colonnes des modèles d'import et des exports ne changent pas sans version explicite. Un fichier d'une version antérieure est reconnu et signalé.
- **Contrôle avant application.** Aucun import n'est appliqué sans que l'utilisateur ait vu le détail de ce qui va être créé, modifié ou rejeté.
- **Réversibilité.** Tout chargement est annulable intégralement pendant 24 heures.

### 14.5 Flux BI

Export quotidien des faits d'activité au format Parquet vers l'entrepôt existant, aux conventions déjà en vigueur : montants HT remises déduites, devise portée explicitement, conversion opérée uniquement à l'agrégat et à parité datée, date de référence explicite. Permet de croiser l'activité service avec l'activité négoce dans les analyses existantes.

### 14.6 Notifications

**Email transactionnel** en V1 : accusés de réception, confirmations de créneau, envoi des rapports, alertes internes.

**SMS** : aucune passerelle n'est en service aujourd'hui. La couche de notification est abstraite dès la conception — un opérateur SMS s'y branche par configuration, sans modification du code métier. Les cas d'usage prévus : confirmation de créneau, rappel la veille, notification de départ du technicien. En Nouvelle-Calédonie, le SMS reste un canal plus fiable que l'email pour la relation client de terrain : la question est celle du choix de l'opérateur, pas de l'opportunité.

**Autres** : cartographie pour les itinéraires et les tournées ; export iCal en lecture seule du planning technicien, consultable depuis un agenda personnel.

---

## 15. Sécurité, confidentialité et conformité

**Authentification.** Mot de passe conforme aux recommandations en vigueur, second facteur obligatoire pour les rôles administrateur et direction, sessions expirantes, verrouillage après tentatives échouées. Les techniciens disposent d'une session longue durée sur appareil enregistré, avec code PIN ou biométrie locale — imposer une ressaisie de mot de passe en intervention serait contre-productif.

**Autorisation.** Contrôle systématique côté serveur à chaque requête, filtré d'abord par société. Cloisonnement strict des données client sur le portail. Aucune information transmise au client mobile au-delà de son périmètre d'affectation.

**Cloisonnement multi-société.** Traité au §12.2. C'est le point de sécurité le plus sensible de la plateforme : une fuite entre deux sociétés, a fortiori entre une société du groupe et une société hors groupe, serait une faute grave. D'où la triple barrière session / couche d'accès / base de données, et un test de recette dédié consistant à tenter l'accès croisé par manipulation directe des identifiants.

**Chiffrement.** Transport en TLS 1.3, données au repos chiffrées, sauvegardes chiffrées. Stockage local de la PWA limité au nécessaire, purgé à la déconnexion.

**Traçabilité.** Journal d'audit inaltérable sur les entités sensibles, conservé 5 ans. Toute consultation de données client par un utilisateur interne est journalisée, ainsi que tout changement de société active.

**Données personnelles.** Les données traitées sont essentiellement professionnelles : contacts d'entreprise, techniciens. Registre des traitements à tenir, durées de conservation définies — données d'intervention : durée du contrat plus 10 ans pour la valeur probatoire ; comptes portail : suppression 12 mois après la fin de la relation. La signature manuscrite et les photos constituent des données à protéger particulièrement.

**Géolocalisation des techniciens.** Sujet sensible, d'autant plus avec un effectif d'une personne, où toute donnée de position est nominative par construction. Position retenue : **pas de suivi continu**. La géolocalisation n'est capturée qu'au démarrage et à la clôture d'intervention, à des fins de preuve de passage, avec information explicite du collaborateur et mention au règlement intérieur. Un suivi temps réel supposerait une consultation préalable et un cadre formalisé — à traiter en V2 s'il est jugé nécessaire.

**Disponibilité.** Objectif de 99,5 % en heures ouvrées. Le mode hors-ligne de la PWA garantit la continuité du travail terrain même en cas d'indisponibilité de la plateforme.

---

## 16. Pilotage et reporting

### 16.1 Alertes automatiques

| Alerte | Destinataire | Déclenchement |
|---|---|---|
| Demande non qualifiée | ADV, responsable matériel | 30 minutes après réception |
| Engagement SLA à risque | ADV, responsable matériel | À 75 % du délai consommé |
| **Absence technicien sans couverture** | Responsable matériel, direction | À la validation de l'absence, tant que l'effectif est de 1 |
| Échéance contractuelle non planifiée | Responsable matériel | J-15 de la fin de fenêtre |
| Échéance dépassée | Responsable matériel, direction | Sortie de fenêtre |
| Intervention en attente de pièce depuis > 30 j | Responsable matériel | Quotidien |
| Rapport non validé depuis > 48 h | Responsable SAV | Quotidien |
| Habilitation technicien expirant | Responsable matériel, technicien | J-60 |
| Contrat arrivant à terme | Responsable matériel, direction | J-90 |
| Retour sous 30 jours sur une machine | Responsable SAV | À la création |
| Préconisation non transformée depuis > 15 j | Responsable matériel | Hebdomadaire |
| Machine sans contrat et hors garantie | Responsable matériel | Mensuel |
| **Progression du parc recensé sous l'objectif** | Responsable matériel, direction | Mensuel |
| Import en attente de validation depuis > 3 j | ADV | Quotidien |

### 16.2 Rapports périodiques

**Point hebdomadaire d'activité** — envoyé le lundi matin : interventions de la semaine écoulée, charge de la semaine à venir, retards, alertes en cours, éléments à facturer.

**Point mensuel de performance** — dans la continuité de la diffusion mensuelle existante : activité, marge, respect des engagements, **progression du parc et du portefeuille de contrats**, évolution N/N-1. PDF à la charte de la société, exploitable tel quel.

**Revue trimestrielle des contrats** — rentabilité par contrat, taux de consommation, contrats à renégocier, pipeline de propositions issues du recensement.

---

## 17. Contraintes spécifiques Nouvelle-Calédonie

Ces contraintes conditionnent la conception, elles ne sont pas des détails de mise en œuvre.

**Couverture réseau.** Le hors-ligne n'est pas une option de confort. Les mines du Grand Sud, la côte Est et une partie du Nord ne sont pas couvertes de manière fiable. Toute fonction terrain doit être utilisable sans réseau, y compris la création de machines en visite de recensement.

**Latence.** L'hébergement métropolitain ou asiatique impose plusieurs centaines de millisecondes de latence. D'où le rendu serveur, la mise en cache agressive et les interfaces optimistes — l'action est affichée comme réussie immédiatement, la confirmation serveur suit.

**Fuseau horaire.** UTC+11, sans changement d'heure. Dates stockées en UTC, affichées en heure locale de la société. Traitements planifiés réglés sur l'heure locale.

**Monnaie.** Franc Pacifique sans décimale, avec une architecture ouverte à l'euro et à d'autres devises pour un déploiement hors territoire. Conversion uniquement sur les agrégats de consolidation, à parité datée.

**Calendriers d'agences.** Ducos ouvre du lundi au samedi, Koné du lundi au vendredi. Les jours fériés du territoire peuvent être travaillés, agence par agence. Un calendrier unique appliqué à toutes les agences produit des chiffres faux. *(Vocabulaire corrigé par D5 puis D47 : Ducos, Koné et Dolbeau sont des agences CODIMA, pas des sites clients. La règle qui fait foi est RG-PLA-01.)*

**Délais d'approvisionnement.** Un acheminement maritime de l'ordre de quatre mois rend le statut « en attente de pièce » structurel. Le pilotage de cette file est une fonction à part entière.

**Accès aux sites miniers.** Induction sécurité, badges, EPI, autorisations préalables. Prérequis portés par la fiche site et contrôlés à l'affectation, avec blocage strict en cas d'habilitation expirée.

**Saison cyclonique.** De novembre à avril, des reports en masse peuvent être nécessaires. Fonction de report groupé avec notification client prévue.

**Effectif unique.** Avec un seul technicien, il n'existe aucune redondance : une absence, une panne de véhicule ou un arrêt est une rupture de service. Le système doit le rendre visible immédiatement et outiller le report, plutôt que de laisser découvrir le trou le jour même.

---

## 18. Plan de réalisation par lots

Le plan complet en six lots est conservé, avec des mises en service intermédiaires. Il intègre les évolutions de la v1.1 : socle multi-société, tarification, imports Excel et outillage de recensement.

### Lot 0 — Cadrage et socle multi-société (3 semaines)

Validation du cahier des charges, dépôt et environnements, socle technique, **modèle multi-société avec sécurité au niveau des lignes**, authentification et rôles par société, référentiel des devises, thématisation par société, bibliothèque de composants à la charte.

*Livrable : environnement de recette accessible, connexion fonctionnelle, deux sociétés de test cloisonnées.*

### Lot 1 — Référentiels, tarification et imports (4 semaines)

Clients, sites, contacts, techniciens, familles et modèles, prestations, **catalogue de forfaits et taux horaire**, compétences et habilitations. **Module M11 : imports Excel contrôlés** (clients, sites, machines, modèles, prestations) avec prévisualisation, rejets annotés et annulation. Import de l'historique des ventes matériel.

*Livrable : référentiels alimentés par import, tarification paramétrée. Le travail de constitution du parc peut commencer.*

### Lot 2 — Parc machines et interventions (4 semaines)

Fiche machine complète, QR codes, documents, compteurs, historique. Demandes, qualification avec mode de valorisation, cycle de vie des interventions, interventions multi-machines, file « en attente de pièce ».

*Livrable : parc et interventions gérables en back-office.*

### Lot 3 — Planning et PWA technicien (5 semaines)

Vue calendrier avec glisser-déposer, contrôles à la pose, file d'attente, absences, tournées, alerte de rupture de service. Application mobile : hors-ligne, synchronisation, scan QR, **création de machine express avec reconnaissance de plaque**, **recensement en série**, saisie de rapport, photos, signature, PDF, envoi automatique.

*Livrable : le technicien réalise une intervention et recense un parc de bout en bout depuis son téléphone, y compris sans réseau. C'est la mise en service opérationnelle.*

### Lot 4 — Contrats de maintenance (3 semaines)

Types de contrats, périmètre machines, **générateur de propositions pré-chiffrées**, échéanciers automatiques, génération des visites, SLA, alertes, suivi de rentabilité, renouvellement, avenants.

*Livrable : le portefeuille de contrats peut être constitué et le préventif se déclenche seul.*

### Lot 5 — Portail client et tableaux de bord (3 semaines)

Portail client complet à la charte de la société, notifications email, tableaux de bord par rôle, exports Excel, rapports périodiques automatiques, suivi de campagne de recensement.

*Livrable : le client est autonome, la direction dispose de ses indicateurs.*

### Lot 6 — Exports, flux BI et mise en production (3 semaines)

Exports « éléments à facturer » et pièces consommées, import des retours de facturation, export Parquet vers l'entrepôt, couche SMS prête à brancher, documentation, formation des utilisateurs, bascule.

*Livrable : production.*

**Durée totale du projet interne : 25 semaines**, soit environ 6 mois. Le **lot 7 — console éditeur et abonnements** (4 semaines, 30 j/h) s'y ajoute pour la commercialisation, et n'intervient qu'après la mise en production interne : voir §22.11. L'allongement de 4 semaines par rapport à la v1.0 correspond au socle multi-société, au module d'imports Excel et à l'outillage de recensement — trois ajouts issus de vos réponses.

### Jalons de mise en service

| Jalon | Fin de lot | Ce qui devient possible |
|---|---|---|
| J1 | Lot 1 | Importer les clients et l'historique des ventes matériel |
| J2 | Lot 2 | Créer et suivre le parc et les interventions en back-office |
| **J3** | **Lot 3** | **Mise en service terrain : planning, mobile, recensement, rapports signés** |
| J4 | Lot 4 | Vendre et piloter des contrats de maintenance |
| J5 | Lot 5 | Ouvrir le portail client et piloter par les indicateurs |
| J6 | Lot 6 | Boucler le cycle vers la facturation et la BI |

Le jalon J3 est celui qui compte : c'est à partir de là que le parc se construit. Tout ce qui le précède est de la préparation.

---

## 19. Charge, coûts et hypothèses

### 19.1 Charge de développement

| Lot | Charge estimée (j/h) | Écart v1.0 |
|---|---|---|
| Lot 0 — Socle multi-société | 15 | +5 |
| Lot 1 — Référentiels, tarification, imports | 22 | +7 |
| Lot 2 — Parc et interventions | 20 | = |
| Lot 3 — Planning et PWA | 25 | +5 |
| Lot 4 — Contrats et générateur de propositions | 17 | +2 |
| Lot 5 — Portail et dashboards | 15 | = |
| Lot 6 — Exports, BI, bascule | 12 | +2 |
| Recette, corrections, documentation | 17 | +2 |
| **Total projet interne** | **143 j/h** | **+23** |
| *Lot 7 — console éditeur (commercialisation)* | *30* | *nouveau* |
| ***Total avec volet éditeur*** | ***173 j/h*** | |

Les 23 jours supplémentaires se répartissent ainsi : environ 8 jours pour le socle multi-société et la tarification multi-devise, 10 jours pour le module d'imports et d'exports Excel rendu nécessaire par la fermeture de Winpro, 5 jours pour l'outillage de recensement et de proposition de contrat.

**Ce que la fermeture de Winpro coûte réellement.** Une dizaine de jours de développement, plus une charge récurrente d'exploitation d'environ deux heures par semaine pour l'ADV — export, import, contrôle, export retour. Sur un an, cela représente une centaine d'heures. C'est le prix de l'absence d'interface, et il est utile de l'avoir en tête si la question d'un changement d'ERP se posait un jour.

### 19.2 Coûts récurrents d'exploitation

| Poste | Ordre de grandeur mensuel |
|---|---|
| Hébergement application | 20 – 50 € |
| Base de données managée | 25 – 60 € |
| Stockage objet et bande passante | 10 – 30 € |
| Email transactionnel | 0 – 20 € |
| SMS (lorsqu'une passerelle sera retenue) | Au volume, ~15 – 25 XPF par message |
| Nom de domaine et certificat | Marginal |
| Licence composant calendrier | 0 – 500 € par an selon le choix |
| **Total hors SMS** | **60 – 170 € par mois** |

Le coût d'hébergement **ne varie pas avec le nombre de sociétés** : c'est l'avantage direct du cloisonnement logique sur une base unique. Une seconde société coûte le paramétrage, pas l'infrastructure.

À comparer avec une solution de GMAO du marché en mode abonné, facturée par utilisateur et par mois, dont le coût croît avec chaque technicien, chaque compte client et souvent chaque société.

### 19.3 Hypothèses

- Développement assuré en interne avec assistance, sans prestataire externe sur le développement.
- Les exports Winpro nécessaires (clients, articles, historique des ventes matériel) peuvent être produits manuellement au format Excel ou CSV.
- Le technicien dispose d'un smartphone Android ou iOS récent avec appareil photo correct.
- Le responsable matériel recruté prend la campagne de recensement à sa charge et en porte l'indicateur.
- La saisie initiale du parc est assurée par le terrain, pas par une prestation de ressaisie.

---

## 20. Risques et parades

| Risque | Probabilité | Impact | Parade |
|---|:---:|:---:|---|
| **Le parc machines ne se constitue pas** | Élevée | **Critique** | Double dispositif du §8 : création au fil des interventions rendue obligatoire, plus campagne de recensement cadrée comme visite commerciale ; création en moins de 60 secondes ; indicateur mensuel porté par le responsable matériel |
| **Le portefeuille de contrats reste vide** | Élevée | Élevé | Le générateur de propositions pré-chiffrées transforme chaque recensement en proposition ; objectif chiffré à M+9 ; suivi en revue trimestrielle |
| Rejet de l'outil par le technicien | Moyenne | **Critique** | Avec un seul technicien, son adhésion est une condition d'existence du projet. L'associer à la conception dès le lot 2, viser un rapport rempli en moins de 5 minutes, supprimer le papier en contrepartie et non en plus |
| Échanges Excel manuels mal tenus | Moyenne | Élevé | Contrôle avant application, rejets annotés, annulation possible, journal des chargements, formats figés et versionnés |
| Fuite de données entre sociétés | Faible | **Critique** | Triple barrière session / couche d'accès / sécurité au niveau des lignes ; test de recette dédié par accès croisé |
| Périmètre qui s'étend en cours de route | Élevée | Élevé | Lots fermés, V2 explicitement documentée, tout ajout arbitré contre une suppression |
| Absence ou départ du technicien unique | Moyenne | Élevé | Alerte de rupture de service, report groupé outillé ; le recrutement des deux techniciens supplémentaires réduit mécaniquement le risque |
| Dépendance à une personne clé côté développement | Moyenne | Élevé | Code documenté, dépôt partagé, documentation d'exploitation, aucun développement non versionné |
| Indisponibilité de la plateforme | Faible | Moyen | Mode hors-ligne assurant la continuité terrain, sauvegardes et restauration testées |
| Résistance des clients au portail | Moyenne | Faible | Le portail est un plus, pas un passage obligé ; l'email reste le canal principal |

Les deux premiers risques sont d'une autre nature que les suivants : ils ne portent pas sur la réussite technique du projet mais sur sa **raison d'être**. Un CODIPLAN techniquement irréprochable avec un parc vide et zéro contrat serait un échec complet.

---

## 21. Recette et critères d'acceptation

Recette organisée par lot, sur l'environnement dédié, avec des jeux de données représentatifs et **au moins deux sociétés de test**.

**Critères d'acceptation transverses**

- Aucune anomalie bloquante ou majeure ouverte à la livraison du lot.
- Temps d'affichage inférieur à 2 secondes sur les écrans principaux depuis Nouméa.
- Interface intégralement en français, à la charte de la société active.
- Contrôle des droits vérifié par tentative d'accès hors périmètre, pour chaque rôle et **pour chaque société**.

**Scénarios de recette prioritaires**

1. Créer une demande, la qualifier avec un forfait, la planifier, la réaliser sur mobile, valider le rapport, le retrouver sur le portail client.
2. Réaliser une intervention complète en mode avion, puis vérifier la synchronisation intégrale au retour du réseau, photos comprises.
3. **Créer 10 machines en série hors ligne lors d'une visite de recensement, générer la fiche de restitution, puis vérifier la synchronisation et l'absence de doublons.**
4. **Générer une proposition de contrat pré-chiffrée depuis un parc recensé, la signer, et vérifier la génération de l'échéancier sur toute la durée.**
5. **Importer un fichier clients comportant des lignes valides, des doublons et des erreurs ; vérifier le rapport de contrôle, corriger le fichier de rejets, le recharger, puis annuler l'import et vérifier le retour à l'état antérieur.**
6. **Vérifier qu'un utilisateur habilité sur la société A ne peut accéder à aucune donnée de la société B, y compris par manipulation directe des identifiants dans les URL et les appels d'API.**
7. **Vérifier qu'un montant en XPF s'affiche sans décimale et un montant en EUR avec deux, et qu'aucune conversion n'est appliquée ligne à ligne.**
8. Déplacer une machine d'un site à l'autre et vérifier l'intégrité de son historique.
9. Vérifier qu'un compte client ne peut accéder à aucune donnée d'un autre client.
10. Vérifier que le calendrier de l'agence de Koné n'ouvre pas le samedi et que celui de Ducos l'ouvre.
11. Vérifier qu'une absence du technicien unique déclenche l'alerte de rupture de service et propose le report groupé.
12. Exporter les éléments à facturer, réimporter le fichier complété des numéros de facture, vérifier le passage au statut FACTURÉE.
13. Générer un rapport PDF et contrôler sa conformité graphique à la charte de la société émettrice.

---

## 22. Commercialisation de la solution : le mode éditeur

Ce chapitre traite d'une décision qui change la nature du projet : **CODIPLAN doit être conçu pour être vendu à des clients tiers**, et pas seulement déployé sur les entités du groupe.

### 22.1 Ce que vendre change réellement

Le multi-société du chapitre 4 rend la plateforme *techniquement* capable d'héberger plusieurs entités. Cela ne suffit pas à en faire un produit vendable. Vendre ajoute six obligations qui n'existent pas pour un outil interne.

| Obligation | Pour un outil interne | Pour un produit vendu |
|---|---|---|
| **Disponibilité** | Une panne se gère entre collègues | Une panne est un manquement contractuel, avec un client qui appelle |
| **Support** | Le développeur est dans le couloir | Un canal, des horaires, des délais de réponse annoncés et tenus |
| **Données** | Vous êtes responsable de traitement de vos données | Vous devenez **sous-traitant** des données de vos clients, avec les obligations correspondantes |
| **Réversibilité** | Sans objet | Le client doit pouvoir récupérer l'intégralité de ses données et partir |
| **Évolutions** | On change quand on veut | Toute évolution s'applique à tous les clients en même temps ; on ne casse plus rien |
| **Responsabilité** | Interne | Contractuelle, avec un plafond à définir et une assurance à vérifier |

Aucune de ces obligations n'est insurmontable. Mais elles ne se rattrapent pas après coup : elles se préparent. C'est l'objet de ce chapitre.

**Un mot de franchise sur le marché.** Le logiciel de gestion d'interventions est un marché encombré : il existe des dizaines de solutions de GMAO et de *field service management*, dont plusieurs en français et à des tarifs accessibles. Vendre CODIPLAN ne réussira pas sur la promesse générique « gérer ses interventions ». L'avantage défendable est ailleurs, et il est réel : un outil conçu pour un territoire insulaire — hors-ligne par nécessité, délais d'approvisionnement longs, calendriers de sites divergents, multi-devise, accès aux sites miniers — et vendu par quelqu'un qui exerce le métier. Ce positionnement se défend en Nouvelle-Calédonie, en Polynésie, aux Antilles-Guyane, à La Réunion. Il se défend beaucoup moins face à un éditeur métropolitain établi sur son marché domestique.

### 22.2 Modèle d'exploitation retenu

**SaaS mutualisé**, une seule installation servant tous les comptes clients, avec le cloisonnement logique décrit au §12.2. L'ouverture d'un compte se fait en deux temps.

| Phase | Mode d'ouverture | Quand |
|---|---|---|
| **Phase 1 — Provisioning assisté** | Vous créez le compte depuis la console éditeur après signature : société, paramétrage, comptes utilisateurs, import initial | Dès le lot 7 |
| **Phase 2 — Libre-service** | Le prospect crée son compte seul, essaie 30 jours, paie en ligne, l'espace se provisionne automatiquement | Ultérieur, conditionné à une demande réelle |

**Pourquoi commencer par l'assisté.** Les premiers clients ne s'obtiennent pas par un formulaire d'inscription : ils s'obtiennent par une démonstration, une discussion et un accompagnement au démarrage. Construire un tunnel de souscription en ligne avant d'avoir vendu trois comptes, c'est bâtir la caisse enregistreuse avant le magasin. Le libre-service devient pertinent quand le volume rend l'accompagnement individuel impossible — pas avant.

### 22.3 Cycle de vie d'un compte client

```
  PROSPECT ──▶ ESSAI ──▶ ACTIF ──▶ SUSPENDU ──▶ RÉSILIÉ ──▶ PURGÉ
                 │         │  ▲         │           │          │
                 │         │  └─────────┘           │          │
                 ▼         ▼                        ▼          ▼
             ABANDONNÉ  AVENANT              Export intégral  Preuve de
                       (+/- techniciens)     des données      suppression
```

| Statut | Définition | Effets |
|---|---|---|
| **Prospect** | Compte créé pour démonstration, données fictives | Accès complet, bandeau « démonstration », purge automatique à 60 jours |
| **Essai** | Compte réel, période d'évaluation de 30 jours | Fonctionnalités complètes, plafond de 50 machines, relances automatiques à J-7 et J-1 |
| **Actif** | Abonnement en cours | Fonctionnalités selon la formule souscrite |
| **Suspendu** | Impayé ou demande du client | Accès en **lecture seule**, aucune perte de données, notification explicite |
| **Résilié** | Fin de contrat | Accès coupé, données conservées 90 jours, export intégral disponible |
| **Purgé** | Après le délai de conservation | Suppression définitive, attestation transmise au client |

Le passage de SUSPENDU à ACTIF est réversible sans perte. La suspension pour impayé ne détruit jamais de données : c'est une règle de conception, autant par correction commerciale que par prudence juridique.

### 22.4 Module M12 — Console éditeur

Espace d'administration réservé à l'éditeur, hors du périmètre de toute société cliente. Il n'est accessible qu'aux rôles éditeur (§22.5) et son accès est intégralement journalisé.

**Gestion des comptes** — liste des comptes clients avec statut, formule, effectif facturé, date de renouvellement ; création et provisioning d'un compte en quelques minutes ; paramétrage initial assisté ; suspension, réactivation, résiliation ; **connexion en tant que** sur demande du client, tracée et notifiée à l'administrateur du compte.

**Abonnements et facturation** — formules et grilles tarifaires, avenants (ajout ou retrait de techniciens en cours de contrat, avec prorata), échéancier de facturation, émission des factures d'abonnement, suivi des impayés et suspension automatique après relances.

**Indicateurs éditeur** — revenu récurrent mensuel, revenu par compte, effectif facturé total, taux d'attrition, comptes en essai et taux de conversion, comptes à risque (usage en baisse, connexions rares).

**Supervision technique** — état de santé par compte, volumétrie consommée (machines, interventions, stockage), erreurs applicatives par compte, files de synchronisation bloquées, dernière sauvegarde vérifiée.

**Support** — tickets rattachés au compte et à l'utilisateur, historique, délais de réponse mesurés contre les engagements, base de connaissances.

**Gestion des versions** — version déployée, notes de version diffusées aux clients, activation progressive des nouveautés par compte (pour ne pas imposer un changement d'écran à tout le monde le même jour).

### 22.5 Rôles éditeur

Trois rôles s'ajoutent à la matrice du §5.2, **au-dessus** des sociétés et non à l'intérieur. Ils ne se confondent pas avec `admin_societe`, qui est dedans (D37).

| Rôle | Périmètre |
|---|---|
| **Super-administrateur plateforme** | Tout **au niveau plateforme** : création et suppression de comptes clients, abonnements, référentiels de plateforme. Second facteur obligatoire. Réservé à une ou deux personnes. Depuis D37, il ne détient **aucune** ligne de la matrice §5.2 : celles-ci sont de portée société et reviennent à `admin_societe`. |
| **Administration commerciale éditeur** | Comptes, abonnements, facturation, indicateurs. Aucun accès aux données métier des clients. |
| **Support éditeur** | Consultation technique et « connexion en tant que » sur demande explicite du client, avec traçabilité et notification. Aucun accès permanent aux données. |

**Principe posé :** un salarié de l'éditeur n'a **aucun accès par défaut** aux données d'un client. L'accès est demandé, motivé, limité dans le temps, journalisé et notifié. C'est une exigence contractuelle chez la plupart des clients professionnels, et c'est aussi ce qui protège l'éditeur en cas de litige.

### 22.6 Modèle tarifaire

Structure recommandée : **un socle par société plus un montant par technicien**, complété de frais de mise en service.

| Composante | Montant indicatif | Justification |
|---|---|---|
| Socle mensuel par société | 12 000 XPF / 100 € | Couvre l'hébergement, les sauvegardes, le support de base |
| Par technicien et par mois | 6 000 XPF / 50 € | La valeur croît avec l'usage ; c'est la métrique que le client comprend |
| Comptes bureau (ADV, responsables) | Inclus | Ne pas facturer les utilisateurs qui font vivre la donnée |
| Comptes portail client | Inclus, illimités | Le portail est un argument de vente pour votre client — le facturer le tuerait |
| Mise en service | 150 000 XPF / 1 250 €, unique | Paramétrage, reprise des données, formation, accompagnement au démarrage |
| Société supplémentaire du même groupe | −30 % sur le socle | Le coût marginal est nul, autant en faire un argument |

*Montants indicatifs, à arbitrer.*

**Ce qu'il ne faut pas faire.** Facturer au nombre de machines suivies serait cohérent avec la valeur, mais découragerait exactement ce qu'il faut encourager : le recensement du parc. Un client qui hésite à référencer une machine parce qu'elle coûte 200 XPF de plus par mois n'utilisera jamais correctement l'outil, et l'outil ne lui apportera rien. La métrique de facturation doit être alignée avec le comportement souhaité.

**Formules.** Une seule formule complète est recommandée au départ. Les paliers (essentiel / avancé) supposent d'avoir des fonctionnalités à réserver, ce qui n'a de sens qu'avec un catalogue large et une base de clients suffisante pour segmenter. Trop tôt, ils compliquent la vente sans augmenter le revenu.

### 22.7 Économie du modèle

**Coût marginal par compte** — un compte supplémentaire ne consomme que du stockage et un peu de calcul, l'infrastructure étant mutualisée. Ordre de grandeur : 1 500 à 3 000 XPF par mois et par compte, incluant sauvegardes et stockage des photos.

**Simulation à 10 comptes**, sur une hypothèse moyenne de 2 techniciens par compte :

| Poste | Mensuel |
|---|---|
| Revenu — 10 socles + 20 techniciens | 240 000 XPF (~2 000 €) |
| Infrastructure mutualisée | 20 000 – 40 000 XPF |
| Coût marginal des comptes | 15 000 – 30 000 XPF |
| **Marge avant support** | **~180 000 XPF (~1 500 €)** |

**Le vrai coût n'est pas dans cette table : c'est le support.** Dix clients qui appellent, c'est plusieurs heures par semaine. Cette charge n'apparaît nulle part dans les coûts d'infrastructure et c'est pourtant elle qui détermine la rentabilité réelle et le nombre de comptes supportables. Deux conséquences pratiques : la documentation utilisateur et les messages d'erreur explicites ne sont pas du confort, ce sont des réducteurs de coût direct ; et il faut fixer un seuil au-delà duquel le support ne peut plus être assuré en plus d'un autre métier.

**Seuil de bascule.** En dessous de 5 comptes, l'activité éditeur ne se justifie pas économiquement — la charge de développement et de support excède le revenu. Entre 5 et 15 comptes, elle est un complément de revenu à charge maîtrisable. Au-delà, elle devient une activité à part entière, qui suppose une personne dédiée.

### 22.8 Cadre juridique et contractuel

Cinq documents sont nécessaires avant la première vente. Ils relèvent d'un conseil juridique — les éléments ci-dessous décrivent ce qu'ils doivent couvrir, ils ne s'y substituent pas.

| Document | Contenu essentiel |
|---|---|
| **Conditions générales de vente et d'utilisation** | Objet, durée, tarifs et révision, résiliation, préavis, responsabilité et son plafond, propriété intellectuelle, loi applicable et juridiction compétente |
| **Contrat de sous-traitance de données** | Vous traitez les données de vos clients pour leur compte : nature et finalité du traitement, catégories de données, mesures de sécurité, sous-traitants ultérieurs (hébergeur, email, SMS), localisation des données, obligations en cas de violation, sort des données en fin de contrat |
| **Engagement de service** | Disponibilité annoncée, plage de support, délais de première réponse par niveau de gravité, exclusions (maintenance planifiée, force majeure), modalités de compensation |
| **Procédure de réversibilité** | Export intégral et documenté des données du client, dans un format exploitable, à tout moment et sans frais — c'est une exigence quasi systématique des acheteurs professionnels et un argument de vente |
| **Politique de confidentialité** | Information des personnes dont les données figurent dans la plateforme |

**Points de vigilance.** La localisation des données doit être annoncée clairement — un client calédonien acceptera un hébergement métropolitain, mais il doit le savoir avant de signer. La propriété des données saisies par le client lui appartient sans ambiguïté ; celle du logiciel reste à l'éditeur. Le plafond de responsabilité doit être borné, généralement au montant annuel de l'abonnement. Enfin, si CODIPLAN est développé dans le cadre de l'emploi chez CODIMA NC, **la question de la titularité des droits doit être tranchée par écrit avec l'employeur avant toute commercialisation** : c'est le point qui, faute d'être traité tôt, bloque le projet le plus sûrement.

### 22.9 Support et exploitation

| Élément | Engagement proposé |
|---|---|
| Canal | Email et formulaire dans l'application ; téléphone réservé aux incidents bloquants |
| Plage | Jours ouvrés, heures de bureau, heure locale du client |
| Première réponse — bloquant | 4 heures ouvrées |
| Première réponse — majeur | 1 jour ouvré |
| Première réponse — mineur | 3 jours ouvrés |
| Maintenance planifiée | Annoncée 5 jours à l'avance, en dehors des heures ouvrées |
| Page de statut | Publique, indiquant l'état du service et les incidents en cours |
| Notes de version | Diffusées à chaque mise à jour significative |

**Documentation** — guide de démarrage, guide utilisateur par rôle, guide de l'application mobile, modèles d'import commentés, base de connaissances des questions fréquentes. C'est l'investissement qui réduit le plus directement la charge de support.

### 22.10 Exigences techniques supplémentaires

Vendre impose des travaux qui ne sont pas nécessaires en interne.

- **Sauvegarde et restauration par compte** — pouvoir restaurer un client sans toucher aux autres.
- **Export intégral d'un compte** — toutes ses données dans un format documenté, à la demande.
- **Purge sur demande** — suppression définitive avec attestation.
- **Quotas et plafonds** — par formule, avec alerte avant dépassement plutôt que blocage brutal.
- **Journalisation d'accès éditeur** — chaque consultation de données client par un salarié de l'éditeur est tracée et consultable par le client lui-même.
- **Montées de version sans interruption** — migrations compatibles, bascule progressive, retour arrière possible.
- **Environnement de démonstration** — un compte de démonstration réinitialisable, avec des données réalistes, indispensable au cycle de vente.
- **Métrologie d'usage** — savoir quels comptes utilisent quoi, pour détecter le risque d'attrition avant la résiliation.

### 22.11 Impact sur le plan de réalisation

**Lot 7 — Console éditeur et abonnements (4 semaines, 30 j/h)**

Comptes clients et cycle de vie, provisioning assisté, rôles éditeur et journalisation d'accès, formules et abonnements, facturation récurrente, suspension et réactivation, export intégral et purge, sauvegarde par compte, quotas, indicateurs éditeur, page de statut, environnement de démonstration réinitialisable.

*Livrable : un compte client peut être vendu, ouvert, facturé, suspendu et résilié.*

**Lot 8 — Libre-service (3 semaines, 20 j/h) — conditionnel**

Inscription en ligne, essai de 30 jours, paiement par carte, relances automatiques, provisioning automatique, tunnel de conversion. **À ne déclencher qu'après trois comptes vendus en assisté**, faute de quoi l'investissement précède la demande.

**Positionnement dans le calendrier.** Le lot 7 intervient **après** la mise en production interne, soit à partir de la semaine 26. La raison est simple : le meilleur argument de vente est une entité qui utilise l'outil quotidiennement et peut en témoigner. Vendre avant d'avoir soi-même éprouvé la solution expose à découvrir ses défauts chez un client payant.

| Phase | Lots | Durée | Charge |
|---|---|---|---|
| Projet interne | 0 à 6 | 25 semaines | 143 j/h |
| **Volet éditeur** | **7** | **+4 semaines** | **+30 j/h** |
| Libre-service (conditionnel) | 8 | +3 semaines | +20 j/h |
| **Total avec volet éditeur** | **0 à 7** | **29 semaines** | **173 j/h** |

### 22.12 Risques propres au mode éditeur

| Risque | Probabilité | Impact | Parade |
|---|:---:|:---:|---|
| **Titularité des droits non tranchée avec l'employeur** | Moyenne | **Critique** | Clarifier par écrit avant tout développement du volet éditeur — c'est le préalable absolu |
| Charge de support sous-estimée | Élevée | Élevé | Documentation soignée, messages d'erreur explicites, seuil de comptes assumé, mesure du temps passé dès le premier client |
| Fuite de données entre comptes clients | Faible | **Critique** | Triple barrière du §12.2, tests d'accès croisé à chaque livraison, journalisation des accès éditeur |
| Engagement de disponibilité intenable | Moyenne | Élevé | Annoncer un engagement atteignable — 99,5 % en heures ouvrées, pas 99,9 % en continu |
| Un client demande une fonctionnalité spécifique | Élevée | Moyen | Règle posée dès le départ : le produit est commun à tous ; les spécificités passent par le paramétrage ou sont refusées. Un premier accord de développement sur mesure fait basculer dans un autre métier |
| Dispersion par rapport au métier principal | Moyenne | Élevé | Le volet éditeur ne démarre qu'après la mise en production interne, et le seuil de bascule du §22.7 est un garde-fou explicite |
| Concurrence établie | Élevée | Moyen | Positionnement territorial assumé, pas de concurrence frontale sur le marché métropolitain |

---

## 23. Annexes

### A. Glossaire

| Terme | Définition |
|---|---|
| **Société** | Entité juridique exploitant la plateforme ; racine du cloisonnement des données |
| **Demande** | Expression d'un besoin, avant qualification |
| **Intervention** | Ordre de travail planifié et affecté |
| **Échéance** | Visite préventive attendue au titre d'un contrat |
| **Recensement** | Visite dédiée à l'inventaire et à l'étiquetage du parc d'un client |
| **Préventif** | Maintenance programmée visant à éviter la panne |
| **Curatif** | Intervention consécutive à une panne |
| **Parc machines** | Ensemble des équipements suivis chez un client |
| **Forfait** | Montant fixe couvrant une prestation définie, alternatif ou complémentaire au temps passé |
| **SLA** | Engagement de délai de service |
| **First-time fix** | Résolution du problème dès la première visite |
| **PWA** | Application web progressive, installable et fonctionnant hors-ligne |
| **RLS** | Sécurité au niveau des lignes, appliquée dans la base de données |
| **GMAO** | Gestion de maintenance assistée par ordinateur |

### B. Nomenclature des identifiants

Compteurs propres à chaque société, préfixés par son code.

| Objet | Format | Exemple |
|---|---|---|
| Demande | DEM-AAAA-NNNNN | DEM-2026-00147 |
| Intervention | INT-AAAA-NNNNN | INT-2026-00312 |
| Contrat | CTR-AAAA-NNN | CTR-2026-014 |
| Proposition de contrat | PRO-AAAA-NNN | PRO-2026-007 |
| Machine | MAC-NNNNNN | MAC-001248 |
| Rapport | RAP-AAAA-NNNNN | RAP-2026-00312 |
| Lot d'import | IMP-AAAAMMJJ-NN | IMP-20260818-03 |

### C. Charte graphique par défaut — CODIMA NC

| Élément | Valeur |
|---|---|
| Rouge Autodistribution | `#E30613` |
| Bleu Autodistribution | `#0053A1` |
| Noir | `#111111` |
| Gris de fond | `#F4F5F7` |
| Blanc | `#FFFFFF` |
| Vert (validé, conforme) | `#0F9D58` |
| Orange (vigilance) | `#F0A202` |

Pas d'orange en couleur d'identité — l'orange est réservé aux états de vigilance de l'interface. Chaque société porte sa propre charte : logo, couleur primaire, couleur secondaire et mentions légales sont des paramètres, pas des constantes du code.

### D. Codes couleur des statuts d'intervention

| Statut | Couleur | Usage planning |
|---|---|---|
| À planifier | Gris | File d'attente |
| Planifiée | Bleu | Bloc calendrier |
| Envoyée | Bleu foncé | Bloc calendrier |
| En cours | Rouge | Bloc calendrier |
| Suspendue | Orange hachuré | Hors planning actif |
| Terminée | Vert clair | Bloc calendrier |
| Clôturée | Vert | Bloc calendrier |
| Annulée | Gris barré | Masqué par défaut |

### E. Arbitrages actés au 18 août 2026

| Sujet | Décision |
|---|---|
| Intégration Winpro | Impossible — échanges Excel manuels contrôlés (§14) |
| Effectif technicien | 1 aujourd'hui, 3 à terme |
| Contrats en portefeuille | 0 — le module devient un outil de conquête (§7/M6) |
| Inventaire du parc | Inexistant — amorçage traité au §8 |
| Utilisateurs internes | Responsable matériel (pilote), responsable SAV, ADV |
| Périmètre | Multi-société dès la conception, extensible à d'autres territoires, groupe ou hors groupe (§4) |
| Devises | XPF et EUR en V1, table ouverte |
| Taux horaire | 7 000 XPF par défaut pour CODIMA SAV, surchargeable et historisé |
| Forfaits | Catalogue de forfaits par société (§4.3) |
| Passerelle SMS | Aucune — couche abstraite, opérateur enfichable |
| Imports en masse | Module M11, format Excel, contrôlés et réversibles |
| Séquencement | Plan complet conservé, six lots, 25 semaines |
| Amorçage du parc | Double dispositif : au fil des interventions **et** campagne de recensement |
| **Commercialisation** | **La solution sera vendue à des clients tiers. Mode SaaS mutualisé, provisioning assisté d'abord, libre-service ultérieur et conditionnel. Lot 7, après la mise en production interne (chapitre 22)** |

### F. Points restant à trancher

1. Quel opérateur de passerelle SMS retenir, et à quel volume mensuel estimé ?
2. Quels forfaits exactement mettre au catalogue à l'ouverture — déplacement par zone, mise en service, contrôle réglementaire — et à quels montants ?
3. Quelle liste de clients cibles pour la première vague de recensement, et à quel rythme de visites ?
4. Quels types de contrats proposer en premier, et à quelle grille tarifaire indicative ?
5. Winpro peut-il produire l'export de l'historique des ventes matériel, et sur quelle profondeur d'années ?
6. Quelle imprimante d'étiquettes retenir pour les QR codes — portable pour le terrain, ou bureau pour une impression par lot ?
7. Quelle est la seconde société envisagée à moyen terme, afin de vérifier dès la recette que le paramétrage suffit ?

**Volet éditeur (chapitre 22)**

8. **La titularité des droits sur CODIPLAN est-elle tranchée par écrit avec CODIMA NC ?** C'est le préalable absolu à toute commercialisation.
9. Quelle structure juridique portera l'activité d'édition, et sous quel régime ?
10. Quels sont les trois premiers prospects identifiés, et sur quel territoire ?
11. La grille tarifaire du §22.6 est-elle retenue, et à quels montants définitifs ?
12. Quel plafond de responsabilité contractuelle, et l'assurance professionnelle le couvre-t-elle ?
13. Quel volume de support est acceptable en parallèle de l'activité principale, et à quel seuil de comptes s'arrête-t-on ?

---

*Document de conception CODIPLAN v1.2 — CODIMA NC, Direction d'Exploitation — 18 août 2026*
