import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";

/**
 * 9L54A-TERRAIN-PRECHARGE-FRAME-SELF — `frame-ancestors` ne doit jamais
 * redevenir `'none'` (bloque le préchargement same-origin de
 * `components/terrain/copie-locale.tsx`, régression mesurée par 9L54), ni
 * s'ouvrir à `*` ou à un domaine tiers (romprait la protection contre le
 * détournement de clic que 9L08-EN-TETES-SECURITE a posée).
 */
describe("9L54A — frame-ancestors reste 'self', jamais 'none' ni '*'", () => {
  it("la politique de contenu posée sur toutes les routes porte `frame-ancestors 'self'`", async () => {
    const regles = await nextConfig.headers!();
    const toutesLesRoutes = regles.find((r) => r.source === "/(.*)")!;
    const csp = toutesLesRoutes.headers.find(
      (e) => e.key === "Content-Security-Policy",
    )!;

    expect(csp.value).toContain("frame-ancestors 'self'");
    expect(csp.value).not.toContain("frame-ancestors 'none'");
    expect(csp.value).not.toContain("frame-ancestors *");
  });

  it("`X-Frame-Options` vaut `SAMEORIGIN`, jamais `DENY` ni `ALLOW-FROM`", async () => {
    const regles = await nextConfig.headers!();
    const toutesLesRoutes = regles.find((r) => r.source === "/(.*)")!;
    const xFrameOptions = toutesLesRoutes.headers.find(
      (e) => e.key === "X-Frame-Options",
    )!;

    expect(xFrameOptions.value).toBe("SAMEORIGIN");
  });
});
