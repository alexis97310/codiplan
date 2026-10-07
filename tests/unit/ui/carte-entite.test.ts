import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CarteEntite } from "@/components/ui/carte-entite";

/**
 * LA CARTE D'ENTITÉ EST CONFRONTÉE À `codiplan-maquette-complete.html`,
 * JAMAIS RECOPIÉE D'ELLE (D123, N-08) — la même discipline que
 * `tests/unit/ui/composants-maquette.test.ts` applique à `Page`, `Carte`,
 * `Fiche`, `Badge`, `Kpi` et `Tableau`, ici pour `.entity-card`, `.entity-
 * card h3`, `.entity-card p`, `.entity-meta`, `.entity-meta b`,
 * `.entity-meta span` et la grille `.client-cards`/`.site-cards`.
 *
 * **Pourquoi un fichier séparé plutôt qu'un ajout au gardien existant.**
 * `composants-maquette.test.ts` lit principalement `docs/maquette/CODIPLAN_
 * Maquette.html` — la source de la disposition, et, depuis D124, de ce que la
 * seconde maquette ne dessine pas. `.entity-card` n'y existe pas du tout :
 * c'est `docs/maquette/codiplan-maquette-complete.html` qui la dessine, et
 * confondre les deux sources dans une même fonction `regle` aurait fait lire
 * la mauvaise maquette sans qu'aucune erreur ne le dise.
 */

const MAQUETTE = readFileSync(
  join(process.cwd(), "docs/maquette/codiplan-maquette-complete.html"),
  "utf8",
);

const CARTE_ENTITE = readFileSync(
  join(process.cwd(), "components/ui/carte-entite.tsx"),
  "utf8",
);

/** Le contenu d'une règle CSS, désignée par son sélecteur EXACT — sans ancrage de ligne : cette maquette écrit son CSS sur des lignes denses. */
function regle(selecteur: string): string {
  const echappe = selecteur.replace(/[.*+^${}()|[\]\\]/g, "\\$&");
  const motif = new RegExp(`${echappe}\\{([^}]*)\\}`, "m");
  const trouve = motif.exec(MAQUETTE);
  if (trouve === null) {
    throw new Error(
      `la règle \`${selecteur}\` est introuvable dans docs/maquette/codiplan-maquette-complete.html — ` +
        "le document a changé de forme, et ce gardien ne mesure plus rien",
    );
  }
  return trouve[1];
}

/** La règle GROUPÉE `.site-cards,.client-cards{…}` — un seul bloc pour les deux. */
function regleGrille(): string {
  const motif = /\.site-cards,\.client-cards\{([^}]*)\}/;
  const trouve = motif.exec(MAQUETTE);
  if (trouve === null) {
    throw new Error(
      "la règle `.site-cards,.client-cards` est introuvable — le document a changé de forme",
    );
  }
  return trouve[1];
}

function propriete(bloc: string, nom: string): string {
  const motif = new RegExp(`(?:^|;)\\s*${nom}\\s*:\\s*([^;]+)`);
  const trouve = motif.exec(bloc);
  if (trouve === null) {
    throw new Error(`la propriété \`${nom}\` est absente du bloc \`${bloc}\``);
  }
  return trouve[1].trim();
}

