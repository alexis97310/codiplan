import { AssujettissementVgp } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  NAISSANCE,
  resoudreAssujettissement,
  resteADeterminer,
  schemaAssujettissementFamille,
  schemaExceptionMachine,
  schemaPrecisionModele,
} from "@/lib/vgp/assujettissement";

/**
 * L'ASSUJETTISSEMENT AUX VGP (L9-03 à L9-06, D88).
 *
 * *Chaque cas qui doit ROUGIR est accompagné d'un cas qui doit rester VERT pour
 * sa propre raison* (§9, 11/09) : sans cette paire, un schéma qui refuserait
 * TOUT passerait exactement les mêmes assertions.
 */

describe("L9-03 — trois valeurs, jamais une case à cocher", () => {
  it("la naissance est `a_determiner`, et elle se lit comme telle", () => {
    expect(NAISSANCE).toBe(AssujettissementVgp.a_determiner);
    expect(resteADeterminer(NAISSANCE)).toBe(true);
  });

  it("aucune des trois réponses ne se confond avec la naissance", () => {
    // LE CAS QUI DOIT RESTER VERT : `non_soumis` est une RÉPONSE, et il ne doit
    // jamais retomber dans « on n'a pas regardé ». C'est toute la raison d'être
    // de la troisième valeur — un booléen les confondrait.
    for (const valeur of [
      AssujettissementVgp.soumis,
      AssujettissementVgp.non_soumis,
      AssujettissementVgp.verifie,
    ]) {
      expect(resteADeterminer(valeur)).toBe(false);
    }
    // TÉMOIN — l'énumération porte bien quatre valeurs, dont la naissance :
    // sur une énumération à deux valeurs, la boucle ci-dessus serait creuse.
    expect(Object.values(AssujettissementVgp)).toHaveLength(4);
    expect(Object.values(AssujettissementVgp)).toContain(NAISSANCE);
  });
});

describe("L9-04 / L9-05 — `soumis` exige sa périodicité ET son texte", () => {
  const soumis = (
    periodiciteMois: number | null,
    referenceTexte: string | null,
  ) =>
    schemaAssujettissementFamille.safeParse({
      assujettissement: AssujettissementVgp.soumis,
      periodiciteMois,
      referenceTexte,
    });

  it("refuse `soumis` sans périodicité, et NOMME ce qui manque", () => {
    const refus = soumis(null, "Code du travail NC, art. Lp. 261-1");
    expect(refus.success).toBe(false);
    expect(refus.error?.issues.map((i) => i.message)).toContain(
      "vgp.periodicite_requise",
    );
  });

  it("refuse `soumis` sans référence de texte — un chiffre indéfendable", () => {
    const refus = soumis(12, null);
    expect(refus.success).toBe(false);
    expect(refus.error?.issues.map((i) => i.message)).toContain(
      "vgp.reference_requise",
    );
  });

  it("les deux manques sont NOMMÉS SÉPARÉMENT — ils se corrigent ailleurs", () => {
    // D50 : un refus qui mêle deux causes n'apprend pas laquelle a mordu.
    const refus = soumis(null, null);
    expect(refus.success).toBe(false);
    expect(refus.error?.issues.map((i) => i.path[0]).sort()).toEqual([
      "periodiciteMois",
      "referenceTexte",
    ]);
  });

  it("accepte `soumis` avec les deux — le cas qui doit rester VERT", () => {
    expect(soumis(12, "Code du travail NC, art. Lp. 261-1").success).toBe(true);
  });

  it("`non_soumis` n'exige rien, et n'INTERDIT rien non plus", () => {
    // Une famille qu'on vient de déclarer non soumise peut garder la trace du
    // texte qu'on a lu pour le décider : c'est une information, pas une
    // contradiction.
    expect(
      schemaAssujettissementFamille.safeParse({
        assujettissement: AssujettissementVgp.non_soumis,
        periodiciteMois: null,
        referenceTexte: null,
      }).success,
    ).toBe(true);
    expect(
      schemaAssujettissementFamille.safeParse({
        assujettissement: AssujettissementVgp.non_soumis,
        periodiciteMois: null,
        referenceTexte: "Note interne du 12/09/2026",
      }).success,
    ).toBe(true);
  });

  it("une périodicité nulle ou négative n'est pas une périodicité", () => {
    expect(soumis(0, "texte").success).toBe(false);
    expect(soumis(-3, "texte").success).toBe(false);
    // …et il n'y a AUCUN plafond : un texte étranger peut en fonder une que
    // nous ne connaissons pas, et un plafond inventé ici serait le délai que
    // le §8 interdit.
    expect(soumis(120, "texte").success).toBe(true);
  });
});

