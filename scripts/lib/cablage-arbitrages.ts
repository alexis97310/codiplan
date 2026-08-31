/**
 * Ticket R0-b — le câblage bidirectionnel entre le chapitre 10 (les règles) et
 * `docs/arbitrages.md` (les décisions qui les amendent).
 *
 * Écart É8 de la revue R0 : neuf règles du chapitre 10 avaient été réécrites
 * par une décision de rang 1, et aucune ne l'avait été dans le texte. D47
 * conclut qu'« un arbitrage qui corrige un mot doit dire où ce mot est écrit »
 * — et ne s'est pas appliqué à lui-même. Une décision qui prescrit une
 * réécriture sans mécanisme de vérification est une décision qu'on CROIT
 * prise. Ce module est ce mécanisme.
 *
 * LA POPULATION, ET LE PIÈGE QU'ELLE CONTIENT *(§9 du CLAUDE.md, 31/08)*.
 * La façon naturelle d'écrire ce contrôle est « pour chaque règle qui porte
 * une mention d'amendement, vérifier que l'arbitrage cité la cite en retour ».
 * Cette sélection exclut exactement les règles qui n'en portent AUCUNE —
 * c'est-à-dire les neuf qui étaient cassées. L'analyse part donc de
 * l'ENSEMBLE des règles du chapitre 10 et de l'ENSEMBLE des décisions du
 * recueil : une mention absente est un écart, jamais une sortie du périmètre.
 */

/** Une règle de gestion du chapitre 10. */
export type Regle = {
  readonly ref: string;
  readonly texte: string;
  /** Arbitrages cités par la mention `*(amendée par Dxx)*`. Vide si aucune. */
  readonly arbitragesCites: readonly string[];
};

/** Une décision du recueil d'arbitrages. */
export type Decision = {
  readonly ref: string;
  readonly titre: string;
  /** Règles citées par la ligne `**Règles amendées :**`. Vide si aucune. */
  readonly reglesDeclarees: readonly string[];
  /**
   * Règles que la PROSE de la décision affirme réécrire, sans passer par la
   * ligne de déclaration. C'est la troisième vérification : une décision qui
   * écrit « RG-XXX-nn est réécrite » sans la déclarer est exactement le
   * défaut d'É8, et il est refusé à la source.
   */
  readonly reglesAffirmeesEnProse: readonly string[];
};

/** Une paire (décision, règle) — l'unité que les deux listes doivent partager. */
export type Paire = { readonly decision: string; readonly regle: string };

export type Analyse = {
  readonly regles: readonly Regle[];
  readonly decisions: readonly Decision[];
  /** Paires vues depuis les règles : la mention `*(amendée par Dxx)*`. */
  readonly pairesDepuisRegles: readonly Paire[];
  /** Paires vues depuis les arbitrages : la ligne `**Règles amendées :**`. */
  readonly pairesDepuisArbitrages: readonly Paire[];
  /** Paires effectivement câblées des deux côtés. */
  readonly pairesAccordees: readonly Paire[];
  readonly ecarts: readonly string[];
};

const REF_REGLE = "RG-[A-Z]{3}-[0-9]{2}";

const LIGNE_REGLE = new RegExp(`^\\|\\s*(${REF_REGLE})\\s*\\|(.*)\\|\\s*$`);

/**
 * La mention portée par une règle amendée. Le commentaire libre qui suit le
 * tiret cadratin est autorisé — il n'entre pas dans la liste des références.
 */
const MENTION_AMENDEMENT =
  /\*\(amendée par (D\d+(?:,\s*D\d+)*)(?:\s+—[^)]*)?\)\*/g;

/** La ligne de déclaration portée par une décision qui amende des règles. */
const DECLARATION_REGLES = new RegExp(
  `^\\*\\*Règles amendées :\\*\\*\\s*(${REF_REGLE}(?:,\\s*${REF_REGLE})*)\\s*$`,
);

/** Un titre de section de décision : `### D6 — …`, `## D52 — …`. */
const TITRE_DECISION = /^#{2,4}\s+(D\d+)\b\s*(.*)$/;

/** N'importe quel titre — il ferme la section ouverte. */
const TITRE_QUELCONQUE = /^#{1,6}\s+/;

/**
 * La prose qui affirme un amendement. Deux formes, relevées dans le recueil :
 * « RG-XXX-nn est réécrite / précisée / assouplie / alignée », et
 * « inscrite au chapitre 10 comme RG-XXX-nn » (D40, qui CRÉE la règle).
 * Les mentions de simple appui — « RG-INT-03 reste donc simple »,
 * « le chapitre 10 (RG-TAR-02) était déjà juste » — n'en sont pas.
 */
