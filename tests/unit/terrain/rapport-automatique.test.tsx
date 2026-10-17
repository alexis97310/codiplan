import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RapportTerrainAutomatique,
  type PrestationOption,
} from "@/components/terrain/rapport-automatique";
import { fr } from "@/lib/i18n";

/**
 * 9F4-TERRAIN-ENREGISTREMENT-AUTO — LE COMPOSANT, SANS SERVEUR NI RÉSEAU.
 *
 * Ce que `tests/e2e/rapport-terrain.spec.ts` et les voisins mesurent de bout
 * en bout, ce fichier le mesure à l'unité : le DÉBOUNCE (rien avant 1,5 s,
 * tout au `blur`), la FUSION du brouillon local avec les valeurs serveur au
 * montage, et le refus hors connexion du bouton Terminer. `fetch` est un
 * mock — aucune route réelle n'est jointe.
 *
 * Le tracé de la signature (canevas) n'est PAS éprouvé ici : jsdom ne pose
 * aucun contexte 2D, et le composant s'en abstient silencieusement
 * (`getContext` rend `null`) — c'est le rôle de `tests/e2e/rapport-
 * terrain.spec.ts`, où un vrai navigateur trace réellement.
 */

const INTERVENTION_ID = "33333333-3333-3333-3333-333333333333";
const CLE_BROUILLON = `codiplan.terrain.${INTERVENTION_ID}.brouillon`;

const POUSSER = vi.fn();
const RAFRAICHIR = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: POUSSER, refresh: RAFRAICHIR }),
}));

const PRESTATIONS: readonly PrestationOption[] = [
  {
    id: "44444444-4444-4444-4444-444444444444",
    libelle: fr["terrain.e2e.prestation_libelle"],
  },
];

function scene(
  props: Partial<{
    rapportInitial: {
      commentaire_technicien: string | null;
      suite_a_donner: string | null;
    };
    prestationsInitiales: readonly string[];
    dejaSignee: boolean;
    afficherTerminer: boolean;
  }> = {},
) {
  return render(
    <RapportTerrainAutomatique
      interventionId={INTERVENTION_ID}
      rapportInitial={
        props.rapportInitial ?? {
          commentaire_technicien: null,
          suite_a_donner: null,
        }
      }
      prestations={PRESTATIONS}
      prestationsInitiales={props.prestationsInitiales ?? []}
      dejaSignee={props.dejaSignee ?? false}
      afficherTerminer={props.afficherTerminer ?? false}
      sectionPhotos={null}
    />,
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.clear();
  fetchMock = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ ok: true, motif: null }),
  });
  vi.stubGlobal("fetch", fetchMock);
  POUSSER.mockClear();
  RAFRAICHIR.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("le brouillon local reprend le pas sur les valeurs serveur, au montage", () => {
  it("un brouillon trouvé l'emporte sur le `rapportInitial` du serveur", () => {
    window.localStorage.setItem(
      CLE_BROUILLON,
      JSON.stringify({
        commentaire: "Brouillon jamais envoyé",
        suite: "",
        prestationIds: [],
        signature: null,
      }),
    );

    scene({
      rapportInitial: {
        commentaire_technicien: "Valeur du serveur",
        suite_a_donner: null,
      },
    });

    expect(
      screen.getByLabelText(fr["terrain.rapport.commentaire_libelle"]),
    ).toHaveValue("Brouillon jamais envoyé");
  });

  it("sans brouillon, les valeurs du serveur restent affichées", () => {
    scene({
      rapportInitial: {
        commentaire_technicien: "Valeur du serveur",
        suite_a_donner: null,
      },
    });

    expect(
      screen.getByLabelText(fr["terrain.rapport.commentaire_libelle"]),
    ).toHaveValue("Valeur du serveur");
  });
});

describe("le rapport s'envoie seul — débounce de 1,5 s, ou immédiatement au blur", () => {
  it("aucun envoi avant 1,5 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    scene();

    fireEvent.change(
      screen.getByLabelText(fr["terrain.rapport.commentaire_libelle"]),
      { target: { value: "Filtre remplacé" } },
    );

    await act(async () => {
      vi.advanceTimersByTime(1499);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/terrain/${INTERVENTION_ID}/rapport`);
    expect(options.headers).toMatchObject({ Accept: "application/json" });
  });

  it("le `blur` envoie immédiatement, sans attendre le débounce", async () => {
    scene();

    const champ = screen.getByLabelText(
      fr["terrain.rapport.commentaire_libelle"],
    );
    fireEvent.change(champ, { target: { value: "Filtre remplacé" } });
    fireEvent.blur(champ);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("l'indicateur « Enregistré » apparaît après un envoi réussi", async () => {
    scene();

    const champ = screen.getByLabelText(
      fr["terrain.rapport.commentaire_libelle"],
    );
    fireEvent.change(champ, { target: { value: "Filtre remplacé" } });
    fireEvent.blur(champ);

    await waitFor(() =>
      expect(screen.getByText(fr["terrain.rapport.enregistre"])).toBeVisible(),
    );
  });
});

describe("les prestations s'envoient à chaque changement, l'ensemble complet", () => {
  it("cocher une prestation l'envoie sans attendre", async () => {
    scene();

    fireEvent.click(
      screen.getByLabelText(fr["terrain.e2e.prestation_libelle"]),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/terrain/${INTERVENTION_ID}/prestations`);
  });
});

describe("la signature « client absent » / « refus » s'envoie au blur du motif", () => {
  it("un motif saisi puis quitté envoie {issue, motif}", async () => {
    scene();

    fireEvent.click(
      screen.getByRole("button", {
        name: fr["terrain.signature.option_absent"],
      }),
    );
    const motif = screen.getByLabelText(fr["terrain.signature.motif_libelle"]);
    fireEvent.change(motif, { target: { value: "Client injoignable" } });
    fireEvent.blur(motif);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/terrain/${INTERVENTION_ID}/signature`);
    const corps = options.body as FormData;
    expect(corps.get("issue")).toBe("client_absent");
    expect(corps.get("motif")).toBe("Client injoignable");
  });

  it("un motif resté vide n'envoie rien", async () => {
    scene();

    fireEvent.click(
      screen.getByRole("button", {
        name: fr["terrain.signature.option_refus"],
      }),
    );
    fireEvent.blur(
      screen.getByLabelText(fr["terrain.signature.motif_libelle"]),
    );

    // Un délai suffit à constater une absence, `waitFor` n'ayant rien de
    // positif à attendre ici.
    await act(async () => {
      await new Promise((resoudre) => setTimeout(resoudre, 10));
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("le bouton Terminer, hors connexion", () => {
  it("affiche le motif et n'appelle jamais la route", async () => {
    const descripteur = Object.getOwnPropertyDescriptor(
      window.navigator,
      "onLine",
    );
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    try {
      scene({ afficherTerminer: true });

      fireEvent.click(
        screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
      );

      await waitFor(() =>
        expect(
          screen.getByText(fr["terrain.terminer.hors_reseau"]),
        ).toBeVisible(),
      );
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      if (descripteur) {
        Object.defineProperty(window.navigator, "onLine", descripteur);
      }
    }
  });
});
