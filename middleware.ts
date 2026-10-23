import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * LE SEUL EMPLOI DE CE FICHIER : PORTER LE CHEMIN JUSQU'AU SERVEUR (D139,
 * décision d'Alexis du 21/10/2026, 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES).
 *
 * `app/(back-office)/layout.tsx` doit savoir, pour un technicien, si la page
 * demandée est la fiche d'une intervention (`/interventions/<id>`, ou son
 * bon) — mais un `layout.tsx` placé AU-DESSUS de plusieurs dossiers `[id]`
 * de natures différentes (`clients/[id]`, `sites/[id]`,
 * `interventions/[id]`…) ne reçoit jamais, par `params`, de quoi distinguer
 * lequel a matché : ces dossiers sont des branches mutuellement exclusives
 * sous un même ancêtre, et Next.js ne remonte jamais ce choix plus haut que
 * la page elle-même.
 *
 * Ce fichier ne JUGE rien — aucune session, aucun rôle, aucune redirection :
 * il recopie seulement le chemin demandé dans un en-tête, lu ensuite par
 * `headers()` dans le layout. La recette documentée par Next.js lui-même
 * pour ce besoin précis.
 */
export function middleware(requete: NextRequest): NextResponse {
  const entetes = new Headers(requete.headers);
  entetes.set("x-chemin", requete.nextUrl.pathname);
  return NextResponse.next({ request: { headers: entetes } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
