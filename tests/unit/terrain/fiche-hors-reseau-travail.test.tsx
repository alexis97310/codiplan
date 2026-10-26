import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { InstantaneJSON } from "@/app/api/terrain/instantane/route";
import { ConsultationHorsReseau } from "@/components/terrain/consultation-hors-reseau";
import { fr } from "@/lib/i18n";
import { lireCopie } from "@/lib/terrain/copie-locale";

import { installerIndexedDBFactice } from "./aide-indexeddb-factice";

/**
 * LA FICHE DE LA COQUILLE DEVIENT UNE FICHE DE TRAVAIL (point 2,
 * 9F4H4B-OUVERTURE-A-FROID) — ce fichier éprouve la COMPOSITION (les bons
 * composants reçoivent les bonnes valeurs tirées de l'instantané), pas la
 * logique de chacun : le compteur, le rapport automatique et les photos ont
 * déjà leurs propres épreuves (`compteur-terrain.test.tsx`,
 * `rapport-automatique.test.tsx`).
 *
 * `INSTANTANE` n'est PAS construit dans `vi.hoisted` (9F4H6, point 3) — son
 * catalogue porte `fr["terrain.e2e.prestation_libelle"]` (L0-11 : la requête
 * d'écran du point 6 ci-dessous doit lire le MÊME dictionnaire, jamais un
 * libellé écrit en dur), et `fr` n'existe pas encore au moment où
 * `vi.hoisted` s'exécute (hissé AVANT les imports). `lireCopie` est donc
 * mockée SANS valeur ici, posée ensuite dans `beforeAll`, une fois les
 * imports réels résolus.
 */
const { FICHE_ID, PRESTATION_ID } = vi.hoisted(() => ({
  FICHE_ID: "77777777-7777-7777-7777-777777777777",
  PRESTATION_ID: "88888888-8888-8888-8888-888888888888",
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams([["id", FICHE_ID]]),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/terrain/copie-locale", () => ({
  lireCopie: vi.fn(),
}));

const UTILISATEUR_ID = "55555555-5555-5555-5555-555555555555";
const SOCIETE_ID = "66666666-6666-6666-6666-666666666666";

const INSTANTANE: InstantaneJSON = {
  utilisateurId: UTILISATEUR_ID,
  societeId: SOCIETE_ID,
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
    [FICHE_ID]: {
      id: FICHE_ID,
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
      prestationsRealiseesIds: [],
      photos: [],
      signatureIssue: null,
      verdictTerminer: {
        refuse: true,
        cle: "intervention.refus.pas_en_cours",
      },
      verdictDemarrer: { refuse: false },
    },
  },
  catalogue: [
    {
      id: PRESTATION_ID,
      code: "VID",
      libelle: fr["terrain.e2e.prestation_libelle"],
    },
  ],
};

beforeAll(() => {
  vi.mocked(lireCopie).mockResolvedValue(INSTANTANE);
});

let restaurerIndexedDB: () => void;

afterEach(() => {
  cleanup();
  restaurerIndexedDB?.();
  vi.unstubAllGlobals();
});

describe("la fiche de la coquille affiche les mêmes gestes que la fiche en ligne", () => {
  it("compteur, rapport, prestations (catalogue emporté par l'instantané, 9F4H6), photos, signature, terminer", async () => {
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
    // LE CATALOGUE EST COCHABLE (9F4H6, point 3) — jamais plus « indisponible ».
    expect(
      screen.queryByText(
        fr["terrain.prestations.catalogue_indisponible_hors_reseau"],
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(fr["terrain.prestations.aucune"]),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: fr["terrain.e2e.prestation_libelle"],
      }),
    ).not.toBeChecked();
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

    // ── « REVENIR À MA JOURNÉE » (point 3) — EN LIGNE, visible ──────────────
    await waitFor(() =>
      expect(
        screen.getByRole("link", {
          name: fr["terrain.hors_reseau.revenir_a_ma_journee"],
        }),
      ).toBeVisible(),
    );
  });
});

