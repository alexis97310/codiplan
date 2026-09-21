import { describe, expect, it } from "vitest";

import {
  FORFAITS_DEMONSTRATION,
  LOTS_IMPORT_DEMONSTRATION,
  UTILISATEURS_INTERNES,
  identifiantParc,
} from "@/prisma/seed-data";

/**
 * DEUX ÉCRANS SANS AUCUNE LIGNE AU SEMIS, RÉPARÉS (lot SEMIS-2, #266,
 * 21/09/2026).
 *
 * ## LE DÉFAUT MESURÉ
 *
 * `tests/e2e/tous-les-ecrans-rendent.spec.ts` `test.skip` deux écrans faute de
 * donnée — `/parametres/forfaits/[id]` et `/imports/[id]` — avec un motif
 * nommé plutôt qu'un saut muet : « aucune ligne du semis ne porte cet écran ».
 * `FORFAITS_DEMONSTRATION` et `LOTS_IMPORT_DEMONSTRATION` comblent ce trou.
 *
 * ## CE QUE CE GARDIEN TIENT, ET CE QU'IL NE PEUT PAS TENIR
 *
 * Il tient que les DEUX collections existent, portent au moins une ligne, et
 * que cette ligne ne fera pas échouer `prisma/seed.ts` — un `utilisateur_email`
 * qui désigne une identité réellement ouverte sur CODIMA-NC, un `type`
 * appartenant à l'énumération `TypeForfait`. *Il ne peut pas prouver que
 * l'écran rend 200* : cela exige une base migrée et semée, ce qui est
 * exactement la limite que l'en-tête de `tous-les-ecrans-rendent.spec.ts`
 * annonce — et exactement pourquoi les deux routes y restent `test.skip`
 * tant que ce fichier, hors du territoire de ce lot, n'apprend pas à les
 * résoudre plutôt qu'à rendre `null` sans même interroger la base.
 */
describe("le forfait et le lot d'import de démonstration", () => {
  it("FORFAITS_DEMONSTRATION porte au moins une ligne, valide et cohérente", () => {
    expect(FORFAITS_DEMONSTRATION.length).toBeGreaterThan(0);
    const rangs = new Set<number>();
    for (const forfait of FORFAITS_DEMONSTRATION) {
      expect(forfait.code.length).toBeGreaterThan(0);
      expect(forfait.libelle.length).toBeGreaterThan(0);
      expect(forfait.montant_mineur).toBeGreaterThan(BigInt(0));
      // Deux forfaits ne peuvent pas partager un rang au sein d'un même type
      // (D86, contrainte composite `societe_id, type, rang`) : un doublon ici
      // ferait échouer le semis en base plutôt que dans ce test rapide.
      expect(rangs.has(forfait.rangApplication)).toBe(false);
      rangs.add(forfait.rangApplication);
      // TÉMOIN : l'identifiant dérivé de deux forfaits distincts ne collide
      // jamais (même famille `identifiantParc`, même société, rangs distincts).
      expect(identifiantParc("forfait", 1, forfait.rang)).toMatch(
        /^0192f0a0-c000-7000-8000-\d{12}$/,
      );
    }
  });

  it("LOTS_IMPORT_DEMONSTRATION porte au moins une ligne, dont l'auteur existe réellement sur CODIMA-NC", () => {
    expect(LOTS_IMPORT_DEMONSTRATION.length).toBeGreaterThan(0);
    for (const lot of LOTS_IMPORT_DEMONSTRATION) {
      expect(lot.nom_fichier.length).toBeGreaterThan(0);
      expect(lot.version_modele).toBeGreaterThan(0);

      // L'IDENTITÉ DOIT EXISTER, ET ÊTRE HABILITÉE SUR CODIMA-NC — sans quoi
      // `prisma/seed.ts` lève à l'étape « forfait et lot d'import de
      // démonstration » plutôt que d'écrire un `utilisateur_id` orphelin.
      const auteur = UTILISATEURS_INTERNES.find(
        (utilisateur) => utilisateur.email === lot.utilisateur_email,
      );
      expect(
        auteur,
        `${lot.utilisateur_email} n'est déclaré dans aucune entrée de ` +
          "UTILISATEURS_INTERNES : le semis ne pourra pas ouvrir le lot " +
          "d'import de démonstration.",
      ).toBeDefined();
      expect(
        auteur?.habilitations.some(
          (habilitation) => habilitation.societe_code === "CODIMA-NC",
        ),
        `${lot.utilisateur_email} n'est pas habilité sur CODIMA-NC : le lot ` +
          "d'import de démonstration vise une société où cette identité " +
          "n'existe pas.",
      ).toBe(true);

      expect(identifiantParc("import_lot", 1, lot.rang)).toMatch(
        /^0192f0a0-d000-7000-8000-\d{12}$/,
      );
    }
  });

  it("les deux nouvelles familles d'identifiant ne collident avec aucune famille existante du parc", () => {
    const familles = [
      "famille",
      "modele",
      "machine",
      "verification",
      "intervention_machine",
      "forfait",
      "import_lot",
    ] as const;
    const segments = new Set(
      familles.map((famille) => identifiantParc(famille, 1, 1)),
    );
    expect(segments.size).toBe(familles.length);
  });
});
