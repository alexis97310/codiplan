import { describe, expect, it } from "vitest";

import { AssujettissementVgp } from "@prisma/client";

import { ASSUJETTISSEMENT } from "@/lib/vgp/assujettissement";
import {
  etatDeLInformation,
  type EtatInformation,
} from "@/lib/vgp/information";
import {
  rechercheCorrespond,
  trierParUrgence,
  type LigneDeRegistre,
} from "@/lib/vgp/registre";

/**
 * VGP-4 — LE TRI PAR URGENCE, ET LA RECHERCHE, ÉPROUVÉS SANS BASE.
 *
 * L'arbitrage du 25/09/2026 retient un ORDRE plutôt qu'une fenêtre de jours
 * (« sous 30 jours » de la maquette, non repris — voir le docblock de
 * `app/(back-office)/vgp/page.tsx`) : ce fichier éprouve `trierParUrgence` et
 * `rechercheCorrespond`, les deux fonctions PURES qui portent cette décision,
 * sur des lignes déjà composées — même discipline que
 * `tests/unit/vgp/voies-a-prevoir.test.ts`.
 */

const AUJOURD_HUI = new Date("2026-09-25T00:00:00Z");

function informee(
  derniereInformation: Date,
  periodiciteMois: number | null,
): EtatInformation {
  return etatDeLInformation({
    assujettissement: ASSUJETTISSEMENT.soumis,
    periodiciteMois,
    derniereInformation,
    depuis: null,
    aujourdHui: AUJOURD_HUI,
  });
}

const SANS_INFORMATION: EtatInformation = etatDeLInformation({
  assujettissement: ASSUJETTISSEMENT.soumis,
  periodiciteMois: 12,
  derniereInformation: null,
  depuis: null,
  aujourdHui: AUJOURD_HUI,
});

const HORS_REGISTRE: EtatInformation = etatDeLInformation({
  assujettissement: ASSUJETTISSEMENT.non_soumis,
  periodiciteMois: null,
  derniereInformation: null,
  depuis: null,
  aujourdHui: AUJOURD_HUI,
});

/** Une ligne complète du registre, avec des valeurs par défaut d'épreuve. */
function ligne(
  nom: string,
  information: EtatInformation,
  champs: Partial<LigneDeRegistre> = {},
): LigneDeRegistre {
  return {
    id: nom,
    numero: null,
    numero_serie: nom,
    clientId: "client-epreuve",
    client: "Client d'épreuve",
    siteId: "site-epreuve",
    site: "Site d'épreuve",
    siteCommune: "Commune d'épreuve",
    marque: "Marque d'épreuve",
    modele: "Modèle d'épreuve",
    referenceInterne: null,
    famille: "Famille d'épreuve",
    assujettissement: AssujettissementVgp.soumis,
    origine: "famille",
    periodiciteMois: 12,
    referenceTexte: "Texte d'épreuve",
    originePeriodicite: "famille",
    information,
    ...champs,
  };
}

