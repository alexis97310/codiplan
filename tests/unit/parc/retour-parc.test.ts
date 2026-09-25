import { describe, expect, it } from "vitest";

import {
  retourActuelDuParc,
  retourVersParc,
} from "../../../app/(back-office)/parc/presentation";

/**
 * LE PARC TEL QU'ON L'AVAIT LAISSÉ, AU RETOUR D'UNE FICHE (79-LIENS-3).
 *
 * ## Le défaut, mesuré sur main le 25/09/2026
 *
 * « Fiche complète » (`app/(back-office)/parc/page.tsx`) menait à
 * `/parc/<id>` nu, et le lien « Retour » de la fiche (`[id]/page.tsx`) vers
 * `/parc` nu : les filtres, la recherche et la page étaient PERDUS.
 *
 * ## Ce que ce fichier tient
 *
 * `retourVersParc` rejoue le paramètre `retour` — une liste FERMÉE de clés,
 * jamais une URL libre reçue en clair (D50, comme `depuis` sur la fiche
 * d'intervention) : un paramètre hors liste est retiré, une valeur qui porte
 * un schéma d'URL fait échouer le tout vers `/parc` nu plutôt qu'ouvrir une
 * redirection.
 */

describe("retourActuelDuParc — compose la requête active sur la liste fermée", () => {
  it("aucun paramètre actif → chaîne vide", () => {
    expect(retourActuelDuParc({})).toBe("");
  });

  it("conserve q, statut, client, site, famille et page", () => {
    expect(
      retourActuelDuParc({
        q: "LIE3-",
        statut: "en_panne",
        client: "client-1",
        site: "site-1",
        famille: "famille-1",
        page: "3",
      }),
    ).toBe(
      "q=LIE3-&statut=en_panne&client=client-1&site=site-1&famille=famille-1&page=3",
    );
  });

  it("ignore machine — l'état de sélection n'est pas un filtre", () => {
    expect(retourActuelDuParc({ q: "LIE3-", machine: "machine-1" })).toBe(
      "q=LIE3-",
    );
  });

  it("un tableau (paramètre répété) prend le premier élément", () => {
    expect(retourActuelDuParc({ page: ["2", "9"] })).toBe("page=2");
  });
});

describe("retourVersParc — rejoue la requête, jamais une URL libre", () => {
  it("retour absent → /parc nu", () => {
    expect(retourVersParc(undefined)).toBe("/parc");
  });

  it("retour vide → /parc nu", () => {
    expect(retourVersParc("")).toBe("/parc");
  });

  it("conserve client et page tels quels", () => {
    expect(retourVersParc("client=client-1&page=3")).toBe(
      "/parc?client=client-1&page=3",
    );
  });

  it("retire machine et un paramètre inconnu, garde le reste", () => {
    expect(retourVersParc("q=LIE3-&machine=machine-1&inconnu=x&page=2")).toBe(
      "/parc?q=LIE3-&page=2",
    );
  });

  it("recompose toujours dans l'ordre fermé, quel que soit l'ordre reçu", () => {
    expect(retourVersParc("page=2&q=LIE3-")).toBe("/parc?q=LIE3-&page=2");
  });

  it.each(["https://x.y", "//x", "javascript:alert(1)"])(
    "valeur %s ignorée en bloc — pas de redirection ouverte",
    (valeur) => {
      expect(retourVersParc(valeur)).toBe("/parc");
    },
  );

  it("un tableau reçu (paramètre répété) prend le premier élément", () => {
    expect(retourVersParc(["page=2", "page=9"])).toBe("/parc?page=2");
  });

  it("une valeur démesurée est écartée, le reste de la requête survit", () => {
    const demesuree = "q".repeat(500);
    expect(retourVersParc(`q=${demesuree}&page=2`)).toBe("/parc?page=2");
  });
});
