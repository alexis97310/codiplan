import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { basculerActiviteModele } from "@/lib/materiel/depot";
import { suiteRecue } from "@/lib/materiel/suite";

import { champ } from "../../../../../interventions/actions";
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
  return dansUnEchangeAuth(() => traiter(requete, params));
}

async function traiter(
  requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const formulaire = await requete.formData();
  const suite = suiteRecue(formulaire);
  const { id } = await params;
  const contexte = await exigerCapaciteComplete("parametrer_societe");
  if (contexte === null) {
    return versLeReferentiel({ suite, motif: await motifDuRefus() });
  }
  const vise = champ(formulaire, "actif");
  if (vise !== ACTIF && vise !== INACTIF) {
    return versLeReferentiel({ suite, motif: "materiel.refus.saisie", ligne: id });
  }
  const resultat = await basculerActiviteModele(contexte, id, vise === ACTIF);
  return versLeReferentiel({
    suite,
    motif: resultat.accepte ? undefined : `materiel.refus.${resultat.motif}`,
    ligne: id,
  });
}
