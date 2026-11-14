import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ChecklistTerrain,
  type PointChecklistEcran,
} from "@/components/terrain/checklist-terrain";
import { fr } from "@/lib/i18n";

import { installerIndexedDBFactice } from "./aide-indexeddb-factice";

// LE DÉTAIL NON CONFORME (9L04I) MONTE `PhotosTerrain`, QUI APPELLE
// `useRouter()` (`router.refresh()` après un envoi) — hors d'un routeur Next
// monté, ce qui n'est jamais le cas sous Vitest/jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

/**
 * LA FICHE TERRAIN « ÉPURÉE » (9L04D-TERRAIN-CHECKLIST-EPUREE) — aucune
 * épreuve unitaire n'existait pour `ChecklistTerrain` (relevé pendant ce
 * lot, voir la passation) : toute sa couverture passait par l'e2e. Le
 * double IndexedDB est nécessaire, même raison que `bouton-envoyer.test.tsx`.
 */

const INTERVENTION_ID = "11111111-1111-1111-1111-111111111111";
const UTILISATEUR_ID = "55555555-5555-5555-5555-555555555555";
const SOCIETE_ID = "66666666-6666-6666-6666-666666666666";

let restaurerIndexedDB: () => void;

beforeEach(() => {
  restaurerIndexedDB = installerIndexedDBFactice();
});

afterEach(() => {
  restaurerIndexedDB();
});

function point(
  partiel: Partial<PointChecklistEcran> & { readonly id: string },
): PointChecklistEcran {
  return {
    section: "Sécurité",
    libelle: "Freins",
    consigne: null,
    obligatoire: false,
    typeReponse: "conforme_non_conforme_sans_objet",
    unite: null,
    choix: [],
    valeurInitiale: null,
    ...partiel,
  };
}

function ligneDuPoint(id: string): HTMLElement {
  const ligne = document.getElementById(`checklist-point-${id}`);
  if (ligne === null) {
    throw new Error(`ligne introuvable pour le point ${id}`);
  }
  return ligne;
}

function scene(points: readonly PointChecklistEcran[]) {
  return render(
    <ChecklistTerrain
      interventionId={INTERVENTION_ID}
      utilisateurId={UTILISATEUR_ID}
      societeId={SOCIETE_ID}
      checklistModeleLibelle="Modèle de test"
      points={points}
    />,
  );
}

describe("les pastilles conforme/non-conforme/sans-objet (point 3, 9L04D)", () => {
  it("un appui répond, l'avancement passe de 0 à 1", async () => {
    scene([point({ id: "p1" })]);

    const avancement = screen.getByRole("status").textContent?.trim();
    expect(avancement).toBe(
      `${fr["checklist.terrain.provenance_prefixe"]}${fr["ponctuation.point_median"]}0 ${fr["checklist.terrain.sur"]} 1`,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: fr["checklist.terrain.option_conforme"],
      }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status").textContent?.trim()).toBe(
        `${fr["checklist.terrain.provenance_prefixe"]}${fr["ponctuation.point_median"]}1 ${fr["checklist.terrain.sur"]} 1`,
      ),
    );
  });

  it("un SECOND appui sur la pastille déjà choisie RETIRE la réponse (point 3)", async () => {
    // Un second point garde la rubrique ouverte (point 4) — sans lui, le
    // premier appui la replierait (section complète), retirant la pastille
    // du document avant le second appui.
    scene([point({ id: "p1" }), point({ id: "p2", libelle: "Autre point" })]);

    const boutonConforme = within(ligneDuPoint("p1")).getByRole("button", {
      name: fr["checklist.terrain.option_conforme"],
    });
    fireEvent.click(boutonConforme);
    await waitFor(() =>
      expect(boutonConforme).toHaveAttribute("aria-pressed", "true"),
    );

    fireEvent.click(boutonConforme);
    await waitFor(() =>
      expect(boutonConforme).toHaveAttribute("aria-pressed", "false"),
    );
    expect(screen.getByRole("status").textContent?.trim()).toBe(
      `${fr["checklist.terrain.provenance_prefixe"]}${fr["ponctuation.point_median"]}0 ${fr["checklist.terrain.sur"]} 2`,
    );
  });
});

describe("l'« Obligatoire » ne s'affiche que tant que le point n'est pas répondu (point 3)", () => {
  it("disparaît une fois répondu, revient après un retrait", async () => {
    // Un second point garde la rubrique ouverte (point 4), même raison.
    scene([
      point({ id: "p1", obligatoire: true }),
      point({ id: "p2", libelle: "Autre point" }),
    ]);

    expect(
      screen.getByText(fr["checklist.parametrage.point_obligatoire"]),
    ).toBeVisible();

    const boutonConforme = within(ligneDuPoint("p1")).getByRole("button", {
      name: fr["checklist.terrain.option_conforme"],
    });
    fireEvent.click(boutonConforme);
    await waitFor(() =>
      expect(
        screen.queryByText(fr["checklist.parametrage.point_obligatoire"]),
      ).not.toBeInTheDocument(),
    );

    fireEvent.click(boutonConforme);
    await waitFor(() =>
      expect(
        screen.getByText(fr["checklist.parametrage.point_obligatoire"]),
      ).toBeVisible(),
    );
  });
});

