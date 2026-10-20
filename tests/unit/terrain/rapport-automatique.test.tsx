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
import {
  ajouterSaisie,
  listerFilePourIntervention,
} from "@/lib/terrain/file-saisies";

import { installerIndexedDBFactice } from "./aide-indexeddb-factice";

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
 *
 * LE DOUBLE INDEXEDDB (9F4H3A-FILE-SANS-PERTE, point 2) — jsdom n'implémente
 * pas IndexedDB ; sans le double, `ajouterSaisie` échouerait RÉELLEMENT à
 * chaque scénario « hors réseau » de ce fichier, et ces scénarios verraient
 * tous le message d'échec du point 2 plutôt que celui qu'ils éprouvent.
 *
 * JAMAIS `vi.useFakeTimers({ shouldAdvanceTime: true })` POUR UNE BORNE EN
 * DEÇÀ D'UN DÉLAI (9F4H5A-HEURE-CALEE-SERVEUR, point 2) — mesuré instable
 * (ROUGE puis VERT sur deux passages de `pnpm verify`, aucun autre
 * changement entre les deux) sur « aucun envoi avant 1,5 s » :
 * `shouldAdvanceTime` fait avancer l'horloge FACTICE toute seule, au rythme
 * de l'horloge RÉELLE de la machine qui joue l'épreuve — le temps que
 * `scene()` prenne à monter (rendu, effets, double IndexedDB) s'ajoutait
 * donc, de façon non reproductible, aux 1 499 ms explicitement avancées, et
 * basculait parfois la minuterie de 1 500 ms AVANT l'assertion « rien
 * envoyé ». Seule l'horloge FACTICE sans compagnon réel, avancée
 * EXPLICITEMENT par `vi.advanceTimersByTimeAsync` (jamais
 * `advanceTimersByTime` synchrone, qui ne laisse pas les microtâches —
 * `fetch`, les promesses d'IndexedDB — se résoudre entre deux avancées),
 * tient la borne « avant »/« après » au nombre de millisecondes exact,
 * indépendamment de la machine.
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

/**
 * UN SEUL TYPE DE GESTE ÉCHOUE À ÊTRE GARDÉ, LES AUTRES PASSENT PAR LE VRAI
 * DOUBLE (point 4, 9F4H3AC) — `installerIndexedDBFactice({ enPanne: true })`
 * fait échouer TOUTE écriture, ce qui ne distinguerait pas « terminer n'a
 * jamais été tenté parce que la signature a échoué » de « terminer a aussi
 * échoué, pour la même raison que la signature ». `controleAjout` isole la
 * panne sur un seul type de geste, le reste restant garde par le double réel.
 */
const controleAjout = vi.hoisted(() => ({
  echouerPourType: null as string | null,
}));

vi.mock("@/lib/terrain/file-saisies", async () => {
  const reel = await vi.importActual<
    typeof import("@/lib/terrain/file-saisies")
  >("@/lib/terrain/file-saisies");
  return {
    ...reel,
    ajouterSaisie: (parametres: Parameters<typeof reel.ajouterSaisie>[0]) => {
      if (parametres.geste.type === controleAjout.echouerPourType) {
        return Promise.resolve({ gardee: false as const });
      }
      return reel.ajouterSaisie(parametres);
    },
  };
});

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
    statut: "en_cours" | "a_planifier" | "cloturee" | "annulee";
    minutesConnues: number;
    segmentOuvertConnu: { readonly debut: string } | null;
  }> = {},
) {
  return render(
    <RapportTerrainAutomatique
      interventionId={INTERVENTION_ID}
      utilisateurId={UTILISATEUR_ID}
      societeId={SOCIETE_ID}
      statut={props.statut ?? "en_cours"}
      // Un temps déjà mesuré par défaut (point 4, C5) : la plupart des
      // épreuves de ce fichier n'éprouvent PAS le refus « temps manquant »,
      // et ne doivent pas s'y heurter par accident.
      minutesConnues={props.minutesConnues ?? 60}
      segmentOuvertConnu={props.segmentOuvertConnu ?? null}
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
let restaurerIndexedDB: () => void;

beforeEach(() => {
  window.localStorage.clear();
  restaurerIndexedDB = installerIndexedDBFactice();
  fetchMock = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ ok: true, motif: null }),
  });
  vi.stubGlobal("fetch", fetchMock);
  POUSSER.mockClear();
  RAFRAICHIR.mockClear();
  controleAjout.echouerPourType = null;
});

