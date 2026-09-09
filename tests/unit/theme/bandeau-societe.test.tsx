import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BandeauSociete } from "@/components/theme/bandeau-societe";
import { fr } from "@/lib/i18n/fr";
import { THEME_DEFAUT, themeDeSociete } from "@/lib/theme/theme";
import { variablesCss } from "@/lib/theme/variables";

/**
 * Le rendu suit la société active (ticket L0-09, points 2 et 4).
 *
 * Le bandeau n'écrit aucune couleur : il nomme les variables. Ce scénario pose
 * les variables comme le fait la mise en page racine — côté serveur, sur
 * l'élément qui enveloppe le rendu — puis vérifie que deux sociétés aux
 * chartes distinctes donnent deux rendus distincts SANS qu'une ligne du
 * composant change.
 */

const SOCIETE_A = {
  raison_sociale: "Société A",
  couleur_primaire: "#0b5cad",
  couleur_secondaire: "#f4a300",
};

const SOCIETE_B = {
  raison_sociale: "Société B",
  couleur_primaire: "#fff9c4",
  couleur_secondaire: "#7a1f3d",
};

/** Rend le bandeau sous les variables du thème, comme le fait `app/layout.tsx`. */
function rendreSousTheme(source: typeof SOCIETE_A | null) {
  const theme = themeDeSociete(source);
  const { container } = render(
    <div style={variablesCss(theme)} data-origine-theme={theme.origine}>
      <BandeauSociete theme={theme} />
    </div>,
  );
  const racine = container.firstElementChild as HTMLElement;
  return {
    theme,
    racine,
    lire: (variable: string) => racine.style.getPropertyValue(variable),
  };
}

describe("bandeau d'identité de la société active", () => {
  it("affiche le nom de la société, qui est une donnée et non une chaîne du code", () => {
    // Le texte attendu est celui que le thème PORTE — jamais un littéral
    // recopié dans le scénario (L0-11) : le nom d'une société est une donnée,
    // et le libellé qui le qualifie vient du dictionnaire. Ni l'un ni l'autre
    // ne s'écrit deux fois.
    const a = rendreSousTheme(SOCIETE_A);

    expect(screen.getByText(a.theme.nom)).toBeInTheDocument();
    expect(screen.getByText(fr["theme.societe"])).toBeInTheDocument();
  });

  it("bascule : deux sociétés, deux rendus — sans redéploiement", () => {
    const a = rendreSousTheme(SOCIETE_A);
    expect(a.lire("--societe-primaire")).toBe("#0b5cad");
    expect(a.lire("--societe-primaire-encre")).toBe("#ffffff");
    expect(a.racine.dataset.origineTheme).toBe("societe");

    const b = rendreSousTheme(SOCIETE_B);
    expect(b.lire("--societe-primaire")).toBe("#fff9c4");
    // Le jaune pâle du ticket : l'encre bascule au noir, dans le rendu réel.
    expect(b.lire("--societe-primaire-encre")).toBe("#000000");

    expect(screen.getByText(b.theme.nom)).toBeInTheDocument();
    expect(a.lire("--societe-primaire")).not.toBe(b.lire("--societe-primaire"));
  });

  it("sans société active, c'est le thème neutre, et il se dit tel quel", () => {
    const neutre = rendreSousTheme(null);

    expect(neutre.racine.dataset.origineTheme).toBe("defaut");
    expect(screen.getByText(THEME_DEFAUT.nom)).toBeInTheDocument();
    expect(screen.getByText(fr["theme.neutre"])).toBeInTheDocument();
    expect(neutre.lire("--societe-primaire")).toBe(THEME_DEFAUT.primaire.fond);
  });

  it("le composant ne porte que des classes adossées aux variables", () => {
    const { racine } = rendreSousTheme(SOCIETE_A);
    const bandeau = racine.firstElementChild as HTMLElement;

    expect(bandeau.className).toContain("bg-societe-primaire");
    expect(bandeau.className).toContain("text-societe-primaire-encre");
    // Aucune couleur écrite dans le style en ligne du bandeau lui-même : elles
    // viennent toutes de l'enveloppe posée par le serveur.
    expect(bandeau.getAttribute("style")).toBeNull();
  });
});
