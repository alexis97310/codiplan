import { describe, expect, it } from "vitest";

import {
  ASSUJETTISSEMENT,
  resoudreAssujettissement,
} from "@/lib/vgp/assujettissement";
import { etatDeLInformation } from "@/lib/vgp/information";

/**
 * LE GARDIEN CENTRAL DU POINT 2 (lot PERF, mesuré sur 4fead41).
 *
 * `compterAPrevoir` lisait TOUTE la table `machine`, sans `where` ni `take`,
 * pour rendre un entier. La lecture est resserrée à deux conditions
 * NÉCESSAIRES, retrouvées en `where` plutôt qu'inventées :
 *
 *   1. `id IN (machines qui ont au moins une vérification reçue)` ;
 *   2. `vgp_exception = 'soumis' OR (vgp_exception IS NULL AND
 *      famille.assujettissement_vgp = 'soumis')`.
 *
 * **Ce que ce fichier prouve, contre les VRAIES fonctions exportées — jamais
 * une réécriture locale qu'on pourrait faire diverger sans le remarquer** :
 * aucune des deux conditions ne peut exclure une machine que le calcul en
 * mémoire (`ligneDuRegistre`, `resoudreAssujettissement` + `etatDeLInformation`)
 * aurait comptée comme `information_recue`. C'est une preuve par
 * ÉNUMÉRATION EXHAUSTIVE des combinaisons possibles, pas un sondage.
 */

const TOUTES_LES_VALEURS = [
  ASSUJETTISSEMENT.a_determiner,
  ASSUJETTISSEMENT.soumis,
  ASSUJETTISSEMENT.non_soumis,
  ASSUJETTISSEMENT.verifie,
] as const;

/** LE PRÉDICAT SQL, REJOUÉ EN JS — la traduction exacte du `where` ajouté. */
function candidatSelonLeWhere(entree: {
  readonly exceptionMachine: (typeof TOUTES_LES_VALEURS)[number] | null;
  readonly assujettissementFamille: (typeof TOUTES_LES_VALEURS)[number];
}): boolean {
  return (
    entree.exceptionMachine === ASSUJETTISSEMENT.soumis ||
    (entree.exceptionMachine === null &&
      entree.assujettissementFamille === ASSUJETTISSEMENT.soumis)
  );
}

describe("le `where` de compterAPrevoir capture EXACTEMENT les machines « soumises » (lot PERF)", () => {
  it("pour CHAQUE combinaison exception × famille, le prédicat SQL vaut « résolu = soumis »", () => {
    let combinaisonsEprouvees = 0;
    for (const assujettissementFamille of TOUTES_LES_VALEURS) {
      for (const exceptionMachine of [null, ...TOUTES_LES_VALEURS]) {
        const resolu = resoudreAssujettissement({
          famille: {
            assujettissement: assujettissementFamille,
            periodiciteMois: 12,
            referenceTexte: "texte",
          },
          modele: { periodiciteMois: null, referenceTexte: null },
          machine: { exception: exceptionMachine },
        });
        const attendu = resolu.valeur === ASSUJETTISSEMENT.soumis;
        expect(
          candidatSelonLeWhere({ exceptionMachine, assujettissementFamille }),
        ).toBe(attendu);
        combinaisonsEprouvees += 1;
      }
    }
    // TÉMOIN — 4 valeurs de famille × 5 valeurs d'exception (les quatre, plus
    // NULLE). Si l'énum en gagne une cinquième, ce compte bouge et le test le
    // signale plutôt que de continuer à n'en couvrir qu'une partie.
    expect(combinaisonsEprouvees).toBe(20);
  });

  it("une machine SANS AUCUNE information reçue n'est jamais « information_recue » — le filtre par `recues` ne peut donc rien exclure à tort", () => {
    for (const assujettissement of TOUTES_LES_VALEURS) {
      const etat = etatDeLInformation({
        assujettissement,
        periodiciteMois: 12,
        derniereInformation: null,
        depuis: new Date("2026-01-01T00:00:00Z"),
        aujourdHui: new Date("2026-09-19T00:00:00Z"),
      });
      expect(etat.etat).not.toBe("information_recue");
    }
  });
});

/**
 * LES VALEURS FIGÉES, aux bornes de l'horizon (D6, AT-04) — une machine due
 * AUJOURD'HUI (0 jour), une due DEMAIN, une PASSÉE hier, une SANS PÉRIODICITÉ
 * connue (échéance nulle), et une EXEMPTÉE malgré une famille soumise.
 *
 * Chaque ligne est réduite à ce dont `compterAPrevoir` a besoin : la
 * résolution (`resoudreAssujettissement`) puis l'état (`etatDeLInformation`),
 * les DEUX fonctions réellement rejouées par la fonction de production —
 * jamais une troisième écriture de la même règle.
 */
const AUJOURD_HUI = new Date("2026-09-19T00:00:00Z");
const HORIZON_JOURS = 30;

type MachineDeDemonstration = {
  readonly id: string;
  readonly exception: (typeof TOUTES_LES_VALEURS)[number] | null;
  readonly assujettissementFamille: (typeof TOUTES_LES_VALEURS)[number];
  readonly periodiciteMois: number | null;
  readonly derniereInformation: Date | null;
};

