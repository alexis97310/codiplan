import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";

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
 * `ÉtatVide` et `Champ` n'ont pas de règle à lire : la maquette est MUETTE sur
 * un état vide ou un champ de saisie générique — ses onze écrans sont peuplés
 * de données de démonstration et n'affichent jamais un formulaire de saisie.
 * Leur propre fichier porte le raisonnement, pièce par pièce ; aucun gardien
 * n'invente une règle que le document ne contient pas.
 *
 * **`BarreDeFiltres` en sortait à tort** — mesuré le 18/09/2026 par le
 * directeur d'exploitation, un silence qu'aucun gardien ne couvrait : depuis
 * D125, `parc()` et `clients()` dessinent bel et bien `.toolbar > .search >
 * input.field`, une loupe comprise. La note ci-dessus datait de N-08, avant
 * D125 ; elle n'a jamais été relue depuis. Voir le bloc dédié plus bas.
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
const MAITRE_DETAIL = source("components/ui/maitre-detail.tsx");
const FICHE_MACHINE = source("app/(back-office)/parc/[id]/page.tsx");
const BARRE_DE_FILTRES = source("components/ui/barre-de-filtres.tsx");
const PARC_PAGE = source("app/(back-office)/parc/page.tsx");
const CLIENTS_PAGE = source("app/(back-office)/clients/page.tsx");

