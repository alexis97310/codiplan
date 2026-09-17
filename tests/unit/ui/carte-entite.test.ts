import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * LA CARTE D'ENTITÉ EST CONFRONTÉE À `codiplan-maquette-complete.html`,
 * JAMAIS RECOPIÉE D'ELLE (D123, N-08) — la même discipline que
 * `tests/unit/ui/composants-maquette.test.ts` applique à `Page`, `Carte`,
 * `Fiche`, `Badge`, `Kpi` et `Tableau`, ici pour `.entity-card`, `.entity-
 * card h3`, `.entity-card p`, `.entity-meta`, `.entity-meta b`,
 * `.entity-meta span` et la grille `.client-cards`/`.site-cards`.
 *
 * **Pourquoi un fichier séparé plutôt qu'un ajout au gardien existant.**
 * Celui-ci lit `docs/maquette/CODIPLAN_Maquette.html` — la source des
 * couleurs et de la disposition (D95). `.entity-card` n'y existe pas du
 * tout : c'est `docs/maquette/codiplan-maquette-complete.html` qui la
 * dessine, et confondre les deux sources dans une même fonction `regle`
 * aurait fait lire la mauvaise maquette sans qu'aucune erreur ne le dise.
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

  it("la carte reprend le rembourrage de .entity-card, jamais sa bordure ni son rayon", () => {
    const carte = regle(".entity-card");
    expect(propriete(carte, "padding")).toBe("17px");
    expect(CARTE_ENTITE).toContain("p-[17px]");

    // LA BORDURE ET LE RAYON RESTENT CEUX DE D95 (#E1E4E8, 10px), jamais
    // `#dce2ea`/`14px` de cette seconde maquette — « deux fichiers, deux
    // questions » (D122).
    expect(CARTE_ENTITE).toContain("border-app-bord");
    expect(CARTE_ENTITE).toContain("rounded-[10px]");
    expect(CARTE_ENTITE).not.toContain("rounded-[14px]");
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
    expect(CARTE_ENTITE).toContain("text-[11px]");
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