describe("une rubrique complète se replie d'elle-même (point 4, 9L04D)", () => {
  it("les deux points de la rubrique répondus : elle se replie, le point n'est plus visible", async () => {
    // L'EXISTENCE EST LUE PAR `id`, JAMAIS PAR LE TEXTE DU LIBELLÉ — le
    // gardien L0-11 instrumente `getByText`, et un libellé de point est une
    // valeur de fixture, pas une clé du dictionnaire.
    scene([point({ id: "p1" }), point({ id: "p2" })]);

    expect(document.getElementById("checklist-point-p1")).not.toBeNull();
    expect(document.getElementById("checklist-point-p2")).not.toBeNull();

    fireEvent.click(
      within(ligneDuPoint("p1")).getByRole("button", {
        name: fr["checklist.terrain.option_conforme"],
      }),
    );
    fireEvent.click(
      within(ligneDuPoint("p2")).getByRole("button", {
        name: fr["checklist.terrain.option_conforme"],
      }),
    );

    await waitFor(() =>
      expect(document.getElementById("checklist-point-p1")).toBeNull(),
    );
    expect(document.getElementById("checklist-point-p2")).toBeNull();

    // LA RUBRIQUE RESTE UN VRAI BOUTON (aria-expanded) — la rouvrir affiche
    // à nouveau ses points. Trouvé par son ÉTAT (`expanded: false`), jamais
    // par son nom (le libellé de section est une valeur de fixture).
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(document.getElementById("checklist-point-p1")).not.toBeNull();
  });
});

describe("la case « fait » — une coche ronde, jamais la case native (point 3, 9L04D)", () => {
  it("un appui la coche, un second la retire", async () => {
    // UN SECOND POINT, JAMAIS RÉPONDU — garde la rubrique OUVERTE (point 4) :
    // sans lui, répondre à l'unique point du groupe le replierait aussitôt
    // (rubrique complète), retirant le bouton coché du document avant que
    // l'épreuve ne puisse le relire.
    scene([
      point({ id: "p1", typeReponse: "case_faite" }),
      point({ id: "p2" }),
    ]);

    // Scopé par `id`, sans nom — un seul `checkbox` existe dans cette ligne
    // (le gardien L0-11 instrumente un nom littéral, jamais un rôle seul).
    const coche = within(ligneDuPoint("p1")).getByRole("checkbox");
    expect(coche).toHaveAttribute("aria-checked", "false");

    fireEvent.click(coche);
    await waitFor(() => expect(coche).toHaveAttribute("aria-checked", "true"));

    fireEvent.click(coche);
    await waitFor(() => expect(coche).toHaveAttribute("aria-checked", "false"));
  });
});

