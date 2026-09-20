import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { creerModele } from "@/lib/materiel/depot";

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
  const contexte = await exigerCapacite("parametrer_societe");
  if (contexte === null) {
    return versLeReferentiel("auth.refus");
  }
  const saisie = saisieModeleRecue(await requete.formData());
  if (saisie === null) {
    return versLeReferentiel("materiel.refus.saisie");
  }
  const resultat = await creerModele(contexte, saisie);
  return versLeReferentiel(
    resultat.accepte ? undefined : `materiel.refus.${resultat.motif}`,
  );
}
