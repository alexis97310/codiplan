import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { obtenirSession } from "@/lib/auth/session";
import { basculerSociete } from "@/lib/auth/societe-active";

import { champ, redirection, redirectionAvecMotif } from "../reponses";

/**
 * ACTIVER UNE SOCIÉTÉ — le chemin qui manquait (D61, D67).
 *
 * ## Ce qu'il débloque, et depuis quand
 *
 * D61 (08/09) a rendu à un compte la LISTE de ses sociétés ; D67 (10/09) leur
 * NOM. Les deux politiques ont été posées, éprouvées, gardées — **et rien ne
 * les appelait.** *Mesuré le 10/09/2026 en photographiant la page d'arrivée
 * d'un compte habilité sur deux sociétés : « Aucune société active. Le choix
 * d'une société parmi plusieurs arrivera avec le back-office. »* Ce compte
 * n'atteignait aucun écran cloisonné — le mur abattu en base tenait encore à
 * l'écran, et seule l'image l'a montré (§9, 09/09).
 *
 * ## Ce que cette route ne décide PAS
 *
 * Elle ne juge rien : `basculerSociete` porte toute la décision — habilitation
 * relue en base, compte actif, second facteur exigé par le rôle —, journalise
 * son refus, et applique le plancher de durée de D35. **Recopier ici l'un de
 * ces contrôles serait une seconde lecture d'un même critère** (§9, 01/09).
 *
 * Le refus est UNIFORME et sans détail : distinguer « société inconnue » de
 * « pas habilité » apprendrait à un compte quelles sociétés existent.
 */
async function traiter(requete: Request): Promise<Response> {
  const session = await obtenirSession(requete.headers);
  if (session === null) {
    return redirection("/connexion");
  }

  const formulaire = await requete.formData();
  const societeId = champ(formulaire, "societe");
  if (societeId === "") {
    return redirectionAvecMotif("/arrivee", "auth.refus");
  }

  const resultat = await basculerSociete({
    utilisateurId: session.contexte.utilisateurId,
    societeId,
    jetonSession: session.jetonSession,
    secondFacteurValide: session.contexte.secondFacteurValide,
    societeIdSource: session.contexte.societeId,
    adresseIp: session.contexte.adresseIp,
  });

  if (!resultat.accepte) {
    return redirectionAvecMotif("/arrivee", "auth.refus");
  }

  // On repart vers l'arrivée plutôt que vers le planning : la page d'arrivée
  // dit ce qui a changé — la société active et le rôle qui va avec — et c'est
  // ce qu'un compte doit voir avant d'agir sous une identité de société.
  return redirection("/arrivee");
}

/**
 * L'ÉCHANGE D'AUTHENTIFICATION EST OUVERT ICI (D64).
 *
 * `basculerSociete` réécrit la ligne de `session` en la nommant par son jeton,
 * et lit `utilisateur` par désignation. Sans échange ouvert, ces opérations
 * lisent une désignation vide et la politique refuse — en silence.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}
