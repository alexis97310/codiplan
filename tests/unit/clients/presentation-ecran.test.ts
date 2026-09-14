import { describe, expect, it } from "vitest";

import {
  resumeDesSites,
  titreSansCode,
} from "../../../app/(back-office)/clients/presentation";
import { t } from "@/lib/i18n/fr";

/**
 * CE QUE L'ÉCRAN CLIENT COMPOSE (14/09/2026, L1-01 rouvert par R3-12).
 *
 * ## LA PAIRE DU §9 (11/09) EST TENUE PARTOUT ICI
 *
 * *« À côté de chaque cas qui doit rougir, un cas qui doit rester vert POUR SA
 * PROPRE RAISON. »* Une assertion qui vérifierait seulement qu'un compteur
 * s'affiche resterait verte sur un compteur qui affiche toujours la même chose.
 * Chaque épreuve porte donc son contraire.
 */

describe("le titre du compteur ne nomme l'ERP de personne", () => {
  it("prend le libellé de la société quand elle l'a nommé (D29)", () => {
    expect(titreSansCode("Code Winpro")).toBe(
      `${t("clients.sans_code_titre")} Code Winpro`,
    );
  });

  it("retombe sur le libellé GÉNÉRIQUE quand elle ne l'a pas nommé", () => {
    // *L'absence est un état légitime* — une société qui vient d'être ouverte
    // n'a pas encore nommé son ERP, et elle ne reçoit pas un « Code Winpro »
    // deviné (D29, L0-09).
    expect(titreSansCode(null)).toBe(
      `${t("clients.sans_code_titre")} ${t("client.code_externe")}`,
    );
    expect(titreSansCode("   ")).toBe(
      `${t("clients.sans_code_titre")} ${t("client.code_externe")}`,
    );
  });

  it("N'ÉCRIT LE MOT « WINPRO » NULLE PART DE LUI-MÊME", () => {
    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON. Il ne suffit pas que
    // le titre sache reprendre un libellé : il faut qu'il n'en invente aucun.
    // *Nommer d'après l'outil d'un seul client est le défaut du 19/08, et le
    // produit est destiné à la vente.*
    expect(titreSansCode(null).toLowerCase()).not.toContain("winpro");
  });
});

describe("la colonne « lieux d'intervention »", () => {
  it("ÉCRIT l'absence plutôt que de laisser une case vide", () => {
    // *Une case vide se lit « on n'a pas rempli », un « aucun lieu » se lit
    // « il n'y en a pas »* — et les deux ne se corrigent pas au même endroit
    // (D88).
    expect(resumeDesSites({ nombre: 0, communes: [] })).toBe(
      t("clients.sites_aucun"),
    );
    // Un client absent de la carte — ce qui ne peut pas arriver, la carte étant
    // amorcée pour chaque ligne — rend la même chose plutôt que « undefined ».
    expect(resumeDesSites(undefined)).toBe(t("clients.sites_aucun"));
  });

  it("accorde le singulier et le pluriel", () => {
    expect(resumeDesSites({ nombre: 1, communes: [] })).toBe(
      `1 ${t("clients.sites_un")}`,
    );
    expect(resumeDesSites({ nombre: 4, communes: [] })).toBe(
      `4 ${t("clients.sites_plusieurs")}`,
    );
  });

  it("nomme les communes à côté du compte", () => {
    const resume = resumeDesSites({
      nombre: 2,
      communes: ["Nouméa", "Païta"],
    });
    expect(resume).toContain("2 ");
    expect(resume).toContain("Nouméa");
    expect(resume).toContain("Païta");
  });

  it("BORNE les communes, et la troncature SE VOIT", () => {
    // *Une liste coupée sans marque ferait croire qu'il n'y en a que trois.*
    const beaucoup = resumeDesSites({
      nombre: 9,
      communes: ["Bourail", "Dumbéa", "Koné", "Nouméa", "Païta"],
    });
    expect(beaucoup).toContain(t("clients.sites_et_autres"));
    expect(beaucoup).not.toContain("Païta");

    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON : trois communes
    // exactement ne sont PAS tronquées. Sans lui, une marque de troncature
    // toujours écrite passerait l'épreuve précédente.
    const pileTrois = resumeDesSites({
      nombre: 3,
      communes: ["Bourail", "Dumbéa", "Koné"],
    });
    expect(pileTrois).not.toContain(t("clients.sites_et_autres"));
    expect(pileTrois).toContain("Koné");
  });

  it("un compte SANS aucune commune connue rend le compte seul", () => {
    // *« Trois lieux » et « trois lieux à Nouméa » ne disent pas la même
    // chose* : un séparateur suivi de rien serait une ponctuation orpheline.
    expect(resumeDesSites({ nombre: 3, communes: [] })).toBe(
      `3 ${t("clients.sites_plusieurs")}`,
    );
  });
});
