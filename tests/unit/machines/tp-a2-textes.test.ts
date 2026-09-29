import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { estCleTraduction, fr, t } from "@/lib/i18n/fr";
import { ECARTS_MAQUETTE_CONTENU_FICHE } from "@/lib/machines/ecarts-maquette";

/**
 * TP-A2 (29/09/2026), audit du 28/09 (PV-22, PV-25) — deux textes de la fiche
 * machine retirés sans changement de règle de gestion : la ligne sous le QR
 * (« Le scan ouvre directement la fiche autorisée. », « CODIPLAN: ») décrivait
 * un chemin qui n'existe pas (L3-11), et le sous-titre de « Corriger la
 * fiche » ne citait aucun geste qui existe ailleurs dans le dépôt (PV-25).
 */

describe("TP-A2 — machine.modifier.sous_titre et machine.qr.jeton_prefixe n'existent plus", () => {
  it("les deux clés sont absentes du dictionnaire (modèle GR16)", () => {
    expect(estCleTraduction("machine.modifier.sous_titre")).toBe(false);
    expect(Object.keys(fr)).not.toContain("machine.modifier.sous_titre");
    expect(estCleTraduction("machine.qr.jeton_prefixe")).toBe(false);
    expect(Object.keys(fr)).not.toContain("machine.qr.jeton_prefixe");
  });
});

describe("TP-A2 — machine.qr.description ne décrit plus un scan qui n'existe pas", () => {
  it("ne contient plus « Le scan ouvre »", () => {
    expect(t("machine.qr.description")).not.toContain("Le scan ouvre");
  });
});

describe("TP-A2 — le formulaire de correction ne porte plus de sous-titre", () => {
  it("la source de parc/[id]/modifier/page.tsx ne pose plus `sousTitre=`", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(back-office)/parc/[id]/modifier/page.tsx"),
      "utf8",
    );
    expect(source).not.toContain("sousTitre=");
  });
});

describe("TP-A2 — les deux écarts ajoutés à ECARTS_MAQUETTE_CONTENU_FICHE sont ADOSSÉS à machinePage()", () => {
  const MAQUETTE = readFileSync(
    join(process.cwd(), "docs/maquette/codiplan-maquette-complete.html"),
    "utf8",
  );

  /** Le corps de `machinePage()`, même repère que `composition-fiche.test.ts`. */
  function fonctionMachinePage(): string {
    const debut = MAQUETTE.indexOf("function machinePage(");
    const fin = MAQUETTE.indexOf("function vgp(){");
    if (debut === -1 || fin === -1 || fin <= debut) {
      throw new Error(
        "la fonction `machinePage()` est introuvable, ou plus bornée par " +
          "`vgp()` qui la suit — le document a changé de forme, et ce " +
          "gardien ne mesure plus rien",
      );
    }
    return MAQUETTE.slice(debut, fin);
  }

  const NOUVEAUX_ECARTS = [
    "Le scan ouvre directement la fiche autorisée.",
    "CODIPLAN:",
  ];

  it("les deux libellés sont bien dans la liste (témoin de non-vacuité)", () => {
    const libelles = ECARTS_MAQUETTE_CONTENU_FICHE.map((e) => e.libelle);
    for (const libelle of NOUVEAUX_ECARTS) {
      expect(libelles).toContain(libelle);
    }
  });

  it("chaque libellé existe réellement dans machinePage()", () => {
    const bloc = fonctionMachinePage();
    for (const libelle of NOUVEAUX_ECARTS) {
      expect(bloc, libelle).toContain(libelle);
    }
  });
});
