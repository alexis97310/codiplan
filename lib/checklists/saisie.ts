import { z } from "zod";

import { TYPES_INTERVENTION } from "@/lib/interventions/saisie";

/**
 * SAISIE DES MODÈLES DE CHECKLIST ET DE LEURS POINTS (9K19-CHECKLIST-
 * PARAMETRAGE, CK3) — l'entrée serveur, validée par Zod sans exception
 * (CLAUDE.md §2).
 *
 * **MÊME FORME QUE LE DÉPÔT** (`lib/checklists/depot.ts`, 9K08-CHECKLIST-
 * SCHEMA) — ces schémas rendent exactement `SaisieModeleChecklist` et
 * `SaisiePointChecklist`, pour qu'aucune traduction de casse ne s'intercale
 * entre la route et le dépôt (§9, 01/09 : une seconde forme de la même
 * donnée aurait divergé au premier champ ajouté).
 *
 * **AU PLUS UN rattachement parmi sous-type / famille / modèle** n'est PAS
 * vérifié ici : la base le tient par une contrainte CHECK posée VALIDÉE
 * (`checklist_modele_un_seul_rattachement`, ticket 9K17A) — répéter la
 * règle ici l'exposerait à diverger de la base qui la fait vraiment
 * respecter. Le dépôt traduit le refus de la base en motif nommé.
 */

/** Un texte obligatoire, une fois les espaces de bordure retirés. */
const texteNonVide = z.string().trim().min(1);

/**
 * LES TYPES D'INTERVENTION OÙ UN MODÈLE EST PROPOSÉ (9K30A, D235 amendée une
 * seconde fois, même raisonnement que D243 pour `prestation.types`) — VIDE =
 * TOUS. Sans doublon : la base le garantit déjà (`@@unique
 * ([checklist_modele_id, type_intervention])`), mais une saisie qui en
 * porterait un ferait écrire UN modèle deux fois le MÊME type, pour rien.
 *
 * Exportée séparément : `saisieGabaritRecue` (« Partir d'un gabarit de
 * départ ») valide les MÊMES cases à cocher que la création d'un modèle,
 * jamais une seconde règle qui diverge en silence (§9, 01/09).
 */
export const schemaTypesIntervention = z
  .array(z.enum(TYPES_INTERVENTION))
  .refine(
    (types) => new Set(types).size === types.length,
    "un type d'intervention ne se coche pas deux fois",
  )
  .default([]);

export const schemaModeleChecklist = z.object({
  code: texteNonVide,
  libelle: texteNonVide,
  typesIntervention: schemaTypesIntervention,
  sousTypeId: z.uuid().nullable().default(null),
  familleId: z.uuid().nullable().default(null),
  modeleId: z.uuid().nullable().default(null),
  exigeMachine: z.boolean().default(false),
});

export type SaisieModeleChecklist = z.infer<typeof schemaModeleChecklist>;

/** Les six types de réponse (migrations 9K18-CHECKLIST-DOMAINE, 9K28-CHECKLIST-REPONSE-PHOTO). */
export const TYPES_REPONSE_CHECKLIST = [
  "conforme_non_conforme_sans_objet",
  "valeur_mesuree",
  "case_faite",
  "choix_dans_une_liste",
  "texte_libre",
  "photo",
] as const;

const enTeteDuPoint = {
  section: texteNonVide,
  ordre: z.number().int(),
  libelle: texteNonVide,
  consigne: z.string().trim().min(1).optional(),
  obligatoire: z.boolean().default(false),
};

/**
 * UN POINT DE LA VERSION PUBLIÉE — discriminée sur `typeReponse`, MÊME FORME
 * que l'union de `lib/checklists/depot.ts`. `choix` n'existe que pour
 * `choix_dans_une_liste` (non vide, sans doublon — même garde que la
 * contrainte CHECK de base, `checklist_point_choix_reserve_a_choix_dans_
 * une_liste`, répétée ici pour que le refus arrive à l'écran plutôt qu'en
 * `500`) ; `unite`/`toleranceMin`/`toleranceMax` n'existent que pour
 * `valeur_mesuree`.
 */
export const schemaPointChecklist = z.discriminatedUnion("typeReponse", [
  z.object({
    ...enTeteDuPoint,
    typeReponse: z.literal("conforme_non_conforme_sans_objet"),
  }),
  z.object({
    ...enTeteDuPoint,
    typeReponse: z.literal("case_faite"),
  }),
  z.object({
    ...enTeteDuPoint,
    typeReponse: z.literal("valeur_mesuree"),
    unite: z.string().trim().min(1).optional(),
    toleranceMin: z.number().optional(),
    toleranceMax: z.number().optional(),
  }),
  z.object({
    ...enTeteDuPoint,
    typeReponse: z.literal("choix_dans_une_liste"),
    choix: z
      .array(texteNonVide)
      .min(1)
      .refine(
        (choix) => new Set(choix).size === choix.length,
        "Un choix est répété.",
      ),
  }),
  z.object({
    ...enTeteDuPoint,
    typeReponse: z.literal("texte_libre"),
  }),
  // AUCUNE unité, AUCUN choix (9K28-CHECKLIST-REPONSE-PHOTO) — une réponse
  // `photo` n'a ni valeur, ni choix, ni texte, et sa ou ses photos arrivent
  // plus tard, par l'outil Photos existant, jamais à la saisie du gabarit.
  z.object({
    ...enTeteDuPoint,
    typeReponse: z.literal("photo"),
  }),
]);

export type SaisiePointChecklist = z.infer<typeof schemaPointChecklist>;

/** Une version — AU MOINS un point, au plus deux cents (même borne que la différence terrain). */
export const schemaVersionChecklist = z
  .array(schemaPointChecklist)
  .min(1)
  .max(200);
