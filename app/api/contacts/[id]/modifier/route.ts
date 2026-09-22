import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { modifierContact } from "@/lib/contacts/depot";

import { champ } from "../../../interventions/actions";
import {
  estUuid,
  modificationContactRecue,
  versLeRetour,
} from "../../saisie-recue";

/**
 * MODIFIER UN INTERLOCUTEUR (CONTACTS-1).
 *
 * `site_id` n'est pas modifié ici : l'écran ne propose pas de déplacer un
 * contact d'un site à l'autre depuis ce formulaire, seulement de corriger son
 * identité (nom, fonction, coordonnées, rôles). La bascule d'activité est un
 * geste séparé, `/api/contacts/[id]/activite`.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete, params));
}

async function traiter(
  requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const { id } = await params;
  const formulaire = await requete.formData();
  const retour = champ(formulaire, "retour") ?? "/clients";

  const contexte = await exigerCapacite("gerer_client_site");
  if (contexte === null) {
    return versLeRetour(retour, "auth.refus");
  }

  // Un identifiant mal formé est un refus, jamais une panne (leçon de
  // `/api/sites/[id]/modifier`, D35, D50).
  if (!estUuid(id)) {
    return versLeRetour(retour, "contacts.refus.introuvable");
  }

  const saisie = modificationContactRecue(formulaire);
  if (saisie === null) {
    return versLeRetour(retour, "contacts.refus.saisie");
  }

  const resultat = await modifierContact(contexte, id, saisie);
  return versLeRetour(
    retour,
    resultat.accepte ? "contacts.modifie" : `contacts.refus.${resultat.motif}`,
  );
}
