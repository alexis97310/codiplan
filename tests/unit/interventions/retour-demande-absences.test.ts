import { describe, expect, it } from "vitest";

import { retourFiche } from "../../../app/(back-office)/interventions/presentation";

import { t } from "@/lib/i18n/fr";

/**
 * LE RETOUR DEPUIS UNE DEMANDE OU LES ABSENCES (99I-RETOUR-FICHE).
 *
 * ## Le défaut, mesuré sur main 10fc3d3 le 25/09/2026 (audit d'ergonomie,
 * constat 21, 2e moitié)
 *
 * `/demandes/{id}` et `/absences` ouvraient la fiche SANS `depuis` : le
 * retour y affichait « Retour au planning » même en arrivant de l'un ou
 * l'autre de ces deux écrans.
 *
 * ## Ce que ce fichier tient
 *
 * Comme `case "machine"`, `case "demande"` ne suit `depuisId` que s'il
 * désigne RÉELLEMENT la demande d'origine de cette intervention — sinon le
 * planning, inchangé. `case "absences"` ne porte aucun `depuisId` : une
 * seule destination, `/absences`.
 */

const LIGNE_DE_BASE = {
  client_id: "client-1",
  site_id: "site-1",
  date_planifiee: null,
  machines: [],
};

describe("retourFiche — case demande", () => {
  it("demande rattachée → /demandes/{id}", () => {
    const retour = retourFiche(
      { depuis: "demande", depuisId: "demande-1", retour: undefined },
      { ...LIGNE_DE_BASE, demande_id: "demande-1" },
    );
    expect(retour).toEqual({
      href: "/demandes/demande-1",
      libelle: t("intervention.retour.demande"),
    });
  });

  it("demande NON rattachée → planning, inchangé", () => {
    const retour = retourFiche(
      { depuis: "demande", depuisId: "demande-autre", retour: undefined },
      { ...LIGNE_DE_BASE, demande_id: "demande-1" },
    );
    expect(retour).toEqual({
      href: "/planning",
      libelle: t("planning.retour_fleche"),
    });
  });

  it("demande sans depuisId → planning, inchangé", () => {
    const retour = retourFiche(
      { depuis: "demande", depuisId: undefined, retour: undefined },
      { ...LIGNE_DE_BASE, demande_id: "demande-1" },
    );
    expect(retour).toEqual({
      href: "/planning",
      libelle: t("planning.retour_fleche"),
    });
  });
});

describe("retourFiche — case absences", () => {
  it("absences → /absences", () => {
    const retour = retourFiche(
      { depuis: "absences", depuisId: undefined, retour: undefined },
      { ...LIGNE_DE_BASE, demande_id: null },
    );
    const titre = t("absences.titre");
    const titreDecapitalise =
      titre.charAt(0).toLocaleLowerCase("fr") + titre.slice(1);
    expect(retour).toEqual({
      href: "/absences",
      libelle: `${t("intervention.retour.absences_prefixe")} ${titreDecapitalise}`,
    });
  });
});

describe("retourFiche — valeur inconnue, comportement inchangé", () => {
  it("depuis absent → planning", () => {
    const retour = retourFiche(
      { depuis: undefined, depuisId: undefined, retour: undefined },
      { ...LIGNE_DE_BASE, demande_id: null },
    );
    expect(retour).toEqual({
      href: "/planning",
      libelle: t("planning.retour_fleche"),
    });
  });

  it("depuis hors liste fermée → planning", () => {
    const retour = retourFiche(
      { depuis: "autre-chose", depuisId: undefined, retour: undefined },
      { ...LIGNE_DE_BASE, demande_id: null },
    );
    expect(retour).toEqual({
      href: "/planning",
      libelle: t("planning.retour_fleche"),
    });
  });
});
