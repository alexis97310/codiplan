import { describe, expect, it } from "vitest";

import {
  dureesParEtat,
  type LigneHistoriqueEtat,
} from "@/lib/interventions/durees-par-etat";

type Statut = "a" | "b" | "c";

function ligne(
  statutAvant: Statut | null,
  statutApres: Statut,
  changeLe: string,
): LigneHistoriqueEtat<Statut> {
  return { statutAvant, statutApres, changeLe: new Date(changeLe) };
}

describe("dureesParEtat — passages multiples dans un même état", () => {
  it("cumule les deux séjours dans le même état, pas seulement le dernier", () => {
    const historique: LigneHistoriqueEtat<Statut>[] = [
      ligne(null, "a", "2026-10-01T00:00:00.000Z"),
      ligne("a", "b", "2026-10-01T01:00:00.000Z"), // "a" : 1h
      ligne("b", "a", "2026-10-01T02:00:00.000Z"), // "b" : 1h
      ligne("a", "c", "2026-10-01T04:00:00.000Z"), // "a" : 2h de plus
    ];
    const resultat = dureesParEtat(
      historique,
      "c",
      new Date("2026-10-01T05:00:00.000Z"),
    );
    expect(resultat.dureesCumuleesMs.get("a")).toBe(3 * 3600_000);
    expect(resultat.dureesCumuleesMs.get("b")).toBe(1 * 3600_000);
    expect(resultat.historiqueIncomplet).toBe(false);
  });
});

describe("dureesParEtat — état courant ouvert", () => {
  it("compte le temps jusqu'à « maintenant » pour le dernier état", () => {
    const historique: LigneHistoriqueEtat<Statut>[] = [
      ligne(null, "a", "2026-10-01T00:00:00.000Z"),
      ligne("a", "b", "2026-10-01T01:00:00.000Z"),
    ];
    const maintenant = new Date("2026-10-01T01:30:00.000Z");
    const resultat = dureesParEtat(historique, "b", maintenant);
    expect(resultat.etatCourant).toBe("b");
    expect(resultat.dureeEnCoursMs).toBe(30 * 60_000);
    expect(resultat.dureesCumuleesMs.get("b")).toBe(30 * 60_000);
    expect(resultat.dureesCumuleesMs.get("a")).toBe(1 * 3600_000);
  });
});

describe("dureesParEtat — historique vide", () => {
  it("ne sait rien : pas de date de début, pas de durée en cours, drapeau posé", () => {
    const resultat = dureesParEtat(
      [],
      "a",
      new Date("2026-10-01T00:00:00.000Z"),
    );
    expect(resultat.dureesCumuleesMs.size).toBe(0);
    expect(resultat.etatCourant).toBe("a");
    expect(resultat.dureeEnCoursMs).toBeNull();
    expect(resultat.depuisLe).toBeNull();
    expect(resultat.historiqueIncomplet).toBe(true);
  });
});

describe("dureesParEtat — historique incomplet (objet créé avant la migration)", () => {
  it("pose le drapeau et la date de début quand la première ligne n'est pas une création", () => {
    const historique: LigneHistoriqueEtat<Statut>[] = [
      // statutAvant non NULL dès la première ligne connue : il manque l'INSERT.
      ligne("a", "b", "2026-10-01T01:00:00.000Z"),
    ];
    const resultat = dureesParEtat(
      historique,
      "b",
      new Date("2026-10-01T02:00:00.000Z"),
    );
    expect(resultat.historiqueIncomplet).toBe(true);
    expect(resultat.depuisLe).toEqual(new Date("2026-10-01T01:00:00.000Z"));
    // Le temps AVANT cette ligne n'est pas inventé à zéro : il n'apparaît
    // simplement dans aucun total.
    expect(resultat.dureesCumuleesMs.get("a")).toBeUndefined();
    expect(resultat.dureesCumuleesMs.get("b")).toBe(3600_000);
  });
});

describe("dureesParEtat — un UPDATE sans changement réel n'a pas de ligne à lire", () => {
  it("un historique à une seule ligne malgré plusieurs écritures ne fausse rien", () => {
    // Le déclencheur ne pose pas de ligne pour un UPDATE qui ne change pas le
    // statut (gardé en isolation) : ce module ne voit donc que des lignes où
    // le statut a réellement changé, et n'a rien de spécial à faire pour ce
    // cas — il est transparent, pas un cas particulier du calcul.
    const historique: LigneHistoriqueEtat<Statut>[] = [
      ligne(null, "a", "2026-10-01T00:00:00.000Z"),
    ];
    const resultat = dureesParEtat(
      historique,
      "a",
      new Date("2026-10-01T03:00:00.000Z"),
    );
    expect(resultat.dureesCumuleesMs.get("a")).toBe(3 * 3600_000);
    expect(resultat.historiqueIncomplet).toBe(false);
  });
});
