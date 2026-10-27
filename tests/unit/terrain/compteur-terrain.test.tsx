import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BoutonCompteurTerrain } from "@/components/terrain/compteur-terrain";
import { fr } from "@/lib/i18n";
import type { StatutIntervention } from "@/lib/interventions/saisie";
import {
  ajouterSaisie,
  EVENEMENT_COMPTEUR_DEMARRE_EN_LIGNE,
  EVENEMENT_FILE_MODIFIEE,
  listerFilePourIntervention,
} from "@/lib/terrain/file-saisies";

import { installerIndexedDBFactice } from "./aide-indexeddb-factice";

/**
 * LE BOUTON DU COMPTEUR, HORS RÉSEAU (9F4H3A-FILE-SANS-PERTE, points 2 et 3)
 * — `fetch` est un mock, aucune route réelle n'est jointe. Le double
 * IndexedDB est nécessaire pour les deux scénarios (gardé / non gardé) :
 * jsdom n'implémente pas IndexedDB (voir `copie-locale.test.ts`).
 */

const INTERVENTION_ID = "33333333-3333-3333-3333-333333333333";
const UTILISATEUR_ID = "55555555-5555-5555-5555-555555555555";
const SOCIETE_ID = "66666666-6666-6666-6666-666666666666";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

let restaurerIndexedDB: () => void;

beforeEach(() => {
  restaurerIndexedDB = installerIndexedDBFactice();
});

afterEach(() => {
  restaurerIndexedDB();
  vi.unstubAllGlobals();
});

function scene({
  sansSession = false,
  instantServeur = null,
  statut = "affectee",
  ici = false,
}: {
  readonly sansSession?: boolean;
  readonly instantServeur?: Date | null;
  readonly statut?: StatutIntervention;
  readonly ici?: boolean;
} = {}) {
  return render(
    <BoutonCompteurTerrain
      interventionId={INTERVENTION_ID}
      utilisateurId={UTILISATEUR_ID}
      societeId={SOCIETE_ID}
      statut={statut}
      ici={ici}
      enPause={false}
      fuseau="Pacific/Noumea"
      sansSession={sansSession}
      instantServeur={instantServeur}
    />,
  );
}

describe("hors réseau — la saisie est gardée (point 1/3)", () => {
  it("un clic sans réseau garde « démarrer » et l'affiche", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("réseau indisponible"))),
    );

    scene();
    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        fr["terrain.compteur.hors_reseau_depuis"],
      ),
    );
  });
});

describe("un identifiant dès le premier essai (point 3, C7)", () => {
  it("le premier essai EN LIGNE porte operation_id ET instant_appareil, et la file garde le MÊME identifiant", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("réseau indisponible"));
    vi.stubGlobal("fetch", fetchMock);

    scene();
    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const corps = options.body as FormData;
    const idPremierEssai = corps.get("operation_id");
    expect(typeof idPremierEssai).toBe("string");
    expect(corps.get("instant_appareil")).not.toBeNull();

    const file = await listerFilePourIntervention(INTERVENTION_ID, {
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
    });
    expect(file).toHaveLength(1);
    expect(file[0].id).toBe(idPremierEssai);
  });
});

describe("un refus serveur EN LIGNE s'affiche, en clair (point 5, C6)", () => {
  it("un compteur déjà ouvert ailleurs montre le motif, jamais un silence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            ok: false,
            motif: "compteur.refus.deja_en_cours",
          }),
      }),
    );

    scene();
    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(fr["compteur.refus.deja_en_cours"]),
      ).toBeVisible(),
    );
  });
});

describe("une réponse non JSON (500, page d'erreur) n'est jamais une coupure (point 8, 9G5-TERRAIN-ERGONOMIE)", () => {
  it("affiche un refus, jamais une mise en file silencieuse", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 500,
        json: () => Promise.reject(new Error("réponse non JSON")),
      }),
    );

    scene();
    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(fr["terrain.compteur.reponse_invalide"]),
      ).toBeVisible(),
    );
    const file = await listerFilePourIntervention(INTERVENTION_ID, {
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
    });
    expect(file).toHaveLength(0);
  });
});

