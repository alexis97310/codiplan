import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { creerContact } from "@/lib/contacts/depot";

import { contextePortailContact, motifDuRefusPortail } from "../contexte";
import { avecFiletPortail } from "../filet";
import {
  creationContactPortailRecue,
  versLeRetourPortail,
} from "../saisie-recue";

/**
 * CRÉER UN INTERLOCUTEUR DEPUIS LE PORTAIL (9J03-PORTAIL-CONTACTS, CLI-3).
 *
 * Même dépôt que le back-office (`lib/contacts/depot.ts`), jamais une
 * recopie de la règle — seule la PORTE et la SAISIE diffèrent (D70, D97) :
 * voir `contexte.ts` et `saisie-recue.ts`.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => avecFiletPortail(() => traiter(requete)));
}

async function traiter(requete: Request): Promise<Response> {
  const porte = await contextePortailContact();
  if (porte === null) {
    return versLeRetourPortail(await motifDuRefusPortail());
  }

  const formulaire = await requete.formData();
  const saisie = creationContactPortailRecue(formulaire, porte.clientId);
  if (saisie === null) {
    return versLeRetourPortail("contacts.refus.saisie");
  }

  const resultat = await creerContact(porte.contexte, saisie);
  return versLeRetourPortail(
    resultat.accepte ? "contacts.cree" : `contacts.refus.${resultat.motif}`,
  );
}