describe("le détail d'un point non conforme (9L04I-CHECKLIST-NON-CONFORME-DETAIL)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("choisir « non conforme » ouvre la suite, le commentaire et « Ajouter une photo »", async () => {
    scene([point({ id: "p1" }), point({ id: "p2", libelle: "Autre point" })]);

    fireEvent.click(
      within(ligneDuPoint("p1")).getByRole("button", {
        name: fr["checklist.terrain.non_conforme"],
      }),
    );

    await waitFor(() =>
      expect(within(ligneDuPoint("p1")).getAllByRole("radio")).toHaveLength(3),
    );
    expect(
      within(ligneDuPoint("p1")).getByRole("button", {
        name: fr["checklist.terrain.ajouter_photo"],
      }),
    ).toBeVisible();
  });

  it("choisir une suite, puis écrire un commentaire — les deux facultatifs, les deux indépendants", async () => {
    scene([point({ id: "p1" }), point({ id: "p2", libelle: "Autre point" })]);

    fireEvent.click(
      within(ligneDuPoint("p1")).getByRole("button", {
        name: fr["checklist.terrain.non_conforme"],
      }),
    );

    const segmentPiece = await waitFor(() =>
      within(ligneDuPoint("p1")).getByRole("radio", {
        name: fr["checklist.non_conformite.piece_a_commander"],
      }),
    );
    fireEvent.click(segmentPiece);
    await waitFor(() =>
      expect(segmentPiece).toHaveAttribute("aria-checked", "true"),
    );

    const commentaire = within(ligneDuPoint("p1")).getByPlaceholderText(
      fr["checklist.non_conformite.commentaire_placeholder"],
    );
    fireEvent.change(commentaire, {
      target: { value: "Ne redémarre pas sous 6 bar" },
    });
    await waitFor(() =>
      expect(commentaire).toHaveValue("Ne redémarre pas sous 6 bar"),
    );
  });

  it("une réponse déjà non conforme AVEC détail arrive REPLIÉE — toucher la ligne la rouvre", async () => {
    // Un second point JAMAIS répondu garde la rubrique ouverte (point 4,
    // 9L04D) — sans lui, la rubrique (complète dès le montage) se replierait
    // elle-même, retirant p1 du document avant toute assertion.
    scene([
      point({
        id: "p1",
        valeurInitiale: {
          conforme: "non_conforme",
          suite: "piece_a_commander",
          commentaire: "Ne redémarre pas sous 6 bar",
        },
      }),
      point({ id: "p2", libelle: "Autre point" }),
    ]);

    // REPLIÉE — aucun segment, aucun champ commentaire tant qu'on ne l'a pas
    // rouverte. La ligne résumée est le QUATRIÈME bouton (les trois pastilles
    // d'abord) — jamais interrogée par son nom, qui porterait le commentaire
    // de la fixture (L0-11, même convention que le reste de ce fichier).
    expect(within(ligneDuPoint("p1")).queryAllByRole("radio")).toHaveLength(0);
    const boutons = within(ligneDuPoint("p1")).getAllByRole("button");
    const ligneResume = boutons[boutons.length - 1]!;
    expect(ligneResume).toHaveTextContent(
      fr["checklist.non_conformite.piece_a_commander"],
    );

    fireEvent.click(ligneResume);
    await waitFor(() =>
      expect(within(ligneDuPoint("p1")).getAllByRole("radio")).toHaveLength(3),
    );
  });

  it("changer vers « conforme » avec un détail NON VIDE demande confirmation ; refusée, la réponse et le détail restent", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    scene([
      point({
        id: "p1",
        valeurInitiale: {
          conforme: "non_conforme",
          suite: "a_revoir",
          commentaire: null,
        },
      }),
      point({ id: "p2", libelle: "Autre point" }),
    ]);

    const boutonConforme = within(ligneDuPoint("p1")).getByRole("button", {
      name: fr["checklist.terrain.option_conforme"],
    });
    fireEvent.click(boutonConforme);

    expect(window.confirm).toHaveBeenCalledTimes(1);
    // REFUSÉE — la pastille « non conforme » reste pressée, le détail reste.
    expect(
      within(ligneDuPoint("p1")).getByRole("button", {
        name: fr["checklist.terrain.non_conforme"],
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("changer vers « conforme » avec un détail NON VIDE, confirmée, efface le détail", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    scene([
      point({
        id: "p1",
        valeurInitiale: {
          conforme: "non_conforme",
          suite: "a_revoir",
          commentaire: null,
        },
      }),
      point({ id: "p2", libelle: "Autre point" }),
    ]);

    const boutonConforme = within(ligneDuPoint("p1")).getByRole("button", {
      name: fr["checklist.terrain.option_conforme"],
    });
    fireEvent.click(boutonConforme);

    await waitFor(() =>
      expect(boutonConforme).toHaveAttribute("aria-pressed", "true"),
    );
    expect(within(ligneDuPoint("p1")).queryAllByRole("radio")).toHaveLength(0);
  });

  it("changer vers « sans objet » SANS détail ne demande AUCUNE confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    scene([point({ id: "p1" }), point({ id: "p2", libelle: "Autre point" })]);

    fireEvent.click(
      within(ligneDuPoint("p1")).getByRole("button", {
        name: fr["checklist.terrain.non_conforme"],
      }),
    );
    await waitFor(() =>
      expect(within(ligneDuPoint("p1")).getAllByRole("radio")).toHaveLength(3),
    );

    fireEvent.click(
      within(ligneDuPoint("p1")).getByRole("button", {
        name: fr["checklist.terrain.option_sans_objet"],
      }),
    );

    expect(confirmSpy).not.toHaveBeenCalled();
  });
});

describe("les segments de choix — pleine largeur, jusqu'à 4 options (point 3, 9L04D)", () => {
  it("un appui choisit, l'option choisie porte aria-checked", async () => {
    // Même raison que ci-dessus : un second point garde la rubrique ouverte.
    scene([
      point({
        id: "p1",
        typeReponse: "choix_dans_une_liste",
        choix: ["Bon", "Moyen", "Mauvais"],
      }),
      point({ id: "p2" }),
    ]);

    // Choisi par POSITION (le premier) — jamais par son nom accessible,
    // une valeur de fixture plutôt qu'une clé du dictionnaire.
    const bon = within(ligneDuPoint("p1")).getAllByRole("radio")[0]!;
    expect(bon).toHaveAttribute("aria-checked", "false");
    fireEvent.click(bon);
    await waitFor(() => expect(bon).toHaveAttribute("aria-checked", "true"));
  });
});
