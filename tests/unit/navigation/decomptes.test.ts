import { describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/auth/roles";

/**
 * LES DÉCOMPTES DU MENU (QE-5, 9DU-TP-NAV3-RECHERCHE-RAIL, D171) — chaque
 * chiffre est celui de SA liste (`demandesOuvertes`, `compterParVue`), jamais
 * une sixième façon de compter. Les deux fonctions sont déjà confrontées à la
 * vraie base par leurs propres gardiens d'isolation
 * (`tests/isolation/demande.test.ts`, `tests/isolation/export-interventions.test.ts`)
 * : ce fichier n'y revient pas, il éprouve uniquement ce que
 * `lib/navigation/decomptes.ts` AJOUTE — la mise en forme `{ total, urgent }`
 * — avec des réponses simulées, jamais la vraie base (§9, 01/09 : deux
 * fichiers qui confrontent la même chose finissent par diverger).
 *
 * **Pourquoi un mock plutôt qu'une épreuve d'isolation** — `urgent` agrège
 * TOUTES les demandes/interventions ouvertes d'une société PARTAGÉE entre
 * fichiers de test (`fullyParallel`) : une épreuve qui poserait un P1 réel ne
 * pourrait jamais prouver l'absence de P1 AVANT son geste, ni l'exclusivité
 * de sa cause après (le piège nommé par le ticket). La fonction testée ici
 * ne fait AUCUNE requête elle-même — elle ne fait que lire ce que les deux
 * dépôts rendent — donc la simuler ne perd aucune couverture réelle.
 */

const demandesOuvertesSimulee = vi.fn();
const compterParVueSimulee = vi.fn();
const listerInterventionsSimulee = vi.fn();

vi.mock("@/lib/demandes/depot", () => ({
  demandesOuvertes: demandesOuvertesSimulee,
}));
vi.mock("@/lib/interventions/depot", () => ({
  compterParVue: compterParVueSimulee,
  listerInterventions: listerInterventionsSimulee,
}));

const { decomptesDuMenu } = await import("@/lib/navigation/decomptes");

const CONTEXTE = {
  utilisateurId: "aaaaaaaa-0000-7000-8000-000000000001",
  societeId: "aaaaaaaa-0000-7000-8000-000000000002",
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
} as const;

const COMPTES_VIDE = {
  toutes: 0,
  a_planifier: 0,
  aujourdhui: 0,
  en_cours: 0,
  bloquees: 0,
  a_controler: 0,
  historique: 0,
  a_venir: 0,
  en_retard: 0,
};

describe("decomptesDuMenu (QE-5, D171)", () => {
  it("rend null sans contexte — personne de connecté, aucun badge", async () => {
    expect(await decomptesDuMenu(null)).toBeNull();
    expect(demandesOuvertesSimulee).not.toHaveBeenCalled();
  });

  it("demandes.total est la longueur de demandesOuvertes, jamais un second calcul", async () => {
    demandesOuvertesSimulee.mockResolvedValueOnce([
      { urgence: "p3" },
      { urgence: "p4" },
      { urgence: "p2" },
    ]);
    compterParVueSimulee.mockResolvedValueOnce(COMPTES_VIDE);
    listerInterventionsSimulee.mockResolvedValueOnce([]);

    const resultat = await decomptesDuMenu(CONTEXTE);

    expect(resultat?.demandes).toEqual({ total: 3, urgent: false });
  });

  it("demandes.urgent passe à vrai dès qu'UNE ligne de demandesOuvertes porte p1", async () => {
    demandesOuvertesSimulee.mockResolvedValueOnce([
      { urgence: "p3" },
      { urgence: "p1" },
    ]);
    compterParVueSimulee.mockResolvedValueOnce(COMPTES_VIDE);
    listerInterventionsSimulee.mockResolvedValueOnce([]);

    const resultat = await decomptesDuMenu(CONTEXTE);

    expect(resultat?.demandes).toEqual({ total: 2, urgent: true });
  });

  it("interventions.total est `compterParVue(...).a_planifier`, jamais le nombre de lignes lues", async () => {
    demandesOuvertesSimulee.mockResolvedValueOnce([]);
    // 12 EST LE COMPTE EXACT DU GROUPBY — `listerInterventions` ne rend que
    // les 2 premières lignes (page 1, vue tronquée à des fins d'exemple) :
    // le total affiché doit rester 12, pas 2.
    compterParVueSimulee.mockResolvedValueOnce({
      ...COMPTES_VIDE,
      a_planifier: 12,
    });
    listerInterventionsSimulee.mockResolvedValueOnce([
      { priorite: "p3" },
      { priorite: "p2" },
    ]);

    const resultat = await decomptesDuMenu(CONTEXTE);

    expect(resultat?.interventions).toEqual({ total: 12, urgent: false });
  });

  it("interventions.urgent passe à vrai dès qu'UNE ligne de listerInterventions porte p1", async () => {
    demandesOuvertesSimulee.mockResolvedValueOnce([]);
    compterParVueSimulee.mockResolvedValueOnce({
      ...COMPTES_VIDE,
      a_planifier: 1,
    });
    listerInterventionsSimulee.mockResolvedValueOnce([{ priorite: "p1" }]);

    const resultat = await decomptesDuMenu(CONTEXTE);

    expect(resultat?.interventions).toEqual({ total: 1, urgent: true });
  });

  it("rend null si l'une des deux lectures échoue — ne lève jamais (même contrat que lib/navigation/chrome.ts)", async () => {
    demandesOuvertesSimulee.mockRejectedValueOnce(
      new Error("base injoignable"),
    );
    compterParVueSimulee.mockResolvedValueOnce(COMPTES_VIDE);
    listerInterventionsSimulee.mockResolvedValueOnce([]);

    await expect(decomptesDuMenu(CONTEXTE)).resolves.toBeNull();
  });
});
