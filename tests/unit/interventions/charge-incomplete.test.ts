import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { Statistiques } from "@/app/(back-office)/planning/statistiques";
import type { Annuaire } from "@/lib/auth/annuaire";
import { t } from "@/lib/i18n/fr";
import type { LigneOccupation } from "@/lib/interventions/occupation";
import {
  occupationTechnicien,
  type InterventionMesuree,
  type OccupationTechnicien,
} from "@/lib/interventions/statistiques";
import { SANS_TRAJET } from "@/lib/interventions/trajet";

/**
 * LA CHARGE INCOMPLÈTE — 53-PLANNING-3, SAV-05.
 *
 * *Un chiffre juste qui fait conclure faux* (§9, 06/09) : `statistiques.tsx`
 * affichait « Taux 0 % » dès que le calendrier était connu, MÊME quand les
 * interventions du technicien n'avaient aucune durée saisie. Un technicien
 * débordé, mais dont personne n'a saisi les durées, paraissait libre.
 *
 * Ce fichier éprouve l'ÉCRAN : dès que `occupation.sansDuree > 0`, la ligne ne
 * porte plus « Taux » ni de pourcentage — elle porte « Charge incomplète ».
 * `occupation-affichee.test.ts` reste le gardien de l'autre règle, inchangée :
 * quand le taux s'affiche, il porte toujours ses deux termes et la formule.
 *
 * Extension `.ts` volontaire (fichier de preuve nommé par le ticket) : la JSX
 * passe donc par `createElement`, jamais par la syntaxe `<...>` qu'un `.ts` ne
 * sait pas analyser.
 */

const TECHNICIEN = "0192f0a0-9000-7000-8000-000000000002";

const ANNUAIRE: Annuaire = () => ({ etat: "nom", nom: "Témoin" });

function ligne(
  surcharge: Partial<InterventionMesuree> = {},
): InterventionMesuree {
  return {
    statut: "planifiee",
    technicien_id: TECHNICIEN,
    temps_valide_min: null,
    duree_estimee_min: null,
    ...surcharge,
  };
}

function lignesAvec(
  occupation: OccupationTechnicien,
): readonly LigneOccupation[] {
  return [
    {
      technicienId: TECHNICIEN,
      agenceId: "agence-1",
      agenceLibelle: "Ducos",
      occupation,
    },
  ];
}

function texteDeLaLigne(): string {
  return screen.getByText(/Ducos/).closest("li")?.textContent ?? "";
}

describe("la charge incomplète remplace le taux, jamais l'inverse", () => {
  it("sansDuree > 0, 0 minute engagée : « Charge incomplète », jamais « 0 % » ni « Taux »", () => {
    const occupation = occupationTechnicien(
      TECHNICIEN,
      [ligne()],
      480,
      SANS_TRAJET,
    );
    expect(occupation.sansDuree).toBe(1);
    expect(occupation.minutesEngagees).toBe(0);

    render(
      createElement(Statistiques, {
        lignes: lignesAvec(occupation),
        annuaire: ANNUAIRE,
      }),
    );
    const texte = texteDeLaLigne();

    expect(texte).toContain(t("statistiques.charge_incomplete"));
    expect(texte).not.toContain("0 %");
    expect(texte).not.toContain(t("statistiques.taux"));
  });

  it("sansDuree === 0 : le taux et la formule s'affichent comme avant", () => {
    const occupation = occupationTechnicien(
      TECHNICIEN,
      [ligne({ duree_estimee_min: 120 })],
      480,
      SANS_TRAJET,
    );
    expect(occupation.sansDuree).toBe(0);

    render(
      createElement(Statistiques, {
        lignes: lignesAvec(occupation),
        annuaire: ANNUAIRE,
      }),
    );
    const texte = texteDeLaLigne();

    expect(texte).toContain(t("statistiques.taux"));
    expect(texte).toContain(t("statistiques.formule"));
    expect(texte).not.toContain(t("statistiques.charge_incomplete"));
  });
});
