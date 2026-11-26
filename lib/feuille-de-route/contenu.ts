/**
 * LE CONTENU DE LA FEUILLE DE ROUTE (9IC5-FEUILLE-DE-ROUTE, demande d'Alexis
 * du 02/11/2026) — un module de données, jamais du Markdown : aucune
 * bibliothèque de rendu n'est ajoutée pour un contenu qui tient dans un
 * objet typé.
 *
 * **Mis à jour par les tickets qui livrent, et par le pilote à chaque
 * relance.** Un ticket qui fait passer un élément de « prêt » à « livré »
 * (ou qui en écrit un nouveau) modifie CE fichier ; rien ici ne se déduit
 * du code ou de la base.
 *
 * Les textes ci-dessous sont du CONTENU, pas des clés du dictionnaire
 * (CLAUDE.md §5, point 5) : seuls les libellés d'interface qui les entourent
 * — titre de page, nom de l'entrée de menu, libellés de statut, refus —
 * vivent dans `lib/i18n/fr.ts`.
 */

export type StatutFeuilleDeRoute =
  | "en_cours"
  | "pret"
  | "a_ecrire"
  | "decision"
  | "tranche"
  | "bloque"
  | "livre";

export type ElementFeuilleDeRoute = {
  readonly statut: StatutFeuilleDeRoute;
  readonly titre: string;
};

export type SectionFeuilleDeRoute = {
  readonly titre: string;
  readonly elements: readonly ElementFeuilleDeRoute[];
};

/** La date affichée en sous-titre de la page. */
export const DATE_ETAT_FEUILLE_DE_ROUTE = "26/11/2026";

