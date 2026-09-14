import { modifierPrestation } from "@/lib/prestations/depot";

import { contexteCourant } from "../../../../interventions/actions";
import { saisiePrestationRecue, versLeCatalogue } from "../../saisie-recue";

/**
 * MODIFIER UNE PRESTATION (R3-15).
 *
 * L'identifiant vient du chemin, jamais du corps : il désigne la ligne, et la
 * politique décide à qui elle est. *Une prestation d'une autre société rend le
 * MÊME refus qu'un identifiant inconnu* — les distinguer ferait un oracle
 * (D35, D50).
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLeCatalogue("auth.refus");
  }
  const { id } = await params;
  const saisie = saisiePrestationRecue(await requete.formData());
  if (saisie === null) {
    return versLeCatalogue("prestations.refus.saisie");
  }
  const resultat = await modifierPrestation(contexte, id, saisie);
  return versLeCatalogue(
    resultat.accepte ? undefined : `prestations.refus.${resultat.motif}`,
  );
}
