import {
  creerCompteDeBureau,
  envoyerLienDAccesBureau,
} from "@/lib/auth/acces-bureau";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { RefusEnvoiAcces } from "@/lib/auth/lien-d-acces";
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
 *
 * **LA CRÉATION RESTE ACQUISE MÊME SI L'ENVOI ÉCHOUE** (solde 174, relecture
 * de 9ET-COMPTES-BUREAU-1) — `envoyerLienDAccesBureau` peut rendre un refus
 * nommé (improbable juste après la création, mais pas impossible : la ligne
 * vient d'être écrite par CE MÊME geste) ou lever `RefusEnvoiAcces` (aucun
 * jeton émis). Avant ce correctif, ni l'un ni l'autre n'était intercepté : un
 * refus nommé passait inaperçu, et l'exception aurait fait échouer toute la
 * requête par un 500 — effaçant à l'écran une création pourtant actée. Le
 * compte reste créé ; seul le motif du retour change.
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
    try {
      const envoi = await envoyerLienDAccesBureau(
        contexte,
        resultat.utilisateurId,
      );
      if (!envoi.accepte) {
        // SOLDE 184 — même correctif que `techniciens/creer` : le cliquet de
        // D65 sur un rattachement n'est pas un échec d'envoi.
        if (envoi.motif === "deja_un_mot_de_passe" && resultat.rattache) {
          return versLEquipeBureau("equipe.info.rattache");
        }
        return versLEquipeBureau("equipe.bureau.refus.envoi_echoue");
      }
      // SOLDE 183 — même correctif que `techniciens/creer` : un envoi
      // ACCEPTÉ mais NON PARTI redirige vers le motif « non parti ».
      if (!envoi.envoi.parti) {
        const suite = new URLSearchParams({
          onglet: "bureau",
          motif: "equipe.acces.non_parti",
          compte: resultat.utilisateurId,
          destinataire: envoi.destinataire,
          raison: envoi.envoi.motif,
        });
        return new Response(null, {
          status: 303,
          headers: { Location: `/parametres/equipe?${suite.toString()}` },
        });
      }
    } catch (erreur: unknown) {
      if (erreur instanceof RefusEnvoiAcces) {
        return versLEquipeBureau("equipe.bureau.refus.envoi_echoue");
      }
      throw erreur;
    }
  }
  return versLEquipeBureau(
    resultat.rattache ? "equipe.info.rattache" : undefined,
  );
}
