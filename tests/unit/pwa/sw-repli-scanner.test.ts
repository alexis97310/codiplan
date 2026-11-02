import { readFileSync } from "node:fs";
import vm from "node:vm";

import { beforeEach, describe, expect, it } from "vitest";

/**
 * `public/sw.js`, LE GESTIONNAIRE `fetch` — ÉPREUVE UNITAIRE, SANS NAVIGATEUR
 * (9IC-CORRECTIFS-COURTS, réserve du solde 592 sur 9I1-SCANNER-HORS-RESEAU).
 *
 * ## Pourquoi une épreuve e2e ne peut pas atteindre la branche `.catch()`
 *
 * `tests/e2e/9i1-scanner-hors-reseau.spec.ts` l'explique dans son en-tête :
 * une fois `/scanner` reconnu, le service worker appelle lui-même `fetch`
 * DEPUIS SON PROPRE CONTEXTE, que ni `context.setOffline` ni `context.route`
 * de Playwright n'atteignent — ce `fetch`-là aboutit contre le vrai serveur de
 * l'épreuve. La branche `.catch()` qui sert la coquille `/scanner-hors-reseau`
 * n'est donc, jusqu'ici, prouvée que par LECTURE du code.
 *
 * ## Ce que ce fichier fait à la place
 *
 * Il charge `public/sw.js` — le fichier RÉEL, pas une copie — dans un bac à
 * sable (`node:vm`) où `self`, `caches` et `fetch` sont des faux contrôlés par
 * le test, déclenche son gestionnaire `fetch` avec une requête synthétique, et
 * force le `fetch` interne à REJETER. C'est la branche `.catch()` elle-même
 * qui s'exécute, pas une lecture de son code.
 */

type RequeteSimulee = {
  readonly method: string;
  readonly url: string;
  readonly mode: string;
};

type EvenementFetchSimule = {
  readonly request: RequeteSimulee;
  respondWith(reponse: Promise<Response>): void;
};

type FauxMagasin = Map<string, Response>;

function creerFaussesCaches(): {
  readonly caches: {
    open(nom: string): Promise<{
      addAll(urls: readonly string[]): Promise<void>;
      put(requete: RequeteSimulee | string, reponse: Response): Promise<void>;
      match(requete: RequeteSimulee | string): Promise<Response | undefined>;
    }>;
    keys(): Promise<string[]>;
    delete(nom: string): Promise<boolean>;
    match(requete: RequeteSimulee | string): Promise<Response | undefined>;
  };
  readonly nombreDeMisesEnCache: () => number;
} {
  const magasins = new Map<string, FauxMagasin>();
  let misesEnCache = 0;
  const cleDe = (requete: RequeteSimulee | string): string =>
    typeof requete === "string" ? requete : requete.url;

  return {
    caches: {
      async open(nom) {
        if (!magasins.has(nom)) magasins.set(nom, new Map());
        const magasin = magasins.get(nom)!;
        return {
          async addAll(urls) {
            for (const url of urls) magasin.set(url, new Response(url));
          },
          async put(requete, reponse) {
            misesEnCache += 1;
            magasin.set(cleDe(requete), reponse);
          },
          async match(requete) {
            return magasin.get(cleDe(requete));
          },
        };
      },
      async keys() {
        return [...magasins.keys()];
      },
      async delete(nom) {
        return magasins.delete(nom);
      },
      async match(requete) {
        for (const magasin of magasins.values()) {
          const trouve = magasin.get(cleDe(requete));
          if (trouve !== undefined) return trouve;
        }
        return undefined;
      },
    },
    nombreDeMisesEnCache: () => misesEnCache,
  };
}

