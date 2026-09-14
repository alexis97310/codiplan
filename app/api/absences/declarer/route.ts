import { declarerAbsence } from "@/lib/absences/depot";
import { schemaCreationAbsence } from "@/lib/absences/saisie";

import { champ, contexteCourant } from "../../interventions/actions";
import { jourCivil, versLesAbsences } from "../actions";

/**
 * POSER UN BLOCAGE D'AGENDA (R3-14, RG-PLA-06).
 *
 * **Le blocage est IMMÉDIAT** : il n'y a plus de statut, donc plus de second
 * geste qui trancherait. Poser la ligne rend à la file les interventions posées
 * sur ces jours-là, dans la même transaction, et ce que cela a produit revient
 * à l'écran — NOMMÉ, jamais compté.
 *
 * **Rien d'autre qu'une personne et deux dates n'est envoyé**, et ce n'est pas
 * un oubli : *CODIPLAN n'est pas un outil de gestion des ressources humaines.*
 * Ni nature, ni motif, ni champ libre — le schéma de saisie ne les accepte plus,
 * et les colonnes n'existent plus.
 *
 * **Un technicien ne bloque que son propre agenda**, et c'est la base qui le
 * tient (`absence_declaree_pour_soi`) : une garde écrite ici serait contournable
 * par tout autre chemin d'écriture.
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
    if (!resultat.accepte) {
      return versLesAbsences(resultat.cle);
    }
    return versLesAbsences(undefined, {
      rendues: resultat.fiche.deplanifiees,
      // LE VERDICT VIENT DE LA POSE, jamais d'un recalcul à l'affichage : il a
      // été rendu avec l'effectif sous les yeux, dans la transaction qui a
      // déplanifié.
      rompues: resultat.fiche.ruptures
        .filter((verdict) => verdict.etat === "rupture")
        .map((verdict) => verdict.agenceId),
    });
  } catch (erreur) {
    // La BASE refuse ce que l'écran n'aurait pas dû proposer — un technicien
    // qui bloque l'agenda d'autrui. Le refus est traduit ; toute autre erreur
    // repart, plutôt que d'être rangée sous un motif qui serait faux.
    if (String(erreur).includes("absence_declaree_pour_soi")) {
      return versLesAbsences("absence.refus.pour_autrui");
    }
    throw erreur;
  }
}
