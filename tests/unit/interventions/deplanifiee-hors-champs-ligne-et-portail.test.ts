import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CHAMPS_LIGNE } from "@/lib/interventions/depot";

/**
 * LA TRACE DE DÉPLANIFICATION NE PASSE NI PAR `CHAMPS_LIGNE`, NI PAR LE
 * PORTAIL (9CC-DEPLANIFIEE-1).
 *
 * ## `CHAMPS_LIGNE` sert le BON et l'historique machine, pas la trace
 *
 * `CHAMPS_LIGNE` (`lib/interventions/depot.ts`) est partagé par le bon
 * imprimable et l'historique machine — deux écrans qui n'ont rien à faire
 * d'une absence qui a déplanifié une ligne. Les cinq colonnes vivent dans
 * `SELECTION_LIGNE_FILE_A_TRAITER` (planning) et dans le `select` propre de
 * `lireFicheIntervention` (fiche), jamais ici : ce gardien tient la
 * séparation plutôt que de la confier à une relecture.
 *
 * ## Le portail ne lit que le PARC (D94)
 *
 * Aucun écran de `app/(portail)/` ni aucun module de `lib/portail/` ne lit
 * `intervention` aujourd'hui (`app/(portail)/portail/page.tsx`, en-tête :
 * « le portail ne lit que le parc »). Le jour où il le ferait, ces colonnes
 * ne doivent pas s'y glisser par une sélection large recopiée d'ailleurs —
 * ce gardien lit le SOURCE, pas une intention.
 */

function fichiersSource(racine: string): readonly string[] {
  const resultat: string[] = [];
  const parcourir = (dossier: string): void => {
    for (const entree of readdirSync(dossier)) {
      const chemin = join(dossier, entree);
      const stat = statSync(chemin);
      if (stat.isDirectory()) {
        parcourir(chemin);
        continue;
      }
      if (chemin.endsWith(".ts") || chemin.endsWith(".tsx")) {
        resultat.push(chemin);
      }
    }
  };
  parcourir(join(process.cwd(), racine));
  return resultat;
}

describe("aucune clé `deplanifiee_` dans CHAMPS_LIGNE", () => {
  it("les clés existent bien — la population n'est pas vide", () => {
    expect(Object.keys(CHAMPS_LIGNE).length).toBeGreaterThan(0);
  });

  it("aucune ne commence par `deplanifiee_`", () => {
    const fautives = Object.keys(CHAMPS_LIGNE).filter((cle) =>
      cle.startsWith("deplanifiee_"),
    );
    expect(fautives).toEqual([]);
  });
});

describe("le portail ne nomme jamais `deplanifiee_`", () => {
  const RACINES = ["app/(portail)", "lib/portail"];
  const fichiers = RACINES.flatMap((racine) => fichiersSource(racine));

  it("au moins un fichier existe — la population n'est pas vide", () => {
    expect(fichiers.length).toBeGreaterThan(0);
  });

  it.each(fichiers)("%s ne contient pas `deplanifiee_`", (chemin) => {
    expect(readFileSync(chemin, "utf8")).not.toContain("deplanifiee_");
  });
});
