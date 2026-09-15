import { describe, expect, it } from "vitest";

import type { Calendrier } from "@/lib/calendar";
import { montant, zero } from "@/lib/money";
import {
  ErreurCalendrierHorsAgence,
  TAUX_MAJORATION,
  majorationHorsOuverture,
} from "@/lib/tarification/majoration";
import { valoriserIntervention } from "@/lib/tarification/valorisation";

/**
 * LA MAJORATION HORS OUVERTURE (L2-09b ; RG-INT-08, D12, D13, D108).
 *
 * > **LA MAJORATION PAIE LA CONTRAINTE D'UN CRÉNEAU POSÉ HORS OUVERTURE, PAS
 * > LES MINUTES EFFECTIVEMENT TRAVAILLÉES.** *(D108)*
 *
 * **Le cas qui a fait trancher, et il est le premier scénario de ce fichier** :
 * créneau 16 h – 18 h, l'agence ferme à 17 h, le technicien travaille 30
 * minutes. *Selon la base retenue, la majoration vaut 50 % ou 0 %* — et l'écart
 * se voit sur la facture. D108 retient le **créneau**.
 */

const XPF = "XPF";
const AGENCE_DU_TECHNICIEN = "agence-kone";
const AGENCE_DE_L_INTERVENTION = "agence-ducos";

/** Un calendrier qui ouvre du lundi au vendredi, de 8 h à 17 h, à Nouméa. */
function calendrierFermantA(finMinutes: number): Calendrier {
  return {
    code: "kone",
    fuseau: "Pacific/Noumea",
    territoire: "NC",
    plages: [1, 2, 3, 4, 5].map((jour) => ({
      jour_semaine: jour,
      debut_minutes: 8 * 60,
      fin_minutes: finMinutes,
    })),
    jours_particuliers: [],
  };
}

