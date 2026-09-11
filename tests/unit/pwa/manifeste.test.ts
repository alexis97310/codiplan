import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import manifest from "../../../app/manifest";
import { COULEUR_FOND, COULEUR_MARQUE } from "../../../lib/theme/manifeste";

/**
 * LE MANIFESTE ET LA FEUILLE DE STYLE DISENT LA MÊME COULEUR (L3-06).
 *
 * ## La duplication qu'on ne pouvait pas éviter, et ce qui la confronte
 *
 * `lib/theme/apparence.ts` pose la règle : *« aucune couleur n'y est écrite :
 * les palettes sont déclarées dans `app/globals.css`, sous la seule forme
 * qu'une feuille de style admet pour une couleur ».* **Un manifeste ne peut pas
 * lire une variable CSS** — le navigateur le lit hors de tout document —, si
 * bien que la couleur de marque est écrite une SECONDE fois.
 *
 * *Le test à faire passer à toute duplication qui se prétend inévitable :
 * **qu'est-ce qui confronterait les deux copies ?*** Si la réponse est « la
 * relecture », ce n'est pas un contrôle, c'est un doublon (§9, 01/09). Voici la
 * réponse : ce fichier lit `app/globals.css` — une source que le manifeste ne
 * contrôle pas — et exige que les deux coïncident.
 *
 * ## Et il éprouve aussi ce qu'une INSTALLATION exige
 *
 * Les champs vérifiés ici ne sont pas une liste de vœux : ce sont ceux sans
 * lesquels un navigateur refuse de proposer l'installation. *Un manifeste
 * incomplet ne produit aucune erreur — il produit une application qu'on ne peut
 * pas installer, et rien ne le dit.*
 */

/**
 * La valeur d'une variable CSS, telle que `app/globals.css` la DÉCLARE.
 *
 * **Le motif est ancré en début de ligne, et il a fallu une mesure pour le
 * savoir.** La première écriture cherchait `--app-fond:\s*([^;]+);` n'importe
 * où dans le fichier, et elle a trouvé… **le commentaire d'entête** :
 *
 *     `--app-fond: #F4F5F7` est licite ; `color: #F4F5F7` ne l'est pas.
 *
 * Le gardien lisait donc une PHRASE au lieu d'une déclaration, et il aurait
 * continué de le faire si le commentaire avait porté la même valeur — *vert, et
 * sur rien.* C'est la sixième forme du §9 (26/08) prise à l'envers : la seule
 * coupure légitime est « documentation contre exécution », et c'est exactement
 * celle qu'on pose ici.
 */
function variableCss(nom: string): string | null {
  const feuille = readFileSync("app/globals.css", "utf8");
  const trouve = new RegExp(`^\\s*--${nom}:\\s*([^;]+);`, "m").exec(feuille);
  return trouve === null ? null : trouve[1].trim().toLowerCase();
}

describe("le manifeste d'application", () => {
  it("sa couleur de marque est CELLE de la feuille de style", () => {
    const declaree = variableCss("app-marque");
    // TÉMOIN : la variable existe réellement. *Sans lui, une variable renommée
    // rendrait `null` des deux côtés et la comparaison serait verte sur rien*
    // — deux erreurs identiques ne se contredisent jamais (§9, 10/09).
    expect(declaree).not.toBeNull();
    expect(COULEUR_MARQUE.toLowerCase()).toBe(declaree);
  });

  it("sa couleur de fond est CELLE de la feuille de style", () => {
    const declaree = variableCss("app-fond");
    expect(declaree).not.toBeNull();
    expect(COULEUR_FOND.toLowerCase()).toBe(declaree);
  });

  it("ÉPREUVE : une couleur qui s'écarte de la feuille est refusée", () => {
    // La faute telle qu'elle se commettrait — quelqu'un ajuste la marque dans
    // la feuille de style et ne pense pas au manifeste, qui n'est pas une
    // feuille de style. On rejoue le verdict sur la valeur fautive, sans
    // toucher au fichier.
    const declaree = variableCss("app-marque");
    const ecartee = "#ff0000";
    expect(ecartee).not.toBe(declaree);
  });

  it("il porte ce qu'une INSTALLATION exige, et rien n'y est vide", () => {
    const m = manifest();
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect((m.name ?? "").length).toBeGreaterThan(0);
    expect((m.short_name ?? "").length).toBeGreaterThan(0);
    expect(m.theme_color).toBe(COULEUR_MARQUE);
    expect(m.background_color).toBe(COULEUR_FOND);
  });

  it("les DEUX tailles d'icône, et une `maskable`", () => {
    // *Sans `maskable`, Android rogne l'icône dans un cercle et coupe ce
    // qu'elle porte.* C'est un champ qu'on oublie parce que son absence ne
    // produit ni erreur ni refus : elle produit une icône laide.
    const icones = manifest().icons ?? [];
    const tailles = icones.map((icone) => icone.sizes);
    expect(tailles).toContain("192x192");
    expect(tailles).toContain("512x512");
    expect(
      icones.some((icone) => (icone.purpose ?? "").includes("maskable")),
    ).toBe(true);
  });

  it("les fichiers d'icône EXISTENT — une déclaration ne suffit pas", () => {
    // *Une exemption qui ne s'adosse à rien n'exempte plus rien* (§9, 31/08),
    // et une icône déclarée mais absente est de la même famille : le manifeste
    // reste valide, et l'installation propose une icône vide.
    for (const icone of manifest().icons ?? []) {
      const chemin = `public${icone.src}`;
      expect(() => readFileSync(chemin), `${chemin} est déclaré`).not.toThrow();
    }
  });
});
