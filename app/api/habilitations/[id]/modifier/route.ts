import { modifierHabilitation } from "@/lib/habilitations/depot";

import { contexteCourant } from "../../../interventions/actions";
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
  const contexte = await contexteCourant();
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
