import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  fileDAttente,
  lignesAffichees,
  type Datable,
} from "@/lib/interventions/affichage";

/**
 * LE PANNEAU ET LA VUE LISENT LE MÊME JEU — ET RIEN NE PEUT LE REDIVISER.
 *
 * ## CE QUI S'EST PASSÉ, ET CE QUI N'A PAS SUFFI À LE RÉPARER
 *
 * L'écran du planning a deux consommateurs du même jeu de lignes : la vue et le
 * **panneau de charge**. Ils ne lisaient pas le même — le panneau recevait la
 * liste BRUTE, la vue une liste filtrée. Il comptait donc la **file
 * d'attente**, et, en vue jour, **les six jours de la semaine**. *Deux chiffres
 * côte à côte, calculés sur deux populations, et rien ne disait lequel croire*
 * (§9, 01/09).
 *
 * La réparation du 11/09 filtrait une fois dans l'écran. **Elle était juste et
 * elle ne tenait rien** : la règle vivait dans une variable locale d'un
 * composant de neuf cents lignes, et le prochain consommateur pouvait recevoir
 * autre chose sans qu'aucun test ne rougisse. *Une réparation qui ne laisse
 * rien derrière elle se défait au ticket suivant.*
 *
 * ## CE QUE CE GARDIEN TIENT, EN DEUX MOITIÉS QUI NE SE RECOUVRENT PAS
 *
 *   1. **La RÈGLE**, éprouvée sur la fonction : la file d'attente est exclue
 *      des deux vues, la vue jour ne garde que son jour, et les deux ensembles
 *      **partitionnent** les lignes reçues.
 *   2. **L'USAGE**, éprouvé sur l'écran : les trois consommateurs —
 *      `construireJournee`, `construireGrille`, `occupationsDuPlanning` —
 *      reçoivent tous `affichees`, et l'écran ne refiltre rien lui-même.
 *
 * *La première sans la seconde laisserait un écran juste appeler une fonction
 * juste avec le mauvais argument ; la seconde sans la première garderait une
 * uniformité sans savoir ce qu'elle uniformise.*
 */

const ECRAN = join(process.cwd(), "app/(back-office)/planning/page.tsx");

function source(): string {
  return readFileSync(ECRAN, "utf8");
}

const JOUR = { annee: 2026, mois: 9, jour: 14 };

/** Une ligne réduite à ce que la règle regarde. */
function ligne(date: string | null): Datable & { readonly nom: string } {
  return {
    date_planifiee: date === null ? null : new Date(`${date}T00:00:00.000Z`),
    nom: date ?? "en attente",
  };
}

const LIGNES = [
  ligne("2026-09-14"),
  ligne("2026-09-15"),
  ligne("2026-09-16"),
  ligne(null),
  ligne(null),
];

describe("la RÈGLE — ce que le planning montre", () => {
  it("la vue semaine garde toutes les posées, et AUCUNE de la file", () => {
    const vues = lignesAffichees(LIGNES, "semaine", JOUR);
    expect(vues).toHaveLength(3);
    expect(vues.every((l) => l.date_planifiee !== null)).toBe(true);
  });

  it("la vue jour ne garde QUE son jour", () => {
    const vues = lignesAffichees(LIGNES, "jour", JOUR);
    expect(vues.map((l) => l.nom)).toEqual(["2026-09-14"]);
  });

  it("la file d'attente est l'exact COMPLÉMENT de la vue semaine", () => {
    // *Deux moitiés qui se prétendent complémentaires et qui sont écrites à
    // deux endroits cessent de l'être au premier changement.* Ici elles sont
    // dans le même module, et ce scénario le CONSTATE plutôt que d'y croire.
    const attente = fileDAttente(LIGNES);
    const posees = lignesAffichees(LIGNES, "semaine", JOUR);
    expect(attente.length + posees.length).toBe(LIGNES.length);
    expect(attente.some((l) => posees.includes(l))).toBe(false);
  });

  it("un jour SANS intervention rend une liste vide, jamais la semaine", () => {
    // La faute d'origine, prise par son bout le plus visible : en vue jour, le
    // panneau montrait la semaine entière. Un jour creux doit rester creux.
    const vides = lignesAffichees(LIGNES, "jour", {
      annee: 2026,
      mois: 9,
      jour: 20,
    });
    expect(vides).toHaveLength(0);
  });
});

describe("l'USAGE — aucun consommateur ne reçoit autre chose", () => {
  /**
   * Les trois consommateurs, et l'argument qu'ils DOIVENT recevoir.
   *
   * La liste est écrite parce qu'elle est le **contrat** de l'écran : un
   * quatrième consommateur qu'on ajouterait sans l'inscrire ici passerait —
   * c'est la limite, et elle est annoncée. Ce que le gardien arrête est la
   * REDIVISION des trois qui existent, qui est la façon dont la faute est
   * revenue la première fois.
   */
  const CONSOMMATEURS = [
    { appel: "construireJournee", rang: 1 },
    { appel: "construireGrille", rang: 1 },
    // `occupationsDuPlanning` prend le CONTEXTE en premier : le rang est écrit
    // plutôt que deviné. *Un gardien qui supposerait « toujours le premier
    // argument » serait vert sur le mauvais mot.*
    { appel: "occupationsDuPlanning", rang: 2 },
  ] as const;

  it("TÉMOIN — les trois consommateurs sont bien dans l'écran", () => {
    // Zéro appel trouvé ressemble exactement à un sans-faute (§9, 30/08) : un
    // renommage ferait passer ce gardien au vert sur un écran qu'il ne regarde
    // plus.
    const texte = source();
    for (const { appel } of CONSOMMATEURS) {
      expect(texte, `${appel} est introuvable dans l'écran`).toContain(
        `${appel}(`,
      );
    }
  });

  it("chacun reçoit `affichees`, et rien d'autre", () => {
    const texte = source();
    for (const { appel, rang } of CONSOMMATEURS) {
      // L'argument de RANG donné, chacun étant un identifiant simple. Les
      // espaces et les retours à la ligne sont absorbés : Prettier décide de la
      // mise en forme, et un gardien qui en dépendrait rougirait au premier
      // reformatage (§9, 26/08, forme 1).
      const avant = "\\s*[A-Za-z0-9_.]+\\s*,".repeat(rang - 1);
      const trouve = new RegExp(`${appel}\\(${avant}\\s*([A-Za-z0-9_]+)`).exec(
        texte,
      );
      expect(trouve?.[1], `${appel} ne reçoit pas « affichees »`).toBe(
        "affichees",
      );
    }
  });

  it("LA MISE EN ÉCHEC : rediviser le filtrage est refusé", () => {
    // La faute telle qu'elle se commettrait — quelqu'un redonne à la grille la
    // liste complète, « puisque la semaine les montre toutes ». On rejoue le
    // verdict sur ce texte-là, sans toucher au fichier.
    const redivise = source().replace(
      "construireGrille(affichees",
      "construireGrille(posees",
    );
    expect(redivise).not.toBe(source());
    const trouve = /construireGrille\(\s*([A-Za-z0-9_]+)/.exec(redivise);
    expect(trouve?.[1]).not.toBe("affichees");
  });

  it("l'écran ne refiltre RIEN lui-même sur la date de planification", () => {
    // *La règle a quitté ce fichier.* Un `filter` sur `date_planifiee` écrit
    // dans l'écran serait une seconde lecture du même critère — celle qui
    // diverge en silence, et qui a déjà divergé une fois ici.
    expect(source()).not.toMatch(/\.filter\([^)]*date_planifiee/);
  });
});