/** Un instant local de Nouméa (UTC+11, sans changement d'heure). */
function aNoumea(jour: string, heure: number, minute = 0): Date {
  const hh = String(heure).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${jour}T${hh}:${mm}:00.000+11:00`);
}

// Le 16 septembre 2026 est un MERCREDI — donc un jour ouvré du calendrier
// ci-dessus. Un samedi rendrait 100 % hors ouverture et le scénario chiffré
// cesserait de mesurer ce qu'il prétend mesurer.
const MERCREDI = "2026-09-16";

function appel(parametres: {
  debut: Date;
  fin: Date;
  mainDoeuvre?: bigint | null;
  finOuverture?: number;
  agenceDuCalendrier?: string;
  agenceDuTechnicien?: string | null;
}) {
  return majorationHorsOuverture({
    creneau: { debut: parametres.debut, fin: parametres.fin },
    mainDoeuvre:
      parametres.mainDoeuvre === null
        ? null
        : montant(parametres.mainDoeuvre ?? BigInt(12_000), XPF),
    calendrierDeLAgence: {
      agenceId: parametres.agenceDuCalendrier ?? AGENCE_DU_TECHNICIEN,
      calendrier: calendrierFermantA(parametres.finOuverture ?? 17 * 60),
    },
    agenceDuTechnicien:
      parametres.agenceDuTechnicien === undefined
        ? AGENCE_DU_TECHNICIEN
        : parametres.agenceDuTechnicien,
  });
}

describe("le prorata se lit sur le CRÉNEAU (D108)", () => {
  it("LE CAS DE L'ACCEPTATION — créneau 16 h–18 h, fermeture 17 h, travail 30 min", () => {
    // LA BASE RETENUE EST NOMMÉE : 60 minutes hors ouverture sur les 120 du
    // CRÉNEAU, et non 30 minutes de travail. Le travail de 30 minutes
    // n'apparaît nulle part ici — c'est tout le sens de D108.
    const verdict = appel({
      debut: aNoumea(MERCREDI, 16),
      fin: aNoumea(MERCREDI, 18),
    });
    expect(verdict.connue).toBe(true);
    if (!verdict.connue) return;

    expect(verdict.majoration.minutesHorsOuverture).toBe(60);
    expect(verdict.majoration.minutesDuCreneau).toBe(120);

    // 50 % de la main-d'œuvre est l'ASSIETTE — la moitié du créneau tombe hors
    // ouverture —, et le taux de D12 s'y applique.
    expect(verdict.majoration.assiette).toEqual(montant(BigInt(6_000), XPF));
    expect(verdict.majoration.supplement).toEqual(montant(BigInt(3_000), XPF));
  });

  it("LE TÉMOIN QUI DISTINGUE LES DEUX BASES : le temps passé ne change RIEN", () => {
    // Si le prorata se lisait sur `temps_valide_min`, passer de 30 minutes à 2
    // heures de travail changerait le résultat. Le module ne reçoit AUCUNE
    // durée de travail : l'impossibilité est structurelle, et c'est ce que ce
    // scénario constate — la signature ne porte pas de `temps_valide_min`.
    const deuxFois = [
      appel({ debut: aNoumea(MERCREDI, 16), fin: aNoumea(MERCREDI, 18) }),
      appel({ debut: aNoumea(MERCREDI, 16), fin: aNoumea(MERCREDI, 18) }),
    ];
    expect(deuxFois[0]).toEqual(deuxFois[1]);
    expect(Object.keys(appel)).not.toContain("temps_valide_min");
  });

  it("un créneau ENTIÈREMENT dans l'ouverture ne majore rien — un zéro VÉRITABLE", () => {
    const verdict = appel({
      debut: aNoumea(MERCREDI, 9),
      fin: aNoumea(MERCREDI, 11),
    });
    expect(verdict.connue).toBe(true);
    if (!verdict.connue) return;
    // `connue: true` AVEC un supplément nul : ce n'est pas « je ne sais pas ».
    expect(verdict.majoration.minutesHorsOuverture).toBe(0);
    expect(verdict.majoration.supplement).toEqual(zero(XPF));
  });

  it("un créneau ENTIÈREMENT hors ouverture majore toute la main-d'œuvre", () => {
    const verdict = appel({
      debut: aNoumea(MERCREDI, 19),
      fin: aNoumea(MERCREDI, 21),
    });
    expect(verdict.connue).toBe(true);
    if (!verdict.connue) return;
    expect(verdict.majoration.minutesHorsOuverture).toBe(120);
    expect(verdict.majoration.assiette).toEqual(montant(BigInt(12_000), XPF));
    // +50 % de D12, sur toute l'assiette.
    expect(verdict.majoration.supplement).toEqual(montant(BigInt(6_000), XPF));
  });

  it("LE TAUX EST UNE FRACTION EXACTE, jamais un flottant", () => {
    // `0.1 + 0.2` ne vaut pas `0.3`, et un montant n'a pas le droit de s'en
    // apercevoir (L0-07). Le taux voyage donc en numérateur / dénominateur.
    expect(TAUX_MAJORATION).toEqual({ numerateur: 1, denominateur: 2 });
  });

  it("L'ARITHMÉTIQUE AFFICHÉE TOMBE JUSTE — le supplément est la moitié de l'assiette", () => {
    // *Un client qui ne peut pas recalculer un montant ne peut pas le
    // contester, et c'est pire que de le contester.* Le supplément est dérivé de
    // l'assiette ARRONDIE, et non d'une fraction que rien n'affiche.
    for (const valeur of [
      BigInt(1),
      BigInt(7),
      BigInt(12_345),
      BigInt(99_999),
    ]) {
      const verdict = appel({
        debut: aNoumea(MERCREDI, 16),
        fin: aNoumea(MERCREDI, 18),
        mainDoeuvre: valeur,
      });
      if (!verdict.connue) throw new Error("verdict inattendu");
      const { assiette, supplement } = verdict.majoration;
      // Au plus proche, à égale distance on s'éloigne de zéro (L0-07).
      const attendu =
        (assiette.valeur + (assiette.valeur % BigInt(2))) / BigInt(2);
      expect(supplement.valeur, `main-d'œuvre ${valeur}`).toBe(attendu);
    }
  });
});

