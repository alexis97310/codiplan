import { describe, expect, it } from "vitest";

import {
  ORDRE_STATUTS,
  minutesEngagees,
  occupationTechnicien,
  partDuSegment,
  tauxArrondiAZeroMaisNonNul,
  tauxOccupation,
  type InterventionMesuree,
} from "@/lib/interventions/statistiques";
import { SANS_TRAJET } from "@/lib/interventions/trajet";

/**
 * STATISTIQUES PAR TECHNICIEN — *demande d'exploitation du 10/09/2026 :*
 * « nombre d'interventions et taux d'occupation, barre segmentée des heures,
 * **formule écrite à côté. Jamais le pourcentage seul.** »
 *
 * Ce fichier éprouve le calcul ; le gardien qui interdit d'afficher le
 * pourcentage sans ses deux termes est dans
 * `tests/unit/interventions/occupation-affichee.test.ts` — c'est une propriété
 * de l'ÉCRAN, pas du calcul.
 */

const TECHNICIEN = "0192f0a0-9000-7000-8000-000000000001";

function ligne(
  surcharge: Partial<InterventionMesuree> = {},
): InterventionMesuree {
  return {
    statut: "planifiee",
    technicien_id: TECHNICIEN,
    temps_reel_min: null,
    duree_estimee_min: 120,
    ...surcharge,
  };
}

describe("les minutes qu'une intervention occupe", () => {
  it("préfère le temps RÉEL à l'estimation — c'est ce qui s'est passé", () => {
    expect(
      minutesEngagees(ligne({ temps_reel_min: 95, duree_estimee_min: 120 })),
    ).toBe(95);
  });

  it("retombe sur l'estimation quand le réel manque — c'est ce qui est engagé", () => {
    expect(minutesEngagees(ligne({ duree_estimee_min: 120 }))).toBe(120);
  });

  it("rend NULL quand ni l'un ni l'autre n'est saisi, jamais zéro", () => {
    // Zéro se confondrait avec « n'a rien occupé ». Le `null` remonte dans
    // `sansDuree`, que l'écran affiche à côté du taux.
    expect(minutesEngagees(ligne({ duree_estimee_min: null }))).toBeNull();
  });

  it("une ANNULÉE ne compte que par son temps réel (I5)", () => {
    // *Le travail terrain n'est jamais perdu* : deux heures sur site avant
    // l'annulation ont occupé deux heures.
    expect(
      minutesEngagees(
        ligne({
          statut: "annulee",
          temps_reel_min: 120,
          duree_estimee_min: 90,
        }),
      ),
    ).toBe(120);
    // Mais une annulation avant déplacement n'a rien occupé, et son estimation
    // décrit un travail qui n'aura pas lieu.
    expect(
      minutesEngagees(ligne({ statut: "annulee", duree_estimee_min: 90 })),
    ).toBeNull();
  });
});

describe("l'occupation d'un technicien", () => {
  it("rend le NOMBRE et les DEUX termes du taux, jamais un pourcentage", () => {
    const o = occupationTechnicien(
      TECHNICIEN,
      [ligne({ duree_estimee_min: 120 }), ligne({ temps_reel_min: 90 })],
      // 7 h ouvrables sur la période.
      420,
      SANS_TRAJET,
    );
    expect(o.interventions).toBe(2);
    expect(o.minutesEngagees).toBe(210);
    expect(o.minutesOuvrables).toBe(420);
    // LA PROPRIÉTÉ QUI COMPTE : le type ne porte AUCUN pourcentage. Un objet
    // qui en porterait un pourrait être transporté sans ses termes.
    expect(Object.keys(o)).not.toContain("taux");
    expect(Object.keys(o)).not.toContain("pourcentage");
    expect(tauxOccupation(o)).toBe(50);
  });

  it("compte à part les interventions SANS durée — l'écart est dit, pas dissous", () => {
    // Sans ce compteur, un planning entièrement saisi sans durées afficherait
    // 0 % sur un technicien débordé, et le chiffre serait juste (§9, 06/09).
    const o = occupationTechnicien(
      TECHNICIEN,
      [ligne({ duree_estimee_min: null }), ligne({ duree_estimee_min: null })],
      420,
      SANS_TRAJET,
    );
    expect(o.interventions).toBe(2);
    expect(o.sansDuree).toBe(2);
    expect(o.minutesEngagees).toBe(0);
    expect(tauxOccupation(o)).toBe(0);
  });

  it("garde les segments VIDES : la barre a toujours la même grammaire", () => {
    const o = occupationTechnicien(TECHNICIEN, [ligne()], 420, SANS_TRAJET);
    expect(o.segments.map((s) => s.statut)).toEqual([...ORDRE_STATUTS]);
    // L'ordre est celui du CYCLE DE VIE, jamais l'alphabet : « annulee »
    // viendrait en tête et « a_planifier » juste après, ce qui ne se lit pas.
    expect(o.segments[0]?.statut).toBe("a_planifier");
    expect(o.segments.at(-1)?.statut).toBe("annulee");
  });

  it("range chaque intervention dans le segment de son statut", () => {
    const o = occupationTechnicien(
      TECHNICIEN,
      [
        ligne({ statut: "cloturee", temps_reel_min: 60 }),
        ligne({ statut: "cloturee", temps_reel_min: 30 }),
        ligne({ statut: "en_cours", duree_estimee_min: 120 }),
      ],
      480,
      SANS_TRAJET,
    );
    const cloturee = o.segments.find((s) => s.statut === "cloturee");
    expect(cloturee).toEqual({
      statut: "cloturee",
      minutes: 90,
      interventions: 2,
    });
    expect(o.minutesEngagees).toBe(210);
  });
});

