import { describe, expect, it } from "vitest";

import { estFormeDeJeton, jetonDeMachine } from "@/lib/machines/qr";

/**
 * LE JETON QR — D7 (« dérivé de l'UUID, jamais le numéro affiché »), I10, I4.
 *
 * Ce que ces scénarios éprouvent est la propriété qui rend le jeton utilisable
 * HORS LIGNE : il se calcule sur l'appareil, sans réseau et sans secret, et il
 * se RECALCULE à l'identique. Une étiquette réimprimée pour une machine créée
 * en mode avion doit porter le même jeton.
 */

const ID = "0192f0a0-1000-7000-8000-0000000000a1";
const AUTRE = "0192f0a0-1000-7000-8000-0000000000a2";

describe("le jeton se dérive de l'`id`, et de rien d'autre", () => {
  it("est DÉTERMINISTE — c'est ce qui permet de réimprimer une étiquette", () => {
    expect(jetonDeMachine(ID)).toBe(jetonDeMachine(ID));
  });

  it("ignore la casse et les espaces de bordure", () => {
    // Deux appareils qui formatent différemment le même UUID doivent produire
    // UNE étiquette, pas deux.
    expect(jetonDeMachine(ID.toUpperCase())).toBe(jetonDeMachine(ID));
    expect(jetonDeMachine(`  ${ID}\n`)).toBe(jetonDeMachine(ID));
  });

  it("sépare deux machines dont les identifiants ne diffèrent que d'un caractère", () => {
    // TÉMOIN : sans cette assertion, une fonction constante passerait les deux
    // scénarios ci-dessus sans rien dériver du tout (§9, 30/08).
    expect(jetonDeMachine(ID)).not.toBe(jetonDeMachine(AUTRE));
  });

  it("N'EST PAS INVERSIBLE : l'étiquette ne rend pas l'`id`", () => {
    // La seule chose que le hachage apporte réellement. Un jeton égal à l'`id`
    // aurait livré, sur une étiquette photographiée, l'identifiant technique et
    // son horodatage de création — un UUID v7 porte les deux.
    const jeton = jetonDeMachine(ID);
    expect(jeton).not.toContain("0192f0a0");
    expect(jeton).not.toContain(
      ID.replaceAll("-", "").slice(0, 8).toUpperCase(),
    );
  });

  it("refuse tout ce qui n'est pas un UUID — le numéro le premier", () => {
    // D7 et I10 : « Le QR encode le jeton, JAMAIS le numéro ». Le refus est ici
    // parce que c'est la confusion que le cahier des charges nomme, et parce
    // que `numero` et `numero_serie` changent tous deux APRÈS la pose de
    // l'étiquette — l'un à la synchronisation, l'autre à la correction d'une
    // plaque illisible.
    for (const mauvais of [
      "42",
      "Local-0000a1",
      "SN-INCONNU-ATELIER-3",
      "",
      "0192f0a0-1000-7000-8000",
      `${ID}-trop-long`,
    ]) {
      expect(() => jetonDeMachine(mauvais), mauvais).toThrow(/dérive de l/);
    }
  });
});

describe("la FORME d'un jeton n'est pas une autorisation", () => {
  it("reconnaît un jeton produit par la dérivation", () => {
    expect(estFormeDeJeton(jetonDeMachine(ID))).toBe(true);
  });

  it("refuse une longueur ou un alphabet étrangers", () => {
    const jeton = jetonDeMachine(ID);
    expect(estFormeDeJeton(jeton.slice(0, 25))).toBe(false);
    expect(estFormeDeJeton(`${jeton}A`)).toBe(false);
    // base32 RFC 4648 : ni 0, ni 1, ni 8, ni 9, ni minuscules.
    expect(estFormeDeJeton(`${jeton.slice(0, 25)}0`)).toBe(false);
    expect(estFormeDeJeton(jeton.toLowerCase())).toBe(false);
  });
});

describe("l'entropie est celle de l'`id`, et le jeton ne l'augmente pas", () => {
  it("porte 26 caractères base32 — au-delà des 74 bits aléatoires d'un UUID v7", () => {
    // Ce scénario n'est PAS une mesure de sécurité, et c'est pourquoi il porte
    // ce titre : 26 caractères valent 130 bits, mais la force du jeton contre
    // la devinette reste celle de l'`id` — 74 bits —, la dérivation étant
    // publique. *Un chiffre qui ne peut pas bouger sous une faute n'est pas une
    // observation* (§9, 06/09) : celui-ci dit seulement que la troncature ne
    // retire rien.
    expect(jetonDeMachine(ID)).toHaveLength(26);
    expect(26 * 5).toBeGreaterThan(74);
  });

  it("ne produit pas de collision sur mille identifiants voisins", () => {
    // Témoin de non-vacuité de la dérivation elle-même : mille UUID qui ne
    // diffèrent que par leurs derniers chiffres rendent mille jetons distincts.
    const jetons = new Set<string>();
    for (let n = 0; n < 1000; n += 1) {
      const suffixe = n.toString(16).padStart(12, "0");
      jetons.add(jetonDeMachine(`0192f0a0-1000-7000-8000-${suffixe}`));
    }
    expect(jetons.size).toBe(1000);
  });
});