describe("CarteEntite — .entity-card, .entity-card h3, .entity-card p, .entity-meta de la maquette", () => {
  it("a réellement lu quatre règles — le témoin de non-vacuité", () => {
    expect(regle(".entity-card")).toContain("padding");
    expect(regle(".entity-card h3")).toContain("font-size");
    expect(regle(".entity-card p")).toContain("font-size");
    expect(regle(".entity-meta")).toContain("display");
  });

  it("la carte reprend le rembourrage de .entity-card", () => {
    const carte = regle(".entity-card");
    expect(propriete(carte, "padding")).toBe("17px");
    expect(CARTE_ENTITE).toContain("p-[17px]");
  });

  it("la bordure et le rayon sont ceux de `.card` (D124), jamais un nombre à part", () => {
    // `.entity-card` seule ne porte ni bordure ni rayon : sur la maquette,
    // l'article combine `class="card entity-card"` — `clients()`, `sites()`
    // posent les deux classes sur le même élément — et c'est `.card` qui
    // fixe `border:1px solid var(--line);border-radius:var(--radius)`.
    // Depuis D124, ce ne sont plus « deux fichiers, deux questions » (D122,
    // D123) : `--app-bord`/`--radius` de `app/globals.css` valent la même
    // valeur que cette maquette mesure, et ce gardien le confronte plutôt que
    // de recopier un nombre.
    const card = regle(".card");
    expect(propriete(card, "border")).toContain("var(--line)");
    expect(propriete(card, "border-radius")).toBe("var(--radius)");

    expect(CARTE_ENTITE).toContain("border-app-bord");
    expect(CARTE_ENTITE).toContain("rounded-lg");
    expect(CARTE_ENTITE).not.toMatch(/rounded-\[\d+px\]/);
  });

  it("le titre reprend la marge et la taille de .entity-card h3", () => {
    const h3 = regle(".entity-card h3");
    const [haut, , bas] = propriete(h3, "margin").split(" ");
    expect(haut).toBe("0");
    expect(CARTE_ENTITE).toContain("m-0");
    expect(CARTE_ENTITE).toContain(`mb-[${bas}]`);

    expect(propriete(h3, "font-size")).toBe("15px");
    expect(CARTE_ENTITE).toContain("text-[15px]");
  });

  it("les lignes reprennent la marge et la taille de .entity-card p", () => {
    const p = regle(".entity-card p");
    const [vertical] = propriete(p, "margin").split(" ");
    expect(CARTE_ENTITE).toContain(`my-[${vertical}]`);

    expect(propriete(p, "font-size")).toBe("12px");
    expect(CARTE_ENTITE).toContain("text-[12px]");
  });

  it("la bande de compteurs reprend l'écart, la marge et le rembourrage de .entity-meta", () => {
    const meta = regle(".entity-meta");
    expect(propriete(meta, "gap")).toBe("13px");
    expect(CARTE_ENTITE).toContain("gap-[13px]");

    expect(propriete(meta, "margin-top")).toBe("14px");
    expect(CARTE_ENTITE).toContain("mt-[14px]");

    expect(propriete(meta, "padding-top")).toBe("13px");
    expect(CARTE_ENTITE).toContain("pt-[13px]");
  });

  it("chaque compteur reprend .entity-meta b (bloc) et .entity-meta span (taille)", () => {
    expect(propriete(regle(".entity-meta b"), "display")).toBe("block");
    expect(CARTE_ENTITE).toContain("block");

    expect(propriete(regle(".entity-meta span"), "font-size")).toBe("11px");
    // D138 (docs/arbitrages.md, 29/09/2026) : plancher de 12 px, amende D124
    // et D95 — la maquette dessine 11 px, le produit affiche 12 px.
    expect(CARTE_ENTITE).toContain("text-app-encre-faible text-12");
  });

  it("la grille reprend les trois colonnes et l'écart de .site-cards,.client-cards", () => {
    const grille = regleGrille();
    expect(propriete(grille, "grid-template-columns")).toBe(
      "repeat(3,minmax(0,1fr))",
    );
    expect(CARTE_ENTITE).toContain("grid-cols-3");

    expect(propriete(grille, "gap")).toBe("14px");
    expect(CARTE_ENTITE).toContain("gap-[14px]");
  });

  it("les deux paliers mesurés (1180px, 900px) sont repris, jamais ceux de Tailwind par défaut", () => {
    expect(MAQUETTE).toContain("@media(max-width:1180px)");
    expect(CARTE_ENTITE).toContain("max-[1180px]:grid-cols-2");

    expect(MAQUETTE).toContain("@media(max-width:900px)");
    expect(CARTE_ENTITE).toContain("max-[900px]:grid-cols-1");
  });
});

/**
 * LES PASTILLES DE COMPTEUR (PASTILLES-1, 23/09/2026) — un `ton` facultatif
 * par compteur, jamais un choix de la carte elle-même.
 */
describe("CarteEntite — compteurs avec ou sans ton (PASTILLES-1)", () => {
  it("sans ton, le rendu reste celui d'avant : .entity-meta b/span, aucune pastille", () => {
    const { container } = render(
      createElement(CarteEntite, {
        titre: "Titre",
        lignes: [],
        compteurs: [{ valeur: 3, libelle: "équipements" }],
      }),
    );
    const bloc = container.querySelector("b");
    expect(bloc?.className).toContain("block");
    expect(bloc?.className).not.toContain("rounded-full");
    expect(container.querySelector(".rounded-full")).toBeNull();
  });

  it("avec un ton, le compteur se rend en pastille : classe du ton, chiffre en gras", () => {
    const { container } = render(
      createElement(CarteEntite, {
        titre: "Titre",
        lignes: [],
        compteurs: [{ valeur: 1, libelle: "site", ton: "bleu" }],
      }),
    );
    const pastille = container.querySelector(".rounded-full");
    expect(pastille).not.toBeNull();
    expect(pastille?.className).toContain("bg-app-bleu-fond");
    expect(pastille?.className).toContain("text-app-bleu-encre");
    const chiffre = pastille?.querySelector("b");
    expect(chiffre?.className).toContain("font-bold");
    expect(chiffre?.textContent).toBe("1");
  });

  it("la rangée de compteurs est centrée", () => {
    const { container } = render(
      createElement(CarteEntite, {
        titre: "Titre",
        lignes: [],
        compteurs: [{ valeur: 1, libelle: "site", ton: "bleu" }],
      }),
    );
    const rangee = container.querySelector(".rounded-full")?.parentElement;
    expect(rangee?.className).toContain("justify-center");
  });
});

