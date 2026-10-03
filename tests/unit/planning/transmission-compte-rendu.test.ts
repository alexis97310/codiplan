import { describe, expect, it } from "vitest";

import {
  courrielTransmissionNonConfigure,
  texteCompteRenduTransmission,
  texteConfirmationTransmettreToutes,
} from "@/app/(back-office)/planning/presentation";
import { t } from "@/lib/i18n/fr";

describe("courrielTransmissionNonConfigure", () => {
  it("la valeur fermée exacte rend vrai", () => {
    expect(courrielTransmissionNonConfigure("non_configure")).toBe(true);
  });

  it("une absence, une autre valeur ou un tableau forgé rendent faux", () => {
    expect(courrielTransmissionNonConfigure(undefined)).toBe(false);
    expect(courrielTransmissionNonConfigure("")).toBe(false);
    expect(courrielTransmissionNonConfigure(["non_configure"])).toBe(false);
  });
});

/**
 * 9DB-RETOUCHES-10 — constat de production du 03/10/2026 : une seule
 * intervention transmise, un seul technicien, dont le courriel récapitulatif
 * échoue, affichait à la fois « 1 technicien prévenu » ET « 1 technicien n'a
 * pas reçu son courriel » — deux phrases vraies pour deux comptages
 * différents (tentés vs partis), fausses ENSEMBLE pour la même personne.
 */
describe("texteCompteRenduTransmission", () => {
  it("un échec de courriel, canal configuré : AUCUN technicien n'est dit prévenu", () => {
    const texte = texteCompteRenduTransmission({
      transmis: 1,
      techniciens: 0,
      echecsCourriel: 1,
      courrielNonConfigure: false,
    });
    expect(texte).not.toContain(
      t("planning.transmission.technicien_prevenu_singulier"),
    );
    expect(texte).toContain(
      t("planning.transmission.echec_courriel_singulier"),
    );
  });

  it("un envoi parti : le technicien est dit prévenu, aucun échec mentionné", () => {
    const texte = texteCompteRenduTransmission({
      transmis: 1,
      techniciens: 1,
      echecsCourriel: 0,
      courrielNonConfigure: false,
    });
    expect(texte).toContain(
      t("planning.transmission.technicien_prevenu_singulier"),
    );
    expect(texte).not.toContain(
      t("planning.transmission.echec_courriel_singulier"),
    );
  });

  it("plusieurs envois partis et plusieurs échecs : les deux pluriels, jamais les singuliers", () => {
    const texte = texteCompteRenduTransmission({
      transmis: 3,
      techniciens: 2,
      echecsCourriel: 1,
      courrielNonConfigure: false,
    });
    expect(texte).toContain(
      t("planning.transmission.techniciens_prevenus_pluriel"),
    );
    expect(texte).toContain(
      t("planning.transmission.echec_courriel_singulier"),
    );
  });

  it("canal non configuré : la phrase dédiée remplace la phrase d'échec générique", () => {
    const texte = texteCompteRenduTransmission({
      transmis: 1,
      techniciens: 0,
      echecsCourriel: 1,
      courrielNonConfigure: true,
    });
    expect(texte).toContain(t("planning.transmission.courriel_non_configure"));
    expect(texte).not.toContain(
      t("planning.transmission.echec_courriel_singulier"),
    );
    expect(texte).not.toContain(
      t("planning.transmission.echec_courriel_pluriel"),
    );
  });

  it("canal non configuré mais aucun échec compté : la phrase dédiée ne s'affiche pas quand même", () => {
    const texte = texteCompteRenduTransmission({
      transmis: 1,
      techniciens: 1,
      echecsCourriel: 0,
      courrielNonConfigure: false,
    });
    expect(texte).not.toContain(
      t("planning.transmission.courriel_non_configure"),
    );
  });
});

describe("texteConfirmationTransmettreToutes", () => {
  it("une seule planifiée prête, aucune laissée : singulier, sans mention des laissées", () => {
    const texte = texteConfirmationTransmettreToutes(1, 0);
    expect(texte).toContain(
      t("planning.transmission.confirmer_toutes_milieu_singulier"),
    );
    expect(texte).not.toContain(
      t("planning.transmission.confirmer_toutes_milieu"),
    );
  });

  it("plusieurs planifiées prêtes : pluriel", () => {
    const texte = texteConfirmationTransmettreToutes(7, 0);
    expect(texte).toContain(t("planning.transmission.confirmer_toutes_milieu"));
  });

  it("une seule laissée : suffixe au singulier", () => {
    const texte = texteConfirmationTransmettreToutes(3, 1);
    expect(texte).toContain(
      t("planning.transmission.confirmer_toutes_laissees_suffixe_singulier"),
    );
    expect(texte).not.toContain(
      t("planning.transmission.confirmer_toutes_laissees_suffixe"),
    );
  });

  it("plusieurs laissées : suffixe au pluriel", () => {
    const texte = texteConfirmationTransmettreToutes(1, 7);
    expect(texte).toContain(
      t("planning.transmission.confirmer_toutes_laissees_suffixe"),
    );
  });

  it("une prête et une laissée : les deux singuliers en même temps — exactement le constat de production", () => {
    const texte = texteConfirmationTransmettreToutes(1, 1);
    expect(texte).toBe(
      `${t("planning.transmission.confirmer_toutes_prefixe")} 1 ${t(
        "planning.transmission.confirmer_toutes_milieu_singulier",
      )} 1 ${t("planning.transmission.confirmer_toutes_laissees_suffixe_singulier")}`,
    );
  });
});
