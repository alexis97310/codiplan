import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * LE SEUL EMPLOI DE CE FICHIER : PORTER LE CHEMIN JUSQU'AU SERVEUR (D221,
 * décision d'Alexis du 21/10/2026, 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES).
 *
 * `app/(back-office)/template.tsx` doit savoir, pour un technicien, si la
 * page demandée est la fiche d'une intervention (`/interventions/<id>`, ou
 * son bon) — mais un `layout.tsx` ou un `template.tsx` placé AU-DESSUS de
 * plusieurs dossiers `[id]` de natures différentes (`clients/[id]`,
 * `sites/[id]`, `interventions/[id]`…) ne reçoit jamais, par `params`, de
 * quoi distinguer lequel a matché : ces dossiers sont des branches
 * mutuellement exclusives sous un même ancêtre, et Next.js ne remonte jamais
 * ce choix plus haut que la page elle-même.
 *
 * Ce fichier ne JUGE rien — aucune session, aucun rôle, aucune redirection :
 * il recopie seulement le chemin demandé dans un en-tête, lu ensuite par
 * `headers()` dans le template. La recette documentée par Next.js lui-même
 * pour ce besoin précis.
 *
 * **Depuis la précision du 24/10/2026 sous D221 (9G8B-REPRISE-9G8A)** :
 * `x-recherche` porte en plus la chaîne de requête (`?declarer=1`) — ni
 * `layout.tsx` ni `template.tsx` ne reçoivent jamais `searchParams`, pas
 * plus que le segment `[id]` matché ; même contrainte, même recette.
 *
 * **9G8D-GARDE-TECHNICIEN-PAGES (25/10/2026)** : le garde lui-même a quitté
 * `layout.tsx` pour `template.tsx` — mesuré, une navigation DOUCE entre deux
 * pages du même layout ne réexécutait pas ce dernier. Ce fichier n'a rien à
 * changer : il postait déjà l'en-tête pour CHAQUE requête, douce ou dure.
 */
export function middleware(requete: NextRequest): NextResponse {
  const entetes = new Headers(requete.headers);
  entetes.set("x-chemin", requete.nextUrl.pathname);
  entetes.set("x-recherche", requete.nextUrl.search);
  return NextResponse.next({ request: { headers: entetes } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
