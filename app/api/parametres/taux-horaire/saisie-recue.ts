import {
  schemaSuccessionTaux,
  type SaisieSuccessionTaux,
} from "@/lib/tarification/succession-taux";

import { champ } from "../../interventions/actions";

/**
 * LA SAISIE D'UNE SUCCESSION DE TAUX, LUE D'UN FORMULAIRE (TAUX-1).
 *
 * Écrite une fois, appelée par la route de création : le formulaire de saisie
 * et le formulaire de confirmation portent les MÊMES deux champs — seul un
 * troisième, `confirme`, distingue l'un de l'autre, et il ne relève pas de
 * cette fonction (voir la route).
 */
export function saisieTauxRecue(
  formulaire: FormData,
): SaisieSuccessionTaux | null {
  const montant = champ(formulaire, "montant_mineur");
  const dateEffet = champ(formulaire, "date_effet");

  const analyse = schemaSuccessionTaux.safeParse({
    montant_mineur: montant === null ? Number.NaN : Number(montant),
    date_effet: dateEffet ?? "",
  });

  return analyse.success ? analyse.data : null;
}
