import { modifierModele } from "@/lib/materiel/depot";

import { contexteCourant } from "../../../../../interventions/actions";
import { saisieModeleRecue, versLeReferentiel } from "../../../saisie-recue";

/**
 * MODIFIER UN MODÈLE DE MATÉRIEL (L1-05b).
 *
 * **La famille peut changer ; la société, jamais.** `societe_id` n'est pas dans
 * les données écrites : la ligne reste où la politique l'a trouvée, et le
 * chaînage composite refuse une famille venue d'ailleurs.
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
  const saisie = saisieModeleRecue(await requete.formData());
  if (saisie === null) {
    return versLeReferentiel("materiel.refus.saisie");
  }
  const resultat = await modifierModele(contexte, id, saisie);
  return versLeReferentiel(
    resultat.accepte ? undefined : `materiel.refus.${resultat.motif}`,
  );
}
