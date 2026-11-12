import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { creerModele, motifModeleChecklist } from "@/lib/checklists/depot";

import { saisieModeleChecklistRecue, versLeReferentiel } from "../saisie-recue";

/**
 * CRÉER UN MODÈLE DE CHECKLIST (9K19-CHECKLIST-PARAMETRAGE, CK3).
 *
 * `creerModele` (`lib/checklists/depot.ts`, 9K08-CHECKLIST-SCHEMA) ne
 * traduit pas elle-même ses refus — la discipline suivie par cette route
 * est celle de `materiel/familles/creer` : le motif se lit APRÈS l'écriture,
 * jamais avant, par `motifModeleChecklist`.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapaciteComplete("parametrer_societe");
  if (contexte === null) {
    return versLeReferentiel(await motifDuRefus());
  }
  const saisie = saisieModeleChecklistRecue(await requete.formData());
  if (saisie === null) {
    return versLeReferentiel("checklist.parametrage.refus.saisie");
  }
  try {
    await creerModele(contexte, {
      code: saisie.code,
      libelle: saisie.libelle,
      typesIntervention: saisie.typesIntervention,
      sousTypeId: saisie.sousTypeId ?? undefined,
      familleId: saisie.familleId ?? undefined,
      modeleId: saisie.modeleId ?? undefined,
      exigeMachine: saisie.exigeMachine,
    });
  } catch (erreur: unknown) {
    const motif = motifModeleChecklist(erreur);
    if (motif === null) throw erreur;
    return versLeReferentiel(`checklist.parametrage.refus.${motif}`);
  }
  return versLeReferentiel();
}
