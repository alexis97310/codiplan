import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BlocPosable,
  CasePosable,
  PARAMETRE_AVERTISSEMENT,
  Posable,
  type CibleDeDepot,
} from "@/components/planning/pose";
import { fr } from "@/lib/i18n/fr";

/**
 * LE GLISSER-DÉPOSER DU PLANNING — LES QUATRE ISSUES D'UN DÉPÔT NE SE
 * CONFONDENT JAMAIS (D-06, 17/09/2026).
 *
 * ## Le défaut que ce fichier éprouve, et il a été mesuré
 *
 * `reponse.ok` n'était jamais lu, et un corps vide ou non-JSON tombait sur la
 * branche du SUCCÈS : le planificateur voyait l'écran dire que c'était fait
 * quand ce n'était pas fait. Et le `fetch` n'avait aucun `catch` : une coupure
 * réseau partait en rejet non intercepté.
 *
 * ## Pourquoi ici, et pas seulement dans `tests/e2e/glisser-deposer.spec.ts`
 *
 * L'e2e éprouve déjà les refus MÉTIER, à travers la vraie route et la vraie
 * base — c'est le seul endroit qui peut le faire. Mais **aucun scénario e2e ne
 * peut couper le réseau au milieu d'un vrai `fetch`**, ni faire répondre le
 * serveur par un corps vide sous un code 200 : ces deux issues-là ne
 * s'éprouvent qu'en maîtrisant ce que `fetch` rend, donc ici, au niveau du
 * composant.
 *
 * ## UN DÉPÔT ACCEPTÉ NAVIGUE, IL NE RAFRAÎCHIT PLUS (N+1, 17/09/2026)
 *
 * *Mesuré : `router.refresh()` ne suivait l'écriture que dans 1 essai sur 20.*
 * `naviguer` remplace `rafraichir` comme témoin de la base ci-dessous — un
 * rechargement complet de l'URL courante, avec les avertissements dans ses
 * paramètres plutôt que dans un état qu'il effacerait avant qu'on le lise.
 */

const naviguer = vi.fn();

beforeEach(() => {
  Object.defineProperty(window, "location", {
    value: {
      ...window.location,
      href: "http://localhost/planning?vue=jour&jour=2026-09-16",
      assign: naviguer,
    },
    writable: true,
  });
});

const CIBLE: CibleDeDepot = {
  jour: "2026-09-16",
  technicienId: "tech-1",
  minutes: null,
  pasMinutes: 30,
};

/** Le corps porté par un glissé, tel que `lireLaMain` sait le lire. */
function dataTransferDe(interventionId: string): DataTransfer {
  const charge = JSON.stringify({ id: interventionId, dureeMin: 60 });
  return {
    getData: (format: string) =>
      format === "application/x-codiplan-intervention" ? charge : "",
  } as DataTransfer;
}

function scene() {
  return render(
    <Posable>
      <table>
        <tbody>
          <tr>
            <td>
              <BlocPosable interventionId="int-1" dureeMin={60}>
                <span aria-hidden />
              </BlocPosable>
            </td>
            <CasePosable cible={CIBLE}>
              <span aria-hidden />
            </CasePosable>
          </tr>
        </tbody>
      </table>
    </Posable>,
  );
}

/** La case de dépôt, seule dans cette scène. */
function laCase(container: HTMLElement): Element {
  const element = container.querySelector(
    '[data-depot-jour="2026-09-16"][data-depot-technicien="tech-1"]',
  );
  if (element === null) {
    throw new Error("la case de dépôt n'a pas été rendue");
  }
  return element;
}

afterEach(() => {
  naviguer.mockClear();
  vi.unstubAllGlobals();
});

describe("un dépôt qui ABOUTIT", () => {
  it("recharge la page courante, avec les avertissements en paramètre", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          accepte: true,
          cle: null,
          avertissements: ["intervention.refus.absence"],
        }),
      }),
    );
    const { container } = scene();

    fireEvent.drop(laCase(container), {
      dataTransfer: dataTransferDe("int-1"),
    });

    await waitFor(() => expect(naviguer).toHaveBeenCalledTimes(1));
    // Aucun refus n'est resté affiché — un rechargement n'y a même pas besoin
    // de veiller, il détruit l'état React dans le même geste.
    expect(screen.queryByRole("alert")).toBeNull();
    const url = new URL(naviguer.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/planning");
    expect(url.searchParams.get("vue")).toBe("jour");
    expect(url.searchParams.getAll(PARAMETRE_AVERTISSEMENT)).toEqual([
      "intervention.refus.absence",
    ]);
  });

  it("purge un avertissement déjà présent dans l'URL avant d'y remettre les nouveaux", async () => {
    Object.defineProperty(window, "location", {
      value: {
        ...window.location,
        href: `http://localhost/planning?${PARAMETRE_AVERTISSEMENT}=intervention.refus.ancien`,
        assign: naviguer,
      },
      writable: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ accepte: true, cle: null, avertissements: [] }),
      }),
    );
    const { container } = scene();

    fireEvent.drop(laCase(container), {
      dataTransfer: dataTransferDe("int-1"),
    });

    await waitFor(() => expect(naviguer).toHaveBeenCalledTimes(1));
    const url = new URL(naviguer.mock.calls[0][0] as string);
    expect(url.searchParams.getAll(PARAMETRE_AVERTISSEMENT)).toEqual([]);
  });

  it("purge aussi `motif` — un refus de création déjà affiché ne doit pas survivre à un dépôt accepté (revue Codex de la PR #267)", async () => {
    // `/planning` lit `motif` pour le bandeau ROUGE d'un refus de création
    // (chantier CRÉA-1). Sans ce retrait, l'URL courante gardait `motif`
    // pendant qu'un dépôt qui vient de RÉUSSIR rechargeait la page : le
    // refus d'une autre action, déjà vu, restait affiché à côté d'un succès.
    Object.defineProperty(window, "location", {
      value: {
        ...window.location,
        href: "http://localhost/planning?motif=intervention.refus.jour_ferme",
        assign: naviguer,
      },
      writable: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ accepte: true, cle: null, avertissements: [] }),
      }),
    );
    const { container } = scene();

    fireEvent.drop(laCase(container), {
      dataTransfer: dataTransferDe("int-1"),
    });

    await waitFor(() => expect(naviguer).toHaveBeenCalledTimes(1));
    const url = new URL(naviguer.mock.calls[0][0] as string);
    expect(url.searchParams.has("motif")).toBe(false);
  });
});

