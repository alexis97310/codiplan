import { describe, expect, it } from "vitest";

import {
  proposerDepuisLesLignes,
  type LigneControlee,
} from "@/lib/excel/controle";
import { decompter } from "@/lib/imports/depot";

/**
 * LES DÉCOMPTES QUE LE CONTRÔLE PORTE (L1-08e).
 *
 * ## Ce que ce fichier éprouve, et ce qu'il n'éprouve PAS
 *
 * Il n'éprouve pas le comptage : `proposerDepuisLesLignes` a ses propres
 * scénarios, et **`lib/imports/depot.ts` ne compte rien** — il a d'abord porté
 * sa propre boucle, retirée plutôt que gardée par un test d'égalité (§9,
 * 01/09 : *« soit on la remplace par un appel à la première, ce qui est presque
 * toujours possible et presque toujours meilleur »*).
 *
 * Ce qui reste à éprouver est le **CHOIX** : la proposition porte sept
 * décomptes, la base en porte cinq QUE `decompter` DÉRIVE d'elle.
 * `nonRattachees` et `incompletes` QUALIFIENT des lignes déjà comptées et ne
 * s'additionnent pas — *les stocker à côté des cinq autres mettrait en base
 * un total supérieur au fichier, et le témoin dirait faux dans le sens
 * rassurant* (L1-08d).
 *
 * **`inchangees` est un SIXIÈME champ, et `decompter` ne le mesure jamais**
 * (16/09/2026) : le contrôle ne touche aucune fiche, il ne peut donc pas
 * savoir si une modification en sera une. Il vaut zéro ici sur toute
 * population, y compris non vide — ce n'est PAS l'absence de mesure du
 * dernier scénario, c'est une mesure qui n'existe pas encore à ce stade.
 */

function ligne(
  rang: number,
  action: LigneControlee["action"],
  cle?: LigneControlee["cle"],
): LigneControlee {
  return { rang, nature: "donnee", action, cle, valeurs: {} };
}

const LIGNES: readonly LigneControlee[] = [
  ligne(3, "creation", { forme: "serie", cle: "SN-1", complet: true }),
  ligne(4, "creation", {
    forme: "reference",
    cle: "SN-INCONNU-R",
    complet: false,
  }),
  ligne(5, "modification", { forme: "serie", cle: "SN-2", complet: true }),
  ligne(6, "gabarit"),
  ligne(7, "vide"),
];

describe("les décomptes posés sur le lot", () => {
  it("sont EXACTEMENT ceux de la proposition, pour les cinq qui s'additionnent", () => {
    const proposition = proposerDepuisLesLignes(LIGNES);
    const decomptes = decompter(LIGNES);

    // Le témoin : la population n'est pas vide, et elle porte les cinq natures.
    expect(LIGNES.length).toBe(5);

    expect(decomptes.creations).toBe(proposition.creations);
    expect(decomptes.modifications).toBe(proposition.modifications);
    expect(decomptes.rejets).toBe(proposition.rejets);
    expect(decomptes.gabarits).toBe(proposition.gabarits);
    expect(decomptes.vides).toBe(proposition.vides);
  });

  it("« inchangees » vaut zéro même sur une population qui porte une MODIFICATION", () => {
    // La population porte une ligne « modification » (rang 5) — le seul cas où
    // « inchangees » pourrait être tenté de dire quelque chose. Le contrôle ne
    // compare aucune fiche : il ne peut pas savoir.
    expect(decompter(LIGNES).inchangees).toBe(0);
  });

  it("n'additionnent PAS ce qui qualifie — le total reste celui du fichier", () => {
    // `incompletes` vaut 1 sur cette population : une création dont la clé est
    // une RÉFÉRENCE et non une série. Si elle entrait dans la somme, le lot
    // annoncerait six lignes pour un fichier qui en porte cinq.
    const proposition = proposerDepuisLesLignes(LIGNES);
    expect(proposition.incompletes).toBe(1);

    const decomptes = decompter(LIGNES);
    const somme =
      decomptes.creations +
      decomptes.modifications +
      decomptes.rejets +
      decomptes.gabarits +
      decomptes.vides;
    expect(somme).toBe(LIGNES.length);
  });

  it("une population VIDE rend cinq zéros, et c'est une absence de mesure", () => {
    // Écrit pour être lu : zéro contre zéro n'est pas un résultat (§9, 10/09).
    // Ce scénario dit que la fonction ne LÈVE pas sur un rapport vide ; il ne
    // dit rien de ce qu'elle compte, et les deux ci-dessus s'en chargent.
    expect(decompter([])).toEqual({
      creations: 0,
      modifications: 0,
      rejets: 0,
      gabarits: 0,
      vides: 0,
      inchangees: 0,
    });
  });
});
