/**
 * LE RETOUR AU FORMULAIRE APRÈS UN REFUS DE SAISIE (9BR-TP-A4b-MESSAGES, CS23)
 * — même raison qu'`app/api/interventions/creer/formulaire.ts` : un refus de
 * SAISIE revient ICI, au formulaire, avec ce qui avait été soumis ; un refus
 * de DROIT (`motifDuRefus`) n'a rien à reprendre, et l'appelant ne passe alors
 * aucun champ.
 *
 * Vit dans un fichier À PART de `route.ts` : Next.js n'autorise sur un module
 * de route que les gestionnaires HTTP et sa poignée d'exports de
 * configuration — un export ordinaire y échoue le typage (`tsc` sur
 * `.next/types`).
 */
export function versLeFormulaire(
  cle: string,
  champs: Readonly<{
    raison_sociale?: string;
    code_externe?: string;
    ridet?: string;
    categorie?: string;
    conditions_reglement?: string;
    commercial_referent?: string;
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
    headers: { Location: `/clients/nouveau?${parametres.toString()}` },
  });
}
