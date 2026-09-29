import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";
import { ASSUJETTISSEMENT } from "@/lib/vgp/assujettissement";
import {
  etatDeLInformation,
  type EtatInformation,
} from "@/lib/vgp/information";
import { libelleEcheance, libelleEtatCourt, tonEtat } from "@/lib/vgp/libelles";
import { syntheseVgpDuSite } from "@/lib/vgp/registre";

/**
 * TP-A2 — LA SYNTHÈSE VGP D'UNE FICHE SITE, ÉPROUVÉE SANS BASE.
 *
 * `prochaineEcheanceDuSite` (`lib/vgp/registre.ts`) rejoue `ligneDuRegistre`
 * sur les machines d'un site puis délègue le choix de la ligne à retenir à
 * `syntheseVgpDuSite` — la fonction PURE éprouvée ici, sur des
 * `EtatInformation` déjà calculés.
 */

const AUJOURD_HUI = new Date("2026-09-29T00:00:00Z");

function informee(
  derniereInformation: Date,
  periodiciteMois: number | null,
): EtatInformation {
  return etatDeLInformation({
    assujettissement: ASSUJETTISSEMENT.soumis,
    periodiciteMois,
    derniereInformation,
    depuis: null,
    aujourdHui: AUJOURD_HUI,
  });
}

function sansInformation(): EtatInformation {
  return etatDeLInformation({
    assujettissement: ASSUJETTISSEMENT.soumis,
    periodiciteMois: 1,
    derniereInformation: null,
    depuis: null,
    aujourdHui: AUJOURD_HUI,
  });
}

function horsRegistre(): EtatInformation {
  return etatDeLInformation({
    assujettissement: ASSUJETTISSEMENT.non_soumis,
    periodiciteMois: null,
    derniereInformation: null,
    depuis: null,
    aujourdHui: AUJOURD_HUI,
  });
}

describe("syntheseVgpDuSite", () => {
  it("retient l'information reçue à la plus petite échéance déduite — dépassée", () => {
    // Informée le 23/07, périodicité d'un mois : échéance le 23/08, largement passée.
    const depassee = informee(new Date("2026-07-23T00:00:00Z"), 1);
    // Informée hier, périodicité de douze mois : échéance dans onze mois, plus lointaine.
    const lointaine = informee(new Date("2026-09-28T00:00:00Z"), 12);
    const synthese = syntheseVgpDuSite([depassee, lointaine]);

    expect(synthese.retenue).not.toBeNull();
    expect(synthese.retenue).toBe(depassee);
    expect(tonEtat(synthese.retenue!)).toBe("rouge");
    expect(libelleEtatCourt(synthese.retenue!)).toBe(
      fr["vgp.information.recue_echeance_depassee"],
    );
    expect(synthese.sansInformation).toBe(0);
    expect(synthese.soumises).toBe(2);
  });

  it("retient l'échéance à venir la plus proche quand aucune n'est dépassée", () => {
    const aVenir = informee(new Date("2026-09-01T00:00:00Z"), 1);
    const synthese = syntheseVgpDuSite([aVenir]);

    expect(synthese.retenue).toBe(aVenir);
    expect(libelleEcheance(synthese.retenue!)).not.toBeNull();
    expect(
      libelleEcheance(synthese.retenue!)!.startsWith(
        fr["vgp.echeance.declaree"],
      ),
    ).toBe(true);
  });

  it("aucune machine soumise : retenue nulle et sansInformation à zéro", () => {
    const synthese = syntheseVgpDuSite([horsRegistre(), horsRegistre()]);
    expect(synthese.retenue).toBeNull();
    expect(synthese.sansInformation).toBe(0);
    expect(synthese.soumises).toBe(0);
  });

  it("deux machines soumises sans information : retenue nulle, sansInformation à deux", () => {
    const synthese = syntheseVgpDuSite([sansInformation(), sansInformation()]);
    expect(synthese.retenue).toBeNull();
    expect(synthese.sansInformation).toBe(2);
    expect(synthese.soumises).toBe(2);
  });

  it("« hors registre » ne compte dans aucune des trois voies", () => {
    const synthese = syntheseVgpDuSite([
      horsRegistre(),
      sansInformation(),
      informee(new Date("2026-09-01T00:00:00Z"), 1),
    ]);
    expect(synthese.soumises).toBe(2);
    expect(synthese.sansInformation).toBe(1);
    expect(synthese.retenue).not.toBeNull();
  });
});
