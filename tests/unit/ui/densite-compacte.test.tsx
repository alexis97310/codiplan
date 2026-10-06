import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { Cellule, Tableau } from "@/components/ui/tableau";
import { fr } from "@/lib/i18n/fr";

// `Tableau` défile par `CadreDefilant` (`components/ui/cadre-defilant.tsx`),
// qui observe son conteneur par `ResizeObserver` — absent de jsdom. Un
// bouchon minimal, comme aucune autre épreuve de rendu de ce dépôt n'a
// encore eu besoin de rendre `<Tableau>` en entier.
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

/**
 * LA DENSITÉ « COMPACT » DE `Tableau`/`Cellule` (TP-UX3-1-REGISTRE-1, §5.3
 * de la spécification du 28/09/2026) — moins de rembourrage VERTICAL,
 * jamais la police : QE-1 (D138) interdit tout texte sous 12 px, et ce
 * ticket ne descend pas sous ce plancher pour gagner de la densité.
 *
 * `compact` est FACULTATIF partout : sans lui, le rendu est EXACTEMENT
 * celui d'avant ce ticket (`py-[9px]` en-tête, `py-[11px]` cellule).
 */
describe("Tableau — la densité « compact »", () => {
  const COLONNES = [{ cle: "x", libelle: fr["trajets.non_reglee"] }];

  it("sans `compact`, l'en-tête garde son rembourrage d'avant ce ticket", () => {
    const { container } = render(
      <Tableau colonnes={COLONNES}>
        <tr />
      </Tableau>,
    );
    expect(container.querySelector("th")?.className).toContain("py-[9px]");
  });

  it("avec `compact`, l'en-tête réduit son rembourrage, la taille de police ne change pas", () => {
    const { container } = render(
      <Tableau colonnes={COLONNES} compact>
        <tr />
      </Tableau>,
    );
    const th = container.querySelector("th");
    expect(th?.className).toContain("py-1");
    expect(th?.className).not.toContain("py-[9px]");
    expect(th?.className).toContain("text-12");
  });
});

describe("Cellule — la densité « compact »", () => {
  function rendreCellule(compact?: boolean) {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <Cellule compact={compact}>{fr["trajets.non_reglee"]}</Cellule>
          </tr>
        </tbody>
      </table>,
    );
    return container.querySelector("td");
  }

  it("sans `compact`, la cellule garde son rembourrage d'avant ce ticket", () => {
    expect(rendreCellule()?.className).toContain("py-[11px]");
  });

  it("avec `compact`, la cellule réduit son rembourrage", () => {
    const td = rendreCellule(true);
    expect(td?.className).toContain("py-1.5");
    expect(td?.className).not.toContain("py-[11px]");
  });
});
