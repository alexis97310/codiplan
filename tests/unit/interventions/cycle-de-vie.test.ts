import { describe, expect, it } from "vitest";

import {
  estFige,
  peutAffecter,
  peutAnnuler,
  peutCloturer,
  peutDemarrerLeCompteur,
  peutDeplacer,
  peutEcrireSansDuree,
  peutGarderHeure,
  peutGenererLeBon,
  peutPlanifier,
  peutTerminer,
  peutTransmettre,
  motifsNonTransmissible,
  statutALaCreation,
} from "@/lib/interventions/cycle-de-vie";

/**
 * LE CYCLE DE VIE D'UNE INTERVENTION (lot 2, D84 ; I5 pour la préséance).
 *
 * Ce module n'est pas ce qui GARDE — la base garde, par
 * `intervention_cycle_de_vie`, et `tests/isolation/intervention.test.ts` le
 * mesure. Ce qu'on éprouve ici est **ce que l'écran dit avant d'agir**, et les
 * deux doivent dire la même chose : *une action refusée à l'écran mais acceptée
 * par la base est un trou ; l'inverse est un écran qui ment.*
 */

describe("le figeage, et l'issue que I5 laisse ouverte", () => {
  it("clôturée et annulée sont figées", () => {
    expect(estFige("cloturee")).toBe(true);
    expect(estFige("annulee")).toBe(true);
  });

  it("aucun autre statut ne l'est — et c'est le cas qui DOIT rester vert", () => {
    // Le pendant du cas ci-dessus (§9, 11/09). Si `estFige` retournait `true`
    // pour tout, le premier cas passerait et le planning serait inutilisable.
    for (const statut of [
      "a_planifier",
      "planifiee",
      "affectee",
      "en_cours",
      "suspendue",
      "terminee",
    ] as const) {
      expect(estFige(statut), statut).toBe(false);
    }
  });

  it("ANNULER une intervention CLÔTURÉE reste possible — I5 le veut", () => {
    // La préséance de I5 : ANNULEE > CLOTUREE. Une intervention clôturée par
    // erreur doit pouvoir être annulée, sinon l'invariant serait vrai dans la
    // synchronisation et faux à l'écran.
    expect(peutAnnuler("cloturee").refuse).toBe(false);
  });

  it("mais on n'annule pas ce qui est déjà annulé", () => {
    const verdict = peutAnnuler("annulee");
    expect(verdict.refuse).toBe(true);
    expect(verdict.refuse && verdict.cle).toBe(
      "intervention.refus.deja_annulee",
    );
  });
});

describe("déplacer et affecter", () => {
  it("sont refusés sur une figée, avec la raison qui la nomme", () => {
    const surCloturee = peutDeplacer("cloturee");
    expect(surCloturee.refuse && surCloturee.cle).toBe(
      "intervention.refus.cloturee_figee",
    );
    const surAnnulee = peutAffecter("annulee");
    expect(surAnnulee.refuse && surAnnulee.cle).toBe(
      "intervention.refus.annulee_figee",
    );
  });

  it("passent sur une intervention vivante", () => {
    expect(peutDeplacer("planifiee").refuse).toBe(false);
    expect(peutAffecter("en_cours").refuse).toBe(false);
  });
});

describe("clôturer — c'est-à-dire VALIDER le temps mesuré (D120)", () => {
  it("est refusée quand AUCUN compteur n'a tourné", () => {
    // ~~sans temps saisi~~ : ce que la garde juge est désormais le temps
    // MESURÉ. *Le compteur est la seule source du temps* — et la conséquence
    // est assumée : une intervention sur laquelle personne n'a démarré de
    // compteur ne se clôture pas dans CODIPLAN, elle se traite dans Winpro au
    // moment de facturer.
    const sansMesure = peutCloturer("terminee", null);
    expect(sansMesure.refuse && sansMesure.cle).toBe(
      "intervention.refus.temps_manquant",
    );
    // Zéro aussi : sous D83, zéro minute facturerait quand même le plancher
    // d'une heure. Une intervention qui n'a pas eu lieu s'annule.
    expect(peutCloturer("terminee", 0).refuse).toBe(true);
  });

  it("passe avec un temps mesuré, et refuse la seconde fois", () => {
    expect(peutCloturer("terminee", 12).refuse).toBe(false);
    const deja = peutCloturer("cloturee", 12);
    expect(deja.refuse && deja.cle).toBe("intervention.refus.deja_cloturee");
  });
});

