import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n/fr";

import { libelleClientSite } from "../../../app/(back-office)/presentation";

/**
 * « Client — Site » (85-PARC-SITES) — le libellé composé partagé par le
 * filtre du parc et par la liste des sites, pour distinguer les sites dont le
 * seul libellé propre ne le permet pas (« Nouméa », mesuré six fois dans le
 * même filtre le 25/09/2026).
 */
describe("libelleClientSite", () => {
  it("compose « client — site » avec le séparateur imposé", () => {
    expect(libelleClientSite("A", "B")).toBe(
      `A${t("ponctuation.separateur")}B`,
    );
  });

  it("n'affiche le nom qu'une fois quand le libellé du site est identique au client (constat 7)", () => {
    expect(libelleClientSite("Client X", "Client X")).toBe("Client X");
  });

  it("rogne les espaces avant de comparer et de composer", () => {
    expect(libelleClientSite("  A  ", "  B  ")).toBe(
      `A${t("ponctuation.separateur")}B`,
    );
    expect(libelleClientSite("  Client X  ", "Client X")).toBe("Client X");
  });
});
