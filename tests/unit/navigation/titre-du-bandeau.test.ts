import { describe, expect, it } from "vitest";

import { titreDuBandeau } from "@/components/navigation/titre-du-bandeau";

function h1De(html: string): HTMLElement {
  const conteneur = document.createElement("div");
  conteneur.innerHTML = html;
  const h1 = conteneur.querySelector("h1");
  if (h1 === null) {
    throw new Error("h1 absent du gabarit de test");
  }
  return h1;
}

describe("titreDuBandeau", () => {
  it("lit le texte d'un h1 sans pastille", () => {
    expect(titreDuBandeau(h1De("<h1>Interventions</h1>"))).toBe(
      "Interventions",
    );
  });

  it("retire la pastille marquée data-hors-bandeau", () => {
    const h1 = h1De(
      '<h1><span>Intervention I-000123</span><span data-hors-bandeau="">Terminée</span></h1>',
    );
    expect(titreDuBandeau(h1)).toBe("Intervention I-000123");
  });

  it("retire une pastille imbriquée, même sous plusieurs niveaux", () => {
    const h1 = h1De(
      '<h1><span>Intervention I-000123</span><span data-hors-bandeau=""><span>Terminée</span></span></h1>',
    );
    expect(titreDuBandeau(h1)).toBe("Intervention I-000123");
  });

  it("normalise les espaces après le retrait de la pastille", () => {
    const h1 = h1De(
      '<h1>  Intervention I-000123  <span data-hors-bandeau="">Terminée</span>  </h1>',
    );
    expect(titreDuBandeau(h1)).toBe("Intervention I-000123");
  });
});
