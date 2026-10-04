import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RetourParametres } from "@/components/navigation/retour-parametres";
import { fr } from "@/lib/i18n/fr";
import { PORTES_PARAMETRAGE } from "@/lib/navigation/portes-parametrage";

/**
 * LE RETOUR VERS « Paramètres » DEPUIS SES SOUS-PAGES (CG1, audit du
 * 26/09/2026, constat C-G2 ; renommé QT-21, D167, 05/10/2026, TP-NAV1).
 *
 * La population de la seconde épreuve se DÉDUIT de `PORTES_PARAMETRAGE` —
 * jamais une liste de fichiers écrite à la main, qui divergerait en silence
 * le jour où une dixième porte naît. Elle ne retient que les chemins
 * `/parametres/*` : `/sites`, `/clients` et `/imports` ont leur propre
 * section ou leur propre menu (hors `/parametres/*`).
 *
 * **HUIT, pas neuf, depuis QT-22** : `/parametres/societe` (Charte) a quitté
 * `PORTES_PARAMETRAGE` — la page existe encore, en redirection seule, mais
 * elle n'est plus une sous-page de paramétrage à qui ce retour s'adresse.
 */

describe("RetourParametres", () => {
  it("rend un lien vers /parametres portant le libellé du dictionnaire", () => {
    render(<RetourParametres />);
    const lien = screen.getByRole("link", { name: fr["parametres.retour"] });
    expect(lien).toHaveAttribute("href", "/parametres");
  });
});

describe("les neuf sous-pages de paramétrage portent le retour", () => {
  const cheminsDeParametrage = PORTES_PARAMETRAGE.filter((porte) =>
    porte.chemin.startsWith("/parametres/"),
  ).map((porte) => porte.chemin);

  it("en dénombre au moins huit", () => {
    expect(cheminsDeParametrage.length).toBeGreaterThanOrEqual(8);
  });

  for (const chemin of cheminsDeParametrage) {
    it(`${chemin} contient <RetourParametres`, () => {
      const contenu = readFileSync(
        join(process.cwd(), "app/(back-office)", chemin, "page.tsx"),
        "utf-8",
      );
      expect(contenu).toContain("<RetourParametres");
    });
  }
});
