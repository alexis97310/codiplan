import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { uuidv7 } from "@/lib/db/uuid";
import { creerAppareilPret } from "@/lib/prets/depot";

import { saisieAppareilPretRecue, versLeParcDePret } from "../saisie-recue";

/**
 * CRÉER UN APPAREIL DU PARC DE PRÊT (9L61-PRET-2-ECRANS-BUREAU, D287).
 *
 * `exigerCapaciteComplete`, pas `exigerCapacite` simple — même consigne que
 * la passation de 9L60 : `gerer_prets` ne porte aucun ○, et le dépôt
 * revérifie `peutPleinement` de son côté (défense en profondeur), jamais à
 * la place de cette porte.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const formulaire = await requete.formData();
  const contexte = await exigerCapaciteComplete("gerer_prets");
  if (contexte === null) {
    return versLeParcDePret({ motif: await motifDuRefus() });
  }
  const saisie = saisieAppareilPretRecue(formulaire);
  if (saisie === null) {
    return versLeParcDePret({ motif: "prets.refus.saisie", volet: {} });
  }
  const id = uuidv7();
  await creerAppareilPret(contexte, id, saisie);
  return versLeParcDePret({});
}
