/**
 * LE RETOUR AU CATALOGUE APRÈS UN REFUS DE SAISIE (9BR-TP-A4b-MESSAGES,
 * PV-45) — même raison qu'`app/api/clients/creer/formulaire.ts`. Chaque
 * paramètre est préfixé `forfait_` : ce catalogue porte déjà `?zone=`, le
 * filtre d'affichage, et les deux ne doivent jamais se confondre.
 */
export function versLeFormulaire(
  cle: string,
  champs: Readonly<{
    forfait_code?: string;
    forfait_libelle?: string;
    forfait_type?: string;
    forfait_rang?: string;
    forfait_montant_mineur?: string;
    forfait_zone_geo?: string;
    forfait_actif?: string;
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
    // UNE SEULE PAGE « TARIFS » (9EWE-PARAMETRES-TARIFS-PAGE-UNIQUE) —
    // `/parametres/forfaits` n'a plus d'écran de catalogue.
    headers: { Location: `/parametres/tarifs?${parametres.toString()}` },
  });
}
