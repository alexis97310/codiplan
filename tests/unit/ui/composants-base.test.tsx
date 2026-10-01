import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it } from "vitest";

import { BandeDecomptes } from "@/components/ui/bande-decomptes";
import { Button, buttonVariants } from "@/components/ui/button";
import { EtatVide } from "@/components/ui/etat-vide";
import { Icone } from "@/components/ui/icone";
import { Kpi } from "@/components/ui/kpi";
import { Message } from "@/components/ui/message";
import { Onglets } from "@/components/ui/onglets";
import { Priorite } from "@/components/ui/priorite";
import { fr } from "@/lib/i18n/fr";

import { fichiersSource } from "../outils/fichiers-source";

/**
 * LES COMPOSANTS DE BASE NEUFS DE TP-UX1-3 — un `describe` par composant, un
 * cas par état. Aucun n'a encore d'appelant dans `app/` (voir la passation) :
 * ces épreuves de rendu en tiennent lieu, la seule preuve que la maquette du
 * 28/09 est bien ce que chacun rend.
 *
 * **Tout le texte visible vient du dictionnaire** (`fr[…]`), jamais d'une
 * chaîne fabriquée : ce fichier contient du JSX et interroge l'écran, donc
 * L0-11 (`tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`) le lit comme
 * n'importe quel composant — les clés réutilisées ici n'ont aucun rapport
 * avec leur sens d'origine, elles servent seulement de texte de test.
 */

