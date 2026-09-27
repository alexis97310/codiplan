import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Statistiques } from "@/app/(back-office)/planning/statistiques";
import type { Annuaire } from "@/lib/auth/annuaire";
import { fr } from "@/lib/i18n/fr";
import { ORDRE_STATUTS } from "@/lib/interventions/statistiques";
import type { OccupationTechnicien } from "@/lib/interventions/statistiques";
import type { LigneOccupation } from "@/lib/interventions/occupation";
import { SANS_TRAJET } from "@/lib/interventions/trajet";

/**
 * 9AW-GR17-SURCHARGE-MARQUE, M7 — LA PASTILLE « SURCHARGÉ », AU-DELÀ DE 100 %.
 *
 * Décision d'Alexis du 27/09/2026 : un taux au-delà de 100 % porte, à côté de
 * la phrase déjà exigée par D56 (`tests/unit/interventions/occupation-affichee.test.ts`),
 * une pastille rouge qui se voit avant que la phrase ne soit lue. Ce fichier
 * n'éprouve que la pastille — la phrase et sa formule restent le territoire du
 * gardien ci-dessus, que ce ticket ne touche pas.
 */

const ANNUAIRE_TEMOIN: Annuaire = () => ({ etat: "nom", nom: "Témoin" });

function occupation(
  surcharge: Partial<OccupationTechnicien> = {},
): OccupationTechnicien {
  return {
    technicienId: "0192f0a0-9000-7000-8000-000000000099",
    interventions: 1,
    minutesEngagees: 60,
    minutesOuvrables: 480,
    sansDuree: 0,
    trajet: SANS_TRAJET,
    segments: ORDRE_STATUTS.map((statut) => ({
      statut,
      minutes: 0,
      interventions: 0,
    })),
    ...surcharge,
  };
}

function ligne(occ: OccupationTechnicien): LigneOccupation {
  return {
    technicienId: occ.technicienId,
    agenceId: "agence-temoin",
    agenceLibelle: "Témoin",
    occupation: occ,
  };
}

describe("la pastille « Surchargé »", () => {
  it("apparaît au-delà de 100 % de charge", () => {
    // 600 minutes engagées sur 480 ouvrables : 125 %, au-delà du plein.
    const occ = occupation({ minutesEngagees: 600, minutesOuvrables: 480 });
    render(<Statistiques lignes={[ligne(occ)]} annuaire={ANNUAIRE_TEMOIN} />);

    expect(screen.getByText(fr["statistiques.surcharge"])).toBeInTheDocument();
  });

  it("n'apparaît pas à 100 % pile", () => {
    const occ = occupation({ minutesEngagees: 480, minutesOuvrables: 480 });
    render(<Statistiques lignes={[ligne(occ)]} annuaire={ANNUAIRE_TEMOIN} />);

    expect(screen.queryByText(fr["statistiques.surcharge"])).toBeNull();
  });

  it("n'apparaît pas sous 100 %", () => {
    const occ = occupation({ minutesEngagees: 60, minutesOuvrables: 480 });
    render(<Statistiques lignes={[ligne(occ)]} annuaire={ANNUAIRE_TEMOIN} />);

    expect(screen.queryByText(fr["statistiques.surcharge"])).toBeNull();
  });
});
