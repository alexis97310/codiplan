import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * LA COUCHE DE COMPOSANTS EST CONFRONTÉE AU `<style>` DE LA MAQUETTE, jamais
 * recopiée d'elle (AT-04, D95).
 *
 * ## Ce que ce gardien répare
 *
 * *Chaque écran du back-office avait dessiné sa propre carte, son propre
 * titre, sa propre pastille* — rien ne ressemblait à rien, et la maquette
 * n'était comparée à personne : le seul gardien qui existait avant ce ticket
 * ne mordait que sur la BARRE de navigation
 * (`tests/unit/navigation/entrees.test.ts`). Ce fichier applique la même
 * discipline aux pièces que les écrans assemblent : `Page`, `Carte`, `Fiche`,
 * `Badge`, et `Tableau` qui existait déjà sans être éprouvé de cette façon.
 *
 * **La population vient du DOCUMENT, jamais d'une recopie.** Comme
 * `tests/unit/theme/apparence.test.ts` le fait pour les jetons de couleur, ce
 * gardien lit une règle CSS de la maquette, en extrait la valeur, et exige que
 * le texte source du composant porte la même mesure — jamais un nombre
 * approché. *Une valeur recopiée à la main devient fausse le jour où la
 * maquette bouge, sans rougir* (§9, 01/09) : ici, il n'y a rien à recopier,
 * seulement à confronter.
 *
 * ## Ce qu'il ne couvre pas, et pourquoi c'est écrit
 *
 * `ÉtatVide`, `Champ` et `BarreDeFiltres` n'ont pas de règle à lire : la
 * maquette est MUETTE sur un état vide, un champ de saisie ou une barre de
 * recherche — ses onze écrans sont peuplés de données de démonstration et
 * n'affichent jamais un formulaire de saisie. Leur propre fichier porte le
 * raisonnement, pièce par pièce ; aucun gardien n'invente une règle que le
 * document ne contient pas.
 *
 * `Tableau` mélange l'échelle Tailwind (`px-4` pour 16 px, un multiple de
 * l'échelle par défaut) et les valeurs entre crochets (`py-[9px]`) — il
 * existait avant ce ticket, et ce gardien le lit tel qu'il est plutôt que de
 * le réécrire pour le confort d'un test.
 *
 * ## LE SURTITRE DE DOMAINE DE `Page` LIT L'AUTRE MAQUETTE (N-08)
 *
 * `docs/maquette/CODIPLAN_Maquette.html` ne dessine aucun `eyebrow` — mesuré :
 * elle n'a ni menu à trois domaines ni fil de position (D95 muet, D122 sur ce
 * point précis). C'est `docs/maquette/codiplan-maquette-complete.html`
 * (`.eyebrow`) qui porte cette forme, la même source que D121/D122 pour la
 * barre latérale et le vocabulaire d'écran. Deux fichiers, deux blocs de
 * lecture séparés ci-dessous — jamais mêlés dans une même fonction `regle`.
 */

const MAQUETTE = readFileSync(
  join(process.cwd(), "docs/maquette/CODIPLAN_Maquette.html"),
  "utf8",
);

const MAQUETTE_COMPLETE = readFileSync(
  join(process.cwd(), "docs/maquette/codiplan-maquette-complete.html"),
  "utf8",
);

/** La même extraction que `regle`, sur `codiplan-maquette-complete.html`. */
function regleComplete(selecteur: string): string {
  const echappe = selecteur.replace(/[.*+^${}()|[\]\\]/g, "\\$&");
  const motif = new RegExp(`${echappe}\\{([^}]*)\\}`, "m");
  const trouve = motif.exec(MAQUETTE_COMPLETE);
  if (trouve === null) {
    throw new Error(
      `la règle \`${selecteur}\` est introuvable dans docs/maquette/codiplan-maquette-complete.html — ` +
        "le document a changé de forme, et ce gardien ne mesure plus rien",
    );
  }
  return trouve[1];
}

/** Le contenu d'une règle CSS de la maquette, désignée par son sélecteur EXACT. */
function regle(selecteur: string): string {
  const echappe = selecteur.replace(/[.*+^${}()|[\]\\]/g, "\\$&");
  const motif = new RegExp(`^${echappe}\\{([^}]*)\\}`, "m");
  const trouve = motif.exec(MAQUETTE);
  if (trouve === null) {
    throw new Error(
      `la règle \`${selecteur}\` est introuvable dans docs/maquette/CODIPLAN_Maquette.html — ` +
        "le document a changé de forme, et ce gardien ne mesure plus rien",
    );
  }
  return trouve[1];
}

