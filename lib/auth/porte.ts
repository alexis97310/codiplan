import { headers } from "next/headers";

import { type Capacite, peut } from "./habilitations";
import { type ContexteActif } from "./contexte";
import { obtenirSession, type SessionServeur } from "./session";

/**
 * LA PORTE — le premier appelant de la matrice depuis une route (D-12).
 *
 * ## Ce que ce fichier répare
 *
 * `contexteCourant()` (`app/api/interventions/actions.ts`) prouve une session
 * et une société ; il ne lit aucun rôle. `lib/auth/habilitations.ts` transcrit
 * la matrice du §5.2, éprouvée, et n'avait pour appelants hors tests que deux
 * modules de lecture — aucune route. Un rôle sans la capacité qu'exige un
 * geste pouvait donc l'accomplir quand même : le cloisonnement entre sociétés
 * restait intact, l'autorisation À L'INTÉRIEUR d'une société n'existait pas.
 *
 * `exigerCapacite` remplace `contexteCourant()` là, et seulement là, où un
 * geste exige une capacité précise de la matrice.
 *
 * ## TROIS POINTS DE CONCEPTION
 *
 * **`peut`, pas `peutPleinement`.** Le niveau « restreint » (○) dit un
 * périmètre limité ou une lecture seule — une restriction de PORTÉE, que
 * cette porte ne sait pas juger et qui appartient au dépôt appelé ensuite.
 * Fermer ○ ici fermerait des chemins que la matrice ouvre.
 *
 * **Le refus ne dit pas pourquoi.** Il rend `null`, exactement comme une
 * session absente : l'appelant refuse par le même chemin, avec le même
 * message. Un refus qui nommerait la capacité manquante apprendrait à
 * l'appelant la carte des capacités.
 *
 * **Aucun message nouveau, aucun code HTTP nouveau.** Cette porte change QUI
 * passe, jamais ce que l'écran affiche.
 *
 * ## LA COUTURE DE LECTURE, ET POURQUOI ELLE EXISTE
 *
 * `lecture` est injectable, par défaut la lecture réelle des en-têtes de la
 * requête — même patron que `lib/auth/chrome.ts`. Chaque appel de route reste
 * `exigerCapacite("...")`, un seul argument : le second n'est vu que des
 * tests, qui lui passent une session fabriquée plutôt que de dépendre d'une
 * requête Next et d'une base pour éprouver « rôle sans la capacité → `null` ».
 * *Elle ne prend pas les en-têtes en paramètre séparé* : `headers()` lève hors
 * d'une requête Next, et un appel nu à sa place échouerait au premier test qui
 * fournit sa propre lecture, avant même de l'atteindre.
 */
export async function exigerCapacite(
  capacite: Capacite,
  lecture: () => Promise<SessionServeur | null> = async () =>
    obtenirSession(await headers()),
): Promise<ContexteActif | null> {
  const session = await lecture();
  if (
    session === null ||
    session.contexte.societeId === null ||
    session.contexte.role === null
  ) {
    return null;
  }
  const contexte: ContexteActif = {
    ...session.contexte,
    societeId: session.contexte.societeId,
    role: session.contexte.role,
  };
  return peut(contexte.role, capacite) ? contexte : null;
}
