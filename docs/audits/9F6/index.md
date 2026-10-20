# Index des écrans — 9F6A-DOSSIER-AUDIT-8-AGENTS

| Clé | Zone | Libellé | Route | Rôle | Paquet | Verdict 1280 | Verdict 375 |
|---|---|---|---|---|---|---|---|
| `racine` | Accès | Racine (/) | `/` | anonyme | P1 — Accès et sans session | sans maquette | sans maquette |
| `connexion` | Accès | Connexion | `/connexion` | anonyme | P1 — Accès et sans session | ecart mesure | ecart mesure |
| `connexion-code` | Accès | Code du second facteur (et code de secours) | `/connexion/code` | spécial, voir note | P1 — Accès et sans session | ecart mesure | ecart mesure |
| `mot-de-passe-oublie` | Accès | Mot de passe oublié | `/mot-de-passe-oublie` | anonyme | P1 — Accès et sans session | ecart mesure | ecart mesure |
| `enrolement` | Accès | Activer le second facteur | `/enrolement` | spécial, voir note | P1 — Accès et sans session | ecart mesure | ecart mesure |
| `premier-acces` | Accès | Premier accès (lien d'accès) | `/premier-acces?token=2mYpHawWpD9FVYXc0EjOfhQD` | spécial, voir note | P1 — Accès et sans session | ecart mesure | ecart mesure |
| `premier-acces-cas-expire` | Accès | Lien d'accès expiré | `/premier-acces?motif=premier_acces.refuse` | spécial, voir note | P1 — Accès et sans session | ecart mesure | ecart mesure |
| `arrivee` | Accès | Choisir la société | `/arrivee` | spécial, voir note | P1 — Accès et sans session | non mesure | non mesure |
| `tableau-de-bord` | Exploitation | Tableau de bord (une composition par rôle) | `/tableau-de-bord` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P2 — Pilotage | ecart mesure | ecart mesure |
| `indicateurs` | Exploitation | Indicateurs du mois | `/indicateurs` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P2 — Pilotage | ecart mesure | ecart mesure |
| `planning` | Exploitation | Planning · semaine | `/planning` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P3 — Planning | ecart mesure | ecart mesure |
| `planning-vue-jour` | Exploitation | Planning · jour (frise) | `/planning?vue=jour` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P3 — Planning | ecart mesure | ecart mesure |
| `planning-vue-deux_semaines` | Exploitation | Planning · deux semaines | `/planning?vue=deux_semaines` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P3 — Planning | ecart mesure | ecart mesure |
| `planning-vue-mois` | Exploitation | Planning · mois | `/planning?vue=mois` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P3 — Planning | ecart mesure | ecart mesure |
| `demandes` | Exploitation | Demandes | `/demandes` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P4 — Demandes et registre | ecart mesure | ecart mesure |
| `demandes-d31` | Exploitation | Qualifier une demande | `absente` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P4 — Demandes et registre | non mesure | non mesure |
| `interventions` | Exploitation | Interventions (registre à onglets) | `/interventions` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P4 — Demandes et registre | ecart mesure | ecart mesure |
| `interventions-a-facturer` | Exploitation | À facturer | `/interventions/a-facturer` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P4 — Demandes et registre | ecart mesure | ecart mesure |
| `interventions-nouvelle` | Exploitation | Nouvelle intervention | `/interventions/nouvelle` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P4 — Demandes et registre | ecart mesure | ecart mesure |
| `interventions-i452` | Exploitation | Fiche intervention · à planifier (P1) | `/interventions/0192f0a0-6000-7000-8000-000000000001` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P5 — Fiches intervention et bon | ecart mesure | ecart mesure |
| `interventions-i436` | Exploitation | Fiche intervention · en cours | `absente` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P5 — Fiches intervention et bon | non mesure | non mesure |
| `interventions-i419` | Exploitation | Fiche intervention · rapport à valider | `/interventions/0192f0a0-6000-7000-8000-000000000004` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P5 — Fiches intervention et bon | ecart mesure | ecart mesure |
| `interventions-i425` | Exploitation | Fiche intervention · prête à clôturer | `/interventions/0192f0a0-6000-7000-8000-000000000004` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P5 — Fiches intervention et bon | ecart mesure | ecart mesure |
| `interventions-i421` | Exploitation | Fiche intervention · suspendue | `/interventions/0192f0a0-6000-7000-8000-000000000030` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P5 — Fiches intervention et bon | ecart mesure | ecart mesure |
| `interventions-h0` | Exploitation | Fiche intervention · reprise de l'archive | `/interventions/0192f0a0-6000-7000-8000-000000000005` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P5 — Fiches intervention et bon | ecart mesure | ecart mesure |
| `interventions-i440` | Exploitation | Fiche intervention · annulée | `/interventions/0192f0a0-6000-7000-8000-000000000006` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P5 — Fiches intervention et bon | ecart mesure | ecart mesure |
| `interventions-i431-bon` | Exploitation | Bon d'intervention (client / interne) | `/interventions/0192f0a0-6000-7000-8000-000000000005/bon` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P5 — Fiches intervention et bon | ecart mesure | ecart mesure |
| `absences` | Exploitation | Absences | `/absences` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P2 — Pilotage | ecart mesure | ecart mesure |
| `clients` | Clients & parc | Clients | `/clients` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P6 — Clients, sites, parc, VGP | ecart mesure | ecart mesure |
| `clients-nouveau` | Clients & parc | Nouveau client | `/clients/nouveau` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P6 — Clients, sites, parc, VGP | ecart mesure | ecart mesure |
| `clients-c14` | Clients & parc | Fiche client | `/clients/0192f0a0-1000-7000-8000-000000000003` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P6 — Clients, sites, parc, VGP | ecart mesure | ecart mesure |
| `sites` | Clients & parc | Sites | `/sites` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P6 — Clients, sites, parc, VGP | ecart mesure | ecart mesure |
| `sites-nouveau-client-c10` | Clients & parc | Nouveau site | `/sites/nouveau?client=0192f0a0-1000-7000-8000-000000000003` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P6 — Clients, sites, parc, VGP | ecart mesure | ecart mesure |
| `sites-s11` | Clients & parc | Fiche site | `/sites/0192f0a0-4000-7000-8000-000000000004` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P6 — Clients, sites, parc, VGP | ecart mesure | ecart mesure |
| `parc` | Clients & parc | Parc machines (maître-détail) | `/parc` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P6 — Clients, sites, parc, VGP | ecart mesure | ecart mesure |
| `parc-nouvelle-site-s18` | Clients & parc | Nouvelle machine | `/parc/nouvelle?site=0192f0a0-4000-7000-8000-000000000004` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P6 — Clients, sites, parc, VGP | ecart mesure | ecart mesure |
| `parc-m14` | Clients & parc | Fiche machine | `/parc/0192f0a0-9000-7000-8000-000000000008` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P6 — Clients, sites, parc, VGP | ecart mesure | ecart mesure |
| `parc-m14-modifier` | Clients & parc | Corriger la fiche machine | `/parc/0192f0a0-9000-7000-8000-000000000008/modifier` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P6 — Clients, sites, parc, VGP | ecart mesure | ecart mesure |
| `vgp` | Clients & parc | VGP · registre | `/vgp` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P6 — Clients, sites, parc, VGP | ecart mesure | ecart mesure |
| `vgp-reserves` | Clients & parc | VGP · réserves | `absente` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P6 — Clients, sites, parc, VGP | non mesure | non mesure |
| `vgp-a-determiner` | Clients & parc | VGP · familles à déterminer (onglet) | `/vgp/a-determiner` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P6 — Clients, sites, parc, VGP | ecart mesure | ecart mesure |
| `vgp-enregistrer-m1` | Clients & parc | Enregistrer une vérification reçue | `/vgp/enregistrer/0192f0a0-9000-7000-8000-000000000008` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P6 — Clients, sites, parc, VGP | ecart mesure | ecart mesure |
| `scan-QR-7F3A9C` | Clients & parc | Scan d'une étiquette | `absente` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P1 — Accès et sans session | non mesure | non mesure |
| `parametres` | Paramètres | Paramètres (hub, carte « Identité ») | `/parametres` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | ecart mesure | ecart mesure |
| `parametres-agences` | Paramètres | Agences | `/parametres/agences` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | ecart mesure | ecart mesure |
| `parametres-societe` | Paramètres | Société | `/parametres/societe` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | sans maquette | sans maquette |
| `parametres-agences-a1` | Paramètres | Fiche agence (horaires, fériés, ponts) | `/parametres/agences/01a15990-ac4d-7681-ad82-68d9fc239559` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | ecart mesure | ecart mesure |
| `parametres-agences-nouvelle` | Paramètres | Nouvelle agence | `/parametres/agences/nouvelle` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | ecart mesure | ecart mesure |
| `parametres-agences-calendrier` | Paramètres | Calendrier de l'agence | `/parametres/agences/calendrier/01a15990-ac4d-7681-ad82-68d9fc239559` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | ecart mesure | ecart mesure |
| `parametres-tarifs` | Paramètres | Tarifs (taux et forfaits) | `/parametres/tarifs` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | ecart mesure | ecart mesure |
| `parametres-forfaits-id` | Paramètres | Fiche forfait | `/parametres/forfaits/0192f0a0-c000-7000-8000-000000000001` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | ecart mesure | ecart mesure |
| `parametres-trajets` | Paramètres | Trajets par zone | `/parametres/trajets` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | ecart mesure | ecart mesure |
| `parametres-prestations` | Paramètres | Prestations | `/parametres/prestations` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | ecart mesure | ecart mesure |
| `parametres-materiel` | Paramètres | Référentiel matériel | `/parametres/materiel` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | ecart mesure | ecart mesure |
| `parametres-equipe` | Paramètres | Équipe et accès | `/parametres/equipe` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | ecart mesure | ecart mesure |
| `parametres-habilitations` | Paramètres | Habilitations | `/parametres/habilitations` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | ecart mesure | ecart mesure |
| `parametres-donnees` | Paramètres | Données à compléter | `/parametres/donnees` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | ecart mesure | ecart mesure |
| `parametres-journal` | Paramètres | Journal d'audit | `absente` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | non mesure | non mesure |
| `imports` | Paramètres | Imports Excel | `/imports` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | ecart mesure | ecart mesure |
| `imports-L17` | Paramètres | Rapport d'import (contrôlé) | `/imports/0192f0a0-d000-7000-8000-000000000001` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | ecart mesure | ecart mesure |
| `imports-L16` | Paramètres | Rapport d'import (appliqué, rejets groupés) | `absente` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P7 — Paramètres et imports | non mesure | non mesure |
| `compte` | Paramètres | Mon compte | `absente` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P1 — Accès et sans session | non mesure | non mesure |
| `terrain` | Paramètres | App technicien (rôle de bureau) | `/terrain` | admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE) | P8 — Terrain | ecart mesure | ecart mesure |
| `sante` | Paramètres | État de l'installation | `/sante` | anonyme | P1 — Accès et sans session | ecart mesure | ecart mesure |
| `terrain-hors-reseau` | Terrain | Coquille hors réseau | `/terrain-hors-reseau` | anonyme | P8 — Terrain | sans maquette | sans maquette |
| `terrain-technicien` | Terrain | Ma journée | `/terrain` | technicien (COMPTE_TECHNICIEN_EPREUVE) | P8 — Terrain | ecart mesure | ecart mesure |
| `terrain-i-i440` | Terrain | Intervention à démarrer | `/terrain/0192f0a0-6000-7000-8000-000000000021` | technicien (COMPTE_TECHNICIEN_EPREUVE) | P8 — Terrain | ecart mesure | ecart mesure |
| `terrain-i-i436` | Terrain | Intervention en cours | `absente` | technicien (COMPTE_TECHNICIEN_EPREUVE) | P8 — Terrain | non mesure | non mesure |
| `terrain-i-i436-rapport` | Terrain | Rapport | `absente` | technicien (COMPTE_TECHNICIEN_EPREUVE) | P8 — Terrain | non mesure | non mesure |
| `terrain-i-i436-signature` | Terrain | Signature et fin | `absente` | technicien (COMPTE_TECHNICIEN_EPREUVE) | P8 — Terrain | non mesure | non mesure |
| `terrain-scan` | Terrain | Scanner un QR | `absente` | technicien (COMPTE_TECHNICIEN_EPREUVE) | P8 — Terrain | non mesure | non mesure |
| `terrain-machine-m4` | Terrain | Fiche machine | `absente` | technicien (COMPTE_TECHNICIEN_EPREUVE) | P8 — Terrain | non mesure | non mesure |
| `terrain-machines` | Terrain | Mes machines | `absente` | technicien (COMPTE_TECHNICIEN_EPREUVE) | P8 — Terrain | non mesure | non mesure |
| `terrain-machine-express` | Terrain | Machine express (recensement) | `absente` | technicien (COMPTE_TECHNICIEN_EPREUVE) | P8 — Terrain | non mesure | non mesure |
| `terrain-profil` | Terrain | Profil | `/terrain/profil` | technicien (COMPTE_TECHNICIEN_EPREUVE) | P8 — Terrain | ecart mesure | ecart mesure |
| `portail` | Hors V1 | Portail client (aperçu) | `/portail` | spécial, voir note | P1 — Accès et sans session | non mesure | non mesure |
| `tableau-de-bord-adv` | Exploitation | Tableau de bord — rôle adv | `/tableau-de-bord` | adv (adv@codima.test) | P2 — Pilotage | ecart mesure | ecart mesure |
| `tableau-de-bord-technicien` | Exploitation | Tableau de bord — rôle technicien | `/tableau-de-bord` | technicien (garnier@codima.test) | P2 — Pilotage | ecart mesure | ecart mesure |
| `tableau-de-bord-responsable_materiel` | Exploitation | Tableau de bord — rôle responsable_materiel | `/tableau-de-bord` | responsable_materiel (rm@codima.test) | P2 — Pilotage | ecart mesure | ecart mesure |
| `tableau-de-bord-responsable_sav` | Exploitation | Tableau de bord — rôle responsable_sav | `/tableau-de-bord` | responsable_sav (rs@codima.test) | P2 — Pilotage | ecart mesure | ecart mesure |
| `tableau-de-bord-direction` | Exploitation | Tableau de bord — rôle direction | `/tableau-de-bord` | direction (zz9f5-direction@codima.test) | P2 — Pilotage | ecart mesure | ecart mesure |