/** Les graisses Tailwind que ce gardien sait lire — un fait du framework, pas de l'application. */
const GRAISSES: Readonly<Record<string, number>> = {
  "font-normal": 400,
  "font-medium": 500,
  "font-semibold": 600,
  "font-bold": 700,
  "font-extrabold": 800,
  "font-black": 900,
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

  it("la carte reprend le rayon de bordure de .card — via `--radius`, depuis D124", () => {
    // `CODIPLAN_Maquette.html` mesure encore `10px` en dur (D95, disposition) ;
    // la VALEUR du jeton, elle, vient désormais de `codiplan-maquette-
    // complete.html` (D124) — `14px`, confronté par
    // `tests/unit/theme/apparence.test.ts`. Ce gardien-ci vérifie seulement
    // que le composant ne recopie plus un nombre : il lit `--radius` par
    // `rounded-lg`, jamais un `rounded-[…px]` littéral.
    const card = regle(".card");
    expect(propriete(card, "border-radius")).toBe("10px");
    expect(CARTE).toContain("rounded-lg");
    expect(CARTE).not.toMatch(/rounded-\[\d+px\]/);
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
    expect(KPI).toContain("rounded-lg");
    expect(KPI).not.toMatch(/rounded-\[\d+px\]/);
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

/**
 * Maître-détail — `.master-detail`, `.machine-list`, `.machine-row`,
 * `.detail-hero`, `.machine-symbol`, `.detail-body`, `.kv`, `.timeline`,
 * `.empty` de `codiplan-maquette-complete.html` (N-10, D125).
 *
 * Toutes les mesures ici viennent de la SECONDE maquette : D125 en fait la
 * source de la disposition de `/parc`, exactement comme D124 l'a déjà faite
 * pour les jetons — deux fichiers, deux blocs de lecture, jamais mêlés.
 */
describe("MaitreDetail — .master-detail de la maquette (N-10, D125)", () => {
  it("a réellement lu une règle — le témoin de non-vacuité", () => {
    expect(regleComplete(".master-detail").length).toBeGreaterThan(0);
  });

  it("la grille reprend les colonnes et l'écart de .master-detail", () => {
    const bloc = regleComplete(".master-detail");
    expect(propriete(bloc, "grid-template-columns")).toBe(
      "minmax(360px,.85fr) minmax(430px,1.15fr)",
    );
    expect(MAITRE_DETAIL).toContain(
      "grid-cols-[minmax(360px,.85fr)_minmax(430px,1.15fr)]",
    );

    expect(propriete(bloc, "gap")).toBe("16px");
    expect(MAITRE_DETAIL).toContain("gap-4");
  });

  it("le repli à une colonne suit le seuil de 900px de la maquette", () => {
    expect(MAQUETTE_COMPLETE).toContain("@media(max-width:900px)");
    expect(MAITRE_DETAIL).toContain("min-[901px]:grid-cols-");
  });
});

describe("CarteListe — .machine-list et .card-head de la maquette", () => {
  it("a réellement lu deux règles — le témoin de non-vacuité", () => {
    expect(regleComplete(".machine-list").length).toBeGreaterThan(0);
    expect(regleComplete(".card-head").length).toBeGreaterThan(0);
  });

  it("la liste reprend la hauteur de défilement de .machine-list", () => {
    const bloc = regleComplete(".machine-list");
    expect(propriete(bloc, "max-height")).toBe("680px");
    expect(MAITRE_DETAIL).toContain("max-h-[680px]");
    expect(propriete(bloc, "overflow")).toBe("auto");
    expect(MAITRE_DETAIL).toContain("overflow-auto");
  });

  it("l'en-tête reprend le rembourrage et la taille de .card-head", () => {
    const bloc = regleComplete(".card-head");
    const [vertical, horizontal] = propriete(bloc, "padding").split(" ");
    expect(MAITRE_DETAIL).toContain(`py-[${vertical}]`);
    expect(MAITRE_DETAIL).toContain(`px-[${horizontal}]`);

    const h2 = regleComplete(".card-head h2,.card-head h3");
    expect(propriete(h2, "font-size")).toBe("15px");
    expect(MAITRE_DETAIL).toContain("text-[15px]");
  });
});

describe("RangeeMaitreDetail — .machine-row de la maquette", () => {
  it("a réellement lu quatre règles — le témoin de non-vacuité", () => {
    expect(regleComplete(".machine-row").length).toBeGreaterThan(0);
    expect(regleComplete(".machine-row.selected").length).toBeGreaterThan(0);
    expect(regleComplete(".machine-row h3").length).toBeGreaterThan(0);
    expect(regleComplete(".machine-row p").length).toBeGreaterThan(0);
  });

  it("la ligne reprend le rembourrage, la grille et l'écart de .machine-row", () => {
    const bloc = regleComplete(".machine-row");
    const [vertical, horizontal] = propriete(bloc, "padding").split(" ");
    expect(MAITRE_DETAIL).toContain(`py-[${vertical}]`);
    expect(MAITRE_DETAIL).toContain(`px-[${horizontal}]`);

    expect(propriete(bloc, "grid-template-columns")).toBe("1fr auto");
    expect(MAITRE_DETAIL).toContain("grid-cols-[1fr_auto]");
  });

  it("la ligne SÉLECTIONNÉE reprend le liseré interne de .machine-row.selected", () => {
    // `--blue` vaut `--app-marque` (D122) : le liseré n'introduit aucun
    // second jeton de bleu, il reprend celui déjà posé pour l'onglet actif.
    //
    // `.machine-row.selected` apparaît DEUX fois dans la maquette — une
    // première fois dans le sélecteur combiné `.machine-row:hover,
    // .machine-row.selected{background:...}`, que `regleComplete` lirait par
    // erreur puisqu'il ne cherche pas la règle en tête de ligne. La règle du
    // liseré est isolée ici par son PROPRE motif, `box-shadow` compris.
    const motif = /\.machine-row\.selected\{box-shadow:([^}]*)\}/;
    const trouve = motif.exec(MAQUETTE_COMPLETE);
    if (trouve === null) {
      throw new Error(
        "la règle `.machine-row.selected{box-shadow:...}` est introuvable " +
          "dans docs/maquette/codiplan-maquette-complete.html",
      );
    }
    expect(trouve[1]).toBe("inset 4px 0 var(--blue)");
    expect(MAITRE_DETAIL).toContain(
      "shadow-[inset_4px_0_0_0_var(--app-marque)]",
    );
  });

  it("le titre et le sous-titre reprennent les tailles de .machine-row h3/p", () => {
    const h3 = regleComplete(".machine-row h3");
    expect(propriete(h3, "font-size")).toBe("14px");
    expect(MAITRE_DETAIL).toContain("text-[14px]");

    const p = regleComplete(".machine-row p");
    expect(propriete(p, "font-size")).toBe("12px");
    expect(MAITRE_DETAIL).toContain("text-[12px]");
  });
});

describe("DetailHero — .detail-hero et .machine-symbol de la maquette", () => {
  it("a réellement lu deux règles — le témoin de non-vacuité", () => {
    expect(regleComplete(".detail-hero").length).toBeGreaterThan(0);
    expect(regleComplete(".machine-symbol").length).toBeGreaterThan(0);
  });

  it("l'aperçu reprend le rembourrage et l'écart de .detail-hero", () => {
    const bloc = regleComplete(".detail-hero");
    expect(propriete(bloc, "padding")).toBe("21px");
    expect(MAITRE_DETAIL).toContain("p-[21px]");
    expect(propriete(bloc, "gap")).toBe("16px");
    expect(MAITRE_DETAIL).toContain("gap-4");
  });

  it("le symbole reprend la taille et la graisse de .machine-symbol — jamais son rayon littéral", () => {
    const bloc = regleComplete(".machine-symbol");
    const [largeur] = [propriete(bloc, "width")];
    expect(largeur).toBe("58px");
    expect(MAITRE_DETAIL).toContain("w-[58px]");
    expect(propriete(bloc, "height")).toBe("58px");
    expect(MAITRE_DETAIL).toContain("h-[58px]");

    expect(propriete(bloc, "font-size")).toBe("26px");
    expect(MAITRE_DETAIL).toContain("text-[26px]");

    expect(
      porteLaGraisse(MAITRE_DETAIL, Number(propriete(bloc, "font-weight"))),
    ).toBe(true);

    // LE RAYON — `14px` dans la maquette, la même VALEUR que `--radius`
    // (D124) : `rounded-lg` le lit par le jeton, jamais par un second
    // `rounded-[14px]` littéral qui redeviendrait faux si `--radius` bougeait.
    expect(propriete(bloc, "border-radius")).toBe("14px");
    expect(MAITRE_DETAIL).toContain("rounded-lg");
    expect(MAITRE_DETAIL).not.toMatch(/rounded-\[\d+px\]/);
  });
});

describe("Kv — .detail-body, .kv, .kv dt et .kv dd de la maquette", () => {
  it("a réellement lu quatre règles — le témoin de non-vacuité", () => {
    expect(regleComplete(".detail-body").length).toBeGreaterThan(0);
    expect(regleComplete(".kv").length).toBeGreaterThan(0);
    expect(regleComplete(".kv dt").length).toBeGreaterThan(0);
    expect(regleComplete(".kv dd").length).toBeGreaterThan(0);
  });

  it("le corps reprend le rembourrage de .detail-body", () => {
    expect(propriete(regleComplete(".detail-body"), "padding")).toBe("19px");
    expect(MAITRE_DETAIL).toContain("p-[19px]");
  });

  it("la grille reprend les colonnes et l'écart de .kv", () => {
    const bloc = regleComplete(".kv");
    expect(propriete(bloc, "grid-template-columns")).toBe(
      "repeat(2,minmax(0,1fr))",
    );
    expect(MAITRE_DETAIL).toContain("grid-cols-2");
    const [ligne, colonne] = propriete(bloc, "gap").split(" ");
    expect(ligne).toBe("0");
    expect(colonne).toBe("18px");
    expect(MAITRE_DETAIL).toContain(`gap-x-[${colonne}]`);
  });

  it("chaque paire reprend le rembourrage de .kv div", () => {
    const bloc = regleComplete(".kv div");
    const [vertical] = propriete(bloc, "padding").split(" ");
    expect(MAITRE_DETAIL).toContain(`py-[${vertical}]`);
  });

  it("le libellé reprend taille, capitales et graisse de .kv dt", () => {
    const dt = regleComplete(".kv dt");
    expect(propriete(dt, "font-size")).toBe("11px");
    expect(MAITRE_DETAIL).toContain("text-[11px]");
    expect(propriete(dt, "text-transform")).toBe("uppercase");
    expect(MAITRE_DETAIL).toContain("uppercase");
    expect(
      porteLaGraisse(MAITRE_DETAIL, Number(propriete(dt, "font-weight"))),
    ).toBe(true);
  });

  it("la valeur reprend l'espacement et la graisse de .kv dd", () => {
    const dd = regleComplete(".kv dd");
    const [haut] = propriete(dd, "margin").split(" ");
    expect(MAITRE_DETAIL).toContain(`mt-[${haut}]`);
    expect(
      porteLaGraisse(MAITRE_DETAIL, Number(propriete(dd, "font-weight"))),
    ).toBe(true);
  });
});

describe("Timeline — .timeline et .timeline-item de la maquette", () => {
  it("a réellement lu deux règles — le témoin de non-vacuité", () => {
    expect(regleComplete(".timeline").length).toBeGreaterThan(0);
    expect(regleComplete(".timeline-item").length).toBeGreaterThan(0);
  });

  it("la frise reprend l'écart de .timeline", () => {
    const bloc = regleComplete(".timeline");
    expect(propriete(bloc, "margin-top")).toBe("18px");
    expect(MAITRE_DETAIL).toContain("mt-[18px]");
    expect(propriete(bloc, "padding-left")).toBe("20px");
    expect(MAITRE_DETAIL).toContain("pl-[20px]");
  });

  it("chaque étape reprend le rembourrage de .timeline-item", () => {
    const bloc = regleComplete(".timeline-item");
    const padding = propriete(bloc, "padding").split(" ");
    const bas = padding[2];
    const gauche = padding[3];
    expect(MAITRE_DETAIL).toContain(`pb-[${bas}]`);
    expect(MAITRE_DETAIL).toContain(`pl-[${gauche}]`);
  });
});

describe("CarteVide — .empty de la maquette (l'état vide du maître-détail)", () => {
  it("a réellement lu deux règles — le témoin de non-vacuité", () => {
    expect(regleComplete(".empty").length).toBeGreaterThan(0);
    expect(regleComplete(".empty b").length).toBeGreaterThan(0);
  });

  it("la carte reprend le rembourrage de .empty, et son titre celui de .empty b", () => {
    const bloc = regleComplete(".empty");
    const [vertical, horizontal] = propriete(bloc, "padding").split(" ");
    expect(MAITRE_DETAIL).toContain(`py-[${vertical}]`);
    expect(MAITRE_DETAIL).toContain(`px-[${horizontal}]`);

    const b = regleComplete(".empty b");
    expect(propriete(b, "font-size")).toBe("16px");
    expect(MAITRE_DETAIL).toContain("text-[16px]");
    expect(propriete(b, "margin-bottom")).toBe("5px");
    expect(MAITRE_DETAIL).toContain("mb-[5px]");
  });
});

/**
 * LA FICHE MACHINE — `.machine-page`, `.machine-banner`, `.qr-card`,
 * `.alert-strip`, `.alert-num` de `codiplan-maquette-complete.html` (N-11,
 * D125). Ces cinq règles vivent dans `app/(back-office)/parc/[id]/page.tsx`
 * et nulle part ailleurs — c'est le seul écran qui les rend — d'où
 * `FICHE_MACHINE` plutôt que `MAITRE_DETAIL` comme source confrontée.
 */
describe("La fiche machine — .machine-page de la maquette", () => {
  it("a réellement lu une règle — le témoin de non-vacuité", () => {
    expect(regleComplete(".machine-page").length).toBeGreaterThan(0);
  });

  it("les deux colonnes et l'écart reprennent .machine-page", () => {
    const bloc = regleComplete(".machine-page");
    expect(propriete(bloc, "grid-template-columns")).toBe(
      "minmax(0,1.4fr) minmax(310px,.6fr)",
    );
    expect(FICHE_MACHINE).toContain(
      "grid-cols-[minmax(0,1.4fr)_minmax(310px,.6fr)]",
    );
    expect(propriete(bloc, "gap")).toBe("16px");
    expect(FICHE_MACHINE).toContain("gap-4");
  });

  it("le repli de largeur à 1180px REPLIE .machine-page À UNE COLONNE — aucun menu, aucun tiroir", () => {
    // Mesuré dans `@media(max-width:1180px){...,.machine-page{grid-template-
    // columns:1fr}...}` : c'est le SEUL repli que N-11 construit pour cet
    // écran (§0 du ticket) — jamais un ☰, jamais une barre latérale.
    const motif =
      /@media\(max-width:1180px\)\{[\s\S]*?\.machine-page\{grid-template-columns:1fr\}/;
    expect(
      motif.test(MAQUETTE_COMPLETE),
      "le repli à 1180px de .machine-page est introuvable dans la maquette",
    ).toBe(true);
    expect(FICHE_MACHINE).toContain("min-[1181px]:grid-cols-");
  });
});

describe("La fiche machine — .machine-banner de la maquette", () => {
  it("a réellement lu une règle — le témoin de non-vacuité", () => {
    expect(regleComplete(".machine-banner").length).toBeGreaterThan(0);
  });

  it("la bannière reprend le rembourrage et l'écart de .machine-banner", () => {
    const bloc = regleComplete(".machine-banner");
    expect(propriete(bloc, "padding")).toBe("22px");
    expect(FICHE_MACHINE).toContain("p-[22px]");
    expect(propriete(bloc, "gap")).toBe("16px");
    expect(FICHE_MACHINE).toContain("gap-4");
    expect(propriete(bloc, "align-items")).toBe("flex-start");
    expect(FICHE_MACHINE).toContain("items-start");
  });
});

describe("La fiche machine — .qr-card de la maquette, dont sa position collante", () => {
  it("a réellement lu une règle — le témoin de non-vacuité", () => {
    expect(regleComplete(".qr-card").length).toBeGreaterThan(0);
  });

  it("la carte reprend le rembourrage et le centrage de .qr-card", () => {
    const bloc = regleComplete(".qr-card");
    expect(propriete(bloc, "padding")).toBe("20px");
    expect(FICHE_MACHINE).toContain("p-[20px]");
    expect(propriete(bloc, "text-align")).toBe("center");
    expect(FICHE_MACHINE).toContain("text-center");
  });

  it("LA POSITION COLLANTE reprend .qr-card — sticky, au décalage mesuré", () => {
    const bloc = regleComplete(".qr-card");
    expect(propriete(bloc, "position")).toBe("sticky");
    expect(FICHE_MACHINE).toContain("sticky");
    expect(propriete(bloc, "top")).toBe("88px");
    expect(FICHE_MACHINE).toContain("top-[88px]");
  });

  it("le repli à 1180px REND .qr-card STATIQUE — mesuré, jamais supposé", () => {
    const motif =
      /@media\(max-width:1180px\)\{[\s\S]*?\.qr-card\{position:static\}/;
    expect(
      motif.test(MAQUETTE_COMPLETE),
      "le repli à 1180px de .qr-card (position:static) est introuvable",
    ).toBe(true);
    // La classe `sticky` ne s'applique qu'AU-DESSUS de 1180px : en dessous,
    // aucune classe `sticky` non préfixée ne doit rester active.
    expect(FICHE_MACHINE).toContain("min-[1181px]:sticky");
    expect(FICHE_MACHINE).not.toMatch(/(?<!:)\bsticky\b/);
  });
});

describe("La fiche machine — .alert-strip et .alert-num de la maquette", () => {
  it("a réellement lu deux règles — le témoin de non-vacuité", () => {
    expect(regleComplete(".alert-strip").length).toBeGreaterThan(0);
    expect(regleComplete(".alert-num").length).toBeGreaterThan(0);
  });

  it("le bandeau reprend la grille, l'écart et le rayon de .alert-strip", () => {
    const bloc = regleComplete(".alert-strip");
    expect(propriete(bloc, "grid-template-columns")).toBe("auto 1fr auto");
    expect(FICHE_MACHINE).toContain("grid-cols-[auto_1fr_auto]");
    expect(propriete(bloc, "gap")).toBe("12px");
    expect(FICHE_MACHINE).toContain("gap-[12px]");
    expect(propriete(bloc, "padding")).toBe("15px");
    expect(FICHE_MACHINE).toContain("p-[15px]");
    expect(propriete(bloc, "border-radius")).toBe("12px");
    expect(FICHE_MACHINE).toContain("rounded-[12px]");
  });

  it("le rond reprend la taille, la forme et la graisse de .alert-num", () => {
    const bloc = regleComplete(".alert-num");
    expect(propriete(bloc, "width")).toBe("38px");
    expect(FICHE_MACHINE).toContain("w-[38px]");
    expect(propriete(bloc, "height")).toBe("38px");
    expect(FICHE_MACHINE).toContain("h-[38px]");
    expect(propriete(bloc, "border-radius")).toBe("50%");
    expect(FICHE_MACHINE).toContain("rounded-full");
    expect(
      porteLaGraisse(FICHE_MACHINE, Number(propriete(bloc, "font-weight"))),
    ).toBe(true);
  });
});

/**
 * BarreDeFiltres — `.search`, `.search .field`, `.search:before` et
 * `.field,.select` de `codiplan-maquette-complete.html` (N-12, 18/09/2026).
 *
 * `/parc` et `/clients` sont les DEUX SEULS écrans qui rendent ce composant
 * — mesuré : `grep BarreDeFiltres` ne trouve que ces deux appelants. `/sites`
 * et `/interventions` portent chacun leur propre formulaire de recherche,
 * distinct de celui-ci ; ce gardien ne les confronte donc pas.
 */
describe("BarreDeFiltres — .search et .field,.select de la maquette (N-12)", () => {
  it("a réellement lu les règles — le témoin de non-vacuité", () => {
    expect(regleComplete(".toolbar").length).toBeGreaterThan(0);
    expect(regleComplete(".search").length).toBeGreaterThan(0);
    expect(regleComplete(".search .field").length).toBeGreaterThan(0);
    expect(regleComplete(".search:before").length).toBeGreaterThan(0);
    expect(regleComplete(".field,.select").length).toBeGreaterThan(0);
  });

  it("le champ grandit avec la barre — flex et largeur minimale de .search", () => {
    const bloc = regleComplete(".search");
    expect(propriete(bloc, "flex")).toBe("1");
    expect(BARRE_DE_FILTRES).toContain("flex-1");
    expect(propriete(bloc, "min-width")).toBe("220px");
    expect(BARRE_DE_FILTRES).toContain("min-w-[220px]");
  });

  it("le champ réserve la place de la loupe — .search .field", () => {
    const bloc = regleComplete(".search .field");
    expect(propriete(bloc, "padding-left")).toBe("38px");
    expect(BARRE_DE_FILTRES).toContain("pl-[38px]");
  });

  it("la loupe reprend le glyphe, le décalage et le corps de .search:before", () => {
    const bloc = regleComplete(".search:before");
    expect(propriete(bloc, "content")).toBe('"⌕"');
    // Le glyphe passe par le dictionnaire (L0-11) : pas de littéral ici,
    // mais la MÊME valeur, confrontée à celle que la maquette écrit.
    expect(fr["recherche.loupe"]).toBe("⌕");
    expect(BARRE_DE_FILTRES).toContain('t("recherche.loupe")');
    expect(propriete(bloc, "left")).toBe("13px");
    expect(BARRE_DE_FILTRES).toContain("left-[13px]");
    expect(propriete(bloc, "font-size")).toBe("20px");
    expect(BARRE_DE_FILTRES).toContain("text-[20px]");
  });

  it("le champ ET le sélecteur reprennent hauteur et rayon de .field,.select", () => {
    const bloc = regleComplete(".field,.select");
    expect(propriete(bloc, "height")).toBe("40px");
    expect(BARRE_DE_FILTRES).toContain("h-[40px]");
    expect(PARC_PAGE).toContain("h-[40px]");
    expect(CLIENTS_PAGE).toContain("h-[40px]");

    expect(propriete(bloc, "border-radius")).toBe("9px");
    expect(BARRE_DE_FILTRES).toContain("rounded-[9px]");
    expect(PARC_PAGE).toContain("rounded-[9px]");
    expect(CLIENTS_PAGE).toContain("rounded-[9px]");

    // La moitié GAUCHE du rembourrage est écrasée par `.search .field`
    // (38px, ci-dessus) ; c'est la moitié DROITE, seule commune au champ et
    // au `<select>`, que ce test confronte — `px-3` vaut 12px sur l'échelle
    // Tailwind par défaut (la même lecture que D124 pose déjà pour `.table
    // td`, `tests/unit/ui/composants-maquette.test.ts` plus haut).
    expect(propriete(bloc, "padding")).toBe("0 12px");
    expect(BARRE_DE_FILTRES).toContain("pr-3");
    expect(PARC_PAGE).toContain("px-3");
    expect(CLIENTS_PAGE).toContain("px-3");
  });

  it("plus aucune largeur, police ou rayon en dur (§9, 01/09)", () => {
    // Les quatre défauts mesurés le 18/09/2026 : une largeur FIXE, un corps
    // de police recopié plutôt qu'hérité, un rayon Tailwind générique, et
    // aucune loupe. Ce test les tient dans les DEUX SENS — la reformulation
    // d'un défaut sous un autre nom romprait le témoin de non-régression.
    expect(BARRE_DE_FILTRES).not.toContain("min-w-64");
    expect(BARRE_DE_FILTRES).not.toMatch(/text-\[12\.5px\]/);
    expect(BARRE_DE_FILTRES).not.toContain("rounded-md");
  });
});
