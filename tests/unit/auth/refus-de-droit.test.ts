import { describe, expect, it } from "vitest";

import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";

/**
 * D-12 / 9BP-TP-A4a-MESSAGES, 9BR-TP-A4b-MESSAGES — LE REFUS DE DROIT NE
 * RETOMBE PLUS SUR L'ANCIEN MESSAGE.
 *
 * Décision d'Alexis (29/09/2026, ~07h10 NC) : un refus de DROIT nomme son
 * motif (`auth.refus_droit`) plutôt que de repartir sur `"auth.refus"`, la
 * chaîne de l'échec de connexion. A4a a converti 56 routes ; les sept routes
 * de CRÉATION qui restaient sciemment sur `"auth.refus"` — `RESTENT_A4B` —
 * sont converties par ce lot (A4b), qui y change aussi le retour de saisie
 * (voir `docs/propositions/9BR-TP-A4b-MESSAGES/`). `RESTENT_A4B` est
 * maintenant VIDE : les deux épreuves qui la lisaient testaient une liste
 * vide et n'auraient plus rien protégé — retirées plutôt que gardées
 * vacantes.
 */

// ── AUCUNE ROUTE NE RESTE SUR L'ANCIEN MESSAGE (A4a ET A4b converties) ─────

const RESTENT_A4B: readonly string[] = [];

const ROUTES = fichiersSource(["app/api"])
  .filter((f) => f.chemin.endsWith("/route.ts"))
  .map((f) => ({ ...f, contenu: sansCommentaires(f.contenu) }));

const RESTE_A4B = new Set(RESTENT_A4B);

const contientAncienRefus = (contenu: string): boolean =>
  /"auth\.refus"/.test(contenu);

describe("9BP-TP-A4a-MESSAGES / 9BR-TP-A4b-MESSAGES — le refus de droit ne dit plus « auth.refus »", () => {
  it("TÉMOIN — la population n'est pas vide, et elle vient du disque", () => {
    expect(ROUTES.length).toBeGreaterThan(45);
  });

  it("aucune route hors app/api/session/** ne contient plus « auth.refus »", () => {
    const fautives = ROUTES.filter(
      (r) =>
        !r.chemin.startsWith("app/api/session/") &&
        !RESTE_A4B.has(r.chemin) &&
        contientAncienRefus(r.contenu),
    ).map((r) => r.chemin);

    expect(
      fautives,
      'une route métier rend encore "auth.refus" sur un refus de droit : ' +
        "elle doit appeler motifDuRefus().",
    ).toEqual([]);
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
