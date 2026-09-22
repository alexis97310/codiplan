import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { RACINE } from "../outils/fichiers-source";

import {
  CODE_DE_SORTIE,
  VARIABLE_CONNEXION,
  VARIABLE_FORCAGE,
  appliqueesDepuisSortieScript,
  calculerVerdict,
  publicationForcee,
} from "../../../scripts/lib/portail-publication";

/**
 * LE PORTAIL DE PUBLICATION (RELEASE-1).
 *
 * Trois gardiens distincts, chacun sur ce que le ticket nomme comme un piège
 * mesuré :
 *   1. `vercel.json` DÉCLARE le refus de construction et pointe vers le
 *      script du portail.
 *   2. Le SENS des codes de sortie Vercel est figé en dur — l'inverser fait
 *      rougir ce gardien, pas seulement une relecture.
 *   3. La traduction de la sortie de `migrations-appliquees.mts` en liste (ou
 *      `null`) ne confond jamais « rien appliqué » et « illisible ».
 */

describe("vercel.json déclare le portail de publication", () => {
  it("porte un ignoreCommand qui pointe vers scripts/portail-publication.sh", () => {
    const contenu = JSON.parse(
      readFileSync(join(RACINE, "vercel.json"), "utf8"),
    ) as { ignoreCommand?: unknown };
    expect(typeof contenu.ignoreCommand).toBe("string");
    expect(contenu.ignoreCommand).toContain("scripts/portail-publication.sh");
  });
});

describe("le sens des codes de sortie Vercel — 0 bloque, 1 publie, jamais l'inverse", () => {
  it("ÉPREUVE — les trois valeurs sont figées, indépendamment de leur source", () => {
    // Valeurs recopiées en dur ici, PAS lues via une constante partagée avec
    // le module testé : si `CODE_DE_SORTIE` était un jour inversé dans
    // `scripts/lib/portail-publication.ts`, ce test doit rougir — une
    // comparaison à une variable importée du même fichier ne le ferait pas.
    expect(CODE_DE_SORTIE.publier).toBe(1);
    expect(CODE_DE_SORTIE.bloquer).toBe(0);
    expect(CODE_DE_SORTIE.illisible).toBe(0);
  });
});

describe("la porte de secours", () => {
  it("ne force que sur la valeur exacte « oui »", () => {
    expect(publicationForcee({ [VARIABLE_FORCAGE]: "oui" })).toBe(true);
    expect(publicationForcee({ [VARIABLE_FORCAGE]: "true" })).toBe(false);
    expect(publicationForcee({ [VARIABLE_FORCAGE]: "1" })).toBe(false);
    expect(publicationForcee({})).toBe(false);
  });
});

describe("la traduction de la sortie de migrations-appliquees.mts", () => {
  it("rend la liste quand la sortie est propre", () => {
    expect(
      appliqueesDepuisSortieScript({
        codeSortie: 0,
        stdout: "a\nb\nc\n",
        stderr: "",
      }),
    ).toEqual(["a", "b", "c"]);
  });

  it("rend une liste VIDE — pas `null` — pour une base neuve sans stderr", () => {
    expect(
      appliqueesDepuisSortieScript({ codeSortie: 0, stdout: "", stderr: "" }),
    ).toEqual([]);
  });

  it("ÉPREUVE — un stderr non vide rend `null`, jamais une liste vide", () => {
    const traduit = appliqueesDepuisSortieScript({
      codeSortie: 0,
      stdout: "",
      stderr: "Lecture de _prisma_migrations impossible : ...\n",
    });
    expect(traduit).toBeNull();
  });

  it("ÉPREUVE — un code de sortie non nul rend `null`, même avec un stdout non vide", () => {
    const traduit = appliqueesDepuisSortieScript({
      codeSortie: 1,
      stdout: "a\n",
      stderr: "",
    });
    expect(traduit).toBeNull();
  });

  it("un code de sortie absent (processus non lancé) rend `null`", () => {
    expect(
      appliqueesDepuisSortieScript({
        codeSortie: null,
        stdout: "",
        stderr: "",
      }),
    ).toBeNull();
  });
});

describe("calculerVerdict — l'orchestration, sans sous-processus réel (injecté)", () => {
  it("illisible quand la variable de connexion n'est pas posée — sans même invoquer le script", () => {
    let invoque = false;
    const verdict = calculerVerdict({}, () => {
      invoque = true;
      return { codeSortie: 0, stdout: "", stderr: "" };
    });
    expect(verdict.decision).toBe("illisible");
    if (verdict.decision === "illisible") {
      expect(verdict.motif).toContain(VARIABLE_CONNEXION);
    }
    expect(invoque).toBe(false);
  });

  it("bloque en nommant la migration manquante quand la connexion est posée mais la base en retard", () => {
    const verdict = calculerVerdict(
      { [VARIABLE_CONNEXION]: "postgres://exemple" },
      () => ({ codeSortie: 0, stdout: "", stderr: "" }),
    );
    expect(verdict.decision).toBe("bloquer");
  });

  it("illisible quand le script invoqué échoue, même avec une connexion posée", () => {
    const verdict = calculerVerdict(
      { [VARIABLE_CONNEXION]: "postgres://exemple" },
      () => ({
        codeSortie: 0,
        stdout: "",
        stderr: "Can't reach database server\n",
      }),
    );
    expect(verdict.decision).toBe("illisible");
  });
});
