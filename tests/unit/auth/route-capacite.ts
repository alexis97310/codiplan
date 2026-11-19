import { type Capacite } from "@/lib/auth/habilitations";

/**
 * D-12 / 9L24-ROUTES-SANS-CAPACITE — LA CORRESPONDANCE ROUTE → CAPACITÉ,
 * SOURCE UNIQUE.
 *
 * Extrait de `tests/unit/auth/porte.test.ts` (D-12) pour que
 * `tests/isolation/9l24-routes-sans-capacite.test.ts` — qui APPELLE chaque
 * route sous un rôle sans la capacité — lise exactement la même table que le
 * gardien qui la mesure par le TEXTE du source, jamais une copie qui aurait
 * divergé en silence. `porte.test.ts` reste le seul fichier qui MESURE cette
 * table contre le disque (`ROUTES`, `CHEMINS_EXISTANTS`, `EXEMPTIONS`) ; ce
 * module-ci ne porte que les deux constantes elles-mêmes.
 */

// ── LA CORRESPONDANCE ROUTE → CAPACITÉ, CHAQUE LIGNE VENANT DU §5.2 ─────────

export const ROUTE_CAPACITE: Readonly<Record<string, Capacite>> = {
  // « Administrer les utilisateurs » — et D37 : admin_societe administre les
  // comptes, les agences ET LES HABILITATIONS de sa société.
  "app/api/habilitations/creer/route.ts": "administrer_utilisateurs",
  "app/api/habilitations/[id]/modifier/route.ts": "administrer_utilisateurs",
  "app/api/habilitations/[id]/activite/route.ts": "administrer_utilisateurs",
  "app/api/habilitations/attributions/creer/route.ts":
    "administrer_utilisateurs",
  "app/api/habilitations/attributions/[id]/retirer/route.ts":
    "administrer_utilisateurs",
  // D153 (03/10/2026, TP-S3) — une exigence porte sur UN SITE, au même titre
  // que `gerer_client_site` : ce n'est plus une habilitation d'utilisateur.
  "app/api/habilitations/exigences/creer/route.ts": "gerer_client_site",
  "app/api/habilitations/exigences/[id]/retirer/route.ts": "gerer_client_site",
  "app/api/techniciens/creer/route.ts": "administrer_utilisateurs",
  "app/api/techniciens/[id]/modifier/route.ts": "administrer_utilisateurs",
  // D162 (04/10/2026, 9DJ-TP-ACC1-DONNER-ACCES, QT-1) — donner l'accès à un
  // technicien est un geste sur les UTILISATEURS de la société, même capacité
  // que créer ou modifier une fiche d'Équipe.
  "app/api/equipe/[id]/envoyer-acces/route.ts": "administrer_utilisateurs",
  // D86 (13/10/2026, décision n° 86 d'Alexis, point 3 de
  // 9EXA-EQUIPE-TECHNICIENS-MAQUETTE) — « Envoyer un nouveau lien d'accès »
  // (mot de passe oublié) depuis le menu « … » d'un accès déjà actif, même
  // capacité que le premier envoi.
  "app/api/equipe/[id]/nouveau-lien/route.ts": "administrer_utilisateurs",
  // D170 (29/10/2026, 9I6B-LIEN-ACCES-A-COPIER) — « Copier le lien d'accès »,
  // sans nom de domaine pour l'envoyer par courriel : même capacité que
  // l'envoi, pour les deux mêmes chemins (premier lien, nouveau lien).
  "app/api/equipe/[id]/copier-lien/route.ts": "administrer_utilisateurs",
  "app/api/equipe/[id]/copier-nouveau-lien/route.ts":
    "administrer_utilisateurs",
  // 9L03C (décision d'Alexis du 10/11/2026 puis du 13/11/2026) — « Retirer
  // l'accès », une seule route pour les deux onglets d'Équipe.
  "app/api/equipe/[id]/retirer-acces/route.ts": "administrer_utilisateurs",
  // 9L04K-REACTIVER-ACCES-INTERNE — son symétrique, « Rétablir l'accès ».
  "app/api/equipe/[id]/retablir-acces/route.ts": "administrer_utilisateurs",
  // D196 (12/10/2026, 9ET-COMPTES-BUREAU-1) — créer un compte de bureau ou lui
  // envoyer un lien d'accès, même capacité que le chemin technicien ci-dessus.
  "app/api/equipe/bureau/creer/route.ts": "administrer_utilisateurs",
  "app/api/equipe/bureau/[id]/envoyer-acces/route.ts":
    "administrer_utilisateurs",
  "app/api/equipe/bureau/[id]/nouveau-lien/route.ts":
    "administrer_utilisateurs",
  "app/api/equipe/bureau/[id]/copier-lien/route.ts": "administrer_utilisateurs",
  "app/api/equipe/bureau/[id]/copier-nouveau-lien/route.ts":
    "administrer_utilisateurs",
  // 9EY-EQUIPE-ALERTE-TOUT-ENVOYER, point 1 — « Tout envoyer » et
  // « Renouveler <CODE> », même capacité que le reste d'Équipe et des
  // habilitations.
  "app/api/equipe/envoyer-acces/tous/route.ts": "administrer_utilisateurs",
  "app/api/habilitations/attributions/[id]/renouveler/route.ts":
    "administrer_utilisateurs",
  // « Créer / modifier une machine ».
  "app/api/machines/creer/route.ts": "gerer_machine",
  "app/api/machines/[id]/modifier/route.ts": "gerer_machine",
  "app/api/machines/[id]/changer-statut/route.ts": "gerer_machine",
  // « Déplacer la machine » (9L20-DEPLACER-MACHINE).
  "app/api/machines/[id]/deplacer/route.ts": "gerer_machine",
  // « Créer / modifier un client ou un site » (D130).
  "app/api/clients/creer/route.ts": "gerer_client_site",
  "app/api/clients/[id]/modifier/route.ts": "gerer_client_site",
  // Le doublon possible à la création (9EK-TP-UX5-2-CREATIONS-1, CS40) — même
  // capacité que la création elle-même : une lecture dédiée, pas un
  // sélecteur partagé.
  "app/api/clients/homonymes/route.ts": "gerer_client_site",
  // D230 (05/11/2026, 9J02A-REPRISE-9J02) — inviter un client au portail ouvre
  // souvent une identité : même capacité que toute ouverture d'identité
  // (technicien, compte de bureau), PAS `gerer_client_site` malgré D130.
  "app/api/clients/[id]/inviter/route.ts": "administrer_utilisateurs",
  "app/api/clients/[id]/revoquer-acces/route.ts": "administrer_utilisateurs",
  // D223/D226 appliquées (9K14-PORTAIL-COPIER-NOUVEAU-LIEN, backlog B7) —
  // même capacité que l'invitation et la révocation ci-dessus.
  "app/api/clients/[id]/comptes/[utilisateurId]/copier-nouveau-lien/route.ts":
    "administrer_utilisateurs",
  "app/api/sites/creer/route.ts": "gerer_client_site",
  "app/api/sites/[id]/modifier/route.ts": "gerer_client_site",
  // Un interlocuteur est un attribut du client, pas un objet à part
  // (CONTACTS-1) : même capacité que les quatre routes ci-dessus.
  "app/api/contacts/creer/route.ts": "gerer_client_site",
  "app/api/contacts/[id]/modifier/route.ts": "gerer_client_site",
  "app/api/contacts/[id]/activite/route.ts": "gerer_client_site",
  // 9L10-CREER-INTERVENTION-QUALIFIER (décision d'Alexis du 10/11/2026) —
  // créer directement une intervention est le même geste que qualifier une
  // demande (D151), jamais celui de déposer une demande : le technicien et
  // le client, qui possèdent `creer_demande`, sont refusés ici.
  "app/api/interventions/creer/route.ts": "qualifier_affecter",
  // « Créer une demande » — « + Demande » (D188,
  // 9EDZ-DEMANDES-CONNEXION-MAQUETTE), le volet de /demandes dépose
  // directement. Depuis 9L10, sa capacité diverge de celle de la création
  // d'intervention ci-dessus : déposer une demande n'est plus le même geste
  // que créer directement une intervention.
  "app/api/demandes/creer/route.ts": "creer_demande",
  // D151 (03/10/2026, décision du 03/10 point 3) — les QUATRE ACTIONS d'une
  // demande relèvent de « Qualifier / affecter » (CDC §5.2), jamais de la
  // création : REVIENT sur le choix d'origine de DEMANDES-1 (`creer_demande`,
  // « qualifier une demande, c'est décider qu'on va intervenir »).
  "app/api/demandes/[id]/accuser/route.ts": "qualifier_affecter",
  "app/api/demandes/[id]/qualifier/route.ts": "qualifier_affecter",
  "app/api/demandes/[id]/transformer/route.ts": "qualifier_affecter",
  "app/api/demandes/[id]/clore/route.ts": "qualifier_affecter",
  // « Qualifier / affecter ». Rattacher une machine après coup (chantier
  // INT-MACHINE 2.2, 20/09/2026) qualifie l'intervention au même titre
  // qu'affecter un technicien — arbitrage de ce lot, voir la PR.
  "app/api/interventions/[id]/affecter/route.ts": "qualifier_affecter",
  "app/api/interventions/[id]/machine/route.ts": "qualifier_affecter",
  // « Modifier le planning » — une absence déplace du planning au même titre
  // qu'un déplacement d'intervention.
  "app/api/interventions/[id]/deplacer/route.ts": "modifier_planning",
  // « TRANSMETTRE » (QG-5, D141, 9CO-PG-G14A-TRANSMETTRE) — MÊME capacité que
  // « Déplacer » : c'est elle qui planifie, et transmettre est la suite du
  // même geste (Planifiée → Affectée).
  "app/api/interventions/[id]/transmettre/route.ts": "modifier_planning",
  // TRANSMETTRE EN GROUPE (QG-5, D141, 9CP-PG-G14B-TRANSMETTRE-GROUPE) — MÊME
  // capacité que la transmission unitaire ci-dessus : « Transmettre demain »
  // et « Transmettre toutes les planifiées prêtes » restent le même geste,
  // posé sur plusieurs lignes à la fois.
  "app/api/interventions/transmettre/route.ts": "modifier_planning",
  // Le verdict d'une pose, en LECTURE SEULE (PG-B1) — même capacité que
  // « Déplacer » : qui peut déplacer peut lire le verdict qu'il obtiendrait.
  "app/api/interventions/[id]/verdict-pose/route.ts": "modifier_planning",
  // LE RÉSUMÉ DU TIROIR, EN LECTURE SEULE (PG-C5-TIROIR) — la même capacité
  // que la page `/planning` elle-même : tout rôle qui voit le planning peut
  // lire le tiroir d'une de ses cartes, y compris `TEC` en périmètre
  // restreint.
  "app/api/interventions/[id]/resume/route.ts": "consulter_planning",
  // LA COPIE QUE LE TÉLÉPHONE EMPORTE (9F4H1, point 2) — même capacité que
  // la page `/terrain` elle-même, relue au périmètre RESTREINT ensuite (voir
  // le docblock de la route) : un rôle à accès complet n'a rien à emporter.
  "app/api/terrain/instantane/route.ts": "consulter_planning",
  "app/api/absences/declarer/route.ts": "modifier_planning",
  "app/api/absences/lever/route.ts": "modifier_planning",
  // ÉCOURTER (QT-15, D136) — même capacité, et même porte COMPLÈTE que
  // « Lever »/« Supprimer » : le ○ du technicien, ajouté pour qu'il déclare
  // SA PROPRE absence, ne lui ouvre ni l'écourtement ni la suppression (TR-5).
  "app/api/absences/ecourter/route.ts": "modifier_planning",
  // La note interne (50-INTERVENTIONS-2) — même capacité que « Déplacer » /
  // « Planifier » sur cette même fiche : aucune ne compte le rôle terrain
  // (`TEC`), à la différence de `consulter_planning` qui l'accorde en
  // « restreint ». La réutiliser évite d'ouvrir, par une requête forgée, une
  // écriture que le technicien ne voit jamais à l'écran.
  "app/api/interventions/[id]/note-interne/route.ts": "modifier_planning",
  // QUALIFIER UNE SUITE À DONNER (9J18-SUITE-A-DONNER-ECRAN) — même capacité
  // que « Déplacer »/« Planifier » sur le registre lui-même : qualifier
  // n'est accessible qu'à qui peut déjà écrire sur le planning.
  "app/api/interventions/suites-a-donner/qualifier/route.ts":
    "modifier_planning",
  // CONFIRMER LE DÉPLACEMENT DE LA REPRISE (9J18-SUITE-A-DONNER-ECRAN,
  // FLX-6/7/11) — même capacité que la qualification ci-dessus.
  "app/api/interventions/suites-a-donner/[id]/replanifier/route.ts":
    "modifier_planning",
  // L'ADV MÈNE LE DOSSIER DE BOUT EN BOUT (9K05-SUITES-A-DONNER-DEBLOQUEES,
  // DÉCISION D'ALEXIS du 08/11/2026) — les trois gestes neufs, même capacité
  // que les deux ci-dessus.
  "app/api/interventions/suites-a-donner/[id]/devis-envoye/route.ts":
    "modifier_planning",
  "app/api/interventions/suites-a-donner/[id]/accord/route.ts":
    "modifier_planning",
  "app/api/interventions/suites-a-donner/[id]/piece-recue/route.ts":
    "modifier_planning",
  // « Importer / exporter en masse ».
  "app/api/imports/controler/route.ts": "importer_exporter",
  "app/api/imports/[id]/appliquer/route.ts": "importer_exporter",
  "app/api/imports/[id]/annuler/route.ts": "importer_exporter",
  "app/api/imports/[id]/rejets/route.ts": "importer_exporter",
  // MO-9 (D169) — les trois exports `.xlsx`, chacun gardé comme D150 : la
  // porte n'exige ici qu'`importer_exporter` ; la seconde capacité (la
  // lecture de l'écran — `consulter_planning`, `consulter_parc_complet`)
  // est un `peut()` posé juste après, hors de la portée de ce gardien
  // (qui ne voit que le PREMIER `exigerCapacite` de chaque route).
  "app/api/interventions/exporter/route.ts": "importer_exporter",
  "app/api/parc/exporter/route.ts": "importer_exporter",
  "app/api/vgp/exporter/route.ts": "importer_exporter",
  // « Paramétrer une société » — les treize routes de taux, forfaits,
  // matériel et prestations (D153, TP-S3) : elles appellent désormais
  // `exigerCapaciteComplete`, le ○ de la direction (PA-02) n'y donnant plus
  // que la lecture. Agences, plages, pas et trajets ont leur propre capacité,
  // juste après.
  "app/api/parametres/taux-horaire/creer/route.ts": "parametrer_societe",
  "app/api/parametres/forfaits/creer/route.ts": "parametrer_societe",
  "app/api/parametres/forfaits/[id]/activite/route.ts": "parametrer_societe",
  "app/api/parametres/forfaits/[id]/modifier/route.ts": "parametrer_societe",
  "app/api/parametres/materiel/familles/creer/route.ts": "parametrer_societe",
  "app/api/parametres/materiel/familles/[id]/activite/route.ts":
    "parametrer_societe",
  "app/api/parametres/materiel/familles/[id]/modifier/route.ts":
    "parametrer_societe",
  "app/api/parametres/materiel/modeles/creer/route.ts": "parametrer_societe",
  "app/api/parametres/materiel/modeles/[id]/activite/route.ts":
    "parametrer_societe",
  "app/api/parametres/materiel/modeles/[id]/modifier/route.ts":
    "parametrer_societe",
  "app/api/parametres/materiel/sous-types/creer/route.ts": "parametrer_societe",
  "app/api/parametres/materiel/sous-types/[id]/activite/route.ts":
    "parametrer_societe",
  "app/api/parametres/materiel/sous-types/[id]/modifier/route.ts":
    "parametrer_societe",
  // 9K19-CHECKLIST-PARAMETRAGE (CK3) — créer un modèle, publier une
  // version, basculer son activité : même capacité que le reste du
  // paramétrage de société.
  "app/api/parametres/checklists/creer/route.ts": "parametrer_societe",
  "app/api/parametres/checklists/[id]/publier/route.ts": "parametrer_societe",
  "app/api/parametres/checklists/[id]/activite/route.ts": "parametrer_societe",
  // 9K20-CHECKLIST-DUPLIQUER-DEPART — dupliquer un modèle, partir d'un
  // gabarit de départ : même capacité que le reste du paramétrage.
  "app/api/parametres/checklists/[id]/dupliquer/route.ts": "parametrer_societe",
  "app/api/parametres/checklists/gabarit/route.ts": "parametrer_societe",
  "app/api/parametres/prestations/creer/route.ts": "parametrer_societe",
  "app/api/parametres/prestations/[id]/activite/route.ts": "parametrer_societe",
  "app/api/parametres/prestations/[id]/modifier/route.ts": "parametrer_societe",
  // 9EZ-LOGO-SOCIETE-1 (D87) — dépôt et retrait du logo, même capacité et
  // même porte complète que le reste du paramétrage de société.
  "app/api/parametres/societe/logo/route.ts": "parametrer_societe",
  "app/api/parametres/societe/logo/retirer/route.ts": "parametrer_societe",
  // 9I7A-MENTIONS-LEGALES-MODIFIABLES — même capacité et même porte complète
  // que le logo, juste au-dessus : le texte du pied des documents.
  "app/api/parametres/societe/mentions-legales/route.ts": "parametrer_societe",
  // 9I8-AFFICHAGE-DES-MONTANTS — même capacité et même porte complète que le
  // logo et les mentions légales : exactement ADMS/DIR dans la matrice, sans
  // garde supplémentaire.
  "app/api/parametres/societe/afficher-montants/route.ts": "parametrer_societe",
  // 9I8A1-REPRISE-9I8A — même capacité et même porte complète : ADMS/DIR
  // seuls, aucune garde supplémentaire.
  "app/api/parametres/tarifs/regle-facturation/route.ts": "parametrer_societe",
  // 9J19-SUITE-A-DONNER-NOTIFICATIONS — même capacité et même porte
  // complète que le logo et les montants : ADMS/DIR seuls.
  "app/api/parametres/societe/delai-relance-suite/route.ts":
    "parametrer_societe",
  // D153 (03/10/2026, TP-S3, choix du pilote) — plages, pas et agences
  // relèvent d'« Administrer les agences », jamais de « Paramétrer une
  // société » : ADMS, et depuis D199 la direction au même ● qu'ADMS.
  "app/api/parametres/plages/ajouter/route.ts": "administrer_agences",
  "app/api/parametres/plages/[id]/modifier/route.ts": "administrer_agences",
  "app/api/parametres/plages/[id]/supprimer/route.ts": "administrer_agences",
  "app/api/parametres/agences/creer/route.ts": "administrer_agences",
  "app/api/parametres/agences/[id]/modifier/route.ts": "administrer_agences",
  "app/api/parametres/pas-creneau/route.ts": "administrer_agences",
  // D153 (03/10/2026, TP-S3, décision PA-25/D107) — nouvelle capacité
  // `regler_trajets` (ADMS + ADV, direction en lecture seule) : voir
  // `lib/auth/habilitations.ts`.
  "app/api/parametres/trajet-zone/route.ts": "regler_trajets",
  // « Saisir un rapport ».
  "app/api/terrain/[id]/compteur/route.ts": "saisir_rapport",
  // Le rapport de terrain (ticket 17-BON-2) : commentaire, suite à donner,
  // prestations réalisées, photos, signature — même capacité que le
  // compteur, même porte.
  "app/api/terrain/[id]/rapport/route.ts": "saisir_rapport",
  "app/api/terrain/[id]/prestations/route.ts": "saisir_rapport",
  "app/api/terrain/[id]/photos/route.ts": "saisir_rapport",
  // Suppression et légende d'une photo (9L04E-TERRAIN-PHOTOS-EPUREES) —
  // même capacité, même porte que le dépôt lui-même.
  "app/api/terrain/[id]/photos/supprimer/route.ts": "saisir_rapport",
  "app/api/terrain/[id]/photos/legende/route.ts": "saisir_rapport",
  "app/api/terrain/[id]/signature/route.ts": "saisir_rapport",
  // Terminer (9DE-TP-CY1) — même capacité, même porte.
  "app/api/terrain/[id]/terminer/route.ts": "saisir_rapport",
  // « J'attends une pièce » (9K13-TERRAIN-ATTENTE-PIECE) — même capacité,
  // même porte ; `suspendreIntervention` revérifie ensuite
  // `suspendre_reprendre_intervention` SUR CETTE intervention (D131).
  "app/api/terrain/[id]/suspendre/route.ts": "saisir_rapport",
  // La saisie des réponses de checklist (9K18-CHECKLIST-DOMAINE) — même
  // porte que le rapport et la signature.
  "app/api/terrain/[id]/checklist/route.ts": "saisir_rapport",
  // Les octets d'un document (BON-2) : une LECTURE, protégée par la même
  // capacité que le bon lui-même — pas une capacité neuve pour un octet
  // qu'une lecture cloisonnée protège déjà.
  "app/api/documents/[id]/octets/route.ts": "consulter_planning",
  // D131 (23/09/2026, DROITS-1) — les cinq routes qui ÉCRIVAIENT sans aucune
  // capacité exigée (mesure du 23/09, ticket DROITS-1) : n'importe quel
  // compte de la société, technicien compris, pouvait clôturer, annuler,
  // suspendre, reprendre ou enregistrer une VGP sur l'intervention ou la
  // machine d'un collègue. Le ○ du technicien passe la porte ; le dépôt
  // appelé ensuite juge le PÉRIMÈTRE (SES interventions affectées) — la
  // porte ne le juge jamais (voir `lib/auth/porte.ts`).
  "app/api/interventions/[id]/cloturer/route.ts": "cloturer_intervention",
  // RG-INT-03 (D135, 9H1) — `valider_rapport` n'a AUCUNE ligne `restreint` :
  // ni l'ADV ni le technicien n'atteignent cette route, contrairement à
  // « clôturer » juste au-dessus.
  "app/api/interventions/[id]/valider-rapport/route.ts": "valider_rapport",
  "app/api/interventions/[id]/annuler/route.ts": "annuler_intervention",
  "app/api/interventions/[id]/suspendre/route.ts":
    "suspendre_reprendre_intervention",
  "app/api/interventions/[id]/reprendre/route.ts":
    "suspendre_reprendre_intervention",
  "app/api/vgp/enregistrer/[id]/route.ts": "enregistrer_vgp",
};