/** La valeur BRUTE d'une propriété, à l'intérieur d'un bloc déjà extrait. */
function propriete(bloc: string, nom: string): string {
  const motif = new RegExp(`(?:^|;)\\s*${nom}\\s*:\\s*([^;]+)`);
  const trouve = motif.exec(bloc);
  if (trouve === null) {
    throw new Error(`la propriété \`${nom}\` est absente du bloc \`${bloc}\``);
  }
  return trouve[1].trim();
}

/** La même valeur, EN NOMBRE — la maquette écrit `.4px`, une source écrit `0.4px`. */
function enPixels(valeur: string): number {
  return Number.parseFloat(valeur);
}

function source(chemin: string): string {
  return readFileSync(join(process.cwd(), chemin), "utf8");
}

const PAGE = source("components/mise-en-page/page.tsx");
const CARTE = source("components/ui/carte.tsx");
const FICHE = source("components/ui/fiche.tsx");
const BADGE = source("components/ui/badge.tsx");
const KPI = source("components/ui/kpi.tsx");
const TABLEAU = source("components/ui/tableau.tsx");

/** Les graisses Tailwind que ce gardien sait lire — un fait du framework, pas de l'application. */
const GRAISSES: Readonly<Record<string, number>> = {
  "font-normal": 400,
  "font-medium": 500,
  "font-semibold": 600,
  "font-bold": 700,
  "font-extrabold": 800,
};

/** Vrai si le texte porte une classe de graisse valant `attendue`. */
function porteLaGraisse(texte: string, attendue: number): boolean {
  return Object.entries(GRAISSES).some(
    ([classe, poids]) => poids === attendue && texte.includes(classe),
  );
}

describe("Page — h1 et .sub de la maquette", () => {
  it("a réellement lu deux règles — le témoin de non-vacuité", () => {
    expect(regle("h1").length).toBeGreaterThan(0);
    expect(regle(".sub").length).toBeGreaterThan(0);
  });

  it("le titre reprend taille, graisse, interlettrage et espacement du h1", () => {
    const h1 = regle("h1");
    expect(propriete(h1, "font-size")).toBe("22px");
    expect(PAGE).toContain("text-[22px]");

    expect(enPixels(propriete(h1, "letter-spacing"))).toBe(-0.4);
    expect(PAGE).toContain("tracking-[-0.4px]");

    expect(propriete(h1, "margin-bottom")).toBe("3px");
    expect(PAGE).toContain("mb-[3px]");

    expect(porteLaGraisse(PAGE, Number(propriete(h1, "font-weight")))).toBe(
      true,
    );
  });

  it("le sous-titre reprend taille et espacement de .sub", () => {
    const sub = regle(".sub");
    expect(propriete(sub, "font-size")).toBe("13px");
    expect(PAGE).toContain("text-[13px]");

    expect(propriete(sub, "margin-bottom")).toBe("20px");
    expect(PAGE).toContain("mb-[20px]");
  });
});

describe("Page — .eyebrow de codiplan-maquette-complete.html (N-08)", () => {
  it("a réellement lu une règle — le témoin de non-vacuité", () => {
    expect(regleComplete(".eyebrow")).toContain("color");
  });

  it("le surtitre reprend taille, capitales, interlettrage et espacement de .eyebrow", () => {
    const eyebrow = regleComplete(".eyebrow");
    expect(propriete(eyebrow, "font-size")).toBe("12px");
    expect(PAGE).toContain("text-[12px]");

    expect(propriete(eyebrow, "text-transform")).toBe("uppercase");
    expect(PAGE).toContain("uppercase");

    expect(propriete(eyebrow, "letter-spacing")).toBe(".09em");
    expect(PAGE).toContain("tracking-[0.09em]");

    expect(propriete(eyebrow, "margin-bottom")).toBe("4px");
    expect(PAGE).toContain("mb-[4px]");
  });

  it("le ton reprend --blue, qui vaut --bleu de D95 — jamais un second jeton", () => {
    // `--blue:#0053a1` (nouvelle maquette) et `--bleu:#0053A1` (D95, ancienne
    // maquette) sont la même couleur (D122) : `text-app-marque` EST ce jeton,
    // et ce gardien refuse qu'un second existe pour la même teinte.
    expect(PAGE).toContain("text-app-marque");
  });
});

