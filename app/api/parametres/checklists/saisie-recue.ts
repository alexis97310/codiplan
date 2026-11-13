import {
  schemaModeleChecklist,
  schemaVersionChecklist,
  type SaisieModeleChecklist,
  type SaisiePointChecklist,
} from "@/lib/checklists/saisie";

import { champ } from "../../interventions/actions";

/**
 * LES SAISIES DU PARAMÉTRAGE DES CHECKLISTS (9K19-CHECKLIST-PARAMETRAGE,
 * CK3) — même discipline que `app/api/parametres/materiel/saisie-recue.ts` :
 * écrites une fois, appelées par chaque route qui en a besoin.
 *
 * *Une case à cocher absente du corps vaut « décochée »* : un formulaire
 * HTML n'envoie pas les cases non cochées.
 */
export function saisieModeleChecklistRecue(
  formulaire: FormData,
): SaisieModeleChecklist | null {
  const analyse = schemaModeleChecklist.safeParse({
    code: champ(formulaire, "code") ?? "",
    libelle: champ(formulaire, "libelle") ?? "",
    // AUCUNE CASE COCHÉE = PROPOSÉ POUR TOUS LES TYPES (9K30A) — même idiome
    // que `exige_machine` : une case absente du corps vaut « décochée ».
    typesIntervention: formulaire
      .getAll("types_intervention")
      .filter((valeur): valeur is string => typeof valeur === "string"),
    sousTypeId: champ(formulaire, "sous_type_id"),
    familleId: champ(formulaire, "famille_id"),
    modeleId: champ(formulaire, "modele_id"),
    exigeMachine: formulaire.get("exige_machine") !== null,
  });
  return analyse.success ? analyse.data : null;
}

/**
 * LA VERSION — un seul champ, `points`, le JSON posé par l'éditeur client
 * (`EditeurVersion`, "use client") dans un `<input type="hidden">`. Le
 * formulaire ne porte aucun autre champ par point : un champ par point
 * multiplierait les noms indexés pour un gain nul, l'éditeur produisant déjà
 * la forme exacte que `schemaVersionChecklist` attend.
 */
export function saisieVersionRecue(
  formulaire: FormData,
): readonly SaisiePointChecklist[] | null {
  const brut = champ(formulaire, "points");
  if (brut === null) {
    return null;
  }
  let analyseJson: unknown;
  try {
    analyseJson = JSON.parse(brut);
  } catch {
    return null;
  }
  const analyse = schemaVersionChecklist.safeParse(analyseJson);
  return analyse.success ? analyse.data : null;
}

/**
 * LA SAISIE DU BOUTON « PARTIR D'UN GABARIT DE DÉPART » (9K20-CHECKLIST-
 * DUPLIQUER-DEPART, étendue au rattachement par 9L04B-GABARIT-RATTACHEMENT)
 * — l'identifiant du gabarit (une liste close, confrontée par
 * `lib/checklists/gabarits-de-depart.ts`, pas ici) PLUS EXACTEMENT la même
 * saisie que `saisieModeleChecklistRecue` (code, libellé, types, rattachement,
 * `exige_machine`) : même schéma, jamais une seconde règle de validation qui
 * diverge en silence (§9, 01/09). `null` si le gabarit ou l'en-tête manque —
 * un identifiant de gabarit inconnu est un refus PLUS TARD, nommé par le dépôt.
 */
export function saisieGabaritRecue(
  formulaire: FormData,
): ({ readonly gabaritId: string } & SaisieModeleChecklist) | null {
  const gabaritId = champ(formulaire, "gabarit_id");
  if (gabaritId === null) {
    return null;
  }
  const saisie = saisieModeleChecklistRecue(formulaire);
  if (saisie === null) {
    return null;
  }
  return { gabaritId, ...saisie };
}

/** Le retour vers l'écran, avec son motif s'il y en a un. */
export function versLeReferentiel(cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/parametres/checklists${suffixe}` },
  });
}

/** L'état visé par une bascule d'activité, ENVOYÉ et jamais déduit. */
export const ACTIF = "oui";
export const INACTIF = "non";