describe("peutTerminer — EN COURS → TERMINÉE (9DE-TP-CY1, D8 à la lettre : QT-4(a))", () => {
  it("passe : en cours, un temps mesuré, une issue de signature", () => {
    expect(peutTerminer("en_cours", 12, "signee").refuse).toBe(false);
    expect(peutTerminer("en_cours", 12, "client_absent").refuse).toBe(false);
    expect(peutTerminer("en_cours", 12, "refus_signature").refuse).toBe(false);
  });

  it("refuse une FIGÉE avec sa clé habituelle, avant tout autre critère", () => {
    const annulee = peutTerminer("annulee", 12, "signee");
    expect(annulee.refuse && annulee.cle).toBe(
      "intervention.refus.annulee_figee",
    );
    const cloturee = peutTerminer("cloturee", 12, "signee");
    expect(cloturee.refuse && cloturee.cle).toBe(
      "intervention.refus.cloturee_figee",
    );
  });

  it("refuse tout statut qui n'est pas en_cours — un cas par statut", () => {
    for (const statut of [
      "a_planifier",
      "planifiee",
      "affectee",
      "suspendue",
      "terminee",
    ] as const) {
      const verdict = peutTerminer(statut, 12, "signee");
      expect(verdict.refuse && verdict.cle, statut).toBe(
        "intervention.refus.pas_en_cours",
      );
    }
  });

  it("refuse sans temps mesuré — même garde que peutCloturer, RG-INT-02", () => {
    const sansMesure = peutTerminer("en_cours", null, "signee");
    expect(sansMesure.refuse && sansMesure.cle).toBe(
      "intervention.refus.temps_manquant",
    );
    expect(peutTerminer("en_cours", 0, "signee").refuse).toBe(true);
  });

  it("refuse sans issue de signature", () => {
    const verdict = peutTerminer("en_cours", 12, null);
    expect(verdict.refuse && verdict.cle).toBe(
      "intervention.refus.signature_manquante",
    );
  });

  it("l'ordre des gardes : figée avant statut, statut avant temps, temps avant signature", () => {
    // Une FIGÉE sans rien d'autre donne la clé de la figée, jamais une autre.
    expect((peutTerminer("cloturee", null, null) as { cle: string }).cle).toBe(
      "intervention.refus.cloturee_figee",
    );
    // Un mauvais statut, même sans temps ni signature, donne SA clé.
    expect((peutTerminer("suspendue", null, null) as { cle: string }).cle).toBe(
      "intervention.refus.pas_en_cours",
    );
    // en_cours sans rien d'autre : le temps manque avant la signature.
    expect((peutTerminer("en_cours", null, null) as { cle: string }).cle).toBe(
      "intervention.refus.temps_manquant",
    );
  });
});

