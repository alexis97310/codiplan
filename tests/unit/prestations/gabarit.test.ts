import { describe, expect, it } from "vitest";

import {
  CHAMPS_PRESTATIONS,
  CHAMPS_PRESTATIONS_ECARTES,
  COLONNES_PRESTATIONS,
  marqueurDu,
  modelePrestations,
  MOTIF_PARENT_INTROUVABLE,
  MOTIF_SAISIE_REFUSEE,
} from "@/lib/imports/modeles";
import { schemaPrestation } from "@/lib/prestations/saisie";

/**
 * LE GABARIT « PRESTATIONS » (L1-12 ; D109, D113, L1-09a).
 *
 * ## CE QU'IL NE DOIT PAS EXPOSER, ET C'EST LE CŒUR DU TICKET
 *
 * **Aucune colonne de prix, aucune colonne de forfait.** Un import est
 * précisément le chemin où personne ne relit ce qui entre : une colonne
 * « Tarif » dans ce tableur ferait passer un montant par la porte que la table a
 * fermée.
 *
 * ## LA FAMILLE EST UN PARENT FACULTATIF — le premier du fichier
 *
 * Les autres gabarits qui désignent un parent le rendent obligatoire. Celui-ci
 * ne l'exige pas : *un déplacement, un diagnostic ou une formation ne visent
 * aucune famille.* La conséquence se mesure ici, et elle a deux moitiés qui ne
 * se confondent pas — **une cellule VIDE passe, une cellule RENSEIGNÉE qui ne
 * désigne rien est un rejet.** *Les confondre ferait rejeter la moitié d'un
 * catalogue ordinaire.*
 */

const FAMILLE_PONTS = "0192f0a0-5000-7000-8000-00000000a001";

const familles = {
  parCode: new Map([["PONTS", FAMILLE_PONTS]]),
};

const modele = modelePrestations(familles);

/**
 * Le validateur du gabarit, avec son TÉMOIN.
 *
 * `ModeleDImport.valider` est FACULTATIF — certains gabarits n'ont rien à
 * valider —, et un `?.()` silencieux rendrait `undefined` partout : **tous les
 * scénarios de rejet ci-dessous passeraient sans rien éprouver.** *Un gardien
 * creux est vert, par définition* (§9, 30/08). Cette fonction lève plutôt que
 * de rendre l'absence.
 */
function valider(valeurs: Record<string, string>): string | null {
  if (modele.valider === undefined) {
    throw new Error(
      "Le gabarit « prestations » n'a aucun validateur : les scénarios de " +
        "rejet ci-dessous ne mesureraient rien.",
    );
  }
  // Le rang est SANS OBJET pour ce gabarit — sa clé est le code, jamais le
  // rang —, et le passer quand même est ce qui rend l'appel fidèle à
  // `controlerFeuille` (R6-03).
  return modele.valider(valeurs, 3);
}

/** Une ligne de tableur, par nom de colonne. */
function ligne(valeurs: Record<string, string>) {
  return valeurs;
}

describe("le gabarit n'expose AUCUN prix", () => {
  it("TÉMOIN — il expose bien des colonnes", () => {
    expect(modele.colonnes.length).toBeGreaterThanOrEqual(5);
  });

  it("aucune colonne ne nomme un montant, un taux ni un forfait", () => {
    const interdits = ["montant", "taux", "prix", "tarif", "forfait"];
    for (const colonne of modele.colonnes) {
      const lu = colonne.nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      for (const mot of interdits) {
        expect(
          lu,
          `la colonne « ${colonne.nom} » nomme « ${mot} »`,
        ).not.toContain(mot);
      }
    }
  });

  it("chaque champ de saisie est EXPOSÉ ou ÉCARTÉ NOMMÉMENT", () => {
    // L1-09a : *un champ écarté sans motif est un champ oublié, et rien ne les
    // distingue.* La population vient du SCHÉMA DE SAISIE, jamais d'une liste
    // écrite à la main — un champ ajouté demain y entre de lui-même.
    const champs = Object.keys(schemaPrestation.shape);
    expect(champs.length).toBeGreaterThanOrEqual(6);
    const exposes = new Set(Object.values(CHAMPS_PRESTATIONS));
    const ecartes = new Set(Object.keys(CHAMPS_PRESTATIONS_ECARTES));
    for (const champ of champs) {
      expect(
        exposes.has(champ) || ecartes.has(champ),
        `le champ « ${champ} » n'est ni exposé ni écarté nommément`,
      ).toBe(true);
    }
  });

  it("et chaque motif d'écart DIT quelque chose", () => {
    for (const [champ, motif] of Object.entries(CHAMPS_PRESTATIONS_ECARTES)) {
      expect(motif.length, champ).toBeGreaterThan(20);
    }
  });

  it("le marqueur est DÉRIVÉ du modèle, jamais recopié", () => {
    expect(marqueurDu(modele)).toBe("CODIPLAN-prestations-v1");
  });
});

