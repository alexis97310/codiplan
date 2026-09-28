import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BlocPosable,
  CasePosable,
  DELAI_DEPLACEMENT_DIFFERE_MS,
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

const SURVOL_NEUTRE = { bloquee: false, ouverte: true, ferie: false };

const CIBLE: CibleDeDepot = {
  jour: "2026-09-16",
  technicienId: "tech-1",
  minutes: null,
  pasMinutes: 30,
  survol: SURVOL_NEUTRE,
};

/** Le corps porté par un glissé, tel que `lireLaMain` sait le lire. */
function dataTransferDe(
  interventionId: string,
  dureeMin: number | null = 60,
): DataTransfer {
  const charge = JSON.stringify({ id: interventionId, dureeMin });
  return {
    getData: (format: string) =>
      format === "application/x-codiplan-intervention" ? charge : "",
    // `setData` : requis par `BlocPosable.engager` à `dragstart` (PG-B4, la
    // carte survolée s'y engage aussi) — jamais lu par le survol lui-même,
    // qui passe par `Depot.carteEnGlisse`, pas par `dataTransfer`.
    setData: () => {},
  } as unknown as DataTransfer;
}

/** Une case d'HEURE, vue Jour — `minutes` n'y est jamais `null`. */
const CIBLE_JOUR: CibleDeDepot = {
  jour: "2026-09-16",
  technicienId: "tech-1",
  minutes: 480,
  pasMinutes: 30,
  survol: SURVOL_NEUTRE,
};

function sceneJour() {
  return render(
    <Posable techniciens={[]} aujourdhui="2026-09-16">
      <table>
        <tbody>
          <tr>
            <td>
              <BlocPosable interventionId="int-1" dureeMin={null}>
                <span aria-hidden />
              </BlocPosable>
            </td>
            <CasePosable cible={CIBLE_JOUR}>
              <span aria-hidden />
            </CasePosable>
          </tr>
        </tbody>
      </table>
    </Posable>,
  );
}

/** La case d'heure, seule dans `sceneJour`. */
function laCaseDHeure(container: HTMLElement): Element {
  const element = container.querySelector(
    '[data-depot-heure="480"][data-depot-technicien="tech-1"]',
  );
  if (element === null) {
    throw new Error("la case d'heure n'a pas été rendue");
  }
  return element;
}

function scene() {
  return render(
    <Posable techniciens={[]} aujourdhui="2026-09-16">
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
  vi.useRealTimers();
});

/**
 * UN DÉPLACEMENT DIRECT D'UNE CARTE DÉJÀ PLANIFIÉE N'ÉCRIT PLUS TOUT DE SUITE
 * (PG-B5-ANNULER-DEPLACEMENT) : `agir` (le `fireEvent.drop`) pose une
 * minuterie fausse, avancée ici d'EXACTEMENT `DELAI_DEPLACEMENT_DIFFERE_MS` —
 * jamais une valeur recopiée, voir l'entête de la constante. Les minuteries
 * RÉELLES sont restaurées ensuite, pour que `waitFor` (qui interroge le DOM
 * par ses propres `setTimeout`) continue de fonctionner normalement dans le
 * reste du scénario.
 */
async function deposerEtAttendreLEcriture(agir: () => void): Promise<void> {
  vi.useFakeTimers();
  agir();
  await vi.advanceTimersByTimeAsync(DELAI_DEPLACEMENT_DIFFERE_MS);
  vi.useRealTimers();
}

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

    await deposerEtAttendreLEcriture(() =>
      fireEvent.drop(laCase(container), {
        dataTransfer: dataTransferDe("int-1"),
      }),
    );

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

    await deposerEtAttendreLEcriture(() =>
      fireEvent.drop(laCase(container), {
        dataTransfer: dataTransferDe("int-1"),
      }),
    );

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

    await deposerEtAttendreLEcriture(() =>
      fireEvent.drop(laCase(container), {
        dataTransfer: dataTransferDe("int-1"),
      }),
    );

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

    await deposerEtAttendreLEcriture(() =>
      fireEvent.drop(laCase(container), {
        dataTransfer: dataTransferDe("int-1"),
      }),
    );

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

    await deposerEtAttendreLEcriture(() =>
      fireEvent.drop(laCase(container), {
        dataTransfer: dataTransferDe("int-1"),
      }),
    );

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

    await deposerEtAttendreLEcriture(() =>
      fireEvent.drop(laCase(container), {
        dataTransfer: dataTransferDe("int-1"),
      }),
    );

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

    await deposerEtAttendreLEcriture(() =>
      fireEvent.drop(laCase(container), {
        dataTransfer: dataTransferDe("int-1"),
      }),
    );

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

