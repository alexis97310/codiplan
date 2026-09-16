import { describe, expect, it } from "vitest";

import { lireClasseur } from "@/lib/excel/classeur";
import { classeurDesRejets } from "@/lib/excel/ecriture";

/**
 * L'ÉCRITURE D'UN CLASSEUR — `write-excel-file`, ADOPTÉE le 16/09/2026 (point 3
 * de la session : le fichier annoté des rejets, RG-IMP-03).
 *
 * **Elle ne se croit pas sur parole** : ce qu'elle écrit est RELU par
 * `lireClasseur` — la même liaison que le contrôle emploie — pour prouver que
 * le fichier produit est bien celui qu'un import saurait recharger, dans la
 * forme exacte que D31 attend (marqueur, en-têtes, données).
 */
describe("le fichier annoté des rejets (RG-IMP-03)", () => {
  it("pose le marqueur, les en-têtes du fichier puis « Motif du rejet », et les valeurs", async () => {
    const classeur = await classeurDesRejets("sites", 1, [
      {
        valeurs: {
          "Client (code ou raison sociale)": "GARAGE DUPOND",
          "Libellé du site": "Atelier",
        },
        motifLisible: "Aucun client ne répond à cette colonne.",
      },
      {
        valeurs: {
          "Client (code ou raison sociale)": "GARAGE DUPONT",
          "Libellé du site": "Dépôt",
        },
        motifLisible: "Aucun client ne répond à cette colonne.",
      },
    ]);

    expect(Buffer.isBuffer(classeur)).toBe(true);

    const feuilles = await lireClasseur(classeur);
    const lignes = feuilles[0]?.lignes ?? [];

    expect(lignes[0]?.[0]).toEqual({ texte: "CODIPLAN-sites-v1" });
    expect(lignes[1]?.map((c) => c?.texte)).toEqual([
      "Client (code ou raison sociale)",
      "Libellé du site",
      "Motif du rejet",
    ]);
    expect(lignes[2]?.map((c) => c?.texte)).toEqual([
      "GARAGE DUPOND",
      "Atelier",
      "Aucun client ne répond à cette colonne.",
    ]);
    expect(lignes[3]?.map((c) => c?.texte)).toEqual([
      "GARAGE DUPONT",
      "Dépôt",
      "Aucun client ne répond à cette colonne.",
    ]);
  });

  it("n'écrit que le marqueur et l'en-tête « Motif du rejet » quand il n'y a aucune ligne", async () => {
    // Cas limite mesuré : le lien de l'écran ne s'affiche que s'il y a au
    // moins un rejet, mais la fonction elle-même ne le suppose pas — un appel
    // direct avec zéro ligne ne doit pas lever.
    const classeur = await classeurDesRejets("clients", 1, []);
    const feuilles = await lireClasseur(classeur);
    const lignes = feuilles[0]?.lignes ?? [];

    expect(lignes[0]?.[0]).toEqual({ texte: "CODIPLAN-clients-v1" });
    expect(lignes[1]?.map((c) => c?.texte)).toEqual(["Motif du rejet"]);
    expect(lignes.length).toBe(2);
  });
});