const VERBES_AMENDEMENT = [
  "réécrite",
  "réécrites",
  "reformulée",
  "reformulées",
  "précisée",
  "précisées",
  "assouplie",
  "assouplies",
  "alignée",
  "alignées",
  "amendée",
  "amendées",
  "corrigée",
  "corrigées",
  "remplacée",
  "remplacées",
  "complétée",
  "complétées",
].join("|");

const PROSE_AMENDEMENT = new RegExp(
  `(${REF_REGLE})\\s*\\*{0,2}\\s+(?:est|sont)\\s+\\*{0,2}(?:${VERBES_AMENDEMENT})\\b`,
  "g",
);

const PROSE_INTRODUCTION = new RegExp(
  `inscrite au chapitre 10 comme\\s*\\*{0,2}(${REF_REGLE})`,
  "g",
);

/**
 * Troisième forme : la RÉDACTION CITÉE. D25 et D47 n'annoncent pas « RG-xxx est
 * réécrite » — ils donnent directement le texte de remplacement en citation,
 * `> RG-INT-10 — …`. Une citation qui restitue une règle EST une réécriture.
 *
 * Ce que ce relevé n'attrape pas, et il vaut mieux l'écrire que le laisser
 * croire *(§9, forme 6)* : une décision qui amende une règle sans jamais en
 * écrire la référence. Aucun motif statique ne peut la voir ; seule la ligne
 * `**Règles amendées :**`, posée à la main, la rattrape.
 */
const PROSE_REDACTION_CITEE = new RegExp(
  `^>\\s*\\*{0,2}(${REF_REGLE})\\*{0,2}\\s*—`,
  "gm",
);

function uniqueTriee(refs: readonly string[]): string[] {
  return [...new Set(refs)].sort();
}

function cle(paire: Paire): string {
  return `${paire.decision} ↔ ${paire.regle}`;
}

/**
 * Découpe le chapitre 10 du cahier des charges. Le chapitre 11 en est exclu :
 * il est de rang 3, il ne porte pas de règle, et l'y inclure ferait entrer des
 * citations dans la population des règles.
 */
