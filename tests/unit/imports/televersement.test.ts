import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MAXIMUM_NOM,
  MAXIMUM_OCTETS,
  MOTIF_TELEVERSEMENT,
  lireLeTeleversement,
} from "@/lib/imports/televersement";

/**
 * CE QU'UN TÉLÉVERSEMENT DOIT ÊTRE AVANT D'ÊTRE LU (L1-11).
 *
 * **Ces refus sont les premiers qu'un fichier rencontre**, et ils sont écrits
 * dans un module plutôt que dans la route parce qu'une route de Next.js n'est
 * éprouvable qu'en démarrant un serveur. *Une garantie qu'on ne peut mesurer
 * qu'en lançant le produit n'est pas une garantie qu'on mesure.*
 *
 * **CHAQUE REFUS A SON JUMEAU QUI DOIT RESTER VERT POUR SA PROPRE RAISON**
 * (§9, 11/09) : à côté du cas qui rougit, le cas voisin qui passe — et qui
 * passerait aussi si le motif confondait deux causes. *Une mise en échec
 * n'éprouve que la direction qui rougit ; la direction permissive ne produit
 * aucun signal.*
 */

const FIXTURE = join(process.cwd(), "tests/fixtures/dates-excel.xlsx");

/** Un `File` de test — la forme exacte que `FormData` rend à une route. */
function fichier(nom: string, octets: Uint8Array): File {
  return new File([octets as BlobPart], nom);
}

describe("un téléversement est refusé avant d'être lu", () => {
  it("REFUSE ce qui n'est pas un fichier — et accepte un fichier", async () => {
    expect((await lireLeTeleversement(null)).accepte).toBe(false);
    expect((await lireLeTeleversement("classeur.xlsx")).accepte).toBe(false);
    const refus = await lireLeTeleversement(undefined);
    expect(refus.accepte).toBe(false);
    if (refus.accepte) return;
    expect(refus.motif).toBe(MOTIF_TELEVERSEMENT.absent);

    // LE JUMEAU QUI DOIT RESTER VERT : un vrai fichier passe. Sans lui, un
    // module qui refuserait TOUT satisferait les trois lignes ci-dessus.
    const bon = await lireLeTeleversement(
      fichier("parc.xlsx", readFileSync(FIXTURE)),
    );
    expect(bon.accepte).toBe(true);
  });

  it("REFUSE tout ce qui n'est pas `.xlsx` — le §2 interdit le CSV", async () => {
    const csv = await lireLeTeleversement(
      fichier("clients.csv", new Uint8Array([1, 2, 3])),
    );
    expect(csv.accepte).toBe(false);
    if (csv.accepte) return;
    expect(csv.motif).toBe(MOTIF_TELEVERSEMENT.extension);

    // Et il reste vert POUR SA PROPRE RAISON sur la casse : « .XLSX » est la
    // même extension. *Un refus sur la casse ferait échouer un fichier sain
    // venu d'un autre système d'exploitation.*
    const majuscules = await lireLeTeleversement(
      fichier("PARC.XLSX", readFileSync(FIXTURE)),
    );
    expect(majuscules.accepte).toBe(true);
  });

  it("REFUSE un fichier vide, et le distingue d'un fichier absent", async () => {
    const vide = await lireLeTeleversement(
      fichier("vide.xlsx", new Uint8Array(0)),
    );
    expect(vide.accepte).toBe(false);
    if (vide.accepte) return;
    // *« Aucun fichier » et « un fichier vide » ne se corrigent pas au même
    // endroit* : l'un est un formulaire mal rempli, l'autre un fichier abîmé.
    expect(vide.motif).toBe(MOTIF_TELEVERSEMENT.vide);
    expect(vide.motif).not.toBe(MOTIF_TELEVERSEMENT.absent);
  });

  it("REFUSE au-delà du plafond, et LE PLAFOND EST MESURÉ", async () => {
    // Le témoin de la borne : le classeur RÉEL tient très largement dessous.
    // *Un plafond qu'on ne rapporte à rien est un chiffre inventé (§8)* ; ici
    // il s'adosse au seul fichier réel que le projet ait lu.
    const reel = readFileSync(FIXTURE).length;
    expect(reel).toBeLessThan(MAXIMUM_OCTETS);
    expect(MAXIMUM_OCTETS / reel).toBeGreaterThan(100);

    // La taille est lue SUR LE FICHIER, jamais après avoir tout chargé : le
    // `File` de test annonce sa taille sans qu'on lise ses octets.
    const enorme = fichier("enorme.xlsx", new Uint8Array(8));
    Object.defineProperty(enorme, "size", { value: MAXIMUM_OCTETS + 1 });
    const refus = await lireLeTeleversement(enorme);
    expect(refus.accepte).toBe(false);
    if (refus.accepte) return;
    expect(refus.motif).toBe(MOTIF_TELEVERSEMENT.trop_gros);

    // ET LE JUMEAU, à la borne exacte : un fichier DE la taille du plafond
    // passe. *Un « >= » écrit à la place d'un « > » refuserait le cas limite
    // sans que rien ne le dise.*
    const juste = fichier("juste.xlsx", readFileSync(FIXTURE));
    Object.defineProperty(juste, "size", { value: MAXIMUM_OCTETS });
    expect((await lireLeTeleversement(juste)).accepte).toBe(true);
  });

  it("BORNE le nom repris dans le rapport, sans le vider", async () => {
    const long = `${"a".repeat(400)}.xlsx`;
    const lu = await lireLeTeleversement(fichier(long, readFileSync(FIXTURE)));
    expect(lu.accepte).toBe(true);
    if (!lu.accepte) return;
    expect(lu.nom.length).toBe(MAXIMUM_NOM);
    // *Un nom borné reste un nom* : il commence par ce que l'utilisateur a
    // écrit, et il n'est jamais rendu vide.
    expect(lu.nom.startsWith("aaa")).toBe(true);
  });

  it("rend des OCTETS, et ce sont ceux du fichier", async () => {
    const source = readFileSync(FIXTURE);
    const lu = await lireLeTeleversement(fichier("parc.xlsx", source));
    expect(lu.accepte).toBe(true);
    if (!lu.accepte) return;
    expect(lu.octets.length).toBe(source.length);
    expect(lu.octets.equals(source)).toBe(true);
  });
});
