/**
 * LE RETOUR AU FORMULAIRE APRÈS UN REFUS DE SAISIE (9BR-TP-A4b-MESSAGES,
 * PA-06) — même raison qu'`app/api/clients/creer/formulaire.ts`.
 */
export function versLeFormulaire(
  cle: string,
  champs: Readonly<{
    code?: string;
    libelle?: string;
    territoire?: string;
    fuseau_horaire?: string;
  }> = {},
): Response {
  const parametres = new URLSearchParams({ motif: cle });
  for (const [nom, valeur] of Object.entries(champs)) {
    if (valeur !== undefined) {
      parametres.set(nom, valeur);
    }
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/parametres/agences/nouvelle?${parametres.toString()}`,
    },
  });
}
