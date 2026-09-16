import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";
import {
  COLONNES_PARC,
  ECARTS_MAQUETTE_COLONNES_PARC,
  ECARTS_MAQUETTE_KPI_PARC,
  KPI_PARC,
} from "@/lib/machines/ecarts-maquette";

/**
 * L'ÉCRAN « PARC » DIT CE QUE LA MAQUETTE DIT, moins les écarts nommés
 * (AT-04).
 *
 * **Même discipline que `tests/unit/navigation/entrees.test.ts`**, appliquée
 * à deux populations que la barre ne couvre pas : les colonnes du tableau du
 * parc, et les KPI de son bandeau. La raison pour laquelle ce sont deux
 * `describe` plutôt qu'un seul mélangé à la barre est écrite dans
 * `lib/machines/ecarts-maquette.ts` : trois formes de DOM, trois listes.
 *
 * **Les deux sens sont gardés** : une colonne ou un KPI ajouté au code sans
 * l'être à la maquette échoue ; ajouté à la maquette sans l'être au code
 * échoue aussi.
 */

const MAQUETTE = readFileSync(
  join(process.cwd(), "docs/maquette/CODIPLAN_Maquette.html"),
  "utf8",
);

/**
 * Le bloc HTML de l'écran « parc », borné par les deux commentaires de
 * section qui l'entourent dans le document — la même sorte de repère que
 * `tests/unit/navigation/entrees.test.ts` utilise pour `.nav`, appliquée à un
 * écran entier plutôt qu'à une barre.
 */
function blocParc(): string {
  const debut = MAQUETTE.indexOf('id="parc"');
  const fin = MAQUETTE.indexOf('id="mach"');
  if (debut === -1 || fin === -1 || fin <= debut) {
    throw new Error(
      "l'écran « parc » est introuvable, ou plus borné par l'écran « mach » " +
        "qui le suit dans docs/maquette/CODIPLAN_Maquette.html — le document " +
        "a changé de forme, et ce gardien ne mesure plus rien",
    );
  }
  return MAQUETTE.slice(debut, fin);
}

/** Les huit libellés de colonne, dans l'ordre où la maquette les écrit. */
function colonnesDeLaMaquette(): string[] {
  const bloc = /<thead>([\s\S]*?)<\/thead>/.exec(blocParc());
  if (bloc === null) {
    throw new Error(
      "le `<thead>` du tableau du parc est introuvable — le document a " +
        "changé de forme, et ce gardien ne mesure plus rien",
    );
  }
  return [...bloc[1].matchAll(/<th>([^<]+)<\/th>/g)].map((m) => m[1].trim());
}

/** Les quatre libellés de KPI, dans l'ordre où la maquette les écrit. */
function kpiDeLaMaquette(): string[] {
  return [...blocParc().matchAll(/<div class="l">([^<]+)<\/div>/g)].map((m) =>
    m[1].replaceAll("&lt;", "<").trim(),
  );
}

