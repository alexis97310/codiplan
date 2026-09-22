/**
 * LE SOCLE COMMUN DES ROUTES DE DEMANDE (DEMANDES-1).
 *
 * Même forme que `app/api/interventions/actions.ts`, pour la même raison :
 * une seule écriture de « comment une action de demande redirige », jamais
 * quatre qui divergeraient en silence (§9, 01/09).
 */

/** Redirige vers la fiche d'une demande — 303, pour que le navigateur suive en GET. */
export function versLaFicheDemande(id: string, cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/demandes/${id}${suffixe}` },
  });
}

/** Redirige vers la file de qualification. */
export function versLaFileDeQualification(cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/demandes${suffixe}` },
  });
}
