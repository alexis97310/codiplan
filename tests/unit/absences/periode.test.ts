import { describe, expect, it } from "vitest";

import {
  absenceCouvrant,
  interventionsADeplanifier,
  periodesValidees,
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
 * *deux absences qui se recouvrent* — demanderait de fabriquer exactement
 * l'état qu'on veut interdire.
 */

const TEC = "0192f0a0-3000-7000-8000-00000000000a";
const AUTRE = "0192f0a0-3000-7000-8000-00000000000b";

function absence(
  du: string,
  au: string,
  statut = "validee",
  utilisateur = TEC,
): AbsenceDeclaree {
  return {
    id: `${du}-${au}`,
    utilisateur_id: utilisateur,
    du: new Date(`${du}T00:00:00.000Z`),
    au: new Date(`${au}T00:00:00.000Z`),
    statut,
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

describe("les périodes validées, fusionnées et bornées (L3-17)", () => {
  it("LE CAS QUI COMPTE — deux absences qui SE RECOUVRENT n'en font qu'une", () => {
    // **C'est la faute qui rendrait un dénominateur NÉGATIF.** Un congé du 14
    // au 18 prolongé par un arrêt du 16 au 20 est un état que rien n'interdit —
    // c'est même le cas ordinaire. Retranchées séparément, les journées des 16,
    // 17 et 18 seraient comptées DEUX fois, et le taux d'occupation
    // dépasserait 100 % ou porterait un signe moins.
    const periodes = periodesValidees(
      [
        absence("2026-09-14", "2026-09-18"),
        absence("2026-09-16", "2026-09-20"),
      ],
      TEC,
      SEMAINE,
    );
    expect(lisible(periodes)).toEqual([
      // La borne haute est la FIN du 20, soit le 21 à zéro heure : les bornes
      // d'une absence sont comprises.
      { du: "2026-09-14", au: "2026-09-21" },
    ]);
  });

  it("deux absences qui SE TOUCHENT d'un jour à l'autre n'en font qu'une non plus", () => {
    // *Le chiffre ne doit pas dépendre de la façon dont l'absence a été
    // saisie* : « du 14 au 15 » puis « du 16 au 18 » est la même semaine
    // d'absence que « du 14 au 18 », et personne ne doit lire deux périodes là
    // où il y en a une.
    const periodes = periodesValidees(
      [
        absence("2026-09-14", "2026-09-15"),
        absence("2026-09-16", "2026-09-18"),
      ],
      TEC,
      SEMAINE,
    );
    expect(periodes).toHaveLength(1);
  });

  it("deux absences SÉPARÉES restent deux — le vert pour sa propre raison", () => {
    // §9 du 11/09 : à côté du cas qui doit fusionner, un cas qui doit rester
    // vert POUR SA PROPRE RAISON. Son voisin lui ressemble à un jour près — et
    // une fusion trop gourmande passerait les deux scénarios précédents en
    // tombant ici.
    const periodes = periodesValidees(
      [
        absence("2026-09-14", "2026-09-15"),
        absence("2026-09-18", "2026-09-19"),
      ],
      TEC,
      SEMAINE,
    );
    expect(periodes).toHaveLength(2);
  });

  it("elle est BORNÉE à la fenêtre — un mois d'absence ne vide pas la semaine d'à côté", () => {
    const periodes = periodesValidees(
      [absence("2026-09-01", "2026-09-30")],
      TEC,
      SEMAINE,
    );
    expect(lisible(periodes)).toEqual([{ du: "2026-09-14", au: "2026-09-22" }]);
  });

  it("une DEMANDÉE et une REFUSÉE ne retranchent rien", () => {
    // *Retrancher une demande en attente ferait baisser un dénominateur qu'un
    // refus rétablirait le lendemain, sans que personne comprenne pourquoi le
    // taux a bougé.*
    expect(
      periodesValidees(
        [absence("2026-09-14", "2026-09-18", "demandee")],
        TEC,
        SEMAINE,
      ),
    ).toEqual([]);
    expect(
      periodesValidees(
        [absence("2026-09-14", "2026-09-18", "refusee")],
        TEC,
        SEMAINE,
      ),
    ).toEqual([]);
  });

  it("l'absence d'un AUTRE technicien ne retranche rien", () => {
    expect(
      periodesValidees(
        [absence("2026-09-14", "2026-09-18", "validee", AUTRE)],
        TEC,
        SEMAINE,
      ),
    ).toEqual([]);
  });

  it("la FILE D'ATTENTE n'a pas de dénominateur, donc rien à retrancher", () => {
    expect(
      periodesValidees([absence("2026-09-14", "2026-09-18")], null, SEMAINE),
    ).toEqual([]);
  });
});

describe("l'absence qui couvre un jour (RG-PLA-06)", () => {
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

describe("ce qu'une absence validée rend à la file (RG-PLA-06)", () => {
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