describe("Carte — .card, .card h2 et .card h2 .more de la maquette", () => {
  it("a réellement lu trois règles — le témoin de non-vacuité", () => {
    expect(regle(".card").length).toBeGreaterThan(0);
    expect(regle(".card h2").length).toBeGreaterThan(0);
    expect(regle(".card h2 .more").length).toBeGreaterThan(0);
  });

  it("la carte reprend le rayon de bordure de .card", () => {
    const card = regle(".card");
    expect(propriete(card, "border-radius")).toBe("10px");
    expect(CARTE).toContain("rounded-[10px]");
  });

  it("l'en-tête reprend taille, graisse et rembourrage de .card h2", () => {
    const h2 = regle(".card h2");
    expect(propriete(h2, "font-size")).toBe("14px");
    expect(CARTE).toContain("text-[14px]");

    expect(porteLaGraisse(CARTE, Number(propriete(h2, "font-weight")))).toBe(
      true,
    );

    const [vertical, horizontal] = propriete(h2, "padding").split(" ");
    expect(CARTE).toContain(`py-[${vertical}]`);
    expect(CARTE).toContain(`px-[${horizontal}]`);
  });

  it("l'action reprend taille et graisse de .card h2 .more", () => {
    const more = regle(".card h2 .more");
    expect(propriete(more, "font-size")).toBe("11px");
    expect(CARTE).toContain("text-[11px]");

    expect(porteLaGraisse(CARTE, Number(propriete(more, "font-weight")))).toBe(
      true,
    );
  });
});

describe("Fiche — .dl, .dl dt et .dl dd de la maquette", () => {
  it("a réellement lu trois règles — le témoin de non-vacuité", () => {
    expect(regle(".dl").length).toBeGreaterThan(0);
    expect(regle(".dl dt").length).toBeGreaterThan(0);
    expect(regle(".dl dd").length).toBeGreaterThan(0);
  });

  it("la grille reprend les colonnes, l'écart et la taille de .dl", () => {
    const dl = regle(".dl");
    expect(propriete(dl, "grid-template-columns")).toBe("132px 1fr");
    expect(FICHE).toContain("grid-cols-[132px_1fr]");

    const [ligne, colonne] = propriete(dl, "gap").split(" ");
    expect(FICHE).toContain(`gap-y-[${ligne}]`);
    expect(FICHE).toContain(`gap-x-[${colonne}]`);

    expect(propriete(dl, "font-size")).toBe("13px");
    expect(FICHE).toContain("text-[13px]");
  });

  it("le libellé reprend la taille de .dl dt", () => {
    const dt = regle(".dl dt");
    expect(propriete(dt, "font-size")).toBe("12px");
    expect(FICHE).toContain("text-[12px]");
  });

  it("la valeur reprend la graisse de .dl dd", () => {
    const dd = regle(".dl dd");
    expect(porteLaGraisse(FICHE, Number(propriete(dd, "font-weight")))).toBe(
      true,
    );
  });
});

describe("Badge — .b de la maquette", () => {
  it("a réellement lu une règle — le témoin de non-vacuité", () => {
    expect(regle(".b").length).toBeGreaterThan(0);
  });

  it("la pastille reprend rembourrage, rayon, taille et graisse de .b", () => {
    const b = regle(".b");

    const [vertical, horizontal] = propriete(b, "padding").split(" ");
    expect(BADGE).toContain(`py-[${vertical}]`);
    expect(BADGE).toContain(`px-[${horizontal}]`);

    expect(propriete(b, "border-radius")).toBe("20px");
    expect(BADGE).toContain("rounded-[20px]");

    expect(propriete(b, "font-size")).toBe("11px");
    expect(BADGE).toContain("text-[11px]");

    expect(porteLaGraisse(BADGE, Number(propriete(b, "font-weight")))).toBe(
      true,
    );
  });

  it("les cinq tons sont adossés aux jetons des cinq familles, jamais à une couleur", () => {
    // Le gardien de L0-09 (`sans-couleur-en-dur.test.ts`) refuse déjà toute
    // couleur littérale ; celui-ci vérifie que les CINQ familles sont bien
    // les cinq que `lib/theme/apparence.ts` déclare, ni plus ni moins.
    for (const famille of ["bleu", "rouge", "vert", "orange", "gris"]) {
      expect(BADGE).toContain(`bg-app-${famille}-fond`);
      expect(BADGE).toContain(`text-app-${famille}-encre`);
    }
  });
});

