import { describe, expect, it } from "vitest";

import {
  codeEtCommune,
  compteurSites,
  referentClient,
  titreSansCode,
} from "../../../app/(back-office)/clients/presentation";
import { t } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";

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

describe("la première ligne de la carte — code et commune (D123)", () => {
  it("ÉCRIT l'absence des DEUX plutôt que de laisser une case vide", () => {
    expect(codeEtCommune(null, undefined)).toBe("—");
    expect(codeEtCommune(null, { nombre: 0, communes: [] })).toBe("—");
  });

  it("nomme une seule commune — la première, jamais la liste — au POINT MÉDIAN", () => {
    expect(
      codeEtCommune("CLI-000184", {
        nombre: 2,
        communes: ["Nouméa", "Ducos"],
      }),
    ).toBe(`CLI-000184${t("ponctuation.point_median")}Nouméa`);
  });

  it("rend le code seul quand aucune commune n'est connue", () => {
    // *« CLI-000184 » et « CLI-000184 à Nouméa » ne disent pas la même
    // chose* : un séparateur suivi de rien serait une ponctuation orpheline.
    expect(codeEtCommune("CLI-000184", { nombre: 3, communes: [] })).toBe(
      "CLI-000184",
    );
    expect(codeEtCommune("CLI-000184", undefined)).toBe("CLI-000184");
  });

  it("LE CAS QUI DOIT ROUGIR SANS LE CORRECTIF : un code absent rend la commune SEULE, jamais « — · Koné »", () => {
    // *Mesuré à l'écran le 18/09/2026 (« Garage du Nord ») : un séparateur
    // suivait le tiret d'un code manquant, et se lisait comme une panne.*
    const rendu = codeEtCommune(null, { nombre: 1, communes: ["Koné"] });
    expect(rendu).toBe("Koné");
    expect(rendu).not.toContain("—");
    expect(rendu).not.toContain(t("ponctuation.point_median").trim());
  });
});

describe("la seconde ligne de la carte — le commercial référent (D123)", () => {
  it("rend `null` plutôt qu'un tiret — la ligne s'omet, elle ne se vide pas", () => {
    expect(referentClient(null)).toBeNull();
  });

  it("labellise la valeur plutôt que de l'écrire seule", () => {
    expect(referentClient("Marc Tjibaou")).toBe(
      `${t("client.commercial_referent")}${t("ponctuation.separateur")}Marc Tjibaou`,
    );
  });
});

describe("le compteur de sites de la bande entity-meta (D123, PASTILLES-1)", () => {
  it("accorde le singulier et le pluriel — le mot IMPOSÉ, composé, jamais écrit ici", () => {
    expect(compteurSites({ nombre: 1, communes: [] })).toEqual({
      valeur: 1,
      libelle: motDansUnePhrase("site"),
      ton: "bleu",
    });
    expect(compteurSites({ nombre: 4, communes: [] })).toEqual({
      valeur: 4,
      libelle: motDansUnePhrase("site", true),
      ton: "bleu",
    });
  });

  it("rend zéro — jamais une carte amorcée qui échoue — pour un client sans entrée", () => {
    expect(compteurSites(undefined)).toEqual({
      valeur: 0,
      libelle: motDansUnePhrase("site", true),
      ton: "bleu",
    });
  });

  it("le ton est FIXE — bleu, jamais choisi par la page qui affiche la carte", () => {
    expect(compteurSites({ nombre: 1, communes: [] }).ton).toBe("bleu");
    expect(compteurSites({ nombre: 4, communes: [] }).ton).toBe("bleu");
  });
});
