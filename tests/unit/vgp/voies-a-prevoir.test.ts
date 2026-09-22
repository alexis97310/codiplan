import { describe, expect, it } from "vitest";

import {
  instantDuJour,
  jourDe,
  versLocal,
  type Fuseau,
} from "@/lib/calendar/fuseau";
import {
  ASSUJETTISSEMENT,
  resoudreAssujettissement,
} from "@/lib/vgp/assujettissement";
import {
  etatDeLInformation,
  type EtatInformation,
} from "@/lib/vgp/information";
import {
  compterLesEcheances,
  echeanceAVenirSous,
  echeanceDepassee,
  resumerLeRegistre,
  type LigneDeRegistre,
} from "@/lib/vgp/registre";

/**
 * VGP-2 — UNE VÉRIFICATION EN RETARD EST UNE VOIE NOMMÉE, JAMAIS UN ZÉRO.
 *
 * ## LE CONSTAT, MESURÉ SUR LE CODE DU 22/09 (d9c9446)
 *
 * `joursAvantEcheance` est NÉGATIF quand l'échéance est passée — le modèle le
 * sait (`lib/vgp/information.ts`). Le compteur d'accueil `compterAPrevoir`
 * filtrait `joursAvantEcheance >= 0 && <= horizon` : une machine dépassée
 * depuis six mois comptait ZÉRO. *Le seul cas où l'outil doit crier est
 * précisément celui où il se taisait.*
 *
 * ## CE QUE CE FICHIER ÉPROUVE
 *
 * 1. **La machine dépassée de trente jours entre dans la voie DÉPASSÉE** —
 *    et l'ancien filtre, rejoué ici comme TÉMOIN, la comptait 0. Le témoin est
 *    l'ancienne lecture mot pour mot : il restera vrai, et c'est ce qui rend
 *    la mesure « avant » relisible.
 * 2. **La civile, jamais l'instant** (DATES-1) : une échéance du JOUR MÊME est
 *    À VENIR à 23 h 59 heure de Nouméa, pas DÉPASSÉE — et l'instant nu, lui,
 *    l'aurait fait tomber sous zéro. Le contre-cas est joué, pas supposé.
 * 3. **La garde du lot PERF est ÉTENDUE aux trois voies** : la lecture
 *    resserrée (`id ∈ recues`, puis le `where` « soumise ») rend les MÊMES
 *    comptes DÉPASSÉES et À VENIR que la lecture entière, et le `where` seul
 *    — sans aucun calcul par ligne — retrouve EXACTEMENT les machines
 *    `sans_information`, pour chaque combinaison possible.
 *
 * `tests/unit/perf/vgp-compter-a-prevoir.test.ts` reste vrai tel quel : sa
 * valeur figée (2) est désormais la voie À VENIR. Ce fichier ne le remplace
 * pas, il le complète.
 */

const FUSEAU_NOUMEA: Fuseau = "Pacific/Noumea";
const HORIZON_JOURS = 30;

/** La civile du 22/09/2026 — la forme que le tableau de bord passe (`debutDuJour`). */
const AUJOURD_HUI = new Date("2026-09-22T00:00:00Z");

function informee(
  derniereInformation: Date,
  periodiciteMois: number | null,
  aujourdHui: Date = AUJOURD_HUI,
): EtatInformation {
  return etatDeLInformation({
    assujettissement: ASSUJETTISSEMENT.soumis,
    periodiciteMois,
    derniereInformation,
    depuis: null,
    aujourdHui,
  });
}

/**
 * L'ANCIEN FILTRE de `compterAPrevoir`, mot pour mot (d9c9446, registre.ts
 * 267-272) — gardé comme TÉMOIN de ce que l'accueil comptait avant ce lot.
 */
function ancienFiltre(etat: EtatInformation, horizonJours: number): boolean {
  return (
    etat.etat === "information_recue" &&
    etat.joursAvantEcheance !== null &&
    etat.joursAvantEcheance >= 0 &&
    etat.joursAvantEcheance <= horizonJours
  );
}

