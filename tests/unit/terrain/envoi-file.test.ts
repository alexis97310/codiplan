import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envoyerFile } from "@/lib/terrain/envoi-file";
import {
  ajouterSaisie,
  CLE_MOTIF_FORMAT_INCONNU,
  listerFilePourIntervention,
  type Geste,
} from "@/lib/terrain/file-saisies";

import { installerIndexedDBFactice } from "./aide-indexeddb-factice";

/**
 * L'ENVOI DE LA FILE SUR UNE ENTRÉE QUE `gesteReconnu` A DÛ TRAITER
 * (9F4H6B-FILE-ANCIEN-FORMAT, point 1) — l'ancien format `{prestationIds}`
 * (avant 9F4H6A) et une forme franchement inconnue sont deux cas DIFFÉRENTS :
 * le premier part normalement une fois migré, le second ne part JAMAIS mais
 * ne doit plus geler les saisies suivantes de la même intervention.
 */

const IDENTITE = { utilisateurId: "u1", societeId: "s1" };

let restaurer: () => void;

beforeEach(() => {
  restaurer = installerIndexedDBFactice();
});

afterEach(() => {
  restaurer();
  vi.unstubAllGlobals();
});

function fetchFactice(appels: string[]): typeof fetch {
  return vi.fn(async (url: string | URL) => {
    appels.push(String(url));
    return {
      json: async () => ({ ok: true, motif: null }),
    } as Response;
  }) as unknown as typeof fetch;
}

describe("envoyerFile — l'ancien format de prestations n'est jamais gelé (point 1)", () => {
  it("une entrée au format d'avant 9F4H6A est envoyée et retirée de la file, « terminer » passe ensuite", async () => {
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: {
        type: "prestations",
        prestationIds: ["p1"],
      } as unknown as Geste,
    });
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "terminer" },
    });

    const appels: string[] = [];
    vi.stubGlobal("fetch", fetchFactice(appels));

    await envoyerFile(IDENTITE);

    expect(appels).toEqual([
      "/api/terrain/i1/prestations",
      "/api/terrain/i1/terminer",
    ]);
    expect(await listerFilePourIntervention("i1", IDENTITE)).toHaveLength(0);
  });

  it("une forme inconnue n'est jamais tentée, mais ne bloque pas « terminer » derrière elle", async () => {
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      // Ni `ajouterIds`/`retirerIds` (forme courante) ni `prestationIds`
      // (ancienne forme) — une forme qu'aucune des deux ne reconnaît.
      geste: { type: "prestations" } as unknown as Geste,
    });
    await ajouterSaisie({
      ...IDENTITE,
      interventionId: "i1",
      geste: { type: "terminer" },
    });

    const appels: string[] = [];
    vi.stubGlobal("fetch", fetchFactice(appels));

    await envoyerFile(IDENTITE);

    expect(appels).toEqual(["/api/terrain/i1/terminer"]);
    const reste = await listerFilePourIntervention("i1", IDENTITE);
    expect(reste).toHaveLength(1);
    expect(reste[0].geste.type).toBe("prestations");
    expect(reste[0].motifRefus).toBe(CLE_MOTIF_FORMAT_INCONNU);
  });
});

/**
 * LE TRI NE CASSE JAMAIS SUR UN TYPE INCONNU (9F4H6C-FILE-ROBUSTESSE, point
 * 2) — `ORDRE_PIPELINE[type]` sur un type absent du dictionnaire rendait
 * `undefined`, et `undefined - nombre` vaut `NaN` : le comparateur n'était
 * plus cohérent, et `Array.prototype.sort` mélangeait l'ordre plutôt que de
 * s'y arrêter proprement. « mystere » est une forme que `gesteReconnu` ne
 * reconnaît sous AUCUNE forme (ni la courante, ni une ancienne migrée) —
 * elle ne part donc jamais, mais ne doit plus corrompre l'ordre des AUTRES.
 */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) {
    return [items.slice()];
  }
  const resultats: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const reste = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const suite of permutations(reste)) {
      resultats.push([items[i]!, ...suite]);
    }
  }
  return resultats;
}

const GESTE_DE: Readonly<Record<string, Geste>> = {
  compteur: { type: "compteur", action: "demarrer" },
  rapport: { type: "rapport", commentaire: "", suite: "" },
  photo: {
    type: "photo",
    blob: new Blob(["x"]),
    nomFichier: "a.jpg",
    libelle: "",
  },
  signature: { type: "signature", champs: {} },
  terminer: { type: "terminer" },
  mystere: { type: "mystere" } as unknown as Geste,
};

// « mystere » n'apparaît jamais ici : jamais tentée (voir l'en-tête), sa
// place dans L'ORDRE DE SORTIE n'a pas de sens à vérifier — seul compte que
// sa PRÉSENCE, où qu'elle s'insère, ne dérange jamais l'ordre des autres.
const ORDRE_PIPELINE_ATTENDU = [
  "compteur",
  "rapport",
  "photo",
  "signature",
  "terminer",
];

function routeAttendue(type: string): string {
  return type === "photo" ? "photos" : type;
}

describe("le tri de la file ne casse jamais sur un type inconnu (point 2, 9F4H6C-FILE-ROBUSTESSE)", () => {
  it("TOUTES les permutations d'insertion de rapport, photo, signature, mystere, compteur, terminer donnent le même ordre d'envoi, pipeline respecté", async () => {
    const types = Object.keys(GESTE_DE);
    let compte = 0;
    for (const permutation of permutations(types)) {
      const interventionId = `i-${compte}`;
      compte += 1;
      for (const type of permutation) {
        await ajouterSaisie({
          ...IDENTITE,
          interventionId,
          geste: GESTE_DE[type]!,
        });
      }

      const appels: string[] = [];
      vi.stubGlobal("fetch", fetchFactice(appels));

      await envoyerFile(IDENTITE);

      expect(appels).toEqual(
        ORDRE_PIPELINE_ATTENDU.map(
          (type) => `/api/terrain/${interventionId}/${routeAttendue(type)}`,
        ),
      );
    }
  });
});
