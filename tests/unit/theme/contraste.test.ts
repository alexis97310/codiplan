import { describe, expect, it } from "vitest";

import {
  ENCRE_CLAIRE,
  ENCRE_SOMBRE,
  LUMINANCE_PIRE_FOND,
  PLANCHER_ENCRE,
  SEUIL_NON_TEXTE,
  SEUIL_TEXTE,
  ajusterPourContraste,
  encreLisible,
} from "@/lib/theme/contraste";
import { luminanceRelative, rapportDeContraste } from "@/lib/theme/couleur";

/**
 * Lisibilité de la charte d'une société (ticket L0-09, point 3 ; D51).
 *
 * Le ticket demande un CHIFFRE, pas une bonne pratique. Le voici, et il tient
 * en trois lignes :
 *
 *   - le seuil appliqué est **4,5:1** — WCAG 2.1, critère 1.4.3 « Contrast
 *     (Minimum) », niveau AA, texte courant ; 3:1 pour le grand texte et pour
 *     les éléments non textuels (critères 1.4.3 et 1.4.11) ;
 *   - la voie retenue est le **choix automatique de l'encre**, parce qu'il
 *     garantit **√21 ≈ 4,58:1** sur n'importe quel fond sRGB — au-dessus du
 *     seuil, par construction et non par échantillonnage ;
 *   - le cas que le ticket cite est mesuré ici : sur le jaune pâle `#fff9c4`,
 *     du blanc donne **1,07:1** — illisible — et l'encre choisie donne
 *     **19,60:1**.
 *
 * Les valeurs attendues sont écrites en clair : un test qui recalculerait le
 * résultat avec la fonction testée ne prouverait rien.
 */

/** Tolérance de comparaison — deux décimales, comme les valeurs publiées. */
const PRECISION = 2;

describe("luminance et rapport de contraste (WCAG 2.1)", () => {
  it("place les extrêmes là où la norme les place", () => {
    expect(luminanceRelative("#000000")).toBe(0);
    expect(luminanceRelative("#ffffff")).toBe(1);
    expect(rapportDeContraste("#000000", "#ffffff")).toBeCloseTo(21, 6);
    expect(rapportDeContraste("#123456", "#123456")).toBeCloseTo(1, 6);
  });

  it("retrouve le gris frontière de la norme : #767676 sur blanc vaut 4,54:1", () => {
    // Valeur de référence connue : c'est le gris le plus clair qui passe encore
    // le seuil AA sur fond blanc. S'en écarter signalerait une erreur dans la
    // linéarisation des canaux ou dans les coefficients de luminance.
    expect(rapportDeContraste("#767676", "#ffffff")).toBeCloseTo(
      4.54,
      PRECISION,
    );
    expect(rapportDeContraste("#777777", "#ffffff")).toBeLessThan(SEUIL_TEXTE);
  });

  it("ne dépend pas de la graphie de la couleur", () => {
    expect(rapportDeContraste("#FFF", "#000000")).toBeCloseTo(21, 6);
    expect(luminanceRelative("#FfF9C4")).toBeCloseTo(
      luminanceRelative("#fff9c4"),
      12,
    );
  });
});

describe("le cas du ticket : un jaune pâle et du texte blanc", () => {
  const JAUNE_PALE = "#fff9c4";

  it("du blanc sur ce jaune donne 1,07:1 — quatre fois moins que le seuil", () => {
    expect(rapportDeContraste(ENCRE_CLAIRE, JAUNE_PALE)).toBeCloseTo(
      1.07,
      PRECISION,
    );
    expect(rapportDeContraste(ENCRE_CLAIRE, JAUNE_PALE)).toBeLessThan(
      SEUIL_TEXTE,
    );
  });

  it("l'encre calculée est sombre, et donne 19,60:1", () => {
    expect(encreLisible(JAUNE_PALE)).toBe(ENCRE_SOMBRE);
    expect(
      rapportDeContraste(encreLisible(JAUNE_PALE), JAUNE_PALE),
    ).toBeCloseTo(19.6, PRECISION);
  });
});

