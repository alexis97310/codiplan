// @vitest-environment node
//
// MESURÉ : sous `jsdom` (l'environnement par défaut du projet « unit »), le
// `Buffer` du logo/de la signature franchit la frontière vers `pdfkit`
// (dépendance transitive de `@react-pdf/renderer`) sous une IDENTITÉ
// DIFFÉRENTE de celle que `Buffer.isBuffer` y reconnaît — `pdfkit` retombe
// alors sur `fs.readFileSync(buffer)`, qui refuse (« path must be a string »).
// Rejoué en Node pur (hors Vitest), le même appel rend un PDF valide : la
// bibliothèque n'est pas en cause, l'environnement de test l'est. Ce PDF
// n'est jamais rendu dans un navigateur (c'est une route serveur, Node) —
// l'environnement `node` colle exactement à l'exécution réelle, `jsdom` ne
// le ferait que par défaut de ce projet.
import { describe, expect, it } from "vitest";

import { genererBonPretPDF, type DonneesBonPretPdf } from "@/lib/prets/bon-pdf";

/**
 * LE CONTENU DU BON DE PRÊT (9L62-PRET-3-BON-SIGNE) — `genererBonPretPDF` ne
 * touche jamais la base (voir `creerBonPretDans`, `lib/prets/bon.ts`, qui la
 * lit et lui fournit tout) : cette épreuve reste donc un test UNITAIRE, sans
 * base jetable, et porte sur le PDF produit lui-même.
 */

const SIGNATURE_PNG_TEST =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function donnees(signature: DonneesBonPretPdf["signature"]): DonneesBonPretPdf {
  return {
    numeroBon: "PRET-ABCDEF",
    societe: { raisonSociale: "CODIMA Essai", logo: null },
    client: "Client Essai",
    site: "Site Essai",
    interventionReference: "INT-2026-0042",
    appareil: {
      designation: "Groupe électrogène",
      marque: "Marque",
      modele: "Modèle 3000",
      numeroSerie: "SN-001",
    },
    etatDepart: "Bon état, plein de carburant",
    dateSortie: new Date(Date.UTC(2026, 10, 27)),
    dateRetourPrevue: new Date(Date.UTC(2026, 11, 4)),
    signature,
  };
}

/** Les quatre octets qui ouvrent tout fichier PDF — la preuve la plus simple qu'un VRAI PDF a été rendu, pas un texte qui y ressemble. */
function magiquePdf(octets: Buffer): string {
  return octets.subarray(0, 4).toString("latin1");
}

describe("genererBonPretPDF — le contenu du bon (9L62-PRET-3-BON-SIGNE)", () => {
  it("rend un PDF figé pour une remise SIGNÉE, sous le plafond de 1 Mo (D96)", async () => {
    const octets = await genererBonPretPDF(
      donnees({
        imageDonnees: SIGNATURE_PNG_TEST,
        nom: "Jean Essai",
        qualite: "Gérant",
      }),
    );
    expect(magiquePdf(octets)).toBe("%PDF");
    expect(octets.byteLength).toBeGreaterThan(0);
    expect(octets.byteLength).toBeLessThan(1024 * 1024);
  });

  it("rend un PDF figé pour une remise SANS SIGNATURE, avec son motif", async () => {
    const octets = await genererBonPretPDF(
      donnees({ motifAbsence: "Client absent au moment de la remise." }),
    );
    expect(magiquePdf(octets)).toBe("%PDF");
    expect(octets.byteLength).toBeGreaterThan(0);
  });

  it("ne porte AUCUN montant dans les données qu'il reçoit (décision 2, D287)", () => {
    const valeur = donnees({ motifAbsence: "Refus de signer." });
    // AUCUNE clé de ce type n'existe sur `DonneesBonPretPdf` — la preuve est
    // au TYPE (voir son docblock), cette ligne ne fait que le dire au test :
    // un montant ajouté un jour à ce type ferait échouer cette assertion,
    // jamais la compilation seule.
    expect(Object.keys(valeur)).not.toContain("montant");
    expect(JSON.stringify(valeur).toLowerCase()).not.toContain("montant");
  });
});