describe("démarrer le compteur (D120)", () => {
  /**
   * **AUCUNE MACHINE N'EST EXIGÉE**, et c'est tout l'objet de D120 : *une
   * intervention peut porter sur autre chose qu'un équipement — un réseau
   * d'air comprimé.* Ce scénario ne peut pas le prouver à lui seul — la règle
   * vivait en BASE —, et c'est `tests/isolation/intervention-machines.test.ts`
   * qui le mesure. Ici on éprouve ce que la fonction décide, statut par statut.
   */
  it.each(["a_planifier", "planifiee", "affectee", "en_cours", "terminee"])(
    "passe sur une intervention « %s »",
    (statut) => {
      expect(
        peutDemarrerLeCompteur(statut as Parameters<typeof estFige>[0]).refuse,
      ).toBe(false);
    },
  );

  it("refuse une SUSPENDUE — elle se reprend, elle ne se redémarre pas", () => {
    const verdict = peutDemarrerLeCompteur("suspendue");
    expect(verdict.refuse && verdict.cle).toBe("compteur.refus.suspendue");
  });

  it("refuse les deux statuts FIGÉS, chacun avec sa clé", () => {
    const annulee = peutDemarrerLeCompteur("annulee");
    expect(annulee.refuse && annulee.cle).toBe(
      "intervention.refus.annulee_figee",
    );
    const cloturee = peutDemarrerLeCompteur("cloturee");
    expect(cloturee.refuse && cloturee.cle).toBe(
      "intervention.refus.deja_cloturee",
    );
  });
});

/**
 * LE BON D'INTERVENTION N'EXISTE QUE POUR UN TRAVAIL FAIT (AFFICHAGE-MATERIEL-1,
 * 23/09/2026).
 *
 * *Mesuré en production le 23/09/2026 : le lien « Bon d'intervention » était
 * proposé, et l'URL du bon le rendait, sur une intervention encore
 * `planifiee`.* Exactement deux statuts l'autorisent — jamais un troisième.
 */
describe("générer le bon d'intervention", () => {
  it("passe sur TERMINÉE et sur CLÔTURÉE, les deux seuls statuts autorisés", () => {
    expect(peutGenererLeBon("terminee").refuse).toBe(false);
    expect(peutGenererLeBon("cloturee").refuse).toBe(false);
  });

  it("refuse tout autre statut, avec le motif qui l'explique", () => {
    for (const statut of [
      "a_planifier",
      "planifiee",
      "affectee",
      "en_cours",
      "suspendue",
      "annulee",
    ] as const) {
      const verdict = peutGenererLeBon(statut);
      expect(verdict.refuse, statut).toBe(true);
      expect(verdict.refuse && verdict.cle).toBe(
        "intervention.bon.refus.non_terminee",
      );
    }
  });
});

describe("le statut à la création est DÉDUIT de la pose", () => {
  /**
   * **Le défaut que ce scénario ferme a été vu à l'écran, pas imaginé.** La
   * première rédaction ne regardait que le créneau : trois interventions datées
   * du 14 septembre s'affichaient « à planifier », rangées parmi les posées.
   * *Un statut qui contredit la ligne où il s'affiche est pire qu'un statut
   * absent.*
   */
  const jour = new Date(Date.UTC(2026, 8, 14));

  it("sans date NI créneau : file d'attente", () => {
    expect(statutALaCreation(null, null)).toBe("a_planifier");
  });

  it("avec une DATE seule : planifiée — c'est le défaut mesuré", () => {
    expect(statutALaCreation(jour, null)).toBe("planifiee");
  });

  it("avec un créneau : planifiée", () => {
    expect(statutALaCreation(null, jour)).toBe("planifiee");
    expect(statutALaCreation(jour, jour)).toBe("planifiee");
  });
});

/**
 * PEUT-ON PLANIFIER ? (PARCOURS-1, 23/09/2026, arbitrage Alexis)
 *
 * *« Une intervention ne peut pas passer au statut planifié/affecté sans »*
 * date, heure, durée prévue ET technicien — les quatre à la fois.
 */
