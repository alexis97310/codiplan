import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/terrain/copie-locale", () => ({
  effacerCopie: vi.fn(),
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
  it("efface quand un formulaire vers /api/session/deconnexion est soumis", () => {
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
    expect(effacerCopie).toHaveBeenCalledTimes(1);
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
