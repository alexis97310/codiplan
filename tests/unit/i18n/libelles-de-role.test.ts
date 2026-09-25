import { describe, expect, it } from "vitest";

import { ROLES } from "@/lib/auth/roles";
import { fr, t, type CleTraduction } from "@/lib/i18n/fr";

/**
 * LES DIX RÔLES ONT LEUR LIBELLÉ (99A-ARRIVEE, sur constat d'audit d'ergonomie).
 *
 * `/arrivee` affichait le nom brut de l'énumération (« admin_societe ») —
 * mesuré à l'audit du 25/09/2026. Ce scénario tient la promesse dans le SENS
 * qui compte : que l'énumération grandisse, et ce test rougit avant qu'un
 * onzième rôle n'atteigne l'écran sans libellé.
 */
describe("libellés de rôle (`role.<valeur>`)", () => {
  it("chaque rôle de l'énumération canonique porte sa clé, non vide", () => {
    for (const role of ROLES) {
      const cle = `role.${role}` as CleTraduction;
      expect(fr[cle], `role.${role} est absente du dictionnaire`).toBeDefined();
      expect(t(cle).trim().length).toBeGreaterThan(0);
    }
  });

  it("ne recopie jamais le nom technique du rôle tel quel", () => {
    for (const role of ROLES) {
      expect(t(`role.${role}` as CleTraduction)).not.toBe(role);
    }
  });
});
