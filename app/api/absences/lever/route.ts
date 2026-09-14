import { leverLeBlocage } from "@/lib/absences/depot";
import { schemaLeveeBlocage } from "@/lib/absences/saisie";

import { champ, contexteCourant } from "../../interventions/actions";
import { versLesAbsences } from "../actions";

/**
 * LEVER UN BLOCAGE D'AGENDA (R3-14).
 *
 * **Il se supprime, il ne se « refuse » pas.** Un statut `refusee` aurait gardé
 * la ligne en disant qu'elle ne compte pas : *deux façons pour une période de ne
 * pas bloquer, dont une invisible au lecteur qui ne regarde que les dates.*
 *
 * **Ce que cette route ne fait pas est écrit plutôt que tu** : lever un blocage
 * ne rend PAS leurs créneaux aux interventions déjà rendues à la file. Elles ne
 * savent plus où elles étaient, et le planificateur a le journal d'audit sous
 * les yeux (I8) et le choix de les reposer où il veut.
 */
export async function POST(requete: Request): Promise<Response> {
  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLesAbsences("auth.refus");
  }
  const formulaire = await requete.formData();
  const saisie = schemaLeveeBlocage.safeParse({
    absence_id: champ(formulaire, "absence_id") ?? "",
  });
  if (!saisie.success) {
    return versLesAbsences("absence.refus.saisie");
  }
  const resultat = await leverLeBlocage(contexte, saisie.data);
  return versLesAbsences(resultat.accepte ? undefined : resultat.cle);
}