describe("une réponse illisible n'est reconnue comme venant de l'application qu'au statut 500 — le reste repart en file, comme une coupure (point 2, 9H4-FINITIONS-AVANT-AUDIT)", () => {
  it("500 applicatif : un refus s'affiche, rien n'est mis en file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 500,
        json: () => Promise.reject(new Error("page d'erreur, pas du JSON")),
      }),
    );

    scene();
    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(fr["terrain.compteur.reponse_invalide"]),
      ).toBeVisible(),
    );
    const file = await listerFilePourIntervention(INTERVENTION_ID, {
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
    });
    expect(file).toHaveLength(0);
  });

  it("502 d'une passerelle (page HTML, jamais posé par cette route) : le geste repart en file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 502,
        json: () => Promise.reject(new Error("<html>Bad Gateway</html>")),
      }),
    );

    scene();
    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        fr["terrain.compteur.hors_reseau_depuis"],
      ),
    );
    const file = await listerFilePourIntervention(INTERVENTION_ID, {
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
    });
    expect(file).toHaveLength(1);
  });

  it("corps coupé en cours de transfert (statut 200, lecture interrompue) : le geste repart en file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.reject(new Error("corps interrompu")),
      }),
    );

    scene();
    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        fr["terrain.compteur.hors_reseau_depuis"],
      ),
    );
    const file = await listerFilePourIntervention(INTERVENTION_ID, {
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
    });
    expect(file).toHaveLength(1);
  });
});

describe("dans la coquille, un refus d'authentification est gardé comme une coupure réseau (point 2, 9F4H4D)", () => {
  it("sansSession : « auth.refus » est mis en file, jamais affiché comme un refus", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ ok: false, motif: "auth.refus" }),
      }),
    );

    scene({ sansSession: true });
    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        fr["terrain.compteur.hors_reseau_depuis"],
      ),
    );
    const file = await listerFilePourIntervention(INTERVENTION_ID, {
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
    });
    expect(file).toHaveLength(1);
  });

  it("sans sansSession (page /terrain normale) : le même « auth.refus » reste un refus affiché, rien n'est mis en file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ ok: false, motif: "auth.refus" }),
      }),
    );

    scene();
    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    );

    await waitFor(() =>
      expect(screen.getByText(fr["auth.refus"])).toBeVisible(),
    );
    const file = await listerFilePourIntervention(INTERVENTION_ID, {
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
    });
    expect(file).toHaveLength(0);
  });
});

describe("l'heure envoyée est calée sur le serveur quand l'écart dépasse une minute (9F4H5A-HEURE-CALEE-SERVEUR, D132)", () => {
  it("téléphone 10 min en avance, EN LIGNE : l'instant envoyé est proche de MAINTENANT, jamais +10 min dans le futur", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("réseau indisponible"));
    vi.stubGlobal("fetch", fetchMock);
    // Même fait que `lib/terrain/compteur-vivant.ts` : l'écart se mesure
    // entre l'heure SERVEUR passée en prop et l'horloge de CET appareil —
    // ici l'horloge réelle du test, sans horloge factice.
    const instantServeur = new Date(Date.now() - 10 * 60_000);

    scene({ instantServeur });
    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const corps = options.body as FormData;
    const instantEnvoye = new Date(corps.get("instant_appareil") as string);

    // Calé sur `instantServeur` (ce que le serveur a rendu), à quelques
    // secondes près (temps du rendu au clic) — jamais sur l'horloge du
    // téléphone, qui elle est 10 min DEVANT.
    expect(
      Math.abs(instantEnvoye.getTime() - instantServeur.getTime()),
    ).toBeLessThan(5_000);
    expect(Date.now() - instantEnvoye.getTime()).toBeGreaterThan(9 * 60_000);

    // FIXÉE UNE FOIS, RÉUTILISÉE TELLE QUELLE PAR LA FILE (même valeur que
    // celle envoyée, jamais une seconde lecture de l'horloge au moment où
    // le geste est gardé après l'échec réseau).
    const file = await listerFilePourIntervention(INTERVENTION_ID, {
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
    });
    expect(file).toHaveLength(1);
    expect(file[0].instantAppareil).toBe(corps.get("instant_appareil"));
  });

  it("aucune heure serveur connue (coquille /terrain-hors-reseau) : l'instant envoyé est celui du téléphone, inchangé", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("réseau indisponible"));
    vi.stubGlobal("fetch", fetchMock);

    scene({ sansSession: true, instantServeur: null });
    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const corps = options.body as FormData;
    const instantEnvoye = new Date(corps.get("instant_appareil") as string);

    expect(Math.abs(instantEnvoye.getTime() - Date.now())).toBeLessThan(5_000);
  });
});