/**
 * `href` — LA CARTE ENTIÈRE OUVRE LA FICHE (9EB-TP-UX3-2-LISTES-1).
 *
 * *Un seul `<a>`, étendu à toute la carte* : jamais un second lien
 * superposé, qui casserait la navigation au clavier.
 */
describe("CarteEntite — href (9EB-TP-UX3-2-LISTES-1)", () => {
  it("SANS href, le rendu reste EXACTEMENT celui d'avant ce ticket", () => {
    const { container } = render(
      createElement(CarteEntite, {
        titre: "Garage de la Baie",
        lignes: ["CLI-000184"],
        compteurs: [],
      }),
    );
    expect(container.querySelectorAll("a")).toHaveLength(0);
    const h3 = container.querySelector("h3");
    expect(h3?.className).toContain("text-[15px]");
    expect(h3?.className).not.toContain("text-[16px]");
    const article = container.querySelector("article");
    expect(article?.className).not.toContain("relative");
    expect(article?.className).toContain("p-[17px]");
  });

  it("AVEC href, un SEUL <a> existe, posé sur le titre et étendu à toute la carte", () => {
    const { container } = render(
      createElement(CarteEntite, {
        titre: "Garage de la Baie",
        lignes: [],
        compteurs: [],
        href: "/clients/cli-1",
      }),
    );
    const liens = container.querySelectorAll("a");
    expect(liens).toHaveLength(1);
    expect(liens[0]?.getAttribute("href")).toBe("/clients/cli-1");
    expect(liens[0]?.textContent).toBe("Garage de la Baie");
    // L'AIRE DE CLIC EST ÉTENDUE PAR UN `::after` ÉTIRÉ, jamais un second lien.
    expect(liens[0]?.className).toContain("after:absolute");
    expect(liens[0]?.className).toContain("after:inset-0");
    const article = container.querySelector("article");
    expect(article?.className).toContain("relative");
    const h3 = container.querySelector("h3");
    expect(h3?.className).toContain("text-[16px]");
  });

  it("le titre garde CLASSES_LIEN — un lien visible sans survol, même avec href", () => {
    const { container } = render(
      createElement(CarteEntite, {
        titre: "Garage de la Baie",
        lignes: [],
        compteurs: [],
        href: "/clients/cli-1",
      }),
    );
    const lien = container.querySelector("a");
    expect(lien?.className).toMatch(/(^|\s)underline(\s|$)/);
    expect(lien?.className).toContain("text-app-marque");
  });
});

/**
 * `chiffres` — LA BANDE DE LA MAQUETTE DU 28/09 (9EB-TP-UX3-2-LISTES-1),
 * DISTINCTE de `compteurs` : alignée à gauche, jamais de pastille.
 */
describe("CarteEntite — chiffres (9EB-TP-UX3-2-LISTES-1)", () => {
  it("absents, aucune bande ne se rend — même contrat que `compteurs` vide", () => {
    const { container } = render(
      createElement(CarteEntite, {
        titre: "Titre",
        lignes: [],
        compteurs: [],
      }),
    );
    expect(container.querySelector("[data-chiffre]")).toBeNull();
  });

  it("sans ton, aucune pastille — un chiffre au-dessus de son libellé, aligné à GAUCHE", () => {
    const { container } = render(
      createElement(CarteEntite, {
        titre: "Titre",
        lignes: [],
        compteurs: [],
        chiffres: [{ valeur: 3, libelle: "sites" }],
      }),
    );
    expect(container.querySelector(".rounded-full")).toBeNull();
    const bande = container.querySelector("b")?.parentElement?.parentElement;
    expect(bande?.className).not.toContain("justify-center");
    const chiffre = container.querySelector("b");
    expect(chiffre?.textContent).toBe("3");
    expect(chiffre?.className).not.toContain("text-app-rouge-encre");
    expect(chiffre?.className).not.toContain("text-app-orange-encre");
  });

  it("le ton `avertissement` colore le TEXTE du chiffre, jamais un fond", () => {
    const { container } = render(
      createElement(CarteEntite, {
        titre: "Titre",
        lignes: [],
        compteurs: [],
        chiffres: [{ valeur: 2, libelle: "à planifier", ton: "avertissement" }],
      }),
    );
    const chiffre = container.querySelector("b");
    expect(chiffre?.className).toContain("text-app-orange-encre");
    expect(container.querySelector(".rounded-full")).toBeNull();
  });

  it("le ton `retard` colore le texte en rouge", () => {
    const { container } = render(
      createElement(CarteEntite, {
        titre: "Titre",
        lignes: [],
        compteurs: [],
        chiffres: [{ valeur: 1, libelle: "VGP dépassée", ton: "retard" }],
      }),
    );
    const chiffre = container.querySelector("b");
    expect(chiffre?.className).toContain("text-app-rouge-encre");
  });
});
