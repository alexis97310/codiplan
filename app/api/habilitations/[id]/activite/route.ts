import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { basculerActiviteHabilitation } from "@/lib/habilitations/depot";

import { champ } from "../../../interventions/actions";
import { versLeReferentiel } from "../../saisie-recue";

/**
 * ACTIVER OU DÉSACTIVER UNE HABILITATION (ÉQUIPE-2).
 *
 * C'est la seule façon de la retirer du choix, comme pour les prestations :
 * une attribution ou une exigence existante continue de la désigner.
 *
 * L'état visé est ENVOYÉ par le formulaire plutôt que déduit d'une bascule,
 * même raison que `prestations/[id]/activite` : une bascule aveugle
 * inverserait un état qu'un autre onglet vient de changer.
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
  const contexte = await exigerCapacite("administrer_utilisateurs");
  if (contexte === null) {
    return versLeReferentiel("auth.refus");
  }
  const { id } = await params;
  const formulaire = await requete.formData();
  const vise = champ(formulaire, "actif");
  if (vise !== ACTIF && vise !== INACTIF) {
    return versLeReferentiel("habilitations.refus.saisie");
  }
  const resultat = await basculerActiviteHabilitation(
    contexte,
    id,
    vise === ACTIF,
  );
  return versLeReferentiel(
    resultat.accepte ? undefined : `habilitations.refus.${resultat.motif}`,
  );
}

const ACTIF = "oui";
const INACTIF = "non";