describe("« Revenir à ma journée » (point 3) — réagit au réseau", () => {
  it("absent hors réseau, apparaît à l'événement online, disparaît à offline", async () => {
    restaurerIndexedDB = installerIndexedDBFactice();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    render(<ConsultationHorsReseau />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
      ).toBeVisible(),
    );
    expect(
      screen.queryByRole("link", {
        name: fr["terrain.hors_reseau.revenir_a_ma_journee"],
      }),
    ).not.toBeInTheDocument();

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    window.dispatchEvent(new Event("online"));
    await waitFor(() =>
      expect(
        screen.getByRole("link", {
          name: fr["terrain.hors_reseau.revenir_a_ma_journee"],
        }),
      ).toBeVisible(),
    );

    window.dispatchEvent(new Event("offline"));
    await waitFor(() =>
      expect(
        screen.queryByRole("link", {
          name: fr["terrain.hors_reseau.revenir_a_ma_journee"],
        }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("une copie ÉCRITE AVANT 9F4H6 (9F4H6A-COQUILLE-ANCIENNE-COPIE, point 1)", () => {
  it("ni `catalogue` ni `prestationsRealiseesIds` : pas d'erreur, compteur et rapport utilisables, prestations non cochables", async () => {
    restaurerIndexedDB = installerIndexedDBFactice();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    // LA FORME EXACTE QU'IndexedDB RENDAIT AVANT 9F4H6 (mesurée sur 8b4512d1)
    // — `catalogue` (sur l'instantané) et `prestationsRealiseesIds` (sur la
    // fiche) n'existaient pas encore. `lireCopie` les rend TELS QUELS (voir
    // son en-tête) ; c'est très exactement ce qu'un appareil jamais
    // rafraîchi depuis sert à la coquille.
    const sansCatalogue: Record<string, unknown> = { ...INSTANTANE };
    delete sansCatalogue.catalogue;
    const ficheSansIds: Record<string, unknown> = {
      ...INSTANTANE.fiches[FICHE_ID],
    };
    delete ficheSansIds.prestationsRealiseesIds;
    const copieAncienne = {
      ...sansCatalogue,
      fiches: { [FICHE_ID]: ficheSansIds },
    } as unknown as InstantaneJSON;
    vi.mocked(lireCopie).mockResolvedValueOnce(copieAncienne);

    render(<ConsultationHorsReseau />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
      ).toBeVisible(),
    );
    expect(
      screen.getByRole("heading", { name: fr["terrain.rapport.titre"] }),
    ).toBeVisible();
    // LA MÊME ABSENCE, LE MÊME MESSAGE QUE « CATALOGUE JAMAIS EMPORTÉ »
    // (9F4H4B) — voir l'en-tête de `lib/terrain/copie-validee.ts`.
    expect(
      screen.getByText(
        fr["terrain.prestations.catalogue_indisponible_hors_reseau"],
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("checkbox", {
        name: fr["terrain.e2e.prestation_libelle"],
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: fr["terrain.signature.titre"] }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: fr["terrain.terminer.titre"] }),
    ).toBeVisible();
  });
});

describe("aucune copie du tout — le lien de retour apparaît quand le réseau revient (point 6, 9G5-TERRAIN-ERGONOMIE)", () => {
  it("un texte seul hors réseau, rejoint par le lien dès que le réseau revient", async () => {
    restaurerIndexedDB = installerIndexedDBFactice();
    vi.mocked(lireCopie).mockResolvedValueOnce(null);
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    render(<ConsultationHorsReseau />);

    await waitFor(() =>
      expect(
        screen.getByText(fr["terrain.hors_reseau.aucune_copie"]),
      ).toBeVisible(),
    );
    expect(
      screen.queryByRole("link", {
        name: fr["terrain.hors_reseau.revenir_a_ma_journee"],
      }),
    ).not.toBeInTheDocument();

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    window.dispatchEvent(new Event("online"));

    await waitFor(() =>
      expect(
        screen.getByRole("link", {
          name: fr["terrain.hors_reseau.revenir_a_ma_journee"],
        }),
      ).toBeVisible(),
    );
  });
});
