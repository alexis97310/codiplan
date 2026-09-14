import { describe, expect, it } from "vitest";

import {
  absenceCouvrant,
  interventionsADeplanifier,
  periodesBloquees,
  type AbsenceDeclaree,
} from "../../../lib/absences/periode";

/**
 * RG-PLA-06 — LA RÈGLE, éprouvée sur des tableaux (L3-04, L3-17).
 *
 * ## Ce que ce fichier mesure et que l'isolation ne mesure pas
 *
 * Les scénarios d'isolation prouvent que la BASE refuse et que les chemins
 * décident pareil. Ils ne peuvent pas éprouver les **bornes** d'une règle :
 * il faudrait une ligne en base par cas, et le cas qui compte le plus —
 * *deux blocages qui se recouvrent* — demanderait de fabriquer exactement
 * l'état qu'on veut interdire.
 *
 * ## IL N'Y A PLUS D'ÉTAT À ÉPROUVER (R3-14, 14/09/2026)
 *
 * Les scénarios « une DEMANDÉE ne retranche rien » et « une REFUSÉE non plus »
 * ont disparu avec la colonne qu'ils lisaient : *CODIPLAN n'est pas un outil de
 * gestion des ressources humaines*, et un cycle demandée → validée → refusée
 * est un circuit d'approbation de congés. **Toute ligne bloque.** Ce qui reste
 * à éprouver est donc la période, et elle seule — et les deux voisins qui
 * doivent rester verts pour leur propre raison sont désormais *l'autre
 * personne* et *l'autre semaine*.
 */

const TEC = "0192f0a0-3000-7000-8000-00000000000a";
const AUTRE = "0192f0a0-3000-7000-8000-00000000000b";

function absence(du: string, au: string, utilisateur = TEC): AbsenceDeclaree {
  return {
    id: `${du}-${au}`,
    utilisateur_id: utilisateur,
    du: new Date(`${du}T00:00:00.000Z`),
    au: new Date(`${au}T00:00:00.000Z`),
  };
}

const SEMAINE = {
  du: new Date("2026-09-14T00:00:00.000Z"),
  au: new Date("2026-09-21T00:00:00.000Z"),
};

/** Les bornes rendues, en `AAAA-MM-JJ`, pour que l'assertion se lise. */
function lisible(
  periodes: readonly { du: Date; au: Date }[],
): { du: string; au: string }[] {
  return periodes.map((p) => ({
    du: p.du.toISOString().slice(0, 10),
    au: p.au.toISOString().slice(0, 10),
  }));
}

