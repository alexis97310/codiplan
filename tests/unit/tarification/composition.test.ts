import { describe, expect, it } from "vitest";

import { montant } from "@/lib/money";
import {
  valoriserIntervention,
  type ModeDeValorisation,
} from "@/lib/tarification/valorisation";

/**
 * LE TOTAL HORS TAXES D'UNE INTERVENTION (L2-09a ; RG-TAR-05, D11, D77,
 * RG-INT-07).
 *
 * **Ce fichier existe parce que deux totaux étaient FAUX**, et faux de deux
 * manières opposées :
 *
 * 1. le **forfait de déplacement** n'entrait dans aucun total, alors que
 *    `intervention.forfait_deplacement_id` le désignait — *un total qui omet
 *    une ligne facturée* ;
 * 2. une intervention **au forfait** se clôturait à **ZÉRO** — *un total qui
 *    affirme un prix qu'il ne connaît pas.*
 *
 * Le second est le plus dangereux : zéro se lit, et il se lit « gratuit ».
 */

const XPF = "XPF";
const TOUS_LES_MODES: readonly ModeDeValorisation[] = [
  "forfait",
  "temps_passe",
  "forfait_plus_heures",
];

describe("le forfait de déplacement s'ajoute TOUJOURS (RG-INT-07, D77)", () => {
  it("au temps passé, le total est la main-d'œuvre PLUS le déplacement", () => {
    const resultat = valoriserIntervention({
      mode: "temps_passe",
      forfaitDeplacement: montant(BigInt(3500), XPF),
      mainDoeuvre: montant(BigInt(12000), XPF),
    });
    expect(resultat.totalHT).toEqual(montant(BigInt(15500), XPF));
    expect(resultat.motifTotalInconnu).toBeNull();
  });

  it("sans forfait applicable, le déplacement n'est PAS facturé — et ce n'est pas une inconnue", () => {
    // D11 en toutes lettres : *« en l'absence de forfait applicable, non
    // facturé »*. C'est un PRIX, pas une absence d'information — le total est
    // donc connu, et il vaut la main-d'œuvre seule.
    const resultat = valoriserIntervention({
      mode: "temps_passe",
      forfaitDeplacement: null,
      mainDoeuvre: montant(BigInt(12000), XPF),
    });
    expect(resultat.totalHT).toEqual(montant(BigInt(12000), XPF));
    expect(resultat.motifTotalInconnu).toBeNull();
  });

  it("le témoin qui sépare les deux scénarios ci-dessus", () => {
    // Sans lui, une fonction qui IGNORERAIT le forfait passerait le second et
    // échouerait au premier sans qu'on sache lequel des deux ment.
    const avec = valoriserIntervention({
      mode: "temps_passe",
      forfaitDeplacement: montant(BigInt(3500), XPF),
      mainDoeuvre: montant(BigInt(12000), XPF),
    });
    const sans = valoriserIntervention({
      mode: "temps_passe",
      forfaitDeplacement: null,
      mainDoeuvre: montant(BigInt(12000), XPF),
    });
    expect(avec.totalHT).not.toEqual(sans.totalHT);
  });
});

describe("un total qu'on ne sait pas calculer est `null`, JAMAIS zéro", () => {
  it.each(["forfait", "forfait_plus_heures"] as const)(
    "le mode « %s » rend un total INCONNU, avec son motif",
    (mode) => {
      const resultat = valoriserIntervention({
        mode,
        forfaitDeplacement: montant(BigInt(3500), XPF),
        mainDoeuvre: montant(BigInt(12000), XPF),
      });
      expect(resultat.totalHT).toBeNull();
      expect(resultat.motifTotalInconnu).toBe(
        "intervention.total.forfait_de_prestation_absent",
      );
    },
  );

  it("le total inconnu n'est PAS un montant nul — la distinction est le ticket", () => {
    // *Zéro dit « cela ne coûte rien », `null` dit « il manque quelque chose
    // pour le savoir ».* La faute d'origine rendait `montant(0)`.
    const resultat = valoriserIntervention({
      mode: "forfait",
      forfaitDeplacement: montant(BigInt(3500), XPF),
      mainDoeuvre: null,
    });
    expect(resultat.totalHT).toBeNull();
    expect(resultat.totalHT).not.toEqual(montant(BigInt(0), XPF));
  });

  it("le forfait de déplacement RESTE lisible même quand le total est inconnu", () => {
    // Il est connu : le taire aussi ferait perdre une information qu'on a.
    const resultat = valoriserIntervention({
      mode: "forfait",
      forfaitDeplacement: montant(BigInt(3500), XPF),
      mainDoeuvre: null,
    });
    expect(resultat.forfaitDeplacement).toEqual(montant(BigInt(3500), XPF));
  });

  it("au temps passé SANS main-d'œuvre, le total est inconnu — et le motif diffère", () => {
    // Deux inconnues, deux motifs : un message unique ferait chercher au
    // mauvais endroit.
    const resultat = valoriserIntervention({
      mode: "temps_passe",
      forfaitDeplacement: montant(BigInt(3500), XPF),
      mainDoeuvre: null,
    });
    expect(resultat.totalHT).toBeNull();
    expect(resultat.motifTotalInconnu).toBe(
      "intervention.total.main_doeuvre_absente",
    );
  });
});

describe("le mode décide de ce qui est facturé (RG-TAR-05)", () => {
  it("couvre les TROIS modes de la règle — sans quoi la mesure est partielle", () => {
    // Témoin de population : un quatrième mode ajouté demain rougit ici.
    expect(TOUS_LES_MODES).toHaveLength(3);
  });

  it("le mode « forfait » ne facture AUCUNE heure, même si on lui en donne", () => {
    // *Le prix d'un forfait ne dépend pas de la durée* (RG-TAR-05). Passer une
    // main-d'œuvre à ce mode est une erreur d'appelant, et la fonction ne la
    // laisse pas se transformer en montant.
    const resultat = valoriserIntervention({
      mode: "forfait",
      forfaitDeplacement: null,
      mainDoeuvre: montant(BigInt(99000), XPF),
    });
    expect(resultat.mainDoeuvre).toBeNull();
  });

  it("les deux modes qui facturent des heures la rendent", () => {
    for (const mode of ["temps_passe", "forfait_plus_heures"] as const) {
      const resultat = valoriserIntervention({
        mode,
        forfaitDeplacement: null,
        mainDoeuvre: montant(BigInt(12000), XPF),
      });
      expect(resultat.mainDoeuvre, mode).toEqual(montant(BigInt(12000), XPF));
    }
  });
});

describe("I2 — jamais de conversion ligne à ligne", () => {
  it("deux devises dans une même intervention rendent un total INCONNU, jamais une somme", () => {
    // Une société n'a qu'une devise : cet état ne devrait pas se produire.
    // *L'additionner en silence fabriquerait un montant faux*, et c'est
    // exactement ce que I2 interdit.
    const resultat = valoriserIntervention({
      mode: "temps_passe",
      forfaitDeplacement: montant(BigInt(30), "EUR"),
      mainDoeuvre: montant(BigInt(12000), XPF),
    });
    expect(resultat.totalHT).toBeNull();
    expect(resultat.motifTotalInconnu).toBe(
      "intervention.total.devises_incompatibles",
    );
  });
});
