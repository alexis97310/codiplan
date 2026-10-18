import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BoutonCompteurTerrain } from "@/components/terrain/compteur-terrain";
import { fr } from "@/lib/i18n";

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

function scene() {
  return render(
    <BoutonCompteurTerrain
      interventionId={INTERVENTION_ID}
      utilisateurId={UTILISATEUR_ID}
      societeId={SOCIETE_ID}
      ici={false}
      enPause={false}
      fuseau="Pacific/Noumea"
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
