import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { modifierModele } from "@/lib/materiel/depot";
import { suiteRecue } from "@/lib/materiel/suite";

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
  const saisie = saisieModeleRecue(formulaire);
  if (saisie === null) {
    return versLeReferentiel({
      suite,
      motif: "materiel.refus.saisie",
      volet: { type: "modele", id },
    });
  }
  const resultat = await modifierModele(contexte, id, saisie);
  if (!resultat.accepte) {
    return versLeReferentiel({
      suite,
      motif: `materiel.refus.${resultat.motif}`,
      volet: { type: "modele", id },
    });
  }
  return versLeReferentiel({ suite, ligne: id });
}