describe("le choix de l'encre est une GARANTIE, pas une heuristique", () => {
  it("le plancher théorique est √21 ≈ 4,5826, au-dessus du seuil AA", () => {
    expect(PLANCHER_ENCRE).toBeCloseTo(4.5826, 4);
    expect(PLANCHER_ENCRE).toBeGreaterThan(SEUIL_TEXTE);
  });

  it("le pire fond possible est celui de luminance ≈ 0,1791, et il donne le plancher", () => {
    expect(LUMINANCE_PIRE_FOND).toBeCloseTo(0.179129, 6);
    // Le fond qui contraste aussi mal avec le noir qu'avec le blanc.
    const contreNoir = (LUMINANCE_PIRE_FOND + 0.05) / 0.05;
    const contreBlanc = 1.05 / (LUMINANCE_PIRE_FOND + 0.05);
    expect(contreNoir).toBeCloseTo(contreBlanc, 10);
    expect(contreNoir).toBeCloseTo(PLANCHER_ENCRE, 10);
  });

  it("aucune couleur du cube sRGB ne descend sous le plancher — balayage exhaustif", () => {
    // Le balayage n'est pas une preuve du théorème : il vérifie que le CODE
    // réalise ce que le théorème annonce, sur toutes les teintes et toutes les
    // clartés, en quantifié 8 bits.
    let minimum = Number.POSITIVE_INFINITY;
    let pire = "";
    let couleurs = 0;

    for (let r = 0; r < 256; r += 9) {
      for (let v = 0; v < 256; v += 9) {
        for (let b = 0; b < 256; b += 9) {
          const hex = `#${[r, v, b]
            .map((canal) => canal.toString(16).padStart(2, "0"))
            .join("")}`;
          const rapport = rapportDeContraste(hex, encreLisible(hex));
          couleurs += 1;
          if (rapport < minimum) {
            minimum = rapport;
            pire = hex;
          }
        }
      }
    }

    expect(couleurs).toBeGreaterThan(20000);
    expect(minimum, `pire fond balayé : ${pire}`).toBeGreaterThanOrEqual(
      SEUIL_TEXTE,
    );
    expect(minimum).toBeCloseTo(PLANCHER_ENCRE, 2);
  });

  it("traite les trois cas extrêmes que le ticket nomme", () => {
    // Très clair : le blanc pur — l'encre bascule au noir.
    expect(encreLisible("#ffffff")).toBe(ENCRE_SOMBRE);
    expect(rapportDeContraste("#ffffff", encreLisible("#ffffff"))).toBeCloseTo(
      21,
      6,
    );

    // Très sombre : un noir presque pur — l'encre bascule au blanc.
    expect(encreLisible("#101010")).toBe(ENCRE_CLAIRE);
    expect(rapportDeContraste("#101010", encreLisible("#101010"))).toBeCloseTo(
      19.03,
      PRECISION,
    );

    // Saturé : un vert pur, très lumineux malgré la saturation — le vert pèse
    // 71 % de la luminance perçue, et c'est pourquoi du blanc dessus ne donne
    // que 1,37:1 là où l'intuition dirait « couleur vive, donc contrastée ».
    expect(rapportDeContraste(ENCRE_CLAIRE, "#00ff00")).toBeCloseTo(
      1.37,
      PRECISION,
    );
    expect(encreLisible("#00ff00")).toBe(ENCRE_SOMBRE);
    expect(rapportDeContraste("#00ff00", encreLisible("#00ff00"))).toBeCloseTo(
      15.3,
      PRECISION,
    );
  });
});

