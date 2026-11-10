import { z } from "zod";

import type { ReponseConformite, TypeReponseChecklist } from "@prisma/client";

/**
 * LA VALIDATION DES CINQ TYPES DE RÉPONSE (9K18-CHECKLIST-DOMAINE) — FONCTION
 * PURE, aucune base. `point.typeReponse` est la source de vérité (relu dans
 * la version figée ou résolue par le dépôt) — le JSON reçu du terrain ne
 * PORTE JAMAIS son propre `typeReponse` : une valeur brute, confrontée au
 * type que LE POINT porte, jamais celui que l'appelant prétendrait.
 *
 * Les tolérances (`tolerance_min`/`tolerance_max`) NE REFUSENT RIEN ici — D235
 * les laisse vides tant que l'atelier ne les fournit pas (CLAUDE.md §8 : pas
 * de valeur inventée) ; un lot futur qui les active rejugera `valeur_mesuree`
 * à cet endroit précis.
 */

export type SaisieReponsePoint =
  | {
      readonly typeReponse: "conforme_non_conforme_sans_objet";
      readonly valeurConforme: ReponseConformite;
    }
  | { readonly typeReponse: "valeur_mesuree"; readonly valeurMesuree: number }
  | { readonly typeReponse: "case_faite"; readonly valeurFait: true }
  | { readonly typeReponse: "choix_dans_une_liste"; readonly valeurChoix: string }
  | { readonly typeReponse: "texte_libre"; readonly valeurTexte: string };

export type PointPourValidation = {
  readonly typeReponse: TypeReponseChecklist;
  /** Les choix proposés — non vide seulement pour `choix_dans_une_liste`. */
  readonly choix: readonly string[];
};

export type ResultatValidationReponse =
  | { readonly valide: true; readonly saisie: SaisieReponsePoint }
  | { readonly valide: false; readonly cle: string };

const schemaValeurConforme = z.enum(["conforme", "non_conforme", "sans_objet"]);
// BORNE (9K18) : `numeric(12, 3)` en base — 999999999.999 est le plus grand
// absolu qu'elle peut porter ; au-delà, la base refuserait avec une erreur
// technique plutôt que ce refus nommé.
const schemaValeurMesuree = z.number().finite().min(-999999999.999).max(999999999.999);
const schemaValeurFait = z.literal(true);
const schemaValeurChoixBrute = z.string().trim().min(1).max(200);
const schemaValeurTexte = z.string().trim().min(1).max(2000);

/** Valide une valeur brute contre LE TYPE DU POINT — jamais contre un type auto-déclaré. */
export function validerReponsePoint(
  point: PointPourValidation,
  valeurBrute: unknown,
): ResultatValidationReponse {
  switch (point.typeReponse) {
    case "conforme_non_conforme_sans_objet": {
      const verdict = schemaValeurConforme.safeParse(valeurBrute);
      if (!verdict.success) {
        return { valide: false, cle: "checklist.refus.valeur_invalide" };
      }
      return {
        valide: true,
        saisie: {
          typeReponse: "conforme_non_conforme_sans_objet",
          valeurConforme: verdict.data,
        },
      };
    }
    case "valeur_mesuree": {
      const verdict = schemaValeurMesuree.safeParse(valeurBrute);
      if (!verdict.success) {
        return { valide: false, cle: "checklist.refus.valeur_invalide" };
      }
      return {
        valide: true,
        saisie: { typeReponse: "valeur_mesuree", valeurMesuree: verdict.data },
      };
    }
    case "case_faite": {
      const verdict = schemaValeurFait.safeParse(valeurBrute);
      if (!verdict.success) {
        return { valide: false, cle: "checklist.refus.valeur_invalide" };
      }
      return { valide: true, saisie: { typeReponse: "case_faite", valeurFait: true } };
    }
    case "choix_dans_une_liste": {
      const verdict = schemaValeurChoixBrute.safeParse(valeurBrute);
      if (!verdict.success) {
        return { valide: false, cle: "checklist.refus.valeur_invalide" };
      }
      if (!point.choix.includes(verdict.data)) {
        return { valide: false, cle: "checklist.refus.choix_inconnu" };
      }
      return {
        valide: true,
        saisie: { typeReponse: "choix_dans_une_liste", valeurChoix: verdict.data },
      };
    }
    case "texte_libre": {
      const verdict = schemaValeurTexte.safeParse(valeurBrute);
      if (!verdict.success) {
        return { valide: false, cle: "checklist.refus.valeur_invalide" };
      }
      return {
        valide: true,
        saisie: { typeReponse: "texte_libre", valeurTexte: verdict.data },
      };
    }
  }
}
