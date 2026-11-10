import { describe, expect, it } from "vitest";

import { versLeReferentiel } from "@/app/api/parametres/materiel/saisie-recue";
import { paramsDeLaSuite, suiteRecue, type Suite } from "@/lib/materiel/suite";

/**
 * LA SUITE DU RÉFÉRENTIEL MATÉRIEL (9K18A-MATERIEL-RETOUR-ONGLET).
 *
 * Signalé par Alexis le 10/11/2026 : ajouter un sous-type depuis l'onglet
 * « Modèles » renvoyait systématiquement sur l'onglet « Familles », les
 * filtres perdus. Deux choses à éprouver sans base : la LECTURE d'une suite
 * depuis un formulaire (une valeur inconnue vaut le défaut, jamais un
 * refus), et la REDIRECTION qui la reporte, au succès comme au refus.
 */

function urlDeRetour(reponse: Response): URL {
  const location = reponse.headers.get("Location");
  expect(location).not.toBeNull();
  return new URL(location as string, "http://localhost");
}

const FAMILLE = "0192f0a0-0000-7000-8000-00000000f001";
const LIGNE = "0192f0a0-0000-7000-8000-00000000f002";

describe("suiteRecue", () => {
  it("un formulaire sans aucun champ `suite_*` rend le défaut — Familles, actifs", () => {
    const suite = suiteRecue(new FormData());
    expect(suite).toEqual({
      onglet: "familles",
      filtres: { q: "", etat: "actifs" },
    });
  });

  it("lit l'onglet, la recherche, l'état et la famille filtrée", () => {
    const formulaire = new FormData();
    formulaire.set("suite_onglet", "modeles");
    formulaire.set("suite_q", "ravaglioli");
    formulaire.set("suite_etat", "inactifs");
    formulaire.set("suite_famille", FAMILLE);
    expect(suiteRecue(formulaire)).toEqual({
      onglet: "modeles",
      filtres: { q: "ravaglioli", etat: "inactifs" },
      familleFiltre: FAMILLE,
    });
  });

  it("un onglet FORGÉ, hors liste close, retombe sur Familles — jamais un refus", () => {
    const formulaire = new FormData();
    formulaire.set("suite_onglet", "autre-chose");
    expect(suiteRecue(formulaire).onglet).toBe("familles");
  });

  it("un état FORGÉ retombe sur « actifs »", () => {
    const formulaire = new FormData();
    formulaire.set("suite_etat", "tout-sauf-une-valeur-close");
    expect(suiteRecue(formulaire).filtres.etat).toBe("actifs");
  });

  it("une famille filtrée qui n'est pas un UUID est absente, jamais recopiée", () => {
    const formulaire = new FormData();
    formulaire.set("suite_famille", "pas-un-uuid");
    expect(suiteRecue(formulaire).familleFiltre).toBeUndefined();
  });

  it("une recherche trop longue (> 200) est ignorée plutôt que tronquée en silence", () => {
    const formulaire = new FormData();
    formulaire.set("suite_q", "x".repeat(201));
    expect(suiteRecue(formulaire).filtres.q).toBe("");
  });
});

describe("paramsDeLaSuite", () => {
  it("Familles, actifs, sans recherche — aucun paramètre (le défaut de l'écran)", () => {
    const suite: Suite = {
      onglet: "familles",
      filtres: { q: "", etat: "actifs" },
    };
    expect(paramsDeLaSuite(suite).toString()).toBe("");
  });

  it("Modèles filtrés sur une famille, avec recherche et état — les quatre paramètres", () => {
    const suite: Suite = {
      onglet: "modeles",
      filtres: { q: "KPX", etat: "tous" },
      familleFiltre: FAMILLE,
    };
    const params = paramsDeLaSuite(suite);
    expect(params.get("onglet")).toBe("modeles");
    expect(params.get("famille")).toBe(FAMILLE);
    expect(params.get("q")).toBe("KPX");
    expect(params.get("etat")).toBe("tous");
  });
});

describe("versLeReferentiel — le cas d'Alexis (le cas d'Alexis exactement, point 4 du ticket)", () => {
  const SUITE_MODELES: Suite = {
    onglet: "modeles",
    filtres: { q: "", etat: "actifs" },
    familleFiltre: FAMILLE,
  };

  it("au SUCCÈS, revient sur Modèles filtrés et repère la ligne — jamais Familles", () => {
    const url = urlDeRetour(
      versLeReferentiel({ suite: SUITE_MODELES, ligne: LIGNE }),
    );
    expect(url.searchParams.get("onglet")).toBe("modeles");
    expect(url.searchParams.get("famille")).toBe(FAMILLE);
    expect(url.searchParams.get("ligne")).toBe(LIGNE);
    expect(url.searchParams.has("volet")).toBe(false);
  });

  it("au REFUS, revient sur Modèles filtrés, le motif visible, le volet ROUVERT", () => {
    const url = urlDeRetour(
      versLeReferentiel({
        suite: SUITE_MODELES,
        motif: "materiel.refus.saisie",
        volet: { type: "modele", id: LIGNE },
      }),
    );
    expect(url.searchParams.get("onglet")).toBe("modeles");
    expect(url.searchParams.get("famille")).toBe(FAMILLE);
    expect(url.searchParams.get("motif")).toBe("materiel.refus.saisie");
    expect(url.searchParams.get("volet")).toBe("modele");
    expect(url.searchParams.get("id")).toBe(LIGNE);
  });

  it("une création refusée rouvre le volet SANS id — rien à éditer encore", () => {
    const url = urlDeRetour(
      versLeReferentiel({
        suite: SUITE_MODELES,
        motif: "materiel.refus.saisie",
        volet: { type: "modele" },
      }),
    );
    expect(url.searchParams.get("volet")).toBe("modele");
    expect(url.searchParams.has("id")).toBe(false);
  });

  it("l'onglet Familles, le défaut, ne pose aucun paramètre d'onglet", () => {
    const url = urlDeRetour(
      versLeReferentiel({
        suite: { onglet: "familles", filtres: { q: "", etat: "actifs" } },
      }),
    );
    expect(url.pathname).toBe("/parametres/materiel");
    expect(url.search).toBe("");
  });
});
