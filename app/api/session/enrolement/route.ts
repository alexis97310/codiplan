import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { confirmerEnrolement, preparerEnrolement } from "@/lib/auth/enrolement";
import { obtenirSession } from "@/lib/auth/session";

import { champ, redirection, redirectionAvecMotif } from "../reponses";

/**
 * LES DEUX ÉTAPES DE L'ENRÔLEMENT (ticket L1-02f, décision D58).
 *
 * Un seul chemin, deux étapes distinguées par le champ `etape` du formulaire :
 * la préparation, qui révèle la clé contre le mot de passe, et la confirmation,
 * qui présente le code. La clé et les codes de secours ne transitent que dans
 * la RÉPONSE de la préparation — ils ne sont jamais relisibles.
 *
 * **Rien ici ne désenrôle**, et rien ne le pourrait : `second_facteur` n'a
 * aucune politique de suppression (D59) et le cliquet de `utilisateur` refuse
 * le retour du drapeau à `false` (L1-02f).
 */
async function traiter(requete: Request): Promise<Response> {
  const formulaire = await requete.formData();
  const session = await obtenirSession(requete.headers);
  if (session === null) {
    return redirection("/connexion");
  }

  if (champ(formulaire, "etape") === "preparer") {
    const preparation = await preparerEnrolement(requete.headers, {
      motDePasse: champ(formulaire, "motDePasse"),
    });
    if (preparation.issue !== "prepare") {
      return redirectionAvecMotif("/enrolement", "auth.refus");
    }
    // La clé et les codes de secours voyagent dans l'URL de redirection, une
    // seule fois, vers la page qui les affiche. Ils ne sont écrits nulle part
    // ailleurs et ne se relisent pas : la seule autre voie aurait été de les
    // remettre en base en clair, ce que D59 a précisément retiré.
    const parametres = new URLSearchParams({
      cle: preparation.cleManuelle,
      uri: preparation.uriTotp,
      secours: preparation.codesSecours.join(","),
    });
    return redirection(`/enrolement?${parametres.toString()}`);
  }

  const confirmation = await confirmerEnrolement(
    requete.headers,
    session.contexte.utilisateurId,
    session.jetonSession,
    { code: champ(formulaire, "code") },
  );
  if (confirmation.issue !== "enrole") {
    return redirectionAvecMotif("/enrolement", "enrolement.code_invalide");
  }
  // La session qui a enrôlé a été fermée : on repart de la connexion, et le
  // second facteur y sera demandé.
  return redirectionAvecMotif("/connexion", "connexion.apres_enrolement");
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
