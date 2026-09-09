import { describe, expect, it } from "vitest";

import {
  engendrerJetonQr,
  engendrerPlancheDeJetons,
  estFormeDeJeton,
} from "@/lib/machines/qr";

/**
 * LE JETON QR EST UN SECRET (D71) — et ces scénarios éprouvent exactement cela.
 *
 * La version précédente le DÉRIVAIT de l'`id`, et ses scénarios éprouvaient le
 * DÉTERMINISME : le même identifiant rendait le même jeton. **Ces scénarios-là
 * ont disparu, et leur disparition est le ticket** : un secret déterministe
 * n'en est pas un.
 *
 * Ce qui est éprouvé désormais est la propriété inverse — *rien de ce qu'un
 * tiers peut connaître ne permet de prévoir le jeton* —, et elle se mesure de
 * la seule façon dont une propriété négative se mesure : par ce qui ne se
 * répète pas.
 */

describe("le jeton est TIRÉ, jamais dérivé", () => {
  it("deux appels ne rendent jamais le même jeton", () => {
    // Le scénario qui remplace le déterminisme, et qui dit l'inverse de lui.
    expect(engendrerJetonQr()).not.toBe(engendrerJetonQr());
  });

  it("mille tirages donnent mille jetons distincts", () => {
    // TÉMOIN de la source aléatoire : un générateur mal câblé — graine figée,
    // tampon réutilisé, `Math.random` — produirait des doublons EN SILENCE, et
    // c'est le défaut qu'aucun décompte ne signale (§9, 30/08).
    const jetons = new Set<string>();
    for (let n = 0; n < 1000; n += 1) jetons.add(engendrerJetonQr());
    expect(jetons.size).toBe(1000);
  });

  it("porte 26 caractères base32 — 130 bits, et ils sont TOUS tirés", () => {
    // Ici la longueur mesure vraiment quelque chose, à la différence de la
    // version dérivée : celle-là affichait 130 bits et n'en portait que 74,
    // ceux de l'UUID. C'est la différence exacte entre un identifiant et un
    // secret.
    const jeton = engendrerJetonQr();
    expect(jeton).toHaveLength(26);
    expect(26 * 5).toBe(130);
    expect(estFormeDeJeton(jeton)).toBe(true);
  });

  it("les 32 caractères de l'alphabet sortent tous — aucun n'est mort", () => {
    // Sans ce témoin, un encodeur qui ne produirait que la moitié de l'alphabet
    // passerait tous les scénarios ci-dessus en ne portant que 4 bits par
    // caractère au lieu de 5 — soit 104 bits au lieu de 130, sans que rien ne
    // le dise.
    const vus = new Set<string>();
    for (let n = 0; n < 500; n += 1) {
      for (const caractere of engendrerJetonQr()) vus.add(caractere);
    }
    expect(vus.size).toBe(32);
  });
});

describe("les PLANCHES pré-générées — la moitié de D7 que D71 rend possible", () => {
  it("engendre le nombre demandé, tous distincts", () => {
    const planche = engendrerPlancheDeJetons(50);
    expect(planche).toHaveLength(50);
    expect(new Set(planche).size).toBe(50);
    for (const jeton of planche) expect(estFormeDeJeton(jeton)).toBe(true);
  });

  it("refuse un nombre qui n'est pas un entier positif", () => {
    for (const mauvais of [0, -1, 1.5, Number.NaN]) {
      expect(() => engendrerPlancheDeJetons(mauvais), String(mauvais)).toThrow(
        /au moins un/,
      );
    }
  });

  it("une planche s'engendre SANS aucune machine — c'est tout l'intérêt", () => {
    // Ce que la dérivation rendait impossible : imprimer avant que les machines
    // existent, donc avant qu'aucun `id` ne soit connu. D7 le demandait déjà
    // — « jetons pré-générés et téléchargés sur l'appareil avant le départ » —
    // et se contredisait trois lignes plus haut.
    expect(() => engendrerPlancheDeJetons(3)).not.toThrow();
  });
});

describe("la FORME d'un jeton n'est pas une autorisation", () => {
  it("refuse une longueur ou un alphabet étrangers", () => {
    const jeton = engendrerJetonQr();
    expect(estFormeDeJeton(jeton.slice(0, 25))).toBe(false);
    expect(estFormeDeJeton(`${jeton}A`)).toBe(false);
    // base32 RFC 4648 : ni 0, ni 1, ni 8, ni 9, ni minuscules.
    expect(estFormeDeJeton(`${jeton.slice(0, 25)}0`)).toBe(false);
    expect(estFormeDeJeton(jeton.toLowerCase())).toBe(false);
  });

  it("ne reconnaît RIEN de ce qu'un humain saisirait à la place", () => {
    // D7 et I10 : « Le QR encode le jeton, JAMAIS le numéro ». Ces valeurs sont
    // celles qu'on confondrait avec un jeton en lisant une fiche.
    for (const mauvais of [
      "42",
      "Local-0000a1",
      "SN-INCONNU-ATELIER-3",
      "",
      "0192f0a0-1000-7000-8000-0000000000a1",
    ]) {
      expect(estFormeDeJeton(mauvais), mauvais).toBe(false);
    }
  });
});
