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
 *
 * ## LE LIBELLÉ « CHARTE DE LA SOCIÉTÉ » / « THÈME NEUTRE » N'EST PLUS ICI
 * (N-02, arbitrage du 16/09/2026)
 *
 * Il vivait dans ce composant, et ce fichier l'attendait à l'écran. Il vit
 * désormais dans `/parametres/societe`, éprouvé de bout en bout par
 * `tests/e2e/deconnexion.spec.ts` — *le déplacer sans déplacer l'épreuve
 * aurait laissé un texte sans gardien nulle part*, la faute inverse de celle
 * que ce ticket répare. Ce fichier-ci vérifie au contraire que ce libellé
 * N'APPARAÎT PLUS ici : la moitié qu'on oublierait d'un déplacement.
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
    <div style={variablesCss(theme)} data-theme={theme.origine}>
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
    // recopié dans le scénario (L0-11) : le nom d'une société est une donnée.
    const a = rendreSousTheme(SOCIETE_A);

    expect(screen.getByText(a.theme.nom)).toBeInTheDocument();
  });

  it("ne porte plus le libellé de diagnostic — il a déménagé (N-02)", () => {
    // Le sens qu'on oublie d'un déplacement : la moitié « ce n'est plus ici »,
    // jamais éprouvée par le seul fait d'ajouter l'écran de destination.
    // Les DEUX origines sont éprouvées : le composant ne branche plus du tout
    // sur `theme.origine` pour du texte, et rien ne garantit qu'un futur
    // correcteur ne le réintroduise pas pour une seule des deux.
    const { unmount } = render(
      <BandeauSociete theme={themeDeSociete(SOCIETE_A)} />,
    );
    expect(screen.queryByText(fr["theme.societe"])).toBeNull();
    unmount();

    render(<BandeauSociete theme={THEME_DEFAUT} />);
    expect(screen.queryByText(fr["theme.neutre"])).toBeNull();
  });

  it("bascule : deux sociétés, deux rendus — sans redéploiement", () => {
    const a = rendreSousTheme(SOCIETE_A);
    expect(a.lire("--societe-primaire")).toBe("#0b5cad");
    expect(a.lire("--societe-primaire-encre")).toBe("#ffffff");
    expect(a.racine.dataset.theme).toBe("societe");

    const b = rendreSousTheme(SOCIETE_B);
    expect(b.lire("--societe-primaire")).toBe("#fff9c4");
    // Le jaune pâle du ticket : l'encre bascule au noir, dans le rendu réel.
    expect(b.lire("--societe-primaire-encre")).toBe("#000000");

    expect(screen.getByText(b.theme.nom)).toBeInTheDocument();
    expect(a.lire("--societe-primaire")).not.toBe(b.lire("--societe-primaire"));
  });

  it("sans société active, c'est le thème neutre", () => {
    const neutre = rendreSousTheme(null);

    expect(neutre.racine.dataset.theme).toBe("defaut");
    expect(screen.getByText(THEME_DEFAUT.nom)).toBeInTheDocument();
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
