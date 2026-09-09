import { lireDecisions, type Decision } from "./cablage-arbitrages";
import { amendementsDeDecisions } from "./coherence-backlog";

/**
 * LE CÂBLAGE ARBITRAGE ↔ ARBITRAGE — une décision amendée par une décision
 * postérieure porte la marque, dans les deux sens (nuit du 10/09/2026).
 *
 * ## Le trou, et pourquoi réparer cinq décisions ne l'aurait pas fermé
 *
 * La passe du 09/09 sur les décisions de rang 1 a trouvé CINQ décisions
 * rendues fausses par une décision ultérieure, sans marque : D11 (D68 retire
 * `forfait.heures_incluses`), D13 (D46 renverse l'ordre de lecture des
 * fériés), D14 (`format:check` entre dans `verify`), D10 (`perimetre_sites`
 * devient une table), D28 (`fusionnee` absent de l'énumération). **Aucun
 * gardien ne pouvait le voir** : le câblage de R0-b vérifie les paires
 * règle ↔ arbitrage, jamais arbitrage ↔ arbitrage. Réparer les cinq aurait
 * refait le geste qui venait d'échouer — *une liste close se re-vérifie à
 * chaque objet créé, sinon elle devient fausse* (§9, 20/08).
 *
 * ## Ce que ce module vérifie
 *
 * Deux marques, une par côté, et le gardien exige qu'elles s'accordent :
 *
 * - dans la décision AMENDÉE : `**Amendé par D52, D53.**` — la forme que
 *   `coherence-backlog` lit déjà pour la clôture des citations. Elle n'est pas
 *   recopiée ici : `amendementsDeDecisions` est importée, une seule lecture ;
 * - dans la décision AMENDANTE : `**Décisions amendées :** D32, D52` — le
 *   miroir de `**Règles amendées :**`.
 *
 * Et une troisième chose, qui est le défaut d'origine : une PROSE qui affirme
 * l'amendement — « D19 est donc amendé », « D71 amende D7 », « *(amendé par
 * D71)* » — sans que la marque suive. Elle est refusée à la source.
 *
 * **Fermé contre le fichier des arbitrages, jamais contre une liste** : la
 * population est l'ENSEMBLE des décisions, et une marque absente est un écart,
 * jamais une sortie du périmètre (§9, 31/08).
 *
 * ## Ce qu'il ne peut PAS voir, et qui est écrit plutôt que tu
 *
 * 1. Une décision amendée par quelque chose qui n'est pas une décision numérotée
 *    — un ticket (L1-02b pour D10), une question tranchée hors registre (Q4 pour
 *    D11), un incident (le 02/09 pour D14). Trois des cinq de la passe sont de
 *    cette espèce : elles sont MARQUÉES dans le texte, et la question de leur
 *    numérotation est inscrite au registre.
 * 2. Une décision qui amende sans jamais écrire la référence de ce qu'elle
 *    amende — la forme 6 du §9 (26/08), qu'aucun motif statique n'arrête.
 * 3. Une marque placée SOUS un sous-titre `###` d'une décision : le parseur des
 *    décisions ferme une section au premier titre, quel que soit son niveau.
 *    Les marques se posent dans le préambule, avant le premier sous-titre.
 */

/** Une paire (amendée, amendante) — l'unité que les deux côtés doivent partager. */
export type Amendement = {
  readonly amendee: string;
  readonly amendante: string;
};

export type AnalyseAmendements = {
  readonly decisions: readonly Decision[];
  /** Paires vues depuis les décisions amendées : `**Amendé par Dxx.**`. */
  readonly depuisAmendees: readonly Amendement[];
  /** Paires vues depuis les décisions amendantes : `**Décisions amendées :** Dxx`. */
  readonly depuisAmendantes: readonly Amendement[];
  /** Paires effectivement câblées des deux côtés. */
  readonly accordees: readonly Amendement[];
  /** Affirmations en prose, avec la décision qui les porte. */
  readonly affirmationsEnProse: readonly Amendement[];
  readonly ecarts: readonly string[];
};

const DECLARATION_DECISIONS =
  /^\*\*Décisions amendées :\*\*\s*(D\d+(?:,\s*D\d+)*)\s*$/;
const DECLARATION_APPROXIMATIVE = /^\*\*Décisions amendées/;

/**
 * La prose qui affirme un amendement, telle qu'elle est écrite dans le recueil :
 *
 * - dans l'AMENDANTE : « D19 est donc amendé », « D19 est corrigé », « D71
 *   amende D7 », « répare D7 » ;
 * - dans l'AMENDÉE : « *(amendé par D71 — …)* », « amendée par D46 ».
 *
 * « D15 amendé mesure… » — l'état amendé cité au passage — n'en est pas une.
 */
// `\b` est ASCII en JavaScript : après « amendé » il n'y a PAS de frontière
// de mot, « é » n'étant pas un caractère de mot. Mesuré : « D19 est donc
// amendé, » n'était pas reconnu. La frontière s'écrit donc en Unicode.
const PROSE_AMENDANTE_SUJET =
  /(?<!\p{L})D(\d+)\s+est\s+(?:donc\s+)?(?:amendée?|corrigée?|réécrite?|remplacée?|réparée?)(?!\p{L})/gu;
const PROSE_AMENDANTE_OBJET =
  /(?<!\p{L})(?:amende|répare|corrige|remplace|réécrit)\s+D(\d+)(?!\d)/gu;
const PROSE_AMENDEE = /(?<!\p{L})amendée?\s+par\s+D(\d+)(?!\d)/gu;

