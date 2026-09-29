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
 * **Le refus ne dit pas QUELLE capacité manque.** `exigerCapacite` rend
 * `null` par le même chemin pour une session absente et pour un rôle sans la
 * capacité : l'appelant ne reçoit jamais le nom de la capacité manquante, qui
 * apprendrait à qui sonde la carte des capacités.
 *
 * Décision d'Alexis (29/09/2026, ~07h10 NC, ticket 9BP-TP-A4a-MESSAGES) : ce
 * que la porte ne distingue pas, l'appelant le distingue quand même, à un
 * niveau plus grossier — un refus de DROIT (rôle présent, capacité absente)
 * nomme désormais son motif, « Votre rôle ne permet pas cette action »,
 * distinct de l'échec de connexion et de la base injoignable. C'est l'objet
 * de `motifDuRefus` ci-dessous, qui relit la session pour ce seul verdict et
 * ne touche à rien du contrat d'`exigerCapacite`.
 *
 * **Aucun code HTTP nouveau.** Cette porte change QUI passe ; ce que l'écran
 * affiche à un refus se décide désormais par `motifDuRefus`, jamais ici.
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

/**
 * LE MOTIF D'UN REFUS DÉJÀ DÉCIDÉ (D-12, décision d'Alexis du 29/09/2026).
 *
 * À appeler UNIQUEMENT dans la branche `contexte === null` qui suit
 * `exigerCapacite` (ou `contexteDuTerrain`, qui l'enveloppe) : cette fonction
 * ne juge rien, elle NOMME. Elle relit la session une seconde fois plutôt que
 * de recevoir le contexte, parce que le seul fait disponible à l'appelant à
 * cet endroit est `null` — sans dire pourquoi.
 *
 * Deux motifs seulement, à la résolution que la porte peut honnêtement
 * garantir : `"auth.refus"` si la session, la société ou le rôle manquent
 * (le même refus qu'un échec de connexion, D35) ; `"auth.refus_droit"` si une
 * session complète existe mais que le rôle n'a pas la capacité exigée. Elle
 * ne nomme JAMAIS la capacité elle-même.
 */
export async function motifDuRefus(
  lecture: () => Promise<SessionServeur | null> = async () =>
    obtenirSession(await headers()),
): Promise<"auth.refus" | "auth.refus_droit"> {
  const session = await lecture();
  if (
    session === null ||
    session.contexte.societeId === null ||
    session.contexte.role === null
  ) {
    return "auth.refus";
  }
  return "auth.refus_droit";
}
