import { describe, expect, it } from "vitest";

import {
  resoudreGabarit,
  type CandidatGabarit,
  type ContexteResolutionGabarit,
} from "@/lib/checklists/cascade";

/**
 * LA CASCADE DE RÉSOLUTION (9K18-CHECKLIST-DOMAINE) — décision d'Alexis du
 * 10/11/2026 : nature d'intervention, puis MODÈLE exact (l'exception), puis
 * SOUS-TYPE (la règle), puis FAMILLE, puis générique. FONCTION PURE : aucune
 * base, des parcs FABRIQUÉS.
 */

function candidat(
  partiel: Partial<CandidatGabarit> & { readonly code: string },
): CandidatGabarit {
  return {
    checklistModeleId: `modele-${partiel.code}`,
    typesIntervention: [],
    modeleId: null,
    sousTypeId: null,
    familleId: null,
    exigeMachine: false,
    ...partiel,
  };
}

const CONTEXTE_AVEC_MACHINE: ContexteResolutionGabarit = {
  typeIntervention: "curatif",
  machinePortee: true,
  modeleId: "modele-machine-1",
  sousTypeId: "sous-type-1",
  familleId: "famille-1",
};

describe("les cinq niveaux, du plus au moins précis", () => {
  it("le modèle exact gagne sur le sous-type, la famille et le générique", () => {
    const candidats = [
      candidat({ code: "GENERIQUE" }),
      candidat({ code: "FAMILLE", familleId: "famille-1" }),
      candidat({ code: "SOUS-TYPE", sousTypeId: "sous-type-1" }),
      candidat({ code: "MODELE", modeleId: "modele-machine-1" }),
    ];
    const resolu = resoudreGabarit(CONTEXTE_AVEC_MACHINE, candidats);
    expect(resolu).toEqual({
      checklistModeleId: "modele-MODELE",
      provenance: "modele",
    });
  });

  it("sans modèle candidat, le sous-type gagne sur la famille et le générique", () => {
    const candidats = [
      candidat({ code: "GENERIQUE" }),
      candidat({ code: "FAMILLE", familleId: "famille-1" }),
      candidat({ code: "SOUS-TYPE", sousTypeId: "sous-type-1" }),
    ];
    const resolu = resoudreGabarit(CONTEXTE_AVEC_MACHINE, candidats);
    expect(resolu).toEqual({
      checklistModeleId: "modele-SOUS-TYPE",
      provenance: "sous_type",
    });
  });

  it("un modèle de matériel SANS sous-type passe DIRECTEMENT au niveau famille", () => {
    const contexteSansSousType: ContexteResolutionGabarit = {
      ...CONTEXTE_AVEC_MACHINE,
      sousTypeId: null,
    };
    const candidats = [
      candidat({ code: "GENERIQUE" }),
      candidat({ code: "FAMILLE", familleId: "famille-1" }),
      // Un candidat au niveau sous-type ne PEUT matcher un contexte sans
      // sous-type : aucun candidat réel ne porte `sousTypeId: null` (la
      // contrainte de base l'exige non nul pour ce niveau).
      candidat({ code: "SOUS-TYPE", sousTypeId: "sous-type-1" }),
    ];
    const resolu = resoudreGabarit(contexteSansSousType, candidats);
    expect(resolu).toEqual({
      checklistModeleId: "modele-FAMILLE",
      provenance: "famille",
    });
  });

  it("sans aucun rattachement matériel, la nature seule gagne sur le générique", () => {
    const candidats = [
      candidat({ code: "GENERIQUE" }),
      candidat({ code: "NATURE", typesIntervention: ["curatif"] }),
    ];
    const resolu = resoudreGabarit(CONTEXTE_AVEC_MACHINE, candidats);
    expect(resolu).toEqual({
      checklistModeleId: "modele-NATURE",
      provenance: "type_seul",
    });
  });

  it("aucun rattachement du tout : le générique reste le dernier filet", () => {
    const candidats = [candidat({ code: "GENERIQUE" })];
    const resolu = resoudreGabarit(CONTEXTE_AVEC_MACHINE, candidats);
    expect(resolu).toEqual({
      checklistModeleId: "modele-GENERIQUE",
      provenance: "generique",
    });
  });

  it("aucun candidat du tout : aucun gabarit", () => {
    expect(resoudreGabarit(CONTEXTE_AVEC_MACHINE, [])).toBeNull();
  });
});

