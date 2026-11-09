import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { BoutonSuspendreTerrain } from "@/components/terrain/suspendre-terrain";
import { fr } from "@/lib/i18n";
import type { StatutIntervention } from "@/lib/interventions/saisie";
import { listerFilePourIntervention } from "@/lib/terrain/file-saisies";

import { installerIndexedDBFactice } from "./aide-indexeddb-factice";

/**
 * « J'ATTENDS UNE PIÈCE » (9K13-TERRAIN-ATTENTE-PIECE) — `fetch` est un
 * mock, aucune route réelle n'est jointe. Même double IndexedDB que
 * `compteur-terrain.test.tsx` : jsdom n'implémente pas IndexedDB. Même
 * polyfill `showModal`/`close` que `tests/unit/ui/dialogue.test.tsx` —
 * jsdom ne porte ni l'un ni l'autre sur `HTMLDialogElement`.
 */

const INTERVENTION_ID = "33333333-3333-3333-3333-333333333333";
const UTILISATEUR_ID = "55555555-5555-5555-5555-555555555555";
const SOCIETE_ID = "66666666-6666-6666-6666-666666666666";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

beforeAll(() => {
  if (typeof HTMLDialogElement.prototype.showModal !== "function") {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.open = true;
      this.setAttribute("open", "");
    };
  }
  if (typeof HTMLDialogElement.prototype.close !== "function") {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.open = false;
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
});

let restaurerIndexedDB: () => void;

beforeEach(() => {
  restaurerIndexedDB = installerIndexedDBFactice();
});

afterEach(() => {
  restaurerIndexedDB();
  vi.unstubAllGlobals();
});

function scene({
  statut = "en_cours",
  sansSession = false,
  motifSuspension = null,
  pieceAttendueRef = null,
  dateDispoPrevue = null,
}: {
  readonly statut?: StatutIntervention;
  readonly sansSession?: boolean;
  readonly motifSuspension?: string | null;
  readonly pieceAttendueRef?: string | null;
  readonly dateDispoPrevue?: string | null;
} = {}) {
  return render(
    <BoutonSuspendreTerrain
      interventionId={INTERVENTION_ID}
      utilisateurId={UTILISATEUR_ID}
      societeId={SOCIETE_ID}
      statut={statut}
      sansSession={sansSession}
      motifSuspension={motifSuspension}
      pieceAttendueRef={pieceAttendueRef}
      dateDispoPrevue={dateDispoPrevue}
    />,
  );
}

async function remplirEtConfirmer(ref: string, date: string): Promise<void> {
  fireEvent.click(
    screen.getByRole("button", { name: fr["terrain.suspendre.bouton"] }),
  );
  fireEvent.change(screen.getByLabelText(fr["intervention.suspension.piece"]), {
    target: { value: ref },
  });
  fireEvent.change(
    screen.getByLabelText(fr["intervention.suspension.date_dispo"]),
    { target: { value: date } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: fr["terrain.suspendre.enregistrer"] }),
  );
}

describe("statut différent de en_cours/suspendue — rien ne s'affiche", () => {
  it("une intervention affectée ne montre ni bouton ni bandeau", () => {
    scene({ statut: "affectee" });
    expect(
      screen.queryByRole("button", { name: fr["terrain.suspendre.bouton"] }),
    ).not.toBeInTheDocument();
  });
});

describe("déjà suspendue — la pièce attendue s'affiche, en lecture", () => {
  it("montre la référence et la date, jamais le bouton", () => {
    scene({
      statut: "suspendue",
      pieceAttendueRef: "REF-42",
      dateDispoPrevue: "2026-12-01T00:00:00.000Z",
    });
    expect(screen.getByText(/REF-42/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: fr["terrain.suspendre.bouton"] }),
    ).not.toBeInTheDocument();
  });
});

describe("en ligne — l'envoi réussit", () => {
  it("poste motif, référence et date, puis rafraîchit la fiche", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ json: async () => ({ ok: true, motif: null }) });
    vi.stubGlobal("fetch", fetchMock);

    scene();
    await remplirEtConfirmer("REF-42", "2026-12-01");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/terrain/${INTERVENTION_ID}/suspendre`);
    const corps = options.body as FormData;
    expect(corps.get("piece_attendue_ref")).toBe("REF-42");
    expect(corps.get("date_dispo_prevue")).toBe("2026-12-01");
    expect(typeof corps.get("motif")).toBe("string");
    expect((corps.get("motif") as string).length).toBeGreaterThan(0);
  });

  it("un refus serveur s'affiche en clair, sans mettre la saisie en file", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          ok: false,
          motif: "intervention.refus.deja_suspendue",
        }),
      }),
    );

    scene();
    await remplirEtConfirmer("REF-42", "2026-12-01");

    await waitFor(() =>
      expect(
        screen.getByText(fr["intervention.refus.deja_suspendue"]),
      ).toBeVisible(),
    );
    const file = await listerFilePourIntervention(INTERVENTION_ID, {
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
    });
    expect(file).toHaveLength(0);
  });
});

describe("hors réseau — la saisie est gardée (décision D108, même patron que BoutonCompteurTerrain)", () => {
  it("affiche « en attente d'envoi » et garde le geste en file", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    scene();
    await remplirEtConfirmer("REF-42", "2026-12-01");

    await waitFor(() =>
      expect(
        screen.getByText(fr["terrain.file.en_attente_envoi"]),
      ).toBeVisible(),
    );
    expect(fetchMock).not.toHaveBeenCalled();

    const file = await listerFilePourIntervention(INTERVENTION_ID, {
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
    });
    expect(file).toHaveLength(1);
    expect(file[0].geste).toMatchObject({
      type: "suspendre",
      pieceAttendueRef: "REF-42",
      dateDispoPrevue: "2026-12-01",
    });
  });
});

describe("la coquille sans réseau — un refus d'authentification n'est jamais affiché (point 2, 9F4H4D)", () => {
  it("`auth.refus` sous `sansSession` garde le geste en file, comme une coupure", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          json: async () => ({ ok: false, motif: "auth.refus" }),
        }),
    );

    scene({ sansSession: true });
    await remplirEtConfirmer("REF-42", "2026-12-01");

    await waitFor(() =>
      expect(
        screen.getByText(fr["terrain.file.en_attente_envoi"]),
      ).toBeVisible(),
    );
  });
});
