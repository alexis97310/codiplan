import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * AUCUN LIEN DOUBLON SOUS UNE TUILE CLIQUABLE (décision d'Alexis du
 * 30/09/2026, point 12 ; D144) — depuis D140, `Kpi` (`href`) rend la tuile
 * ELLE-MÊME cliquable, chevron compris (`components/ui/kpi.tsx`). Quatre
 * tuiles portaient EN PLUS un second `<Link` au même `href`, sous la tuile :
 * un doublon, jamais un second chemin. Ce gardien lit les DEUX écrans
 * concernés et refuse qu'un bloc `data-bloc="kpi-…"` dont la `Kpi` est
 * cliquable contienne encore un `<Link` à côté d'elle.
 *
 * `kpi-grille` (`tableau-de-bord/page.tsx:334`) ENVELOPPE toutes les tuiles
 * de la première grille : ce n'en est pas une, et elle est exclue de la
 * population par son NOM, jamais par un décompte.
 */

const TABLEAU_DE_BORD = readFileSync(
  join(process.cwd(), "app/(back-office)/tableau-de-bord/page.tsx"),
  "utf8",
);
const INTERVENTIONS = readFileSync(
  join(process.cwd(), "app/(back-office)/interventions/page.tsx"),
  "utf8",
);

/**
 * Le contenu du bloc `data-bloc="nom"`, par COMPTAGE DE BALISES `<div>`
 * ÉQUILIBRÉES — jamais par le premier `</div>` venu, qui s'arrêterait net
 * dans un bloc qui, lui, EN CONTIENT (`kpi-grille`).
 */
function contenuDuBloc(source: string, nom: string): string {
  const marqueur = `data-bloc="${nom}"`;
  const indexMarqueur = source.indexOf(marqueur);
  if (indexMarqueur === -1) {
    throw new Error(`le bloc ${nom} est introuvable`);
  }
  const debutDiv = source.lastIndexOf("<div", indexMarqueur);
  const finOuverture = source.indexOf(">", indexMarqueur) + 1;
  const motif = /<div[\s>]|<\/div>/g;
  motif.lastIndex = finOuverture;
  let profondeur = 1;
  let position = finOuverture;
  let trouve: RegExpExecArray | null;
  while (profondeur > 0 && (trouve = motif.exec(source)) !== null) {
    profondeur += trouve[0].startsWith("<div") ? 1 : -1;
    position = motif.lastIndex;
  }
  if (profondeur !== 0) {
    throw new Error(`le bloc ${nom} n'est jamais refermé`);
  }
  return source.slice(debutDiv, position);
}

/** Les noms de bloc `kpi-…`, DÉDUITS du document — `kpi-grille` exclue par son nom. */
function nomsDesBlocsKpi(source: string): readonly string[] {
  const noms = [...source.matchAll(/data-bloc="(kpi-[a-z-]+)"/g)].map(
    (m) => m[1],
  );
  return [...new Set(noms)].filter((nom) => nom !== "kpi-grille");
}

/** La `<Kpi .../>` d'un bloc — sa balise seule, jamais le reste du bloc. */
function baliseKpi(contenu: string): string {
  const trouve = /<Kpi\b[\s\S]*?\/>/.exec(contenu);
  if (trouve === null) {
    throw new Error("aucune balise <Kpi ... /> dans ce bloc");
  }
  return trouve[0];
}

/** La tuile est CLIQUABLE quand sa `Kpi` porte un `href` (D140). */
function estCliquable(contenu: string): boolean {
  return /\bhref\s*[:=]/.test(baliseKpi(contenu));
}

/** Un `<Link` ailleurs que dans la balise `<Kpi .../>` elle-même — le doublon retiré par D144. */
function portELienDoublon(contenu: string): boolean {
  const sansKpi = contenu.replace(/<Kpi\b[\s\S]*?\/>/, "");
  return /<Link\b/.test(sansKpi);
}

function blocsCliquables(
  source: string,
): readonly { readonly nom: string; readonly contenu: string }[] {
  return nomsDesBlocsKpi(source)
    .map((nom) => ({ nom, contenu: contenuDuBloc(source, nom) }))
    .filter(({ contenu }) => estCliquable(contenu));
}

describe("aucune tuile cliquable ne porte de lien doublon sous elle (décision du 30/09/2026, point 12 ; D144)", () => {
  it("le témoin de non-vacuité — CINQ tuiles cliquables au tableau de bord, aucune aux interventions (TP-UX3-1-REGISTRE-1 retire les deux du registre ; 9EG-TP-UX6-TABLEAU-DE-BORD-1 reconstruit le tableau de bord selon le rôle, D185)", () => {
    const population = [
      ...blocsCliquables(TABLEAU_DE_BORD),
      ...blocsCliquables(INTERVENTIONS),
    ];
    expect(population.map((bloc) => bloc.nom).sort()).toEqual(
      [
        "kpi-a-controler",
        "kpi-a-planifier",
        "kpi-aujourdhui",
        "kpi-en-retard",
        "kpi-suspendues",
      ].sort(),
    );
  });

  it.each([
    ["tableau de bord", TABLEAU_DE_BORD],
    ["interventions", INTERVENTIONS],
  ] as const)(
    "%s — chaque tuile cliquable n'a AUCUN lien doublon",
    (_nom, source) => {
      for (const { nom, contenu } of blocsCliquables(source)) {
        expect(portELienDoublon(contenu), `bloc ${nom}`).toBe(false);
      }
    },
  );

  it("ÉPREUVE — un extrait FABRIQUÉ avec un doublon est bien détecté", () => {
    const fabrique = [
      '<div data-bloc="kpi-exemple" className="flex flex-col gap-1.5">',
      '  <Kpi libelle="x" valeur={1} href="/x" />',
      '  <Link href="/x" className="y">Voir →</Link>',
      "</div>",
    ].join("\n");
    expect(portELienDoublon(contenuDuBloc(fabrique, "kpi-exemple"))).toBe(true);
  });

  it("ÉPREUVE — le même extrait SANS le second lien ne l'est plus", () => {
    const fabrique = [
      '<div data-bloc="kpi-exemple" className="flex flex-col gap-1.5">',
      '  <Kpi libelle="x" valeur={1} href="/x" />',
      "</div>",
    ].join("\n");
    expect(portELienDoublon(contenuDuBloc(fabrique, "kpi-exemple"))).toBe(
      false,
    );
  });

  it("les quatre clés de lien retirées n'apparaissent plus dans aucun des deux écrans", () => {
    const CLES_RETIREES = [
      "tableau_de_bord.lien_dossiers_bloques",
      "tableau_de_bord.lien_en_retard",
      "interventions.lien_kpi_en_cours",
      "interventions.lien_kpi_en_attente",
    ];
    for (const cle of CLES_RETIREES) {
      expect(TABLEAU_DE_BORD).not.toContain(cle);
      expect(INTERVENTIONS).not.toContain(cle);
    }
  });
});
