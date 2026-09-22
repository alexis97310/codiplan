import { z } from "zod";

import {
  schemaCreationContact,
  schemaModificationContact,
  type CreationContact,
  type ModificationContact,
} from "@/lib/contacts/saisie";

import { champ } from "../interventions/actions";

/**
 * LA SAISIE D'UN CONTACT, LUE D'UN FORMULAIRE (CONTACTS-1).
 *
 * Même forme que `saisie-recue.ts` des habilitations. **Aucun canal n'est lu
 * ici** : `CANAUX_IMPLEMENTES` n'en connaît qu'un — `email` —, et le schéma le
 * pose déjà par défaut dès que le champ est absent (`champsCommuns.canaux`).
 * Proposer une case à cocher pour un canal que rien ne sait servir serait
 * exactement le mensonge silencieux que ce dépôt refuse partout.
 */

export function creationContactRecue(
  formulaire: FormData,
): CreationContact | null {
  const analyse = schemaCreationContact.safeParse({
    client_id: champ(formulaire, "client_id") ?? "",
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
 * **`actif` n'est PAS lu ici** : la bascule d'activité est un geste séparé
 * (`/api/contacts/[id]/activite`), sur la forme de
 * `/api/habilitations/[id]/activite` — un formulaire de modification qui
 * omettrait la case ne désactiverait jamais un contact par erreur (R2-20).
 */
export function modificationContactRecue(
  formulaire: FormData,
): ModificationContact | null {
  const analyse = schemaModificationContact.safeParse({
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
 * LA CIBLE DE RETOUR — la fiche client OU la fiche site, selon le bloc d'où le
 * formulaire est parti. Un contact rattaché à un site peut être modifié depuis
 * le bloc de la fiche CLIENT (qui montre tous les contacts du client) autant
 * que depuis celui de la fiche SITE (qui ne montre que les siens) : la cible
 * voyage donc dans le formulaire, elle ne se déduit pas du contact.
 *
 * **Fermée à un chemin relatif connu** — jamais un `Location` construit sur une
 * entrée libre : un `retour` qui ne commence pas par `/clients/` ou `/sites/`
 * suivi d'un UUID est refusé, et la liste des contacts sert de repli.
 */
const RETOUR_VALIDE = /^\/(clients|sites)\/[0-9a-f-]{36}$/;

export function versLeRetour(retour: string, cle?: string): Response {
  const cible = RETOUR_VALIDE.test(retour) ? retour : "/clients";
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `${cible}${suffixe}` },
  });
}

/** Un identifiant d'URL, valide ou non — jamais transmis tel quel à la base. */
export function estUuid(valeur: string): boolean {
  return z.uuid().safeParse(valeur).success;
}
