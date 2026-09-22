import { describe, expect, it } from "vitest";

import {
  ANOMALIES,
  analyserMarqueur,
  codeDuMarqueur,
} from "@/lib/excel/format";
import { estCleTraduction } from "@/lib/i18n/fr";
import { TYPES_PUBLIES, refusSansGabarit } from "@/lib/imports/modeles";

/**
 * UN MARQUEUR QU'AUCUN GABARIT NE LIT N'EST PAS « UN AUTRE TYPE » (REPRISE-HISTORIQUE).
 *
 * *Mesuré en production le 22/09/2026* : un classeur `CODIPLAN-historique-v1`
 * téléversé avant que ce gabarit existe a reçu `marqueur_autre_type` — *« Vérifiez
 * le type d'import choisi »* — alors qu'il n'y a AUCUN type à choisir : D31 dit
 * que le choix se fait par le marqueur. Le lecteur est parti chercher une case
 * qui n'existe pas.
 *
 * Deux situations, deux gestes, donc deux codes — et les deux sens sont
 * éprouvés : un marqueur d'un type PUBLIÉ mais différent de celui qu'on oppose
 * garde l'ancien code ; un marqueur d'un type que PERSONNE ne publie rend le
 * neuf, avec le type qu'il annonce.
 */
describe("le refus d'un marqueur dit s'il désigne un autre gabarit ou aucun", () => {
  it("le code neuf existe dans la grammaire, et son libellé au dictionnaire", () => {
    expect(ANOMALIES).toContain("marqueur_type_inconnu");
    expect(estCleTraduction("import.anomalie.marqueur_type_inconnu")).toBe(
      true,
    );
    // Et l'ancien n'a pas bougé.
    expect(ANOMALIES).toContain("marqueur_autre_type");
  });

  it("un type PUBLIÉ mais différent de celui attendu garde l'ANCIEN code", () => {
    // TÉMOIN : `sites` est bien un type publié — sans quoi ce scénario
    // testerait la même chose que le suivant.
    expect(TYPES_PUBLIES).toContain("sites");
    const marqueur = analyserMarqueur(
      { texte: "CODIPLAN-sites-v1" },
      { type: "clients", version: 1 },
    );
    expect(marqueur.etat).toBe("autre_type");
    expect(codeDuMarqueur(marqueur)).toBe("marqueur_autre_type");
  });

  it("un type que PERSONNE ne publie rend le code NEUF, et NOMME le type", () => {
    // TÉMOIN de l'autre direction : ce type n'est publié par aucun gabarit.
    expect(TYPES_PUBLIES).not.toContain("inventaire");
    const refus = refusSansGabarit({ texte: "CODIPLAN-inventaire-v1" });
    expect(refus).toEqual({
      code: "marqueur_type_inconnu",
      type: "inventaire",
    });
  });

  it("LE CAS DE PRODUCTION : « historique » est désormais publié, et ne tombe plus ici", () => {
    // *C'est le fichier d'Alexis* : le type existe maintenant, et la question
    // « quel refus rendre » ne se pose plus pour lui — c'est le gabarit qui
    // le juge.
    expect(TYPES_PUBLIES).toContain("historique");
  });

  it("une cellule qui n'est pas un marqueur lisible ne rend pas le code neuf", () => {
    // Le code neuf dit « ce TYPE n'est pas importable » : il exige un type. Une
    // cellule vide, ou qui n'est pas un marqueur, n'en annonce aucun — elle
    // garde le refus de la grammaire, qu'on ne rejuge pas ici.
    expect(refusSansGabarit(undefined).code).not.toBe("marqueur_type_inconnu");
    expect(refusSansGabarit({ texte: "Bonjour" }).code).not.toBe(
      "marqueur_type_inconnu",
    );
    expect(refusSansGabarit({ texte: "CODIPLAN-" }).code).not.toBe(
      "marqueur_type_inconnu",
    );
  });
});
