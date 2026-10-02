import { describe, expect, it } from "vitest";

import {
  clesAvertissementCourriel,
  corpsPourClient,
  corpsPourTechnicien,
  corpsRecapitulatifTechnicien,
  groupesParTechnicien,
  sujetPourClient,
  sujetPourTechnicien,
  sujetRecapitulatifTechnicien,
  type CreneauLisible,
  type DetailPourCourriel,
  type LigneRecapitulatif,
} from "@/lib/avertissements/planification";

/**
 * LA COMPOSITION DES COURRIELS DE PLANIFICATION (AVERTISSEMENTS-1) — texte
 * simple, jamais de prix (la surface de `lib/courriel` ne s'élargit pas).
 */

const DETAIL: DetailPourCourriel = {
  site: { libelle: "Atelier Ducos", commune: "Nouméa" },
  nature: "Curatif",
  referenceClient: "BC-4821",
  dureeMin: 90,
  machine: {
    famille: "Compresseur",
    marque: "Atlas Copco",
    reference: "GA 15",
    numeroSerie: "SN-778241",
  },
};

const NOUVEAU: CreneauLisible = { date: "14/10/2026", heure: "08:00" };
const ANCIEN: CreneauLisible = { date: "10/10/2026", heure: "14:00" };

describe("le sujet distingue planification et déplacement", () => {
  it("client", () => {
    expect(sujetPourClient(false)).toMatch(/planifiée/);
    expect(sujetPourClient(true)).toMatch(/déplacée/);
  });
  it("technicien", () => {
    expect(sujetPourTechnicien(false)).toMatch(/affectée/);
    expect(sujetPourTechnicien(true)).toMatch(/déplacée/);
  });
});

describe("corpsPourClient", () => {
  it("annonce une PREMIÈRE planification sans mentionner d'ancien créneau", () => {
    const corps = corpsPourClient(DETAIL, NOUVEAU, null);
    expect(corps).toContain("planifiée");
    expect(corps).toContain("14/10/2026 à 08:00");
    expect(corps).not.toMatch(/déplacée/);
  });

  it("annonce un DÉPLACEMENT avec l'ancien ET le nouveau créneau", () => {
    const corps = corpsPourClient(DETAIL, NOUVEAU, ANCIEN);
    expect(corps).toContain(
      "déplacée du 10/10/2026 à 14:00 au 14/10/2026 à 08:00",
    );
  });

  it("porte le lieu, la nature, la durée, la machine et la référence client — jamais de prix", () => {
    const corps = corpsPourClient(DETAIL, NOUVEAU, null);
    expect(corps).toContain("Atelier Ducos — Nouméa");
    expect(corps).toContain("Curatif");
    expect(corps).toContain("90 min");
    expect(corps).toContain("Compresseur Atlas Copco GA 15 (S/N SN-778241)");
    expect(corps).toContain("BC-4821");
    expect(corps).not.toMatch(/XPF|\bEUR\b|\$|€|montant|prix/i);
  });

  it("omet la ligne machine quand aucune n'est rattachée", () => {
    const sansMachine: DetailPourCourriel = { ...DETAIL, machine: null };
    const corps = corpsPourClient(sansMachine, NOUVEAU, null);
    expect(corps).not.toContain("Machine :");
  });

  it("un créneau sans heure ne porte pas de tiret orphelin", () => {
    const sansHeure: CreneauLisible = { date: "14/10/2026", heure: null };
    const corps = corpsPourClient(DETAIL, sansHeure, null);
    expect(corps).toContain("Date : 14/10/2026");
    expect(corps).not.toContain("à null");
  });
});

describe("corpsPourTechnicien", () => {
  const lien = "https://codiplan.test/terrain/abc-123";

  it("porte le lien vers la fiche terrain", () => {
    const corps = corpsPourTechnicien(DETAIL, NOUVEAU, null, lien);
    expect(corps).toContain(lien);
  });

  it("annonce une affectation, pas un déplacement, sans ancien créneau", () => {
    const corps = corpsPourTechnicien(DETAIL, NOUVEAU, null, lien);
    expect(corps).toMatch(/affectée/);
  });

  it("annonce le déplacement avec les deux créneaux, comme pour le client", () => {
    const corps = corpsPourTechnicien(DETAIL, NOUVEAU, ANCIEN, lien);
    expect(corps).toContain(
      "déplacée du 10/10/2026 à 14:00 au 14/10/2026 à 08:00",
    );
  });
});