describe("les colonnes du tableau du parc disent ce que la maquette dit", () => {
  it("a réellement lu un tableau — le témoin de non-vacuité", () => {
    // Zéro colonne lue ressemblerait trait pour trait à « les deux listes
    // s'accordent ». C'est la faute du 10/09 : deux côtés aveugles ensemble
    // s'accordent parfaitement, et la comparaison porte sur rien.
    expect(colonnesDeLaMaquette().length).toBe(8);
    expect(COLONNES_PARC.length).toBe(6);
  });

  it("les libellés et leur ordre s'accordent, des deux côtés", () => {
    const ecartees = new Set(
      ECARTS_MAQUETTE_COLONNES_PARC.map((e) => e.libelle),
    );
    const attendues = colonnesDeLaMaquette().filter(
      (libelle) => !ecartees.has(libelle),
    );
    expect(COLONNES_PARC.map((c) => c.libelle())).toEqual(attendues);
  });

  it("chaque colonne rend un libellé non vide", () => {
    // Pas de clé unique à vérifier ici : la colonne « lieu » COMPOSE son
    // libellé depuis `mot("site")`, un mot imposé (D5, D47) qu'aucune entrée
    // du dictionnaire hors de `vocabulaire.*` n'a le droit de porter — voir
    // `tests/unit/i18n/vocabulaire-impose.test.ts`.
    for (const colonne of COLONNES_PARC) {
      expect(colonne.libelle().length, colonne.id).toBeGreaterThan(0);
    }
  });

  it("les écarts sont exactement ceux qui ont été décidés — Compteur et Contrat", () => {
    expect(ECARTS_MAQUETTE_COLONNES_PARC.map((e) => e.libelle)).toEqual([
      "Compteur",
      "Contrat",
    ]);
    for (const ecart of ECARTS_MAQUETTE_COLONNES_PARC) {
      expect(ecart.motif, ecart.libelle).toBeTruthy();
    }
  });

  it("chaque écart est ADOSSÉ à un libellé que la maquette porte vraiment", () => {
    const dansLaMaquette = new Set(colonnesDeLaMaquette());
    for (const ecart of ECARTS_MAQUETTE_COLONNES_PARC) {
      expect(dansLaMaquette.has(ecart.libelle), ecart.libelle).toBe(true);
    }
  });

  it("un écart est réellement SORTI du tableau — Statut, lui, y reste", () => {
    // La paire qui doit rester verte pour sa propre raison (§9, 11/09) :
    // « Compteur » et « Contrat » sont absents ET « Statut » est présent — la
    // colonne réelle qu'un test moins soigné aurait pu confondre avec elles.
    const rendues = COLONNES_PARC.map((c) => c.libelle());
    for (const ecart of ECARTS_MAQUETTE_COLONNES_PARC) {
      expect(rendues, ecart.libelle).not.toContain(ecart.libelle);
    }
    expect(rendues).toContain(fr["parc.colonne_statut"]);
  });
});

describe("les KPI du bandeau du parc disent ce que la maquette dit", () => {
  it("a réellement lu un bandeau — le témoin de non-vacuité", () => {
    expect(kpiDeLaMaquette().length).toBe(4);
    expect(KPI_PARC.length).toBe(3);
  });

  it("les libellés et leur ordre s'accordent, des deux côtés", () => {
    const ecartes = new Set(ECARTS_MAQUETTE_KPI_PARC.map((e) => e.libelle));
    const attendus = kpiDeLaMaquette().filter(
      (libelle) => !ecartes.has(libelle),
    );
    expect(KPI_PARC.map((k) => fr[k.cle])).toEqual(attendus);
  });

  it("chaque KPI a sa clé au dictionnaire", () => {
    for (const kpi of KPI_PARC) {
      expect(Object.hasOwn(fr, kpi.cle), kpi.cle).toBe(true);
    }
  });

  it("l'écart est exactement celui qui a été décidé — Sous contrat", () => {
    expect(ECARTS_MAQUETTE_KPI_PARC.map((e) => e.libelle)).toEqual([
      "Sous contrat",
    ]);
    for (const ecart of ECARTS_MAQUETTE_KPI_PARC) {
      expect(ecart.motif, ecart.libelle).toBeTruthy();
    }
  });

  it("l'écart est ADOSSÉ à un libellé que la maquette porte vraiment", () => {
    const dansLaMaquette = new Set(kpiDeLaMaquette());
    for (const ecart of ECARTS_MAQUETTE_KPI_PARC) {
      expect(dansLaMaquette.has(ecart.libelle), ecart.libelle).toBe(true);
    }
  });

  it("l'écart est réellement SORTI du bandeau — Garantie, lui, y reste", () => {
    const rendus = KPI_PARC.map((k) => fr[k.cle]);
    for (const ecart of ECARTS_MAQUETTE_KPI_PARC) {
      expect(rendus, ecart.libelle).not.toContain(ecart.libelle);
    }
    expect(rendus).toContain(fr["parc.kpi_garantie"]);
  });
});
