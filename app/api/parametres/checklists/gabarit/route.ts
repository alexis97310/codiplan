import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { creerModeleDepuisGabarit } from "@/lib/checklists/depot";

import { saisieGabaritRecue, versLeReferentiel } from "../saisie-recue";

/**
 * PARTIR D'UN GABARIT DE DÉPART (9K20-CHECKLIST-DUPLIQUER-DEPART, étendue au
 * rattachement par 9L04B-GABARIT-RATTACHEMENT) — crée un modèle depuis l'un
 * des gabarits de `lib/checklists/gabarits-de-depart.ts` et publie sa
 * version 1 avec les points du gabarit, inchangés. Le rattachement
 * (sous-type, famille ou modèle) et `exige_machine` sont ceux CHOISIS à
 * l'écran, jamais déduits du texte de suggestion — même discipline que
 * `/api/parametres/checklists/creer`.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapaciteComplete("parametrer_societe");
  if (contexte === null) {
    return versLeReferentiel(await motifDuRefus());
  }
  const saisie = saisieGabaritRecue(await requete.formData());
  if (saisie === null) {
    return versLeReferentiel("checklist.parametrage.refus.saisie");
  }
  const resultat = await creerModeleDepuisGabarit(contexte, saisie.gabaritId, {
    code: saisie.code,
    libelle: saisie.libelle,
    typesIntervention: saisie.typesIntervention,
    sousTypeId: saisie.sousTypeId ?? undefined,
    familleId: saisie.familleId ?? undefined,
    modeleId: saisie.modeleId ?? undefined,
    exigeMachine: saisie.exigeMachine,
  });
  return versLeReferentiel(
    resultat.accepte
      ? undefined
      : `checklist.parametrage.refus.${resultat.motif}`,
  );
}
