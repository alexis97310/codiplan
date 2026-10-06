import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { obtenirSession } from "@/lib/auth/session";
import { rechercherGlobalement } from "@/lib/navigation/recherche-globale";

/**
 * LA RECHERCHE GLOBALE DU BANDEAU DU BUREAU (QE-3, 9DU-TP-NAV3-RECHERCHE-RAIL,
 * D171) — `Ctrl K` / `/`, ouverte depuis
 * `components/navigation/recherche-globale.tsx`.
 *
 * Toute la logique vit dans `lib/navigation/recherche-globale.ts` : cette
 * route ne fait qu'authentifier l'appelant et traduire la réponse en JSON,
 * exactement la même posture que les quatre routes de `/api/recherche/*`
 * déjà en place pour les sélecteurs de formulaire.
 *
 * **Aucune capacité n'est exigée au-delà d'une session valide** — le bandeau
 * qui l'ouvre est rendu à quiconque a une société active (`app/(back-office)/
 * layout.tsx`), et chaque groupe applique son propre périmètre par personne
 * (voir l'entête de `rechercherGlobalement`).
 */
async function traiter(requete: Request): Promise<Response> {
  const session = await obtenirSession(requete.headers);
  if (session === null || session.contexte.societeId === null) {
    return Response.json({ erreur: "session_absente" }, { status: 401 });
  }

  const url = new URL(requete.url);
  const texte = url.searchParams.get("q") ?? "";

  const groupes = await rechercherGlobalement(session.contexte, texte);

  return Response.json({ groupes });
}

export async function GET(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}
