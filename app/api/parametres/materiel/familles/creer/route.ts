import { creerFamille } from "@/lib/materiel/depot";

import { contexteCourant } from "../../../../interventions/actions";
import { saisieFamilleRecue, versLeReferentiel } from "../../saisie-recue";

/**
 * CRÉER UNE FAMILLE DE MATÉRIEL (L1-05b).
 *
 * **Le refus retourne sur le référentiel avec son motif**, et non sur une page
 * blanche : *un refus qui renvoie ailleurs fait perdre la saisie.* L'écran porte
 * le formulaire, si bien que le retour est aussi le lieu de la correction.
 *
 * **Aucun champ de VGP** : une famille naît `a_determiner`, et c'est `/vgp` qui
 * la fait sortir de cet état (L9-03). *Deux entrées sur la même règle, c'est la
 * seconde qui ne connaît pas la première.*
 */
export async function POST(requete: Request): Promise<Response> {
  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLeReferentiel("auth.refus");
  }
  const saisie = saisieFamilleRecue(await requete.formData());
  if (saisie === null) {
    return versLeReferentiel("materiel.refus.saisie");
  }
  const resultat = await creerFamille(contexte, saisie);
  return versLeReferentiel(
    resultat.accepte ? undefined : `materiel.refus.${resultat.motif}`,
  );
}
