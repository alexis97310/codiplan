import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Avatar,
  teintePersonne,
  type TeintePersonne,
} from "@/components/ui/avatar";
import { DecompteLecture } from "@/components/ui/decompte-lecture";
import { Volet } from "@/components/ui/volet";
import { fr } from "@/lib/i18n/fr";

/**
 * 9EC-TP-UX3-E-ABSENCES (D175) — les trois composants neufs de la page
 * Absences reconstruite au gabarit de la maquette du 28/09 : le volet
 * (dialogue, fermeture), le décompte en lecture (jamais une tuile
 * cliquable), l'avatar à teinte par personne (décision 28 du pilote).
 *
 * Même discipline que `tests/unit/ui/composants-base.test.tsx` : tout le
 * texte visible vient du dictionnaire (`fr[…]`), les clés réutilisées ici
 * n'ont aucun rapport avec leur sens d'origine — elles servent seulement de
 * texte de test (L0-11).
 */

describe("Volet", () => {
  const SURTITRE = fr["absences.titre"];
  const TITRE = fr["absences.declarer"];
  const CORPS = fr["absences.immediat"];

  it("porte un dialogue nommé par son titre", () => {
    render(
      <Volet surtitre={SURTITRE} titre={TITRE} hrefFermer="/absences">
        <p>{CORPS}</p>
      </Volet>,
    );
    const dialogue = screen.getByRole("dialog");
    expect(dialogue).toHaveAccessibleName(TITRE);
    expect(dialogue).toHaveTextContent(CORPS);
  });

  it("le lien de fermeture vise `hrefFermer`, nommé « Fermer »", () => {
    render(
      <Volet
        surtitre={SURTITRE}
        titre={TITRE}
        hrefFermer="/absences?vue=terminees"
      >
        <p>{CORPS}</p>
      </Volet>,
    );
    const liens = screen.getAllByRole("link", { name: fr["volet.fermer"] });
    expect(liens.length).toBeGreaterThan(0);
    for (const lien of liens) {
      expect(lien).toHaveAttribute("href", "/absences?vue=terminees");
    }
  });

  it("le pied, s'il est passé, est rendu sous le corps", () => {
    render(
      <Volet
        surtitre={SURTITRE}
        titre={TITRE}
        hrefFermer="/absences"
        pied={<span>{fr["absences.annuler"]}</span>}
      >
        <p>{CORPS}</p>
      </Volet>,
    );
    expect(screen.getByText(fr["absences.annuler"])).toBeInTheDocument();
  });
});

describe("DecompteLecture — jamais une tuile cliquable (QE-13b, D175)", () => {
  const LIBELLE = fr["absences.kpi_ce_mois"];
  const DETAIL = fr["absences.kpi_rupture"];

  it("aucun lien, aucune icône — à la différence de `Kpi` avec `href`", () => {
    const { container } = render(
      <DecompteLecture libelle={LIBELLE} valeur={4} detail={DETAIL} />,
    );
    expect(container.querySelector("a")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    expect(container.textContent).toBe(`${LIBELLE}4${DETAIL}`);
  });

  it("le détail est absent du rendu quand il n'est pas passé", () => {
    const { container } = render(
      <DecompteLecture libelle={LIBELLE} valeur={0} />,
    );
    expect(container.querySelector("small")).not.toBeInTheDocument();
  });
});

describe("Avatar — teinte par personne, stable (décision 28 du pilote, 05/10/2026)", () => {
  const NOM = fr["absences.personne"];

  it("porte les initiales, et reste caché d'un lecteur d'écran", () => {
    render(<Avatar identifiant="u1" nom={NOM} />);
    const avatar = screen.getByText(/.+/, { selector: "span[aria-hidden]" });
    expect(avatar).toHaveAttribute("aria-hidden", "true");
  });

  it("personne inconnue (`identifiant` nul) — teinte grise, jamais un hachage sur rien", () => {
    const { container } = render(<Avatar identifiant={null} nom={NOM} />);
    const span = container.querySelector("span[aria-hidden]");
    expect(span?.className).toContain("bg-app-gris-fond");
    expect(span?.className).toContain("text-app-gris-encre");
  });

  it("teintePersonne — même identifiant, même teinte, à chaque appel", () => {
    expect(teintePersonne("u1")).toBe(teintePersonne("u1"));
    expect(teintePersonne("un-identifiant-stable")).toBe(
      teintePersonne("un-identifiant-stable"),
    );
  });

  it("teintePersonne — ne rend QUE les jetons de la liste fermée (jamais rouge, jamais gris)", () => {
    const LISTE_FERMEE: readonly TeintePersonne[] = [
      "bleu",
      "vert",
      "orange",
      "violet",
    ];
    for (const identifiant of ["a", "bb", "ccc", "dddd", "eeeee", "u-42"]) {
      expect(LISTE_FERMEE).toContain(teintePersonne(identifiant));
    }
  });

  it("chaque teinte de la liste fermée a un fond et une encre de la MÊME paire de jetons — contraste lisible", () => {
    const CLASSES_PAR_TEINTE: Record<TeintePersonne, string> = {
      bleu: "bg-app-bleu-fond text-app-bleu-encre",
      vert: "bg-app-vert-fond text-app-vert-encre",
      orange: "bg-app-orange-fond text-app-orange-encre",
      violet: "bg-app-violet-fond text-app-violet-encre",
    };
    // Sonde un identifiant par teinte — `teintePersonne` est un hachage
    // déterministe, pas une loterie : un petit balayage retrouve chacune
    // des quatre teintes de la liste fermée à coup sûr.
    const teintesTrouvees = new Set<TeintePersonne>();
    for (let n = 0; n < 50 && teintesTrouvees.size < 4; n += 1) {
      const identifiant = `sonde-${n}`;
      const teinte = teintePersonne(identifiant);
      if (teintesTrouvees.has(teinte)) {
        continue;
      }
      teintesTrouvees.add(teinte);
      const { container } = render(
        <Avatar identifiant={identifiant} nom={NOM} />,
      );
      const span = container.querySelector("span[aria-hidden]");
      for (const classe of CLASSES_PAR_TEINTE[teinte].split(" ")) {
        expect(span?.className).toContain(classe);
      }
    }
    expect(teintesTrouvees.size).toBe(4);
  });
});
