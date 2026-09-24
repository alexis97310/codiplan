import { describe, expect, it } from "vitest";

import {
  destinataireClient,
  type ContactPourDestinataire,
} from "@/lib/avertissements/planification";

/**
 * `destinataireClient` (AVERTISSEMENTS-1) — LE CONTACT QUI REÇOIT LE COURRIEL
 * CLIENT, tel qu'Alexis l'a arbitré le 23/09/2026 : d'abord le donneur
 * d'ordre du SITE, à défaut celui du CLIENT (`site_id` nul), et `null` si
 * aucun n'a l'adresse qu'il faudrait.
 */

const SITE = "11111111-1111-1111-1111-111111111111";
const AUTRE_SITE = "22222222-2222-2222-2222-222222222222";

function contact(
  partiel: Partial<ContactPourDestinataire> & { id: string },
): ContactPourDestinataire {
  return {
    nom: "Contact",
    email: "contact@example.test",
    actif: true,
    roles: ["donneur_ordre"],
    site_id: null,
    ...partiel,
  };
}

describe("destinataireClient", () => {
  it("choisit le donneur d'ordre du SITE quand il y en a un", () => {
    const duSite = contact({ id: "a", nom: "Site", site_id: SITE });
    const duClient = contact({ id: "b", nom: "Client", site_id: null });
    expect(destinataireClient([duClient, duSite], SITE)).toBe(duSite);
  });

  it("retombe sur le donneur d'ordre du CLIENT (site_id nul) à défaut", () => {
    const duClient = contact({ id: "a", nom: "Client", site_id: null });
    const dUnAutreSite = contact({
      id: "b",
      nom: "Ailleurs",
      site_id: AUTRE_SITE,
    });
    expect(destinataireClient([dUnAutreSite, duClient], SITE)).toBe(duClient);
  });

  it("rend null quand aucun contact n'a le rôle donneur d'ordre", () => {
    const technique = contact({
      id: "a",
      site_id: SITE,
      roles: ["contact_technique"],
    });
    expect(destinataireClient([technique], SITE)).toBeNull();
  });

  it("rend null quand aucun contact n'a de courriel", () => {
    const sansEmail = contact({ id: "a", site_id: SITE, email: null });
    expect(destinataireClient([sansEmail], SITE)).toBeNull();
  });

  it("écarte le donneur d'ordre INACTIF", () => {
    const inactif = contact({ id: "a", site_id: SITE, actif: false });
    const duClient = contact({ id: "b", site_id: null });
    expect(destinataireClient([inactif, duClient], SITE)).toBe(duClient);
  });

  it("rend null quand la liste est vide", () => {
    expect(destinataireClient([], SITE)).toBeNull();
  });

  it("départage plusieurs éligibles au même niveau par le nom, puis l'id — de façon STABLE", () => {
    const zoe = contact({ id: "z-id", nom: "Zoé", site_id: SITE });
    const alice = contact({ id: "a-id", nom: "Alice", site_id: SITE });
    expect(destinataireClient([zoe, alice], SITE)).toBe(alice);
    // L'ordre de la liste d'entrée ne doit rien changer au résultat.
    expect(destinataireClient([alice, zoe], SITE)).toBe(alice);
  });

  it("départage par l'id quand deux éligibles portent le même nom", () => {
    const b = contact({ id: "b-id", nom: "Même nom", site_id: SITE });
    const a = contact({ id: "a-id", nom: "Même nom", site_id: SITE });
    expect(destinataireClient([b, a], SITE)).toBe(a);
  });

  it("un contact du site l'emporte sur un contact du client même mieux classé alphabétiquement", () => {
    const duClientAlice = contact({ id: "a", nom: "Alice", site_id: null });
    const duSiteZoe = contact({ id: "z", nom: "Zoé", site_id: SITE });
    expect(destinataireClient([duClientAlice, duSiteZoe], SITE)).toBe(
      duSiteZoe,
    );
  });
});
