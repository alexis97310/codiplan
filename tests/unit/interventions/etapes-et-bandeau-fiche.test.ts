import { describe, expect, it } from "vitest";

import {
  bandeauDeLaFiche,
  etapesDeLIntervention,
  habilitationExigeeSurLeSite,
} from "@/app/(back-office)/interventions/presentation";
import { enDuree } from "@/lib/calendar/duree";
import { jourDe, maintenant, type Fuseau } from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";
import { STATUTS_INTERVENTION } from "@/lib/interventions/saisie";

/**
 * LA FRISE D'ÉTAPES (D8) ET LE BANDEAU D'ÉTAT (9EE-TP-UX4-1-
 * FICHE-INTERVENTION-1) — fonctions pures, jamais `new Date()` ni
 * « aujourd'hui » en UTC : l'instant vient de `maintenant(fuseau)`, comme un
 * appelant réel le lirait.
 */

const NOUMEA: Fuseau = "Pacific/Noumea";
const UN_JOUR_MS = 24 * 60 * 60 * 1000;

function maintenantFiche() {
  const m = maintenant(NOUMEA);
  return { instant: m.instant, local: jourDe(m.local) };
}

function ilYA(jours: number): Date {
  return new Date(maintenantFiche().instant.getTime() - jours * UN_JOUR_MS);
}

describe("etapesDeLIntervention — les six étapes de D8", () => {
  it("huit statuts : la population n'est pas vide, et couvre tout le cycle", () => {
    expect(STATUTS_INTERVENTION.length).toBe(8);
  });

  it("aucune frise sur une ANNULÉE", () => {
    expect(etapesDeLIntervention("annulee", false)).toEqual([]);
  });

  it("aucune frise sur une fiche REPRISE d'un import, quel que soit son statut", () => {
    expect(etapesDeLIntervention("cloturee", true)).toEqual([]);
  });

  it("« a_planifier » : courante en tête, les cinq suivantes à venir", () => {
    const etapes = etapesDeLIntervention("a_planifier", false);
    expect(etapes).toHaveLength(6);
    expect(etapes[0]).toEqual({ cle: "a_planifier", etat: "courante" });
    expect(etapes.slice(1).every((e) => e.etat === "a_venir")).toBe(true);
  });

  it("« terminee » : les quatre précédentes faites, courante, puis clôturée à venir", () => {
    const etapes = etapesDeLIntervention("terminee", false);
    expect(etapes.map((e) => e.etat)).toEqual([
      "faite",
      "faite",
      "faite",
      "faite",
      "courante",
      "a_venir",
    ]);
  });

  it("« cloturee » : toutes les étapes sont faites, sauf la dernière, courante", () => {
    const etapes = etapesDeLIntervention("cloturee", false);
    expect(etapes.map((e) => e.etat)).toEqual([
      "faite",
      "faite",
      "faite",
      "faite",
      "faite",
      "courante",
    ]);
  });

  it("« suspendue » : l'étape « En cours » est ARRÊTÉE, avec sa précision — jamais une septième étape", () => {
    const etapes = etapesDeLIntervention("suspendue", false);
    expect(etapes.map((e) => e.cle)).toEqual([
      "a_planifier",
      "planifiee",
      "affectee",
      "en_cours",
      "terminee",
      "cloturee",
    ]);
    const enCours = etapes.find((e) => e.cle === "en_cours");
    expect(enCours).toEqual({
      cle: "en_cours",
      etat: "arretee",
      precision: "intervention.frise.etape_arretee",
    });
  });
});

describe("habilitationExigeeSurLeSite", () => {
  it("compose « Habilitation <code> exigée sur le site. »", () => {
    expect(habilitationExigeeSurLeSite("BR")).toBe(
      "Habilitation BR exigée sur le site.",
    );
  });
});

const PARAMS_PAR_DEFAUT = {
  statut: "a_planifier" as const,
  creeLe: ilYA(0),
  deplanifieeLe: null,
  priorite: "p3" as const,
  exigencesBloquantes: [],
  mentionDeplanifiee: null,
  datePlanifiee: null,
  aDesSegments: false,
  segmentOuvertDepuis: null,
  motifSuspension: null,
  pieceAttendue: null,
  suspendueLe: null,
  tempsMesureMin: null,
};

