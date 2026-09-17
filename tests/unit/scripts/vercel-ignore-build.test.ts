import { describe, expect, it } from "vitest";

import { decider } from "../../../scripts/vercel-ignore-build.mjs";

/**
 * Étape « Ignored Build Step » Vercel : plus un déploiement par commit
 * intermédiaire sur une branche `claude/*`, un seul quand la pull request
 * associée sort de brouillon. Convention Vercel : 1 = on construit, 0 = on
 * ignore. Par défaut (branche hors périmètre, panne réseau) on construit —
 * ne jamais faire taire une vraie relecture pour économiser du stockage.
 */
describe("étape Ignored Build Step Vercel", () => {
  it("construit sur une branche hors claude/*, sans appeler GitHub", async () => {
    const recupererPullRequests = () => {
      throw new Error("ne doit pas être appelé");
    };
    const { code } = await decider({
      branche: "main",
      proprietaire: "alexis97310",
      depot: "codiplan",
      recupererPullRequests,
    });
    expect(code).toBe(1);
  });

  it("ignore une branche claude/* sans pull request ouverte", async () => {
    const { code } = await decider({
      branche: "claude/great-turing-z01k8g",
      proprietaire: "alexis97310",
      depot: "codiplan",
      recupererPullRequests: async () => [],
    });
    expect(code).toBe(0);
  });

  it("ignore une branche claude/* dont la pull request est en brouillon", async () => {
    const { code } = await decider({
      branche: "claude/great-turing-z01k8g",
      proprietaire: "alexis97310",
      depot: "codiplan",
      recupererPullRequests: async () => [{ number: 42, draft: true }],
    });
    expect(code).toBe(0);
  });

  it("construit une branche claude/* dont la pull request est prête à relire", async () => {
    const { code } = await decider({
      branche: "claude/great-turing-z01k8g",
      proprietaire: "alexis97310",
      depot: "codiplan",
      recupererPullRequests: async () => [{ number: 42, draft: false }],
    });
    expect(code).toBe(1);
  });

  it("construit par défaut si l'appel GitHub échoue (fail-open)", async () => {
    const { code } = await decider({
      branche: "claude/great-turing-z01k8g",
      proprietaire: "alexis97310",
      depot: "codiplan",
      recupererPullRequests: async () => {
        throw new Error("panne réseau");
      },
    });
    expect(code).toBe(1);
  });
});
