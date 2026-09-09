import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  EXTENSIONS_CSS,
  RACINE,
  fichiersSource,
  sansCommentaires,
} from "../outils/fichiers-source";
import { porteUneCouleur } from "../outils/couleurs";

/**
 * Gardien de la CHARTE VISUELLE — `docs/charte-visuelle.md`, rang 1.
 *
 * **Une seule règle : une valeur hexadécimale de couleur ne s'écrit que dans
 * `app/jetons.css`.**
 *
 * **Pourquoi un second gardien plutôt qu'un durcissement du premier.** Celui de
 * L0-09 (`sans-couleur-en-dur.test.ts`) exempte une FORME D'ÉCRITURE : dans une
 * feuille de style, une couleur est licite dès qu'elle est portée par une
 * déclaration de variable. Cette exemption est juste pour ce qu'elle garde — un
 * composant ne doit pas écrire de couleur — et elle laisse passer exactement ce
 * que la charte interdit : `--rouge-provisoire: #f00` écrit dans n'importe quelle
 * feuille, un thème parallèle installé sans que la palette bouge. Mesuré :
 * l'état d'avant la charte portait treize couleurs `oklch` dans `app/globals.css`
 * et le gardien de L0-09 était vert, à raison.
 *
 * Celui-ci exempte UN FICHIER. La différence n'est pas de sévérité, elle est de
 * NATURE : une exemption de forme s'applique partout et ne se compte pas ; une
 * exemption de fichier tient dans une page, et son diff EST la charte qui change.
 *
 * **Ce qu'il ne garde pas, et qui l'est ailleurs.** Les palettes nommées de
 * Tailwind, les valeurs arbitraires, la réécriture d'une variable de société
 * côté navigateur : tout cela reste au gardien de L0-09, dont le motif est
 * réutilisé ici plutôt que recopié (§9 du 01/09 — une seconde lecture d'un même
 * critère diverge en silence ; il n'y en a donc qu'une).
 */

/** Tout ce qui peut porter une couleur : le code applicatif et les feuilles. */
const REPERTOIRES = ["app", "components", "lib"];

/**
 * LA PALETTE. Le seul fichier où une couleur s'écrit.
 *
 * C'est un CHEMIN EXACT, pas un préfixe : `app/jetons-provisoires.css` n'en
 * bénéficie pas, et c'est le sens de l'exemption.
 */
const FICHIER_JETONS = "app/jetons.css";

/**
 * Le mécanisme de la charte de SOCIÉTÉ (L0-09, D51) — un autre objet : deux
 * couleurs venues de la table `societe`, et le noir et le blanc dont on calcule
 * l'encre lisible. Déjà gardé par `sans-couleur-en-dur.test.ts`, qui l'exempte
 * pour la même raison. Préfixe de répertoire.
 */
const EXEMPT_SOCIETE = "lib/theme/";

/** Les fichiers soumis à la charte, hors les deux exemptions nommées. */
function fichiersSoumis(): { chemin: string; contenu: string }[] {
  return [
    ...fichiersSource(REPERTOIRES),
    ...fichiersSource(REPERTOIRES, EXTENSIONS_CSS),
  ]
    .filter(
      (fichier) =>
        fichier.chemin !== FICHIER_JETONS &&
        !fichier.chemin.startsWith(EXEMPT_SOCIETE),
    )
    .map((fichier) => ({
      chemin: fichier.chemin,
      contenu: sansCommentaires(fichier.contenu),
    }));
}

/** Les fichiers qui portent une couleur alors qu'ils n'en ont pas le droit. */
export function fautifsCharte(): string[] {
  return fichiersSoumis()
    .filter((fichier) => porteUneCouleur(fichier.contenu))
    .map((fichier) => fichier.chemin);
}

const CHEMIN_JETONS = join(RACINE, FICHIER_JETONS);
const CHEMIN_GLOBALS = join(RACINE, "app/globals.css");

