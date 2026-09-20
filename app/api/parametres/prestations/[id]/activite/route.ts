import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { basculerActivite } from "@/lib/prestations/depot";

import { champ } from "../../../../interventions/actions";
import { versLeCatalogue } from "../../saisie-recue";

/**
 * ACTIVER OU DÉSACTIVER UNE PRESTATION (R3-15).
 *
 * **C'est la seule façon de la retirer du choix**, et il n'y a pas de
 * suppression : une intervention désignera sa prestation, et *une facture émise
 * sous une prestation disparue ne s'explique plus.* Désactiver retire du CHOIX
 * sans toucher au passé.
 *
 * L'état visé est ENVOYÉ par le formulaire plutôt que déduit d'une bascule :
 * une bascule aveugle inverserait un état qu'un autre onglet vient de changer,
 * et personne ne saurait lequel des deux a gagné.
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
    return versLeCatalogue("auth.refus");
  }
  const { id } = await params;
  const formulaire = await requete.formData();
  const vise = champ(formulaire, "actif");
  if (vise !== ACTIF && vise !== INACTIF) {
    return versLeCatalogue("prestations.refus.saisie");
  }
  const resultat = await basculerActivite(contexte, id, vise === ACTIF);
  return versLeCatalogue(
    resultat.accepte ? undefined : `prestations.refus.${resultat.motif}`,
  );
}

const ACTIF = "oui";
const INACTIF = "non";