describe("bandeauDeLaFiche — un cas par état", () => {
  it("« a_planifier », priorité P3 : ton information, « depuis » en jours", () => {
    const bandeau = bandeauDeLaFiche(
      { ...PARAMS_PAR_DEFAUT, creeLe: ilYA(3) },
      NOUMEA,
      maintenantFiche(),
    );
    expect(bandeau?.ton).toBe("information");
    expect(bandeau?.titre).toBe(
      `${t("intervention.bandeau.a_planifier_depuis")} 3 ${t("interventions.anciennete.jours")}.`,
    );
    expect(bandeau?.texte).toBeUndefined();
  });

  it("« a_planifier », priorité P1 : ton refus, « Priorité critique. »", () => {
    const bandeau = bandeauDeLaFiche(
      { ...PARAMS_PAR_DEFAUT, priorite: "p1" },
      NOUMEA,
      maintenantFiche(),
    );
    expect(bandeau?.ton).toBe("refus");
    expect(bandeau?.texte).toContain(
      t("intervention.bandeau.priorite_critique"),
    );
  });

  it("« a_planifier » avec une exigence bloquante : nomme l'habilitation", () => {
    const bandeau = bandeauDeLaFiche(
      {
        ...PARAMS_PAR_DEFAUT,
        exigencesBloquantes: [{ code: "BR" }],
      },
      NOUMEA,
      maintenantFiche(),
    );
    expect(bandeau?.texte).toContain("Habilitation BR exigée sur le site.");
  });

  it("« a_planifier » depuis moins d'un jour : la durée se lit en minutes/heures", () => {
    const bandeau = bandeauDeLaFiche(
      { ...PARAMS_PAR_DEFAUT, creeLe: ilYA(0) },
      NOUMEA,
      maintenantFiche(),
    );
    expect(bandeau?.titre).not.toContain(t("interventions.anciennete.jours"));
  });

  it("« planifiee », en retard : ton refus, « prévue <date> »", () => {
    const bandeau = bandeauDeLaFiche(
      {
        ...PARAMS_PAR_DEFAUT,
        statut: "planifiee",
        datePlanifiee: ilYA(2),
        aDesSegments: false,
      },
      NOUMEA,
      maintenantFiche(),
    );
    expect(bandeau?.ton).toBe("refus");
    expect(bandeau?.titre).toContain(t("intervention.bandeau.en_retard_avant"));
  });

  it("« planifiee », pas en retard : ton information, « préparée par le bureau »", () => {
    const bandeau = bandeauDeLaFiche(
      { ...PARAMS_PAR_DEFAUT, statut: "planifiee", datePlanifiee: null },
      NOUMEA,
      maintenantFiche(),
    );
    expect(bandeau).toEqual({
      ton: "information",
      titre: t("intervention.bandeau.planifiee"),
    });
  });

  it("« affectee », pas en retard : aucun bandeau", () => {
    const bandeau = bandeauDeLaFiche(
      { ...PARAMS_PAR_DEFAUT, statut: "affectee", datePlanifiee: null },
      NOUMEA,
      maintenantFiche(),
    );
    expect(bandeau).toBeNull();
  });

  it("« affectee », en retard : même bandeau refus que « planifiee »", () => {
    const bandeau = bandeauDeLaFiche(
      {
        ...PARAMS_PAR_DEFAUT,
        statut: "affectee",
        datePlanifiee: ilYA(1),
      },
      NOUMEA,
      maintenantFiche(),
    );
    expect(bandeau?.ton).toBe("refus");
  });

  it("« en_cours », un segment ouvert : ton information, l'heure du segment", () => {
    const bandeau = bandeauDeLaFiche(
      {
        ...PARAMS_PAR_DEFAUT,
        statut: "en_cours",
        segmentOuvertDepuis: "08:15",
      },
      NOUMEA,
      maintenantFiche(),
    );
    expect(bandeau?.ton).toBe("information");
    expect(bandeau?.titre).toContain("08:15");
  });

  it("« en_cours » sans segment ouvert (cas de bord) : aucun bandeau", () => {
    const bandeau = bandeauDeLaFiche(
      { ...PARAMS_PAR_DEFAUT, statut: "en_cours", segmentOuvertDepuis: null },
      NOUMEA,
      maintenantFiche(),
    );
    expect(bandeau).toBeNull();
  });

  it("« suspendue » avec motif et pièce attendue : avertissement, les deux phrases", () => {
    const bandeau = bandeauDeLaFiche(
      {
        ...PARAMS_PAR_DEFAUT,
        statut: "suspendue",
        suspendueLe: ilYA(1),
        motifSuspension: "Pièce manquante",
        pieceAttendue: {
          reference: "REF-123",
          disponibleLe: "disponible le 12/10",
        },
      },
      NOUMEA,
      maintenantFiche(),
    );
    expect(bandeau?.ton).toBe("avertissement");
    expect(bandeau?.titre).toContain("Pièce manquante");
    expect(bandeau?.texte).toContain("REF-123");
  });

  it("« suspendue » sans suspendue_le, sans motif : titre « Suspendue », sans durée", () => {
    const bandeau = bandeauDeLaFiche(
      {
        ...PARAMS_PAR_DEFAUT,
        statut: "suspendue",
        suspendueLe: null,
        motifSuspension: null,
      },
      NOUMEA,
      maintenantFiche(),
    );
    expect(bandeau?.ton).toBe("avertissement");
    expect(bandeau?.titre).toBe(`${t("intervention.bandeau.suspendue")}.`);
    expect(bandeau?.titre).not.toContain(enDuree(0));
  });

  it("« suspendue » sans suspendue_le, avec motif : titre « Suspendue · motif », sans durée", () => {
    const bandeau = bandeauDeLaFiche(
      {
        ...PARAMS_PAR_DEFAUT,
        statut: "suspendue",
        suspendueLe: null,
        motifSuspension: "Pièce manquante",
      },
      NOUMEA,
      maintenantFiche(),
    );
    expect(bandeau?.ton).toBe("avertissement");
    expect(bandeau?.titre).toBe(
      `${t("intervention.bandeau.suspendue")}${t("ponctuation.point_median")}Pièce manquante.`,
    );
    expect(bandeau?.titre).not.toContain(enDuree(0));
  });

  it("« suspendue » avec pièce attendue sans date de disponibilité : « REF-123. », jamais « , . »", () => {
    const bandeau = bandeauDeLaFiche(
      {
        ...PARAMS_PAR_DEFAUT,
        statut: "suspendue",
        suspendueLe: ilYA(1),
        motifSuspension: null,
        pieceAttendue: {
          reference: "REF-123",
          disponibleLe: null,
        },
      },
      NOUMEA,
      maintenantFiche(),
    );
    expect(bandeau?.texte).toBe("REF-123.");
    expect(bandeau?.texte).not.toContain(`${t("ponctuation.virgule")}.`);
  });

  it("« terminee », verdict refusé : avertissement, la raison du refus", () => {
    const bandeau = bandeauDeLaFiche(
      {
        ...PARAMS_PAR_DEFAUT,
        statut: "terminee",
        tempsMesureMin: null,
      },
      NOUMEA,
      maintenantFiche(),
    );
    expect(bandeau?.ton).toBe("avertissement");
    expect(bandeau?.titre).toBe(t("intervention.bandeau.cloture_impossible"));
    expect(bandeau?.texte).toBe(t("intervention.refus.temps_manquant"));
  });

  it("« terminee », verdict accepté : succès, « prête à clôturer »", () => {
    const bandeau = bandeauDeLaFiche(
      {
        ...PARAMS_PAR_DEFAUT,
        statut: "terminee",
        tempsMesureMin: 90,
      },
      NOUMEA,
      maintenantFiche(),
    );
    expect(bandeau).toEqual({
      ton: "succes",
      titre: t("intervention.bandeau.prete_a_cloturer"),
    });
  });

  it.each(["affectee", "cloturee", "annulee"] as const)(
    "« %s » sans condition particulière : pas plus riche qu'attendu",
    (statut) => {
      expect(() =>
        bandeauDeLaFiche(
          { ...PARAMS_PAR_DEFAUT, statut, datePlanifiee: null },
          NOUMEA,
          maintenantFiche(),
        ),
      ).not.toThrow();
    },
  );
});
