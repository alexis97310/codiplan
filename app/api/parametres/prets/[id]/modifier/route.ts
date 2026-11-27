import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import {
  AppareilPretIntrouvable,
  modifierAppareilPret,
} from "@/lib/prets/depot";

import { saisieAppareilPretRecue, versLeParcDePret } from "../../saisie-recue";

/**
 * MODIFIER UN APPAREIL DU PARC DE PRÊT (9L61-PRET-2-ECRANS-BUREAU).
 *
 * L'identifiant vient du chemin, jamais du corps — un appareil d'une autre
 * société rend le MÊME refus qu'un identifiant inconnu (D35, D50), la
 * politique RLS « société » le cachant déjà avant que le dépôt ne lève
 * `AppareilPretIntrouvable`.
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
  const saisie = saisieAppareilPretRecue(formulaire);
  if (saisie === null) {
    return versLeParcDePret({
      motif: "prets.refus.saisie",
      volet: { id },
    });
  }
  try {
    await modifierAppareilPret(contexte, id, saisie);
  } catch (erreur) {
    if (erreur instanceof AppareilPretIntrouvable) {
      return versLeParcDePret({ motif: "prets.refus.introuvable" });
    }
    throw erreur;
  }
  return versLeParcDePret({});
}
