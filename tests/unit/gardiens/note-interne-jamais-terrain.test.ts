import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE } from "../outils/fichiers-source";

/**
 * LA NOTE INTERNE (50-INTERVENTIONS-2) NE SE RESTITUE JAMAIS AILLEURS QU'AU
 * BACK-OFFICE.
 *
 * `lireFicheIntervention` (`lib/interventions/depot.ts`) est PARTAGÉE entre la
 * fiche back-office et `/terrain/[id]` — les deux seuls appelants du dépôt —
 * et rend `noteInterne` dans les deux cas, exactement comme elle rend déjà
 * `valorisation` ou `habilitations` sans que `/terrain` les affiche (le
 * technicien n'a droit à aucun montant, matrice §5.2). **Ce gardien tient la
 * moitié qu'un test de type ne peut pas tenir** : que la note reste absente
 * du RENDU terrain, pas seulement hors périmètre de rôle.
 *
 * Un test isolé (`tests/isolation/intervention-pause.test.ts`) tient l'autre
 * moitié : que le bon d'intervention (`lib/interventions/bon.ts`, qui lit
 * `CHAMPS_LIGNE` et non `lireFicheIntervention`) et le rapport de terrain
 * (`lib/interventions/depot-rapport-terrain.ts`) ne SÉLECTIONNENT même pas la
 * colonne.
 */

const TERRAIN = readFileSync(
  join(RACINE, "app/(mobile)/terrain/[id]/page.tsx"),
  "utf8",
);

describe("la note interne n'apparaît jamais sur la fiche terrain", () => {
  it("le fichier ne référence ni `noteInterne` ni `note_interne`", () => {
    expect(TERRAIN).not.toContain("noteInterne");
    expect(TERRAIN).not.toContain("note_interne");
  });

  // Témoin : la fiche terrain lit bien `lireFicheIntervention`, sans quoi ce
  // gardien ne prouverait rien — l'absence serait celle d'un fichier qui
  // n'appelle jamais la fonction partagée.
  it("TÉMOIN — la fiche terrain appelle réellement `lireFicheIntervention`", () => {
    expect(TERRAIN).toContain("lireFicheIntervention");
  });
});