/**
 * LE CALENDRIER LU EST CELUI DE L'AGENCE DU TECHNICIEN (D13, I7).
 *
 * I7 range les usages, et ils ne se ressemblent pas : *SLA → agence de
 * l'INTERVENTION ; **majoration → agence du TECHNICIEN***. Les deux diffèrent
 * dès qu'un technicien de Koné intervient sur un site rattaché à Ducos, et la
 * ligne d'intervention porte `agence_id` — **celle de l'intervention** — à
 * portée de main. C'est la faute qu'on commettrait sans y penser.
 */
describe("une discordance d'agence LÈVE plutôt que de calculer faux", () => {
  it("le calendrier d'une AUTRE agence est refusé, et le refus nomme les deux", () => {
    expect(() =>
      appel({
        debut: aNoumea(MERCREDI, 16),
        fin: aNoumea(MERCREDI, 18),
        agenceDuCalendrier: AGENCE_DE_L_INTERVENTION,
      }),
    ).toThrow(ErreurCalendrierHorsAgence);

    try {
      appel({
        debut: aNoumea(MERCREDI, 16),
        fin: aNoumea(MERCREDI, 18),
        agenceDuCalendrier: AGENCE_DE_L_INTERVENTION,
      });
      throw new Error("le refus n'a pas eu lieu");
    } catch (erreur) {
      expect(erreur).toBeInstanceOf(ErreurCalendrierHorsAgence);
      expect((erreur as Error).message).toContain(AGENCE_DE_L_INTERVENTION);
      expect((erreur as Error).message).toContain(AGENCE_DU_TECHNICIEN);
      // Le refus dit la RÈGLE, pas seulement le symptôme.
      expect((erreur as Error).message).toContain("D13");
    }
  });

  it("ET IL RESTE VERT POUR SA PROPRE RAISON quand les deux agences coïncident", () => {
    // La moitié qu'on n'éprouve jamais (§9, 11/09) : un cas qui doit PASSER, et
    // qui pourrait passer pour une mauvaise raison — un contrôle désactivé.
    const verdict = appel({
      debut: aNoumea(MERCREDI, 16),
      fin: aNoumea(MERCREDI, 18),
      agenceDuCalendrier: AGENCE_DU_TECHNICIEN,
    });
    expect(verdict.connue).toBe(true);

    // Et les DEUX agences employées par ce fichier sont bien distinctes, sans
    // quoi la paire ci-dessus ne mesurerait rien.
    expect(AGENCE_DU_TECHNICIEN).not.toBe(AGENCE_DE_L_INTERVENTION);
  });

  it("LE MÊME CRÉNEAU donne un résultat DIFFÉRENT selon l'agence — la règle mord", () => {
    // Le témoin qui donne son sens à D13 : si les deux calendriers diffèrent, le
    // choix de l'agence change la facture. Ici Koné ferme à 17 h et l'autre
    // agence à 19 h — le même créneau de 16 h à 18 h ne majore pas pareil.
    const kone = majorationHorsOuverture({
      creneau: { debut: aNoumea(MERCREDI, 16), fin: aNoumea(MERCREDI, 18) },
      mainDoeuvre: montant(BigInt(12_000), XPF),
      calendrierDeLAgence: {
        agenceId: AGENCE_DU_TECHNICIEN,
        calendrier: calendrierFermantA(17 * 60),
      },
      agenceDuTechnicien: AGENCE_DU_TECHNICIEN,
    });
    const tardive = majorationHorsOuverture({
      creneau: { debut: aNoumea(MERCREDI, 16), fin: aNoumea(MERCREDI, 18) },
      mainDoeuvre: montant(BigInt(12_000), XPF),
      calendrierDeLAgence: {
        agenceId: AGENCE_DE_L_INTERVENTION,
        calendrier: calendrierFermantA(19 * 60),
      },
      agenceDuTechnicien: AGENCE_DE_L_INTERVENTION,
    });
    if (!kone.connue || !tardive.connue) throw new Error("verdict inattendu");
    expect(kone.majoration.supplement).toEqual(montant(BigInt(3_000), XPF));
    expect(tardive.majoration.supplement).toEqual(zero(XPF));
  });
});

