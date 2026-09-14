import { enMinutes, type Plage } from "@/lib/calendar/parametrage";
import type { Reglage } from "@/lib/calendar/depot";

import { champ } from "../../interventions/actions";

/**
 * LE SOCLE COMMUN DES TROIS ROUTES DE PLAGE (R3-13).
 *
 * Trois routes — ajouter, modifier, retirer — et un seul endroit où le retour
 * est composé. *Il n'y en aurait pas trois qui redirigeraient de la même façon* :
 * c'est l'argument du socle des routes d'intervention, et il vaut ici.
 *
 * Le refus voyage par un paramètre d'URL qui est une CLÉ de dictionnaire,
 * jamais un texte : sans ce filtre, n'importe qui ferait écrire n'importe quoi
 * à la page en forgeant un lien (L1-02f).
 */

/** Retour vers l'écran de détail d'un calendrier, avec son motif s'il y en a un. */
export function versLeCalendrier(calendrierId: string, cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/parametres/agences/${encodeURIComponent(calendrierId)}${suffixe}`,
    },
  });
}

/** Retour vers le tableau des établissements. */
export function versLesAgences(cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/parametres/agences${suffixe}` },
  });
}

/**
 * Les deux bornes d'un formulaire, en minutes — `null` si l'une ne se lit pas.
 *
 * La conversion REFUSE plutôt qu'elle ne devine : `<input type="time">` rend
 * `HH:MM` et rien d'autre, mais un formulaire se forge, et une heure illisible
 * prise pour minuit ouvrirait une agence à 00:00 sans que personne l'ait
 * demandé.
 */
export function bornes(
  formulaire: FormData,
): Pick<Plage, "debutMinutes" | "finMinutes"> | null {
  const debut = champ(formulaire, "debut");
  const fin = champ(formulaire, "fin");
  if (debut === null || fin === null) {
    return null;
  }
  const debutMinutes = enMinutes(debut);
  const finMinutes = enMinutes(fin);
  if (debutMinutes === null || finMinutes === null) {
    return null;
  }
  return { debutMinutes, finMinutes };
}

/** Le motif d'un verdict, ou `undefined` quand il n'y a rien à dire. */
export function motifDe(reglage: Reglage): string | undefined {
  return reglage.ok ? undefined : reglage.motif;
}