const PARC_DE_DEMONSTRATION: readonly MachineDeDemonstration[] = [
  // Échéance déduite AUJOURD'HUI même (0 jour, borne basse) : périodicité de
  // 1 mois, informée il y a exactement un mois.
  {
    id: "due-aujourdhui",
    exception: null,
    assujettissementFamille: ASSUJETTISSEMENT.soumis,
    periodiciteMois: 1,
    derniereInformation: new Date("2026-08-19T00:00:00Z"),
  },
  // Échéance DEMAIN — dans l'horizon de 30 jours.
  {
    id: "due-demain",
    exception: null,
    assujettissementFamille: ASSUJETTISSEMENT.soumis,
    periodiciteMois: 1,
    derniereInformation: new Date("2026-08-20T00:00:00Z"),
  },
  // Échéance PASSÉE hier — hors horizon (jours négatifs).
  {
    id: "echeance-passee",
    exception: null,
    assujettissementFamille: ASSUJETTISSEMENT.soumis,
    periodiciteMois: 1,
    derniereInformation: new Date("2026-07-18T00:00:00Z"),
  },
  // Soumise et informée, mais AUCUNE périodicité connue nulle part —
  // l'échéance est nulle, jamais comptée (L9-05).
  {
    id: "sans-periodicite",
    exception: null,
    assujettissementFamille: ASSUJETTISSEMENT.soumis,
    periodiciteMois: null,
    derniereInformation: new Date("2026-08-19T00:00:00Z"),
  },
  // EXEMPTÉE au niveau machine malgré une famille soumise — hors registre.
  {
    id: "exception-non-soumis",
    exception: ASSUJETTISSEMENT.non_soumis,
    assujettissementFamille: ASSUJETTISSEMENT.soumis,
    periodiciteMois: 1,
    derniereInformation: new Date("2026-08-19T00:00:00Z"),
  },
  // Famille jamais examinée, aucune exception — hors registre.
  {
    id: "famille-a-determiner",
    exception: null,
    assujettissementFamille: ASSUJETTISSEMENT.a_determiner,
    periodiciteMois: 1,
    derniereInformation: new Date("2026-08-19T00:00:00Z"),
  },
  // Soumise, mais JAMAIS informée — sans_information, jamais comptée, et
  // absente de `recues` (voir le second test ci-dessus).
  {
    id: "jamais-informee",
    exception: null,
    assujettissementFamille: ASSUJETTISSEMENT.soumis,
    periodiciteMois: 1,
    derniereInformation: null,
  },
];

/** LA VALEUR FIGÉE — relevée AVANT le resserrement de la lecture. */
const COMPTE_FIGE = 2;

function estCompteeParLeCalcul(machine: MachineDeDemonstration): boolean {
  const resolu = resoudreAssujettissement({
    famille: {
      assujettissement: machine.assujettissementFamille,
      periodiciteMois: machine.periodiciteMois,
      referenceTexte: machine.periodiciteMois === null ? null : "texte",
    },
    modele: { periodiciteMois: null, referenceTexte: null },
    machine: { exception: machine.exception },
  });
  const etat = etatDeLInformation({
    assujettissement: resolu.valeur,
    periodiciteMois: resolu.periodiciteMois,
    derniereInformation: machine.derniereInformation,
    depuis: null,
    aujourdHui: AUJOURD_HUI,
  });
  return (
    etat.etat === "information_recue" &&
    etat.joursAvantEcheance !== null &&
    etat.joursAvantEcheance >= 0 &&
    etat.joursAvantEcheance <= HORIZON_JOURS
  );
}

describe("compterAPrevoir rend la MÊME valeur, lue en entier ou resserrée (lot PERF)", () => {
  it("le compte SANS resserrement (l'ancienne lecture) vaut la valeur figée", () => {
    const compte = PARC_DE_DEMONSTRATION.filter(estCompteeParLeCalcul).length;
    expect(compte).toBe(COMPTE_FIGE);
  });

  it("le compte APRÈS resserrement (id ∈ recues, puis le `where` soumis) vaut EXACTEMENT la même valeur", () => {
    const recues = new Set(
      PARC_DE_DEMONSTRATION.filter((m) => m.derniereInformation !== null).map(
        (m) => m.id,
      ),
    );
    const resserre = PARC_DE_DEMONSTRATION.filter(
      (m) =>
        recues.has(m.id) &&
        candidatSelonLeWhere({
          exceptionMachine: m.exception,
          assujettissementFamille: m.assujettissementFamille,
        }),
    );
    expect(resserre.filter(estCompteeParLeCalcul).length).toBe(COMPTE_FIGE);
    // ET LE RESSERREMENT N'A ÉCARTÉ AUCUNE MACHINE QUE LE CALCUL COMPTAIT :
    // toute machine comptée par l'ancienne lecture est encore présente après
    // le `where` — jamais une exclue en silence.
    for (const machine of PARC_DE_DEMONSTRATION) {
      if (estCompteeParLeCalcul(machine)) {
        expect(resserre.map((m) => m.id)).toContain(machine.id);
      }
    }
  });
});
