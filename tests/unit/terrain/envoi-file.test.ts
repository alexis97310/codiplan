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
