import { describe, expect, it } from "vitest";

import {
  jourDeLEtape,
  SANS_TRAJET,
  trajetDesJournees,
  type EtapeDeTournee,
} from "@/lib/interventions/trajet";

/**
 * LA LECTURE C — le trajet d'une journée (L3-05a, D107, RG-PLA-05).
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesurerait
 *
 * **LES TROIS LECTURES, CHIFFRÉES CÔTE À CÔTE.** L3-05 les nommait et donnait
 * leurs valeurs sur une journée à trois sites — **270, 120 et 105 minutes** —,
 * c'est-à-dire plusieurs heures d'écart par semaine et par technicien. Les
 * écrire toutes les trois ici est ce qui rend le choix VÉRIFIABLE : *un scénario
 * qui n'éprouverait que la lecture retenue ne dirait pas qu'elle en est une.*
 *
 * **L'ÉGALITÉ AVEC A SUR UNE JOURNÉE À UN SITE**, qui est la raison décisive de
 * D107 : C ne change rien au cas simple, et cesse de compter un retour qui n'a
 * pas eu lieu dès que la journée est groupée.
 *
 * **CE QUI N'EST PAS COMPTÉ EST COMPTÉ À PART.** Une journée dont une extrémité
 * a un trajet inconnu — un lieu sans zone, ou les Îles (D107) — n'additionne pas
 * zéro : *« aucun trajet » et « je ne sais pas » ne se corrigent pas au même
 * endroit.*
 *
 * **ET L'ORDRE REÇU EST L'ORDRE COMPTÉ.** Le module ne trie pas ; un scénario le
 * PROUVE en renversant l'ordre et en montrant que le total change. Sans lui,
 * « ce module ne trie pas » serait une phrase de commentaire.
 */

/** Une étape d'un jour donné, écrite courte pour que les scénarios se lisent. */
function etape(jour: string | null, trajetMin: number | null): EtapeDeTournee {
  return { jour, trajetMin };
}

/** La lecture A, écrite ICI pour être comparée — aller-retour PAR intervention. */
function lectureA(etapes: readonly EtapeDeTournee[]): number {
  return etapes.reduce((total, e) => total + 2 * (e.trajetMin ?? 0), 0);
}

/** La lecture B, écrite ICI pour être comparée — `2 × max` sur la journée. */
function lectureB(etapes: readonly EtapeDeTournee[]): number {
  return 2 * Math.max(...etapes.map((e) => e.trajetMin ?? 0));
}

describe("les trois lectures, sur la journée à trois sites de L3-05", () => {
  // 60, 30 puis 45 minutes depuis l'établissement — la journée du ticket.
  const journee = [
    etape("2026-09-14", 60),
    etape("2026-09-14", 30),
    etape("2026-09-14", 45),
  ];

  it("A donne 270, B donne 120, et C — celle de D107 — donne 105", () => {
    // Les trois sont chiffrées côte à côte : c'est ce qui rend le choix
    // vérifiable plutôt que déclaré.
    expect(lectureA(journee)).toBe(270);
    expect(lectureB(journee)).toBe(120);
    expect(trajetDesJournees(journee).minutes).toBe(105);
  });

  it("C compte UN aller et UN retour, et rien entre les deux", () => {
    // 60 (aller vers le premier) + 45 (retour depuis le dernier). Le site du
    // milieu — 30 — n'entre pas : *le temps d'un lieu à un autre n'est pas
    // connu, et il n'est pas compté.*
    const trajet = trajetDesJournees(journee);
    expect(trajet.minutes).toBe(60 + 45);
    expect(trajet.journees).toBe(1);
    expect(trajet.journeesSansTrajet).toBe(0);
  });

  it("l'ORDRE REÇU décide des extrémités — et le RENVERSEMENT n'y change rien", () => {
    // ── DEUX CONSTATS, ET LE SECOND EST CELUI QU'ON AURAIT CRU MESURER ─────
    //
    // **Renverser la journée ne change PAS le total, et c'est une propriété de
    // la lecture C** : `premier + dernier` est symétrique. Un scénario qui
    // aurait « prouvé que l'ordre compte » en renversant la liste n'aurait donc
    // rien prouvé du tout — il serait vert dans les deux cas (§9, 11/09 : un
    // vert mérité pour la mauvaise raison).
    const renversee = [...journee].reverse();
    expect(trajetDesJournees(renversee).minutes).toBe(105);

    // **Ce qui change le total est de DÉPLACER un site d'une extrémité vers le
    // milieu.** C'est la vraie dépendance à l'ordre, et c'est elle qui rend
    // « ce module ne trie pas » vérifiable : trier ici compterait les
    // extrémités d'une journée que personne ne voit (§9, 01/09).
    const autreDebut = [
      etape("2026-09-14", 200),
      etape("2026-09-14", 10),
      etape("2026-09-14", 20),
    ];
    expect(trajetDesJournees(autreDebut).minutes).toBe(220);
    const memesSitesAutreOrdre = [
      etape("2026-09-14", 10),
      etape("2026-09-14", 200),
      etape("2026-09-14", 20),
    ];
    expect(trajetDesJournees(memesSitesAutreOrdre).minutes).toBe(30);
  });
});

