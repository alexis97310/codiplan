import { tenterConnexion } from "@/lib/auth/connexion";
import {
  basculerSociete,
  habilitationsDuCompte,
} from "@/lib/auth/societe-active";

import { champ, redirection, redirectionAvecMotif } from "../reponses";

/**
 * OUVERTURE DE SESSION (ticket L1-02f).
 *
 * Trois issues, et une seule d'entre elles apprend quelque chose : le refus est
 * uniforme (D35), et il ne dit ni si le compte existe, ni si le mot de passe
 * est faux, ni si le compte est habilité quelque part.
 *
 * ## L'ACTIVATION AUTOMATIQUE N'EST PAS UN CHOIX FAIT À LA PLACE DE L'USAGER
 *
 * Elle n'a lieu que si le compte est habilité sur **exactement une** société :
 * il n'y a alors aucun choix à faire, et l'obliger à en faire un serait une
 * cérémonie. Sur plusieurs, rien n'est activé — le sélecteur est un écran de
 * back-office, hors du périmètre de ce ticket, et la page d'arrivée le DIT
 * plutôt que d'inventer un ordre de préférence.
 *
 * Cette lecture n'était possible pour personne avant D61 : `utilisateur_societe`
 * portait la forme « société », et la question « sur quelles sociétés suis-je
 * habilité ? » rendait zéro ligne tant qu'une société n'était pas déjà active.
 */
export async function POST(requete: Request): Promise<Response> {
  const formulaire = await requete.formData();
  const resultat = await tenterConnexion({
    email: champ(formulaire, "email"),
    motDePasse: champ(formulaire, "motDePasse"),
  });

  if (resultat.issue === "refus") {
    return redirectionAvecMotif("/connexion", "auth.refus");
  }

  if (resultat.issue === "second_facteur_requis") {
    // Le cookie de défi part avec la redirection : c'est LUI qui désigne la
    // tentative en cours, et sans lui la présentation du code n'a rien à quoi
    // se rattacher.
    return redirection("/connexion/code", resultat.cookies);
  }

  const habilitations = await habilitationsDuCompte(resultat.utilisateurId);
  if (habilitations.length === 1) {
    const seule = habilitations[0]!;
    await basculerSociete({
      utilisateurId: resultat.utilisateurId,
      jetonSession: resultat.jetonSession,
      societeId: seule.societeId,
      societeIdSource: null,
      // La session vient d'être ouverte sans second facteur : la bascule le
      // sait, et refusera d'elle-même un rôle qui l'exige. On ne préjuge pas
      // de sa décision — on lui donne l'état réel.
      secondFacteurValide: false,
    });
  }

  return redirection("/arrivee", resultat.cookies);
}

/**
 * Un GET sur ce chemin n'ouvre rien : la page de connexion est ailleurs.
 * Le déclarer évite qu'un navigateur qui suit un lien reçoive un 405 opaque.
 */
export async function GET(): Promise<Response> {
  return redirection("/connexion");
}
