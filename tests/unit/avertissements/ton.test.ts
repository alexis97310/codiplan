import { describe, expect, it } from "vitest";

import { tonDeLAvertissement } from "@/lib/avertissements/ton";
import type { CleTraduction } from "@/lib/i18n/fr";

/**
 * GR17-M13 — LE TON D'UN AVERTISSEMENT DE PLANIFICATION.
 *
 * Les huit clés `intervention.avertissement.*` du dictionnaire (fr.ts) :
 * seules les trois `_parti` (jamais `_non_parti`) rendent « succès ».
 */
const CLES: readonly CleTraduction[] = [
  "intervention.avertissement.habilitation",
  "intervention.avertissement.courriel_client_parti",
  "intervention.avertissement.courriel_client_non_parti",
  "intervention.avertissement.courriel_client_sans_destinataire",
  "intervention.avertissement.courriel_technicien_parti",
  "intervention.avertissement.courriel_technicien_non_parti",
  "intervention.avertissement.courriel_ancien_technicien_parti",
  "intervention.avertissement.courriel_ancien_technicien_non_parti",
];

const SUCCES: readonly CleTraduction[] = [
  "intervention.avertissement.courriel_client_parti",
  "intervention.avertissement.courriel_technicien_parti",
  "intervention.avertissement.courriel_ancien_technicien_parti",
];

describe("tonDeLAvertissement", () => {
  for (const cle of CLES) {
    const attendu = SUCCES.includes(cle) ? "succes" : "avertissement";
    it(`${cle} → ${attendu}`, () => {
      expect(tonDeLAvertissement(cle)).toBe(attendu);
    });
  }
});
