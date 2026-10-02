import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { auth } from "@/lib/auth/config";
import {
  basculerSociete,
  habilitationsDuCompte,
} from "@/lib/auth/societe-active";
import { obtenirSession } from "@/lib/auth/session";

import { champ, redirection, redirectionAvecMotif } from "../reponses";

/**
 * LA SAISIE D'UN CODE DE SECOURS, À LA CONNEXION (TR-34, 9CW-TP-S6).
 *
 * **Même chemin que `/api/session/code`, un autre point d'entrée de
 * vérification de la bibliothèque.** D59 n'a fermé que `/two-factor/enable` et
 * `/two-factor/disable` — ce qui GOUVERNE le second facteur ; les chemins de
 * VÉRIFICATION, dont `verifyBackupCode`, restent ouverts, et c'est le seul des
 * trois que D64 nomme (`/verify-backup-code`) qu'aucune route locale
 * n'atteignait encore.
 *
 * Le cliquet d'échecs de D64 s'applique ici SANS rien y ajouter : il vit dans
 * un déclencheur PostgreSQL sur `second_facteur`, franchi par les trois
 * chemins de vérification de la bibliothèque — celui-ci y compris, puisque
 * c'est la même écriture, quel que soit le point d'entrée qui la déclenche.
 */
async function traiter(requete: Request): Promise<Response> {
  const formulaire = await requete.formData();
  const code = champ(formulaire, "code");

  let cookies: readonly string[] = [];
  try {
    const reponse = await auth().api.verifyBackupCode({
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

/**
 * L'ÉCHANGE D'AUTHENTIFICATION EST OUVERT ICI (ticket D62).
 *
 * La bibliothèque réécrit par leur `id` des lignes qu'elle vient de lire par
 * leur clé de désignation. Sans échange ouvert, ces écritures ne reçoivent
 * aucun report, la politique lit une variable vide et refuse — silencieusement.
 * L'oubli casse donc la fonctionnalité ; il n'ouvre jamais rien.
 * Voir `lib/auth/echange.ts`.
 */

export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}
