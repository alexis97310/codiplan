import { AssujettissementVgp } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { ajouterMois, etatDeLInformation } from "@/lib/vgp/information";

/**
 * L'ÉTAT DE L'INFORMATION (L9-01, L9-02, D88).
 *
 * *Ce n'est pas un registre de conformité : c'est un registre de ce qu'on nous
 * a dit.* Le danger nommé par D88 est qu'**un registre à moitié rempli
 * ressemble à un registre complet** — c'est le §9 du 06/09 à l'échelle d'un
 * parc. Ce fichier mesure que les trois situations restent DISTINCTES.
 */

const LE_JOUR = new Date(Date.UTC(2026, 8, 12));

describe("L9-02 — « sans information » n'est ni « à jour » ni « en retard »", () => {
  it("les TROIS états sont distincts, sur les mêmes données", () => {
    const commun = {
      periodiciteMois: 12,
      depuis: new Date(Date.UTC(2024, 0, 1)),
      aujourdHui: LE_JOUR,
    };

    const horsRegistre = etatDeLInformation({
      ...commun,
      assujettissement: AssujettissementVgp.non_soumis,
      derniereInformation: null,
    });
    const sansNouvelles = etatDeLInformation({
      ...commun,
      assujettissement: AssujettissementVgp.soumis,
      derniereInformation: null,
    });
    const informe = etatDeLInformation({
      ...commun,
      assujettissement: AssujettissementVgp.soumis,
      derniereInformation: new Date(Date.UTC(2026, 2, 1)),
    });

    // TROIS valeurs différentes, et c'est tout l'objet : deux d'entre elles
    // pourraient se confondre en « rien à signaler », et le registre mentirait.
    expect(
      new Set([horsRegistre.etat, sansNouvelles.etat, informe.etat]).size,
    ).toBe(3);
  });

  it("`hors_registre` et `sans_information` ne se confondent JAMAIS", () => {
    // L'un dit « la question ne se pose pas ici », l'autre « elle se pose et
    // nous n'avons pas la réponse ». Les ranger ensemble ferait sortir un pont
    // élévateur du registre en silence.
    const jamaisRegarde = etatDeLInformation({
      assujettissement: AssujettissementVgp.a_determiner,
      periodiciteMois: null,
      derniereInformation: null,
      depuis: null,
      aujourdHui: LE_JOUR,
    });
    expect(jamaisRegarde.etat).toBe("hors_registre");

    const soumisSansNouvelles = etatDeLInformation({
      assujettissement: AssujettissementVgp.soumis,
      periodiciteMois: null,
      derniereInformation: null,
      depuis: null,
      aujourdHui: LE_JOUR,
    });
    expect(soumisSansNouvelles.etat).toBe("sans_information");
  });

  it("« sans information DEPUIS X » porte sa date, ou dit qu'elle manque", () => {
    const depuis = new Date(Date.UTC(2026, 5, 12));
    const etat = etatDeLInformation({
      assujettissement: AssujettissementVgp.soumis,
      periodiciteMois: 12,
      derniereInformation: null,
      depuis,
      aujourdHui: LE_JOUR,
    });
    expect(etat.etat).toBe("sans_information");
    if (etat.etat !== "sans_information") {
      throw new Error("état inattendu");
    }
    expect(etat.depuis).toEqual(depuis);
    expect(etat.joursSansInformation).toBe(92);

    // …et sans date de départ, le décompte est NUL et non zéro. Zéro se lirait
    // « depuis aujourd'hui », c'est-à-dire une mesure là où il n'y en a pas
    // (§9, 06/09).
    const sansDepart = etatDeLInformation({
      assujettissement: AssujettissementVgp.soumis,
      periodiciteMois: 12,
      derniereInformation: null,
      depuis: null,
      aujourdHui: LE_JOUR,
    });
    if (sansDepart.etat !== "sans_information") {
      throw new Error("état inattendu");
    }
    expect(sansDepart.joursSansInformation).toBeNull();
  });
});

describe("L9-01 — le seul calcul est une DATE", () => {
  it("l'échéance se DÉDUIT de la périodicité déclarée", () => {
    const etat = etatDeLInformation({
      assujettissement: AssujettissementVgp.soumis,
      periodiciteMois: 12,
      derniereInformation: new Date(Date.UTC(2026, 2, 1)),
      depuis: null,
      aujourdHui: LE_JOUR,
    });
    if (etat.etat !== "information_recue") {
      throw new Error("état inattendu");
    }
    expect(etat.prochaineEcheance).toEqual(new Date(Date.UTC(2027, 2, 1)));
    expect(etat.joursAvantEcheance).toBe(170);
  });

  it("SANS périodicité déclarée, l'échéance est NULLE — jamais devinée", () => {
    // On sait quand on a été informé ; on ne sait pas quand la prochaine visite
    // est due. Rendre une date au jugé serait très exactement le registre qui
    // ment.
    const etat = etatDeLInformation({
      assujettissement: AssujettissementVgp.soumis,
      periodiciteMois: null,
      derniereInformation: new Date(Date.UTC(2026, 2, 1)),
      depuis: null,
      aujourdHui: LE_JOUR,
    });
    if (etat.etat !== "information_recue") {
      throw new Error("état inattendu");
    }
    expect(etat.prochaineEcheance).toBeNull();
    expect(etat.joursAvantEcheance).toBeNull();
  });

  it("une échéance PASSÉE se compte en négatif, et ne rend aucun verdict", () => {
    const etat = etatDeLInformation({
      assujettissement: AssujettissementVgp.soumis,
      periodiciteMois: 6,
      derniereInformation: new Date(Date.UTC(2025, 0, 15)),
      depuis: null,
      aujourdHui: LE_JOUR,
    });
    if (etat.etat !== "information_recue") {
      throw new Error("état inattendu");
    }
    expect(etat.joursAvantEcheance).toBeLessThan(0);
    // ET C'EST TOUT CE QU'IL REND. Aucune clé « conforme », « en retard » ni
    // « alerte » : « conforme » ne s'affiche que parce qu'un organisme agréé
    // l'a écrit (L9-01), et ce module n'écrit jamais à leur place.
    expect(Object.keys(etat).sort()).toEqual([
      "derniereInformation",
      "etat",
      "joursAvantEcheance",
      "prochaineEcheance",
    ]);
  });
});

describe("l'arithmétique des mois ne DÉBORDE jamais la fin du mois", () => {
  it("31 janvier + 1 mois est le 28 février, jamais le 3 mars", () => {
    // Le comportement natif de `Date` fait exactement l'inverse : une échéance
    // qui saute par-dessus la fin du mois est fausse d'un mois entier une fois
    // sur douze, et personne ne le verrait sur les onze autres.
    expect(ajouterMois(new Date(Date.UTC(2026, 0, 31)), 1)).toEqual(
      new Date(Date.UTC(2026, 1, 28)),
    );
    // TÉMOIN — l'année bissextile est traitée par le CALCUL, pas par un cas
    // particulier : 2028 rend le 29.
    expect(ajouterMois(new Date(Date.UTC(2028, 0, 31)), 1)).toEqual(
      new Date(Date.UTC(2028, 1, 29)),
    );
  });

  it("et un jour qui existe partout n'est PAS ramené — le cas qui reste vert", () => {
    expect(ajouterMois(new Date(Date.UTC(2026, 0, 15)), 13)).toEqual(
      new Date(Date.UTC(2027, 1, 15)),
    );
  });
});
