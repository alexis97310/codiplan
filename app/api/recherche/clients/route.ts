import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { obtenirSession } from "@/lib/auth/session";
import { compterClients, rechercherClients } from "@/lib/clients/depot";
import { schemaRechercheClient } from "@/lib/clients/saisie";

/**
 * RECHERCHE SERVEUR DE CLIENTS, POUR UN SÉLECTEUR (SELECTEURS-1, 24/09/2026).
 *
 * `rechercherClients` existait déjà (L1-01) — cette route ne fait qu'exposer
 * ses critères par l'URL, cloisonnée par le même contexte que tout le reste
 * de l'application. Seuls les clients ACTIFS sont proposés : un sélecteur de
 * création n'a rien à faire d'un client désactivé.
 *
 * **Aucune capacité n'est exigée au-delà d'une session valide** — même
 * posture que les écrans qui l'appellent (`/sites/nouveau`,
 * `/interventions/nouvelle`, `/parc/nouvelle`), qui ne portent eux-mêmes
 * aucun contrôle de rôle au-delà de la société active.
 */
async function traiter(requete: Request): Promise<Response> {
  const session = await obtenirSession(requete.headers);
  if (session === null || session.contexte.societeId === null) {
    return Response.json({ erreur: "session_absente" }, { status: 401 });
  }

  const url = new URL(requete.url);
  const saisie = schemaRechercheClient.safeParse({
    texte: url.searchParams.get("q") ?? undefined,
    etat: "actifs",
    inclure_sans_equipement: true,
    limite: 20,
    page: url.searchParams.get("page") ?? undefined,
  });
  if (!saisie.success) {
    return Response.json({ erreur: "requete_invalide" }, { status: 400 });
  }
  const criteres = saisie.data;

  const [resultats, total] = await Promise.all([
    rechercherClients(session.contexte, criteres),
    compterClients(session.contexte, criteres),
  ]);

  return Response.json({
    resultats: resultats.map((client) => ({
      id: client.id,
      libelle: client.raison_sociale,
    })),
    page: criteres.page,
    limite: criteres.limite,
    total,
  });
}

export async function GET(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}
