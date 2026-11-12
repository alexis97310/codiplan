import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { dupliquerModele } from "@/lib/checklists/depot";

import {
  saisieModeleChecklistRecue,
  versLeReferentiel,
} from "../../saisie-recue";

/**
 * DUPLIQUER UN MODÈLE (9K20-CHECKLIST-DUPLIQUER-DEPART) — `id` dans le
 * chemin est le modèle SOURCE, jamais celui qu'on crée. Le formulaire porte
 * les mêmes champs que « Créer un modèle » : un nouveau code OBLIGATOIRE
 * (le libellé et le rattachement, préremplis depuis la source par l'écran,
 * restent modifiables avant l'envoi).
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
  const contexte = await exigerCapaciteComplete("parametrer_societe");
  if (contexte === null) {
    return versLeReferentiel(await motifDuRefus());
  }
  const { id } = await params;
  const saisie = saisieModeleChecklistRecue(await requete.formData());
  if (saisie === null) {
    return versLeReferentiel("checklist.parametrage.refus.saisie");
  }
  const resultat = await dupliquerModele(contexte, id, {
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