describe("un dépôt REFUSÉ par la règle métier", () => {
  it("nomme le motif que la route a rendu, jamais une réussite", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          accepte: false,
          cle: "intervention.refus.chevauchement",
          avertissements: null,
        }),
      }),
    );
    const { container } = scene();

    fireEvent.drop(laCase(container), {
      dataTransfer: dataTransferDe("int-1"),
    });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        fr["intervention.refus.chevauchement"],
      ),
    );
    expect(naviguer).not.toHaveBeenCalled();
  });
});

describe("une ERREUR SERVEUR — LE DÉFAUT MESURÉ, dans sa forme exacte", () => {
  it("un code HTTP d'échec n'est jamais lu comme un succès", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("pas de corps JSON");
        },
      }),
    );
    const { container } = scene();

    fireEvent.drop(laCase(container), {
      dataTransfer: dataTransferDe("int-1"),
    });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        fr["intervention.refus.erreur_serveur"],
      ),
    );
    expect(naviguer).not.toHaveBeenCalled();
  });

  it("un corps VIDE sous un 200 n'est pas davantage lu comme un succès", async () => {
    // C'est très exactement le défaut mesuré : `.json().catch(() => null)`
    // faisait tomber une réponse illisible sur la branche du succès.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("réponse non-JSON");
        },
      }),
    );
    const { container } = scene();

    fireEvent.drop(laCase(container), {
      dataTransfer: dataTransferDe("int-1"),
    });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        fr["intervention.refus.erreur_serveur"],
      ),
    );
    expect(naviguer).not.toHaveBeenCalled();
  });
});

describe("une CONNEXION INTERROMPUE — l'autre moitié du défaut mesuré", () => {
  it("un `fetch` qui rejette n'est jamais lu comme un succès", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    const { container } = scene();

    fireEvent.drop(laCase(container), {
      dataTransfer: dataTransferDe("int-1"),
    });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        fr["intervention.refus.connexion_interrompue"],
      ),
    );
    expect(naviguer).not.toHaveBeenCalled();
  });

  it("ne se confond pas avec l'erreur serveur : les deux textes diffèrent", () => {
    expect(fr["intervention.refus.connexion_interrompue"]).not.toBe(
      fr["intervention.refus.erreur_serveur"],
    );
  });
});

describe("UN GESTE RÉPÉTÉ EST BLOQUÉ PENDANT LA DEMANDE", () => {
  it("deux dépôts de la même intervention avant la réponse ne postent qu'une requête", async () => {
    let resoudre: (valeur: unknown) => void = () => {};
    const enVol = new Promise((resolve) => {
      resoudre = resolve;
    });
    const fetchSimule = vi.fn().mockReturnValue(enVol);
    vi.stubGlobal("fetch", fetchSimule);
    const { container } = scene();

    const case_ = laCase(container);
    fireEvent.drop(case_, { dataTransfer: dataTransferDe("int-1") });
    fireEvent.drop(case_, { dataTransfer: dataTransferDe("int-1") });

    // Le second geste n'a envoyé AUCUNE requête : il a été bloqué pendant que
    // la première demande volait, pas seulement ignoré après coup.
    expect(fetchSimule).toHaveBeenCalledTimes(1);

    resoudre({
      ok: true,
      json: async () => ({ accepte: true, cle: null, avertissements: null }),
    });
    await waitFor(() => expect(naviguer).toHaveBeenCalledTimes(1));

    // Et une fois la demande retombée, un troisième dépôt en poste une neuve :
    // le blocage porte sur la demande EN VOL, jamais sur l'intervention pour
    // toujours.
    fireEvent.drop(case_, { dataTransfer: dataTransferDe("int-1") });
    await waitFor(() => expect(fetchSimule).toHaveBeenCalledTimes(2));
  });
});