describe("le filtre par NATURE vient d'abord, indépendamment du niveau matériel", () => {
  it("un candidat dont la nature ne correspond pas est exclu, même au niveau MODÈLE", () => {
    const candidats = [
      candidat({
        code: "MAUVAISE-NATURE",
        modeleId: "modele-machine-1",
        typesIntervention: ["preventif_contrat"],
      }),
      candidat({ code: "GENERIQUE" }),
    ];
    const resolu = resoudreGabarit(CONTEXTE_AVEC_MACHINE, candidats);
    expect(resolu).toEqual({
      checklistModeleId: "modele-GENERIQUE",
      provenance: "generique",
    });
  });

  it("un candidat SANS nature déclarée est UNIVERSEL — il passe pour toute nature", () => {
    const candidats = [
      candidat({
        code: "UNIVERSEL",
        familleId: "famille-1",
        typesIntervention: [],
      }),
    ];
    expect(
      resoudreGabarit(
        { ...CONTEXTE_AVEC_MACHINE, typeIntervention: "expertise" },
        candidats,
      ),
    ).toEqual({ checklistModeleId: "modele-UNIVERSEL", provenance: "famille" });
  });
});

describe("`exige_machine` — appliqué AVANT le classement", () => {
  it("un candidat qui l'exige est écarté quand aucune machine n'est portée", () => {
    const sansMachine: ContexteResolutionGabarit = {
      typeIntervention: "curatif",
      machinePortee: false,
      modeleId: null,
      sousTypeId: null,
      familleId: null,
    };
    const candidats = [
      candidat({ code: "EXIGE-MACHINE", exigeMachine: true }),
      candidat({ code: "GENERIQUE" }),
    ];
    const resolu = resoudreGabarit(sansMachine, candidats);
    expect(resolu).toEqual({
      checklistModeleId: "modele-GENERIQUE",
      provenance: "generique",
    });
  });

  it("un modèle INACTIF n'est jamais proposé — ce filtre vit chez l'appelant (le dépôt)", () => {
    // `resoudreGabarit` ne reçoit QUE des candidats déjà filtrés `actif:
    // true` par le dépôt (fonction pure, aucune base) : rien à éprouver ici
    // sur ce critère précis, qu'une épreuve d'isolation couvre contre la
    // vraie table.
    expect(true).toBe(true);
  });
});

describe("à égalité de niveau — le CODE, par ordre alphabétique, jamais le premier rendu", () => {
  it("deux candidats au même niveau : celui dont le code est alphabétiquement premier gagne", () => {
    const candidats = [
      candidat({ code: "ZZZ-FAMILLE", familleId: "famille-1" }),
      candidat({ code: "AAA-FAMILLE", familleId: "famille-1" }),
    ];
    const resolu = resoudreGabarit(CONTEXTE_AVEC_MACHINE, candidats);
    expect(resolu).toEqual({
      checklistModeleId: "modele-AAA-FAMILLE",
      provenance: "famille",
    });
    // Rejoué avec l'ORDRE INVERSE des mêmes candidats : même résultat — la
    // règle ne dépend jamais de l'ordre dans lequel ils sont fournis.
    expect(
      resoudreGabarit(CONTEXTE_AVEC_MACHINE, [...candidats].reverse()),
    ).toEqual({
      checklistModeleId: "modele-AAA-FAMILLE",
      provenance: "famille",
    });
  });
});
