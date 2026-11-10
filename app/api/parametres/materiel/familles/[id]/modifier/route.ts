import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { modifierFamille } from "@/lib/materiel/depot";
import { suiteRecue } from "@/lib/materiel/suite";

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
  const formulaire = await requete.formData();
  const suite = suiteRecue(formulaire);
  const { id } = await params;
  const contexte = await exigerCapaciteComplete("parametrer_societe");
  if (contexte === null) {
    return versLeReferentiel({ suite, motif: await motifDuRefus() });
  }
  const saisie = saisieFamilleRecue(formulaire);
  if (saisie === null) {
    return versLeReferentiel({
      suite,
      motif: "materiel.refus.saisie",
      volet: { type: "famille", id },
    });
  }
  const resultat = await modifierFamille(contexte, id, saisie);
  if (!resultat.accepte) {
    return versLeReferentiel({
      suite,
      motif: `materiel.refus.${resultat.motif}`,
      volet: { type: "famille", id },
    });
  }
  return versLeReferentiel({ suite, ligne: id });
}
