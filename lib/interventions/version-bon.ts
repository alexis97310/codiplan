/**
 * LE CHOIX DE VERSION DU BON (9EN, D186, QT-8 (a)) — fonction pure, sans
 * base, sans session.
 *
 * Reçoit la valeur BRUTE de `?version=` (ce qu'un `searchParams` Next.js
 * porte réellement : absente, une chaîne, ou un tableau si le paramètre est
 * répété dans l'URL) et le booléen déjà tranché par `accesAuxMontants` —
 * cette fonction ne rappelle jamais cette dernière, elle ne connaît que ce
 * qu'on lui donne (une seule règle du droit, à un seul endroit).
 *
 * **Égalité STRICTE avec `"interne"`** : une casse différente, un tableau, une
 * chaîne vide retombent sur la version client — jamais une redirection, jamais
 * une erreur. Un rôle sans droit qui force `?version=interne` obtient la
 * version client, silencieusement : c'est le même sens de défaillance que
 * `accesAuxMontants`, qui ne retire rien à personne sans qu'on l'ait voulu,
 * appliqué ici à l'inverse — il ne donne rien à qui n'a pas le droit.
 */
export type VersionBon = "client" | "interne";

export function versionDuBon(
  parametre: string | string[] | undefined,
  montantsMontre: boolean,
): VersionBon {
  return parametre === "interne" && montantsMontre ? "interne" : "client";
}