export const SECTIONS_FEUILLE_DE_ROUTE: readonly SectionFeuilleDeRoute[] = [
  {
    titre: "À écrire après la démo",
    elements: [
      {
        statut: "a_ecrire",
        titre: "Bug des pièces sur l'application technicien (à préciser).",
      },
      {
        statut: "a_ecrire",
        titre:
          "Équipement de prêt — prêter un appareil au client pendant une réparation et suivre le parc de remplacement (prévu en Version 2 au cahier des charges) : besoin à cadrer avec Alexis.",
      },
    ],
  },
  {
    titre: "Application technicien — audit du 10/11/2026",
    elements: [
      {
        statut: "a_ecrire",
        titre:
          "P6 — Compléter le catalogue des prestations par l'import avant la mise en service (geste d'exploitation ; maquette 03-rapport).",
      },
    ],
  },
  {
    titre: "Réserves des revues, à regrouper",
    elements: [
      {
        statut: "a_ecrire",
        titre:
          "Statut machine : écritures simultanées, confirmation de sortie du parc renforcée.",
      },
      {
        statut: "a_ecrire",
        titre:
          "Finitions : liste déroulante sur téléphone (clavier, bas d'écran), écran de changement de mot de passe pour le technicien.",
      },
    ],
  },
  {
    titre: "Décisions prises",
    elements: [
      {
        statut: "tranche",
        titre:
          "Clôture par le technicien : on garde — le technicien termine, le bureau clôture (D271 inchangé). Tranché le 23/11/2026.",
      },
      {
        statut: "tranche",
        titre:
          "Valorisation au coût de la garantie, pour le suivi de rentabilité (9L18) : pas pour l'instant. Tranché le 23/11/2026.",
      },
      {
        statut: "tranche",
        titre:
          "Protection « validation obligatoire » de l'environnement de production sur GitHub (9L22) : on garde ainsi. Tranché le 23/11/2026.",
      },
      {
        statut: "tranche",
        titre:
          "M2 — Fiche en quatre étapes avec une barre d'action fixe : on garde un seul écran qui défile (D161/D212 inchangés). Tranché le 23/11/2026.",
      },
      {
        statut: "tranche",
        titre:
          "Historique des emplacements d'une machine : visible à tout rôle qui voit la fiche (pas seulement l'administration et la direction) ; déplacer la machine réservé au bureau, sans le technicien. Tranché le 23/11/2026 (D280), les deux moitiés livrées — voir « Livré depuis le 31/10 ».",
      },
      {
        statut: "tranche",
        titre:
          "m11 — Bleu pour l'état actif, rouge réservé à l'erreur, sur les cases de la fiche terrain : non retenu, couleurs natives inchangées. Tranché le 23/11/2026 (9L37).",
      },
    ],
  },
  {
    titre: "Bloqué / en enquête",
    elements: [
      {
        statut: "bloque",
        titre:
          "Envoi de courriels : domaine à vérifier chez Resend (aujourd'hui l'envoi ne part que vers l'adresse de l'administrateur).",
      },
      {
        statut: "bloque",
        titre:
          "Bouton « Reprendre » après une suspension, sur le terrain : erreur non expliquée en base (enquêtes 9L08C, 9L08CA, 9L29) ; cause soupçonnée dans la bibliothèque d'accès à la base ; bouton retiré en attendant. Le « Reprendre » du bureau utilise la même fonction : à vérifier en production.",
      },
    ],
  },
  {
    titre: "Livré depuis le 31/10",
    elements: [
      {
        statut: "livre",
        titre:
          "Épreuves et captures manquantes sur 9I8C (fiche machine, bon interne et client, fiche terrain) et 9I8F1 (machine sortie du parc choisie dans une demande ou une intervention) — (9L45).",
      },
      {
        statut: "livre",
        titre:
          "Sécurité : second facteur conservé dans la session neuve après un changement de mot de passe ; limite d'essais sur l'ancien mot de passe, partagée avec celle de la connexion ; trace du changement dans le journal des accès — (9L43).",
      },
      {
        statut: "livre",
        titre:
          "m8, m10b et m13 — En-tête de « Ma journée » et de « Profil » sur une ligne, avec la pastille « En ligne »/« Hors ligne · N saisie(s) en attente » ; « Installer l'application » rangé dans Profil, retiré de « Ma journée » (maquettes 01-journee et 07-profil). Réserve : « Se déconnecter » reste aussi dans le bandeau du haut, commun aux trois coques (N-02, 16/09/2026) — non retiré de là, à trancher avec Alexis s'il doit disparaître du terrain seul — (9L42).",
      },
      {
        statut: "livre",
        titre:
          "M8 — Ma journée : tri par priorité puis par créneau, une intervention en cours ou suspendue en tête ; carte « À faire maintenant » en haut d'écran, en ligne et hors réseau — (9L41).",
      },
      {
        statut: "livre",
        titre:
          "Import Excel du parc : une cellule absente du gabarit (année de fabrication, référence de facture, trois dates) ne remplace plus une valeur saisie à la main — (9L40).",
      },
      {
        statut: "livre",
        titre:
          "Page Matériel, deuxième passe : état actif/inactif écrit en clair dans la liste (bouton ou pas), saisie gardée après un refus de création ou de modification (famille, modèle, sous-type) — (9L39).",
      },
      {
        statut: "livre",
        titre:
          "Historique des emplacements d'une machine, lecture ouverte à tout rôle qui voit la fiche (ADMS, DIR, RM, RS, ADV) — déplacer la machine reste réservé au bureau (D283, 9L38).",
      },
      {
        statut: "livre",
        titre:
          "Gardes en base de 9L19 (chevauchement d'un technicien, segment fermé, annulation, clôture) : les quatre gardes posées, dont l'exemption nommée de l'archive sans temps (D277, 9L19).",
      },
      {
        statut: "livre",
        titre:
          "m12 — Cases à cocher de la fiche terrain (prestation, checklist) à 26 px, cible tactile et couleurs natives inchangées (9L37).",
      },
      {
        statut: "livre",
        titre:
          "M9 — « Annuler le démarrage » pendant 10 secondes : l'intervention revient à « affectée », le segment ouvert est supprimé, aucun temps compté (D282, 9L36).",
      },
      {
        statut: "livre",
        titre:
          "Fiche terrain à 375 px : le libellé « Terminer l'intervention » se lit en entier dans la barre fixe (9L31).",
      },
      {
        statut: "livre",
        titre:
          "Feuille « Terminer l'intervention ? » : épouse son contenu, plus de grand vide au-dessus de « Confirmer la fin » (9L31).",
      },
      {
        statut: "livre",
        titre:
          "Checklist : un point chiffré garde la même mise en page, avec ou sans « Dernier relevé » (9L31).",
      },
      {
        statut: "livre",
        titre:
          "Affichage des montants réglable par société ; règle de facturation du temps réglable et figée à la clôture.",
      },
      {
        statut: "livre",
        titre:
          "Conditions de facturation sans montant sur l'écran de signature et le bon ; mention de majoration corrigée.",
      },
      {
        statut: "livre",
        titre:
          "Année de fabrication et garantie sur la fiche, le bon et l'application technicien.",
      },
      {
        statut: "livre",
        titre:
          "Sécurité des liens d'accès entre sociétés (refus sans panne) ; mentions légales.",
      },
      {
        statut: "livre",
        titre:
          "Listes déroulantes et plafond de 50 pièces ; statut de la machine modifiable, avec garde serveur.",
      },
      {
        statut: "livre",
        titre:
          "Écran « Mon compte » ; changer son mot de passe ferme les autres sessions.",
      },
      {
        statut: "livre",
        titre:
          "Réinitialisation du second facteur par un administrateur ; écran d'arrivée hors du back-office.",
      },
      { statut: "livre", titre: "Refonte de la page Paramètres › Matériel." },
      {
        statut: "livre",
        titre: "Installer l'application sur le téléphone.",
      },
      {
        statut: "livre",
        titre:
          "Réinitialisation du second facteur interdite sur une personne qui a aussi accès à une autre société.",
      },
      {
        statut: "livre",
        titre:
          "Correctifs courts issus des revues (règle D127 en entier, écran Équipe par paquets de 5, preuve du scanner hors réseau, bandeau au-dessus du planning).",
      },
      {
        statut: "livre",
        titre: "Page « Feuille de route » réservée aux administrateurs.",
      },
      {
        statut: "livre",
        titre:
          "Mesure des échanges avec la base sur les pages principales, correctifs sur les plus lentes (9ID).",
      },
      {
        statut: "livre",
        titre:
          "Règle « PARCOURS-1 » écrite au registre des décisions : une intervention ne porte qu'une machine au plus (9J01, D228).",
      },
      {
        statut: "livre",
        titre:
          "Portail client : le client invite ses contacts, dépose une demande, voit la fiche de sa machine et l'état de ses interventions, et télécharge le bon après clôture (9J03 à 9J07).",
      },
      {
        statut: "livre",
        titre:
          "Portail client : historique daté de chaque changement d'état, notifications internes (dont l'alerte de signature manquante), suites à donner avec relances, barème publié sans montant d'intervention (9J08A, 9J08B, 9J09 à 9J11, 9J17 à 9J20).",
      },
      {
        statut: "livre",
        titre:
          "Portail client : invitation sécurisée d'une identité déjà connue d'une autre société, révocation immédiate, verrou applicatif qui ferme la base au compte client (9K01, 9K14 à 9K16).",
      },
      {
        statut: "livre",
        titre:
          "Checklists adaptées au type d'intervention et au sous-type de matériel, modèles rattachés par table de liaison, dernier relevé rappelé en rubrique, réponse par photo, retrait d'une réponse déjà donnée (9K08, 9K17 à 9K30).",
      },
      {
        statut: "livre",
        titre:
          "Prestations proposées selon le type d'intervention, et filtrées par famille de matériel (9K29, 9L04J).",
      },
      {
        statut: "livre",
        titre:
          "Fiche terrain « épurée » : style, checklist, photos, rapport à phrases types, récapitulatif de signature, zone de signature agrandie avec le nom du signataire prérempli (9L04C à 9L04M).",
      },
      {
        statut: "livre",
        titre:
          "Alerte de fin d'intervention sans signature toujours adressée à quelqu'un ; « Terminer » exige un commentaire et dit ce qui manque avant de s'activer (9K26, 9K27).",
      },
      {
        statut: "livre",
        titre:
          "Toute minute commencée compte sur le temps total de l'intervention ; suspendre arrête le compteur ; seuls le responsable et l'ADV corrigent le temps à la clôture (9L06, 9L13, 9L15).",
      },
      {
        statut: "livre",
        titre:
          "Tout est figé à la clôture, en base : une saisie terrain arrivée après est gardée à part et signalée à l'ADV, jamais appliquée (9L14).",
      },
      {
        statut: "livre",
        titre:
          "La checklist, le rapport, les prestations et la signature ne se saisissent qu'après le démarrage de l'intervention (9L08B).",
      },
      {
        statut: "livre",
        titre:
          "Majoration hors ouverture réglable par société et figée à la clôture ; le temps facturé ne descend jamais à zéro (9L12, 9L27).",
      },
      {
        statut: "livre",
        titre:
          "Le bon d'une intervention close relit sa valorisation figée, jamais le barème du jour (9L17).",
      },
      {
        statut: "livre",
        titre:
          "Cinq échecs de mot de passe déclenchent un refus temporisé de quinze minutes ; en-têtes de sécurité HTTP durcis (9L07, 9L08A).",
      },
      {
        statut: "livre",
        titre:
          "Réinitialiser un second facteur ou choisir un mot de passe par lien ferme les sessions déjà ouvertes du compte (9L09).",
      },
      {
        statut: "livre",
        titre:
          "Retirer l'accès d'un compte interne désactive la ligne sans la supprimer ; réaccorder l'accès la réactive (9L03A, 9L04K).",
      },
      {
        statut: "livre",
        titre:
          "Création d'une intervention directe : exige qualifier puis affecter, jamais une demande portail (9L10).",
      },
      {
        statut: "livre",
        titre:
          "L'état de la machine se change aussi depuis la fiche machine, et dès la saisie de la demande ou de l'intervention (9I8F).",
      },
      {
        statut: "livre",
        titre:
          "« Changer de technicien » refuse le chevauchement et exige un technicien actif de la société (9L02).",
      },
      {
        statut: "livre",
        titre:
          "Déplacer une machine entre sites ou agences (9L20), réservé au bureau depuis 9L34 (D280) : le technicien ne déplace plus jamais une machine.",
      },
      {
        statut: "livre",
        titre:
          "CI durcie : les flux qui écrivent sur une base réelle épinglent leurs actions et portent un environnement de production (9L22).",
      },
      {
        statut: "livre",
        titre:
          "Écran de réglage du pourcentage de majoration hors ouverture, par société, borné 0 à 200 en base (9L33, complète D269).",
      },
      {
        statut: "livre",
        titre:
          "Un nouveau lien d'accès (premier accès ou mot de passe oublié) annule les liens antérieurs non utilisés du même compte (9L35, D281, complète D266).",
      },
    ],
  },
];