afterEach(() => {
  restaurerIndexedDB();
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
    // JAMAIS `shouldAdvanceTime` (instable — voir le docblock de tête du
    // fichier) : l'horloge factice n'avance alors QUE par
    // `advanceTimersByTimeAsync`, jamais toute seule au rythme de l'horloge
    // RÉELLE — la durée que prend `scene()` à monter sur la machine qui
    // joue l'épreuve ne compte plus pour rien dans les 1 499 ms mesurées.
    vi.useFakeTimers();
    scene();

    fireEvent.change(
      screen.getByLabelText(fr["terrain.rapport.commentaire_libelle"]),
      { target: { value: "Filtre remplacé" } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1499);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
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
  // aucune), le refus vient désormais du verdict LOCAL `peutTerminer`
  // (point 4, 9F4H3A, C5) — même clé que le serveur poserait pour ce même
  // manque, mais SEUL (plus de prefixe `signature_non_enregistree`) : le
  // verdict local nomme la cause réelle, qu'elle soit le temps ou la
  // signature, jamais une seule d'entre elles supposée par construction.
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
          screen.getByText(fr["intervention.refus.signature_manquante"]),
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

describe("jamais « gardé » sans preuve, quand IndexedDB échoue (point 2, 9F4H3A)", () => {
  it("un rapport jamais parti ET non gardé affiche l'échec, jamais « hors ligne »", async () => {
    restaurerIndexedDB();
    restaurerIndexedDB = installerIndexedDBFactice({ enPanne: true });
    fetchMock = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchMock);

    scene();

    const champ = screen.getByLabelText(
      fr["terrain.rapport.commentaire_libelle"],
    );
    fireEvent.change(champ, { target: { value: "Filtre remplacé" } });
    fireEvent.blur(champ);

    await waitFor(() =>
      expect(screen.getByText(fr["terrain.file.echec_gardee"])).toBeVisible(),
    );
    expect(
      screen.queryByText(fr["terrain.auto.hors_ligne"]),
    ).not.toBeInTheDocument();
  });

  it("« Terminer » hors réseau, IndexedDB en panne : aucune promesse d'attente", async () => {
    restaurerIndexedDB();
    restaurerIndexedDB = installerIndexedDBFactice({ enPanne: true });
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
          screen.getAllByText(fr["terrain.file.echec_gardee"]).length,
        ).toBeGreaterThan(0),
      );
      // LE BOUTON RESTE : rien n'a été gardé, le geste doit pouvoir être
      // retenté plutôt que de disparaître derrière « en attente d'envoi ».
      expect(
        screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(fr["terrain.terminer.en_attente_envoi"]),
      ).not.toBeInTheDocument();
    } finally {
      delete (window.navigator as { onLine?: boolean }).onLine;
    }
  });
});

describe("un identifiant dès le premier essai, pour la signature (point 3, C7)", () => {
  it("le premier essai EN LIGNE porte operation_id, et la file garde le MÊME identifiant", async () => {
    fetchMock = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchMock);

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
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const idPremierEssai = (options.body as FormData).get("operation_id");
    expect(typeof idPremierEssai).toBe("string");

    const file = await listerFilePourIntervention(INTERVENTION_ID, {
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
    });
    expect(file).toHaveLength(1);
    expect(file[0].id).toBe(idPremierEssai);
  });
});

describe("« Terminer » hors réseau ne ment pas sur ce qu'il a gardé (point 4, 9F4H3AC)", () => {
  it("signature en échec de garde : jamais « en attente d'envoi », même si « terminer » aurait réussi", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    fetchMock = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchMock);
    // SEULE LA SIGNATURE ÉCHOUE À ÊTRE GARDÉE — rapport et prestations
    // n'ont pas changé (rien à mettre en file), « terminer » réussirait si
    // on le tentait : c'est justement ce que ce test interdit.
    controleAjout.echouerPourType = "signature";
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
          screen.getAllByText(fr["terrain.file.echec_gardee"]).length,
        ).toBeGreaterThan(0),
      );
      expect(
        screen.queryByText(fr["terrain.terminer.en_attente_envoi"]),
      ).not.toBeInTheDocument();
      const file = await listerFilePourIntervention(INTERVENTION_ID, {
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
      });
      expect(file.some((e) => e.geste.type === "terminer")).toBe(false);
    } finally {
      delete (window.navigator as { onLine?: boolean }).onLine;
    }
  });
});

