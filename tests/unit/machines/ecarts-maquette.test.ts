import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ECARTS_MAQUETTE_ACTIONS_PARC,
  ECARTS_MAQUETTE_APERCU_PARC,
  ECARTS_MAQUETTE_CONTENU_APERCU_PARC,
  ECARTS_MAQUETTE_CONTENU_FICHE,
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

/** `machinePage()`, qui dessine le `dl.kv` de la fiche — bornée par `vgp()`. */
function fonctionMachinePage(): string {
  const debut = MAQUETTE.indexOf("function machinePage(");
  const fin = MAQUETTE.indexOf("function vgp(){");
  if (debut === -1 || fin === -1 || fin <= debut) {
    throw new Error(
      "la fonction `machinePage()` est introuvable, ou plus bornée par " +
        "`vgp()` qui la suit — le document a changé de forme, et ce gardien " +
        "ne mesure plus rien",
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

/** Les libellés `<dt>` du `dl.kv` de la fiche machine. */
function champsDuKvFiche(): string[] {
  return [...fonctionMachinePage().matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) =>
    m[1].trim(),
  );
}

describe("les actions du bandeau du parc disent ce que la maquette dit (N-10, D125)", () => {
  it("a réellement lu deux actions — le témoin de non-vacuité", () => {
    expect(actionsDeLaMaquette()).toEqual(["Scanner un QR code", "+ Machine"]);
  });

  it("une seule reste l'écart décidé — « + Machine » est un GAP COMBLÉ (AT-07 bis)", () => {
    expect(ECARTS_MAQUETTE_ACTIONS_PARC.map((e) => e.libelle)).toEqual([
      "Scanner un QR code",
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

  it("« + Machine » n'est plus ABSENTE de l'écart SANS être un lien réel — elle mène à /parc/nouvelle", () => {
    // Le témoin inverse de « aucune action non couverte » : depuis que
    // `parc/nouvelle` existe, « + Machine » n'a plus besoin d'un écart pour
    // ne pas se lire comme une panne — elle est retirée de la liste ET
    // rendue comme un vrai lien (`app/(back-office)/parc/page.tsx`,
    // `LienPrimaire href="/parc/nouvelle"`), jamais l'un sans l'autre.
    const source = readFileSync(
      join(process.cwd(), "app/(back-office)/parc/page.tsx"),
      "utf8",
    );
    expect(source).toContain("/parc/nouvelle");
    const ecartees = new Set(
      ECARTS_MAQUETTE_ACTIONS_PARC.map((e) => e.libelle),
    );
    expect(ecartees.has("+ Machine")).toBe(false);

    // « aucune action non couverte » vaut toujours, à condition d'élargir la
    // couverture au lien réel — sans quoi la suppression de l'écart, seule,
    // ferait rougir ce gardien pour la mauvaise raison.
    const nonCouvertes = actionsDeLaMaquette().filter(
      (libelle) => libelle !== "+ Machine" && !ecartees.has(libelle),
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

describe("« Agence CODIMA » est un écart de CONTENU, jamais d'absence (TP-A5, PV-02, D128 cas 1)", () => {
  // PV-02 : le nom de la société pilote ne s'écrit plus en dur dans le
  // libellé du champ (`dt`), qui devient `mot("agence")` seul — « Agence ».
  // Le CHAMP reste, avec son fait réel ; c'est son LIBELLÉ qui diverge de la
  // maquette, jamais son absence. C'est pourquoi cet écart vit dans une
  // liste séparée de ECARTS_MAQUETTE_APERCU_PARC (l'absence de « Contrat »)
  // et de ECARTS_MAQUETTE_CONTENU_FICHE (même raison, côté fiche).

  it("l'aperçu porte l'écart, adossé à un <dt> réel de machinePreview()", () => {
    expect(ECARTS_MAQUETTE_CONTENU_APERCU_PARC.map((e) => e.libelle)).toEqual([
      "Agence CODIMA",
    ]);
    for (const ecart of ECARTS_MAQUETTE_CONTENU_APERCU_PARC) {
      expect(ecart.motif, ecart.libelle).toBeTruthy();
    }
    expect(champsDuKv()).toContain("Agence CODIMA");
  });

  it("la fiche porte la même entrée, adossée à un <dt> réel de machinePage()", () => {
    const libelles = ECARTS_MAQUETTE_CONTENU_FICHE.map((e) => e.libelle);
    expect(libelles).toContain("Agence CODIMA");
    for (const ecart of ECARTS_MAQUETTE_CONTENU_FICHE) {
      expect(ecart.motif, ecart.libelle).toBeTruthy();
    }
    expect(champsDuKvFiche()).toContain("Agence CODIMA");
  });

  it("l'écran ne compose plus « Agence CODIMA » en dur — le suffixe a disparu des deux pages", () => {
    const parc = readFileSync(
      join(process.cwd(), "app/(back-office)/parc/page.tsx"),
      "utf8",
    );
    const fiche = readFileSync(
      join(process.cwd(), "app/(back-office)/parc/[id]/page.tsx"),
      "utf8",
    );
    expect(parc).not.toContain("kv_agence_suffixe");
    expect(fiche).not.toContain("kv_agence_suffixe");
  });
});