describe("UN GESTE RÉPÉTÉ REMPLACE LE PRÉCÉDENT, IL NE L'EMPILE JAMAIS (PG-B5-ANNULER-DEPLACEMENT)", () => {
  it("deux dépôts de la même intervention avant l'échéance ne postent qu'une requête, à l'échéance du SECOND", async () => {
    // *Avant PG-B5* : un dépôt direct écrivait tout de suite, et `enVol`
    // (`Posable`) empêchait deux requêtes CONCURRENTES pour le même `id`.
    // *Depuis PG-B5* : un dépôt direct n'écrit plus tout de suite — un second
    // dépôt avant l'échéance du premier REMPLACE sa minuterie plutôt que
    // d'en empiler une seconde (voir `deposer`, `components/planning/pose.tsx`).
    const fetchSimule = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accepte: true, cle: null, avertissements: null }),
    });
    vi.stubGlobal("fetch", fetchSimule);
    vi.useFakeTimers();
    const { container } = scene();

    const case_ = laCase(container);
    fireEvent.drop(case_, { dataTransfer: dataTransferDe("int-1") });
    // Juste avant l'échéance du PREMIER dépôt, un second REMPLACE le sien.
    await vi.advanceTimersByTimeAsync(DELAI_DEPLACEMENT_DIFFERE_MS - 1);
    fireEvent.drop(case_, { dataTransfer: dataTransferDe("int-1") });

    // À l'échéance du PREMIER délai (déjà annulé), rien n'est encore parti.
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchSimule).not.toHaveBeenCalled();

    // À l'échéance du SECOND, une SEULE requête part — jamais deux.
    await vi.advanceTimersByTimeAsync(DELAI_DEPLACEMENT_DIFFERE_MS - 1);
    expect(fetchSimule).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
    await waitFor(() => expect(naviguer).toHaveBeenCalledTimes(1));
  });
});

describe("UNE CARTE SANS DURÉE CONNUE, DÉPOSÉE SUR UNE HEURE (PG-A3a, bug 2 de l'audit du 27/09/2026)", () => {
  it("ne poste jamais `duree_min=0` — le champ est ABSENT, jamais un zéro inventé", async () => {
    // *Le défaut mesuré sur `main` avant ce ticket* : `dureeDe` (page du
    // planning) rendait `?? 0` pour une intervention sans créneau ni durée
    // estimée, et ce zéro voyageait jusqu'à la route comme un `duree_min`
    // INVALIDE — Zod le refuse (`positive()`), et le message affiché était
    // « tirez la poignée », qui ne s'applique qu'au redimensionnement.
    const fetchSimule = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accepte: true, cle: null, avertissements: null }),
    });
    vi.stubGlobal("fetch", fetchSimule);
    const { container } = sceneJour();

    await deposerEtAttendreLEcriture(() =>
      fireEvent.drop(laCaseDHeure(container), {
        dataTransfer: dataTransferDe("int-1", null),
      }),
    );

    await waitFor(() => expect(fetchSimule).toHaveBeenCalledTimes(1));
    const corps = fetchSimule.mock.calls[0]?.[1]?.body as FormData;
    expect(corps.get("heure_debut")).toBe("480");
    expect(corps.has("duree_min")).toBe(false);
  });
});

/** Le corps porté par une carte de la file « À planifier » (PG-B2). */
function dataTransferDeFile(interventionId: string): DataTransfer {
  const charge = JSON.stringify({
    id: interventionId,
    dureeMin: 60,
    depuisFile: true,
    libelle: "Client Témoin · Panne · Urgent",
    fuseau: "Pacific/Noumea",
  });
  return {
    getData: (format: string) =>
      format === "application/x-codiplan-intervention" ? charge : "",
  } as DataTransfer;
}

describe("UNE CARTE DE LA FILE, DÉPOSÉE (PG-B2-FENETRE-POSE)", () => {
  it("n'écrit rien avant « Planifier » : elle ouvre `FenetrePose`, pré-remplie du jour et du technicien de la case", async () => {
    // `FenetrePose` LIT `verdict-pose` (PG-B1) dès l'ouverture — ce que le
    // ticket interdit, c'est une ÉCRITURE (`.../deplacer`) avant le clic.
    const fetchSimule = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ creneaux: [], verdicts: [] }),
    });
    vi.stubGlobal("fetch", fetchSimule);
    const { container } = scene();

    fireEvent.drop(laCase(container), {
      dataTransfer: dataTransferDeFile("int-1"),
    });

    const fenetre = container.ownerDocument.querySelector(
      '[data-fenetre-pose="int-1"]',
    );
    expect(fenetre).not.toBeNull();
    expect(fenetre?.getAttribute("data-jour")).toBe(CIBLE.jour);
    expect(fenetre?.getAttribute("data-technicien")).toBe(CIBLE.technicienId);

    await waitFor(() => expect(fetchSimule).toHaveBeenCalled());
    const urlsAppelees = fetchSimule.mock.calls.map((appel) =>
      String(appel[0]),
    );
    expect(urlsAppelees.every((url) => url.includes("verdict-pose"))).toBe(
      true,
    );
    expect(urlsAppelees.some((url) => url.includes("/deplacer"))).toBe(false);
  });

  it("garde le déplacement DIRECT pour une carte déjà planifiée (PG-A7, inchangé)", async () => {
    const fetchSimule = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accepte: true, cle: null, avertissements: null }),
    });
    vi.stubGlobal("fetch", fetchSimule);
    const { container } = scene();

    await deposerEtAttendreLEcriture(() =>
      fireEvent.drop(laCase(container), {
        dataTransfer: dataTransferDe("int-1"),
      }),
    );

    await waitFor(() => expect(fetchSimule).toHaveBeenCalledTimes(1));
    expect(
      container.ownerDocument.querySelector("[data-fenetre-pose]"),
    ).toBeNull();
  });
});

