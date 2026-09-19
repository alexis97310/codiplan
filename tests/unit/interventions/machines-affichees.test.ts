import { describe, expect, it } from "vitest";

import { machinesAffichees } from "@/app/(back-office)/interventions/presentation";

/**
 * `machinesAffichees` EST PARTAGÉE PAR LE REGISTRE ET LA FICHE (audit du
 * 19/09/2026) : `tests/unit/interventions/colonnes-et-kpi.test.ts` et
 * `tests/unit/ui/lot-a3.test.ts` en gardent la PRÉSENCE dans le source, mais
 * aucun des deux ne l'APPELLE — ce fichier ferme ce trou, sur la fonction
 * elle-même plutôt que sur son texte.
 */

describe("machinesAffichees", () => {
  it("rend le signe d'absence quand aucune machine n'est rattachée", () => {
    expect(machinesAffichees({ machines: [] }, new Map())).toBe("—");
  });

  it("rend le libellé d'une seule machine", () => {
    const libelles = new Map([["m1", "Atlas Copco GA-11"]]);
    expect(
      machinesAffichees({ machines: [{ machine_id: "m1" }] }, libelles),
    ).toBe("Atlas Copco GA-11");
  });

  it("joint plusieurs machines par une virgule, sans troncature", () => {
    const libelles = new Map([
      ["m1", "Atlas Copco GA-11"],
      ["m2", "Ravaglioli KPX-337"],
      ["m3", "Facom V.400"],
    ]);
    expect(
      machinesAffichees(
        {
          machines: [
            { machine_id: "m1" },
            { machine_id: "m2" },
            { machine_id: "m3" },
          ],
        },
        libelles,
      ),
    ).toBe("Atlas Copco GA-11, Ravaglioli KPX-337, Facom V.400");
  });

  it("rend le signe d'absence pour un identifiant sans libellé résolu (hors périmètre)", () => {
    expect(
      machinesAffichees({ machines: [{ machine_id: "inconnu" }] }, new Map()),
    ).toBe("—");
  });
});
