import { describe, expect, it } from "vitest";

import { decider } from "../../../scripts/vercel-ignore-build.mjs";

/**
 * Étape « Ignored Build Step » Vercel — décision d'Alexis (17/09/2026) :
 * Vercel ne sert plus qu'à UNE URL vivante. Seule `main` construit, toute
 * autre branche est ignorée, sans exception ni condition réseau. Convention
 * Vercel : 1 = on construit, 0 = on ignore.
 */
describe("étape Ignored Build Step Vercel — seule main construit", () => {
  it("construit sur main", () => {
    expect(decider({ branche: "main" }).code).toBe(1);
  });

  it("ignore une branche claude/*", () => {
    expect(decider({ branche: "claude/great-turing-z01k8g" }).code).toBe(0);
  });

  it("ignore une branche humaine", () => {
    expect(decider({ branche: "alexis97310-patch-1" }).code).toBe(0);
  });

  it("ignore une branche absente (défaut fermé)", () => {
    expect(decider({ branche: undefined }).code).toBe(0);
  });
});
