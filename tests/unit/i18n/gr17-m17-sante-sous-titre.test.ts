import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n/fr";

/**
 * GR17-M17 (audit GR du 26/09/2026, constat M17) — LA PAGE SANTÉ NE COMPTE
 * PLUS CE QU'ELLE NE MONTRE PAS.
 *
 * `sante.sous_titre` annonçait « Quatre questions, quatre réponses » alors que
 * la page (`app/(sans-session)/sante/page.tsx`) en rend CINQ (base, rôle,
 * migrations, sociétés, comptes) : un décompte qui ne correspond plus à
 * l'écran est faux à chaque lecture, pas seulement le jour où il a été écrit.
 */
describe("GR17-M17 — page Santé : sans décompte", () => {
  it("sante.sous_titre ne compte plus les questions", () => {
    const texte = t("sante.sous_titre");
    expect(texte).not.toContain("Quatre");
    expect(texte.toLowerCase()).not.toContain("quatre");
  });
});