describe("LE SURVOL D'UNE CASE PENDANT LE GLISSÉ (PG-B4-SURVOL-CASES)", () => {
  const CIBLE_BLOQUEE: CibleDeDepot = {
    ...CIBLE,
    survol: { bloquee: true, ouverte: true, ferie: false },
  };
  const CIBLE_OUVERTE: CibleDeDepot = {
    ...CIBLE,
    survol: { bloquee: false, ouverte: true, ferie: false },
  };

  function sceneSurvol(cible: CibleDeDepot) {
    return render(
      <Posable techniciens={[]} aujourdhui="2026-09-16">
        <table>
          <tbody>
            <tr>
              <td>
                <BlocPosable interventionId="int-1" dureeMin={60}>
                  <span aria-hidden />
                </BlocPosable>
              </td>
              <CasePosable cible={cible}>
                <span aria-hidden />
              </CasePosable>
            </tr>
          </tbody>
        </table>
      </Posable>,
    );
  }

  it("annonce « Absent » et marque la case, survolée pendant un glissé, sur une case bloquée", () => {
    const { container } = sceneSurvol(CIBLE_BLOQUEE);
    const source = container.querySelector('[data-bloc="int-1"]');
    const case_ = laCase(container);
    if (source === null) throw new Error("le bloc n'a pas été rendu");

    fireEvent.dragStart(source, { dataTransfer: dataTransferDe("int-1") });
    fireEvent.dragOver(case_, { dataTransfer: dataTransferDe("int-1") });

    expect(case_.getAttribute("data-survol")).toBe("absent");
    // « Absent » apparaît DEUX FOIS : le motif visible sur la case, et
    // l'unique région `aria-live` de `Posable` — jamais l'annoncer une
    // seule fois priverait l'un des deux publics (voir/entendre).
    expect(screen.getAllByText(fr["planning.survol.absent"])).toHaveLength(2);
  });

  it("ne marque RIEN sur une case ouverte et libre", () => {
    const { container } = sceneSurvol(CIBLE_OUVERTE);
    const source = container.querySelector('[data-bloc="int-1"]');
    const case_ = laCase(container);
    if (source === null) throw new Error("le bloc n'a pas été rendu");

    fireEvent.dragStart(source, { dataTransfer: dataTransferDe("int-1") });
    fireEvent.dragOver(case_, { dataTransfer: dataTransferDe("int-1") });

    expect(case_.getAttribute("data-survol")).toBe("possible");
    expect(screen.queryByText(fr["planning.survol.absent"])).toBeNull();
  });

  it("efface la marque et l'annonce au départ du survol (`dragleave`)", () => {
    const { container } = sceneSurvol(CIBLE_BLOQUEE);
    const source = container.querySelector('[data-bloc="int-1"]');
    const case_ = laCase(container);
    if (source === null) throw new Error("le bloc n'a pas été rendu");

    fireEvent.dragStart(source, { dataTransfer: dataTransferDe("int-1") });
    fireEvent.dragOver(case_, { dataTransfer: dataTransferDe("int-1") });
    expect(case_.getAttribute("data-survol")).toBe("absent");

    fireEvent.dragLeave(case_);
    expect(case_.getAttribute("data-survol")).toBeNull();
    expect(screen.queryByText(fr["planning.survol.absent"])).toBeNull();
  });

  it("aucun indice tant qu'aucun glissé n'est en cours (pas de `dragstart` observé)", () => {
    const { container } = sceneSurvol(CIBLE_BLOQUEE);
    const case_ = laCase(container);
    fireEvent.dragOver(case_, { dataTransfer: dataTransferDe("int-1") });
    expect(case_.getAttribute("data-survol")).toBeNull();
  });
});
