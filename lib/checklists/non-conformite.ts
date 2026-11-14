import type {
  ChecklistNonConformiteSuite,
  ReponseConformite,
} from "@prisma/client";

import { t } from "@/lib/i18n/fr";

/**
 * LE DÉTAIL D'UN POINT NON CONFORME (9L04I-CHECKLIST-NON-CONFORME-DETAIL) —
 * FONCTIONS PURES, partagées entre le domaine serveur
 * (`lib/checklists/validation-reponse.ts`, `lib/checklists/presentation.ts`)
 * et la saisie terrain (`components/terrain/checklist-terrain.tsx`), même
 * discipline que `lib/checklists/completude.ts` (§9, 01/09 : une seule
 * fonction, jamais deux lectures qui pourraient diverger).
 *
 * Une réponse `conforme_non_conforme_sans_objet` voyage soit comme une simple
 * chaîne (`"conforme" | "non_conforme" | "sans_objet"`, SANS détail — le cas
 * le plus courant), soit comme l'objet `DetailNonConforme` ci-dessous DÈS que
 * la suite ou le commentaire porte une valeur. Les deux formes sont
 * JSON-sérialisables, et traversent donc la file hors réseau
 * (`lib/terrain/file-saisies.ts`, `Record<string, unknown>`) comme la route
 * `POST /api/terrain/[id]/checklist` SANS aucun changement de forme.
 */

export const SUITES_NON_CONFORMITE_CHECKLIST = [
  "regle_sur_place",
  "piece_a_commander",
  "a_revoir",
] as const satisfies readonly ChecklistNonConformiteSuite[];

export type SuiteNonConformiteChecklist = ChecklistNonConformiteSuite;

export type DetailNonConforme = {
  readonly conforme: "non_conforme";
  readonly suite: SuiteNonConformiteChecklist | null;
  readonly commentaire: string | null;
};

function estValeurConforme(valeur: string): valeur is ReponseConformite {
  return (
    valeur === "conforme" ||
    valeur === "non_conforme" ||
    valeur === "sans_objet"
  );
}

function estDetailNonConforme(valeur: unknown): valeur is DetailNonConforme {
  return typeof valeur === "object" && valeur !== null && "conforme" in valeur;
}

/** La valeur conforme/non-conforme/sans-objet, qu'elle voyage seule ou dans un `DetailNonConforme`. `null` si `valeur` ne porte ni l'une ni l'autre forme. */
export function valeurConformeDe(valeur: unknown): ReponseConformite | null {
  if (typeof valeur === "string" && estValeurConforme(valeur)) {
    return valeur;
  }
  if (estDetailNonConforme(valeur)) {
    return valeur.conforme;
  }
  return null;
}

/** Le détail porté par `valeur` — `{ suite: null, commentaire: null }` si `valeur` ne porte pas la forme `DetailNonConforme` (jamais `null`, pour que l'appelant compare toujours la même forme). */
export function detailNonConformeDe(
  valeur: unknown,
): Pick<DetailNonConforme, "suite" | "commentaire"> {
  if (estDetailNonConforme(valeur)) {
    return { suite: valeur.suite, commentaire: valeur.commentaire };
  }
  return { suite: null, commentaire: null };
}

/** Vrai quand NI la suite NI le commentaire ne porte de valeur. */
export function detailNonConformeVide(
  detail: Pick<DetailNonConforme, "suite" | "commentaire">,
): boolean {
  return detail.suite === null && detail.commentaire === null;
}

/**
 * Le libellé d'une suite à donner — UNE SEULE fonction (§9, 01/09), partagée
 * par la saisie terrain et les lectures bureau/portail (bons, fiche), qui
 * doivent toutes nommer les TROIS valeurs closes avec le même mot. Switch
 * exhaustif, composé hors JSX (L0-11).
 */
export function libelleSuiteNonConformite(
  suite: SuiteNonConformiteChecklist,
): string {
  switch (suite) {
    case "regle_sur_place":
      return t("checklist.non_conformite.regle_sur_place");
    case "piece_a_commander":
      return t("checklist.non_conformite.piece_a_commander");
    case "a_revoir":
      return t("checklist.non_conformite.a_revoir");
  }
}
