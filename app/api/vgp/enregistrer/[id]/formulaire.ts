const LIMITE_OBSERVATIONS_URL = 1000;

/**
 * LE RETOUR AU FORMULAIRE APRÈS UN REFUS DE SAISIE (9BR-TP-A4b-MESSAGES,
 * PV-45) — même raison qu'`app/api/interventions/creer/formulaire.ts`. Les
 * observations sont tronquées dans l'URL pour la même raison que la panne
 * signalée d'une intervention : la valeur pleine reste en base, seul le
 * retour visuel est borné.
 */
export function versLeFormulaire(
  id: string,
  cle: string,
  champs: Readonly<{
    date_verification?: string;
    origine?: string;
    organisme?: string;
    reference_rapport?: string;
    observations?: string;
  }> = {},
): Response {
  const parametres = new URLSearchParams({ motif: cle });
  const valeurs: Readonly<Record<string, string | undefined>> = {
    date_verification: champs.date_verification,
    origine: champs.origine,
    organisme: champs.organisme,
    reference_rapport: champs.reference_rapport,
    observations: champs.observations?.slice(0, LIMITE_OBSERVATIONS_URL),
  };
  for (const [nom, valeur] of Object.entries(valeurs)) {
    if (valeur !== undefined) {
      parametres.set(nom, valeur);
    }
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/vgp/enregistrer/${id}?${parametres.toString()}`,
    },
  });
}
