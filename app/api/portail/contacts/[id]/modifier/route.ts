import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { modifierContact } from "@/lib/contacts/depot";
import { estUuid } from "@/lib/identifiant";

import { contextePortailContact, motifDuRefusPortail } from "../../contexte";
import { avecFiletPortail } from "../../filet";
import {
  modificationContactPortailRecue,
  versLeRetourPortail,
} from "../../saisie-recue";

/**
 * MODIFIER UN INTERLOCUTEUR DEPUIS LE PORTAIL (9J03-PORTAIL-CONTACTS, CLI-3).
 *
 * `client_id` n'est PAS modifiable — `schemaModificationContact`
 * (`lib/contacts/saisie.ts`) ne le porte même pas, hors territoire de ce
 * ticket, en lecture seule. La politique « parc » de `contact` referme
 * quand même l'écriture si l'identifiant visé n'est pas un contact DE ce
 * client (I1) : un `updateMany` sous `app.client_id` posé ne touche que les
 * lignes que la politique laisse voir, zéro ligne pour un contact d'un autre
 * client — le même refus « introuvable » qu'un identifiant inconnu (D35,
 * D50), jamais une distinction qui apprendrait qu'il existe ailleurs.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() =>
    avecFiletPortail(() => traiter(requete, params)),
  );
}

async function traiter(
  requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const { id } = await params;
  const porte = await contextePortailContact();
  if (porte === null) {
    return versLeRetourPortail(await motifDuRefusPortail());
  }

  // Un identifiant mal formé est un refus, jamais une panne (D35, D50).
  if (!estUuid(id)) {
    return versLeRetourPortail("contacts.refus.introuvable");
  }

  const formulaire = await requete.formData();
  const saisie = modificationContactPortailRecue(formulaire);
  if (saisie === null) {
    return versLeRetourPortail("contacts.refus.saisie");
  }

  const resultat = await modifierContact(porte.contexte, id, saisie);
  return versLeRetourPortail(
    resultat.accepte ? "contacts.modifie" : `contacts.refus.${resultat.motif}`,
  );
}
