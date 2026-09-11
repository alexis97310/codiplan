import { expect, test, type Page } from "@playwright/test";

import { ouvrirUneSession } from "../setup/session";

/**
 * LE SOCLE PWA — manifeste, service worker, installabilité (L3-06, I4).
 *
 * ## CES SCÉNARIOS ONT ÉTÉ ÉCRITS AVANT LE CODE, ET C'EST UNE PRESCRIPTION
 *
 * `tests/e2e/offline/README.md` porte la règle, corrigée le 13/09/2026 contre
 * `docs/guide-pilotage.md` §5 : *« au premier ticket du lot 3 qui touche le
 * hors-ligne — L3-06 —, les scénarios de ce répertoire s'écrivent AVANT le code
 * qu'ils éprouvent. »* Le guide nomme le hors-ligne comme le point le plus
 * difficile du projet, celui qui *« se teste mal, échoue silencieusement et se
 * corrige tard »*.
 *
 * Ce fichier est le premier habitant de ce répertoire, resté vide depuis L0-02.
 *
 * ## CE QU'ILS MESURENT, ET CE QU'ILS NE MESURENT PAS
 *
 * **Le SOCLE, et lui seul.** Le cache des données est L3-07, la file
 * d'opérations est L3-08. Ce qu'on éprouve ici est qu'une coquille se charge
 * sans réseau, et que le navigateur a de quoi proposer l'installation.
 *
 * *Une intervention complète en mode avion appartient à L3-08, et son scénario
 * s'écrira là — avant son code, par la même règle.*
 *
 * ## ⚠ CE QUE LE SERVICE WORKER N'A PAS LE DROIT DE METTRE EN CACHE
 *
 * **Aucune page authentifiée, aucune réponse d'API.** Un service worker qui
 * garderait le planning rendu pour la société A le resservirait à une session
 * de la société B sur le même appareil — *un cache est un stockage, et I1 ne
 * s'arrête pas au serveur.* Le dernier scénario le mesure : après une session,
 * le cache ne contient aucune page de planning.
 */

/** Le service worker est-il enregistré ET actif ? */
async function serviceWorkerActif(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    const enregistrement = await navigator.serviceWorker.ready;
    return enregistrement.active !== null;
  });
}

/** Les URL réellement présentes dans les caches du navigateur. */
async function urlsEnCache(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const noms = await caches.keys();
    const toutes: string[] = [];
    for (const nom of noms) {
      const cache = await caches.open(nom);
      for (const requete of await cache.keys()) {
        toutes.push(requete.url);
      }
    }
    return toutes;
  });
}

test.describe.configure({ mode: "serial" });

test("le MANIFESTE est servi, et il déclare ce qu'une installation exige", async ({
  page,
}) => {
  // *« Installable sur l'écran d'accueil, iOS et Android, sans passer par les
  // magasins »* (§13.1). Les champs ci-dessous ne sont pas une liste de vœux :
  // ce sont ceux sans lesquels un navigateur REFUSE de proposer l'installation.
  const reponse = await page.goto("/manifest.webmanifest");
  expect(reponse?.status()).toBe(200);

  const manifeste: unknown = await reponse?.json();
  expect(manifeste).toMatchObject({
    display: "standalone",
    start_url: expect.any(String),
  });
  const lu = manifeste as {
    name: string;
    short_name: string;
    icons: { sizes: string; src: string; purpose?: string }[];
  };
  expect(lu.name.length).toBeGreaterThan(0);
  expect(lu.short_name.length).toBeGreaterThan(0);

  // **Les deux tailles que l'installation exige**, et une icône `maskable` :
  // sans elle, Android rogne l'icône dans un cercle et coupe ce qu'elle porte.
  const tailles = lu.icons.map((icone) => icone.sizes);
  expect(tailles).toContain("192x192");
  expect(tailles).toContain("512x512");
  expect(
    lu.icons.some((icone) => (icone.purpose ?? "").includes("maskable")),
  ).toBe(true);
});

test("le SERVICE WORKER s'enregistre, et la coquille se charge SANS RÉSEAU", async ({
  page,
  context,
}) => {
  // La page publique suffit : ce qu'on mesure est la COQUILLE, pas une donnée.
  await page.goto("/sante");
  expect(await serviceWorkerActif(page)).toBe(true);

  // **Le réseau est réellement coupé** — `context.setOffline` agit sur la pile
  // réseau du navigateur, service worker compris. *Un scénario qui simulerait
  // l'absence de réseau par un intercepteur mesurerait l'intercepteur.*
  await context.setOffline(true);
  const horsLigne = await page.goto("/sante");

  // Servi par le cache : le statut est 200 alors qu'aucun octet n'a pu
  // traverser. C'est le seul fait qui distingue un socle d'une page rendue.
  expect(horsLigne?.status()).toBe(200);
  await expect(page.locator("body")).not.toBeEmpty();

  await context.setOffline(false);
});

test("AUCUNE PAGE AUTHENTIFIÉE N'ENTRE EN CACHE — I1 ne s'arrête pas au serveur", async ({
  page,
}) => {
  // **Le scénario qui compte.** Un service worker qui garderait le planning
  // rendu pour la société A le resservirait à une session de la société B sur
  // le même appareil, et *aucune politique de cloisonnement ne s'applique à un
  // cache de navigateur* : la lecture a déjà eu lieu.
  //
  // Il est écrit AVANT le service worker, et c'est ce qui le contraint : la
  // façon la plus simple d'écrire un service worker est de mettre en cache
  // toute navigation réussie, et elle est refusée ici.
  await page.goto("/sante");
  expect(await serviceWorkerActif(page)).toBe(true);

  await ouvrirUneSession(page);
  await page.goto("/planning");
  await expect(page).toHaveURL(/\/planning/);

  const enCache = await urlsEnCache(page);

  // **L'ASSERTION EST CLOSE, ET C'EST DÉLIBÉRÉ.** Elle a d'abord été écrite en
  // filtrant les URL contenant « /planning » — *et elle a rougi sur trois
  // entrées qui ne sont pas des pages* :
  //
  //     /_next/static/chunks/app/(back-office)/planning/page-6039….js
  //
  // Ce sont les MODULES de la route, nommés d'après elle : du code, identique
  // pour toutes les sociétés, immuable par empreinte. *Un filtre par sous-chaîne
  // confondait le nom d'un fichier avec ce qu'il contient.*
  //
  // Ce qui a remplacé le filtre est plus STRICT et non plus permissif : on
  // retire les ressources statiques — qui portent leur empreinte dans leur nom
  // et ne peuvent donc pas périmer — et **tout ce qui reste doit être
  // exactement la coquille publique.** Une route authentifiée entrée demain
  // n'aurait aucun moyen de passer : elle ne serait pas dans cette liste.
  const statiques = (url: string) =>
    url.includes("/_next/static/") || url.includes("/icones/");
  const documents = enCache
    .filter((url) => !statiques(url))
    .map((url) => new URL(url).pathname)
    .sort();
  expect(documents).toEqual(["/connexion", "/sante"]);

  // TÉMOIN : le cache n'est pas vide — sinon ce scénario serait vert sur un
  // service worker qui ne met rien en cache du tout, c'est-à-dire sur rien.
  // *Deux listes vides sont égales* (§9, 10/09).
  expect(enCache.length).toBeGreaterThan(documents.length);
});
