import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * « DÉMARRER L'INTERVENTION » VISIBLE SANS DÉFILER (point 1,
 * 9G5-TERRAIN-ERGONOMIE) — l'audit du 21/10 a mesuré, à 375 px, le bouton à
 * y=740 sur une fiche sans contact ni accès particuliers : il venait après
 * Référence, Panne, Machine et Contact, sous la ligne de flottaison.
 *
 * Gardien STATIQUE, même idiome que `sans-montant.test.ts` : la section
 * Compteur — seule à porter le bouton — doit apparaître dans le JSX AVANT
 * la section Référence, pas après elle. Une mesure en pixels dépendrait du
 * contenu de CETTE fiche (machine, contact, accès…) ; l'ORDRE du JSX ne
 * dépend d'aucune donnée.
 */
describe("le geste principal (Démarrer l'intervention) vient en tête de la fiche", () => {
  it("la section Compteur précède la section Référence dans app/(mobile)/terrain/[id]/page.tsx", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(mobile)/terrain/[id]/page.tsx"),
      "utf8",
    );
    const indexCompteur = source.indexOf('t("terrain.compteur")');
    const indexReference = source.indexOf('t("intervention.reference")');

    expect(indexCompteur).toBeGreaterThan(-1);
    expect(indexReference).toBeGreaterThan(-1);
    expect(indexCompteur).toBeLessThan(indexReference);
  });
});
