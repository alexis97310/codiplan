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

import { BoutonReprendreTerrain } from "@/components/terrain/reprendre-terrain";
import { fr } from "@/lib/i18n";
import type { StatutIntervention } from "@/lib/interventions/saisie";
import { listerFilePourIntervention } from "@/lib/terrain/file-saisies";

import { installerIndexedDBFactice } from "./aide-indexeddb-factice";

/**
 * « REPRENDRE » (9L08C-TERRAIN-REPRENDRE-SUSPENSION) — même harnais que
 * `suspendre-terrain.test.tsx` : `fetch` est un mock, et le double
 * IndexedDB/`<dialog>` couvre les mêmes lacunes de jsdom.
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
  statut = "suspendue",
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
    <BoutonReprendreTerrain
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

function ouvrirEtConfirmer(): void {
  fireEvent.click(
    screen.getByRole("button", { name: fr["terrain.reprendre.bouton"] }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: fr["terrain.reprendre.confirmer"] }),
  );
}

describe("statut différent de suspendue — rien ne s'affiche", () => {
  it("une intervention en cours ne montre pas « Reprendre »", () => {
    scene({ statut: "en_cours" });
    expect(
      screen.queryByRole("button", { name: fr["terrain.reprendre.bouton"] }),
    ).not.toBeInTheDocument();
  });
});

describe("suspendue — la confirmation rappelle le motif", () => {
  it("montre la référence et la date dans le dialogue", () => {
    scene({
      pieceAttendueRef: "REF-42",
      dateDispoPrevue: "2026-12-01T00:00:00.000Z",
    });
    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.reprendre.bouton"] }),
    );
    expect(screen.getByText(/REF-42/)).toBeVisible();
  });
});

describe("en ligne — l'envoi réussit", () => {
  it("poste, puis rafraîchit la fiche", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ json: async () => ({ ok: true, motif: null }) });
    vi.stubGlobal("fetch", fetchMock);

    scene();
    ouvrirEtConfirmer();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/terrain/${INTERVENTION_ID}/reprendre`);
    expect(options.method).toBe("POST");
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
          motif: "intervention.refus.pas_suspendue",
        }),
      }),
    );

    scene();
    ouvrirEtConfirmer();

    await waitFor(() =>
      expect(
        screen.getByText(fr["intervention.refus.pas_suspendue"]),
      ).toBeVisible(),
    );
    const file = await listerFilePourIntervention(INTERVENTION_ID, {
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
    });
    expect(file).toHaveLength(0);
  });
});

describe("hors réseau — la saisie est gardée (même patron que BoutonSuspendreTerrain)", () => {
  it("affiche « en attente d'envoi » et garde le geste en file", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    scene();
    ouvrirEtConfirmer();

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
    expect(file[0].geste).toStrictEqual({ type: "reprendre" });
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
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: false, motif: "auth.refus" }),
      }),
    );

    scene({ sansSession: true });
    ouvrirEtConfirmer();

    await waitFor(() =>
      expect(
        screen.getByText(fr["terrain.file.en_attente_envoi"]),
      ).toBeVisible(),
    );
  });
});
