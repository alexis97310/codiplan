import { auth } from "@/lib/auth/config";
import {
  basculerSociete,
  habilitationsDuCompte,
} from "@/lib/auth/societe-active";
import { obtenirSession } from "@/lib/auth/session";

import { champ, redirection, redirectionAvecMotif } from "../reponses";

/**
 * PRÉSENTATION DU SECOND FACTEUR À LA CONNEXION (ticket L1-02f).
 *
 * **Ce chemin-ci passe par la bibliothèque, et c'est délibéré.** D59 a fermé
 * `/two-factor/enable` et `/two-factor/disable` — ce qui GOUVERNE le facteur —
 * et a laissé ouverts les chemins de VÉRIFICATION : les fermer interdirait la
 * connexion de tout compte qui en porte un. La vérification vit donc là où
 * l'enrôlement l'a mise, et le code accepté ici est exactement celui
 * qu'accepterait l'enrôlement.
 */
export async function POST(requete: Request): Promise<Response> {
  const formulaire = await requete.formData();
  const code = champ(formulaire, "code");

  let cookies: readonly string[] = [];
  try {
    const reponse = await auth().api.verifyTOTP({
      body: { code },
      headers: requete.headers,
      asResponse: true,
    });
    if (reponse.status !== 200) {
      return redirectionAvecMotif("/connexion/code", "auth.refus");
    }
    cookies = reponse.headers.getSetCookie?.() ?? [];
  } catch {
    return redirectionAvecMotif("/connexion/code", "auth.refus");
  }

  // La session est désormais ouverte AVEC le facteur présenté. On relit ce que
  // le navigateur portera — les nouveaux cookies —, pour activer la société sur
  // la BONNE session : celle qui vient de naître, pas celle du défi.
  const entetes = new Headers();
  for (const cookie of cookies) {
    entetes.append("cookie", cookie.split(";")[0] ?? "");
  }
  const session = await obtenirSession(entetes);
  if (session !== null) {
    const habilitations = await habilitationsDuCompte(
      session.contexte.utilisateurId,
    );
    if (habilitations.length === 1) {
      await basculerSociete({
        utilisateurId: session.contexte.utilisateurId,
        jetonSession: session.jetonSession,
        societeId: habilitations[0]!.societeId,
        societeIdSource: null,
        secondFacteurValide: session.contexte.secondFacteurValide,
      });
    }
  }

  return redirection("/arrivee", cookies);
}
