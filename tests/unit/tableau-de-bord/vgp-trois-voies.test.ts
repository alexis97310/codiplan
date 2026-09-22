import { describe, expect, it } from "vitest";

import {
  detailVgpAPrevoir,
  etatVgpAPrevoir,
  valeurVgpAPrevoir,
} from "../../../app/(back-office)/tableau-de-bord/presentation";
import { fr, t } from "@/lib/i18n/fr";

/**
 * VGP-2 — LA TUILE « VGP À PRÉVOIR » DIT LES TROIS VOIES : DÉPASSÉE, À VENIR,
 * SANS INFORMATION.
 *
 * ## LE CONSTAT (d9c9446, mesuré sur l'écran le 22/09/2026)
 *
 * La tuile rendait « 0 — Dans les 30 prochains jours » sur une base dont une
 * machine soumise portait une échéance dépassée depuis huit mois. Le compte
 * excluait le retard (`>= 0`), et `etatVgpAPrevoir` n'avait que DEUX formes :
 * `{calcule:true, valeur}` ou `{calcule:false}` — aucune place pour le
 * nommer.
 *
 * ## CE QUI NE ROUVRE PAS AV-14
 *
 * Le registre VIERGE (aucune vérification jamais enregistrée) reste
 * `{calcule:false}` → « Non calculé » : *un texte nommé, jamais un zéro qui se
 * lit comme une mesure.* Le retard est le même défaut, fermé de la même façon
 * — une voie nommée, jamais un vert, jamais un zéro.
 *
 * ## CE QUE CES ÉPREUVES NE PROUVENT PAS
 *
 * `detailVgpAPrevoir` et `valeurVgpAPrevoir` n'existaient pas avant ce lot :
 * elles rougissent « avant » parce qu'elles manquent, pas parce qu'elles
 * mesurent le défaut. La mesure du défaut est dans
 * `tests/e2e/vgp-retard-visible.spec.ts` (l'écran) et
 * `tests/unit/vgp/voies-a-prevoir.test.ts` (le compte, avec son témoin).
 */

const HORIZON = 30;

describe("etatVgpAPrevoir porte les trois voies quand le registre a reçu au moins une vérification", () => {
  it("les trois comptes passent tels quels, y compris à zéro", () => {
    expect(
      etatVgpAPrevoir(true, { depassees: 1, aVenir: 0, sansInformation: 1 }),
    ).toEqual({ calcule: true, depassees: 1, aVenir: 0, sansInformation: 1 });
    expect(
      etatVgpAPrevoir(true, { depassees: 0, aVenir: 0, sansInformation: 0 }),
    ).toEqual({ calcule: true, depassees: 0, aVenir: 0, sansInformation: 0 });
  });

  it("LE CAS AV-14 RESTE FERMÉ : aucune vérification jamais enregistrée → non calculé, quels que soient les comptes", () => {
    expect(
      etatVgpAPrevoir(false, { depassees: 0, aVenir: 0, sansInformation: 4 }),
    ).toEqual({ calcule: false });
  });
});

describe("la valeur de la tuile — le grand chiffre", () => {
  it("compte les DÉPASSÉES avec les À VENIR : une échéance passée est à prévoir, et d'abord", () => {
    // AVANT : la tuile rendait 0 pour ce même parc (1 dépassée, 0 à venir).
    expect(
      valeurVgpAPrevoir({ depassees: 1, aVenir: 0, sansInformation: 1 }),
    ).toBe(1);
    expect(
      valeurVgpAPrevoir({ depassees: 2, aVenir: 3, sansInformation: 9 }),
    ).toBe(5);
  });

  it("n'y compte PAS les « sans information » : on ne sait pas quand elles sont dues, et l'inventer serait une durée (L9-05)", () => {
    expect(
      valeurVgpAPrevoir({ depassees: 0, aVenir: 0, sansInformation: 7 }),
    ).toBe(0);
  });
});

describe("le détail sous la valeur nomme les trois voies, toujours, dans cet ordre", () => {
  it("DÉPASSÉE d'abord — c'est celle qui crie —, puis À VENIR sous l'horizon reçu, puis SANS INFORMATION", () => {
    const detail = detailVgpAPrevoir(
      { depassees: 1, aVenir: 0, sansInformation: 1 },
      HORIZON,
    );
    const depassee = detail.indexOf(t("tableau_de_bord.vgp_voie_depassee_une"));
    const aVenir = detail.indexOf(
      t("tableau_de_bord.vgp_voie_a_venir_prefixe"),
    );
    const sansInformation = detail.indexOf(
      t("tableau_de_bord.vgp_voie_sans_information"),
    );
    expect(depassee).toBeGreaterThanOrEqual(0);
    expect(aVenir).toBeGreaterThan(depassee);
    expect(sansInformation).toBeGreaterThan(aVenir);
    expect(detail).toContain(`1 ${t("tableau_de_bord.vgp_voie_depassee_une")}`);
    expect(detail).toContain(
      `0 ${t("tableau_de_bord.vgp_voie_a_venir_prefixe")} ${HORIZON} ${t("tableau_de_bord.vgp_voie_a_venir_suffixe")}`,
    );
    expect(detail).toContain(
      `1 ${t("tableau_de_bord.vgp_voie_sans_information")}`,
    );
  });

  it("accorde le pluriel des dépassées", () => {
    const detail = detailVgpAPrevoir(
      { depassees: 2, aVenir: 0, sansInformation: 0 },
      HORIZON,
    );
    expect(detail).toContain(`2 ${t("tableau_de_bord.vgp_voie_depassees")}`);
    expect(detail).not.toContain(t("tableau_de_bord.vgp_voie_depassee_une"));
  });

  it("l'horizon est REÇU, jamais écrit dans le texte : un autre horizon change le détail", () => {
    const trente = detailVgpAPrevoir(
      { depassees: 0, aVenir: 1, sansInformation: 0 },
      30,
    );
    const soixante = detailVgpAPrevoir(
      { depassees: 0, aVenir: 1, sansInformation: 0 },
      60,
    );
    expect(trente).toContain("30");
    expect(soixante).toContain("60");
    expect(soixante).not.toContain("30");
  });

  it("aucun des mots de la tuile ne prononce un verdict (D88) — ni conforme, ni à jour, ni en retard, ni en règle", () => {
    const forme = (texte: string) =>
      texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const cles = Object.keys(fr).filter((cle) =>
      cle.startsWith("tableau_de_bord.vgp_"),
    );
    expect(cles.length).toBeGreaterThanOrEqual(5);
    for (const cle of cles) {
      const lu = forme(fr[cle as keyof typeof fr]);
      for (const interdit of ["conforme", "a jour", "en retard", "en regle"]) {
        expect(lu, cle).not.toContain(interdit);
      }
    }
  });
});