/**
 * LES QUATRE MOTIFS, ET AUCUN N'EST UN ZÉRO.
 *
 * *Zéro se lit « rien à majorer » ; `null` dit « je ne sais pas ».* Les confondre
 * ferait facturer une intervention sans son supplément, en silence.
 */
describe("ce qui rend la majoration inconnue", () => {
  const CRENEAU = {
    debut: aNoumea(MERCREDI, 16),
    fin: aNoumea(MERCREDI, 18),
  };
  const CALENDRIER = {
    agenceId: AGENCE_DU_TECHNICIEN,
    calendrier: calendrierFermantA(17 * 60),
  };

  it("un TECHNICIEN sans rattachement — la majoration n'a pas de sujet", () => {
    const verdict = majorationHorsOuverture({
      creneau: CRENEAU,
      mainDoeuvre: montant(BigInt(12_000), XPF),
      calendrierDeLAgence: CALENDRIER,
      agenceDuTechnicien: null,
    });
    expect(verdict).toEqual({
      connue: false,
      motif: "intervention.majoration.technicien_absent",
    });
  });

  it("un CRÉNEAU absent — et c'est le cœur de D108", () => {
    const verdict = majorationHorsOuverture({
      creneau: null,
      mainDoeuvre: montant(BigInt(12_000), XPF),
      calendrierDeLAgence: CALENDRIER,
      agenceDuTechnicien: AGENCE_DU_TECHNICIEN,
    });
    expect(verdict).toEqual({
      connue: false,
      motif: "intervention.majoration.creneau_absent",
    });
  });

  it("un créneau INVERSÉ ou NUL n'est pas « entièrement ouvert »", () => {
    // Le dénominateur du prorata serait nul. Un zéro silencieux ici majorerait
    // à 0 % une soirée réellement bloquée.
    for (const creneau of [
      { debut: aNoumea(MERCREDI, 18), fin: aNoumea(MERCREDI, 16) },
      { debut: aNoumea(MERCREDI, 18), fin: aNoumea(MERCREDI, 18) },
    ]) {
      const verdict = majorationHorsOuverture({
        creneau,
        mainDoeuvre: montant(BigInt(12_000), XPF),
        calendrierDeLAgence: CALENDRIER,
        agenceDuTechnicien: AGENCE_DU_TECHNICIEN,
      });
      expect(verdict.connue, JSON.stringify(creneau)).toBe(false);
    }
  });

  it("une MAIN-D'ŒUVRE absente — l'assiette de D12, et rien d'autre", () => {
    const verdict = majorationHorsOuverture({
      creneau: CRENEAU,
      mainDoeuvre: null,
      calendrierDeLAgence: CALENDRIER,
      agenceDuTechnicien: AGENCE_DU_TECHNICIEN,
    });
    expect(verdict).toEqual({
      connue: false,
      motif: "intervention.majoration.main_doeuvre_absente",
    });
  });

  it("un CALENDRIER absent — « inconnu » n'est pas « ouvert » (I7)", () => {
    const verdict = majorationHorsOuverture({
      creneau: CRENEAU,
      mainDoeuvre: montant(BigInt(12_000), XPF),
      calendrierDeLAgence: null,
      agenceDuTechnicien: AGENCE_DU_TECHNICIEN,
    });
    expect(verdict).toEqual({
      connue: false,
      motif: "intervention.majoration.calendrier_absent",
    });
  });

  it("L'ORDRE DES MOTIFS EST UNE DÉCISION — le créneau avant le calendrier", () => {
    // Les deux manquent : on nomme le CRÉNEAU. *Nommer le calendrier enverrait
    // paramétrer une agence quand ce qui manque est un rendez-vous.*
    const verdict = majorationHorsOuverture({
      creneau: null,
      mainDoeuvre: montant(BigInt(12_000), XPF),
      calendrierDeLAgence: null,
      agenceDuTechnicien: AGENCE_DU_TECHNICIEN,
    });
    expect(verdict).toEqual({
      connue: false,
      motif: "intervention.majoration.creneau_absent",
    });
  });
});