describe("une journée à UN site donne exactement la lecture A", () => {
  it("le site est à la fois premier et dernier", () => {
    // *La raison décisive de D107* : C ne change rien au cas simple.
    const seule = [etape("2026-09-14", 90)];
    expect(trajetDesJournees(seule).minutes).toBe(180);
    expect(trajetDesJournees(seule).minutes).toBe(lectureA(seule));
    // Vert POUR SA PROPRE RAISON : sur trois sites, les deux DIFFÈRENT — sans
    // quoi l'égalité ci-dessus pourrait venir d'une lecture A déguisée.
    const trois = [
      etape("2026-09-14", 60),
      etape("2026-09-14", 30),
      etape("2026-09-14", 45),
    ];
    expect(trajetDesJournees(trois).minutes).not.toBe(lectureA(trois));
  });
});

describe("ce qui n'est pas connu est compté à part", () => {
  it("un ALLER inconnu ne compte pas zéro : la journée se dit", () => {
    const trajet = trajetDesJournees([
      etape("2026-09-14", null),
      etape("2026-09-14", 45),
    ]);
    expect(trajet.minutes).toBe(0);
    expect(trajet.journees).toBe(0);
    expect(trajet.journeesSansTrajet).toBe(1);
  });

  it("un RETOUR inconnu aussi — les deux extrémités comptent", () => {
    // Le second sens est celui qu'on oublie : un contrôle qui ne regarderait
    // que la première étape passerait celui-ci sans rien dire.
    const trajet = trajetDesJournees([
      etape("2026-09-14", 60),
      etape("2026-09-14", null),
    ]);
    expect(trajet.journeesSansTrajet).toBe(1);
    expect(trajet.minutes).toBe(0);
  });

  it("un MILIEU inconnu ne gêne pas : il n'entre dans aucun calcul", () => {
    // Vert pour sa propre raison, et ce n'est pas une tolérance : la lecture C
    // ne lit PAS le milieu, donc son absence n'a rien à dire.
    const trajet = trajetDesJournees([
      etape("2026-09-14", 60),
      etape("2026-09-14", null),
      etape("2026-09-14", 45),
    ]);
    expect(trajet.minutes).toBe(105);
    expect(trajet.journeesSansTrajet).toBe(0);
  });

  it("une journée inconnue n'empêche pas les autres d'être comptées", () => {
    const trajet = trajetDesJournees([
      etape("2026-09-14", 30),
      etape("2026-09-15", null),
      etape("2026-09-16", 90),
    ]);
    expect(trajet.minutes).toBe(60 + 180);
    expect(trajet.journees).toBe(2);
    expect(trajet.journeesSansTrajet).toBe(1);
  });
});

describe("ce qui n'a pas de jour n'a pas de trajet", () => {
  it("la FILE D'ATTENTE ne compte ni minute ni journée inconnue", () => {
    // *Personne n'y est allé* : une intervention non datée n'est pas une
    // journée dont on ignorerait le trajet, c'est une journée qui n'existe pas.
    const trajet = trajetDesJournees([
      etape(null, 90),
      etape(null, null),
      etape("2026-09-14", 30),
    ]);
    expect(trajet.minutes).toBe(60);
    expect(trajet.journees).toBe(1);
    expect(trajet.journeesSansTrajet).toBe(0);
  });

  it("aucune étape rend un trajet nul, et c'est `SANS_TRAJET`", () => {
    expect(trajetDesJournees([])).toEqual(SANS_TRAJET);
  });
});

describe("la clé de journée ne lit aucun fuseau", () => {
  it("une DATE rend son jour, tel quel", () => {
    // La colonne est un `DATE` : Prisma rend minuit UTC, et la journée est déjà
    // une journée. La rapporter à un fuseau la décalerait d'un cran sous UTC+11
    // — le trajet du 1ᵉʳ se rangerait au 31.
    expect(jourDeLEtape(new Date("2026-09-14T00:00:00.000Z"))).toBe(
      "2026-09-14",
    );
    expect(jourDeLEtape(new Date("2026-01-01T00:00:00.000Z"))).toBe(
      "2026-01-01",
    );
  });

  it("et l'absence de date rend `null`, jamais une journée d'aujourd'hui", () => {
    expect(jourDeLEtape(null)).toBeNull();
  });

  it("deux interventions du MÊME jour tombent dans la MÊME journée", () => {
    // Le témoin qui rend le regroupement lisible : sans lui, une clé trop fine
    // ferait deux journées d'une seule, et compterait deux allers-retours.
    const a = jourDeLEtape(new Date("2026-09-14T00:00:00.000Z"));
    const b = jourDeLEtape(new Date("2026-09-14T00:00:00.000Z"));
    expect(a).toBe(b);
    expect(
      trajetDesJournees([etape(a, 60), etape(b, 45)]).journees,
      "deux interventions du même jour font UNE journée",
    ).toBe(1);
  });
});
