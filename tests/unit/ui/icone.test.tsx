import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Icone, NOMS_ICONES, type TailleIcone } from "@/components/ui/icone";

/**
 * L'ICÔNE, CONFRONTÉE À `ICONS` DE LA MAQUETTE (D139) — jamais recopiée
 * d'elle sans preuve. `docs/propositions/ergonomie-2026-09-28/
 * maquette-toutes-pages.html` (:1624-1729) porte l'objet `ICONS`, une clé par
 * icône, une chaîne de balises SVG par valeur (`ic()`, :1730, pose
 * `aria-hidden`/`focusable`, jamais le contenu du contour).
 */

const MAQUETTE = readFileSync(
  join(
    process.cwd(),
    "docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html",
  ),
  "utf8",
);

/** Le bloc `ICONS = { … };` isolé, avant d'y lire une seule icône. */
function blocIcones(): string {
  const debut = MAQUETTE.indexOf("const ICONS = {");
  if (debut === -1) {
    throw new Error(
      "`const ICONS = {` est introuvable dans maquette-toutes-pages.html — le document a changé de forme",
    );
  }
  const fin = MAQUETTE.indexOf("\n};", debut);
  if (fin === -1) {
    throw new Error("la fin de l'objet `ICONS` est introuvable");
  }
  return MAQUETTE.slice(debut, fin);
}

/** La chaîne SVG brute d'UNE icône, désignée par son nom exact. */
function formeMaquette(nom: string): string {
  const bloc = blocIcones();
  const echappe = nom.replace(/[.*+^${}()|[\]\\]/g, "\\$&");
  // La clé est parfois nue (`home:`), parfois entre guillemets (`"chev-r":`).
  const motif = new RegExp(`(?:"${echappe}"|\\b${echappe}):\\s*'([^']*)'`);
  const trouve = motif.exec(bloc);
  if (trouve === null) {
    throw new Error(
      `l'icône \`${nom}\` est introuvable dans ICONS de maquette-toutes-pages.html`,
    );
  }
  return trouve[1];
}

type Forme = {
  readonly balise: string;
  readonly attributs: Record<string, string>;
};

/** Les éléments d'un contour SVG (path/rect/circle/ellipse), balise et attributs. */
function analyserFormes(html: string): readonly Forme[] {
  const formes: Forme[] = [];
  const motifBalise = /<(path|rect|circle|ellipse)([^>]*?)\/?>(?:<\/\1>)?/g;
  let trouveBalise: RegExpExecArray | null;
  while ((trouveBalise = motifBalise.exec(html)) !== null) {
    const attributs: Record<string, string> = {};
    const motifAttribut = /([a-zA-Z-]+)="([^"]*)"/g;
    let trouveAttribut: RegExpExecArray | null;
    while ((trouveAttribut = motifAttribut.exec(trouveBalise[2])) !== null) {
      attributs[trouveAttribut[1]] = trouveAttribut[2];
    }
    formes.push({ balise: trouveBalise[1], attributs });
  }
  return formes;
}

describe("Icone — confrontée à ICONS de la maquette du 28/09", () => {
  it("porte au moins une icône", () => {
    expect(NOMS_ICONES.length).toBeGreaterThan(0);
  });

  it.each(NOMS_ICONES)("« %s » — même contour, élément pour élément", (nom) => {
    const attendu = analyserFormes(formeMaquette(nom));
    expect(attendu.length).toBeGreaterThan(0);

    const { container } = render(<Icone nom={nom} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const obtenu = analyserFormes(svg?.innerHTML ?? "");

    expect(obtenu).toEqual(attendu);
  });

  it("ne porte aucune icône absente de ICONS", () => {
    for (const nom of NOMS_ICONES) {
      expect(() => formeMaquette(nom)).not.toThrow();
    }
  });

  it("n'utilise jamais dangerouslySetInnerHTML", () => {
    const source = readFileSync(
      join(process.cwd(), "components/ui/icone.tsx"),
      "utf8",
    );
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });

  it("pose aria-hidden, focusable, et le contour de `.ico` par défaut (:56)", () => {
    const { container } = render(<Icone nom="check" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveAttribute("stroke-width", "1.8");
    expect(svg).toHaveAttribute("stroke-linecap", "round");
    expect(svg).toHaveAttribute("stroke-linejoin", "round");
  });

  const TAILLES: readonly [TailleIcone, string][] = [
    [16, "size-[16px]"],
    [18, "size-[18px]"],
    [22, "size-[22px]"],
    [28, "size-[28px]"],
  ];

  it.each(TAILLES)(
    "taille %s px — classe %s (.ico, .s, .lg, .xl)",
    (taille, classe) => {
      const { container } = render(<Icone nom="check" taille={taille} />);
      expect(container.querySelector("svg")?.getAttribute("class")).toContain(
        classe,
      );
    },
  );

  it("18 px par défaut, sans le prop `taille`", () => {
    const { container } = render(<Icone nom="check" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "size-[18px]",
    );
  });
});

describe("aucune dépendance nouvelle (D139 :5041)", () => {
  const PAQUETS_ICONES_INTERDITS = [
    "lucide-react",
    "@heroicons/react",
    "react-icons",
    "@tabler/icons-react",
    "phosphor-react",
    "react-feather",
    "@fortawesome/react-fontawesome",
  ];

  it("package.json ne porte aucune bibliothèque d'icônes", () => {
    const paquet = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as {
      readonly dependencies?: Record<string, string>;
      readonly devDependencies?: Record<string, string>;
    };
    const toutes = {
      ...(paquet.dependencies ?? {}),
      ...(paquet.devDependencies ?? {}),
    };
    for (const nom of PAQUETS_ICONES_INTERDITS) {
      expect(toutes).not.toHaveProperty(nom);
    }
  });
});