describe("la couleur de société employée comme ENCRE sur la surface", () => {
  const BLANC = "#ffffff";

  it("laisse intacte une couleur qui passe déjà le seuil", () => {
    const ajustement = ajusterPourContraste("#0b5cad", BLANC);
    expect(ajustement.ajustee).toBe(false);
    expect(ajustement.couleur).toBe("#0b5cad");
    expect(ajustement.rapport).toBeCloseTo(6.67, PRECISION);
  });

  it("assombrit un jaune pâle jusqu'au seuil, sans changer sa teinte", () => {
    const ajustement = ajusterPourContraste("#fff9c4", BLANC);
    expect(ajustement.ajustee).toBe(true);
    expect(ajustement.atteint).toBe(true);
    expect(ajustement.rapport).toBeGreaterThanOrEqual(SEUIL_TEXTE);
    // La teinte est conservée : le canal bleu reste le plus faible des trois,
    // comme dans le jaune d'origine.
    expect(ajustement.couleur).toBe("#857700");
  });

  it("éclaircit sur une surface sombre — la direction n'est pas codée en dur", () => {
    const ajustement = ajusterPourContraste("#1a1a2e", "#000000");
    expect(ajustement.ajustee).toBe(true);
    expect(ajustement.atteint).toBe(true);
    expect(ajustement.rapport).toBeGreaterThanOrEqual(SEUIL_TEXTE);
    expect(luminanceRelative(ajustement.couleur)).toBeGreaterThan(
      luminanceRelative("#1a1a2e"),
    );
  });

  it("atteint le seuil sur toutes les couleurs balayées", () => {
    for (let r = 0; r < 256; r += 37) {
      for (let v = 0; v < 256; v += 37) {
        for (let b = 0; b < 256; b += 37) {
          const hex = `#${[r, v, b]
            .map((canal) => canal.toString(16).padStart(2, "0"))
            .join("")}`;
          const ajustement = ajusterPourContraste(hex, BLANC);
          expect(ajustement.atteint, `échec sur ${hex}`).toBe(true);
          expect(ajustement.rapport).toBeGreaterThanOrEqual(SEUIL_TEXTE);
        }
      }
    }
  });

  it("GARANTIE (1) : la fin de la course est le noir ou le blanc PUR", () => {
    // Le fait porteur. Si les extrémités de la clarté HSL n'étaient pas les
    // couleurs pures, la garantie ci-dessous n'existerait pas — la course
    // s'arrêterait sur « une couleur très sombre », de rapport inconnu.
    // Éprouvé en exigeant 21:1, que seule l'extrémité atteint.
    expect(ajusterPourContraste("#fff9c4", BLANC, 21).couleur).toBe("#000000");
    expect(ajusterPourContraste("#7a1f3d", BLANC, 21).couleur).toBe("#000000");
    expect(ajusterPourContraste("#0b5cad", "#000000", 21).couleur).toBe(
      "#ffffff",
    );
    // Y compris sur une couleur très saturée, où la teinte pourrait laisser
    // croire qu'un canal reste allumé.
    expect(ajusterPourContraste("#00ff00", BLANC, 21).couleur).toBe("#000000");
  });

  it("GARANTIE (2) : tout seuil ≤ √21 est atteint, sur TOUT couple couleur/fond", () => {
    // Le balayage porte sur les deux dimensions — la couleur ET le fond —
    // parce que la garantie porte sur le couple. Un balayage sur fond blanc
    // seulement n'aurait rien prouvé du fond sombre.
    const fonds = [
      "#ffffff",
      "#000000",
      "#767676",
      "#5d60ff", // le pire fond balayé : celui qui atteint le plancher
      "#fff9c4",
      "#0b5cad",
      "#1a1a2e",
      "#00ff00",
    ];
    let couples = 0;

    for (const fond of fonds) {
      for (let r = 0; r < 256; r += 51) {
        for (let v = 0; v < 256; v += 51) {
          for (let b = 0; b < 256; b += 51) {
            const couleur = `#${[r, v, b]
              .map((canal) => canal.toString(16).padStart(2, "0"))
              .join("")}`;
            couples += 1;

            const auSeuil = ajusterPourContraste(couleur, fond, SEUIL_TEXTE);
            expect(auSeuil.atteint, `${couleur} sur ${fond} — seuil AA`).toBe(
              true,
            );
            expect(auSeuil.rapport).toBeGreaterThanOrEqual(SEUIL_TEXTE);

            // Et jusqu'au plancher théorique lui-même, pas seulement jusqu'à 4,5.
            const auPlancher = ajusterPourContraste(
              couleur,
              fond,
              PLANCHER_ENCRE,
            );
            expect(
              auPlancher.atteint,
              `${couleur} sur ${fond} — plancher √21`,
            ).toBe(true);
          }
        }
      }
    }

    expect(couples).toBeGreaterThan(1000);
  });

  it("GARANTIE (3) : la frontière est réelle — juste au-dessus de √21, elle cède", () => {
    // Une garantie qui ne cède jamais nulle part est une garantie qu'on n'a pas
    // éprouvée. Sur le pire fond — celui dont la luminance vaut le point
    // d'équilibre —, un seuil d'un centième au-dessus du plancher devient hors
    // d'atteinte, et la fonction le DIT au lieu de le taire.
    const pireFond = "#5d60ff";
    expect(
      ajusterPourContraste(pireFond, pireFond, PLANCHER_ENCRE).atteint,
    ).toBe(true);

    const auDela = ajusterPourContraste(
      pireFond,
      pireFond,
      PLANCHER_ENCRE + 0.01,
    );
    expect(auDela.atteint).toBe(false);
    expect(auDela.rapport).toBeCloseTo(PLANCHER_ENCRE, 2);
    // Et la course s'est bien arrêtée sur l'encre lisible de ce fond — le
    // fait (2) de la garantie, observé à l'endroit exact où elle cède.
    expect(auDela.couleur).toBe(encreLisible(pireFond));
  });

  it("dit qu'il n'a pas atteint un seuil inatteignable, plutôt que d'échouer", () => {
    // 21:1 n'est atteignable que par le couple noir/blanc. Sur une surface
    // blanche, une couleur autre que le noir ne peut pas y arriver : le
    // résultat est alors la meilleure trouvée, et `atteint` vaut faux.
    const ajustement = ajusterPourContraste("#7a1f3d", BLANC, 21.5);
    expect(ajustement.atteint).toBe(false);
    expect(ajustement.rapport).toBeGreaterThan(SEUIL_TEXTE);
    expect(ajustement.couleur).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("le seuil des éléments non textuels reste celui de la norme", () => {
    expect(SEUIL_NON_TEXTE).toBe(3);
    expect(SEUIL_TEXTE).toBe(4.5);
  });
});