describe("peutPlanifier — les quatre valeurs vont ensemble, ou pas du tout", () => {
  const TOUT = {
    datePlanifiee: new Date("2026-09-24"),
    debutMinutes: 480,
    dureeMin: 60,
    technicienId: "un-technicien",
  };
  const RIEN = {
    datePlanifiee: null,
    debutMinutes: null,
    dureeMin: null,
    technicienId: null,
  };

  it("une intervention déjà planifiée n'est JAMAIS jugée — un déplacement partiel reste permis", () => {
    for (const statut of [
      "planifiee",
      "affectee",
      "en_cours",
      "suspendue",
      "terminee",
      "cloturee",
      "annulee",
    ] as const) {
      expect(peutPlanifier(statut, RIEN).refuse).toBe(false);
      expect(peutPlanifier(statut, { ...RIEN, technicienId: "x" }).refuse).toBe(
        false,
      );
    }
  });

  it("`a_planifier`, RIEN donné : permis — ce n'est pas une planification, rien ne bouge", () => {
    expect(peutPlanifier("a_planifier", RIEN).refuse).toBe(false);
  });

  it("`a_planifier`, les QUATRE données : permis", () => {
    expect(peutPlanifier("a_planifier", TOUT).refuse).toBe(false);
  });

  it("`a_planifier`, la date manque : refusé et nommé", () => {
    const verdict = peutPlanifier("a_planifier", {
      ...TOUT,
      datePlanifiee: null,
    });
    expect(verdict.refuse && verdict.cle).toBe(
      "intervention.refus.planification_date_manquante",
    );
  });

  it("`a_planifier`, l'heure manque : refusé, nommé « durée manquante »", () => {
    const verdict = peutPlanifier("a_planifier", {
      ...TOUT,
      debutMinutes: null,
    });
    expect(verdict.refuse && verdict.cle).toBe(
      "intervention.refus.planification_duree_manquante",
    );
  });

  it("`a_planifier`, la durée manque : refusé, nommé « durée manquante »", () => {
    const verdict = peutPlanifier("a_planifier", { ...TOUT, dureeMin: null });
    expect(verdict.refuse && verdict.cle).toBe(
      "intervention.refus.planification_duree_manquante",
    );
  });

  it("`a_planifier`, le technicien manque : refusé et nommé", () => {
    const verdict = peutPlanifier("a_planifier", {
      ...TOUT,
      technicienId: null,
    });
    expect(verdict.refuse && verdict.cle).toBe(
      "intervention.refus.planification_technicien_manquant",
    );
  });

  it("`a_planifier`, technicien SEUL — le contournement que ce verdict ferme", () => {
    const verdict = peutPlanifier("a_planifier", {
      ...RIEN,
      technicienId: "x",
    });
    expect(verdict.refuse).toBe(true);
  });
});

/**
 * PEUT-ON GARDER L'HEURE ? (décision QG-4 d'Alexis, 27/09/2026)
 *
 * Une intervention déjà `planifiee`/`affectee` ne peut plus perdre son heure
 * en gardant sa date. Tout vider — date comprise — reste permis : c'est la
 * remettre dans la file.
 */
describe("peutGarderHeure — une planifiée/affectée garde son heure (QG-4)", () => {
  const DATE = new Date("2026-09-24");

  it("refuse une PLANIFIÉE dont la date reste donnée mais l'heure se vide", () => {
    const verdict = peutGarderHeure("planifiee", DATE, null);
    expect(verdict.refuse && verdict.cle).toBe(
      "intervention.refus.heure_obligatoire",
    );
  });

  it("refuse une AFFECTÉE dont la date reste donnée mais l'heure se vide", () => {
    const verdict = peutGarderHeure("affectee", DATE, null);
    expect(verdict.refuse && verdict.cle).toBe(
      "intervention.refus.heure_obligatoire",
    );
  });

  it("permet une PLANIFIÉE ou une AFFECTÉE qui garde sa date ET son heure", () => {
    expect(peutGarderHeure("planifiee", DATE, 480).refuse).toBe(false);
    expect(peutGarderHeure("affectee", DATE, 480).refuse).toBe(false);
  });

  it("permet de tout vider — la remettre dans la file", () => {
    expect(peutGarderHeure("planifiee", null, null).refuse).toBe(false);
    expect(peutGarderHeure("affectee", null, null).refuse).toBe(false);
  });

  it("ne juge pas les autres statuts", () => {
    for (const statut of [
      "a_planifier",
      "en_cours",
      "suspendue",
      "terminee",
      "cloturee",
      "annulee",
    ] as const) {
      expect(peutGarderHeure(statut, DATE, null).refuse, statut).toBe(false);
    }
  });
});

