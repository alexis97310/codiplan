/**
 * LE RETOUR AU FORMULAIRE APRÈS UN REFUS DE SAISIE (9BR-TP-A4b-MESSAGES, CS42)
 * — même raison qu'`app/api/clients/creer/formulaire.ts`. `client` reprend le
 * nom déjà lu par la page (`?client=`, LIENS-1/FICHE-360-1) : le sélecteur de
 * client s'en sert déjà pour préremplir depuis une fiche, un refus de saisie
 * n'a rien à réinventer.
 */
export function versLeFormulaire(
  cle: string,
  champs: Readonly<{
    client?: string;
    agence_id?: string;
    libelle?: string;
    commune?: string;
    zone_geo?: string;
    temps_trajet_min?: string;
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
    headers: { Location: `/sites/nouveau?${parametres.toString()}` },
  });
}
