import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BandeauMobile } from "@/components/navigation/bandeau-mobile";
import { fr } from "@/lib/i18n/fr";

/**
 * TR-47 (audit du 28/09/2026 ; 9DR-TP-NAV2-RETOURS-FIL) — la zone cliquable
 * du bouton de menu, au téléphone, tient 44 px, pas 36 (`h-9 w-9`, mesuré
 * avant ce ticket).
 */
describe("le bouton de menu du bandeau mobile tient 44 px", () => {
  it("porte `h-11 w-11`, jamais `h-9 w-9`", () => {
    render(<BandeauMobile />);
    const bouton = screen.getByRole("button", {
      name: fr["nav.ouvrir_le_menu"],
    });
    expect(bouton.className).toMatch(/(^|\s)h-11(\s|$)/);
    expect(bouton.className).toMatch(/(^|\s)w-11(\s|$)/);
    expect(bouton.className).not.toMatch(/(^|\s)h-9(\s|$)/);
    expect(bouton.className).not.toMatch(/(^|\s)w-9(\s|$)/);
  });
});
