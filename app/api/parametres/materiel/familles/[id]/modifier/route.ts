import { modifierFamille } from "@/lib/materiel/depot";

import { contexteCourant } from "../../../../../interventions/actions";
import { saisieFamilleRecue, versLeReferentiel } from "../../../saisie-recue";

/**
 * MODIFIER UNE FAMILLE DE MATÉRIEL (L1-05b).
 *
 * L'identifiant vient du chemin, jamais du corps : il désigne la ligne, et la
 * politique décide à qui elle est. *Une famille d'une autre société rend le
 * MÊME refus qu'un identifiant inconnu* — les distinguer ferait un oracle
 * (D35, D50).
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLeReferentiel("auth.refus");
  }
  const { id } = await params;
  const saisie = saisieFamilleRecue(await requete.formData());
  if (saisie === null) {
    return versLeReferentiel("materiel.refus.saisie");
  }
  const resultat = await modifierFamille(contexte, id, saisie);
  return versLeReferentiel(
    resultat.accepte ? undefined : `materiel.refus.${resultat.motif}`,
  );
}
