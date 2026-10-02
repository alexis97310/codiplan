import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sansCommentaires } from "../outils/fichiers-source";

/**
 * TR-36 — PLUS AUCUN SECRET DU SECOND FACTEUR NE TRANSITE PAR L'URL
 * (9CW-TP-S6).
 *
 * La route d'enrôlement construisait `new URLSearchParams({ cle, uri,
 * secours })` et redirigeait vers `/enrolement?…` — la clé, l'URI `otpauth://`
 * et les codes de secours partaient donc dans l'URL, donc dans les journaux
 * de l'hébergeur. `preparationEnAttente` (`lib/auth/enrolement.ts`) les relit
 * désormais côté serveur ; ce gardien tient le RETRAIT, pas seulement
 * l'ajout : un `URLSearchParams` qui reviendrait dans cette route, pour
 * quelque raison que ce soit, doit faire rougir ce test avant de faire
 * fuiter quoi que ce soit.
 */

const ROUTE = sansCommentaires(
  readFileSync(
    join(process.cwd(), "app/api/session/enrolement/route.ts"),
    "utf8",
  ),
);

describe("la route d'enrôlement ne construit plus aucun URLSearchParams", () => {
  it("TÉMOIN — la route existe bien et porte encore les deux étapes", () => {
    expect(ROUTE).toMatch(/\bpreparerEnrolement\b/);
    expect(ROUTE).toMatch(/\bconfirmerEnrolement\b/);
  });

  it("aucun `URLSearchParams` dans ce fichier", () => {
    expect(ROUTE).not.toMatch(/\bURLSearchParams\b/);
  });

  it("ni la clé manuelle ni les codes de secours ne sont construits ici", () => {
    // La redirection après préparation ne porte plus que `/enrolement`, sans
    // paramètre de secret : ces deux noms n'ont donc plus leur place dans la
    // route elle-même, seulement dans `lib/auth/enrolement.ts` qui les relit.
    expect(ROUTE).not.toMatch(/\bcleManuelle\b/);
    expect(ROUTE).not.toMatch(/\bcodesSecours\b/);
  });
});
