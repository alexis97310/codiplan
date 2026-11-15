import { describe, expect, it } from "vitest";

import {
  FONCTIONS_IDENTITE,
  etatsFonctionsIdentite,
  exemptionFonctionsIdentiteOk,
  type LigneFonctionIdentite,
} from "../../../lib/db/exemption-fonctions-identite";
import {
  ecartsExemptionFonctionsIdentite,
  rapportExemptionFonctionsIdentite,
} from "../../../scripts/lib/exemption-fonctions-identite";

/**
 * Exemption des deux fonctions SECURITY DEFINER d'identité (D226, D233) —
 * décision d'Alexis du 10/11/2026. La mesure (`lib/db/`) et le jugement
 * (`scripts/lib/`, câblé dans `pnpm veille`) sont éprouvés ici sur des lignes
 * FABRIQUÉES ; la mesure contre une vraie base vit dans
 * `tests/isolation/9l05-exemption-fonctions-identite.test.ts`.
 */

function ligneSure(fonction: string): LigneFonctionIdentite {
  return {
    fonction,
    proprietaire: "postgres",
    proprietaire_contourne_rls: true,
    proprietaire_superutilisateur: false,
    securite_definer: true,
    reglages: ["search_path=pg_catalog, public", "row_security=off"],
  };
}

describe("etatsFonctionsIdentite / exemptionFonctionsIdentiteOk", () => {
  it("un propriétaire BYPASSRLS, réglages intacts : exempté et sûr", () => {
    const etats = etatsFonctionsIdentite(FONCTIONS_IDENTITE.map(ligneSure));
    expect(exemptionFonctionsIdentiteOk(etats)).toBe(true);
    for (const etat of etats) {
      expect(etat.exempte).toBe(true);
      expect(etat.reglagesSurs).toBe(true);
    }
  });

  it("un propriétaire superutilisateur (base de test) est, lui aussi, exempté", () => {
    const [nom] = FONCTIONS_IDENTITE;
    const ligne: LigneFonctionIdentite = {
      ...ligneSure(nom),
      proprietaire_contourne_rls: false,
      proprietaire_superutilisateur: true,
    };
    expect(etatsFonctionsIdentite([ligne])[0]?.exempte).toBe(true);
  });

  it("RK (ko) : un propriétaire ni BYPASSRLS ni superutilisateur n'est pas exempté", () => {
    const [nom] = FONCTIONS_IDENTITE;
    const ligne: LigneFonctionIdentite = {
      ...ligneSure(nom),
      proprietaire_contourne_rls: false,
      proprietaire_superutilisateur: false,
    };
    const etats = etatsFonctionsIdentite([ligne]);
    expect(etats[0]?.exempte).toBe(false);
    expect(exemptionFonctionsIdentiteOk(etats)).toBe(false);
  });

  it("ko : une fonction absente des lignes observées n'est jamais sûre", () => {
    const [seule] = FONCTIONS_IDENTITE;
    const etats = etatsFonctionsIdentite([ligneSure(seule)]);
    expect(exemptionFonctionsIdentiteOk(etats)).toBe(false);
  });

  it("ko : search_path ou row_security différents de ceux de la migration", () => {
    const [nom] = FONCTIONS_IDENTITE;
    const sansRowSecurity: LigneFonctionIdentite = {
      ...ligneSure(nom),
      reglages: ["search_path=pg_catalog, public"],
    };
    const searchPathDesserre: LigneFonctionIdentite = {
      ...ligneSure(nom),
      reglages: ["search_path=public", "row_security=off"],
    };
    const invoker: LigneFonctionIdentite = {
      ...ligneSure(nom),
      securite_definer: false,
    };
    for (const ligne of [sansRowSecurity, searchPathDesserre, invoker]) {
      expect(etatsFonctionsIdentite([ligne])[0]?.reglagesSurs).toBe(false);
    }
  });

  it("aucun réglage (`reglages: null`) n'est jamais sûr", () => {
    const [nom] = FONCTIONS_IDENTITE;
    const ligne: LigneFonctionIdentite = { ...ligneSure(nom), reglages: null };
    expect(etatsFonctionsIdentite([ligne])[0]?.reglagesSurs).toBe(false);
  });
});

describe("ecartsExemptionFonctionsIdentite (D226, D233)", () => {
  it("rend une liste VIDE quand les deux fonctions sont exemptées et sûres", () => {
    const etats = etatsFonctionsIdentite(FONCTIONS_IDENTITE.map(ligneSure));
    expect(ecartsExemptionFonctionsIdentite(etats)).toEqual([]);
  });

  it("ÉCHOUE, et NOMME la fonction, quand son propriétaire n'est plus exempté", () => {
    const [nom, autre] = FONCTIONS_IDENTITE;
    const etats = etatsFonctionsIdentite([
      {
        ...ligneSure(nom),
        proprietaire_contourne_rls: false,
        proprietaire_superutilisateur: false,
      },
      ligneSure(autre),
    ]);
    const ecarts = ecartsExemptionFonctionsIdentite(etats);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain(nom);
  });

  it("ÉCHOUE sur une fonction introuvable, nommée dans l'écart", () => {
    const [seule, manquante] = FONCTIONS_IDENTITE;
    const etats = etatsFonctionsIdentite([ligneSure(seule)]);
    const ecarts = ecartsExemptionFonctionsIdentite(etats);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain(manquante);
    expect(ecarts[0]).toContain("introuvable");
  });

  it("le rapport nomme les deux fonctions, même absentes", () => {
    const rapport = rapportExemptionFonctionsIdentite([]);
    for (const nom of FONCTIONS_IDENTITE) {
      expect(rapport).toContain(nom);
    }
  });
});
