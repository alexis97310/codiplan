import { describe, expect, it } from "vitest";

import { preparerUnePrestation } from "@/lib/imports/modeles";
import { prestationsPourFamille } from "@/lib/prestations/regle-famille";
import { prestationsProposees } from "@/lib/prestations/regle-type";
import { schemaPrestation } from "@/lib/prestations/saisie";

/**
 * 9L04J-PRESTATIONS-PAR-MATERIEL, D259.
 *
 * Décision d'Alexis du 13/11/2026 : « Filtrer par matériel ». Une prestation
 * SANS famille renseignée reste proposée sur TOUTE machine (générale) ; dès
 * qu'une famille au moins est cochée, elle n'est proposée que sur les
 * machines de ces familles. Le filtre se COMPOSE avec celui du type (9K29),
 * jamais à sa place. Une prestation déjà déclarée réalisée reste affichée,
 * quelle que soit la règle.
 */

const FAMILLE_PONT = "0192f0a0-5000-7000-8000-00000000a001";
const FAMILLE_COMPRESSEUR = "0192f0a0-5000-7000-8000-00000000a002";

const familles = {
  parCode: new Map([["PONT-ELEV", FAMILLE_PONT]]),
};

describe("schemaPrestation — les familles de matériel", () => {
  it("VIDE par défaut quand rien n'est saisi", () => {
    const analyse = schemaPrestation.safeParse({
      code: "ENT-1",
      libelle: "Entretien",
    });
    expect(analyse.success).toBe(true);
    expect(analyse.success && analyse.data.familles).toEqual([]);
  });

  it("accepte une liste de familles", () => {
    const analyse = schemaPrestation.safeParse({
      code: "ENT-1",
      libelle: "Entretien",
      familles: [FAMILLE_PONT, FAMILLE_COMPRESSEUR],
    });
    expect(analyse.success).toBe(true);
  });

  it("refuse une famille cochée deux fois — la base le garantit déjà, la saisie ne le laisse pas passer", () => {
    const analyse = schemaPrestation.safeParse({
      code: "ENT-1",
      libelle: "Entretien",
      familles: [FAMILLE_PONT, FAMILLE_PONT],
    });
    expect(analyse.success).toBe(false);
  });

  it("refuse un identifiant qui n'est pas un UUID", () => {
    const analyse = schemaPrestation.safeParse({
      code: "ENT-1",
      libelle: "Entretien",
      familles: ["pas-un-uuid"],
    });
    expect(analyse.success).toBe(false);
  });
});

describe("prestationsPourFamille — VIDE = générale, une réalisation ne disparaît jamais", () => {
  const GENERALE = { id: "p1", familles: [] as const };
  const PONT_SEUL = { id: "p2", familles: [FAMILLE_PONT] as const };
  const DEUX_FAMILLES = {
    id: "p3",
    familles: [FAMILLE_PONT, FAMILLE_COMPRESSEUR] as const,
  };
  const catalogue = [GENERALE, PONT_SEUL, DEUX_FAMILLES];

  it("une prestation sans famille est toujours proposée, quelle que soit la machine", () => {
    const proposees = prestationsPourFamille(
      catalogue,
      FAMILLE_COMPRESSEUR,
      new Set(),
    );
    expect(proposees.map((p) => p.id)).toContain("p1");
  });

  it("sur un compresseur, la prestation « pont seul » n'est PAS proposée", () => {
    const proposees = prestationsPourFamille(
      catalogue,
      FAMILLE_COMPRESSEUR,
      new Set(),
    );
    expect(proposees.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("sur un pont, elle EST proposée", () => {
    const proposees = prestationsPourFamille(catalogue, FAMILLE_PONT, new Set());
    expect(proposees.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("AUCUNE machine connue — seules les prestations GÉNÉRALES restent proposées", () => {
    const proposees = prestationsPourFamille(catalogue, null, new Set());
    expect(proposees.map((p) => p.id)).toEqual(["p1"]);
  });

  it("déjà déclarée réalisée, elle reste affichée même hors de sa famille", () => {
    const proposees = prestationsPourFamille(
      catalogue,
      FAMILLE_COMPRESSEUR,
      new Set(["p2"]),
    );
    expect(proposees.map((p) => p.id).sort()).toEqual(["p1", "p2", "p3"]);
  });
});

describe("le filtre TYPE × FAMILLE se compose — jamais l'un à la place de l'autre", () => {
  const catalogue = [
    { id: "p1", types: [] as const, familles: [] as const },
    {
      id: "p2",
      types: ["curatif"] as const,
      familles: [FAMILLE_PONT] as const,
    },
    {
      id: "p3",
      types: ["curatif"] as const,
      familles: [FAMILLE_COMPRESSEUR] as const,
    },
    {
      id: "p4",
      types: ["installation"] as const,
      familles: [FAMILLE_PONT] as const,
    },
  ];

  it("un curatif sur un pont ne propose que la générale et « p2 »", () => {
    const parType = prestationsProposees(catalogue, "curatif", new Set());
    const parFamille = prestationsPourFamille(parType, FAMILLE_PONT, new Set());
    expect(parFamille.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("un curatif sur un compresseur ne propose que la générale et « p3 »", () => {
    const parType = prestationsProposees(catalogue, "curatif", new Set());
    const parFamille = prestationsPourFamille(
      parType,
      FAMILLE_COMPRESSEUR,
      new Set(),
    );
    expect(parFamille.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("une installation sur un pont ne propose que la générale et « p4 » — ni « p2 » (mauvais type) ni « p3 » (mauvaise famille)", () => {
    const parType = prestationsProposees(catalogue, "installation", new Set());
    const parFamille = prestationsPourFamille(parType, FAMILLE_PONT, new Set());
    expect(parFamille.map((p) => p.id)).toEqual(["p1", "p4"]);
  });
});

describe("preparerUnePrestation — la colonne « Famille (code) » produit au plus UNE famille", () => {
  it("une cellule vide prépare une saisie générale", () => {
    const prepare = preparerUnePrestation(familles, {
      Code: "ENT-1",
      Libellé: "Entretien",
    });
    expect(prepare.prete).toBe(true);
    expect(prepare.prete && prepare.saisie.familles).toEqual([]);
  });

  it("une famille connue prépare un tableau d'UNE famille", () => {
    const prepare = preparerUnePrestation(familles, {
      Code: "ENT-1",
      Libellé: "Entretien",
      "Famille (code)": "PONT-ELEV",
    });
    expect(prepare.prete).toBe(true);
    expect(prepare.prete && prepare.saisie.familles).toEqual([FAMILLE_PONT]);
  });
});
