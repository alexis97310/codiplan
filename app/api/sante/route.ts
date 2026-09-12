import { commitDeploye, lireSante, reponseMachine } from "@/lib/db/sante";

/**
 * `/api/sante` — LA MÊME SONDE, LUE PAR UNE MACHINE (R3-01).
 *
 * ## Pourquoi cette route existe alors que `/sante` existe déjà
 *
 * *Mesuré le 12/09/2026 : `/sante` nommait la cause de la panne en une ligne, et
 * personne ne l'avait ouverte.* **Une sonde que personne n'ouvre ne sonne pas.**
 * La page est faite pour un humain qui se pose la question ; cette route est
 * faite pour le contrôle qui la pose après chaque déploiement, sans qu'on le lui
 * demande.
 *
 * ## ELLE REND 200 MÊME QUAND TOUT VA MAL, ET C'EST UNE DÉCISION
 *
 * Un code HTTP d'erreur aurait paru plus propre. Il confondrait deux choses que
 * le contrôle doit distinguer : *« l'application ne répond pas »* et
 * *« l'application répond et dit que sa base est en retard »*. **Le premier est
 * un incident d'exploitation, le second appelle une migration** — et un 503
 * indistinct enverrait chercher le mauvais.
 *
 * *C'est la règle de `lib/db/sante.ts` poussée d'un cran : elle ne lève jamais,
 * et cette route ne se met jamais en travers de ce qu'elle dit.* Le verdict vit
 * dans le corps, où il est lisible, et `scripts/lib/verdict-deploiement.ts` le
 * traduit en code de sortie.
 *
 * ## NI CACHE, NI SECRET
 *
 * `force-dynamic` : une sonde mise en cache dirait l'état d'hier, et c'est très
 * exactement la panne qu'on cherche à voir. `no-store` le répète à tout ce qui
 * se trouve sur le chemin. Quant aux secrets, il n'y en a aucun à rendre : les
 * motifs sont réécrits en amont, et un nom de migration comme une empreinte de
 * commit sont publics par construction (D50).
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const etat = await lireSante();
  return new Response(JSON.stringify(reponseMachine(etat, commitDeploye())), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
