import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { modifierHabilitation } from "@/lib/habilitations/depot";

import {
  modificationHabilitationRecue,
  versLeReferentiel,
} from "../../saisie-recue";

/**
 * MODIFIER UNE HABILITATION (ÉQUIPE-2).
 *
 * L'identifiant vient du chemin, jamais du corps. Une habilitation d'une autre
 * société rend le MÊME refus qu'un identifiant inconnu (D35, D50).
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
  const saisie = modificationHabilitationRecue(await requete.formData());
  if (saisie === null) {
    return versLeReferentiel("habilitations.refus.saisie");
  }
  const resultat = await modifierHabilitation(contexte, id, saisie);
  return versLeReferentiel(
    resultat.accepte ? undefined : `habilitations.refus.${resultat.motif}`,
  );
}