/** Charge `public/sw.js` dans un bac à sable, et déclenche « install » pour peupler la coquille. */
async function chargerServiceWorker(
  fetchSimule: (r: RequeteSimulee) => Promise<Response>,
): Promise<{
  declencherFetch: (
    requete: RequeteSimulee,
  ) => Promise<{ reponse: Response | undefined; interceptee: boolean }>;
  nombreDeMisesEnCache: () => number;
}> {
  const source = readFileSync("public/sw.js", "utf8");
  const ecouteurs: Record<string, ((e: unknown) => void)[]> = {};
  const { caches, nombreDeMisesEnCache } = creerFaussesCaches();

  const self_ = {
    addEventListener(type: string, fn: (e: unknown) => void) {
      (ecouteurs[type] ??= []).push(fn);
    },
    skipWaiting() {},
    clients: { async claim() {} },
    location: { origin: "http://localhost:3000" },
  };

  const contexte = vm.createContext({
    self: self_,
    caches,
    fetch: fetchSimule,
    Response,
    URL,
    console,
  });
  vm.runInContext(source, contexte);

  // « install » peuple la coquille — SANS ce passage, `/scanner-hors-reseau`
  // n'existe pas dans la fausse cache, exactement comme au premier démarrage
  // réel du service worker.
  const attentesInstall: Promise<unknown>[] = [];
  for (const fn of ecouteurs.install ?? []) {
    fn({ waitUntil: (p: Promise<unknown>) => attentesInstall.push(p) });
  }
  await Promise.all(attentesInstall);

  return {
    async declencherFetch(requete) {
      let reponsePromise: Promise<Response> | undefined;
      const evenement: EvenementFetchSimule = {
        request: requete,
        respondWith(p) {
          reponsePromise = p;
        },
      };
      for (const fn of ecouteurs.fetch ?? []) fn(evenement);
      if (reponsePromise === undefined) {
        return { reponse: undefined, interceptee: false };
      }
      return { reponse: await reponsePromise, interceptee: true };
    },
    nombreDeMisesEnCache,
  };
}

describe("public/sw.js — le repli de /scanner et /parc/scanner, par la branche .catch() réellement exécutée", () => {
  let fetchRejette: (requete: RequeteSimulee) => Promise<Response>;

  beforeEach(() => {
    fetchRejette = () => Promise.reject(new Error("hors réseau (simulé)"));
  });

  it.each(["/scanner", "/parc/scanner"])(
    "une NAVIGATION vers %s, réseau en échec, reçoit la coquille /scanner-hors-reseau — et rien n'est mis en cache",
    async (chemin) => {
      const sw = await chargerServiceWorker(fetchRejette);
      const { reponse, interceptee } = await sw.declencherFetch({
        method: "GET",
        url: `http://localhost:3000${chemin}`,
        mode: "navigate",
      });

      expect(interceptee).toBe(true);
      expect(reponse).toBeDefined();
      // La fausse coquille porte son URL comme corps (voir `addAll` ci-dessus) :
      // c'est bien `/scanner-hors-reseau`, pas `/terrain-hors-reseau` ni un 504.
      await expect(reponse?.text()).resolves.toBe("/scanner-hors-reseau");
      expect(sw.nombreDeMisesEnCache()).toBe(0);
    },
  );

  it.each(["/scanner", "/parc/scanner"])(
    "un GET NON-NAVIGATION vers %s, réseau en échec, NE reçoit PAS la coquille",
    async (chemin) => {
      const sw = await chargerServiceWorker(fetchRejette);
      const { reponse, interceptee } = await sw.declencherFetch({
        method: "GET",
        url: `http://localhost:3000${chemin}`,
        mode: "same-origin",
      });

      // Non reconnu comme repli (mode ≠ navigate) ET absent de la coquille :
      // le service worker ne l'intercepte pas du tout — le réseau, ici simulé
      // en échec, échoue alors NATURELLEMENT, sans jamais recevoir le HTML
      // d'une page.
      expect(interceptee).toBe(false);
      expect(reponse).toBeUndefined();
    },
  );

  it("une NAVIGATION vers /terrain, réseau en échec, reçoit TOUJOURS sa propre coquille /terrain-hors-reseau (non-régression 9F4H1)", async () => {
    const sw = await chargerServiceWorker(fetchRejette);
    const { reponse, interceptee } = await sw.declencherFetch({
      method: "GET",
      url: "http://localhost:3000/terrain",
      mode: "navigate",
    });

    expect(interceptee).toBe(true);
    await expect(reponse?.text()).resolves.toBe("/terrain-hors-reseau");
  });

  it("un GET NON-NAVIGATION vers /terrain, réseau en échec, NE reçoit PAS la coquille", async () => {
    const sw = await chargerServiceWorker(fetchRejette);
    const { reponse, interceptee } = await sw.declencherFetch({
      method: "GET",
      url: "http://localhost:3000/terrain",
      mode: "same-origin",
    });

    expect(interceptee).toBe(false);
    expect(reponse).toBeUndefined();
  });
});
