import { describe, expect, it } from "vitest";

import {
  cleDeRapprochement,
  lignesExpliquees,
  natureDeLigne,
  propositionVide,
  rattacherAuParc,
} from "@/lib/excel/rapprochement";
import { PREFIXE_SERIE_INCONNUE } from "@/lib/machines/saisie";

/**
 * LE RAPPROCHEMENT D'UN IMPORT (L1-08b, I6).
 *
 * Les scénarios ci-dessous sont écrits contre les **mesures** du fichier de
 * suivi réel de l'exploitation — 292 machines sans doublon de série, 4 % sans
 * série exploitable, 1 996 lignes d'historique dont 72 % non rattachées,
 * 652 lignes d'onglet client pour 55 codes réels —, jamais contre une idée de
 * ce qu'un fichier contient d'habitude.
 */

describe("la clé tolère l'absence de série SANS fabriquer de doublon", () => {
  it("une série exploitable rapproche, et la fiche est complète", () => {
    const cle = cleDeRapprochement({ numeroSerie: "  A-1234 ", rang: 2 });
    expect(cle).toEqual({ forme: "serie", cle: "A-1234", complet: true });
  });

  it("SANS série mais AVEC référence : identifiable, et INCOMPLÈTE", () => {
    const cle = cleDeRapprochement({ reference: "CH-77", rang: 3 });
    expect(cle.forme).toBe("reference");
    expect(cle.cle).toBe(`${PREFIXE_SERIE_INCONNUE}CH-77`);
    expect(cle.complet).toBe(false);
  });

  it("DEUX lignes muettes ne sont PAS la même machine — le cœur du ticket", () => {
    // Une clé qui rendrait la même valeur pour toutes les lignes sans série
    // les FUSIONNERAIT, et l'import perdrait des machines en silence — ce qui
    // est pire que de les rejeter.
    const a = cleDeRapprochement({ rang: 7 });
    const b = cleDeRapprochement({ rang: 8 });
    expect(a.cle).not.toBe(b.cle);
    expect(a.forme).toBe("rang");
    expect(a.complet).toBe(false);
  });

  it("les TROIS espaces de clés sont DISJOINTS, et c'est prouvé", () => {
    // C'est la seule chose qui garantisse l'absence de doublon fabriqué. On le
    // prouve plutôt que de l'espérer : sur un jeu où les trois formes portent
    // la MÊME valeur d'origine, les trois clés restent distinctes.
    const serie = cleDeRapprochement({ numeroSerie: "X9", rang: 1 });
    const reference = cleDeRapprochement({ reference: "X9", rang: 1 });
    const rang = cleDeRapprochement({ rang: 1 });
    const cles = new Set([serie.cle, reference.cle, rang.cle]);
    expect(cles.size).toBe(3);
  });

  it("une série DÉJÀ préfixée reste une référence — jamais promue complète", () => {
    // C'est ce qu'écrit une fiche saisie par le terrain (L2-01). La relire
    // comme une série ferait passer une fiche incomplète pour une complète.
    const cle = cleDeRapprochement({
      numeroSerie: `${PREFIXE_SERIE_INCONNUE}CH-77`,
      rang: 4,
    });
    expect(cle.forme).toBe("reference");
    expect(cle.complet).toBe(false);
    // …et elle n'est pas RE-préfixée : deux passages du même fichier doivent
    // rendre la même clé, sinon l'import crée un doublon à chaque relecture.
    expect(cle.cle).toBe(`${PREFIXE_SERIE_INCONNUE}CH-77`);
  });

  it("les tirets et « n/a » de saisie ne sont pas des valeurs", () => {
    for (const rien of ["", "  ", "-", "N/A", "néant", "?"]) {
      expect(cleDeRapprochement({ numeroSerie: rien, rang: 5 }).forme).toBe(
        "rang",
      );
    }
    // LE CAS QUI DOIT RESTER VERT : « NA-12 » est une vraie série, pas un
    // « n/a ». Sans lui, un filtre trop large mangerait des machines réelles.
    expect(cleDeRapprochement({ numeroSerie: "NA-12", rang: 5 }).forme).toBe(
      "serie",
    );
  });
});

