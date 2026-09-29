import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n/fr";
import type { Decomptes } from "@/lib/imports/depot";
import type { LigneDeLot } from "@/lib/imports/depot";

import {
  lignesDeResultat,
  lignesDeRattachementVgp,
  rejetsParMotif,
  texteConfirmationAnnulation,
} from "../../../app/(back-office)/imports/presentation";

/**
 * LES TEXTES DU RAPPORT SELON LE STATUT DU LOT (TP-A3-RAPPORT-IMPORT, PA-54),
 * ET LE REGROUPEMENT DES REJETS PAR MOTIF (PA-55).
 */

const DECOMPTES: Decomptes = {
  creations: 3,
  modifications: 2,
  rejets: 1,
  gabarits: 0,
  vides: 0,
  inchangees: 0,
};

describe("lignesDeResultat dit ce qui SERA fait, ou ce qui A ÉTÉ fait, selon le statut", () => {
  it("un lot CONTRÔLÉ garde les libellés au futur", () => {
    const lignes = lignesDeResultat(DECOMPTES, "controle");
    const parCle = Object.fromEntries(lignes.map((l) => [l.cle, l.detail]));
    expect(parCle.creations).toBe("imports.creations_detail");
    expect(parCle.modifications).toBe("imports.modifications_detail");
    expect(parCle.rejets).toBe("imports.rejets_detail");
  });

  it("un lot APPLIQUÉ ne rend AUCUNE clé au futur pour ce qui a été écrit", () => {
    const lignes = lignesDeResultat(DECOMPTES, "applique");
    const detailsFuturs = [
      "imports.creations_detail",
      "imports.modifications_detail",
      "imports.rejets_detail",
    ];
    for (const ligne of lignes) {
      expect(detailsFuturs).not.toContain(ligne.detail);
    }
    const parCle = Object.fromEntries(lignes.map((l) => [l.cle, l.detail]));
    expect(parCle.creations).toBe("imports.creations_detail_passe");
    expect(parCle.modifications).toBe("imports.modifications_detail_passe");
    expect(parCle.rejets).toBe("imports.rejets_detail_passe");
    // Chaque clé rendue existe réellement dans le dictionnaire.
    for (const ligne of lignes) {
      expect(() => t(ligne.detail)).not.toThrow();
    }
  });

  it("les chiffres restent ceux du contrôle, quel que soit le statut", () => {
    const controle = lignesDeResultat(DECOMPTES, "controle");
    const applique = lignesDeResultat(DECOMPTES, "applique");
    expect(controle.map((l) => l.valeur)).toEqual(
      applique.map((l) => l.valeur),
    );
  });
});

describe("lignesDeRattachementVgp suit la même règle pour « rattachées »", () => {
  const COMPTES = {
    rattachees: 4,
    enAttente: [],
    autresRejets: 0,
  };

  it("un lot CONTRÔLÉ garde le futur", () => {
    const lignes = lignesDeRattachementVgp(COMPTES, "controle");
    const rattachees = lignes.find((l) => l.cle === "rattachees");
    expect(rattachees?.detail).toBe("imports.vgp.rattachees_detail");
  });

  it("un lot APPLIQUÉ passe au passé", () => {
    const lignes = lignesDeRattachementVgp(COMPTES, "applique");
    const rattachees = lignes.find((l) => l.cle === "rattachees");
    expect(rattachees?.detail).toBe("imports.vgp.rattachees_detail_passe");
  });
});

function ligne(
  rang: number,
  rejetMotif: string | null,
  cle: string | null = null,
  valeurs: Record<string, string | undefined> = {},
): LigneDeLot {
  return { rang, action: "rejet", cle, rejetMotif, valeurs };
}

describe("rejetsParMotif regroupe les rejets par motif (PA-55)", () => {
  it("vingt lignes du même motif font UN groupe de vingt", () => {
    const lignes = Array.from({ length: 20 }, (_, i) =>
      ligne(i + 1, "saisie_refusee"),
    );
    const groupes = rejetsParMotif(lignes, "clients");
    expect(groupes).toHaveLength(1);
    expect(groupes[0]!.nombre).toBe(20);
    expect(groupes[0]!.lignes).toHaveLength(20);
    expect(groupes[0]!.libelle).toBe("imports.motif.saisie_refusee");
  });

  it("deux motifs différents font deux groupes", () => {
    const lignes = [
      ligne(1, "saisie_refusee"),
      ligne(2, "cle_ambigue"),
      ligne(3, "saisie_refusee"),
    ];
    const groupes = rejetsParMotif(lignes, "clients");
    expect(groupes).toHaveLength(2);
  });

  it("« parent_introuvable » sur un import de sites se groupe sous le motif CLIENT, jamais une seconde table", () => {
    const lignes = [
      ligne(1, "parent_introuvable"),
      ligne(2, "parent_introuvable"),
    ];
    const groupes = rejetsParMotif(lignes, "sites");
    expect(groupes).toHaveLength(1);
    expect(groupes[0]!.libelle).toBe("imports.motif.client_introuvable");
  });

  it("un motif inconnu garde son CODE, jamais traduit", () => {
    const groupes = rejetsParMotif(
      [ligne(1, "code_absent_du_dictionnaire")],
      "clients",
    );
    expect(groupes).toHaveLength(1);
    expect(groupes[0]!.libelle).toBeNull();
    expect(groupes[0]!.code).toBe("code_absent_du_dictionnaire");
  });

  it("l'ordre des groupes suit le rang de leur PREMIÈRE ligne, aucune autre règle", () => {
    const lignes = [
      ligne(1, "cle_ambigue"),
      ligne(2, "saisie_refusee"),
      ligne(3, "cle_ambigue"),
    ];
    const groupes = rejetsParMotif(lignes, "clients");
    expect(groupes.map((g) => g.libelle)).toEqual([
      "imports.motif.cle_ambigue",
      "imports.motif.saisie_refusee",
    ]);
  });

  it("aucune ligne rejetée ne rend aucun groupe", () => {
    expect(rejetsParMotif([], "clients")).toEqual([]);
  });
});

describe("texteConfirmationAnnulation lit les chiffres du CONTRÔLE, aucun calcul", () => {
  it("cite les créations et les modifications du lot", () => {
    const texte = texteConfirmationAnnulation(DECOMPTES);
    expect(texte).toContain(String(DECOMPTES.creations));
    expect(texte).toContain(String(DECOMPTES.modifications));
    expect(texte).toContain(t("imports.annuler_aide"));
  });
});
