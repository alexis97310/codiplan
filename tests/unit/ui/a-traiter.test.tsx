import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BlocATraiter, type LigneATraiter } from "@/components/ui/a-traiter";
import { fr } from "@/lib/i18n/fr";

/**
 * LE BLOC « À TRAITER » (9EE-TP-UX4-1-FICHE-INTERVENTION-1) — une carte
 * titrée, des lignes cliquables, et une borne fournie par l'appelant ; ce
 * composant ne choisit rien lui-même.
 *
 * Tout texte vient du dictionnaire, jamais d'une donnée inventée ici
 * (gardien `sans-chaine-visible-en-dur`) — le sens des clés réemployées
 * n'a pas d'importance pour ce composant générique.
 */
const TITRE_CARTE = fr["intervention.actions.titre"];
const TITRE_LIGNE_1 = fr["intervention.titre"];
const TITRE_LIGNE_2 = fr["vocabulaire.agence"];
const DETAIL_LIGNE_1 = fr["planning.a_traiter_onglet_en_retard"];
const LIBELLE_VOIR_PLUS = fr["interventions.puce_tout_effacer"];

const LIGNES: readonly LigneATraiter[] = [
  {
    id: "1",
    ton: "refus",
    titre: TITRE_LIGNE_1,
    detail: DETAIL_LIGNE_1,
    href: "/interventions/1",
  },
  {
    id: "2",
    ton: "avertissement",
    titre: TITRE_LIGNE_2,
    href: "/interventions/2",
  },
];

describe("BlocATraiter", () => {
  it("rend le titre de la carte et une ligne par élément", () => {
    const { getByText, getAllByRole } = render(
      <BlocATraiter titre={TITRE_CARTE} lignes={LIGNES} />,
    );
    expect(getByText(TITRE_CARTE)).not.toBeNull();
    expect(getAllByRole("listitem")).toHaveLength(2);
  });

  it("chaque ligne est un lien cliquable vers sa destination, avec son détail", () => {
    const { getByRole, getByText } = render(
      <BlocATraiter titre={TITRE_CARTE} lignes={LIGNES} />,
    );
    const lien = getByRole("link", { name: TITRE_LIGNE_1 });
    expect(lien.getAttribute("href")).toBe("/interventions/1");
    expect(getByText(DETAIL_LIGNE_1)).not.toBeNull();
  });

  it("n'affiche le lien « Les N … » que si l'appelant le fournit", () => {
    const sansLien = render(
      <BlocATraiter titre={TITRE_CARTE} lignes={LIGNES} />,
    );
    expect(
      sansLien.queryByRole("link", { name: LIBELLE_VOIR_PLUS }),
    ).toBeNull();

    const avecLien = render(
      <BlocATraiter
        titre={TITRE_CARTE}
        lignes={LIGNES}
        lienVoirPlus={{ href: "/interventions", libelle: LIBELLE_VOIR_PLUS }}
      />,
    );
    const lien = avecLien.getByRole("link", { name: LIBELLE_VOIR_PLUS });
    expect(lien.getAttribute("href")).toBe("/interventions");
  });
});
