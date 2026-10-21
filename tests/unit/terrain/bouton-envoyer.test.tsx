import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BoutonEnvoyer } from "@/components/terrain/bouton-envoyer";
import { fr } from "@/lib/i18n";
import {
  ajouterSaisie,
  listerFile,
  marquerRefusee,
} from "@/lib/terrain/file-saisies";

import { installerIndexedDBFactice } from "./aide-indexeddb-factice";

/**
 * LE BOUTON « ENVOYER » (9F4H3A-FILE-SANS-PERTE, point 5) — aucune épreuve
 * unitaire n'existait (relevé par 9F4H3). Le double IndexedDB est
 * nécessaire : jsdom n'implémente pas IndexedDB.
 */

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
  delete (window.navigator as { onLine?: boolean }).onLine;
});

function scene() {
  return render(
    <BoutonEnvoyer utilisateurId={UTILISATEUR_ID} societeId={SOCIETE_ID} />,
  );
}

describe("hors réseau, la file reste visible (point 5, C6)", () => {
  it("« En attente d'envoi (1) » s'affiche sans attendre le retour du réseau", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    await ajouterSaisie({
      interventionId: "11111111-1111-1111-1111-111111111111",
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
      geste: { type: "rapport", commentaire: "A", suite: "" },
    });

    scene();

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        fr["terrain.file.en_attente_envoi"],
      ),
    );
    expect(
      screen.queryByRole("button", { name: /envoyer/i }),
    ).not.toBeInTheDocument();
  });
});

describe("des saisies d'une autre identité (addendum 3, point 5, C3)", () => {
  it("affiche le message dédié, et il ne disparaît pas derrière les autres états", async () => {
    await ajouterSaisie({
      interventionId: "11111111-1111-1111-1111-111111111111",
      utilisateurId: "autre-utilisateur",
      societeId: "autre-societe",
      geste: { type: "rapport", commentaire: "A", suite: "" },
    });

    scene();

    await waitFor(() =>
      expect(screen.getByText(fr["terrain.file.autre_identite"])).toBeVisible(),
    );
  });

  it("absente quand seule l'identité courante a des saisies", async () => {
    await ajouterSaisie({
      interventionId: "11111111-1111-1111-1111-111111111111",
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
      geste: { type: "rapport", commentaire: "A", suite: "" },
    });

    scene();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /envoyer/i })).toBeVisible(),
    );
    expect(
      screen.queryByText(fr["terrain.file.autre_identite"]),
    ).not.toBeInTheDocument();
  });
});

describe("retirer une saisie refusée (point 4, décision n° 142 d'Alexis, 9F4H6C-FILE-ROBUSTESSE)", () => {
  it("une saisie REFUSÉE affiche « Retirer cette saisie » ; une saisie seulement en attente ne l'affiche pas", async () => {
    const refusee = await ajouterSaisie({
      interventionId: "11111111-1111-1111-1111-111111111111",
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
      geste: { type: "rapport", commentaire: "A", suite: "" },
    });
    await ajouterSaisie({
      interventionId: "22222222-2222-2222-2222-222222222222",
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
      geste: { type: "terminer" },
    });
    expect(refusee.gardee).toBe(true);
    if (refusee.gardee) {
      await marquerRefusee(refusee.id, "terrain.file.refus_generique");
    }

    scene();

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: fr["terrain.file.retirer_bouton"],
        }),
      ).toBeVisible(),
    );
    // UNE SEULE entrée porte un motif de refus — l'autre, « terminer »,
    // seulement en attente, n'a jamais ce bouton.
    expect(
      screen.getAllByRole("button", {
        name: fr["terrain.file.retirer_bouton"],
      }),
    ).toHaveLength(1);
  });

  it("le clic seul ne retire rien : « Revenir » garde la saisie en file", async () => {
    const refusee = await ajouterSaisie({
      interventionId: "11111111-1111-1111-1111-111111111111",
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
      geste: { type: "rapport", commentaire: "A", suite: "" },
    });
    expect(refusee.gardee).toBe(true);
    if (refusee.gardee) {
      await marquerRefusee(refusee.id, "terrain.file.refus_generique");
    }

    scene();

    fireEvent.click(
      await screen.findByRole("button", {
        name: fr["terrain.file.retirer_bouton"],
      }),
    );
    expect(
      screen.getByText(fr["terrain.file.retirer_confirmation"]),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.file.retirer_revenir"] }),
    );

    const file = await listerFile({
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
    });
    expect(file).toHaveLength(1);
    expect(
      screen.queryByText(fr["terrain.file.retirer_confirmation"]),
    ).not.toBeInTheDocument();
  });

  it("confirmer le retrait retire réellement la saisie, jamais sans ce geste explicite", async () => {
    const refusee = await ajouterSaisie({
      interventionId: "11111111-1111-1111-1111-111111111111",
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
      geste: { type: "rapport", commentaire: "A", suite: "" },
    });
    expect(refusee.gardee).toBe(true);
    if (refusee.gardee) {
      await marquerRefusee(refusee.id, "terrain.file.refus_generique");
    }

    scene();

    fireEvent.click(
      await screen.findByRole("button", {
        name: fr["terrain.file.retirer_bouton"],
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: fr["terrain.file.retirer_confirmer"],
      }),
    );

    await waitFor(async () => {
      const file = await listerFile({
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
      });
      expect(file).toHaveLength(0);
    });
    expect(
      screen.queryByText(fr["terrain.file.retirer_bouton"]),
    ).not.toBeInTheDocument();
  });
});
