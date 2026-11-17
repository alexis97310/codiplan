import { describe, expect, it } from "vitest";

import type {
  FicheJSON,
  InstantaneJSON,
} from "@/app/api/terrain/instantane/route";
import {
  catalogueDeLaCopie,
  checklistDeLaFiche,
  copieUtilisable,
  photosDeLaFiche,
  prestationsRealiseesDeLaFiche,
  rapportDeLaFiche,
} from "@/lib/terrain/copie-validee";

/**
 * LA COPIE ANCIENNE, TOLÉRÉE (9F4H6A-COQUILLE-ANCIENNE-COPIE, point 1) —
 * `lireCopie` rend l'objet IndexedDB tel quel (voir son en-tête) ; une copie
 * écrite AVANT 9F4H6 ne porte ni `catalogue` ni `prestationsRealiseesIds`.
 * `as unknown as InstantaneJSON` est le même raccourci que le composant :
 * c'est exactement ce que ces fonctions reçoivent en vrai depuis IndexedDB.
 */

describe("catalogueDeLaCopie", () => {
  it("un catalogue présent est rendu tel quel, indisponible: false", () => {
    const catalogue = [
      { id: "p1", libelle: "Filtre" },
    ] as unknown as InstantaneJSON["catalogue"];
    const copie = { catalogue } as unknown as InstantaneJSON;
    expect(catalogueDeLaCopie(copie)).toEqual({
      catalogue,
      indisponible: false,
    });
  });

  it("une copie ANCIENNE (catalogue absent) rend [], indisponible: true", () => {
    const copie = {} as unknown as InstantaneJSON;
    expect(catalogueDeLaCopie(copie)).toEqual({
      catalogue: [],
      indisponible: true,
    });
  });
});

describe("prestationsRealiseesDeLaFiche", () => {
  it("un ensemble présent, même vide, est rendu tel quel, indisponibles: false", () => {
    const fiche = { prestationsRealiseesIds: [] } as unknown as FicheJSON;
    expect(prestationsRealiseesDeLaFiche(fiche)).toEqual({
      ids: [],
      indisponibles: false,
    });
  });

  it("un ensemble non vide est rendu tel quel", () => {
    const fiche = {
      prestationsRealiseesIds: ["p1", "p2"],
    } as unknown as FicheJSON;
    expect(prestationsRealiseesDeLaFiche(fiche)).toEqual({
      ids: ["p1", "p2"],
      indisponibles: false,
    });
  });

  it("une fiche d'une copie ANCIENNE (ids absents) rend [], indisponibles: true — jamais un ensemble vide muet", () => {
    const fiche = {} as unknown as FicheJSON;
    expect(prestationsRealiseesDeLaFiche(fiche)).toEqual({
      ids: [],
      indisponibles: true,
    });
  });

  it("un élément qui n'est pas une chaîne est écarté, jamais gardé tel quel", () => {
    const fiche = {
      prestationsRealiseesIds: ["p1", null, 42, "p2"],
    } as unknown as FicheJSON;
    expect(prestationsRealiseesDeLaFiche(fiche)).toEqual({
      ids: ["p1", "p2"],
      indisponibles: false,
    });
  });
});

/**
 * LA COPIE ENTIÈRE ET SES FICHES, VALIDÉES (9F4H6B-FILE-ANCIEN-FORMAT,
 * point 2) — une copie PARTIELLEMENT écrite ou corrompue ne plante plus la
 * coquille : `journee`/`fiches` absents la rendent équivalente à « aucune
 * copie », un élément invalide du catalogue ou une fiche malformée sont
 * écartés plutôt que de lever au rendu.
 */

describe("copieUtilisable — `journee` et `fiches` sont le CŒUR de la forme, jamais tolérés absents", () => {
  const JOURNEE_VALIDE = {
    fuseau: "Pacific/Noumea",
    enRetard: [],
    aujourdhui: [],
    demain: [],
    sansDate: [],
  };

  it("une copie complète est utilisable", () => {
    const copie = {
      journee: JOURNEE_VALIDE,
      fiches: {},
    } as unknown as InstantaneJSON;
    expect(copieUtilisable(copie)).toBe(true);
  });

  it("`journee` absente rend la copie inutilisable", () => {
    const copie = { fiches: {} } as unknown as InstantaneJSON;
    expect(copieUtilisable(copie)).toBe(false);
  });

  it("`fiches` absentes rend la copie inutilisable", () => {
    const copie = { journee: JOURNEE_VALIDE } as unknown as InstantaneJSON;
    expect(copieUtilisable(copie)).toBe(false);
  });

  it("une `journee` d'un mauvais type (chaîne au lieu d'un objet) rend la copie inutilisable", () => {
    const copie = {
      journee: "pas un objet",
      fiches: {},
    } as unknown as InstantaneJSON;
    expect(copieUtilisable(copie)).toBe(false);
  });

  it("une `journee` dont un tableau attendu est absent rend la copie inutilisable", () => {
    const copie = {
      journee: { ...JOURNEE_VALIDE, aujourdhui: undefined },
      fiches: {},
    } as unknown as InstantaneJSON;
    expect(copieUtilisable(copie)).toBe(false);
  });
});

