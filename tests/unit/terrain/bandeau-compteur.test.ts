import { describe, expect, it } from "vitest";

import { texteDuBandeau } from "@/components/terrain/bandeau-compteur";
import { fr } from "@/lib/i18n";

/**
 * LE BANDEAU « COMPTEUR EN COURS » (9DI-TP-TER1-JOURNEE-FICHE, QE-11, D161) —
 * LA PART PURE, éprouvée sans base ni navigateur (D-13).
 *
 * ## Ce que ce fichier garde (relecture de 9DI, T7, publiée a058705c)
 *
 * `app/(mobile)/terrain/[id]/page.tsx` passait le fuseau de la fiche
 * CONSULTÉE au bandeau d'une AUTRE intervention, dont le fuseau peut différer
 * (D5 : surchargeable par agence). `texteDuBandeau` n'a jamais porté ce
 * défaut — elle compose depuis le SEUL `fuseau` qu'on lui donne —, mais rien
 * ne le prouvait : ce test confronte deux fuseaux distincts sur le MÊME
 * instant et montre que l'heure rendue suit celui qu'on lui passe, jamais un
 * autre. C'est la garantie qui manquait à la chaîne : si un futur appelant
 * repasse le fuseau de la fiche consultée plutôt que celui de l'intervention
 * où le compteur tourne, ce test ne le détecte pas (il n'a pas de base), mais
 * il fixe au moins ce que la fonction DOIT faire une fois qu'on lui donne le
 * bon fuseau.
 */

const INSTANT = new Date("2026-10-04T22:00:00.000Z");

describe("texteDuBandeau", () => {
  it("rend l'heure dans LE FUSEAU DONNÉ, jamais un autre (ici Nouméa, 09:00)", () => {
    const texte = texteDuBandeau("Client X", INSTANT, "Pacific/Noumea");
    expect(texte).toBe(
      `${fr["terrain.compteur.bandeau_prefixe"]} 09:00${fr["ponctuation.separateur"]}Client X`,
    );
  });

  it("le MÊME instant rend une heure DIFFÉRENTE sous un autre fuseau (Paris, 00:00)", () => {
    const texte = texteDuBandeau("Client X", INSTANT, "Europe/Paris");
    expect(texte).toBe(
      `${fr["terrain.compteur.bandeau_prefixe"]} 00:00${fr["ponctuation.separateur"]}Client X`,
    );
  });
});