describe("relu à chaque modification de la file (point 5, C6)", () => {
  it("une entrée ajoutée par ailleurs (ex. « Envoyer ») met le bouton à jour sans rechargement", async () => {
    scene();
    expect(
      screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    ).toBeInTheDocument();

    await ajouterSaisie({
      interventionId: INTERVENTION_ID,
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
      geste: { type: "compteur", action: "demarrer" },
    });
    window.dispatchEvent(new Event(EVENEMENT_FILE_MODIFIEE));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: fr["terrain.compteur.pause"] }),
      ).toBeInTheDocument(),
    );
  });
});

describe("jamais « gardé » sans preuve, quand IndexedDB échoue (point 2)", () => {
  it("affiche l'échec, jamais l'heure hors réseau", async () => {
    restaurerIndexedDB();
    restaurerIndexedDB = installerIndexedDBFactice({ enPanne: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("réseau indisponible"))),
    );

    scene();
    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    );

    await waitFor(() =>
      expect(screen.getByText(fr["terrain.file.echec_gardee"])).toBeVisible(),
    );
    expect(screen.queryByRole("status")).toHaveTextContent(
      fr["terrain.file.echec_gardee"],
    );
  });
});

describe("rouvrir une intervention « terminée » pose la question (D220, décision d'Alexis du 21/10/2026)", () => {
  it("statut « terminee » : un clic sur « Démarrer » pose la question, sans appeler le serveur", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    scene({ statut: "terminee" });
    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    );

    expect(
      screen.getByText(fr["terrain.compteur.reouverture.titre"]),
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("« Non » referme la question sans rien changer", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    scene({ statut: "terminee" });
    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: fr["terrain.compteur.reouverture.non"],
      }),
    );

    expect(
      screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("« Oui, rouvrir » appelle le serveur et signale le démarrage EN LIGNE, pour que « Terminer » apparaisse sans rechargement", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ ok: true, motif: null }),
      }),
    );
    const surSignal = vi.fn();
    window.addEventListener(EVENEMENT_COMPTEUR_DEMARRE_EN_LIGNE, surSignal);

    try {
      scene({ statut: "terminee" });
      fireEvent.click(
        screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: fr["terrain.compteur.reouverture.oui"],
        }),
      );

      await waitFor(() => expect(surSignal).toHaveBeenCalledTimes(1));
      expect(
        (surSignal.mock.calls[0][0] as CustomEvent<{ interventionId: string }>)
          .detail.interventionId,
      ).toBe(INTERVENTION_ID);
    } finally {
      window.removeEventListener(
        EVENEMENT_COMPTEUR_DEMARRE_EN_LIGNE,
        surSignal,
      );
    }
  });

  it("statut autre que « terminee » : « Démarrer » appelle le serveur directement, sans question", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ ok: true, motif: null }),
      }),
    );

    scene({ statut: "affectee" });
    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    );

    expect(
      screen.queryByText(fr["terrain.compteur.reouverture.titre"]),
    ).toBeNull();
    expect(fetch).toHaveBeenCalled();
  });
});
