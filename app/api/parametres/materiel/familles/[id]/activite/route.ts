import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { basculerActiviteFamille } from "@/lib/materiel/depot";

import { champ } from "../../../../../interventions/actions";
import { ACTIF, INACTIF, versLeReferentiel } from "../../../saisie-recue";

/**
 * ACTIVER OU DÉSACTIVER UNE FAMILLE (L1-05b).
 *
 * **C'est la seule façon de la retirer du choix**, et il n'y a pas de
 * suppression : quatre clés étrangères la retiennent en `Restrict` — modèles,
 * forfaits, prestations, campagnes de VGP. *Proposer un bouton qui échoue huit
 * fois sur dix est pire que de ne pas le proposer.*
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
    return versLeReferentiel("auth.refus");
  }
  const { id } = await params;
  const vise = champ(await requete.formData(), "actif");
  if (vise !== ACTIF && vise !== INACTIF) {
    return versLeReferentiel("materiel.refus.saisie");
  }
  const resultat = await basculerActiviteFamille(contexte, id, vise === ACTIF);
  return versLeReferentiel(
    resultat.accepte ? undefined : `materiel.refus.${resultat.motif}`,
  );
}
