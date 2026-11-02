import { describe, expect, it } from "vitest";

import { Role, ROLES } from "@/lib/auth/roles";
import { ROLES_FEUILLE_DE_ROUTE } from "@/lib/feuille-de-route/acces";
import { entreeVisible } from "@/lib/navigation/entrees";

/**
 * « FEUILLE DE ROUTE » N'EST VISIBLE QU'À admin_societe ET admin_plateforme
 * (9IC5-FEUILLE-DE-ROUTE, demande d'Alexis du 02/11/2026).
 *
 * `entreeVisible` relit `CAPACITE_REQUISE` (`lib/navigation/entrees.ts`),
 * jamais une seconde liste de rôles : si cette entrée changeait de forme
 * (capacité au lieu de rôles), c'est ELLE qui ferait rougir ce fichier.
 */
describe("l'entrée de menu « Feuille de route »", () => {
  it("témoin — dix rôles, et les deux attendus en font partie", () => {
    expect(ROLES.length).toBe(10);
    expect(ROLES_FEUILLE_DE_ROUTE).toEqual([
      Role.admin_societe,
      Role.admin_plateforme,
    ]);
  });

  it.each(ROLES_FEUILLE_DE_ROUTE.map((role) => [role] as const))(
    "%s la voit",
    (role) => {
      expect(entreeVisible("nav.feuille_de_route", role)).toBe(true);
    },
  );

  it.each(
    ROLES.filter((role) => !ROLES_FEUILLE_DE_ROUTE.includes(role)).map(
      (role) => [role] as const,
    ),
  )("%s ne la voit jamais", (role) => {
    expect(entreeVisible("nav.feuille_de_route", role)).toBe(false);
  });

  it("un rôle absent (role === null) ne la voit pas non plus", () => {
    expect(entreeVisible("nav.feuille_de_route", null)).toBe(false);
  });
});
