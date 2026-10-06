import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OngletsRegistre } from "@/components/interventions/onglets-registre";
import { fr } from "@/lib/i18n/fr";
import type { ComptesRegistre } from "@/lib/interventions/depot";

/**
 * `OngletsRegistre` (TP-UX3-1-REGISTRE-1, QE-8 ; §3.4 et §5.3 de la
 * spécification du 28/09/2026) — la rangée de huit onglets à compteur, plus
 * « Toutes », partagée par `/interventions` et `/interventions/a-facturer`.
 */

const COMPTES_VIDES: ComptesRegistre = {
  toutes: 0,
  a_planifier: 0,
  aujourdhui: 0,
  en_cours: 0,
  bloquees: 0,
  a_controler: 0,
  historique: 0,
  a_venir: 0,
  en_retard: 0,
  a_planifier_p1: false,
};

function hrefOnglet(vue: string | null): string {
  return vue === null
    ? "/interventions?vue=toutes"
    : `/interventions?vue=${vue}`;
}

/** Le libellé SEUL d'un lien d'onglet — exclut le compteur (`[data-compte]`). */
function libelleDuLien(lien: HTMLElement): string {
  const compteur = lien.querySelector("[data-compte]");
  const sansCompte = lien.cloneNode(true) as HTMLElement;
  if (compteur !== null) {
    sansCompte.querySelector("[data-compte]")?.remove();
  }
  return sansCompte.textContent?.trim() ?? "";
}

describe("OngletsRegistre", () => {
  it("l'ordre exact — À planifier, Aujourd'hui, En retard, En cours, Suspendues, À contrôler, Toutes (sans « À facturer »)", () => {
    render(
      <OngletsRegistre
        vueActive="toutes"
        comptes={COMPTES_VIDES}
        peutFacturer={false}
        hrefOnglet={hrefOnglet}
        hrefAFacturer="/interventions/a-facturer"
      />,
    );
    const liens = screen.getAllByRole("link").map(libelleDuLien);
    expect(liens).toEqual([
      fr["interventions.vue.a_planifier"],
      fr["interventions.vue.aujourdhui"],
      fr["interventions.vue.en_retard"],
      fr["interventions.vue.en_cours"],
      fr["interventions.vue.bloquees"],
      fr["interventions.vue.a_controler"],
      fr["interventions.vue.toutes"],
    ]);
  });

  it("« À facturer » s'intercale entre « À contrôler » et « Toutes » quand `peutFacturer`", () => {
    render(
      <OngletsRegistre
        vueActive="toutes"
        comptes={COMPTES_VIDES}
        peutFacturer
        hrefOnglet={hrefOnglet}
        hrefAFacturer="/interventions/a-facturer"
      />,
    );
    const liens = screen.getAllByRole("link").map(libelleDuLien);
    expect(liens).toEqual([
      fr["interventions.vue.a_planifier"],
      fr["interventions.vue.aujourdhui"],
      fr["interventions.vue.en_retard"],
      fr["interventions.vue.en_cours"],
      fr["interventions.vue.bloquees"],
      fr["interventions.vue.a_controler"],
      fr["interventions.vue.a_facturer"],
      fr["interventions.vue.toutes"],
    ]);
    expect(
      screen.getByRole("link", { name: fr["interventions.vue.a_facturer"] }),
    ).toHaveAttribute("href", "/interventions/a-facturer");
  });

  it("« Toutes » ne porte AUCUN compteur, même quand `toutes` > 0", () => {
    render(
      <OngletsRegistre
        vueActive="toutes"
        comptes={{ ...COMPTES_VIDES, toutes: 12 }}
        peutFacturer={false}
        hrefOnglet={hrefOnglet}
        hrefAFacturer="/interventions/a-facturer"
      />,
    );
    const toutes = screen.getByRole("link", {
      name: fr["interventions.vue.toutes"],
    });
    expect(toutes.querySelector("[data-compte]")).toBeNull();
  });

  it("chaque onglet principal porte son propre compteur exact", () => {
    render(
      <OngletsRegistre
        vueActive="a_planifier"
        comptes={{ ...COMPTES_VIDES, a_planifier: 3, en_cours: 5 }}
        peutFacturer={false}
        hrefOnglet={hrefOnglet}
        hrefAFacturer="/interventions/a-facturer"
      />,
    );
    const aPlanifier = screen.getByRole("link", {
      name: new RegExp(fr["interventions.vue.a_planifier"]),
    });
    expect(aPlanifier.querySelector("[data-compte]")).toHaveAttribute(
      "data-compte",
      "3",
    );
    const enCours = screen.getByRole("link", {
      name: new RegExp(fr["interventions.vue.en_cours"]),
    });
    expect(enCours.querySelector("[data-compte]")).toHaveAttribute(
      "data-compte",
      "5",
    );
  });

  it("l'onglet actif porte aria-current=page, les autres non", () => {
    render(
      <OngletsRegistre
        vueActive="en_cours"
        comptes={COMPTES_VIDES}
        peutFacturer={false}
        hrefOnglet={hrefOnglet}
        hrefAFacturer="/interventions/a-facturer"
      />,
    );
    expect(
      screen.getByRole("link", {
        name: new RegExp(fr["interventions.vue.en_cours"]),
      }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", {
        name: new RegExp(fr["interventions.vue.a_planifier"]),
      }),
    ).not.toHaveAttribute("aria-current");
  });

  it("« À planifier » s'allume quand une P1 attend ; « En retard » dès que son compte > 0 ; « À contrôler » JAMAIS (IN-20)", () => {
    const { container } = render(
      <OngletsRegistre
        vueActive="toutes"
        comptes={{
          ...COMPTES_VIDES,
          a_planifier_p1: true,
          en_retard: 2,
          a_controler: 4,
        }}
        peutFacturer={false}
        hrefOnglet={hrefOnglet}
        hrefAFacturer="/interventions/a-facturer"
      />,
    );
    const alerteDe = (libelle: string) =>
      screen
        .getByRole("link", { name: new RegExp(libelle) })
        .querySelector("[data-compte]")?.className;
    expect(alerteDe(fr["interventions.vue.a_planifier"])).toContain(
      "bg-app-rouge-fond",
    );
    expect(alerteDe(fr["interventions.vue.en_retard"])).toContain(
      "bg-app-rouge-fond",
    );
    expect(alerteDe(fr["interventions.vue.a_controler"])).not.toContain(
      "bg-app-rouge-fond",
    );
    expect(container.querySelectorAll("[data-compte]").length).toBeGreaterThan(
      0,
    );
  });

  it("« À planifier » reste GRIS sans P1 en attente, même avec des lignes", () => {
    render(
      <OngletsRegistre
        vueActive="toutes"
        comptes={{ ...COMPTES_VIDES, a_planifier: 9, a_planifier_p1: false }}
        peutFacturer={false}
        hrefOnglet={hrefOnglet}
        hrefAFacturer="/interventions/a-facturer"
      />,
    );
    const compteur = screen
      .getByRole("link", {
        name: new RegExp(fr["interventions.vue.a_planifier"]),
      })
      .querySelector("[data-compte]");
    expect(compteur?.className).not.toContain("bg-app-rouge-fond");
  });
});
