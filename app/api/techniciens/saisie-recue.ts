import {
  schemaModificationTechnicien,
  schemaTechnicien,
  type SaisieModificationTechnicien,
  type SaisieTechnicien,
} from "@/lib/techniciens/saisie";

import { champ } from "../interventions/actions";

/**
 * LA SAISIE D'UN TECHNICIEN, LUE D'UN FORMULAIRE (ÉQUIPE-1).
 *
 * Écrite une fois, comme `saisiePrestationRecue` : la création et la
 * modification lisent les mêmes formes de champ.
 *
 * « Actif » suit la même règle que `prestations.saisie-recue` : une case à
 * cocher absente du corps vaut « décochée », un formulaire HTML n'envoyant
 * pas les cases non cochées.
 */
export function saisieTechnicienRecue(
  formulaire: FormData,
): SaisieTechnicien | null {
  const analyse = schemaTechnicien.safeParse({
    nom: champ(formulaire, "nom") ?? "",
    email: champ(formulaire, "email") ?? "",
    agence_id: champ(formulaire, "agence_id") ?? "",
    actif: formulaire.get("actif") !== null,
  });
  return analyse.success ? analyse.data : null;
}

export function saisieModificationRecue(
  formulaire: FormData,
): SaisieModificationTechnicien | null {
  const analyse = schemaModificationTechnicien.safeParse({
    agence_id: champ(formulaire, "agence_id") ?? "",
    actif: formulaire.get("actif") !== null,
  });
  return analyse.success ? analyse.data : null;
}

/** Le retour vers l'écran d'équipe, avec son motif s'il y en a un. */
export function versLEquipe(cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/parametres/equipe${suffixe}` },
  });
}
