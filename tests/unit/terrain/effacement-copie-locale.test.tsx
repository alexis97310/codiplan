import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

// `compterEnAttente` N'EST MOCKÉE QU'ICI (9F4H4C) — les trois épreuves
// ci-dessus n'en ont jamais besoin (copie toujours nulle) ; les épreuves de
// la fenêtre avant la première lecture ont besoin d'une file NON VIDE pour
// éprouver la question posée après coup.
vi.mock("@/lib/terrain/file-saisies", async () => {
  const reel = await vi.importActual<
    typeof import("@/lib/terrain/file-saisies")
  >("@/lib/terrain/file-saisies");
  return { ...reel, compterEnAttente: vi.fn() };
});

import {
  EffacementCopieADeconnexion,
  EffacementCopieALouverture,
} from "@/components/terrain/effacement-copie-locale";
import { effacerCopie, lireCopie } from "@/lib/terrain/copie-locale";
import { compterEnAttente } from "@/lib/terrain/file-saisies";

const MARQUE_CONFIRME = "codiplanConfirmeDeconnexion";

function monterFormulaireDeconnexion(): HTMLFormElement {
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
  if (formulaire === null) {
    throw new Error("formulaire de déconnexion introuvable");
  }
  return formulaire;
}

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

describe("EffacementCopieADeconnexion — la fenêtre avant la première lecture (9F4H4C)", () => {
  it("file NON VIDE : un clic arrivé avant la fin de la lecture pose quand même la question", async () => {
    let resoudreLecture!: (
      copie: Awaited<ReturnType<typeof lireCopie>>,
    ) => void;
    vi.mocked(lireCopie).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resoudreLecture = resolve;
        }),
    );
    vi.mocked(compterEnAttente).mockResolvedValueOnce(3);

    const formulaire = monterFormulaireDeconnexion();
    const evenement = new Event("submit", { bubbles: true, cancelable: true });
    formulaire.dispatchEvent(evenement);

    // LA LECTURE N'A PAS ENCORE RÉSOLU — le clic est bloqué, rien n'est
    // encore tranché (ni la question, ni l'effacement).
    expect(evenement.defaultPrevented).toBe(true);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(effacerCopie).not.toHaveBeenCalled();

    resoudreLecture({
      utilisateurId: "u-1",
      societeId: "s-1",
      genereLe: "2026-10-20T00:00:00.000Z",
    });

    await waitFor(() =>
      expect(screen.getByRole("alertdialog")).toBeInTheDocument(),
    );
    expect(effacerCopie).not.toHaveBeenCalled();
  });

  it("file VIDE : un clic arrivé avant la fin de la lecture laisse partir la déconnexion une seule fois", async () => {
    let resoudreLecture!: (
      copie: Awaited<ReturnType<typeof lireCopie>>,
    ) => void;
    vi.mocked(lireCopie).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resoudreLecture = resolve;
        }),
    );

    const formulaire = monterFormulaireDeconnexion();
    const requestSubmitEspion = vi
      .spyOn(formulaire, "requestSubmit")
      .mockImplementation(() => {});
    const evenement = new Event("submit", { bubbles: true, cancelable: true });
    formulaire.dispatchEvent(evenement);

    expect(evenement.defaultPrevented).toBe(true);
    expect(effacerCopie).not.toHaveBeenCalled();

    resoudreLecture(null);

    await waitFor(() => expect(effacerCopie).toHaveBeenCalledTimes(1));
    expect(requestSubmitEspion).toHaveBeenCalledTimes(1);
    expect(formulaire.dataset[MARQUE_CONFIRME]).toBe("1");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("état DÉJÀ LU (file vide) : comportement inchangé — ni marque, ni requestSubmit", async () => {
    vi.mocked(lireCopie).mockResolvedValueOnce(null);

    const formulaire = monterFormulaireDeconnexion();
    const requestSubmitEspion = vi
      .spyOn(formulaire, "requestSubmit")
      .mockImplementation(() => {});

    // LAISSER LA PREMIÈRE LECTURE DU MONTAGE ARRIVER avant de cliquer — le
    // cas commun, déjà résolu avant le clic dans toutes les épreuves
    // mesurées (voir le docblock du composant).
    await waitFor(() => expect(lireCopie).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const evenement = new Event("submit", { bubbles: true, cancelable: true });
    formulaire.dispatchEvent(evenement);

    expect(effacerCopie).toHaveBeenCalledTimes(1);
    expect(evenement.defaultPrevented).toBe(false);
    expect(requestSubmitEspion).not.toHaveBeenCalled();
    expect(formulaire.dataset[MARQUE_CONFIRME]).toBeUndefined();
  });
});

describe("EffacementCopieALouverture — à l'ouverture de la page", () => {
  it("efface dès le montage", () => {
    render(<EffacementCopieALouverture />);
    expect(effacerCopie).toHaveBeenCalledTimes(1);
  });
});
