import { describe, expect, it } from "vitest";

import { uuidv7 } from "@/lib/db/uuid";
import { viseCetteCible } from "@/lib/auth/acces-technicien";

/**
 * `viseCetteCible` (D162, 9DJ-TP-ACC1-DONNER-ACCES) — la seule part de
 * `lib/auth/acces-technicien.ts` qui se mesure SANS base.
 *
 * `journal_acces` désigne la trace de ce lot par son AUTEUR — l'administrateur
 * — jamais par le technicien visé (voir l'en-tête du module) : `detail` est
 * donc le seul endroit qui porte la cible, et c'est ce que cette fonction
 * retrouve. Le marqueur est TOUJOURS en fin de chaîne — un test le mesure
 * plutôt que de le supposer.
 */
describe("viseCetteCible", () => {
  const CIBLE = uuidv7();
  const AUTRE = uuidv7();

  it("reconnaît un détail qui se termine par le marqueur de cette cible", () => {
    expect(viseCetteCible(`lien d'accès envoyé ; cible:${CIBLE}`, CIBLE)).toBe(
      true,
    );
  });

  it("refuse un détail qui vise une AUTRE cible", () => {
    expect(viseCetteCible(`lien d'accès envoyé ; cible:${AUTRE}`, CIBLE)).toBe(
      false,
    );
  });

  it("refuse un détail nul — TÉMOIN que la fonction ne lève pas sur `null`", () => {
    expect(viseCetteCible(null, CIBLE)).toBe(false);
  });

  it("refuse un détail qui porte la cible ailleurs qu'EN FIN de chaîne", () => {
    // Le marqueur doit conclure le détail : un identifiant qui apparaîtrait au
    // milieu (par exemple dans le motif d'un refus de courriel qui citerait un
    // UUID) ne doit jamais être confondu avec la cible réelle.
    expect(viseCetteCible(`cible:${CIBLE} — puis autre chose`, CIBLE)).toBe(
      false,
    );
  });
});
