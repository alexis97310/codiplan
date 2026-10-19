import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InstantaneJSON } from "@/app/api/terrain/instantane/route";
import { ConsultationHorsReseau } from "@/components/terrain/consultation-hors-reseau";
import { fr } from "@/lib/i18n";

import { installerIndexedDBFactice } from "./aide-indexeddb-factice";

/**
 * LA FICHE DE LA COQUILLE DEVIENT UNE FICHE DE TRAVAIL (point 2,
 * 9F4H4B-OUVERTURE-A-FROID) — ce fichier éprouve la COMPOSITION (les bons
 * composants reçoivent les bonnes valeurs tirées de l'instantané), pas la
 * logique de chacun : le compteur, le rapport automatique et les photos ont
 * déjà leurs propres épreuves (`compteur-terrain.test.tsx`,
 * `rapport-automatique.test.tsx`).
 */

const { FICHE_ID, INSTANTANE } = vi.hoisted(() => {
  const ficheId = "77777777-7777-7777-7777-777777777777";
  const utilisateurId = "55555555-5555-5555-5555-555555555555";
  const societeId = "66666666-6666-6666-6666-666666666666";
  const instantane: InstantaneJSON = {
    utilisateurId,
    societeId,
    genereLe: "2026-10-19T08:00:00.000Z",
    journee: {
      fuseau: "Pacific/Noumea",
      jour: { jour: 19, mois: 10, annee: 2026 },
      enRetard: [],
      aujourdhui: [],
      demain: [],
      sansDate: [],
      suite: { nombre: 0, dates: [] },
    },
    fiches: {
      [ficheId]: {
        id: ficheId,
        statut: "affectee",
        type: "curatif",
        priorite: "normale",
        client: "Atelier Ducos",
        lieu: "Atelier Ducos",
        creneauDebut: null,
        creneauFin: null,
        datePlanifiee: null,
        fuseau: "Pacific/Noumea",
        panne: null,
        machinesLibelles: [],
        contact: null,
        rapport: { commentaireTechnicien: null, suiteADonner: null },
        prestationsRealisees: [],
        photos: [],
        signatureIssue: null,
        verdictTerminer: {
          refuse: true,
          cle: "intervention.refus.pas_en_cours",
        },
        verdictDemarrer: { refuse: false },
      },
    },
  };
  return { FICHE_ID: ficheId, INSTANTANE: instantane };
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams([["id", FICHE_ID]]),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/terrain/copie-locale", () => ({
  lireCopie: vi.fn().mockResolvedValue(INSTANTANE),
}));

let restaurerIndexedDB: () => void;

afterEach(() => {
  cleanup();
  restaurerIndexedDB?.();
  vi.unstubAllGlobals();
});

describe("la fiche de la coquille affiche les mêmes gestes que la fiche en ligne", () => {
  it("compteur, rapport, prestations (catalogue indisponible), photos, signature, terminer", async () => {
    restaurerIndexedDB = installerIndexedDBFactice();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });

    render(<ConsultationHorsReseau />);

    // ── LE COMPTEUR (BoutonCompteurTerrain, réutilisé) ─────────────────────
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
      ).toBeVisible(),
    );

    // ── LE RAPPORT, LES PRESTATIONS, LES PHOTOS, LA SIGNATURE, TERMINER
    // (RapportTerrainAutomatique, réutilisé) ───────────────────────────────
    expect(
      screen.getByRole("heading", { name: fr["terrain.rapport.titre"] }),
    ).toBeVisible();
    expect(
      screen.getByText(
        fr["terrain.prestations.catalogue_indisponible_hors_reseau"],
      ),
    ).toBeVisible();
    // JAMAIS le message « catalogue vide » — ce n'est pas la même chose
    // (voir le docblock de `catalogueIndisponibleHorsReseau`).
    expect(
      screen.queryByText(fr["terrain.prestations.aucune"]),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: fr["terrain.photos.titre"] }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: fr["terrain.photos.ajouter"] }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: fr["terrain.signature.titre"] }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: fr["terrain.terminer.titre"] }),
    ).toBeVisible();

    // ── AUCUN BOUTON « ENVOYER » DANS LA COQUILLE (point 2 : pas de session) ─
    expect(
      screen.queryByRole("button", { name: fr["terrain.file.envoyer"] }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(fr["terrain.hors_reseau.saisies_gardees"]),
    ).toBeVisible();
  });
});