describe("L9-06 — le modèle PRÉCISE, la machine fait EXCEPTION", () => {
  it("une précision de modèle sans son texte est refusée", () => {
    expect(
      schemaPrecisionModele.safeParse({
        periodiciteMois: 6,
        referenceTexte: null,
      }).success,
    ).toBe(false);
    // LE CAS QUI DOIT RESTER VERT : ne rien préciser du tout est légitime —
    // l'absence n'est pas « aucune périodicité », c'est « rien à préciser ».
    expect(
      schemaPrecisionModele.safeParse({
        periodiciteMois: null,
        referenceTexte: null,
      }).success,
    ).toBe(true);
  });

  it("une exception sans motif est refusée", () => {
    const refus = schemaExceptionMachine.safeParse({
      exception: AssujettissementVgp.non_soumis,
      motif: null,
    });
    expect(refus.success).toBe(false);
    expect(refus.error?.issues.map((i) => i.message)).toContain(
      "vgp.motif_requis",
    );
  });

  it("un motif SANS exception est refusé aussi — le sens qu'on oublie", () => {
    // Un motif orphelin est une trace qui ne se rattache à rien, et qui
    // survivrait au retrait de l'exception qu'elle expliquait.
    const refus = schemaExceptionMachine.safeParse({
      exception: null,
      motif: "usage particulier",
    });
    expect(refus.success).toBe(false);
    expect(refus.error?.issues.map((i) => i.message)).toContain(
      "vgp.motif_orphelin",
    );
  });

  it("les deux ensemble, ou aucun des deux — les cas qui restent VERTS", () => {
    expect(
      schemaExceptionMachine.safeParse({
        exception: AssujettissementVgp.soumis,
        motif: "modifiée pour lever des charges",
      }).success,
    ).toBe(true);
    expect(
      schemaExceptionMachine.safeParse({ exception: null, motif: null })
        .success,
    ).toBe(true);
  });
});

describe("la CASCADE rend l'origine, jamais la valeur seule", () => {
  const famille = {
    assujettissement: AssujettissementVgp.soumis,
    periodiciteMois: 12,
    referenceTexte: "Code du travail NC",
  };

  it("sans exception ni précision, tout vient de la famille", () => {
    const resolu = resoudreAssujettissement({
      famille,
      modele: { periodiciteMois: null, referenceTexte: null },
      machine: { exception: null },
    });
    expect(resolu.valeur).toBe(AssujettissementVgp.soumis);
    expect(resolu.origine).toBe("famille");
    expect(resolu.periodiciteMois).toBe(12);
    expect(resolu.originePeriodicite).toBe("famille");
  });

  it("le modèle précise le RYTHME, et la référence SUIT le rythme", () => {
    // Rendre le texte de la famille à côté du rythme du modèle serait une
    // justification qui ne justifie pas ce qu'elle accompagne.
    const resolu = resoudreAssujettissement({
      famille,
      modele: { periodiciteMois: 6, referenceTexte: "Notice constructeur" },
      machine: { exception: null },
    });
    expect(resolu.periodiciteMois).toBe(6);
    expect(resolu.referenceTexte).toBe("Notice constructeur");
    expect(resolu.originePeriodicite).toBe("modele");
    // …et l'assujettissement, lui, reste celui de la famille : le modèle
    // précise, il ne décide pas.
    expect(resolu.origine).toBe("famille");
  });

  it("la machine fait exception sur la VALEUR, jamais sur le rythme", () => {
    // Distinguer les deux évite qu'une exception motivée serve à contourner
    // en silence une périodicité réglementaire.
    const resolu = resoudreAssujettissement({
      famille,
      modele: { periodiciteMois: 6, referenceTexte: "Notice constructeur" },
      machine: { exception: AssujettissementVgp.non_soumis },
    });
    expect(resolu.valeur).toBe(AssujettissementVgp.non_soumis);
    expect(resolu.origine).toBe("machine");
    expect(resolu.periodiciteMois).toBe(6);
    expect(resolu.originePeriodicite).toBe("modele");
  });

  it("sans périodicité nulle part, l'origine est NULLE — jamais inventée", () => {
    const resolu = resoudreAssujettissement({
      famille: {
        assujettissement: AssujettissementVgp.a_determiner,
        periodiciteMois: null,
        referenceTexte: null,
      },
      modele: { periodiciteMois: null, referenceTexte: null },
      machine: { exception: null },
    });
    expect(resolu.periodiciteMois).toBeNull();
    expect(resolu.originePeriodicite).toBeNull();
  });
});
