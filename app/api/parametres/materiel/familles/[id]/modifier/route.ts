import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { modifierFamille } from "@/lib/materiel/depot";

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
  return dansUnEchangeAuth(() => traiter(requete, params));
}

async function traiter(
  requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const contexte = await exigerCapacite("parametrer_societe");
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
