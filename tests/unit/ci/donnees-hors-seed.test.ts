import { describe, expect, it } from "vitest";

import {
  SOCIETES_DU_SEED,
  rapportHorsSeed,
  verdictHorsSeed,
  type SocieteObservee,
} from "../../../scripts/lib/donnees-hors-seed";

/**
 * LE REFUS QUI PROTÈGE LE JOUR OÙ PERSONNE NE S'EN SOUVIENDRA (N1, borne 3).
 *
 * L'amendement du §12 laisse une migration atteindre la base de démonstration
 * sans main. **La borne 3 est ce qui l'arrête le jour où cette base cesse
 * d'être une fiction** — et ce jour-là, personne ne relira la décision. Ce
 * gardien est donc écrit AVANT que le cas existe, ce qui est le seul moment où
 * il coûte quelque chose et le seul où il est encore possible.
 */

const demonstration: readonly SocieteObservee[] = SOCIETES_DU_SEED.map(
  (id, rang) => ({
    id,
    code: `DEMO-${rang}`,
    raison_sociale: `Démonstration ${rang}`,
  }),
);

const reelle: SocieteObservee = {
  id: "0192ffff-0000-7000-8000-00000000beef",
  code: "CLIENT-1",
  raison_sociale: "Une société qui n'est pas une fiction",
};

describe("la base ne porte-t-elle que le jeu de démonstration ?", () => {
  it("TÉMOIN — le seed écrit bien des sociétés, et leurs identifiants sont FIXES", () => {
    // Sans ce témoin, une liste devenue vide rendrait « toute société est
    // étrangère » (le contrôle refuserait tout) ou, pire selon l'implémentation,
    // « aucune n'est étrangère ». *Un décompte nul ressemble à un sans-faute.*
    expect(SOCIETES_DU_SEED.length).toBeGreaterThanOrEqual(2);
    for (const id of SOCIETES_DU_SEED) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
    }
  });

  it("REFUSE dès qu'UNE société hors seed apparaît", () => {
    const verdict = verdictHorsSeed([...demonstration, reelle]);
    expect(verdict.verdict).toBe("donnees_reelles");
    if (verdict.verdict !== "donnees_reelles") return;
    expect(verdict.etrangeres).toEqual([reelle]);
  });

  it("REFUSE même si la société hors seed est SEULE en base", () => {
    // Le cas d'une base de production naissante : aucune fiction, que du réel.
    const verdict = verdictHorsSeed([reelle]);
    expect(verdict.verdict).toBe("donnees_reelles");
  });

  // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09). Un contrôle
  // qui refuserait toujours serait vert sur les deux scénarios ci-dessus et
  // décrirait une automatisation qui ne part jamais.
  it("AUTORISE quand la base ne porte que les sociétés du seed", () => {
    const verdict = verdictHorsSeed(demonstration);
    expect(verdict.verdict).toBe("seed_seul");
  });

  it("le critère est l'IDENTIFIANT, jamais le nom ni le code", () => {
    // *Le rapprochement se fait sur la CLÉ, jamais sur une ressemblance.* Une
    // société baptisée « CODIMA Nouvelle-Calédonie » par une main humaine ne
    // devient pas du seed en empruntant son nom.
    const usurpatrice: SocieteObservee = {
      id: reelle.id,
      code: "CODIMA-NC",
      raison_sociale: "CODIMA Nouvelle-Calédonie",
    };
    expect(verdictHorsSeed([usurpatrice]).verdict).toBe("donnees_reelles");
  });

  it("RIEN OBSERVÉ n'est pas « la base est saine »", () => {
    // Deux causes distinctes rendent zéro société : une base neuve, et une
    // lecture filtrée par les politiques sous `FORCE` (§9, 07/09). Les deux
    // interdisent de conclure, et le refus est le même.
    const verdict = verdictHorsSeed([]);
    expect(verdict.verdict).toBe("rien_observe");
    const rapport = rapportHorsSeed(verdict);
    expect(rapport).toContain("RIEN OBSERVÉ");
    expect(rapport).toContain("Ce n'est PAS « la base est saine »");
    expect(rapport).not.toContain("autorisée");
  });
});

describe("le rapport NOMME ce qu'il a observé", () => {
  it("il nomme chaque société étrangère, jamais seulement leur nombre", () => {
    // *Un décompte se lit en trois secondes et ne se vérifie pas, un nom se
    // vérifie* (§9, 06/09). Celui qui lit ce refus doit pouvoir aller regarder.
    const rapport = rapportHorsSeed(
      verdictHorsSeed([...demonstration, reelle]),
    );
    expect(rapport).toContain(reelle.id);
    expect(rapport).toContain(reelle.raison_sociale);
  });

  it("il distingue ce qui vient du DÉPÔT de ce qui vient de la BASE", () => {
    const rapport = rapportHorsSeed(verdictHorsSeed(demonstration));
    expect(rapport).toContain("(dépôt)");
    expect(rapport).toContain("observée(s)");
  });
});
