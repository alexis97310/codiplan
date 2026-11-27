import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import {
  AppareilPretIntrouvable,
  basculerActiviteAppareilPret,
} from "@/lib/prets/depot";

import { champ } from "../../../../interventions/actions";
import { ACTIF, INACTIF, versLeParcDePret } from "../../saisie-recue";

/**
 * ACTIVER OU DÉSACTIVER UN APPAREIL DU PARC DE PRÊT (9L61, D287) — le
 * retirer du choix, jamais le supprimer : même doctrine que le référentiel
 * matériel (`materiel.aucune_suppression`).
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
  const formulaire = await requete.formData();
  const { id } = await params;
  const contexte = await exigerCapaciteComplete("gerer_prets");
  if (contexte === null) {
    return versLeParcDePret({ motif: await motifDuRefus() });
  }
  const vise = champ(formulaire, "actif");
  if (vise !== ACTIF && vise !== INACTIF) {
    return versLeParcDePret({ motif: "prets.refus.saisie" });
  }
  try {
    await basculerActiviteAppareilPret(contexte, id, vise === ACTIF);
  } catch (erreur) {
    if (erreur instanceof AppareilPretIntrouvable) {
      return versLeParcDePret({ motif: "prets.refus.introuvable" });
    }
    throw erreur;
  }
  return versLeParcDePret({});
}
