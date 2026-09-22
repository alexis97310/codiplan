import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { creerContact } from "@/lib/contacts/depot";

import { champ } from "../../interventions/actions";
import { creationContactRecue, versLeRetour } from "../saisie-recue";

/**
 * CRÉER UN INTERLOCUTEUR (CONTACTS-1).
 *
 * Depuis le bloc de la fiche CLIENT (`site_id` choisi dans une liste, ou vide
 * — « contact du client ») ou depuis celui de la fiche SITE (`site_id` fixé au
 * site de la fiche). `retour` porte le chemin d'où le formulaire est parti,
 * même sous une saisie refusée : *un refus qui renvoie ailleurs fait perdre la
 * saisie.* Même capacité que la création d'un client ou d'un site
 * (`gerer_client_site`, D130) : un interlocuteur est un attribut du client, pas
 * un objet à part.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const formulaire = await requete.formData();
  const retour = champ(formulaire, "retour") ?? "/clients";

  const contexte = await exigerCapacite("gerer_client_site");
  if (contexte === null) {
    return versLeRetour(retour, "auth.refus");
  }

  const saisie = creationContactRecue(formulaire);
  if (saisie === null) {
    return versLeRetour(retour, "contacts.refus.saisie");
  }

  const resultat = await creerContact(contexte, saisie);
  return versLeRetour(
    retour,
    resultat.accepte ? "contacts.cree" : `contacts.refus.${resultat.motif}`,
  );
}
