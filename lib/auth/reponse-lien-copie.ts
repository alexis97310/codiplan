/**
 * LA RÉPONSE JSON COMMUNE AUX QUATRE ROUTES « COPIER UN LIEN D'ACCÈS »
 * (B4, relecture de 9I6B, 9I7D-RESERVES-DE-REVUE-ACCES-ET-MENTIONS) —
 * `app/api/equipe/[id]/copier-lien`, `.../copier-nouveau-lien`,
 * `app/api/equipe/bureau/[id]/copier-lien`, `.../copier-nouveau-lien`.
 *
 * `Cache-Control: no-store` sur TOUTE réponse, succès comme refus — même
 * motif que `/api/sante` (`app/api/sante/route.ts`) : le succès porte une
 * URL qui est un secret au porteur, jamais une valeur qu'un cache
 * intermédiaire ou le navigateur devrait pouvoir rejouer.
 */
export function reponseLienCopie(
  corps: Readonly<{ readonly url?: string; readonly erreur?: string }>,
  init?: ResponseInit,
): Response {
  return Response.json(corps, {
    ...init,
    headers: { ...init?.headers, "cache-control": "no-store" },
  });
}
