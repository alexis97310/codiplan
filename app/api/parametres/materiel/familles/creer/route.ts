import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { creerFamille } from "@/lib/materiel/depot";
import { suiteRecue } from "@/lib/materiel/suite";

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
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const formulaire = await requete.formData();
  const suite = suiteRecue(formulaire);
  const contexte = await exigerCapaciteComplete("parametrer_societe");
  if (contexte === null) {
    return versLeReferentiel({ suite, motif: await motifDuRefus() });
  }
  const saisie = saisieFamilleRecue(formulaire);
  if (saisie === null) {
    return versLeReferentiel({
      suite,
      motif: "materiel.refus.saisie",
      volet: { type: "famille" },
    });
  }
  const resultat = await creerFamille(contexte, saisie);
  if (!resultat.accepte) {
    return versLeReferentiel({
      suite,
      motif: `materiel.refus.${resultat.motif}`,
      volet: { type: "famille" },
    });
  }
  return versLeReferentiel({ suite, ligne: resultat.id });
}
