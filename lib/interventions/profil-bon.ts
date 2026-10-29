import { t } from "@/lib/i18n/fr";

import { type TypeIntervention } from "./saisie";

/**
 * LE PROFIL D'AFFICHAGE DU BON, SELON LA NATURE DE L'INTERVENTION
 * (9I7-BON-INTERVENTION-EN-TUILES, point 2 bis, demande d'Alexis du
 * 29/10/2026 ~20:50, verbatim).
 *
 * ## Une fonction pure, sur une donnée déjà en base
 *
 * `profilDuBon` ne lit rien, ne calcule aucun montant : elle ne fait que
 * nommer, pour un `TypeIntervention` (chapitre 11.2), le titre du document et
 * l'ordre des sept tuiles du bon. Le titre compose UNIQUEMENT des clés déjà
 * écrites (`intervention.bon.titre`, `type_intervention.*`) — jamais un
 * libellé inventé ici.
 *
 * ## Pourquoi l'ordre change
 *
 * Sur un préventif ou un contrôle réglementaire, ce qui a été FAIT ou
 * CONTRÔLÉ (la tuile Prestations) prime sur la description de la visite — on
 * la place juste après la tuile Matériel. Sur les autres natures, dont le
 * curatif, la garantie et la reprise, c'est le TRAVAIL RÉALISÉ (la tuile
 * Commentaires et photos) qui prime, et qui vient juste après la tuile
 * Intervention — l'ordre de base ci-dessous le porte déjà.
 *
 * ## Deux emplacements réservés, encore vides
 *
 * Les données qui rempliraient une checklist préventive ou une liste de
 * pièces remplacées N'EXISTENT PAS ENCORE en base : aucune tuile ne les
 * affiche, vide ou non. `EMPLACEMENT_CHECKLIST_PREVENTIVE` et
 * `EMPLACEMENT_PIECES_REMPLACEES_CURATIF` ci-dessous ne nomment qu'un
 * emplacement futur, pour le ticket qui écrira la tuile elle-même.
 */

/** Les sept tuiles de contenu du bon — hors en-tête, toujours en tête. */
export const TUILES_BON = [
  "client",
  "materiel",
  "intervention",
  "commentaires",
  "prestations",
  "suite",
  "signataire",
] as const;
export type TuileBon = (typeof TUILES_BON)[number];

export type ProfilBon = {
  readonly titreDocument: string;
  readonly ordreTuiles: readonly TuileBon[];
};

const ORDRE_BASE: readonly TuileBon[] = TUILES_BON;

/**
 * EMPLACEMENT RÉSERVÉ (ticket 9J16, étude du 29/10/2026) — la checklist
 * préventive de l'équipement viendra ici, juste après "prestations", quand
 * sa donnée existera. Jusque-là, aucune tuile n'y figure.
 */
export const EMPLACEMENT_CHECKLIST_PREVENTIVE = "après prestations";

const ORDRE_PREVENTIF: readonly TuileBon[] = [
  "client",
  "materiel",
  "prestations",
  "intervention",
  "commentaires",
  "suite",
  "signataire",
];

/**
 * EMPLACEMENT RÉSERVÉ (à venir) — la liste des pièces remplacées, pour un
 * curatif, viendra ici, juste après "commentaires", quand sa donnée existera.
 * Jusque-là, aucune tuile n'y figure.
 */
export const EMPLACEMENT_PIECES_REMPLACEES_CURATIF = "après commentaires";

/**
 * Les trois natures dont le bon avance « Prestations » juste après
 * « Matériel » — les six autres gardent `ORDRE_BASE`. Écrit en `Record`
 * plutôt qu'en liste : une nature ajoutée à `TypeIntervention` sans entrée
 * ici fait échouer `pnpm typecheck`, jamais en silence.
 */
const GROUPE_ORDRE: Record<TypeIntervention, readonly TuileBon[]> = {
  preventif_contrat: ORDRE_PREVENTIF,
  preventif_hors_contrat: ORDRE_PREVENTIF,
  controle_reglementaire: ORDRE_PREVENTIF,
  curatif: ORDRE_BASE,
  installation: ORDRE_BASE,
  garantie: ORDRE_BASE,
  expertise: ORDRE_BASE,
  reprise: ORDRE_BASE,
  recensement: ORDRE_BASE,
};

export function profilDuBon(type: TypeIntervention): ProfilBon {
  return {
    titreDocument:
      t("intervention.bon.titre") +
      t("ponctuation.separateur") +
      t(`type_intervention.${type}`),
    ordreTuiles: GROUPE_ORDRE[type],
  };
}