/**
 * PEUT-ON ÉCRIRE CETTE LIGNE ? (audit d'ergonomie du 27/09/2026, bug 4)
 *
 * `intervention_planifiee_a_sa_duree` (`NOT VALID`) refuse toute ligne
 * réécrite — pas seulement créée — dont le statut après écriture est
 * `planifiee`/`affectee` sans durée. Ce verdict le dit AVANT l'écriture.
 */
describe("peutEcrireSansDuree — la garde qui précède le 23514 de production", () => {
  it("refuse une ligne PLANIFIÉE sans durée", () => {
    const verdict = peutEcrireSansDuree("planifiee", null);
    expect(verdict.refuse && verdict.cle).toBe(
      "intervention.refus.planifiee_sans_duree",
    );
  });

  it("refuse une ligne AFFECTÉE sans durée", () => {
    const verdict = peutEcrireSansDuree("affectee", null);
    expect(verdict.refuse && verdict.cle).toBe(
      "intervention.refus.planifiee_sans_duree",
    );
  });

  it("passe une PLANIFIÉE ou une AFFECTÉE qui porte sa durée", () => {
    expect(peutEcrireSansDuree("planifiee", 60).refuse).toBe(false);
    expect(peutEcrireSansDuree("affectee", 60).refuse).toBe(false);
  });

  it("ne juge pas les autres statuts — retirer du planning reste permis", () => {
    for (const statut of [
      "a_planifier",
      "en_cours",
      "suspendue",
      "terminee",
      "cloturee",
      "annulee",
    ] as const) {
      expect(peutEcrireSansDuree(statut, null).refuse, statut).toBe(false);
    }
  });
});

/**
 * PEUT-ON TRANSMETTRE UNE PLANIFIÉE AU TECHNICIEN ? (QG-5, D141,
 * 9CO-PG-G14A-TRANSMETTRE) — seule une `planifiee` qui porte les quatre
 * valeurs (date, heure, durée, technicien) se transmet.
 */
describe("peutTransmettre — Planifiée → Affectée (D141)", () => {
  const COMPLETE = {
    statut: "planifiee" as const,
    technicienId: "un-technicien",
    datePlanifiee: new Date("2026-10-12T00:00:00.000Z"),
    debutMinutes: 480,
    dureeMin: 60,
  };

  it("permet une Planifiée complète", () => {
    expect(peutTransmettre(COMPLETE).refuse).toBe(false);
  });

  it("refuse chaque statut autre que planifiee", () => {
    for (const statut of [
      "a_planifier",
      "affectee",
      "en_cours",
      "suspendue",
      "terminee",
      "cloturee",
      "annulee",
    ] as const) {
      const verdict = peutTransmettre({ ...COMPLETE, statut });
      expect(verdict.refuse, statut).toBe(true);
      expect(verdict.refuse && verdict.cle, statut).toBe(
        "intervention.refus.pas_planifiee",
      );
    }
  });

  it("refuse — nommée — l'absence de date", () => {
    const verdict = peutTransmettre({ ...COMPLETE, datePlanifiee: null });
    expect(verdict.refuse && verdict.cle).toBe(
      "intervention.refus.transmission_date_manquante",
    );
  });

  it("refuse — nommée — l'absence d'heure", () => {
    const verdict = peutTransmettre({ ...COMPLETE, debutMinutes: null });
    expect(verdict.refuse && verdict.cle).toBe(
      "intervention.refus.transmission_duree_manquante",
    );
  });

  it("refuse — nommée — l'absence de durée", () => {
    const verdict = peutTransmettre({ ...COMPLETE, dureeMin: null });
    expect(verdict.refuse && verdict.cle).toBe(
      "intervention.refus.transmission_duree_manquante",
    );
  });

  it("refuse — nommée — l'absence de technicien", () => {
    const verdict = peutTransmettre({ ...COMPLETE, technicienId: null });
    expect(verdict.refuse && verdict.cle).toBe(
      "intervention.refus.transmission_technicien_manquant",
    );
  });
});

