import { describe, expect, it } from "vitest";

import {
  avecPlancherDeDuree,
  motifRefusUniforme,
  PLANCHER_REPONSE_MS,
} from "@/lib/auth/reponse-uniforme";
import { fr } from "@/lib/i18n/fr";

/**
 * Le plancher de durée des réponses d'authentification (arbitrage D35).
 *
 * La règle seule est éprouvée ici ; les trois refus de D35 le sont contre la
 * vraie base par `tests/isolation/reponses-indiscernables.test.ts`.
 */
describe("plancher de durée", () => {
  it("ne rend pas la main avant le plancher, même quand le travail est immédiat", async () => {
    const debut = performance.now();
    await avecPlancherDeDuree(async () => "fait", 120);
    // Une tolérance de quelques millisecondes : `setTimeout` n'est pas exact.
    expect(performance.now() - debut).toBeGreaterThanOrEqual(115);
  });

  it("l'applique AUSSI quand le travail lève — sinon l'échec se trahit par sa vitesse", async () => {
    // C'est le cas qui compte : le chemin « compte inexistant » est justement
    // celui qui lève le plus tôt.
    const debut = performance.now();
    await expect(
      avecPlancherDeDuree(async () => {
        throw new Error("compte inexistant");
      }, 120),
    ).rejects.toThrow("compte inexistant");
    expect(performance.now() - debut).toBeGreaterThanOrEqual(115);
  });

  it("rend la valeur du travail, sans la toucher", async () => {
    await expect(avecPlancherDeDuree(async () => 42, 1)).resolves.toBe(42);
  });

  it("le plancher retenu couvre une vérification de mot de passe et deux allers-retours", () => {
    // Un plancher trop bas rouvre la fuite : les chemins les plus lents le
    // dépasseraient et se distingueraient à nouveau des plus rapides.
    expect(PLANCHER_REPONSE_MS).toBeGreaterThanOrEqual(500);
  });
});

describe("motif de refus uniforme", () => {
  it("vient du dictionnaire, jamais d'une chaîne écrite sur place", () => {
    expect(motifRefusUniforme()).toBe(fr["auth.refus"]);
  });

  it("ne dit ni si le compte existe, ni s'il est habilité quelque part", () => {
    const motif = motifRefusUniforme().toLowerCase();
    for (const revelateur of [
      "inexistant",
      "inconnu",
      "introuvable",
      "mot de passe",
      "habilitation",
      "société active",
      "désactivé",
    ]) {
      expect(motif, `« ${revelateur} » distinguerait les cas`).not.toContain(
        revelateur,
      );
    }
  });
});
