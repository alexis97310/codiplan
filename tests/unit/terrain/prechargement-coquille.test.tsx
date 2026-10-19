import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/terrain",
}));

vi.mock("@/lib/terrain/copie-locale", () => ({
  ecrireCopieEnRemplacantLidentite: vi.fn().mockResolvedValue(undefined),
}));

import { CopieLocaleTerrain } from "@/components/terrain/copie-locale";

/**
 * LE PRÉCHARGEMENT DE LA COQUILLE (point 1, 9F4H4B-OUVERTURE-A-FROID) — un
 * cadre invisible vers `/terrain-hors-reseau`, posé par `CopieLocaleTerrain`
 * à chaque montage EN LIGNE. `fetch` est un mock : aucune route réelle n'est
 * jointe (même idiome que `bouton-envoyer.test.tsx`).
 */

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete (window.navigator as { onLine?: boolean }).onLine;
  document.querySelectorAll("iframe").forEach((cadre) => cadre.remove());
});

function cadreDeLaCoquille(): HTMLIFrameElement | null {
  return document.querySelector('iframe[src="/terrain-hors-reseau"]');
}

describe("en ligne — la coquille est préchargée dans un cadre invisible", () => {
  it("pose un <iframe> vers /terrain-hors-reseau, aria-hidden", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );

    render(<CopieLocaleTerrain />);

    await waitFor(() => expect(cadreDeLaCoquille()).not.toBeNull());
    const cadre = cadreDeLaCoquille();
    expect(cadre?.getAttribute("aria-hidden")).toBe("true");
    expect(cadre?.tabIndex).toBe(-1);
  });
});

describe("hors réseau — aucun cadre n'est posé", () => {
  it("ne crée pas d'<iframe> quand navigator.onLine est faux", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    render(<CopieLocaleTerrain />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cadreDeLaCoquille()).toBeNull();
  });
});