export function extraireChapitre10(cahierDesCharges: string): string {
  const lignes = cahierDesCharges.split("\n");
  const debut = lignes.findIndex((l) => /^##\s+10\.\s/.test(l));
  if (debut === -1) {
    throw new Error(
      "chapitre 10 introuvable dans le cahier des charges : le contrôle du câblage ne peut pas s'exercer",
    );
  }
  const suite = lignes.slice(debut + 1).findIndex((l) => /^##\s/.test(l));
  const fin = suite === -1 ? lignes.length : debut + 1 + suite;
  return lignes.slice(debut, fin).join("\n");
}

/** Toutes les règles du chapitre 10, amendées ou non. */
export function lireRegles(cahierDesCharges: string): {
  regles: Regle[];
  ecarts: string[];
} {
  const ecarts: string[] = [];
  const regles: Regle[] = [];

  for (const ligne of extraireChapitre10(cahierDesCharges).split("\n")) {
    const entete = LIGNE_REGLE.exec(ligne);
    if (!entete) continue;
    const [, ref, texte] = entete;

    MENTION_AMENDEMENT.lastIndex = 0;
    const cites: string[] = [];
    let nombreDeMentions = 0;
    for (const m of texte.matchAll(MENTION_AMENDEMENT)) {
      nombreDeMentions += 1;
      cites.push(...m[1].split(",").map((r) => r.trim()));
    }

    // Une mention mal formée ne doit JAMAIS être ignorée : elle passerait pour
    // une absence de mention, c'est-à-dire pour un état légitime.
    const occurrencesBrutes = (texte.match(/amendée par/g) ?? []).length;
    if (occurrencesBrutes !== nombreDeMentions) {
      ecarts.push(
        `${ref} : mention d'amendement mal formée — la forme attendue est « *(amendée par D6, D47 — commentaire)* »`,
      );
    }

    regles.push({ ref, texte, arbitragesCites: uniqueTriee(cites) });
  }

  const doublons = regles
    .map((r) => r.ref)
    .filter((ref, i, tout) => tout.indexOf(ref) !== i);
  for (const ref of uniqueTriee(doublons)) {
    ecarts.push(`${ref} : référence de règle en double au chapitre 10`);
  }

  return { regles, ecarts };
}

/** Toutes les décisions du recueil, amendantes ou non. */
export function lireDecisions(arbitrages: string): {
  decisions: Decision[];
  ecarts: string[];
} {
  const ecarts: string[] = [];
  const sections = new Map<string, { titre: string; corps: string[] }>();
  let courante: { ref: string; corps: string[] } | undefined;

  for (const ligne of arbitrages.split("\n")) {
    const titre = TITRE_DECISION.exec(ligne);
    if (titre) {
      const [, ref, reste] = titre;
      // `#### D46, complément 1 — …` prolonge D46 : ce n'est pas une décision
      // de plus, et en ouvrir une seconde tronquerait la première.
      if (courante?.ref !== ref) {
        courante = { ref, corps: [] };
        const deja = sections.get(ref);
        if (deja) {
          ecarts.push(
            `${ref} : deux sections distinctes portent cette référence`,
          );
          courante.corps = deja.corps;
        } else {
          sections.set(ref, { titre: reste.trim(), corps: courante.corps });
        }
      }
      continue;
    }
    if (TITRE_QUELCONQUE.test(ligne)) {
      courante = undefined;
      continue;
    }
    courante?.corps.push(ligne);
  }

  const decisions: Decision[] = [];
  for (const [ref, { titre, corps }] of sections) {
    const declarees: string[] = [];
    let nombreDeDeclarations = 0;
    let nombreBrut = 0;
    for (const ligne of corps) {
      if (ligne.startsWith("**Règles amendées")) nombreBrut += 1;
      const m = DECLARATION_REGLES.exec(ligne);
      if (!m) continue;
      nombreDeDeclarations += 1;
      declarees.push(...m[1].split(",").map((r) => r.trim()));
    }
    if (nombreBrut !== nombreDeDeclarations) {
      ecarts.push(
        `${ref} : ligne de déclaration mal formée — la forme attendue est « **Règles amendées :** RG-PLA-01, RG-PLA-02 »`,
      );
    }

    const texte = corps.join("\n");
    const enProse: string[] = [];
    for (const m of texte.matchAll(PROSE_AMENDEMENT)) enProse.push(m[1]);
    for (const m of texte.matchAll(PROSE_INTRODUCTION)) enProse.push(m[1]);
    for (const m of texte.matchAll(PROSE_REDACTION_CITEE)) enProse.push(m[1]);

    decisions.push({
      ref,
      titre,
      reglesDeclarees: uniqueTriee(declarees),
      reglesAffirmeesEnProse: uniqueTriee(enProse),
    });
  }

  return { decisions, ecarts };
}

/**
 * Le contrôle lui-même. Il ne SÉLECTIONNE rien : toute règle et toute décision
 * entrent dans la population, y compris celles qui ne citent personne.
 */
export function analyserCablage(
  cahierDesCharges: string,
  arbitrages: string,
): Analyse {
  const { regles, ecarts: ecartsRegles } = lireRegles(cahierDesCharges);
  const { decisions, ecarts: ecartsDecisions } = lireDecisions(arbitrages);
  const ecarts = [...ecartsRegles, ...ecartsDecisions];

  const refsRegles = new Set(regles.map((r) => r.ref));
  const refsDecisions = new Set(decisions.map((d) => d.ref));

  const pairesDepuisRegles: Paire[] = [];
  for (const regle of regles) {
    for (const decision of regle.arbitragesCites) {
      pairesDepuisRegles.push({ decision, regle: regle.ref });
      if (!refsDecisions.has(decision)) {
        ecarts.push(
          `${regle.ref} cite ${decision}, qui n'existe pas dans docs/arbitrages.md`,
        );
      }
    }
  }

  const pairesDepuisArbitrages: Paire[] = [];
  for (const decision of decisions) {
    for (const regle of decision.reglesDeclarees) {
      pairesDepuisArbitrages.push({ decision: decision.ref, regle });
      if (!refsRegles.has(regle)) {
        ecarts.push(
          `${decision.ref} déclare amender ${regle}, qui n'existe pas au chapitre 10`,
        );
      }
    }
    for (const regle of decision.reglesAffirmeesEnProse) {
      if (!decision.reglesDeclarees.includes(regle)) {
        ecarts.push(
          `${decision.ref} affirme en prose amender ${regle} mais ne la déclare pas — ajouter « **Règles amendées :** ${regle} »`,
        );
      }
    }
  }

  const vuesDesRegles = new Set(pairesDepuisRegles.map(cle));
  const vuesDesArbitrages = new Set(pairesDepuisArbitrages.map(cle));

  for (const paire of pairesDepuisArbitrages) {
    if (!vuesDesRegles.has(cle(paire)) && refsRegles.has(paire.regle)) {
      ecarts.push(
        `${paire.decision} déclare amender ${paire.regle}, mais ${paire.regle} ne cite pas ${paire.decision} au chapitre 10`,
      );
    }
  }
  for (const paire of pairesDepuisRegles) {
    if (
      !vuesDesArbitrages.has(cle(paire)) &&
      refsDecisions.has(paire.decision)
    ) {
      ecarts.push(
        `${paire.regle} cite ${paire.decision}, mais ${paire.decision} ne déclare pas amender ${paire.regle}`,
      );
    }
  }

  const pairesAccordees = pairesDepuisRegles.filter((p) =>
    vuesDesArbitrages.has(cle(p)),
  );

  return {
    regles,
    decisions,
    pairesDepuisRegles,
    pairesDepuisArbitrages,
    pairesAccordees,
    ecarts: uniqueTriee(ecarts),
  };
}
