import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { creerPrestation } from "@/lib/prestations/depot";

import { saisiePrestationRecue, versLeCatalogue } from "../saisie-recue";

/**
 * CRÉER UNE PRESTATION (R3-15).
 *
 * **Le refus retourne sur le catalogue avec son motif**, et non sur une page
 * blanche : *un refus qui renvoie ailleurs fait perdre la saisie.* Le catalogue
 * porte le formulaire, si bien que le retour est aussi le lieu de la correction.
 *
 * **Aucune devise, aucun montant** : D109 — *une prestation porte une durée,
 * jamais un taux.* Il n'y a donc rien à lire du côté de la société, à la
 * différence de la route jumelle des forfaits.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapacite("parametrer_societe");
  if (contexte === null) {
    return versLeCatalogue("auth.refus");
  }
  const saisie = saisiePrestationRecue(await requete.formData());
  if (saisie === null) {
    return versLeCatalogue("prestations.refus.saisie");
  }
  const resultat = await creerPrestation(contexte, saisie);
  return versLeCatalogue(
    resultat.accepte ? undefined : `prestations.refus.${resultat.motif}`,
  );
}
