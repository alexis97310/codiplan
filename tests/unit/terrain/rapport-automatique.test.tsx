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
const UTILISATEUR_ID = "55555555-5555-5555-5555-555555555555";
const SOCIETE_ID = "66666666-6666-6666-6666-666666666666";
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
      utilisateurId={UTILISATEUR_ID}
      societeId={SOCIETE_ID}
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
      verdictTerminerRefuseCle={null}
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
  // DEPUIS 9F4H3-HORS-RESEAU-ENVOYER (point 1, décision n° 108 d'Alexis) —
  // « Terminer » hors réseau n'est plus un refus générique
  // (`terrain.terminer.sans_reseau`, superseded) : il est ACCEPTÉ et mis en
  // file, SIGNATURE COMPRISE. Sans signature saisie (ce `scene()` n'en pose
  // aucune), le motif redevient celui, plus précis, que `peutTerminer` pose
  // déjà pour ce même manque en ligne.
  it("sans signature saisie, affiche le motif de signature manquante et n'appelle jamais la route", async () => {
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
          screen.getByText(
            `${fr["terrain.terminer.signature_non_enregistree"]}${fr["intervention.refus.signature_manquante"]}`,
          ),
        ).toBeVisible(),
      );
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      delete (window.navigator as { onLine?: boolean }).onLine;
    }
  });
});

describe("« Terminer » n'appelle jamais /terminer tant qu'un bloc n'est pas accepté (9F4A, point 1)", () => {
  it("un rapport refusé par le serveur bloque Terminer, et garde le brouillon", async () => {
    fetchMock = vi.fn((url: unknown) => {
      if ((url as string).endsWith("/rapport")) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({ ok: false, motif: "terrain.rapport.refus" }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ ok: true, motif: null }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    scene({ afficherTerminer: true });

    const champ = screen.getByLabelText(
      fr["terrain.rapport.commentaire_libelle"],
    );
    fireEvent.change(champ, { target: { value: "Filtre remplacé" } });
    fireEvent.blur(champ);
    await waitFor(() =>
      expect(screen.getByText(fr["terrain.rapport.refus"])).toBeVisible(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          `${fr["terrain.terminer.rapport_non_enregistre"]}${fr["terrain.rapport.refus"]}`,
        ),
      ).toBeVisible(),
    );
    expect(
      (fetchMock.mock.calls as [string, RequestInit][]).some(([url]) =>
        url.endsWith("/terminer"),
      ),
    ).toBe(false);
    expect(window.localStorage.getItem(CLE_BROUILLON)).not.toBeNull();
  });

  // INCHANGÉ PAR 9F4H3-HORS-RESEAU-ENVOYER — la décision n° 108 (Terminer
  // accepté et mis en file) ne se déclenche que sur `!navigator.onLine`
  // (mode avion RÉEL), jamais sur un simple échec de requête alors que
  // l'appareil se croit en ligne : ce scénario (9F4A) reste donc le refus
  // d'origine, rejouable par un second clic.
  it("un rapport jamais parti faute de réseau bloque Terminer, et garde le brouillon", async () => {
    fetchMock = vi.fn((url: unknown) => {
      if ((url as string).endsWith("/rapport")) {
        return Promise.reject(new Error("réseau indisponible"));
      }
      return Promise.resolve({
        json: () => Promise.resolve({ ok: true, motif: null }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    scene({ afficherTerminer: true });

    const champ = screen.getByLabelText(
      fr["terrain.rapport.commentaire_libelle"],
    );
    fireEvent.change(champ, { target: { value: "Filtre remplacé" } });
    fireEvent.blur(champ);
    await waitFor(() =>
      expect(screen.getByText(fr["terrain.auto.hors_ligne"])).toBeVisible(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(fr["terrain.terminer.sans_reseau"]),
      ).toBeVisible(),
    );
    expect(
      (fetchMock.mock.calls as [string, RequestInit][]).some(([url]) =>
        url.endsWith("/terminer"),
      ),
    ).toBe(false);
    expect(window.localStorage.getItem(CLE_BROUILLON)).not.toBeNull();
  });

  it("tout accepté : /terminer est appelé, puis le brouillon est effacé", async () => {
    window.localStorage.setItem(
      CLE_BROUILLON,
      JSON.stringify({
        commentaire: "Prêt à synchroniser",
        suite: "",
        prestationIds: [],
        signature: null,
      }),
    );

    scene({ afficherTerminer: true });

    await waitFor(() =>
      expect(screen.getByText(fr["terrain.rapport.enregistre"])).toBeVisible(),
    );
    fetchMock.mockClear();

    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
    );

    await waitFor(() => expect(POUSSER).toHaveBeenCalledTimes(1));
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/terrain/${INTERVENTION_ID}/terminer`);
    expect(window.localStorage.getItem(CLE_BROUILLON)).toBeNull();
  });
});

describe("chaque envoi abandonne après 15 s, plutôt que de bloquer Terminer indéfiniment (point 3)", () => {
  // INCHANGÉ PAR 9F4H3-HORS-RESEAU-ENVOYER — voir le `describe` précédent :
  // ce n'est pas `!navigator.onLine`, donc le refus d'origine (9F4A).
  it("le bloc passe hors connexion, et « Terminer » se réactive avec le message sans réseau", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock = vi.fn(
      (_url: unknown, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => {
            reject(new DOMException("Abandon", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    scene({ afficherTerminer: true });

    fireEvent.change(
      screen.getByLabelText(fr["terrain.rapport.commentaire_libelle"]),
      { target: { value: "Filtre remplacé" } },
    );

    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
    );
    expect(
      screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
    ).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    await waitFor(() =>
      expect(
        screen.getByText(fr["terrain.terminer.sans_reseau"]),
      ).toBeVisible(),
    );
    expect(
      screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
    ).not.toBeDisabled();
  });
});

describe("« Terminer » hors réseau AVEC signature est accepté et mis en file (9F4H3-HORS-RESEAU-ENVOYER, point 1, décision n° 108)", () => {
  it("met « terminer » en file plutôt que de refuser, et montre l'attente d'envoi", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    fetchMock = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchMock);
    try {
      scene({ afficherTerminer: true });

      fireEvent.click(
        screen.getByRole("button", {
          name: fr["terrain.signature.option_absent"],
        }),
      );
      fireEvent.change(
        screen.getByLabelText(fr["terrain.signature.motif_libelle"]),
        { target: { value: "Client absent au départ du technicien" } },
      );

      fireEvent.click(
        screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
      );

      await waitFor(() =>
        expect(
          screen.getByText(fr["terrain.terminer.en_attente_envoi"]),
        ).toBeVisible(),
      );
      expect(
        screen.queryByRole("button", { name: fr["terrain.terminer.bouton"] }),
      ).not.toBeInTheDocument();
      expect(
        (fetchMock.mock.calls as [string, RequestInit][]).some(([url]) =>
          url.endsWith("/terminer"),
        ),
      ).toBe(false);
      // RIEN NE SE PERD (point 3) : le brouillon reste jusqu'à l'envoi réel.
      expect(window.localStorage.getItem(CLE_BROUILLON)).not.toBeNull();
    } finally {
      delete (window.navigator as { onLine?: boolean }).onLine;
    }
  });
});
