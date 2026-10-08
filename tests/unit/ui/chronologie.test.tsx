import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Chronologie } from "@/components/ui/chronologie";
import { t } from "@/lib/i18n/fr";

/**
 * LA CHRONOLOGIE — GÉNÉRIQUE (9EE-TP-UX4-1-FICHE-INTERVENTION-2) : les
 * évènements arrivent déjà traduits (`instant`/`libelle` sont des chaînes),
 * ce composant ne lit ni fuseau ni dictionnaire métier.
 *
 * `t(...)` est appelé EN LIGNE à chaque usage, jamais mis en variable (le
 * gardien `sans-chaine-visible-en-dur`, L0-11, ne reconnaît l'accesseur que
 * sous cette forme — une constante qui le mettrait en cache redeviendrait,
 * à ses yeux, une chaîne en dur).
 */
describe("Chronologie", () => {
  it("rend le titre et une entrée par évènement, dans l'ordre reçu", () => {
    const { getByRole, getAllByRole } = render(
      <Chronologie
        titre={t("intervention.chronologie.titre")}
        evenements={[
          { instant: "25/09/2026 08:00", libelle: "Créée" },
          { instant: "26/09/2026 09:00", libelle: "Clôturée" },
        ]}
      />,
    );
    expect(
      getByRole("heading", { name: t("intervention.chronologie.titre") }),
    ).not.toBeNull();
    const lignes = getAllByRole("listitem");
    expect(lignes).toHaveLength(2);
    expect(lignes[0]?.textContent).toContain("25/09/2026 08:00");
    expect(lignes[0]?.textContent).toContain("Créée");
    expect(lignes[1]?.textContent).toContain("Clôturée");
  });

  it("ne rend aucune entrée quand la liste est vide", () => {
    const { getByRole, queryAllByRole } = render(
      <Chronologie
        titre={t("intervention.chronologie.titre")}
        evenements={[]}
      />,
    );
    expect(
      getByRole("heading", { name: t("intervention.chronologie.titre") }),
    ).not.toBeNull();
    expect(queryAllByRole("listitem")).toHaveLength(0);
  });
});