describe("clesAvertissementCourriel — des clés, jamais du texte", () => {
  it("rend une clé par destinataire concerné, dans l'ordre client puis technicien", () => {
    const cles = clesAvertissementCourriel({
      client: { type: "parti" },
      technicien: {
        type: "non_parti",
        motif: "422 : refusé par le prestataire",
      },
    });
    expect(cles).toEqual([
      "intervention.avertissement.courriel_client_parti",
      "intervention.avertissement.courriel_technicien_non_parti",
    ]);
    // Le motif technique ne doit JAMAIS apparaître dans ce qui est rendu :
    // ce canal traverse une redirection HTTP (L1-02f, D50).
    expect(cles.join(" ")).not.toContain("422");
  });

  it("omet le bord non concerné — changement de technicien seul, client à null", () => {
    const cles = clesAvertissementCourriel({
      client: null,
      technicien: { type: "parti" },
    });
    expect(cles).toEqual([
      "intervention.avertissement.courriel_technicien_parti",
    ]);
  });

  it("distingue « sans destinataire » de « non parti »", () => {
    const cles = clesAvertissementCourriel({
      client: { type: "sans_destinataire" },
      technicien: null,
    });
    expect(cles).toEqual([
      "intervention.avertissement.courriel_client_sans_destinataire",
    ]);
  });

  it("rend un tableau vide quand aucun des deux bords n'est concerné", () => {
    expect(
      clesAvertissementCourriel({ client: null, technicien: null }),
    ).toEqual([]);
  });
});

/**
 * LE RÉCAPITULATIF D'UNE TRANSMISSION GROUPÉE (9CP-PG-G14B-TRANSMETTRE-GROUPE)
 * — « Transmettre demain »/« Transmettre toutes les planifiées prêtes »
 * envoient UN SEUL courriel par technicien, jamais un par intervention.
 */
describe("groupesParTechnicien — regroupe, puis trie CHAQUE groupe par créneau", () => {
  function ligne(
    technicienId: string,
    instant: string,
    reference: string,
  ): LigneRecapitulatif {
    return {
      technicienId,
      instant: new Date(instant),
      detail: { ...DETAIL, referenceClient: reference },
      creneau: { date: "peu importe", heure: "peu importe" },
      lien: `https://codiplan.test/terrain/${reference}`,
    };
  }

  it("3 interventions pour 2 techniciens → 2 groupes", () => {
    const groupes = groupesParTechnicien([
      ligne("tech-1", "2026-10-14T08:00:00.000Z", "A"),
      ligne("tech-2", "2026-10-14T09:00:00.000Z", "B"),
      ligne("tech-1", "2026-10-15T08:00:00.000Z", "C"),
    ]);

    expect(groupes.size).toBe(2);
    expect(groupes.get("tech-1")?.map((l) => l.detail.referenceClient)).toEqual(
      ["A", "C"],
    );
    expect(groupes.get("tech-2")?.map((l) => l.detail.referenceClient)).toEqual(
      ["B"],
    );
  });

  it("trie par INSTANT, jamais par le texte déjà composé du créneau", () => {
    // Un tri lexicographique sur une date « JJ/MM/AAAA » mettrait le
    // 03/10/2026 avant le 12/09/2027 — ce n'est pas ce qui est trié ici.
    const groupes = groupesParTechnicien([
      ligne("tech-1", "2027-09-12T08:00:00.000Z", "plus-tard"),
      ligne("tech-1", "2026-10-03T08:00:00.000Z", "plus-tot"),
    ]);

    expect(groupes.get("tech-1")?.map((l) => l.detail.referenceClient)).toEqual(
      ["plus-tot", "plus-tard"],
    );
  });

  it("rend un Map vide sur une liste vide", () => {
    expect(groupesParTechnicien([]).size).toBe(0);
  });
});

describe("sujetRecapitulatifTechnicien", () => {
  it("nomme le nombre d'interventions transmises", () => {
    expect(sujetRecapitulatifTechnicien(1)).toBe(
      "CODIPLAN — Interventions transmises (1)",
    );
    expect(sujetRecapitulatifTechnicien(3)).toBe(
      "CODIPLAN — Interventions transmises (3)",
    );
  });
});

describe("corpsRecapitulatifTechnicien", () => {
  const BLOC_1 = {
    instant: new Date("2026-10-14T08:00:00.000Z"),
    detail: DETAIL,
    creneau: NOUVEAU,
    lien: "https://codiplan.test/terrain/un",
  };
  const BLOC_2 = {
    instant: new Date("2026-10-15T08:00:00.000Z"),
    detail: { ...DETAIL, machine: null, referenceClient: null },
    creneau: ANCIEN,
    lien: "https://codiplan.test/terrain/deux",
  };

  it("un bloc par intervention, chacun avec son lien terrain, DANS L'ORDRE REÇU", () => {
    const corps = corpsRecapitulatifTechnicien([BLOC_1, BLOC_2]);
    expect(corps.indexOf("terrain/un")).toBeLessThan(
      corps.indexOf("terrain/deux"),
    );
    expect(corps).toContain("14/10/2026 à 08:00");
    expect(corps).toContain("10/10/2026 à 14:00");
  });

  it("singulier à une intervention, pluriel à plusieurs", () => {
    expect(corpsRecapitulatifTechnicien([BLOC_1])).toContain(
      "1 intervention vous est affectée :",
    );
    expect(corpsRecapitulatifTechnicien([BLOC_1, BLOC_2])).toContain(
      "2 interventions vous sont affectées :",
    );
  });

  it("aucun montant, aucune balise HTML", () => {
    const corps = corpsRecapitulatifTechnicien([BLOC_1, BLOC_2]);
    expect(corps).not.toMatch(/XPF|\bEUR\b|\$|€|montant|prix/i);
    expect(corps).not.toMatch(/<[a-z][^>]*>/i);
  });
});