describe("la charte visuelle : une couleur ne s'écrit que dans les jetons", () => {
  it("regarde bien quelque chose — témoin de non-vacuité", () => {
    // Un décompte nul ressemble toujours à un sans-faute (§9, 30/08). Trois
    // témoins, et le troisième est celui qui manquerait le plus : la palette
    // elle-même DOIT porter des couleurs, sans quoi le gardien s'appliquerait
    // à un fichier vide et serait vert pour rien.
    const soumis = fichiersSoumis();
    expect(soumis.length).toBeGreaterThan(10);
    expect(soumis.some((f) => f.chemin.endsWith(".css"))).toBe(true);
    expect(porteUneCouleur(readFileSync(CHEMIN_JETONS, "utf8"))).toBe(true);
  });

  it("aucun fichier ne porte de couleur hors de la palette", () => {
    expect(
      fautifsCharte(),
      `une couleur est écrite hors de ${FICHIER_JETONS} : la charte visuelle ` +
        "est de rang 1, et tout écran s'y adosse (docs/charte-visuelle.md)",
    ).toEqual([]);
  });

  /**
   * La palette porte les TROIS ÉTATS DE THÈME, dans l'ordre, et aucune couleur
   * n'a sa seule définition dans un bloc `@media`.
   *
   * L'assertion porte sur le FAIT — les mêmes jetons sont redéfinis dans les
   * trois blocs — et non sur le geste « il existe un bloc @media » : un bloc
   * média vide passerait le geste et laisserait le thème sombre à trous
   * (§9, 09/09 — une garantie énoncée en termes de geste se referme un étage
   * plus bas).
   */
  it("les trois états de thème redéfinissent les MÊMES jetons", () => {
    const palette = readFileSync(CHEMIN_JETONS, "utf8");

    const blocs = {
      clair: /^:root \{([\s\S]*?)^\}/m,
      systeme: /:root:not\(\[data-theme="light"\]\) \{([\s\S]*?)^  \}/m,
      choix: /^:root\[data-theme="dark"\] \{([\s\S]*?)^\}/m,
    };

    const jetons = Object.fromEntries(
      Object.entries(blocs).map(([nom, motif]) => {
        const trouve = palette.match(motif);
        expect(trouve, `bloc « ${nom} » introuvable dans la palette`).not.toBe(
          null,
        );
        const noms = [...(trouve?.[1] ?? "").matchAll(/^\s*(--[\w-]+)\s*:/gm)]
          .map((m) => m[1])
          .sort();
        expect(noms.length, `bloc « ${nom} » vide`).toBeGreaterThan(8);
        return [nom, noms];
      }),
    );

    expect(jetons.systeme).toEqual(jetons.clair);
    expect(jetons.choix).toEqual(jetons.clair);

    // L'ordre est une règle de la charte : le clair d'abord, le système
    // ensuite, le choix en dernier — sinon le choix ne gagne pas.
    const rangs = [
      palette.indexOf(":root {"),
      palette.indexOf("@media (prefers-color-scheme: dark)"),
      palette.indexOf(':root[data-theme="dark"]'),
    ];
    expect(rangs.every((rang) => rang >= 0)).toBe(true);
    expect([...rangs].sort((a, b) => a - b)).toEqual(rangs);
  });
});

/**
 * LA MISE EN ÉCHEC — le gardien doit rougir, et pour SA propre raison.
 *
 * Deux directions, comme l'exige le §9 du 11/09 : un cas qui doit rougir, et à
 * côté un cas qui doit rester vert pour une raison qui lui appartienne. Les
 * greffes sont écrites dans les FICHIERS RÉELS — jamais dans un fichier
 * fabriqué (leçon du 21/08) — puis rendues dans le même geste.
 */
describe("le gardien mis en échec sur le dépôt réel", () => {
  const original = readFileSync(CHEMIN_GLOBALS, "utf8");
  afterEach(() => writeFileSync(CHEMIN_GLOBALS, original));

  it("rougit sur une couleur greffée dans une DÉCLARATION DE VARIABLE", () => {
    // C'est exactement ce que le gardien de L0-09 laisse passer, et c'est la
    // faute que celui-ci existe pour prendre : un thème parallèle installé
    // sans que la palette bouge.
    expect(fautifsCharte()).toEqual([]);

    const greffe = original.replace(
      "  --radius: var(--rayon-bloc);",
      "  --radius: var(--rayon-bloc);\n  --bleu-provisoire: #0b5cad;",
    );
    expect(greffe).not.toBe(original);
    writeFileSync(CHEMIN_GLOBALS, greffe);

    expect(fautifsCharte()).toEqual(["app/globals.css"]);
  });

  it("rougit sur une couleur greffée dans un composant réel", () => {
    const chemin = join(RACINE, "app/page.tsx");
    const avant = readFileSync(chemin, "utf8");
    try {
      const greffe = avant.replace(
        'className="text-muted-foreground text-lg"',
        'style={{ color: "#59615c" }} className="text-lg"',
      );
      expect(greffe).not.toBe(avant);
      writeFileSync(chemin, greffe);
      expect(fautifsCharte()).toEqual(["app/page.tsx"]);
    } finally {
      writeFileSync(chemin, avant);
    }
  });

  it("reste vert sur un ALIAS, et pour sa propre raison", () => {
    // La direction permissive — celle qui ne produit jamais de signal. Un
    // renvoi vers un jeton n'est pas une couleur, et le gardien doit le laisser
    // passer PARCE QUE c'est un renvoi, pas parce qu'il ne regarde rien : le
    // scénario précédent a montré qu'il mord dans ce même fichier.
    const greffe = original.replace(
      "  --radius: var(--rayon-bloc);",
      "  --radius: var(--rayon-bloc);\n  --encre-secondaire: var(--gris);",
    );
    expect(greffe).not.toBe(original);
    writeFileSync(CHEMIN_GLOBALS, greffe);

    expect(fautifsCharte()).toEqual([]);
  });

  it("l'exemption est un CHEMIN EXACT, pas un préfixe", () => {
    // Une exemption de fichier qui se lirait comme un préfixe ferait entrer
    // `app/jetons-provisoires.css` — soit une seconde palette, soit la
    // première contournée.
    for (const voisin of [
      "app/jetons-provisoires.css",
      "app/jetons.backup.css",
      "components/jetons.css",
    ]) {
      expect(voisin === FICHIER_JETONS, `${voisin} serait exempté à tort`).toBe(
        false,
      );
    }
  });
});
