import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ECARTS_MAQUETTE_ACTIONS_PARC,
  ECARTS_MAQUETTE_APERCU_PARC,
} from "@/lib/machines/ecarts-maquette";

/**
 * L'ÉCRAN « PARC » DIT CE QUE LA MAQUETTE DIT, moins les écarts nommés
 * (AT-04 ; réécrit N-10, D125 — voir la note de tête de `ecarts-maquette.ts`
 * pour ce que cette réécriture rend caduc et pourquoi).
 *
 * **Les deux sens sont gardés** : une action ou un champ de `dl.kv` ajouté au
 * code sans l'être à la maquette échoue ; ajouté à la maquette sans l'être au
 * code échoue aussi — chacun sur SA population, jamais mélangé à l'autre.
 */

const MAQUETTE = readFileSync(
  join(process.cwd(), "docs/maquette/codiplan-maquette-complete.html"),
  "utf8",
);

/** Le corps de `parc()`, même repère que `composition-parc.test.ts`. */
function fonctionParc(): string {
  const debut = MAQUETTE.indexOf("function parc(){");
  const fin = MAQUETTE.indexOf("function machineRow(");
  if (debut === -1 || fin === -1 || fin <= debut) {
    throw new Error(
      "la fonction `parc()` est introuvable, ou plus bornée par " +
        "`machineRow()` — le document a changé de forme, et ce gardien ne " +
        "mesure plus rien",
    );
  }
  return MAQUETTE.slice(debut, fin);
}

/** `machinePreview()`, qui dessine le `dl.kv` de l'aperçu. */
function fonctionMachinePreview(): string {
  const debut = MAQUETTE.indexOf("function machinePreview(");
  const fin = MAQUETTE.indexOf("function machinePage(");
  if (debut === -1 || fin === -1 || fin <= debut) {
    throw new Error(
      "la fonction `machinePreview()` est introuvable, ou plus bornée par " +
        "`machinePage()` — le document a changé de forme, et ce gardien ne " +
        "mesure plus rien",
    );
  }
  return MAQUETTE.slice(debut, fin);
}

/** Les libellés des `<button>` posés par `head()` dans `parc()`. */
function actionsDeLaMaquette(): string[] {
  return [...fonctionParc().matchAll(/<button[^>]*>([^<]+)<\/button>/g)]
    .map((m) => m[1].trim())
    .filter((libelle) => libelle !== "Réinitialiser");
}

/** Les libellés `<dt>` du `dl.kv` de l'aperçu. */
function champsDuKv(): string[] {
  return [...fonctionMachinePreview().matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) =>
    m[1].trim(),
  );
}

describe("les actions du bandeau du parc disent ce que la maquette dit (N-10, D125)", () => {
  it("a réellement lu deux actions — le témoin de non-vacuité", () => {
    expect(actionsDeLaMaquette()).toEqual(["Scanner un QR code", "+ Machine"]);
  });

  it("les deux sont exactement l'écart décidé", () => {
    expect(ECARTS_MAQUETTE_ACTIONS_PARC.map((e) => e.libelle)).toEqual([
      "Scanner un QR code",
      "+ Machine",
    ]);
    for (const ecart of ECARTS_MAQUETTE_ACTIONS_PARC) {
      expect(ecart.motif, ecart.libelle).toBeTruthy();
    }
  });

  it("chaque écart est ADOSSÉ à un libellé que la maquette porte vraiment", () => {
    const dansLaMaquette = new Set(actionsDeLaMaquette());
    for (const ecart of ECARTS_MAQUETTE_ACTIONS_PARC) {
      expect(dansLaMaquette.has(ecart.libelle), ecart.libelle).toBe(true);
    }
  });

  it("aucune action de la maquette n'est ABSENTE de l'écart — les deux sont couvertes", () => {
    const ecartees = new Set(
      ECARTS_MAQUETTE_ACTIONS_PARC.map((e) => e.libelle),
    );
    const nonCouvertes = actionsDeLaMaquette().filter(
      (libelle) => !ecartees.has(libelle),
    );
    expect(nonCouvertes).toEqual([]);
  });
});

describe("le dl.kv de l'aperçu du parc dit ce que la maquette dit (N-10, D125)", () => {
  it("a réellement lu six champs — le témoin de non-vacuité", () => {
    expect(champsDuKv()).toEqual([
      "Client",
      "Site",
      "N° de série",
      "Famille",
      "Agence CODIMA",
      "Contrat",
    ]);
  });

  it("l'écart est exactement celui qui a été décidé — Contrat", () => {
    expect(ECARTS_MAQUETTE_APERCU_PARC.map((e) => e.libelle)).toEqual([
      "Contrat",
    ]);
    for (const ecart of ECARTS_MAQUETTE_APERCU_PARC) {
      expect(ecart.motif, ecart.libelle).toBeTruthy();
    }
  });

  it("l'écart est ADOSSÉ à un champ que la maquette porte vraiment", () => {
    const dansLaMaquette = new Set(champsDuKv());
    for (const ecart of ECARTS_MAQUETTE_APERCU_PARC) {
      expect(dansLaMaquette.has(ecart.libelle), ecart.libelle).toBe(true);
    }
  });

  it("les cinq autres champs restent réels, et Contrat n'en fait plus partie", () => {
    // La paire qui doit rester verte pour sa propre raison (§9, 11/09) : les
    // cinq champs réels distinguent ce gardien d'un accord vide.
    const reels = champsDuKv().filter((libelle) => libelle !== "Contrat");
    expect(reels).toEqual([
      "Client",
      "Site",
      "N° de série",
      "Famille",
      "Agence CODIMA",
    ]);
  });
});
