"use strict";

// Ce fichier est chargé par `NODE_OPTIONS=--require`, donc nécessairement en
// CommonJS synchrone : un `import` ESM n'est pas une option pour un
// préchargement.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { appendFileSync } = require("node:fs");

/**
 * LE DOUBLE DE TEST DU TRANSPORT COURRIEL (AVERTISSEMENTS-1, 24/09/2026).
 *
 * Chargé par `NODE_OPTIONS=--require` AVANT que le serveur de test ne
 * démarre (`playwright.config.ts`) — le seul point où intercepter un appel
 * réseau fait par le PROCESSUS SERVEUR : Playwright n'intercepte que les
 * requêtes du NAVIGATEUR, et l'envoi de courriel part du serveur.
 *
 * Même principe que `tests/unit/courriel/envoi.test.ts` (`vi.stubGlobal`) —
 * un `fetch` de substitution —, transposé au processus séparé qu'est le
 * serveur `next start` de bout en bout. Seules les requêtes vers
 * `api.resend.com` sont interceptées ; tout le reste (la base, les autres
 * appels éventuels) passe par le `fetch` réel. Aucune vraie adresse, aucun
 * vrai réseau : `COURRIEL_API_CLE` posée par `playwright.config.ts` pour
 * l'exécution de bout en bout ne vaut rien chez un vrai prestataire.
 *
 * ## LE JOURNAL DES ENVOIS INTERCEPTÉS
 *
 * Le SERVEUR et l'ÉPREUVE Playwright sont deux PROCESSUS distincts : la
 * page rendue ne porte que le compte-rendu par CLÉS (L1-02f) — jamais le
 * sujet ni le corps. Pour que `avertissements-1.spec.ts` puisse mesurer que
 * le courriel « déplacée du … au … » a bien été COMPOSÉ, chaque envoi
 * intercepté est ajouté, en une ligne JSON, au fichier que
 * `E2E_COURRIELS_CAPTURES` désigne — l'épreuve le relit après coup.
 */

const reel = globalThis.fetch;
const CAPTURES = process.env.E2E_COURRIELS_CAPTURES;

globalThis.fetch = async function fetchDouble(entree, init) {
  const url =
    typeof entree === "string" ? entree : (entree && entree.url) || "";
  if (url.startsWith("https://api.resend.com/")) {
    if (CAPTURES) {
      const corps = init && typeof init.body === "string" ? init.body : "{}";
      appendFileSync(CAPTURES, corps.replace(/\n/g, " ") + "\n");
    }
    return new Response(JSON.stringify({ id: `e2e-double-${Date.now()}` }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return reel(entree, init);
};
