import { basculerActiviteModele } from "@/lib/materiel/depot";

import { champ, contexteCourant } from "../../../../../interventions/actions";
import { ACTIF, INACTIF, versLeReferentiel } from "../../../saisie-recue";

/**
 * ACTIVER OU DÉSACTIVER UN MODÈLE (L1-05b).
 *
 * Les machines qui le désignent ne bougent pas : désactiver retire du CHOIX au
 * moment de recenser, sans toucher au parc déjà recensé. *Une fiche machine dont
 * le modèle aurait disparu ne s'expliquerait plus.*
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
  const vise = champ(await requete.formData(), "actif");
  if (vise !== ACTIF && vise !== INACTIF) {
    return versLeReferentiel("materiel.refus.saisie");
  }
  const resultat = await basculerActiviteModele(contexte, id, vise === ACTIF);
  return versLeReferentiel(
    resultat.accepte ? undefined : `materiel.refus.${resultat.motif}`,
  );
}
