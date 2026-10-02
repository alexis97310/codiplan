import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n/fr";

/**
 * `enrolement.codes_secours.aide` DIT LE VRAI (9CZ-RETOUCHES-9).
 *
 * Depuis TR-36 (9CW-TP-S6), les codes de secours restent relus côté serveur
 * et donc RÉAFFICHÉS tant que la ligne `second_facteur` n'est pas confirmée —
 * y compris après un code refusé (voir le docblock de
 * `app/(sans-session)/enrolement/page.tsx`). Le texte affirmait l'inverse
 * (« ils ne seront plus affichés »), ce qui est faux dès le premier code
 * refusé.
 */
describe("enrolement.codes_secours.aide dit le vrai", () => {
  it("ne prétend plus qu'ils ne seront plus affichés", () => {
    expect(t("enrolement.codes_secours.aide")).not.toContain(
      "ne seront plus affichés",
    );
  });

  it("dit qu'ils restent affichés jusqu'à la confirmation, puis plus jamais après", () => {
    expect(t("enrolement.codes_secours.aide")).toBe(
      "Notez-les maintenant : ils restent affichés jusqu'à la confirmation de l'activation, plus jamais après. Chacun ne sert qu'une fois, si vous perdez votre application.",
    );
  });
});
