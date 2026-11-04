import {
  schemaCreationContact,
  schemaModificationContact,
  type CreationContact,
  type ModificationContact,
} from "@/lib/contacts/saisie";

import { champ } from "../../interventions/actions";

/**
 * LA SAISIE D'UN CONTACT PORTAIL (9J03-PORTAIL-CONTACTS) — même schéma Zod que
 * le back-office (`lib/contacts/saisie.ts`), jamais une recopie de la règle.
 *
 * **`client_id` N'EST JAMAIS LU DU FORMULAIRE.** Un compte portail n'a qu'un
 * seul client — `clientId` vient de `contextePortailContact`, la même
 * désignation que la page de lecture — et aucun champ caché ne le porte ici :
 * il n'y a rien à forger, contrairement à la fiche back-office où un
 * administrateur CHOISIT le client. La base revalide quand même la
 * désignation posée (`app_poser_perimetre_client`, D70) — défense en
 * profondeur, jamais la seule garde.
 */
export function creationContactPortailRecue(
  formulaire: FormData,
  clientId: string,
): CreationContact | null {
  const analyse = schemaCreationContact.safeParse({
    client_id: clientId,
    site_id: champ(formulaire, "site_id"),
    nom: champ(formulaire, "nom") ?? "",
    fonction: champ(formulaire, "fonction"),
    telephone: champ(formulaire, "telephone"),
    mobile: champ(formulaire, "mobile"),
    email: champ(formulaire, "email"),
    roles: formulaire.getAll("roles"),
  });
  return analyse.success ? analyse.data : null;
}

/**
 * **`site_id` est lu ici** — à la différence de `modificationContactRecue` du
 * back-office (`/api/contacts/[id]/modifier`, qui ne propose pas de déplacer
 * un contact d'un site à l'autre) : l'écran du portail ne porte qu'un seul
 * formulaire par contact, création et rattachement compris. Le choix reste
 * celui des sites DU PÉRIMÈTRE affiché par l'écran (cohérence, pas un
 * contrôle — D97) ; la politique `WITH CHECK` de `contact` referme si la
 * valeur soumise en sort quand même.
 *
 * **`actif` n'est pas lu** : même décision que le back-office, la bascule
 * d'activité est un geste séparé.
 */
export function modificationContactPortailRecue(
  formulaire: FormData,
): ModificationContact | null {
  const analyse = schemaModificationContact.safeParse({
    site_id: champ(formulaire, "site_id"),
    nom: champ(formulaire, "nom") ?? "",
    fonction: champ(formulaire, "fonction"),
    telephone: champ(formulaire, "telephone"),
    mobile: champ(formulaire, "mobile"),
    email: champ(formulaire, "email"),
    roles: formulaire.getAll("roles"),
  });
  return analyse.success ? analyse.data : null;
}

/**
 * LE RETOUR — toujours `/portail/contacts`, jamais un chemin reçu de la
 * requête : à la différence du back-office (fiche client OU fiche site), le
 * portail n'a qu'UN écran de contacts, donc rien à désigner.
 */
export function versLeRetourPortail(cle?: string): Response {
  const parametres = new URLSearchParams();
  if (cle !== undefined) {
    parametres.set("motif", cle);
  }
  const chaine = parametres.toString();
  const suffixe = chaine === "" ? "" : `?${chaine}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/portail/contacts${suffixe}` },
  });
}
