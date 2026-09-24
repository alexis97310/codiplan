/**
 * LE RETOUR AU FORMULAIRE APRÈS UN REFUS DE SAISIE (56-FORMULAIRES-2).
 *
 * `versLePlanning` (`../actions`) fait quitter l'écran et perd tout ce que
 * l'utilisateur avait saisi — c'est le constat de ce lot. Un refus de SAISIE
 * (le schéma, le lieu, la panne) revient ICI, au formulaire, avec ce qui avait
 * été soumis ; un refus de DROIT (`exigerCapacite` → `null`) garde
 * `versLePlanning`, inchangé.
 *
 * Vit dans un fichier À PART de `route.ts` : Next.js n'autorise sur un module
 * de route que les gestionnaires HTTP et sa poignée d'exports de
 * configuration — un export ordinaire y échoue le typage (`tsc` sur
 * `.next/types`). Ce module n'est pas une route, il n'a pas cette contrainte,
 * et reste testable directement.
 *
 * La description est TRONQUÉE à 1000 caractères dans l'URL : au-delà, une
 * panne longue ferait une adresse déraisonnable pour un simple retour d'écran
 * — la valeur pleine reste dans `description` côté serveur, jamais perdue
 * avant ce refus, seul le retour visuel est borné.
 */
const LIMITE_DESCRIPTION_URL = 1000;

export function versLeFormulaire(
  cle: string,
  champs: Readonly<{
    site?: string;
    machine?: string;
    type?: string;
    priorite?: string;
    description?: string;
    reference_client?: string;
    contact_id?: string;
  }>,
): Response {
  const parametres = new URLSearchParams({ motif: cle });
  const valeurs: Readonly<Record<string, string | undefined>> = {
    site: champs.site,
    machine: champs.machine,
    type: champs.type,
    priorite: champs.priorite,
    description: champs.description?.slice(0, LIMITE_DESCRIPTION_URL),
    reference_client: champs.reference_client,
    contact_id: champs.contact_id,
  };
  for (const [nom, valeur] of Object.entries(valeurs)) {
    if (valeur !== undefined) {
      parametres.set(nom, valeur);
    }
  }
  return new Response(null, {
    status: 303,
    headers: { Location: `/interventions/nouvelle?${parametres.toString()}` },
  });
}
