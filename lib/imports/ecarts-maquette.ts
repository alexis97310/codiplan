/**
 * LES ÉCARTS NOMMÉS DE `/imports` FACE À LA MAQUETTE (D95, D128, TP-A3).
 *
 * Même geste que `lib/absences/ecarts-maquette.ts` et
 * `lib/machines/ecarts-maquette.ts` : chaque entrée est un bloc que la
 * maquette dessine et que cet écran ne construit plus à l'identique, avec le
 * fait mesuré qui l'explique — jamais un bloc oublié en silence.
 *
 * Décidé au lot TP-A3-RAPPORT-IMPORT (audit du 28/09/2026, constats PA-48 et
 * PA-51) : un lien inerte se lit comme une panne dès qu'il porte un motif
 * visible à côté de lui plutôt qu'à sa place — la même règle qu'applique déjà
 * « Scanner un QR code » (`lib/machines/ecarts-maquette.ts`). Les deux entrées
 * ci-dessous ne disparaissent pas : elles se rétabliront le jour où la
 * dépendance qu'elles nomment sera comblée, sans qu'un gardien les oublie.
 */

export type EcartMaquette = {
  readonly libelle: string;
  readonly motif: string;
};

export const ECARTS_MAQUETTE_IMPORTS: readonly EcartMaquette[] = [
  {
    libelle: "Télécharger le modèle Excel",
    motif:
      "aucun des sept modèles n'est encore produit ; l'écrire est un lot à " +
      "part (IMPORT-3). Un lien inerte à côté d'un motif visible se lit " +
      "comme une panne, la même faute que R2-13 nomme déjà pour un lien " +
      "mort — le bouton est donc retiré tant que rien ne sait le servir, " +
      "plutôt que laissé inerte avec son motif à côté.",
  },
  {
    libelle: "Sites et contacts",
    motif:
      "le type Contacts se contrôle mais ne s'applique pas encore " +
      "(aucune fonction d'application n'existe dans lib/contacts/) ; " +
      "MO-10 l'écrira. La liste « Imports disponibles » ne montre que les " +
      "types complets — Sites y reste, sous son propre libellé.",
  },
];