describe("la FAMILLE est facultative, et les deux cas ne se confondent pas", () => {
  const saine = {
    [COLONNES_PRESTATIONS.code]: "ENT-PONT",
    [COLONNES_PRESTATIONS.libelle]: "Entretien annuel pont élévateur",
    [COLONNES_PRESTATIONS.dureeStandard]: "90",
  };

  it("une famille NOMMÉE et connue passe", () => {
    expect(
      valider(ligne({ ...saine, [COLONNES_PRESTATIONS.famille]: "PONTS" })),
    ).toBeNull();
  });

  it("une cellule VIDE passe — l'absence de parent n'est pas un parent absent", () => {
    // *Un déplacement, un diagnostic ou une formation ne visent aucune famille.*
    expect(valider(ligne(saine))).toBeNull();
    expect(
      valider(ligne({ ...saine, [COLONNES_PRESTATIONS.famille]: "  " })),
    ).toBeNull();
  });

  it("une famille NOMMÉE et inconnue est REJETÉE, et le motif dit où corriger", () => {
    // *Une saisie refusée se corrige dans le FICHIER, un parent introuvable se
    // corrige dans le PARC.* Rendre le même code ferait chercher au mauvais
    // endroit.
    expect(
      valider(ligne({ ...saine, [COLONNES_PRESTATIONS.famille]: "INCONNUE" })),
    ).toBe(MOTIF_PARENT_INTROUVABLE);
  });
});

describe("ce que le gabarit refuse par la SAISIE", () => {
  it("une durée illisible est une saisie refusée, jamais une absence", () => {
    // *Rendre `undefined` pour une cellule illisible serait un piège* : le
    // schéma porte `.default(null)`, et une faute de frappe deviendrait une
    // durée absente, en silence.
    expect(
      valider(
        ligne({
          [COLONNES_PRESTATIONS.code]: "ENT",
          [COLONNES_PRESTATIONS.libelle]: "Entretien",
          [COLONNES_PRESTATIONS.dureeStandard]: "quatre-vingt-dix",
        }),
      ),
    ).toBe(MOTIF_SAISIE_REFUSEE);
  });

  it("ZÉRO minute est refusé — une prestation qui dure zéro n'en est pas une", () => {
    expect(
      valider(
        ligne({
          [COLONNES_PRESTATIONS.code]: "ENT",
          [COLONNES_PRESTATIONS.libelle]: "Entretien",
          [COLONNES_PRESTATIONS.dureeStandard]: "0",
        }),
      ),
    ).toBe(MOTIF_SAISIE_REFUSEE);
  });

  it("un code vide n'a AUCUNE clé de référence — il tombe sur son rang", () => {
    // *Un gabarit et une ligne vide ne portent aucune clé* : leur en inventer
    // une les ferait entrer dans l'espace des clés réelles, où deux lignes
    // muettes deviendraient la même prestation.
    expect(
      modele.cle(ligne({ [COLONNES_PRESTATIONS.libelle]: "x" }), 7),
    ).toEqual({ forme: "rang", cle: "LIGNE-7", complet: false });
  });

  it("LE CAS QUI DOIT RESTER VERT — un code renseigné donne une clé de référence", () => {
    expect(
      modele.cle(ligne({ [COLONNES_PRESTATIONS.code]: "ENT-PONT" }), 7).forme,
    ).toBe("reference");
  });
});