/** Numéro d'une référence `Dnn`, pour vérifier l'ordre. */
function numero(ref: string): number {
  return Number(ref.slice(1));
}

function cle(a: Amendement): string {
  return `${a.amendee} ← ${a.amendante}`;
}

function uniqueTriee(refs: readonly string[]): string[] {
  return [...new Set(refs)].sort();
}

export function analyserAmendements(arbitrages: string): AnalyseAmendements {
  const { decisions, ecarts: ecartsLecture } = lireDecisions(arbitrages);
  const ecarts: string[] = [...ecartsLecture];
  const refs = new Set(decisions.map((d) => d.ref));

  // ── Côté AMENDÉ : `**Amendé par …**`, lu par coherence-backlog ────────────
  const { amendeurs, ecarts: ecartsAmendeurs } =
    amendementsDeDecisions(decisions);
  ecarts.push(...ecartsAmendeurs);
  const depuisAmendees: Amendement[] = [];
  for (const [amendee, amendantes] of amendeurs) {
    for (const amendante of amendantes) {
      depuisAmendees.push({ amendee, amendante });
    }
  }

  // ── Côté AMENDANT : `**Décisions amendées :** …` ─────────────────────────
  const depuisAmendantes: Amendement[] = [];
  const affirmationsEnProse: Amendement[] = [];
  for (const decision of decisions) {
    const lignes = decision.corps.split("\n");
    const approximatives = lignes.filter((l) =>
      DECLARATION_APPROXIMATIVE.test(l),
    ).length;
    let declarations = 0;
    for (const ligne of lignes) {
      const m = DECLARATION_DECISIONS.exec(ligne);
      if (!m) continue;
      declarations += 1;
      for (const amendee of m[1].split(",").map((r) => r.trim())) {
        depuisAmendantes.push({ amendee, amendante: decision.ref });
      }
    }
    if (approximatives !== declarations) {
      ecarts.push(
        `${decision.ref} : ligne de déclaration mal formée — la forme attendue est « **Décisions amendées :** D15, D19 »`,
      );
    }

    // La prose. Le titre en fait partie : « D44 — D19 est corrigé, pas contourné ».
    const texte = `${decision.titre}\n${decision.corps}`;
    const enProse = new Set<string>();
    for (const m of texte.matchAll(PROSE_AMENDANTE_SUJET))
      enProse.add(`D${m[1]}`);
    for (const m of texte.matchAll(PROSE_AMENDANTE_OBJET))
      enProse.add(`D${m[1]}`);
    for (const amendee of enProse) {
      if (amendee === decision.ref) continue;
      affirmationsEnProse.push({ amendee, amendante: decision.ref });
    }
    for (const m of texte.matchAll(PROSE_AMENDEE)) {
      const amendante = `D${m[1]}`;
      if (amendante === decision.ref) continue;
      affirmationsEnProse.push({ amendee: decision.ref, amendante });
    }
  }

  const vuesAmendees = new Set(depuisAmendees.map(cle));
  const vuesAmendantes = new Set(depuisAmendantes.map(cle));

  for (const paire of depuisAmendees) {
    if (!refs.has(paire.amendante)) {
      ecarts.push(
        `${paire.amendee} se dit amendée par ${paire.amendante}, qui n'existe pas dans docs/arbitrages.md`,
      );
    } else if (!vuesAmendantes.has(cle(paire))) {
      ecarts.push(
        `${paire.amendee} se dit amendée par ${paire.amendante}, mais ${paire.amendante} ne déclare pas « **Décisions amendées :** ${paire.amendee} »`,
      );
    }
  }
  for (const paire of depuisAmendantes) {
    if (!refs.has(paire.amendee)) {
      ecarts.push(
        `${paire.amendante} déclare amender ${paire.amendee}, qui n'existe pas dans docs/arbitrages.md`,
      );
    } else if (!vuesAmendees.has(cle(paire))) {
      ecarts.push(
        `${paire.amendante} déclare amender ${paire.amendee}, mais ${paire.amendee} ne porte pas « **Amendé par ${paire.amendante}.** »`,
      );
    }
    if (paire.amendee === paire.amendante) {
      ecarts.push(`${paire.amendante} déclare s'amender elle-même`);
    } else if (
      refs.has(paire.amendee) &&
      numero(paire.amendante) <= numero(paire.amendee)
    ) {
      // Une décision est amendée par une décision POSTÉRIEURE. L'inverse
      // signalerait une paire écrite à l'envers — et un gardien qui la
      // laisserait passer câblerait le contraire de ce qu'on croit.
      ecarts.push(
        `${paire.amendante} déclare amender ${paire.amendee}, qui lui est postérieure : la paire est écrite à l'envers`,
      );
    }
  }
  for (const affirmation of affirmationsEnProse) {
    if (!refs.has(affirmation.amendee) || !refs.has(affirmation.amendante)) {
      continue;
    }
    if (!vuesAmendantes.has(cle(affirmation))) {
      ecarts.push(
        `${affirmation.amendante} affirme en prose amender ${affirmation.amendee} mais ne le déclare pas — ajouter « **Décisions amendées :** ${affirmation.amendee} » à ${affirmation.amendante} et « **Amendé par ${affirmation.amendante}.** » à ${affirmation.amendee}`,
      );
    }
  }

  const accordees = depuisAmendees.filter((p) => vuesAmendantes.has(cle(p)));

  return {
    decisions,
    depuisAmendees,
    depuisAmendantes,
    accordees,
    affirmationsEnProse,
    ecarts: uniqueTriee(ecarts),
  };
}