describe("Priorite", () => {
  it.each(["p1", "p2", "p3", "p4"] as const)(
    "« %s » — rend le mot complet, jamais le seul code",
    (valeur) => {
      const { getByText } = render(<Priorite valeur={valeur} />);
      expect(getByText(fr[`priorite.${valeur}`])).toBeInTheDocument();
    },
  );

  it("P1 porte le ton rouge (GR5), pas le rouge plein de la maquette", () => {
    const { container } = render(<Priorite valeur="p1" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-app-rouge-fond");
    expect(span?.className).toContain("text-app-rouge-encre");
  });

  it("P3 et P4 portent le ton gris (GR5)", () => {
    const { container: c3 } = render(<Priorite valeur="p3" />);
    const { container: c4 } = render(<Priorite valeur="p4" />);
    expect(c3.querySelector("span")?.className).toContain("bg-app-gris-fond");
    expect(c4.querySelector("span")?.className).toContain("bg-app-gris-fond");
  });
});

describe("BandeDecomptes", () => {
  const LIBELLE = fr["parc.titre"];
  const LIBELLE_ZERO = fr["absences.titre"];

  it("n > 0 — un lien, le nombre, le libellé, un chevron", () => {
    const { getByRole, container } = render(
      <BandeDecomptes elements={[{ n: 3, libelle: LIBELLE, href: "/parc" }]} />,
    );
    const lien = getByRole("link", { name: new RegExp(`3.*${LIBELLE}`, "s") });
    expect(lien).toHaveAttribute("href", "/parc");
    expect(container.querySelector("b")?.textContent).toBe(String(3));
  });

  it("n = 0 — un état neutre, JAMAIS un lien", () => {
    const { queryByRole, getByText } = render(
      <BandeDecomptes
        elements={[
          {
            n: 0,
            libelle: LIBELLE_ZERO,
            href: "/absences",
            libelleAJour: fr["vgp.titre"],
          },
        ]}
      />,
    );
    expect(queryByRole("link")).not.toBeInTheDocument();
    expect(getByText(fr["vgp.titre"])).toBeInTheDocument();
  });

  it("n = 0 sans libelleAJour — retombe sur le libellé", () => {
    const { getByText } = render(
      <BandeDecomptes
        elements={[{ n: 0, libelle: LIBELLE_ZERO, href: "/absences" }]}
      />,
    );
    expect(getByText(LIBELLE_ZERO)).toBeInTheDocument();
  });
});

describe("Onglets", () => {
  const A = fr["parc.titre"];
  const B = fr["vgp.titre"];

  it("l'onglet actif porte aria-current=page", () => {
    const { getByRole } = render(
      <Onglets
        libelleAria={fr["nav.libelle"]}
        elements={[
          { libelle: A, href: "/parc", actif: true },
          { libelle: B, href: "/vgp" },
        ]}
      />,
    );
    expect(getByRole("link", { name: A })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(getByRole("link", { name: B })).not.toHaveAttribute("aria-current");
  });

  it("sans `compte`, aucun compteur ne s'affiche", () => {
    const { getByRole } = render(
      <Onglets
        libelleAria={fr["nav.libelle"]}
        elements={[{ libelle: A, href: "/parc" }]}
      />,
    );
    expect(getByRole("link", { name: A }).textContent).toBe(A);
  });

  it("`alerte` l'emporte sur `actif` pour le ton du compteur", () => {
    const { container } = render(
      <Onglets
        libelleAria={fr["nav.libelle"]}
        elements={[
          { libelle: A, href: "/parc", actif: true, alerte: true, compte: 4 },
        ]}
      />,
    );
    const compteur = container.querySelector("a span");
    expect(compteur?.textContent).toBe(String(4));
    expect(compteur?.className).toContain("bg-app-rouge-fond");
  });
});

describe("Message", () => {
  const TITRE = fr["tableau_de_bord.titre"];
  const CORPS = fr["vgp.titre"];
  const ACTION = fr["interventions.puce_tout_effacer"];

  it("succès — role=status, icône check-circle", () => {
    const { getByRole, container } = render(
      <Message ton="succes" titre={TITRE} />,
    );
    expect(getByRole("status")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("refus — role=alert, jamais status", () => {
    const { getByRole, queryByRole } = render(
      <Message ton="refus" titre={TITRE} />,
    );
    expect(getByRole("alert")).toBeInTheDocument();
    expect(queryByRole("status")).not.toBeInTheDocument();
  });

  it("avertissement — role=status", () => {
    const { getByRole } = render(<Message ton="avertissement" titre={TITRE} />);
    expect(getByRole("status")).toBeInTheDocument();
  });

  it("l'action, quand fournie, se rend", () => {
    const { getByText } = render(
      <Message ton="succes" titre={TITRE} action={<span>{ACTION}</span>}>
        {CORPS}
      </Message>,
    );
    expect(getByText(ACTION)).toBeInTheDocument();
    expect(getByText(CORPS)).toBeInTheDocument();
  });

  it("sans action, rien n'est rendu à sa place", () => {
    const { container } = render(<Message ton="succes" titre={TITRE} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});

describe("EtatVide", () => {
  const TEXTE = fr["vgp.titre"];
  const TITRE = fr["tableau_de_bord.titre"];
  const ACTION = fr["interventions.puce_tout_effacer"];

  it("sans `titre` — la boîte d'icône et le titre en moins, le texte à 14 px (décision du 30/09, D144)", () => {
    const { container, getByText } = render(<EtatVide>{TEXTE}</EtatVide>);
    expect(getByText(TEXTE)).toBeInTheDocument();
    expect(container.querySelector("b")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    const p = container.querySelector("p");
    expect(p?.className).toContain("text-14");
  });

  it("avec `titre` — la boîte d'icône, le titre, le texte à 14 px (décision du 30/09, D144)", () => {
    const { container, getByText } = render(
      <EtatVide titre={TITRE}>{TEXTE}</EtatVide>,
    );
    expect(getByText(TITRE).tagName).toBe("B");
    expect(container.querySelector("svg")).toBeInTheDocument();
    const p = container.querySelector("p");
    expect(p?.className).toContain("text-14");
  });

  it("`action`, quand fournie, se rend sous le texte", () => {
    const { getByText } = render(
      <EtatVide titre={TITRE} action={<Link href="/demandes">{ACTION}</Link>}>
        {TEXTE}
      </EtatVide>,
    );
    expect(getByText(ACTION)).toBeInTheDocument();
  });
});

describe("Kpi — tuile cliquable (D140)", () => {
  const LIBELLE = fr["parc.titre"];
  const DETAIL = fr["vgp.titre"];

  it("sans `href` — le DOM d'avant ce commit, à l'identique", () => {
    const { container } = render(
      <Kpi libelle={LIBELLE} valeur={7} detail={DETAIL} />,
    );
    expect(container.querySelector("a")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    const racine = container.firstElementChild;
    expect(racine?.tagName).toBe("DIV");
    expect(racine?.textContent).toBe(`${LIBELLE}${7}${DETAIL}`);
  });

  it("avec `href` — un seul <a href>, le chevron aria-hidden, rien d'autre", () => {
    const { container } = render(
      <Kpi libelle={LIBELLE} valeur={7} detail={DETAIL} href="/parc" />,
    );
    const liens = container.querySelectorAll("a");
    expect(liens.length).toBe(1);
    expect(liens[0]).toHaveAttribute("href", "/parc");
    expect(liens[0].textContent).toBe(`${LIBELLE}${7}${DETAIL}`);
    const chevron = liens[0].querySelector("svg");
    expect(chevron).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Button + Icone", () => {
  it("une icône enfant garde sa taille (18 px), jamais le size-4 du bouton", () => {
    const { container } = render(
      <Button>
        <Icone nom="check" />
        {fr["interventions.puce_tout_effacer"]}
      </Button>,
    );
    const svg = container.querySelector("svg");
    // `[&_svg:not([class*='size-'])]:size-4` (button.tsx:8) ne mord que sur un
    // <svg> SANS classe "size-" : la classe posée par `Icone` (`size-[18px]`)
    // échappe donc structurellement à la règle, quelle que soit la cascade.
    expect(svg?.getAttribute("class")).toContain("size-[18px]");
  });
});

describe("Button — hauteurs 32/40/48 px (spec §3.4 :255, maquette du 28/09 ; décision du 30/09, D144)", () => {
  it.each([
    ["sm", "h-8"],
    ["default", "h-10"],
    ["lg", "h-12"],
  ] as const)('size="%s" → %s', (taille, classe) => {
    expect(buttonVariants({ size: taille })).toContain(classe);
  });

  it('size="icon" → size-10 (40 px, même échelle que "default")', () => {
    expect(buttonVariants({ size: "icon" })).toContain("size-10");
  });
});

describe('tous les boutons du terrain portent size="lg" (décision du 30/09/2026 ; D144)', () => {
  it('app/(mobile)/** et signature-terrain.tsx — chaque <Button a size="lg"', () => {
    const fichiers = [
      ...fichiersSource(["app/(mobile)"], [".tsx"]),
      {
        chemin: "components/interventions/signature-terrain.tsx",
        contenu: readFileSync(
          join(process.cwd(), "components/interventions/signature-terrain.tsx"),
          "utf8",
        ),
      },
    ];
    let total = 0;
    for (const fichier of fichiers) {
      const blocs = fichier.contenu.match(/<Button\b[\s\S]*?>/g) ?? [];
      total += blocs.length;
      for (const bloc of blocs) {
        expect(
          bloc,
          `${fichier.chemin} : ${bloc.replace(/\s+/g, " ")}`,
        ).toContain('size="lg"');
      }
    }
    // LE TÉMOIN DE NON-VACUITÉ — six boutons au 30/09/2026 (voir
    // `tests/unit/ui/retouches-2a.test.ts`, même population).
    expect(total).toBe(6);
  });
});
