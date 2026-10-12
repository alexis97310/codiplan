import {
  creerCompteDeBureau,
  envoyerLienDAccesBureau,
} from "@/lib/auth/acces-bureau";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";

import {
  envoyerAccesCoche,
  saisieCompteDeBureauRecue,
  versLEquipeBureau,
} from "../saisie-recue";

/**
 * CRÉER UN COMPTE DE BUREAU (D196, 9ET-COMPTES-BUREAU-1).
 *
 * Un courriel déjà pris n'est PAS un refus : `creerCompteDeBureau` rattache
 * la personne existante à la société active, comme pour un technicien
 * (`app/api/techniciens/creer/route.ts`). La case « envoyer le lien en
 * l'ajoutant » appelle ensuite le même geste que le bouton dédié — un
 * courriel non parti n'annule pas la création, déjà actée.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapacite("administrer_utilisateurs");
  if (contexte === null) {
    return versLEquipeBureau(await motifDuRefus());
  }
  const formulaire = await requete.formData();
  const saisie = saisieCompteDeBureauRecue(formulaire);
  if (saisie === null) {
    return versLEquipeBureau("equipe.refus.saisie");
  }
  const resultat = await creerCompteDeBureau(contexte, saisie);
  if (!resultat.accepte) {
    return versLEquipeBureau(`equipe.bureau.refus.${resultat.motif}`);
  }
  if (envoyerAccesCoche(formulaire)) {
    await envoyerLienDAccesBureau(contexte, resultat.utilisateurId);
  }
  return versLEquipeBureau(
    resultat.rattache ? "equipe.info.rattache" : undefined,
  );
}
