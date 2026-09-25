import { describe, expect, it } from "vitest";

import {
  retourFiche,
  retourVersRegistre,
} from "../../../app/(back-office)/interventions/presentation";

import { t } from "@/lib/i18n/fr";

/**
 * LE REGISTRE TEL QU'ON L'AVAIT LAISSÉ, AU RETOUR D'UNE FICHE (78-LIENS-2).
 *
 * ## Le défaut, mesuré sur main 876db2e le 25/09/2026
 *
 * Chaque ligne du registre menait à `/interventions/<id>?depuis=interventions`
 * — la vue, la recherche, les filtres et la page étaient PERDUS au retour :
 * `retourFiche`, `case "interventions"`, rendait `/interventions` nu.
 *
 * ## Ce que ce fichier tient
 *
 * `retourVersRegistre` rejoue le paramètre `retour` — une liste FERMÉE de
 * clés, jamais une URL libre reçue en clair (D50, comme `depuis`) : un
 * paramètre hors liste est retiré, une valeur qui porte un schéma d'URL fait
 * échouer le tout vers `/interventions` nu plutôt qu'ouvrir une redirection.
 */

const LIGNE_SANS_MACHINE = {
  client_id: "client-1",
  site_id: "site-1",
  date_planifiee: null,
  machines: [],
};

describe("retourVersRegistre — rejoue la requête, jamais une URL libre", () => {
  it("retour absent → /interventions nu", () => {
    expect(retourVersRegistre(undefined)).toBe("/interventions");
  });

  it("retour vide → /interventions nu", () => {
    expect(retourVersRegistre("")).toBe("/interventions");
  });

  it("conserve vue, technicien et page tels quels", () => {
    const uuid = "018f1a2b-3c4d-7e5f-8a9b-0123456789ab";
    expect(
      retourVersRegistre(`vue=a_planifier&technicien=${uuid}&page=3`),
    ).toBe(`/interventions?vue=a_planifier&technicien=${uuid}&page=3`);
  });

  it("retire un paramètre inconnu et motif, garde le reste", () => {
    expect(retourVersRegistre("q=LIE2-&motif=une_cle&inconnu=x&page=2")).toBe(
      "/interventions?q=LIE2-&page=2",
    );
  });

  it("recompose toujours dans l'ordre fermé, quel que soit l'ordre reçu", () => {
    expect(retourVersRegistre("page=2&q=LIE2-")).toBe(
      "/interventions?q=LIE2-&page=2",
    );
  });

  it.each(["https://x.y", "//x", "javascript:alert(1)"])(
    "valeur %s ignorée en bloc — pas de redirection ouverte",
    (valeur) => {
      expect(retourVersRegistre(valeur)).toBe("/interventions");
    },
  );

  it("un tableau reçu (paramètre répété) prend le premier élément", () => {
    expect(retourVersRegistre(["page=2", "page=9"])).toBe(
      "/interventions?page=2",
    );
  });

  it("une valeur démesurée est écartée, le reste de la requête survit", () => {
    const demesuree = "q".repeat(500);
    expect(retourVersRegistre(`q=${demesuree}&page=2`)).toBe(
      "/interventions?page=2",
    );
  });
});

describe("retourFiche — case interventions, avec et sans retour", () => {
  it("sans retour, se comporte comme avant : /interventions nu", () => {
    const retour = retourFiche(
      { depuis: "interventions", depuisId: undefined, retour: undefined },
      LIGNE_SANS_MACHINE,
    );
    expect(retour).toEqual({
      href: "/interventions",
      libelle: t("intervention.retour.interventions"),
    });
  });

  it("avec retour, la destination porte la requête re-filtrée", () => {
    const retour = retourFiche(
      {
        depuis: "interventions",
        depuisId: undefined,
        retour: "vue=a_planifier&page=3&motif=x",
      },
      LIGNE_SANS_MACHINE,
    );
    expect(retour).toEqual({
      href: "/interventions?vue=a_planifier&page=3",
      libelle: t("intervention.retour.interventions"),
    });
  });
});
