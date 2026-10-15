import { envoyerLienDAcces } from "@/lib/auth/acces-technicien";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { RefusEnvoiAcces } from "@/lib/auth/lien-d-acces";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { creerTechnicien } from "@/lib/techniciens/depot";

import { envoyerAccesCoche } from "@/app/api/equipe/bureau/saisie-recue";

import { saisieTechnicienRecue, versLEquipe } from "../saisie-recue";

/**
 * CRÉER UN TECHNICIEN (ÉQUIPE-1).
 *
 * Le refus retourne sur l'écran d'équipe avec son motif, comme les autres
 * écrans de paramétrage — un refus qui renvoie ailleurs fait perdre la
 * saisie.
 *
 * Un courriel déjà pris n'est PAS un refus : `creerTechnicien` rattache la
 * personne existante à la société active, et le retour le dit à l'écran
 * (`resultat.rattache`).
 *
 * **L'INTERRUPTEUR « ENVOYER LE LIEN D'ACCÈS EN L'AJOUTANT » DU VOLET**
 * (9ET-COMPTES-BUREAU-2) — `envoyerAccesCoche`, partagée avec la création
 * d'un compte de bureau (`app/api/equipe/bureau/saisie-recue.ts`) : une case
 * absente du corps vaut « décochée ». La création reste acquise même si
 * l'envoi échoue (solde 174, même discipline que
 * `app/api/equipe/bureau/creer/route.ts`).
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapacite("administrer_utilisateurs");
  if (contexte === null) {
    return versLEquipe(await motifDuRefus());
  }
  const formulaire = await requete.formData();
  const saisie = saisieTechnicienRecue(formulaire);
  if (saisie === null) {
    return versLEquipe("equipe.refus.saisie");
  }
  const resultat = await creerTechnicien(contexte, saisie);
  if (!resultat.accepte) {
    return versLEquipe(`equipe.refus.${resultat.motif}`);
  }
  if (envoyerAccesCoche(formulaire)) {
    try {
      const envoi = await envoyerLienDAcces(contexte, resultat.utilisateurId);
      if (!envoi.accepte) {
        // SOLDE 184 (relecture de 9ET-COMPTES-BUREAU-2) — un rattachement à
        // une identité qui a déjà choisi son mot de passe (le cliquet de
        // D65) n'est pas un ÉCHEC D'ENVOI : la personne a déjà un accès,
        // exactement ce que « Cette personne est déjà connue de la
        // plateforme » dit déjà — jamais « le lien n'a pas pu être envoyé ».
        if (envoi.motif === "deja_un_mot_de_passe" && resultat.rattache) {
          return versLEquipe("equipe.info.rattache");
        }
        return versLEquipe("equipe.refus.envoi_echoue");
      }
      // SOLDE 183 — un envoi ACCEPTÉ mais NON PARTI (le prestataire a
      // refusé le courriel) ne doit pas se taire derrière le motif
      // générique : même redirection que la route dédiée
      // (`app/api/equipe/[id]/envoyer-acces/route.ts`).
      if (!envoi.envoi.parti) {
        const suite = new URLSearchParams({
          motif: "equipe.acces.non_parti",
          technicien: resultat.utilisateurId,
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
        return versLEquipe("equipe.refus.envoi_echoue");
      }
      throw erreur;
    }
  }
  return versLEquipe(resultat.rattache ? "equipe.info.rattache" : undefined);
}
