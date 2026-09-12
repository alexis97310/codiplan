import { describe, expect, it } from "vitest";

import {
  ruptures,
  rupturesDeService,
  type InterventionRendue,
} from "@/lib/absences/rupture-de-service";

/**
 * RG-PLA-06, LA MOITIÉ QUI RESTAIT (L3-04a, D106).
 *
 * *« Tant que l'effectif est d'un seul technicien, l'absence déclenche une
 * alerte de rupture de service et propose le report groupé. »* L3-04 rendait
 * déjà les interventions à la file ; il manquait l'ALERTE.
 *
 * **Et il ne manquait pas de moteur.** D106 : le report groupé rend les
 * interventions ENSEMBLE et ne propose AUCUN créneau. Un scénario le mesure
 * ci-dessous plutôt que de l'espérer — *c'est ce que l'acceptation demande.*
 */

const ducos = "0192f0a0-3000-7000-8000-00000000d001";
const kone = "0192f0a0-3000-7000-8000-00000000d002";

const rendue = (id: string, agenceId: string): InterventionRendue => ({
  id,
  agenceId,
});

describe("l'alerte se déclenche à EFFECTIF UN, et pas à deux", () => {
  it("une agence d'UN technicien actif est en rupture", () => {
    const verdicts = rupturesDeService(
      [rendue("i1", kone), rendue("i2", kone)],
      new Map([[kone, 1]]),
    );

    expect(verdicts).toEqual([
      { etat: "rupture", agenceId: kone, interventions: ["i1", "i2"] },
    ]);
  });

  // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09). Une règle
  // qui alerterait toujours serait verte sur le scénario ci-dessus et
  // décrirait une alerte qu'on apprend à ne plus lire (§9, 11/09).
  it("une agence de DEUX ne l'est pas — et le verdict le DIT", () => {
    const verdicts = rupturesDeService(
      [rendue("i1", ducos)],
      new Map([[ducos, 2]]),
    );

    expect(verdicts).toEqual([
      { etat: "effectif_suffisant", agenceId: ducos, effectif: 2 },
    ]);
    expect(ruptures(verdicts)).toEqual([]);
  });

  it("une agence à ZÉRO technicien actif est la rupture la plus complète", () => {
    // Elle n'est pas « inconnue » : le dépôt amorce chaque agence touchée à
    // zéro précisément parce que `groupBy` ne rend aucune ligne pour un compte
    // nul. *Sans cela, l'agence qui n'a plus personne tomberait sous le
    // verdict qui n'alerte PAS.*
    expect(
      rupturesDeService([rendue("i1", kone)], new Map([[kone, 0]]))[0],
    ).toMatchObject({ etat: "rupture" });
  });

  it("L'ABSENT COMPTE dans l'effectif — sinon « un » deviendrait « zéro »", () => {
    // *Être absent quinze jours ne rend pas inactif*, et le seuil de D106 —
    // « un seul technicien actif » — cesserait de vouloir dire ce qu'il dit.
    // Un effectif de 1 est donc la rupture, jamais un effectif de 0 attendu.
    expect(
      rupturesDeService([rendue("i1", kone)], new Map([[kone, 1]]))[0],
    ).toMatchObject({ etat: "rupture" });
  });
});

describe("LA MAILLE est l'agence de l'INTERVENTION, jamais la société", () => {
  it("deux agences touchées rendent DEUX verdicts distincts", () => {
    // *Compter par société ferait taire l'alerte à Koné parce que Ducos a du
    // monde, et personne à Koné n'irait remplacer l'absent* (D106).
    const verdicts = rupturesDeService(
      [rendue("i1", ducos), rendue("i2", kone), rendue("i3", ducos)],
      new Map([
        [ducos, 4],
        [kone, 1],
      ]),
    );

    expect(verdicts).toHaveLength(2);
    expect(ruptures(verdicts)).toEqual([
      { etat: "rupture", agenceId: kone, interventions: ["i2"] },
    ]);
  });

  it("et c'est l'agence de l'INTERVENTION, pas celle de l'absent (D112)", () => {
    // Un technicien de Ducos posé en renfort à Koné : ce qui se rompt est le
    // service rendu À KONÉ. La règle ne reçoit jamais l'agence de l'absent —
    // le type ne la porte pas, et c'est ce qui l'empêche d'être lue par erreur.
    const verdicts = rupturesDeService(
      [rendue("renfort", kone)],
      new Map([
        [ducos, 4],
        [kone, 1],
      ]),
    );

    expect(ruptures(verdicts)).toHaveLength(1);
    expect(ruptures(verdicts)[0]?.agenceId).toBe(kone);
  });
});

describe("« je ne sais pas » n'est pas « l'agence a du monde »", () => {
  it("une agence dont l'effectif n'a pas été observé rend un TROISIÈME état", () => {
    // Sous un verdict à deux valeurs, elle rendrait exactement ce que rend une
    // agence bien pourvue : le SILENCE. *Et le silence a exactement la forme
    // du succès* — ici, la forme d'un service qui tient.
    const verdicts = rupturesDeService([rendue("i1", kone)], new Map());

    expect(verdicts).toEqual([{ etat: "effectif_inconnu", agenceId: kone }]);
    expect(ruptures(verdicts)).toEqual([]);
  });
});

describe("AUCUN CRÉNEAU N'EST PROPOSÉ, et c'est mesuré", () => {
  it("le verdict ne porte ni date, ni heure, ni technicien de remplacement", () => {
    // *Un moteur qui propose sur un effectif d'un ne propose rien* — la règle
    // décrit précisément le cas où il n'y a personne d'autre. L'acceptation de
    // L3-04a demande que ce soit MESURÉ plutôt qu'espéré : voici la mesure,
    // sur la forme même de ce que la règle rend.
    const verdicts = rupturesDeService(
      [rendue("i1", kone)],
      new Map([[kone, 1]]),
    );
    const clefs = Object.keys(verdicts[0] ?? {});

    expect(clefs.sort()).toEqual(["agenceId", "etat", "interventions"]);
    for (const interdit of [
      "creneau",
      "creneauDebut",
      "date",
      "datePlanifiee",
      "heure",
      "propositions",
      "remplacant",
      "technicienId",
    ]) {
      expect(clefs, `le verdict porte « ${interdit} »`).not.toContain(interdit);
    }
  });

  it("les interventions sont NOMMÉES, jamais comptées", () => {
    // *« 3 interventions déplanifiées » ne dit pas lesquelles*, et c'est
    // précisément ce que le planificateur doit voir pour les reposer (§9,
    // 06/09 : un décompte se lit en trois secondes et ne se vérifie pas).
    const verdicts = rupturesDeService(
      [rendue("i1", kone), rendue("i2", kone)],
      new Map([[kone, 1]]),
    );

    expect(ruptures(verdicts)[0]?.interventions).toEqual(["i1", "i2"]);
  });
});

describe("le report sans conséquence", () => {
  it("aucune intervention rendue — aucun verdict, et donc aucune alerte", () => {
    // Une absence validée qui ne déplanifie rien ne rompt aucun service : il
    // n'y a pas d'agence touchée. *Le vide se distingue ici du « je ne sais
    // pas » par le fait qu'il n'y a rien à savoir.*
    expect(rupturesDeService([], new Map([[kone, 1]]))).toEqual([]);
  });
});
