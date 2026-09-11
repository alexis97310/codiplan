import { describe, expect, it } from "vitest";

import type { JourLocal } from "@/lib/calendar/fuseau";
import {
  construireJournee,
  type AgenceDeJournee,
  type Occupante,
} from "@/lib/interventions/journee";

/**
 * LA VUE JOUR — l'axe, les trois états, et le compte des trous (11/09/2026).
 *
 * *« Un créneau libre doit se distinguer au premier coup d'œil d'un créneau
 * occupé, sinon l'écran ne sert à rien. »* C'est la définition de l'écran, donc
 * le sujet de ce fichier : **combien de trous, et où.**
 *
 * Les horaires employés ici sont ceux que le semis écrit réellement, mesurés en
 * base le 11/09/2026 — Nouméa 07:30–11:30 et 13:00–17:00, le siège 09:00–12:30
 * et 14:00–18:00, pas de 30 minutes partout. *Des horaires fabriqués auraient
 * démontré une arithmétique, pas l'écran.*
 */

/** Lundi 17 août 2026 — la semaine de la maquette. */
const LUNDI: JourLocal = { annee: 2026, mois: 8, jour: 17 };
/** Samedi 22 — Ducos ouvre, Koné non. */
const SAMEDI: JourLocal = { annee: 2026, mois: 8, jour: 22 };

const NOUMEA: AgenceDeJournee = {
  id: "ag-ducos",
  libelle: "Ducos",
  plages: [1, 2, 3, 4, 5, 6].flatMap((jourSemaine) => [
    { jourSemaine, debutMinutes: 450, finMinutes: 690 },
    { jourSemaine, debutMinutes: 780, finMinutes: 1020 },
  ]),
  pasCreneauMinutes: 30,
  calendrierConnu: true,
};
const SIEGE: AgenceDeJournee = {
  id: "ag-siege",
  libelle: "Siège",
  plages: [1, 2, 3, 4, 5].flatMap((jourSemaine) => [
    { jourSemaine, debutMinutes: 540, finMinutes: 750 },
    { jourSemaine, debutMinutes: 840, finMinutes: 1080 },
  ]),
  pasCreneauMinutes: 30,
  calendrierConnu: true,
};
const SANS_CALENDRIER: AgenceDeJournee = {
  id: "ag-muette",
  libelle: "Agence muette",
  plages: [],
  pasCreneauMinutes: 0,
  calendrierConnu: false,
};

/** Un instant d'un jour donné, à `minutes` minutes locales — en UTC pour le test. */
function instant(jour: JourLocal, minutes: number): Date {
  return new Date(
    Date.UTC(jour.annee, jour.mois - 1, jour.jour, 0, minutes, 0),
  );
}
const minutesDe = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();

function pose(p: Partial<Occupante> & { id: string }): Occupante {
  return {
    technicien_id: "t1",
    agence_id: NOUMEA.id,
    creneau_debut: null,
    creneau_fin: null,
    duree_estimee_min: null,
    ...p,
  };
}

