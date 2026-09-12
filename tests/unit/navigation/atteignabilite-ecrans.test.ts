import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { ENTREES } from "@/lib/navigation/entrees";
import {
  cheminsDesignes,
  ecransOrphelins,
  mene,
  type Ecran,
} from "../../../scripts/lib/atteignabilite-ecrans";
import { RACINE } from "../outils/fichiers-source";

/**
 * TOUT ÉCRAN DU BACK-OFFICE EST ATTEIGNABLE — mesuré le 13/09/2026.
 *
 * *Trois écrans existaient et aucun lien n'y menait :* `/parametres/trajets`,
 * `/parametres/forfaits` et, selon le chemin qu'on emprunte, la liste des
 * sites. Le premier est celui qui fait mal : **Alexis avait demandé que les
 * temps de trajet soient paramétrables, et ils l'étaient déjà** (R3-03). Le
 * produit avait la fonction et pas la porte, et il a fallu lire le code pour
 * le savoir.
 *
 * *Un écran orphelin est une fonctionnalité qui n'existe pas.*
 */

const GROUPE = join(RACINE, "app", "(back-office)");

/** Les pages du groupe de routes — la population vient du dépôt. */
function pages(
  racine: string,
  prefixe = "",
): { route: string; fichier: string }[] {
  const trouves: { route: string; fichier: string }[] = [];
  for (const entree of readdirSync(racine, { withFileTypes: true })) {
    const chemin = join(racine, entree.name);
    if (entree.isDirectory()) {
      // Un segment entre parenthèses est un GROUPE de routes : il organise les
      // fichiers et n'apparaît pas dans l'URL.
      const segment = entree.name.startsWith("(") ? "" : `/${entree.name}`;
      trouves.push(...pages(chemin, `${prefixe}${segment}`));
    } else if (entree.name === "page.tsx") {
      trouves.push({ route: prefixe === "" ? "/" : prefixe, fichier: chemin });
    }
  }
  return trouves;
}

/**
 * Le source d'un écran, ET celui des composants LOCAUX qu'il utilise.
 *
 * Sans cette fermeture, un écran dont la liste vit dans un composant paraîtrait
 * ne mener nulle part — et le gardien rougirait sur un chemin qui existe. *Un
 * gardien qui crie à tort désapprend à lire les gardiens aussi sûrement qu'un
 * gardien muet* (§9, 11/09).
 */
function sourceAvecComposants(
  fichier: string,
  vus = new Set<string>(),
): string {
  const absolu = resolve(fichier);
  if (vus.has(absolu)) {
    return "";
  }
  vus.add(absolu);

  let source: string;
  try {
    source = readFileSync(absolu, "utf8");
  } catch {
    return "";
  }

  let total = source;
  for (const trouve of source.matchAll(/from\s+"(@\/[^"]+|\.[^"]+)"/g)) {
    const brut = trouve[1]!;
    const base = brut.startsWith("@/")
      ? join(RACINE, brut.slice(2))
      : resolve(dirname(absolu), brut);
    for (const extension of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
      try {
        readFileSync(`${base}${extension}`, "utf8");
        total += `\n${sourceAvecComposants(`${base}${extension}`, vus)}`;
        break;
      } catch {
        continue;
      }
    }
  }
  return total;
}

const ECRANS: readonly Ecran[] = pages(GROUPE).map(({ route, fichier }) => ({
  route,
  source: sourceAvecComposants(fichier),
}));

/** Les départs : ce que la barre du back-office ouvre réellement. */
const DEPARTS = ENTREES.map((e) => e.chemin).filter(
  (chemin): chemin is string => chemin !== null,
);

describe("aucun écran du back-office n'est orphelin", () => {
  it("la population n'est pas vide, et elle vient du dépôt", () => {
    // TÉMOIN : un gardien qui n'énumère aucun écran passerait au vert sans
    // avoir rien regardé (§9, 30/08).
    expect(ECRANS.length).toBeGreaterThan(5);
    expect(DEPARTS.length).toBeGreaterThan(0);
    // Et les sources ont bien été lues : un écran vide ne mène nulle part et
    // ferait conclure « orphelin » à tort.
    expect(ECRANS.every((e) => e.source.length > 0)).toBe(true);
  });

  it("chaque écran est atteint depuis la barre, directement ou de proche en proche", () => {
    const orphelins = ecransOrphelins(ECRANS, DEPARTS);

    expect(
      orphelins,
      "ces écrans existent et AUCUN lien n'y mène — ni la barre, ni un écran " +
        "lui-même atteignable. Un écran orphelin est une fonctionnalité qui " +
        "n'existe pas : celui qui doit s'en servir ne la trouvera jamais, et " +
        "aucun autre contrôle du dépôt ne le dit.",
    ).toEqual([]);
  });
});

/**
 * LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09) — sans lui, le
 * gardien pourrait être vert parce qu'il apparie trop largement.
 */
describe("l'appariement d'un chemin à une route", () => {
  it("un gabarit mène à la route dynamique qu'il commence", () => {
    expect(mene("/parc/", "/parc/[id]")).toBe(true);
    expect(mene("/parc", "/parc")).toBe(true);
  });

  it("et il ne mène PAS à une route voisine, ni au-delà d'un segment", () => {
    expect(mene("/parc/", "/parc/[id]/documents")).toBe(false);
    expect(mene("/parc", "/parc/[id]")).toBe(false);
    expect(mene("/parc/", "/sites/[id]")).toBe(false);
    // Une route statique ne s'atteint pas par le gabarit d'une autre.
    expect(mene("/parametres/", "/parametres/trajets")).toBe(false);
  });

  it("c'est la VALEUR qui désigne, jamais le nom de l'attribut", () => {
    // `lien={…}` est un composant maison, et il a produit un FAUX ORPHELIN à la
    // première exécution du gardien : la fiche d'un site se rejoint par là.
    const lus = cheminsDesignes(
      'href="/parc" redirect("/planning") lien={`/sites/${site.id}`} ' +
        'href={`/parc/${m.id}`} chemin: "/parametres/trajets"',
    );
    expect(lus.sort()).toEqual([
      "/parametres/trajets",
      "/parc",
      "/parc/",
      "/planning",
      "/sites/",
    ]);
  });
});
