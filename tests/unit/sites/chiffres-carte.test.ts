import { describe, expect, it } from "vitest";

import {
  chiffreMachinesSite,
  chiffreOuvertes,
  chiffreTrajet,
  chiffreVgpDepassee,
  libelleAgenceDeLaLigne,
  libelleBadgeSousContrat,
  libelleZone,
  ligneHabilitationsExigees,
} from "../../../app/(back-office)/sites/presentation";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";

/**
 * LA BANDE DE CHIFFRES DE LA CARTE SITE (QE-13c, 9EB-TP-UX3-2-LISTES-1).
 */

describe("chiffreMachinesSite / chiffreOuvertes — pas de ton, la maquette n'en pose aucun ici", () => {
  it("accordent singulier et pluriel, sans ton", () => {
    expect(chiffreMachinesSite(1)).toEqual({
      valeur: 1,
      libelle: t("sites.equipements_un"),
    });
    expect(chiffreOuvertes(2)).toEqual({
      valeur: 2,
      libelle: t("sites.chiffre_ouverte_plusieurs"),
    });
    expect("ton" in chiffreOuvertes(2)).toBe(false);
  });
});

describe("chiffreTrajet — ton `avertissement` seulement quand le trajet est INCONNU", () => {
  it("un trajet connu (mesuré ou estimé) ne porte aucun ton", () => {
    expect(chiffreTrajet({ minutes: 45, origine: "site" }).ton).toBeUndefined();
    expect(
      chiffreTrajet({ minutes: 30, origine: "defaut" }).ton,
    ).toBeUndefined();
  });

  it("LE CAS QUI DOIT ROUGIR SANS LE CORRECTIF : un trajet inconnu porte le ton avertissement", () => {
    expect(chiffreTrajet({ minutes: null, motif: "sans_zone" }).ton).toBe(
      "avertissement",
    );
    expect(chiffreTrajet({ minutes: null, motif: "sans_estimation" }).ton).toBe(
      "avertissement",
    );
  });

  it("reprend exactement la valeur et le libellé de `trajetAffiche`", () => {
    const connu = chiffreTrajet({ minutes: 45, origine: "site" });
    expect(connu.libelle).toBe(t("sites.colonne_trajet"));
  });
});

describe("chiffreVgpDepassee — jamais un chiffre à zéro dans cette bande", () => {
  it("zéro : absent (`null`)", () => {
    expect(chiffreVgpDepassee(0)).toBeNull();
  });

  it("au moins une : ton retard, accordé", () => {
    expect(chiffreVgpDepassee(1)).toEqual({
      valeur: 1,
      libelle: t("sites.chiffre_vgp_depassee_un"),
      ton: "retard",
    });
    expect(chiffreVgpDepassee(3)?.libelle).toBe(
      t("sites.chiffre_vgp_depassee_plusieurs"),
    );
  });
});

describe("libelleZone — la même phrase pour `null` et pour une valeur inconnue", () => {
  it("rend le libellé de la zone connue", () => {
    expect(libelleZone("grand_noumea")).toBe(t("site.zone.grand_noumea"));
  });

  it("`null` rend la phrase « Sans zone », la même que la puce", () => {
    expect(libelleZone(null)).toBe(t("sites.sans_zone"));
  });

  it("LE CAS QUI DOIT ROUGIR SANS LE CORRECTIF : une valeur qui ne serait plus l'une des six zones rend la même phrase, jamais une exception", () => {
    expect(libelleZone("zone_retiree_un_jour")).toBe(t("sites.sans_zone"));
  });
});

describe("libelleAgenceDeLaLigne — le mot imposé ne s'écrit pas ici", () => {
  it("compose « Agence X »", () => {
    expect(libelleAgenceDeLaLigne("Ducos")).toBe(`${mot("agence")} Ducos`);
  });
});

describe("libelleBadgeSousContrat", () => {
  it("rend le libellé du dictionnaire", () => {
    expect(libelleBadgeSousContrat()).toBe(t("sites.badge_sous_contrat"));
  });
});

describe("ligneHabilitationsExigees — remplace la pastille verte de PASTILLES-1", () => {
  it("zéro : aucune ligne (`null`)", () => {
    expect(ligneHabilitationsExigees(0)).toBeNull();
  });

  it("accorde singulier et pluriel", () => {
    expect(ligneHabilitationsExigees(1)).toBe(
      `1 ${t("sites.habilitation_exigee_un")}`,
    );
    expect(ligneHabilitationsExigees(2)).toBe(
      `2 ${t("sites.habilitation_exigee_plusieurs")}`,
    );
  });
});