describe("ÉPREUVE 1 — une machine soumise, informée, dépassée de trente jours", () => {
  // Périodicité d'un mois, informée le 23/07 : échéance le 23/08, soit trente
  // jours AVANT le 22/09.
  const depassee = informee(new Date("2026-07-23T00:00:00Z"), 1);

  it("TÉMOIN — le modèle sait qu'elle est passée : -30 jours", () => {
    expect(depassee.etat).toBe("information_recue");
    expect(
      depassee.etat === "information_recue" && depassee.joursAvantEcheance,
    ).toBe(-HORIZON_JOURS);
  });

  it("AVANT — l'ancien filtre de compterAPrevoir la comptait ZÉRO", () => {
    expect(
      [depassee].filter((e) => ancienFiltre(e, HORIZON_JOURS)),
    ).toHaveLength(0);
  });

  it("APRÈS — elle est dans la voie DÉPASSÉE, et dans aucune autre", () => {
    expect(echeanceDepassee(depassee)).toBe(true);
    expect(echeanceAVenirSous(depassee, HORIZON_JOURS)).toBe(false);
    expect(
      compterLesEcheances([{ information: depassee }], HORIZON_JOURS),
    ).toEqual({ depassees: 1, aVenir: 0 });
  });

  it("LE CAS QUI DOIT RESTER VERT : une échéance dans l'horizon est À VENIR, jamais dépassée", () => {
    const demain = informee(new Date("2026-08-23T00:00:00Z"), 1);
    expect(echeanceDepassee(demain)).toBe(false);
    expect(echeanceAVenirSous(demain, HORIZON_JOURS)).toBe(true);
    expect(
      compterLesEcheances([{ information: demain }], HORIZON_JOURS),
    ).toEqual({ depassees: 0, aVenir: 1 });
  });

  it("ni « sans information », ni « hors registre », ni « sans rythme » n'entrent dans les deux voies datées", () => {
    const sansInformation = etatDeLInformation({
      assujettissement: ASSUJETTISSEMENT.soumis,
      periodiciteMois: 1,
      derniereInformation: null,
      depuis: null,
      aujourdHui: AUJOURD_HUI,
    });
    const horsRegistre = etatDeLInformation({
      assujettissement: ASSUJETTISSEMENT.non_soumis,
      periodiciteMois: 1,
      derniereInformation: new Date("2026-01-01T00:00:00Z"),
      depuis: null,
      aujourdHui: AUJOURD_HUI,
    });
    const sansRythme = informee(new Date("2020-01-01T00:00:00Z"), null);
    for (const etat of [sansInformation, horsRegistre, sansRythme]) {
      expect(echeanceDepassee(etat)).toBe(false);
      expect(echeanceAVenirSous(etat, HORIZON_JOURS)).toBe(false);
    }
    expect(
      compterLesEcheances(
        [sansInformation, horsRegistre, sansRythme].map((information) => ({
          information,
        })),
        HORIZON_JOURS,
      ),
    ).toEqual({ depassees: 0, aVenir: 0 });
  });

  it("au-delà de l'horizon, une échéance n'est ni dépassée ni à venir — l'horizon est le seul seuil, et il est REÇU", () => {
    const lointaine = informee(new Date("2026-09-01T00:00:00Z"), 12);
    expect(echeanceDepassee(lointaine)).toBe(false);
    expect(echeanceAVenirSous(lointaine, HORIZON_JOURS)).toBe(false);
  });

  it("le résumé du registre compte la même machine dans « échéances dépassées »", () => {
    // `resumerLeRegistre` (les KPI de /vgp) disait déjà « dépassée » : c'est
    // le même prédicat, écrit UNE fois, qui sert désormais aux deux écrans.
    const ligne = { information: depassee } as LigneDeRegistre;
    expect(resumerLeRegistre([ligne]).echeanceDepassee).toBe(1);
    expect(resumerLeRegistre([ligne]).echeanceAVenir).toBe(0);
  });
});

describe("ÉPREUVE 2 — le jour J à 23 h 59 heure de Nouméa est À VENIR, pas DÉPASSÉ (DATES-1)", () => {
  // 23 h 59 à Nouméa (UTC+11) le 22/09 = 12 h 59 UTC le 22/09.
  const instant = new Date("2026-09-22T12:59:00Z");
  const local = versLocal(instant, FUSEAU_NOUMEA);
  // Informée le 22/08, rythme d'un mois : échéance LE JOUR MÊME.
  const informeeIlYAUnMois = new Date("2026-08-22T00:00:00Z");

  it("TÉMOIN — c'est bien le 22 à Nouméa", () => {
    expect(jourDe(local)).toEqual({ annee: 2026, mois: 9, jour: 22 });
  });

  it("avec LA CIVILE (ce que les écrans passent), l'échéance du jour vaut 0 jour : À VENIR", () => {
    const civile = instantDuJour(jourDe(local));
    const etat = informee(informeeIlYAUnMois, 1, civile);
    expect(etat.etat === "information_recue" && etat.joursAvantEcheance).toBe(
      0,
    );
    expect(echeanceDepassee(etat)).toBe(false);
    expect(echeanceAVenirSous(etat, HORIZON_JOURS)).toBe(true);
  });

  it("CONTRE-CAS — avec l'INSTANT nu, la même échéance tomberait sous zéro : c'est la faute que DATES-1 interdit, et elle est jouée ici pour que la civile ne soit pas un mot", () => {
    const etat = informee(informeeIlYAUnMois, 1, instant);
    expect(etat.etat === "information_recue" && etat.joursAvantEcheance).toBe(
      -1,
    );
    expect(echeanceDepassee(etat)).toBe(true);
  });
});

