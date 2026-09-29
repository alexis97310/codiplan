import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";

/**
 * AUCUN LIBELLÉ AFFICHÉ NE NOMME « CODIMA » NI « WINPRO » (TP-A5, PV-02,
 * TR-28, TR-53 — audit du 28/09/2026).
 *
 * *Le produit est destiné à la vente à d'autres sociétés que CODIMA* (D29,
 * même raison que `clients/presentation-ecran.test.ts` sur « Winpro ») : un
 * libellé qui nomme le client pilote en dur ment à toute autre société, et un
 * libellé qui nomme son ERP ment dès que la société en change.
 *
 * **Deux exclusions, closes, et aucune autre** :
 *  - `vocabulaire.*.definition` — non affichées (lecture seule par
 *    `definition()`, `lib/i18n/vocabulaire.ts`), et « Établissement CODIMA »
 *    y est la DÉFINITION même du mot « agence », pas un texte d'écran ;
 *  - `equipe.e2e.courriel` — une adresse d'épreuve (`tests/e2e/equipe.
 *    spec.ts`), jamais rendue à un humain comme un libellé de produit.
 * Toute autre clé qui porterait l'un des deux mots est une régression.
 */
describe("aucun libellé du dictionnaire ne nomme le client pilote ni son ERP", () => {
  const EXCLUSION_DEFINITION = /^vocabulaire\.[a-z_]+\.definition$/;
  const EXCLUSION_COURRIEL_EPREUVE = "equipe.e2e.courriel";

  it("ne contient ni « CODIMA » ni « Winpro », hors les deux exclusions closes", () => {
    const fautives: string[] = [];
    for (const [cle, valeur] of Object.entries(fr)) {
      if (
        EXCLUSION_DEFINITION.test(cle) ||
        cle === EXCLUSION_COURRIEL_EPREUVE
      ) {
        continue;
      }
      if (/codima|winpro/i.test(valeur)) {
        fautives.push(cle);
      }
    }
    expect(fautives).toEqual([]);
  });

  it("le témoin de non-vacuité : les deux définitions imposées, et le courriel d'épreuve, portent bien le mot qu'ils excusent", () => {
    // Un gardien dont ces entrées n'existeraient plus, ou ne porteraient plus
    // le mot, mesurerait un dictionnaire différent de celui qu'il documente.
    // `vocabulaire.taux_occupation.definition` correspond aussi à
    // EXCLUSION_DEFINITION sans jamais nommer CODIMA — l'exclusion reste
    // correcte (elle n'a rien à laisser passer), seules les deux définitions
    // imposées sont vérifiées ici pour leur propre raison.
    expect(EXCLUSION_DEFINITION.test("vocabulaire.agence.definition")).toBe(
      true,
    );
    expect(EXCLUSION_DEFINITION.test("vocabulaire.site.definition")).toBe(true);
    expect(fr["vocabulaire.agence.definition"]).toMatch(/codima/i);
    expect(fr["vocabulaire.site.definition"]).toMatch(/codima/i);
    expect(fr[EXCLUSION_COURRIEL_EPREUVE as keyof typeof fr]).toMatch(
      /codima/i,
    );
  });
});
