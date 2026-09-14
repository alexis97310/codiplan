import { declarerAbsence } from "@/lib/absences/depot";
import { schemaCreationAbsence } from "@/lib/absences/saisie";

import { champ, contexteCourant } from "../../interventions/actions";
import { jourCivil, versLesAbsences } from "../actions";

/**
 * DÉCLARER UNE ABSENCE (R3-14, RG-PLA-06).
 *
 * Elle naît `demandee` et rien d'autre : *la laisser naître validée donnerait à
 * qui la saisit le pouvoir de déplanifier le planning d'autrui en un appel.* Le
 * statut n'est pas dans la saisie, il ne peut donc pas être forcé d'ici.
 *
 * **Aucune nature n'est envoyée**, et ce n'est pas un oubli : la décision
 * provisoire de R3-14 est qu'une absence ne dit que *quand*. Le schéma de saisie
 * ne l'accepte plus, et le déclencheur `absence_sans_nature` refuse ce que ce
 * chemin n'envoie déjà pas.
 *
 * **Un technicien ne déclare que pour lui-même**, et c'est la base qui le tient
 * (`absence_declaree_pour_soi`) : une garde écrite ici serait contournable par
 * tout autre chemin d'écriture.
 */
export async function POST(requete: Request): Promise<Response> {
  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLesAbsences("auth.refus");
  }
  const formulaire = await requete.formData();
  const saisie = schemaCreationAbsence.safeParse({
    utilisateur_id: champ(formulaire, "utilisateur_id") ?? "",
    du: jourCivil(formulaire, "du") ?? new Date(Number.NaN),
    au: jourCivil(formulaire, "au") ?? new Date(Number.NaN),
  });
  if (!saisie.success) {
    return versLesAbsences("absence.refus.saisie");
  }

  try {
    const resultat = await declarerAbsence(contexte, saisie.data);
    return versLesAbsences(resultat.accepte ? undefined : resultat.cle);
  } catch (erreur) {
    // La BASE refuse ce que l'écran n'aurait pas dû proposer — un technicien
    // qui déclare pour autrui. Le refus est traduit ; toute autre erreur repart,
    // plutôt que d'être rangée sous un motif qui serait faux.
    if (String(erreur).includes("absence_declaree_pour_soi")) {
      return versLesAbsences("absence.refus.pour_autrui");
    }
    throw erreur;
  }
}