describe("catalogueDeLaCopie — un élément invalide est écarté, jamais tout le catalogue", () => {
  it("un élément `null` est écarté, les autres restent", () => {
    const copie = {
      catalogue: [{ id: "p1", code: "C1", libelle: "Filtre" }, null],
    } as unknown as InstantaneJSON;
    expect(catalogueDeLaCopie(copie)).toEqual({
      catalogue: [{ id: "p1", code: "C1", libelle: "Filtre" }],
      indisponible: false,
    });
  });

  it("un élément avec un `id` mais sans `libelle` est écarté", () => {
    const copie = {
      catalogue: [{ id: "p1", code: "C1" }],
    } as unknown as InstantaneJSON;
    expect(catalogueDeLaCopie(copie)).toEqual({
      catalogue: [],
      indisponible: false,
    });
  });

  it("un élément avec un `libelle` mais sans `id` est écarté", () => {
    const copie = {
      catalogue: [{ code: "C1", libelle: "Filtre" }],
    } as unknown as InstantaneJSON;
    expect(catalogueDeLaCopie(copie)).toEqual({
      catalogue: [],
      indisponible: false,
    });
  });
});

describe("photosDeLaFiche", () => {
  it("un tableau de chaînes traverse sans changement", () => {
    const fiche = { photos: ["a.jpg", "b.jpg"] } as unknown as FicheJSON;
    expect(photosDeLaFiche(fiche)).toEqual(["a.jpg", "b.jpg"]);
  });

  it("absent devient []", () => {
    const fiche = {} as unknown as FicheJSON;
    expect(photosDeLaFiche(fiche)).toEqual([]);
  });

  it("un élément qui n'est pas une chaîne est écarté", () => {
    const fiche = { photos: ["a.jpg", null, 1] } as unknown as FicheJSON;
    expect(photosDeLaFiche(fiche)).toEqual(["a.jpg"]);
  });
});

describe("rapportDeLaFiche", () => {
  it("un rapport valide traverse sans changement", () => {
    const fiche = {
      rapport: {
        commentaireTechnicien: "RAS",
        suiteADonner: null,
        piecesRemplacees: [
          { designation: "Vis M6", reference: "V6", quantite: 2 },
        ],
      },
    } as unknown as FicheJSON;
    expect(rapportDeLaFiche(fiche)).toEqual({
      commentaireTechnicien: "RAS",
      suiteADonner: null,
      piecesRemplacees: [
        { designation: "Vis M6", reference: "V6", quantite: 2 },
      ],
    });
  });

  it("absent devient {commentaireTechnicien: null, suiteADonner: null, piecesRemplacees: []}", () => {
    const fiche = {} as unknown as FicheJSON;
    expect(rapportDeLaFiche(fiche)).toEqual({
      commentaireTechnicien: null,
      suiteADonner: null,
      piecesRemplacees: [],
    });
  });

  it("d'un mauvais type (chaîne au lieu d'un objet) devient aussi le repli sûr", () => {
    const fiche = { rapport: "pas un objet" } as unknown as FicheJSON;
    expect(rapportDeLaFiche(fiche)).toEqual({
      commentaireTechnicien: null,
      suiteADonner: null,
      piecesRemplacees: [],
    });
  });

  // UNE COPIE ÉCRITE AVANT 9I7B NE PORTE PAS `piecesRemplacees` — devient
  // `[]`, même doctrine que `catalogue` absent (voir l'en-tête du module).
  it("`piecesRemplacees` absent du rapport devient []", () => {
    const fiche = {
      rapport: { commentaireTechnicien: "RAS", suiteADonner: null },
    } as unknown as FicheJSON;
    expect(rapportDeLaFiche(fiche).piecesRemplacees).toEqual([]);
  });

  it("un élément de `piecesRemplacees` qui n'est pas de la bonne forme est écarté", () => {
    const fiche = {
      rapport: {
        commentaireTechnicien: null,
        suiteADonner: null,
        piecesRemplacees: [
          { designation: "Vis M6", reference: null, quantite: 1 },
          null,
          { designation: 42, reference: null, quantite: 1 },
          { designation: "Sans quantité", reference: null },
        ],
      },
    } as unknown as FicheJSON;
    expect(rapportDeLaFiche(fiche).piecesRemplacees).toEqual([
      { designation: "Vis M6", reference: null, quantite: 1 },
    ]);
  });
});

