import { describe, expect, it } from "vitest";

import { versLeRetour } from "@/app/api/contacts/saisie-recue";

/**
 * LE RETOUR APRÈS UN REFUS DE SAISIE D'INTERLOCUTEUR (9BR-TP-A4b-MESSAGES,
 * CS46) — `saisie` est FACULTATIF : `[id]/modifier` et `[id]/activite`
 * n'ont rien à reprendre. **Aucune coordonnée** (courriel, téléphone,
 * mobile) ne doit jamais apparaître dans l'URL (question ouverte à Alexis).
 */

const RETOUR = "/clients/11111111-1111-1111-1111-111111111111";

function urlDeRetour(reponse: Response): URL {
  const location = reponse.headers.get("Location");
  expect(location).not.toBeNull();
  return new URL(location as string, "http://localhost");
}

describe("versLeRetour", () => {
  it("sans `saisie`, ne porte que le motif — comportement inchangé pour modifier/activite", () => {
    const url = urlDeRetour(versLeRetour(RETOUR, "contacts.cree"));
    expect(url.pathname).toBe(RETOUR);
    expect(url.searchParams.get("motif")).toBe("contacts.cree");
    expect(url.searchParams.has("contact_nom")).toBe(false);
  });

  it("porte site_id, nom, fonction et roles — jamais courriel, téléphone ni mobile", () => {
    const url = urlDeRetour(
      versLeRetour(RETOUR, "contacts.refus.saisie", {
        site_id: "22222222-2222-2222-2222-222222222222",
        nom: "TPA4-Contact",
        fonction: "Responsable",
        roles: ["donneur_ordre", "technique"],
      }),
    );
    expect(url.searchParams.get("contact_site_id")).toBe(
      "22222222-2222-2222-2222-222222222222",
    );
    expect(url.searchParams.get("contact_nom")).toBe("TPA4-Contact");
    expect(url.searchParams.get("contact_fonction")).toBe("Responsable");
    expect(url.searchParams.getAll("contact_role")).toEqual([
      "donneur_ordre",
      "technique",
    ]);
    expect(url.toString()).not.toContain("courriel");
    expect(url.searchParams.has("contact_telephone")).toBe(false);
    expect(url.searchParams.has("contact_mobile")).toBe(false);
    expect(url.searchParams.has("contact_email")).toBe(false);
  });

  it("un site_id vide (« contact du client ») est distingué d'une absence", () => {
    const url = urlDeRetour(
      versLeRetour(RETOUR, "contacts.refus.saisie", { site_id: "" }),
    );
    expect(url.searchParams.has("contact_site_id")).toBe(true);
    expect(url.searchParams.get("contact_site_id")).toBe("");
  });
});
