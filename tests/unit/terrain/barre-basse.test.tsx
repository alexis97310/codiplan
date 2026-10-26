import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BarreBasseDuTerrain } from "@/components/terrain/barre-basse";
import { fr } from "@/lib/i18n/fr";

/**
 * « JOURNÉE » RESTE ALLUMÉ SUR UNE FICHE (point 2, 9G5-TERRAIN-ERGONOMIE) —
 * sur `/terrain/<id>`, ni « Journée » ni « Profil » ne s'allumait avec une
 * égalité stricte sur le chemin : la fiche est une SECTION de « Journée »,
 * au même titre que `/terrain` lui-même.
 */

let chemin = "/terrain";

vi.mock("next/navigation", () => ({
  usePathname: () => chemin,
}));

describe("la barre basse du terrain allume « Journée » par section, jamais par égalité stricte", () => {
  it("sur /terrain, « Journée » est actif", () => {
    chemin = "/terrain";
    render(<BarreBasseDuTerrain />);
    expect(
      screen.getByText(fr["terrain.barre.journee"]).closest("a"),
    ).toHaveAttribute("aria-current", "page");
  });

  it("sur /terrain/<id>, une fiche d'intervention, « Journée » reste actif", () => {
    chemin = "/terrain/0192f0a0-6000-7000-8000-000000000021";
    render(<BarreBasseDuTerrain />);
    expect(
      screen.getByText(fr["terrain.barre.journee"]).closest("a"),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByText(fr["terrain.barre.profil"]).closest("a"),
    ).not.toHaveAttribute("aria-current");
  });

  it("sur /terrain/profil, « Profil » est actif, jamais « Journée »", () => {
    chemin = "/terrain/profil";
    render(<BarreBasseDuTerrain />);
    expect(
      screen.getByText(fr["terrain.barre.profil"]).closest("a"),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByText(fr["terrain.barre.journee"]).closest("a"),
    ).not.toHaveAttribute("aria-current");
  });
});
