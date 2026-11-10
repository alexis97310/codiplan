import { Prisma } from "@prisma/client";

import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { publierVersion } from "@/lib/checklists/depot";

import { saisieVersionRecue, versLeReferentiel } from "../../saisie-recue";

/**
 * PUBLIER UNE VERSION (9K19-CHECKLIST-PARAMETRAGE, CK3) — « Publier »
 * (premier appel) et « Modifier » (l'éditeur prérempli de la dernière
 * version) soumettent le MÊME formulaire, vers la MÊME route : `publier
 * Version` crée TOUJOURS la version N+1, jamais une réécriture (D235).
 *
 * `checklistModeleId` vient du chemin, jamais du corps — même discipline
 * que `materiel/sous-types/[id]/modifier`. Un identifiant d'une AUTRE
 * société refuse PAR LA CLÉ (`checklist_version_societe_id_checklist_
 * modele_id_fkey`), traduit ici en `introuvable` (D50 : jamais dit si le
 * modèle existe ailleurs).
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
  const points = saisieVersionRecue(await requete.formData());
  if (points === null) {
    return versLeReferentiel("checklist.parametrage.refus.saisie");
  }
  try {
    await publierVersion(contexte, id, points);
  } catch (erreur: unknown) {
    if (erreur instanceof Prisma.PrismaClientKnownRequestError) {
      return versLeReferentiel("checklist.parametrage.refus.introuvable");
    }
    throw erreur;
  }
  return versLeReferentiel();
}
