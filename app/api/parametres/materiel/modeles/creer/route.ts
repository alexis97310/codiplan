import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { creerModele } from "@/lib/materiel/depot";
import { suiteRecue } from "@/lib/materiel/suite";

import { saisieModeleRecue, versLeReferentiel } from "../../saisie-recue";

/**
 * CRÉER UN MODÈLE DE MATÉRIEL (L1-05b).
 *
 * **La famille est obligatoire, et c'est la base qui la tient** : la clé
 * étrangère est composite `(societe_id, famille_id)`, si bien qu'une famille
 * d'une autre société est refusée **par la clé** et non par une comparaison
 * écrite au-dessus de la politique. *Sans la société dans la clé, le verrou
 * serait muet là où le cloisonnement doit mordre.*
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
  const saisie = saisieModeleRecue(formulaire);
  if (saisie === null) {
    return versLeReferentiel({
      suite,
      motif: "materiel.refus.saisie",
      volet: { type: "modele" },
    });
  }
  const resultat = await creerModele(contexte, saisie);
  if (!resultat.accepte) {
    return versLeReferentiel({
      suite,
      motif: `materiel.refus.${resultat.motif}`,
      volet: { type: "modele" },
    });
  }
  return versLeReferentiel({ suite, ligne: resultat.id });
}
