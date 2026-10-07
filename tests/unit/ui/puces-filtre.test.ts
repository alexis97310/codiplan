import { createElement } from "react";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PuceMenu, PuceVue, ResumeListe } from "@/components/ui/puces-filtre";

/**
 * `PuceVue`, `PuceMenu`, `ResumeListe` (9EB-TP-UX3-2-LISTES-1) — les pièces
 * partagées des listes clients et sites (QE-10 (a), QE-13c).
 */

describe("PuceVue — à zéro, un état neutre, jamais une porte (maquette, puceFiltre())", () => {
  it("compteur à zéro et inactive : un <span> désactivé, pas un lien", () => {
    const { container } = render(
      createElement(PuceVue, {
        libelle: "Trajet inconnu",
        compteur: 0,
        actif: false,
        href: "/sites?vue=trajet_inconnu",
      }),
    );
    expect(container.querySelector("a")).toBeNull();
    const puce = container.querySelector("span[aria-disabled]");
    expect(puce).not.toBeNull();
    expect(puce?.textContent).toContain("Trajet inconnu");
    expect(puce?.textContent).toContain("0");
  });

  it("LE CAS QUI DOIT ROUGIR SANS LE CORRECTIF : à zéro MAIS active, elle reste une porte (rester sur une vue vide reste légitime)", () => {
    const { container } = render(
      createElement(PuceVue, {
        libelle: "Trajet inconnu",
        compteur: 0,
        actif: true,
        href: "/sites?vue=trajet_inconnu",
      }),
    );
    const lien = container.querySelector("a");
    expect(lien).not.toBeNull();
    expect(lien?.getAttribute("aria-current")).toBe("true");
  });

  it("compteur positif et inactive : un lien, sans aria-current", () => {
    const { container } = render(
      createElement(PuceVue, {
        libelle: "Inactifs",
        compteur: 4,
        actif: false,
        href: "/clients?etat=inactifs",
      }),
    );
    const lien = container.querySelector("a");
    expect(lien).not.toBeNull();
    expect(lien?.getAttribute("href")).toBe("/clients?etat=inactifs");
    expect(lien?.hasAttribute("aria-current")).toBe(false);
    expect(lien?.textContent).toContain("4");
  });
});

describe("PuceMenu — rien sans valeur, une puce retirable avec elle", () => {
  it("`valeur` absente (`null`) : rien ne se rend — le <select> porte seul l'état", () => {
    const { container } = render(
      createElement(PuceMenu, {
        libelle: "Zone",
        valeur: null,
        href: "/sites",
      }),
    );
    expect(container.firstChild).toBeNull();
  });

  it("`valeur` présente : « Libellé : valeur » suivi d'un lien retirable", () => {
    const { container } = render(
      createElement(PuceMenu, {
        libelle: "Zone",
        valeur: "Grand Nouméa",
        href: "/sites",
      }),
    );
    expect(container.textContent).toContain("Zone");
    expect(container.textContent).toContain("Grand Nouméa");
    const lien = container.querySelector("a");
    expect(lien?.getAttribute("href")).toBe("/sites");
  });
});

describe("ResumeListe", () => {
  it("rend le texte déjà composé, puis le complément s'il existe", () => {
    const { container } = render(
      createElement(ResumeListe, {
        texte: "14 clients",
        complement: " pour « x »",
      }),
    );
    expect(container.textContent).toBe("14 clients pour « x »");
  });

  it("sans complément, rien ne s'ajoute", () => {
    const { container } = render(
      createElement(ResumeListe, { texte: "18 sites" }),
    );
    expect(container.textContent).toBe("18 sites");
  });
});
