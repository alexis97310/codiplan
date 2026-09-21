/**
 * `tousLesResultats` — UN SÉLECTEUR MONTRE LE RÉFÉRENTIEL ENTIER (lot
 * SELECT-1, 21/09/2026 ; déplacée ici par PARC-TER, 21/09/2026).
 *
 * Mesuré contre une base réelle (locale — le proxy de ce bac à sable bloque
 * la base hébergée) : une société porte déjà 576 clients, et le sélecteur de
 * `/parc/nouvelle` s'arrêtait à 200, `LIMITE_RECHERCHE_MAXIMALE` de
 * `lib/clients/saisie.ts` et `lib/sites/saisie.ts`. Créer une machine pour
 * l'un des 376 clients restants était impossible — aucun message, la fiche
 * disparaissait simplement du sélecteur.
 *
 * Elle enchaîne les pages d'une recherche bornée — `rechercherClients` ou
 * `rechercherSites`, déjà appliqués au contexte et aux critères — jusqu'à ce
 * qu'un lot revienne plus court que `tailleDePage` : exactement le critère
 * que `skip`/`take` de Prisma produisent déjà côté dépôt, jamais une seconde
 * lecture du total. La borne `LIMITE_RECHERCHE_MAXIMALE` reste entière comme
 * garde-fou PAR REQUÊTE — contre une seule requête qui ramènerait tout le
 * référentiel d'un coup depuis Nouméa —, ce n'est que la première page qui ne
 * suffit plus à un sélecteur.
 *
 * ## POURQUOI CE FICHIER, ET NI `page.tsx` NI `formulaire-machine.tsx`
 *
 * Le lot SELECT-1 l'avait posée dans `components/parc/formulaire-machine.tsx`
 * en écartant `page.tsx` pour une raison juste — Next.js refuse toute
 * exportation d'un `page.tsx` étrangère à son contrat de route (mesuré au
 * build) — mais qui n'épuisait pas le problème : `formulaire-machine.tsx`
 * commence par `"use client"`, et **toute exportation d'un module client
 * devient une RÉFÉRENCE CLIENT quand un composant serveur l'importe** — pas
 * seulement les composants rendus en JSX. Un composant serveur qui APPELLE
 * une telle exportation comme une fonction ordinaire (ce que
 * `app/(back-office)/parc/nouvelle/page.tsx` fait de `tousLesResultats`, une
 * boucle de pagination, jamais un élément à rendre) échoue au RENDU — mesuré
 * PARC-TER, 21/09/2026 : « /parc/nouvelle » rendait 500. C'est la DEUXIÈME
 * fois que cet écran tombe pour une fonction franchissant la frontière
 * serveur → client (la première, PARC-BIS, portait sur `urlRetour`) — le
 * commentaire de tête de `formulaire-machine.tsx` mettait en garde contre
 * exactement ce risque sans empêcher qu'il se reproduise ailleurs dans le
 * même fichier.
 *
 * Ce fichier ne porte NI `"use client"`, ni le contrat d'une route : une
 * fonction serveur ordinaire, importable par un composant serveur sans
 * traverser aucune frontière. `tests/unit/gardiens/frontiere-serveur-client.test.ts`
 * tient cette frontière pour TOUT le dépôt, pas seulement pour cet écran.
 */
export async function tousLesResultats<T>(
  page: (numero: number) => Promise<readonly T[]>,
  tailleDePage: number,
): Promise<T[]> {
  const resultats: T[] = [];
  for (let numero = 1; ; numero += 1) {
    const lot = await page(numero);
    resultats.push(...lot);
    if (lot.length < tailleDePage) {
      return resultats;
    }
  }
}
