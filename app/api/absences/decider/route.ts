import { deciderAbsence } from "@/lib/absences/depot";
import { schemaDecisionAbsence } from "@/lib/absences/saisie";

import { champ, contexteCourant } from "../../interventions/actions";
import { versLesAbsences } from "../actions";

/**
 * VALIDER OU REFUSER UNE ABSENCE (R3-14, RG-PLA-06).
 *
 * **Décider appartient à l'encadrement — `adv` ou `direction`.** *Un technicien
 * qui validerait sa propre absence déplanifierait ses propres interventions*,
 * c'est-à-dire retirerait des rendez-vous à des clients sans que personne
 * l'ait vu. La garde vit dans la base
 * (`absence_decision_reservee_a_l_encadrement`) et non ici : une garde écrite
 * dans une route est contournée par la route suivante.
 *
 * **Ce que la décision a rendu voyage jusqu'à l'écran** — les interventions
 * déplanifiées et les agences où le service est rompu, par leurs identifiants.
 * L'écran les NOMME ; il ne les rejuge pas.
 */
export async function POST(requete: Request): Promise<Response> {
  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLesAbsences("auth.refus");
  }
  const formulaire = await requete.formData();
  const saisie = schemaDecisionAbsence.safeParse({
    absence_id: champ(formulaire, "absence_id") ?? "",
    decision: champ(formulaire, "decision") ?? "",
  });
  if (!saisie.success) {
    return versLesAbsences("absence.refus.saisie");
  }

  try {
    const resultat = await deciderAbsence(contexte, saisie.data);
    if (!resultat.accepte) {
      return versLesAbsences(resultat.cle);
    }
    return versLesAbsences(undefined, {
      rendues: resultat.fiche.deplanifiees,
      // LE VERDICT VIENT DE LA DÉCISION, jamais d'un recalcul à l'affichage :
      // il a été rendu avec l'effectif sous les yeux, dans la transaction qui a
      // déplanifié.
      rompues: resultat.fiche.ruptures
        .filter((verdict) => verdict.etat === "rupture")
        .map((verdict) => verdict.agenceId),
    });
  } catch (erreur) {
    if (String(erreur).includes("absence_decision_reservee_a_l_encadrement")) {
      return versLesAbsences("absence.refus.role");
    }
    throw erreur;
  }
}