/**
 * LES ROUTES QUI DOIVENT FERMER LE ○ — `exigerCapaciteComplete`, JAMAIS
 * `exigerCapacite` SIMPLE (D153, TP-S3, condition de réouverture ~:5545 de
 * `docs/arbitrages.md`). `capaciteAppelee` ci-dessus reconnaît les deux
 * portes sans distinguer LAQUELLE est appelée : cette liste, et le test qui
 * la lit, est ce qui rend la condition de réouverture vérifiable. Les treize
 * routes de taux, forfaits, matériel et prestations, plus `trajet-zone`
 * (A1, 9DX-RETOUCHES-11 — PA-25 est la même lecture seule que PA-02).
 */
export const PORTE_COMPLETE: readonly string[] = [
  "app/api/parametres/taux-horaire/creer/route.ts",
  "app/api/parametres/forfaits/creer/route.ts",
  "app/api/parametres/forfaits/[id]/activite/route.ts",
  "app/api/parametres/forfaits/[id]/modifier/route.ts",
  "app/api/parametres/materiel/familles/creer/route.ts",
  "app/api/parametres/materiel/familles/[id]/activite/route.ts",
  "app/api/parametres/materiel/familles/[id]/modifier/route.ts",
  "app/api/parametres/materiel/modeles/creer/route.ts",
  "app/api/parametres/materiel/modeles/[id]/activite/route.ts",
  "app/api/parametres/materiel/modeles/[id]/modifier/route.ts",
  "app/api/parametres/materiel/sous-types/creer/route.ts",
  "app/api/parametres/materiel/sous-types/[id]/activite/route.ts",
  "app/api/parametres/materiel/sous-types/[id]/modifier/route.ts",
  // 9K19-CHECKLIST-PARAMETRAGE (CK3) — même doctrine : ADMS/DIR seuls.
  "app/api/parametres/checklists/creer/route.ts",
  "app/api/parametres/checklists/[id]/publier/route.ts",
  "app/api/parametres/checklists/[id]/activite/route.ts",
  // 9K20-CHECKLIST-DUPLIQUER-DEPART — même doctrine : ADMS/DIR seuls.
  "app/api/parametres/checklists/[id]/dupliquer/route.ts",
  "app/api/parametres/checklists/gabarit/route.ts",
  "app/api/parametres/prestations/creer/route.ts",
  "app/api/parametres/prestations/[id]/activite/route.ts",
  "app/api/parametres/prestations/[id]/modifier/route.ts",
  "app/api/parametres/trajet-zone/route.ts",
  // 9EZ-LOGO-SOCIETE-1 (D87) — même doctrine : ADMS/DIR seuls, aucun ○.
  "app/api/parametres/societe/logo/route.ts",
  "app/api/parametres/societe/logo/retirer/route.ts",
  // 9I7A-MENTIONS-LEGALES-MODIFIABLES — même doctrine.
  "app/api/parametres/societe/mentions-legales/route.ts",
  // 9I8-AFFICHAGE-DES-MONTANTS — même doctrine : ADMS/DIR seuls, aucun ○.
  "app/api/parametres/societe/afficher-montants/route.ts",
  // 9I8A1-REPRISE-9I8A — même doctrine : ADMS/DIR seuls, aucun ○.
  "app/api/parametres/tarifs/regle-facturation/route.ts",
  // 9J19-SUITE-A-DONNER-NOTIFICATIONS — même doctrine : ADMS/DIR seuls.
  "app/api/parametres/societe/delai-relance-suite/route.ts",
  // 9DKA-REPRISE-9DK, TR-5/D136 — le ○ du technicien sur `modifier_planning`
  // n'ouvre que la déclaration de SA PROPRE absence ; ces sept routes ferment
  // désormais le ○ pour que « Déplacer », « Transmettre », la note interne et
  // les écritures sur une absence déjà posée restent réservées à l'accès
  // complet (9D3-PLANNING-TECHNICIEN-ACTIONS en tire la conséquence côté
  // écran : ces lectures passent à `peutPleinement`).
  "app/api/interventions/[id]/deplacer/route.ts",
  "app/api/interventions/[id]/transmettre/route.ts",
  "app/api/interventions/transmettre/route.ts",
  "app/api/interventions/[id]/verdict-pose/route.ts",
  "app/api/interventions/[id]/note-interne/route.ts",
  "app/api/absences/ecourter/route.ts",
  "app/api/absences/lever/route.ts",
  // QUALIFIER UNE SUITE À DONNER (9J18-SUITE-A-DONNER-ECRAN) — même porte
  // complète que « Déplacer »/« Planifier » ci-dessus : aucun ○ technicien
  // n'a de raison de qualifier une suite à donner.
  "app/api/interventions/suites-a-donner/qualifier/route.ts",
  "app/api/interventions/suites-a-donner/[id]/replanifier/route.ts",
  // L'ADV MÈNE LE DOSSIER DE BOUT EN BOUT (9K05-SUITES-A-DONNER-DEBLOQUEES)
  // — même porte complète, même raison.
  "app/api/interventions/suites-a-donner/[id]/devis-envoye/route.ts",
  "app/api/interventions/suites-a-donner/[id]/accord/route.ts",
  "app/api/interventions/suites-a-donner/[id]/piece-recue/route.ts",
];