describe("trierParUrgence (VGP-4)", () => {
  // Vérifiée il y a près de cinq ans, périodicité douze mois : très largement
  // dépassée. Vérifiée il y a treize mois, même périodicité : dépassée d'un
  // mois seulement — moins ancienne que la première.
  const depasseeAncienne = ligne(
    "depassee-ancienne",
    informee(new Date("2021-10-01T00:00:00Z"), 12),
  );
  const depasseeRecente = ligne(
    "depassee-recente",
    informee(new Date("2025-08-20T00:00:00Z"), 12),
  );
  // Vérifiée il y a onze mois : échéance dans un mois, la plus PROCHE.
  const aVenirProche = ligne(
    "a-venir-proche",
    informee(new Date("2025-10-25T00:00:00Z"), 12),
  );
  // Vérifiée il y a un mois : échéance dans onze mois, la plus LOINTAINE.
  const aVenirLointaine = ligne(
    "a-venir-lointaine",
    informee(new Date("2026-08-25T00:00:00Z"), 12),
  );
  const sansInformationA = ligne("sans-information-a", SANS_INFORMATION);
  const sansInformationB = ligne("sans-information-b", SANS_INFORMATION);
  const horsRegistre = ligne("hors-registre", HORS_REGISTRE);

  it("TÉMOIN — les quatre lignes datées portent bien le signe attendu", () => {
    expect(
      depasseeAncienne.information.etat === "information_recue" &&
        depasseeAncienne.information.joursAvantEcheance,
    ).toBeLessThan(0);
    expect(
      depasseeRecente.information.etat === "information_recue" &&
        depasseeRecente.information.joursAvantEcheance,
    ).toBeLessThan(0);
    expect(
      aVenirProche.information.etat === "information_recue" &&
        aVenirProche.information.joursAvantEcheance,
    ).toBeGreaterThanOrEqual(0);
    expect(
      aVenirLointaine.information.etat === "information_recue" &&
        aVenirLointaine.information.joursAvantEcheance,
    ).toBeGreaterThan(
      (aVenirProche.information as { joursAvantEcheance: number })
        .joursAvantEcheance,
    );
  });

  it("PALIER 1 puis 2 : dépassées (la plus ancienne d'abord), puis à venir (la plus proche d'abord)", () => {
    const trie = trierParUrgence([
      aVenirLointaine,
      depasseeRecente,
      aVenirProche,
      depasseeAncienne,
    ]);
    expect(trie.map((l) => l.id)).toEqual([
      "depassee-ancienne",
      "depassee-recente",
      "a-venir-proche",
      "a-venir-lointaine",
    ]);
  });

  it("PALIER 3 : sans échéance déduite, toujours APRÈS les deux paliers datés", () => {
    const trie = trierParUrgence([
      horsRegistre,
      aVenirProche,
      sansInformationA,
      depasseeAncienne,
    ]);
    expect(trie.map((l) => l.id)).toEqual([
      "depassee-ancienne",
      "a-venir-proche",
      "hors-registre",
      "sans-information-a",
    ]);
  });

  it("LE PALIER 3 GARDE SON ORDRE D'ARRIVÉE (tri stable)", () => {
    const trie = trierParUrgence([
      sansInformationB,
      horsRegistre,
      sansInformationA,
    ]);
    expect(trie.map((l) => l.id)).toEqual([
      "sans-information-b",
      "hors-registre",
      "sans-information-a",
    ]);
  });

  it("une liste vide reste vide", () => {
    expect(trierParUrgence([])).toEqual([]);
  });
});

describe("rechercheCorrespond (VGP-4 ; étendue PV-37, D166)", () => {
  const machine = ligne("VGP4-SN-0001", informee(new Date("2026-01-01"), 12), {
    numero_serie: "VGP4-SN-0001",
    modele: "SPL-4000",
    marque: "Caterpillar",
    client: "CODIMA Nouvelle-Calédonie",
    famille: "Ponts élévateurs",
    site: "Atelier de Ducos",
    siteCommune: "Nouméa",
    referenceInterne: "INT-0042",
  });

  it("une recherche vide correspond à tout — l'absence de filtre, jamais un résultat vide", () => {
    expect(rechercheCorrespond(machine, "")).toBe(true);
    expect(rechercheCorrespond(machine, "   ")).toBe(true);
  });

  it("correspond par numéro de série, insensible à la casse", () => {
    expect(rechercheCorrespond(machine, "vgp4-sn-0001")).toBe(true);
    expect(rechercheCorrespond(machine, "SN-0001")).toBe(true);
  });

  it("correspond par désignation (le modèle)", () => {
    expect(rechercheCorrespond(machine, "spl-4000")).toBe(true);
  });

  it("correspond par client", () => {
    expect(rechercheCorrespond(machine, "codima")).toBe(true);
  });

  it("correspond par marque (PV-37)", () => {
    expect(rechercheCorrespond(machine, "caterpillar")).toBe(true);
  });

  it("correspond par famille (PV-37)", () => {
    expect(rechercheCorrespond(machine, "ponts élévateurs")).toBe(true);
  });

  it("correspond par site (PV-37)", () => {
    expect(rechercheCorrespond(machine, "ducos")).toBe(true);
  });

  it("correspond par commune du site (PV-37)", () => {
    expect(rechercheCorrespond(machine, "nouméa")).toBe(true);
  });

  it("correspond par référence interne (PV-37)", () => {
    expect(rechercheCorrespond(machine, "int-0042")).toBe(true);
  });

  it("une commune ou une référence interne absentes (null) ne font jamais correspondre", () => {
    const sansCommuneNiReference = ligne(
      "VGP4-SN-0002",
      informee(new Date("2026-01-01"), 12),
      { siteCommune: null, referenceInterne: null },
    );
    expect(rechercheCorrespond(sansCommuneNiReference, "nouméa")).toBe(false);
    expect(rechercheCorrespond(sansCommuneNiReference, "int-0042")).toBe(false);
  });

  it("ne correspond pas à ce qu'aucune colonne ne porte", () => {
    expect(rechercheCorrespond(machine, "introuvable")).toBe(false);
  });
});