describe("les périodes bloquées, fusionnées et bornées (L3-17)", () => {
  it("LE CAS QUI COMPTE — deux blocages qui SE RECOUVRENT n'en font qu'un", () => {
    // **C'est la faute qui rendrait un dénominateur NÉGATIF.** Une semaine du 14
    // au 18 prolongée par une seconde ligne du 16 au 20 est un état que rien
    // n'interdit — c'est même le cas ordinaire. Retranchées séparément, les journées des 16,
    // 17 et 18 seraient comptées DEUX fois, et le taux d'occupation
    // dépasserait 100 % ou porterait un signe moins.
    const periodes = periodesBloquees(
      [
        absence("2026-09-14", "2026-09-18"),
        absence("2026-09-16", "2026-09-20"),
      ],
      TEC,
      SEMAINE,
    );
    expect(lisible(periodes)).toEqual([
      // La borne haute est la FIN du 20, soit le 21 à zéro heure : les bornes
      // d'un blocage sont comprises.
      { du: "2026-09-14", au: "2026-09-21" },
    ]);
  });

  it("deux blocages qui SE TOUCHENT d'un jour à l'autre n'en font qu'un non plus", () => {
    // *Le chiffre ne doit pas dépendre de la façon dont le blocage a été
    // saisi* : « du 14 au 15 » puis « du 16 au 18 » est la même semaine
    // bloquée que « du 14 au 18 », et personne ne doit lire deux périodes là
    // où il y en a une.
    const periodes = periodesBloquees(
      [
        absence("2026-09-14", "2026-09-15"),
        absence("2026-09-16", "2026-09-18"),
      ],
      TEC,
      SEMAINE,
    );
    expect(periodes).toHaveLength(1);
  });

  it("deux blocages SÉPARÉS restent deux — le vert pour sa propre raison", () => {
    // §9 du 11/09 : à côté du cas qui doit fusionner, un cas qui doit rester
    // vert POUR SA PROPRE RAISON. Son voisin lui ressemble à un jour près — et
    // une fusion trop gourmande passerait les deux scénarios précédents en
    // tombant ici.
    const periodes = periodesBloquees(
      [
        absence("2026-09-14", "2026-09-15"),
        absence("2026-09-18", "2026-09-19"),
      ],
      TEC,
      SEMAINE,
    );
    expect(periodes).toHaveLength(2);
  });

  it("elle est BORNÉE à la fenêtre — un mois bloqué ne vide pas la semaine d'à côté", () => {
    const periodes = periodesBloquees(
      [absence("2026-09-01", "2026-09-30")],
      TEC,
      SEMAINE,
    );
    expect(lisible(periodes)).toEqual([{ du: "2026-09-14", au: "2026-09-22" }]);
  });

  it("TOUTE ligne retranche — il n'y a plus d'état qui suspende l'effet", () => {
    // **Le vert qui remplace les deux scénarios d'état.** Avant R3-14, une
    // absence pouvait exister sans rien retrancher ; c'est précisément ce qui
    // n'est plus vrai, et le mesurer vaut mieux que de le déduire de l'absence
    // d'un scénario.
    expect(
      periodesBloquees([absence("2026-09-14", "2026-09-18")], TEC, SEMAINE),
    ).toHaveLength(1);
  });

  it("le blocage d'un AUTRE technicien ne retranche rien", () => {
    expect(
      periodesBloquees(
        [absence("2026-09-14", "2026-09-18", AUTRE)],
        TEC,
        SEMAINE,
      ),
    ).toEqual([]);
  });

  it("un blocage HORS de la fenêtre ne retranche rien", () => {
    // Le second voisin : même personne, **une autre semaine**.
    expect(
      periodesBloquees([absence("2026-10-05", "2026-10-09")], TEC, SEMAINE),
    ).toEqual([]);
  });

  it("la FILE D'ATTENTE n'a pas de dénominateur, donc rien à retrancher", () => {
    expect(
      periodesBloquees([absence("2026-09-14", "2026-09-18")], null, SEMAINE),
    ).toEqual([]);
  });
});

describe("le blocage qui couvre un jour (RG-PLA-06)", () => {
  it("les BORNES sont comprises des deux côtés", () => {
    const absences = [absence("2026-09-14", "2026-09-18")];
    const jour = (j: string) => new Date(`${j}T00:00:00.000Z`);
    expect(absenceCouvrant(absences, TEC, jour("2026-09-14"))).not.toBeNull();
    expect(absenceCouvrant(absences, TEC, jour("2026-09-18"))).not.toBeNull();
    // Et le vert pour sa propre raison, de part et d'autre : la veille et le
    // lendemain ne sont PAS couverts.
    expect(absenceCouvrant(absences, TEC, jour("2026-09-13"))).toBeNull();
    expect(absenceCouvrant(absences, TEC, jour("2026-09-19"))).toBeNull();
  });
});

describe("ce qu'un blocage rend à la file (RG-PLA-06)", () => {
  const posee = (id: string, jour: string | null, statut: string) => ({
    id,
    technicien_id: TEC,
    date_planifiee: jour === null ? null : new Date(`${jour}T00:00:00.000Z`),
    statut,
  });

  it("elle ne touche NI ce qui a eu lieu, NI ce qui n'occupe rien — deux motifs distincts", () => {
    // *L'une n'a rien à rendre, l'autre a quelque chose à protéger* (I5).
    const rendues = interventionsADeplanifier(
      [
        posee("planifiee", "2026-09-15", "planifiee"),
        posee("annulee", "2026-09-15", "annulee"),
        posee("cloturee", "2026-09-15", "cloturee"),
        posee("terminee", "2026-09-15", "terminee"),
        posee("en_cours", "2026-09-15", "en_cours"),
        posee("sans_date", null, "a_planifier"),
      ],
      absence("2026-09-14", "2026-09-18"),
    );
    expect(rendues).toEqual(["planifiee"]);
  });
});
