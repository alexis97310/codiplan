import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { basculerActiviteContact } from "@/lib/contacts/depot";

import { champ } from "../../../interventions/actions";
import { estUuid, versLeRetour } from "../../saisie-recue";

const ACTIF = "oui";
const INACTIF = "non";

/**
 * ACTIVER OU DÉSACTIVER UN INTERLOCUTEUR (CONTACTS-1).
 *
 * Même forme que `/api/habilitations/[id]/activite` : « actif » se
 * DÉSACTIVE, il ne se supprime pas — un interlocuteur parti disparaît des
 * listes courantes sans effacer ce qu'il a désigné (`demande.contact_id`).
 * L'état visé est ENVOYÉ par le formulaire plutôt que déduit d'une bascule :
 * une bascule aveugle inverserait un état qu'un autre onglet vient de changer.
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

  if (!estUuid(id)) {
    return versLeRetour(retour, "contacts.refus.introuvable");
  }

  const vise = champ(formulaire, "actif");
  if (vise !== ACTIF && vise !== INACTIF) {
    return versLeRetour(retour, "contacts.refus.saisie");
  }

  const resultat = await basculerActiviteContact(contexte, id, vise === ACTIF);
  return versLeRetour(
    retour,
    resultat.accepte ? undefined : `contacts.refus.${resultat.motif}`,
  );
}