describe("checklistDeLaFiche — aucun test n'existait (9L04I-CHECKLIST-NON-CONFORME-DETAIL)", () => {
  it("disponible: false, mal formée ou absente, devient { disponible: false }", () => {
    expect(checklistDeLaFiche({} as unknown as FicheJSON)).toEqual({
      disponible: false,
    });
    expect(
      checklistDeLaFiche({
        checklist: "pas un objet",
      } as unknown as FicheJSON),
    ).toEqual({ disponible: false });
    expect(
      checklistDeLaFiche({
        checklist: { disponible: false },
      } as unknown as FicheJSON),
    ).toEqual({ disponible: false });
  });

  it("une réponse simple (chaîne) traverse sans changement", () => {
    const fiche = {
      checklist: {
        disponible: true,
        checklistVersionId: "v1",
        reponses: { p1: "conforme" },
      },
    } as unknown as FicheJSON;
    expect(checklistDeLaFiche(fiche)).toEqual({
      disponible: true,
      checklistVersionId: "v1",
      reponses: { p1: "conforme" },
      dernierReleves: {},
    });
  });

  it("le DÉTAIL NON CONFORME (suite + commentaire) traverse sans changement", () => {
    const fiche = {
      checklist: {
        disponible: true,
        checklistVersionId: "v1",
        reponses: {
          p1: {
            conforme: "non_conforme",
            suite: "piece_a_commander",
            commentaire: "Ne redémarre pas sous 6 bar",
          },
        },
      },
    } as unknown as FicheJSON;
    expect(checklistDeLaFiche(fiche)).toEqual({
      disponible: true,
      checklistVersionId: "v1",
      reponses: {
        p1: {
          conforme: "non_conforme",
          suite: "piece_a_commander",
          commentaire: "Ne redémarre pas sous 6 bar",
        },
      },
      dernierReleves: {},
    });
  });

  it("un détail de forme invalide (conforme absent, suite hors énumération) est écarté — ce point redevient « pas encore répondu »", () => {
    const fiche = {
      checklist: {
        disponible: true,
        checklistVersionId: "v1",
        reponses: {
          p1: { suite: "piece_a_commander", commentaire: "Sans conforme" },
          p2: { conforme: "non_conforme", suite: "autre_chose" },
        },
      },
    } as unknown as FicheJSON;
    expect(checklistDeLaFiche(fiche)).toEqual({
      disponible: true,
      checklistVersionId: "v1",
      reponses: {},
      dernierReleves: {},
    });
  });

  it("9L08F — `dernierReleves` absent (copie antérieure à ce lot) devient `{}`, jamais un plantage", () => {
    const fiche = {
      checklist: {
        disponible: true,
        checklistVersionId: "v1",
        reponses: {},
      },
    } as unknown as FicheJSON;
    expect(checklistDeLaFiche(fiche)).toEqual({
      disponible: true,
      checklistVersionId: "v1",
      reponses: {},
      dernierReleves: {},
    });
  });

  it("9L08F — un relevé valide traverse, un relevé de forme invalide est écarté", () => {
    const fiche = {
      checklist: {
        disponible: true,
        checklistVersionId: "v1",
        reponses: {},
        dernierReleves: {
          p1: { valeur: 6.2, unite: "bar", date: "12/09/2026" },
          p2: { valeur: "pas un nombre", unite: null, date: "12/09/2026" },
        },
      },
    } as unknown as FicheJSON;
    expect(checklistDeLaFiche(fiche)).toEqual({
      disponible: true,
      checklistVersionId: "v1",
      reponses: {},
      dernierReleves: { p1: { valeur: 6.2, unite: "bar", date: "12/09/2026" } },
    });
  });
});
