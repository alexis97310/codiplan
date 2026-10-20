# Répartition en 8 paquets — 9F6A-DOSSIER-AUDIT-8-AGENTS

Chaque écran est dans EXACTEMENT un paquet (épreuve `tests/unit/audits/9f6-repartition.test.ts`, sur `index.json`).

**Déséquilibre mesuré** : le plus grand paquet (18 écrans) fait plus du double du plus petit (4 écrans).

## P1 — Accès et sans session

12 écran(s), 80 image(s).

- `racine` — Accès · Racine (/)
- `connexion` — Accès · Connexion
- `connexion-code` — Accès · Code du second facteur (et code de secours)
- `mot-de-passe-oublie` — Accès · Mot de passe oublié
- `enrolement` — Accès · Activer le second facteur
- `premier-acces` — Accès · Premier accès (lien d'accès)
- `premier-acces-cas-expire` — Accès · Lien d'accès expiré
- `arrivee` — Accès · Choisir la société
- `scan-QR-7F3A9C` — Clients & parc · Scan d'une étiquette
- `compte` — Paramètres · Mon compte
- `sante` — Paramètres · État de l'installation
- `portail` — Hors V1 · Portail client (aperçu)

## P2 — Pilotage

8 écran(s), 64 image(s).

- `tableau-de-bord` — Exploitation · Tableau de bord (une composition par rôle)
- `indicateurs` — Exploitation · Indicateurs du mois
- `absences` — Exploitation · Absences
- `tableau-de-bord-adv` — Exploitation · Tableau de bord — rôle adv
- `tableau-de-bord-technicien` — Exploitation · Tableau de bord — rôle technicien
- `tableau-de-bord-responsable_materiel` — Exploitation · Tableau de bord — rôle responsable_materiel
- `tableau-de-bord-responsable_sav` — Exploitation · Tableau de bord — rôle responsable_sav
- `tableau-de-bord-direction` — Exploitation · Tableau de bord — rôle direction

## P3 — Planning

4 écran(s), 32 image(s).

- `planning` — Exploitation · Planning · semaine
- `planning-vue-jour` — Exploitation · Planning · jour (frise)
- `planning-vue-deux_semaines` — Exploitation · Planning · deux semaines
- `planning-vue-mois` — Exploitation · Planning · mois

## P4 — Demandes et registre

5 écran(s), 40 image(s).

- `demandes` — Exploitation · Demandes
- `demandes-d31` — Exploitation · Qualifier une demande
- `interventions` — Exploitation · Interventions (registre à onglets)
- `interventions-a-facturer` — Exploitation · À facturer
- `interventions-nouvelle` — Exploitation · Nouvelle intervention

## P5 — Fiches intervention et bon

16 écran(s), 92 image(s).

- `interventions-i452` — Exploitation · Fiche intervention · à planifier (P1)
- `interventions-i436` — Exploitation · Fiche intervention · en cours
- `interventions-i419` — Exploitation · Fiche intervention · rapport à valider
- `interventions-i425` — Exploitation · Fiche intervention · prête à clôturer
- `interventions-i421` — Exploitation · Fiche intervention · suspendue
- `interventions-h0` — Exploitation · Fiche intervention · reprise de l'archive
- `interventions-i440` — Exploitation · Fiche intervention · annulée
- `interventions-i431-bon` — Exploitation · Bon d'intervention (client / interne)
- `interventions-onglet-temps` — Exploitation · Fiche intervention — onglet Temps
- `interventions-onglet-rapport` — Exploitation · Fiche intervention — onglet Rapport
- `interventions-onglet-valorisation` — Exploitation · Fiche intervention — onglet Valorisation
- `interventions-onglet-historique` — Exploitation · Fiche intervention — onglet Historique
- `interventions-onglet-valorisation-adv` — Exploitation · Fiche intervention — onglet Valorisation (rôle adv)
- `interventions-bon-interne-adv` — Exploitation · Bon d'intervention — version interne (rôle adv)
- `interventions-onglet-valorisation-direction` — Exploitation · Fiche intervention — onglet Valorisation (rôle direction)
- `interventions-bon-interne-direction` — Exploitation · Bon d'intervention — version interne (rôle direction)

## P6 — Clients, sites, parc, VGP

14 écran(s), 108 image(s).

- `clients` — Clients & parc · Clients
- `clients-nouveau` — Clients & parc · Nouveau client
- `clients-c14` — Clients & parc · Fiche client
- `sites` — Clients & parc · Sites
- `sites-nouveau-client-c10` — Clients & parc · Nouveau site
- `sites-s11` — Clients & parc · Fiche site
- `parc` — Clients & parc · Parc machines (maître-détail)
- `parc-nouvelle-site-s18` — Clients & parc · Nouvelle machine
- `parc-m14` — Clients & parc · Fiche machine
- `parc-m14-modifier` — Clients & parc · Corriger la fiche machine
- `vgp` — Clients & parc · VGP · registre
- `vgp-reserves` — Clients & parc · VGP · réserves
- `vgp-a-determiner` — Clients & parc · VGP · familles à déterminer (onglet)
- `vgp-enregistrer-m1` — Clients & parc · Enregistrer une vérification reçue

## P7 — Paramètres et imports

18 écran(s), 124 image(s).

- `parametres` — Paramètres · Paramètres (hub, carte « Identité »)
- `parametres-agences` — Paramètres · Agences
- `parametres-societe` — Paramètres · Société
- `parametres-agences-a1` — Paramètres · Fiche agence (horaires, fériés, ponts)
- `parametres-agences-nouvelle` — Paramètres · Nouvelle agence
- `parametres-agences-calendrier` — Paramètres · Calendrier de l'agence
- `parametres-tarifs` — Paramètres · Tarifs (taux et forfaits)
- `parametres-forfaits-id` — Paramètres · Fiche forfait
- `parametres-trajets` — Paramètres · Trajets par zone
- `parametres-prestations` — Paramètres · Prestations
- `parametres-materiel` — Paramètres · Référentiel matériel
- `parametres-equipe` — Paramètres · Équipe et accès
- `parametres-habilitations` — Paramètres · Habilitations
- `parametres-donnees` — Paramètres · Données à compléter
- `parametres-journal` — Paramètres · Journal d'audit
- `imports` — Paramètres · Imports Excel
- `imports-L17` — Paramètres · Rapport d'import (contrôlé)
- `imports-L16` — Paramètres · Rapport d'import (appliqué, rejets groupés)

## P8 — Terrain

14 écran(s), 84 image(s).

- `terrain` — Paramètres · App technicien (rôle de bureau)
- `terrain-hors-reseau` — Terrain · Coquille hors réseau
- `terrain-technicien` — Terrain · Ma journée
- `terrain-i-i440` — Terrain · Intervention à démarrer
- `terrain-i-i436` — Terrain · Intervention en cours
- `terrain-i-i436-rapport` — Terrain · Rapport
- `terrain-i-i436-signature` — Terrain · Signature et fin
- `terrain-scan` — Terrain · Scanner un QR
- `terrain-machine-m4` — Terrain · Fiche machine
- `terrain-machines` — Terrain · Mes machines
- `terrain-machine-express` — Terrain · Machine express (recensement)
- `terrain-profil` — Terrain · Profil
- `terrain-hors-reseau-fiche-utilisable` — Terrain · Fiche hors réseau, utilisable (compteur, rapport, prestations, photos, signature, Terminer gardé)
- `terrain-hors-reseau-journee-utilisable` — Terrain · Ma journée, hors réseau (copie présente)

