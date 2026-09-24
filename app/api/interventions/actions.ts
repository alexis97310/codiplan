import { headers } from "next/headers";

import { obtenirSession } from "@/lib/auth/session";
import type { ContexteSession } from "@/lib/auth/contexte";

/**
 * LE SOCLE COMMUN DES ROUTES D'INTERVENTION (lot 2, D84).
 *
 * Cinq routes, un seul endroit où la session est vérifiée et où le refus est
 * reporté. *Il n'y en aurait pas deux qui vérifieraient la session de la même
 * façon* — c'est la raison qui a fait écrire le gestionnaire unique de
 * l'authentification, et elle vaut ici.
 *
 * Le refus voyage par un paramètre d'URL qui est une CLÉ de dictionnaire,
 * jamais un texte : sans ce filtre, n'importe qui ferait écrire n'importe quoi
 * à la page en forgeant un lien (L1-02f).
 */

/**
 * Redirige après un POST — 303, pour que le navigateur suive en GET.
 *
 * `avertissements` porte des CLÉS de dictionnaire, jamais du texte — même
 * discipline que `motif` (L1-02f) : sans ce filtre, une réponse forgée ferait
 * écrire n'importe quoi à la page. C'est ce canal qu'AVERTISSEMENTS-1
 * emploie pour dire si le courriel de planification est parti.
 */
export function versLaFiche(
  id: string,
  cle?: string,
  avertissements?: readonly string[],
): Response {
  const parametres = new URLSearchParams();
  if (cle !== undefined) {
    parametres.set("motif", cle);
  }
  for (const avertissement of avertissements ?? []) {
    parametres.append("avertissement", avertissement);
  }
  const suffixe = parametres.size === 0 ? "" : `?${parametres.toString()}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/interventions/${id}${suffixe}` },
  });
}

/** Redirige vers le planning. */
export function versLePlanning(cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/planning${suffixe}` },
  });
}

/**
 * Le contexte de la session, ou `null` s'il n'y en a pas d'exploitable.
 *
 * Une session sans société active n'est pas une erreur : c'est un compte qui
 * n'a pas encore basculé, et il repart de l'arrivée.
 */
export async function contexteCourant(): Promise<ContexteSession | null> {
  const session = await obtenirSession(await headers());
  if (session === null || session.contexte.societeId === null) {
    return null;
  }
  return session.contexte;
}

/** Un champ de formulaire, en chaîne, ou `null` s'il est vide. */
export function champ(formulaire: FormData, nom: string): string | null {
  const valeur = formulaire.get(nom);
  if (typeof valeur !== "string" || valeur.trim().length === 0) {
    return null;
  }
  return valeur.trim();
}
