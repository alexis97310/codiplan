import { describe, expect, it } from "vitest";

import { AssujettissementVgp } from "@prisma/client";

import { ASSUJETTISSEMENT } from "@/lib/vgp/assujettissement";
import {
  etatDeLInformation,
  type EtatInformation,
} from "@/lib/vgp/information";
import {
  regrouperRegistreParClient,
  type LigneDeRegistre,
} from "@/lib/vgp/registre";

/**
 * LE REGROUPEMENT « PAR CLIENT » DU REGISTRE (MO-12, UX9-c, D166) — fonction
 * PURE, éprouvée sans base, même discipline que `tri-et-recherche.test.ts`.
 */

const AUJOURD_HUI = new Date("2026-10-04T00:00:00Z");

const INFORMATION: EtatInformation = etatDeLInformation({
  assujettissement: ASSUJETTISSEMENT.soumis,
  periodiciteMois: 12,
  derniereInformation: new Date("2026-01-01"),
  depuis: null,
  aujourdHui: AUJOURD_HUI,
});

function ligne(nom: string, clientId: string, client: string): LigneDeRegistre {
  return {
    id: nom,
    numero: null,
    numero_serie: nom,
    clientId,
    client,
    siteId: "site-epreuve",
    site: "Site d'épreuve",
    siteCommune: "Commune d'épreuve",
    marque: "Marque d'épreuve",
    modele: "Modèle d'épreuve",
    referenceInterne: null,
    famille: "Famille d'épreuve",
    assujettissement: AssujettissementVgp.soumis,
    origine: "famille",
    periodiciteMois: 12,
    referenceTexte: "Texte d'épreuve",
    originePeriodicite: "famille",
    information: INFORMATION,
  };
}

describe("regrouperRegistreParClient (MO-12, D166)", () => {
  it("regroupe les lignes par client, dans l'ordre alphabétique du client", () => {
    const groupes = regrouperRegistreParClient([
      ligne("m1", "c-zebra", "Zèbre SARL"),
      ligne("m2", "c-alpha", "Alpha SARL"),
      ligne("m3", "c-zebra", "Zèbre SARL"),
    ]);
    expect(groupes.map((g) => g.client)).toEqual(["Alpha SARL", "Zèbre SARL"]);
    expect(groupes.map((g) => g.lignes.map((l) => l.id))).toEqual([
      ["m2"],
      ["m1", "m3"],
    ]);
  });

  it("une liste vide ne rend aucun groupe", () => {
    expect(regrouperRegistreParClient([])).toEqual([]);
  });

  it("chaque groupe garde l'ordre d'arrivée de ses lignes", () => {
    const groupes = regrouperRegistreParClient([
      ligne("b", "c-1", "Client"),
      ligne("a", "c-1", "Client"),
    ]);
    expect(groupes).toHaveLength(1);
    expect(groupes[0]?.lignes.map((l) => l.id)).toEqual(["b", "a"]);
  });
});