describe("652 lignes pour 55 codes — le gabarit n'est ni donnée ni vide", () => {
  const IDENTIFIANTES = ["code", "raison_sociale"];

  it("une ligne identifiée est une DONNÉE, même incomplète", () => {
    expect(
      natureDeLigne(
        { code: "C001", raison_sociale: "", ville: "" },
        IDENTIFIANTES,
      ),
    ).toBe("donnee");
  });

  it("une ligne sans identifiant mais avec un reste est un GABARIT", () => {
    // Une formule recopiée, une unité, un reste de mise en forme : 597 lignes
    // sur 652. Les rejeter ferait un rapport de 597 erreurs pour un fichier
    // sain — la panne par le bruit (§9, 11/09).
    expect(
      natureDeLigne(
        { code: "", raison_sociale: "", ville: "XPF" },
        IDENTIFIANTES,
      ),
    ).toBe("gabarit");
  });

  it("une ligne sans rien du tout est VIDE", () => {
    expect(
      natureDeLigne(
        { code: " ", raison_sociale: "", ville: "-" },
        IDENTIFIANTES,
      ),
    ).toBe("vide");
  });

  it("gabarit et vide se comptent SÉPARÉMENT — ils ne se corrigent pas pareil", () => {
    // L'un est un modèle trop étendu, l'autre n'est rien. Les confondre
    // reviendrait à ne plus savoir si un fichier est court ou mal rempli.
    const gabarit = natureDeLigne({ a: "kg" }, ["code"]);
    const vide = natureDeLigne({ a: "" }, ["code"]);
    expect(gabarit).not.toBe(vide);
  });
});

describe("72 % de l'historique ne se rattache à rien, et se reprend quand même", () => {
  const CONNUES = new Set(["A-1234", "B-5678"]);

  it("une ligne qui désigne une machine connue est RATTACHÉE", () => {
    expect(rattacherAuParc("A-1234", CONNUES)).toEqual({
      issue: "rattachee",
      cle: "A-1234",
    });
  });

  it("une ligne qui ne désigne rien de connu est REPRISE, non rejetée", () => {
    // C'est le point sur lequel l'exploitation ne cède pas : écarter ces
    // lignes perdrait les trois quarts de l'historique.
    const issue = rattacherAuParc("Z-0000", CONNUES);
    expect(issue.issue).toBe("non_rattachee");
    // …et elle garde ce qu'elle portait, pour que le rapport puisse le montrer
    // à quelqu'un qui saura, lui, à quelle machine elle appartient.
    if (issue.issue !== "non_rattachee") {
      throw new Error("issue inattendue");
    }
    expect(issue.designation).toBe("Z-0000");
  });

  it("une ligne SANS désignation est reprise aussi, et le dit", () => {
    const issue = rattacherAuParc(undefined, CONNUES);
    expect(issue.issue).toBe("non_rattachee");
    if (issue.issue !== "non_rattachee") {
      throw new Error("issue inattendue");
    }
    expect(issue.designation).toBeNull();
  });

  it("AUCUNE issue n'est un rejet — le prouver, plutôt que le dire", () => {
    // TÉMOIN de non-vacuité : la population n'est pas vide, et aucune des
    // trois situations ne produit un rejet.
    const issues = [
      rattacherAuParc("A-1234", CONNUES),
      rattacherAuParc("Z-0000", CONNUES),
      rattacherAuParc(undefined, CONNUES),
    ];
    expect(issues).toHaveLength(3);
    expect(issues.map((i) => i.issue)).toEqual([
      "rattachee",
      "non_rattachee",
      "non_rattachee",
    ]);
  });

  it("le rapprochement ne se fait PAS sur une ressemblance", () => {
    // Un rattachement faux est pire qu'une absence de rattachement : il
    // attribue une facture à la mauvaise machine, et plus personne ne saura
    // que c'était automatique.
    expect(rattacherAuParc("a-1234", CONNUES).issue).toBe("non_rattachee");
    expect(rattacherAuParc("A-1234 ", CONNUES).issue).toBe("rattachee");
  });
});

describe("le décompte du rapport, et son TÉMOIN", () => {
  it("une proposition neuve est à zéro partout — aucun champ ne s'oublie", () => {
    const vide = propositionVide();
    expect(Object.values(vide).every((n) => n === 0)).toBe(true);
    // TÉMOIN — le type porte bien sept compteurs : sur un objet vide, la
    // boucle ci-dessus serait creuse.
    expect(Object.keys(vide)).toHaveLength(7);
  });

  it("le total EXPLIQUE chaque ligne du fichier, et rien de plus", () => {
    const proposition = {
      creations: 200,
      modifications: 50,
      rejets: 5,
      nonRattachees: 1437,
      gabarits: 597,
      vides: 10,
      incompletes: 12,
    };
    // 200 + 50 + 5 + 597 + 10 = 862.
    expect(lignesExpliquees(proposition)).toBe(862);
  });

  it("« non rattachée » et « incomplète » ne sont PAS additionnées", () => {
    // Ce sont des QUALIFICATIONS de lignes déjà comptées ailleurs. Les
    // additionner ferait un total supérieur au fichier, et le témoin dirait
    // faux DANS LE SENS RASSURANT.
    const base = { ...propositionVide(), creations: 10 };
    expect(lignesExpliquees(base)).toBe(10);
    expect(
      lignesExpliquees({ ...base, nonRattachees: 7, incompletes: 3 }),
    ).toBe(10);
  });
});