describe("le verdict local de « Terminer », hors réseau (point 4, 9F4H3A, C5)", () => {
  it("aucun temps mesuré, ni connu ni en file : refuse « temps manquant », rien en file", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    try {
      scene({ afficherTerminer: true, minutesConnues: 0 });

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
          screen.getByText(fr["intervention.refus.temps_manquant"]),
        ).toBeVisible(),
      );
      const file = await listerFilePourIntervention(INTERVENTION_ID, {
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
      });
      expect(file.some((e) => e.geste.type === "terminer")).toBe(false);
    } finally {
      delete (window.navigator as { onLine?: boolean }).onLine;
    }
  });

  it("aucune minute connue, mais un segment FERMÉ dans la file : accepté et mis en file", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    try {
      // DES IDENTIFIANTS EXPLICITEMENT ORDONNÉS — deux appels d'affilée
      // peuvent tomber dans la MÊME milliseconde, où le tri lexicographique
      // d'un UUID v7 dépend alors des octets aléatoires, pas de l'ordre
      // d'appel (voir l'en-tête de `file-saisies.ts`) ; sans réseau humain
      // entre les deux clics, ce test fixe l'ordre pour rester déterministe.
      await ajouterSaisie({
        interventionId: INTERVENTION_ID,
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
        geste: { type: "compteur", action: "demarrer" },
        instantAppareil: "2026-10-18T03:00:00.000Z",
        id: "01111111-1111-7111-8111-111111111111",
      });
      await ajouterSaisie({
        interventionId: INTERVENTION_ID,
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
        geste: { type: "compteur", action: "arreter" },
        instantAppareil: "2026-10-18T03:10:00.000Z",
        id: "02222222-2222-7222-8222-222222222222",
      });

      scene({ afficherTerminer: true, minutesConnues: 0 });

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
    } finally {
      delete (window.navigator as { onLine?: boolean }).onLine;
    }
  });

  it("un « démarrer » resté seul en file (compteur encore ouvert) : accepté et mis en file, PAS « temps manquant » (correctif 9F4H3AA)", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    try {
      // AUCUN « ARRÊTER » — le cas ORDINAIRE : le technicien clique
      // « Terminer » directement, sans mettre le compteur en pause d'abord.
      // Le serveur fermerait ce segment sur l'instant du « terminer »
      // (`terminerIntervention`) ; la file ne le ferme jamais elle-même.
      await ajouterSaisie({
        interventionId: INTERVENTION_ID,
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
        geste: { type: "compteur", action: "demarrer" },
        instantAppareil: "2026-10-18T03:00:00.000Z",
        id: "03333333-3333-7333-8333-333333333333",
      });

      scene({ afficherTerminer: true, minutesConnues: 0 });

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
    } finally {
      delete (window.navigator as { onLine?: boolean }).onLine;
    }
  });

  // UN COMPTEUR DÉMARRÉ EN LIGNE (point 3, 9F4H3AC) — le serveur connaît déjà
  // un segment ouvert (`segmentOuvertConnu`), que la file, elle, ignore
  // puisque ce « démarrer » n'y est jamais passé.
  describe("un compteur démarré EN LIGNE, connu du serveur (point 3, 9F4H3AC)", () => {
    it("(a) rien en file : accepté localement et rangé, jamais « temps manquant »", async () => {
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });
      try {
        scene({
          afficherTerminer: true,
          minutesConnues: 0,
          segmentOuvertConnu: { debut: "2026-10-18T03:00:00.000Z" },
        });

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
          screen.queryByText(fr["intervention.refus.temps_manquant"]),
        ).not.toBeInTheDocument();
      } finally {
        delete (window.navigator as { onLine?: boolean }).onLine;
      }
    });

    it("(b) un « arrêter » seul hors réseau en file ferme ce segment : minutes > 0, accepté", async () => {
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });
      try {
        await ajouterSaisie({
          interventionId: INTERVENTION_ID,
          utilisateurId: UTILISATEUR_ID,
          societeId: SOCIETE_ID,
          geste: { type: "compteur", action: "arreter" },
          instantAppareil: "2026-10-18T03:10:00.000Z",
          id: "04444444-4444-7444-8444-444444444444",
        });

        scene({
          afficherTerminer: true,
          minutesConnues: 0,
          segmentOuvertConnu: { debut: "2026-10-18T03:00:00.000Z" },
        });

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
      } finally {
        delete (window.navigator as { onLine?: boolean }).onLine;
      }
    });

    it("(c) aucun segment nulle part (ni serveur, ni file) : refus « temps manquant » CONSERVÉ", async () => {
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });
      try {
        scene({
          afficherTerminer: true,
          minutesConnues: 0,
          segmentOuvertConnu: null,
        });

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
            screen.getByText(fr["intervention.refus.temps_manquant"]),
          ).toBeVisible(),
        );
        const file = await listerFilePourIntervention(INTERVENTION_ID, {
          utilisateurId: UTILISATEUR_ID,
          societeId: SOCIETE_ID,
        });
        expect(file.some((e) => e.geste.type === "terminer")).toBe(false);
      } finally {
        delete (window.navigator as { onLine?: boolean }).onLine;
      }
    });
  });
});
