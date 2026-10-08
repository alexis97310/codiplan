import { render } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it } from "vitest";

import { EnTeteFiche, type FaitFiche } from "@/components/ui/entete-fiche";
import { fr } from "@/lib/i18n/fr";

/**
 * LA LIGNE DE FAITS DE L'EN-TÊTE (9EE-TP-UX4-1-FICHE-INTERVENTION-1) — une
 * icône, un petit libellé, une valeur ; en `<dt>`/`<dd>`, pour que les
 * épreuves de bout en bout qui cherchaient déjà un `<dt>` continuent de le
 * trouver, quel que soit l'écran.
 *
 * Libellés ET valeurs viennent du dictionnaire, jamais d'une donnée
 * inventée ici (gardien `sans-chaine-visible-en-dur`).
 */
const LIBELLE_SITE = fr["vocabulaire.agence"];
const VALEUR_SITE = fr["intervention.technicien"];
const LIBELLE_TECHNICIEN = fr["intervention.technicien"];
const VALEUR_ABSENTE = fr["intervention.aucun_technicien"];

const FAITS: readonly FaitFiche[] = [
  { cle: "site", icone: "pin", libelle: LIBELLE_SITE, valeur: VALEUR_SITE },
  {
    cle: "technicien",
    icone: "user",
    libelle: LIBELLE_TECHNICIEN,
    valeur: VALEUR_ABSENTE,
  },
];

describe("EnTeteFiche", () => {
  it("rend un <dt>/<dd> par fait, avec son icône", () => {
    const { getByText, container } = render(<EnTeteFiche faits={FAITS} />);
    const dtSite = getByText(LIBELLE_SITE);
    expect(dtSite.tagName).toBe("DT");
    const ddSite = dtSite.nextElementSibling;
    expect(ddSite?.tagName).toBe("DD");
    expect(ddSite?.textContent).toBe(VALEUR_SITE);
    expect(container.querySelectorAll("dt")).toHaveLength(2);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("rend la valeur comme un ReactNode (un lien, par exemple)", () => {
    const { getByRole } = render(
      <EnTeteFiche
        faits={[
          {
            cle: "site",
            icone: "pin",
            libelle: LIBELLE_SITE,
            valeur: <Link href="/sites/1">{VALEUR_SITE}</Link>,
          },
        ]}
      />,
    );
    expect(getByRole("link", { name: VALEUR_SITE })).not.toBeNull();
  });

  it("ne rend rien quand la liste de faits est vide", () => {
    const { container } = render(<EnTeteFiche faits={[]} />);
    expect(container.querySelectorAll("dt")).toHaveLength(0);
  });
});
