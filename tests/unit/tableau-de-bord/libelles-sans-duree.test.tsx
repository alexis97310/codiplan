import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Kpi } from "@/components/ui/kpi";
import { fr, t } from "@/lib/i18n/fr";
import { Statistiques } from "@/app/(back-office)/planning/statistiques";
import type { Annuaire } from "@/lib/auth/annuaire";
import { ORDRE_STATUTS } from "@/lib/interventions/statistiques";
import type { OccupationTechnicien } from "@/lib/interventions/statistiques";
import type { LigneOccupation } from "@/lib/interventions/occupation";
import { SANS_TRAJET } from "@/lib/interventions/trajet";

/**
 * PG-A6-LIBELLE-SANS-DUREE (28/09/2026, audit d'ergonomie du 27/09, I-5).
 *
 * ## Le défaut mesuré sur `main` avant ce ticket
 *
 * Deux comptes qui ne portent pas la même population se lisaient par le même
 * mot, « sans durée » :
 *
 * - la tuile du tableau de bord (`tableau_de_bord.kpi_interventions_sans_duree`,
 *   « Planifiées sans durée prévue ») compte aussi une intervention `a_planifier`
 *   (sans `date_planifiee`) — en production ses 3 lignes sont des « A
 *   planifier », aucune n'est « planifiée ».
 * - le lien du panneau de charge du planning
 *   (`statistiques.charge_incomplete_lien`, « Voir les interventions sans
 *   durée → ») ouvre `/interventions?sans_duree_a_venir=1` — une population
 *   différente de celle que la phrase juste à côté vient de compter (la
 *   SEMAINE affichée, dates passées comprises).
 *
 * Ce fichier éprouve les LIBELLÉS rendus, pas le calcul (inchangé).
 */

describe("le libellé de la tuile « sans durée » du tableau de bord", () => {
  it("dit sa population — à planifier OU à venir, jamais seulement « planifiées »", () => {
    render(
      <Kpi
        ton="orange"
        libelle={t("tableau_de_bord.kpi_interventions_sans_duree")}
        valeur={3}
      />,
    );
    expect(
      screen.getByText(fr["tableau_de_bord.kpi_interventions_sans_duree"]),
    ).toBeInTheDocument();
    expect(fr["tableau_de_bord.kpi_interventions_sans_duree"]).not.toBe(
      "Planifiées sans durée prévue",
    );
  });
});

const ANNUAIRE_TEMOIN: Annuaire = () => ({ etat: "nom", nom: "Témoin" });

function occupationIncomplete(): OccupationTechnicien {
  return {
    technicienId: "0192f0a0-9000-7000-8000-000000000098",
    interventions: 1,
    minutesEngagees: 60,
    minutesOuvrables: 480,
    sansDuree: 1,
    trajet: SANS_TRAJET,
    segments: ORDRE_STATUTS.map((statut) => ({
      statut,
      minutes: 0,
      interventions: 0,
    })),
  };
}

describe("le lien « sans durée » du panneau de charge du planning", () => {
  it("dit la population qu'il ouvre — celles À VENIR, distincte du compte de la semaine juste à côté", () => {
    const occupation = occupationIncomplete();
    const ligne: LigneOccupation = {
      technicienId: occupation.technicienId,
      agenceId: "agence-temoin",
      agenceLibelle: "Témoin",
      occupation,
    };
    render(<Statistiques lignes={[ligne]} annuaire={ANNUAIRE_TEMOIN} />);

    expect(
      screen.getByRole("link", {
        name: fr["statistiques.charge_incomplete_lien"],
      }),
    ).toHaveAttribute("href", "/interventions?sans_duree_a_venir=1");
    expect(fr["statistiques.charge_incomplete_lien"]).not.toBe(
      "Voir les interventions sans durée →",
    );
  });
});
