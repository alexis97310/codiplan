import { describe, expect, it } from "vitest";

import type { JourLocal } from "@/lib/calendar/fuseau";
import {
  etatGarantieMachine,
  libelleEtatGarantieMachine,
  libelleMaterielComplet,
  lignesDetailMachine,
} from "@/lib/machines/presentation";

/**
 * LE LIBELLÉ COMPLET D'UN MATÉRIEL (AFFICHAGE-MATERIEL-1, 23/09/2026).
 *
 * *Mesuré le 23/09/2026 en production : « il manque la famille sur la page
 * intervention ».* Alexis nomme le format exact : « Pont 2 colonnes Cascos
 * 13442 S/N 10044 ».
 */
describe("libelleMaterielComplet", () => {
  it("compose famille, marque, référence, puis S/N et le numéro de série", () => {
    expect(
      libelleMaterielComplet({
        familleLibelle: "Pont 2 colonnes",
        marque: "Cascos",
        reference: "13442",
        numeroSerie: "10044",
      }),
    ).toBe("Pont 2 colonnes Cascos 13442 S/N 10044");
  });

  it("n'omet pas un numéro de série illisible saisi SN-INCONNU-…", () => {
    expect(
      libelleMaterielComplet({
        familleLibelle: "Pont Elevateur",
        marque: "RAVAGLIOLI",
        reference: "RAV4401.4",
        numeroSerie: "SN-INCONNU-RAV4401.4",
      }),
    ).toBe("Pont Elevateur RAVAGLIOLI RAV4401.4 S/N SN-INCONNU-RAV4401.4");
  });
});

const JOUR: JourLocal = { annee: 2026, mois: 10, jour: 31 };

describe("etatGarantieMachine — 9I8C", () => {
  it("non renseignée quand `garantieFin` est `null`", () => {
    expect(etatGarantieMachine(null, JOUR)).toEqual({
      etat: "non_renseignee",
    });
  });

  it("sous garantie quand la fin de garantie suit le jour de référence", () => {
    const fin = new Date("2026-11-01T00:00:00.000Z");
    expect(etatGarantieMachine(fin, JOUR)).toEqual({
      etat: "sous_garantie",
      garantieFin: fin,
    });
  });

  it("sous garantie quand la fin de garantie EST le jour de référence (bornes incluses)", () => {
    const fin = new Date("2026-10-31T00:00:00.000Z");
    expect(etatGarantieMachine(fin, JOUR)).toEqual({
      etat: "sous_garantie",
      garantieFin: fin,
    });
  });

  it("hors garantie quand la fin de garantie précède le jour de référence", () => {
    const fin = new Date("2026-10-30T00:00:00.000Z");
    expect(etatGarantieMachine(fin, JOUR)).toEqual({
      etat: "hors_garantie",
      garantieFin: fin,
    });
  });
});

describe("libelleEtatGarantieMachine — 9I8C", () => {
  it("« Non renseignée » sans date", () => {
    expect(libelleEtatGarantieMachine({ etat: "non_renseignee" })).toBe(
      "Non renseignée",
    );
  });

  it("« Sous garantie jusqu'au JJ/MM/AAAA »", () => {
    expect(
      libelleEtatGarantieMachine({
        etat: "sous_garantie",
        garantieFin: new Date("2027-01-01T00:00:00.000Z"),
      }),
    ).toBe("Sous garantie jusqu'au 01/01/2027");
  });

  it("« Hors garantie depuis le JJ/MM/AAAA »", () => {
    expect(
      libelleEtatGarantieMachine({
        etat: "hors_garantie",
        garantieFin: new Date("2025-01-01T00:00:00.000Z"),
      }),
    ).toBe("Hors garantie depuis le 01/01/2025");
  });
});

describe("lignesDetailMachine — 9I8C", () => {
  it("aucune ligne pour une donnée absente, sauf la garantie, toujours présente", () => {
    const lignes = lignesDetailMachine(
      {
        anneeFabrication: null,
        dateVente: null,
        dateMiseEnService: null,
        garantieFin: null,
      },
      JOUR,
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toEqual({
      libelle: "Garantie",
      valeur: "Non renseignée",
    });
  });

  it("une ligne par donnée présente, dans l'ordre année / vente / mise en service / garantie", () => {
    const lignes = lignesDetailMachine(
      {
        anneeFabrication: 1999,
        dateVente: new Date("2000-01-01T00:00:00.000Z"),
        dateMiseEnService: new Date("2000-02-01T00:00:00.000Z"),
        garantieFin: new Date("2026-11-01T00:00:00.000Z"),
      },
      JOUR,
    );
    expect(lignes.map((l) => l.libelle)).toEqual([
      "Année de fabrication (plaque)",
      "Date de vente",
      "Date de mise en service",
      "Garantie",
    ]);
    expect(lignes[0]?.valeur).toBe("1999");
    expect(lignes[3]?.valeur).toBe("Sous garantie jusqu'au 01/11/2026");
  });
});
