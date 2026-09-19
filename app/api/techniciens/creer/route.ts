import { creerTechnicien } from "@/lib/techniciens/depot";

import { contexteCourant } from "../../interventions/actions";
import { saisieTechnicienRecue, versLEquipe } from "../saisie-recue";

/**
 * CRÉER UN TECHNICIEN (ÉQUIPE-1).
 *
 * Le refus retourne sur l'écran d'équipe avec son motif, comme les autres
 * écrans de paramétrage — un refus qui renvoie ailleurs fait perdre la
 * saisie.
 *
 * Un courriel déjà pris n'est PAS un refus : `creerTechnicien` rattache la
 * personne existante à la société active, et le retour le dit à l'écran
 * (`resultat.rattache`).
 */
export async function POST(requete: Request): Promise<Response> {
  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLEquipe("auth.refus");
  }
  const saisie = saisieTechnicienRecue(await requete.formData());
  if (saisie === null) {
    return versLEquipe("equipe.refus.saisie");
  }
  const resultat = await creerTechnicien(contexte, saisie);
  if (!resultat.accepte) {
    return versLEquipe(`equipe.refus.${resultat.motif}`);
  }
  return versLEquipe(resultat.rattache ? "equipe.info.rattache" : undefined);
}
