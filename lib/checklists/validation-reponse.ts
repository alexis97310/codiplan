import { z } from "zod";

import type { ReponseConformite, TypeReponseChecklist } from "@prisma/client";

import { SUITES_NON_CONFORMITE_CHECKLIST } from "@/lib/checklists/non-conformite";

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
 *
 * `conforme_non_conforme_sans_objet` PORTE DEPUIS 9L04I-CHECKLIST-NON-
 * CONFORME-DETAIL deux informations additionnelles, `suite` et `commentaire`
 * — FACULTATIVES, et refusées (`checklist.refus.detail_hors_non_conforme`)
 * sur toute réponse AUTRE que `non_conforme` (même règle que la contrainte
 * `checklist_reponse_detail_non_conforme` en base, jamais contournable par
 * cette seule validation applicative).
 */

export type SaisieReponsePoint =
  | {
      readonly typeReponse: "conforme_non_conforme_sans_objet";
      readonly valeurConforme: ReponseConformite;
      readonly suite: (typeof SUITES_NON_CONFORMITE_CHECKLIST)[number] | null;
      readonly commentaire: string | null;
    }
  | { readonly typeReponse: "valeur_mesuree"; readonly valeurMesuree: number }
  | { readonly typeReponse: "case_faite"; readonly valeurFait: true }
  | {
      readonly typeReponse: "choix_dans_une_liste";
      readonly valeurChoix: string;
    }
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
const schemaSuiteNonConforme = z.enum(SUITES_NON_CONFORMITE_CHECKLIST);
// MÊME BORNE QUE `valeur_texte` ci-dessous (2000) — un commentaire de point
// reste plus court, 500 (`checklist_reponse_commentaire_non_conforme_borne`).
const schemaCommentaireNonConforme = z.string().trim().min(1).max(500);
/** Bare (sans détail) OU l'objet `{ conforme, suite, commentaire }` — jamais les deux formes mêlées. */
const schemaDetailConformite = z.union([
  schemaValeurConforme,
  z.object({
    conforme: schemaValeurConforme,
    suite: schemaSuiteNonConforme.nullable().optional(),
    commentaire: schemaCommentaireNonConforme.nullable().optional(),
  }),
]);
// BORNE (9K18) : `numeric(12, 3)` en base — 999999999.999 est le plus grand
// absolu qu'elle peut porter ; au-delà, la base refuserait avec une erreur
// technique plutôt que ce refus nommé.
const schemaValeurMesuree = z
  .number()
  .finite()
  .min(-999999999.999)
  .max(999999999.999);
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
      const verdict = schemaDetailConformite.safeParse(valeurBrute);
      if (!verdict.success) {
        return { valide: false, cle: "checklist.refus.valeur_invalide" };
      }
      if (typeof verdict.data === "string") {
        return {
          valide: true,
          saisie: {
            typeReponse: "conforme_non_conforme_sans_objet",
            valeurConforme: verdict.data,
            suite: null,
            commentaire: null,
          },
        };
      }
      const { conforme, suite = null, commentaire = null } = verdict.data;
      if (
        (suite !== null || commentaire !== null) &&
        conforme !== "non_conforme"
      ) {
        return {
          valide: false,
          cle: "checklist.refus.detail_hors_non_conforme",
        };
      }
      return {
        valide: true,
        saisie: {
          typeReponse: "conforme_non_conforme_sans_objet",
          valeurConforme: conforme,
          suite,
          commentaire,
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
      return {
        valide: true,
        saisie: { typeReponse: "case_faite", valeurFait: true },
      };
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
        saisie: {
          typeReponse: "choix_dans_une_liste",
          valeurChoix: verdict.data,
        },
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
    // UN POINT `photo` NE SE RÉPOND JAMAIS PAR CETTE DIFFÉRENCE JSON
    // (9K28-CHECKLIST-REPONSE-PHOTO) — sa réponse naît d'une photo déjà
    // déposée (`enregistrerReponsePhoto`, appelée depuis
    // `deposerPhotoIntervention`), jamais d'une valeur auto-déclarée ici.
    case "photo":
      return { valide: false, cle: "checklist.refus.photo_hors_formulaire" };
  }
}
