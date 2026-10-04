import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n/fr";

import { libelleOptionClient } from "../../../app/(back-office)/presentation";

/**
 * CS40 (audit TP-CLI du 28/09/2026) — « raison sociale · code · commune »,
 * le libellé d'option du sélecteur de client. Avant ce ticket, l'option ne
 * portait que la raison sociale : deux clients homonymes ne se
 * distinguaient pas dans la liste.
 */
describe("libelleOptionClient", () => {
  const POINT_MEDIAN = t("ponctuation.point_median");

  it("compose les trois parties quand elles existent toutes", () => {
    expect(libelleOptionClient("Dupont Électricité", "C-001", "Koné")).toBe(
      `Dupont Électricité${POINT_MEDIAN}C-001${POINT_MEDIAN}Koné`,
    );
  });

  it("omet le code ABSENT sans laisser de séparateur orphelin", () => {
    expect(libelleOptionClient("Dupont Électricité", null, "Koné")).toBe(
      `Dupont Électricité${POINT_MEDIAN}Koné`,
    );
  });

  it("omet la commune ABSENTE sans laisser de séparateur orphelin", () => {
    expect(libelleOptionClient("Dupont Électricité", "C-001", undefined)).toBe(
      `Dupont Électricité${POINT_MEDIAN}C-001`,
    );
  });

  it("rend la seule raison sociale quand ni le code ni la commune n'existent", () => {
    expect(libelleOptionClient("Dupont Électricité", null, undefined)).toBe(
      "Dupont Électricité",
    );
  });

  it("distingue deux homonymes par leur code et leur commune", () => {
    const premier = libelleOptionClient("Dupont", "C-010", "Nouméa");
    const second = libelleOptionClient("Dupont", "C-011", "Koné");
    expect(premier).not.toBe(second);
  });
});
