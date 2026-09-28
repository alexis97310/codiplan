# Constats détaillés de l'audit du 28/09/2026

Ces fichiers sont les rapports de relecture du code au commit `bcc637e`, un par groupe de pages. Chaque constat donne :
- sa preuve (`fichier:ligne` et un extrait) ;
- son effet pour l'utilisateur ;
- un correctif proposé, sans valeur inventée ;
- sa couverture : nouveau, déjà couvert ou en file.

| Fichier | Pages |
|---|---|
| `IN.md` | registre des interventions, création, fiche, bon, demandes, tableau de bord |
| `CS.md` | clients, sites, interlocuteurs |
| `PV.md` | parc machines, fiche machine, identifiant et QR, registre VGP |
| `PA.md` | paramètres (hub, charte, taux, prestations, forfaits, trajets, agences, équipe, habilitations, matériel), imports |
| `TR.md` | absences, terrain, portail, arrivée, connexion, enrôlement, premier accès, santé, navigation, vocabulaire |
| `MO.md` | matrice de couverture du cahier des charges ; modules et pages à ajouter, retirer, fusionner (MO-1 à MO-32) |
| `VERIF-IN-TR.md`, `VERIF-CS-PV.md`, `VERIF-PA-MO.md` | vérification contradictoire des six rapports |

**Les verdicts de vérification prévalent.** Ils revoient des gravités, fusionnent des doublons (IN-14 ≡ TR-21, IN-17 ≡ TR-18, CS30 ≡ PV-34) et corrigent des références.

Aucune donnée de production identifiante ne figure dans ces fichiers : pas de nom de client ou de technicien, pas de courriel, pas de numéro réel. Les décomptes cités sont des ordres de grandeur relevés en ligne le 28/09.

La synthèse, les questions et les lots sont dans `docs/audit-ergonomie-2026-09-28.md` et `docs/propositions/audit-2026-09-28/lots.md`.