describe("Kpi — .kpi, .kpi .l, .kpi .v2 et .kpi .d de la maquette", () => {
  it("a réellement lu quatre règles — le témoin de non-vacuité", () => {
    expect(regle(".kpi").length).toBeGreaterThan(0);
    expect(regle(".kpi .l").length).toBeGreaterThan(0);
    expect(regle(".kpi .v2").length).toBeGreaterThan(0);
    expect(regle(".kpi .d").length).toBeGreaterThan(0);
  });

  it("la carte reprend le rembourrage et le rayon de .kpi", () => {
    const kpi = regle(".kpi");
    const [vertical, horizontal] = propriete(kpi, "padding").split(" ");
    expect(KPI).toContain(`py-[${vertical}]`);
    expect(KPI).toContain(`px-[${horizontal}]`);

    expect(propriete(kpi, "border-radius")).toBe("10px");
    expect(KPI).toContain("rounded-[10px]");
  });

  it("le libellé reprend taille, capitales, interlettrage et graisse de .kpi .l", () => {
    const l = regle(".kpi .l");
    expect(propriete(l, "font-size")).toBe("11px");
    expect(KPI).toContain("text-[11px]");

    expect(propriete(l, "text-transform")).toBe("uppercase");
    expect(KPI).toContain("uppercase");

    expect(enPixels(propriete(l, "letter-spacing"))).toBe(0.6);
    expect(KPI).toContain("tracking-[0.6px]");

    expect(porteLaGraisse(KPI, Number(propriete(l, "font-weight")))).toBe(true);
  });

  it("la valeur reprend taille, graisse, interlettrage et espacement de .kpi .v2", () => {
    const v2 = regle(".kpi .v2");
    expect(propriete(v2, "font-size")).toBe("27px");
    expect(KPI).toContain("text-[27px]");

    expect(porteLaGraisse(KPI, Number(propriete(v2, "font-weight")))).toBe(
      true,
    );

    expect(enPixels(propriete(v2, "letter-spacing"))).toBe(-1);
    expect(KPI).toContain("tracking-[-1px]");

    const [haut, , bas] = propriete(v2, "margin").split(" ");
    expect(KPI).toContain(`mt-[${haut}]`);
    expect(KPI).toContain(`mb-[${bas}]`);
  });

  it("le détail reprend la taille de .kpi .d", () => {
    const d = regle(".kpi .d");
    expect(propriete(d, "font-size")).toBe("11px");
    expect(KPI).toContain("text-[11px]");
  });

  it("les trois tons non rouges sont adossés aux jetons que la maquette NOMME", () => {
    // Les mêmes paires que `tests/unit/theme/apparence.test.ts` établit entre
    // les noms de la maquette et les jetons : ce fichier ne les redéclare pas,
    // il vérifie que le filet de chaque ton s'y adosse.
    expect(KPI).toContain("bg-app-marque"); // bleu — var(--bleu)
    expect(KPI).toContain("bg-app-vert-plein"); // vert — var(--vert)
    expect(KPI).toContain("bg-app-orange-bord"); // orange — var(--orange)
  });

  it("le ton rouge rejoint la famille de statut, jamais l'accent de la marque", () => {
    // `--app-accent` et `--app-rouge-bord` valent la même teinte dans la
    // maquette, qui ne nomme `--rouge` qu'une fois — mais l'accent porte déjà
    // deux sens dans ce dépôt (marque, alerte), et `tests/unit/theme/
    // action-primaire.test.ts` refuse qu'un écran l'écrive pour un troisième.
    expect(KPI).toContain("bg-app-rouge-bord");
    expect(KPI).not.toContain("bg-app-accent");
  });
});

describe("Tableau — table, th et td de la maquette (déjà écrit, ici éprouvé)", () => {
  it("a réellement lu trois règles — le témoin de non-vacuité", () => {
    expect(regle("table").length).toBeGreaterThan(0);
    expect(regle("th").length).toBeGreaterThan(0);
    expect(regle("td").length).toBeGreaterThan(0);
  });

  it("le tableau reprend la taille de police de table", () => {
    expect(propriete(regle("table"), "font-size")).toBe("13px");
    expect(TABLEAU).toContain("text-[13px]");
  });

  it("l'en-tête reprend taille, interlettrage, graisse et rembourrage de th", () => {
    const th = regle("th");
    expect(propriete(th, "font-size")).toBe("10.5px");
    expect(TABLEAU).toContain("text-[10.5px]");

    expect(enPixels(propriete(th, "letter-spacing"))).toBe(0.6);
    expect(TABLEAU).toContain("tracking-[0.6px]");

    expect(porteLaGraisse(TABLEAU, Number(propriete(th, "font-weight")))).toBe(
      true,
    );

    const [vertical, horizontal] = propriete(th, "padding").split(" ");
    expect(TABLEAU).toContain(`py-[${vertical}]`);
    // 16px est le quatrième cran de l'échelle Tailwind par défaut (4 × 4px) —
    // un fait du framework, pas une mesure de l'application : Tableau
    // l'écrit `px-4`, littéralement comme la maquette l'écrit `16px`.
    expect(horizontal).toBe("16px");
    expect(TABLEAU).toContain("px-4");
  });

  it("une cellule reprend le rembourrage de td", () => {
    const td = regle("td");
    const [vertical, horizontal] = propriete(td, "padding").split(" ");
    expect(TABLEAU).toContain(`py-[${vertical}]`);
    expect(horizontal).toBe("16px");
    expect(TABLEAU).toContain("px-4");
  });
});