describe("l'axe des heures", () => {
  it("couvre les plages d'UNE agence, au pas qu'elle règle", () => {
    const j = construireJournee(
      [pose({ id: "a" })],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    // 07:30 → 17:00, pas 30 : les créneaux vont de 450 à 990 inclus.
    expect(j.pasMinutes).toBe(30);
    expect(j.axe[0]).toBe(450);
    expect(j.axe[j.axe.length - 1]).toBe(990);
    expect(j.axe).toHaveLength(19);
  });

  it("porte l'UNION quand deux agences aux horaires différents se côtoient", () => {
    // C'est le cas que l'exploitation nomme : Nouméa 07:30–17:00, le siège
    // 09:00–18:00. L'axe va de la première ouverture à la dernière fermeture.
    const j = construireJournee(
      [
        pose({ id: "a", agence_id: NOUMEA.id, technicien_id: "t1" }),
        pose({ id: "b", agence_id: SIEGE.id, technicien_id: "t2" }),
      ],
      LUNDI,
      [NOUMEA, SIEGE],
      minutesDe,
    );
    expect(j.axe[0]).toBe(450);
    expect(j.axe[j.axe.length - 1]).toBe(1050);
  });

  it("n'étire PAS l'axe sur une agence dont personne ne travaille ce jour-là", () => {
    // Sinon la mesure des trous devient fausse dans le sens flatteur : des
    // heures vides apparaîtraient dans toutes les colonnes.
    const j = construireJournee(
      [pose({ id: "a" })],
      LUNDI,
      [NOUMEA, SIEGE],
      minutesDe,
    );
    expect(j.axe[j.axe.length - 1]).toBe(990);
  });

  it("sans calendrier connu, il n'y a pas d'axe — et pas de faux créneaux", () => {
    const j = construireJournee(
      [pose({ id: "a", agence_id: SANS_CALENDRIER.id })],
      LUNDI,
      [SANS_CALENDRIER],
      minutesDe,
    );
    expect(j.axe).toEqual([]);
    expect(j.creneauxLibres).toBe(0);
  });
});

describe("les trois états d'une cellule", () => {
  it("OCCUPÉ sur toute la durée, et le libellé ne paraît qu'une fois", () => {
    const j = construireJournee(
      [
        pose({
          id: "a",
          creneau_debut: instant(LUNDI, 450),
          creneau_fin: instant(LUNDI, 570),
        }),
      ],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    const occupees = j.colonnes[0].cellules.filter((c) => c.etat === "occupe");
    // 450 → 570, pas 30 : quatre créneaux.
    expect(occupees).toHaveLength(4);
    expect(occupees.filter((c) => c.debutDeBloc)).toHaveLength(1);
    expect(occupees[0].debutMinutes).toBe(450);
  });

  it("LIBRE partout ailleurs, et le compte le dit", () => {
    const j = construireJournee(
      [
        pose({
          id: "a",
          creneau_debut: instant(LUNDI, 450),
          creneau_fin: instant(LUNDI, 570),
        }),
      ],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    // 19 créneaux d'axe, 4 occupés, 1 hors ouverture (la pause 11:30–13:00
    // tombe sur le créneau 690–720 … et sur 720–750 et 750–780).
    expect(j.colonnes[0].creneauxLibres).toBe(
      j.axe.length -
        4 -
        j.colonnes[0].cellules.filter((c) => c.etat === "hors_ouverture")
          .length,
    );
    expect(j.creneauxLibres).toBeGreaterThan(0);
  });

  it("HORS OUVERTURE sur la pause de midi — un trou de déjeuner n'est pas un trou à vendre", () => {
    const j = construireJournee(
      [pose({ id: "a" })],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    const midi = j.colonnes[0].cellules.filter(
      (c) => c.debutMinutes >= 690 && c.debutMinutes < 780,
    );
    expect(midi).toHaveLength(3);
    expect(midi.every((c) => c.etat === "hors_ouverture")).toBe(true);
  });

  it("CHAQUE COLONNE grise ses PROPRES heures — c'est la demande exacte", () => {
    // Deux colonnes, deux agences. À 07:30 Nouméa ouvre et le siège non ;
    // à 17:30 c'est l'inverse. Le témoin est la paire croisée : une seule
    // moitié se satisferait d'une colonne toujours grise.
    const j = construireJournee(
      [
        pose({ id: "a", agence_id: NOUMEA.id, technicien_id: "t1" }),
        pose({ id: "b", agence_id: SIEGE.id, technicien_id: "t2" }),
      ],
      LUNDI,
      [NOUMEA, SIEGE],
      minutesDe,
    );
    const noumea = j.colonnes.find((c) => c.technicienId === "t1")!;
    const siege = j.colonnes.find((c) => c.technicienId === "t2")!;
    const a = (colonne: typeof noumea, minutes: number) =>
      colonne.cellules.find((c) => c.debutMinutes === minutes)!.etat;

    expect(a(noumea, 450)).toBe("libre");
    expect(a(siege, 450)).toBe("hors_ouverture");
    expect(a(noumea, 1020)).toBe("hors_ouverture");
    expect(a(siege, 1020)).toBe("libre");
  });

  it("le SAMEDI, la colonne de Koné n'existe pas et celle de Ducos ouvre", () => {
    // RG-PLA-01, vue par la journée : le siège ne porte aucune plage le samedi.
    const j = construireJournee(
      [
        pose({ id: "a", agence_id: NOUMEA.id, technicien_id: "t1" }),
        pose({ id: "b", agence_id: SIEGE.id, technicien_id: "t2" }),
      ],
      SAMEDI,
      [NOUMEA, SIEGE],
      minutesDe,
    );
    const siege = j.colonnes.find((c) => c.technicienId === "t2")!;
    expect(siege.creneauxLibres).toBe(0);
    expect(siege.cellules.every((c) => c.etat === "hors_ouverture")).toBe(true);
    const ducos = j.colonnes.find((c) => c.technicienId === "t1")!;
    expect(ducos.creneauxLibres).toBeGreaterThan(0);
  });
});

describe("ce que la journée refuse de deviner", () => {
  it("une intervention SANS créneau n'occupe rien", () => {
    // Elle appartient au jour, pas à une heure. La poser à l'ouverture lui
    // donnerait un créneau que personne n'a saisi.
    const j = construireJournee(
      [pose({ id: "a", creneau_debut: null })],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    expect(j.colonnes[0].cellules.every((c) => c.etat !== "occupe")).toBe(true);
  });

  it("sans `creneau_fin`, la durée estimée sert de longueur", () => {
    const j = construireJournee(
      [
        pose({
          id: "a",
          creneau_debut: instant(LUNDI, 450),
          creneau_fin: null,
          duree_estimee_min: 90,
        }),
      ],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    expect(
      j.colonnes[0].cellules.filter((c) => c.etat === "occupe"),
    ).toHaveLength(3);
  });

  it("les non affectées viennent en PREMIÈRE colonne", () => {
    const j = construireJournee(
      [
        pose({ id: "a", technicien_id: "t9" }),
        pose({ id: "b", technicien_id: null }),
      ],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    expect(j.colonnes.map((c) => c.technicienId)).toEqual([null, "t9"]);
  });
});
