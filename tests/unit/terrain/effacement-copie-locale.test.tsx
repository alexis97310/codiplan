import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/terrain/copie-locale", () => ({
  effacerCopie: vi.fn(),
  // SANS COPIE LOCALE (9F4H3-HORS-RESEAU-ENVOYER, point 3) — le composant
  // retombe alors sur le comportement d'avant ce lot : effacement immédiat,
  // sans jamais poser de question. `compterEnAttente`/`envoyerFile` ne sont
  // donc jamais sollicitées par CE fichier ; voir `bouton-envoyer.test.tsx`
  // et le spec e2e `9f4h3-mode-avion` pour le chemin AVEC copie et file.
  lireCopie: vi.fn().mockResolvedValue(null),
}));

import {
  EffacementCopieADeconnexion,
  EffacementCopieALouverture,
} from "@/components/terrain/effacement-copie-locale";
import { effacerCopie } from "@/lib/terrain/copie-locale";

/**
 * L'EFFACEMENT DE LA COPIE TERRAIN (point 6, 9F4H1-HORS-RESEAU-CONSULTATION).
 *
 * `effacerCopie` est MOCKÉE : ce fichier éprouve le DÉCLENCHEMENT (quel
 * `submit`, quelle ouverture), pas IndexedDB lui-même — déjà couvert par
 * `tests/unit/terrain/copie-locale.test.ts`.
 */
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EffacementCopieADeconnexion — un écouteur délégué sur l'action", () => {
  it("efface quand un formulaire vers /api/session/deconnexion est soumis", async () => {
    render(
      <>
        <EffacementCopieADeconnexion />
        <form
          action="/api/session/deconnexion"
          method="post"
          data-testid="deco"
        />
      </>,
    );
    const formulaire = document.querySelector<HTMLFormElement>(
      '[data-testid="deco"]',
    );
    formulaire?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    // DEPUIS 9F4H3-HORS-RESEAU-ENVOYER (point 3) — `lireCopie()` est
    // interrogée d'abord (async) : sans copie locale (mock ci-dessus),
    // `effacerCopie()` part quand même, mais après ce détour.
    await waitFor(() => expect(effacerCopie).toHaveBeenCalledTimes(1));
  });

  it("n'efface PAS pour un formulaire vers une autre action", () => {
    render(
      <>
        <EffacementCopieADeconnexion />
        <form action="/api/session/connexion" method="post" data-testid="co" />
      </>,
    );
    const formulaire =
      document.querySelector<HTMLFormElement>('[data-testid="co"]');
    formulaire?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    expect(effacerCopie).not.toHaveBeenCalled();
  });
});

describe("EffacementCopieALouverture — à l'ouverture de la page", () => {
  it("efface dès le montage", () => {
    render(<EffacementCopieALouverture />);
    expect(effacerCopie).toHaveBeenCalledTimes(1);
  });
});
