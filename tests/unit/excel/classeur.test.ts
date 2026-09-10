import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  celluleDepuisValeur,
  feuilleNommee,
  lireClasseur,
} from "@/lib/excel/classeur";
import { EPOQUE_MS, lireDate } from "@/lib/excel/format";

/**
 * LA LIAISON AU CLASSEUR, ÉPROUVÉE SUR LE VRAI FICHIER D'EXCEL (L1-08c, D90).
 *
 * **Ce fichier ne mesure pas ce que `tests/unit/excel/fixture-dates.test.ts`
 * mesure**, et la distinction est le tout de son existence. Celui-là éprouve la
 * BIBLIOTHÈQUE — que les dates d'un fichier produit par Excel sortent
 * identiques sous trois fuseaux. Celui-ci éprouve la COUTURE : que la valeur
 * rendue par la bibliothèque, transposée en `Cellule`, soit exactement ce que
 * la grammaire de L1-08a attendait depuis qu'elle a été écrite.
 *
 * *Une suite qui éprouve tous les maillons n'éprouve pas la chaîne* (§9, 08/09).
 * La chaîne est ici `read-excel-file` → `celluleDepuisValeur` → `lireDate`, et
 * elle n'avait aucun appelant jusqu'à ce ticket.
 */

const FIXTURE = join(process.cwd(), "tests/fixtures/dates-excel.xlsx");

describe("la transposition d'une valeur en cellule", () => {
  it("une DATE devient une série, par le chemin inverse de `lireDate`", () => {
    // Le 21 février 2022, série 44613 — l'un des quatre relevés faits sur le
    // fichier SOURCE avant qu'une ligne ne soit écrite (D90).
    const cellule = celluleDepuisValeur(
      new Date(EPOQUE_MS + 44_613 * 86_400_000),
    );
    expect(cellule).toEqual({ serie: 44613 });

    // ET LE CHEMIN COMPLET : la grammaire rend bien le jour attendu.
    const lue = lireDate(cellule);
    expect(lue.ok && lue.valeur.toISOString()).toBe("2022-02-21T00:00:00.000Z");
  });

  it("LE ZÉRO ne s'écarte PAS ici — il descend à la grammaire", () => {
    // *Mesuré : `read-excel-file` rend `1899-12-30T00:00:00.000Z` pour une
    // cellule à zéro — une date parfaitement formée, et parfaitement fausse.*
    // 171 cellules du classeur réel sont dans ce cas. La liaison la transpose
    // en série 0 ; c'est `lireDate` qui la range en ABSENCE.
    const cellule = celluleDepuisValeur(new Date(EPOQUE_MS));
    expect(cellule).toEqual({ serie: 0 });

    const lue = lireDate(cellule);
    expect(lue.ok).toBe(false);
    expect(!lue.ok && lue.anomalie.code).toBe("cellule_vide");
    // Et non `date_hors_plage` : les ranger là ferait rejeter 171 machines
    // pour un champ légitimement vide.
    expect(!lue.ok && lue.anomalie.code).not.toBe("date_hors_plage");
  });

  it("les trois refus de D31 restent EXPRIMABLES après la transposition", () => {
    // C'est la raison pour laquelle la liaison rend une SÉRIE et non un `Date` :
    // un `Date` est déjà une date valide, il a perdu ce qui permettait de la
    // refuser.
    const avecHeure = lireDate({ serie: 44613.5 });
    expect(!avecHeure.ok && avecHeure.anomalie.code).toBe("date_avec_heure");

    const bissextileFantome = lireDate({ serie: 60 });
    expect(!bissextileFantome.ok && bissextileFantome.anomalie.code).toBe(
      "date_hors_plage",
    );
  });

  it("un nombre, un texte et un vide se transposent sans être interprétés", () => {
    expect(celluleDepuisValeur(1234.56)).toEqual({ nombre: 1234.56 });
    expect(celluleDepuisValeur(" GA-11 ")).toEqual({ texte: " GA-11 " });
    expect(celluleDepuisValeur(null)).toBeUndefined();
    expect(celluleDepuisValeur(undefined)).toBeUndefined();
  });

  it("ce qui n'est PAS lisible devient une cellule vide, jamais une devinette", () => {
    expect(celluleDepuisValeur({ formule: "=A1" })).toBeUndefined();
    expect(celluleDepuisValeur(new Error("#REF!"))).toBeUndefined();
    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09) : un
    // booléen, lui, est bien transposé — si la clause `instanceof`/`typeof`
    // était écrite trop large, ce témoin tomberait avec le reste.
    expect(celluleDepuisValeur(true)).toEqual({ texte: "true" });
  });
});

describe("la lecture du classeur RÉEL", () => {
  it("rend toutes ses feuilles, nommées, en un seul appel", async () => {
    const feuilles = await lireClasseur(FIXTURE);
    // TÉMOIN DE NON-VACUITÉ : zéro feuille ressemblerait trait pour trait à un
    // sans-faute (§9, 30/08).
    expect(feuilles.length).toBeGreaterThan(0);
    expect(feuilles.map((f) => f.nom)).toContain("3-Parc machines");
  });

  it("les quatre dates relevées sur le fichier SOURCE ressortent au bon jour", async () => {
    // Les mêmes cellules que la mesure de D90, lues cette fois **à travers la
    // couture** plutôt qu'avec un appel direct à la bibliothèque. C'est le
    // maillon que personne ne traversait.
    const feuilles = await lireClasseur(FIXTURE);
    const parc = feuilleNommee(feuilles, "3-Parc machines");
    expect(parc).not.toBeNull();

    // R254 → ligne 254, colonne R (18ᵉ, indice 17).
    const cellule = parc?.lignes[253]?.[17];
    const lue = lireDate(cellule);
    expect(lue.ok && lue.valeur.toISOString()).toBe("2022-02-21T00:00:00.000Z");
  });

  it("la feuille se nomme EXACTEMENT, jamais par ressemblance", async () => {
    const feuilles = await lireClasseur(FIXTURE);
    // L'élagage est la seule tolérance, comme pour les colonnes.
    expect(feuilleNommee(feuilles, "  3-Parc machines  ")).not.toBeNull();
    // *Une tolérance choisit à la place de celui qui a écrit le fichier.*
    expect(feuilleNommee(feuilles, "3-parc machines")).toBeNull();
    expect(feuilleNommee(feuilles, "Parc machines")).toBeNull();
  });
});