describe("le taux d'occupation", () => {
  it("rend NULL sur un dénominateur nul — « pas de calendrier » n'est pas « 0 % »", () => {
    // Rendre zéro accuserait un technicien de n'avoir rien fait là où c'est le
    // paramétrage qui manque. Deux causes, deux corrections différentes.
    const o = occupationTechnicien(TECHNICIEN, [ligne()], 0, SANS_TRAJET);
    expect(tauxOccupation(o)).toBeNull();
    // …et le cas voisin reste vert POUR SA PROPRE RAISON : un technicien sans
    // aucune intervention sur une période ouvrable rend bien 0 %.
    const vide = occupationTechnicien(TECHNICIEN, [], 420, SANS_TRAJET);
    expect(tauxOccupation(vide)).toBe(0);
  });

  it("DÉPASSE 100 sans être plafonné — c'est le seul cas qui demande une action", () => {
    // Un technicien qui travaille hors des heures d'ouverture est sur-occupé.
    // Plafonner masquerait exactement ce qu'un planificateur doit voir.
    const o = occupationTechnicien(
      TECHNICIEN,
      [ligne({ temps_reel_min: 600 })],
      420,
      SANS_TRAJET,
    );
    expect(tauxOccupation(o)).toBe(143);
  });

  it("arrondit au plus proche, sans dériver", () => {
    const o = occupationTechnicien(
      TECHNICIEN,
      [ligne({ temps_reel_min: 209 })],
      420,
      SANS_TRAJET,
    );
    // 209 / 420 = 49,76 %
    expect(tauxOccupation(o)).toBe(50);
  });
});

describe("la barre segmentée", () => {
  it("somme à 100 % de sa propre largeur, jamais des heures ouvrables", () => {
    // Une barre dont les segments ne somment pas à sa largeur se lit comme un
    // défaut d'affichage. Le taux, lui, se lit à côté avec sa formule.
    const o = occupationTechnicien(
      TECHNICIEN,
      [
        ligne({ statut: "cloturee", temps_reel_min: 60 }),
        ligne({ statut: "en_cours", duree_estimee_min: 180 }),
      ],
      // Volontairement très supérieur au total engagé.
      2400,
      SANS_TRAJET,
    );
    const total = o.segments.reduce((n, s) => n + partDuSegment(s, o), 0);
    expect(Math.round(total)).toBe(100);
    expect(Math.round(partDuSegment(o.segments[6]!, o))).toBe(25);
  });

  it("ne divise pas par zéro quand rien n'est engagé", () => {
    const o = occupationTechnicien(TECHNICIEN, [], 420, SANS_TRAJET);
    expect(o.segments.every((s) => partDuSegment(s, o) === 0)).toBe(true);
  });
});

describe("« 0 % » ne s'affiche pas sur du temps réellement engagé", () => {
  /**
   * **La capture d'écran a posé la question, aucune assertion ne l'aurait
   * posée.** Sur le planning de démonstration : *« 01:35 engagées · 548:00
   * ouvrables · Taux d'occupation 0 % »*. Le calcul est juste, la ligne se
   * contredit — zéro pour cent se lit « n'a rien fait » (§9, 09/09 : un défaut
   * invisible à toute assertion et évident sur une image).
   */
  it("reconnaît le taux qui s'arrondit à zéro sans être nul", () => {
    const o = occupationTechnicien(
      TECHNICIEN,
      [ligne({ temps_reel_min: 95 })],
      32_880,
      SANS_TRAJET,
    );
    expect(tauxOccupation(o)).toBe(0);
    expect(tauxArrondiAZeroMaisNonNul(o)).toBe(true);
  });

  it("et le distingue du VRAI zéro — vert pour SA propre raison", () => {
    // Aucune minute engagée : « 0 % » est alors exact, et c'est ce qu'il faut
    // afficher. Les deux cas rendent le même chiffre et ne disent pas la même
    // chose ; c'est très exactement pour cela que la distinction existe.
    const rien = occupationTechnicien(TECHNICIEN, [], 32_880, SANS_TRAJET);
    expect(tauxOccupation(rien)).toBe(0);
    expect(tauxArrondiAZeroMaisNonNul(rien)).toBe(false);
  });

  it("ne se déclenche pas sur un dénominateur inconnu", () => {
    // Là, il n'y a pas de taux du tout : `tauxOccupation` rend `null`, et la
    // question « est-il infime ? » n'a pas de sens.
    const sansCalendrier = occupationTechnicien(
      TECHNICIEN,
      [ligne({ temps_reel_min: 95 })],
      0,
      SANS_TRAJET,
    );
    expect(tauxOccupation(sansCalendrier)).toBeNull();
    expect(tauxArrondiAZeroMaisNonNul(sansCalendrier)).toBe(false);
  });
});