/**
 * ── LA GARDE DU LOT PERF, ÉTENDUE AUX TROIS VOIES ─────────────────────────
 *
 * Même parc que `tests/unit/perf/vgp-compter-a-prevoir.test.ts`, mêmes VRAIES
 * fonctions (`resoudreAssujettissement`, `etatDeLInformation`), et le `where`
 * rejoué en JS comme là-bas. Ce qui s'ajoute : les comptes des TROIS voies,
 * et la preuve que le `where` seul retrouve `sans_information`.
 */

const TOUTES_LES_VALEURS = [
  ASSUJETTISSEMENT.a_determiner,
  ASSUJETTISSEMENT.soumis,
  ASSUJETTISSEMENT.non_soumis,
  ASSUJETTISSEMENT.verifie,
] as const;

/** Le prédicat « soumise » du `where`, rejoué — identique au lot PERF. */
function soumiseSelonLeWhere(entree: {
  readonly exceptionMachine: (typeof TOUTES_LES_VALEURS)[number] | null;
  readonly assujettissementFamille: (typeof TOUTES_LES_VALEURS)[number];
}): boolean {
  return (
    entree.exceptionMachine === ASSUJETTISSEMENT.soumis ||
    (entree.exceptionMachine === null &&
      entree.assujettissementFamille === ASSUJETTISSEMENT.soumis)
  );
}

type MachineDeDemonstration = {
  readonly id: string;
  readonly exception: (typeof TOUTES_LES_VALEURS)[number] | null;
  readonly assujettissementFamille: (typeof TOUTES_LES_VALEURS)[number];
  readonly periodiciteMois: number | null;
  readonly derniereInformation: Date | null;
};

const PARC: readonly MachineDeDemonstration[] = [
  {
    id: "due-aujourdhui",
    exception: null,
    assujettissementFamille: ASSUJETTISSEMENT.soumis,
    periodiciteMois: 1,
    derniereInformation: new Date("2026-08-22T00:00:00Z"),
  },
  {
    id: "due-demain",
    exception: null,
    assujettissementFamille: ASSUJETTISSEMENT.soumis,
    periodiciteMois: 1,
    derniereInformation: new Date("2026-08-23T00:00:00Z"),
  },
  {
    id: "echeance-passee-hier",
    exception: null,
    assujettissementFamille: ASSUJETTISSEMENT.soumis,
    periodiciteMois: 1,
    derniereInformation: new Date("2026-08-21T00:00:00Z"),
  },
  {
    id: "echeance-passee-six-mois",
    exception: null,
    assujettissementFamille: ASSUJETTISSEMENT.soumis,
    periodiciteMois: 6,
    derniereInformation: new Date("2025-09-22T00:00:00Z"),
  },
  {
    id: "sans-periodicite",
    exception: null,
    assujettissementFamille: ASSUJETTISSEMENT.soumis,
    periodiciteMois: null,
    derniereInformation: new Date("2026-08-22T00:00:00Z"),
  },
  {
    id: "exception-non-soumis",
    exception: ASSUJETTISSEMENT.non_soumis,
    assujettissementFamille: ASSUJETTISSEMENT.soumis,
    periodiciteMois: 1,
    derniereInformation: new Date("2026-08-22T00:00:00Z"),
  },
  {
    id: "famille-a-determiner",
    exception: null,
    assujettissementFamille: ASSUJETTISSEMENT.a_determiner,
    periodiciteMois: 1,
    derniereInformation: new Date("2026-08-22T00:00:00Z"),
  },
  {
    id: "jamais-informee",
    exception: null,
    assujettissementFamille: ASSUJETTISSEMENT.soumis,
    periodiciteMois: 1,
    derniereInformation: null,
  },
  {
    id: "jamais-informee-non-soumise",
    exception: null,
    assujettissementFamille: ASSUJETTISSEMENT.non_soumis,
    periodiciteMois: null,
    derniereInformation: null,
  },
];

