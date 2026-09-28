# MO — Modules et pages de CODIPLAN : ajouter, retirer, fusionner

*Partie « code » de l'audit du 28/09/2026. Dépôt `/home/claude/codiplan` au commit `bcc637e` (main publié = production), lu en lecture seule : aucun fichier modifié, aucun serveur, aucune base, aucun accès à la production. Aucune donnée de production ici : ni client, ni technicien, ni courriel, ni numéro réel — seulement des états et, rarement, des décomptes déjà écrits dans le dépôt.*

---

## En bref

1. **La V1 du cahier des charges est livrée côté bureau** (référentiels, parc, interventions, planning, absences, VGP, imports), mais **les trois boucles qui rapportent de l'argent restent ouvertes** : la file « à facturer » (P7) n'existe pas, les réserves des organismes VGP sont écrites en base et jamais montrées, les « suites à donner » du technicien n'alimentent aucune file.
2. **Une chaîne bloque tout le reste** : un technicien créé dans Équipe n'a pas d'accès (lien de premier accès par script seulement) → pas de compteur sur `/terrain` → pas de clôture (D120) → rien à facturer. Priorité 1 : donner l'accès depuis Équipe (MO-1), puis la file « À facturer » (MO-2, FACTURE-1).
3. **Couches écrites sans écran** (preuves au §2) : statut de facturation et montant figé à la clôture ; réserves VGP (`planifierLObservation`, `observationsEnAttente` sans appelant) ; campagnes VGP ; exception VGP d'une machine ; régime VGP d'une famille (import seulement) ; périodicité d'entretien des modèles ; adresse, GPS et horaires d'accès des sites (ni écran, ni import) ; fériés travaillés et ponts ; journal d'audit ; six capacités de la matrice sans consommateur.
4. **Le QR imprimé encode un jeton nu et aucun écran ne l'ouvre** : la moitié « scan téléphone vers la fiche » de la décision 8 manque. À trancher avant d'imprimer les étiquettes en nombre (MO-4).
5. **Pages sans usage réel aujourd'hui** : `/demandes` (aucune source ne crée de demande), « App technicien » pour un compte bureau (renvoi vers `/planning`), `/parametres/societe` (diagnostic), `/vgp/a-determiner` (vide et sans geste), bloc « Documents » de la fiche machine, import « Contacts » (contrôle seul, motif périmé), tuile « Demandes à valider — Sans objet ». Quatre d'entre elles relèvent d'une décision d'Alexis (D133, D132, N-02, choix du 25/09) : ce sont des questions, pas des retraits.
6. **Ajouts proposés** — P1 : accès des techniciens, « À facturer » (onglet du registre), « Réserves VGP » (avec un cycle de vie minimal de la réserve), scan QR. P2 : suites à donner → Demandes, indicateurs du mois, données à compléter, gestes sur une machine, exports Excel, import des contacts, adresse du site, VGP par client.
7. **Fusions proposées** : familles à déterminer → registre VGP (avec le geste « Décider le régime ») ; horaires d'ouverture + établissements → « Agences » (avec fériés travaillés et ponts) ; taux horaire + forfaits → « Tarifs » ; portes Clients et Sites retirées du hub Paramètres. Absences reste une page (D121), avec un point d'entrée depuis le planning.
8. **Écartées ou gardées en attente, avec preuve** : astreinte (R3-14), compétences, tournées (un filtre « Zone » suffit pour l'instant), entretien préventif hors contrat, campagne de recensement, et tout ce qui est différé par décision (Contrats, portail, console, plusieurs agences, bon multi-machines).
9. **Angle mort outillé** : le gardien des chemins (`pnpm chemins`) ne regarde que `lib/*/depot*.ts` ; les six fonctions VGP sans appelant lui échappent.

---

## 0. Méthode et limites

- **Sources lues** : `docs/cahier-des-charges.md` (§2, §3, §7, §8, §9, §10, §16) ; `docs/arbitrages.md` (D8, D37, D65, D88, D114, D115, D119-D121, D125, D128-D134) ; `docs/propositions/planning-gmao/decisions-2026-09-27.md` ; `docs/backlog.md` (lots 4 à 9, R6-01 à R6-04, L2-08b) ; `docs/audit-ergonomie-2026-09-26.md` et `-27.md` ; les deux maquettes ; et, dans le projet (hors dépôt), les décisions d'Alexis du 23/09 (`claude/decisions-alexis-23-09.md`, décisions 4, 7, 8, 9, 11, 12), du 26/09 et du 27/09, la feuille de route SAV du 23/09 (`claude/feuille-route-sav-triage-23-09.md`), l'arbitrage du 16/09 (`claude/arbitrage-audit-16-09-2026.md`) et la file des travaux du 28/09.
- **`pnpm chemins`** : ne démarre pas tel quel dans ce bac (pas de `node_modules` ; sous le `tsx` global, `scripts/chemins-de-depot.mts` échoue sur « does not provide an export named FONCTIONS_SANS_CHEMIN », interopérabilité ESM/CJS). La même analyse statique (`scripts/lib/chemins-de-depot.ts`, qui ne fait que lire des fichiers) a été rejouée par un lanceur placé dans le scratchpad, sans base ; `git status` vide avant et après. Résultat : 172 fonctions de dépôt, 152 atteintes depuis `app/`, 20 sans chemin, toutes avec un motif écrit ; deux modules sans chemin, `lib/compteurs` et `lib/reporting`, tous deux déclarés.
- **Niveaux de preuve** : « vu en ligne » = notes du passage du 28/09 (compte bureau) ; « DÉDUIT » = lu dans le code, non rejoué ; « À VÉRIFIER » = incertain, avec la raison.
- **Légende d'état** : LIVRÉ · PARTIEL (ce qui manque est dit) · ABSENT · DIFFÉRÉ PAR DÉCISION (référence) · EN FILE (lot nommé) · BLOQUÉ (motif).

---

## 1. Matrice de couverture du cahier des charges

### 1.1 Modules M1 à M12 (§7) — c'est aussi le périmètre V1 (§3.1)

| Réf | Exigence du CDC | Pages / routes | lib · tables | État | Ce qui manque · décision · preuve |
|---|---|---|---|---|---|
| M1a Sociétés | identité, territoire, devise, majoration, numérotation (§4.2) | `/parametres/societe` (lecture seule) | `societe` ; script `pnpm db:societe-initiale` | PARTIEL | aucun écran ne modifie une société (aucun `societe.update` dans `app/` ni `lib/`, git grep) ; réglage prévu avec la console (lot 7, D132) |
| M1b Clients | fiche autonome, import Winpro | `/clients`, `/clients/[id]`, `/clients/nouveau` ; `api/clients/*` | `lib/clients` ; `client` | LIVRÉ | — |
| M1c Sites | adresse, GPS, horaires d'accès, consignes, trajet | `/sites`, `/sites/[id]`, `/sites/nouveau` ; `api/sites/*` | `lib/sites` ; `site` | PARTIEL | adresse, GPS et horaires : colonnes présentes (`prisma/schema.prisma:720`, `:742-744`, `:765`) mais ni formulaire ni route ne les envoie, et l'import les écarte (`lib/imports/modeles.ts:425-435`, « aucune forme n'est fixée ») → MO-11 |
| M1d Contacts | rôles, préférence de notification | fiches client et site ; `api/contacts/*` | `lib/contacts` ; `contact` | PARTIEL | import en « contrôle seulement » sur un motif périmé → MO-10 |
| M1e Techniciens | agence, habilitations, calendrier, coût, véhicule | `/parametres/equipe` ; `api/techniciens/*` | `lib/techniciens` ; `technicien` | PARTIEL | « créer un technicien crée son identité, pas son accès » (`app/(back-office)/parametres/equipe/page.tsx:59-60`) → MO-1 ; horaires propres (`technicien_calendrier`) jamais écrits → MO-30 ; coût interne = arbitrage (L4-09) |
| M1f Familles et modèles | périodicité d'entretien, gamme, pièces d'usure | `/parametres/materiel` ; `api/parametres/materiel/*` | `lib/materiel` ; `famille_materiel`, `modele_materiel` | PARTIEL | régime VGP d'une famille : import seulement (`app/api/parametres/materiel/saisie-recue.ts:27`) → MO-29 ; périodicité d'entretien saisie, lue nulle part (`prisma/schema.prisma:2618-2619`) → MO-14 ; gamme opératoire et pièces d'usure : ABSENT |
| M1g Prestations, forfaits, taux | catalogue, forfaits (§4.3), taux historisé | `/parametres/prestations`, `/forfaits`, `/forfaits/[id]`, `/taux-horaire` | `lib/prestations`, `lib/tarification` | LIVRÉ | checklist type « arrivera plus tard » (RAPPORT-2, à arbitrer) |
| M1h Compétences | proposer les techniciens compétents | — | aucune table | ABSENT | habilitations seules (`/parametres/habilitations`, deux listes : A-02 en file) → MO-21 |
| M2a Fiche machine | statut, localisation, criticité, garantie | `/parc`, `/parc/[id]`, `/parc/nouvelle`, `/parc/[id]/modifier` ; `api/machines/*` | `lib/machines` ; `machine` | PARTIEL | statut, site, modèle et client ne se modifient plus après la création (`lib/machines/depot.ts:1032-1044`) alors que l'écran de correction y renvoie (`lib/i18n/fr.ts:2423-2424`) → MO-8 |
| M2b Identification QR | étiquette, scan → fiche | étiquette sur `/parc/[id]` ; `GET api/machines/qr/[jeton]` | `lib/machines/qr.ts`, `resolution.ts` | PARTIEL | le QR porte le jeton nu (`app/(back-office)/parc/[id]/page.tsx:463`) ; la route rend du JSON « lu par une machine » (`app/api/machines/qr/[jeton]/route.ts:27-28`) ; aucun écran de lecture (écart N-11, `lib/machines/ecarts-maquette.ts:53-61`) ; planches de jetons sans appelant (`lib/machines/qr.ts:121`) → MO-4 |
| M2c Compteurs | relevé à chaque passage | — | règle pure `lib/compteurs/regression.ts`, aucune table | ABSENT | module déclaré sans chemin (`scripts/lib/chemins-de-depot.ts:297`) ; attend le terrain |
| M2d Documents | notices, certificats, PV, photos | liste sur `/parc/[id]` ; `GET api/documents/[id]/octets` | `lib/documents` ; `document`, `document_recu` | PARTIEL | aucun ajout de document machine possible (bac `recevoir`/`classer` sans écran, `lib/documents/depot.ts:93`, `:190`) ; pas de lien de téléchargement (`app/(back-office)/parc/[id]/page.tsx:443`) ; stockage sur disque local (`lib/documents/stockage.ts:36`) → À VÉRIFIER chez l'hébergeur ; → MO-26 |
| M2e Historique | chronologie unifiée | `/parc/[id]` | `lib/machines/historique.ts` | PARTIEL | les interventions oui ; ni changements de statut ou de lieu (aucun geste), ni vérifications VGP reçues (`verificationsDeLaMachine` sans appelant, `lib/vgp/verification.ts:243`) → MO-3 |
| M2f Pièces d'usure | consommables du modèle | — | — | ABSENT | — |
| M3a Demande | appel, portail, courriel, échéance, compteur, détection technicien | `/demandes`, `/demandes/[id]` ; `api/demandes/*` | `lib/demandes` ; `demande` | PARTIEL | file sans source : `deposerDemande` n'a aucun appelant (exemption `scripts/lib/chemins-de-depot.ts:358-362`) ; au bureau, un appel devient directement une intervention (PARCOURS-1) → MO-5 |
| M3b Qualification et cycle de vie | nature, durée, priorité, valorisation, statuts | `/interventions/nouvelle`, `/interventions/[id]` ; `api/interventions/*` | `lib/interventions` ; `intervention` | PARTIEL | « Affectée » inatteignable (EN FILE PG-G14) ; RG-INT-03/04 (rapport validé, signature) non contrôlées à la clôture : seul le temps mesuré l'est (`lib/interventions/cycle-de-vie.ts:81-95`) — RAPPORT-1 |
| M3c Urgences et engagements | délais cibles P1 à P4 | — | — | DIFFÉRÉ PAR DÉCISION | QG-11 du 27/09 : ancienneté seule jusqu'aux contrats |
| M3d Multi-machines | une visite, plusieurs machines | une machine par intervention | `intervention_machine` | DIFFÉRÉ PAR DÉCISION | décision 4 (23/09) |
| M3e Multi-techniciens | pose de pont à deux | — | `technicien_id` unique | BLOQUÉ | L2-08b attend deux réponses (`docs/backlog.md:668-676`) → MO-19 |
| M3f Checklists, pièces | checklist, pièces remplacées | — | `prestation.checklist_type` (texte) | ABSENT | RAPPORT-2 (à arbitrer) ; pièces : terrain puis V2 |
| M3g Temps | temps réel décomposé | compteur sur `/terrain/[id]` ; clôture sur `/interventions/[id]` | `segment_travail` | LIVRÉ | D119/D120 : sans compteur, pas de clôture (`docs/arbitrages.md:4237`) |
| M4a Planning, pose, file | vues, glisser-déposer, contrôles, file | `/planning` ; `api/interventions/[id]/{deplacer,affecter}` | `lib/interventions` (grille, journée, pose, occupation) | PARTIEL | EN FILE : PG-G4 à PG-G17 (audit du 27/09) |
| M4b Tournées | regroupement, ordre, trajets | — | trajet aller/retour seulement (D107) | DIFFÉRÉ PAR DÉCISION | P3 (file des travaux §4) → MO-18 |
| M4c Absences | bloquer, alerter, report groupé | `/absences` ; `api/absences/*` | `lib/absences` ; `absence` | LIVRÉ | « Absence » partout et demi-journée : EN FILE (PG-G15) |
| M4d Astreinte | planning de garde | — | — | ABSENT | → MO-20 (écartée) |
| M4e Fériés travaillés, ponts (RG-PLA-02) | par agence | — | `calendrier_ferie` lu par `lib/calendar`, jamais écrit | ABSENT (écran) | → MO-30 |
| M5a Saisie terrain | diagnostic, travaux, photos, signature | `/terrain/[id]` ; `api/terrain/[id]/*` | `depot-rapport-terrain.ts` ; `intervention_signature`, `document` | PARTIEL | en ligne seulement (hors-ligne mis de côté le 19/09) ; photos sur disque local → À VÉRIFIER |
| M5b PDF à la charte, envoi | PDF, envoi au contact, dépôt portail | `/interventions/[id]/bon` (HTML imprimable) | `lib/interventions/bon.ts` | PARTIEL | ni `lib/pdf` ni dépendance PDF (`package.json`) ; aucun envoi : `lib/courriel` ne sert que la planification et le premier accès — RAPPORT-1 |
| M5c Validation | contrôle par un responsable | clôture avec temps validé | capacité `valider_rapport` sans consommateur (`lib/auth/habilitations.ts:119`) | PARTIEL | RAPPORT-1 |
| M5d Préconisations → demande | « génèrent automatiquement une demande à qualifier » | `suite_a_donner` sur la fiche et le bon | `intervention.suite_a_donner` (`prisma/schema.prisma:1767`) | ABSENT (file) | → MO-5 |
| M6 Contrats | types, échéancier, propositions, rentabilité | — (entrée masquée) | aucune table ; case `site.sous_contrat` | DIFFÉRÉ PAR DÉCISION | décision 9 (23/09) ; D132 ; tickets L4-01 à L4-11 écrits |
| M7 App technicien | PWA hors ligne | `/terrain`, `/terrain/[id]` | `perimetre-technicien.ts` | PARTIEL | en ligne seulement ; accès par script (MO-1) ; lot « terrain » en file |
| M8 Portail client | parc, historique, demandes | `/portail` (parc, lecture) ; entrée masquée (D132) | `lib/portail` | DIFFÉRÉ PAR DÉCISION | portail hors V1 ; aucun écran ne crée de compte portail |
| M9 Tableaux de bord | par rôle, exports, alertes | `/tableau-de-bord` (commun au bureau) | lectures de `lib/interventions`, `lib/vgp`, `lib/demandes` | PARTIEL | un seul tableau, orienté « jour » ; taux consolidé « Non calculé » (R2-13, §8) ; exports ABSENT → MO-6, MO-9 |
| M10 Administration | sociétés, utilisateurs, rôles, textes, journal | 11 portes sous `/parametres` | `lib/auth`, `lib/navigation` | PARTIEL | comptes bureau par script (`lib/auth/amorcage.ts:278`) → MO-15 ; journal d'audit sans écran (`consulter_journal_audit`, `lib/auth/habilitations.ts:167`) → MO-17 ; modèles de documents et de notifications : ABSENT |
| M11a Imports | contrôle, rejets, annulation, journal | `/imports`, `/imports/[id]` ; `api/imports/*` | `lib/imports`, `lib/excel` ; `import_lot`, `import_lot_ligne` | PARTIEL | 9 types appliqués sur 10 (contacts : contrôle seul) ; modèle à télécharger : DÉJÀ COUVERT (audit 26/09 B2, IMPORT-3) ; import en modification : IMPORT-3 ; retour de facturation remplacé par un marquage manuel (décision 7, FACTURE-1) |
| M11b Exports normalisés | à facturer, parc, interventions, contrats, temps, indicateurs | — | `lib/excel/ecriture.ts` n'écrit que le fichier des rejets | ABSENT | → MO-2, MO-9 |
| M12 Console éditeur | comptes, abonnements, supervision | — (entrée masquée) | `lib/reporting` sans appelant par décision (D38) | DIFFÉRÉ PAR DÉCISION | lot 7 ; D132 |

### 1.2 Parcours P1 à P7 (§9)

| Parcours | Ce qui passe aujourd'hui | Ce qui manque | État |
|---|---|---|---|
| P1 Dépannage urgent | création (PARCOURS-1), priorité, courriel au client à la planification (si un interlocuteur « donneur d'ordre » a un courriel, `lib/avertissements/planification.ts:18-21`), courriel et badge au technicien, compteur, photos, signature, suite à donner | « machine à l'arrêt » (EN FILE PG-G17) ; poser par glisser (EN FILE PG-B) ; scan QR (MO-4) ; relevé de compteur (ABSENT) ; validation, PDF, envoi (RAPPORT-1) ; « la préconisation apparaît dans la file des opportunités » (MO-5) | PARTIEL |
| P2 Recensement et proposition de contrat | nature « recensement », création de machine au bureau, import d'équipements | saisie en série (terrain) ; étiquettes par lot ; fiche de restitution (RG-INT-11) ; suivi de campagne (AM-10) ; proposition pré-chiffrée (décision 9) | ABSENT / DIFFÉRÉ |
| P3 Visite préventive contractuelle | nature « préventif » | échéancier (décision 9), tournée (P3), rappels au client, checklist (RAPPORT-2) | DIFFÉRÉ PAR DÉCISION |
| P4 Hors couverture réseau | — | hors-ligne mis de côté le 19/09 ; I4 reste entier | DIFFÉRÉ PAR DÉCISION |
| P5 Demande depuis le portail | la file `/demandes` existe | dépôt par le client (portail hors V1) | DIFFÉRÉ PAR DÉCISION |
| P6 Référentiel client depuis Winpro | dépôt, contrôle, rejets annotés téléchargeables, application, annulation | modèle à télécharger, import en modification (IMPORT-3) | PARTIEL (EN FILE) |
| P7 Éléments à facturer | montant figé à la clôture (`lib/interventions/depot.ts:1309-1356`) ; statut « à facturer » posé par la base | file, export, « facturée » avec n° et date (FACTURE-1) ; aucune clôture sans compteur (D120) | ABSENT (EN FILE) |

### 1.3 Indicateurs de pilotage (§2.2), alertes et rapports (§16)

| Indicateur | Où on le lit | État | Motif |
|---|---|---|---|
| Machines référencées, cumul | total de `/parc` | LIVRÉ | — |
| Machines référencées, rythme mensuel | — | ABSENT | → MO-6 |
| Couverture des clients actifs | `/clients` compte « avec équipement » | PARTIEL | pas de taux |
| Contrats signés, valeur annualisée ; machines sans contrat | — | DIFFÉRÉ PAR DÉCISION | décision 9 |
| Interventions par statut | onglets du registre `/interventions` | LIVRÉ | — |
| Interventions par période et par nature ; répartition préventif / curatif / installation / garantie | — | ABSENT | → MO-6 |
| Taux d'occupation | par technicien sur `/planning` ; consolidé « Non calculé » sur le tableau de bord | PARTIEL | règle d'agrégation absente (R2-13 BLOQUÉ, `app/(back-office)/tableau-de-bord/page.tsx:142-149`) : §8 |
| Délai de prise en charge | accusé de réception des demandes | PARTIEL | couche en place, file sans source |
| Délai d'intervention par urgence ; respect des échéances | — | DIFFÉRÉ PAR DÉCISION | QG-11 ; décision 9 |
| Résolution en une visite | — | ABSENT | — |
| Retours sous 30 jours (RG-INT-10) | — | ABSENT | la colonne `retour` n'existe pas (`docs/backlog.md:648`) : règle de gestion de rang 2 non appliquée |
| CA par intervention | montant figé à la clôture, fiche intervention | PARTIEL | rien par client, par famille, par période |
| Marges, dont hors main-d'œuvre | — | BLOQUÉ | coût interne = arbitrage (L4-09, `docs/backlog.md:1944-1948`) |
| Heures facturées / heures travaillées | — | ABSENT | données présentes (`temps_mesure_min`, `temps_valide_min`) |
| Âge du parc, fin de vie | — | ABSENT | dates de vente et de mise en service peu renseignées (vu en ligne) |
| Alertes §16.1 | rupture de service à la déclaration d'absence (D106) ; pièces attendues sur le tableau de bord | PARTIEL | aucun mécanisme d'alerte métier (`docs/backlog.md:1863`) ; les délais du §16.1 sont narratifs (rang 5) : valeurs à fixer par Alexis (CLAUDE.md §8) |
| Rapports périodiques §16.2 | — | ABSENT | — |

### 1.4 Amorçage du parc (§8)

| Dispositif | État | Preuve |
|---|---|---|
| §8.1 Création au fil des interventions | PARTIEL | au bureau, la fiche ne rattache qu'une machine existante du site (`app/(back-office)/interventions/[id]/page.tsx:701-749`) et dit sinon « Aucune machine n'est déclarée pour ce lieu » (`lib/i18n/fr.ts:1208-1209`), sans lien « créer la machine puis la rattacher » ; au terrain : différé |
| §8.2 Nature « recensement » | LIVRÉ | `lib/interventions/saisie.ts:68` |
| §8.2 Saisie en série sur mobile | DIFFÉRÉ | terrain hors ligne mis de côté |
| §8.2 Étiquettes par lot | ABSENT | `engendrerPlancheDeJetons` sans appelant (`lib/machines/qr.ts:121`) |
| §8.2 Fiche de restitution client | ABSENT | RG-INT-11 |
| §8.2 Proposition pré-chiffrée | DIFFÉRÉ PAR DÉCISION | décision 9 ; L4-06 |
| §8.2 Suivi de campagne | ABSENT | AM-10, « produit vendable » (arbitrage du 16/09, projet) → MO-22 |
| §8.3 Import de l'historique des ventes / des équipements | LIVRÉ | gabarit « équipements » (R6-03) |
| §8.3-8.4 Suivi mensuel « machines référencées » | ABSENT | → MO-6 |

### 1.5 Version 2 (§3.2)

| Élément V2 | État |
|---|---|
| Devis et chiffrage ; pièces valorisées ; préparation de facturation détaillée | ABSENT (V2) ; la file « à facturer » minimale est en V1 (FACTURE-1) |
| Prêts et parc de remplacement | EN FILE — avancé par Alexis le 23/09 : conception 70-PRET-A faite, PRET-B/C/D à venir (PRET-B attend l'inventaire, P9) |
| Géolocalisation temps réel, optimisation de tournées | ABSENT (V2) ; tournées simples : P3 |
| Immobilisations, matériel loué ; application native | ABSENT (V2) |

---

## 2. Ce qui existe en base ou dans `lib/` sans écran qui l'atteigne

| # | Ce qui existe | Preuve | Qui l'écrit · qui le lit à l'écran | Effet pour l'exploitation | Suite |
|---|---|---|---|---|---|
| 1 | Statut de facturation et montant HT figé à la clôture | `prisma/schema.prisma:1683`, `:1724` ; `lib/interventions/depot.ts:1309-1356` | écrit par le déclencheur à la clôture et par la reprise d'historique ; **lu par aucun écran** (git grep : seule occurrence hors reprise, un nom de migration, `lib/db/migrations-attendues.ts:110`) ; `facturee` inatteignable | l'argent clôturé dans CODIPLAN n'a pas de chemin vers Winpro (P7) | MO-2 (EN FILE FACTURE-1) |
| 2 | Réserves des organismes VGP (`vgp_observation`) | `prisma/schema.prisma:2320-2341` ; `lib/vgp/observations.ts:58`, `:124` | écrites par `/vgp/enregistrer/[id]` (`lib/vgp/verification.ts:150-170`) et par l'import ; **jamais affichées** ; `planifierLObservation` et `observationsEnAttente` sans appelant (constaté aussi dans `docs/propositions/vgp-import/README.md:36-38`) | le « travail qui rapporte » de D88 §10 reste invisible | MO-3 |
| 3 | Aucun état de la réserve | `lib/imports/vgp.ts:114-125` | le fichier source distingue trois états (dont « levée ») ; la table n'en porte aucun | une liste « en attente » mélangerait des réserves déjà levées | Q-MO-2 |
| 4 | Vérifications reçues d'une machine | `lib/vgp/verification.ts:243` (`verificationsDeLaMachine`) | aucun appelant | la fiche machine ne montre que la prochaine échéance | MO-3 |
| 5 | Campagnes VGP (D88 §8) | `prisma/schema.prisma:2358` ; `lib/vgp/campagne.ts:63`, `:96`, `:156` | aucun appelant | passer une famille à « soumise » n'ouvre aucune campagne | MO-29 |
| 6 | Exception VGP d'une machine (D88 §6) | `prisma/schema.prisma:1504-1505` | aucun chemin d'écriture (git grep ; `lib/machines/depot.ts:960` le dit) | impossible de dire qu'un exemplaire fait exception | MO-29 |
| 7 | Régime VGP d'une famille | `lib/materiel/depot.ts:692-719` (`colonnesVgp`) | écrit par l'import seulement ; l'écran matériel n'en porte aucun champ (`app/api/parametres/materiel/saisie-recue.ts:27`) | `/vgp/a-determiner` constate sans pouvoir corriger | MO-29 |
| 8 | Périodicité d'entretien des modèles | `prisma/schema.prisma:2618-2619` | saisie sur `/parametres/materiel`, lue nulle part ailleurs | aucune proposition d'entretien possible | MO-14 |
| 9 | Suite à donner du technicien | `prisma/schema.prisma:1767` | écrite au terrain ; montrée sur la fiche (`app/(back-office)/interventions/[id]/page.tsx:1484`) et le bon (`lib/interventions/bon.ts:150`) ; aucune liste | les préconisations se perdent (M5) | MO-5 |
| 10 | Bac de réception des documents | `lib/documents/depot.ts:93-252` | `recevoir`, `prochainATraiter`, `classer`, `ecarter`, `avancement` sans appelant (exemptions écrites) | aucun document machine ne peut être ajouté | MO-26 |
| 11 | Journal d'audit | `prisma/schema.prisma:1264` ; capacité `lib/auth/habilitations.ts:167` | écrit par déclencheur ; aucun écran | « qui a changé quoi » ne se lit qu'en base | MO-17 |
| 12 | Capacités sans consommateur | `lib/auth/habilitations.ts:119`, `:140`, `:158`, `:159`, `:166`, `:167` | `valider_rapport`, `gerer_contrat`, `voir_marges`, `preparer_facturation`, `administrer_agences`, `consulter_journal_audit` : zéro usage hors de la matrice (git grep) ; plus six capacités éditeur (lot 7) | droits écrits pour des écrans absents ; les agences se règlent sous `parametrer_societe` (`app/api/parametres/agences/creer/route.ts:34`), que la direction détient en restreint — hors mission, à transmettre au groupe Paramètres | MO-2, MO-17 |
| 13 | Dépôt d'une demande | `lib/demandes/depot.ts:124` | aucun appelant | `/demandes` vide par construction | MO-5 |
| 14 | Numéros définitifs | `prisma/schema.prisma:1461`, `:1616`, `:1896` | jamais attribués | « Local-… » partout | EN FILE NUMERO-1 |
| 15 | Fériés travaillés, ponts ; horaires propres d'un technicien | `prisma/schema.prisma:421`, `:537` | lus par `lib/calendar/*` et `app/(back-office)/parametres/agences/page.tsx:130`, jamais écrits | RG-PLA-02 sans geste | MO-30 |
| 16 | Adresse, GPS, horaires d'accès du site | `prisma/schema.prisma:720`, `:742-744`, `:765` ; `lib/sites/saisie.ts:134-140` | le schéma de saisie les accepte, aucun formulaire ni gabarit ne les envoie | le bon n'affiche au mieux que la commune, « — » sans elle (`app/(back-office)/interventions/[id]/bon/page.tsx:184` ; `lib/interventions/bon.ts:265`) ; `/terrain/[id]` n'affiche aucune adresse (DÉDUIT) ; le contrôle à la pose « jour de fermeture du site » (M4) n'a ni donnée ni code (aucune lecture de `site.horaires` dans `lib/interventions`, git grep) | MO-11 |
| 17 | Planches de jetons QR | `lib/machines/qr.ts:121` | aucun appelant | pas d'étiquettes par lot (§8.2) | MO-22 |
| 18 | Consolidation multi-sociétés | `lib/reporting` | sans appelant par décision (D38, lot 5) | — | DIFFÉRÉ |
| 19 | Contrats, prêts, recensement | — | aucune table (contrats : décision 9 ; prêts : PRET-B ; recensement : une nature et une origine de création seulement) | — | DIFFÉRÉ / EN FILE |
| 20 | Courriels | `lib/courriel` | planification, déplacement, premier accès (script) ; ni accusé de réception, ni rapport, ni rappel la veille | notifications client M8 partielles | RAPPORT-1 |

**Angle mort du gardien des chemins (NOUVEAU, outillage).** `scripts/lib/chemins-de-depot.ts:175` ne retient que les fichiers `lib/<domaine>/depot*.ts`. Les modules qui lisent et écrivent en base sous d'autres noms — `lib/vgp/observations.ts`, `lib/vgp/campagne.ts`, `lib/vgp/verification.ts` — échappent au contrôle : `planifierLObservation`, `observationsEnAttente`, `ouvrirCampagne`, `campagnes`, `clore` et `verificationsDeLaMachine` n'ont aucun appelant dans `app/` ni dans `lib/` (git grep), sans qu'aucune exemption ne le dise. Correctif proposé : étendre la population aux modules qui appellent `avecContexteApplicatif` ou renommer ces trois fichiers en `depot-*.ts` ; toucher la population d'un gardien se mesure avant et après (règle écrite dans R6-04).

---

## 3. Pages ou blocs sans usage réel aujourd'hui

| Page ou bloc | Pourquoi vide ou sans geste | Preuve | Décision en jeu | Suite |
|---|---|---|---|---|
| `/demandes`, `/demandes/[id]`, tuile « Demandes en attente » du tableau de bord | aucune source ne crée de demande : portail fermé, pas de saisie au bureau (PARCOURS-1) | `lib/demandes/depot.ts:124` sans appelant ; `app/(back-office)/tableau-de-bord/page.tsx:397` | D133 (entrée voulue par Alexis) | MO-5 ; Q-MO-5 |
| Entrée « App technicien » pour admin société, responsables matériel et SAV | l'entrée s'affiche (capacité `saisir_rapport`), `/terrain` renvoie vers `/planning` | `lib/navigation/entrees.ts:357`, `:530` ; `lib/auth/habilitations.ts:118` ; `app/(mobile)/terrain/page.tsx:91-95` | D132 (`docs/arbitrages.md:4843`, `:4855`) ; décision du 26/09 n°4 et « C-G3 : Rien, D132 tient » | MO-23 ; Q-MO-13 |
| `/parametres/societe` | « cet écran lit, il ne règle rien » | `app/(back-office)/parametres/societe/page.tsx:15`, `:28-36` | N-02 (16/09) ; charte = P3 | MO-24 ; Q-MO-14 |
| `/vgp/a-determiner` | vide quand toutes les familles sont décidées ; aucun geste quand il y en a | `app/(back-office)/vgp/a-determiner/page.tsx` ; régime par import seulement (§2 n°7) | D88 §3 (liste visible) | MO-29 |
| « Télécharger le modèle Excel » sur `/imports` | texte inerte | `app/(back-office)/imports/page.tsx:194-204` ; `lib/i18n/fr.ts:679`, `:690-691` | — | DÉJÀ COUVERT (audit 26/09 B2 ; IMPORT-3) |
| Type d'import « Contacts » | contrôle seulement ; le motif « `lib/contacts/` n'a pas de dépôt » est faux depuis CONTACTS-1 (23/09) | `lib/imports/types-dimport.ts:139-153` contre `lib/contacts/depot.ts:108` | — | MO-10 |
| Bloc « Documents » de `/parc/[id]` | rien à montrer ni à ajouter ; « Le téléchargement des fichiers n'est pas encore disponible » | `app/(back-office)/parc/[id]/page.tsx:417-444` ; `lib/i18n/fr.ts:2404-2405` | stockage objet (lot 8, service externe : §8) | MO-26 |
| `/parc/[id]/modifier` | renvoie « à la fiche » pour statut, lieu, modèle : la fiche n'a aucun de ces gestes | `lib/i18n/fr.ts:2423-2424` ; `lib/machines/depot.ts:1032-1044` | QG-10 (PG-G17) ; « déplacer » non arbitré (R5, feuille de route 23/09) | MO-8 ; Q-MO-7 |
| Tuile « Demandes à valider — Sans objet » sur `/absences` | concept aboli par R3-14 | `app/(back-office)/absences/page.tsx:244-246` ; `docs/audits/2026-09-19-ecrans.md:203` | gardée par Alexis le 25/09 (`docs/audit-ergonomie-2026-09-26.md:265`) | MO-25 ; Q-MO-15 |
| `/portail` | réservé aux comptes portail ; aucun écran ne crée de tels comptes | `lib/portail/depot.ts` (lecture seule) | portail hors V1 ; D132 masque l'entrée | garder masqué, rien à faire |
| Aides qui promettent des « tournées » | tournées différées | `lib/i18n/fr.ts:454-455`, `:2891-2892` | tournées P3 | MO-18 |

---

## 4. Maquettes : écrans ou blocs dessinés et non construits

**`docs/maquette/codiplan-maquette-complete.html`** (fait foi sur la disposition des 14 écrans qu'elle dessine, D125, dans les limites de D128) :

| Écran ou bloc | État | Décision |
|---|---|---|
| `contrats()` — Contrats de maintenance (aperçu du lot 4) | non construit, entrée masquée | décision 9, D132 |
| `consolePage()` — Console éditeur (aperçu du lot 7) | non construit, entrée masquée | lot 7, D132 |
| `portail()` — aperçu bureau, « Envoyer une invitation », « Ouvrir en tant que client » | non construit ; `/portail` ne sert que les comptes portail | portail hors V1 ; la bascule est refusée par D121 |
| `interventions()` — bouton « Exporter » | non construit, **et aucun écart nommé** (aucune occurrence dans `app/(back-office)/interventions/`, DÉDUIT) | écart silencieux à D125 → MO-9 |
| `parc()` — « Scanner un QR code » | écart nommé N-11 (`lib/machines/ecarts-maquette.ts:53-61`), dont le motif « aucun encodeur d'image QR n'existe » est périmé depuis la décision 8 (`qrcode-generator`, `package.json:51`) | → MO-4 |
| `vgp()` — « + Planifier un contrôle », actions « Planifier » | écart nommé (`app/(back-office)/vgp/page.tsx:65-71`) | D88 (CODIMA ne commande pas les VGP), D128 → MO-12 |
| `imports()` — « Télécharger un gabarit » | inerte | IMPORT-3 |
| `parametres()` — carte « Société » avec « Modifier la société » | absent | lot 7 |
| `dashboard()` — « Activité récente » | remplacée par « sans durée » (TABLEAU-1, `app/(back-office)/tableau-de-bord/page.tsx:195-208`) | écart assumé |
| `absences()` — « + Déclarer une absence », calendrier du mois | écart nommé (`lib/absences/ecarts-maquette.ts`) | R3-14 |

**`docs/maquette/CODIPLAN_Maquette.html`** (maquette d'origine ; garde son autorité hors des jetons et des 14 écrans) :

| Écran ou bloc | État | Suite |
|---|---|---|
| Tableau de bord : « Préventif dans les délais », « Répartition par type », « Parc machines suivi » (sous contrat, sous garantie, hors contrat), « Qualité de service » (prise en charge, résolution en une visite, retours sous 30 jours, délai intervention → facturation) | absents | MO-6 (ce qui se compte sans contrat ni règle inventée) |
| Tableau de bord : « Alertes » (échéance dépassée, engagement à 75 %, pièces > 30 j, habilitation expirant, contrats à renouveler, préconisations non transformées) | absent ; « Priorités opérationnelles » en couvre une partie | seuils = valeurs à fixer par Alexis |
| Interventions : « File en attente de pièce — suivi dédié » | partiel (onglet « Bloquées ») | DÉJÀ COUVERT (audit 26/09 C4) |
| Parc : KPI « Sous contrat » | absent | décision 9 |
| Fiche machine : « Relevés de compteur », « Pièces d'usure du modèle » | absents | terrain ; M2f |
| Contrats : portefeuille, échéancier, dossier de renouvellement | absents | décision 9 |
| Portail : « Demander une intervention », suivi de la demande | absents | portail hors V1 |
| Imports : « Exports normalisés » (éléments à facturer, parc, interventions, contrats et échéanciers) | absent | MO-2, MO-9 |
| Paramètres : devises | absent | lot 7 (multi-société) |
| Console éditeur : revenu récurrent, comptes, supervision, support | absente | lot 7 |

---

## 5. Propositions

*Contexte d'usage retenu : SAV itinérant de matériel de garage (ponts élévateurs, crics, démonte-pneus…), environ quatre techniciens, une agence (décision 11), beaucoup de machines soumises à VGP. Aucune valeur métier n'est proposée ici : quand un correctif en demande une, elle est « à fixer par Alexis (CLAUDE.md §8) ».*

### 5.1 Ajouter — P1

**MO-1 — Donner l'accès aux techniciens depuis « Équipe »** — P1 — Ajout (geste sur une page existante)
- Constat : créer un technicien crée son identité, pas son accès ; le lien de premier accès ne s'émet que par script.
- Preuve : `app/(back-office)/parametres/equipe/page.tsx:59-60` ; `lib/techniciens/depot.ts:430-435` ; `scripts/amorcage-premier-compte.mts:11`, `:283` ; `lib/auth/amorcage.ts:403` ; `lib/courriel/premier-acces.ts:93`.
- Raison métier : sans accès, pas de compteur ; sans compteur, pas de clôture (D120, `docs/arbitrages.md:4237`) ; sans clôture, rien à facturer. C'est le premier maillon du lot « terrain » et de P1 (étapes 6-9).
- Proposition : sur la ligne d'un technicien, « Envoyer le lien d'accès » (capacité `administrer_utilisateurs`), qui réutilise l'émission du jeton et le courriel existants ; l'état « accès envoyé / activé » visible. Aucune migration attendue (À VÉRIFIER : la réémission refuse un compte qui a déjà un mot de passe, ce qui convient).
- Décision touchée : D65 point 4 (`docs/arbitrages.md:2226`) annonce que le « chemin administratif d'ouverture de compte » remplace le script, et le situe au lot 7 ; D37 confie l'ouverture des comptes à l'administrateur de société. **ÉCART À ARBITRER (D65)** : l'avancer. → Q-MO-1.
- Couverture : NOUVEAU (le « compte technicien de test » en file est un geste d'Alexis, pas ce bouton).

**MO-2 — « À facturer » : la file des interventions clôturées, avec export Excel et marquage « facturée »** — P1 — Ajout
- Constat : §2 n°1 ; aucune file, aucun export, `facturee` inatteignable ; `reference_facture` et `date_facture` absentes du schéma (`docs/backlog.md:2079-2087`).
- Raison métier : P7 ; O6 (délai intervention → facturation) ; M9 ADV « file des éléments à facturer ». C'est ce qui relie le travail fait à l'argent encaissé.
- Proposition : un **onglet « À facturer » du registre `/interventions`** plutôt qu'une nouvelle entrée de menu (la barre suit D121 + D133) : clôturées « à facturer », colonnes client · site · nature · date de clôture · temps validé · forfait de déplacement · montant HT (seulement avec `voir_montants_vente`) ; bouton « Exporter » (bibliothèque `write-excel-file` déjà adoptée, `lib/excel/ecriture.ts:1-5`) ; « Marquer facturée » avec n° et date de facture Winpro (décision 7), sous `preparer_facturation`, capacité déjà écrite et sans consommateur (`lib/auth/habilitations.ts:159`). Migration (colonnes de facture, revue du déclencheur annoncée par la décision 7) : publication avec le geste d'Alexis.
- À dire à Alexis : la file restera vide tant que les techniciens ne démarrent pas le compteur (D120) — le lot « terrain » et MO-1 passent avant ou avec.
- Décision touchée : décision 7 (23/09) ; D8 ; D115 (les clôtures anciennes une par une) ; D37 (l'administrateur de société ne voit pas les montants). Aucun écart.
- Couverture : EN FILE (FACTURE-1) — la forme « onglet + export » est la proposition.

**MO-3 — « Réserves VGP » : voir les réserves des organismes et en faire une intervention, une par une** — P1 — Ajout
- Constat : §2 n°2 à 4. Les réserves sont écrites (enregistrement d'une vérification, import) et jamais montrées ; la transformation en intervention existe sans écran ; la réserve n'a aucun état alors que le fichier source en distingue trois, et il « avertit que cela ne prouve pas qu'elles sont restées ouvertes » (`lib/imports/vgp.ts:37-43`).
- Raison métier : D88 §10 — « c'est le seul point où ce lot alimente le planning, et c'est celui qui rapporte de l'argent » (`docs/arbitrages.md:2795`). Pour un parc de ponts et de crics soumis à VGP, chaque réserve d'organisme est une réparation à proposer. Sert P1 (étapes 8-10), M5 (préconisations), M9 (« préconisations non transformées »).
- Proposition : (a) sur `/vgp`, une vue « Réserves » du registre (pas de nouvelle entrée de menu) — machine, client — site, date de vérification, organisme, libellé, état — avec « Créer l'intervention » (`planifierLObservation`) : **un geste humain par ligne**, jamais une création en masse (arbitrage du 22/09, `lib/imports/vgp.ts:39-41`) ; (b) sur `/parc/[id]`, un bloc « Vérifications reçues » avec leurs réserves (`verificationsDeLaMachine`) ; (c) préalable : un cycle de vie minimal de la réserve (au moins « à traiter », « levée », « écartée avec motif », et la reprise de l'état importé) — migration et **Arrêt §8** : « levée est ce qu'un client voit » (`lib/imports/vgp.ts:123-125`).
- À VÉRIFIER avant de brancher l'écran (DÉDUIT) : `planifierLObservation` crée l'intervention par `creerIntervention(contexte, saisie, client)` (`lib/vgp/observations.ts:99`), qui ouvre **sa propre** transaction (`lib/interventions/depot.ts:286` ; `lib/db/client.ts:86-101`), puis pose le lien dans la transaction extérieure (`lib/vgp/observations.ts:104`) ; le docblock promet « le lien est posé dans la même transaction que la création » (`lib/vgp/observations.ts:36`). Un échec entre les deux laisserait une intervention sans lien et une réserve toujours « à traiter ».
- Décision touchée : D88 §10, D114, arbitrages du 22/09 ; migration d'état = §8 → Q-MO-2.
- Couverture : NOUVEAU dans la file (nommé SAV-21 → VGP-3 dans la feuille de route du 23/09, projet ; absent de la liste « plus tard » de la file des travaux).

**MO-4 — Ouvrir une machine en scannant son QR** — P1 — Ajout (page d'atterrissage)
- Constat : §1.1 M2b ; l'étiquette encode le jeton nu, la route de résolution rend du JSON, aucun écran ne lit un QR. L'appareil photo d'un téléphone affichera le jeton comme du texte, sans ouvrir la fiche (DÉDUIT).
- Raison métier : M2 — « le scan ouvre la fiche… c'est le geste qui fait vivre le référentiel » ; P1 étape 7 ; décision 8 du 23/09 : « étiquette imprimable **+ scan téléphone vers la fiche machine** » — la seconde moitié manque.
- Proposition : une page d'atterrissage de scan, session exigée, qui résout le jeton (`lib/machines/resolution.ts`) et mène à `/parc/[id]` (bureau) ou à la fiche terrain (technicien) ; le QR imprimé porte l'adresse de cette page suivie du jeton (I10 tenu : le jeton, jamais le numéro). La page publique sans compte reste AM-08 (Q-C du 16/09 : jamais l'état VGP sans compte). **À décider avant d'imprimer les étiquettes en nombre** : changer le contenu d'un QR, c'est réimprimer.
- Décision touchée : décision 8 ; I10, D71 ; Q-C (16/09). → Q-MO-3.
- Couverture : NOUVEAU (l'écart N-11 porte un motif en partie périmé).

### 5.2 Ajouter — P2

**MO-5 — Les suites à donner du technicien alimentent la file « Demandes »** — P2 — Ajout (et donne un usage à `/demandes`)
- Constat : §2 n°9 et n°13 ; la suite à donner n'est lue que sur la fiche et le bon ; `/demandes` est vide par construction.
- Raison métier : M5 — « les travaux à prévoir saisis par le technicien génèrent automatiquement une demande à qualifier ; c'est le principal gisement commercial de l'outil » ; P1 étape 10 ; l'énumération des sources porte déjà `detection_technicien` (`prisma/schema.prisma:2194`).
- Proposition : sur la fiche d'une intervention qui porte une suite à donner, « Créer une demande » (`deposerDemande`, source `detection_technicien`, texte = la suite) ; la demande suit le circuit existant (qualifier, créer l'intervention avec son lien `demande_id`, 73-DEMANDES-2). Un lien de la demande vers l'intervention d'origine évite les doublons : colonne à ajouter (migration hors liste §8). Geste manuel, jamais automatique (même prudence que pour les réserves VGP). Les réserves VGP restent sur `/vgp` (D88 §10 dit « intervention », pas « demande »).
- Décision touchée : D133 (l'entrée « Demandes » gagne un contenu, rien n'est retiré) ; PARCOURS-1 inchangé (au bureau, un appel reste une intervention). → Q-MO-5.
- Couverture : NOUVEAU.

**MO-6 — « Indicateurs du mois »** — P2 — Ajout (page atteinte depuis le tableau de bord, sans entrée de menu)
- Constat : aucun indicateur mensuel ; le tableau de bord est « du jour » et son ordre de blocs est fixé (D125, `app/(back-office)/tableau-de-bord/page.tsx:97-118`).
- Raison métier : §2.2 ; §8.4 — « ne pas mesurer » est l'une des trois causes d'échec de l'amorçage ; §8.3 — suivi mensuel des machines référencées ; M9 Direction.
- Proposition : par mois — machines ajoutées (par origine de création), interventions créées et clôturées par nature, part préventif / curatif / installation / garantie, heures validées face aux heures mesurées, CA HT clôturé (seulement avec `voir_montants_vente`), état du registre VGP (dépassées, à venir, sans information). Chaque chiffre vient de la même requête que la liste qu'il ouvre (règle AT-07). Pas de taux d'occupation consolidé (R2-13, §8), pas de marge (L4-09), pas d'objectif affiché (l'O3 du §2.1 est narratif : cible à fixer par Alexis s'il en veut une). « Retours sous 30 jours » seulement si RG-INT-10 est d'abord appliquée (la colonne n'existe pas).
- Décision touchée : la feuille de route du 23/09 classait « PILOTAGE » en différé (§10, projet) → Q-MO-6.
- Couverture : NOUVEAU.

**MO-7 — « Données à compléter »** — P2 — Ajout (une porte du hub Paramètres)
- Constat : les manques de données sont dispersés, certains sans filtre ; plusieurs faussent le planning ou les courriels.
- Proposition : une page de décomptes, chacun menant à l'écran où l'on corrige : sites sans trajet ni zone (charge fausse, D107) ; machines « à compléter » ; sites dont le client ne sera pas prévenu faute d'interlocuteur « donneur d'ordre » avec courriel (`lib/avertissements/planification.ts:18-21`) ; interventions planifiées sans durée ; lots d'import avec rejets ; familles à déterminer ; prestations sans durée standard ; zones sans forfait de déplacement ; modèles sans périodicité (seulement si MO-14 est retenu). Aucun seuil, aucune alerte.
- Décision touchée : compatible avec AV-14 (« un problème de qualité de données n'est pas une alerte du matin », `app/(back-office)/tableau-de-bord/page.tsx:134-140`) : ce n'est pas le tableau de bord.
- Couverture : NOUVEAU ; rejoint SAV-23 / PARAMETRES-1 (feuille de route 23/09, « checklist de mise en route ») ; le filtre « trajet inconnu » de `/sites` est DÉJÀ COUVERT (audit 27/09 §4.9).

**MO-8 — Gestes sur une machine : panne et remise en service, déplacement, remplacement, ferraillage** — P2 — Ajout
- Constat : §1.1 M2a ; l'écran de correction renvoie à des gestes qui n'existent pas.
- Raison métier : RG-PAR-03 (une machine déplacée garde son historique), RG-PAR-05 et 06 (remplacée, ferraillée, lien de remplacement) ; recette §21 scénario 8.
- Proposition : un bloc « Gestes » sur `/parc/[id]` ; la voie « machine à l'arrêt » depuis une intervention est EN FILE (PG-G17, QG-10) ; en attendant, retirer la phrase qui renvoie « à la fiche ».
- Décision touchée : qui peut déplacer une machine et avec quelle trace n'est pas arbitré (R5 préparé le 23/09 : « geste réservé au bureau, tracé ») ; la matrice §5.2 donne « créer / modifier une machine » au technicien aussi. → Q-MO-7.
- Couverture : EN FILE pour la panne (PG-G17) ; NOUVEAU pour le reste (DEPLACER-1 nommé le 23/09, jamais mis en file).

**MO-9 — « Exporter » en Excel : registre des interventions, parc, registre VGP** — P2 — Ajout
- Constat : seul le fichier des rejets s'écrit ; la maquette complète dessine « Exporter » sur le registre sans écart nommé (§4).
- Raison métier : M9 — « tout tableau est exportable » ; M11 exports normalisés ; §14.3 ; l'ADV recopie dans Winpro ; les clients réclament la liste de leurs échéances VGP.
- Proposition : bouton « Exporter » (filtres courants) sur `/interventions`, `/parc`, `/vgp`, sous `importer_exporter` (`lib/auth/habilitations.ts:160`) ; montants seulement avec `voir_montants_vente`.
- Décision touchée : D125 (comble un écart silencieux). Aucune contradiction.
- Couverture : NOUVEAU.

**MO-10 — Appliquer l'import des contacts** — P2 — Ajout
- Constat : type en « contrôle seulement » sur un motif périmé (§3).
- Raison métier : le courriel au client à la planification part vers l'interlocuteur « donneur d'ordre » ; sans import, chaque contact se saisit à la main ; P6.
- Proposition : application et annulation du type « contacts » avec leur index de cible (le gardien l'exige, `docs/backlog.md:2046`) ; à défaut, masquer le type tant qu'il n'est que contrôlable.
- Couverture : NOUVEAU.

**MO-11 — Adresse et horaires d'accès du site, saisis et montrés au technicien** — P2 — Ajout
- Constat : §2 n°16.
- Raison métier : un SAV itinérant sur tout le territoire ; le technicien doit savoir où aller et quand le site ouvre (M1 sites, P1).
- Proposition : fixer d'abord la forme (question), puis un champ sur la fiche site et une colonne au gabarit « sites » ; afficher l'adresse sur `/terrain/[id]` et sur le bon.
- Décision touchée : aucune décision écrite ; `lib/imports/modeles.ts:425-435` refuse de figer une forme sans décision. → Q-MO-8.
- Couverture : NOUVEAU.

**MO-12 — Registre VGP par client et par site (information du client)** — P2 — Ajout ; la vente du service VGP reste ÉCART À ARBITRER
- Constat : `/vgp` est une liste unique triée par urgence (vu en ligne : les plus anciennes échéances dépassées en tête) ; aucun regroupement par client.
- Proposition : une vue « par client — site » (avec l'export de MO-9) : ce que CODIMA sait des échéances de chaque client, prêt à lui être transmis. Conforme à D88 : rien n'est commandé, aucun verdict.
- « Préparer et proposer les vérifications à venir » au client, c'est vendre le service VGP : **ÉCART À ARBITRER (D88 « HORS V1 : la commande des visites aux organismes », `docs/arbitrages.md:2798`, condition de réouverture `:2800`)** ; nommé AM-09 « boucle commerciale VGP » dans l'arbitrage du 16/09 (projet). → Q-MO-9.
- Couverture : vue par client NOUVEAU ; vente : écart.

### 5.3 Ajouter — P3, ou garder en attente

**MO-13 — Prêts : décider la place dans le menu** — EN FILE (PRET-B/C/D)
- Constat : la conception 70-PRET-A prévoit une liste « Parc de prêt », une fiche actif et une fiche dossier (`docs/decisions/2026-09-25-module-de-pret.md:367-386`) sans dire où l'on y entre ; la barre suit D121 (quatorze destinations) plus l'écart D133.
- Proposition : une entrée « Prêts » dans « Clients & parc », écart nommé comme D133 (`ECARTS_HORS_MAQUETTE`) — la réservation d'un pont est un geste quotidien du bureau. **ÉCART À ARBITRER (D121)**. → Q-MO-10.

**MO-14 — Entretien préventif hors contrat, d'après la périodicité des modèles** — P3 — en attente
- Constat : §2 n°8 ; tous les modèles sont « non périodiques » (vu en ligne).
- Raison métier : le préventif fait le chiffre récurrent (O4, O5) ; c'est le métier d'entretien des ponts et des démonte-pneus.
- Proposition : ne rien construire avant décision ; si oui, une vue « Entretiens à proposer » (dernière intervention préventive + périodicité du modèle), sans aucune création automatique. La règle « entretien dû hors contrat » n'existe pas au chapitre 10 : **Arrêt §8**.
- Décision touchée : décision 9 (Contrats plus tard). **ÉCART À ARBITRER (décision 9)**. → Q-MO-11.

**MO-15 — Comptes du bureau (ADV, responsables, direction) créés depuis l'application** — P3 pour CODIMA seule, P2 pour la vente
- Preuve : seules les identités de technicien se créent à l'écran (`lib/techniciens/depot.ts:430-435`) ; les autres par script (`lib/auth/amorcage.ts:278`).
- Décision touchée : D37 (l'administrateur de société ouvre les comptes de ses collègues) ; D65 point 4 (même question que Q-MO-1). Couverture : NOUVEAU.

**MO-16 — « Mon compte »** — P3
- Constat : aucun écran pour voir son rôle et ses sociétés, l'état du second facteur, changer de mot de passe ; pas de « mot de passe oublié » (réémission par script). Couverture : NOUVEAU.

**MO-17 — Journal d'audit consultable (administrateur de société, direction)** — P3
- Preuve : §2 n°11. La chronologie de la fiche intervention reste DÉJÀ COUVERTE (audit 27/09 §4.4). Couverture : NOUVEAU (écran).

**MO-18 — Tournées : garder différé ; un filtre « Zone » dans la colonne « À traiter » ; retirer la promesse des aides** — P3
- Preuve : tournées P3 (file des travaux §4) ; D107 : le trajet entre deux sites n'est pas compté ; aides qui promettent des tournées (`lib/i18n/fr.ts:454-455`, `:2891-2892`).
- Proposition : regrouper les visites d'une même zone (P3 étape 2 du CDC) par un simple filtre sur la zone du site, sans moteur de tournée ; reformuler les deux aides (« sert au calcul de charge »).
- Couverture : tournées DIFFÉRÉ ; filtre = amendement de PG-G9 (EN FILE, filtres du planning).

**MO-19 — Pose à deux techniciens** — P3 — question
- Preuve : L2-08b BLOQUÉ sur deux réponses (chevauchement par technicien, décompte de la charge) (`docs/backlog.md:668-676`) ; cumul des heures déjà arbitré (`docs/arbitrages.md:236`).
- Proposition : deux interventions jumelles sur le même créneau (aucune migration, même logique que la décision 4), plutôt qu'une table multi-techniciens. → Q-MO-12.

### 5.4 Pistes écartées (avec preuve)

**MO-20 — Astreinte : ne pas ajouter maintenant.** Aucun besoin exprimé ; la modéliser comme une absence typée contredirait R3-14 (« pas de nature, pas de motif », `docs/backlog.md:1704`) ; l'audit du 27/09 la place « plus tard ». Rouvrir si Alexis vend un service d'urgence hors heures.

**MO-21 — Compétences : ne pas ajouter.** Quatre techniciens ; les habilitations portent déjà les exigences de site qui bloquent (RG-PLA-04). Rouvrir le jour où un technicien ne sait pas intervenir sur une famille de matériel.

**MO-22 — Campagne de recensement (suivi, étiquettes par lot, fiche de restitution) : attendre le terrain.** Elle suppose la saisie en série hors ligne (I4) ; nommée AM-10 « produit vendable » (arbitrage du 16/09, projet). D'ici là, MO-6 suit les machines ajoutées par mois et `/clients` montre les clients sans équipement.

### 5.5 Retirer ou masquer

**MO-23 — Entrée « App technicien » pour les rôles à accès complet : la masquer** — Retrait
- Preuve : §3. D132 a mesuré ce symptôme (« redirige silencieusement un rôle à accès complet vers /planning », `docs/arbitrages.md:4843`) puis a gardé l'entrée pour l'administrateur de société parce qu'il a `saisir_rapport` (`:4855`) : la lettre de D132 garde l'entrée morte que son motif voulait retirer.
- Proposition : filtrer l'entrée sur le même critère que `/terrain` (accès restreint au planning, `perimetreDuPlanning`), plutôt que sur `saisir_rapport` : une seule lecture du critère.
- **ÉCART À ARBITRER (D132 ; décision du 26/09 n°4 et « C-G3 : Rien, D132 tient »)**. → Q-MO-13.

**MO-24 — Porte « Charte de la société » : la retirer jusqu'au lot 7** — Retrait
- Preuve : §3 ; la charte est P3 (file des travaux §4, SAV-31).
- Proposition : garder l'information (nom du thème, charte ou thème neutre) comme une ligne de la carte « Société » du hub, retirer la page tant qu'elle ne règle rien.
- **ÉCART À ARBITRER (N-02, 16/09 : l'écran a été créé pour recevoir la pastille retirée de la barre)**. → Q-MO-14.

**MO-25 — Tuile « Demandes à valider — Sans objet » (`/absences`) : la retirer** — Retrait
- Preuve : §3 ; SAV-12 (feuille de route du 23/09) proposait déjà ce retrait.
- **ÉCART À ARBITRER (tuile gardée par Alexis le 25/09)**. → Q-MO-15.

**MO-26 — Bloc « Documents » de la fiche machine : ne l'afficher que s'il porte au moins un document ; retirer « pas encore disponible »** — Retrait partiel
- Preuve : §3 ; §2 n°10. Le bloc est un ajout nommé (`ECARTS_MAQUETTE_AJOUTS_FICHE`, `app/(back-office)/parc/[id]/page.tsx:417-424`), pas un bloc de la maquette complète ; un bloc toujours vide ne porte aucune information réelle (D128 non touchée).
- Construire l'ajout de documents suppose le stockage objet de l'hébergeur : service externe, **Arrêt §8** (lot 8).
- Couverture : NOUVEAU.

**MO-27 — Hub Paramètres : retirer les portes « Clients » et « Sites »** — Retrait
- Preuve : leur motif — « la barre est close à onze entrées » (`lib/navigation/portes-parametrage.ts:71-93`) — est caduc depuis D121, qui met Clients et Sites dans « Clients & parc » (`docs/arbitrages.md:4279-4284`) ; depuis Paramètres, ces portes font sauter l'utilisateur d'un domaine de la barre à l'autre.
- Décision touchée : aucune (le hub n'est pas une destination de D121, et `parametres()` de la maquette ne dessine pas ces portes).
- Option liée : le titre de page « Sociétés & tarifs » (`lib/i18n/fr.ts:2747`) coiffe onze réglages dont aucun ne crée de société ; « Paramètres » serait juste, mais le libellé vient de D121 « lettre pour lettre » (question déjà ouverte par R4-04, `docs/backlog.md:2269`) : **ÉCART À ARBITRER (D121)**. → Q-MO-16.
- Couverture : NOUVEAU.

**MO-28 — Si MO-5 est refusée : masquer l'entrée « Demandes » et la tuile du tableau de bord tant qu'aucune source n'existe** — Retrait conditionnel
- **ÉCART À ARBITRER (D133 : « le jour où l'exploitation veut retirer cette entrée, c'est cette décision qui se rouvre », `docs/arbitrages.md:4893`)**. → Q-MO-5, option (b).

### 5.6 Fusionner

**MO-29 — « Familles à déterminer » dans le registre VGP, avec le geste « Décider le régime »** — Fusion
- Preuve : §2 n°5 à 7 ; la tuile de `/vgp` mène à une page qui ne permet rien (`app/(back-office)/vgp/page.tsx:356-373`).
- Proposition : sur `/vgp`, un bloc « Familles à déterminer » affiché seulement s'il y en a ; pour chacune, « Décider » (soumise avec périodicité et texte / non soumise / vérifiée), qui appelle la règle déjà écrite (`schemaAssujettissementFamille`, `lib/vgp/assujettissement.ts:60`) par `modifierFamilleDans` — « une entrée qui appelle la règle n'est pas une seconde entrée sur la règle » (`docs/backlog.md:2113`) ; au passage à « soumise », ouvrir la campagne existante (`lib/vgp/campagne.ts:63`, D88 §8) ; sur `/parc/[id]`, l'exception d'un exemplaire avec son motif obligatoire (D88 §6). Retirer ensuite `/vgp/a-determiner`.
- Décision touchée : D88 §3 (liste visible : tenue), §5 (aucune périodicité inventée : saisie humaine), §7 (journalisation : déclencheur). Aucun écart.
- Couverture : NOUVEAU.

**MO-30 — « Horaires d'ouverture » et établissements → une page « Agences »** — Fusion
- Preuve : la page s'intitule « Réglage des horaires d'ouverture » (`lib/i18n/fr.ts:2057`) mais liste des agences ; `/parametres/agences/[id]` attend l'identifiant d'un **calendrier** (`app/(back-office)/parametres/agences/[id]/page.tsx:77`) et `/parametres/agences/[id]/modifier` celui d'une **agence** (`app/(back-office)/parametres/agences/[id]/modifier/page.tsx:59-63`) ; fériés travaillés, ponts et horaires propres d'un technicien n'ont aucun écran (§2 n°15).
- Proposition : « Agences » — la liste des agences (état, calendrier rattaché) ; la fiche d'une agence (identité, horaires, fériés travaillés et ponts, RG-PLA-02) ; des adresses distinctes pour l'agence et pour le calendrier (un calendrier peut servir plusieurs agences) ; les horaires propres d'un technicien sur « Équipe ». Vocabulaire imposé : « Agence ». Avec une seule agence active (décision 11), l'écran reste court.
- Décision touchée : I7, RG-PLA-01/02, D134 (l'agence inactive reste listée). Aucun écart.
- Couverture : NOUVEAU.

**MO-31 — Absences et planning : garder la page, ajouter l'entrée depuis le planning** — Fusion partielle
- Proposition : « Déclarer une absence » depuis la ligne d'un technicien du planning, qui ouvre le formulaire existant pré-rempli. Retirer l'entrée « Absences » du menu serait un **ÉCART À ARBITRER (D121)** : non recommandé (consultation hebdomadaire, report groupé RG-PLA-06).
- Couverture : « Absence » partout et demi-journée EN FILE (PG-G15) ; l'entrée depuis le planning : NOUVEAU (à joindre à PG-G13 « créer ici »).

**MO-32 — « Taux horaire » et « Forfaits » → une page « Tarifs »** — Fusion, P3, facultative
- Preuve : deux portes pour deux réglages d'argent rarement touchés (`lib/navigation/portes-parametrage.ts:54-68`) ; `parametres()` de la maquette les montre sur un même écran (« Tarification », « Forfaits actifs »).
- Garde-fous : historisation du taux (RG-TAR-04) inchangée ; les prestations restent à part (D109 : une durée, jamais un prix).
- Avec MO-24, MO-27 et MO-32, le hub passe de onze portes à sept.
- Couverture : NOUVEAU.

---

## 6. Questions pour Alexis

*Une question = une décision. Recommandation en premier. Ordre = priorité.*

| # | Question | Options | Recommandation | Débloque |
|---|---|---|---|---|
| Q-MO-1 | Faut-il avancer dès maintenant le « chemin administratif » d'ouverture de compte (D65 point 4, prévu au lot 7), sous la forme d'un bouton « Envoyer le lien d'accès » sur Équipe pour les techniciens ? | (a) oui, pour les techniciens maintenant, les comptes bureau ensuite ; (b) non, rester au script | (a) — sans accès, pas de compteur, pas de clôture (D120), pas de facturation | MO-1, MO-15 |
| Q-MO-2 | Une réserve VGP reçoit-elle un état (« à traiter », « levée », « écartée avec motif », avec reprise de l'état importé) pour pouvoir être affichée et transformée une par une ? (migration, « levée » est ce qu'un client voit : §8) | (a) oui ; (b) afficher sans état (les réserves levées se mêlent aux autres) ; (c) plus tard | (a) | MO-3 |
| Q-MO-3 | Le QR imprimé doit-il porter une adresse web ouvrable par l'appareil photo du téléphone (le jeton inclus, session exigée), plutôt que le jeton seul ? | (a) oui, avant toute impression en nombre ; (b) non, un lecteur dans l'application | (a) | MO-4 |
| Q-MO-4 | « À facturer » : un onglet du registre des interventions, avec export et « Marquer facturée », plutôt qu'une nouvelle entrée de menu ? | (a) onglet ; (b) entrée de menu (écart nommé à D121) | (a) | MO-2 (FACTURE-1) |
| Q-MO-5 | La file « Demandes » : que devient-elle tant que le portail est fermé ? | (a) la nourrir avec les « suites à donner » du technicien (geste manuel, source « détection technicien ») ; (b) masquer l'entrée et la tuile (revient sur D133) ; (c) la laisser vide | (a) | MO-5, MO-28 |
| Q-MO-6 | Une page « Indicateurs du mois » (décomptes seulement : pas d'objectif, pas de taux consolidé, pas de marge) maintenant, alors que la feuille de route du 23/09 classait le pilotage en différé ? Si vous voulez un objectif affiché, il reste à fixer par vous. | (a) oui ; (b) après les contrats | (a) | MO-6 |
| Q-MO-7 | Déplacer, remplacer ou ferrailler une machine : qui peut le faire, et le geste est-il tracé (ancien et nouveau site, date, motif) ? | (a) bureau seulement, tracé ; (b) bureau et technicien affecté, tracé | (a) | MO-8 |
| Q-MO-8 | L'adresse d'un site : une ligne libre (rue, lieu-dit, boîte postale) en plus de la commune suffit-elle ? | (a) oui ; (b) des champs séparés | (a) | MO-11 |
| Q-MO-9 | CODIMA veut-elle proposer ou vendre la VGP à ses clients (D88 : hors V1, AM-09) ? | (a) pas maintenant : seulement la vue « par client » et l'export ; (b) oui : D88 est à réécrire | (a) | MO-12 |
| Q-MO-10 | Où entre-t-on dans les prêts ? | (a) entrée « Prêts » dans « Clients & parc », écart nommé à D121 comme D133 ; (b) onglet de `/parc` | (a) | MO-13 |
| Q-MO-11 | CODIPLAN doit-il proposer les entretiens préventifs hors contrat d'après la périodicité des modèles, avant le module Contrats (décision 9) ? | (a) pas maintenant ; (b) oui : règle à écrire au chapitre 10, périodicités à saisir | (a) | MO-14 |
| Q-MO-12 | Une pose à deux techniciens : deux interventions jumelles sur le même créneau, ou plusieurs techniciens sur une intervention (L2-08b) ? | (a) jumelles, sans migration ; (b) L2-08b | (a) | MO-19 |
| Q-MO-13 | Masquer « App technicien » pour les rôles qui ont un accès complet au planning (ils sont renvoyés vers `/planning`) ? | (a) oui (revient sur D132 et sur la décision du 26/09) ; (b) non | (a) | MO-23 |
| Q-MO-14 | Retirer la porte « Charte de la société » jusqu'au lot 7, en gardant l'information dans le hub ? | (a) oui (revient sur N-02) ; (b) non | (a) | MO-24 |
| Q-MO-15 | Retirer la tuile « Demandes à valider — Sans objet » de la page Absences ? | (a) oui (revient sur le choix du 25/09) ; (b) non | (a) | MO-25 |
| Q-MO-16 | Titre du hub : « Paramètres » au lieu de « Sociétés & tarifs » ? | (a) oui, écart nommé à D121 ; (b) non | (a) | MO-27 |

---

## 7. Observations en ligne : confirmées / réfutées (celles qui touchent cette mission)

- « App technicien » renvoie un compte bureau vers `/planning` — **CONFIRMÉE** (`lib/navigation/entrees.ts:357`, `:530` ; `app/(mobile)/terrain/page.tsx:91-95`). Nuance : ce n'est pas « contre D132 », c'est conforme à sa lettre (`docs/arbitrages.md:4855`) et contraire à son motif (`:4843`).
- « Sociétés & tarifs » coiffe onze réglages — **CONFIRMÉE** (`lib/navigation/portes-parametrage.ts`, onze portes ; `lib/i18n/fr.ts:2747`) ; le libellé vient de D121.
- `/portail` refuse un compte interne et l'entrée est masquée — **CONFIRMÉE** (D132 ; `CAPACITE_REQUISE`, `lib/navigation/entrees.ts:527`).
- `/demandes` toujours vide — **CONFIRMÉE** par construction (`deposerDemande` sans appelant ; PARCOURS-1).
- Hub : Sites et Clients doublent le menu — **CONFIRMÉE** (`lib/navigation/portes-parametrage.ts:71-93`).
- « Charte de la société » = diagnostic sans action — **CONFIRMÉE** (`app/(back-office)/parametres/societe/page.tsx:28-36`).
- « Familles à déterminer » vide et atteinte par une tuile à 0 — **CONFIRMÉE**, et **aggravée** : même non vide, la page ne permet pas de décider (régime par import seulement).
- « Télécharger le modèle Excel » indisponible — **CONFIRMÉE** (`app/(back-office)/imports/page.tsx:194-204`) ; DÉJÀ COUVERT.
- Import « Contacts » en contrôle seul — **CONFIRMÉE**, et son motif est périmé (`lib/imports/types-dimport.ts:139-153` contre `lib/contacts/depot.ts:108`).
- Documents de la fiche machine non téléchargeables — **CONFIRMÉE** (`app/(back-office)/parc/[id]/page.tsx:443`) ; de plus, aucun document ne peut être ajouté.
- « Corriger la fiche machine » renvoie à des gestes absents — **CONFIRMÉE** (`lib/machines/depot.ts:1032-1044` ; `lib/i18n/fr.ts:2423-2424`).
- Tuile « Demandes à valider — Sans objet » — **CONFIRMÉE** (`app/(back-office)/absences/page.tsx:244-246`) ; gardée par Alexis le 25/09.
- Référentiel matériel : « entretien périodique » non renseigné — **CONFIRMÉE** côté code : même renseignée, la périodicité n'est lue nulle part.
- Aide du site « sert … aux tournées » alors que les tournées n'existent pas — **CONFIRMÉE** (`lib/i18n/fr.ts:454-455`, et `:2891-2892`).
- Bon d'intervention « Adresse — » — **CONFIRMÉE** par le code : l'adresse du site n'est écrite par aucun écran ni aucun import (`lib/imports/modeles.ts:425-435`) ; le bon ne peut montrer que la commune, et « — » quand elle manque (`lib/interventions/bon.ts:265`).
- Réserves VGP « D88 : observations → interventions à planifier ? » — **CONFIRMÉE** : la couche existe (`lib/vgp/observations.ts:58`), aucun écran ne l'appelle, et les réserves ne sont affichées nulle part.
