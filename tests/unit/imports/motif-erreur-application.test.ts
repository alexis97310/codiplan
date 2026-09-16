import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { motifDeLErreurTransaction } from "@/lib/imports/application";

/**
 * LE FILET DE `appliquerLesLignes`, ÉPROUVÉ SANS BASE (point 3 et point 4 de
 * la session du 16/09/2026).
 *
 * **Pourquoi une erreur FABRIQUÉE, et non reproduite.** `P2002` se reproduit
 * réellement contre la base jetable (`tests/isolation/application-import-types.test.ts`,
 * « une violation de contrainte à l'application ne sort JAMAIS en 500 ») —
 * c'est instantané, une vraie contrainte d'unicité heurtée deux fois. `P2028`
 * ne se reproduit pas de la même façon : il exige que
 * `DELAIS_APPLICATION.timeout` (quinze minutes) s'écoule réellement, ce
 * qu'aucune suite de tests ne peut se permettre. **`motifDeLErreurTransaction`
 * est donc extraite en fonction PURE** — le même geste que `motifDeLErreur`
 * de `lib/clients/depot.ts` — pour que son verdict s'éprouve sur une erreur
 * dont on choisit le code, sans attendre qu'elle survienne.
 */
describe("motifDeLErreurTransaction", () => {
  const erreurPrisma = (code: string): Prisma.PrismaClientKnownRequestError =>
    new Prisma.PrismaClientKnownRequestError("erreur de fabrication", {
      code,
      clientVersion: "test",
    });

  it("P2002 devient contrainte_violee", () => {
    expect(motifDeLErreurTransaction(erreurPrisma("P2002"))).toBe(
      "contrainte_violee",
    );
  });

  it("P2028 devient delai_depasse — le dépassement mesuré le 16/09/2026", () => {
    expect(motifDeLErreurTransaction(erreurPrisma("P2028"))).toBe(
      "delai_depasse",
    );
  });

  it("une autre erreur Prisma NOMMÉE n'est pas rattrapée — elle mentirait sur sa cause", () => {
    // P2025 (enregistrement absent) est un code réel et connu ailleurs dans le
    // dépôt (`lib/clients/depot.ts`) : il ne dit ni un doublon ni un
    // dépassement, et ce filet ne prétend pas le savoir.
    expect(motifDeLErreurTransaction(erreurPrisma("P2025"))).toBeNull();
  });

  it("une erreur qui n'est pas de Prisma n'est pas rattrapée", () => {
    expect(motifDeLErreurTransaction(new Error("panne quelconque"))).toBeNull();
  });

  it("une valeur qui n'est même pas une Error n'est pas rattrapée", () => {
    expect(motifDeLErreurTransaction("une chaîne")).toBeNull();
    expect(motifDeLErreurTransaction(null)).toBeNull();
  });
});
