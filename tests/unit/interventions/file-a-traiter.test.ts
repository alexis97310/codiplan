import { describe, expect, it } from "vitest";

import {
  ancienneteEnJours,
  ongletFileDepuisParametre,
  parZone,
  zoneFileDepuisParametre,
} from "@/lib/interventions/affichage";

/**
 * LES FONCTIONS PURES DE LA COLONNE « À TRAITER » (PG-C2-FILE-ONGLETS, MO-18).
 *
 * Trois choses, jamais lues ailleurs qu'ici sous cette forme : l'onglet et la
 * zone se LISENT depuis un paramètre d'URL sans jamais faire échouer la page
 * (L1-02f) ; le filtre « Zone » PARTITIONNE (une intervention sans zone ne
 * rejoint aucune zone précise) ; l'ancienneté se compte en JOURS CIVILS, sous
 * le fuseau donné, jamais celui de l'appareil.
 */

describe("ongletFileDepuisParametre", () => {
  it("reconnaît les trois onglets non-défaut", () => {
    expect(ongletFileDepuisParametre("en_retard")).toBe("en_retard");
    expect(ongletFileDepuisParametre("sans_duree")).toBe("sans_duree");
    expect(ongletFileDepuisParametre("suspendues")).toBe("suspendues");
  });

  it("retombe sur « a_planifier » — absent, inconnu, ou tableau (paramètre répété)", () => {
    expect(ongletFileDepuisParametre(undefined)).toBe("a_planifier");
    expect(ongletFileDepuisParametre("autre-chose")).toBe("a_planifier");
    expect(ongletFileDepuisParametre(["en_retard", "suspendues"])).toBe(
      "a_planifier",
    );
  });
});

describe("zoneFileDepuisParametre", () => {
  it("reconnaît une zone de la liste D23", () => {
    expect(zoneFileDepuisParametre("nord")).toBe("nord");
  });

  it("ignore une valeur hors liste — absente, inconnue, ou tableau", () => {
    expect(zoneFileDepuisParametre(undefined)).toBeNull();
    expect(zoneFileDepuisParametre("koumac")).toBeNull();
    expect(zoneFileDepuisParametre(["nord", "sud"])).toBeNull();
  });
});

describe("parZone", () => {
  const ligne = (id: string, zone: string | null) => ({
    id,
    site: { zone_geo: zone },
  });

  it("« Toutes les zones » (null) rend les lignes inchangées", () => {
    const lignes = [ligne("a", "nord"), ligne("b", null)];
    expect(parZone(lignes, null)).toEqual(lignes);
  });

  it("une zone choisie ne garde que les sites de cette zone", () => {
    const nord = ligne("a", "nord");
    const sud = ligne("b", "sud");
    expect(parZone([nord, sud], "nord")).toEqual([nord]);
  });

  it("un site SANS zone n'apparaît sous AUCUNE zone précise", () => {
    const sansZone = ligne("a", null);
    expect(parZone([sansZone], "nord")).toEqual([]);
    // Témoin : elle revient bien sous « Toutes les zones ».
    expect(parZone([sansZone], null)).toEqual([sansZone]);
  });
});

describe("ancienneteEnJours", () => {
  const FUSEAU = "Pacific/Noumea";

  it("une carte créée AUJOURD'HUI a zéro jour d'ancienneté", () => {
    const aujourdhui = { annee: 2026, mois: 9, jour: 29 };
    // 29/09/2026 08:00 UTC+11 == 28/09/2026 21:00 UTC.
    const creeLe = new Date("2026-09-28T21:00:00.000Z");
    expect(ancienneteEnJours(creeLe, FUSEAU, aujourdhui)).toBe(0);
  });

  it("compte des JOURS CIVILS, jamais des heures arrondies", () => {
    const aujourdhui = { annee: 2026, mois: 9, jour: 29 };
    // Créée le 24/09 à 23h50 locales : cinq jours civils avant le 29/09, pas
    // « quatre jours et quelques heures ».
    const creeLe = new Date("2026-09-24T12:50:00.000Z");
    expect(ancienneteEnJours(creeLe, FUSEAU, aujourdhui)).toBe(5);
  });
});
