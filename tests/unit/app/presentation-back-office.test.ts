import { describe, expect, it } from "vitest";

import type { ContactPourDestinataire } from "@/lib/avertissements/planification";
import { t } from "@/lib/i18n/fr";

import {
  decompte,
  hrefDeLaPage,
  libelleDestinataireCourriels,
  libellePage,
  ouTiret,
} from "../../../app/(back-office)/presentation";

/**
 * CE QUE LES QUATRE LISTES DU BACK-OFFICE PARTAGENT POUR LEUR PAGINATION
 * (AT-07) — `decompte`, `libellePage`, `hrefDeLaPage`, à côté de `ouTiret`
 * qu'elles partageaient déjà.
 */

describe("ouTiret", () => {
  it("écrit un tiret pour une absence, jamais un zéro", () => {
    expect(ouTiret(null)).toBe("—");
    expect(ouTiret(0)).toBe("0");
    expect(ouTiret("x")).toBe("x");
  });
});

describe("decompte — un nombre et son unité accordée", () => {
  it("accorde le singulier et le pluriel", () => {
    expect(decompte(1, "client", "clients")).toBe("1 client");
    expect(decompte(4, "client", "clients")).toBe("4 clients");
  });

  it("LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON : zéro prend le pluriel", () => {
    // *Zéro n'est pas « un »* : sans ce cas, un accord câblé sur `nombre <= 1`
    // passerait l'épreuve du singulier ci-dessus sans être juste sur le zéro.
    expect(decompte(0, "client", "clients")).toBe("0 clients");
  });
});

describe("libellePage — « Page X sur Y », composé hors du JSX", () => {
  it("compose la page courante et le total, séparés par « sur »", () => {
    expect(libellePage(2, 5)).toBe(
      `${t("pagination.page")} 2 ${t("pagination.sur")} 5`,
    );
  });
});

describe("hrefDeLaPage — l'état de la pagination vit dans l'URL", () => {
  it("pose le numéro de page demandé", () => {
    expect(hrefDeLaPage("/clients", {}, 3)).toBe("/clients?page=3");
  });

  it("préserve les filtres actifs, et EUX SEULS", () => {
    const href = hrefDeLaPage("/clients", { q: "koné", actifs: "1" }, 2);
    expect(href).toContain("q=k");
    expect(href).toContain("actifs=1");
    expect(href).toContain("page=2");
  });

  it("omet un filtre absent ou vide, plutôt que d'écrire `undefined` dans l'URL", () => {
    const href = hrefDeLaPage("/clients", { q: undefined, actifs: "" }, 1);
    expect(href).not.toContain("undefined");
    expect(href).not.toContain("actifs=");
    expect(href).toBe("/clients?page=1");
  });
});

/**
 * `libelleDestinataireCourriels` (CS45, QT-16, D165) — partagée par la fiche
 * client et la fiche site, qui ne calculent plus que LE CONTACT avec
 * `destinataireClient` avant de lui demander son texte.
 */
describe("libelleDestinataireCourriels", () => {
  const destinataire: ContactPourDestinataire = {
    id: "c1",
    nom: "Jeanne Dupont",
    email: "jeanne.dupont@example.test",
    actif: true,
    roles: ["donneur_ordre"],
    site_id: null,
  };

  it("nomme le contact et son courriel quand un destinataire a été trouvé", () => {
    expect(libelleDestinataireCourriels(destinataire)).toBe(
      `${t("clients.fiche.destinataire_courriels_prefixe")} Jeanne Dupont (jeanne.dupont@example.test)`,
    );
  });

  it("dit l'absence quand aucun destinataire n'a été trouvé (`null`)", () => {
    expect(libelleDestinataireCourriels(null)).toBe(
      t("clients.fiche.destinataire_courriels_aucun"),
    );
  });

  it("dit l'absence même pour un contact sans courriel — ce que `destinataireClient` ne devrait jamais rendre, mais que ce texte ne distingue pas non plus", () => {
    expect(libelleDestinataireCourriels({ ...destinataire, email: null })).toBe(
      t("clients.fiche.destinataire_courriels_aucun"),
    );
  });
});
