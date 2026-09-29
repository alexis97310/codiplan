import { describe, expect, it } from "vitest";

import { fichiersSource } from "../outils/fichiers-source";

/**
 * D-12 / 9BP-TP-A4a-MESSAGES — LE REFUS DE DROIT NE RETOMBE PAS SUR
 * L'ANCIEN MESSAGE, SAUF LÀ OÙ IL LE DOIT ENCORE.
 *
 * Décision d'Alexis (29/09/2026, ~07h10 NC) : un refus de DROIT nomme son
 * motif (`auth.refus_droit`) plutôt que de repartir sur `"auth.refus"`, la
 * chaîne de l'échec de connexion. Ce lot (A4a) convertit 56 routes ; sept
 * routes de CRÉATION restent sciemment sur `"auth.refus"` — leur conversion
 * appartient au corps suivant (A4b), qui y change aussi le retour de saisie.
 *
 * La liste ci-dessous est fermée dans les DEUX sens, comme
 * `tests/unit/auth/porte.test.ts` : une route qui a retrouvé sa conversion
 * doit sortir de la liste, sous peine de protéger un fantôme.
 */

// ── LES SEPT ROUTES QUI RESTENT SUR L'ANCIEN MESSAGE (A4b les convertit) ───

const RESTENT_A4B: readonly string[] = [
  "app/api/clients/creer/route.ts",
  "app/api/sites/creer/route.ts",
  "app/api/contacts/creer/route.ts",
  "app/api/parametres/agences/creer/route.ts",
  "app/api/parametres/forfaits/creer/route.ts",
  "app/api/vgp/enregistrer/[id]/route.ts",
  "app/api/interventions/creer/route.ts",
];

const sansCommentaires = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "\n")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const ROUTES = fichiersSource(["app/api"])
  .filter((f) => f.chemin.endsWith("/route.ts"))
  .map((f) => ({ ...f, contenu: sansCommentaires(f.contenu) }));

const CHEMINS_EXISTANTS = new Set(ROUTES.map((r) => r.chemin));

const RESTE_A4B = new Set(RESTENT_A4B);

const contientAncienRefus = (contenu: string): boolean =>
  /"auth\.refus"/.test(contenu);

describe("9BP-TP-A4a-MESSAGES — le refus de droit ne dit plus « auth.refus »", () => {
  it("TÉMOIN — la population n'est pas vide, et elle vient du disque", () => {
    expect(ROUTES.length).toBeGreaterThan(45);
  });

  it("aucune route hors app/api/session/** et hors RESTENT_A4B ne contient plus « auth.refus »", () => {
    const fautives = ROUTES.filter(
      (r) =>
        !r.chemin.startsWith("app/api/session/") &&
        !RESTE_A4B.has(r.chemin) &&
        contientAncienRefus(r.contenu),
    ).map((r) => r.chemin);

    expect(
      fautives,
      'une route métier rend encore "auth.refus" sur un refus de droit : ' +
        "elle doit appeler motifDuRefus(), ou entrer dans RESTENT_A4B avec " +
        "son motif si sa conversion appartient à A4b.",
    ).toEqual([]);
  });

  it("les sept routes de RESTENT_A4B contiennent ENCORE « auth.refus » — fermé dans les deux sens", () => {
    const revenues = RESTENT_A4B.filter((chemin) => {
      const route = ROUTES.find((r) => r.chemin === chemin);
      return route !== undefined && !contientAncienRefus(route.contenu);
    });

    expect(
      revenues,
      "une route de RESTENT_A4B a déjà été convertie : elle doit sortir de " +
        "cette liste, qui ne protège plus rien pour elle.",
    ).toEqual([]);
  });

  it("aucune entrée de RESTENT_A4B ne nomme une route disparue", () => {
    const fantomes = RESTENT_A4B.filter(
      (chemin) => !CHEMINS_EXISTANTS.has(chemin),
    );
    expect(fantomes).toEqual([]);
  });

  it("les quatre routes de app/api/session/** gardent « auth.refus » (D35, hors territoire)", () => {
    const session = ROUTES.filter((r) =>
      r.chemin.startsWith("app/api/session/"),
    ).filter((r) => contientAncienRefus(r.contenu));
    expect(session.length).toBeGreaterThanOrEqual(4);
  });

  it("le gardien détecte réellement la chaîne — contre-épreuve", () => {
    expect(contientAncienRefus('return vers("auth.refus");')).toBe(true);
    expect(contientAncienRefus("return vers(await motifDuRefus());")).toBe(
      false,
    );
  });
});
