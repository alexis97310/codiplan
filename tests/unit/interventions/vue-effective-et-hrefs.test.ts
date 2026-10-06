import { describe, expect, it } from "vitest";

import {
  hrefDensite,
  hrefEffacerLesFiltres,
  hrefOnglet,
  puceFiltresActifs,
  vueEffectiveDuRegistre,
} from "@/app/(back-office)/interventions/presentation";
import { schemaRechercheInterventions } from "@/lib/interventions/saisie";

/**
 * L'ONGLET EFFECTIF, ET LES URLS QU'IL COMPOSE (TP-UX3-1-REGISTRE-1, décision
 * 13 d'Alexis du 05/10/2026) — `schemaRechercheInterventions` ne peut pas
 * distinguer « absent » de « `vue=toutes` » (les deux retombent à `null`),
 * c'est `vueEffectiveDuRegistre` qui tranche, UNE SEULE FOIS, pour que la
 * page, les onglets et tous les liens qu'elle compose s'accordent.
 */
describe("vueEffectiveDuRegistre — décision 13 d'Alexis (05/10/2026)", () => {
  it("adresse nue (vue absent) : « a_planifier », l'onglet par défaut de la maquette", () => {
    expect(vueEffectiveDuRegistre(undefined, null)).toBe("a_planifier");
  });

  it("`vue=toutes` explicite : « toutes »", () => {
    expect(vueEffectiveDuRegistre("toutes", null)).toBe("toutes");
  });

  it("une valeur INCONNUE (favori périmé) : « a_planifier », jamais une erreur", () => {
    expect(vueEffectiveDuRegistre("n-importe-quoi", null)).toBe("a_planifier");
  });

  it("une vue VALIDE (déjà analysée) prime sur le brut — jamais ignorée", () => {
    expect(vueEffectiveDuRegistre("peu-importe", "en_cours")).toBe("en_cours");
  });

  it("tableau de paramètres (plusieurs `vue=`) — lit le premier", () => {
    expect(vueEffectiveDuRegistre(["toutes", "en_cours"], null)).toBe("toutes");
  });
});

describe("hrefOnglet — « Toutes » pose `?vue=toutes` en toutes lettres", () => {
  it("vue=null (« Toutes ») → `vue=toutes` explicite, jamais une adresse nue", () => {
    const href = hrefOnglet({}, null);
    expect(href).toContain("vue=toutes");
  });

  it("une vue nommée → son propre paramètre, les autres filtres actifs gardés", () => {
    const href = hrefOnglet({ q: "REG1-" }, "en_cours");
    expect(href).toContain("vue=en_cours");
    expect(href).toContain("q=REG1-");
  });

  it("change toujours la page à 1 — changer d'onglet est une nouvelle recherche", () => {
    expect(hrefOnglet({}, "bloquees")).toContain("page=1");
  });
});

describe("hrefDensite — garde les autres paramètres, bascule `densite` seule", () => {
  it("« confort » retire `densite` de l'URL (son état par défaut)", () => {
    const href = hrefDensite({ vue: "toutes", q: "x" }, 2, "confort");
    expect(href).not.toContain("densite");
    expect(href).toContain("vue=toutes");
    expect(href).toContain("q=x");
    expect(href).toContain("page=2");
  });

  it("« compact » pose `densite=compact`, la page courante préservée", () => {
    const href = hrefDensite({ vue: "toutes" }, 3, "compact");
    expect(href).toContain("densite=compact");
    expect(href).toContain("page=3");
  });
});

describe("hrefEffacerLesFiltres — garde `vue` ET `densite`, retire tout le reste", () => {
  it("retire q/technicien/etc., garde vue et densite", () => {
    const href = hrefEffacerLesFiltres({
      vue: "en_cours",
      densite: "compact",
      q: "REG1-",
      technicien: "aucun",
    });
    expect(href).toContain("vue=en_cours");
    expect(href).toContain("densite=compact");
    expect(href).not.toContain("q=");
    expect(href).not.toContain("technicien=");
  });
});

describe("puceFiltresActifs — la priorité, et le suivi fusionné avec sans_duree_a_venir", () => {
  it("une priorité active pose une puce « Priorité : P1 — critique »", () => {
    const criteres = schemaRechercheInterventions.parse({ priorite: "p1" });
    const puces = puceFiltresActifs(criteres, { priorite: "p1" }, [], () => ({
      etat: "nom",
      nom: "x",
    }));
    const puce = puces.find((p) => p.cle === "priorite");
    expect(puce).toBeDefined();
    expect(puce!.libelle).toContain("P1");
  });

  it("`suivi=sans_duree_a_venir` pose la MÊME puce que `sans_duree_a_venir=1`, et la retire des DEUX côtés", () => {
    const criteres = schemaRechercheInterventions.parse({
      suivi: "sans_duree_a_venir",
    });
    const puces = puceFiltresActifs(
      criteres,
      { suivi: "sans_duree_a_venir" },
      [],
      () => ({ etat: "nom", nom: "x" }),
    );
    const puce = puces.find((p) => p.cle === "sans_duree_a_venir");
    expect(puce).toBeDefined();
    expect(puce!.href).not.toContain("suivi=sans_duree_a_venir");
    expect(puce!.href).not.toContain("sans_duree_a_venir=1");
  });

  it("aucun des deux paramètres de suivi actif : aucune puce « sans_duree_a_venir »", () => {
    const criteres = schemaRechercheInterventions.parse({});
    const puces = puceFiltresActifs(criteres, {}, [], () => ({
      etat: "nom",
      nom: "x",
    }));
    expect(puces.some((p) => p.cle === "sans_duree_a_venir")).toBe(false);
  });
});
