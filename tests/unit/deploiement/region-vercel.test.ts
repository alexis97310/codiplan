import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * HEBERGEMENT-1 — LA RÉGION DES FONCTIONS SE DÉCLARE DANS LE DÉPÔT.
 *
 * ## Le constat, mesuré le 23/09/2026
 *
 * La base Neon vit à `ap-southeast-2` (Sydney) — `docs/mise-en-ligne.md`, §3.
 * Aucun fichier du dépôt ne le disait à l'hébergeur : ni `vercel.json`
 * (absent), ni `preferredRegion`/`regions` dans `next.config.ts` ou `app/`.
 * Sans déclaration, l'hébergeur place les fonctions dans SA région par
 * défaut — `iad1`, Washington D.C. — et chaque requête de base fait
 * l'aller-retour transpacifique. C'est le réglage qu'on oublie et qui suit
 * le produit chez chaque acheteur.
 *
 * ## Pourquoi `syd1`, et pas une région voisine
 *
 * Vérifié dans la documentation Vercel (`vercel.com/docs/regions`, lue le
 * 23/09/2026) : `syd1` EST `ap-southeast-2`, Sydney — la correspondance
 * exacte avec la région Neon, pas une approximation.
 *
 * ## Ce que ce gardien tient
 *
 * Il n'exige pas que `vercel.json` existe pour son propre compte : il exige
 * qu'UNE région y soit nommée, et que ce soit la bonne. Un fichier présent
 * mais vide de `regions`, ou portant une région qui n'est plus `syd1` sans
 * qu'une note explique le changement, doit rougir tout autant que son
 * absence — sinon le réglage peut disparaître au premier `vercel.json`
 * réécrit pour une autre raison, en silence.
 */

const RACINE = process.cwd();
const CHEMIN_VERCEL_JSON = join(RACINE, "vercel.json");

describe("HEBERGEMENT-1 — la région des fonctions Vercel", () => {
  it("`vercel.json` existe à la racine du dépôt", () => {
    expect(existsSync(CHEMIN_VERCEL_JSON)).toBe(true);
  });

  it("déclare `regions` avec `syd1` — la région Vercel qui EST `ap-southeast-2` (Sydney), au plus près de la base Neon", () => {
    const contenu = JSON.parse(readFileSync(CHEMIN_VERCEL_JSON, "utf8")) as {
      regions?: unknown;
    };

    expect(Array.isArray(contenu.regions)).toBe(true);
    expect(contenu.regions).toEqual(["syd1"]);
  });
});