/**
 * LA MAJORATION ENTRE DANS LE TOTAL (L2-09b), et c'est ce qui la rend utile.
 *
 * *Une interface sans appelant est la maladie que ce dépôt soigne ailleurs* :
 * une majoration juste que personne n'additionne ne change aucune facture.
 */
describe("le total hors taxes porte le supplément", () => {
  const MAJOREE = majorationHorsOuverture({
    creneau: { debut: aNoumea(MERCREDI, 16), fin: aNoumea(MERCREDI, 18) },
    mainDoeuvre: montant(BigInt(12_000), XPF),
    calendrierDeLAgence: {
      agenceId: AGENCE_DU_TECHNICIEN,
      calendrier: calendrierFermantA(17 * 60),
    },
    agenceDuTechnicien: AGENCE_DU_TECHNICIEN,
  });

  it("main-d'œuvre + déplacement + MAJORATION, dans l'ordre de D11", () => {
    const resultat = valoriserIntervention({
      mode: "temps_passe",
      forfaitDeplacement: montant(BigInt(3_500), XPF),
      mainDoeuvre: montant(BigInt(12_000), XPF),
      majoration: MAJOREE,
    });
    // 12 000 + 3 500 + 3 000
    expect(resultat.totalHT).toEqual(montant(BigInt(18_500), XPF));
    expect(resultat.majoration).toEqual(montant(BigInt(3_000), XPF));
    expect(resultat.motifTotalInconnu).toBeNull();
  });

  it("sans forfait, le total est la main-d'œuvre PLUS le supplément", () => {
    const resultat = valoriserIntervention({
      mode: "temps_passe",
      forfaitDeplacement: null,
      mainDoeuvre: montant(BigInt(12_000), XPF),
      majoration: MAJOREE,
    });
    expect(resultat.totalHT).toEqual(montant(BigInt(15_000), XPF));
  });

  it("UNE MAJORATION INCONNUE REND LE TOTAL INCONNU, avec SON motif", () => {
    // *Une facture amputée d'un supplément dû est fausse.* Et le motif est celui
    // de la majoration, jamais un « total inconnu » générique : il dit quoi
    // corriger.
    const resultat = valoriserIntervention({
      mode: "temps_passe",
      forfaitDeplacement: montant(BigInt(3_500), XPF),
      mainDoeuvre: montant(BigInt(12_000), XPF),
      majoration: {
        connue: false,
        motif: "intervention.majoration.creneau_absent",
      },
    });
    expect(resultat.totalHT).toBeNull();
    expect(resultat.motifTotalInconnu).toBe(
      "intervention.majoration.creneau_absent",
    );
  });

  it("un mode AU FORFAIT ne majore rien — l'assiette de D12 est la main-d'œuvre", () => {
    // Le total est déjà inconnu pour une autre raison (rien ne sélectionne de
    // forfait de prestation), et le motif retenu est CELUI-LÀ : il vient avant.
    const resultat = valoriserIntervention({
      mode: "forfait",
      forfaitDeplacement: montant(BigInt(3_500), XPF),
      mainDoeuvre: montant(BigInt(12_000), XPF),
      majoration: MAJOREE,
    });
    expect(resultat.majoration).toBeNull();
    expect(resultat.motifTotalInconnu).toBe(
      "intervention.total.forfait_de_prestation_absent",
    );
  });
});
