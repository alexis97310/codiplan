import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * LE MOT TOUJOURS — AUCUN `<Badge>` VIDE (TP-UX1-3, commit « composants de
 * base »).
 *
 * `Badge` (`components/ui/badge.tsx`) peint un ton, jamais un sens : une
 * pastille sans texte serait une couleur qui ne dit plus rien à qui ne voit
 * pas — la même faute que le vocabulaire imposé refuse déjà pour « site »/
 * « agence ». Ce gardien lit chaque appel de `app/` et `components/`, jamais
 * une liste tenue à la main : un appel écrit demain y entre le jour où son
 * fichier apparaît.
 *
 * **`children: string` n'est PAS la bonne signature.** Deux appels passent
 * autre chose qu'une chaîne — `<Badge ton="orange">{attenteParZone.length}
 * </Badge>` (un nombre, `planning/page.tsx`) et `<Badge ton={compteEquip.ton}>
 * {compteEquip.valeur} {compteEquip.libelle}</Badge>` (deux enfants,
 * `clients/[id]/page.tsx`) — resserrer le type romprait ces deux appels. Ce
 * gardien l'atteste : `children: React.ReactNode` reste juste.
 */

const RACINES = ["app", "components"];

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
      if (chemin.endsWith(".tsx") && !chemin.includes(".test.")) {
        resultat.push(chemin);
      }
    }
  };
  parcourir(join(process.cwd(), racine));
  return resultat;
}

type AppelBadge = {
  readonly fichier: string;
  readonly autoFermant: boolean;
  /** Le contenu ENTRE les balises, brut — vide pour un appel fautif. */
  readonly contenu: string;
};

function appelsBadge(chemin: string, source: string): readonly AppelBadge[] {
  const appels: AppelBadge[] = [];
  // Auto-fermant d'abord : `<Badge .../>` n'a par construction aucun enfant.
  const motifAutoFermant = /<Badge\b[^>]*\/>/g;
  const nombreAutoFermants = source.match(motifAutoFermant)?.length ?? 0;
  for (let i = 0; i < nombreAutoFermants; i += 1) {
    appels.push({ fichier: chemin, autoFermant: true, contenu: "" });
  }
  // Puis les paires ouvrantes/fermantes — jamais imbriquées dans ce dépôt.
  const motifOuvertFerme = /<Badge\b[^>]*[^/]>([\s\S]*?)<\/Badge>/g;
  for (const trouve of source.matchAll(motifOuvertFerme)) {
    appels.push({ fichier: chemin, autoFermant: false, contenu: trouve[1] });
  }
  return appels;
}

describe("Badge — le mot toujours, aucun appel vide", () => {
  const tous = RACINES.flatMap((racine) => fichiersSource(racine)).flatMap(
    (chemin) => appelsBadge(chemin, readFileSync(chemin, "utf8")),
  );

  it("au moins un appel existe — la population n'est pas vide", () => {
    expect(tous.length).toBeGreaterThan(0);
  });

  it("aucun appel n'est auto-fermant", () => {
    const fautifs = tous.filter((appel) => appel.autoFermant);
    expect(fautifs.map((a) => relative(process.cwd(), a.fichier))).toEqual([]);
  });

  it.each(
    tous
      .filter((appel) => !appel.autoFermant)
      .map((appel) => [relative(process.cwd(), appel.fichier), appel] as const),
  )("%s — l'enfant n'est pas vide", (_nom, appel) => {
    expect(appel.contenu.trim().length).toBeGreaterThan(0);
  });
});

describe("Badge — la signature de `children` reste `React.ReactNode`", () => {
  it("`components/ui/badge.tsx` ne resserre pas `children` à `string`", () => {
    const source = readFileSync(
      join(process.cwd(), "components/ui/badge.tsx"),
      "utf8",
    );
    expect(source).toContain("children: React.ReactNode");
  });

  it("au moins un appel réel passe autre chose qu'une simple chaîne (preuve du refus)", () => {
    const planning = readFileSync(
      join(process.cwd(), "app/(back-office)/planning/page.tsx"),
      "utf8",
    );
    expect(planning).toContain(
      '<Badge ton="orange">{attenteParZone.length}</Badge>',
    );
  });
});
