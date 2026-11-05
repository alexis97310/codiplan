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
  "en_cours" | "pret" | "a_ecrire" | "decision" | "bloque" | "livre";

export type ElementFeuilleDeRoute = {
  readonly statut: StatutFeuilleDeRoute;
  readonly titre: string;
};

export type SectionFeuilleDeRoute = {
  readonly titre: string;
  readonly elements: readonly ElementFeuilleDeRoute[];
};

/** La date affichée en sous-titre de la page. */
export const DATE_ETAT_FEUILLE_DE_ROUTE = "03/11/2026";

export const SECTIONS_FEUILLE_DE_ROUTE: readonly SectionFeuilleDeRoute[] = [
  {
    titre: "Déjà écrits, en attente",
    elements: [
      {
        statut: "pret",
        titre:
          "9ID — Performances : mesurer les échanges avec la base sur chaque page principale, corriger les pires.",
      },
      {
        statut: "pret",
        titre:
          "9J01 — Documentation : écrire la règle « PARCOURS-1 » dans le registre des décisions.",
      },
      {
        statut: "en_cours",
        titre:
          "Portail client (9J02 à 9J08, 9J20) — Inviter un client par lien (livré, 9J02A), ses contacts, déposer une demande, fiche machine, état de ses interventions, bon téléchargeable après clôture, barème sans montant d'intervention.",
      },
      {
        statut: "pret",
        titre:
          "Historique des états (9J08A, 9J08B) — Date de chaque changement d'état ; le client voit le temps de traitement.",
      },
      {
        statut: "pret",
        titre:
          "Notifications internes (9J09 à 9J11) — Page de notifications ; premier déclencheur : signature absente ou refusée.",
      },
      {
        statut: "pret",
        titre:
          "Checklist par type (9J12 à 9J16) — Le bon adapté au type d'intervention et à la machine (à revoir après l'atelier « bon par type »).",
      },
      {
        statut: "pret",
        titre:
          "Suites à donner (9J17 à 9J19) — Devis, accord, pièce à commander, avec relances.",
      },
    ],
  },
  {
    titre: "À écrire après la démo",
    elements: [
      {
        statut: "a_ecrire",
        titre:
          "Figer l'application technicien dès « terminée » (aujourd'hui seulement à la clôture).",
      },
      {
        statut: "a_ecrire",
        titre:
          "État des lieux complet de l'application technicien, puis atelier : ce que contient un bon pour chaque type d'intervention (prestations proposées selon le type).",
      },
      {
        statut: "a_ecrire",
        titre: "Bug des pièces sur l'application technicien (à préciser).",
      },
      {
        statut: "a_ecrire",
        titre:
          "Page Matériel, deuxième passe : état actif ou inactif écrit en clair, saisie gardée après un refus, famille présélectionnée.",
      },
      {
        statut: "a_ecrire",
        titre:
          "Import Excel : ne plus effacer l'année de fabrication saisie à la main.",
      },
      {
        statut: "a_ecrire",
        titre:
          "Équipement de prêt — prêter un appareil au client pendant une réparation et suivre le parc de remplacement (prévu en Version 2 au cahier des charges) : besoin à cadrer avec Alexis.",
      },
    ],
  },
  {
    titre: "Réserves des revues, à regrouper",
    elements: [
      {
        statut: "a_ecrire",
        titre:
          "Sécurité : second facteur recopié dans la session neuve après un changement de mot de passe ; limite d'essais sur l'ancien mot de passe ; trace du changement dans le journal.",
      },
      {
        statut: "a_ecrire",
        titre:
          "Statut machine : écritures simultanées, confirmation de sortie du parc renforcée.",
      },
      {
        statut: "a_ecrire",
        titre: "Épreuves et captures manquantes sur 9I8C et 9I8F1.",
      },
      {
        statut: "a_ecrire",
        titre:
          "Finitions : liste déroulante sur téléphone (clavier, bas d'écran), écran de changement de mot de passe pour le technicien.",
      },
    ],
  },
  {
    titre: "Décisions en attente",
    elements: [
      {
        statut: "decision",
        titre:
          "« Copier un nouveau lien » refusé pour tous en production : A, un rôle dédié en base (geste dans Neon) ; ou B, ouvrir deux colonnes au rôle de consolidation (modifier D21).",
      },
      {
        statut: "decision",
        titre:
          "Réinitialisation du second facteur : protéger aussi la direction et les administrateurs ? Fermer les sessions de la personne visée ?",
      },
      {
        statut: "decision",
        titre:
          "Régime VGP des familles modifiable dans l'application (ticket prêt, mis de côté le 23/10).",
      },
    ],
  },
  {
    titre: "Bloquants extérieurs",
    elements: [
      {
        statut: "bloque",
        titre:
          "Envoi de courriels : domaine à vérifier chez Resend (aujourd'hui l'envoi ne part que vers l'adresse de l'administrateur).",
      },
      { statut: "bloque", titre: "Hors-ligne : non fait." },
    ],
  },
  {
    titre: "Livré depuis le 31/10",
    elements: [
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
    ],
  },
];
