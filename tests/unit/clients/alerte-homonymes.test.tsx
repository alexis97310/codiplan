import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AlerteHomonymes } from "@/app/(back-office)/clients/nouveau/alerte-homonymes";
import { fr } from "@/lib/i18n/fr";

/**
 * SOLDE 9EP POINT 40 (Q8) — LE TITRE ET LE CONSEIL DE L'ALERTE D'HOMONYMIE
 * AU PLURIEL.
 *
 * Un seul homonyme garde les clés au singulier (`clients.homonymes.titre`,
 * `.conseil`) ; deux ou plus basculent sur `_pluriel`.
 */

const HOMONYME_1 = {
  id: "11111111-1111-1111-1111-111111111111",
  raison_sociale: "Garage Dupont",
  commune: null,
  nombreSites: 0,
  actif: true,
};
const HOMONYME_2 = {
  id: "22222222-2222-2222-2222-222222222222",
  raison_sociale: "Garage Dupont SARL",
  commune: null,
  nombreSites: 0,
  actif: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function simulerReponse(resultats: readonly unknown[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resultats }),
    }),
  );
}

describe("AlerteHomonymes — singulier puis pluriel (solde 9EP point 40, Q8)", () => {
  it("un seul homonyme — titre et conseil au singulier", async () => {
    simulerReponse([HOMONYME_1]);
    render(<AlerteHomonymes />);
    const champ = screen.getByRole("textbox");
    fireEvent.change(champ, { target: { value: "Dupont" } });
    fireEvent.blur(champ);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        fr["clients.homonymes.titre"],
      );
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      fr["clients.homonymes.conseil"],
    );
  });

  it("deux homonymes — titre et conseil au pluriel", async () => {
    simulerReponse([HOMONYME_1, HOMONYME_2]);
    render(<AlerteHomonymes />);
    const champ = screen.getByRole("textbox");
    fireEvent.change(champ, { target: { value: "Dupont" } });
    fireEvent.blur(champ);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        fr["clients.homonymes.titre_pluriel"],
      );
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      fr["clients.homonymes.conseil_pluriel"],
    );
  });
});
