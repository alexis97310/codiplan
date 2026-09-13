import { describe, expect, it } from "vitest";

import { libelleEtatInformation } from "@/lib/vgp/libelles";
import { fr } from "@/lib/i18n/fr";

/**
 * L9-02 — CE N'EST PAS UN REGISTRE DE CONFORMITÉ, C'EST UN REGISTRE DE CE QU'ON
 * NOUS A DIT (D88 §1 et §2).
 *
 * ## LE COMPORTEMENT GARDÉ, et il en fait DEUX
 *
 * 1. **Aucun état rendu ne prononce un verdict de conformité.** *Les VGP sont
 *    commandées par les CLIENTS ; CODIPLAN n'apprend leur résultat que si on le
 *    lui dit.* Un logiciel qui déduirait « conforme » d'une règle qu'il porte
 *    engagerait une responsabilité que personne ne lui a donnée — et le ferait
 *    dans un produit vendu sur d'autres territoires, sous d'autres textes.
 * 2. **Aucun état rendu ne sort sans sa date, et jamais blanc.** *Le danger est
 *    qu'un registre à moitié rempli ressemble à un registre complet* : c'est le
 *    zéro de `/sante` lu comme « installation vide », à l'échelle d'un parc.
 *
 * ## POURQUOI LA POPULATION EST CELLE-CI, ET PAS « TOUT LE DICTIONNAIRE »
 *
 * Le sous-titre de l'écran dit, en toutes lettres, *« CODIPLAN n'affirme jamais
 * la conformité »* — et il doit le dire. Un gardien qui refuserait le mot
 * partout rougirait **sur la phrase qui énonce la règle**, c'est-à-dire onze
 * fois pour rien : *un gardien dont le taux de fausses alertes conduit à ne
 * plus le lire coûte plus qu'il ne rapporte* (§9, 11/09).
 *
 * La population est donc exactement **ce qu'un écran affiche COMME ÉTAT** : les
 * clés `vgp.information.*` et `vgp.regime.*`. Elle est DÉRIVÉE du dictionnaire
 * et non écrite à la main — une clé d'état ajoutée demain y entre d'elle-même.
 */

/** Les mots qu'un état ne prononce jamais, quelle que soit sa graphie. */
const VERDICTS_INTERDITS = ["conforme", "a jour", "en retard", "en regle"];

/** Sans accents ni casse : un gardien ne se contourne pas par une graphie. */
function forme(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

describe("aucun état du registre ne prononce un verdict", () => {
  // **LA POPULATION S'EST ÉLARGIE LE 13/09/2026** (R3-11) : `vgp.echeance.*`
  // est une TROISIÈME famille de libellés d'état, née avec la colonne
  // d'échéance — et elle échappait à ce gardien, qui ne connaissait que les
  // deux premières. *Une famille de textes qui naît hors du périmètre d'un
  // gardien est exactement la liste close qu'une décision ultérieure a cessé
  // de compléter* (§9, 20/08).
  const etats = Object.entries(fr).filter(
    ([cle]) =>
      cle.startsWith("vgp.information.") ||
      cle.startsWith("vgp.regime.") ||
      cle.startsWith("vgp.echeance."),
  );

  it("TÉMOIN — la population n'est pas vide", () => {
    // Zéro clé observée ressemble exactement à un sans-faute (§9, 30/08).
    expect(etats.length).toBeGreaterThanOrEqual(7);
  });

  it.each(etats)(
    "« %s » ne dit ni conforme, ni à jour, ni en retard",
    (_cle, valeur) => {
      const lu = forme(String(valeur));
      for (const interdit of VERDICTS_INTERDITS) {
        expect(lu).not.toContain(interdit);
      }
    },
  );

  it("LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON", () => {
    // Le sous-titre de l'écran DOIT contenir le mot — il énonce la règle. S'il
    // tombait dans la population, le gardien serait bruyant et on cesserait de
    // le lire. Cette assertion dit que la coupure est au bon endroit.
    expect(forme(fr["vgp.sous_titre"])).toContain("conformite");
    expect(etats.some(([cle]) => cle === "vgp.sous_titre")).toBe(false);
  });
});

describe("aucun état ne sort sans sa date", () => {
  const LE_JOUR = new Date("2026-03-14T00:00:00.000Z");

  it("« sans information » porte depuis quand", () => {
    const rendu = libelleEtatInformation({
      etat: "sans_information",
      depuis: LE_JOUR,
      joursSansInformation: 180,
    });
    expect(rendu).toContain("14/03/2026");
  });

  it("« information reçue » porte la date de ce qu'on nous a dit", () => {
    const rendu = libelleEtatInformation({
      etat: "information_recue",
      derniereInformation: LE_JOUR,
      prochaineEcheance: null,
      joursAvantEcheance: null,
    });
    expect(rendu).toContain("14/03/2026");
  });

  it("sans date de mise en service, il le DIT — jamais un tiret", () => {
    // *On saurait qu'on ne sait pas, sans savoir depuis combien de temps on ne
    // sait pas.* Un tiret se lirait comme « rien à signaler ».
    const rendu = libelleEtatInformation({
      etat: "sans_information",
      depuis: null,
      joursSansInformation: null,
    });
    expect(rendu.length).toBeGreaterThan(20);
    expect(rendu).not.toBe("—");
    expect(forme(rendu)).toContain("sans information");
  });

  it("« hors registre » est le SEUL état sans date, et c'est sa nature", () => {
    // La question ne se pose pas : il n'y a pas de date d'une information qu'on
    // n'attend pas. Le distinguer de « sans information » est tout l'objet des
    // quatre états de `information.ts`.
    const rendu = libelleEtatInformation({
      etat: "hors_registre",
      assujettissement: "non_soumis",
    });
    expect(rendu).not.toContain("/");
    expect(forme(rendu)).toContain("hors registre");
  });
});