function etatDe(machine: MachineDeDemonstration): EtatInformation {
  const resolu = resoudreAssujettissement({
    famille: {
      assujettissement: machine.assujettissementFamille,
      periodiciteMois: machine.periodiciteMois,
      referenceTexte: machine.periodiciteMois === null ? null : "texte",
    },
    modele: { periodiciteMois: null, referenceTexte: null },
    machine: { exception: machine.exception },
  });
  return etatDeLInformation({
    assujettissement: resolu.valeur,
    periodiciteMois: resolu.periodiciteMois,
    derniereInformation: machine.derniereInformation,
    depuis: null,
    aujourdHui: AUJOURD_HUI,
  });
}

/** LES VALEURS FIGÉES du parc ci-dessus — relevées sur la lecture ENTIÈRE. */
const FIGE = { depassees: 2, aVenir: 2, sansInformation: 1 };

describe("la lecture resserrée rend les MÊMES trois voies que la lecture entière (garde PERF étendue)", () => {
  const lignesEntieres = PARC.map((m) => ({ information: etatDe(m) }));

  it("la lecture ENTIÈRE vaut les valeurs figées", () => {
    expect(compterLesEcheances(lignesEntieres, HORIZON_JOURS)).toEqual({
      depassees: FIGE.depassees,
      aVenir: FIGE.aVenir,
    });
    expect(
      lignesEntieres.filter((l) => l.information.etat === "sans_information"),
    ).toHaveLength(FIGE.sansInformation);
  });

  it("DÉPASSÉES et À VENIR — la lecture resserrée (id ∈ recues, puis `where` soumise) rend exactement la même valeur", () => {
    const recues = new Set(
      PARC.filter((m) => m.derniereInformation !== null).map((m) => m.id),
    );
    const resserre = PARC.filter(
      (m) =>
        recues.has(m.id) &&
        soumiseSelonLeWhere({
          exceptionMachine: m.exception,
          assujettissementFamille: m.assujettissementFamille,
        }),
    );
    expect(
      compterLesEcheances(
        resserre.map((m) => ({ information: etatDe(m) })),
        HORIZON_JOURS,
      ),
    ).toEqual({ depassees: FIGE.depassees, aVenir: FIGE.aVenir });
    // ET AUCUNE MACHINE COMPTÉE PAR L'ENTIÈRE N'A ÉTÉ ÉCARTÉE.
    for (const machine of PARC) {
      const etat = etatDe(machine);
      if (echeanceDepassee(etat) || echeanceAVenirSous(etat, HORIZON_JOURS)) {
        expect(resserre.map((m) => m.id)).toContain(machine.id);
      }
    }
  });

  it("SANS INFORMATION — le `where` seul (id ∉ recues, soumise) retrouve exactement les machines `sans_information`, sans calcul par ligne", () => {
    const recues = new Set(
      PARC.filter((m) => m.derniereInformation !== null).map((m) => m.id),
    );
    const parLeWhere = PARC.filter(
      (m) =>
        !recues.has(m.id) &&
        soumiseSelonLeWhere({
          exceptionMachine: m.exception,
          assujettissementFamille: m.assujettissementFamille,
        }),
    ).map((m) => m.id);
    const parLeCalcul = PARC.filter(
      (m) => etatDe(m).etat === "sans_information",
    ).map((m) => m.id);
    expect(parLeWhere).toEqual(parLeCalcul);
    expect(parLeWhere).toHaveLength(FIGE.sansInformation);
  });

  it("pour CHAQUE combinaison exception × famille, une machine jamais informée est `sans_information` SI ET SEULEMENT SI le `where` la dit soumise", () => {
    // C'est ce qui autorise un `count` sans lecture des lignes : le verdict
    // « sans information » ne dépend d'AUCUNE date, seulement de la cascade
    // que le `where` retrouve déjà (garde PERF, point 2).
    let combinaisons = 0;
    for (const assujettissementFamille of TOUTES_LES_VALEURS) {
      for (const exceptionMachine of [null, ...TOUTES_LES_VALEURS]) {
        const etat = etatDe({
          id: "x",
          exception: exceptionMachine,
          assujettissementFamille,
          periodiciteMois: 1,
          derniereInformation: null,
        });
        expect(etat.etat === "sans_information").toBe(
          soumiseSelonLeWhere({ exceptionMachine, assujettissementFamille }),
        );
        combinaisons += 1;
      }
    }
    expect(combinaisons).toBe(20);
  });
});
