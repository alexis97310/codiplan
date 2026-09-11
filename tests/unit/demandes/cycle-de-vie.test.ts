import { describe, expect, it } from "vitest";

import {
  estFige,
  peutAccuser,
  peutCloreSansSuite,
  peutQualifier,
  peutTransformer,
} from "@/lib/demandes/cycle-de-vie";
import { STATUTS_DEMANDE, type StatutDemande } from "@/lib/demandes/saisie";

/**
 * LE CYCLE DE VIE D'UNE DEMANDE (L2-06).
 *
 * Ce module EXPLIQUE, il ne garde pas : la garantie est le déclencheur
 * `demande_cycle_de_vie`, et `tests/isolation/cycle-de-vie-demande.test.ts`
 * confronte les deux — *deux lectures d'un même critère divergent en silence*
 * (§9, 01/09). Ici on éprouve ce que l'écran dira AVANT d'essayer.
 *
 * **La population est l'ÉNUMÉRATION**, jamais une liste tenue à la main : un
 * cinquième statut ajouté demain entre dans ces tables le jour où il est écrit,
 * et un statut qu'aucune ligne ne traite fait rougir.
 */

/**
 * La matrice, statut par statut, action par action. Elle est écrite en toutes
 * lettres parce que c'est elle, la règle : un tableau se relit, une suite de
 * `if` se raconte.
 */
const ATTENDU: Record<
  StatutDemande,
  {
    qualifier: boolean;
    transformer: boolean;
    clore: boolean;
    accuserSansAccuse: boolean;
  }
> = {
  nouvelle: {
    qualifier: true,
    transformer: false,
    clore: true,
    accuserSansAccuse: true,
  },
  qualifiee: {
    qualifier: false,
    transformer: true,
    clore: true,
    accuserSansAccuse: true,
  },
  transformee: {
    qualifier: false,
    transformer: false,
    clore: false,
    accuserSansAccuse: false,
  },
  close_sans_suite: {
    qualifier: false,
    transformer: false,
    clore: false,
    accuserSansAccuse: false,
  },
};

describe("la matrice des transitions (L2-06)", () => {
  it("couvre tous les statuts de l'énumération — sans quoi elle ne mesure rien", () => {
    // Témoin de non-vacuité, et clôture par l'énumération plutôt que par une
    // liste : un statut ajouté demain rougit ici le jour où il est écrit.
    expect(Object.keys(ATTENDU).sort()).toEqual([...STATUTS_DEMANDE].sort());
    expect(STATUTS_DEMANDE.length).toBeGreaterThan(3);
  });

  it.each(STATUTS_DEMANDE)("depuis « %s »", (statut) => {
    const attendu = ATTENDU[statut];
    expect(peutQualifier(statut).refuse).toBe(!attendu.qualifier);
    expect(peutTransformer(statut).refuse).toBe(!attendu.transformer);
    expect(peutCloreSansSuite(statut).refuse).toBe(!attendu.clore);
    expect(peutAccuser(statut, null).refuse).toBe(!attendu.accuserSansAccuse);
  });

  it("chaque refus porte une clé de dictionnaire, jamais une phrase", () => {
    // CLAUDE.md §5 : aucune chaîne en dur. Le témoin est le PRÉFIXE — une clé
    // vide ou empruntée à `intervention.` passerait sans lui.
    for (const statut of STATUTS_DEMANDE) {
      for (const verdict of [
        peutQualifier(statut),
        peutTransformer(statut),
        peutCloreSansSuite(statut),
        peutAccuser(statut, null),
      ]) {
        if (verdict.refuse) {
          expect(verdict.cle).toMatch(/^demande\.refus\./);
        }
      }
    }
  });
});

describe("les deux fins ne se ressemblent pas", () => {
  it("« transformée » et « close sans suite » sont figées, les deux autres non", () => {
    expect(estFige("transformee")).toBe(true);
    expect(estFige("close_sans_suite")).toBe(true);
    expect(estFige("nouvelle")).toBe(false);
    expect(estFige("qualifiee")).toBe(false);
  });

  it("elles refusent avec des MOTIFS distincts, jamais une phrase creuse", () => {
    // Elles sont terminales pour deux raisons différentes — l'une est devenue
    // une intervention, l'autre a mesuré un service rendu à distance — et un
    // message unique ferait chercher au mauvais endroit.
    const apresTransformation = peutCloreSansSuite("transformee");
    const apresCloture = peutQualifier("close_sans_suite");
    expect(apresTransformation.refuse && apresTransformation.cle).toBe(
      "demande.refus.deja_transformee",
    );
    expect(apresCloture.refuse && apresCloture.cle).toBe(
      "demande.refus.deja_close",
    );
  });
});

describe("l'accusé de réception ne s'écrit qu'une fois", () => {
  it("une demande déjà accusée refuse un second accusé", () => {
    // *Une mesure qu'on peut repousser ne mesure plus rien* : réécrire
    // l'horodatage transformerait un délai dépassé en délai tenu.
    const verdict = peutAccuser("nouvelle", new Date("2026-08-24T07:40:00Z"));
    expect(verdict.refuse && verdict.cle).toBe("demande.refus.deja_accusee");
  });

  it("la même demande SANS accusé l'accepte — le refus vient bien de là", () => {
    // Le cas qui doit rester vert POUR SA PROPRE RAISON (§9, 11/09) : sans lui,
    // un `peutAccuser` qui refuserait toujours passerait le scénario ci-dessus.
    expect(peutAccuser("nouvelle", null).refuse).toBe(false);
  });
});