describe("motifsNonTransmissible — le tri pret/laissée (9CP-PG-G14B-TRANSMETTRE-GROUPE)", () => {
  const COMPLETE = {
    technicienId: "un-technicien",
    debutMinutes: 480,
    dureeMin: 60,
  };

  it("une ligne complète n'a aucun motif — elle est prête", () => {
    expect(motifsNonTransmissible(COMPLETE)).toEqual([]);
  });

  it("nomme sans_technicien seule", () => {
    expect(motifsNonTransmissible({ ...COMPLETE, technicienId: null })).toEqual(
      ["sans_technicien"],
    );
  });

  it("nomme sans_heure seule", () => {
    expect(motifsNonTransmissible({ ...COMPLETE, debutMinutes: null })).toEqual(
      ["sans_heure"],
    );
  });

  it("nomme sans_duree seule", () => {
    expect(motifsNonTransmissible({ ...COMPLETE, dureeMin: null })).toEqual([
      "sans_duree",
    ]);
  });

  it("nomme LES DEUX manques à la fois, jamais seulement le premier", () => {
    // `peutTransmettre` s'arrête au premier refus (heure avant technicien) ;
    // ce tri ne doit en cacher aucun pour une ligne laissée à l'écran.
    expect(
      motifsNonTransmissible({
        technicienId: null,
        debutMinutes: null,
        dureeMin: 60,
      }),
    ).toEqual(["sans_technicien", "sans_heure"]);
  });

  it("nomme les trois manques à la fois", () => {
    expect(
      motifsNonTransmissible({
        technicienId: null,
        debutMinutes: null,
        dureeMin: null,
      }),
    ).toEqual(["sans_technicien", "sans_heure", "sans_duree"]);
  });

  // ── DÉCISION D'ALEXIS DU 02/10/2026, POINT 7 (D141, 9CT-RETOUCHES-5) ──────
  //
  // « Transmettre toutes les planifiées prêtes » exclut les Planifiées déjà
  // passées. `aPartirDe` est le SEUL point d'entrée de cette date-ci : omis,
  // le motif ne se pose jamais, même sur une ligne dont la date est ancienne
  // — c'est « Transmettre demain », qui ne le fournit pas.
  const BORNE = new Date("2026-11-16T00:00:00.000Z");

  it("omis, aPartirDe ne pose jamais date_passee, même sur une date ancienne", () => {
    expect(
      motifsNonTransmissible({
        ...COMPLETE,
        datePlanifiee: new Date("2020-01-01T00:00:00.000Z"),
      }),
    ).toEqual([]);
  });

  it("nomme date_passee seule, quand la date est avant la borne", () => {
    expect(
      motifsNonTransmissible(
        { ...COMPLETE, datePlanifiee: new Date("2026-11-09T00:00:00.000Z") },
        BORNE,
      ),
    ).toEqual(["date_passee"]);
  });

  it("ne nomme pas date_passee quand la date égale la borne (inclusive)", () => {
    expect(
      motifsNonTransmissible({ ...COMPLETE, datePlanifiee: BORNE }, BORNE),
    ).toEqual([]);
  });

  it("ne nomme pas date_passee quand la date est après la borne", () => {
    expect(
      motifsNonTransmissible(
        { ...COMPLETE, datePlanifiee: new Date("2026-11-23T00:00:00.000Z") },
        BORNE,
      ),
    ).toEqual([]);
  });

  it("cumule date_passee avec les autres manques, jamais à sa place", () => {
    expect(
      motifsNonTransmissible(
        {
          technicienId: null,
          debutMinutes: null,
          dureeMin: 60,
          datePlanifiee: new Date("2026-11-09T00:00:00.000Z"),
        },
        BORNE,
      ),
    ).toEqual(["sans_technicien", "sans_heure", "date_passee"]);
  });
});
