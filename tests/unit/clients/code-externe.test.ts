import { describe, expect, it } from "vitest";

import { libelleCodeExterne } from "@/lib/clients";
import { fr } from "@/lib/i18n";
import { SOCIETES } from "@/prisma/seed-data";

/**
 * Le libellé du code externe, paramétrable par société (D29, ticket L1-01).
 *
 * **Ce que D29 répare :** `client.code_winpro` nommait une colonne d'après
 * l'ERP d'un seul client, dans un produit destiné à la vente. La colonne est
 * devenue neutre, et le MOT que l'utilisateur lit est redevenu une donnée.
 */
describe("libellé du code externe (D29)", () => {
  it("affiche le libellé de la société quand elle en a un", () => {
    expect(libelleCodeExterne("Code Winpro")).toBe("Code Winpro");
  });

  it("retombe sur le libellé générique du dictionnaire quand elle n'en a pas", () => {
    // « Société qui n'a pas nommé son ERP » est un état légitime, comme la
    // société sans charte de L0-09. Elle ne reçoit pas un « Code Winpro »
    // deviné : elle reçoit le mot du produit.
    for (const absent of [null, undefined, "", "   "]) {
      expect(libelleCodeExterne(absent)).toBe(fr["client.code_externe"]);
    }
  });

  it("le libellé générique ne nomme AUCUN ERP", () => {
    // C'est la moitié de D29 qu'un libellé mal choisi défferait en silence :
    // « Code Winpro » dans le dictionnaire réintroduirait dans le produit le
    // vocabulaire d'un seul client, sans qu'aucune colonne ne change de nom.
    expect(fr["client.code_externe"].toLowerCase()).not.toContain("winpro");
  });

  it("le jeu de démonstration porte les DEUX cas", () => {
    // Témoin de non-vacuité : si toutes les sociétés du seed nommaient leur ERP,
    // la branche « libellé générique » ne serait empruntée nulle part et ce
    // module ne serait jamais exercé sur une base réelle.
    const avec = SOCIETES.filter(
      (societe) => (societe.libelle_code_externe ?? "").trim().length > 0,
    );
    const sans = SOCIETES.filter(
      (societe) => (societe.libelle_code_externe ?? "").trim().length === 0,
    );
    expect(avec.length).toBeGreaterThan(0);
    expect(sans.length).toBeGreaterThan(0);
  });
});
